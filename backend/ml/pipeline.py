"""
pipeline.py — End-to-end orchestration of the Kryptos ML pipeline.

This is the single entry-point that ties every module together:

    raw transactions  →  graph  →  features  →  anomaly scores
                                                      ↓
                                                  clusters  →  risk scores  →  report

The function `run_pipeline()` accepts a list of transaction dicts and returns
a JSON-serialisable report ready for consumption by any downstream system
(API, CLI, dashboard, etc.).
"""

from typing import List, Dict, Any
import json

from .graph_builder import build_transaction_graph, get_graph_summary
from .features import compute_wallet_features
from .anomaly_detection import detect_anomalies
from .cluster_analysis import find_anomalous_clusters, score_clusters
from .explainability import explain_all_clusters


def run_pipeline(
    transactions: List[Dict[str, Any]],
    contamination: float = 0.15,
    n_estimators: int = 200,
    random_state: int = 42,
    verbose: bool = True,
) -> Dict[str, Any]:
    """
    Execute the full Kryptos ML pipeline.

    Parameters
    ----------
    transactions : list of dict
        Each dict: {"from": str, "to": str, "value": float, "timestamp": int}
    contamination : float
        Isolation Forest contamination parameter (expected anomaly fraction).
    n_estimators : int
        Number of trees in the Isolation Forest.
    random_state : int
        For reproducibility.
    verbose : bool
        Print progress to stdout.

    Returns
    -------
    dict
        {
          "graph_summary": {...},
          "total_wallets": int,
          "anomalous_wallets": int,
          "clusters": [ {...report per cluster...} ],
          "wallet_scores": { wallet: anomaly_score }
        }
    """
    # ------------------------------------------------------------------
    # Step 1: Build directed transaction graph
    # ------------------------------------------------------------------
    if verbose:
        print("[1/6] Building transaction graph...")
    G = build_transaction_graph(transactions)
    graph_summary = get_graph_summary(G)
    if verbose:
        print(f"      {graph_summary['num_wallets']} wallets, "
              f"{graph_summary['num_transactions']} transactions")

    # ------------------------------------------------------------------
    # Step 2: Feature engineering
    # ------------------------------------------------------------------
    if verbose:
        print("[2/6] Computing wallet-level features...")
    feature_df = compute_wallet_features(G)

    # Guard: need at least a handful of wallets for Isolation Forest to be
    # statistically meaningful.
    if len(feature_df) < 5:
        if verbose:
            print("      WARNING: fewer than 5 wallets — results may be unreliable.")

    # ------------------------------------------------------------------
    # Step 3: Anomaly detection (scale → train → score)
    # ------------------------------------------------------------------
    if verbose:
        print("[3/6] Running anomaly detection (Isolation Forest)...")
    scored_df, model, scaler = detect_anomalies(
        feature_df,
        contamination=contamination,
        n_estimators=n_estimators,
        random_state=random_state,
    )
    n_anomalous = int(scored_df["is_anomalous"].sum())
    if verbose:
        print(f"      {n_anomalous} anomalous wallets detected "
              f"({n_anomalous / len(scored_df) * 100:.1f}%)")

    # ------------------------------------------------------------------
    # Step 4: Cluster anomalous wallets via connected components
    # ------------------------------------------------------------------
    if verbose:
        print("[4/6] Identifying coordinated clusters...")
    clusters = find_anomalous_clusters(G, scored_df)
    if verbose:
        print(f"      {len(clusters)} cluster(s) found")

    # ------------------------------------------------------------------
    # Step 5: Score clusters
    # ------------------------------------------------------------------
    if verbose:
        print("[5/6] Scoring clusters...")
    scored_clusters = score_clusters(clusters, G, scored_df)

    # ------------------------------------------------------------------
    # Step 6: Explainability
    # ------------------------------------------------------------------
    if verbose:
        print("[6/6] Generating explanations...")
    reports = explain_all_clusters(scored_clusters, G, scored_df)

    # ------------------------------------------------------------------
    # Assemble final output
    # ------------------------------------------------------------------
    wallet_scores = {
        wallet: round(float(row["anomaly_score"]), 4)
        for wallet, row in scored_df.iterrows()
    }

    output = {
        "graph_summary": graph_summary,
        "total_wallets": len(scored_df),
        "anomalous_wallets": n_anomalous,
        "clusters": reports,
        "wallet_scores": wallet_scores,
    }

    if verbose:
        print("\nPipeline complete.")
        print(f"  Total wallets analysed : {output['total_wallets']}")
        print(f"  Anomalous wallets      : {output['anomalous_wallets']}")
        print(f"  Clusters reported      : {len(output['clusters'])}")
        if reports:
            print(f"  Highest risk score     : {reports[0]['risk_score']}")

    return output


def pipeline_to_json(output: Dict[str, Any], indent: int = 2) -> str:
    """Serialise the pipeline output to a JSON string."""
    return json.dumps(output, indent=indent, default=str)

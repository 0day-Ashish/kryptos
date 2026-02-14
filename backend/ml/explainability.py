"""
explainability.py — Generate human-readable explanations for risky clusters.

WHY explainability?
Flagging a cluster as "risk_score 87" is useless if an analyst can't understand
*why*.  We derive concrete, evidence-based signals from the same features that
drove the anomaly scores, so every claim is traceable back to data.

Signals emitted (all are boolean or numeric):

1. high_internal_circulation
   – The cluster's internal transaction ratio exceeds a threshold.
   – Suggests fund cycling / wash-trading.

2. short_inter_tx_times
   – The mean inter-transaction gap inside the cluster is below a threshold.
   – Suggests automated / scripted behavior.

3. high_pass_through
   – A significant fraction of wallets have near-zero pass-through score
     relative to their volume, meaning they forward almost everything they receive.
   – Suggests layering / intermediary chains.

4. high_fan_out / high_fan_in
   – At least one wallet has disproportionately high out-degree or in-degree.
   – Suggests distribution hub or collection point.

5. predicted_exits
   – Wallets at the "edge" of the cluster (high out-degree to external wallets)
     that are likely cash-out / exit points.
"""

from typing import List, Dict, Any
import numpy as np
import networkx as nx
import pandas as pd


def _mean_internal_time_gap(sub: nx.MultiDiGraph) -> float:
    """Average time gap between consecutive internal transactions."""
    timestamps = sorted(
        data["timestamp"] for _, _, data in sub.edges(data=True)
    )
    if len(timestamps) < 2:
        return float("inf")
    gaps = np.diff(timestamps).astype(float)
    return float(np.mean(gaps))


def _pass_through_fraction(
    wallets: List[str], scored_df: pd.DataFrame, threshold_ratio: float = 0.15
) -> float:
    """
    Fraction of cluster wallets whose pass_through_score is ≤ threshold_ratio
    of their total volume.  A low pass-through score relative to volume means
    almost everything that comes in goes back out — classic intermediary.
    """
    count = 0
    for w in wallets:
        row = scored_df.loc[w]
        volume = row["total_in_amount"] + row["total_out_amount"]
        if volume == 0:
            continue
        if row["pass_through_score"] / volume <= threshold_ratio:
            count += 1
    return count / max(len(wallets), 1)


def _find_predicted_exits(
    wallets: List[str], G: nx.MultiDiGraph
) -> List[str]:
    """
    Identify wallets that are likely exit / cash-out points.

    Heuristic: wallets with high out-degree to *external* (non-cluster) addresses
    relative to their internal out-degree.  These are the endpoints from which
    funds leave the coordinated ring.
    """
    cluster_set = set(wallets)
    exits: List[str] = []

    for w in wallets:
        external_out = 0
        internal_out = 0
        for _, target, _ in G.out_edges(w, data=True):
            if target in cluster_set:
                internal_out += 1
            else:
                external_out += 1
        # A wallet is an exit candidate if it sends more externally than internally.
        if external_out > internal_out and external_out >= 2:
            exits.append(w)

    return exits


def explain_cluster(
    cluster: Dict[str, Any],
    G: nx.MultiDiGraph,
    scored_df: pd.DataFrame,
    # Thresholds (configurable per deployment context)
    internal_ratio_thresh: float = 0.50,
    time_gap_thresh: float = 120,         # seconds — 2 minutes
    pass_through_ratio: float = 0.15,
    fan_degree_thresh: int = 10,
) -> Dict[str, Any]:
    """
    Produce an explanation dict for a single scored cluster.

    Parameters
    ----------
    cluster : dict with keys cluster_id, wallets, subgraph, risk_score, etc.
    G : full transaction graph
    scored_df : feature + anomaly DataFrame
    Various thresholds for signal generation.

    Returns
    -------
    dict matching the target output schema:
        cluster_id, risk_score, wallets, signals, predicted_exits
    """
    wallets = cluster["wallets"]
    sub: nx.MultiDiGraph = cluster["subgraph"]

    signals: Dict[str, Any] = {}

    # 1. Internal circulation
    itr = cluster.get("internal_tx_ratio", 0.0)
    signals["high_internal_circulation"] = bool(itr >= internal_ratio_thresh)
    signals["internal_tx_ratio"] = itr

    # 2. Short inter-transaction times
    mean_gap = _mean_internal_time_gap(sub)
    signals["short_inter_tx_times"] = bool(mean_gap < time_gap_thresh)
    signals["mean_internal_time_gap_sec"] = round(mean_gap, 2) if mean_gap != float("inf") else None

    # 3. Pass-through behavior
    pt_frac = _pass_through_fraction(wallets, scored_df, pass_through_ratio)
    signals["high_pass_through"] = bool(pt_frac >= 0.40)
    signals["pass_through_wallet_fraction"] = round(pt_frac, 4)

    # 4. Fan-out / Fan-in hubs
    max_out = max((G.out_degree(w) for w in wallets), default=0)
    max_in = max((G.in_degree(w) for w in wallets), default=0)
    signals["high_fan_out"] = bool(max_out >= fan_degree_thresh)
    signals["max_out_degree"] = max_out
    signals["high_fan_in"] = bool(max_in >= fan_degree_thresh)
    signals["max_in_degree"] = max_in

    # 5. Cluster-level stats
    signals["avg_anomaly_score"] = cluster.get("avg_anomaly_score", 0.0)
    signals["cluster_size"] = cluster.get("cluster_size", len(wallets))

    # 6. Predicted exits
    predicted_exits = _find_predicted_exits(wallets, G)

    return {
        "cluster_id": cluster["cluster_id"],
        "risk_score": cluster["risk_score"],
        "wallets": wallets,
        "signals": signals,
        "predicted_exits": predicted_exits,
    }


def explain_all_clusters(
    scored_clusters: List[Dict[str, Any]],
    G: nx.MultiDiGraph,
    scored_df: pd.DataFrame,
    **kwargs,
) -> List[Dict[str, Any]]:
    """Run explainability on every scored cluster."""
    return [
        explain_cluster(c, G, scored_df, **kwargs)
        for c in scored_clusters
    ]

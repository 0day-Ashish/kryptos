"""
cluster_analysis.py — Detect coordinated behavior among anomalous wallets.

WHY subgraph + connected components?
After flagging individual wallets as anomalous, the next question is:
"Are any of these anomalous wallets *working together*?"

We answer this by:
1. Inducing a subgraph containing ONLY the anomalous wallets.
2. Finding weakly-connected components in that subgraph.
   (Weakly-connected because the direction of fund flow matters for scoring
    but not for grouping — if A→B and C→B, all three participate.)

Each connected component is a *cluster* of anomalous wallets that have
directly or transitively transacted with each other.  Isolated anomalous
wallets form singleton clusters (still reported but usually lower risk).

Cluster-level risk scoring combines:
- Mean anomaly score of member wallets  (how individually unusual they are)
- Internal transaction ratio            (what fraction of their activity is
                                          within the cluster — high ratio ⇒
                                          likely coordinated fund cycling)
- Cluster size                          (larger coordinated groups are rarer
                                          and harder to dismiss as coincidence)
"""

from typing import List, Dict, Any
import networkx as nx
import pandas as pd
import numpy as np


def find_anomalous_clusters(
    G: nx.MultiDiGraph, scored_df: pd.DataFrame
) -> List[Dict[str, Any]]:
    """
    Identify connected components among anomalous wallets.

    Parameters
    ----------
    G : nx.MultiDiGraph
        Full transaction graph.
    scored_df : pd.DataFrame
        Must contain columns 'is_anomalous' and 'anomaly_score', indexed by wallet.

    Returns
    -------
    list of dict
        Each dict: {"cluster_id": str, "wallets": [str], "subgraph": nx.MultiDiGraph}
    """
    anomalous_wallets = set(scored_df[scored_df["is_anomalous"]].index)
    if not anomalous_wallets:
        return []

    # Induce subgraph on anomalous wallets only.
    # This preserves all edges between anomalous nodes.
    subgraph = G.subgraph(anomalous_wallets).copy()

    clusters: List[Dict[str, Any]] = []
    for i, component in enumerate(nx.weakly_connected_components(subgraph)):
        wallets = sorted(component)
        clusters.append({
            "cluster_id": f"cluster_{i}",
            "wallets": wallets,
            "subgraph": subgraph.subgraph(wallets).copy(),
        })

    # Sort by size descending so largest clusters come first.
    clusters.sort(key=lambda c: len(c["wallets"]), reverse=True)
    # Re-index after sort.
    for i, c in enumerate(clusters):
        c["cluster_id"] = f"cluster_{i}"

    return clusters


def _internal_tx_ratio(cluster_subgraph: nx.MultiDiGraph, G: nx.MultiDiGraph) -> float:
    """
    Fraction of transactions among cluster wallets that stay *inside* the cluster.

    internal_tx_ratio = (edges inside cluster) / (all edges touching cluster members)

    A ratio close to 1.0 means the wallets trade almost exclusively with each other
    — a hallmark of wash-trading or fund-cycling rings.
    """
    cluster_nodes = set(cluster_subgraph.nodes())
    internal_edges = cluster_subgraph.number_of_edges()

    # Count ALL edges that touch at least one cluster member in the full graph.
    total_edges = 0
    for node in cluster_nodes:
        total_edges += G.in_degree(node) + G.out_degree(node)

    # Each internal edge was counted twice (once for sender, once for receiver).
    # Correct: total_external = total_edges - 2*internal_edges
    # total_touching = internal_edges + total_external = total_edges - internal_edges
    total_touching = max(total_edges - internal_edges, 1)  # avoid div-by-zero

    return internal_edges / total_touching


def score_clusters(
    clusters: List[Dict[str, Any]],
    G: nx.MultiDiGraph,
    scored_df: pd.DataFrame,
    # Weights for the three components of the risk score.
    w_anomaly: float = 0.40,
    w_internal: float = 0.35,
    w_size: float = 0.25,
    size_cap: int = 20,
) -> List[Dict[str, Any]]:
    """
    Assign a risk score (0-100) to each cluster.

    The score is a weighted combination of:
    1. avg_anomaly_score  — how individually anomalous the wallets are          (0-1)
    2. internal_tx_ratio  — how self-contained the cluster's transactions are  (0-1)
    3. normalised size    — cluster size capped & normalised                    (0-1)

    Parameters
    ----------
    clusters : list of dict from find_anomalous_clusters()
    G : full transaction graph
    scored_df : DataFrame with anomaly_score column
    w_anomaly, w_internal, w_size : weight floats summing to 1.0
    size_cap : cluster sizes ≥ this are mapped to 1.0

    Returns
    -------
    list of dict — each cluster dict enriched with:
        risk_score, avg_anomaly_score, internal_tx_ratio
    """
    results: List[Dict[str, Any]] = []

    for cluster in clusters:
        wallets = cluster["wallets"]
        sub = cluster["subgraph"]

        avg_anomaly = float(scored_df.loc[wallets, "anomaly_score"].mean())
        internal_ratio = _internal_tx_ratio(sub, G)
        norm_size = min(len(wallets) / size_cap, 1.0)

        raw_score = (
            w_anomaly * avg_anomaly
            + w_internal * internal_ratio
            + w_size * norm_size
        )
        # Map to 0–100 integer.
        risk_score = int(round(raw_score * 100))
        risk_score = max(0, min(100, risk_score))

        results.append({
            "cluster_id": cluster["cluster_id"],
            "wallets": wallets,
            "risk_score": risk_score,
            "avg_anomaly_score": round(avg_anomaly, 4),
            "internal_tx_ratio": round(internal_ratio, 4),
            "cluster_size": len(wallets),
            "subgraph": sub,  # carried forward for explainability
        })

    # Sort by risk descending.
    results.sort(key=lambda r: r["risk_score"], reverse=True)
    return results

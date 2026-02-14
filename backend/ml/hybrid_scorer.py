"""
hybrid_scorer.py — Blend unsupervised anomaly scores with known labels.

WHY hybrid scoring?
Pure unsupervised detection doesn't know about OFAC sanctions, known scams,
or analyst reviews.  A wallet might score 0.48 (just below threshold) on
Isolation Forest, but if it's on the OFAC list, it should absolutely be
flagged.  Conversely, a high-degree wallet that IF flags as anomalous
might be Binance — a known exchange, not a threat.

This module implements three complementary mechanisms:

1. **Label boosting** — If a wallet has a known malicious label, its
   anomaly score is boosted (pushed toward 1.0).

2. **Label suppression** — If a wallet has a known benign label (exchange,
   verified contract), its anomaly score is dampened (pushed toward 0.0)
   and it's excluded from the "is_anomalous" flag.

3. **Graph-based label propagation** — If a wallet transacts heavily with
   known-malicious wallets, it gets a "guilt by association" boost
   proportional to the edge weight and proximity.  This is NOT deep learning —
   it's a simple 1-hop weighted average, O(E).

The result: a hybrid score that uses statistical detection (IF) as the
foundation and known intelligence (labels) as calibration.  This is the
standard approach used by Chainalysis, Elliptic, and TRM Labs.
"""

from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
import networkx as nx

from .label_store import LabelStore, MALICIOUS_LABELS, BENIGN_LABELS


def apply_label_adjustments(
    scored_df: pd.DataFrame,
    label_store: LabelStore,
    boost_malicious: float = 0.25,
    suppress_benign: float = 0.30,
) -> pd.DataFrame:
    """
    Adjust anomaly scores based on known labels.

    Parameters
    ----------
    scored_df : pd.DataFrame
        Must have columns 'anomaly_score' and 'is_anomalous', indexed by wallet.
    label_store : LabelStore
        Known wallet labels.
    boost_malicious : float
        Amount to ADD to anomaly_score for known-malicious wallets.
    suppress_benign : float
        Amount to SUBTRACT from anomaly_score for known-benign wallets.

    Returns
    -------
    pd.DataFrame with adjusted scores and a new 'label_source' column.
    """
    result = scored_df.copy()
    result["label_source"] = None
    result["known_label"] = None

    for wallet in result.index:
        entry = label_store.get(wallet)
        if entry is None:
            continue

        label = entry["label"]
        confidence = entry.get("confidence", 1.0)
        result.at[wallet, "label_source"] = entry["source"]
        result.at[wallet, "known_label"] = label

        if label in MALICIOUS_LABELS:
            # Boost: known bad actor.  Scale boost by source confidence.
            current = result.at[wallet, "anomaly_score"]
            boosted = current + boost_malicious * confidence
            result.at[wallet, "anomaly_score"] = min(boosted, 1.0)
            result.at[wallet, "is_anomalous"] = True

        elif label in BENIGN_LABELS:
            # Suppress: known exchange/verified entity.
            current = result.at[wallet, "anomaly_score"]
            suppressed = current - suppress_benign * confidence
            result.at[wallet, "anomaly_score"] = max(suppressed, 0.0)
            result.at[wallet, "is_anomalous"] = False

    return result


def propagate_labels_one_hop(
    scored_df: pd.DataFrame,
    G: nx.MultiDiGraph,
    label_store: LabelStore,
    propagation_weight: float = 0.10,
) -> pd.DataFrame:
    """
    Graph-based label propagation: guilt-by-association (1 hop).

    For each wallet that does NOT have a known label, check its direct
    neighbors.  If a neighbor is known-malicious, boost the wallet's
    score proportional to:
        (edge_volume_with_malicious_neighbor / total_edge_volume) * weight

    This captures the intuition: "if you transact heavily with a sanctioned
    wallet, you're more suspicious — even if your own features look normal."

    Only 1 hop is used (not iterative propagation) to avoid over-spreading
    suspicion and to keep computation O(E).

    Parameters
    ----------
    scored_df : pd.DataFrame
        Already label-adjusted scores.
    G : nx.MultiDiGraph
        Full transaction graph.
    label_store : LabelStore
        Known labels.
    propagation_weight : float
        Maximum boost from neighbor contamination (default 0.10).

    Returns
    -------
    pd.DataFrame with updated anomaly_score.
    """
    result = scored_df.copy()

    for wallet in result.index:
        # Skip wallets that already have a known label.
        if label_store.get(wallet) is not None:
            continue

        # Compute volume flowing to/from known-malicious neighbors.
        malicious_volume = 0.0
        total_volume = 0.0

        # Outgoing edges.
        for _, target, data in G.out_edges(wallet, data=True):
            vol = data.get("value", 0.0)
            total_volume += vol
            if label_store.is_malicious(target):
                malicious_volume += vol

        # Incoming edges.
        for source, _, data in G.in_edges(wallet, data=True):
            vol = data.get("value", 0.0)
            total_volume += vol
            if label_store.is_malicious(source):
                malicious_volume += vol

        if total_volume == 0 or malicious_volume == 0:
            continue

        # Proportional boost.
        contamination_ratio = malicious_volume / total_volume
        boost = propagation_weight * contamination_ratio

        current = result.at[wallet, "anomaly_score"]
        result.at[wallet, "anomaly_score"] = min(current + boost, 1.0)

    return result


def hybrid_score(
    scored_df: pd.DataFrame,
    G: nx.MultiDiGraph,
    label_store: Optional[LabelStore] = None,
    boost_malicious: float = 0.25,
    suppress_benign: float = 0.30,
    propagation_weight: float = 0.10,
    verbose: bool = True,
) -> pd.DataFrame:
    """
    Full hybrid scoring: label adjustment + graph propagation.

    If label_store is None or empty, returns scored_df unchanged
    (pure unsupervised mode — backwards compatible).

    Returns
    -------
    pd.DataFrame with final hybrid anomaly scores.
    """
    if label_store is None or label_store.size == 0:
        if verbose:
            print("      No labels available — using pure unsupervised scores.")
        return scored_df

    # Count how many known wallets are actually in our graph.
    graph_wallets = set(scored_df.index)
    known_in_graph = sum(
        1 for w in graph_wallets if label_store.get(w) is not None
    )

    if verbose:
        print(f"      {label_store.size} labels loaded, "
              f"{known_in_graph} match wallets in current graph")

    # Step 1: Direct label adjustments.
    result = apply_label_adjustments(
        scored_df, label_store, boost_malicious, suppress_benign
    )

    n_boosted = (result["known_label"].notna() &
                 result["known_label"].isin(MALICIOUS_LABELS)).sum()
    n_suppressed = (result["known_label"].notna() &
                    result["known_label"].isin(BENIGN_LABELS)).sum()

    if verbose and (n_boosted or n_suppressed):
        print(f"      Boosted {n_boosted} known-malicious, "
              f"suppressed {n_suppressed} known-benign")

    # Step 2: 1-hop label propagation.
    result = propagate_labels_one_hop(
        result, G, label_store, propagation_weight
    )

    return result

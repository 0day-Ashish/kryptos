"""
features.py — Per-wallet feature engineering from the transaction graph.

WHY these features?
We need to characterise each wallet's behavioral fingerprint so that an
unsupervised model can separate "normal" wallets from "anomalous" ones.

The features capture three orthogonal axes of suspicious behavior:

1. **Structural**  (in/out degree, transaction count)
   – Layering and fan-out/fan-in operations produce extreme degree ratios.

2. **Volumetric**  (total_in_amount, total_out_amount, pass_through_score)
   – Pass-through wallets move almost everything they receive onward.
     pass_through_score ≈ 0 means ~perfect in-out balance, which is unusual
     for end-user wallets and typical for automated intermediaries.

3. **Temporal**  (avg_time_gap)
   – Automated coordination tends to have unnaturally regular or very short
     inter-transaction intervals.

All features are computed in O(E) where E = number of edges.
"""

from typing import Dict, Any, List
import numpy as np
import pandas as pd
import networkx as nx


def compute_wallet_features(G: nx.MultiDiGraph) -> pd.DataFrame:
    """
    Compute a feature vector for every wallet in the graph.

    Returns
    -------
    pd.DataFrame
        Indexed by wallet address with columns:
        in_degree, out_degree, total_in_amount, total_out_amount,
        transaction_count, pass_through_score, avg_time_gap
    """
    wallets: List[str] = list(G.nodes())
    records: List[Dict[str, Any]] = []

    for wallet in wallets:
        # --- Structural features ---
        in_deg = G.in_degree(wallet)
        out_deg = G.out_degree(wallet)

        # --- Volumetric features ---
        # Incoming edges: edges where this wallet is the receiver.
        total_in_amount = 0.0
        for _, _, data in G.in_edges(wallet, data=True):
            total_in_amount += data["value"]

        # Outgoing edges: edges where this wallet is the sender.
        total_out_amount = 0.0
        for _, _, data in G.out_edges(wallet, data=True):
            total_out_amount += data["value"]

        transaction_count = in_deg + out_deg

        # Pass-through score: how close total-in ≈ total-out.
        # A low absolute difference relative to volume indicates the wallet
        # is a conduit rather than a source or sink.
        # We use the raw absolute difference; the model consumes the scaled
        # version so magnitude issues are handled downstream.
        pass_through_score = abs(total_in_amount - total_out_amount)

        # --- Temporal features ---
        # Gather all timestamps touching this wallet (both in and out).
        timestamps: List[int] = []
        for _, _, data in G.in_edges(wallet, data=True):
            timestamps.append(data["timestamp"])
        for _, _, data in G.out_edges(wallet, data=True):
            timestamps.append(data["timestamp"])

        if len(timestamps) >= 2:
            timestamps.sort()
            gaps = np.diff(timestamps).astype(float)
            avg_time_gap = float(np.mean(gaps))
        else:
            # Only one transaction → no gap to compute.
            # Use 0 as a sentinel; it will be scaled along with everything else.
            avg_time_gap = 0.0

        records.append({
            "wallet": wallet,
            "in_degree": in_deg,
            "out_degree": out_deg,
            "total_in_amount": total_in_amount,
            "total_out_amount": total_out_amount,
            "transaction_count": transaction_count,
            "pass_through_score": pass_through_score,
            "avg_time_gap": avg_time_gap,
        })

    df = pd.DataFrame(records)
    df.set_index("wallet", inplace=True)
    return df


# Column order used throughout the pipeline (keeps things deterministic).
FEATURE_COLUMNS = [
    "in_degree",
    "out_degree",
    "total_in_amount",
    "total_out_amount",
    "transaction_count",
    "pass_through_score",
    "avg_time_gap",
]

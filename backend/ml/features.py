"""
features.py — Per-wallet feature engineering from raw transaction data.

Computes 32+ behavioral features across structural, volumetric, temporal,
and behavioral axes for ML-based anomaly detection.
"""

from typing import Dict, Any, List
import numpy as np
from datetime import datetime
from collections import Counter

# Also keep the graph-based imports for backward compat with existing pipeline
try:
    import pandas as pd
    import networkx as nx
    HAS_GRAPH_DEPS = True
except ImportError:
    HAS_GRAPH_DEPS = False


def extract_wallet_features(address: str, transactions: list, chain_id: int = 1) -> dict:
    """
    Extract comprehensive behavioral features from a wallet's transactions.
    Returns a flat dict of numeric features for ML scoring.
    """
    address = address.lower()
    if not transactions:
        return _empty_features(address, chain_id)

    # Separate sent vs received
    sent = [tx for tx in transactions if tx.get("from", "").lower() == address]
    received = [tx for tx in transactions if tx.get("to", "").lower() == address]

    # Value arrays (in native token units)
    sent_values = [int(tx.get("value", 0)) / 1e18 for tx in sent]
    recv_values = [int(tx.get("value", 0)) / 1e18 for tx in received]
    all_values = [int(tx.get("value", 0)) / 1e18 for tx in transactions]

    # Timestamps
    timestamps = sorted([int(tx.get("timeStamp", 0)) for tx in transactions if tx.get("timeStamp")])

    # Unique counterparties
    counterparties_out = set(tx.get("to", "").lower() for tx in sent if tx.get("to"))
    counterparties_in = set(tx.get("from", "").lower() for tx in received if tx.get("from"))
    all_counterparties = counterparties_out | counterparties_in

    # Time-based features
    time_diffs = np.diff(timestamps).tolist() if len(timestamps) > 1 else [0]
    active_days = len(set(datetime.fromtimestamp(t).date() for t in timestamps)) if timestamps else 0
    lifespan_days = (timestamps[-1] - timestamps[0]) / 86400 if len(timestamps) > 1 else 0

    # Gas analysis
    gas_prices = [int(tx.get("gasPrice", 0)) / 1e9 for tx in transactions if tx.get("gasPrice")]
    gas_used = [int(tx.get("gasUsed", 0)) for tx in transactions if tx.get("gasUsed")]

    # Contract interaction
    contract_calls = sum(1 for tx in transactions if tx.get("input", "0x") != "0x" and len(tx.get("input", "")) > 10)
    failed_txns = sum(1 for tx in transactions if tx.get("isError") == "1" or tx.get("txreceipt_status") == "0")

    # Frequency of counterparties (for detecting round-trip / cycling)
    to_counts = Counter(tx.get("to", "").lower() for tx in sent if tx.get("to"))
    repeated_targets = sum(1 for addr, count in to_counts.items() if count >= 3)

    # Self-transfers
    self_transfers = sum(1 for tx in transactions if tx.get("from", "").lower() == tx.get("to", "").lower())

    # Round numbers (common in laundering — e.g., exactly 1.0 ETH, 10.0 ETH)
    round_value_txns = sum(1 for v in all_values if v > 0 and (v == int(v) or v * 10 == int(v * 10)))
    round_ratio = round_value_txns / max(len(all_values), 1)

    # Burst detection — transactions within short windows
    burst_count = sum(1 for d in time_diffs if d < 300) if time_diffs else 0  # < 5 min apart
    burst_ratio = burst_count / max(len(time_diffs), 1)

    # Net flow (negative = net sender)
    total_sent = sum(sent_values)
    total_recv = sum(recv_values)
    net_flow = total_recv - total_sent
    flow_ratio = total_sent / max(total_recv, 1e-18)

    features = {
        "address": address,
        "chain_id": chain_id,
        # Volume features
        "tx_count": len(transactions),
        "sent_count": len(sent),
        "recv_count": len(received),
        "total_sent_eth": total_sent,
        "total_recv_eth": total_recv,
        "net_flow_eth": net_flow,
        "flow_ratio": min(flow_ratio, 100),  # cap outliers
        # Value distribution
        "mean_value": float(np.mean(all_values)) if all_values else 0,
        "median_value": float(np.median(all_values)) if all_values else 0,
        "std_value": float(np.std(all_values)) if all_values else 0,
        "max_value": max(all_values) if all_values else 0,
        "min_value": min(all_values) if all_values else 0,
        "mean_sent": float(np.mean(sent_values)) if sent_values else 0,
        "mean_recv": float(np.mean(recv_values)) if recv_values else 0,
        # Counterparty features
        "unique_counterparties": len(all_counterparties),
        "unique_targets": len(counterparties_out),
        "unique_sources": len(counterparties_in),
        "repeated_targets": repeated_targets,
        "self_transfers": self_transfers,
        # Time features
        "active_days": active_days,
        "lifespan_days": lifespan_days,
        "mean_time_between_tx": float(np.mean(time_diffs)) if time_diffs else 0,
        "std_time_between_tx": float(np.std(time_diffs)) if time_diffs else 0,
        "min_time_between_tx": min(time_diffs) if time_diffs else 0,
        "burst_ratio": burst_ratio,
        # Gas features
        "mean_gas_price": float(np.mean(gas_prices)) if gas_prices else 0,
        "std_gas_price": float(np.std(gas_prices)) if gas_prices else 0,
        "mean_gas_used": float(np.mean(gas_used)) if gas_used else 0,
        # Behavioral flags
        "contract_call_ratio": contract_calls / max(len(transactions), 1),
        "failed_tx_ratio": failed_txns / max(len(transactions), 1),
        "round_value_ratio": round_ratio,
        # Derived risk indicators
        "tx_per_day": len(transactions) / max(lifespan_days, 1),
        "value_per_counterparty": sum(all_values) / max(len(all_counterparties), 1),
    }

    return features


def _empty_features(address: str, chain_id: int) -> dict:
    """Return zeroed features for wallets with no transactions."""
    return {
        "address": address,
        "chain_id": chain_id,
        "tx_count": 0, "sent_count": 0, "recv_count": 0,
        "total_sent_eth": 0, "total_recv_eth": 0, "net_flow_eth": 0, "flow_ratio": 0,
        "mean_value": 0, "median_value": 0, "std_value": 0, "max_value": 0, "min_value": 0,
        "mean_sent": 0, "mean_recv": 0,
        "unique_counterparties": 0, "unique_targets": 0, "unique_sources": 0,
        "repeated_targets": 0, "self_transfers": 0,
        "active_days": 0, "lifespan_days": 0,
        "mean_time_between_tx": 0, "std_time_between_tx": 0, "min_time_between_tx": 0,
        "burst_ratio": 0,
        "mean_gas_price": 0, "std_gas_price": 0, "mean_gas_used": 0,
        "contract_call_ratio": 0, "failed_tx_ratio": 0, "round_value_ratio": 0,
        "tx_per_day": 0, "value_per_counterparty": 0,
    }


# The numeric feature columns used by the ML model
FEATURE_COLUMNS = [
    "tx_count", "sent_count", "recv_count",
    "total_sent_eth", "total_recv_eth", "net_flow_eth", "flow_ratio",
    "mean_value", "median_value", "std_value", "max_value", "min_value",
    "mean_sent", "mean_recv",
    "unique_counterparties", "unique_targets", "unique_sources",
    "repeated_targets", "self_transfers",
    "active_days", "lifespan_days",
    "mean_time_between_tx", "std_time_between_tx", "min_time_between_tx",
    "burst_ratio",
    "mean_gas_price", "std_gas_price", "mean_gas_used",
    "contract_call_ratio", "failed_tx_ratio", "round_value_ratio",
    "tx_per_day", "value_per_counterparty",
]


# ---------------------------------------------------------------------------
# Legacy graph-based feature computation (kept for backward compat with
# existing pipeline.py / anomaly_detection.py that import from here)
# ---------------------------------------------------------------------------
if HAS_GRAPH_DEPS:
    def compute_wallet_features(G: nx.MultiDiGraph) -> pd.DataFrame:
        """Legacy: compute features from a NetworkX graph."""
        wallets = list(G.nodes())
        records = []

        for wallet in wallets:
            in_deg = G.in_degree(wallet)
            out_deg = G.out_degree(wallet)

            total_in_amount = sum(data["value"] for _, _, data in G.in_edges(wallet, data=True))
            total_out_amount = sum(data["value"] for _, _, data in G.out_edges(wallet, data=True))
            transaction_count = in_deg + out_deg
            pass_through_score = abs(total_in_amount - total_out_amount)

            timestamps = []
            for _, _, data in G.in_edges(wallet, data=True):
                timestamps.append(data["timestamp"])
            for _, _, data in G.out_edges(wallet, data=True):
                timestamps.append(data["timestamp"])

            if len(timestamps) >= 2:
                timestamps.sort()
                avg_time_gap = float(np.mean(np.diff(timestamps).astype(float)))
            else:
                avg_time_gap = 0.0

            records.append({
                "wallet": wallet,
                "in_degree": in_deg, "out_degree": out_deg,
                "total_in_amount": total_in_amount, "total_out_amount": total_out_amount,
                "transaction_count": transaction_count,
                "pass_through_score": pass_through_score,
                "avg_time_gap": avg_time_gap,
            })

        df = pd.DataFrame(records)
        df.set_index("wallet", inplace=True)
        return df

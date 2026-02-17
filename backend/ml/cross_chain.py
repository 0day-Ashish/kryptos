"""
cross_chain.py — Scan the same wallet address across all supported chains.
Aggregates activity, balance, and risk info per chain.
"""
from __future__ import annotations
from typing import List, Dict

try:
    from backend.ml.config import SUPPORTED_CHAINS
    from backend.ml.fetcher import fetch_transactions, fetch_balance
    from backend.ml.known_labels import lookup_address
except ModuleNotFoundError:
    from ml.config import SUPPORTED_CHAINS
    from ml.fetcher import fetch_transactions, fetch_balance
    from ml.known_labels import lookup_address


def cross_chain_scan(
    address: str,
    chains: List[dict] | None = None,
    quick: bool = True,
) -> dict:
    """
    Scan a wallet across all (or specified) EVM chains.

    Parameters
    ----------
    address : Wallet address.
    chains  : Subset of chains to scan. Defaults to all SUPPORTED_CHAINS.
    quick   : If True, only fetch first page (50 txns) per chain for speed.

    Returns
    -------
    {
        address, label, active_chains[], inactive_chains[],
        total_chains_active, total_transactions, total_balance,
    }
    """
    address = address.lower()
    scan_chains = chains or SUPPORTED_CHAINS
    max_results = 50 if quick else 200

    label_info = lookup_address(address)
    active_chains: List[dict] = []
    inactive_chains: List[str] = []
    total_txns = 0
    total_balance = 0.0

    for chain in scan_chains:
        chain_id = chain["id"]
        chain_name = chain["name"]

        txns = fetch_transactions(address, chain_id, max_results=max_results)
        balance = fetch_balance(address, chain_id)

        if txns:
            # Compute basic stats
            sent = 0.0
            received = 0.0
            unique_counterparties = set()

            for tx in txns:
                val = int(tx.get("value", 0)) / 1e18
                tx_from = tx.get("from", "").lower()
                tx_to = tx.get("to", "").lower()

                if tx_from == address:
                    sent += val
                    if tx_to:
                        unique_counterparties.add(tx_to)
                else:
                    received += val
                    unique_counterparties.add(tx_from)

            total_txns += len(txns)

            entry = {
                "chain_id": chain_id,
                "chain_name": chain_name,
                "native": chain.get("native", "ETH"),
                "explorer": chain.get("explorer", ""),
                "tx_count": len(txns),
                "balance": round(balance, 6) if balance else 0,
                "total_sent": round(sent, 6),
                "total_received": round(received, 6),
                "unique_counterparties": len(unique_counterparties),
            }
            active_chains.append(entry)
            if balance:
                total_balance += balance
        else:
            if balance and balance > 0:
                # Has balance but no txns in our window
                active_chains.append({
                    "chain_id": chain_id,
                    "chain_name": chain_name,
                    "native": chain.get("native", "ETH"),
                    "explorer": chain.get("explorer", ""),
                    "tx_count": 0,
                    "balance": round(balance, 6),
                    "total_sent": 0,
                    "total_received": 0,
                    "unique_counterparties": 0,
                })
                total_balance += balance
            else:
                inactive_chains.append(chain_name)

    # Sort active chains by tx count descending
    active_chains.sort(key=lambda c: c["tx_count"], reverse=True)

    return {
        "address": address,
        "label": label_info["label"] if label_info else None,
        "category": label_info["category"] if label_info else None,
        "active_chains": active_chains,
        "inactive_chains": inactive_chains,
        "total_chains_active": len(active_chains),
        "total_transactions": total_txns,
        "total_balance": round(total_balance, 6),
    }

"""
tracer.py — Multi-hop fund flow tracing.
Follows outgoing (or incoming) transactions N levels deep
to map where funds went after leaving a given wallet.
"""
from typing import List, Dict, Optional
from collections import deque

try:
    from backend.ml.fetcher import fetch_transactions
    from backend.ml.known_labels import lookup_address
except ModuleNotFoundError:
    from ml.fetcher import fetch_transactions
    from ml.known_labels import lookup_address


def trace_fund_flow(
    address: str,
    chain_id: int = 1,
    max_depth: int = 3,
    min_value_eth: float = 0.01,
    max_branches: int = 8,
    direction: str = "out",
) -> dict:
    """
    BFS traversal of outgoing (or incoming) transactions.

    Parameters
    ----------
    address      : Starting wallet address.
    chain_id     : EVM chain to trace on.
    max_depth    : How many hops to follow (1-5, clamped).
    min_value_eth: Ignore transfers below this threshold.
    max_branches : Max children per node to avoid explosion.
    direction    : "out" = follow where funds go, "in" = follow where funds came from.

    Returns
    -------
    A tree dict with { address, label, value, tx_hash, depth, children[] }
    plus summary stats.
    """
    max_depth = max(1, min(max_depth, 5))
    address = address.lower()
    visited: set = set()
    total_nodes = 0
    total_value = 0.0

    def _trace(addr: str, depth: int) -> dict:
        nonlocal total_nodes, total_value
        total_nodes += 1

        label_info = lookup_address(addr)
        node: dict = {
            "address": addr,
            "label": label_info["label"] if label_info else None,
            "category": label_info["category"] if label_info else None,
            "depth": depth,
            "children": [],
        }

        if depth >= max_depth or addr in visited:
            return node

        visited.add(addr)
        txns = fetch_transactions(addr, chain_id, max_results=100)
        if not txns:
            return node

        # Filter by direction
        if direction == "out":
            relevant = [
                tx for tx in txns
                if tx.get("from", "").lower() == addr
                and tx.get("to", "")
                and int(tx.get("value", 0)) / 1e18 >= min_value_eth
            ]
        else:
            relevant = [
                tx for tx in txns
                if tx.get("to", "").lower() == addr
                and tx.get("from", "")
                and int(tx.get("value", 0)) / 1e18 >= min_value_eth
            ]

        # Sort by value descending, limit branches
        relevant.sort(key=lambda t: int(t.get("value", 0)), reverse=True)
        relevant = relevant[:max_branches]

        for tx in relevant:
            value_eth = int(tx.get("value", 0)) / 1e18
            total_value += value_eth

            next_addr = tx.get("to", "").lower() if direction == "out" else tx.get("from", "").lower()
            if not next_addr or next_addr == addr:
                continue

            child = _trace(next_addr, depth + 1)
            child["value"] = round(value_eth, 6)
            child["tx_hash"] = tx.get("hash", "")
            child["timestamp"] = int(tx.get("timeStamp", 0))
            node["children"].append(child)

        return node

    tree = _trace(address, 0)

    return {
        "root": address,
        "direction": direction,
        "chain_id": chain_id,
        "max_depth": max_depth,
        "min_value_eth": min_value_eth,
        "tree": tree,
        "summary": {
            "total_nodes": total_nodes,
            "unique_addresses": len(visited),
            "total_value_traced": round(total_value, 6),
        },
    }

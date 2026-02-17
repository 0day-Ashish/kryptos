"""
similarity.py — Find wallets that behave similarly to a given target.
Uses cosine similarity on the 32+ feature vectors to rank neighbors.
"""
import numpy as np
from typing import List, Dict

try:
    from backend.ml.features import extract_wallet_features, FEATURE_COLUMNS
    from backend.ml.fetcher import fetch_transactions
    from backend.ml.known_labels import lookup_address
except ModuleNotFoundError:
    from ml.features import extract_wallet_features, FEATURE_COLUMNS
    from ml.fetcher import fetch_transactions
    from ml.known_labels import lookup_address


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def find_similar_wallets(
    address: str,
    candidate_addresses: List[str],
    chain_id: int = 1,
    top_k: int = 5,
) -> dict:
    """
    Given a target address and a list of candidate addresses,
    compute behavioral similarity based on extracted features.

    Parameters
    ----------
    address             : Target wallet to compare against.
    candidate_addresses : List of wallets to rank by similarity.
    chain_id            : Chain to fetch transactions from.
    top_k               : How many similar wallets to return.

    Returns
    -------
    {
        target: { address, features },
        similar: [{ address, label, similarity, features }],
        feature_columns: [],
    }
    """
    address = address.lower()

    # Extract target features
    target_txns = fetch_transactions(address, chain_id, max_results=200)
    target_features = extract_wallet_features(address, target_txns, chain_id)
    target_vector = np.array([target_features.get(col, 0) for col in FEATURE_COLUMNS], dtype=float)
    target_vector = np.nan_to_num(target_vector, nan=0.0, posinf=0.0, neginf=0.0)

    # Score each candidate
    candidates: List[dict] = []
    for cand_addr in candidate_addresses:
        cand_addr = cand_addr.lower()
        if cand_addr == address:
            continue

        cand_txns = fetch_transactions(cand_addr, chain_id, max_results=100)
        if not cand_txns:
            continue

        cand_features = extract_wallet_features(cand_addr, cand_txns, chain_id)
        cand_vector = np.array([cand_features.get(col, 0) for col in FEATURE_COLUMNS], dtype=float)
        cand_vector = np.nan_to_num(cand_vector, nan=0.0, posinf=0.0, neginf=0.0)

        sim = cosine_similarity(target_vector, cand_vector)
        label_info = lookup_address(cand_addr)

        candidates.append({
            "address": cand_addr,
            "label": label_info["label"] if label_info else None,
            "category": label_info["category"] if label_info else None,
            "similarity": round(sim, 4),
            "tx_count": len(cand_txns),
            "feature_summary": {
                "tx_count": cand_features.get("tx_count", 0),
                "unique_counterparties": cand_features.get("unique_counterparties", 0),
                "total_sent_eth": round(cand_features.get("total_sent_eth", 0), 4),
                "total_recv_eth": round(cand_features.get("total_recv_eth", 0), 4),
            },
        })

    # Sort by similarity descending
    candidates.sort(key=lambda c: c["similarity"], reverse=True)
    top_similar = candidates[:top_k]

    return {
        "target": {
            "address": address,
            "tx_count": len(target_txns),
            "feature_summary": {
                "tx_count": target_features.get("tx_count", 0),
                "unique_counterparties": target_features.get("unique_counterparties", 0),
                "total_sent_eth": round(target_features.get("total_sent_eth", 0), 4),
                "total_recv_eth": round(target_features.get("total_recv_eth", 0), 4),
            },
        },
        "similar": top_similar,
        "candidates_checked": len(candidates),
    }

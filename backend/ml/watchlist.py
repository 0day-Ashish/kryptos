"""
Watchlist quick-score: lightweight wallet risk check for monitoring.
Skips heavy analysis (GNN, temporal, MEV, bridge) for faster refresh cycles.
"""
import time
from datetime import datetime, timezone

try:
    from backend.ml.fetcher import (
        fetch_transactions, fetch_internal_transactions,
        fetch_token_transfers, discover_neighbors, fetch_neighbor_transactions,
        fetch_balance,
    )
    from backend.ml.scorer import wallet_scorer
    from backend.ml.sanctions import check_sanctions
    from backend.ml.known_labels import lookup_address, is_mixer
    from backend.ml.config import get_chain_by_id
    from backend.ml.ens_resolver import resolve_input
except ModuleNotFoundError:
    from ml.fetcher import (
        fetch_transactions, fetch_internal_transactions,
        fetch_token_transfers, discover_neighbors, fetch_neighbor_transactions,
        fetch_balance,
    )
    from ml.scorer import wallet_scorer
    from ml.sanctions import check_sanctions
    from ml.known_labels import lookup_address, is_mixer
    from ml.config import get_chain_by_id
    from ml.ens_resolver import resolve_input


def quick_score(address: str, chain_id: int = 1) -> dict:
    """
    Lightweight wallet risk score — faster than full /analyze.
    Returns score, label, flags, balance, and basic stats.
    Skips: GNN scoring, temporal anomaly, MEV detection, bridge tracking,
           graph building, timeline, on-chain storage.
    """
    start = time.time()

    # Resolve ENS
    resolved = resolve_input(address)
    if resolved["resolved"] and resolved["address"]:
        target_address = resolved["address"].lower()
        ens_name = resolved.get("ens_name")
    else:
        target_address = address.lower()
        ens_name = None

    chain = get_chain_by_id(chain_id)

    # Sanctions pre-check
    sanctions_result = check_sanctions(target_address)

    # Fetch transactions (smaller batches for speed)
    normal_txns = fetch_transactions(target_address, chain_id, max_results=100)
    internal_txns = fetch_internal_transactions(target_address, chain_id, max_results=50)
    token_txns = fetch_token_transfers(target_address, chain_id, max_results=50)

    all_target_txns = normal_txns + internal_txns

    if not all_target_txns:
        return {
            "address": target_address,
            "ens_name": ens_name,
            "chain_id": chain_id,
            "chain_name": chain["name"],
            "risk_score": 0,
            "risk_label": "No Data",
            "flags": ["No transactions found on this chain"],
            "balance": "0",
            "tx_count": 0,
            "token_transfers": 0,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "elapsed_ms": int((time.time() - start) * 1000),
        }

    # Discover neighbors (fewer for speed)
    neighbors = discover_neighbors(target_address, all_target_txns, max_neighbors=4)
    neighbor_txns = fetch_neighbor_transactions(neighbors, chain_id, max_per_neighbor=30)

    # ML scoring
    try:
        result = wallet_scorer.score_wallet(
            target_address, all_target_txns, neighbor_txns, chain_id
        )
        risk_score = result["risk_score"]
        risk_label = result["risk_label"]
        flags = result["flags"]
    except Exception as e:
        risk_score = 50
        risk_label = "Unknown"
        flags = [f"Scoring error: {str(e)}"]

    # Check mixer interactions
    counterparty_addrs = set()
    for tx in normal_txns:
        tx_from = tx.get("from", "").lower()
        tx_to = tx.get("to", "").lower()
        if tx_from and tx_from != target_address:
            counterparty_addrs.add(tx_from)
        if tx_to and tx_to != target_address:
            counterparty_addrs.add(tx_to)

    for addr in counterparty_addrs:
        if is_mixer(addr):
            info = lookup_address(addr)
            mixer_flag = f"Interacted with mixer: {info['label'] if info else addr}"
            if mixer_flag not in flags:
                flags.append(mixer_flag)

    # Apply sanctions modifier
    if sanctions_result["risk_modifier"] > 0:
        risk_score = min(100, risk_score + sanctions_result["risk_modifier"])
        if sanctions_result["is_sanctioned"]:
            flags.insert(0, "ADDRESS IS ON OFAC SANCTIONS LIST")
            risk_label = "Critical Risk"

    # Balance
    balance = fetch_balance(target_address, chain_id)

    # Compute activity summary
    first_ts = min((int(tx.get("timeStamp", 0)) for tx in normal_txns if tx.get("timeStamp")), default=0)
    last_ts = max((int(tx.get("timeStamp", 0)) for tx in normal_txns if tx.get("timeStamp")), default=0)

    return {
        "address": target_address,
        "ens_name": ens_name,
        "chain_id": chain_id,
        "chain_name": chain["name"],
        "risk_score": risk_score,
        "risk_label": risk_label,
        "flags": flags,
        "balance": balance,
        "tx_count": len(normal_txns),
        "internal_tx_count": len(internal_txns),
        "token_transfers": len(token_txns),
        "first_seen": datetime.utcfromtimestamp(first_ts).isoformat() if first_ts else None,
        "last_active": datetime.utcfromtimestamp(last_ts).isoformat() if last_ts else None,
        "is_sanctioned": sanctions_result.get("is_sanctioned", False),
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "elapsed_ms": int((time.time() - start) * 1000),
    }

"""
mev_detector.py — MEV (Maximal Extractable Value) bot detection.

Detects on-chain MEV patterns:
  · Sandwich attacks  (buy → victim tx → sell in same block)
  · Front-running     (same contract call with higher gas, earlier position)
  · Back-running      (copy-cat tx immediately after a large trade)
  · Arbitrage loops   (token A → B → C → A in rapid succession)
  · Gas price outliers (consistently extreme gas usage)
"""

import numpy as np
from datetime import datetime
from typing import Dict, List, Any
from collections import defaultdict


# ── Known MEV bot contracts / relayers ──────────────────────────────────────
KNOWN_MEV_BOTS = {
    "0x00000000000747d525e29c8b0dfea0a5b4e5dbe1": "Flashbots Builder",
    "0x98c3d3183c4b8a650614ad179a1a98be0a8d6b8e": "MEV Bot",
    "0xa57bd00134b2850b2a1c55860c9e9ea100fdd6cf": "MEV Bot #1",
    "0x000000000035b5e5ad9019092c665357240f594e": "Jared (Sandwich Bot)",
    "0x6b75d8af000000e20b7a7ddf000ba900b4009a80": "MEV Bot #2",
    "0xae2fc483527b8ef99eb5d9b44875f005ba1fae13": "MEV Searcher",
    "0x56178a0d5f301baf6cf3e1cd53d9863437345bf9": "Sandwich Bot",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap Router V2 (used by MEV)",
    "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Exchange Proxy",
}

# DEX router addresses (where swaps happen)
DEX_ROUTERS = {
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2 Router",
    "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap V3 Router 2",
    "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": "SushiSwap Router",
    "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch V5 Router",
    "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Exchange",
}


def _is_same_block(tx1: dict, tx2: dict) -> bool:
    return tx1.get("blockNumber") == tx2.get("blockNumber") and tx1.get("blockNumber")


def _is_dex_call(tx: dict) -> bool:
    to_addr = tx.get("to", "").lower()
    inp = tx.get("input", "0x")
    return to_addr in DEX_ROUTERS and len(inp) > 10


def _gas_price(tx: dict) -> float:
    return int(tx.get("gasPrice", 0)) / 1e9  # Gwei


# ── Sandwich Detection ─────────────────────────────────────────────────────

def _detect_sandwiches(
    address: str,
    transactions: list,
    all_block_txns: Dict[str, list],
) -> List[Dict]:
    """
    Detect sandwich attacks:  address buys → victim buys → address sells
    within the same block with the same contract.
    """
    address = address.lower()
    sandwiches = []

    # Group target's DEX calls by block
    dex_by_block: Dict[str, list] = defaultdict(list)
    for tx in transactions:
        if tx.get("from", "").lower() == address and _is_dex_call(tx):
            block = tx.get("blockNumber", "")
            dex_by_block[block].append(tx)

    for block, txs in dex_by_block.items():
        if len(txs) < 2:
            continue

        # Sort by transaction index within block
        txs_sorted = sorted(txs, key=lambda t: int(t.get("transactionIndex", 0)))

        # Look for buy-sell pattern (first and last tx in same block)
        first = txs_sorted[0]
        last = txs_sorted[-1]

        # If they target the same contract → potential sandwich
        if first.get("to", "").lower() == last.get("to", "").lower():
            first_idx = int(first.get("transactionIndex", 0))
            last_idx = int(last.get("transactionIndex", 0))

            if last_idx - first_idx >= 2:  # at least 1 victim tx in between
                sandwiches.append({
                    "block": block,
                    "front_tx": first.get("hash", ""),
                    "back_tx": last.get("hash", ""),
                    "front_index": first_idx,
                    "back_index": last_idx,
                    "contract": first.get("to", ""),
                    "victims_between": last_idx - first_idx - 1,
                    "gas_front": _gas_price(first),
                    "gas_back": _gas_price(last),
                })

    return sandwiches


# ── Front-running Detection ────────────────────────────────────────────────

def _detect_frontrunning(address: str, transactions: list) -> List[Dict]:
    """
    Detect front-running: multiple txns to same contract in same block
    where earlier txns have higher gas price.
    """
    address = address.lower()
    frontrun_candidates = []

    block_groups: Dict[str, list] = defaultdict(list)
    for tx in transactions:
        if tx.get("from", "").lower() == address:
            block = tx.get("blockNumber", "")
            block_groups[block].append(tx)

    for block, txs in block_groups.items():
        if len(txs) < 2:
            continue

        contract_groups: Dict[str, list] = defaultdict(list)
        for tx in txs:
            contract_groups[tx.get("to", "").lower()].append(tx)

        for contract, ctxs in contract_groups.items():
            if len(ctxs) < 2 or not contract:
                continue

            sorted_txs = sorted(ctxs, key=lambda t: int(t.get("transactionIndex", 0)))
            for i in range(len(sorted_txs) - 1):
                gas_early = _gas_price(sorted_txs[i])
                gas_later = _gas_price(sorted_txs[i + 1])
                if gas_early > gas_later * 1.1:  # earlier has ≥10% higher gas
                    frontrun_candidates.append({
                        "block": block,
                        "contract": contract,
                        "frontrun_tx": sorted_txs[i].get("hash", ""),
                        "followup_tx": sorted_txs[i + 1].get("hash", ""),
                        "gas_frontrun": gas_early,
                        "gas_followup": gas_later,
                        "gas_premium_pct": round((gas_early / max(gas_later, 0.01) - 1) * 100, 1),
                    })

    return frontrun_candidates


# ── Gas Analysis ────────────────────────────────────────────────────────────

def _analyse_gas_patterns(transactions: list) -> Dict[str, Any]:
    """Analyse gas pricing patterns for MEV-like behaviour."""
    if not transactions:
        return {"is_gas_outlier": False}

    gas_prices = [_gas_price(tx) for tx in transactions if tx.get("gasPrice")]
    if not gas_prices:
        return {"is_gas_outlier": False}

    arr = np.array(gas_prices)
    mean_gas = float(arr.mean())
    std_gas = float(arr.std())
    max_gas = float(arr.max())
    min_gas = float(arr.min())

    # High variance in gas → MEV bot adjusting gas dynamically
    cv = std_gas / mean_gas if mean_gas > 0 else 0
    # Very high max gas → priority fee manipulation
    has_extreme = max_gas > mean_gas * 5 if mean_gas > 0 else False

    return {
        "mean_gas_gwei": round(mean_gas, 2),
        "std_gas_gwei": round(std_gas, 2),
        "max_gas_gwei": round(max_gas, 2),
        "min_gas_gwei": round(min_gas, 2),
        "gas_cv": round(cv, 3),
        "is_gas_outlier": cv > 1.0 or has_extreme,
        "extreme_gas_txns": int((arr > mean_gas * 3).sum()),
    }


# ── Contract Interaction Pattern ────────────────────────────────────────────

def _analyse_dex_pattern(address: str, transactions: list) -> Dict[str, Any]:
    """Check if wallet predominantly interacts with DEX routers (bot-like)."""
    address = address.lower()
    total_sent = sum(1 for tx in transactions if tx.get("from", "").lower() == address)
    dex_calls = sum(
        1 for tx in transactions
        if tx.get("from", "").lower() == address and _is_dex_call(tx)
    )
    known_bot_interactions = []
    for tx in transactions:
        for addr_key in [tx.get("to", "").lower(), tx.get("from", "").lower()]:
            if addr_key in KNOWN_MEV_BOTS:
                known_bot_interactions.append({
                    "address": addr_key,
                    "label": KNOWN_MEV_BOTS[addr_key],
                    "tx_hash": tx.get("hash", ""),
                })

    # Unique known bots
    seen = set()
    unique_bots = []
    for item in known_bot_interactions:
        if item["address"] not in seen:
            seen.add(item["address"])
            unique_bots.append(item)

    return {
        "total_outgoing": total_sent,
        "dex_calls": dex_calls,
        "dex_ratio": round(dex_calls / max(total_sent, 1), 3),
        "is_dex_heavy": dex_calls > total_sent * 0.5 and dex_calls >= 5,
        "known_bot_interactions": unique_bots,
    }


# ── Arbitrage Detection ────────────────────────────────────────────────────

def _detect_arb_patterns(address: str, transactions: list) -> Dict[str, Any]:
    """
    Detect arbitrage-like patterns:
    - Multiple DEX calls within very short windows (< 30s)
    - Profit extraction: value out > value in within short bursts
    """
    address = address.lower()
    dex_txns = [
        tx for tx in transactions
        if tx.get("from", "").lower() == address and _is_dex_call(tx)
    ]

    if len(dex_txns) < 3:
        return {"arb_sequences": 0, "is_arb_bot": False}

    # Sort by timestamp
    dex_sorted = sorted(dex_txns, key=lambda t: int(t.get("timeStamp", 0)))

    # Find rapid sequences
    arb_sequences = 0
    i = 0
    while i < len(dex_sorted) - 2:
        t1 = int(dex_sorted[i].get("timeStamp", 0))
        t2 = int(dex_sorted[i + 1].get("timeStamp", 0))
        t3 = int(dex_sorted[i + 2].get("timeStamp", 0))

        # 3 DEX calls within 60 seconds → potential arb
        if t3 - t1 < 60:
            arb_sequences += 1
            i += 3  # skip past this sequence
        else:
            i += 1

    return {
        "arb_sequences": arb_sequences,
        "total_dex_txns": len(dex_txns),
        "is_arb_bot": arb_sequences >= 3,
    }


# ── Public API ──────────────────────────────────────────────────────────────

def detect_mev_activity(
    address: str,
    transactions: list,
) -> Dict[str, Any]:
    """
    Full MEV behaviour analysis for a wallet.

    Returns:
      is_mev_bot       – bool, overall verdict
      mev_risk_score   – 0-100 MEV confidence score
      sandwiches       – detected sandwich attacks
      frontrunning     – detected front-running patterns
      gas_analysis     – gas price statistics
      dex_pattern      – DEX interaction pattern
      arb_analysis     – arbitrage pattern detection
      mev_flags        – human-readable flags
    """
    address = address.lower()

    sandwiches = _detect_sandwiches(address, transactions, {})
    frontrunning = _detect_frontrunning(address, transactions)
    gas = _analyse_gas_patterns(transactions)
    dex = _analyse_dex_pattern(address, transactions)
    arb = _detect_arb_patterns(address, transactions)

    # ── Composite MEV risk score ────────────────────────────────────────
    score = 0.0
    flags = []

    # Sandwich attacks (very strong signal)
    if sandwiches:
        score += min(len(sandwiches) * 15, 35)
        flags.append(f"{len(sandwiches)} potential sandwich attack(s) detected")

    # Front-running
    if frontrunning:
        score += min(len(frontrunning) * 10, 25)
        flags.append(f"{len(frontrunning)} front-running pattern(s) detected")

    # DEX-heavy usage
    if dex["is_dex_heavy"]:
        score += 15
        flags.append(f"Heavy DEX usage ({dex['dex_ratio']*100:.0f}% of outgoing txns)")

    # Known bot interactions
    if dex["known_bot_interactions"]:
        score += min(len(dex["known_bot_interactions"]) * 5, 15)
        for bot in dex["known_bot_interactions"]:
            flags.append(f"Interacted with known MEV bot: {bot['label']}")

    # Gas outlier
    if gas.get("is_gas_outlier"):
        score += 10
        flags.append(f"Extreme gas price variance (CV={gas['gas_cv']:.2f})")

    # Arbitrage patterns
    if arb["is_arb_bot"]:
        score += 20
        flags.append(f"{arb['arb_sequences']} rapid arbitrage sequence(s) detected")

    mev_score = int(min(score, 100))
    is_bot = mev_score >= 40

    if is_bot and not flags:
        flags.append("MEV bot characteristics detected")

    return {
        "is_mev_bot": is_bot,
        "mev_risk_score": mev_score,
        "sandwiches": sandwiches,
        "frontrunning": frontrunning,
        "gas_analysis": gas,
        "dex_pattern": {k: v for k, v in dex.items() if k != "known_bot_interactions"},
        "known_bots": dex["known_bot_interactions"],
        "arb_analysis": arb,
        "mev_flags": flags,
    }

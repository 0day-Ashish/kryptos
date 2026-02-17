"""
token_portfolio.py — Fetch and analyze a wallet's ERC-20 token holdings.
Uses Etherscan V2 API to get token balances and transfer history.
"""
from typing import List, Dict, Optional
from collections import defaultdict

try:
    from backend.ml.fetcher import fetch_token_transfers, _rate_limit, ETHERSCAN_V2_BASE, ETHERSCAN_API_KEY, _get_cached, _set_cache, _cache_key
    from backend.ml.known_labels import lookup_address
except ModuleNotFoundError:
    from ml.fetcher import fetch_token_transfers, _rate_limit, ETHERSCAN_V2_BASE, ETHERSCAN_API_KEY, _get_cached, _set_cache, _cache_key
    from ml.known_labels import lookup_address

import requests


def get_token_portfolio(address: str, chain_id: int = 1) -> dict:
    """
    Build a token portfolio from ERC-20 transfer history.

    Analyzes token transfer patterns to identify:
    - What tokens the wallet holds/held
    - Token diversity
    - Suspicious token interactions (scam tokens, rug pulls, etc.)

    Returns
    -------
    {
        address, chain_id,
        tokens: [{ symbol, name, contract, transfers_in, transfers_out, net_transfers, last_seen }],
        summary: { total_tokens, total_transfers, unique_contracts, top_token },
    }
    """
    address = address.lower()

    key = _cache_key(address, chain_id, "token_portfolio")
    cached = _get_cached(key)
    if cached is not None:
        return cached[0] if isinstance(cached, list) and cached else cached

    # Get token transfers
    token_txns = fetch_token_transfers(address, chain_id, max_results=200)

    if not token_txns:
        result = {
            "address": address,
            "chain_id": chain_id,
            "tokens": [],
            "summary": {
                "total_tokens": 0,
                "total_transfers": 0,
                "unique_contracts": 0,
                "top_token": None,
            },
        }
        return result

    # Aggregate by token contract
    token_map: Dict[str, dict] = {}

    for tx in token_txns:
        contract = tx.get("contractAddress", "").lower()
        symbol = tx.get("tokenSymbol", "???")
        name = tx.get("tokenName", "Unknown Token")
        decimals = int(tx.get("tokenDecimal", 18) or 18)
        value_raw = int(tx.get("value", 0))
        value = value_raw / (10 ** decimals) if decimals > 0 else value_raw
        tx_from = tx.get("from", "").lower()
        timestamp = int(tx.get("timeStamp", 0))

        if contract not in token_map:
            token_map[contract] = {
                "symbol": symbol,
                "name": name,
                "contract": contract,
                "decimals": decimals,
                "transfers_in": 0,
                "transfers_out": 0,
                "volume_in": 0.0,
                "volume_out": 0.0,
                "net_transfers": 0,
                "tx_count": 0,
                "first_seen": timestamp,
                "last_seen": timestamp,
            }

        entry = token_map[contract]
        entry["tx_count"] += 1
        entry["last_seen"] = max(entry["last_seen"], timestamp)
        entry["first_seen"] = min(entry["first_seen"], timestamp) if entry["first_seen"] else timestamp

        if tx_from == address:
            entry["transfers_out"] += 1
            entry["volume_out"] += value
        else:
            entry["transfers_in"] += 1
            entry["volume_in"] += value

        entry["net_transfers"] = entry["transfers_in"] - entry["transfers_out"]

    # Convert to sorted list
    tokens = sorted(token_map.values(), key=lambda t: t["tx_count"], reverse=True)

    # Identify suspicious patterns
    for token in tokens:
        flags = []
        # Airdrop scam: received but never sent, from unknown contract
        if token["transfers_in"] > 0 and token["transfers_out"] == 0 and token["tx_count"] == 1:
            flags.append("possible_airdrop_scam")
        # Dust attack: very small value, single transfer in
        if token["volume_in"] > 0 and token["volume_in"] < 0.01 and token["transfers_in"] == 1:
            flags.append("possible_dust_attack")
        token["flags"] = flags

    # Summary
    top_token = tokens[0] if tokens else None
    summary = {
        "total_tokens": len(tokens),
        "total_transfers": sum(t["tx_count"] for t in tokens),
        "unique_contracts": len(token_map),
        "top_token": {
            "symbol": top_token["symbol"],
            "tx_count": top_token["tx_count"],
        } if top_token else None,
    }

    result = {
        "address": address,
        "chain_id": chain_id,
        "tokens": tokens[:50],  # Limit to top 50
        "summary": summary,
    }

    _set_cache(key, [result])
    return result

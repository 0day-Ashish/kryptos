"""
Multi-chain transaction fetcher using Etherscan V2 API.
Handles rate limiting, caching, and neighbor discovery.
"""
import os
import time
import hashlib
import json
import requests
from pathlib import Path
from typing import Optional, List, Dict

ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "86PQ988S2PM22W4RDZM6HRZXQSY7SRSPT1")
ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api"

# Simple file-based cache
CACHE_DIR = Path(__file__).parent.parent / ".cache"
CACHE_DIR.mkdir(exist_ok=True)
CACHE_TTL = 300  # 5 minutes

# Rate limiting
_last_call_time = 0.0
RATE_LIMIT_DELAY = 0.25  # 4 calls/sec to stay under free tier


def _rate_limit():
    global _last_call_time
    now = time.time()
    elapsed = now - _last_call_time
    if elapsed < RATE_LIMIT_DELAY:
        time.sleep(RATE_LIMIT_DELAY - elapsed)
    _last_call_time = time.time()


def _cache_key(address: str, chain_id: int, action: str) -> str:
    raw = f"{address.lower()}:{chain_id}:{action}"
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached(key: str) -> Optional[list]:
    cache_file = CACHE_DIR / f"{key}.json"
    if cache_file.exists():
        age = time.time() - cache_file.stat().st_mtime
        if age < CACHE_TTL:
            try:
                return json.loads(cache_file.read_text())
            except Exception:
                pass
    return None


def _set_cache(key: str, data: list):
    cache_file = CACHE_DIR / f"{key}.json"
    try:
        cache_file.write_text(json.dumps(data))
    except Exception:
        pass


def fetch_transactions(address: str, chain_id: int = 1, max_results: int = 200) -> list:
    """
    Fetch normal transactions for a wallet on a given chain.
    Uses caching and rate limiting.
    """
    key = _cache_key(address, chain_id, "txlist")
    cached = _get_cached(key)
    if cached is not None:
        print(f"  [cache hit] {address[:10]}... txlist")
        return cached[:max_results]

    _rate_limit()

    params = {
        "chainid": chain_id,
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": 0,
        "endblock": 99999999,
        "page": 1,
        "offset": max_results,
        "sort": "desc",
        "apikey": ETHERSCAN_API_KEY,
    }

    try:
        resp = requests.get(ETHERSCAN_V2_BASE, params=params, timeout=15)
        data = resp.json()
        if data.get("status") == "1" and data.get("result"):
            txns = data["result"]
            _set_cache(key, txns)
            print(f"  [fetched] {address[:10]}... {len(txns)} normal txns on chain {chain_id}")
            return txns[:max_results]
        else:
            msg = data.get("message", "unknown")
            print(f"  [no data] {address[:10]}... on chain {chain_id}: {msg}")
            return []
    except Exception as e:
        print(f"  [error] fetching {address[:10]}... on chain {chain_id}: {e}")
        return []


def fetch_internal_transactions(address: str, chain_id: int = 1, max_results: int = 100) -> list:
    """Fetch internal (contract) transactions."""
    key = _cache_key(address, chain_id, "txlistinternal")
    cached = _get_cached(key)
    if cached is not None:
        return cached[:max_results]

    _rate_limit()

    params = {
        "chainid": chain_id,
        "module": "account",
        "action": "txlistinternal",
        "address": address,
        "startblock": 0,
        "endblock": 99999999,
        "page": 1,
        "offset": max_results,
        "sort": "desc",
        "apikey": ETHERSCAN_API_KEY,
    }

    try:
        resp = requests.get(ETHERSCAN_V2_BASE, params=params, timeout=15)
        data = resp.json()
        if data.get("status") == "1" and data.get("result"):
            txns = data["result"]
            _set_cache(key, txns)
            return txns[:max_results]
        return []
    except Exception as e:
        print(f"  [error] fetching internal txns: {e}")
        return []


def fetch_token_transfers(address: str, chain_id: int = 1, max_results: int = 100) -> list:
    """Fetch ERC-20 token transfers."""
    key = _cache_key(address, chain_id, "tokentx")
    cached = _get_cached(key)
    if cached is not None:
        return cached[:max_results]

    _rate_limit()

    params = {
        "chainid": chain_id,
        "module": "account",
        "action": "tokentx",
        "address": address,
        "startblock": 0,
        "endblock": 99999999,
        "page": 1,
        "offset": max_results,
        "sort": "desc",
        "apikey": ETHERSCAN_API_KEY,
    }

    try:
        resp = requests.get(ETHERSCAN_V2_BASE, params=params, timeout=15)
        data = resp.json()
        if data.get("status") == "1" and data.get("result"):
            txns = data["result"]
            _set_cache(key, txns)
            return txns[:max_results]
        return []
    except Exception as e:
        print(f"  [error] fetching token txns: {e}")
        return []


def discover_neighbors(address: str, transactions: list, max_neighbors: int = 10) -> List[str]:
    """
    Extract the most relevant neighbor addresses from transactions.
    Prioritizes counterparties with highest volume/frequency.
    """
    address = address.lower()
    counter: Dict[str, float] = {}

    for tx in transactions:
        from_addr = tx.get("from", "").lower()
        to_addr = tx.get("to", "").lower()
        value = int(tx.get("value", 0)) / 1e18

        counterparty = to_addr if from_addr == address else from_addr
        if counterparty and counterparty != address and len(counterparty) == 42:
            counter[counterparty] = counter.get(counterparty, 0) + max(value, 0.001)

    # Sort by total value exchanged
    sorted_neighbors = sorted(counter.items(), key=lambda x: x[1], reverse=True)
    return [addr for addr, _ in sorted_neighbors[:max_neighbors]]


def fetch_neighbor_transactions(
    neighbors: List[str], chain_id: int = 1, max_per_neighbor: int = 50
) -> Dict[str, list]:
    """Fetch transactions for each neighbor (for ML context)."""
    result = {}
    for addr in neighbors:
        txns = fetch_transactions(addr, chain_id, max_per_neighbor)
        if txns:
            result[addr] = txns
    return result


def fetch_balance(address: str, chain_id: int = 1) -> Optional[float]:
    """
    Fetch the current native token balance for a wallet (in ETH/native units).
    Returns None on error.
    """
    key = _cache_key(address, chain_id, "balance")
    cached = _get_cached(key)
    if cached is not None:
        return cached[0] if cached else None

    _rate_limit()

    params = {
        "chainid": chain_id,
        "module": "account",
        "action": "balance",
        "address": address,
        "tag": "latest",
        "apikey": ETHERSCAN_API_KEY,
    }

    try:
        resp = requests.get(ETHERSCAN_V2_BASE, params=params, timeout=10)
        data = resp.json()
        if data.get("status") == "1" and data.get("result"):
            balance_wei = int(data["result"])
            balance_eth = balance_wei / 1e18
            _set_cache(key, [balance_eth])
            return balance_eth
        return None
    except Exception as e:
        print(f"  [error] fetching balance for {address[:10]}...: {e}")
        return None

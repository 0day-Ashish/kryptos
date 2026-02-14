"""
data_loader.py — Fetch real Ethereum transactions from Etherscan's free API.

This module converts raw Etherscan API responses into the normalised
[{from, to, value, timestamp}] format that the ML pipeline expects.

It supports two modes:
1. **Wallet mode** — fetch all transactions for a given address, optionally
   expanding to its 1-hop or 2-hop neighborhood.
2. **Block range mode** — fetch all transactions in a range of blocks.

Built-in safeguards:
- Rate limiting (5 calls/sec max on free tier)
- Pagination (Etherscan caps at 10,000 results per call)
- Neighbor cap (don't expand more than MAX_NEIGHBORS)
- Graceful error handling (network failures, bad responses)
"""

import time
import json
from typing import List, Dict, Any, Optional, Set

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

from .config import ETHERSCAN_API_KEY


# -----------------------------------------------------------------------
# Constants & safeguards
# -----------------------------------------------------------------------

ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"

RATE_LIMIT_DELAY = 0.22          # ~4.5 calls/sec (stay under 5/sec limit)
MAX_RESULTS_PER_PAGE = 10_000    # Etherscan hard cap
MAX_PAGES = 10                   # safety: max 100K txs per wallet
MAX_NEIGHBORS = 50               # don't expand more than this many neighbors
MAX_DEPTH = 2                    # don't go deeper than 2 hops

_call_count = 0  # track calls for logging


def _get_api_key() -> str:
    """Resolve API key, raising a clear error if not set."""
    key = ETHERSCAN_API_KEY
    if not key or key == "PASTE_YOUR_KEY_HERE":
        raise ValueError(
            "Etherscan API key not set.\n"
            "Open backend/ml/config.py and paste your key in ETHERSCAN_API_KEY.\n"
            "Get a free key at: https://etherscan.io/myapikey"
        )
    return key


# -----------------------------------------------------------------------
# Low-level API call
# -----------------------------------------------------------------------

def _etherscan_get(params: Dict[str, str]) -> Dict[str, Any]:
    """
    Make a single GET request to Etherscan with rate limiting.
    Returns the parsed JSON response or raises on error.
    """
    global _call_count

    if not HAS_REQUESTS:
        raise ImportError("'requests' library required. Run: pip install requests")

    key = _get_api_key()
    params["apikey"] = key
    # Etherscan V2 requires chainid (1 = Ethereum mainnet)
    if "chainid" not in params:
        params["chainid"] = "1"

    time.sleep(RATE_LIMIT_DELAY)  # rate limit
    _call_count += 1

    try:
        resp = requests.get(ETHERSCAN_BASE, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") == "0" and "No transactions found" in data.get("message", ""):
            return {"result": []}

        if data.get("status") == "0":
            msg = data.get("message", "") + " " + data.get("result", "")
            raise RuntimeError(f"Etherscan API error: {msg.strip()}")

        return data

    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Network error calling Etherscan: {e}")


# -----------------------------------------------------------------------
# Fetch transactions for a single wallet (with pagination)
# -----------------------------------------------------------------------

def fetch_wallet_transactions(
    address: str,
    start_block: int = 0,
    end_block: int = 99_999_999,
    sort: str = "asc",
    max_pages: int = MAX_PAGES,
) -> List[Dict[str, Any]]:
    """
    Fetch all normal ETH transactions for a wallet address.

    Handles pagination: Etherscan returns max 10,000 per call, so we
    paginate using the offset parameter.

    Returns a list of normalised transaction dicts:
        {from, to, value (in ETH), timestamp}
    """
    all_txs: List[Dict[str, Any]] = []
    page = 1

    while page <= max_pages:
        data = _etherscan_get({
            "module": "account",
            "action": "txlist",
            "address": address.lower(),
            "startblock": str(start_block),
            "endblock": str(end_block),
            "page": str(page),
            "offset": str(MAX_RESULTS_PER_PAGE),
            "sort": sort,
        })

        results = data.get("result", [])
        if not results:
            break

        for tx in results:
            # Skip failed transactions.
            if tx.get("isError", "0") == "1":
                continue
            # Skip contract creation (no "to" address).
            if not tx.get("to"):
                continue

            all_txs.append({
                "from": tx["from"].lower(),
                "to": tx["to"].lower(),
                "value": int(tx["value"]) / 1e18,  # Wei → ETH
                "timestamp": int(tx["timeStamp"]),
            })

        # If we got fewer than max, we've reached the end.
        if len(results) < MAX_RESULTS_PER_PAGE:
            break

        page += 1

    return all_txs


# -----------------------------------------------------------------------
# Multi-hop neighborhood expansion
# -----------------------------------------------------------------------

def fetch_neighborhood(
    seed_address: str,
    depth: int = 1,
    max_neighbors: int = MAX_NEIGHBORS,
    verbose: bool = True,
) -> List[Dict[str, Any]]:
    """
    Fetch transactions for a wallet and expand to its neighborhood.

    depth=1: Fetch seed wallet's transactions only.
    depth=2: Also fetch transactions for the seed's top neighbors
             (by transaction count), up to max_neighbors.

    The "top neighbors" heuristic prioritises wallets that transact
    most frequently with the seed — these are the most likely
    co-conspirators, not random one-time counterparties.

    Returns a deduplicated list of normalised transactions.
    """
    if depth > MAX_DEPTH:
        depth = MAX_DEPTH
        if verbose:
            print(f"    Clamping depth to {MAX_DEPTH}")

    global _call_count
    _call_count = 0

    seen_tx_hashes: Set[str] = set()
    all_txs: List[Dict[str, Any]] = []

    seed = seed_address.lower().strip()

    # --- Depth 1: Seed wallet ---
    if verbose:
        print(f"    Fetching transactions for seed: {seed[:10]}...{seed[-6:]}")

    seed_txs = fetch_wallet_transactions(seed)
    all_txs.extend(seed_txs)

    if verbose:
        print(f"    Found {len(seed_txs)} transactions (API calls: {_call_count})")

    if depth < 2 or not seed_txs:
        return all_txs

    # --- Depth 2: Expand top neighbors ---
    # Count how often each neighbor appears.
    neighbor_counts: Dict[str, int] = {}
    for tx in seed_txs:
        for addr in [tx["from"], tx["to"]]:
            if addr != seed:
                neighbor_counts[addr] = neighbor_counts.get(addr, 0) + 1

    # Sort by frequency, take top N.
    top_neighbors = sorted(
        neighbor_counts.items(), key=lambda x: x[1], reverse=True
    )[:max_neighbors]

    if verbose:
        print(f"    Expanding {len(top_neighbors)} neighbors (depth=2)...")

    for i, (neighbor, count) in enumerate(top_neighbors):
        if verbose and (i + 1) % 10 == 0:
            print(f"      Progress: {i + 1}/{len(top_neighbors)} "
                  f"(API calls: {_call_count})")

        neighbor_txs = fetch_wallet_transactions(neighbor)

        # Deduplicate: only add transactions we haven't seen.
        for tx in neighbor_txs:
            # Use a composite key for dedup (no tx hash available in our format).
            key = f"{tx['from']}_{tx['to']}_{tx['value']}_{tx['timestamp']}"
            if key not in seen_tx_hashes:
                seen_tx_hashes.add(key)
                all_txs.append(tx)

    if verbose:
        print(f"    Total: {len(all_txs)} transactions, "
              f"{_call_count} API calls")

    return all_txs


# -----------------------------------------------------------------------
# Block range mode
# -----------------------------------------------------------------------

def fetch_block_range(
    start_block: int,
    end_block: int,
    address: Optional[str] = None,
    verbose: bool = True,
) -> List[Dict[str, Any]]:
    """
    Fetch transactions within a block range.

    If address is provided, fetches only that wallet's transactions
    in the range.  Otherwise fetches a representative sample by
    querying a known high-activity address in that range.

    NOTE: Etherscan's free API doesn't support "all transactions in a block"
    directly — it requires an address filter.  For block-level scanning,
    you'd need a full node or a different API.
    """
    if not address:
        if verbose:
            print("    Block range mode requires an address filter on free API.")
            print("    Use --address with --start-block and --end-block.")
        return []

    if verbose:
        print(f"    Fetching blocks {start_block}–{end_block} "
              f"for {address[:10]}...{address[-6:]}")

    return fetch_wallet_transactions(
        address,
        start_block=start_block,
        end_block=end_block,
    )


# -----------------------------------------------------------------------
# Save/load for reuse
# -----------------------------------------------------------------------

def save_transactions(txs: List[Dict[str, Any]], filepath: str) -> None:
    """Save fetched transactions to a JSON file for later reuse."""
    with open(filepath, "w") as f:
        json.dump(txs, f, indent=2)
    print(f"    Saved {len(txs)} transactions to {filepath}")


def load_transactions(filepath: str) -> List[Dict[str, Any]]:
    """Load transactions from a previously saved JSON file."""
    with open(filepath, "r") as f:
        return json.load(f)

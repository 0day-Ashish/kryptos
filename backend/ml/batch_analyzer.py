"""
batch_analyzer.py — Bulk address analysis from CSV or JSON input.

Processes multiple addresses in parallel (with rate limiting) and
returns aggregated risk scores.
"""

import csv
import io
import time
import json
from typing import Dict, List, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from backend.ml.fetcher import (
        fetch_transactions, fetch_internal_transactions,
        fetch_token_transfers, discover_neighbors, fetch_neighbor_transactions,
        fetch_balance,
    )
    from backend.ml.scorer import wallet_scorer
    from backend.ml.sanctions import check_sanctions
    from backend.ml.ens_resolver import resolve_input
except ModuleNotFoundError:
    from ml.fetcher import (
        fetch_transactions, fetch_internal_transactions,
        fetch_token_transfers, discover_neighbors, fetch_neighbor_transactions,
        fetch_balance,
    )
    from ml.scorer import wallet_scorer
    from ml.sanctions import check_sanctions
    from ml.ens_resolver import resolve_input


MAX_BATCH_SIZE = 50
DEFAULT_CHAIN_ID = 1


def _analyze_single(address: str, chain_id: int, quick: bool = True) -> Dict[str, Any]:
    """
    Analyze a single address with optional quick mode.
    Quick mode uses fewer neighbors for faster processing.
    """
    address = address.strip().lower()

    # Resolve ENS if needed
    if address.endswith(".eth"):
        resolved = resolve_input(address)
        if resolved.get("resolved") and resolved.get("address"):
            ens_name = resolved.get("ens_name")
            address = resolved["address"].lower()
        else:
            return {
                "address": address,
                "error": "Could not resolve ENS name",
                "risk_score": None,
            }
    else:
        ens_name = None

    # Validate address format
    if not address.startswith("0x") or len(address) != 42:
        return {
            "address": address,
            "error": "Invalid address format",
            "risk_score": None,
        }

    try:
        # Fetch transactions
        max_txns = 100 if quick else 200
        max_neighbors = 4 if quick else 8

        normal_txns = fetch_transactions(address, chain_id, max_results=max_txns)
        internal_txns = fetch_internal_transactions(address, chain_id, max_results=50)
        all_txns = normal_txns + internal_txns

        if not all_txns:
            return {
                "address": address,
                "ens_name": ens_name,
                "risk_score": 0,
                "risk_label": "No Data",
                "flags": ["No transactions found"],
                "tx_count": 0,
            }

        # Discover neighbors
        neighbors = discover_neighbors(address, all_txns, max_neighbors=max_neighbors)
        neighbor_txns = fetch_neighbor_transactions(neighbors, chain_id, max_per_neighbor=30)

        # Score
        result = wallet_scorer.score_wallet(address, all_txns, neighbor_txns, chain_id)

        # Quick sanctions check
        sanctions = check_sanctions(address)
        risk_score = result["risk_score"]
        if sanctions["risk_modifier"] > 0:
            risk_score = min(100, risk_score + sanctions["risk_modifier"])

        return {
            "address": address,
            "ens_name": ens_name,
            "risk_score": risk_score,
            "risk_label": result["risk_label"],
            "ml_raw_score": result["ml_raw_score"],
            "heuristic_score": result["heuristic_score"],
            "flags": result["flags"],
            "tx_count": result.get("feature_summary", {}).get("tx_count", len(all_txns)),
            "is_sanctioned": sanctions.get("is_sanctioned", False),
        }

    except Exception as e:
        return {
            "address": address,
            "error": str(e),
            "risk_score": None,
        }


def analyze_batch(
    addresses: List[str],
    chain_id: int = DEFAULT_CHAIN_ID,
    quick: bool = True,
    max_workers: int = 2,
) -> Dict[str, Any]:
    """
    Analyze a batch of addresses sequentially (respecting API rate limits).

    Returns:
      results     – list of per-address results
      summary     – aggregate statistics
      errors      – count of failed analyses
    """
    # Cap batch size
    if len(addresses) > MAX_BATCH_SIZE:
        return {
            "error": f"Batch too large. Maximum {MAX_BATCH_SIZE} addresses.",
            "max_batch_size": MAX_BATCH_SIZE,
        }

    # Deduplicate
    unique_addrs = list(dict.fromkeys(addr.strip().lower() for addr in addresses if addr.strip()))

    results = []
    errors = 0

    print(f"\n{'='*60}")
    print(f"📦 Batch analysis: {len(unique_addrs)} addresses on chain {chain_id}")
    print(f"{'='*60}")

    for i, addr in enumerate(unique_addrs):
        print(f"  [{i+1}/{len(unique_addrs)}] Analyzing {addr[:12]}...")
        result = _analyze_single(addr, chain_id, quick)
        results.append(result)
        if result.get("error"):
            errors += 1
        # Small delay between addresses to respect rate limits
        time.sleep(0.5)

    # Compute summary
    scored = [r for r in results if r.get("risk_score") is not None]
    high_risk = [r for r in scored if r["risk_score"] >= 75]
    medium_risk = [r for r in scored if 40 <= r["risk_score"] < 75]
    low_risk = [r for r in scored if r["risk_score"] < 40]
    sanctioned = [r for r in scored if r.get("is_sanctioned")]

    avg_score = sum(r["risk_score"] for r in scored) / len(scored) if scored else 0

    summary = {
        "total_addresses": len(unique_addrs),
        "successfully_analyzed": len(scored),
        "errors": errors,
        "avg_risk_score": round(avg_score, 1),
        "high_risk_count": len(high_risk),
        "medium_risk_count": len(medium_risk),
        "low_risk_count": len(low_risk),
        "sanctioned_count": len(sanctioned),
    }

    print(f"\n📊 Batch summary: {len(scored)} analyzed, avg score={avg_score:.1f}")
    print(f"   High: {len(high_risk)}, Medium: {len(medium_risk)}, Low: {len(low_risk)}")

    return {
        "results": results,
        "summary": summary,
    }


def parse_csv_addresses(csv_content: str) -> List[str]:
    """
    Parse addresses from CSV content.
    Accepts single-column CSV or looks for 'address' column.
    """
    addresses = []
    reader = csv.reader(io.StringIO(csv_content))

    header = None
    addr_col = 0

    for i, row in enumerate(reader):
        if not row:
            continue

        # Check if first row is a header
        if i == 0:
            lower_row = [c.lower().strip() for c in row]
            if "address" in lower_row:
                header = lower_row
                addr_col = lower_row.index("address")
                continue
            elif not row[0].startswith("0x") and not row[0].endswith(".eth"):
                # Likely a header without 'address' column name
                continue

        if addr_col < len(row):
            addr = row[addr_col].strip()
            if addr and (addr.startswith("0x") or addr.endswith(".eth")):
                addresses.append(addr)

    return addresses

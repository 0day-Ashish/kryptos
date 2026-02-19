"""
Token Risk Scanner — Phase 1
Fetches token metadata, holder distribution, creator wallet info,
and contract source analysis via Etherscan V2 API.
"""
import os
import time
import json
import requests
from typing import Optional, Dict, List, Any
from collections import Counter
from pathlib import Path

from .fetcher import (
    _rate_limit, _cache_key, _get_cached, _set_cache,
    fetch_transactions, fetch_balance,
    ETHERSCAN_API_KEY, ETHERSCAN_V2_BASE,
)
from .config import get_chain_by_id
from .known_labels import lookup_address


# ── Etherscan Helpers ────────────────────────────────────────────────────────

def _etherscan_get(params: dict, chain_id: int = 1) -> Optional[Any]:
    """Generic Etherscan V2 GET with rate limiting + error handling."""
    _rate_limit()
    params["chainid"] = chain_id
    params["apikey"] = ETHERSCAN_API_KEY
    try:
        resp = requests.get(ETHERSCAN_V2_BASE, params=params, timeout=15)
        data = resp.json()
        if data.get("status") == "1" and data.get("result"):
            return data["result"]
        return None
    except Exception as e:
        print(f"  [error] Etherscan request failed: {e}")
        return None


# ── Token Metadata ───────────────────────────────────────────────────────────

def fetch_token_info(contract_address: str, chain_id: int = 1) -> Dict[str, Any]:
    """
    Fetch basic token info by analyzing the contract's ERC-20 token transfers.
    Extracts name, symbol, decimals from the first transfer event.
    """
    key = _cache_key(contract_address, chain_id, "tokeninfo")
    cached = _get_cached(key)
    if cached is not None:
        return cached[0] if cached else {}

    # Fetch a small batch of token transfers involving this contract
    result = _etherscan_get({
        "module": "account",
        "action": "tokentx",
        "contractaddress": contract_address,
        "page": 1,
        "offset": 5,
        "sort": "asc",
    }, chain_id)

    info = {
        "name": "Unknown",
        "symbol": "???",
        "decimals": 18,
        "contract_address": contract_address.lower(),
    }

    if result and len(result) > 0:
        tx = result[0]
        info["name"] = tx.get("tokenName", "Unknown")
        info["symbol"] = tx.get("tokenSymbol", "???")
        info["decimals"] = int(tx.get("tokenDecimal", 18))

    _set_cache(key, [info])
    print(f"  [token info] {info['name']} ({info['symbol']}) decimals={info['decimals']}")
    return info


# ── Contract Source / ABI Analysis ───────────────────────────────────────────

def fetch_contract_source(contract_address: str, chain_id: int = 1) -> Dict[str, Any]:
    """
    Fetch contract source code and ABI from Etherscan.
    Checks for verification status, dangerous functions (mint, pause, blacklist).
    """
    key = _cache_key(contract_address, chain_id, "contractsource")
    cached = _get_cached(key)
    if cached is not None:
        return cached[0] if cached else {}

    _rate_limit()
    params = {
        "chainid": chain_id,
        "module": "contract",
        "action": "getsourcecode",
        "address": contract_address,
        "apikey": ETHERSCAN_API_KEY,
    }

    analysis = {
        "is_verified": False,
        "compiler_version": None,
        "contract_name": None,
        "is_proxy": False,
        "implementation": None,
        "has_mint_function": False,
        "has_pause_function": False,
        "has_blacklist": False,
        "has_owner": False,
        "is_renounced": False,
        "source_length": 0,
        "license": None,
        "source_code": None,
        "abi": None,
    }

    try:
        resp = requests.get(ETHERSCAN_V2_BASE, params=params, timeout=15)
        data = resp.json()

        if data.get("status") == "1" and data.get("result"):
            contract = data["result"][0]
            source = contract.get("SourceCode", "")
            abi_str = contract.get("ABI", "")
            contract_name = contract.get("ContractName", "")

            analysis["is_verified"] = bool(source and source.strip() and abi_str != "Contract source code not verified")
            analysis["compiler_version"] = contract.get("CompilerVersion", None)
            analysis["contract_name"] = contract_name or None
            analysis["is_proxy"] = bool(contract.get("Proxy") == "1" or contract.get("Implementation"))
            analysis["implementation"] = contract.get("Implementation") or None
            analysis["license"] = contract.get("LicenseType", None)
            analysis["source_length"] = len(source)

            # Store raw source and ABI for frontend code viewer
            if analysis["is_verified"] and source:
                # Handle Etherscan multi-file JSON format
                clean_source = source
                if clean_source.startswith("{") or clean_source.startswith("{{"): 
                    try:
                        # Double-brace wrapped JSON (Etherscan multi-file)
                        if clean_source.startswith("{{"):
                            clean_source = clean_source[1:-1]
                        parsed = json.loads(clean_source)
                        if isinstance(parsed, dict) and "sources" in parsed:
                            # Concatenate all source files
                            parts = []
                            for fname, fdata in parsed["sources"].items():
                                parts.append(f"// ── {fname} ──\n{fdata.get('content', '')}")
                            clean_source = "\n\n".join(parts)
                        elif isinstance(parsed, dict):
                            parts = []
                            for fname, fdata in parsed.items():
                                content = fdata.get("content", fdata) if isinstance(fdata, dict) else str(fdata)
                                parts.append(f"// ── {fname} ──\n{content}")
                            clean_source = "\n\n".join(parts)
                    except (json.JSONDecodeError, TypeError):
                        pass  # Use raw source as-is
                analysis["source_code"] = clean_source

            if abi_str and abi_str != "Contract source code not verified":
                try:
                    analysis["abi"] = json.loads(abi_str)
                except json.JSONDecodeError:
                    analysis["abi"] = None

            # Analyze source code for dangerous patterns
            source_lower = source.lower()
            analysis["has_mint_function"] = any(
                kw in source_lower for kw in ["function mint(", "function _mint(", "function mint ("]
            )
            analysis["has_pause_function"] = any(
                kw in source_lower for kw in ["function pause(", "whennotpaused", "whenpaused", "pausable"]
            )
            analysis["has_blacklist"] = any(
                kw in source_lower for kw in [
                    "blacklist", "blocklist", "isblacklisted", "isblocklisted",
                    "function deny(", "function ban(",
                ]
            )
            analysis["has_owner"] = any(
                kw in source_lower for kw in ["ownable", "function owner(", "onlyowner"]
            )

            # Try to parse ABI for renounced ownership
            if abi_str and abi_str != "Contract source code not verified":
                try:
                    abi = json.loads(abi_str)
                    fn_names = [item.get("name", "").lower() for item in abi if item.get("type") == "function"]
                    if "renounceownership" in fn_names:
                        # Ownership CAN be renounced, but we can't confirm on-chain here
                        analysis["is_renounced"] = False  # Need on-chain call to confirm
                except json.JSONDecodeError:
                    pass

            print(f"  [contract] verified={analysis['is_verified']} mint={analysis['has_mint_function']} pause={analysis['has_pause_function']} blacklist={analysis['has_blacklist']}")
    except Exception as e:
        print(f"  [error] fetching contract source: {e}")

    _set_cache(key, [analysis])
    return analysis


# ── Holder Distribution ──────────────────────────────────────────────────────

def analyze_holder_distribution(
    contract_address: str, chain_id: int = 1, max_transfers: int = 2000
) -> Dict[str, Any]:
    """
    Approximate holder distribution by replaying token transfers.
    Counts transfers in/out per address to estimate current balances.
    Returns top holders and concentration metrics.
    """
    key = _cache_key(contract_address, chain_id, "holder_dist")
    cached = _get_cached(key)
    if cached is not None:
        return cached[0] if cached else {}

    # Fetch a large batch of token transfers for this contract
    all_transfers = []
    page = 1
    per_page = 1000

    while len(all_transfers) < max_transfers:
        result = _etherscan_get({
            "module": "account",
            "action": "tokentx",
            "contractaddress": contract_address,
            "page": page,
            "offset": per_page,
            "sort": "desc",
        }, chain_id)

        if not result:
            break
        all_transfers.extend(result)
        if len(result) < per_page:
            break
        page += 1

    if not all_transfers:
        empty = {
            "total_transfers": 0,
            "unique_holders": 0,
            "top10_pct": 0,
            "top20_pct": 0,
            "top_holders": [],
            "holder_concentration": 0,
            "total_supply_estimated": 0,
        }
        _set_cache(key, [empty])
        return empty

    # Replay transfers to estimate balances
    decimals = int(all_transfers[0].get("tokenDecimal", 18)) if all_transfers else 18
    balances: Dict[str, float] = {}
    zero_addr = "0x0000000000000000000000000000000000000000"

    for tx in all_transfers:
        from_addr = tx.get("from", "").lower()
        to_addr = tx.get("to", "").lower()
        try:
            value = int(tx.get("value", "0")) / (10 ** decimals)
        except (ValueError, OverflowError):
            continue

        if from_addr and from_addr != zero_addr:
            balances[from_addr] = balances.get(from_addr, 0) - value
        if to_addr and to_addr != zero_addr:
            balances[to_addr] = balances.get(to_addr, 0) + value

    # Clean up — only positive balances (actual holders)
    positive_balances = {
        addr: bal for addr, bal in balances.items()
        if bal > 0 and addr != zero_addr
    }

    total_held = sum(positive_balances.values())
    sorted_holders = sorted(positive_balances.items(), key=lambda x: x[1], reverse=True)

    # Top holder metrics
    top10 = sorted_holders[:10]
    top20 = sorted_holders[:20]
    top10_total = sum(b for _, b in top10)
    top20_total = sum(b for _, b in top20)

    top10_pct = (top10_total / total_held * 100) if total_held > 0 else 0
    top20_pct = (top20_total / total_held * 100) if total_held > 0 else 0

    # Build top holders list with labels
    top_holders = []
    for addr, bal in sorted_holders[:20]:
        pct = (bal / total_held * 100) if total_held > 0 else 0
        label_info = lookup_address(addr)
        top_holders.append({
            "address": addr,
            "balance": round(bal, 4),
            "percentage": round(pct, 2),
            "label": label_info["label"] if label_info else None,
            "category": label_info["category"] if label_info else None,
        })

    distribution = {
        "total_transfers": len(all_transfers),
        "unique_holders": len(positive_balances),
        "top10_pct": round(top10_pct, 2),
        "top20_pct": round(top20_pct, 2),
        "top_holders": top_holders,
        "holder_concentration": round(top10_pct, 2),  # alias
        "total_supply_estimated": round(total_held, 4),
    }

    _set_cache(key, [distribution])
    print(f"  [holders] {distribution['unique_holders']} holders, top10={distribution['top10_pct']}%")
    return distribution


# ── Creator / Deployer Analysis ──────────────────────────────────────────────

def find_contract_creator(contract_address: str, chain_id: int = 1) -> Dict[str, Any]:
    """
    Find the deployer of a contract by looking up its creation transaction.
    """
    key = _cache_key(contract_address, chain_id, "creator")
    cached = _get_cached(key)
    if cached is not None:
        return cached[0] if cached else {}

    result = _etherscan_get({
        "module": "contract",
        "action": "getcontractcreation",
        "contractaddresses": contract_address,
    }, chain_id)

    creator_info = {
        "creator_address": None,
        "creation_tx": None,
        "creator_balance": None,
        "creator_tx_count": 0,
        "creator_other_contracts": 0,
    }

    if result and len(result) > 0:
        creator_info["creator_address"] = result[0].get("contractCreator", "").lower()
        creator_info["creation_tx"] = result[0].get("txHash", "")

        if creator_info["creator_address"]:
            # Fetch deployer's transaction history to check how many contracts they've deployed
            deployer = creator_info["creator_address"]
            creator_info["creator_balance"] = fetch_balance(deployer, chain_id)

            deployer_txs = fetch_transactions(deployer, chain_id, max_results=200)
            creator_info["creator_tx_count"] = len(deployer_txs)

            # Count contract deployments (transactions with empty 'to' field)
            contract_deploys = sum(
                1 for tx in deployer_txs
                if not tx.get("to") or tx.get("to") == ""
            )
            creator_info["creator_other_contracts"] = contract_deploys

    _set_cache(key, [creator_info])
    print(f"  [creator] {creator_info['creator_address'] or 'unknown'}, {creator_info['creator_other_contracts']} deploys")
    return creator_info


# ── Risk Scoring ─────────────────────────────────────────────────────────────

def compute_token_risk_score(
    contract_source: Dict,
    holder_dist: Dict,
    creator_info: Dict,
) -> Dict[str, Any]:
    """
    Compute a 0–100 risk score for a token based on Phase 1 signals.
    Higher score = riskier.
    """
    score = 0.0
    flags = []
    breakdown = {}

    # ── Contract Verification (0-15 pts) ──
    if not contract_source.get("is_verified"):
        score += 15
        flags.append("Contract source code is NOT verified")
        breakdown["verification"] = 15
    else:
        breakdown["verification"] = 0

    # ── Dangerous Functions (0-25 pts) ──
    func_score = 0
    if contract_source.get("has_mint_function"):
        func_score += 10
        flags.append("Mint function detected — owner can inflate supply")
    if contract_source.get("has_pause_function"):
        func_score += 5
        flags.append("Pausable contract — trading can be halted by owner")
    if contract_source.get("has_blacklist"):
        func_score += 10
        flags.append("Blacklist function — owner can block specific wallets")
    score += func_score
    breakdown["dangerous_functions"] = func_score

    # ── Ownership (0-10 pts) ──
    ownership_score = 0
    if contract_source.get("has_owner") and not contract_source.get("is_renounced"):
        ownership_score += 5
        flags.append("Contract has active ownership (not renounced)")
    if contract_source.get("is_proxy"):
        ownership_score += 5
        flags.append("Proxy contract — logic can be changed by owner")
    score += ownership_score
    breakdown["ownership"] = ownership_score

    # ── Holder Concentration (0-25 pts) ──
    concentration_score = 0
    top10 = holder_dist.get("top10_pct", 0)
    unique_holders = holder_dist.get("unique_holders", 0)

    if top10 > 90:
        concentration_score += 25
        flags.append(f"Extreme concentration — top 10 wallets hold {top10:.1f}%")
    elif top10 > 70:
        concentration_score += 15
        flags.append(f"High concentration — top 10 wallets hold {top10:.1f}%")
    elif top10 > 50:
        concentration_score += 8
        flags.append(f"Moderate concentration — top 10 wallets hold {top10:.1f}%")

    if unique_holders < 50:
        concentration_score += 5
        flags.append(f"Very few unique holders ({unique_holders})")
    score += concentration_score
    breakdown["holder_concentration"] = concentration_score

    # ── Creator Risk (0-15 pts) ──
    creator_score = 0
    if creator_info.get("creator_address"):
        other_contracts = creator_info.get("creator_other_contracts", 0)
        if other_contracts > 20:
            creator_score += 10
            flags.append(f"Deployer has created {other_contracts} contracts (serial deployer)")
        elif other_contracts > 10:
            creator_score += 5
            flags.append(f"Deployer has created {other_contracts} contracts")

        creator_tx_count = creator_info.get("creator_tx_count", 0)
        if creator_tx_count < 5:
            creator_score += 5
            flags.append("Deployer wallet has very little history")
    else:
        creator_score += 5
        flags.append("Could not identify contract deployer")
    score += creator_score
    breakdown["creator_risk"] = creator_score

    # ── Low Activity (0-10 pts) ──
    activity_score = 0
    total_transfers = holder_dist.get("total_transfers", 0)
    if total_transfers < 10:
        activity_score += 10
        flags.append(f"Very low transfer activity ({total_transfers} transfers)")
    elif total_transfers < 50:
        activity_score += 5
    score += activity_score
    breakdown["activity"] = activity_score

    # Clamp
    final_score = int(min(max(score, 0), 100))

    # Label
    if final_score >= 75:
        risk_label = "High Risk"
    elif final_score >= 40:
        risk_label = "Medium Risk"
    else:
        risk_label = "Low Risk"

    # Add positive flag if clean
    if final_score < 25:
        flags.append("No major red flags detected")

    return {
        "risk_score": final_score,
        "risk_label": risk_label,
        "flags": flags,
        "score_breakdown": breakdown,
    }


# ── Main Scanner Entry Point ────────────────────────────────────────────────

def scan_token(contract_address: str, chain_id: int = 1) -> Dict[str, Any]:
    """
    Full token risk scan — Phase 1.
    1. Fetch token metadata (name, symbol, decimals)
    2. Analyze contract source (verification, dangerous functions)
    3. Compute holder distribution from transfer history
    4. Identify and analyze the deployer wallet
    5. Score everything into a 0–100 risk score
    """
    contract_address = contract_address.lower()
    chain = get_chain_by_id(chain_id)

    print(f"\n{'='*60}")
    print(f"🪙 Token Scan: {contract_address} on {chain['name']}")
    print(f"{'='*60}")

    # Step 1: Token info
    print("📡 Step 1: Fetching token metadata...")
    token_info = fetch_token_info(contract_address, chain_id)

    # Step 2: Contract source analysis
    print("📜 Step 2: Analyzing contract source...")
    contract_source = fetch_contract_source(contract_address, chain_id)

    # Step 3: Holder distribution
    print("👥 Step 3: Analyzing holder distribution...")
    holder_dist = analyze_holder_distribution(contract_address, chain_id)

    # Step 4: Creator analysis
    print("🔍 Step 4: Identifying deployer...")
    creator_info = find_contract_creator(contract_address, chain_id)

    # Step 5: Compute risk score
    print("🧠 Step 5: Computing risk score...")
    risk = compute_token_risk_score(contract_source, holder_dist, creator_info)

    result = {
        "contract_address": contract_address,
        "chain": {
            "id": chain["id"],
            "name": chain["name"],
            "short": chain["short"],
            "explorer": chain["explorer"],
        },
        "token": token_info,
        "risk_score": risk["risk_score"],
        "risk_label": risk["risk_label"],
        "flags": risk["flags"],
        "score_breakdown": risk["score_breakdown"],
        "contract_analysis": {
            "is_verified": contract_source.get("is_verified", False),
            "contract_name": contract_source.get("contract_name"),
            "compiler_version": contract_source.get("compiler_version"),
            "is_proxy": contract_source.get("is_proxy", False),
            "has_mint_function": contract_source.get("has_mint_function", False),
            "has_pause_function": contract_source.get("has_pause_function", False),
            "has_blacklist": contract_source.get("has_blacklist", False),
            "has_owner": contract_source.get("has_owner", False),
            "is_renounced": contract_source.get("is_renounced", False),
            "license": contract_source.get("license"),
            "source_code": contract_source.get("source_code"),
            "abi": contract_source.get("abi"),
        },
        "holder_distribution": {
            "unique_holders": holder_dist.get("unique_holders", 0),
            "top10_pct": holder_dist.get("top10_pct", 0),
            "top20_pct": holder_dist.get("top20_pct", 0),
            "total_supply_estimated": holder_dist.get("total_supply_estimated", 0),
            "total_transfers": holder_dist.get("total_transfers", 0),
            "top_holders": holder_dist.get("top_holders", [])[:10],
        },
        "creator": {
            "address": creator_info.get("creator_address"),
            "creation_tx": creator_info.get("creation_tx"),
            "balance": creator_info.get("creator_balance"),
            "tx_count": creator_info.get("creator_tx_count", 0),
            "other_contracts_deployed": creator_info.get("creator_other_contracts", 0),
        },
    }

    print(f"✅ Token Risk Score: {result['risk_score']}/100 ({result['risk_label']})")
    print(f"   Flags: {result['flags']}")
    print(f"{'='*60}\n")

    return result

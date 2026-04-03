"""
Contract Risk Computation Module

Extracts contract addresses from wallet transactions,
computes risk scores using NLP analysis, and provides
wallet-level contract risk aggregation.
"""

import os
import json
from typing import Dict, List, Set, Optional, Any
from pathlib import Path


def extract_contract_addresses(transactions: List[Dict]) -> Set[str]:
    """
    Extract unique contract addresses from wallet transactions.
    
    Identifies contracts from:
    1. ERC-20 token transfers (contractAddress field)
    2. Contract calls (non-empty input data)
    3. to_address where interaction indicates contract
    
    Args:
        transactions: List of transaction dicts from Etherscan
    
    Returns:
        Set of unique contract addresses (lowercase)
    """
    contracts = set()
    
    for tx in transactions:
        # Method 1: ERC-20 token contract
        contract_addr = tx.get("contractAddress", "").lower().strip()
        if contract_addr and contract_addr != "":
            contracts.add(contract_addr)
        
        # Method 2: Contract calls (input data present)
        to_addr = tx.get("to", "").lower().strip()
        input_data = tx.get("input", "0x")
        
        # Contract interaction: input length > 10 chars (beyond "0x")
        if to_addr and input_data and len(input_data) > 10:
            contracts.add(to_addr)
    
    # Filter out zero address
    contracts.discard("0x0000000000000000000000000000000000000000")
    contracts.discard("")
    
    return contracts


RISKY_FN_HIGH = [
    "selfdestruct", "destroy", "kill", "drain", "rugpull", "rug",
    "emergencywithdraw", "withdrawall", "sweeptoken", "sweepeth",
]
RISKY_FN_MEDIUM = [
    "setfee", "settax", "setmaxwallet", "setmaxtx", "setmaxtransaction",
    "blacklist", "addtoblacklist", "blocklist", "denylist",
    "mint", "mintto", "minttoken",
    "pause", "unpause",
    "excludefromfee", "excludefromtax",
    "transferownership", "setnewowner",
    "setswapback", "manualswap", "manualburn",
]
RISKY_FN_LOW = [
    "approve", "increaseallowance",
    "withdraw", "withdraweth", "claim", "claimreward", "claimrewards",
]


def compute_wallet_contract_risk_from_txs(
    transactions: List[Dict],
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Compute contract risk for a wallet purely from its transaction history.
    No external API calls needed — works offline for batch scoring.

    Signals: risky function names, failed tx rate, contract interaction
    intensity, zero-value call patterns, approve patterns, opaque calls.

    Returns dict with raw_score, contract_risk (0/0.5/1.0), severity,
    confidence, reasons, and optional debug info.
    """
    if not transactions:
        return {
            "raw_score": 0.0,
            "contract_risk": 0.0,
            "severity": "LOW",
            "confidence": 0.1,
            "reasons": ["No transaction data available"],
        }

    signals: Dict[str, float] = {}
    reasons: List[str] = []
    total_txs = len(transactions)

    fn_names_raw = [tx.get("functionName", "") or "" for tx in transactions]
    fn_names = [fn.split("(")[0].strip().lower() for fn in fn_names_raw if fn]

    # ── Signal 1: Risky function-name patterns ──
    high_hits = [fn for fn in fn_names if any(p in fn for p in RISKY_FN_HIGH)]
    med_hits = [fn for fn in fn_names if any(p in fn for p in RISKY_FN_MEDIUM)]
    low_hits = [fn for fn in fn_names if any(p in fn for p in RISKY_FN_LOW)]

    if high_hits:
        fn_score = min(1.0, 0.7 + 0.05 * len(high_hits))
        reasons.append(f"High-risk contract functions: {', '.join(sorted(set(high_hits))[:3])}")
    elif med_hits:
        fn_score = min(0.6, 0.3 + 0.04 * len(med_hits))
        reasons.append(f"Medium-risk contract functions: {', '.join(sorted(set(med_hits))[:3])}")
    elif low_hits:
        fn_score = min(0.25, 0.1 + 0.02 * len(low_hits))
    else:
        fn_score = 0.0
    signals["function_risk"] = fn_score

    # ── Signal 2: Failed transaction rate ──
    failed = sum(1 for tx in transactions if str(tx.get("isError", "0")) == "1")
    fail_ratio = failed / total_txs if total_txs > 0 else 0.0

    if fail_ratio > 0.4:
        fail_score = 0.5
        reasons.append(f"Very high failure rate ({failed}/{total_txs})")
    elif fail_ratio > 0.2:
        fail_score = 0.3
        reasons.append(f"Elevated failure rate ({failed}/{total_txs})")
    elif fail_ratio > 0.1:
        fail_score = 0.15
    else:
        fail_score = 0.0
    signals["fail_rate"] = fail_score

    # ── Signal 3: Contract interaction intensity ──
    contract_calls = sum(
        1 for tx in transactions
        if (tx.get("input", "0x") or "0x") not in ("0x", "")
        and len(str(tx.get("input", ""))) > 10
    )
    contract_ratio = contract_calls / total_txs if total_txs > 0 else 0.0
    contracts = extract_contract_addresses(transactions)
    n_contracts = len(contracts)

    if n_contracts > 15 and contract_ratio > 0.7:
        intensity_score = 0.35
        reasons.append(f"Heavy contract interaction ({n_contracts} contracts)")
    elif n_contracts > 8 and contract_ratio > 0.5:
        intensity_score = 0.2
    elif n_contracts > 3:
        intensity_score = 0.1
    else:
        intensity_score = 0.0
    signals["intensity"] = intensity_score

    # ── Signal 4: Zero-value contract calls ──
    zv_calls = sum(
        1 for tx in transactions
        if str(tx.get("value", "0")) == "0"
        and (tx.get("input", "0x") or "0x") not in ("0x", "")
        and len(str(tx.get("input", ""))) > 10
    )
    zv_ratio = zv_calls / total_txs if total_txs > 0 else 0.0

    if zv_ratio > 0.7 and total_txs > 5:
        zv_score = 0.2
        reasons.append("Predominantly zero-value contract calls")
    elif zv_ratio > 0.4:
        zv_score = 0.1
    else:
        zv_score = 0.0
    signals["zero_value"] = zv_score

    # ── Signal 5: Approve pattern (potential token draining) ──
    approve_count = sum(1 for fn in fn_names if "approve" in fn)
    if approve_count > 5:
        approve_score = 0.3
        reasons.append(f"Many approve calls ({approve_count})")
    elif approve_count > 2:
        approve_score = 0.15
    else:
        approve_score = 0.0
    signals["approve"] = approve_score

    # ── Signal 6: Opaque calls (to unverified / undecoded contracts) ──
    opaque = sum(
        1 for tx in transactions
        if len(str(tx.get("input", ""))) > 10
        and not (tx.get("functionName") or "").strip()
    )
    if opaque > total_txs * 0.5 and opaque > 3:
        opaque_score = 0.25
        reasons.append(f"Many calls to unverified contracts ({opaque})")
    elif opaque > 2:
        opaque_score = 0.1
    else:
        opaque_score = 0.0
    signals["opaque_calls"] = opaque_score

    # ── Combine: max-anchored weighted aggregation ──
    signal_values = list(signals.values())
    max_signal = max(signal_values) if signal_values else 0.0
    non_max = [v for v in signal_values if v < max_signal]
    if not non_max:
        non_max = [0.0]
    other_avg = sum(non_max) / len(non_max)

    raw_score = 0.6 * max_signal + 0.4 * other_avg

    active_signals = sum(1 for v in signal_values if v > 0)
    if active_signals >= 4:
        raw_score *= 1.5
    elif active_signals >= 3:
        raw_score *= 1.3
    raw_score = max(0.0, min(1.0, raw_score))

    # ── Threshold to risk buckets (user-specified) ──
    if raw_score > 0.6:
        contract_risk = 1.0
        severity = "HIGH"
    elif raw_score > 0.3:
        contract_risk = 0.5
        severity = "MEDIUM"
    else:
        contract_risk = 0.0
        severity = "LOW"

    confidence = min(0.9, 0.3 + 0.04 * min(total_txs, 15))

    result: Dict[str, Any] = {
        "raw_score": round(raw_score, 4),
        "contract_risk": contract_risk,
        "severity": severity,
        "confidence": round(confidence, 4),
        "reasons": reasons[:4] if reasons else ["Normal contract interaction patterns"],
    }

    if debug:
        result["debug"] = {
            "signals": {k: round(v, 4) for k, v in signals.items()},
            "active_signals": active_signals,
            "total_txs": total_txs,
            "contract_calls": contract_calls,
            "failed_txs": failed,
            "n_contracts": n_contracts,
            "fn_sample": list(set(fn_names))[:10],
        }

    return result


def _normalize_severity(value: str) -> str:
    sev = str(value or "LOW").upper()
    if sev not in {"CRITICAL", "HIGH", "MEDIUM", "LOW"}:
        return "LOW"
    return sev


def _severity_weight(severity: str) -> float:
    return {
        "CRITICAL": 1.0,
        "HIGH": 0.9,
        "MEDIUM": 0.6,
        "LOW": 0.2,
    }.get(_normalize_severity(severity), 0.2)


def _reason_from_title(title: str) -> Optional[str]:
    t = (title or "").lower()
    mapping = [
        ("reentrancy", "Reentrancy vulnerability detected"),
        ("delegatecall", "Unsafe delegatecall usage"),
        ("access control", "Missing access control"),
        ("owner-privileged", "Privileged owner functions increase abuse risk"),
        ("tx.origin", "tx.origin-based authorization is unsafe"),
        ("selfdestruct", "Contract can selfdestruct"),
        ("unchecked low-level call", "Unchecked low-level call return values"),
        ("honeypot", "Potential honeypot behavior detected"),
        ("minting", "Minting capability can inflate token supply"),
        ("blacklist", "Blacklist controls can restrict user funds"),
    ]
    for needle, reason in mapping:
        if needle in t:
            return reason
    return None


def _build_contract_profile(
    *,
    findings: List[Dict[str, Any]],
    security_score: float,
    is_verified: bool,
    used_nlp: bool,
    nlp_risk_score: Optional[float] = None,
) -> Dict[str, Any]:
    findings = findings or []
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    reasons: List[str] = []

    for finding in findings:
        sev = _normalize_severity(finding.get("severity", "LOW"))
        severity_counts[sev] += 1
        reason = _reason_from_title(finding.get("title", ""))
        if reason and reason not in reasons:
            reasons.append(reason)

    if not is_verified:
        unverified_risk = 0.5 if findings else 0.0
        return {
            "contract_risk": unverified_risk,
            "severity": "MEDIUM" if findings else "LOW",
            "confidence": 0.30,
            "reasons": (
                ["Unverified contract with detected issues"]
                if findings else
                ["Contract not verified; limited analysis available"]
            ),
            "is_flagged": unverified_risk > 0,
        }

    if not findings:
        return {
            "contract_risk": 0.0,
            "severity": "LOW",
            "confidence": 0.90,
            "reasons": ["No major contract vulnerabilities detected"],
            "is_flagged": False,
        }

    highest = "LOW"
    for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        if severity_counts[sev] > 0:
            highest = sev
            break

    confidence = 0.25
    confidence += min(0.30, 0.08 * len(findings))
    confidence += 0.25 if highest in {"CRITICAL", "HIGH"} else 0.10
    confidence += 0.10 if used_nlp else 0.0
    confidence += 0.10 if security_score <= 40 else 0.0
    confidence -= 0.20 if highest == "LOW" else 0.0
    confidence = max(0.0, min(1.0, confidence))

    severity_score = _severity_weight(highest)
    combined = severity_score * 0.6 + confidence * 0.4

    if nlp_risk_score is not None and nlp_risk_score > 0:
        nlp_norm = nlp_risk_score / 100.0
        combined = max(combined, nlp_norm * 0.8 + confidence * 0.2)

    if combined > 0.6:
        contract_risk = 1.0
    elif combined > 0.3:
        contract_risk = 0.5
    else:
        contract_risk = 0.0

    print(
        f"  [DEBUG] _build_contract_profile: highest={highest}, conf={confidence:.3f}, "
        f"nlp_risk={nlp_risk_score}, combined={combined:.3f} -> risk={contract_risk}"
    )

    if contract_risk == 0.0 and not reasons:
        reasons = ["No major contract vulnerabilities detected"]

    return {
        "contract_risk": float(contract_risk),
        "severity": highest,
        "confidence": float(round(confidence, 4)),
        "reasons": reasons[:4] if reasons else ["No major contract vulnerabilities detected"],
        "is_flagged": contract_risk > 0.0,
    }


def compute_contract_risk_profile(
    contract_address: str,
    chain_id: int = 1,
    cache: Optional[Dict[str, Any]] = None,
    use_nlp: bool = True
) -> Dict[str, Any]:
    contract_address = str(contract_address).lower().strip()

    if cache and contract_address in cache:
        cached = cache[contract_address]
        if isinstance(cached, dict):
            return {
                "contract_risk": float(cached.get("contract_risk", 0.0)),
                "severity": _normalize_severity(cached.get("severity", "LOW")),
                "confidence": float(cached.get("confidence", 0.0)),
                "reasons": list(cached.get("reasons", ["No major contract vulnerabilities detected"])),
                "is_flagged": bool(cached.get("is_flagged", float(cached.get("contract_risk", 0.0)) > 0)),
            }
        # backward compatibility with old float cache
        legacy_risk = float(cached)
        return {
            "contract_risk": legacy_risk,
            "severity": "HIGH" if legacy_risk >= 1.0 else ("MEDIUM" if legacy_risk >= 0.5 else "LOW"),
            "confidence": 0.5 if legacy_risk > 0 else 0.9,
            "reasons": (
                ["Interacts with previously flagged contract"]
                if legacy_risk > 0
                else ["No major contract vulnerabilities detected"]
            ),
            "is_flagged": legacy_risk > 0,
        }

    try:
        try:
            from backend.ml.contract_auditor import audit_contract
        except ImportError:
            from ml.contract_auditor import audit_contract

        nlp_findings: List[Dict[str, Any]] = []
        nlp_risk_score: Optional[float] = None
        used_nlp = False
        audit_result = audit_contract(contract_address, chain_id)
        security = audit_result.get("security_score", {})
        security_score = float(security.get("score", 50))
        findings = audit_result.get("findings", []) or []
        is_verified = bool(audit_result.get("is_verified", False))

        if use_nlp and is_verified:
            try:
                from ml.audit_nlp_analyzer import analyze_audit_report
            except ImportError:
                from backend.ml.audit_nlp_analyzer import analyze_audit_report

            print(f"[NLP] analyze_audit_report starting for {contract_address}")
            audit_text_parts = [
                f"Contract: {audit_result.get('contract_name', 'Unknown')}",
                f"Security Score: {security_score}/100",
            ]
            for finding in findings[:10]:
                title = finding.get("title", "")
                sev = _normalize_severity(finding.get("severity", "LOW"))
                audit_text_parts.append(f"- [{sev}] {title}")
            audit_text = "\n".join(audit_text_parts)

            if len(audit_text) > 50:
                nlp_result = analyze_audit_report(
                    audit_text=audit_text,
                    contract_address=contract_address,
                    model="gpt-4o-mini",
                )
                if nlp_result.get("success"):
                    used_nlp = True
                    nlp_findings = nlp_result.get("vulnerabilities", []) or []
                    nlp_risk_score = float(nlp_result.get("risk_score", 0))
                    print(
                        f"[NLP] success for {contract_address}: "
                        f"vulns={len(nlp_findings)}, risk_score={nlp_risk_score}"
                    )

        merged_findings = nlp_findings if nlp_findings else findings
        profile = _build_contract_profile(
            findings=merged_findings,
            security_score=security_score,
            is_verified=is_verified,
            used_nlp=used_nlp,
            nlp_risk_score=nlp_risk_score,
        )

    except Exception as e:
        print(f"Contract risk computation failed for {contract_address}: {e}")
        profile = {
            "contract_risk": 0.0,
            "severity": "LOW",
            "confidence": 0.10,
            "reasons": ["Contract analysis unavailable; low-confidence signal ignored"],
            "is_flagged": False,
        }

    if cache is not None:
        cache[contract_address] = profile
    return profile


def compute_contract_risk(
    contract_address: str,
    chain_id: int = 1,
    cache: Optional[Dict[str, float]] = None,
    use_nlp: bool = True
) -> float:
    """
    Compute normalized risk score for a single contract.
    
    Args:
        contract_address: Contract address to analyze
        chain_id: Blockchain chain ID
        cache: Optional dict to cache results
        use_nlp: Whether to use NLP analysis (requires OpenAI API)
    
    Returns:
        Normalized risk score (0.0 - 1.0)
    """
    profile = compute_contract_risk_profile(
        contract_address=contract_address,
        chain_id=chain_id,
        cache=cache,
        use_nlp=use_nlp,
    )
    return float(profile.get("contract_risk", 0.0))


def _compute_contract_risk_heuristic(
    contract_address: str,
    chain_id: int
) -> float:
    """
    Heuristic-based contract risk scoring (fallback when NLP unavailable).
    
    Uses static analysis findings and known patterns.
    """
    try:
        from backend.ml.contract_auditor import audit_contract
        
        print(f"Computing risk for contract {contract_address[:10]}... (heuristic)")
        audit_result = audit_contract(contract_address, chain_id)
        security = audit_result.get("security_score", {})
        score = security.get("score", 50)
        
        # Invert security score to risk score
        # High security (90) → low risk (0.1)
        # Low security (20) → high risk (0.8)
        risk_score_norm = (100 - score) / 100.0
        
        print(f"  → Security score: {score}, Risk: {risk_score_norm:.4f}")
        return risk_score_norm
    
    except Exception as e:
        # Default neutral risk
        print(f"  → Heuristic failed: {e}, using default 0.5")
        return 0.5


def aggregate_wallet_contract_risk(
    contract_risk_map: Dict[str, float],
    wallet_contracts: Set[str]
) -> float:
    """
    Aggregate contract risks at wallet level using MAX.
    
    Args:
        contract_risk_map: Dict of {contract_address: risk_score_normalized}
        wallet_contracts: Set of contract addresses interacted by wallet
    
    Returns:
        Maximum contract risk score (0.0 - 1.0), or 0.0 if no contracts
    """
    if not wallet_contracts:
        return 0.0
    
    missing_contracts = [c for c in wallet_contracts if c not in contract_risk_map]
    if missing_contracts:
        print(
            f"  WARNING: {len(missing_contracts)} contracts missing in contract_risk_map "
            f"(sample: {missing_contracts[:3]})"
        )

    risks = [contract_risk_map.get(contract, 0.0) for contract in wallet_contracts if contract in contract_risk_map]
    
    return max(risks) if risks else 0.0


def build_wallet_contract_mapping(
    wallet_transactions: Dict[str, List[Dict]]
) -> Dict[str, Set[str]]:
    """
    Build mapping: wallet_address → set of interacted contracts.
    
    Args:
        wallet_transactions: Dict of {wallet_address: [transactions]}
    
    Returns:
        Dict of {wallet_address: {contract_addresses}}
    """
    wallet_contract_map = {}
    
    total_contracts_found = 0
    for wallet_address, transactions in wallet_transactions.items():
        contracts = extract_contract_addresses(transactions)
        # Normalize address to lowercase
        wallet_address_normalized = str(wallet_address).lower().strip()
        wallet_contract_map[wallet_address_normalized] = contracts
        total_contracts_found += len(contracts)
    
    print(f"  DEBUG: build_wallet_contract_mapping extracted {total_contracts_found} total contract interactions")
    
    return wallet_contract_map


def compute_all_contract_risks(
    unique_contracts: Set[str],
    chain_id: int = 1,
    use_nlp: bool = False,
    cache_file: Optional[str] = None
) -> Dict[str, float]:
    """
    Compute risk scores for all unique contracts.
    
    Args:
        unique_contracts: Set of contract addresses
        chain_id: Blockchain chain ID
        use_nlp: Whether to use NLP (slow but accurate)
        cache_file: Optional JSON file to cache results
    
    Returns:
        Dict of {contract_address: risk_score_normalized}
    """
    profiles = compute_all_contract_risk_profiles(
        unique_contracts=unique_contracts,
        chain_id=chain_id,
        use_nlp=use_nlp,
        cache_file=cache_file,
    )
    return {k: float(v.get("contract_risk", 0.0)) for k, v in profiles.items()}


def compute_all_contract_risk_profiles(
    unique_contracts: Set[str],
    chain_id: int = 1,
    use_nlp: bool = False,
    cache_file: Optional[str] = None
) -> Dict[str, Dict[str, Any]]:
    cache: Dict[str, Any] = {}
    if cache_file and os.path.exists(cache_file):
        with open(cache_file, "r") as f:
            cache = json.load(f)

    profile_map: Dict[str, Dict[str, Any]] = {}
    for i, contract in enumerate(unique_contracts):
        contract_norm = str(contract).lower().strip()
        print(f"Computing risk for contract {i+1}/{len(unique_contracts)}: {contract_norm}")
        profile = compute_contract_risk_profile(
            contract_address=contract_norm,
            chain_id=chain_id,
            cache=cache,
            use_nlp=use_nlp,
        )
        profile_map[contract_norm] = profile
        cache[contract_norm] = profile

    if cache_file:
        os.makedirs(os.path.dirname(cache_file) or ".", exist_ok=True)
        with open(cache_file, "w") as f:
            json.dump(cache, f, indent=2)

    return profile_map


def aggregate_wallet_contract_profile(
    contract_profile_map: Dict[str, Dict[str, Any]],
    wallet_contracts: Set[str],
    interaction_count: int = 0
) -> Dict[str, Any]:
    if not wallet_contracts:
        return {
            "contract_risk": 0.0,
            "severity": "LOW",
            "confidence": 1.0,
            "reasons": ["No major contract vulnerabilities detected"],
        }

    profiles = [contract_profile_map[c] for c in wallet_contracts if c in contract_profile_map]
    if not profiles:
        return {
            "contract_risk": 0.0,
            "severity": "LOW",
            "confidence": 0.2,
            "reasons": ["Contract interaction data uncertain; no major vulnerabilities confirmed"],
        }

    top = sorted(
        profiles,
        key=lambda p: (float(p.get("contract_risk", 0.0)), float(p.get("confidence", 0.0)), _severity_weight(p.get("severity", "LOW"))),
        reverse=True,
    )[0]
    base_conf = float(top.get("confidence", 0.0))

    # Reduce false positives for weak interaction evidence.
    if interaction_count <= 1:
        conf = base_conf * 0.60
    elif interaction_count == 2:
        conf = base_conf * 0.80
    else:
        conf = base_conf
    conf = max(0.0, min(1.0, conf))

    sev = _normalize_severity(top.get("severity", "LOW"))
    top_risk = float(top.get("contract_risk", 0.0))

    wallet_risk = top_risk
    flagged_count = sum(1 for p in profiles if float(p.get("contract_risk", 0.0)) > 0)
    if flagged_count >= 2 and wallet_risk < 1.0 and conf >= 0.4:
        wallet_risk = min(1.0, wallet_risk + 0.5)

    reasons = list(top.get("reasons", []))
    if flagged_count > 0:
        if "Interacts with previously flagged contract" not in reasons:
            reasons.append("Interacts with previously flagged contract")

    if wallet_risk == 0.0:
        reasons = ["No major contract vulnerabilities detected"]

    return {
        "contract_risk": float(wallet_risk),
        "severity": sev if wallet_risk > 0 else "LOW",
        "confidence": float(round(conf, 4)),
        "reasons": reasons[:4],
    }


def generate_risk_reasons(
    rf_score: float,
    gnn_score: float,
    contract_risk_score: float,
    contract_reasons: Optional[List[str]] = None,
    contract_contribution_pct: Optional[float] = None
) -> List[str]:
    """
    Generate explainability reasons based on score components.
    
    Args:
        rf_score: Random Forest score (0-1)
        gnn_score: GNN score (0-1)
        contract_risk_score: Contract risk score (0-1)
    
    Returns:
        List of reason strings
    """
    reasons = []
    
    if contract_risk_score > 0 and contract_reasons:
        for reason in contract_reasons[:2]:
            if reason and reason not in reasons:
                reasons.append(reason)
    
    if gnn_score > 0.7:
        reasons.append("Connected to high-risk wallets")
    
    if rf_score > 0.7:
        reasons.append("Suspicious transaction behavior")
    
    if gnn_score > 0.8 and rf_score > 0.6:
        reasons.append("High-risk network with suspicious patterns")
    
    if all(score > 0.5 for score in [rf_score, gnn_score, contract_risk_score]):
        reasons.append("Multiple risk indicators present")

    if contract_contribution_pct is not None and contract_risk_score > 0:
        reasons.append(f"Contract risk contributed {float(contract_contribution_pct):.1f}% to final score")
    
    return reasons if reasons else ["Normal activity detected"]

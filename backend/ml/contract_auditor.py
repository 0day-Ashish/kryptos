"""
Contract Auditor — Static Security Analysis
Fetches contract source + ABI from Etherscan V2 and performs pattern-based
vulnerability detection across multiple severity categories.
"""
import re
import json
import requests
from typing import Optional, Dict, List, Any

from .fetcher import (
    _rate_limit, _cache_key, _get_cached, _set_cache,
    fetch_transactions, fetch_balance,
    ETHERSCAN_API_KEY, ETHERSCAN_V2_BASE,
)
from .config import get_chain_by_id
from .known_labels import lookup_address


# ── Severity levels ──────────────────────────────────────────────────────────
CRITICAL = "critical"
HIGH = "high"
MEDIUM = "medium"
LOW = "low"
INFO = "info"

# ── Known compiler bugs by version ranges ────────────────────────────────────
COMPILER_BUGS = [
    {
        "max_version": "0.4.25",
        "id": "dirty-high-order-bits",
        "title": "Dirty higher-order bits in arithmetic",
        "severity": HIGH,
    },
    {
        "max_version": "0.5.7",
        "id": "abi-encoding-bug",
        "title": "ABI encoding bug for nested arrays",
        "severity": MEDIUM,
    },
    {
        "max_version": "0.8.14",
        "id": "optimizer-dup-bug",
        "title": "Optimizer keccak caching bug",
        "severity": LOW,
    },
]


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


# ── Fetch Contract Source ────────────────────────────────────────────────────

def fetch_contract_data(contract_address: str, chain_id: int = 1) -> Dict[str, Any]:
    """
    Fetch full contract metadata, source code, and ABI from Etherscan.
    Returns parsed, cleaned data ready for analysis.
    """
    key = _cache_key(contract_address, chain_id, "audit_source")
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

    data = {
        "is_verified": False,
        "contract_name": None,
        "compiler_version": None,
        "compiler_version_clean": None,
        "optimization_used": False,
        "optimization_runs": 0,
        "evm_version": None,
        "license": None,
        "is_proxy": False,
        "implementation": None,
        "source_code": None,
        "source_files": [],
        "abi": None,
        "raw_source": "",
    }

    try:
        resp = requests.get(ETHERSCAN_V2_BASE, params=params, timeout=15)
        result = resp.json()

        if result.get("status") == "1" and result.get("result"):
            contract = result["result"][0]
            source = contract.get("SourceCode", "")
            abi_str = contract.get("ABI", "")

            data["is_verified"] = bool(
                source and source.strip()
                and abi_str != "Contract source code not verified"
            )
            data["contract_name"] = contract.get("ContractName", "") or None
            data["compiler_version"] = contract.get("CompilerVersion", "") or None
            data["optimization_used"] = contract.get("OptimizationUsed", "0") == "1"
            data["optimization_runs"] = int(contract.get("Runs", 0) or 0)
            data["evm_version"] = contract.get("EVMVersion", "default") or "default"
            data["license"] = contract.get("LicenseType", "") or None
            data["is_proxy"] = bool(
                contract.get("Proxy") == "1" or contract.get("Implementation")
            )
            data["implementation"] = contract.get("Implementation") or None
            data["raw_source"] = source

            # Parse compiler version
            if data["compiler_version"]:
                m = re.search(r"v?(\d+\.\d+\.\d+)", data["compiler_version"])
                data["compiler_version_clean"] = m.group(1) if m else None

            # Parse source code — handle multi-file JSON
            if data["is_verified"] and source:
                clean = source
                files = []
                if clean.startswith("{{") or (clean.startswith("{") and '"sources"' in clean[:200]):
                    try:
                        if clean.startswith("{{"):
                            clean = clean[1:-1]
                        parsed = json.loads(clean)
                        if isinstance(parsed, dict) and "sources" in parsed:
                            for fname, fdata in parsed["sources"].items():
                                content = fdata.get("content", "")
                                files.append({"name": fname, "content": content})
                        elif isinstance(parsed, dict):
                            for fname, fdata in parsed.items():
                                content = fdata.get("content", fdata) if isinstance(fdata, dict) else str(fdata)
                                files.append({"name": fname, "content": content})
                    except (json.JSONDecodeError, TypeError):
                        files = [{"name": f"{data['contract_name'] or 'Contract'}.sol", "content": clean}]
                else:
                    files = [{"name": f"{data['contract_name'] or 'Contract'}.sol", "content": clean}]

                data["source_files"] = files
                data["source_code"] = "\n\n".join(
                    f"// ── {f['name']} ──\n{f['content']}" for f in files
                )

            # Parse ABI
            if abi_str and abi_str != "Contract source code not verified":
                try:
                    data["abi"] = json.loads(abi_str)
                except json.JSONDecodeError:
                    data["abi"] = None

    except Exception as e:
        print(f"  [error] fetching contract source: {e}")

    _set_cache(key, [data])
    return data


# ── Creator Analysis ─────────────────────────────────────────────────────────

def fetch_creator_info(contract_address: str, chain_id: int = 1) -> Dict[str, Any]:
    """Find deployer wallet and gather basic info about it."""
    key = _cache_key(contract_address, chain_id, "audit_creator")
    cached = _get_cached(key)
    if cached is not None:
        return cached[0] if cached else {}

    result = _etherscan_get({
        "module": "contract",
        "action": "getcontractcreation",
        "contractaddresses": contract_address,
    }, chain_id)

    info = {
        "deployer": None,
        "creation_tx": None,
        "deployer_balance": None,
        "deployer_tx_count": 0,
        "deployer_contracts": 0,
        "deployer_label": None,
    }

    if result and len(result) > 0:
        info["deployer"] = result[0].get("contractCreator", "").lower()
        info["creation_tx"] = result[0].get("txHash", "")

        if info["deployer"]:
            info["deployer_balance"] = fetch_balance(info["deployer"], chain_id)
            label_info = lookup_address(info["deployer"])
            if label_info:
                info["deployer_label"] = label_info["label"]

            txs = fetch_transactions(info["deployer"], chain_id, max_results=200)
            info["deployer_tx_count"] = len(txs)
            info["deployer_contracts"] = sum(
                1 for tx in txs if not tx.get("to") or tx.get("to") == ""
            )

    _set_cache(key, [info])
    return info


# ── Vulnerability Pattern Detectors ─────────────────────────────────────────

def _detect_reentrancy(source: str) -> List[Dict]:
    """Detect potential reentrancy vulnerabilities."""
    findings = []
    lines = source.split("\n")

    # Pattern: external call followed by state change
    external_call_patterns = [
        r'\.call\{',
        r'\.call\.value\(',
        r'\.send\(',
        r'\.transfer\(',
    ]

    for i, line in enumerate(lines):
        line_lower = line.strip().lower()
        for pattern in external_call_patterns:
            if re.search(pattern, line_lower):
                # Check if there are state changes after this in the same function
                # Simple heuristic: look for assignments in next 10 lines
                context = "\n".join(lines[i+1:i+15])
                if re.search(r'\b\w+\s*=\s*', context) and "require(" not in context[:50]:
                    findings.append({
                        "id": "reentrancy-state-change",
                        "title": "Potential reentrancy — state change after external call",
                        "severity": CRITICAL,
                        "line": i + 1,
                        "description": "An external call is followed by a state variable modification. "
                                       "Consider using the checks-effects-interactions pattern or a reentrancy guard.",
                        "snippet": lines[i].strip(),
                    })
                    break

    # Check for ReentrancyGuard usage (mitigates findings)
    has_guard = "reentrancyguard" in source.lower() or "nonreentrant" in source.lower()
    if has_guard and findings:
        for f in findings:
            f["severity"] = LOW
            f["description"] += " (ReentrancyGuard detected — risk mitigated)"

    return findings


def _detect_unsafe_calls(source: str) -> List[Dict]:
    """Detect unsafe low-level calls and delegatecall usage."""
    findings = []
    lines = source.split("\n")

    for i, line in enumerate(lines):
        stripped = line.strip().lower()

        # delegatecall
        if "delegatecall(" in stripped and "library" not in stripped:
            findings.append({
                "id": "unsafe-delegatecall",
                "title": "Unsafe delegatecall usage",
                "severity": HIGH,
                "line": i + 1,
                "description": "delegatecall allows external code to execute in the caller's "
                               "storage context. Ensure the target is trusted and immutable.",
                "snippet": lines[i].strip(),
            })

        # selfdestruct
        if "selfdestruct(" in stripped or "suicide(" in stripped:
            findings.append({
                "id": "selfdestruct-present",
                "title": "Contract contains selfdestruct",
                "severity": CRITICAL,
                "line": i + 1,
                "description": "The selfdestruct opcode permanently destroys the contract "
                               "and sends remaining ETH to a designated address. "
                               "This can be exploited if access control is weak.",
                "snippet": lines[i].strip(),
            })

        # tx.origin for auth
        if "tx.origin" in stripped and ("require" in stripped or "if" in stripped):
            findings.append({
                "id": "tx-origin-auth",
                "title": "tx.origin used for authorization",
                "severity": HIGH,
                "line": i + 1,
                "description": "Using tx.origin for authorization is vulnerable to phishing attacks. "
                               "Use msg.sender instead.",
                "snippet": lines[i].strip(),
            })

        # Unchecked low-level call return value
        if re.search(r'\.call\{', stripped) or re.search(r'\.call\(', stripped):
            # Check if return value is handled
            full_line = line.strip()
            if not re.search(r'\(bool\s+\w+', full_line) and "require(" not in full_line:
                findings.append({
                    "id": "unchecked-call",
                    "title": "Unchecked low-level call return value",
                    "severity": MEDIUM,
                    "line": i + 1,
                    "description": "The return value of a low-level call is not checked. "
                                   "Failed calls will not revert the transaction.",
                    "snippet": full_line,
                })

    return findings


def _detect_access_control_issues(source: str, abi: Optional[List]) -> List[Dict]:
    """Detect access control issues and centralization risks."""
    findings = []
    source_lower = source.lower()
    lines = source.split("\n")

    # Check for ownable / access control
    has_ownable = "ownable" in source_lower
    has_access_control = "accesscontrol" in source_lower
    has_multisig = any(kw in source_lower for kw in ["multisig", "gnosis", "timelock", "timelockcontroller"])

    if has_ownable and not has_multisig:
        findings.append({
            "id": "single-owner",
            "title": "Single-owner access control (no multisig/timelock)",
            "severity": MEDIUM,
            "line": None,
            "description": "Contract uses Ownable pattern without a multisig or timelock. "
                           "A compromised owner key can control all privileged functions.",
            "snippet": None,
        })

    # Detect onlyOwner functions that affect funds
    dangerous_owner_fns = []
    for i, line in enumerate(lines):
        if "onlyowner" in line.lower():
            fn_match = re.search(r'function\s+(\w+)', line)
            if not fn_match:
                # Look at previous lines for function name
                for j in range(max(0, i - 3), i):
                    fn_match = re.search(r'function\s+(\w+)', lines[j])
                    if fn_match:
                        break
            if fn_match:
                fn_name = fn_match.group(1)
                dangerous_owner_fns.append(fn_name)

    if dangerous_owner_fns:
        findings.append({
            "id": "privileged-functions",
            "title": f"Owner-privileged functions detected ({len(dangerous_owner_fns)})",
            "severity": MEDIUM,
            "line": None,
            "description": f"These functions are restricted to the owner: "
                           f"{', '.join(dangerous_owner_fns[:8])}. "
                           f"Verify the owner is a multisig or DAO.",
            "snippet": None,
        })

    # Check for renounceOwnership
    if has_ownable:
        if "renounceownership" not in source_lower:
            findings.append({
                "id": "no-renounce-ownership",
                "title": "Owner cannot renounce ownership",
                "severity": LOW,
                "line": None,
                "description": "The contract does not include renounceOwnership. "
                               "Ownership transfer is possible but not revocation.",
                "snippet": None,
            })

    # Minting capability
    for i, line in enumerate(lines):
        if re.search(r'function\s+mint\s*\(', line.lower()):
            findings.append({
                "id": "mint-function",
                "title": "Minting function present — supply can be inflated",
                "severity": MEDIUM,
                "line": i + 1,
                "description": "The contract has a public or restricted mint function that can "
                               "create new tokens. Verify minting limits and access controls.",
                "snippet": lines[i].strip(),
            })
            break

    # Pausing
    if any(kw in source_lower for kw in ["whennotpaused", "function pause(", "pausable"]):
        findings.append({
            "id": "pausable-contract",
            "title": "Contract is pausable — admin can halt operations",
            "severity": LOW,
            "line": None,
            "description": "The contract implements a pause mechanism. While useful for "
                           "emergency stops, it gives centralized control over contract operations.",
            "snippet": None,
        })

    # Blacklisting
    if any(kw in source_lower for kw in ["blacklist", "blocklist", "function deny(", "function ban("]):
        findings.append({
            "id": "blacklist-mechanism",
            "title": "Blacklist/blocklist mechanism detected",
            "severity": MEDIUM,
            "line": None,
            "description": "The contract can block specific addresses from interacting. "
                           "This gives the admin power to freeze individual users.",
            "snippet": None,
        })

    return findings


def _detect_token_issues(source: str) -> List[Dict]:
    """Detect ERC-20 / ERC-721 token-specific issues."""
    findings = []
    source_lower = source.lower()
    lines = source.split("\n")

    # Unlimited approval / allowance risk
    if "approve(" in source_lower:
        # Check for max uint approval handling
        max_patterns = ["type(uint256).max", "uint256(-1)", "0xffffffff"]
        has_max_check = any(p in source_lower for p in max_patterns)
        if not has_max_check:
            findings.append({
                "id": "unlimited-approval",
                "title": "No max approval handling",
                "severity": LOW,
                "line": None,
                "description": "The approve function does not special-case unlimited approvals. "
                               "This is standard but worth noting for user awareness.",
                "snippet": None,
            })

    # Fee-on-transfer / tax mechanism
    fee_patterns = [
        r'_?tax\w*',
        r'_?fee\w*\s*=',
        r'totaltax|totalfee',
        r'buytax|selltax|buyfee|sellfee',
    ]
    for pattern in fee_patterns:
        if re.search(pattern, source_lower):
            findings.append({
                "id": "transfer-fee",
                "title": "Fee/tax mechanism detected in transfers",
                "severity": MEDIUM,
                "line": None,
                "description": "The contract implements a fee or tax on transfers. "
                               "This can reduce amounts received and may indicate a honeypot pattern.",
                "snippet": None,
            })
            break

    # Max transaction / max wallet limits
    if any(kw in source_lower for kw in ["maxtx", "maxwallet", "max_tx", "max_wallet", "_maxtxamount"]):
        findings.append({
            "id": "transfer-limits",
            "title": "Transfer/wallet size limits detected",
            "severity": LOW,
            "line": None,
            "description": "The contract enforces maximum transaction or wallet size limits. "
                           "These can prevent selling if set maliciously.",
            "snippet": None,
        })

    # Honeypot pattern: different buy/sell conditions
    if ("buy" in source_lower and "sell" in source_lower and
            ("swapandliquify" in source_lower or "uniswap" in source_lower or "pancake" in source_lower)):
        if re.search(r'sell.*fee|sell.*tax|sell.*rate', source_lower):
            findings.append({
                "id": "asymmetric-fees",
                "title": "Asymmetric buy/sell fees — potential honeypot indicator",
                "severity": HIGH,
                "line": None,
                "description": "The contract has different conditions for buys and sells on a DEX. "
                               "Extremely high sell fees can make a token impossible to sell.",
                "snippet": None,
            })

    return findings


def _detect_compiler_issues(compiler_version: Optional[str]) -> List[Dict]:
    """Check compiler version for known issues."""
    findings = []

    if not compiler_version:
        findings.append({
            "id": "unknown-compiler",
            "title": "Compiler version unknown",
            "severity": INFO,
            "line": None,
            "description": "Could not determine the Solidity compiler version.",
            "snippet": None,
        })
        return findings

    # Parse version
    m = re.search(r'(\d+)\.(\d+)\.(\d+)', compiler_version)
    if not m:
        return findings

    major, minor, patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
    version_tuple = (major, minor, patch)

    # Very old compiler
    if major == 0 and minor < 6:
        findings.append({
            "id": "old-compiler",
            "title": f"Outdated compiler v{major}.{minor}.{patch}",
            "severity": HIGH,
            "line": None,
            "description": "The contract was compiled with a very old Solidity version. "
                           "Multiple known bugs and missing safety features exist in this version.",
            "snippet": None,
        })
    elif major == 0 and minor < 8:
        findings.append({
            "id": "legacy-compiler",
            "title": f"Legacy compiler v{major}.{minor}.{patch}",
            "severity": LOW,
            "line": None,
            "description": "Consider using Solidity 0.8.x+ for built-in overflow checks.",
            "snippet": None,
        })

    # Pre-0.8.0 = no built-in overflow protection
    if major == 0 and minor < 8:
        findings.append({
            "id": "no-overflow-protection",
            "title": "No built-in overflow/underflow protection",
            "severity": MEDIUM,
            "line": None,
            "description": "Solidity <0.8.0 does not have built-in overflow protection. "
                           "Ensure SafeMath is used for all arithmetic operations.",
            "snippet": None,
        })

    # Floating pragma
    # This is checked in source code
    return findings


def _detect_code_quality(source: str) -> List[Dict]:
    """Detect code quality and best practice issues."""
    findings = []
    source_lower = source.lower()
    lines = source.split("\n")

    # Floating pragma
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("pragma solidity") and "^" in stripped:
            findings.append({
                "id": "floating-pragma",
                "title": "Floating pragma version",
                "severity": LOW,
                "line": i + 1,
                "description": "The contract uses a floating pragma (^). Lock the compiler "
                               "version for deterministic builds.",
                "snippet": stripped,
            })
            break

    # Missing events for state changes
    state_change_fns = re.findall(r'function\s+(\w+)[^}]*\{([^}]{0,500})\}', source, re.DOTALL)
    fns_without_events = 0
    for fn_name, fn_body in state_change_fns:
        if ("=" in fn_body and "emit " not in fn_body and
                fn_name not in ["constructor", "_transfer", "_approve", "_mint", "_burn"]):
            # Has state changes but no events
            fns_without_events += 1

    if fns_without_events > 3:
        findings.append({
            "id": "missing-events",
            "title": f"State changes without events ({fns_without_events} functions)",
            "severity": LOW,
            "line": None,
            "description": "Several functions modify state without emitting events. "
                           "Events help off-chain monitoring and transparency.",
            "snippet": None,
        })

    # Use of assembly
    if "assembly" in source_lower and "assembly {" in source_lower:
        assembly_count = source_lower.count("assembly {") + source_lower.count("assembly{")
        findings.append({
            "id": "inline-assembly",
            "title": f"Inline assembly used ({assembly_count} blocks)",
            "severity": INFO,
            "line": None,
            "description": "The contract uses inline assembly. This bypasses Solidity's safety "
                           "checks and requires careful auditing.",
            "snippet": None,
        })

    # Contract size (approximate by source length)
    lines_count = len([l for l in lines if l.strip() and not l.strip().startswith("//")])
    if lines_count > 1500:
        findings.append({
            "id": "large-contract",
            "title": f"Large codebase ({lines_count} non-empty lines)",
            "severity": INFO,
            "line": None,
            "description": "The contract has a large codebase. Larger contracts have "
                           "higher attack surface and are harder to audit.",
            "snippet": None,
        })

    return findings


def _analyze_functions(abi: Optional[List]) -> List[Dict]:
    """Analyze ABI functions for risk indicators."""
    if not abi:
        return []

    functions = []
    for item in abi:
        if item.get("type") != "function":
            continue

        fn = {
            "name": item.get("name", ""),
            "inputs": len(item.get("inputs", [])),
            "outputs": len(item.get("outputs", [])),
            "mutability": item.get("stateMutability", "nonpayable"),
            "risk_tags": [],
        }

        name_lower = fn["name"].lower()

        # Tag dangerous functions
        if name_lower in ["mint", "_mint", "mintto"]:
            fn["risk_tags"].append("mint")
        if name_lower in ["burn", "_burn", "burnfrom"]:
            fn["risk_tags"].append("burn")
        if name_lower in ["pause", "unpause"]:
            fn["risk_tags"].append("pause")
        if any(kw in name_lower for kw in ["blacklist", "blocklist", "deny", "ban"]):
            fn["risk_tags"].append("blacklist")
        if any(kw in name_lower for kw in ["owner", "admin", "setfee", "settax", "setmax"]):
            fn["risk_tags"].append("admin")
        if name_lower in ["selfdestruct", "destroy", "kill"]:
            fn["risk_tags"].append("destructive")
        if name_lower in ["upgradeto", "upgradetoandcall"]:
            fn["risk_tags"].append("upgradeable")
        if fn["mutability"] == "payable":
            fn["risk_tags"].append("payable")
        if fn["mutability"] in ("view", "pure"):
            fn["risk_tags"].append("read-only")

        functions.append(fn)

    return functions


# ── Security Score ───────────────────────────────────────────────────────────

def compute_security_score(findings: List[Dict], contract_data: Dict) -> Dict[str, Any]:
    """
    Compute a 0-100 security score from findings.
    100 = perfectly safe (no findings), 0 = extremely risky.
    """
    # Start at 100, deduct for findings
    deductions = {
        CRITICAL: 25,
        HIGH: 15,
        MEDIUM: 8,
        LOW: 3,
        INFO: 0,
    }

    total_deduction = 0
    severity_counts = {CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0}

    for f in findings:
        sev = f["severity"]
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
        total_deduction += deductions.get(sev, 0)

    # Bonus for good practices
    bonus = 0
    source_lower = (contract_data.get("source_code") or "").lower()

    if "reentrancyguard" in source_lower or "nonreentrant" in source_lower:
        bonus += 5
    if contract_data.get("is_verified"):
        bonus += 5
    if "openzeppelin" in source_lower or "@openzeppelin" in source_lower:
        bonus += 5
    if "timelockcontroller" in source_lower or "timelock" in source_lower:
        bonus += 5

    score = max(0, min(100, 100 - total_deduction + bonus))

    # Label
    if score >= 85:
        label = "Secure"
        grade = "A"
    elif score >= 70:
        label = "Mostly Secure"
        grade = "B"
    elif score >= 50:
        label = "Moderate Risk"
        grade = "C"
    elif score >= 30:
        label = "High Risk"
        grade = "D"
    else:
        label = "Critical Risk"
        grade = "F"

    return {
        "score": score,
        "label": label,
        "grade": grade,
        "total_deduction": total_deduction,
        "bonus": bonus,
        "severity_counts": severity_counts,
    }


# ── Main Audit Entry Point ──────────────────────────────────────────────────

def audit_contract(contract_address: str, chain_id: int = 1) -> Dict[str, Any]:
    """
    Full contract security audit.
    1. Fetch contract source + ABI from Etherscan
    2. Run all vulnerability detectors
    3. Analyze ABI functions
    4. Compute security score
    """
    contract_address = contract_address.lower()
    chain = get_chain_by_id(chain_id)

    print(f"\n{'='*60}")
    print(f"🔍 Contract Audit: {contract_address} on {chain['name']}")
    print(f"{'='*60}")

    # Step 1: Fetch contract data
    print("📡 Step 1: Fetching contract source & metadata...")
    contract_data = fetch_contract_data(contract_address, chain_id)

    if not contract_data.get("is_verified"):
        # Unverified contract — limited analysis
        print("⚠️  Contract is NOT verified — limited analysis possible")
        creator = fetch_creator_info(contract_address, chain_id)
        return {
            "contract_address": contract_address,
            "chain": {
                "id": chain["id"],
                "name": chain["name"],
                "short": chain["short"],
                "explorer": chain["explorer"],
            },
            "is_verified": False,
            "contract_name": None,
            "compiler_version": None,
            "security_score": {
                "score": 0,
                "label": "Unverified",
                "grade": "F",
                "total_deduction": 100,
                "bonus": 0,
                "severity_counts": {CRITICAL: 1, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0},
            },
            "findings": [{
                "id": "unverified-contract",
                "title": "Contract source code is NOT verified",
                "severity": CRITICAL,
                "line": None,
                "description": "The contract source code is not verified on Etherscan. "
                               "This means the code cannot be inspected or audited. "
                               "Unverified contracts are significantly riskier.",
                "snippet": None,
            }],
            "functions": [],
            "metadata": {
                "optimization_used": False,
                "optimization_runs": 0,
                "evm_version": None,
                "license": None,
                "is_proxy": False,
                "implementation": None,
                "source_lines": 0,
                "source_files_count": 0,
            },
            "creator": {
                "address": creator.get("deployer"),
                "creation_tx": creator.get("creation_tx"),
                "balance": creator.get("deployer_balance"),
                "tx_count": creator.get("deployer_tx_count", 0),
                "contracts_deployed": creator.get("deployer_contracts", 0),
                "label": creator.get("deployer_label"),
            },
            "source_code": None,
            "abi": None,
        }

    # Step 2: Run vulnerability detectors
    print("🔬 Step 2: Running security analysis...")
    source = contract_data.get("source_code", "") or ""
    abi = contract_data.get("abi")

    findings = []
    findings.extend(_detect_reentrancy(source))
    findings.extend(_detect_unsafe_calls(source))
    findings.extend(_detect_access_control_issues(source, abi))
    findings.extend(_detect_token_issues(source))
    findings.extend(_detect_compiler_issues(contract_data.get("compiler_version")))
    findings.extend(_detect_code_quality(source))

    # Deduplicate by id
    seen_ids = set()
    unique_findings = []
    for f in findings:
        if f["id"] not in seen_ids:
            seen_ids.add(f["id"])
            unique_findings.append(f)
    findings = unique_findings

    # Sort by severity (critical first)
    severity_order = {CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4}
    findings.sort(key=lambda x: severity_order.get(x["severity"], 5))

    print(f"   Found {len(findings)} issues")

    # Step 3: Function analysis
    print("📋 Step 3: Analyzing contract functions...")
    functions = _analyze_functions(abi)

    # Step 4: Creator info
    print("👤 Step 4: Fetching deployer info...")
    creator = fetch_creator_info(contract_address, chain_id)

    # Step 5: Compute score
    print("🧠 Step 5: Computing security score...")
    security_score = compute_security_score(findings, contract_data)

    # Count source lines
    source_lines = len([l for l in source.split("\n") if l.strip()]) if source else 0

    result = {
        "contract_address": contract_address,
        "chain": {
            "id": chain["id"],
            "name": chain["name"],
            "short": chain["short"],
            "explorer": chain["explorer"],
        },
        "is_verified": True,
        "contract_name": contract_data.get("contract_name"),
        "compiler_version": contract_data.get("compiler_version_clean") or contract_data.get("compiler_version"),
        "security_score": security_score,
        "findings": findings,
        "functions": functions,
        "metadata": {
            "optimization_used": contract_data.get("optimization_used", False),
            "optimization_runs": contract_data.get("optimization_runs", 0),
            "evm_version": contract_data.get("evm_version"),
            "license": contract_data.get("license"),
            "is_proxy": contract_data.get("is_proxy", False),
            "implementation": contract_data.get("implementation"),
            "source_lines": source_lines,
            "source_files_count": len(contract_data.get("source_files", [])),
        },
        "creator": {
            "address": creator.get("deployer"),
            "creation_tx": creator.get("creation_tx"),
            "balance": creator.get("deployer_balance"),
            "tx_count": creator.get("deployer_tx_count", 0),
            "contracts_deployed": creator.get("deployer_contracts", 0),
            "label": creator.get("deployer_label"),
        },
        "source_code": contract_data.get("source_code"),
        "abi": abi,
    }

    print(f"✅ Security Score: {security_score['score']}/100 ({security_score['label']}) — Grade {security_score['grade']}")
    print(f"   Findings: {security_score['severity_counts']}")
    print(f"{'='*60}\n")

    return result

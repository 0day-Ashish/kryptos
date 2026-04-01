"""
Contract Risk Computation Module

Extracts contract addresses from wallet transactions,
computes risk scores using NLP analysis, and provides
wallet-level contract risk aggregation.
"""

import os
import json
from typing import Dict, List, Set, Optional
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
    # Check cache first
    if cache and contract_address in cache:
        return cache[contract_address]
    
    risk_score_norm = 0.0
    
    try:
        if use_nlp:
            # Import here to avoid circular dependencies
            from ml.audit_nlp_analyzer import analyze_audit_report
            from backend.ml.contract_auditor import audit_contract
            
            # Get contract audit findings
            audit_result = audit_contract(contract_address, chain_id)
            
            # Build audit text from findings
            audit_text_parts = []
            
            # Add contract metadata
            contract_name = audit_result.get("contract_name", "Unknown")
            audit_text_parts.append(f"Contract: {contract_name}")
            
            # Add security score
            security = audit_result.get("security_score", {})
            score = security.get("score", 0)
            audit_text_parts.append(f"Security Score: {score}/100")
            
            # Add findings
            findings = audit_result.get("findings", [])
            if findings:
                audit_text_parts.append(f"\nFindings ({len(findings)}):")
                for finding in findings[:10]:  # Limit to top 10
                    title = finding.get("title", "")
                    severity = finding.get("severity", "low")
                    audit_text_parts.append(f"- [{severity.upper()}] {title}")
            
            # Only run NLP if we have meaningful content
            audit_text = "\n".join(audit_text_parts)
            if len(audit_text) > 50:
                nlp_result = analyze_audit_report(
                    audit_text=audit_text,
                    contract_address=contract_address,
                    model="gpt-4o-mini"
                )
                
                if nlp_result.get("success"):
                    risk_score = nlp_result.get("risk_score", 0)
                    risk_score_norm = risk_score / 100.0
            else:
                # Fallback to security score
                risk_score_norm = (100 - score) / 100.0  # Invert (low security = high risk)
        
        else:
            # Fallback: Use heuristic scoring without NLP
            risk_score_norm = _compute_contract_risk_heuristic(
                contract_address, chain_id
            )
    
    except Exception as e:
        # Graceful fallback: assign neutral risk
        print(f"Contract risk computation failed for {contract_address}: {e}")
        risk_score_norm = 0.5  # Neutral risk
    
    # Cache result
    if cache is not None:
        cache[contract_address] = risk_score_norm
    
    return risk_score_norm


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
    
    risks = [
        contract_risk_map.get(contract, 0.0)
        for contract in wallet_contracts
        if contract in contract_risk_map
    ]
    
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
    cache = {}
    
    # Load cache if exists
    if cache_file and os.path.exists(cache_file):
        with open(cache_file, 'r') as f:
            cache = json.load(f)
    
    contract_risk_map = {}
    
    for i, contract in enumerate(unique_contracts):
        if contract in cache:
            contract_risk_map[contract] = cache[contract]
        else:
            print(f"Computing risk for contract {i+1}/{len(unique_contracts)}: {contract}")
            risk = compute_contract_risk(contract, chain_id, cache, use_nlp)
            contract_risk_map[contract] = risk
            cache[contract] = risk
    
    # Save cache
    if cache_file:
        os.makedirs(os.path.dirname(cache_file) or ".", exist_ok=True)
        with open(cache_file, 'w') as f:
            json.dump(cache, f, indent=2)
    
    return contract_risk_map


def generate_risk_reasons(
    rf_score: float,
    gnn_score: float,
    contract_risk_score: float
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
    
    if contract_risk_score > 0.6:
        reasons.append("Interacts with vulnerable smart contracts")
    
    if gnn_score > 0.7:
        reasons.append("Connected to high-risk wallets")
    
    if rf_score > 0.7:
        reasons.append("Suspicious transaction behavior")
    
    # Additional nuanced reasons
    if contract_risk_score > 0.8:
        reasons.append("Critical smart contract vulnerabilities detected")
    
    if gnn_score > 0.8 and rf_score > 0.6:
        reasons.append("High-risk network with suspicious patterns")
    
    if all(score > 0.5 for score in [rf_score, gnn_score, contract_risk_score]):
        reasons.append("Multiple risk indicators present")
    
    return reasons if reasons else ["Normal activity detected"]

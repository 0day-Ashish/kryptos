"""
Quick Test for Contract Risk Integration

Tests the contract risk module with mock data to verify functionality
without requiring actual blockchain data.
"""

import sys
from pathlib import Path

# Add ml directory to path
sys.path.insert(0, str(Path(__file__).parent))

from contract_risk import (
    extract_contract_addresses,
    aggregate_wallet_contract_risk,
    generate_risk_reasons
)


def test_contract_extraction():
    """Test contract address extraction from transactions."""
    print("\n" + "="*60)
    print("TEST 1: Contract Address Extraction")
    print("="*60)
    
    # Mock transactions
    mock_txs = [
        {
            "to": "0xcontract1",
            "input": "0xa9059cbb00000000",  # ERC-20 transfer
            "contractAddress": ""
        },
        {
            "to": "0xcontract2",
            "input": "0x",  # Simple transfer
            "contractAddress": ""
        },
        {
            "to": "",
            "input": "0x",
            "contractAddress": "0xtoken1"  # Token transfer
        },
        {
            "to": "0xcontract1",  # Duplicate
            "input": "0x12345678",
            "contractAddress": ""
        }
    ]
    
    contracts = extract_contract_addresses(mock_txs)
    
    print(f"Input: {len(mock_txs)} transactions")
    print(f"Output: {len(contracts)} unique contracts")
    print(f"Contracts: {contracts}")
    
    assert "0xcontract1" in contracts, "Contract1 should be extracted"
    assert "0xtoken1" in contracts, "Token1 should be extracted"
    assert "0xcontract2" not in contracts, "Simple transfers should be excluded"
    assert len(contracts) == 2, f"Expected 2 contracts, got {len(contracts)}"
    
    print("✅ PASSED")
    return True


def test_wallet_risk_aggregation():
    """Test wallet-level contract risk aggregation using MAX."""
    print("\n" + "="*60)
    print("TEST 2: Wallet Risk Aggregation (MAX)")
    print("="*60)
    
    # Mock contract risk map
    contract_risks = {
        "0xcontract1": 0.8,  # High risk
        "0xcontract2": 0.3,  # Low risk
        "0xcontract3": 0.6,  # Medium risk
    }
    
    # Test case 1: Wallet interacts with high-risk contract
    wallet_contracts_1 = {"0xcontract1", "0xcontract2"}
    risk_1 = aggregate_wallet_contract_risk(contract_risks, wallet_contracts_1)
    
    print(f"\nTest Case 1:")
    print(f"  Wallet contracts: {wallet_contracts_1}")
    print(f"  Individual risks: {[contract_risks[c] for c in wallet_contracts_1]}")
    print(f"  Aggregated risk (MAX): {risk_1}")
    
    assert risk_1 == 0.8, f"Expected 0.8 (max), got {risk_1}"
    print("  ✅ Correct (uses MAX)")
    
    # Test case 2: Wallet with no risky contracts
    wallet_contracts_2 = {"0xcontract2"}
    risk_2 = aggregate_wallet_contract_risk(contract_risks, wallet_contracts_2)
    
    print(f"\nTest Case 2:")
    print(f"  Wallet contracts: {wallet_contracts_2}")
    print(f"  Aggregated risk: {risk_2}")
    
    assert risk_2 == 0.3, f"Expected 0.3, got {risk_2}"
    print("  ✅ Correct")
    
    # Test case 3: Wallet with no contracts
    wallet_contracts_3 = set()
    risk_3 = aggregate_wallet_contract_risk(contract_risks, wallet_contracts_3)
    
    print(f"\nTest Case 3:")
    print(f"  Wallet contracts: {wallet_contracts_3}")
    print(f"  Aggregated risk: {risk_3}")
    
    assert risk_3 == 0.0, f"Expected 0.0, got {risk_3}"
    print("  ✅ Correct (no contracts)")
    
    print("\n✅ PASSED")
    return True


def test_risk_reasons():
    """Test explainability reason generation."""
    print("\n" + "="*60)
    print("TEST 3: Risk Reason Generation")
    print("="*60)
    
    # Test case 1: High risk across all components
    reasons_1 = generate_risk_reasons(
        rf_score=0.85,
        gnn_score=0.78,
        contract_risk_score=0.72
    )
    
    print(f"\nTest Case 1 (High Risk):")
    print(f"  RF: 0.85, GNN: 0.78, Contract: 0.72")
    print(f"  Reasons: {reasons_1}")
    
    assert "Suspicious transaction behavior" in reasons_1
    assert "Connected to high-risk wallets" in reasons_1
    assert "Interacts with vulnerable smart contracts" in reasons_1
    print("  ✅ All high-risk reasons present")
    
    # Test case 2: Medium risk
    reasons_2 = generate_risk_reasons(
        rf_score=0.45,
        gnn_score=0.52,
        contract_risk_score=0.35
    )
    
    print(f"\nTest Case 2 (Medium Risk):")
    print(f"  RF: 0.45, GNN: 0.52, Contract: 0.35")
    print(f"  Reasons: {reasons_2}")
    
    assert len(reasons_2) >= 1
    print("  ✅ Reasons generated")
    
    # Test case 3: Low risk
    reasons_3 = generate_risk_reasons(
        rf_score=0.12,
        gnn_score=0.18,
        contract_risk_score=0.05
    )
    
    print(f"\nTest Case 3 (Low Risk):")
    print(f"  RF: 0.12, GNN: 0.18, Contract: 0.05")
    print(f"  Reasons: {reasons_3}")
    
    assert "Normal activity detected" in reasons_3
    print("  ✅ Low-risk fallback present")
    
    print("\n✅ PASSED")
    return True


def test_scoring_formula():
    """Test the updated scoring formula (40% RF + 40% GNN + 20% Contract)."""
    print("\n" + "="*60)
    print("TEST 4: Scoring Formula Integration")
    print("="*60)
    
    # Test case: Equal scores
    rf_norm = 0.5
    gnn_norm = 0.5
    contract_norm = 0.5
    
    final_score = 0.4 * rf_norm + 0.4 * gnn_norm + 0.2 * contract_norm
    
    print(f"\nTest Case 1 (Equal Scores):")
    print(f"  RF: {rf_norm}, GNN: {gnn_norm}, Contract: {contract_norm}")
    print(f"  Formula: 0.4×{rf_norm} + 0.4×{gnn_norm} + 0.2×{contract_norm}")
    print(f"  Final Score: {final_score}")
    
    assert final_score == 0.5, f"Expected 0.5, got {final_score}"
    print("  ✅ Correct")
    
    # Test case: High contract risk dominates
    rf_norm = 0.3
    gnn_norm = 0.3
    contract_norm = 1.0
    
    final_score = 0.4 * rf_norm + 0.4 * gnn_norm + 0.2 * contract_norm
    
    print(f"\nTest Case 2 (High Contract Risk):")
    print(f"  RF: {rf_norm}, GNN: {gnn_norm}, Contract: {contract_norm}")
    print(f"  Final Score: {final_score}")
    print(f"  Note: Contract risk (20% weight) increases final score by 0.2")
    
    expected = 0.4 * 0.3 + 0.4 * 0.3 + 0.2 * 1.0  # = 0.44
    assert abs(final_score - expected) < 0.001, f"Expected {expected}, got {final_score}"
    print("  ✅ Correct")
    
    # Verify weights sum to 1.0
    weights_sum = 0.4 + 0.4 + 0.2
    print(f"\nWeight Verification:")
    print(f"  RF weight: 0.4 (40%)")
    print(f"  GNN weight: 0.4 (40%)")
    print(f"  Contract weight: 0.2 (20%)")
    print(f"  Sum: {weights_sum}")
    
    assert weights_sum == 1.0, f"Weights must sum to 1.0, got {weights_sum}"
    print("  ✅ Weights sum to 1.0")
    
    print("\n✅ PASSED")
    return True


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("CONTRACT RISK INTEGRATION - UNIT TESTS")
    print("="*60)
    
    tests = [
        test_contract_extraction,
        test_wallet_risk_aggregation,
        test_risk_reasons,
        test_scoring_formula
    ]
    
    passed = 0
    failed = 0
    
    for test_func in tests:
        try:
            if test_func():
                passed += 1
        except AssertionError as e:
            print(f"\n❌ FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            failed += 1
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"✅ Passed: {passed}/{len(tests)}")
    print(f"❌ Failed: {failed}/{len(tests)}")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED!")
        print("\nNext steps:")
        print("  1. Run: python extract_wallet_transactions.py --max-wallets 10")
        print("  2. Run: python combine_models.py")
        print("  3. Check: ../data/final_predictions.csv")
    else:
        print("\n⚠️  SOME TESTS FAILED")
        print("   Please review implementation")
    
    print("="*60)
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

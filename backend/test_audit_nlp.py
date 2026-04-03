#!/usr/bin/env python3
"""
Test script for NLP-based audit analysis.
Demonstrates the analyze_audit_report functionality.
"""

import os
import sys
import json
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Test audit report samples
SAMPLE_AUDIT_REPORTS = {
    "high_risk": """
    SECURITY AUDIT REPORT - Critical Findings
    
    Contract: TokenSwap.sol
    Date: 2024-01-15
    
    CRITICAL VULNERABILITIES:
    1. Reentrancy Attack Vector: The transfer() function calls an external contract 
       before updating the balance state. This allows an attacker to recursively call 
       the function and drain all funds.
       Location: Line 156 - addr.call{value: amount}("")
       
    2. Delegatecall to Untrusted Contract: Function allows arbitrary delegatecall 
       to user-supplied addresses, enabling complete contract takeover.
       Location: Line 234
    
    HIGH SEVERITY:
    - Access Control: Only single owner, no multisig protection for admin functions
    - Compiler: Using Solidity 0.6.0 (vulnerable to known exploits)
    - Integer Overflow: SafeMath not used in token transfer calculations
    
    MEDIUM SEVERITY:
    - Missing event logging for critical state changes
    - Floating pragma in contract definition
    - No emergency pause mechanism
    
    RECOMMENDATIONS:
    - DO NOT DEPLOY until reentrancy and delegatecall issues are fixed
    - Implement emergency pause circuit breaker
    - Use multisig for admin functions
    - Upgrade to Solidity 0.8.24+
    """,
    
    "medium_risk": """
    Smart Contract Security Audit
    Contract: StakingPool.sol
    
    FINDINGS:
    
    HIGH - Potential Token Burn:
    The withdraw() function uses a dangerous fee calculation that could exceed 100%
    under certain conditions, burning user tokens instead of returning them.
    
    MEDIUM - Missing Validation:
    - Staking amount not validated against minimum threshold
    - No checks for paused state before transfers
    - Event not emitted on stake() function
    
    LOW - Code Quality:
    - Variable naming could be more descriptive
    - Some functions lack natspec documentation
    
    Overall Assessment: Safe to deploy with recommended fixes applied.
    """,
    
    "low_risk": """
    Audit Summary: SimpleToken.sol
    
    The contract implements a standard ERC-20 token with no critical issues detected.
    
    Observations:
    - Code follows Solidity best practices
    - Proper use of SafeMath library
    - Access control appropriately implemented
    - Events properly emitted
    
    Recommendations:
    - Consider adding pausable functionality for emergency situations
    - Documentation could be enhanced with more natspec comments
    - Gas optimization possible in batch transfer functions
    
    Risk Level: LOW
    Status: APPROVED FOR PRODUCTION
    """
}


def test_nlp_analyzer():
    """Test the NLP analyzer with sample audit reports."""
    # Add backend to path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    try:
        from ml.audit_nlp_analyzer import analyze_audit_report
        print("✓ Successfully imported analyze_audit_report\n")
    except ImportError as e:
        print(f"✗ Failed to import: {e}")
        return False
    
    # Check for Gemini API key
    if not os.getenv("GEMINI_API_KEY"):
        print("WARNING: GEMINI_API_KEY environment variable not set")
        print("  Please set your Gemini API key: export GEMINI_API_KEY='...'")
        print("  Skipping API tests.\n")
        return False
    
    print("Testing NLP Audit Analysis with sample reports...\n")
    
    for report_name, audit_text in SAMPLE_AUDIT_REPORTS.items():
        print(f"\n{'='*60}")
        print(f"Testing: {report_name.upper()}")
        print(f"{'='*60}")
        print(f"Input length: {len(audit_text)} characters\n")
        
        try:
            result = analyze_audit_report(
                audit_text=audit_text,
                contract_address="0xabcd1234" if report_name == "high_risk" else None,
            )
            
            print(f"✓ Analysis successful!")
            print(f"\nResults:")
            print(f"  Risk Score: {result['risk_score']}/100")
            print(f"  Model Used: {result['model_used']}")
            print(f"\nSeverity Summary:")
            for severity, count in result['severity_summary'].items():
                print(f"  {severity}: {count}")
            
            print(f"\nVulnerabilities Found: {len(result['vulnerabilities'])}")
            for i, vuln in enumerate(result['vulnerabilities'][:3], 1):
                print(f"  {i}. {vuln['title']}")
                print(f"     Severity: {vuln['severity']}")
            
            print(f"\nKey Concerns:")
            for concern in result['key_concerns']:
                print(f"  • {concern}")
            
            print(f"\nSummary:")
            print(f"  {result['overall_summary']}")
            
            print(f"\nRecommended Action: {result['recommended_action']}")
            
        except Exception as e:
            print(f"✗ Analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    print(f"\n{'='*60}")
    print("✓ All tests completed successfully!")
    print(f"{'='*60}")
    return True


if __name__ == "__main__":
    success = test_nlp_analyzer()
    sys.exit(0 if success else 1)

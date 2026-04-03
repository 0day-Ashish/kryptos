"""
Generate mock data for testing combine_models.py
Creates sample RF/GNN predictions and transaction data.
"""

import pandas as pd
import json
import os

print("="*70)
print("MOCK DATA GENERATOR - Contract Risk Pipeline Test")
print("="*70)

# Create data directory if needed
os.makedirs("../data", exist_ok=True)

# =========================
# 1. GENERATE RF PREDICTIONS
# =========================

print("\n1. Generating RF predictions...")

rf_data = {
    "address": [
        "0xabcd1234567890abcdef1234567890abcdef1234",
        "0xef567890abcdef1234567890abcdef1234567890",
        "0x1234567890abcdef1234567890abcdef12345678",
        "0x567890abcdef1234567890abcdef1234567890ab",
        "0x90abcdef1234567890abcdef1234567890abcdef",
    ],
    "rf_score": [0.85, 0.42, 0.68, 0.15, 0.91]
}

rf_df = pd.DataFrame(rf_data)
rf_df.to_csv("../data/rf_predictions.csv", index=False)
print(f"   ✓ Created rf_predictions.csv ({len(rf_df)} wallets)")

# =========================
# 2. GENERATE GNN PREDICTIONS
# =========================

print("\n2. Generating GNN predictions...")

gnn_data = {
    "address": [
        "0xabcd1234567890abcdef1234567890abcdef1234",
        "0xef567890abcdef1234567890abcdef1234567890",
        "0x1234567890abcdef1234567890abcdef12345678",
        "0x567890abcdef1234567890abcdef1234567890ab",
        "0x90abcdef1234567890abcdef1234567890abcdef",
    ],
    "gnn_score": [0.78, 0.51, 0.62, 0.22, 0.89]
}

gnn_df = pd.DataFrame(gnn_data)
gnn_df.to_csv("../data/gnn_predictions.csv", index=False)
print(f"   ✓ Created gnn_predictions.csv ({len(gnn_df)} wallets)")

# =========================
# 3. GENERATE TRANSACTION DATA
# =========================

print("\n3. Generating wallet transactions...")

wallet_transactions = {
    "0xabcd1234567890abcdef1234567890abcdef1234": [
        {
            "to": "0xcontractA",
            "input": "0xa9059cbb00000000",  # Contract call
            "contractAddress": ""
        },
        {
            "to": "0xcontractB",
            "input": "0x12345678",  # Contract call
            "contractAddress": ""
        },
        {
            "to": "",
            "input": "0x",
            "contractAddress": "0xtokenX"  # Token transfer
        }
    ],
    "0xef567890abcdef1234567890abcdef1234567890": [
        {
            "to": "0xcontractC",
            "input": "0xabcdef12",
            "contractAddress": ""
        }
    ],
    "0x1234567890abcdef1234567890abcdef12345678": [
        {
            "to": "0xcontractA",  # Same contract as wallet 1
            "input": "0x11223344",
            "contractAddress": ""
        },
        {
            "to": "",
            "input": "0x",
            "contractAddress": "0xtokenY"
        }
    ],
    "0x567890abcdef1234567890abcdef1234567890ab": [
        {
            "to": "0xuser123",
            "input": "0x",  # Simple transfer (no contract)
            "contractAddress": ""
        }
    ],
    "0x90abcdef1234567890abcdef1234567890abcdef": [
        {
            "to": "0xcontractD",
            "input": "0xdeadbeef",
            "contractAddress": ""
        },
        {
            "to": "0xcontractE",
            "input": "0xcafebabe",
            "contractAddress": ""
        }
    ]
}

with open("../data/wallet_transactions.json", 'w') as f:
    json.dump(wallet_transactions, f, indent=2)

# Count contracts
total_contracts = set()
for txs in wallet_transactions.values():
    for tx in txs:
        if tx.get("contractAddress"):
            total_contracts.add(tx["contractAddress"])
        if tx.get("input", "0x") != "0x" and len(tx.get("input", "")) > 10:
            total_contracts.add(tx.get("to", ""))

print(f"   ✓ Created wallet_transactions.json ({len(wallet_transactions)} wallets)")
print(f"   ✓ Unique contracts: {len(total_contracts)}")

# =========================
# 4. GENERATE CONTRACT RISK CACHE
# =========================

print("\n4. Generating contract risk cache...")

contract_risk_cache = {
    "0xcontractA": 0.75,  # High risk
    "0xcontractB": 0.85,  # Very high risk
    "0xcontractC": 0.30,  # Low risk
    "0xcontractD": 0.65,  # Medium-high risk
    "0xcontractE": 0.55,  # Medium risk
    "0xtokenX": 0.20,     # Low risk token
    "0xtokenY": 0.15,     # Low risk token
}

with open("../data/contract_risk_cache.json", 'w') as f:
    json.dump(contract_risk_cache, f, indent=2)

print(f"   ✓ Created contract_risk_cache.json ({len(contract_risk_cache)} contracts)")

# =========================
# SUMMARY
# =========================

print("\n" + "="*70)
print("MOCK DATA SUMMARY")
print("="*70)

print("\nWallet Risk Expectations:")
print("-" * 70)
print("  Wallet 1 (0xabcd...): High RF (0.85), High GNN (0.78)")
print("    Contracts: A (0.75), B (0.85), tokenX (0.20)")
print("    → Expected contract_risk_score: 0.85 (MAX)")
print()
print("  Wallet 2 (0xef56...): Medium RF (0.42), Medium GNN (0.51)")
print("    Contracts: C (0.30)")
print("    → Expected contract_risk_score: 0.30")
print()
print("  Wallet 3 (0x1234...): Medium RF (0.68), Medium GNN (0.62)")
print("    Contracts: A (0.75), tokenY (0.15)")
print("    → Expected contract_risk_score: 0.75")
print()
print("  Wallet 4 (0x5678...): Low RF (0.15), Low GNN (0.22)")
print("    Contracts: NONE (simple transfer only)")
print("    → Expected contract_risk_score: 0.00")
print()
print("  Wallet 5 (0x90ab...): Very High RF (0.91), Very High GNN (0.89)")
print("    Contracts: D (0.65), E (0.55)")
print("    → Expected contract_risk_score: 0.65")

print("\n" + "="*70)
print("✅ Mock data generation complete!")
print("\nNext step: Run combine_models.py to verify contract risk integration")
print("  python combine_models.py")
print("="*70)

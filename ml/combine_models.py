import pandas as pd
import json
import os
from pathlib import Path

# Import contract risk module
import sys
sys.path.insert(0, str(Path(__file__).parent))
from contract_risk import (
    build_wallet_contract_mapping,
    compute_all_contract_risks,
    aggregate_wallet_contract_risk,
    generate_risk_reasons
)

print("="*70)
print("KRYPTOS - ENHANCED SCORING PIPELINE (RF + GNN + Contract Risk)")
print("="*70)

print("\n📂 Loading predictions...")

rf = pd.read_csv("../data/rf_predictions.csv")
gnn = pd.read_csv("../data/gnn_predictions.csv")

print(f"  RF predictions: {len(rf)} wallets")
print(f"  GNN predictions: {len(gnn)} wallets")

# Merge
df = rf.merge(gnn, on="address", how="inner")

print(f"  Merged dataset: {df.shape[0]} wallets")

# =========================
# COMPUTE CONTRACT RISK
# =========================

print("\n🔍 Computing contract risk scores...")

# Check if transaction data exists
tx_data_path = "../data/wallet_transactions.json"
contract_cache_path = "../data/contract_risk_cache.json"

contract_risk_computed = False

if os.path.exists(tx_data_path):
    print(f"✓ Found transaction data: {tx_data_path}")
    
    try:
        with open(tx_data_path, 'r') as f:
            wallet_transactions = json.load(f)
        
        print(f"  Loaded transactions for {len(wallet_transactions)} wallets")
        
        # Build wallet → contracts mapping
        print("  Extracting contract addresses from transactions...")
        wallet_contract_map = build_wallet_contract_mapping(wallet_transactions)
        
        # DEBUG: Show sample wallet → contracts mapping
        print("\n  DEBUG: Wallet → Contracts Mapping (first 5):")
        sample_count = 0
        for wallet_addr, contracts in list(wallet_contract_map.items())[:5]:
            print(f"    {wallet_addr}: {len(contracts)} contracts → {list(contracts)[:3]}")
            sample_count += 1
        print(f"  Total wallets with contracts: {len(wallet_contract_map)}")
        
        # Get all unique contracts
        all_contracts = set()
        for contracts in wallet_contract_map.values():
            all_contracts.update(contracts)
        
        print(f"\n  Found {len(all_contracts)} unique contracts across {len(wallet_contract_map)} wallets")
        if len(all_contracts) > 0:
            print(f"  Sample contracts: {list(all_contracts)[:5]}")
        
        if len(all_contracts) > 0:
            # Compute contract risks (use heuristic-only for speed)
            # Set use_nlp=True for higher quality but slower processing
            print("  Computing contract risk scores (heuristic mode)...")
            contract_risk_map = compute_all_contract_risks(
                unique_contracts=all_contracts,
                chain_id=1,
                use_nlp=False,  # Set to True to enable NLP analysis
                cache_file=contract_cache_path
            )
            
            print(f"  Computed risk for {len(contract_risk_map)} contracts")
            
            # DEBUG: Show sample contract risks
            print("\n  DEBUG: Sample Contract Risk Scores:")
            non_zero_risks = {k: v for k, v in list(contract_risk_map.items())[:10] if v > 0}
            if non_zero_risks:
                for contract, risk in list(non_zero_risks.items())[:5]:
                    print(f"    {contract}: {risk:.4f}")
            else:
                print("    ⚠️  WARNING: All contract risks are 0.0!")
                print(f"    Showing all computed risks: {list(contract_risk_map.items())[:5]}")
            
            # Aggregate at wallet level using MAX
            print("\n  Aggregating contract risks at wallet level (using MAX)...")
            # Check address format matching
            print("\n  DEBUG: Address Format Matching:")
            df_sample_addrs = df["address"].head(5).tolist()
            wallet_map_sample_addrs = list(wallet_contract_map.keys())[:5]
            print(f"    DataFrame addresses: {df_sample_addrs}")
            print(f"    Wallet map addresses: {wallet_map_sample_addrs}")
            
            # Count matches
            matches = 0
            for addr in df["address"]:
                addr_lower = str(addr).lower().strip()
                if addr_lower in wallet_contract_map:
                    matches += 1
                    if matches <= 3:
                        print(f"    ✓ Match found: {addr_lower} → {len(wallet_contract_map[addr_lower])} contracts")
            
            if matches == 0:
                print(f"    ✗ WARNING: NO ADDRESS MATCHES FOUND!")
                print(f"    DataFrame has {len(df)} addresses")
                print(f"    Wallet map has {len(wallet_contract_map)} addresses")
            else:
                print(f"    Found {matches}/{len(df)} matching addresses")
            
            df["contract_risk_score"] = df["address"].apply(
                lambda addr: aggregate_wallet_contract_risk(
                    contract_risk_map,
                    wallet_contract_map.get(str(addr).lower().strip(), set())
                )
            )
            
            contract_risk_computed = True
            wallets_with_contract_risk = df["contract_risk_score"].gt(0).sum()
            print(f"\n  ✓ Contract risk computed for {wallets_with_contract_risk}/{len(df)} wallets")
        
        else:
            print("  ⚠️  No contracts found in transactions")
            df["contract_risk_score"] = 0.0
    
    except Exception as e:
        print(f"  ✗ Error loading transaction data: {e}")
        df["contract_risk_score"] = 0.0

else:
    print(f"✗ Transaction data not found: {tx_data_path}")
    print("  To compute contract risk, run:")
    print("    python extract_wallet_transactions.py --max-wallets 50")
    print("  Setting contract_risk_score = 0.0 for all wallets")
    df["contract_risk_score"] = 0.0

# =========================
# DEBUG: VERIFY CONTRACT RISK SCORES
# =========================

print("\n🔬 Contract Risk Score Statistics:")
print("-" * 70)
print(df["contract_risk_score"].describe())
print("-" * 70)

if contract_risk_computed:
    print(f"  Non-zero scores: {df['contract_risk_score'].gt(0).sum()}")
    print(f"  Max score: {df['contract_risk_score'].max():.4f}")
    print(f"  Mean score: {df['contract_risk_score'].mean():.4f}")
else:
    print("  ⚠️  All scores are 0.0 (no transaction data or no contracts)")

# =========================
# NORMALIZE SCORES
# =========================

def min_max_normalize(series: pd.Series) -> pd.Series:
    """Normalize to [0, 1] range."""
    min_val = series.min()
    max_val = series.max()
    if max_val == min_val:
        # All values are the same, return zeros
        return pd.Series(0.0, index=series.index)
    return (series - min_val) / (max_val - min_val)


print("\n🔄 Normalizing scores...")

df["rf_score_norm"] = min_max_normalize(df["rf_score"])
df["gnn_score_norm"] = min_max_normalize(df["gnn_score"])

# IMPORTANT: Only normalize contract_risk_score if there's variance
if df["contract_risk_score"].max() > 0:
    df["contract_risk_norm"] = min_max_normalize(df["contract_risk_score"])
    print("  ✓ Contract risk normalized (variance detected)")
else:
    df["contract_risk_norm"] = 0.0
    print("  ⚠️  Contract risk not normalized (all zeros)")

# =========================
# COMBINE SCORES
# =========================

print("\n⚡ Computing final scores...")
print("  Formula: final_score = 0.4×RF + 0.4×GNN + 0.2×Contract")

# Updated formula: 40% RF + 40% GNN + 20% Contract Risk
df["final_score"] = (
    0.4 * df["rf_score_norm"] + 
    0.4 * df["gnn_score_norm"] + 
    0.2 * df["contract_risk_norm"]
)

print("  ✓ Final scores computed")

# Final classification
df["final_label"] = (df["final_score"] > 0.5).astype(int)

# Risk levels
def risk_level(x):
    if x >= 0.7:
        return "HIGH"
    elif x >= 0.4:
        return "MEDIUM"
    else:
        return "LOW"

df["risk_level"] = df["final_score"].apply(risk_level)

# =========================
# GENERATE EXPLAINABILITY
# =========================

print("\n💡 Generating risk reasons...")

df["risk_reasons"] = df.apply(
    lambda row: "; ".join(generate_risk_reasons(
        rf_score=row["rf_score_norm"],
        gnn_score=row["gnn_score_norm"],
        contract_risk_score=row["contract_risk_norm"]
    )),
    axis=1
)

print("  ✓ Risk reasons generated")

# =========================
# DISPLAY RESULTS
# =========================

print("\n" + "="*70)
print("FINAL PREDICTIONS SUMMARY")
print("="*70)

# Show sample
print("\nSample predictions (first 5):")
print("-" * 70)
display_cols = ["address", "rf_score_norm", "gnn_score_norm", "contract_risk_score", "final_score", "risk_level"]
print(df[display_cols].head(5).to_string(index=False))

print("\n" + "-" * 70)
print("Risk Level Distribution:")
print(df["risk_level"].value_counts().to_string())

print("\n" + "-" * 70)
print("Score Statistics:")
print(f"  RF Score (normalized):      min={df['rf_score_norm'].min():.4f}, max={df['rf_score_norm'].max():.4f}, mean={df['rf_score_norm'].mean():.4f}")
print(f"  GNN Score (normalized):     min={df['gnn_score_norm'].min():.4f}, max={df['gnn_score_norm'].max():.4f}, mean={df['gnn_score_norm'].mean():.4f}")
print(f"  Contract Risk (raw):        min={df['contract_risk_score'].min():.4f}, max={df['contract_risk_score'].max():.4f}, mean={df['contract_risk_score'].mean():.4f}")
print(f"  Contract Risk (normalized): min={df['contract_risk_norm'].min():.4f}, max={df['contract_risk_norm'].max():.4f}, mean={df['contract_risk_norm'].mean():.4f}")
print(f"  Final Score:                min={df['final_score'].min():.4f}, max={df['final_score'].max():.4f}, mean={df['final_score'].mean():.4f}")

# =========================
# SAVE FINAL OUTPUT
# =========================

# Select columns to save
output_columns = [
    "address",
    "rf_score",
    "gnn_score",
    "contract_risk_score",  # RAW contract risk score
    "rf_score_norm",
    "gnn_score_norm",
    "contract_risk_norm",
    "final_score",
    "final_label",
    "risk_level",
    "risk_reasons"
]

output_path = "../data/final_predictions.csv"
df[output_columns].to_csv(output_path, index=False)

print("\n" + "="*70)
print(f"✅ Final predictions saved: {output_path}")
print(f"   Total wallets: {len(df)}")
print(f"   Columns: {len(output_columns)}")
print("="*70)

# Show column list
print("\nOutput columns:")
for i, col in enumerate(output_columns, 1):
    print(f"  {i}. {col}")

print("\n✨ Pipeline complete!")
print("="*70)



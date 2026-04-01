"""
Regenerate RF and GNN predictions from existing labeled dataset.

This will restore your predictions to use the FULL dataset instead of just 5 mock wallets.
"""

import pandas as pd
import sys
from pathlib import Path

print("="*70)
print("REGENERATE PREDICTIONS FROM FULL DATASET")
print("="*70)

# Check which dataset file exists
dataset_files = [
    "../data/wallet_features_hard.csv",
    "../data/wallet_features_labeled.csv",
    "../data/wallet_features_graph_hard.csv",
    "../data/wallet_features_1M.csv",
]

dataset_path = None
for path in dataset_files:
    if Path(path).exists():
        dataset_path = path
        print(f"\n✓ Found dataset: {path}")
        break

if not dataset_path:
    print("\n✗ ERROR: No dataset file found!")
    print("   Looked for:")
    for path in dataset_files:
        print(f"     - {path}")
    sys.exit(1)

# Load dataset
print(f"\nLoading dataset from {dataset_path}...")
df = pd.read_csv(dataset_path)
print(f"  Total wallets in dataset: {len(df)}")

# Check if predictions already exist
if "rf_score" not in df.columns:
    print("\n✗ ERROR: Dataset does not have rf_score column!")
    print("   You need to run the RF training pipeline first.")
    print("   Available columns:", list(df.columns[:10]), "...")
    sys.exit(1)

# Extract RF predictions
print("\n1. Extracting RF predictions...")
if "address" in df.columns and "rf_score" in df.columns:
    rf_df = df[["address", "rf_score"]].copy()
    rf_df.to_csv("../data/rf_predictions.csv", index=False)
    print(f"   ✓ Saved rf_predictions.csv ({len(rf_df)} wallets)")
else:
    print("   ✗ Missing required columns: address, rf_score")
    sys.exit(1)

# Extract GNN predictions
print("\n2. Extracting GNN predictions...")
if "gnn_score" in df.columns:
    gnn_df = df[["address", "gnn_score"]].copy()
    gnn_df.to_csv("../data/gnn_predictions.csv", index=False)
    print(f"   ✓ Saved gnn_predictions.csv ({len(gnn_df)} wallets)")
elif "gnn_anomaly_score" in df.columns:
    # Alternative column name
    gnn_df = df[["address", "gnn_anomaly_score"]].rename(columns={"gnn_anomaly_score": "gnn_score"})
    gnn_df.to_csv("../data/gnn_predictions.csv", index=False)
    print(f"   ✓ Saved gnn_predictions.csv ({len(gnn_df)} wallets)")
else:
    print("   ⚠️  No gnn_score column found, creating placeholder...")
    # Create placeholder GNN scores (use RF scores as approximation)
    gnn_df = df[["address", "rf_score"]].copy()
    gnn_df.rename(columns={"rf_score": "gnn_score"}, inplace=True)
    gnn_df.to_csv("../data/gnn_predictions.csv", index=False)
    print(f"   ✓ Saved gnn_predictions.csv ({len(gnn_df)} wallets - using RF as placeholder)")

print("\n" + "="*70)
print("✅ PREDICTIONS REGENERATED SUCCESSFULLY!")
print(f"   RF predictions: {len(rf_df)} wallets")
print(f"   GNN predictions: {len(gnn_df)} wallets")
print("\nNext step: Run combine_models.py")
print("  python combine_models.py")
print("="*70)

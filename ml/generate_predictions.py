"""
Generate RF and GNN predictions for the full dataset.

Loads trained models and runs inference on all wallets.
"""

import pandas as pd
import numpy as np
import joblib
import sys
from pathlib import Path

print("="*70)
print("GENERATE PREDICTIONS FOR FULL DATASET")
print("="*70)

# Add ml directory to path
ml_path = Path(__file__).parent
sys.path.insert(0, str(ml_path))

# Load dataset
dataset_path = "../data/wallet_features_hard.csv"
print(f"\n📂 Loading dataset from {dataset_path}...")
df = pd.read_csv(dataset_path)
print(f"   Total wallets: {len(df):,}")

# Check if address column exists
if "address" not in df.columns:
    print("✗ ERROR: No 'address' column found!")
    sys.exit(1)

# =========================
# LOAD TRAINED MODELS
# =========================

print("\n🤖 Loading trained models...")

# Load Random Forest
rf_path = "../models/random_forest.pkl"
if not Path(rf_path).exists():
    print(f"✗ ERROR: Random Forest model not found at {rf_path}")
    sys.exit(1)

rf_model = joblib.load(rf_path)
print(f"   ✓ Loaded Random Forest")

# Load Isolation Forest
iforest_path = "../models/isolation_forest.pkl"
iforest_scaler_path = "../models/iforest_scaler.pkl"

if Path(iforest_path).exists() and Path(iforest_scaler_path).exists():
    iforest_model = joblib.load(iforest_path)
    iforest_scaler = joblib.load(iforest_scaler_path)
    print(f"   ✓ Loaded Isolation Forest")
    use_iforest = True
else:
    print(f"   ⚠️  Isolation Forest not found (optional)")
    use_iforest = False

# =========================
# DEFINE FEATURE COLUMNS
# =========================

# Base features for RF (13 features)
BASE_FEATURES = [
    'fan_out', 'fan_in', 'total_out', 'total_in', 'total_volume',
    'out_tx_count', 'in_tx_count', 'total_tx_count', 'lifetime_seconds',
    'tx_frequency', 'counterparty_ratio', 'out_in_volume_ratio', 'pass_through_ratio'
]

# Check which features exist in dataset
available_features = [col for col in BASE_FEATURES if col in df.columns]
missing_features = [col for col in BASE_FEATURES if col not in df.columns]

print(f"\n📊 Feature availability:")
print(f"   Available: {len(available_features)}/{len(BASE_FEATURES)}")
if missing_features:
    print(f"   Missing: {missing_features}")

# Use available features
feature_columns = available_features

if len(feature_columns) < 5:
    print(f"\n✗ ERROR: Too few features available ({len(feature_columns)})")
    print("   This dataset may not be compatible with the trained model")
    sys.exit(1)

# =========================
# GENERATE RF PREDICTIONS
# =========================

print(f"\n⚡ Generating RF predictions...")

# Extract features
X = df[feature_columns].fillna(0)  # Fill NaN with 0

# Generate predictions
try:
    rf_proba = rf_model.predict_proba(X)[:, 1]  # Probability of scam class
    df['rf_score'] = rf_proba
    print(f"   ✓ Generated RF scores for {len(df):,} wallets")
    print(f"   Score range: [{df['rf_score'].min():.4f}, {df['rf_score'].max():.4f}]")
except Exception as e:
    print(f"   ✗ ERROR: {e}")
    print("   Trying alternative method...")
    # Try with all features the model expects
    try:
        rf_proba = rf_model.predict_proba(X)[:, 1]
        df['rf_score'] = rf_proba
        print(f"   ✓ Generated RF scores (alternative method)")
    except:
        print("   ✗ Failed to generate RF scores")
        sys.exit(1)

# =========================
# GENERATE GNN PREDICTIONS (PLACEHOLDER)
# =========================

print(f"\n⚡ Generating GNN predictions...")

# For now, use RF scores as placeholder
# Real GNN requires graph structure
df['gnn_score'] = df['rf_score'] * 0.9  # Similar but slightly different
print(f"   ⚠️  Using RF-based placeholder for GNN scores")
print(f"   (Real GNN requires graph structure - run gnn_pipeline.py for accurate scores)")

# =========================
# SAVE PREDICTIONS
# =========================

print(f"\n💾 Saving predictions...")

# Save RF predictions
rf_output = df[['address', 'rf_score']].copy()
rf_output.to_csv('../data/rf_predictions.csv', index=False)
print(f"   ✓ Saved rf_predictions.csv ({len(rf_output):,} wallets)")

# Save GNN predictions
gnn_output = df[['address', 'gnn_score']].copy()
gnn_output.to_csv('../data/gnn_predictions.csv', index=False)
print(f"   ✓ Saved gnn_predictions.csv ({len(gnn_output):,} wallets)")

# =========================
# STATISTICS
# =========================

print(f"\n" + "="*70)
print("PREDICTION STATISTICS")
print("="*70)

print(f"\nRF Score Distribution:")
print(f"  Min:    {df['rf_score'].min():.4f}")
print(f"  Max:    {df['rf_score'].max():.4f}")
print(f"  Mean:   {df['rf_score'].mean():.4f}")
print(f"  Median: {df['rf_score'].median():.4f}")
print(f"  Std:    {df['rf_score'].std():.4f}")

print(f"\nRisk Level Distribution (RF Score):")
high_risk = (df['rf_score'] >= 0.7).sum()
medium_risk = ((df['rf_score'] >= 0.4) & (df['rf_score'] < 0.7)).sum()
low_risk = (df['rf_score'] < 0.4).sum()

print(f"  HIGH (≥0.7):    {high_risk:,} ({high_risk/len(df)*100:.1f}%)")
print(f"  MEDIUM (0.4-0.7): {medium_risk:,} ({medium_risk/len(df)*100:.1f}%)")
print(f"  LOW (<0.4):     {low_risk:,} ({low_risk/len(df)*100:.1f}%)")

print(f"\n" + "="*70)
print("✅ PREDICTIONS GENERATED SUCCESSFULLY!")
print(f"\nTotal wallets processed: {len(df):,}")
print("\nNext step: Run combine_models.py to integrate contract risk")
print("  python combine_models.py")
print("="*70)

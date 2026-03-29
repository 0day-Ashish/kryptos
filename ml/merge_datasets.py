"""
merge_datasets.py — Merge healthy + scam CSVs into a unified labeled dataset.

Handles:
    - Different column sets (healthy has 11 cols, scam has 15)
    - Wei → ETH conversion for scam volumes
    - Computing derived features (total_volume, tx_frequency, counterparty_ratio)
      for wallets that are missing them
    - Deduplication by address
"""

import pandas as pd
import numpy as np

print("Loading datasets...")

healthy = pd.read_csv("../data/healthy_wallet_features_1.csv")
scam = pd.read_csv("../data/scam_wallets_full.csv")

print(f"  Healthy: {len(healthy):,} rows, columns: {list(healthy.columns)}")
print(f"  Scam:    {len(scam):,} rows, columns: {list(scam.columns)}")

# ===============================
# Standardize address column
# ===============================
if "addresses" in healthy.columns:
    healthy.rename(columns={"addresses": "address"}, inplace=True)
if "addresses" in scam.columns:
    scam.rename(columns={"addresses": "address"}, inplace=True)

# ===============================
# Add labels
# ===============================
healthy["label"] = 0
if "label" not in scam.columns:
    scam["label"] = 1

# ===============================
# Wei → ETH conversion for SCAM volumes
# ===============================
# Healthy volumes are already in ETH (values like 16.63)
# Scam volumes are in wei (values like 3.25e16)
# Detect and convert: if median > 1e12, it's wei

WEI_THRESHOLD = 1e12
WEI_COLS = ["total_out_volume", "total_in_volume", "total_volume"]

print("\nConverting scam volumes from wei to ETH...")
for col in WEI_COLS:
    if col in scam.columns:
        median_val = scam[col].dropna().median()
        if median_val > WEI_THRESHOLD:
            scam[col] = scam[col].astype(float) / 1e18
            print(f"  Converted scam[{col}]: median was {median_val:.2e}, now {scam[col].median():.4f}")
        else:
            print(f"  Skipped scam[{col}]: already in ETH (median={median_val:.4f})")

# Also check healthy (should not need conversion but be safe)
for col in WEI_COLS:
    if col in healthy.columns:
        median_val = healthy[col].dropna().median()
        if median_val > WEI_THRESHOLD:
            healthy[col] = healthy[col].astype(float) / 1e18
            print(f"  Converted healthy[{col}]: median was {median_val:.2e}")

# ===============================
# Merge datasets
# ===============================
print("\nMerging datasets...")

# Only keep columns that both datasets have, plus any extras
df = pd.concat([healthy, scam], ignore_index=True, sort=False)

# ===============================
# Compute missing derived features
# ===============================
print("Computing derived features for wallets missing them...")

# total_volume: if missing or 0, compute from out + in
if "total_out_volume" in df.columns and "total_in_volume" in df.columns:
    needs_total = df["total_volume"].isna() | (df["total_volume"] == 0)
    out_vol = df["total_out_volume"].fillna(0)
    in_vol = df["total_in_volume"].fillna(0)
    computed_total = out_vol + in_vol
    # Only fill where total_volume is missing/zero AND we actually have data
    has_data = (out_vol > 0) | (in_vol > 0)
    df.loc[needs_total & has_data, "total_volume"] = computed_total[needs_total & has_data]
    n_fixed = int((needs_total & has_data).sum())
    print(f"  Computed total_volume for {n_fixed:,} wallets")

# tx_frequency: total_tx_count / lifetime_seconds
if "tx_frequency" not in df.columns:
    df["tx_frequency"] = np.nan
needs_freq = df["tx_frequency"].isna() | (df["tx_frequency"] == 0)
if "total_tx_count" in df.columns and "lifetime_seconds" in df.columns:
    life = df["lifetime_seconds"].astype(float)
    tx = df["total_tx_count"].astype(float)
    computed_freq = np.where(life > 0, tx / life, 0.0)
    # Only fill where we have tx data
    has_tx = tx > 0
    df.loc[needs_freq & has_tx, "tx_frequency"] = computed_freq[needs_freq & has_tx]
    n_fixed = int((needs_freq & has_tx).sum())
    print(f"  Computed tx_frequency for {n_fixed:,} wallets")

# counterparty_ratio: (unique_receivers + unique_senders) / total_tx_count
if "counterparty_ratio" not in df.columns:
    df["counterparty_ratio"] = np.nan
needs_cpr = df["counterparty_ratio"].isna() | (df["counterparty_ratio"] == 0)
if "unique_receivers" in df.columns and "unique_senders" in df.columns and "total_tx_count" in df.columns:
    tx = df["total_tx_count"].astype(float)
    rcv = df["unique_receivers"].astype(float)
    snd = df["unique_senders"].astype(float)
    computed_cpr = np.where(tx > 0, (rcv + snd) / tx, 0.0)
    has_tx = tx > 0
    df.loc[needs_cpr & has_tx, "counterparty_ratio"] = computed_cpr[needs_cpr & has_tx]
    n_fixed = int((needs_cpr & has_tx).sum())
    print(f"  Computed counterparty_ratio for {n_fixed:,} wallets")

# out_in_volume_ratio: total_out / total_in
if "out_in_volume_ratio" in df.columns:
    needs_ratio = df["out_in_volume_ratio"].isna() | (df["out_in_volume_ratio"] == 0)
    if "total_out_volume" in df.columns and "total_in_volume" in df.columns:
        out_v = df["total_out_volume"].fillna(0).astype(float)
        in_v = df["total_in_volume"].fillna(0).astype(float)
        computed_ratio = np.where(in_v > 0, out_v / in_v, np.where(out_v > 0, out_v, 0.0))
        has_data = (out_v > 0) | (in_v > 0)
        df.loc[needs_ratio & has_data, "out_in_volume_ratio"] = computed_ratio[needs_ratio & has_data]
        n_fixed = int((needs_ratio & has_data).sum())
        print(f"  Computed out_in_volume_ratio for {n_fixed:,} wallets")

# ===============================
# Clean
# ===============================
df = df.dropna(subset=["address"])
df = df.drop_duplicates(subset=["address"])

# Fill any remaining NaN with 0 (but only in numeric columns, not address)
numeric_cols = df.select_dtypes(include=[np.number]).columns
df[numeric_cols] = df[numeric_cols].fillna(0)

# Replace inf values
df[numeric_cols] = df[numeric_cols].replace([np.inf, -np.inf], 0)

# Shuffle
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

# ===============================
# Save
# ===============================
df.to_csv("../data/wallet_features_labeled.csv", index=False)

print(f"\nDone! Shape: {df.shape}")
print(df["label"].value_counts().to_string())

# Sanity checks
print("\n--- Sanity Checks ---")
scam_df = df[df["label"] == 1]
healthy_df = df[df["label"] == 0]
for col in ["total_volume", "counterparty_ratio", "tx_frequency"]:
    if col in df.columns:
        h_med = healthy_df[col].median()
        s_med = scam_df[col].median()
        print(f"  {col:25s}  healthy_median={h_med:.6f}  scam_median={s_med:.6f}")
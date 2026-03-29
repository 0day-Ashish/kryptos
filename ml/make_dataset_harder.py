"""
make_dataset_harder.py — Create a harder version of the labeled dataset by:
    1. Generating "mixed" wallets (interpolated scam+healthy features)
    2. Adding noise to healthy wallets to blur decision boundaries

Uses the corrected wallet_features_labeled.csv as input.
"""

import pandas as pd
import numpy as np

print("Loading dataset...")

df = pd.read_csv("../data/wallet_features_labeled.csv")

print(f"Original shape: {df.shape}")
print(f"Label distribution:\n{df['label'].value_counts().to_string()}")

# Feature columns (everything except address and label)
feature_cols = [col for col in df.columns if col not in ["address", "label"]]

# Split
scam = df[df["label"] == 1].copy()
healthy = df[df["label"] == 0].copy()

print(f"Healthy: {len(healthy):,}  Scam: {len(scam):,}")

# ===============================
# 1. Create "mixed" wallets
# ===============================
print("Creating mixed wallets (interpolated scam+healthy)...")

num_mixed = 10000
rng = np.random.RandomState(42)

scam_sample = scam.sample(num_mixed, replace=True, random_state=42).reset_index(drop=True)
healthy_sample = healthy.sample(num_mixed, replace=True, random_state=42).reset_index(drop=True)

mixed = scam_sample.copy()

# Generate unique addresses for mixed wallets
mixed["address"] = ["0xmixed_" + f"{i:06d}" for i in range(num_mixed)]

for col in feature_cols:
    alpha = rng.uniform(0.3, 0.7, size=num_mixed)
    mixed[col] = alpha * scam_sample[col].values + (1 - alpha) * healthy_sample[col].values

mixed["label"] = 1  # still scams but harder to detect

print(f"  Created {len(mixed):,} mixed scam wallets")

# ===============================
# 2. Create noisy healthy wallets
# ===============================
print("Adding noise to healthy wallets...")

noisy_healthy = healthy.copy()

# Generate unique addresses for noisy wallets
noisy_healthy["address"] = ["0xnoisy_" + f"{i:06d}" for i in range(len(noisy_healthy))]

for col in feature_cols:
    noise = rng.normal(0, 0.1, size=len(noisy_healthy))
    noisy_healthy[col] = noisy_healthy[col] * (1 + noise)

# Clip negative values for features that should be non-negative
non_negative_cols = [c for c in feature_cols if c not in ["out_in_volume_ratio"]]
for col in non_negative_cols:
    noisy_healthy[col] = noisy_healthy[col].clip(lower=0)

noisy_healthy["label"] = 0

print(f"  Created {len(noisy_healthy):,} noisy healthy wallets")

# ===============================
# 3. Combine everything
# ===============================
df_hard = pd.concat([df, mixed, noisy_healthy], ignore_index=True)

# Replace inf/nan
df_hard[feature_cols] = df_hard[feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0)

# Shuffle
df_hard = df_hard.sample(frac=1, random_state=42).reset_index(drop=True)

print(f"\nNew shape: {df_hard.shape}")
print(f"Label distribution:\n{df_hard['label'].value_counts().to_string()}")

# ===============================
# Save
# ===============================
df_hard.to_csv("../data/wallet_features_hard.csv", index=False)

print("\nDone! Saved: wallet_features_hard.csv")
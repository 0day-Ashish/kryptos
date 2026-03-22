import pandas as pd
import numpy as np

print("Loading dataset...")

df = pd.read_csv("../data/wallet_features_labeled.csv")

print("Original shape:", df.shape)

# Split
scam = df[df["label"] == 1]
healthy = df[df["label"] == 0]


# ===============================
# 1. Create "mixed" wallets
# ===============================
print("Creating mixed wallets...")

num_samples = 10000

scam_sample = scam.sample(num_samples, replace=True)
healthy_sample = healthy.sample(num_samples, replace=True)

mixed = scam_sample.copy()

for col in df.columns:
    if col not in ["address", "label"]:
        alpha = np.random.uniform(0.3, 0.7)
        mixed[col] = alpha * scam_sample[col].values + (1 - alpha) * healthy_sample[col].values

mixed["label"] = 1  # still scams but harder


# ===============================
# 2. Add noise to healthy wallets
# ===============================
print("Adding noise to healthy wallets...")

noisy_healthy = healthy.copy()

for col in df.columns:
    if col not in ["address", "label"]:
        noise = np.random.normal(0, 0.1, size=len(noisy_healthy))
        noisy_healthy[col] = noisy_healthy[col] * (1 + noise)


# ===============================
# 3. Combine everything
# ===============================
df_hard = pd.concat([df, mixed, noisy_healthy], ignore_index=True)

df_hard = df_hard.sample(frac=1).reset_index(drop=True)

print("New shape:", df_hard.shape)


# ===============================
# Save
# ===============================
df_hard.to_csv("../data/wallet_features_hard.csv", index=False)

print("✅ Saved: wallet_features_hard.csv")
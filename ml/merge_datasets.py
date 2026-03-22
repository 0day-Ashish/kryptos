import pandas as pd

print("Loading datasets...")

healthy = pd.read_csv("../data/healthy_wallet_features_1.csv")
scam = pd.read_csv("../data/scam_wallets_full.csv")

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
scam["label"] = 1

# ===============================
# Merge ALL columns (IMPORTANT)
# ===============================
df = pd.concat([healthy, scam], ignore_index=True, sort=False)

# ===============================
# Clean
# ===============================
df = df.dropna(subset=["address"])
df = df.drop_duplicates(subset=["address"])

# Fill missing features
df = df.fillna(0)

# Shuffle
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

# ===============================
# Save
# ===============================
df.to_csv("../data/wallet_features_labeled.csv", index=False)

print("✅ Done")
print("Shape:", df.shape)
print(df["label"].value_counts())
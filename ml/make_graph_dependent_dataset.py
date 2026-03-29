"""
make_graph_dependent_dataset.py — Create a graph-dependent harder dataset.

Creates deceptive wallets that look normal by features but are connected
to known scam hubs.  Properly handles deduplication and label consistency.
"""

import pandas as pd
import numpy as np
import random

random.seed(42)
np.random.seed(42)

print("Loading datasets...")

df = pd.read_csv("../data/wallet_features_hard.csv")
edges = pd.read_csv("../data/wallet_edges.csv")

print(f"  Features: {df.shape}")
print(f"  Edges: {edges.shape}")

feature_cols = [col for col in df.columns if col not in ["address", "label"]]

# ===============================
# Build adjacency
# ===============================
print("Building adjacency graph...")

graph = {}
for _, row in edges.iterrows():
    a, b = str(row["from_address"]), str(row["to_address"])
    graph.setdefault(a, set()).add(b)
    graph.setdefault(b, set()).add(a)

# ===============================
# Split
# ===============================
scam = df[df["label"] == 1]
healthy = df[df["label"] == 0]

print(f"  Healthy: {len(healthy):,}  Scam: {len(scam):,}")

# ===============================
# STEP 1: Pick scam hubs
# ===============================
print("Selecting scam hubs...")

scam_addresses = list(scam["address"].unique())
num_hubs = min(5000, len(scam_addresses))
scam_hubs = random.sample(scam_addresses, num_hubs)

print(f"  Selected {num_hubs} scam hubs")

# ===============================
# STEP 2: Create deceptive wallets
# ===============================
print("Creating deceptive wallets (look normal, connected to scam)...")

num_fake = 15000

healthy_sample = healthy.sample(num_fake, replace=True, random_state=42).reset_index(drop=True)
fake_wallets = healthy_sample.copy()

# Generate UNIQUE addresses for fake wallets
fake_wallets["address"] = ["0xdeceptive_" + f"{i:06d}" for i in range(num_fake)]

# Connect fake wallets to scam hubs in the edge list
new_edges = []
for i, addr in enumerate(fake_wallets["address"]):
    scam_neighbor = random.choice(scam_hubs)
    new_edges.append({"from_address": addr, "to_address": scam_neighbor})

# Label them as scam (they're deceptive — normal features but scam connections)
fake_wallets["label"] = 1

print(f"  Created {len(fake_wallets):,} deceptive wallets")

# ===============================
# Combine dataset
# ===============================
df_new = pd.concat([df, fake_wallets], ignore_index=True)

# ===============================
# DEDUPLICATE by address (keep first occurrence)
# ===============================
before_dedup = len(df_new)
df_new = df_new.drop_duplicates(subset=["address"], keep="first")
after_dedup = len(df_new)
print(f"  Deduplication: {before_dedup:,} -> {after_dedup:,} (removed {before_dedup - after_dedup:,})")

# Verify no address has inconsistent labels
addr_label_counts = df_new.groupby("address")["label"].nunique()
inconsistent = (addr_label_counts > 1).sum()
assert inconsistent == 0, f"Found {inconsistent} addresses with inconsistent labels!"

# Replace inf/nan
df_new[feature_cols] = df_new[feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0)

# Shuffle
df_new = df_new.sample(frac=1, random_state=42).reset_index(drop=True)

print(f"\nFinal dataset: {df_new.shape}")
print(f"  Unique addresses: {df_new['address'].nunique():,}")
print(f"  Label distribution:\n{df_new['label'].value_counts().to_string()}")

# ===============================
# Save updated edges
# ===============================
new_edges_df = pd.DataFrame(new_edges)
edges_combined = pd.concat([edges, new_edges_df], ignore_index=True)
edges_combined = edges_combined.drop_duplicates()
edges_combined.to_csv("../data/wallet_edges.csv", index=False)
print(f"  Updated edges: {len(edges_combined):,}")

# ===============================
# Save dataset
# ===============================
df_new.to_csv("../data/wallet_features_graph_hard.csv", index=False)

print("\nDone! Saved: wallet_features_graph_hard.csv")
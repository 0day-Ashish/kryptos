import pandas as pd
import numpy as np
import random

print("Loading dataset...")

df = pd.read_csv("../data/wallet_features_hard.csv")
edges = pd.read_csv("../data/wallet_edges.csv")

print("Dataset:", df.shape)


# ===============================
# Build adjacency
# ===============================
graph = {}

for _, row in edges.iterrows():
    a, b = row["from_address"], row["to_address"]
    
    graph.setdefault(a, set()).add(b)
    graph.setdefault(b, set()).add(a)


# ===============================
# Split
# ===============================
scam = df[df["label"] == 1]
healthy = df[df["label"] == 0]

print("Healthy:", len(healthy), "Scam:", len(scam))


# ===============================
# STEP 1: Pick scam hubs
# ===============================
print("Selecting scam hubs...")

scam_addresses = set(scam["address"])
scam_hubs = random.sample(list(scam_addresses), 5000)


# ===============================
# STEP 2: Create deceptive wallets
# ===============================
print("Creating deceptive wallets...")

num_fake = 15000

healthy_sample = healthy.sample(num_fake, replace=True).copy()

fake_wallets = healthy_sample.copy()

# Make them look normal BUT connect to scam
for i, addr in enumerate(fake_wallets["address"]):
    # attach scam neighbors
    scam_neighbor = random.choice(scam_hubs)
    
    graph.setdefault(addr, set()).add(scam_neighbor)
    graph.setdefault(scam_neighbor, set()).add(addr)

# Label them as scam
fake_wallets["label"] = 1


# ===============================
# Combine dataset
# ===============================
df_new = pd.concat([df, fake_wallets], ignore_index=True)
df_new = df_new.sample(frac=1).reset_index(drop=True)

print("New dataset:", df_new.shape)


# ===============================
# Save
# ===============================
df_new.to_csv("../data/wallet_features_graph_hard.csv", index=False)

print("✅ Saved: wallet_features_graph_hard.csv")
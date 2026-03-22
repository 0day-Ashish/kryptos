import pandas as pd
import networkx as nx
from node2vec import Node2Vec
import time

start_time = time.time()

# ===============================
# STEP 1: Load edge data
# ===============================
print("Loading edges...")

df = pd.read_csv("../data/wallet_edges.csv")

# Drop nulls
df = df.dropna(subset=["from_address", "to_address"])

# OPTIONAL: reduce size for faster runs (comment if full run needed)
df = df.sample(300000, random_state=42)

print("Edges loaded:", len(df))


# ===============================
# STEP 2: Build graph
# ===============================
print("Building graph...")

G = nx.from_pandas_edgelist(
    df,
    source="from_address",
    target="to_address",
    create_using=nx.DiGraph()
)

print("Nodes:", G.number_of_nodes())
print("Edges:", G.number_of_edges())


# ===============================
# STEP 3: Node2Vec embeddings
# ===============================
print("Running Node2Vec... (this may take time)")

node2vec = Node2Vec(
    G,
    dimensions=64,
    walk_length=5,   # reduced
    num_walks=10,    # reduced
    workers=1        # 🔥 CRITICAL FIX (no crash)
)

model = node2vec.fit(window=5, min_count=1)

print("Embeddings ready!")


# ===============================
# STEP 4: Save embeddings
# ===============================
print("Saving embeddings...")

embeddings = []

for node in G.nodes():
    embeddings.append([node] + list(model.wv[node]))

emb_df = pd.DataFrame(embeddings)

# Rename columns properly
cols = ["address"] + [f"emb_{i}" for i in range(64)]
emb_df.columns = cols

emb_df.to_csv("../data/wallet_embeddings.csv", index=False)

print("Saved to data/wallet_embeddings.csv")


# ===============================
# DONE
# ===============================
end_time = time.time()
print(f"Total time: {(end_time - start_time)/60:.2f} minutes")
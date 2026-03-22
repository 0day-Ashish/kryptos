import pandas as pd
from sklearn.cluster import KMeans

print("Loading data...")

# Load datasets
df = pd.read_csv("../data/wallet_features_labeled.csv")
emb = pd.read_csv("../data/wallet_embeddings.csv")

print("Features:", df.shape)
print("Embeddings:", emb.shape)


# ===============================
# STEP 1: Merge embeddings
# ===============================
print("Merging embeddings...")

df = df.merge(emb, on="address", how="inner")

print("After merge:", df.shape)


# ===============================
# STEP 2: Prepare embedding vectors
# ===============================
print("Preparing embeddings...")

embedding_cols = [col for col in df.columns if col.startswith("emb_")]

X_emb = df[embedding_cols].values


# ===============================
# STEP 3: Clustering
# ===============================
print("Running KMeans...")

kmeans = KMeans(n_clusters=20, random_state=42)
df["cluster_id"] = kmeans.fit_predict(X_emb)


# ===============================
# STEP 4: Cluster features
# ===============================
print("Creating cluster features...")

# Cluster size
cluster_size = df.groupby("cluster_id").size()
df["cluster_size"] = df["cluster_id"].map(cluster_size)

# Cluster scam ratio
cluster_scam_ratio = df.groupby("cluster_id")["label"].mean()
df["cluster_scam_ratio"] = df["cluster_id"].map(cluster_scam_ratio)


# ===============================
# STEP 5: Save final dataset
# ===============================
output_path = "../data/wallet_features_with_clusters.csv"

df.to_csv(output_path, index=False)

print("\n✅ DONE")
print("Final shape:", df.shape)
print("Saved to:", output_path)
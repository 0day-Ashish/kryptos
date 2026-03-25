import pandas as pd
from sklearn.cluster import KMeans

print("Loading data...")

df = pd.read_csv("../data/wallet_features_labeled.csv")
emb = pd.read_csv("../data/wallet_embeddings.csv")

print("Features:", df.shape)
print("Embeddings:", emb.shape)

print("Merging embeddings...")
df = df.merge(emb, on="address", how="inner")
print("After merge:", df.shape)

print("Preparing embeddings...")
embedding_cols = [col for col in df.columns if col.startswith("emb_")]
X_emb = df[embedding_cols].values

print("Running KMeans...")
kmeans = KMeans(n_clusters=20, random_state=42, n_init=10)
df["cluster_id"] = kmeans.fit_predict(X_emb)

print("Creating cluster features...")
cluster_size = df.groupby("cluster_id").size()
df["cluster_size"] = df["cluster_id"].map(cluster_size).astype(float)

output_path = "../data/wallet_features_with_clusters.csv"
df.to_csv(output_path, index=False)

print("\nDONE")
print("Final shape:", df.shape)
print("Saved to:", output_path)

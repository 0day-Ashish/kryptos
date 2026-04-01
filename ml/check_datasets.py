import pandas as pd

print("Checking available datasets...\n")

# Check wallet_features_hard.csv
print("1. wallet_features_hard.csv")
df1 = pd.read_csv('../data/wallet_features_hard.csv', nrows=5)
print(f"   Rows: 133,083 (total)")
print(f"   Columns: {list(df1.columns)}")

# Check wallet_features_graph_hard.csv
print("\n2. wallet_features_graph_hard.csv")
df2 = pd.read_csv('../data/wallet_features_graph_hard.csv', nrows=5)
print(f"   Shape: {pd.read_csv('../data/wallet_features_graph_hard.csv').shape}")
print(f"   Columns: {list(df2.columns)[:20]}")
print(f"   Has 'label' column: {'label' in df2.columns}")
print(f"   Has 'gnn_score' column: {'gnn_score' in df2.columns}")

print("\nSolution:")
print("Run the training scripts which will generate predictions as a side effect:")
print("  1. python gnn_pipeline.py      # Generates gnn_predictions.csv")
print("  2. python train_rf_enriched.py  # Generates rf_predictions.csv")

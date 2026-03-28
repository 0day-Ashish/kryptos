import pandas as pd

print("Loading predictions...")

rf = pd.read_csv("../data/rf_predictions.csv")
gnn = pd.read_csv("../data/gnn_predictions.csv")

# Merge
df = rf.merge(gnn, on="address", how="inner")

print("Merged shape:", df.shape)

# =========================
# COMBINE SCORES
# =========================

def min_max_normalize(series: pd.Series) -> pd.Series:
    min_val = series.min()
    max_val = series.max()
    if max_val == min_val:
        return pd.Series(0.0, index=series.index)
    return (series - min_val) / (max_val - min_val)


df["rf_score_norm"] = min_max_normalize(df["rf_score"])
df["gnn_score_norm"] = min_max_normalize(df["gnn_score"])
df["final_score"] = 0.5 * df["rf_score_norm"] + 0.5 * df["gnn_score_norm"]

# Final classification
df["final_label"] = (df["final_score"] > 0.5).astype(int)

# Risk levels (for demo 🔥)
def risk_level(x):
    if x >= 0.7:
        return "HIGH"
    elif x >= 0.4:
        return "MEDIUM"
    else:
        return "LOW"

df["risk_level"] = df["final_score"].apply(risk_level)

print(df.head())
print("\nRisk level distribution:")
print(df["risk_level"].value_counts())
print("\nFinal score summary:")
print(f"min={df['final_score'].min():.4f}, max={df['final_score'].max():.4f}, mean={df['final_score'].mean():.4f}")

# =========================
# SAVE FINAL OUTPUT
# =========================
df.to_csv("../data/final_predictions.csv", index=False)

print("✅ Final predictions saved!")

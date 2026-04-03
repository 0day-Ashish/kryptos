import json
import os
from pathlib import Path

import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).parent))
from contract_risk import (
    compute_wallet_contract_risk_from_txs,
    generate_risk_reasons,
)

print("=" * 70)
print("KRYPTOS - ENHANCED SCORING PIPELINE (RF + GNN + Contract Risk)")
print("=" * 70)

# =========================
# LOAD PREDICTIONS
# =========================

print("\n Loading predictions...")

rf = pd.read_csv("../data/rf_predictions.csv")
gnn = pd.read_csv("../data/gnn_predictions.csv")

print(f"  RF predictions: {len(rf)} wallets")
print(f"  GNN predictions: {len(gnn)} wallets")

df = rf.merge(gnn, on="address", how="inner")
df["address_norm"] = df["address"].astype(str).str.lower().str.strip()

total = df.shape[0]
print(f"  Merged dataset: {total} wallets")

# =========================
# COMPUTE CONTRACT RISK
# =========================

print("\n Computing contract risk scores...")

tx_data_path = "../data/wallet_transactions.json"

cache_path = "../data/contract_risk_cache.json"
if os.path.exists(cache_path):
    os.remove(cache_path)
    print(f"  Cleared stale cache: {cache_path}")

wallet_tx_normed: dict = {}
if os.path.exists(tx_data_path):
    with open(tx_data_path, "r") as f:
        wallet_transactions = json.load(f)
    wallet_tx_normed = {
        str(k).lower().strip(): v for k, v in wallet_transactions.items()
    }
    print(f"  Loaded transactions for {len(wallet_tx_normed)} wallets")
else:
    print(f"  Transaction data not found: {tx_data_path} (using fallback for all)")

contract_risks: list[float] = []
per_wallet_reasons: list[list[str]] = []
wallets_with_txs = 0
wallets_fallback = 0
debug_samples: list[dict] = []

for i in range(total):
    addr = df.at[i, "address_norm"]
    rf_val = float(df.at[i, "rf_score"])
    gnn_val = float(df.at[i, "gnn_score"])
    txs = wallet_tx_normed.get(addr, [])

    if txs:
        wallets_with_txs += 1
        result = compute_wallet_contract_risk_from_txs(txs, debug=True)
        cr = float(result["contract_risk"])
        reasons = result.get("reasons", [])
        source = "tx"
    else:
        # Fallback: never hard-zero — derive from behavioural scores
        wallets_fallback += 1
        cr = round(min(0.5, 0.3 * rf_val + 0.2 * gnn_val), 4)
        reasons = (
            ["Estimated from behavioral risk profile"]
            if cr > 0.01
            else ["Low behavioral risk"]
        )
        source = "fallback"

    contract_risks.append(cr)
    per_wallet_reasons.append(reasons)

    if len(debug_samples) < 12 and (cr > 0.01 or source == "tx"):
        debug_samples.append(
            dict(addr=addr[:22], rf=rf_val, gnn=gnn_val, cr=cr, source=source)
        )

df["contract_risk"] = contract_risks

print(f"\n  Wallets scored from transactions: {wallets_with_txs}")
print(f"  Wallets scored from fallback:     {wallets_fallback}")

print(f"\n  DEBUG: Sample wallet contract_risk values:")
for s in debug_samples[:10]:
    print(
        f"    {s['addr']}...  rf={s['rf']:.4f}  gnn={s['gnn']:.4f}  "
        f"contract_risk={s['cr']:.4f}  [{s['source']}]"
    )

print(f"\n  Contract Risk Stats:")
print(
    f"    min={df['contract_risk'].min():.4f}  "
    f"max={df['contract_risk'].max():.4f}  "
    f"mean={df['contract_risk'].mean():.4f}  "
    f"median={df['contract_risk'].median():.4f}"
)
n_zero = int((df["contract_risk"] < 0.01).sum())
n_mid = int(((df["contract_risk"] >= 0.01) & (df["contract_risk"] < 0.5)).sum())
n_high = int((df["contract_risk"] >= 0.5).sum())
n_max = int((df["contract_risk"] == 1.0).sum())
print(
    f"    ~0: {n_zero} ({n_zero/total*100:.1f}%)  "
    f"0.01-0.49: {n_mid} ({n_mid/total*100:.1f}%)  "
    f">=0.5: {n_high} ({n_high/total*100:.1f}%)  "
    f"=1.0: {n_max} ({n_max/total*100:.1f}%)"
)

# =========================
# NORMALIZE RF & GNN
# =========================


def min_max_normalize(series: pd.Series) -> pd.Series:
    mn, mx = series.min(), series.max()
    if mx == mn:
        return pd.Series(0.0, index=series.index)
    return (series - mn) / (mx - mn)


print("\n Normalizing RF and GNN scores...")
df["rf_score_norm"] = min_max_normalize(df["rf_score"])
df["gnn_score_norm"] = min_max_normalize(df["gnn_score"])

# =========================
# COMBINE SCORES — dynamic weighting
# =========================

print("\n Computing final scores (dynamic weighting)...")
print("  IF contract_risk >= 0.5: 0.35*rf + 0.35*gnn + 0.30*contract_risk")
print("  ELSE:                    0.40*rf + 0.40*gnn + 0.20*contract_risk")


def _final_score(rf_n: float, gnn_n: float, cr: float) -> float:
    if cr >= 0.5:
        return 0.35 * rf_n + 0.35 * gnn_n + 0.30 * cr
    return 0.40 * rf_n + 0.40 * gnn_n + 0.20 * cr


df["final_score"] = [
    round(_final_score(r, g, c), 6)
    for r, g, c in zip(
        df["rf_score_norm"], df["gnn_score_norm"], df["contract_risk"]
    )
]

n_boosted = int((df["contract_risk"] >= 0.5).sum())
print(f"  Standard weighting: {total - n_boosted} wallets")
print(f"  Boosted  weighting: {n_boosted} wallets")

# =========================
# CLASSIFICATION
# =========================

df["final_label"] = (df["final_score"] > 0.5).astype(int)


def _risk_level(score: float) -> str:
    if score >= 0.7:
        return "HIGH"
    elif score >= 0.4:
        return "MEDIUM"
    return "LOW"


df["risk_level"] = df["final_score"].apply(_risk_level)

# Rule-based override: contract_risk == 1 forces HIGH
override_mask = df["contract_risk"] == 1.0
n_override = int(override_mask.sum())
df.loc[override_mask, "risk_level"] = "HIGH"
df.loc[override_mask, "final_label"] = 1
print(f"\n  Rule override: {n_override} wallets forced to HIGH (contract_risk=1.0)")

# =========================
# GENERATE EXPLAINABILITY
# =========================

print("\n Generating risk reasons...")


def _build_reasons(row_idx: int, row) -> str:
    cr = row["contract_risk"]
    fs = row["final_score"]

    cr_weight = 0.30 if cr >= 0.5 else 0.20
    contribution_pct = (cr_weight * cr / fs * 100.0) if fs > 0 and cr > 0 else None

    reasons = generate_risk_reasons(
        rf_score=row["rf_score_norm"],
        gnn_score=row["gnn_score_norm"],
        contract_risk_score=cr,
        contract_reasons=per_wallet_reasons[row_idx] if row_idx < len(per_wallet_reasons) else [],
        contract_contribution_pct=contribution_pct,
    )
    return "; ".join(reasons)


df["risk_reasons"] = [
    _build_reasons(i, df.iloc[i]) for i in range(total)
]

print("  Risk reasons generated")

# =========================
# DEBUG: per-wallet final log
# =========================

print("\n DEBUG: Final per-wallet scores (first 15):")
print(f"  {'address':<24} {'rf':>8} {'gnn':>8} {'c_risk':>8} {'final':>8} {'level':<8}")
print("  " + "-" * 70)
for i in range(min(15, total)):
    row = df.iloc[i]
    print(
        f"  {str(row['address'])[:22]:<24} "
        f"{row['rf_score_norm']:8.4f} {row['gnn_score_norm']:8.4f} "
        f"{row['contract_risk']:8.4f} {row['final_score']:8.4f} "
        f"{row['risk_level']:<8}"
    )

# =========================
# DISPLAY RESULTS
# =========================

print("\n" + "=" * 70)
print("FINAL PREDICTIONS SUMMARY")
print("=" * 70)

print("\nRisk Level Distribution:")
print(df["risk_level"].value_counts().to_string())

print(f"\nScore Statistics:")
print(
    f"  RF (norm):       min={df['rf_score_norm'].min():.4f}, "
    f"max={df['rf_score_norm'].max():.4f}, mean={df['rf_score_norm'].mean():.4f}"
)
print(
    f"  GNN (norm):      min={df['gnn_score_norm'].min():.4f}, "
    f"max={df['gnn_score_norm'].max():.4f}, mean={df['gnn_score_norm'].mean():.4f}"
)
print(
    f"  Contract Risk:   min={df['contract_risk'].min():.4f}, "
    f"max={df['contract_risk'].max():.4f}, mean={df['contract_risk'].mean():.4f}"
)
print(
    f"  Final Score:     min={df['final_score'].min():.4f}, "
    f"max={df['final_score'].max():.4f}, mean={df['final_score'].mean():.4f}"
)

# =========================
# SAVE FINAL OUTPUT
# =========================

output_columns = [
    "address",
    "rf_score",
    "gnn_score",
    "contract_risk",
    "rf_score_norm",
    "gnn_score_norm",
    "final_score",
    "final_label",
    "risk_level",
    "risk_reasons",
]

output_path = "../data/final_predictions.csv"
df[output_columns].to_csv(output_path, index=False)

print("\n" + "=" * 70)
print(f"  Final predictions saved: {output_path}")
print(f"  Total wallets: {total}")
print(f"  Columns: {output_columns}")
print("=" * 70)
print("\n Pipeline complete!")

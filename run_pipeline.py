"""
run_pipeline.py — Full Kryptos Hybrid ML Training Pipeline.

Runs Stage 1 (Isolation Forest) → Stage 2 (Random Forest) end-to-end,
then validates with a quick inference test.

Usage:
    python run_pipeline.py                  # train with real CSV data in data/
    python run_pipeline.py --synthetic      # generate synthetic CSVs first, then train
"""

import os
import sys
import argparse
import logging
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))

from ml.features import FEATURE_COLUMNS, LABEL_COLUMN
from ml.train_iforest import (
    load_unlabeled_data,
    train_isolation_forest,
    save_iforest,
)
from ml.train_rf import (
    load_labeled_data,
    train_random_forest,
    save_rf,
)
from ml.predict import WalletRiskPredictor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


# ══════════════════════════════════════════════════════════════════════════════
# Synthetic CSV generator (for testing without real data)
# ══════════════════════════════════════════════════════════════════════════════

def generate_synthetic_csvs(
    n_unlabeled: int = 100_000,
    n_scam: int = 50_000,
    n_healthy: int = 50_000,
):
    """
    Generate synthetic CSV files in data/ for pipeline testing.

    The synthetic distributions approximate real-world patterns:
        - Normal wallets: low fan_out, balanced in/out, long age, slow frequency
        - Scam wallets:   high fan_out, pass-through ≈ 1, young, burst activity
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    np.random.seed(42)

    def _normal_wallet(n):
        return pd.DataFrame({
            "fan_out":                    np.random.poisson(8, n),
            "fan_in":                     np.random.poisson(10, n),
            "total_in":                   np.random.exponential(5.0, n),
            "total_out":                  np.random.exponential(4.5, n),
            "pass_through_ratio":         np.random.uniform(0.3, 0.8, n),
            "avg_tx_gap":                 np.random.exponential(86400, n),
            "tx_frequency":               np.random.exponential(1.5, n),
            "cluster_internal_ratio":     np.random.uniform(0.2, 0.7, n),
            "wallet_age_days":            np.random.exponential(365, n).clip(1),
            "max_single_tx_value":        np.random.exponential(2.0, n),
            "std_tx_value":               np.random.exponential(0.5, n),
            "unique_token_types":         np.random.poisson(3, n),
            "contract_interaction_ratio": np.random.uniform(0.1, 0.6, n),
            "avg_tx_value":               np.random.exponential(0.5, n),
            "dormancy_max_days":          np.random.exponential(14, n),
            "rapid_burst_count":          np.random.poisson(1, n),
        })

    def _scam_wallet(n):
        return pd.DataFrame({
            "fan_out":                    np.random.poisson(120, n),
            "fan_in":                     np.random.poisson(2, n),
            "total_in":                   np.random.exponential(100.0, n),
            "total_out":                  np.random.exponential(99.0, n),
            "pass_through_ratio":         np.random.uniform(0.9, 1.0, n),
            "avg_tx_gap":                 np.random.exponential(120, n),
            "tx_frequency":               np.random.exponential(80, n),
            "cluster_internal_ratio":     np.random.uniform(0.0, 0.1, n),
            "wallet_age_days":            np.random.exponential(15, n).clip(1),
            "max_single_tx_value":        np.random.exponential(50.0, n),
            "std_tx_value":               np.random.exponential(30.0, n),
            "unique_token_types":         np.random.poisson(1, n),
            "contract_interaction_ratio": np.random.uniform(0.0, 0.1, n),
            "avg_tx_value":               np.random.exponential(5.0, n),
            "dormancy_max_days":          np.random.exponential(1, n),
            "rapid_burst_count":          np.random.poisson(25, n),
        })

    # ── Unlabeled: mostly normal + ~5% injected anomalies ──
    n_anomalous = int(n_unlabeled * 0.05)
    n_clean = n_unlabeled - n_anomalous
    unlabeled = pd.concat([
        _normal_wallet(n_clean),
        _scam_wallet(n_anomalous),
    ], ignore_index=True).sample(frac=1, random_state=42).reset_index(drop=True)

    # ── Labeled ──
    scam = _scam_wallet(n_scam)
    scam[LABEL_COLUMN] = 1

    healthy = _normal_wallet(n_healthy)
    healthy[LABEL_COLUMN] = 0

    # ── Save ──
    unlabeled_path = os.path.join(DATA_DIR, "unlabeled_wallets.csv")
    scam_path = os.path.join(DATA_DIR, "scam_wallets.csv")
    healthy_path = os.path.join(DATA_DIR, "healthy_wallets.csv")

    unlabeled.to_csv(unlabeled_path, index=False)
    scam.to_csv(scam_path, index=False)
    healthy.to_csv(healthy_path, index=False)

    logger.info("Synthetic CSVs generated:")
    logger.info(f"  {unlabeled_path}  ({len(unlabeled):,} rows)")
    logger.info(f"  {scam_path}  ({len(scam):,} rows)")
    logger.info(f"  {healthy_path}  ({len(healthy):,} rows)")


# ══════════════════════════════════════════════════════════════════════════════
# Main pipeline
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Kryptos Hybrid ML Pipeline")
    parser.add_argument(
        "--synthetic", action="store_true",
        help="Generate synthetic CSV data before training (for testing)",
    )
    args = parser.parse_args()

    print()
    print("=" * 62)
    print("  KRYPTOS — Hybrid ML Training Pipeline")
    print("  Stage 1: Isolation Forest (unsupervised)")
    print("  Stage 2: Random Forest   (supervised)")
    print("=" * 62)
    print()

    # ── Generate synthetic data if requested ──
    if args.synthetic:
        logger.info("Generating synthetic data for testing...\n")
        generate_synthetic_csvs()
        print()

    # ==================================================================
    # STAGE 1: Isolation Forest
    # ==================================================================
    unlabeled_df = load_unlabeled_data()
    iforest, scaler, scored_df = train_isolation_forest(unlabeled_df)
    save_iforest(iforest, scaler)
    print()

    # ==================================================================
    # STAGE 2: Random Forest
    # ==================================================================
    labeled_df = load_labeled_data()
    rf_model, metrics = train_random_forest(labeled_df, iforest, scaler)
    save_rf(rf_model)
    print()

    # ==================================================================
    # Summary
    # ==================================================================
    print("=" * 62)
    print("  TRAINING COMPLETE")
    print("-" * 62)
    print(f"  Accuracy  : {metrics['accuracy']}")
    print(f"  Precision : {metrics['precision']}")
    print(f"  Recall    : {metrics['recall']}")
    print(f"  ROC-AUC   : {metrics['roc_auc']}")
    print("-" * 62)
    print("  Models saved:")
    print("    models/isolation_forest.pkl")
    print("    models/iforest_scaler.pkl")
    print("    models/random_forest.pkl")
    print("=" * 62)
    print()

    # ==================================================================
    # Quick inference test
    # ==================================================================
    print("  Quick Inference Test")
    print("  " + "-" * 40)

    predictor = WalletRiskPredictor()
    predictor.load_models()

    suspicious = {
        "fan_out": 200, "fan_in": 1,
        "total_in": 500.0, "total_out": 499.0,
        "pass_through_ratio": 0.998,
        "avg_tx_gap": 30.0, "tx_frequency": 150.0,
        "cluster_internal_ratio": 0.02,
        "wallet_age_days": 5,
        "max_single_tx_value": 100.0,
        "std_tx_value": 40.0,
        "unique_token_types": 1,
        "contract_interaction_ratio": 0.01,
        "avg_tx_value": 2.5,
        "dormancy_max_days": 0.2,
        "rapid_burst_count": 60,
    }

    normal = {
        "fan_out": 5, "fan_in": 12,
        "total_in": 3.5, "total_out": 2.8,
        "pass_through_ratio": 0.45,
        "avg_tx_gap": 172800.0, "tx_frequency": 0.5,
        "cluster_internal_ratio": 0.4,
        "wallet_age_days": 730,
        "max_single_tx_value": 1.2,
        "std_tx_value": 0.3,
        "unique_token_types": 4,
        "contract_interaction_ratio": 0.35,
        "avg_tx_value": 0.3,
        "dormancy_max_days": 21,
        "rapid_burst_count": 0,
    }

    r1 = predictor.predict_wallet_risk(suspicious)
    r2 = predictor.predict_wallet_risk(normal)

    print(f"  Suspicious wallet → Risk: {r1['risk_score']}/100  "
          f"| anomaly_flag={'YES' if r1['anomaly_flag'] else 'NO'}  "
          f"| scam_prob={r1['scam_probability']:.4f}")
    print(f"  Normal wallet     → Risk: {r2['risk_score']}/100  "
          f"| anomaly_flag={'YES' if r2['anomaly_flag'] else 'NO'}  "
          f"| scam_prob={r2['scam_probability']:.4f}")
    print()


if __name__ == "__main__":
    main()

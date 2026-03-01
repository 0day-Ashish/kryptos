"""
predict.py — Inference module for the Kryptos hybrid pipeline.

Loads both trained models (Isolation Forest + Random Forest) and
predicts scam risk for any wallet given its feature vector.

Usage:
    # As a module
    from ml.predict import predict_wallet_risk
    result = predict_wallet_risk({"fan_out": 120, "fan_in": 3, ...})

    # CLI test
    python -m ml.predict
"""

import os
import sys
import logging
import numpy as np
import pandas as pd
import joblib

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.features import FEATURE_COLUMNS, ANOMALY_COLUMNS, ANOMALY_THRESHOLD

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
MODEL_DIR = os.path.join(BASE_DIR, "models")

IFOREST_MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest.pkl")
IFOREST_SCALER_PATH = os.path.join(MODEL_DIR, "iforest_scaler.pkl")
RF_MODEL_PATH = os.path.join(MODEL_DIR, "random_forest.pkl")


# ══════════════════════════════════════════════════════════════════════════════
# Predictor class
# ══════════════════════════════════════════════════════════════════════════════

class WalletRiskPredictor:
    """
    Production predictor running both stages:
        Stage 1: Isolation Forest  → anomaly_score + anomaly_flag
        Stage 2: Random Forest     → scam_probability + risk_score
    """

    def __init__(self):
        self._iforest = None
        self._scaler = None
        self._rf = None
        self._loaded = False

    def load_models(
        self,
        iforest_path: str = IFOREST_MODEL_PATH,
        scaler_path: str = IFOREST_SCALER_PATH,
        rf_path: str = RF_MODEL_PATH,
    ):
        """Load all persisted models from disk."""
        self._iforest = joblib.load(iforest_path)
        self._scaler = joblib.load(scaler_path)
        self._rf = joblib.load(rf_path)
        self._loaded = True
        logger.info("All models loaded successfully")

    def _ensure_loaded(self):
        if not self._loaded:
            self.load_models()

    # ──────────────────────────────────────────────────────────────────────
    # Single wallet prediction
    # ──────────────────────────────────────────────────────────────────────

    def predict_wallet_risk(self, wallet_features: dict) -> dict:
        """
        Predict scam risk for a single wallet.

        Parameters
        ----------
        wallet_features : dict
            Keys matching FEATURE_COLUMNS.  Example::

                {
                    "fan_out": 120,
                    "fan_in": 3,
                    "total_in": 450.0,
                    "total_out": 448.5,
                    ...
                }

        Returns
        -------
        dict
            {
                "anomaly_score": float,
                "anomaly_flag": 0 or 1,
                "scam_probability": float (0–1),
                "risk_score": float (0–100),
            }
        """
        self._ensure_loaded()

        # Build single-row DataFrame from input dict
        row = {col: wallet_features.get(col, 0) for col in FEATURE_COLUMNS}
        df = pd.DataFrame([row])
        df = df.replace([np.inf, -np.inf], np.nan).fillna(0)

        # ── Stage 1: Isolation Forest ──
        X_scaled = self._scaler.transform(df[FEATURE_COLUMNS])
        anomaly_score = float(self._iforest.decision_function(X_scaled)[0])
        anomaly_flag = int(anomaly_score < ANOMALY_THRESHOLD)

        # ── Stage 2: Random Forest ──
        df["anomaly_score"] = anomaly_score
        df["anomaly_flag"] = anomaly_flag

        rf_features = FEATURE_COLUMNS + ANOMALY_COLUMNS
        X_rf = df[rf_features]

        scam_probability = float(self._rf.predict_proba(X_rf)[0][1])
        risk_score = round(scam_probability * 100, 2)

        return {
            "anomaly_score": round(anomaly_score, 6),
            "anomaly_flag": anomaly_flag,
            "scam_probability": round(scam_probability, 6),
            "risk_score": risk_score,
        }

    # ──────────────────────────────────────────────────────────────────────
    # Batch prediction
    # ──────────────────────────────────────────────────────────────────────

    def predict_batch(self, wallets_df: pd.DataFrame) -> pd.DataFrame:
        """
        Predict risk for multiple wallets at once.

        Parameters
        ----------
        wallets_df : pd.DataFrame
            Must contain FEATURE_COLUMNS.

        Returns
        -------
        pd.DataFrame
            Input + anomaly_score, anomaly_flag, scam_probability, risk_score.
        """
        self._ensure_loaded()

        df = wallets_df.copy()
        X = df[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan).fillna(0)

        # Stage 1
        X_scaled = self._scaler.transform(X)
        df["anomaly_score"] = self._iforest.decision_function(X_scaled)
        df["anomaly_flag"] = (df["anomaly_score"] < ANOMALY_THRESHOLD).astype(int)

        # Stage 2
        rf_features = FEATURE_COLUMNS + ANOMALY_COLUMNS
        X_rf = df[rf_features].replace([np.inf, -np.inf], np.nan).fillna(0)
        df["scam_probability"] = self._rf.predict_proba(X_rf)[:, 1]
        df["risk_score"] = (df["scam_probability"] * 100).round(2)

        return df


# ══════════════════════════════════════════════════════════════════════════════
# Convenience function (stateless, caches models after first call)
# ══════════════════════════════════════════════════════════════════════════════

_predictor_singleton = None


def predict_wallet_risk(wallet_features: dict) -> dict:
    """
    Predict scam risk for a single wallet.

    Models are loaded on first call and cached for subsequent calls.

    Parameters
    ----------
    wallet_features : dict
        Keys matching FEATURE_COLUMNS.

    Returns
    -------
    dict
        {
            "anomaly_score": float,
            "anomaly_flag": 0 or 1,
            "scam_probability": float (0–1),
            "risk_score": float (0–100),
        }
    """
    global _predictor_singleton
    if _predictor_singleton is None:
        _predictor_singleton = WalletRiskPredictor()
        _predictor_singleton.load_models()
    return _predictor_singleton.predict_wallet_risk(wallet_features)


# ══════════════════════════════════════════════════════════════════════════════
# CLI test
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Suspicious wallet — high fan-out, rapid bursts, young, high pass-through
    suspicious = {
        "fan_out": 250,
        "fan_in": 2,
        "total_in": 800.0,
        "total_out": 798.5,
        "pass_through_ratio": 0.998,
        "avg_tx_gap": 45.0,
        "tx_frequency": 120.0,
        "cluster_internal_ratio": 0.05,
        "wallet_age_days": 12,
        "max_single_tx_value": 200.0,
        "std_tx_value": 85.0,
        "unique_token_types": 1,
        "contract_interaction_ratio": 0.02,
        "avg_tx_value": 3.2,
        "dormancy_max_days": 0.5,
        "rapid_burst_count": 45,
    }

    # Normal wallet — low activity, old, diverse
    normal = {
        "fan_out": 5,
        "fan_in": 12,
        "total_in": 3.5,
        "total_out": 2.8,
        "pass_through_ratio": 0.45,
        "avg_tx_gap": 172800.0,
        "tx_frequency": 0.5,
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

    print()
    print("=" * 55)
    print("  KRYPTOS — Wallet Risk Prediction")
    print("=" * 55)

    r1 = predict_wallet_risk(suspicious)
    r2 = predict_wallet_risk(normal)

    print()
    print("  Suspicious wallet:")
    print(f"    Anomaly Score   : {r1['anomaly_score']}")
    print(f"    Anomaly Flag    : {'YES' if r1['anomaly_flag'] else 'NO'}")
    print(f"    Scam Probability: {r1['scam_probability']:.4f}")
    print(f"    Risk Score      : {r1['risk_score']}/100")

    print()
    print("  Normal wallet:")
    print(f"    Anomaly Score   : {r2['anomaly_score']}")
    print(f"    Anomaly Flag    : {'YES' if r2['anomaly_flag'] else 'NO'}")
    print(f"    Scam Probability: {r2['scam_probability']:.4f}")
    print(f"    Risk Score      : {r2['risk_score']}/100")

    print()
    print("=" * 55)

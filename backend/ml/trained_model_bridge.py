"""
trained_model_bridge.py — Bridge between Etherscan-extracted features and
the pre-trained Isolation Forest + Random Forest models.

The trained models (models/*.pkl) were trained on BigQuery-exported data
with 13 pipeline-standard features.  The backend's real-time feature
extractor (backend/ml/features.py) produces 32+ Etherscan-style features.

This module:
    1. Maps backend features → trained-model features.
    2. Loads the pre-trained IF + RF models (once, cached).
    3. Runs 2-stage inference and returns the trained-model risk score.
"""

import os
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Paths to pre-trained model artifacts
# ──────────────────────────────────────────────────────────────────────────────
_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..")
_MODEL_DIR = os.path.join(_BASE_DIR, "models")

IFOREST_MODEL_PATH = os.path.join(_MODEL_DIR, "isolation_forest.pkl")
IFOREST_SCALER_PATH = os.path.join(_MODEL_DIR, "iforest_scaler.pkl")
RF_MODEL_PATH = os.path.join(_MODEL_DIR, "random_forest.pkl")

# The 13 features the trained models expect, in order
TRAINED_FEATURE_COLUMNS = [
    "fan_out",
    "fan_in",
    "total_out",
    "total_in",
    "total_volume",
    "out_tx_count",
    "in_tx_count",
    "total_tx_count",
    "lifetime_seconds",
    "tx_frequency",
    "counterparty_ratio",
    "out_in_volume_ratio",
    "pass_through_ratio",
]

TRAINED_ANOMALY_COLUMNS = [
    "anomaly_score",
    "anomaly_flag",
]

# Anomaly threshold (same as used during training)
ANOMALY_THRESHOLD = 0.0


# ══════════════════════════════════════════════════════════════════════════════
# Feature mapping: Etherscan-extracted → trained-model features
# ══════════════════════════════════════════════════════════════════════════════

def map_features(backend_features: dict) -> dict:
    """
    Convert a backend feature dict (from extract_wallet_features) to the
    13-feature dict expected by the pre-trained models.

    Parameters
    ----------
    backend_features : dict
        Output of backend.ml.features.extract_wallet_features().

    Returns
    -------
    dict
        Keys matching TRAINED_FEATURE_COLUMNS.
    """
    total_out = backend_features.get("total_sent_eth", 0.0)
    total_in = backend_features.get("total_recv_eth", 0.0)
    total_volume = total_out + total_in
    tx_count = backend_features.get("tx_count", 0)
    lifetime_days = backend_features.get("lifespan_days", 0)
    lifetime_seconds = lifetime_days * 86400.0

    # tx_frequency: transactions per second
    tx_frequency = (tx_count / lifetime_seconds) if lifetime_seconds > 0 else 0.0

    # counterparty_ratio: unique counterparties / total tx count
    unique_counterparties = backend_features.get("unique_counterparties", 0)
    counterparty_ratio = (
        unique_counterparties / tx_count if tx_count > 0 else 0.0
    )

    # out_in_volume_ratio: total_out / total_in (capped same as flow_ratio)
    out_in_volume_ratio = (
        total_out / total_in if total_in > 0 else min(total_out, 100.0)
    )

    # pass_through_ratio: min(in, out) / max(in, out)
    max_vol = max(total_in, total_out)
    pass_through_ratio = (
        min(total_in, total_out) / max_vol if max_vol > 0 else 0.0
    )

    return {
        "fan_out": backend_features.get("unique_targets", 0),
        "fan_in": backend_features.get("unique_sources", 0),
        "total_out": total_out,
        "total_in": total_in,
        "total_volume": total_volume,
        "out_tx_count": backend_features.get("sent_count", 0),
        "in_tx_count": backend_features.get("recv_count", 0),
        "total_tx_count": tx_count,
        "lifetime_seconds": lifetime_seconds,
        "tx_frequency": tx_frequency,
        "counterparty_ratio": counterparty_ratio,
        "out_in_volume_ratio": out_in_volume_ratio,
        "pass_through_ratio": pass_through_ratio,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Pre-trained model predictor (singleton, lazy-loaded)
# ══════════════════════════════════════════════════════════════════════════════

class TrainedModelPredictor:
    """
    Loads the pre-trained Isolation Forest + Random Forest models and
    runs two-stage inference.

    Stage 1: Isolation Forest  → anomaly_score + anomaly_flag
    Stage 2: Random Forest     → scam_probability + risk_score (0-100)
    """

    def __init__(self):
        self._iforest = None
        self._scaler = None
        self._rf = None
        self._loaded = False
        self._available = False  # True only if model files exist

    @property
    def available(self) -> bool:
        """Check if model files exist on disk (without loading them)."""
        if self._loaded:
            return True
        return (
            os.path.isfile(IFOREST_MODEL_PATH)
            and os.path.isfile(IFOREST_SCALER_PATH)
            and os.path.isfile(RF_MODEL_PATH)
        )

    def load_models(self):
        """Load all pre-trained models from disk. Safe to call multiple times."""
        if self._loaded:
            return

        try:
            import joblib

            self._iforest = joblib.load(IFOREST_MODEL_PATH)
            self._scaler = joblib.load(IFOREST_SCALER_PATH)
            self._rf = joblib.load(RF_MODEL_PATH)
            self._loaded = True
            self._available = True
            logger.info(
                "Pre-trained models loaded: IF(%s), RF(%s)",
                IFOREST_MODEL_PATH,
                RF_MODEL_PATH,
            )
        except Exception as e:
            logger.warning("Could not load pre-trained models: %s", e)
            self._available = False

    def _ensure_loaded(self):
        if not self._loaded:
            self.load_models()
        if not self._loaded:
            raise RuntimeError("Pre-trained models are not available")

    def predict(self, backend_features: dict) -> dict:
        """
        Run 2-stage prediction using a backend feature dict.

        Parameters
        ----------
        backend_features : dict
            Output of extract_wallet_features().

        Returns
        -------
        dict
            {
                "trained_anomaly_score": float,
                "trained_anomaly_flag": 0 | 1,
                "trained_scam_probability": float (0-1),
                "trained_risk_score": float (0-100),
            }
        """
        import pandas as pd

        self._ensure_loaded()

        # Map backend features → trained model features
        mapped = map_features(backend_features)

        # Build single-row DataFrame
        row = {col: mapped.get(col, 0) for col in TRAINED_FEATURE_COLUMNS}
        df = pd.DataFrame([row])
        df = df.replace([np.inf, -np.inf], np.nan).fillna(0)

        # ── Stage 1: Isolation Forest ──
        X_scaled = self._scaler.transform(df[TRAINED_FEATURE_COLUMNS])
        anomaly_score = float(self._iforest.decision_function(X_scaled)[0])
        anomaly_flag = int(anomaly_score < ANOMALY_THRESHOLD)

        # ── Stage 2: Random Forest ──
        df["anomaly_score"] = anomaly_score
        df["anomaly_flag"] = anomaly_flag

        rf_features = TRAINED_FEATURE_COLUMNS + TRAINED_ANOMALY_COLUMNS
        X_rf = df[rf_features]

        scam_probability = float(self._rf.predict_proba(X_rf)[0][1])
        risk_score = round(scam_probability * 100, 2)

        return {
            "trained_anomaly_score": round(anomaly_score, 6),
            "trained_anomaly_flag": anomaly_flag,
            "trained_scam_probability": round(scam_probability, 6),
            "trained_risk_score": risk_score,
        }


# Module-level singleton
trained_predictor = TrainedModelPredictor()

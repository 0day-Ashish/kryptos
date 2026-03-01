"""
train_iforest.py — Stage 1: Isolation Forest (Unsupervised Anomaly Detection)

Trains on unlabeled wallet feature vectors exported from BigQuery.
Handles the raw CSV format (wei volumes, BigQuery column names) and converts
everything to the pipeline-standard FEATURE_COLUMNS before training.

After training, computes anomaly_score via decision_function() and creates
anomaly_flag (1 if anomaly_score < threshold, else 0).

Saves:
    models/isolation_forest.pkl
    models/iforest_scaler.pkl

Usage:
    python -m ml.train_iforest
    python -m ml.train_iforest --data data/wallet_features_1M.csv
"""

import os
import sys
import logging
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# Ensure project root is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.features import (
    FEATURE_COLUMNS, ANOMALY_THRESHOLD,
    RAW_TO_FEATURE_MAP, WEI_COLUMNS, RAW_COLUMNS,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Default paths (relative to project root)
# ──────────────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")

UNLABELED_CSV = os.path.join(DATA_DIR, "wallet_features_1M.csv")
IFOREST_MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest.pkl")
IFOREST_SCALER_PATH = os.path.join(MODEL_DIR, "iforest_scaler.pkl")


# ══════════════════════════════════════════════════════════════════════════════
# Preprocessing: BigQuery CSV → pipeline-standard DataFrame
# ══════════════════════════════════════════════════════════════════════════════

def preprocess_raw_csv(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert a raw BigQuery-exported CSV into pipeline-standard format.

    Steps:
        1. Convert wei columns (total_out_volume, total_in_volume, total_volume)
           to ETH by dividing by 1e18.
        2. Rename columns per RAW_TO_FEATURE_MAP
           (unique_receivers→fan_out, unique_senders→fan_in, etc.)
        3. Fill NaN values (tx_frequency, pass_through_ratio) with 0.
        4. Validate that all FEATURE_COLUMNS are present.

    Parameters
    ----------
    df : pd.DataFrame
        Raw DataFrame as read from the BigQuery CSV.

    Returns
    -------
    pd.DataFrame
        Cleaned DataFrame with FEATURE_COLUMNS ready for training.
    """
    logger.info("  Preprocessing raw BigQuery CSV...")

    # Step 1: Wei → ETH conversion
    for col in WEI_COLUMNS:
        if col in df.columns:
            df[col] = df[col].astype(float) / 1e18
            logger.info(f"    Converted {col} from wei to ETH")

    # Step 2: Rename columns
    df = df.rename(columns=RAW_TO_FEATURE_MAP)
    renamed = [f"{k} → {v}" for k, v in RAW_TO_FEATURE_MAP.items() if k in df.columns or v in df.columns]
    if renamed:
        logger.info(f"    Renamed: {', '.join(renamed)}")

    # Step 3: Fill NaNs
    nan_before = df[FEATURE_COLUMNS].isnull().sum()
    nan_cols = nan_before[nan_before > 0]
    if len(nan_cols) > 0:
        for col_name, count in nan_cols.items():
            logger.info(f"    Filling {count:,} NaNs in '{col_name}' with 0")
    df[FEATURE_COLUMNS] = df[FEATURE_COLUMNS].fillna(0)

    # Step 4: Validate
    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing feature columns after preprocessing: {missing}")

    logger.info(f"    ✓ All {len(FEATURE_COLUMNS)} feature columns present")
    return df


def load_unlabeled_data(csv_path: str = UNLABELED_CSV) -> pd.DataFrame:
    """
    Load unlabeled wallet CSV, auto-detect format (raw BigQuery or
    pre-processed), and return a DataFrame with FEATURE_COLUMNS.

    Parameters
    ----------
    csv_path : str
        Path to the unlabeled wallets CSV file.

    Returns
    -------
    pd.DataFrame
        DataFrame containing at least FEATURE_COLUMNS, cleaned and ready.
    """
    logger.info(f"Loading unlabeled data from {csv_path}")
    df = pd.read_csv(csv_path)
    logger.info(f"  Raw shape: {df.shape[0]:,} rows × {df.shape[1]} columns")

    # Auto-detect: if raw BigQuery columns are present, preprocess
    has_raw_cols = any(col in df.columns for col in RAW_TO_FEATURE_MAP.keys())
    has_wei_cols = any(col in df.columns for col in WEI_COLUMNS)

    if has_raw_cols or has_wei_cols:
        logger.info("  Detected raw BigQuery format — preprocessing...")
        df = preprocess_raw_csv(df)
    else:
        # Already in pipeline format — just validate
        missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
        if missing:
            raise ValueError(f"Missing feature columns in CSV: {missing}")

    logger.info(
        f"  Ready: {len(df):,} wallets  |  "
        f"{len(FEATURE_COLUMNS)} features"
    )
    return df


# ══════════════════════════════════════════════════════════════════════════════
# Training
# ══════════════════════════════════════════════════════════════════════════════

def train_isolation_forest(unlabeled_df: pd.DataFrame) -> tuple:
    """
    Train an Isolation Forest on the unlabeled wallet dataset.

    Steps:
        1. Extract FEATURE_COLUMNS, handle NaN/inf.
        2. StandardScaler normalisation.
        3. Fit IsolationForest (n_estimators=300, contamination='auto').
        4. Compute anomaly_score = decision_function(X).
        5. Create anomaly_flag = 1 where anomaly_score < ANOMALY_THRESHOLD.

    Parameters
    ----------
    unlabeled_df : pd.DataFrame
        DataFrame with at least FEATURE_COLUMNS.

    Returns
    -------
    (iforest_model, scaler, result_df)
        iforest_model : fitted sklearn IsolationForest
        scaler        : fitted StandardScaler
        result_df     : original df + 'anomaly_score' and 'anomaly_flag' columns
    """
    logger.info("=" * 60)
    logger.info("STAGE 1 — Isolation Forest Training")
    logger.info("=" * 60)

    X = unlabeled_df[FEATURE_COLUMNS].copy()
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

    # Scale — important so no single feature dominates distance calculations
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    logger.info(f"  Samples : {X_scaled.shape[0]:,}")
    logger.info(f"  Features: {X_scaled.shape[1]}")

    # Build & fit model
    iforest = IsolationForest(
        n_estimators=300,
        max_samples="auto",
        contamination="auto",
        random_state=42,
        n_jobs=-1,
        verbose=1,
    )
    iforest.fit(X_scaled)

    # Anomaly scoring — lower values = more anomalous
    anomaly_scores = iforest.decision_function(X_scaled)

    # Flag anomalies: score < threshold → anomaly_flag = 1
    anomaly_flags = (anomaly_scores < ANOMALY_THRESHOLD).astype(int)

    # Attach results
    result_df = unlabeled_df.copy()
    result_df["anomaly_score"] = anomaly_scores
    result_df["anomaly_flag"] = anomaly_flags

    n_flagged = int(anomaly_flags.sum())
    logger.info(f"  Threshold       : {ANOMALY_THRESHOLD}")
    logger.info(f"  Score range     : [{anomaly_scores.min():.4f}, {anomaly_scores.max():.4f}]")
    logger.info(f"  Score mean      : {anomaly_scores.mean():.4f}")
    logger.info(
        f"  Flagged wallets : {n_flagged:,} / {len(result_df):,} "
        f"({100 * n_flagged / len(result_df):.2f}%)"
    )

    return iforest, scaler, result_df


# ══════════════════════════════════════════════════════════════════════════════
# Reusable scoring — used by Stage 2 and inference
# ══════════════════════════════════════════════════════════════════════════════

def compute_anomaly_features(
    df: pd.DataFrame,
    iforest_model: IsolationForest,
    scaler: StandardScaler,
) -> pd.DataFrame:
    """
    Enrich a DataFrame with anomaly_score and anomaly_flag using a
    pre-trained Isolation Forest + scaler.

    Used to:
        - Add IF features to labeled data before Random Forest training.
        - Add IF features at inference time.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain FEATURE_COLUMNS.
    iforest_model : fitted IsolationForest
    scaler : fitted StandardScaler

    Returns
    -------
    pd.DataFrame
        Copy of input with 'anomaly_score' and 'anomaly_flag' added.
    """
    X = df[FEATURE_COLUMNS].copy()
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)
    X_scaled = scaler.transform(X)

    scores = iforest_model.decision_function(X_scaled)
    flags = (scores < ANOMALY_THRESHOLD).astype(int)

    result = df.copy()
    result["anomaly_score"] = scores
    result["anomaly_flag"] = flags
    return result


# ══════════════════════════════════════════════════════════════════════════════
# Persistence
# ══════════════════════════════════════════════════════════════════════════════

def save_iforest(
    iforest_model,
    scaler,
    model_path: str = IFOREST_MODEL_PATH,
    scaler_path: str = IFOREST_SCALER_PATH,
):
    """Save Isolation Forest model and scaler to disk."""
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(iforest_model, model_path)
    joblib.dump(scaler, scaler_path)
    logger.info(f"  Model  saved → {model_path}")
    logger.info(f"  Scaler saved → {scaler_path}")


def load_iforest(
    model_path: str = IFOREST_MODEL_PATH,
    scaler_path: str = IFOREST_SCALER_PATH,
):
    """Load Isolation Forest model and scaler from disk."""
    iforest = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    logger.info(f"  Isolation Forest loaded from {model_path}")
    return iforest, scaler


# ══════════════════════════════════════════════════════════════════════════════
# CLI entry point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Stage 1: Train Isolation Forest")
    parser.add_argument(
        "--data", type=str, default=UNLABELED_CSV,
        help="Path to unlabeled wallets CSV (default: data/wallet_features_1M.csv)"
    )
    args = parser.parse_args()

    # Load → Preprocess → Train → Save
    unlabeled_df = load_unlabeled_data(args.data)
    iforest, scaler, result_df = train_isolation_forest(unlabeled_df)
    save_iforest(iforest, scaler)

    # Save scored CSV for inspection (only address + scores to keep file small)
    out_path = os.path.join(DATA_DIR, "unlabeled_wallets_scored.csv")
    if "address" in result_df.columns:
        scored_out = result_df[["address", "anomaly_score", "anomaly_flag"]]
    else:
        scored_out = result_df[["anomaly_score", "anomaly_flag"]]
    scored_out.to_csv(out_path, index=False)
    logger.info(f"  Scored data saved → {out_path}")

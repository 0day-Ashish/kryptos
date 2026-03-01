"""
train_rf.py — Stage 2: Random Forest (Supervised Scam Classification)

Loads 50K scam + 50K healthy labeled wallets, enriches each with
anomaly_score and anomaly_flag from the trained Isolation Forest,
then trains a Random Forest classifier.

IMPORTANT:
    - anomaly_score and anomaly_flag are INPUT FEATURES, not labels.
    - The training target y is the real 'label' column (1 = scam, 0 = healthy).

Saves:
    models/random_forest.pkl

Usage:
    python -m ml.train_rf
    python -m ml.train_rf --scam data/scam_wallets.csv --healthy data/healthy_wallets.csv
"""

import os
import sys
import logging
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    roc_auc_score,
    classification_report,
    confusion_matrix,
)

# Ensure project root is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.features import FEATURE_COLUMNS, ANOMALY_COLUMNS, LABEL_COLUMN
from ml.train_iforest import load_iforest, compute_anomaly_features

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Default paths
# ──────────────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")

SCAM_CSV = os.path.join(DATA_DIR, "scam_wallets.csv")
HEALTHY_CSV = os.path.join(DATA_DIR, "healthy_wallets.csv")
RF_MODEL_PATH = os.path.join(MODEL_DIR, "random_forest.pkl")


# ══════════════════════════════════════════════════════════════════════════════
# Data loading
# ══════════════════════════════════════════════════════════════════════════════

def load_labeled_data(
    scam_csv: str = SCAM_CSV,
    healthy_csv: str = HEALTHY_CSV,
) -> pd.DataFrame:
    """
    Load and combine scam + healthy labeled datasets.

    If the CSV doesn't have a 'label' column, it is created automatically:
        scam_wallets.csv    → label = 1
        healthy_wallets.csv → label = 0

    Parameters
    ----------
    scam_csv : str
        Path to the scam wallets CSV (50K rows).
    healthy_csv : str
        Path to the healthy wallets CSV (50K rows).

    Returns
    -------
    pd.DataFrame
        Combined DataFrame with FEATURE_COLUMNS + LABEL_COLUMN.
    """
    logger.info(f"Loading scam data    → {scam_csv}")
    scam_df = pd.read_csv(scam_csv)

    logger.info(f"Loading healthy data → {healthy_csv}")
    healthy_df = pd.read_csv(healthy_csv)

    # Ensure label column exists
    if LABEL_COLUMN not in scam_df.columns:
        scam_df[LABEL_COLUMN] = 1
    if LABEL_COLUMN not in healthy_df.columns:
        healthy_df[LABEL_COLUMN] = 0

    combined = pd.concat([scam_df, healthy_df], ignore_index=True)

    # Validate feature columns
    missing = [c for c in FEATURE_COLUMNS if c not in combined.columns]
    if missing:
        raise ValueError(f"Missing feature columns in labeled data: {missing}")

    logger.info(
        f"  Combined: {len(combined):,} wallets  |  "
        f"scam={len(scam_df):,}  |  healthy={len(healthy_df):,}"
    )
    return combined


# ══════════════════════════════════════════════════════════════════════════════
# Training
# ══════════════════════════════════════════════════════════════════════════════

def train_random_forest(
    labeled_df: pd.DataFrame,
    iforest_model,
    iforest_scaler,
) -> tuple:
    """
    Train a Random Forest on labeled wallet data enriched with IF features.

    Workflow:
        1. Compute anomaly_score and anomaly_flag for every labeled wallet
           using the pre-trained Isolation Forest.
        2. Build X  = FEATURE_COLUMNS + ['anomaly_score', 'anomaly_flag']
        3. Build y  = labeled_df['label']   (1 = scam, 0 = healthy)
           IMPORTANT: anomaly_flag is an INPUT FEATURE, not the target.
        4. train_test_split(test_size=0.2, stratify=y)
        5. Train RandomForestClassifier.
        6. Evaluate: ROC-AUC, accuracy, precision, recall.

    Parameters
    ----------
    labeled_df : pd.DataFrame
        Must have FEATURE_COLUMNS + LABEL_COLUMN.
    iforest_model : fitted IsolationForest from Stage 1
    iforest_scaler : fitted StandardScaler from Stage 1

    Returns
    -------
    (rf_model, metrics_dict)
    """
    logger.info("=" * 60)
    logger.info("STAGE 2 — Random Forest Training")
    logger.info("=" * 60)

    # ── Step 1: Enrich with anomaly features from Stage 1 ──
    logger.info("  Computing anomaly features from Isolation Forest...")
    enriched_df = compute_anomaly_features(labeled_df, iforest_model, iforest_scaler)

    # ── Step 2: Build X and y ──
    feature_cols = FEATURE_COLUMNS + ANOMALY_COLUMNS
    X = enriched_df[feature_cols].copy()
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

    y = enriched_df[LABEL_COLUMN].astype(int)

    # Sanity check: label must NOT be in the feature set
    assert LABEL_COLUMN not in feature_cols, \
        "BUG: label column must not be in the feature set!"

    logger.info(f"  Feature matrix : {X.shape}")
    logger.info(f"  Features       : {feature_cols}")
    logger.info(f"  Label dist     :\n{y.value_counts().to_string()}")
    logger.info("  ✓ anomaly_flag is an INPUT FEATURE — label is the target")

    # ── Step 3: Train/test split ──
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )
    logger.info(f"  Train: {len(X_train):,}  |  Test: {len(X_test):,}")

    # ── Step 4: Train Random Forest ──
    rf = RandomForestClassifier(
        n_estimators=400,
        max_depth=15,
        min_samples_split=10,
        min_samples_leaf=5,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42,
        verbose=1,
    )
    rf.fit(X_train, y_train)

    # ── Step 5: Evaluate ──
    y_pred = rf.predict(X_test)
    y_proba = rf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    roc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred)

    logger.info("")
    logger.info("=" * 60)
    logger.info("EVALUATION RESULTS")
    logger.info("=" * 60)
    logger.info(f"  Accuracy  : {acc:.4f}")
    logger.info(f"  Precision : {prec:.4f}")
    logger.info(f"  Recall    : {rec:.4f}")
    logger.info(f"  ROC-AUC   : {roc:.4f}")
    logger.info(f"\n  Confusion Matrix:\n{cm}")
    logger.info(f"\n{classification_report(y_test, y_pred)}")

    # Feature importances
    importances = (
        pd.Series(rf.feature_importances_, index=feature_cols)
        .sort_values(ascending=False)
    )
    logger.info(f"  Feature Importances:\n{importances.to_string()}")

    metrics = {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "roc_auc": round(roc, 4),
        "confusion_matrix": cm.tolist(),
        "feature_importances": importances.to_dict(),
    }

    return rf, metrics


# ══════════════════════════════════════════════════════════════════════════════
# Persistence
# ══════════════════════════════════════════════════════════════════════════════

def save_rf(rf_model, model_path: str = RF_MODEL_PATH):
    """Save Random Forest model to disk."""
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(rf_model, model_path)
    logger.info(f"  Random Forest saved → {model_path}")


def load_rf(model_path: str = RF_MODEL_PATH):
    """Load Random Forest model from disk."""
    rf = joblib.load(model_path)
    logger.info(f"  Random Forest loaded from {model_path}")
    return rf


# ══════════════════════════════════════════════════════════════════════════════
# CLI entry point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Stage 2: Train Random Forest")
    parser.add_argument(
        "--scam", type=str, default=SCAM_CSV,
        help="Path to scam_wallets.csv",
    )
    parser.add_argument(
        "--healthy", type=str, default=HEALTHY_CSV,
        help="Path to healthy_wallets.csv",
    )
    args = parser.parse_args()

    # Load Stage 1 model
    iforest, iforest_scaler = load_iforest()

    # Load labeled data
    labeled_df = load_labeled_data(args.scam, args.healthy)

    # Train Stage 2
    rf_model, metrics = train_random_forest(labeled_df, iforest, iforest_scaler)
    save_rf(rf_model)

    print()
    print("=" * 60)
    print("STAGE 2 TRAINING COMPLETE")
    print(f"  Accuracy  : {metrics['accuracy']}")
    print(f"  Precision : {metrics['precision']}")
    print(f"  Recall    : {metrics['recall']}")
    print(f"  ROC-AUC   : {metrics['roc_auc']}")
    print("=" * 60)

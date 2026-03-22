"""
train_rf_enriched.py — Stage 2+: Random Forest with Graph-Enriched Features

Loads the pre-merged dataset (wallet_features_with_clusters.csv) that
contains behavioral features + Node2Vec embeddings + cluster signals,
enriches with Isolation Forest anomaly scores, and trains a Random Forest
on the full 81-feature vector:

    13 base behavioral features
  +  2 Isolation Forest anomaly features (anomaly_score, anomaly_flag)
  + 64 Node2Vec embedding dimensions   (emb_0 … emb_63)
  +  2 cluster features                (cluster_size, cluster_scam_ratio)
  ─────────────────────────────────────
  = 81 total features

Usage:
    python -m ml.train_rf_enriched
    python -m ml.train_rf_enriched --data data/wallet_features_with_clusters.csv
"""

import os
import sys
import logging
import time
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    classification_report,
    confusion_matrix,
)

# Ensure project root is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.features import (
    FEATURE_COLUMNS, ANOMALY_COLUMNS, LABEL_COLUMN,
    RAW_TO_FEATURE_MAP, WEI_COLUMNS,
    EMBEDDING_COLUMNS, CLUSTER_COLUMNS, GRAPH_COLUMNS,
    ALL_FEATURE_COLUMNS,
)
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

ENRICHED_CSV = os.path.join(DATA_DIR, "wallet_features_with_clusters.csv")
RF_MODEL_PATH = os.path.join(MODEL_DIR, "random_forest.pkl")
RF_META_PATH = os.path.join(MODEL_DIR, "random_forest_meta.json")

# Wei detection threshold
WEI_DETECTION_THRESHOLD = 1e12


# ══════════════════════════════════════════════════════════════════════════════
# Data loading & preprocessing
# ══════════════════════════════════════════════════════════════════════════════

def _is_wei(series: pd.Series) -> bool:
    """Return True if a volume column looks like wei (median > threshold)."""
    median = series.dropna().median()
    return median > WEI_DETECTION_THRESHOLD


def load_enriched_data(csv_path: str = ENRICHED_CSV) -> pd.DataFrame:
    """
    Load a labeled dataset for training. Handles both:
        - Enriched datasets (with embeddings + cluster features)
        - Standard datasets (behavioral features only)

    Preprocessing:
        1. Auto-detect and convert wei → ETH for volume columns
        2. Rename raw BigQuery columns → pipeline-standard names
        3. Compute derived columns if missing
        4. Fill NaN / Inf with 0
        5. Validate base feature columns present
    """
    logger.info(f"Loading data from {csv_path}")
    df = pd.read_csv(csv_path)
    logger.info(f"  Raw shape: {df.shape[0]:,} rows × {df.shape[1]} columns")

    # 1. Wei → ETH (auto-detect per column)
    for col in WEI_COLUMNS:
        if col in df.columns and _is_wei(df[col]):
            df[col] = df[col].astype(float) / 1e18
            logger.info(f"    Converted {col} from wei → ETH")

    # 2. Compute derived columns if missing
    if "total_volume" not in df.columns:
        out_col = "total_out_volume" if "total_out_volume" in df.columns else "total_out"
        in_col = "total_in_volume" if "total_in_volume" in df.columns else "total_in"
        if out_col in df.columns and in_col in df.columns:
            df["total_volume"] = df[out_col].fillna(0) + df[in_col].fillna(0)
            logger.info("    Computed total_volume")

    if "tx_frequency" not in df.columns:
        if "lifetime_seconds" in df.columns and "total_tx_count" in df.columns:
            df["tx_frequency"] = np.where(
                df["lifetime_seconds"] > 0,
                df["total_tx_count"] / df["lifetime_seconds"],
                0.0,
            )
            logger.info("    Computed tx_frequency")

    recv_col = "unique_receivers" if "unique_receivers" in df.columns else "fan_out"
    send_col = "unique_senders" if "unique_senders" in df.columns else "fan_in"
    if "counterparty_ratio" not in df.columns:
        if recv_col in df.columns and send_col in df.columns and "total_tx_count" in df.columns:
            df["counterparty_ratio"] = np.where(
                df["total_tx_count"] > 0,
                (df[recv_col] + df[send_col]) / df["total_tx_count"],
                0.0,
            )
            logger.info("    Computed counterparty_ratio")

    # 3. Rename raw → pipeline columns
    df = df.rename(columns=RAW_TO_FEATURE_MAP)

    # 4. Fill NaN / Inf for all feature columns that exist
    all_numeric = FEATURE_COLUMNS + EMBEDDING_COLUMNS + CLUSTER_COLUMNS
    present = [c for c in all_numeric if c in df.columns]
    df[present] = (
        df[present]
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0)
    )

    # 5. Validate base features
    missing_base = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing_base:
        raise ValueError(f"Missing base feature columns: {missing_base}")

    if LABEL_COLUMN not in df.columns:
        raise ValueError(f"Missing label column: {LABEL_COLUMN}")

    # Detect available graph features
    has_embeddings = all(c in df.columns for c in EMBEDDING_COLUMNS)
    has_clusters = all(c in df.columns for c in CLUSTER_COLUMNS)

    n_total = len(df)
    n_scam = (df[LABEL_COLUMN] == 1).sum()
    n_healthy = (df[LABEL_COLUMN] == 0).sum()

    logger.info(
        f"  Ready: {n_total:,} wallets  |  "
        f"scam={n_scam:,} ({100*n_scam/n_total:.1f}%)  "
        f"healthy={n_healthy:,} ({100*n_healthy/n_total:.1f}%)"
    )
    logger.info(f"  Base features : {len(FEATURE_COLUMNS)}")
    logger.info(f"  Embeddings    : {'YES (64)' if has_embeddings else 'NO'}")
    logger.info(f"  Clusters      : {'YES (2)' if has_clusters else 'NO'}")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# Training
# ══════════════════════════════════════════════════════════════════════════════

def train_enriched_random_forest(
    enriched_df: pd.DataFrame,
    iforest_model,
    iforest_scaler,
) -> tuple:
    """
    Train a Random Forest on the available feature set.

    Auto-detects which features are present in the DataFrame:
        - Always uses: FEATURE_COLUMNS + ANOMALY_COLUMNS (15 features)
        - If available: + EMBEDDING_COLUMNS (64 features)
        - If available: + CLUSTER_COLUMNS (2 features)

    Returns
    -------
    (rf_model, metrics_dict)
    """
    logger.info("=" * 70)
    logger.info("STAGE 2+ — Random Forest Training")
    logger.info("=" * 70)

    # ── Step 1: Enrich with anomaly features from Stage 1 ──
    logger.info("  Computing anomaly features from Isolation Forest...")
    enriched_df = compute_anomaly_features(enriched_df, iforest_model, iforest_scaler)

    # ── Step 2: Auto-detect available features ──
    has_embeddings = all(c in enriched_df.columns for c in EMBEDDING_COLUMNS)
    has_clusters = all(c in enriched_df.columns for c in CLUSTER_COLUMNS)

    feature_cols = list(FEATURE_COLUMNS) + list(ANOMALY_COLUMNS)
    if has_embeddings:
        feature_cols += EMBEDDING_COLUMNS
    if has_clusters:
        feature_cols += CLUSTER_COLUMNS

    X = enriched_df[feature_cols].copy()
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

    y = enriched_df[LABEL_COLUMN].astype(int)

    # Sanity checks
    assert LABEL_COLUMN not in feature_cols, \
        "BUG: label column must not be in the feature set!"
    assert "cluster_id" not in feature_cols, \
        "BUG: cluster_id (categorical) should not be in the feature set!"

    logger.info(f"  Feature matrix : {X.shape}")
    logger.info(f"  Total features : {len(feature_cols)}")
    logger.info(f"    Base behavioral : {len(FEATURE_COLUMNS)}")
    logger.info(f"    Anomaly (IF)    : {len(ANOMALY_COLUMNS)}")
    logger.info(f"    Embeddings      : {len(EMBEDDING_COLUMNS) if has_embeddings else 0}")
    logger.info(f"    Cluster         : {len(CLUSTER_COLUMNS) if has_clusters else 0}")
    logger.info(f"  Label distribution:")
    logger.info(f"    {y.value_counts().to_string()}")
    logger.info("  ✓ anomaly_flag is an INPUT FEATURE — label is the target")

    # ── Step 3: Train/test split ──
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )
    logger.info(f"  Train: {len(X_train):,}  |  Test: {len(X_test):,}")
    logger.info(f"  Train scam: {y_train.sum():,}  |  Test scam: {y_test.sum():,}")

    # ── Step 4: Cross-validation ──
    logger.info("")
    logger.info("  Running 5-fold stratified cross-validation...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    rf_cv = RandomForestClassifier(
        n_estimators=400,
        max_depth=18,
        min_samples_split=8,
        min_samples_leaf=4,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42,
    )

    cv_scores = cross_val_score(rf_cv, X_train, y_train, cv=cv, scoring="roc_auc", n_jobs=-1)
    logger.info(f"  CV ROC-AUC scores  : {[f'{s:.4f}' for s in cv_scores]}")
    logger.info(f"  CV ROC-AUC mean    : {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # ── Step 5: Train final model on full training set ──
    logger.info("")
    logger.info("  Training final Random Forest on full training set...")
    start_time = time.time()

    rf = RandomForestClassifier(
        n_estimators=400,
        max_depth=18,
        min_samples_split=8,
        min_samples_leaf=4,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42,
        verbose=1,
    )
    rf.fit(X_train, y_train)

    train_time = time.time() - start_time
    logger.info(f"  Training time: {train_time:.1f}s")

    # ── Step 6: Evaluate on held-out test set ──
    y_pred = rf.predict(X_test)
    y_proba = rf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    roc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred)

    logger.info("")
    logger.info("=" * 70)
    logger.info("EVALUATION RESULTS (Held-out Test Set)")
    logger.info("=" * 70)
    logger.info(f"  Accuracy  : {acc:.4f}")
    logger.info(f"  Precision : {prec:.4f}")
    logger.info(f"  Recall    : {rec:.4f}")
    logger.info(f"  F1 Score  : {f1:.4f}")
    logger.info(f"  ROC-AUC   : {roc:.4f}")
    logger.info(f"\n  Confusion Matrix:")
    logger.info(f"                  Predicted Healthy   Predicted Scam")
    logger.info(f"  True Healthy :   TN = {cm[0][0]:<12,}   FP = {cm[0][1]:,}")
    logger.info(f"  True Scam    :   FN = {cm[1][0]:<12,}   TP = {cm[1][1]:,}")
    logger.info(f"\n{classification_report(y_test, y_pred, target_names=['Healthy', 'Scam'], digits=4)}")

    # Feature importances — show top 20
    importances = (
        pd.Series(rf.feature_importances_, index=feature_cols)
        .sort_values(ascending=False)
    )
    logger.info("  Top 20 Feature Importances:")
    for feat, imp in importances.head(20).items():
        bar = "█" * int(imp * 80)
        logger.info(f"    {feat:<25s} {imp:.4f}  {bar}")

    # Aggregate importance by feature group
    base_imp = importances[[c for c in FEATURE_COLUMNS if c in importances.index]].sum()
    anomaly_imp = importances[[c for c in ANOMALY_COLUMNS if c in importances.index]].sum()
    emb_imp = importances[[c for c in EMBEDDING_COLUMNS if c in importances.index]].sum() if has_embeddings else 0.0
    cluster_imp = importances[[c for c in CLUSTER_COLUMNS if c in importances.index]].sum() if has_clusters else 0.0

    logger.info("")
    logger.info("  Feature Group Importance:")
    logger.info(f"    Base behavioral ({len(FEATURE_COLUMNS)} features)  : {base_imp:.4f}")
    logger.info(f"    Anomaly IF     ({len(ANOMALY_COLUMNS)} features)  : {anomaly_imp:.4f}")
    if has_embeddings:
        logger.info(f"    Embeddings     ({len(EMBEDDING_COLUMNS)} features) : {emb_imp:.4f}")
    if has_clusters:
        logger.info(f"    Cluster        ({len(CLUSTER_COLUMNS)} features)  : {cluster_imp:.4f}")

    group_importances = {
        "base_behavioral": round(float(base_imp), 4),
        "anomaly_if": round(float(anomaly_imp), 4),
    }
    if has_embeddings:
        group_importances["embeddings"] = round(float(emb_imp), 4)
    if has_clusters:
        group_importances["cluster"] = round(float(cluster_imp), 4)

    metrics = {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "roc_auc": round(roc, 4),
        "cv_roc_auc_mean": round(cv_scores.mean(), 4),
        "cv_roc_auc_std": round(cv_scores.std(), 4),
        "confusion_matrix": cm.tolist(),
        "feature_importances": importances.to_dict(),
        "group_importances": group_importances,
        "training_time_seconds": round(train_time, 1),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "n_features": len(feature_cols),
        "has_embeddings": has_embeddings,
        "has_clusters": has_clusters,
    }

    return rf, metrics


# ══════════════════════════════════════════════════════════════════════════════
# Persistence
# ══════════════════════════════════════════════════════════════════════════════

def save_rf(rf_model, metrics: dict, model_path: str = RF_MODEL_PATH, meta_path: str = RF_META_PATH):
    """Save Random Forest model and metadata to disk."""
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(rf_model, model_path)
    logger.info(f"  Random Forest saved → {model_path}")

    has_embeddings = metrics.get("has_embeddings", False)
    has_clusters = metrics.get("has_clusters", False)
    is_enriched = has_embeddings or has_clusters

    # Build the actual feature list that was used
    feature_columns = list(FEATURE_COLUMNS) + list(ANOMALY_COLUMNS)
    emb_features = EMBEDDING_COLUMNS if has_embeddings else []
    clust_features = CLUSTER_COLUMNS if has_clusters else []
    if has_embeddings:
        feature_columns += EMBEDDING_COLUMNS
    if has_clusters:
        feature_columns += CLUSTER_COLUMNS

    # Save metadata so predictor knows which features the model expects
    meta = {
        "model_type": "enriched_random_forest" if is_enriched else "standard_random_forest",
        "n_features": len(feature_columns),
        "feature_columns": feature_columns,
        "base_features": list(FEATURE_COLUMNS),
        "anomaly_features": list(ANOMALY_COLUMNS),
        "embedding_features": emb_features,
        "cluster_features": clust_features,
        "metrics": {k: v for k, v in metrics.items() if k not in ("feature_importances", "has_embeddings", "has_clusters")},
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    logger.info(f"  Metadata saved → {meta_path}")


# ══════════════════════════════════════════════════════════════════════════════
# CLI entry point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Stage 2+: Train Enriched Random Forest (with graph features)"
    )
    parser.add_argument(
        "--data", type=str, default=ENRICHED_CSV,
        help="Path to enriched dataset CSV (default: data/wallet_features_with_clusters.csv)",
    )
    args = parser.parse_args()

    print()
    print("╔" + "═" * 68 + "╗")
    print("║   KRYPTOS — ENRICHED Random Forest Training                       ║")
    print("║   (Behavioral + Graph Embeddings + Cluster Features)              ║")
    print("╚" + "═" * 68 + "╝")
    print()

    # Load Stage 1 model
    iforest, iforest_scaler = load_iforest()

    # Load enriched data
    enriched_df = load_enriched_data(args.data)

    # Train Stage 2+
    rf_model, metrics = train_enriched_random_forest(enriched_df, iforest, iforest_scaler)
    save_rf(rf_model, metrics)

    print()
    print("=" * 70)
    print("  TRAINING COMPLETE")
    print("=" * 70)
    print(f"  Accuracy        : {metrics['accuracy']}")
    print(f"  Precision       : {metrics['precision']}")
    print(f"  Recall          : {metrics['recall']}")
    print(f"  F1 Score        : {metrics['f1']}")
    print(f"  ROC-AUC         : {metrics['roc_auc']}")
    print(f"  CV ROC-AUC      : {metrics['cv_roc_auc_mean']} ± {metrics['cv_roc_auc_std']}")
    print(f"  Training time   : {metrics['training_time_seconds']}s")
    print(f"  Features used   : {metrics['n_features']}")
    print()
    print("  Group Importances:")
    gi = metrics["group_importances"]
    for name, val in gi.items():
        print(f"    {name:<20s}: {val:.4f}")
    print("=" * 70)

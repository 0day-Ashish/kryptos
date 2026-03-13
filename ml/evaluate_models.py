"""
evaluate_models.py — Evaluate accuracy of the trained Kryptos ML models.

Loads the saved Isolation Forest + Random Forest from models/ and runs
them against the labeled scam/healthy wallet datasets with a held-out
test split. Reports:
    - Accuracy, Precision, Recall, F1-Score, ROC-AUC
    - Confusion Matrix
    - Feature Importances
    - Per-threshold sweep to find optimal cutoff

Usage:
    python -m ml.evaluate_models
"""

import os
import sys
import logging
import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, classification_report, confusion_matrix,
    precision_recall_curve, average_precision_score,
)
from sklearn.model_selection import train_test_split

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.features import FEATURE_COLUMNS, ANOMALY_COLUMNS, ANOMALY_THRESHOLD, LABEL_COLUMN
from ml.train_iforest import compute_anomaly_features, load_iforest
from ml.train_rf import load_labeled_data, load_rf

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
MODEL_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(BASE_DIR, "data")

IFOREST_MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest.pkl")
IFOREST_SCALER_PATH = os.path.join(MODEL_DIR, "iforest_scaler.pkl")
RF_MODEL_PATH = os.path.join(MODEL_DIR, "random_forest.pkl")


def load_all_models():
    """Load all saved models from disk."""
    print("=" * 65)
    print("  LOADING SAVED MODELS")
    print("=" * 65)

    iforest, scaler = load_iforest(IFOREST_MODEL_PATH, IFOREST_SCALER_PATH)
    rf = load_rf(RF_MODEL_PATH)

    print(f"  Isolation Forest : {IFOREST_MODEL_PATH}")
    print(f"  Scaler           : {IFOREST_SCALER_PATH}")
    print(f"  Random Forest    : {RF_MODEL_PATH}")
    print(f"  IF estimators    : {iforest.n_estimators}")
    print(f"  RF estimators    : {rf.n_estimators}")
    print(f"  RF max_depth     : {rf.max_depth}")
    print()
    return iforest, scaler, rf


def evaluate_isolation_forest(iforest, scaler, df):
    """
    Evaluate the Isolation Forest on labeled data.
    IF is unsupervised, but we can check how well its anomaly_flag
    correlates with the true scam labels.
    """
    print("=" * 65)
    print("  STAGE 1 — ISOLATION FOREST EVALUATION")
    print("=" * 65)

    enriched = compute_anomaly_features(df, iforest, scaler)
    y_true = enriched[LABEL_COLUMN].astype(int).values
    y_pred_if = enriched["anomaly_flag"].values
    anomaly_scores = enriched["anomaly_score"].values

    # anomaly_flag: 1 = anomalous (potential scam), 0 = normal
    acc = accuracy_score(y_true, y_pred_if)
    prec = precision_score(y_true, y_pred_if, zero_division=0)
    rec = recall_score(y_true, y_pred_if, zero_division=0)
    f1 = f1_score(y_true, y_pred_if, zero_division=0)
    cm = confusion_matrix(y_true, y_pred_if)

    # For AUC, invert anomaly_score (lower = more anomalous = higher risk)
    try:
        auc = roc_auc_score(y_true, -anomaly_scores)
    except ValueError:
        auc = float("nan")

    print(f"\n  Samples     : {len(y_true):,}")
    print(f"  Scam        : {y_true.sum():,}  |  Healthy : {(1 - y_true).sum():,}")
    print(f"  IF flagged  : {y_pred_if.sum():,} as anomalous")
    print()
    print(f"  Accuracy    : {acc:.4f}")
    print(f"  Precision   : {prec:.4f}    (of wallets IF flagged, how many are actually scam?)")
    print(f"  Recall      : {rec:.4f}    (of actual scam wallets, how many did IF flag?)")
    print(f"  F1 Score    : {f1:.4f}")
    print(f"  ROC-AUC     : {auc:.4f}")
    print()
    print(f"  Confusion Matrix (rows=true, cols=predicted):")
    print(f"                  Predicted Normal   Predicted Anomaly")
    print(f"  True Healthy :   TN = {cm[0][0]:<12,}   FP = {cm[0][1]:,}")
    print(f"  True Scam    :   FN = {cm[1][0]:<12,}   TP = {cm[1][1]:,}")
    print()

    # Anomaly score distribution by class
    scam_scores = anomaly_scores[y_true == 1]
    healthy_scores = anomaly_scores[y_true == 0]
    print(f"  Anomaly Score Stats:")
    print(f"    Scam wallets    — mean: {scam_scores.mean():.4f}, median: {np.median(scam_scores):.4f}, std: {scam_scores.std():.4f}")
    print(f"    Healthy wallets — mean: {healthy_scores.mean():.4f}, median: {np.median(healthy_scores):.4f}, std: {healthy_scores.std():.4f}")
    print()

    return {
        "accuracy": acc, "precision": prec, "recall": rec,
        "f1": f1, "roc_auc": auc, "confusion_matrix": cm.tolist(),
    }


def evaluate_random_forest(rf, iforest, scaler, df, test_size=0.2):
    """
    Evaluate the Random Forest on a held-out test split.
    Uses the same preprocessing as training: IF enrichment → RF prediction.
    """
    print("=" * 65)
    print("  STAGE 2 — RANDOM FOREST EVALUATION")
    print("=" * 65)

    # Enrich with anomaly features
    enriched = compute_anomaly_features(df, iforest, scaler)

    feature_cols = FEATURE_COLUMNS + ANOMALY_COLUMNS
    X = enriched[feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0)
    y = enriched[LABEL_COLUMN].astype(int)

    # Stratified train/test split — evaluate on data the model hasn't seen
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y,
    )
    print(f"\n  Total samples : {len(y):,}")
    print(f"  Train split   : {len(y_train):,}")
    print(f"  Test split    : {len(y_test):,}  (evaluation set)")
    print(f"  Test scam     : {y_test.sum():,}  |  Test healthy : {(1 - y_test).sum():,}")

    # Predict on test set only
    y_pred = rf.predict(X_test)
    y_proba = rf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    roc = roc_auc_score(y_test, y_proba)
    ap = average_precision_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred)

    print()
    print(f"  Accuracy          : {acc:.4f}")
    print(f"  Precision         : {prec:.4f}    (of wallets flagged scam, how many are?)")
    print(f"  Recall            : {rec:.4f}    (of actual scams, how many caught?)")
    print(f"  F1 Score          : {f1:.4f}")
    print(f"  ROC-AUC           : {roc:.4f}")
    print(f"  Average Precision : {ap:.4f}")
    print()
    print(f"  Confusion Matrix (rows=true, cols=predicted):")
    print(f"                  Predicted Healthy   Predicted Scam")
    print(f"  True Healthy :   TN = {cm[0][0]:<12,}   FP = {cm[0][1]:,}")
    print(f"  True Scam    :   FN = {cm[1][0]:<12,}   TP = {cm[1][1]:,}")
    print()

    # Classification report
    print("  Full Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["Healthy", "Scam"], digits=4))

    # Feature importances
    importances = pd.Series(rf.feature_importances_, index=feature_cols).sort_values(ascending=False)
    print("  Top Feature Importances:")
    for feat, imp in importances.head(10).items():
        bar = "█" * int(imp * 50)
        print(f"    {feat:<25s} {imp:.4f}  {bar}")
    print()

    return {
        "accuracy": acc, "precision": prec, "recall": rec,
        "f1": f1, "roc_auc": roc, "avg_precision": ap,
        "confusion_matrix": cm.tolist(),
        "feature_importances": importances.to_dict(),
    }


def evaluate_full_pipeline(rf, iforest, scaler, df, test_size=0.2):
    """
    Evaluate the full pipeline (IF → RF) end-to-end using risk_score thresholds.
    """
    print("=" * 65)
    print("  FULL PIPELINE — THRESHOLD SWEEP")
    print("=" * 65)

    enriched = compute_anomaly_features(df, iforest, scaler)
    feature_cols = FEATURE_COLUMNS + ANOMALY_COLUMNS
    X = enriched[feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0)
    y = enriched[LABEL_COLUMN].astype(int)

    _, X_test, _, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y,
    )

    y_proba = rf.predict_proba(X_test)[:, 1]
    risk_scores = y_proba * 100  # convert to 0-100 scale

    print(f"\n  Testing {len(y_test):,} wallets across risk_score thresholds...\n")
    print(f"  {'Threshold':>10}  {'Accuracy':>10}  {'Precision':>10}  {'Recall':>10}  {'F1':>10}")
    print("  " + "-" * 57)

    best_f1 = 0
    best_threshold = 50

    for t in range(10, 95, 5):
        preds = (risk_scores >= t).astype(int)
        a = accuracy_score(y_test, preds)
        p = precision_score(y_test, preds, zero_division=0)
        r = recall_score(y_test, preds, zero_division=0)
        f = f1_score(y_test, preds, zero_division=0)
        marker = " ◄" if f >= best_f1 and f > 0 else ""
        print(f"  {t:>10}  {a:>10.4f}  {p:>10.4f}  {r:>10.4f}  {f:>10.4f}{marker}")
        if f > best_f1:
            best_f1 = f
            best_threshold = t

    print()
    print(f"  ★ Best threshold : {best_threshold}  (F1 = {best_f1:.4f})")
    print()

    # Risk score distribution
    scam_scores = risk_scores[y_test.values == 1]
    healthy_scores = risk_scores[y_test.values == 0]
    print(f"  Risk Score Distribution:")
    print(f"    Scam wallets    — mean: {scam_scores.mean():.1f}, median: {np.median(scam_scores):.1f}, min: {scam_scores.min():.1f}, max: {scam_scores.max():.1f}")
    print(f"    Healthy wallets — mean: {healthy_scores.mean():.1f}, median: {np.median(healthy_scores):.1f}, min: {healthy_scores.min():.1f}, max: {healthy_scores.max():.1f}")
    print()

    return best_threshold, best_f1


def main():
    print()
    print("╔" + "═" * 63 + "╗")
    print("║    KRYPTOS ML MODEL ACCURACY EVALUATION                       ║")
    print("╚" + "═" * 63 + "╝")
    print()

    # 1. Load models
    iforest, scaler, rf = load_all_models()

    # 2. Load labeled data (scam + healthy)
    print("=" * 65)
    print("  LOADING LABELED DATA")
    print("=" * 65)
    labeled_df = load_labeled_data()
    total = len(labeled_df)
    n_scam = (labeled_df[LABEL_COLUMN] == 1).sum()
    n_healthy = (labeled_df[LABEL_COLUMN] == 0).sum()
    print(f"  Total: {total:,}  |  Scam: {n_scam:,} ({100*n_scam/total:.1f}%)  |  Healthy: {n_healthy:,} ({100*n_healthy/total:.1f}%)")
    print()

    # 3. Evaluate Isolation Forest
    if_metrics = evaluate_isolation_forest(iforest, scaler, labeled_df)

    # 4. Evaluate Random Forest
    rf_metrics = evaluate_random_forest(rf, iforest, scaler, labeled_df, test_size=0.2)

    # 5. Full pipeline threshold sweep
    best_threshold, best_f1 = evaluate_full_pipeline(rf, iforest, scaler, labeled_df, test_size=0.2)

    # ── Summary ──
    print("╔" + "═" * 63 + "╗")
    print("║    SUMMARY                                                     ║")
    print("╚" + "═" * 63 + "╝")
    print()
    print(f"  Model                  Accuracy   Precision  Recall     F1         AUC")
    print(f"  " + "-" * 73)
    print(f"  Isolation Forest       {if_metrics['accuracy']:.4f}     {if_metrics['precision']:.4f}     {if_metrics['recall']:.4f}     {if_metrics['f1']:.4f}     {if_metrics['roc_auc']:.4f}")
    print(f"  Random Forest          {rf_metrics['accuracy']:.4f}     {rf_metrics['precision']:.4f}     {rf_metrics['recall']:.4f}     {rf_metrics['f1']:.4f}     {rf_metrics['roc_auc']:.4f}")
    print()
    print(f"  Optimal risk_score threshold: {best_threshold}  (F1 = {best_f1:.4f})")
    print()


if __name__ == "__main__":
    main()

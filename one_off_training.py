"""
One-off training/evaluation script: 13 base features + 2 anomaly features
(No graph embeddings, no cluster features)
"""

import sys
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    roc_auc_score, confusion_matrix
)
import json

# Add project to path
sys.path.insert(0, 'c:/Users/ARYADEEP/Desktop/kryptos')

from ml import train_iforest, features
from ml.train_rf_enriched import load_labeled_data, _split_by_address

def main():
    print("=" * 80)
    print("ONE-OFF TRAINING: 13 Base Features + 2 Anomaly Features")
    print("=" * 80)
    
    # 1. Load data
    print("\n[1] Loading data from data/wallet_features_hard.csv...")
    df = load_labeled_data('data/wallet_features_hard.csv')
    print(f"Loaded {len(df)} rows from data/wallet_features_hard.csv")
    print(f"Shape: {df.shape}")
    print(f"Columns: {df.columns.tolist()}")
    
    # 2. Load Isolation Forest and compute anomaly features
    print("\n[2] Loading Isolation Forest model and computing anomaly features...")
    try:
        iforest, scaler = train_iforest.load_iforest()
        print("Loaded pre-trained Isolation Forest model")
    except FileNotFoundError as e:
        print(f"ERROR: Could not load Isolation Forest model: {e}")
        print("Please train it first with ml.train_iforest.train_isolation_forest()")
        return
    
    df = train_iforest.compute_anomaly_features(df, iforest, scaler)
    print(f"Shape after anomaly features: {df.shape}")
    print(f"Anomaly columns added: {features.ANOMALY_COLUMNS}")
    
    # 3. Check label column exists
    if 'label' not in df.columns:
        print("ERROR: 'label' column not found in data")
        print(f"Available columns: {df.columns.tolist()}")
        return
    
    # 4. Select feature columns: 13 base + 2 anomaly (no graph embeddings, no clusters)
    feature_cols = features.FEATURE_COLUMNS + features.ANOMALY_COLUMNS
    print(f"\n[3] Feature columns ({len(feature_cols)} total):")
    print(f"Base features (13): {features.FEATURE_COLUMNS}")
    print(f"Anomaly features (2): {features.ANOMALY_COLUMNS}")
    
    # Verify all features exist
    missing_cols = [col for col in feature_cols if col not in df.columns]
    if missing_cols:
        print(f"ERROR: Missing columns: {missing_cols}")
        print(f"Available columns: {df.columns.tolist()}")
        return
    
    # 5. Remove rows with NaN in features or label
    print(f"\n[4] Data cleaning...")
    print(f"Rows before NaN removal: {len(df)}")
    df_clean = df.dropna(subset=feature_cols + ['label'])
    print(f"Rows after NaN removal: {len(df_clean)}")
    print(f"Rows removed: {len(df) - len(df_clean)}")
    
    # 6. Split by address (leakage-safe)
    print(f"\n[5] Splitting by address (test_size=0.2, random_state=42)...")
    if 'address' not in df_clean.columns:
        print("ERROR: 'address' column not found in data")
        print(f"Available columns: {df_clean.columns.tolist()}")
        return
    
    train_df, test_df = _split_by_address(df_clean, test_size=0.2, random_state=42)
    print(f"Train set: {len(train_df)} rows, {train_df['label'].sum()} positive labels")
    print(f"Test set: {len(test_df)} rows, {test_df['label'].sum()} positive labels")
    
    X_train = train_df[feature_cols].values
    y_train = train_df['label'].values
    X_test = test_df[feature_cols].values
    y_test = test_df['label'].values
    
    # 7. Train Random Forest with enriched hyperparams
    print(f"\n[6] Training RandomForestClassifier...")
    print(f"Hyperparameters: n_estimators=400, max_depth=15, min_samples_split=10,")
    print(f"                 min_samples_leaf=5, class_weight='balanced', random_state=42")
    
    rf = RandomForestClassifier(
        n_estimators=400,
        max_depth=15,
        min_samples_split=10,
        min_samples_leaf=5,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    print("Training complete!")
    
    # 8. Compute held-out metrics on test set
    print(f"\n[7] Computing held-out metrics (test set)...")
    y_pred = rf.predict(X_test)
    y_pred_proba = rf.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    conf_matrix = confusion_matrix(y_test, y_pred)
    
    print(f"Accuracy:  {accuracy:.6f}")
    print(f"Precision: {precision:.6f}")
    print(f"Recall:    {recall:.6f}")
    print(f"F1:        {f1:.6f}")
    print(f"ROC-AUC:   {roc_auc:.6f}")
    print(f"Confusion Matrix:")
    print(f"  {conf_matrix}")
    
    # 9. Compute 5-fold CV ROC-AUC on train set
    print(f"\n[8] Computing 5-fold CV ROC-AUC on train set (StratifiedKFold shuffle=True, random_state=42)...")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_roc_auc_scores = []
    
    for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X_train, y_train)):
        X_fold_train = X_train[train_idx]
        y_fold_train = y_train[train_idx]
        X_fold_val = X_train[val_idx]
        y_fold_val = y_train[val_idx]
        
        rf_fold = RandomForestClassifier(
            n_estimators=400,
            max_depth=15,
            min_samples_split=10,
            min_samples_leaf=5,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        )
        rf_fold.fit(X_fold_train, y_fold_train)
        y_fold_pred_proba = rf_fold.predict_proba(X_fold_val)[:, 1]
        fold_roc_auc = roc_auc_score(y_fold_val, y_fold_pred_proba)
        cv_roc_auc_scores.append(fold_roc_auc)
        print(f"  Fold {fold_idx + 1}: ROC-AUC = {fold_roc_auc:.6f}")
    
    cv_roc_auc_mean = np.mean(cv_roc_auc_scores)
    cv_roc_auc_std = np.std(cv_roc_auc_scores)
    print(f"Mean CV ROC-AUC: {cv_roc_auc_mean:.6f} ± {cv_roc_auc_std:.6f}")
    
    # 10. Summary report
    print(f"\n" + "=" * 80)
    print("FINAL RESULTS SUMMARY")
    print("=" * 80)
    print(f"Dataset: data/wallet_features_hard.csv")
    print(f"Features: 13 base + 2 anomaly = {len(feature_cols)} total")
    print(f"Train samples: {len(train_df)}, Test samples: {len(test_df)}")
    print(f"\nHeld-out Test Metrics:")
    print(f"  Accuracy:  {accuracy:.6f}")
    print(f"  Precision: {precision:.6f}")
    print(f"  Recall:    {recall:.6f}")
    print(f"  F1-Score:  {f1:.6f}")
    print(f"  ROC-AUC:   {roc_auc:.6f}")
    print(f"  Confusion Matrix: {conf_matrix.tolist()}")
    print(f"\n5-Fold Cross-Validation (on train set):")
    print(f"  Individual fold ROC-AUC: {[f'{s:.6f}' for s in cv_roc_auc_scores]}")
    print(f"  Mean ROC-AUC: {cv_roc_auc_mean:.6f}")
    print(f"  Std Dev:      {cv_roc_auc_std:.6f}")
    print("=" * 80)
    
    # Save results to JSON
    results = {
        "dataset": "data/wallet_features_hard.csv",
        "features": {
            "base_features": features.FEATURE_COLUMNS,
            "anomaly_features": features.ANOMALY_COLUMNS,
            "total_count": len(feature_cols)
        },
        "data_split": {
            "train_samples": len(train_df),
            "test_samples": len(test_df),
            "train_positive_labels": int(train_df['label'].sum()),
            "test_positive_labels": int(test_df['label'].sum())
        },
        "held_out_metrics": {
            "accuracy": float(accuracy),
            "precision": float(precision),
            "recall": float(recall),
            "f1_score": float(f1),
            "roc_auc": float(roc_auc),
            "confusion_matrix": conf_matrix.tolist()
        },
        "cross_validation": {
            "fold_roc_auc_scores": [float(s) for s in cv_roc_auc_scores],
            "mean_roc_auc": float(cv_roc_auc_mean),
            "std_roc_auc": float(cv_roc_auc_std)
        }
    }
    
    output_path = "one_off_training_results.json"
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {output_path}")

if __name__ == "__main__":
    main()

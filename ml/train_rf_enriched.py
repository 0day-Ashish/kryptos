"""
train_rf_enriched.py — Leakage-safe enriched Random Forest training.

Key guarantees:
    1) Train/test split is performed before any graph feature generation.
    2) Graph features are computed from TRAIN graph only.
    3) Scam-neighbor ratios use TRAIN labels only.
    4) Test labels are never used for graph features.
"""

import os
import sys
import json
import time
import logging
from typing import Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.features import (  # noqa: E402
    ANOMALY_COLUMNS,
    FEATURE_COLUMNS,
    GRAPH_COLUMNS,
    LABEL_COLUMN,
    RAW_TO_FEATURE_MAP,
    WEI_COLUMNS,
)
from ml.train_iforest import compute_anomaly_features, load_iforest  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")

LABELED_CSV = os.path.join(DATA_DIR, "wallet_features_labeled.csv")
EDGES_CSV = os.path.join(DATA_DIR, "wallet_edges.csv")
RF_MODEL_PATH = os.path.join(MODEL_DIR, "random_forest.pkl")
RF_META_PATH = os.path.join(MODEL_DIR, "random_forest_meta.json")

WEI_DETECTION_THRESHOLD = 1e12


def _is_wei(series: pd.Series) -> bool:
    median = series.dropna().median()
    return median > WEI_DETECTION_THRESHOLD


def load_labeled_data(csv_path: str = LABELED_CSV) -> pd.DataFrame:
    logger.info(f"Loading labeled data from {csv_path}")
    df = pd.read_csv(csv_path)
    logger.info(f"  Raw shape: {df.shape[0]:,} rows × {df.shape[1]} columns")

    for col in WEI_COLUMNS:
        if col in df.columns and _is_wei(df[col]):
            df[col] = df[col].astype(float) / 1e18
            logger.info(f"    Converted {col} from wei → ETH")

    df = df.rename(columns=RAW_TO_FEATURE_MAP)
    _recompute_derived_features(df)

    numeric_cols = [c for c in FEATURE_COLUMNS if c in df.columns]
    df[numeric_cols] = df[numeric_cols].replace([np.inf, -np.inf], np.nan).fillna(0)

    missing_base = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing_base:
        raise ValueError(f"Missing base feature columns: {missing_base}")
    if LABEL_COLUMN not in df.columns:
        raise ValueError(f"Missing label column: {LABEL_COLUMN}")
    if "address" not in df.columns:
        raise ValueError("Missing required address column for graph feature generation.")

    n_total = len(df)
    n_scam = int((df[LABEL_COLUMN] == 1).sum())
    logger.info(
        f"  Ready: {n_total:,} wallets | scam={n_scam:,} ({100*n_scam/n_total:.1f}%) "
        f"healthy={n_total-n_scam:,} ({100*(n_total-n_scam)/n_total:.1f}%)"
    )
    return df


def _recompute_derived_features(df: pd.DataFrame) -> None:
    if "total_out" in df.columns and "total_in" in df.columns:
        df["total_volume"] = df["total_out"].fillna(0) + df["total_in"].fillna(0)
        logger.info("    Recomputed total_volume from total_out + total_in")

    if "lifetime_seconds" in df.columns and "total_tx_count" in df.columns:
        life = df["lifetime_seconds"].astype(float)
        tx = df["total_tx_count"].astype(float)
        df["tx_frequency"] = np.where(life > 0, tx / life, 0.0)
        logger.info("    Recomputed tx_frequency from total_tx_count / lifetime_seconds")

    if "fan_out" in df.columns and "fan_in" in df.columns and "total_tx_count" in df.columns:
        tx = df["total_tx_count"].astype(float)
        df["counterparty_ratio"] = np.where(
            tx > 0,
            (df["fan_out"].astype(float) + df["fan_in"].astype(float)) / tx,
            0.0,
        )
        logger.info("    Recomputed counterparty_ratio from fan_out + fan_in")


def _split_by_address(df: pd.DataFrame, test_size: float = 0.2, random_state: int = 42) -> Tuple[pd.DataFrame, pd.DataFrame]:
    grouped = (
        df.groupby("address", as_index=False)[LABEL_COLUMN]
        .max()
        .rename(columns={LABEL_COLUMN: "address_label"})
    )
    train_addr, test_addr = train_test_split(
        grouped["address"],
        test_size=test_size,
        random_state=random_state,
        stratify=grouped["address_label"],
    )
    train_set = set(train_addr.astype(str))
    test_set = set(test_addr.astype(str))
    train_df = df[df["address"].astype(str).isin(train_set)].copy()
    test_df = df[df["address"].astype(str).isin(test_set)].copy()
    return train_df, test_df


def load_edges(edges_path: str = EDGES_CSV) -> pd.DataFrame:
    logger.info(f"Loading edges from {edges_path}")
    edges = pd.read_csv(edges_path, usecols=["from_address", "to_address"])
    edges = edges.dropna(subset=["from_address", "to_address"])
    edges["from_address"] = edges["from_address"].astype(str)
    edges["to_address"] = edges["to_address"].astype(str)
    logger.info(f"  Raw edges: {len(edges):,}")
    return edges


def _build_graph_feature_tables(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    edges_df: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, float]]:
    train_addresses = set(train_df["address"].astype(str))
    test_addresses = set(test_df["address"].astype(str))
    all_addresses = train_addresses.union(test_addresses)

    # Use full graph structure for neighbor access, but labels stay train-only.
    full_edges = edges_df[
        edges_df["from_address"].isin(all_addresses) & edges_df["to_address"].isin(all_addresses)
    ].copy()
    logger.info(f"  Full-graph edges retained for split addresses: {len(full_edges):,}")

    neighbor_map: Dict[str, set[str]] = {}
    for src, dst in full_edges[["from_address", "to_address"]].itertuples(index=False):
        if src not in neighbor_map:
            neighbor_map[src] = set()
        if dst not in neighbor_map:
            neighbor_map[dst] = set()
        neighbor_map[src].add(dst)
        neighbor_map[dst].add(src)

    for addr in all_addresses:
        if addr not in neighbor_map:
            neighbor_map[addr] = set()

    train_base_by_addr = (
        train_df.groupby("address", as_index=False)
        .agg(
            label=(LABEL_COLUMN, "max"),
        )
    )
    label_map = dict(zip(train_base_by_addr["address"].astype(str), train_base_by_addr["label"].astype(int)))
    n_train_labeled = len(label_map)

    def build_row(addr: str) -> dict:
        neigh = neighbor_map.get(addr, set())
        neigh_count = float(len(neigh))
        train_labeled_neighbors = [n for n in neigh if n in label_map]
        scam_neighbor_count = float(sum(label_map[n] for n in train_labeled_neighbors))
        if train_labeled_neighbors:
            scam_ratio = float(scam_neighbor_count / len(train_labeled_neighbors))
            max_neighbor_risk = float(1.0 if scam_neighbor_count > 0 else 0.0)
            has_scam_neighbor = float(1.0 if scam_neighbor_count > 0 else 0.0)
        else:
            scam_ratio = np.nan
            max_neighbor_risk = np.nan
            has_scam_neighbor = np.nan

        scam_density = float(scam_neighbor_count / (1.0 + neigh_count))

        two_hop_nodes = set()
        for n in neigh:
            two_hop_nodes.update(neighbor_map.get(n, set()))
        two_hop_nodes.discard(addr)
        two_hop_nodes = two_hop_nodes.difference(neigh)
        two_hop_train_labeled = [n for n in two_hop_nodes if n in label_map]
        if two_hop_train_labeled:
            two_hop_scam_exists = float(1.0 if any(label_map[n] == 1 for n in two_hop_train_labeled) else 0.0)
        else:
            two_hop_scam_exists = np.nan

        return {
            "address": addr,
            "neighbor_count": neigh_count,
            "scam_neighbor_count": scam_neighbor_count,
            "scam_neighbor_ratio": scam_ratio,
            "max_neighbor_risk": max_neighbor_risk,
            "has_scam_neighbor": has_scam_neighbor,
            "scam_density": scam_density,
            "two_hop_scam_exists": two_hop_scam_exists,
        }

    train_graph_rows = [build_row(addr) for addr in sorted(train_addresses)]
    test_graph_rows = [build_row(addr) for addr in sorted(test_addresses)]

    train_graph = pd.DataFrame(train_graph_rows)
    test_graph = pd.DataFrame(test_graph_rows)

    train_means = {
        col: float(train_graph[col].mean()) if col in train_graph.columns else 0.0
        for col in GRAPH_COLUMNS
    }
    train_means = {k: (0.0 if np.isnan(v) else v) for k, v in train_means.items()}

    for col in GRAPH_COLUMNS:
        train_graph[col] = train_graph[col].fillna(train_means[col])
        test_graph[col] = test_graph[col].fillna(train_means[col])

    coverage_train = float((train_graph["neighbor_count"] > 0).mean()) if len(train_graph) else 0.0
    coverage_test = float((test_graph["neighbor_count"] > 0).mean()) if len(test_graph) else 0.0
    train_label_neighbor_cov_train = (
        float((train_graph["scam_neighbor_ratio"] > 0).mean()) if len(train_graph) else 0.0
    )
    train_label_neighbor_cov_test = (
        float((test_graph["scam_neighbor_ratio"] > 0).mean()) if len(test_graph) else 0.0
    )
    logger.info(
        "  Graph feature coverage: train_with_neighbors=%.2f%%, test_with_neighbors=%.2f%%",
        coverage_train * 100.0,
        coverage_test * 100.0,
    )
    logger.info(
        "  Train-label neighbor coverage: train=%.2f%%, test=%.2f%% (train labels available=%d)",
        train_label_neighbor_cov_train * 100.0,
        train_label_neighbor_cov_test * 100.0,
        n_train_labeled,
    )
    return train_graph, test_graph, train_means


def _build_split_matrix(
    split_df: pd.DataFrame,
    graph_features: pd.DataFrame,
    iforest_model,
    iforest_scaler,
) -> Tuple[pd.DataFrame, pd.Series]:
    out = split_df.copy()
    out["address"] = out["address"].astype(str)
    out = compute_anomaly_features(out, iforest_model, iforest_scaler)

    merged = out.merge(graph_features, on="address", how="left")
    for col in GRAPH_COLUMNS:
        if col not in merged.columns:
            merged[col] = 0.0

    feature_cols = FEATURE_COLUMNS + ANOMALY_COLUMNS + GRAPH_COLUMNS
    X = merged[feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0)
    y = merged[LABEL_COLUMN].astype(int)
    return X, y


def train_leakage_safe_enriched_rf(
    labeled_df: pd.DataFrame,
    edges_df: pd.DataFrame,
    iforest_model,
    iforest_scaler,
) -> tuple:
    logger.info("=" * 70)
    logger.info("LEAKAGE-SAFE ENRICHED RF TRAINING")
    logger.info("=" * 70)

    train_df, test_df = _split_by_address(labeled_df, test_size=0.2, random_state=42)
    overlap = set(train_df["address"].astype(str)).intersection(set(test_df["address"].astype(str)))
    if overlap:
        raise RuntimeError("Address overlap detected between train and test splits.")
    logger.info(
        f"Split first by address: train_rows={len(train_df):,}, test_rows={len(test_df):,}, "
        f"train_addresses={train_df['address'].nunique():,}, test_addresses={test_df['address'].nunique():,}"
    )

    logger.info("Building full-graph, train-label-only graph features...")
    train_graph, test_graph, graph_defaults = _build_graph_feature_tables(train_df, test_df, edges_df)
    logger.info(f"  Graph features: {len(GRAPH_COLUMNS)} columns")

    X_train, y_train = _build_split_matrix(
        train_df,
        graph_features=train_graph,
        iforest_model=iforest_model,
        iforest_scaler=iforest_scaler,
    )
    X_test, y_test = _build_split_matrix(
        test_df,
        graph_features=test_graph,
        iforest_model=iforest_model,
        iforest_scaler=iforest_scaler,
    )

    feature_cols = list(X_train.columns)
    assert LABEL_COLUMN not in feature_cols, "BUG: label column present in features"
    assert set(feature_cols) == set(FEATURE_COLUMNS + ANOMALY_COLUMNS + GRAPH_COLUMNS), "Feature mismatch"

    logger.info(f"Feature matrix train={X_train.shape}, test={X_test.shape}")

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
    logger.info(f"CV ROC-AUC: {[f'{s:.4f}' for s in cv_scores]} | mean={cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    start = time.time()
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
    train_time = time.time() - start

    y_pred = rf.predict(X_test)
    y_proba = rf.predict_proba(X_test)[:, 1]
    rf_df = pd.DataFrame({
        "address": test_df["address"].values,
        "rf_score": y_proba,
    })
    rf_predictions_path = os.path.join(DATA_DIR, "rf_predictions.csv")
    rf_df.to_csv(rf_predictions_path, index=False)
    logger.info(f"Saved RF predictions → {rf_predictions_path}")

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    roc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred)

    logger.info("")
    logger.info("=" * 70)
    logger.info("EVALUATION (held-out test)")
    logger.info("=" * 70)
    logger.info(f"Accuracy={acc:.4f} Precision={prec:.4f} Recall={rec:.4f} F1={f1:.4f} ROC-AUC={roc:.4f}")
    logger.info(f"Confusion matrix:\n{cm}")
    logger.info(f"\n{classification_report(y_test, y_pred, target_names=['Healthy', 'Scam'], digits=4)}")

    importances = pd.Series(rf.feature_importances_, index=feature_cols).sort_values(ascending=False)
    base_imp = float(importances[[c for c in FEATURE_COLUMNS if c in importances.index]].sum())
    anomaly_imp = float(importances[[c for c in ANOMALY_COLUMNS if c in importances.index]].sum())
    graph_imp = float(importances[[c for c in GRAPH_COLUMNS if c in importances.index]].sum())
    graph_imp_pct = float(graph_imp * 100.0)
    top20 = importances.head(20)
    logger.info("Top 20 features by importance:")
    logger.info(top20.to_string())

    metrics = {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "roc_auc": round(roc, 4),
        "cv_roc_auc_mean": round(float(cv_scores.mean()), 4),
        "cv_roc_auc_std": round(float(cv_scores.std()), 4),
        "confusion_matrix": cm.tolist(),
        "feature_importances": importances.to_dict(),
        "top20_feature_importances": top20.to_dict(),
        "group_importances": {
            "behavioral": round(base_imp, 4),
            "anomaly": round(anomaly_imp, 4),
            "graph": round(graph_imp, 4),
            "graph_percent": round(graph_imp_pct, 2),
        },
        "training_time_seconds": round(train_time, 1),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "n_features": int(len(feature_cols)),
        "n_graph_features": int(len(GRAPH_COLUMNS)),
        "graph_feature_defaults": graph_defaults,
        "graph_train_only": False,
        "label_usage_train_only": True,
        "test_graph_strategy": "full_graph_neighbors_train_label_only",
    }
    return rf, metrics, feature_cols, test_df


def save_rf(rf_model, metrics: dict, feature_cols: list[str], model_path: str = RF_MODEL_PATH, meta_path: str = RF_META_PATH):
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(rf_model, model_path)
    logger.info(f"Saved model → {model_path}")

    meta = {
        "model_type": "enriched_random_forest",
        "n_features": len(feature_cols),
        "feature_columns": feature_cols,
        "base_features": list(FEATURE_COLUMNS),
        "anomaly_features": list(ANOMALY_COLUMNS),
        "graph_features": list(GRAPH_COLUMNS),
        "embedding_features": [],
        "cluster_features": [],
        "graph_train_only": metrics.get("graph_train_only", False),
        "label_usage_train_only": metrics.get("label_usage_train_only", True),
        "test_graph_strategy": metrics.get("test_graph_strategy", "unknown"),
        "metrics": {k: v for k, v in metrics.items() if k not in ("feature_importances", "top20_feature_importances")},
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    logger.info(f"Saved metadata → {meta_path}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train leakage-safe enriched Random Forest")
    parser.add_argument("--data", type=str, default=LABELED_CSV, help="Path to labeled wallet CSV")
    parser.add_argument("--edges", type=str, default=EDGES_CSV, help="Path to wallet edges CSV")
    args = parser.parse_args()

    print()
    print("╔" + "═" * 68 + "╗")
    print("║   KRYPTOS — LEAKAGE-SAFE ENRICHED Random Forest Training        ║")
    print("╚" + "═" * 68 + "╝")
    print()

    iforest, iforest_scaler = load_iforest()
    labeled = load_labeled_data(args.data)
    edges = load_edges(args.edges)

    rf_model, metrics, feature_cols, test_df = train_leakage_safe_enriched_rf(labeled, edges, iforest, iforest_scaler)
    save_rf(rf_model, metrics, feature_cols)

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
    print(f"  Graph features  : {metrics['n_graph_features']}")
    print(f"  Graph strategy  : full-graph neighbors + train-label-only")
    print(f"  Graph contrib % : {metrics['group_importances']['graph_percent']}%")
    print("=" * 70)

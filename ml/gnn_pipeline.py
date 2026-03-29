"""
gnn_pipeline.py — Leakage-safe GraphSAGE training pipeline.

Trains a 2-layer GraphSAGE model on wallet transaction graphs for scam
detection.  Designed to be called standalone OR imported by the RF
training pipeline with a shared train/test split.

Key leakage-safety guarantees:
    1) Feature scaler is fit on TRAIN nodes only.
    2) GNN loss is computed on TRAIN-mask nodes only.
    3) Test nodes participate in message passing (transductive) but their
       labels are never used in the loss.
    4) Early stopping uses a held-out VALIDATION split from the train set.

Saves:
    models/gnn_model.pt
    models/gnn_scaler.pkl
    data/gnn_predictions.csv
"""

import os
import sys
import logging

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from sklearn.metrics import (
    classification_report,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch_geometric.data import Data
from torch_geometric.nn import SAGEConv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")

LABELED_CSV = os.path.join(DATA_DIR, "wallet_features_graph_hard.csv")
EDGES_CSV = os.path.join(DATA_DIR, "wallet_edges.csv")
GNN_MODEL_PATH = os.path.join(MODEL_DIR, "gnn_model.pt")
GNN_SCALER_PATH = os.path.join(MODEL_DIR, "gnn_scaler.pkl")
GNN_PREDICTIONS_PATH = os.path.join(DATA_DIR, "gnn_predictions.csv")


# ══════════════════════════════════════════════════════════════════════════════
# Model Definition
# ══════════════════════════════════════════════════════════════════════════════

class GraphSAGE(torch.nn.Module):
    """2-layer GraphSAGE with dropout regularization."""

    def __init__(self, in_channels: int, hidden_channels: int = 64, dropout: float = 0.3):
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, hidden_channels)
        self.lin = torch.nn.Linear(hidden_channels, 2)
        self.dropout = dropout

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)

        x = self.conv2(x, edge_index)
        x = F.relu(x)

        x = self.lin(x)
        return x


# ══════════════════════════════════════════════════════════════════════════════
# Data Loading & Preparation
# ══════════════════════════════════════════════════════════════════════════════

def load_and_prepare_data(
    csv_path: str = LABELED_CSV,
    edges_path: str = EDGES_CSV,
):
    """
    Load wallet features + edges and build a PyG Data object.

    Returns
    -------
    df : pd.DataFrame  — cleaned feature dataframe with address + label
    data : torch_geometric.data.Data  — graph with x, edge_index, y
    feature_cols : list[str]  — feature column names
    address_to_idx : dict  — mapping from address string to node index
    """
    logger.info(f"Loading data from {csv_path}")
    df = pd.read_csv(csv_path)
    edges = pd.read_csv(edges_path)

    logger.info(f"  Raw: {df.shape[0]:,} nodes, {edges.shape[0]:,} edges")

    feature_cols = [col for col in df.columns if col not in ["address", "label"]]

    # Clean
    df = df.dropna(subset=["address", "label"]).copy()
    df = df.drop_duplicates(subset=["address"]).reset_index(drop=True)

    for col in feature_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df[feature_cols] = df[feature_cols].replace([float("inf"), float("-inf")], float("nan"))
    df[feature_cols] = df[feature_cols].fillna(0.0)

    # Node mapping
    address_to_idx = {addr: i for i, addr in enumerate(df["address"].values)}
    logger.info(f"  Nodes after cleaning: {len(address_to_idx):,}")

    # Edge index
    edge_src = edges["from_address"].map(address_to_idx)
    edge_dst = edges["to_address"].map(address_to_idx)
    edge_mask = edge_src.notna() & edge_dst.notna()

    edge_index_df = pd.DataFrame({
        "src": edge_src[edge_mask].astype("int64"),
        "dst": edge_dst[edge_mask].astype("int64"),
    }).drop_duplicates()

    if edge_index_df.empty:
        edge_index = torch.empty((2, 0), dtype=torch.long)
    else:
        edge_index = torch.tensor(
            edge_index_df[["src", "dst"]].values,
            dtype=torch.long,
        ).t().contiguous()

    logger.info(f"  Edge index: {edge_index.shape[1]:,} edges retained")

    # Labels
    label_values = df["label"].values
    unique_labels = sorted(pd.unique(label_values))
    label_to_idx = {label: idx for idx, label in enumerate(unique_labels)}
    y = torch.tensor([label_to_idx[label] for label in label_values], dtype=torch.long)
    logger.info(f"  Label mapping: {label_to_idx}")

    # Features (raw — scaling happens in train_gnn)
    X_raw = torch.tensor(df[feature_cols].values, dtype=torch.float)

    data = Data(x=X_raw, edge_index=edge_index, y=y)

    return df, data, feature_cols, address_to_idx


# ══════════════════════════════════════════════════════════════════════════════
# Training
# ══════════════════════════════════════════════════════════════════════════════

def train_gnn(
    df: pd.DataFrame,
    data: Data,
    feature_cols: list,
    train_idx: list = None,
    test_idx: list = None,
    hidden_channels: int = 64,
    dropout: float = 0.3,
    lr: float = 0.001,
    weight_decay: float = 1e-4,
    epochs: int = 200,
    patience: int = 20,
    val_fraction: float = 0.15,
    random_state: int = 42,
):
    """
    Train GraphSAGE with leakage-safe guarantees.

    Parameters
    ----------
    df : pd.DataFrame
        Wallet features with address + label columns.
    data : Data
        PyG graph object with x (raw features), edge_index, y.
    feature_cols : list
        Column names corresponding to data.x columns.
    train_idx / test_idx : list, optional
        If provided, use these indices (from an external split, e.g. RF pipeline).
        If None, creates its own 80/20 stratified split.
    patience : int
        Early stopping patience (epochs without val loss improvement).
    val_fraction : float
        Fraction of train set held out for validation / early stopping.

    Returns
    -------
    gnn_scores : np.ndarray
        Per-node scam probability (softmax[:, 1]) for ALL nodes.
    metrics : dict
        Evaluation metrics on test set.
    scaler : StandardScaler
        Fitted on train nodes only — needed for inference.
    model : GraphSAGE
        Trained model.
    """
    num_nodes = data.x.shape[0]

    # ── Split ──
    if train_idx is None or test_idx is None:
        all_idx = list(range(num_nodes))
        train_idx, test_idx = train_test_split(
            all_idx,
            test_size=0.2,
            stratify=data.y.numpy(),
            random_state=random_state,
        )

    # Sub-split train into train + validation for early stopping
    train_labels = data.y[train_idx].numpy()
    sub_train_idx, val_idx = train_test_split(
        train_idx,
        test_size=val_fraction,
        stratify=train_labels,
        random_state=random_state,
    )

    train_mask = torch.zeros(num_nodes, dtype=torch.bool)
    val_mask = torch.zeros(num_nodes, dtype=torch.bool)
    test_mask = torch.zeros(num_nodes, dtype=torch.bool)

    train_mask[sub_train_idx] = True
    val_mask[val_idx] = True
    test_mask[test_idx] = True

    data.train_mask = train_mask
    data.val_mask = val_mask
    data.test_mask = test_mask

    logger.info(
        f"  Split: train={train_mask.sum().item()}, val={val_mask.sum().item()}, "
        f"test={test_mask.sum().item()}"
    )

    # ── Scale features (fit on train only) ──
    raw_features = df[feature_cols].values
    scaler = StandardScaler()
    scaler.fit(raw_features[sub_train_idx])
    scaled_features = scaler.transform(raw_features)
    data.x = torch.tensor(scaled_features, dtype=torch.float)

    # ── Model ──
    model = GraphSAGE(
        in_channels=data.x.shape[1],
        hidden_channels=hidden_channels,
        dropout=dropout,
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)

    # ── Training loop with early stopping ──
    best_val_loss = float("inf")
    best_state = None
    epochs_no_improve = 0

    logger.info(f"  Training GraphSAGE for up to {epochs} epochs (patience={patience})...")

    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()

        out = model(data.x, data.edge_index)
        loss = F.cross_entropy(out[data.train_mask], data.y[data.train_mask])

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        # Validation
        model.eval()
        with torch.no_grad():
            val_out = model(data.x, data.edge_index)
            val_loss = F.cross_entropy(val_out[data.val_mask], data.y[data.val_mask]).item()

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            epochs_no_improve = 0
        else:
            epochs_no_improve += 1

        if epoch % 25 == 0:
            logger.info(
                f"    Epoch {epoch:3d} | train_loss={loss.item():.4f} | "
                f"val_loss={val_loss:.4f} | best_val={best_val_loss:.4f}"
            )

        if epochs_no_improve >= patience:
            logger.info(f"    Early stopping at epoch {epoch} (patience={patience})")
            break

    # Restore best model
    if best_state is not None:
        model.load_state_dict(best_state)

    # ── Evaluate ──
    model.eval()
    with torch.no_grad():
        out = model(data.x, data.edge_index)
        pred = out.argmax(dim=1)
        probs = torch.softmax(out, dim=1)[:, 1]

    # Test metrics
    y_true = data.y[data.test_mask].numpy()
    y_pred = pred[data.test_mask].numpy()
    y_proba = probs[data.test_mask].numpy()

    test_acc = float((pred[data.test_mask] == data.y[data.test_mask]).float().mean())
    test_f1 = float(f1_score(y_true, y_pred, zero_division=0))
    test_roc = float(roc_auc_score(y_true, y_proba)) if len(np.unique(y_true)) > 1 else 0.0

    train_acc = float((pred[data.train_mask] == data.y[data.train_mask]).float().mean())

    logger.info("")
    logger.info("  ── GNN Evaluation (test set) ──")
    logger.info(f"  Train Accuracy : {train_acc:.4f}")
    logger.info(f"  Test Accuracy  : {test_acc:.4f}")
    logger.info(f"  Test F1        : {test_f1:.4f}")
    logger.info(f"  Test ROC-AUC   : {test_roc:.4f}")
    logger.info(f"\n{classification_report(y_true, y_pred, target_names=['Healthy', 'Scam'], digits=4)}")

    gnn_scores = probs.numpy()

    metrics = {
        "train_accuracy": round(train_acc, 4),
        "test_accuracy": round(test_acc, 4),
        "test_f1": round(test_f1, 4),
        "test_roc_auc": round(test_roc, 4),
        "best_val_loss": round(best_val_loss, 4),
        "epochs_trained": epoch + 1,
    }

    return gnn_scores, metrics, scaler, model


# ══════════════════════════════════════════════════════════════════════════════
# Persistence
# ══════════════════════════════════════════════════════════════════════════════

def save_gnn(
    model: GraphSAGE,
    scaler: StandardScaler,
    gnn_scores: np.ndarray,
    addresses: np.ndarray,
    model_path: str = GNN_MODEL_PATH,
    scaler_path: str = GNN_SCALER_PATH,
    predictions_path: str = GNN_PREDICTIONS_PATH,
):
    """Save GNN model, scaler, and predictions to disk."""
    os.makedirs(os.path.dirname(model_path), exist_ok=True)

    torch.save(model.state_dict(), model_path)
    logger.info(f"  GNN model saved → {model_path}")

    joblib.dump(scaler, scaler_path)
    logger.info(f"  GNN scaler saved → {scaler_path}")

    gnn_df = pd.DataFrame({
        "address": addresses,
        "gnn_score": gnn_scores,
    })
    gnn_df.to_csv(predictions_path, index=False)
    logger.info(f"  GNN predictions saved → {predictions_path}")


# ══════════════════════════════════════════════════════════════════════════════
# CLI entry point (standalone mode)
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train leakage-safe GraphSAGE")
    parser.add_argument("--data", type=str, default=LABELED_CSV, help="Path to labeled wallet CSV")
    parser.add_argument("--edges", type=str, default=EDGES_CSV, help="Path to wallet edges CSV")
    parser.add_argument("--epochs", type=int, default=200, help="Max training epochs")
    parser.add_argument("--patience", type=int, default=20, help="Early stopping patience")
    parser.add_argument("--hidden", type=int, default=64, help="Hidden channel size")
    parser.add_argument("--dropout", type=float, default=0.3, help="Dropout rate")
    args = parser.parse_args()

    print()
    print("╔" + "═" * 68 + "╗")
    print("║   KRYPTOS — Leakage-Safe GraphSAGE Training                     ║")
    print("╚" + "═" * 68 + "╝")
    print()

    df, data, feature_cols, address_to_idx = load_and_prepare_data(args.data, args.edges)

    gnn_scores, metrics, scaler, model = train_gnn(
        df, data, feature_cols,
        hidden_channels=args.hidden,
        dropout=args.dropout,
        epochs=args.epochs,
        patience=args.patience,
    )

    save_gnn(model, scaler, gnn_scores, df["address"].values)

    print()
    print("=" * 70)
    print("  GNN TRAINING COMPLETE")
    print("=" * 70)
    for k, v in metrics.items():
        print(f"  {k:20s}: {v}")
    print("=" * 70)
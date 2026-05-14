"""
modal_train.py - Train Kryptos ML pipeline on Modal cloud compute.

Usage:
    pip install modal && modal setup
    modal run ml/modal_train.py --command upload
    modal run ml/modal_train.py --command train
    modal run ml/modal_train.py --command download
    modal run ml/modal_train.py --command all      # upload+train+download
"""

import modal
import os

# ── Modal infrastructure ──
vol = modal.Volume.from_name("kryptos-data", create_if_missing=True)
VOL = "/vol"

cpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("scikit-learn==1.4.2", "pandas==2.2.2", "numpy==1.26.4", "joblib==1.4.2")
)

gpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("scikit-learn==1.4.2", "pandas==2.2.2", "numpy==1.26.4", "joblib==1.4.2")
    .pip_install("torch==2.3.0", index_url="https://download.pytorch.org/whl/cu121")
    .run_commands(
        "pip install pyg-lib torch-scatter torch-sparse torch-cluster "
        "-f https://data.pyg.org/whl/torch-2.3.0+cu121.html",
        "pip install torch-geometric",
    )
)

app = modal.App("kryptos-training")

# ── Feature definitions (from ml/features.py) ──
FEATURE_COLUMNS = [
    "fan_out", "fan_in", "total_out", "total_in", "total_volume",
    "out_tx_count", "in_tx_count", "total_tx_count", "lifetime_seconds",
    "tx_frequency", "counterparty_ratio", "out_in_volume_ratio", "pass_through_ratio",
]
ANOMALY_COLUMNS = ["anomaly_score", "anomaly_flag"]
GRAPH_COLUMNS = [
    "neighbor_count", "scam_neighbor_count", "scam_neighbor_ratio",
    "max_neighbor_risk", "has_scam_neighbor", "scam_density", "two_hop_scam_exists",
]
GNN_COLUMNS = ["gnn_score"]
LABEL_COLUMN = "label"
ANOMALY_THRESHOLD = 0.0
WEI_COLUMNS = ["total_out_volume", "total_in_volume", "total_volume"]
RAW_TO_FEATURE_MAP = {
    "unique_receivers": "fan_out", "unique_senders": "fan_in",
    "total_out_volume": "total_out", "total_in_volume": "total_in",
}
WEI_DETECTION_THRESHOLD = 1e12

RF_PARAMS = dict(
    n_estimators=200, max_depth=12, min_samples_split=10,
    min_samples_leaf=8, class_weight="balanced", n_jobs=-1, random_state=42,
)


# ═══════════════════════════════════════════════════════════════════════
# Stage 1: Isolation Forest (CPU-only)
# ═══════════════════════════════════════════════════════════════════════

@app.function(
    image=cpu_image, volumes={VOL: vol},
    cpu=16.0, memory=32768, timeout=3600,
)
def train_iforest_remote():
    import numpy as np
    import pandas as pd
    import joblib
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler

    data_dir = f"{VOL}/data"
    model_dir = f"{VOL}/models"
    os.makedirs(model_dir, exist_ok=True)

    csv_path = f"{data_dir}/wallet_features_1M.csv"
    print(f"Loading {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"  Shape: {df.shape}")

    # Preprocess: wei -> ETH, rename columns
    for col in WEI_COLUMNS:
        if col in df.columns:
            df[col] = df[col].astype(float) / 1e18
    df = df.rename(columns=RAW_TO_FEATURE_MAP)

    # Compute derived features
    if "total_volume" not in df.columns or df["total_volume"].isna().all():
        df["total_volume"] = df.get("total_out", 0) + df.get("total_in", 0)
    if "tx_frequency" not in df.columns:
        life = df["lifetime_seconds"].astype(float)
        df["tx_frequency"] = np.where(life > 0, df["total_tx_count"] / life, 0.0)
    if "counterparty_ratio" not in df.columns:
        tx = df["total_tx_count"].astype(float)
        df["counterparty_ratio"] = np.where(
            tx > 0, (df["fan_out"] + df["fan_in"]) / tx, 0.0
        )

    df[FEATURE_COLUMNS] = df[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan).fillna(0)

    X = df[FEATURE_COLUMNS].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print(f"Training IForest on {X_scaled.shape[0]:,} samples, {X_scaled.shape[1]} features...")
    iforest = IsolationForest(
        n_estimators=300, max_samples="auto", contamination="auto",
        random_state=42, n_jobs=-1, verbose=1,
    )
    iforest.fit(X_scaled)

    joblib.dump(iforest, f"{model_dir}/isolation_forest.pkl")
    joblib.dump(scaler, f"{model_dir}/iforest_scaler.pkl")
    vol.commit()

    scores = iforest.decision_function(X_scaled)
    n_flagged = int((scores < ANOMALY_THRESHOLD).sum())
    print(f"  Flagged: {n_flagged:,}/{len(df):,} ({100*n_flagged/len(df):.1f}%)")
    print("Stage 1 DONE ✅")
    return {"n_samples": len(df), "n_flagged": n_flagged}


# ═══════════════════════════════════════════════════════════════════════
# Stage 2+3: Enriched RF + GNN (GPU for GNN, CPU for RF)
# ═══════════════════════════════════════════════════════════════════════

@app.function(
    image=gpu_image, volumes={VOL: vol},
    gpu="T4", cpu=8.0, memory=65536, timeout=7200,
)
def train_enriched_rf_remote():
    import time
    import json
    import numpy as np
    import pandas as pd
    import joblib
    import torch
    import torch.nn.functional as F
    from sklearn.ensemble import IsolationForest, RandomForestClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score, f1_score,
        roc_auc_score, classification_report, confusion_matrix,
    )
    from torch_geometric.data import Data
    from torch_geometric.nn import SAGEConv

    data_dir = f"{VOL}/data"
    model_dir = f"{VOL}/models"

    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    # ── Load IForest from Stage 1 ──
    iforest = joblib.load(f"{model_dir}/isolation_forest.pkl")
    iforest_scaler = joblib.load(f"{model_dir}/iforest_scaler.pkl")
    print("Loaded IForest ✅")

    # ── Load labeled data ──
    labeled_csv = f"{data_dir}/wallet_features_labeled.csv"
    df = pd.read_csv(labeled_csv)
    print(f"Labeled data: {df.shape}")

    for col in WEI_COLUMNS:
        if col in df.columns:
            median = df[col].dropna().median()
            if median > WEI_DETECTION_THRESHOLD:
                df[col] = df[col].astype(float) / 1e18
    df = df.rename(columns=RAW_TO_FEATURE_MAP)

    # Recompute derived features
    if "total_out" in df.columns and "total_in" in df.columns:
        df["total_volume"] = df["total_out"].fillna(0) + df["total_in"].fillna(0)
    if "lifetime_seconds" in df.columns and "total_tx_count" in df.columns:
        life = df["lifetime_seconds"].astype(float)
        df["tx_frequency"] = np.where(life > 0, df["total_tx_count"] / life, 0.0)
    if "fan_out" in df.columns and "fan_in" in df.columns:
        tx = df["total_tx_count"].astype(float)
        df["counterparty_ratio"] = np.where(
            tx > 0, (df["fan_out"] + df["fan_in"]) / tx, 0.0
        )

    numeric_cols = [c for c in FEATURE_COLUMNS if c in df.columns]
    df[numeric_cols] = df[numeric_cols].replace([np.inf, -np.inf], np.nan).fillna(0)

    # ── Address-level train/test split ──
    grouped = df.groupby("address", as_index=False)[LABEL_COLUMN].max()
    train_addr, test_addr = train_test_split(
        grouped["address"], test_size=0.2, random_state=42,
        stratify=grouped[LABEL_COLUMN],
    )
    train_set, test_set = set(train_addr.astype(str)), set(test_addr.astype(str))
    train_df = df[df["address"].astype(str).isin(train_set)].copy()
    test_df = df[df["address"].astype(str).isin(test_set)].copy()
    print(f"Split: train={len(train_df):,}, test={len(test_df):,}")

    # ── Load edges & build graph features ──
    edges_csv = f"{data_dir}/wallet_edges.csv"
    edges = pd.read_csv(edges_csv, usecols=["from_address", "to_address"]).dropna()
    edges["from_address"] = edges["from_address"].astype(str)
    edges["to_address"] = edges["to_address"].astype(str)
    print(f"Edges: {len(edges):,}")

    train_addresses = set(train_df["address"].astype(str))
    test_addresses = set(test_df["address"].astype(str))
    all_addresses = train_addresses | test_addresses

    full_edges = edges[
        edges["from_address"].isin(all_addresses) & edges["to_address"].isin(all_addresses)
    ]

    neighbor_map = {}
    for src, dst in full_edges[["from_address", "to_address"]].itertuples(index=False):
        neighbor_map.setdefault(src, set()).add(dst)
        neighbor_map.setdefault(dst, set()).add(src)
    for addr in all_addresses:
        neighbor_map.setdefault(addr, set())

    label_map = dict(zip(
        train_df.groupby("address")[LABEL_COLUMN].max().index.astype(str),
        train_df.groupby("address")[LABEL_COLUMN].max().values.astype(int),
    ))

    def build_graph_row(addr):
        neigh = neighbor_map.get(addr, set())
        nc = float(len(neigh))
        tln = [n for n in neigh if n in label_map]
        snc = float(sum(label_map[n] for n in tln))
        if tln:
            sr = snc / len(tln)
            mnr = 1.0 if snc > 0 else 0.0
            hsn = mnr
        else:
            sr = mnr = hsn = np.nan
        sd = snc / (1.0 + nc)
        two_hop = set()
        for n in neigh:
            two_hop.update(neighbor_map.get(n, set()))
        two_hop -= {addr} | neigh
        thl = [n for n in two_hop if n in label_map]
        ths = float(any(label_map[n] == 1 for n in thl)) if thl else np.nan
        return {
            "address": addr, "neighbor_count": nc, "scam_neighbor_count": snc,
            "scam_neighbor_ratio": sr, "max_neighbor_risk": mnr,
            "has_scam_neighbor": hsn, "scam_density": sd, "two_hop_scam_exists": ths,
        }

    print("Building graph features...")
    train_graph = pd.DataFrame([build_graph_row(a) for a in sorted(train_addresses)])
    test_graph = pd.DataFrame([build_graph_row(a) for a in sorted(test_addresses)])

    train_means = {
        col: float(train_graph[col].mean()) if col in train_graph.columns else 0.0
        for col in GRAPH_COLUMNS
    }
    train_means = {k: (0.0 if np.isnan(v) else v) for k, v in train_means.items()}
    for col in GRAPH_COLUMNS:
        train_graph[col] = train_graph[col].fillna(train_means[col])
        test_graph[col] = test_graph[col].fillna(train_means[col])
    print("Graph features ✅")

    # ── GNN (GraphSAGE) ──
    print("Training GNN...")
    gnn_csv = f"{data_dir}/wallet_features_graph_hard.csv"
    df_gnn = pd.read_csv(gnn_csv).dropna(subset=["address", "label"]).drop_duplicates(subset=["address"]).reset_index(drop=True)
    feat_cols = [c for c in df_gnn.columns if c not in ["address", "label"]]
    for c in feat_cols:
        df_gnn[c] = pd.to_numeric(df_gnn[c], errors="coerce")
    df_gnn[feat_cols] = df_gnn[feat_cols].replace([np.inf, -np.inf], np.nan).fillna(0)

    addr_to_idx = {a: i for i, a in enumerate(df_gnn["address"].values)}
    edge_src = edges["from_address"].map(addr_to_idx)
    edge_dst = edges["to_address"].map(addr_to_idx)
    mask = edge_src.notna() & edge_dst.notna()
    ei_df = pd.DataFrame({"s": edge_src[mask].astype(int), "d": edge_dst[mask].astype(int)}).drop_duplicates()
    edge_index = torch.tensor(ei_df.values.T, dtype=torch.long).contiguous() if len(ei_df) else torch.empty((2,0), dtype=torch.long)

    labels = df_gnn["label"].values
    ul = sorted(set(labels))
    lmap = {l: i for i, l in enumerate(ul)}
    y = torch.tensor([lmap[l] for l in labels], dtype=torch.long)
    X_raw = torch.tensor(df_gnn[feat_cols].values, dtype=torch.float)
    data = Data(x=X_raw, edge_index=edge_index, y=y)

    # Map RF split to GNN indices
    ti = [addr_to_idx[a] for a in train_addresses if a in addr_to_idx]
    tei = [addr_to_idx[a] for a in test_addresses if a in addr_to_idx]

    if len(ti) >= 10 and len(tei) >= 5:
        tl = data.y[ti].numpy()
        sti, vi = train_test_split(ti, test_size=0.15, stratify=tl, random_state=42)
        num_nodes = data.x.shape[0]
        train_mask = torch.zeros(num_nodes, dtype=torch.bool); train_mask[sti] = True
        val_mask = torch.zeros(num_nodes, dtype=torch.bool); val_mask[vi] = True
        test_mask = torch.zeros(num_nodes, dtype=torch.bool); test_mask[tei] = True

        gnn_scaler = StandardScaler()
        gnn_scaler.fit(df_gnn[feat_cols].values[sti])
        data.x = torch.tensor(gnn_scaler.transform(df_gnn[feat_cols].values), dtype=torch.float)

        class GraphSAGE(torch.nn.Module):
            def __init__(self, inc, hc=64, dr=0.3):
                super().__init__()
                self.c1 = SAGEConv(inc, hc)
                self.c2 = SAGEConv(hc, hc)
                self.lin = torch.nn.Linear(hc, 2)
                self.dr = dr
            def forward(self, x, ei):
                x = F.dropout(F.relu(self.c1(x, ei)), p=self.dr, training=self.training)
                x = F.relu(self.c2(x, ei))
                return self.lin(x)

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        data = data.to(device)
        train_mask = train_mask.to(device)
        val_mask = val_mask.to(device)

        model = GraphSAGE(data.x.shape[1]).to(device)
        opt = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)

        best_vl, best_state, no_imp = float("inf"), None, 0
        for ep in range(200):
            model.train(); opt.zero_grad()
            out = model(data.x, data.edge_index)
            loss = F.cross_entropy(out[train_mask], data.y[train_mask])
            loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
            model.eval()
            with torch.no_grad():
                vl = F.cross_entropy(model(data.x, data.edge_index)[val_mask], data.y[val_mask]).item()
            if vl < best_vl:
                best_vl = vl; best_state = {k: v.clone() for k, v in model.state_dict().items()}; no_imp = 0
            else:
                no_imp += 1
            if ep % 25 == 0:
                print(f"  Epoch {ep}: loss={loss.item():.4f} val={vl:.4f}")
            if no_imp >= 20:
                print(f"  Early stop at epoch {ep}"); break
        if best_state: model.load_state_dict(best_state)
        model.eval()
        with torch.no_grad():
            probs = torch.softmax(model(data.x, data.edge_index), dim=1)[:, 1].cpu().numpy()
        gnn_addr_scores = pd.DataFrame({"address": df_gnn["address"].astype(str), "gnn_score": probs})
        torch.save(model.state_dict(), f"{model_dir}/gnn_model.pt")
        joblib.dump(gnn_scaler, f"{model_dir}/gnn_scaler.pkl")
        print("GNN ✅")
    else:
        print("Not enough GNN overlap, using zero scores")
        gnn_addr_scores = pd.DataFrame({"address": list(all_addresses), "gnn_score": 0.0})

    train_gnn = gnn_addr_scores[gnn_addr_scores["address"].isin(train_addresses)]
    test_gnn = gnn_addr_scores[gnn_addr_scores["address"].isin(test_addresses)]

    # ── Compute anomaly features ──
    def add_anomaly(split_df):
        X = split_df[FEATURE_COLUMNS].replace([np.inf, -np.inf], np.nan).fillna(0)
        Xs = iforest_scaler.transform(X)
        scores = iforest.decision_function(Xs)
        out = split_df.copy()
        out["anomaly_score"] = scores
        out["anomaly_flag"] = (scores < ANOMALY_THRESHOLD).astype(int)
        return out

    # ── Build feature matrices ──
    def build_matrix(split_df, graph_df, gnn_df):
        out = add_anomaly(split_df)
        out["address"] = out["address"].astype(str)
        m = out.merge(graph_df, on="address", how="left")
        for c in GRAPH_COLUMNS:
            if c not in m.columns: m[c] = 0.0
        m = m.merge(gnn_df[["address", "gnn_score"]], on="address", how="left")
        for c in GNN_COLUMNS:
            if c not in m.columns: m[c] = 0.0
            m[c] = m[c].fillna(0.0)
        fc = FEATURE_COLUMNS + ANOMALY_COLUMNS + GRAPH_COLUMNS + GNN_COLUMNS
        X = m[fc].replace([np.inf, -np.inf], np.nan).fillna(0)
        y = m[LABEL_COLUMN].astype(int)
        return X, y

    X_train, y_train = build_matrix(train_df, train_graph, train_gnn)
    X_test, y_test = build_matrix(test_df, test_graph, test_gnn)
    feature_cols = list(X_train.columns)
    print(f"Feature matrix: train={X_train.shape}, test={X_test.shape}")

    # ── Cross-validation ──
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    rf_cv = RandomForestClassifier(**RF_PARAMS)
    cv_scores = cross_val_score(rf_cv, X_train, y_train, cv=cv, scoring="roc_auc", n_jobs=-1)
    print(f"CV ROC-AUC: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

    # ── Train final RF ──
    start = time.time()
    rf = RandomForestClassifier(**RF_PARAMS, verbose=1)
    rf.fit(X_train, y_train)
    train_time = time.time() - start

    y_pred = rf.predict(X_test)
    y_proba = rf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    roc = roc_auc_score(y_test, y_proba)

    print(f"\n{'='*60}")
    print(f"Accuracy={acc:.4f} Precision={prec:.4f} Recall={rec:.4f} F1={f1:.4f} ROC-AUC={roc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["Healthy", "Scam"], digits=4))

    # ── Save ──
    joblib.dump(rf, f"{model_dir}/random_forest.pkl")
    metrics = {
        "accuracy": round(acc, 4), "precision": round(prec, 4),
        "recall": round(rec, 4), "f1": round(f1, 4), "roc_auc": round(roc, 4),
        "cv_roc_auc_mean": round(float(cv_scores.mean()), 4),
        "training_time_seconds": round(train_time, 1),
        "n_train": len(X_train), "n_test": len(X_test),
        "n_features": len(feature_cols),
    }
    meta = {"model_type": "enriched_random_forest", "feature_columns": feature_cols, "metrics": metrics}
    with open(f"{model_dir}/random_forest_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    vol.commit()
    print("Stage 2+3 DONE ✅")
    return metrics


# ═══════════════════════════════════════════════════════════════════════
# Data upload helper
# ═══════════════════════════════════════════════════════════════════════

@app.function(image=cpu_image, volumes={VOL: vol}, timeout=1800)
def upload_file_to_vol(filename: str, content: bytes):
    os.makedirs(f"{VOL}/data", exist_ok=True)
    os.makedirs(f"{VOL}/models", exist_ok=True)
    path = f"{VOL}/data/{filename}"
    with open(path, "wb") as f:
        f.write(content)
    vol.commit()
    print(f"Uploaded {filename} ({len(content)/1e6:.1f} MB)")


@app.function(image=cpu_image, volumes={VOL: vol}, timeout=600)
def download_file_from_vol(filepath: str) -> bytes:
    with open(f"{VOL}/{filepath}", "rb") as f:
        return f.read()


# ═══════════════════════════════════════════════════════════════════════
# Local entrypoint
# ═══════════════════════════════════════════════════════════════════════

@app.local_entrypoint()
def main(command: str = "all"):
    import pathlib

    project_root = pathlib.Path(__file__).resolve().parent.parent
    data_dir = project_root / "data"
    model_dir = project_root / "models"

    if command in ("upload", "all"):
        print("\n📤 Uploading data to Modal volume...")
        files_to_upload = [
            "wallet_features_1M.csv",
            "wallet_features_labeled.csv",
            "wallet_edges.csv",
            "wallet_features_graph_hard.csv",
        ]
        for fname in files_to_upload:
            fpath = data_dir / fname
            if fpath.exists():
                print(f"  Uploading {fname} ({fpath.stat().st_size/1e6:.1f} MB)...")
                content = fpath.read_bytes()
                upload_file_to_vol.remote(fname, content)
            else:
                print(f"  ⚠️  Skipping {fname} (not found)")
        print("Upload complete ✅\n")

    if command in ("train", "all"):
        print("\n🔬 Stage 1: Training Isolation Forest (CPU)...")
        s1 = train_iforest_remote.remote()
        print(f"  Result: {s1}\n")

        print("🧠 Stage 2+3: Training RF + GNN (GPU)...")
        s2 = train_enriched_rf_remote.remote()
        print(f"  Result: {s2}\n")

    if command in ("download", "all"):
        print("\n📥 Downloading trained models...")
        model_dir.mkdir(exist_ok=True)
        model_files = [
            "models/isolation_forest.pkl",
            "models/iforest_scaler.pkl",
            "models/random_forest.pkl",
            "models/random_forest_meta.json",
            "models/gnn_model.pt",
            "models/gnn_scaler.pkl",
        ]
        for mf in model_files:
            fname = pathlib.Path(mf).name
            try:
                content = download_file_from_vol.remote(mf)
                (model_dir / fname).write_bytes(content)
                print(f"  ✅ {fname} ({len(content)/1e6:.1f} MB)")
            except Exception as e:
                print(f"  ⚠️  {fname}: {e}")
        print("Download complete ✅\n")

    print("🎉 All done!")

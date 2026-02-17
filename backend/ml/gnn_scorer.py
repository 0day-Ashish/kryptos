"""
gnn_scorer.py — Graph Neural Network (GCN) based wallet risk scoring.

Implements a lightweight Graph Convolutional Network using numpy that
learns node embeddings from the transaction graph topology and produces
a graph-aware anomaly score.  No GPU / PyTorch required.

Theory:
  Each GCN layer propagates & aggregates neighbor features through the
  adjacency matrix, so a node's final embedding encodes multi-hop
  structural context.  The anomaly score is computed by measuring how
  far a node's embedding deviates from the graph-level mean.
"""

import numpy as np
from typing import Dict, List, Any, Optional

try:
    from backend.ml.features import extract_wallet_features, FEATURE_COLUMNS
except ModuleNotFoundError:
    from ml.features import extract_wallet_features, FEATURE_COLUMNS


# ── GCN helpers ─────────────────────────────────────────────────────────────

def _relu(x: np.ndarray) -> np.ndarray:
    return np.maximum(0, x)


def _normalize_adj(A: np.ndarray) -> np.ndarray:
    """Symmetric normalisation: D^{-1/2} A D^{-1/2}."""
    A_hat = A + np.eye(A.shape[0])  # self-loops
    D = np.diag(A_hat.sum(axis=1))
    D_inv_sqrt = np.diag(1.0 / np.sqrt(np.maximum(D.diagonal(), 1e-12)))
    return D_inv_sqrt @ A_hat @ D_inv_sqrt


def _gcn_layer(H: np.ndarray, A_norm: np.ndarray, W: np.ndarray) -> np.ndarray:
    """Single GCN layer: H' = σ( A_norm · H · W )."""
    return _relu(A_norm @ H @ W)


# ── Core GNN Scorer ─────────────────────────────────────────────────────────

class GNNScorer:
    """
    Two-layer GCN that:
      1. Builds a local transaction graph (target + neighbors)
      2. Extracts per-node feature vectors
      3. Propagates features through the graph via GCN layers
      4. Produces an anomaly score for the target node
    """

    def __init__(
        self,
        hidden_dim: int = 32,
        embedding_dim: int = 16,
        n_layers: int = 2,
        seed: int = 42,
    ):
        self.hidden_dim = hidden_dim
        self.embedding_dim = embedding_dim
        self.n_layers = n_layers
        self.rng = np.random.RandomState(seed)
        # Weights are initialised lazily once we know input dim
        self._weights: List[np.ndarray] = []

    def _init_weights(self, input_dim: int):
        """Xavier-style weight initialisation for GCN layers."""
        dims = [input_dim, self.hidden_dim, self.embedding_dim]
        self._weights = []
        for i in range(self.n_layers):
            fan_in, fan_out = dims[i], dims[i + 1]
            scale = np.sqrt(2.0 / (fan_in + fan_out))
            W = self.rng.randn(fan_in, fan_out) * scale
            self._weights.append(W)

    # ── Public API ──────────────────────────────────────────────────────────

    def score(
        self,
        address: str,
        target_txns: list,
        neighbor_txns: Dict[str, list],
        chain_id: int = 1,
    ) -> Dict[str, Any]:
        """
        Run a GCN over the local transaction sub-graph centred on *address*.

        Returns a dict with:
          gnn_score       – 0-100 anomaly score (higher = more anomalous)
          gnn_embedding   – float list of the target's embedding
          graph_stats     – summary of the constructed graph
        """
        # 1. Build node list (target first)
        node_addrs = [address.lower()]
        for n in neighbor_txns:
            if n.lower() not in node_addrs:
                node_addrs.append(n.lower())
        addr_to_idx = {a: i for i, a in enumerate(node_addrs)}
        n_nodes = len(node_addrs)

        # 2. Feature matrix  (n_nodes × n_features)
        features_list = [extract_wallet_features(address, target_txns, chain_id)]
        for n_addr in node_addrs[1:]:
            n_txns = neighbor_txns.get(n_addr, [])
            features_list.append(extract_wallet_features(n_addr, n_txns, chain_id))

        X = np.array(
            [[f.get(col, 0) for col in FEATURE_COLUMNS] for f in features_list],
            dtype=np.float64,
        )
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

        # Standardise column-wise
        col_mean = X.mean(axis=0)
        col_std = X.std(axis=0)
        col_std[col_std < 1e-12] = 1.0
        X = (X - col_mean) / col_std

        # 3. Adjacency matrix from target_txns edges
        A = np.zeros((n_nodes, n_nodes), dtype=np.float64)
        for tx in target_txns:
            src = tx.get("from", "").lower()
            dst = tx.get("to", "").lower()
            i = addr_to_idx.get(src)
            j = addr_to_idx.get(dst)
            if i is not None and j is not None:
                value = max(float(int(tx.get("value", 0)) / 1e18), 0.01)
                A[i, j] += value
                A[j, i] += value  # undirected for message passing

        # Also add edges from neighbor txns
        for n_addr, n_txns in neighbor_txns.items():
            for tx in n_txns:
                src = tx.get("from", "").lower()
                dst = tx.get("to", "").lower()
                i = addr_to_idx.get(src)
                j = addr_to_idx.get(dst)
                if i is not None and j is not None and i != j:
                    value = max(float(int(tx.get("value", 0)) / 1e18), 0.01)
                    A[i, j] += value
                    A[j, i] += value

        # Log-transform edge weights to reduce skew
        A = np.log1p(A)

        A_norm = _normalize_adj(A)

        # 4. Run GCN
        self._init_weights(X.shape[1])
        H = X.copy()
        for W in self._weights:
            H = _gcn_layer(H, A_norm, W)

        # H is now (n_nodes × embedding_dim)
        target_emb = H[0]

        # 5. Anomaly score — Mahalanobis-like deviation from graph mean
        graph_mean = H.mean(axis=0)
        graph_cov = np.cov(H.T) if n_nodes > 2 else np.eye(H.shape[1])
        # Regularize covariance
        graph_cov += np.eye(graph_cov.shape[0]) * 1e-6

        diff = target_emb - graph_mean
        try:
            cov_inv = np.linalg.inv(graph_cov)
            mahal_dist = float(np.sqrt(diff @ cov_inv @ diff))
        except np.linalg.LinAlgError:
            # Fallback to L2 distance
            mahal_dist = float(np.linalg.norm(diff))

        # Also compute cosine distance from mean
        cos_sim = float(
            np.dot(target_emb, graph_mean)
            / (np.linalg.norm(target_emb) * np.linalg.norm(graph_mean) + 1e-12)
        )
        cosine_anomaly = 1.0 - cos_sim  # 0 = identical, 2 = opposite

        # Degree centrality anomaly
        degree = A[0].sum()
        avg_degree = A.sum(axis=1).mean() if n_nodes > 1 else degree
        degree_ratio = degree / max(avg_degree, 1e-12)

        # Combine into 0-100 score
        # Mahalanobis: typical range [0, 10], map to [0, 50]
        mahal_component = min(mahal_dist / 10.0 * 50, 50)
        # Cosine: range [0, 2], map to [0, 30]
        cosine_component = min(cosine_anomaly / 2.0 * 30, 30)
        # Degree ratio extremes: map to [0, 20]
        if degree_ratio > 3.0 or degree_ratio < 0.3:
            degree_component = min(abs(degree_ratio - 1.0) * 10, 20)
        else:
            degree_component = 0

        raw_score = mahal_component + cosine_component + degree_component
        gnn_score = int(np.clip(raw_score, 0, 100))

        return {
            "gnn_score": gnn_score,
            "gnn_embedding": target_emb.tolist(),
            "mahalanobis_distance": round(mahal_dist, 4),
            "cosine_anomaly": round(cosine_anomaly, 4),
            "degree_ratio": round(degree_ratio, 4),
            "graph_stats": {
                "n_nodes": n_nodes,
                "n_edges": int((A > 0).sum() // 2),
                "avg_degree": round(float(avg_degree), 2),
                "target_degree": round(float(degree), 2),
            },
        }


# Singleton
gnn_scorer = GNNScorer()

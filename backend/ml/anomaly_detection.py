"""
anomaly_detection.py — Isolation-Forest-based unsupervised anomaly detection.

WHY Isolation Forest?
1. It is *unsupervised* — no labeled "normal" vs "anomalous" wallets are needed.
2. It is *fast* on CPU (O(n·t·log(ψ)) where t = trees, ψ = sub-sample size).
3. It isolates anomalies *directly* instead of profiling normal behavior first,
   which is exactly right when we expect anomalies to be sparse and structurally
   different from the majority.
4. It naturally handles the mixed feature scales after our StandardScaler step.

Alternatives like LOF or DBSCAN were considered but:
- LOF is O(n²) with default ball-tree; doesn't scale past ~100k wallets.
- DBSCAN conflates density with anomaly which is less interpretable here.

The output is a per-wallet anomaly score in [-1, 1] (sklearn convention:
negative = more anomalous) which we invert and rescale to [0, 1] for
downstream readability (1 = most anomalous).
"""

from typing import Tuple
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest

from .features import FEATURE_COLUMNS


def scale_features(df: pd.DataFrame) -> Tuple[np.ndarray, StandardScaler]:
    """
    Apply z-score standardisation so no single feature dominates the model
    due to its raw magnitude (e.g. total_in_amount in ETH vs in_degree counts).

    Returns the scaled matrix and the fitted scaler (for future inverse transforms
    or new-data transforms).
    """
    scaler = StandardScaler()
    X = scaler.fit_transform(df[FEATURE_COLUMNS].values)
    return X, scaler


def train_isolation_forest(
    X: np.ndarray,
    contamination: float = 0.15,
    n_estimators: int = 200,
    random_state: int = 42,
) -> IsolationForest:
    """
    Train an Isolation Forest on the scaled feature matrix.

    Parameters
    ----------
    X : np.ndarray
        Scaled feature matrix (n_wallets × n_features).
    contamination : float
        Expected proportion of outliers.  0.15 is a reasonable starting point
        for blockchain data where ~10-20 % of wallets in a suspicious
        neighborhood may be anomalous.  This is configurable.
    n_estimators : int
        Number of isolation trees.  200 gives stable scores without being slow.
    random_state : int
        Reproducibility.

    Returns
    -------
    IsolationForest
        Fitted model.
    """
    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
        # max_samples="auto" uses min(256, n_samples) — fine for our scale.
        max_samples="auto",
        n_jobs=-1,  # use all CPU cores
    )
    model.fit(X)
    return model


def compute_anomaly_scores(
    model: IsolationForest, X: np.ndarray, df: pd.DataFrame
) -> pd.DataFrame:
    """
    Compute per-wallet anomaly scores and binary labels.

    Scores are rescaled from sklearn's convention (negative = anomalous)
    to [0, 1] where **1 = most anomalous**.

    The rescaling is:  score = (1 − raw_score) / 2
    This maps  raw_score ∈ [-1, 1]  →  score ∈ [0, 1]  monotonically
    in the anomaly direction.

    Returns a copy of `df` with two new columns:
        anomaly_score  : float ∈ [0, 1]
        is_anomalous   : bool  (True if model labels as -1)
    """
    raw_scores = model.decision_function(X)   # higher = more normal
    labels = model.predict(X)                  # +1 normal, -1 anomaly

    # Rescale so 1 = most anomalous.
    rescaled = (1.0 - raw_scores) / 2.0
    # Clip to [0,1] for safety (extreme values possible with sparse data).
    rescaled = np.clip(rescaled, 0.0, 1.0)

    result = df.copy()
    result["anomaly_score"] = rescaled
    result["is_anomalous"] = labels == -1
    return result


def detect_anomalies(
    df: pd.DataFrame,
    contamination: float = 0.15,
    n_estimators: int = 200,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, IsolationForest, StandardScaler]:
    """
    End-to-end convenience: scale → train → score.

    Returns
    -------
    scored_df : pd.DataFrame  — original features + anomaly_score + is_anomalous
    model     : IsolationForest
    scaler    : StandardScaler
    """
    X, scaler = scale_features(df)
    model = train_isolation_forest(X, contamination, n_estimators, random_state)
    scored_df = compute_anomaly_scores(model, X, df)
    return scored_df, model, scaler

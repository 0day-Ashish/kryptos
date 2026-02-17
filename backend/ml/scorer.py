"""
ML-based wallet risk scoring using Isolation Forest + heuristic boosting.
"""
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler
from .features import extract_wallet_features, FEATURE_COLUMNS


class WalletScorer:
    """Scores a single wallet using Isolation Forest anomaly detection + heuristic rules."""

    def __init__(self):
        self.model = IsolationForest(
            n_estimators=200,
            contamination=0.15,
            max_features=0.8,
            random_state=42,
            n_jobs=-1,
        )
        self.scaler = RobustScaler()
        self._is_fitted = False

    def score_wallet(
        self,
        address: str,
        target_txns: list,
        neighbor_txns: dict,
        chain_id: int = 1,
    ) -> dict:
        """
        Score a wallet by:
        1. Building features for target + its neighbors
        2. Fitting Isolation Forest on the local neighborhood
        3. Extracting anomaly score for the target
        4. Applying heuristic boosts for known scam patterns
        """
        # Extract features for target
        target_features = extract_wallet_features(address, target_txns, chain_id)

        # Extract features for neighbors to give the model context
        all_features = [target_features]
        for neighbor_addr, neighbor_tx_list in neighbor_txns.items():
            nf = extract_wallet_features(neighbor_addr, neighbor_tx_list, chain_id)
            all_features.append(nf)

        # Build feature matrix
        X = np.array([[f.get(col, 0) for col in FEATURE_COLUMNS] for f in all_features])

        # Replace any NaN/inf with 0
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

        # Need at least some variation for the model
        if X.shape[0] < 5:
            # Pad with synthetic "normal" noise so model has something to contrast
            normal_mean = np.mean(X, axis=0)
            rng = np.random.RandomState(42)
            noise = rng.normal(0, 0.1, size=(10, X.shape[1]))
            col_std = np.std(X, axis=0)
            col_std = np.where(col_std < 0.01, 0.01, col_std)
            synthetic = np.abs(normal_mean + noise * col_std)
            X = np.vstack([X, synthetic])

        # Scale
        X_scaled = self.scaler.fit_transform(X)
        X_scaled = np.nan_to_num(X_scaled, nan=0.0, posinf=0.0, neginf=0.0)

        # Fit and score
        self.model.fit(X_scaled)
        self._is_fitted = True

        # decision_function: lower = more anomalous (typically negative for outliers)
        raw_scores = self.model.decision_function(X_scaled)
        target_raw = raw_scores[0]

        # Normalize to 0-100 (higher = more risky)
        score_min = float(np.min(raw_scores))
        score_max = float(np.max(raw_scores))
        score_range = score_max - score_min if score_max != score_min else 1.0
        ml_score = (1 - (target_raw - score_min) / score_range) * 100
        ml_score = float(np.clip(ml_score, 0, 100))

        # Heuristic boosts
        heuristic_boost = self._compute_heuristic_boost(target_features)

        # Combine: 70% ML + 30% heuristics
        final_score = int(np.clip(ml_score * 0.7 + heuristic_boost * 0.3, 0, 100))

        # Label
        if final_score >= 75:
            label = "High Risk"
        elif final_score >= 40:
            label = "Medium Risk"
        else:
            label = "Low Risk"

        # Flags
        flags = self._generate_flags(target_features, final_score)

        return {
            "risk_score": final_score,
            "risk_label": label,
            "ml_raw_score": round(float(ml_score), 2),
            "heuristic_score": round(float(heuristic_boost), 2),
            "flags": flags,
            "feature_summary": {
                "tx_count": target_features["tx_count"],
                "unique_counterparties": target_features["unique_counterparties"],
                "total_sent_eth": round(target_features["total_sent_eth"], 4),
                "total_recv_eth": round(target_features["total_recv_eth"], 4),
                "active_days": target_features["active_days"],
                "burst_ratio": round(target_features["burst_ratio"], 3),
                "round_value_ratio": round(target_features["round_value_ratio"], 3),
                "self_transfers": target_features["self_transfers"],
                "failed_tx_ratio": round(target_features["failed_tx_ratio"], 3),
                "contract_call_ratio": round(target_features["contract_call_ratio"], 3),
            },
            "neighbors_analyzed": len(neighbor_txns),
        }

    def _compute_heuristic_boost(self, f: dict) -> float:
        """Rule-based risk score 0-100 based on known scam patterns."""
        score = 0.0

        # High round-value ratio -> potential laundering
        if f["round_value_ratio"] > 0.6:
            score += 20
        elif f["round_value_ratio"] > 0.3:
            score += 10

        # Burst transactions -> automated behavior
        if f["burst_ratio"] > 0.5:
            score += 25
        elif f["burst_ratio"] > 0.2:
            score += 10

        # Self-transfers -> common in mixers
        if f["self_transfers"] > 3:
            score += 15
        elif f["self_transfers"] > 0:
            score += 5

        # Very high send/recv ratio -> draining pattern
        if f["flow_ratio"] > 5:
            score += 20
        elif f["flow_ratio"] > 2:
            score += 10

        # High failed tx ratio -> possible spam/attack
        if f["failed_tx_ratio"] > 0.3:
            score += 15

        # Few counterparties but many txns -> cycling
        if f["tx_count"] > 20 and f["unique_counterparties"] < 5:
            score += 15

        # Short lifespan + high volume -> hit-and-run
        if f["lifespan_days"] < 7 and f["tx_count"] > 30:
            score += 20

        # New wallet with large values
        if f["lifespan_days"] < 3 and f["max_value"] > 10:
            score += 15

        return min(score, 100)

    def _generate_flags(self, f: dict, score: int) -> list:
        """Generate human-readable risk flags."""
        flags = []

        if f["burst_ratio"] > 0.3:
            flags.append("Rapid-fire transactions detected (possible bot)")
        if f["round_value_ratio"] > 0.5:
            flags.append("High ratio of round-number transfers (laundering pattern)")
        if f["self_transfers"] > 0:
            flags.append(f"{f['self_transfers']} self-transfer(s) detected")
        if f["flow_ratio"] > 3:
            flags.append("Wallet is a net sender (draining pattern)")
        if f["failed_tx_ratio"] > 0.2:
            flags.append("High transaction failure rate")
        if f["tx_count"] > 20 and f["unique_counterparties"] < 5:
            flags.append("Transaction cycling — few counterparties, many txns")
        if f["lifespan_days"] < 7 and f["tx_count"] > 30:
            flags.append("New wallet with unusually high activity")
        if f["contract_call_ratio"] > 0.8:
            flags.append("Primarily interacts with contracts")
        if score < 25:
            flags.append("No significant anomalies detected")

        return flags


# Singleton
wallet_scorer = WalletScorer()

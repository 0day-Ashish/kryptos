"""
temporal_anomaly.py — Time-series anomaly detection on transaction activity.

Implements a lightweight regime-change detector using:
  · Z-score deviation from rolling statistics
  · CUSUM (cumulative sum) change-point detection
  · Exponential moving average (EMA) regime tracking
  · Burst-interval analysis

No LSTM/Transformer dependency — uses numpy for portability.
"""

import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import defaultdict


# ── Helpers ─────────────────────────────────────────────────────────────────

def _to_daily_series(transactions: list, address: str) -> Dict[str, Dict]:
    """Aggregate raw transactions into daily buckets."""
    address = address.lower()
    buckets: Dict[str, Dict] = {}

    for tx in transactions:
        ts = int(tx.get("timeStamp", 0))
        if ts == 0:
            continue
        day = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        if day not in buckets:
            buckets[day] = {
                "date": day,
                "tx_count": 0,
                "volume": 0.0,
                "in_count": 0,
                "out_count": 0,
                "gas_total": 0.0,
                "unique_addrs": set(),
            }
        b = buckets[day]
        b["tx_count"] += 1
        val = int(tx.get("value", 0)) / 1e18
        b["volume"] += val
        b["gas_total"] += int(tx.get("gasUsed", 0)) * int(tx.get("gasPrice", 0)) / 1e18

        tx_from = tx.get("from", "").lower()
        tx_to = tx.get("to", "").lower()
        if tx_from == address:
            b["out_count"] += 1
            if tx_to:
                b["unique_addrs"].add(tx_to)
        else:
            b["in_count"] += 1
            if tx_from:
                b["unique_addrs"].add(tx_from)

    # Serialise sets
    for d in buckets.values():
        d["unique_addrs"] = len(d["unique_addrs"])

    return dict(sorted(buckets.items()))


def _fill_gaps(series: List[Dict], key: str = "tx_count") -> np.ndarray:
    """Convert daily series to contiguous array, filling gaps with 0."""
    if not series:
        return np.array([])
    dates = sorted(series, key=lambda x: x["date"])
    return np.array([d.get(key, 0) for d in dates], dtype=np.float64)


# ── Detectors ───────────────────────────────────────────────────────────────

def _zscore_anomalies(
    y: np.ndarray,
    window: int = 7,
    threshold: float = 2.5,
) -> List[Dict]:
    """Detect days where activity deviates >threshold σ from rolling mean."""
    if len(y) < window + 1:
        return []

    anomalies = []
    for i in range(window, len(y)):
        win = y[i - window : i]
        mu = win.mean()
        sigma = win.std()
        if sigma < 1e-12:
            continue
        z = (y[i] - mu) / sigma
        if abs(z) >= threshold:
            anomalies.append({
                "index": int(i),
                "z_score": round(float(z), 3),
                "value": float(y[i]),
                "rolling_mean": round(float(mu), 3),
                "type": "spike" if z > 0 else "drop",
            })
    return anomalies


def _cusum(
    y: np.ndarray,
    drift: float = 0.5,
    threshold: float = 5.0,
) -> List[Dict]:
    """
    Cumulative Sum change-point detection.
    Returns indices where a regime shift is detected.
    """
    if len(y) < 5:
        return []

    mu = y.mean()
    sigma = y.std()
    if sigma < 1e-12:
        return []

    # Normalise
    y_norm = (y - mu) / sigma

    s_pos = np.zeros(len(y_norm))
    s_neg = np.zeros(len(y_norm))
    changepoints = []

    for i in range(1, len(y_norm)):
        s_pos[i] = max(0, s_pos[i - 1] + y_norm[i] - drift)
        s_neg[i] = max(0, s_neg[i - 1] - y_norm[i] - drift)

        if s_pos[i] > threshold:
            changepoints.append({
                "index": int(i),
                "direction": "increase",
                "cumsum": round(float(s_pos[i]), 3),
            })
            s_pos[i] = 0  # reset after detection

        if s_neg[i] > threshold:
            changepoints.append({
                "index": int(i),
                "direction": "decrease",
                "cumsum": round(float(s_neg[i]), 3),
            })
            s_neg[i] = 0

    return changepoints


def _ema_regimes(
    y: np.ndarray,
    short_span: int = 3,
    long_span: int = 10,
) -> List[Dict]:
    """
    Detect regime changes via EMA crossovers.
    When short EMA crosses above long EMA → upward regime, and vice versa.
    """
    if len(y) < long_span + 2:
        return []

    alpha_s = 2.0 / (short_span + 1)
    alpha_l = 2.0 / (long_span + 1)

    ema_short = np.zeros(len(y))
    ema_long = np.zeros(len(y))
    ema_short[0] = y[0]
    ema_long[0] = y[0]

    for i in range(1, len(y)):
        ema_short[i] = alpha_s * y[i] + (1 - alpha_s) * ema_short[i - 1]
        ema_long[i] = alpha_l * y[i] + (1 - alpha_l) * ema_long[i - 1]

    regimes = []
    prev_above = ema_short[long_span] > ema_long[long_span]
    for i in range(long_span + 1, len(y)):
        above = ema_short[i] > ema_long[i]
        if above != prev_above:
            regimes.append({
                "index": int(i),
                "new_regime": "high_activity" if above else "low_activity",
                "ema_short": round(float(ema_short[i]), 3),
                "ema_long": round(float(ema_long[i]), 3),
            })
        prev_above = above

    return regimes


def _burst_intervals(transactions: list, address: str, threshold_seconds: int = 300) -> Dict:
    """Analyse rapid-fire transaction bursts (< threshold_seconds apart)."""
    address = address.lower()
    timestamps = sorted(
        [int(tx.get("timeStamp", 0)) for tx in transactions if tx.get("timeStamp")],
    )
    if len(timestamps) < 2:
        return {"burst_count": 0, "longest_burst": 0, "avg_burst_gap": 0}

    diffs = np.diff(timestamps)
    is_burst = diffs < threshold_seconds
    burst_count = int(is_burst.sum())

    # Find longest consecutive burst
    max_streak = 0
    current = 0
    for b in is_burst:
        if b:
            current += 1
            max_streak = max(max_streak, current)
        else:
            current = 0

    burst_gaps = diffs[is_burst]
    avg_gap = float(burst_gaps.mean()) if len(burst_gaps) > 0 else 0

    return {
        "burst_count": burst_count,
        "longest_burst": max_streak + 1,  # number of txns in longest burst
        "avg_burst_gap_sec": round(avg_gap, 1),
        "burst_pct": round(burst_count / len(diffs) * 100, 1) if len(diffs) > 0 else 0,
    }


# ── Public API ──────────────────────────────────────────────────────────────

def detect_temporal_anomalies(
    address: str,
    transactions: list,
) -> Dict[str, Any]:
    """
    Full temporal anomaly analysis on a wallet's transaction history.

    Returns:
      zscore_anomalies   – list of days with unusual spikes/drops
      changepoints       – list of regime-change indices (CUSUM)
      regime_shifts      – list of EMA crossover events
      burst_analysis     – rapid-fire transaction statistics
      temporal_risk      – 0-100 composite temporal risk score
      daily_series       – the aggregated daily data (for frontend charts)
    """
    daily = _to_daily_series(transactions, address)
    daily_list = list(daily.values())

    tx_counts = _fill_gaps(daily_list, "tx_count")
    volumes = _fill_gaps(daily_list, "volume")

    # Run detectors on tx_count series
    z_anomalies = _zscore_anomalies(tx_counts, window=7, threshold=2.5)
    cp_txcount = _cusum(tx_counts, drift=0.5, threshold=5.0)
    regimes = _ema_regimes(tx_counts, short_span=3, long_span=10)

    # Also detect volume anomalies
    z_volume = _zscore_anomalies(volumes, window=7, threshold=2.0)
    cp_volume = _cusum(volumes, drift=0.5, threshold=4.0)

    bursts = _burst_intervals(transactions, address)

    # Map indices back to dates
    dates = [d["date"] for d in daily_list]
    for a in z_anomalies:
        a["date"] = dates[a["index"]] if a["index"] < len(dates) else None
    for a in z_volume:
        a["date"] = dates[a["index"]] if a["index"] < len(dates) else None
    for c in cp_txcount:
        c["date"] = dates[c["index"]] if c["index"] < len(dates) else None
    for c in cp_volume:
        c["date"] = dates[c["index"]] if c["index"] < len(dates) else None
    for r in regimes:
        r["date"] = dates[r["index"]] if r["index"] < len(dates) else None

    # ── Composite temporal risk score ───────────────────────────────────
    score = 0.0

    # Spikes contribute 5 pts each (max 25)
    score += min(len(z_anomalies) * 5, 25)

    # Volume anomalies contribute 5 pts each (max 20)
    score += min(len(z_volume) * 5, 20)

    # Changepoints contribute 8 pts each (max 20)
    score += min((len(cp_txcount) + len(cp_volume)) * 8, 20)

    # Regime shifts contribute 5 pts each (max 15)
    score += min(len(regimes) * 5, 15)

    # Burst contribution (max 20)
    if bursts["burst_pct"] > 50:
        score += 20
    elif bursts["burst_pct"] > 25:
        score += 12
    elif bursts["burst_pct"] > 10:
        score += 6

    temporal_score = int(min(score, 100))

    return {
        "temporal_risk_score": temporal_score,
        "zscore_anomalies": z_anomalies,
        "volume_anomalies": z_volume,
        "changepoints_txcount": cp_txcount,
        "changepoints_volume": cp_volume,
        "regime_shifts": regimes,
        "burst_analysis": bursts,
        "days_analyzed": len(daily_list),
        "total_days_span": len(dates),
        "daily_series": daily_list,
    }

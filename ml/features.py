"""
features.py — Feature column definitions for the Kryptos training pipeline.

Two column sets are maintained:
    1. RAW_COLUMNS       — the exact column names from the BigQuery export CSV.
    2. FEATURE_COLUMNS   — the cleaned, pipeline-standard names used by both
                           Isolation Forest and Random Forest.

A mapping (RAW_TO_FEATURE_MAP) translates from (1) → (2) so the rest of the
pipeline only ever sees FEATURE_COLUMNS.
"""

# ══════════════════════════════════════════════════════════════════════════════
# Raw column names — as they appear in wallet_features_1M.csv from BigQuery
# ══════════════════════════════════════════════════════════════════════════════
RAW_COLUMNS = [
    "out_tx_count",
    "in_tx_count",
    "total_tx_count",
    "unique_receivers",
    "unique_senders",
    "total_out_volume",       # in wei
    "total_in_volume",        # in wei
    "total_volume",           # in wei
    "lifetime_seconds",
    "tx_frequency",
    "counterparty_ratio",
    "out_in_volume_ratio",
    "pass_through_ratio",
]

# ══════════════════════════════════════════════════════════════════════════════
# Pipeline-standard feature names (what the models see)
# ══════════════════════════════════════════════════════════════════════════════
FEATURE_COLUMNS = [
    "fan_out",                    # unique_receivers  → fan_out
    "fan_in",                     # unique_senders    → fan_in
    "total_out",                  # total_out_volume  → total_out  (converted to ETH)
    "total_in",                   # total_in_volume   → total_in   (converted to ETH)
    "total_volume",               # total_volume      → total_volume (converted to ETH)
    "out_tx_count",               # kept as-is
    "in_tx_count",                # kept as-is
    "total_tx_count",             # kept as-is
    "lifetime_seconds",           # kept as-is
    "tx_frequency",               # kept as-is
    "counterparty_ratio",         # kept as-is
    "out_in_volume_ratio",        # kept as-is
    "pass_through_ratio",         # kept as-is
]

# ══════════════════════════════════════════════════════════════════════════════
# Mapping: raw CSV column name → pipeline feature name
# Only entries that differ need to be listed; identical names are identity-mapped.
# ══════════════════════════════════════════════════════════════════════════════
RAW_TO_FEATURE_MAP = {
    "unique_receivers":  "fan_out",
    "unique_senders":    "fan_in",
    "total_out_volume":  "total_out",
    "total_in_volume":   "total_in",
    # columns with same name in both are mapped automatically
}

# Columns whose raw values are in wei and need ÷ 1e18 to convert to ETH
WEI_COLUMNS = [
    "total_out_volume",
    "total_in_volume",
    "total_volume",
]

# ══════════════════════════════════════════════════════════════════════════════
# Columns added by Stage 1 (Isolation Forest)
# ══════════════════════════════════════════════════════════════════════════════
ANOMALY_COLUMNS = [
    "anomaly_score",
    "anomaly_flag",
]

# ══════════════════════════════════════════════════════════════════════════════
# Label column in supervised data (Stage 2)
# ══════════════════════════════════════════════════════════════════════════════
LABEL_COLUMN = "label"

# ══════════════════════════════════════════════════════════════════════════════
# Anomaly threshold: wallets with decision_function score < this are flagged.
# 0.0 is the natural decision boundary for Isolation Forest.
# ══════════════════════════════════════════════════════════════════════════════
ANOMALY_THRESHOLD = 0.0

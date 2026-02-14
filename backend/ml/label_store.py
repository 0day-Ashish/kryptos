"""
label_store.py — Manages known wallet labels from multiple sources.

WHY a label store?
Unsupervised detection finds anomalies but doesn't know if they're truly
malicious.  By incorporating known labels from free public sources, we can:

1. **Boost confidence** — if an anomalous wallet is ALSO on a sanctions list,
   the risk score should be much higher.
2. **Reduce false positives** — if a high-degree wallet is a known exchange
   (Binance, Coinbase), we can suppress it.
3. **Bootstrap supervised learning** — as labels accumulate (from public
   sources + analyst reviews), we can train a classifier alongside IF.

The label store is source-agnostic: it merges labels from OFAC, Etherscan,
community databases, and manual analyst input into a single lookup table.

Label schema:
    wallet  →  {
        "label":    "fraud" | "legit" | "exchange" | "sanctioned" | "scam",
        "source":   "ofac" | "etherscan" | "analyst" | "community",
        "confidence": float 0-1
    }
"""

import json
import os
from typing import Dict, Optional, Any, List


# Canonical label categories (ordered by severity).
LABEL_FRAUD = "fraud"
LABEL_SCAM = "scam"
LABEL_SANCTIONED = "sanctioned"
LABEL_SUSPICIOUS = "suspicious"
LABEL_LEGIT = "legit"
LABEL_EXCHANGE = "exchange"

# Labels that indicate badness (used for risk boosting).
MALICIOUS_LABELS = {LABEL_FRAUD, LABEL_SCAM, LABEL_SANCTIONED, LABEL_SUSPICIOUS}
# Labels that indicate known-good (used for suppression).
BENIGN_LABELS = {LABEL_LEGIT, LABEL_EXCHANGE}


class LabelStore:
    """
    In-memory store of known wallet labels.
    Supports loading from files, adding programmatically, and querying.
    """

    def __init__(self):
        # wallet_address (lowercase) → dict with label, source, confidence
        self._labels: Dict[str, Dict[str, Any]] = {}

    @property
    def size(self) -> int:
        return len(self._labels)

    def add(
        self,
        wallet: str,
        label: str,
        source: str = "unknown",
        confidence: float = 1.0,
    ) -> None:
        """Add or update a label.  Higher confidence wins on conflict."""
        wallet = wallet.lower().strip()
        existing = self._labels.get(wallet)

        if existing is None or confidence > existing["confidence"]:
            self._labels[wallet] = {
                "label": label,
                "source": source,
                "confidence": confidence,
            }

    def add_batch(self, entries: List[Dict[str, Any]]) -> int:
        """
        Add multiple labels at once.
        Each entry: {"wallet": str, "label": str, "source": str, "confidence": float}
        Returns count of labels added/updated.
        """
        count = 0
        for entry in entries:
            self.add(
                wallet=entry["wallet"],
                label=entry["label"],
                source=entry.get("source", "unknown"),
                confidence=entry.get("confidence", 1.0),
            )
            count += 1
        return count

    def get(self, wallet: str) -> Optional[Dict[str, Any]]:
        """Look up a wallet's label.  Returns None if unknown."""
        return self._labels.get(wallet.lower().strip())

    def is_malicious(self, wallet: str) -> bool:
        """Check if a wallet has a known malicious label."""
        entry = self.get(wallet)
        return entry is not None and entry["label"] in MALICIOUS_LABELS

    def is_benign(self, wallet: str) -> bool:
        """Check if a wallet has a known benign label."""
        entry = self.get(wallet)
        return entry is not None and entry["label"] in BENIGN_LABELS

    def get_all_malicious(self) -> Dict[str, Dict[str, Any]]:
        """Return all wallets with malicious labels."""
        return {
            w: info for w, info in self._labels.items()
            if info["label"] in MALICIOUS_LABELS
        }

    def get_all_benign(self) -> Dict[str, Dict[str, Any]]:
        """Return all wallets with benign labels."""
        return {
            w: info for w, info in self._labels.items()
            if info["label"] in BENIGN_LABELS
        }

    def save(self, filepath: str) -> None:
        """Persist labels to a JSON file."""
        with open(filepath, "w") as f:
            json.dump(self._labels, f, indent=2)

    def load(self, filepath: str) -> int:
        """
        Load labels from a JSON file.
        File format: { "wallet_address": {"label": ..., "source": ..., "confidence": ...} }
        Returns count of labels loaded.
        """
        if not os.path.exists(filepath):
            return 0

        with open(filepath, "r") as f:
            data = json.load(f)

        count = 0
        for wallet, info in data.items():
            self.add(
                wallet=wallet,
                label=info["label"],
                source=info.get("source", "file"),
                confidence=info.get("confidence", 1.0),
            )
            count += 1
        return count

    def summary(self) -> Dict[str, int]:
        """Count labels by category."""
        counts: Dict[str, int] = {}
        for info in self._labels.values():
            label = info["label"]
            counts[label] = counts.get(label, 0) + 1
        return counts

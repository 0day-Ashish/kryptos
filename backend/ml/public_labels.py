"""
public_labels.py — Fetch known wallet labels from free public sources.

This module provides functions to ingest labels from:

1. **OFAC SDN List** — US Treasury's Office of Foreign Assets Control publishes
   sanctioned crypto addresses.  Downloadable as XML/CSV for free.
   https://sanctionslist.ofac.treas.gov/

2. **Etherscan Label Cloud** — Etherscan publicly tags some addresses
   (exchanges, phishing, exploit contracts).  No bulk API, but we can
   use the free account API to check individual addresses.

3. **Community Databases** — Curated lists of known scam/rug-pull addresses
   maintained by the crypto security community (e.g., CryptoScamDB,
   chainabuse.com reports).  We support loading these as JSON/CSV.

4. **Manual Analyst Labels** — A simple JSON file where a human analyst
   records their review of flagged wallets.

All fetchers return data in a uniform format that the LabelStore can ingest.

NOTE: Network fetches may fail (rate limits, downtime).  Every function
gracefully returns an empty list on error — the pipeline still runs,
just without that label source.
"""

import json
import csv
import os
import io
from typing import List, Dict, Any

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

from .label_store import (
    LabelStore,
    LABEL_SANCTIONED,
    LABEL_SCAM,
    LABEL_EXCHANGE,
    LABEL_FRAUD,
    LABEL_LEGIT,
)


# -----------------------------------------------------------------------
# 1. OFAC Sanctioned Addresses
# -----------------------------------------------------------------------

# OFAC publishes a consolidated XML/CSV list.  The "Digital Currency Address"
# entries contain sanctioned wallet addresses.  We parse the CSV variant
# because it's simpler.

OFAC_SDN_CSV_URL = (
    "https://www.treasury.gov/ofac/downloads/sdn.csv"
)

# Known OFAC-sanctioned crypto addresses (hardcoded subset for offline use).
# These are PUBLIC, from official US government press releases.
# Last updated from OFAC publications — a small representative sample.
OFAC_HARDCODED: List[Dict[str, Any]] = [
    # Tornado Cash (sanctioned Aug 2022, OFAC)
    {"wallet": "0x8589427373d6d84e98730d7795d8f6f8731fda16", "label": LABEL_SANCTIONED, "source": "ofac", "confidence": 1.0},
    {"wallet": "0x722122df12d4e14e13ac3b6895a86e84145b6967", "label": LABEL_SANCTIONED, "source": "ofac", "confidence": 1.0},
    {"wallet": "0xdd4c48c0b24039969fc16d1cdf626eab821d3384", "label": LABEL_SANCTIONED, "source": "ofac", "confidence": 1.0},
    {"wallet": "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b", "label": LABEL_SANCTIONED, "source": "ofac", "confidence": 1.0},
    {"wallet": "0xd96f2b1ef156b3df97de4fce3dab63b7dfce7305", "label": LABEL_SANCTIONED, "source": "ofac", "confidence": 1.0},
    # Lazarus Group / DPRK-linked (various OFAC actions)
    {"wallet": "0x098b716b8aaf21512996dc57eb0615e2383e2f96", "label": LABEL_SANCTIONED, "source": "ofac", "confidence": 1.0},
    {"wallet": "0xa7e5d5a720f06526557c513402f2e6b5fa20b008", "label": LABEL_SANCTIONED, "source": "ofac", "confidence": 1.0},
    # Garantex exchange (sanctioned Apr 2022)
    {"wallet": "0x6f1ca141a28907f78ebaa64f83d4e6f1add18025", "label": LABEL_SANCTIONED, "source": "ofac", "confidence": 1.0},
]


def fetch_ofac_labels(use_hardcoded: bool = True) -> List[Dict[str, Any]]:
    """
    Fetch OFAC-sanctioned crypto addresses.

    Parameters
    ----------
    use_hardcoded : bool
        If True (default), return the hardcoded subset immediately (no network).
        If False, attempt to download the full SDN CSV from treasury.gov.

    Returns
    -------
    list of label dicts ready for LabelStore.add_batch()
    """
    if use_hardcoded:
        return OFAC_HARDCODED.copy()

    if not HAS_REQUESTS:
        print("    [OFAC] 'requests' not installed — using hardcoded list.")
        return OFAC_HARDCODED.copy()

    try:
        resp = requests.get(OFAC_SDN_CSV_URL, timeout=15)
        resp.raise_for_status()

        labels: List[Dict[str, Any]] = []
        reader = csv.reader(io.StringIO(resp.text))
        for row in reader:
            # SDN CSV format: the "Digital Currency Address" id type
            # appears in the remarks/alt-names columns.
            line = ",".join(row).lower()
            if "digital currency address" in line:
                # Extract hex addresses from the line.
                for token in line.split():
                    token = token.strip(",;()\"'")
                    if token.startswith("0x") and len(token) >= 40:
                        labels.append({
                            "wallet": token,
                            "label": LABEL_SANCTIONED,
                            "source": "ofac",
                            "confidence": 1.0,
                        })
        if labels:
            return labels
        # Fallback if parsing yielded nothing.
        return OFAC_HARDCODED.copy()

    except Exception as e:
        print(f"    [OFAC] Fetch failed ({e}) — using hardcoded list.")
        return OFAC_HARDCODED.copy()


# -----------------------------------------------------------------------
# 2. Community Scam Databases
# -----------------------------------------------------------------------

# A representative set of publicly documented scam/exploit addresses.
# Sources: published post-mortems, Etherscan labels, news reports.
COMMUNITY_SCAM_ADDRESSES: List[Dict[str, Any]] = [
    # Ronin Bridge exploit (Mar 2022 — $625M)
    {"wallet": "0x098b716b8aaf21512996dc57eb0615e2383e2f96", "label": LABEL_FRAUD, "source": "community", "confidence": 0.95},
    # Wormhole exploit (Feb 2022 — $320M)
    {"wallet": "0x629e7da20197a5429d30da36e77d06cdf796b71a", "label": LABEL_FRAUD, "source": "community", "confidence": 0.95},
    # Nomad Bridge exploit (Aug 2022)
    {"wallet": "0x56d8b635a7c88fd1104d23d632af40c1c3aac4e3", "label": LABEL_FRAUD, "source": "community", "confidence": 0.90},
    # FTX drainer (Nov 2022)
    {"wallet": "0x59abf3837fa962d6853b4cc0a19513aa031fd32b", "label": LABEL_FRAUD, "source": "community", "confidence": 0.90},
    # Wintermute exploit (Sep 2022)
    {"wallet": "0xe74b28c2eae8679e3ccc3a94d5d0de83ccb84705", "label": LABEL_FRAUD, "source": "community", "confidence": 0.85},
]

# Known major exchanges (should NOT be flagged as anomalous).
KNOWN_EXCHANGES: List[Dict[str, Any]] = [
    {"wallet": "0x28c6c06298d514db089934071d89d39179e9b149", "label": LABEL_EXCHANGE, "source": "community", "confidence": 0.99},  # Binance 14
    {"wallet": "0x21a31ee1afc51d94c2efccaa2092ad1028285549", "label": LABEL_EXCHANGE, "source": "community", "confidence": 0.99},  # Binance 7
    {"wallet": "0xdfd5293d8e347dfe59e90efd55b2956a1343963d", "label": LABEL_EXCHANGE, "source": "community", "confidence": 0.99},  # Binance 16
    {"wallet": "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43", "label": LABEL_EXCHANGE, "source": "community", "confidence": 0.99},  # Coinbase 10
    {"wallet": "0x71660c4005ba85c37ccec55d0c4493e66fe775d3", "label": LABEL_EXCHANGE, "source": "community", "confidence": 0.99},  # Coinbase 1
    {"wallet": "0x503828976d22510aad0201ac7ec88293211d23da", "label": LABEL_EXCHANGE, "source": "community", "confidence": 0.99},  # Coinbase 2
    {"wallet": "0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2", "label": LABEL_EXCHANGE, "source": "community", "confidence": 0.99},  # FTX (pre-collapse)
    {"wallet": "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0", "label": LABEL_EXCHANGE, "source": "community", "confidence": 0.99},  # Kraken 4
]


def fetch_community_labels() -> List[Dict[str, Any]]:
    """Return known scam + exchange labels from community databases."""
    return COMMUNITY_SCAM_ADDRESSES + KNOWN_EXCHANGES


# -----------------------------------------------------------------------
# 3. Etherscan Label Lookup (single-address, free API)
# -----------------------------------------------------------------------

def fetch_etherscan_label(
    address: str, api_key: str = ""
) -> List[Dict[str, Any]]:
    """
    Check if Etherscan has a public label for an address.

    NOTE: Etherscan's free API doesn't expose labels in bulk.
    The 'getaddresstag' endpoint requires a Pro API key.
    This function is a best-effort attempt using the free tier.

    Returns a list with 0 or 1 label dicts.
    """
    if not HAS_REQUESTS or not api_key:
        return []

    try:
        url = (
            f"https://api.etherscan.io/api"
            f"?module=account&action=txlist&address={address}"
            f"&startblock=0&endblock=99999999&page=1&offset=1"
            f"&apikey={api_key}"
        )
        resp = requests.get(url, timeout=10)
        data = resp.json()
        # Etherscan doesn't return labels via free API, but if the address
        # returns valid data we confirm it exists.  Real label lookup
        # would require their Pro "address label" endpoint.
        return []
    except Exception:
        return []


# -----------------------------------------------------------------------
# 4. Load Analyst Labels from File
# -----------------------------------------------------------------------

def load_analyst_labels(filepath: str) -> List[Dict[str, Any]]:
    """
    Load manual analyst labels from a JSON file.

    Expected format:
    [
        {"wallet": "0xabc...", "label": "fraud"},
        {"wallet": "0xdef...", "label": "legit"},
        ...
    ]

    Or a dict format:
    {
        "0xabc...": "fraud",
        "0xdef...": "legit"
    }
    """
    if not os.path.exists(filepath):
        return []

    with open(filepath, "r") as f:
        data = json.load(f)

    labels: List[Dict[str, Any]] = []

    if isinstance(data, list):
        for entry in data:
            labels.append({
                "wallet": entry["wallet"],
                "label": entry.get("label", "suspicious"),
                "source": "analyst",
                "confidence": entry.get("confidence", 0.9),
            })
    elif isinstance(data, dict):
        for wallet, label in data.items():
            labels.append({
                "wallet": wallet,
                "label": label if isinstance(label, str) else label.get("label", "suspicious"),
                "source": "analyst",
                "confidence": 0.9,
            })

    return labels


# -----------------------------------------------------------------------
# Convenience: load all available labels into a LabelStore
# -----------------------------------------------------------------------

def build_label_store(
    analyst_file: str = None,
    use_ofac: bool = True,
    use_community: bool = True,
    verbose: bool = True,
) -> LabelStore:
    """
    Build a LabelStore from all available free sources.

    Parameters
    ----------
    analyst_file : str or None
        Path to a JSON file with manual analyst labels.
    use_ofac : bool
        Include OFAC sanctioned addresses.
    use_community : bool
        Include community scam/exchange labels.
    verbose : bool
        Print loading stats.

    Returns
    -------
    LabelStore with all available labels merged.
    """
    store = LabelStore()

    if use_ofac:
        ofac = fetch_ofac_labels(use_hardcoded=True)
        store.add_batch(ofac)
        if verbose:
            print(f"    Loaded {len(ofac)} OFAC sanctioned addresses")

    if use_community:
        community = fetch_community_labels()
        store.add_batch(community)
        if verbose:
            print(f"    Loaded {len(community)} community labels "
                  f"(scams + exchanges)")

    if analyst_file:
        analyst = load_analyst_labels(analyst_file)
        store.add_batch(analyst)
        if verbose:
            print(f"    Loaded {len(analyst)} analyst labels from {analyst_file}")

    if verbose:
        print(f"    Total labels: {store.size}  |  "
              f"Breakdown: {store.summary()}")

    return store

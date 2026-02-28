"""
ipfs.py — Upload analysis reports to IPFS via Pinata.
"""

import os
import json
import requests

PINATA_API_KEY = os.getenv("PINATA_API_KEY", "")
PINATA_SECRET  = os.getenv("PINATA_SECRET_API_KEY", "")
PINATA_JWT     = os.getenv("PINATA_JWT", "")  # preferred — set this

PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"


def pin_report_to_ipfs(report_data: dict, wallet_address: str) -> str:
    """
    Upload a report dict to IPFS via Pinata.
    Returns the IPFS CID (e.g. 'bafyb...') on success, or '' if Pinata is not configured.
    """
    if not (PINATA_JWT or (PINATA_API_KEY and PINATA_SECRET)):
        print("ℹ️  Pinata not configured — skipping IPFS pin.")
        return ""

    headers = {"Content-Type": "application/json"}
    if PINATA_JWT:
        headers["Authorization"] = f"Bearer {PINATA_JWT}"
    else:
        headers["pinata_api_key"] = PINATA_API_KEY
        headers["pinata_secret_api_key"] = PINATA_SECRET

    body = {
        "pinataMetadata": {
            "name": f"kryptos-report-{wallet_address[:10]}",
            "keyvalues": {
                "wallet": wallet_address,
                "risk_score": str(report_data.get("risk_score", 0)),
                "chain": report_data.get("chain", {}).get("name", "unknown"),
            },
        },
        "pinataContent": {
            "kryptos_version": "4.0.0",
            "wallet": wallet_address,
            "risk_score": report_data.get("risk_score"),
            "risk_label": report_data.get("risk_label"),
            "flags": report_data.get("flags", []),
            "sanctions": report_data.get("sanctions", {}),
            "chain": report_data.get("chain", {}),
            "tx_count": report_data.get("tx_count"),
            "balance": report_data.get("balance"),
            "ml_raw_score": report_data.get("ml_raw_score"),
            "heuristic_score": report_data.get("heuristic_score"),
        },
    }

    try:
        resp = requests.post(PINATA_PIN_URL, headers=headers, data=json.dumps(body), timeout=15)
        resp.raise_for_status()
        cid = resp.json().get("IpfsHash", "")
        print(f"📌 Report pinned to IPFS: {cid}")
        print(f"🔗 https://gateway.pinata.cloud/ipfs/{cid}")
        return cid
    except Exception as e:
        print(f"⚠️  Pinata pin failed (non-fatal): {e}")
        return ""

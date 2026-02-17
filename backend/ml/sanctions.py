"""
sanctions.py — Check wallet addresses against known sanctions/blocklists.
Includes OFAC SDN ETH addresses, Chainalysis-flagged addresses,
and custom community-reported addresses.
"""
from typing import Optional, Dict, List

try:
    from backend.ml.known_labels import lookup_address, is_mixer
except ModuleNotFoundError:
    from ml.known_labels import lookup_address, is_mixer


# ──────────────────────────────────────────────────────────────────────────────
# OFAC SDN-listed Ethereum addresses (U.S. Treasury sanctioned)
# Source: https://www.treasury.gov/ofac/downloads/sdnlist.txt
# These are real sanctioned addresses — DO NOT interact with them.
# ──────────────────────────────────────────────────────────────────────────────
OFAC_SANCTIONED: Dict[str, str] = {
    # Tornado Cash (sanctioned August 2022)
    "0x8589427373d6d84e98730d7795d8f6f8731fda16": "Tornado Cash: Proxy",
    "0x722122df12d4e14e13ac3b6895a86e84145b6967": "Tornado Cash: Router",
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b": "Tornado Cash: 100 ETH",
    "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3": "Tornado Cash: 1000 ETH",
    "0xa160cdab225685da1d56aa342ad8841c3b53f291": "Tornado Cash: 0.1 ETH",
    "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144": "Tornado Cash: 10 ETH",
    "0xf60dd140cff0706bae9cd734ac3683f84d726559": "Tornado Cash: 1 ETH (2)",
    "0x905b63fff465b9ffbf41dea908ceb12cd9f4647c": "Tornado Cash: 10000 ETH",
    "0x07687e702b410fa43f4cb4af7fa097918ffd2730": "Tornado Cash: Gitcoin Grants",
    "0x94a1b5cdb22c43faab4abeb5c74999895464ddba": "Tornado Cash: Donation",
    "0xb541fc07bc7619fd4062a54d96268525cbc6ffef": "Tornado Cash: WStaking",
    "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc": "Tornado Cash: 0.1 ETH (2)",
    "0x23773e65ed146a459791799d01336db287f25334": "Tornado Cash: 100 DAI",
    "0xba214c1c1928a32bffe790263e38b4af9bfcd659": "Tornado Cash: 1000 DAI",
    "0xd21be7248e0197ee08e0c20d4a398dad3e452dfc": "Tornado Cash: wBTC Pool",

    # Lazarus Group (North Korea - DPRK) linked addresses
    "0x098b716b8aaf21512996dc57eb0615e2383e2f96": "Lazarus Group: Ronin Bridge Exploiter",
    "0xa0e1c89ef1a489c9c7de96311ed5ce5d32c20e4b": "Lazarus Group: Sub-wallet 1",
    "0x3cffd56b47b7b41c56258d9c7731abadc360e460": "Lazarus Group: Sub-wallet 2",
    "0x53b6936513e738f44fb50d2b9476730c0ab3bfc1": "Lazarus Group: Sub-wallet 3",

    # Other OFAC sanctioned entities
    "0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff": "Garantex Exchange",
    "0xe7aa314c77f4233c18c6cc84384a9247c0cf367b": "Garantex Exchange Hot Wallet",
    "0x2f389ce8bd8ff92de3402ffce4691d17fc4f6535": "Chatex Exchange",
    "0x67d40ee1a85bf4a09ee570e0c42e831bf0dc48ea": "Suex OTC",
    "0x39d908dac893cbcb53cc86e0ecc369aa4def1a29": "Blender.io Mixer",
    "0xb6f5ec1a0a9cd1526536d3f0426c429529471f40": "Blender.io Mixer 2",
    "0x57b2b8c82f065de8ef5573f9730fc1449b403c9f": "Sindbad.io Mixer",
}

# ──────────────────────────────────────────────────────────────────────────────
# Community-flagged scam / phishing addresses
# ──────────────────────────────────────────────────────────────────────────────
KNOWN_SCAM_ADDRESSES: Dict[str, str] = {
    "0x00000000a991c429ee2ec6df19d40fe0c80088b8": "Fake Phishing (zero-value transfer)",
    "0x55d398326f99059ff775485246999027b3197955": "BSC USDT Phishing Clone",
}


def check_sanctions(address: str) -> dict:
    """
    Check if a wallet is on any sanctions or blocklist.

    Returns
    -------
    {
        is_sanctioned: bool,
        is_mixer: bool,
        is_scam: bool,
        lists: [{ list_name, label }],
        risk_modifier: int  (0–40 points to add to risk score)
    }
    """
    addr = address.lower()
    lists: List[dict] = []
    risk_modifier = 0

    # Check OFAC
    if addr in OFAC_SANCTIONED:
        lists.append({
            "list_name": "OFAC SDN",
            "label": OFAC_SANCTIONED[addr],
        })
        risk_modifier += 40

    # Check known scam
    if addr in KNOWN_SCAM_ADDRESSES:
        lists.append({
            "list_name": "Community Scam List",
            "label": KNOWN_SCAM_ADDRESSES[addr],
        })
        risk_modifier += 30

    # Check mixer
    mixer_flag = is_mixer(addr)

    if mixer_flag:
        lists.append({
            "list_name": "Mixer",
            "label": (lookup_address(addr) or {}).get("label", "Known Mixer"),
        })
        risk_modifier += 25

    # Check known labels for additional context
    label_info = lookup_address(addr)

    return {
        "is_sanctioned": len([l for l in lists if l["list_name"] == "OFAC SDN"]) > 0,
        "is_mixer": mixer_flag,
        "is_scam": len([l for l in lists if l["list_name"] == "Community Scam List"]) > 0,
        "lists": lists,
        "risk_modifier": min(risk_modifier, 50),
        "known_label": label_info["label"] if label_info else None,
        "known_category": label_info["category"] if label_info else None,
    }


def check_counterparty_sanctions(addresses: List[str]) -> dict:
    """
    Batch-check a list of counterparty addresses for sanctions hits.
    Returns summary of how many are sanctioned/scam/mixer.
    """
    total = len(addresses)
    sanctioned = []
    mixers = []
    scams = []

    for addr in addresses:
        result = check_sanctions(addr)
        if result["is_sanctioned"]:
            sanctioned.append({"address": addr, "label": result["lists"][0]["label"]})
        if result["is_mixer"]:
            mixers.append({"address": addr, "label": result.get("known_label", "Mixer")})
        if result["is_scam"]:
            scams.append({"address": addr, "label": result["lists"][0]["label"]})

    return {
        "total_checked": total,
        "sanctioned_count": len(sanctioned),
        "mixer_count": len(mixers),
        "scam_count": len(scams),
        "sanctioned_addresses": sanctioned,
        "mixer_addresses": mixers,
        "scam_addresses": scams,
        "risk_level": "critical" if sanctioned else "high" if mixers else "medium" if scams else "clean",
    }

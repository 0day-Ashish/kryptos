"""
bridge_tracker.py — Cross-chain bridge usage detection and tracking.

Identifies interactions with known bridge protocols:
  · Stargate Finance
  · Across Protocol
  · Hop Protocol
  · Wormhole
  · LayerZero
  · Synapse
  · Celer cBridge
  · Multichain (Anyswap)
  · Orbiter Finance
  · Connext

Analyses patterns to detect bridge-based fund obfuscation.
"""

from typing import Dict, List, Any
from collections import defaultdict
from datetime import datetime


# ── Known Bridge Contracts (Ethereum mainnet) ───────────────────────────────
# Addresses are lowercased for matching

BRIDGE_CONTRACTS: Dict[str, Dict[str, str]] = {
    # Stargate Finance
    "0x8731d54e9d02c286767d56ac03e8037c07e01e98": {"name": "Stargate Router", "protocol": "Stargate", "type": "router"},
    "0xdf0770df86a8034b3efef0a1bb3c889b8332ff56": {"name": "Stargate USDC Pool", "protocol": "Stargate", "type": "pool"},
    "0x101816545f6b2efe8c49d00c015f7d3a5b3e8464": {"name": "Stargate ETH Pool", "protocol": "Stargate", "type": "pool"},
    # Across Protocol
    "0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5": {"name": "Across SpokePool V2", "protocol": "Across", "type": "spokepool"},
    "0xe35e9842fceaca96570b734083f4a58e8f7c5f2a": {"name": "Across SpokePool V3", "protocol": "Across", "type": "spokepool"},
    "0xc186fa914353c44b2e33ebe05f21846f1048beda": {"name": "Across HubPool", "protocol": "Across", "type": "hubpool"},
    # Hop Protocol
    "0xb8901acb165ed027e32754e0ffe830802919727f": {"name": "Hop ETH Bridge", "protocol": "Hop", "type": "bridge"},
    "0x3666f603cc164936c1b87e207f36beba4ac5f18a": {"name": "Hop USDC Bridge", "protocol": "Hop", "type": "bridge"},
    "0x3e4a3a4796d16c0cd582c382691998f7c06420b6": {"name": "Hop DAI Bridge", "protocol": "Hop", "type": "bridge"},
    # Wormhole
    "0x3ee18b2214aff97000d974cf647e7c347e8fa585": {"name": "Wormhole Token Bridge", "protocol": "Wormhole", "type": "bridge"},
    "0x98f3c9e6e3face36baad05fe09d375ef1464288b": {"name": "Wormhole Core Bridge", "protocol": "Wormhole", "type": "core"},
    # LayerZero
    "0x66a71dcef29a0ffbdbe3c6a460a3b5bc225cd675": {"name": "LayerZero Endpoint", "protocol": "LayerZero", "type": "endpoint"},
    "0xb6319cc6c8c27a8f5daf0dd3df91ea35c4720dd7": {"name": "LayerZero UltraLight V2", "protocol": "LayerZero", "type": "messaging"},
    # Synapse
    "0x2796317b0ff8538f253012862c06787adfb8ceb6": {"name": "Synapse Bridge", "protocol": "Synapse", "type": "bridge"},
    "0x1116898dda4015ed8ddefb84b6e8bc24528af2d8": {"name": "Synapse Router", "protocol": "Synapse", "type": "router"},
    # Celer cBridge
    "0x5427fefa711eff984124bfbb1ab6fbf5e3da1820": {"name": "cBridge V2", "protocol": "Celer", "type": "bridge"},
    "0xb37d31b2a74029b5951a2778f959282e2d518595": {"name": "cBridge PegBridge V2", "protocol": "Celer", "type": "pegbridge"},
    # Multichain (Anyswap)
    "0xe95fd76cf16008c12ff3b3a937cb16cd9cc20284": {"name": "Multichain Router V6", "protocol": "Multichain", "type": "router"},
    "0x6b7a87899490ece95443e979ca9485cbe7e71522": {"name": "Multichain Router V4", "protocol": "Multichain", "type": "router"},
    # Orbiter Finance
    "0x80c67432656d59144ceff962e8faf8926599bcf8": {"name": "Orbiter Bridge", "protocol": "Orbiter", "type": "bridge"},
    "0xe4edb277e41dc89ab076a1f049f4a3efa700bce8": {"name": "Orbiter Maker", "protocol": "Orbiter", "type": "maker"},
    # Connext
    "0x8898b472c54c31894e3b9bb83cea802a5d0e63c6": {"name": "Connext Diamond", "protocol": "Connext", "type": "bridge"},
    # Polygon Bridge
    "0xa0c68c638235ee32657e8f720a23cec1bfc6c9a8": {"name": "Polygon Bridge", "protocol": "Polygon", "type": "bridge"},
    "0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf": {"name": "Polygon ERC20 Bridge", "protocol": "Polygon", "type": "bridge"},
    # Arbitrum Bridge
    "0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f": {"name": "Arbitrum Inbox", "protocol": "Arbitrum", "type": "bridge"},
    "0x72ce9c846789fdb6fc1f34ac4ad25dd9ef7031ef": {"name": "Arbitrum Gateway Router", "protocol": "Arbitrum", "type": "gateway"},
    # Optimism Bridge
    "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1": {"name": "Optimism L1 Bridge", "protocol": "Optimism", "type": "bridge"},
    "0x49048044d57e1c92a77f79988d21fa8faf74e97e": {"name": "Base Portal", "protocol": "Base", "type": "bridge"},
}


def detect_bridge_usage(
    address: str,
    transactions: list,
    token_transfers: list | None = None,
) -> Dict[str, Any]:
    """
    Detect cross-chain bridge interactions from a wallet's transactions.

    Returns:
      bridges_used       – list of bridge protocols used with details
      total_bridge_txns  – total number of bridge interactions
      bridge_volume      – total ETH bridged
      bridge_risk        – 0-100 risk score for bridge usage patterns
      bridge_flags       – human-readable flags
      bridge_timeline    – chronological bridge usage
    """
    address = address.lower()
    bridge_interactions = []
    protocol_stats: Dict[str, Dict] = defaultdict(
        lambda: {"protocol": "", "txn_count": 0, "volume_eth": 0.0, "contracts": set(), "directions": set()}
    )

    all_txns = list(transactions)
    if token_transfers:
        all_txns.extend(token_transfers)

    for tx in all_txns:
        tx_from = tx.get("from", "").lower()
        tx_to = tx.get("to", "").lower()
        value = int(tx.get("value", 0)) / 1e18

        # Check if either from or to is a known bridge
        bridge_info = None
        direction = None

        if tx_to in BRIDGE_CONTRACTS:
            bridge_info = BRIDGE_CONTRACTS[tx_to]
            direction = "deposit" if tx_from == address else "observed"
        elif tx_from in BRIDGE_CONTRACTS:
            bridge_info = BRIDGE_CONTRACTS[tx_from]
            direction = "withdrawal" if tx_to == address else "observed"

        if bridge_info and direction != "observed":
            ts = int(tx.get("timeStamp", 0))
            interaction = {
                "tx_hash": tx.get("hash", ""),
                "protocol": bridge_info["protocol"],
                "contract_name": bridge_info["name"],
                "contract_type": bridge_info["type"],
                "direction": direction,
                "value_eth": value,
                "timestamp": ts,
                "date": datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M") if ts else None,
                "block": tx.get("blockNumber", ""),
            }
            bridge_interactions.append(interaction)

            # Update protocol stats
            pstat = protocol_stats[bridge_info["protocol"]]
            pstat["protocol"] = bridge_info["protocol"]
            pstat["txn_count"] += 1
            pstat["volume_eth"] += value
            pstat["contracts"].add(bridge_info["name"])
            pstat["directions"].add(direction)

    # Sort by timestamp
    bridge_interactions.sort(key=lambda x: x.get("timestamp", 0))

    # Build per-protocol summary
    bridges_used = []
    for protocol, stats in sorted(protocol_stats.items(), key=lambda x: x[1]["txn_count"], reverse=True):
        bridges_used.append({
            "protocol": protocol,
            "txn_count": stats["txn_count"],
            "volume_eth": round(stats["volume_eth"], 4),
            "contracts": list(stats["contracts"]),
            "directions": list(stats["directions"]),
        })

    total_bridge_txns = sum(b["txn_count"] for b in bridges_used)
    total_bridge_volume = sum(b["volume_eth"] for b in bridges_used)

    # ── Bridge risk scoring ─────────────────────────────────────────────
    score = 0.0
    flags = []

    # Many bridge protocols used → obfuscation
    if len(bridges_used) >= 4:
        score += 25
        flags.append(f"Uses {len(bridges_used)} different bridge protocols (potential obfuscation)")
    elif len(bridges_used) >= 2:
        score += 10
        flags.append(f"Uses {len(bridges_used)} bridge protocols")

    # High bridge volume
    if total_bridge_volume > 100:
        score += 20
        flags.append(f"Large bridge volume: {total_bridge_volume:.2f} ETH")
    elif total_bridge_volume > 10:
        score += 10

    # Many bridge transactions
    if total_bridge_txns > 20:
        score += 15
        flags.append(f"Frequent bridge usage: {total_bridge_txns} transactions")
    elif total_bridge_txns > 5:
        score += 5

    # Rapid bridging — multiple bridge txns within short time
    if len(bridge_interactions) >= 3:
        timestamps = [b["timestamp"] for b in bridge_interactions if b["timestamp"]]
        if timestamps:
            diffs = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
            rapid = sum(1 for d in diffs if d < 3600)  # within 1 hour
            if rapid >= 3:
                score += 20
                flags.append("Rapid successive bridge transactions (< 1 hour apart)")

    # Deposit-only or withdrawal-only → not round-tripping
    all_directions = set()
    for b in bridges_used:
        all_directions.update(b["directions"])
    if all_directions == {"deposit"}:
        # Only depositing → moving funds away
        score += 10
        flags.append("Only bridge deposits detected (funds moving to other chains)")

    # Known risky bridges (Multichain was compromised)
    risky_protocols = {"Multichain"}
    for b in bridges_used:
        if b["protocol"] in risky_protocols:
            score += 10
            flags.append(f"Used compromised bridge: {b['protocol']}")

    bridge_risk = int(min(score, 100))

    return {
        "bridges_used": bridges_used,
        "total_bridge_txns": total_bridge_txns,
        "total_bridge_volume": round(total_bridge_volume, 4),
        "bridge_risk_score": bridge_risk,
        "bridge_flags": flags,
        "bridge_timeline": bridge_interactions[:50],  # cap for response size
    }

"""
synthetic_data.py — Generate realistic synthetic blockchain transactions for testing.

The dataset encodes three behavioural archetypes:

1. **Normal wallets** (N0–N19)
   – 20 wallets that transact with each other infrequently, with varied amounts
     and timestamps spread over ~24 hours.  These represent ordinary users.

2. **Wash-trading ring** (M0–M5)
   – 6 wallets that rapidly cycle funds among themselves with near-equal amounts
     and very short time gaps (~30-90 s).  High internal circulation, low
     pass-through score, short inter-tx times.

3. **Layering chain** (L0–L3)
   – 4 wallets forming a linear chain (L0→L1→L2→L3→external).
     Each wallet forwards almost exactly what it receives.
     High pass-through, distinct fan-out at endpoint.

The generator is deterministic (seeded RNG) so results are reproducible.
"""

import random
from typing import List, Dict, Any


def generate_synthetic_transactions(seed: int = 42) -> List[Dict[str, Any]]:
    rng = random.Random(seed)
    txs: List[Dict[str, Any]] = []
    base_ts = 1_700_000_000  # ~ Nov 2023 epoch

    # ------------------------------------------------------------------
    # 1. Normal wallets: sparse, varied activity over a long time window
    # ------------------------------------------------------------------
    normal_wallets = [f"0xnormal_{i:02d}" for i in range(30)]

    # Normal users: ~3-4 txs each, spread over 7 days, varied amounts.
    for i in range(100):
        sender = rng.choice(normal_wallets)
        receiver = rng.choice([w for w in normal_wallets if w != sender])
        txs.append({
            "from": sender,
            "to": receiver,
            "value": round(rng.uniform(0.01, 5.0), 4),   # small varied amounts
            "timestamp": base_ts + rng.randint(0, 604_800),  # spread over 7 days
        })

    # ------------------------------------------------------------------
    # 2. Wash-trading ring: tight loop, very fast, large uniform amounts
    #    Key anomaly axes:
    #    - Extremely high degree (many rapid txs)
    #    - Near-uniform large amounts (10x normal)
    #    - Very short time gaps (30-60 s vs hours for normals)
    #    - Near-zero pass-through (in ≈ out for each wallet)
    # ------------------------------------------------------------------
    ring_wallets = [f"0xring_{i}" for i in range(6)]
    ring_ts = base_ts + 1000

    # 12 full ring cycles → each wallet gets ~12 in + 12 out = 24 degree.
    # Normal wallets have ~3-6 degree.  This 4x+ gap is the main signal.
    for cycle in range(12):
        for j in range(len(ring_wallets)):
            sender = ring_wallets[j]
            receiver = ring_wallets[(j + 1) % len(ring_wallets)]
            # Large, tightly clustered amounts.
            amount = round(50.0 + rng.uniform(-1.0, 1.0), 4)
            txs.append({
                "from": sender,
                "to": receiver,
                "value": amount,
                "timestamp": ring_ts,
            })
            ring_ts += rng.randint(15, 45)  # 15-45 s gaps (very fast)

        # Extra random cross-links each cycle.
        for _ in range(2):
            a, b = rng.sample(ring_wallets, 2)
            txs.append({
                "from": a,
                "to": b,
                "value": round(50.0 + rng.uniform(-2.0, 2.0), 4),
                "timestamp": ring_ts,
            })
            ring_ts += rng.randint(15, 30)

    # Small leakage to normal wallets (makes the graph connected but
    # the ring remains structurally distinct).
    for _ in range(4):
        txs.append({
            "from": rng.choice(ring_wallets),
            "to": rng.choice(normal_wallets),
            "value": round(rng.uniform(0.5, 2.0), 4),
            "timestamp": base_ts + rng.randint(0, 604_800),
        })

    # ------------------------------------------------------------------
    # 3. Layering chain: linear pass-through with small skims
    #    Key anomaly axes:
    #    - Very low pass-through score (forwards ~98 % of inbound)
    #    - Endpoint has high fan-out to external wallets
    #    - Short temporal spacing (< 2 min between hops)
    # ------------------------------------------------------------------
    layer_wallets = [f"0xlayer_{i}" for i in range(5)]

    # Run the layering pattern multiple times to build up volume.
    for run in range(6):
        layer_ts = base_ts + 5000 + run * 600
        chain_amount = round(40.0 + rng.uniform(-3, 3), 4)

        for i in range(len(layer_wallets) - 1):
            txs.append({
                "from": layer_wallets[i],
                "to": layer_wallets[i + 1],
                "value": round(chain_amount, 4),
                "timestamp": layer_ts,
            })
            chain_amount *= 0.98  # 2 % skim per hop
            layer_ts += rng.randint(30, 90)

        # Endpoint fans out to different normal wallets each time (exit pattern).
        exit_wallet = layer_wallets[-1]
        targets = rng.sample(normal_wallets, min(3, len(normal_wallets)))
        for t in targets:
            txs.append({
                "from": exit_wallet,
                "to": t,
                "value": round(rng.uniform(2.0, 8.0), 4),
                "timestamp": layer_ts + rng.randint(10, 60),
            })

    # Seed L0 from external funders.
    for _ in range(4):
        txs.append({
            "from": f"0xexternal_funder_{rng.randint(0,2)}",
            "to": layer_wallets[0],
            "value": round(rng.uniform(50, 80), 4),
            "timestamp": base_ts + rng.randint(4000, 5000),
        })

    # ------------------------------------------------------------------
    # Shuffle to avoid ordering bias
    # ------------------------------------------------------------------
    rng.shuffle(txs)

    return txs


if __name__ == "__main__":
    data = generate_synthetic_transactions()
    print(f"Generated {len(data)} transactions.")
    for tx in data[:5]:
        print(tx)

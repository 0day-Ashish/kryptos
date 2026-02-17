from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import os
from collections import Counter
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

try:
    from backend.ml.config import CHAIN_ID, ETHERSCAN_API_KEY, SUPPORTED_CHAINS, get_chain_by_id
    from backend.ml.fetcher import (
        fetch_transactions, fetch_internal_transactions,
        fetch_token_transfers, discover_neighbors, fetch_neighbor_transactions,
        fetch_balance,
    )
    from backend.ml.scorer import wallet_scorer
    from backend.ml.known_labels import lookup_address, label_addresses, is_mixer
    from backend.on_chain import store_report_on_chain, get_report_from_chain
except ModuleNotFoundError:
    from ml.config import CHAIN_ID, ETHERSCAN_API_KEY, SUPPORTED_CHAINS, get_chain_by_id
    from ml.fetcher import (
        fetch_transactions, fetch_internal_transactions,
        fetch_token_transfers, discover_neighbors, fetch_neighbor_transactions,
        fetch_balance,
    )
    from ml.scorer import wallet_scorer
    from ml.known_labels import lookup_address, label_addresses, is_mixer
    from on_chain import store_report_on_chain, get_report_from_chain

app = FastAPI(title="Kryptos API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"status": "Kryptos Backend Running", "version": "2.0.0", "chains": len(SUPPORTED_CHAINS)}

@app.get("/chains")
def list_chains():
    """Return all supported chains for the frontend dropdown."""
    return {"chains": SUPPORTED_CHAINS, "default": 1}

@app.get("/analyze/{address}")
def analyze_wallet(address: str, chain_id: int = Query(default=1, description="Chain ID to query")):
    target_address = address.lower()
    chain = get_chain_by_id(chain_id)

    print(f"\n{'='*60}")
    print(f"🔍 Analyzing {target_address} on {chain['name']} (chainid={chain_id})")
    print(f"{'='*60}")

    # Step 1: Fetch target wallet transactions
    print("📡 Step 1: Fetching target transactions...")
    normal_txns = fetch_transactions(target_address, chain_id, max_results=200)
    internal_txns = fetch_internal_transactions(target_address, chain_id, max_results=100)
    token_txns = fetch_token_transfers(target_address, chain_id, max_results=100)

    # Merge normal + internal for feature extraction
    all_target_txns = normal_txns + internal_txns

    if not all_target_txns:
        print("⚠️ No transactions found.")
        return {
            "address": target_address,
            "chain": {
                "id": chain["id"], "name": chain["name"],
                "short": chain["short"], "explorer": chain["explorer"],
                "native": chain["native"],
            },
            "risk_score": 0,
            "risk_label": "No Data",
            "ml_raw_score": 0,
            "heuristic_score": 0,
            "flags": ["No transactions found on this chain for this address"],
            "feature_summary": {},
            "neighbors_analyzed": 0,
            "tx_count": 0,
            "internal_tx_count": 0,
            "token_transfers": len(token_txns),
            "graph": {"nodes": [{"id": target_address, "group": "suspect", "val": 20}], "links": []},
            "on_chain": {},
        }

    # Step 2: Build graph data for visualization
    print("🕸️ Step 2: Building graph...")
    nodes = []
    links = []
    seen_nodes = set()

    # Check target label
    target_label_info = lookup_address(target_address)
    target_group = "suspect"
    if target_label_info:
        target_group = target_label_info["category"]
    nodes.append({
        "id": target_address,
        "group": target_group,
        "val": 20,
        "label": target_label_info["label"] if target_label_info else None,
    })
    seen_nodes.add(target_address)

    # Collect all counterparties for labeling
    all_counterparty_addrs = set()
    for tx in normal_txns:
        tx_from = tx.get("from", "").lower()
        tx_to = tx.get("to", "").lower()
        if tx_from and tx_from != target_address:
            all_counterparty_addrs.add(tx_from)
        if tx_to and tx_to != target_address:
            all_counterparty_addrs.add(tx_to)

    # Batch label lookup
    known_labels = label_addresses(list(all_counterparty_addrs))

    for tx in normal_txns:
        tx_from = tx.get("from", "").lower()
        tx_to = tx.get("to", "").lower()
        if not tx_to:
            continue

        if tx_from == target_address:
            neighbor = tx_to
            direction = "out"
        else:
            neighbor = tx_from
            direction = "in"

        if neighbor and neighbor not in seen_nodes:
            label_info = known_labels.get(neighbor)
            group = label_info["category"] if label_info else "neighbor"
            nodes.append({
                "id": neighbor,
                "group": group,
                "val": 10,
                "label": label_info["label"] if label_info else None,
            })
            seen_nodes.add(neighbor)

            links.append({
                "source": tx_from,
                "target": tx_to,
                "value": float(tx.get("value", 0)) / 10**18,
                "type": direction,
            })

    # Step 3: Discover and fetch neighbor transactions for ML context
    print("🔗 Step 3: Discovering neighbors...")
    neighbors = discover_neighbors(target_address, all_target_txns, max_neighbors=8)
    print(f"   Found {len(neighbors)} top neighbors")

    print("📡 Step 4: Fetching neighbor transactions...")
    neighbor_txns = fetch_neighbor_transactions(neighbors, chain_id, max_per_neighbor=50)
    print(f"   Fetched data for {len(neighbor_txns)} neighbors")

    # Step 5: ML scoring
    print("🧠 Step 5: Running ML scorer...")
    try:
        result = wallet_scorer.score_wallet(
            target_address, all_target_txns, neighbor_txns, chain_id
        )
        risk_score = result["risk_score"]
        risk_label = result["risk_label"]
        ml_raw_score = result["ml_raw_score"]
        heuristic_score = result["heuristic_score"]
        flags = result["flags"]
        feature_summary = result["feature_summary"]
        neighbors_analyzed = result["neighbors_analyzed"]
        print(f"   Score: {risk_score}/100 ({risk_label})")
        print(f"   ML: {ml_raw_score}, Heuristic: {heuristic_score}")
        print(f"   Flags: {flags}")
    except Exception as e:
        print(f"⚠️ ML scoring error (non-fatal): {e}")
        import traceback
        traceback.print_exc()
        risk_score = 50
        risk_label = "Unknown"
        ml_raw_score = 0
        heuristic_score = 0
        flags = [f"ML scoring error: {str(e)}"]
        feature_summary = {}
        neighbors_analyzed = 0

    # Step 6: Compute top counterparties
    print("📊 Step 6: Computing counterparties & timeline...")
    counterparty_volume: dict[str, dict] = {}
    for tx in normal_txns:
        tx_from = tx.get("from", "").lower()
        tx_to = tx.get("to", "").lower()
        value = float(tx.get("value", 0)) / 1e18
        if not tx_to:
            continue
        counterparty = tx_to if tx_from == target_address else tx_from
        if counterparty == target_address:
            continue
        if counterparty not in counterparty_volume:
            label_info = known_labels.get(counterparty)
            counterparty_volume[counterparty] = {
                "address": counterparty,
                "label": label_info["label"] if label_info else None,
                "category": label_info["category"] if label_info else None,
                "total_value": 0.0,
                "tx_count": 0,
                "sent": 0.0,
                "received": 0.0,
            }
        entry = counterparty_volume[counterparty]
        entry["total_value"] += value
        entry["tx_count"] += 1
        if tx_from == target_address:
            entry["sent"] += value
        else:
            entry["received"] += value

    top_counterparties = sorted(
        counterparty_volume.values(),
        key=lambda x: x["total_value"],
        reverse=True,
    )[:10]

    # Step 7: Build timeline data (bucketed by day)
    timeline_data = []
    if normal_txns:
        timestamps = [int(tx.get("timeStamp", 0)) for tx in normal_txns if tx.get("timeStamp")]
        if timestamps:
            day_buckets: dict[str, dict] = {}
            for tx in normal_txns:
                ts = int(tx.get("timeStamp", 0))
                if ts == 0:
                    continue
                day = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
                if day not in day_buckets:
                    day_buckets[day] = {"date": day, "tx_count": 0, "volume": 0.0, "in_count": 0, "out_count": 0}
                bucket = day_buckets[day]
                bucket["tx_count"] += 1
                bucket["volume"] += float(tx.get("value", 0)) / 1e18
                if tx.get("from", "").lower() == target_address:
                    bucket["out_count"] += 1
                else:
                    bucket["in_count"] += 1
            timeline_data = sorted(day_buckets.values(), key=lambda x: x["date"])

    # Step 8: Check mixer interactions
    mixer_interactions = []
    for addr in all_counterparty_addrs:
        if is_mixer(addr):
            info = lookup_address(addr)
            mixer_interactions.append(info["label"] if info else addr)
            if f"Interacted with mixer: {info['label'] if info else addr}" not in flags:
                flags.append(f"Interacted with mixer: {info['label'] if info else addr}")

    # Step 9: Fetch balance
    balance = fetch_balance(target_address, chain_id)

    # Step 10: Store report on Base Sepolia
    on_chain = {}
    try:
        on_chain = store_report_on_chain(target_address, risk_score)
        print(f"📝 On-chain report: {on_chain}")
    except Exception as e:
        print(f"⚠️ On-chain write failed (non-fatal): {e}")
        on_chain = {"error": str(e)}

    print(f"{'='*60}\n")

    return {
        "address": target_address,
        "risk_score": risk_score,
        "risk_label": risk_label,
        "ml_raw_score": ml_raw_score,
        "heuristic_score": heuristic_score,
        "flags": flags,
        "feature_summary": feature_summary,
        "neighbors_analyzed": neighbors_analyzed,
        "tx_count": len(normal_txns),
        "internal_tx_count": len(internal_txns),
        "token_transfers": len(token_txns),
        "balance": balance,
        "top_counterparties": top_counterparties,
        "timeline": timeline_data,
        "mixer_interactions": mixer_interactions,
        "chain": {
            "id": chain["id"], "name": chain["name"],
            "short": chain["short"], "explorer": chain["explorer"],
            "native": chain["native"],
        },
        "graph": {
            "nodes": nodes,
            "links": links
        },
        "on_chain": on_chain,
    }


@app.get("/balance/{address}")
def get_balance(address: str, chain_id: int = Query(default=1, description="Chain ID")):
    """Fetch current native token balance for a wallet."""
    chain = get_chain_by_id(chain_id)
    bal = fetch_balance(address.lower(), chain_id)
    return {
        "address": address.lower(),
        "balance": bal,
        "native": chain["native"],
        "chain": chain["name"],
    }


@app.get("/report/{address}")
def get_on_chain_report(address: str):
    """Read an existing on-chain risk report for a wallet."""
    try:
        report = get_report_from_chain(address.lower())
        return report
    except Exception as e:
        return {"error": str(e), "on_chain": False}
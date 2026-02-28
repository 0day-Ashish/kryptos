from fastapi import FastAPI, Query, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import os
import json
import secrets
import string
from collections import Counter
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

# ── Database + Auth ──────────────────────────────────────────────────────────
try:
    from backend.db.models import init_db, get_db, SharedReport
    from backend.auth.routes import router as auth_router
    from backend.auth.watchlist_routes import router as watchlist_router
except ModuleNotFoundError:
    from db.models import init_db, get_db, SharedReport
    from auth.routes import router as auth_router
    from auth.watchlist_routes import router as watchlist_router

try:
    from backend.ml.config import CHAIN_ID, ETHERSCAN_API_KEY, SUPPORTED_CHAINS, get_chain_by_id
    from backend.ml.fetcher import (
        fetch_transactions, fetch_internal_transactions,
        fetch_token_transfers, discover_neighbors, fetch_neighbor_transactions,
        fetch_balance,
    )
    from backend.ml.scorer import wallet_scorer
    from backend.ml.known_labels import lookup_address, label_addresses, is_mixer
    from backend.ml.tracer import trace_fund_flow
    from backend.ml.cross_chain import cross_chain_scan
    from backend.ml.sanctions import check_sanctions, check_counterparty_sanctions
    from backend.ml.similarity import find_similar_wallets
    from backend.ml.ens_resolver import resolve_input, is_ens_name
    from backend.ml.token_portfolio import get_token_portfolio
    from backend.ml.gnn_scorer import gnn_scorer
    from backend.ml.temporal_anomaly import detect_temporal_anomalies
    from backend.ml.mev_detector import detect_mev_activity
    from backend.ml.bridge_tracker import detect_bridge_usage
    from backend.ml.community_reports import (
        submit_report, get_reports, vote_report,
        get_recent_reports, get_flagged_addresses, get_community_risk_modifier,
    )
    from backend.ml.batch_analyzer import analyze_batch, parse_csv_addresses
    from backend.ml.token_scanner import scan_token
    from backend.ml.contract_auditor import audit_contract
    from backend.ml.watchlist import quick_score
    from backend.report_pdf import generate_pdf_report
    from backend.on_chain import store_report_on_chain, get_report_from_chain
    from backend.ipfs import pin_report_to_ipfs
except ModuleNotFoundError:
    from ml.config import CHAIN_ID, ETHERSCAN_API_KEY, SUPPORTED_CHAINS, get_chain_by_id
    from ml.fetcher import (
        fetch_transactions, fetch_internal_transactions,
        fetch_token_transfers, discover_neighbors, fetch_neighbor_transactions,
        fetch_balance,
    )
    from ml.scorer import wallet_scorer
    from ml.known_labels import lookup_address, label_addresses, is_mixer
    from ml.tracer import trace_fund_flow
    from ml.cross_chain import cross_chain_scan
    from ml.sanctions import check_sanctions, check_counterparty_sanctions
    from ml.similarity import find_similar_wallets
    from ml.ens_resolver import resolve_input, is_ens_name
    from ml.token_portfolio import get_token_portfolio
    from ml.gnn_scorer import gnn_scorer
    from ml.temporal_anomaly import detect_temporal_anomalies
    from ml.mev_detector import detect_mev_activity
    from ml.bridge_tracker import detect_bridge_usage
    from ml.community_reports import (
        submit_report, get_reports, vote_report,
        get_recent_reports, get_flagged_addresses, get_community_risk_modifier,
    )
    from ml.batch_analyzer import analyze_batch, parse_csv_addresses
    from ml.token_scanner import scan_token
    from ml.contract_auditor import audit_contract
    from ml.watchlist import quick_score
    from report_pdf import generate_pdf_report
    from on_chain import store_report_on_chain, get_report_from_chain
    from ipfs import pin_report_to_ipfs


# ── Pydantic models for request bodies ──────────────────────────────────────
class ReportRequest(BaseModel):
    address: str
    category: str
    description: str = ""
    reporter_id: str = "anonymous"
    evidence_urls: List[str] = []
    chain_id: int = 1

class VoteRequest(BaseModel):
    report_id: str
    vote: str  # "up" or "down"
    voter_id: str = "anonymous"

class BatchRequest(BaseModel):
    addresses: List[str]
    chain_id: int = 1
    quick: bool = True

class BatchCsvRequest(BaseModel):
    csv_content: str
    chain_id: int = 1
    quick: bool = True

class ShareRequest(BaseModel):
    """Request body for creating a shareable report link."""
    data: dict  # Full analysis result JSON


def _generate_report_id(length: int = 10) -> str:
    """Generate a URL-safe short ID for shared reports."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


app = FastAPI(title="Kryptos API", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Initialize DB + register auth/watchlist routers ──────────────────────────
init_db()
app.include_router(auth_router)
app.include_router(watchlist_router)


@app.get("/")
def home():
    return {"status": "Kryptos Backend Running", "version": "4.0.0", "chains": len(SUPPORTED_CHAINS)}

@app.get("/chains")
def list_chains():
    """Return all supported chains for the frontend dropdown."""
    return {"chains": SUPPORTED_CHAINS, "default": 1}

@app.get("/analyze/{address}")
def analyze_wallet(address: str, chain_id: int = Query(default=1, description="Chain ID to query")):
    # ENS resolution — accept vitalik.eth or raw address
    resolved = resolve_input(address)
    if resolved["resolved"] and resolved["address"]:
        target_address = resolved["address"].lower()
        ens_name = resolved.get("ens_name")
    else:
        target_address = address.lower()
        ens_name = None

    chain = get_chain_by_id(chain_id)

    # Sanctions pre-check on the target itself
    sanctions_result = check_sanctions(target_address)

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
        # Still apply sanctions even if no on-chain txns exist on this specific chain
        no_data_score = sanctions_result.get("risk_modifier", 0)
        no_data_flags = ["No transactions found on this chain for this address"]
        no_data_label = "No Data"
        if sanctions_result.get("is_sanctioned"):
            no_data_flags.insert(0, "ADDRESS IS ON OFAC SANCTIONS LIST")
            no_data_label = "Critical Risk"
        elif sanctions_result.get("is_mixer"):
            no_data_flags.insert(0, "Address is a known mixer/tumbler")
            if no_data_score >= 40:
                no_data_label = "High Risk"
        return {
            "address": target_address,
            "chain": {
                "id": chain["id"], "name": chain["name"],
                "short": chain["short"], "explorer": chain["explorer"],
                "native": chain["native"],
            },
            "risk_score": no_data_score,
            "risk_label": no_data_label,
            "ml_raw_score": 0,
            "heuristic_score": 0,
            "flags": no_data_flags,
            "feature_summary": {},
            "neighbors_analyzed": 0,
            "tx_count": 0,
            "internal_tx_count": 0,
            "token_transfers": len(token_txns),
            "sanctions": sanctions_result,
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

    # Step 8b: Sanctions check on counterparties
    counterparty_sanctions = check_counterparty_sanctions(list(all_counterparty_addrs))
    if counterparty_sanctions["sanctioned_count"] > 0:
        for s in counterparty_sanctions["sanctioned_addresses"]:
            flag_msg = f"Transacted with OFAC-sanctioned address: {s['label']}"
            if flag_msg not in flags:
                flags.append(flag_msg)

    # Step 8c: Apply sanctions modifier to risk score
    if sanctions_result["risk_modifier"] > 0:
        risk_score = min(100, risk_score + sanctions_result["risk_modifier"])
        if sanctions_result["is_sanctioned"]:
            flags.insert(0, "ADDRESS IS ON OFAC SANCTIONS LIST")
            risk_label = "Critical Risk"
        elif sanctions_result["is_mixer"]:
            risk_label = "Critical Risk" if risk_score >= 80 else risk_label

    # Step 9: Fetch balance
    balance = fetch_balance(target_address, chain_id)

    # Step 10: Advanced analysis — GNN, Temporal, MEV, Bridge
    print("🧬 Step 10: Running advanced analysis...")
    gnn_result = {}
    temporal_result = {}
    mev_result = {}
    bridge_result = {}
    community_risk = 0

    try:
        gnn_result = gnn_scorer.score(target_address, all_target_txns, neighbor_txns, chain_id)
        print(f"   GNN score: {gnn_result.get('gnn_score', '?')}")
    except Exception as e:
        print(f"   GNN scoring error (non-fatal): {e}")

    try:
        temporal_result = detect_temporal_anomalies(target_address, normal_txns)
        print(f"   Temporal risk: {temporal_result.get('temporal_risk_score', '?')}")
    except Exception as e:
        print(f"   Temporal analysis error (non-fatal): {e}")

    try:
        mev_result = detect_mev_activity(target_address, normal_txns)
        if mev_result.get("is_mev_bot"):
            flags.append(f"MEV bot detected (score: {mev_result['mev_risk_score']})")
        print(f"   MEV score: {mev_result.get('mev_risk_score', '?')}")
    except Exception as e:
        print(f"   MEV detection error (non-fatal): {e}")

    try:
        bridge_result = detect_bridge_usage(target_address, normal_txns, token_txns)
        if bridge_result.get("bridge_flags"):
            for bf in bridge_result["bridge_flags"][:3]:
                if bf not in flags:
                    flags.append(bf)
        print(f"   Bridge risk: {bridge_result.get('bridge_risk_score', '?')}")
    except Exception as e:
        print(f"   Bridge tracking error (non-fatal): {e}")

    try:
        community_risk = get_community_risk_modifier(target_address)
        if community_risk > 0:
            risk_score = min(100, risk_score + community_risk)
            flags.append(f"Community flagged (+{community_risk} risk modifier)")
            print(f"   Community modifier: +{community_risk}")
    except Exception as e:
        print(f"   Community risk error (non-fatal): {e}")

    # Step 11: Pin report to IPFS, then store CID + risk score on Base Sepolia
    on_chain = {}
    try:
        # 11a — pin the report summary to IPFS via Pinata
        report_summary = {
            "address": target_address,
            "risk_score": risk_score,
            "risk_label": risk_label,
            "flags": flags,
            "sanctions": sanctions_result,
            "chain": chain,
            "tx_count": len(normal_txns),
            "balance": balance,
            "ml_raw_score": ml_raw_score,
            "heuristic_score": heuristic_score,
        }
        ipfs_cid = pin_report_to_ipfs(report_summary, target_address)

        # 11b — store (riskScore, ipfsCID, timestamp) on-chain
        on_chain = store_report_on_chain(target_address, risk_score, ipfs_cid)
        if ipfs_cid:
            on_chain["ipfs_cid"] = ipfs_cid
            on_chain["ipfs_url"] = f"https://gateway.pinata.cloud/ipfs/{ipfs_cid}"
        print(f"📝 On-chain report: {on_chain}")
    except Exception as e:
        print(f"⚠️ On-chain write failed (non-fatal): {e}")
        on_chain = {"error": str(e)}

    print(f"{'='*60}\n")

    return {
        "address": target_address,
        "ens_name": ens_name,
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
        "sanctions": sanctions_result,
        "counterparty_sanctions": counterparty_sanctions,
        "chain": {
            "id": chain["id"], "name": chain["name"],
            "short": chain["short"], "explorer": chain["explorer"],
            "native": chain["native"],
        },
        "graph": {
            "nodes": nodes,
            "links": links
        },
        "gnn": gnn_result,
        "temporal": temporal_result,
        "mev": mev_result,
        "bridges": bridge_result,
        "community_risk_modifier": community_risk,
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


# ── New Endpoints (v3.0) ────────────────────────────────────────────────────

@app.get("/resolve/{name}")
def resolve_name(name: str):
    """Resolve ENS name to address, or reverse-resolve address to ENS."""
    return resolve_input(name)


@app.get("/trace/{address}")
def trace_funds(
    address: str,
    chain_id: int = Query(default=1),
    depth: int = Query(default=3, ge=1, le=5),
    min_value: float = Query(default=0.01),
    direction: str = Query(default="out", pattern="^(in|out)$"),
):
    """
    Trace fund flow from a wallet.
    Follow outgoing or incoming transactions up to N hops deep.
    """
    return trace_fund_flow(
        address=address.lower(),
        chain_id=chain_id,
        max_depth=depth,
        min_value_eth=min_value,
        direction=direction,
    )


@app.get("/cross-chain/{address}")
def cross_chain(address: str):
    """Scan a wallet across all 14 supported chains."""
    return cross_chain_scan(address.lower())


@app.get("/sanctions/{address}")
def sanctions_check(address: str):
    """Check if a wallet is on OFAC sanctions list or other blocklists."""
    return check_sanctions(address.lower())


@app.get("/tokens/{address}")
def token_portfolio(address: str, chain_id: int = Query(default=1)):
    """Get ERC-20 token portfolio and transfer analysis for a wallet."""
    return get_token_portfolio(address.lower(), chain_id)


@app.get("/similar/{address}")
def similar_wallets(
    address: str,
    chain_id: int = Query(default=1),
    top_k: int = Query(default=5, ge=1, le=20),
):
    """
    Find wallets with similar behavioral patterns.
    Uses the wallet's neighbors as candidates for comparison.
    """
    target = address.lower()
    txns = fetch_transactions(target, chain_id, max_results=200)
    if not txns:
        return {"target": {"address": target}, "similar": [], "candidates_checked": 0}

    # Use top neighbors as candidates
    candidates = discover_neighbors(target, txns, max_neighbors=15)
    return find_similar_wallets(target, candidates, chain_id, top_k)


@app.get("/report/{address}/pdf")
def download_pdf_report(address: str, chain_id: int = Query(default=1)):
    """Generate and download a PDF investigation report."""
    # Run analysis
    analysis = analyze_wallet(address, chain_id)

    # Generate PDF
    pdf_buffer = generate_pdf_report(analysis)

    short = address[:10].lower()
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="kryptos-report-{short}.pdf"'
        },
    )


# ── Advanced Endpoints (v4.0) ───────────────────────────────────────────────

@app.get("/gnn/{address}")
def gnn_analysis(address: str, chain_id: int = Query(default=1)):
    """Run Graph Neural Network scoring on a wallet's transaction sub-graph."""
    target = address.lower()
    normal_txns = fetch_transactions(target, chain_id, max_results=200)
    internal_txns = fetch_internal_transactions(target, chain_id, max_results=100)
    all_txns = normal_txns + internal_txns
    if not all_txns:
        return {"address": target, "gnn_score": 0, "error": "No transactions found"}
    neighbors = discover_neighbors(target, all_txns, max_neighbors=8)
    neighbor_txns = fetch_neighbor_transactions(neighbors, chain_id, max_per_neighbor=50)
    result = gnn_scorer.score(target, all_txns, neighbor_txns, chain_id)
    result["address"] = target
    return result


@app.get("/temporal/{address}")
def temporal_analysis(address: str, chain_id: int = Query(default=1)):
    """Detect temporal anomalies — spikes, regime shifts, burst patterns."""
    target = address.lower()
    txns = fetch_transactions(target, chain_id, max_results=500)
    if not txns:
        return {"address": target, "temporal_risk_score": 0, "error": "No transactions found"}
    result = detect_temporal_anomalies(target, txns)
    result["address"] = target
    return result


@app.get("/mev/{address}")
def mev_analysis(address: str, chain_id: int = Query(default=1)):
    """Detect MEV bot behaviour — sandwich attacks, front-running, arbitrage."""
    target = address.lower()
    txns = fetch_transactions(target, chain_id, max_results=500)
    if not txns:
        return {"address": target, "mev_risk_score": 0, "is_mev_bot": False, "error": "No transactions found"}
    result = detect_mev_activity(target, txns)
    result["address"] = target
    return result


@app.get("/bridges/{address}")
def bridge_analysis(address: str, chain_id: int = Query(default=1)):
    """Detect cross-chain bridge usage and obfuscation patterns."""
    target = address.lower()
    txns = fetch_transactions(target, chain_id, max_results=500)
    token_txns = fetch_token_transfers(target, chain_id, max_results=200)
    result = detect_bridge_usage(target, txns, token_txns)
    result["address"] = target
    return result


# ── Community Reports ───────────────────────────────────────────────────────

@app.post("/community/report")
def create_community_report(req: ReportRequest):
    """Submit a community scam report for an address."""
    return submit_report(
        address=req.address,
        category=req.category,
        description=req.description,
        reporter_id=req.reporter_id,
        evidence_urls=req.evidence_urls,
        chain_id=req.chain_id,
    )


@app.get("/community/reports/{address}")
def get_community_reports(address: str, limit: int = Query(default=50, ge=1, le=200)):
    """Get all community reports for a specific address."""
    return get_reports(address.lower(), limit)


@app.post("/community/vote")
def vote_on_report(req: VoteRequest):
    """Upvote or downvote a community report."""
    return vote_report(req.report_id, req.vote, req.voter_id)


@app.get("/community/recent")
def recent_community_reports(limit: int = Query(default=20, ge=1, le=100)):
    """Get the most recent community reports across all addresses."""
    return get_recent_reports(limit)


@app.get("/community/flagged")
def flagged_addresses(min_reports: int = Query(default=2, ge=1)):
    """Get addresses with the most community reports."""
    return get_flagged_addresses(min_reports)


# ── Batch Analysis ──────────────────────────────────────────────────────────

@app.post("/batch")
def batch_analysis(req: BatchRequest):
    """Analyze multiple addresses in one request (max 50)."""
    return analyze_batch(
        addresses=req.addresses,
        chain_id=req.chain_id,
        quick=req.quick,
    )


# ── Token Risk Scanner ───────────────────────────────────────────────────────

@app.get("/token-scan/{address}")
def token_risk_scan(address: str, chain_id: int = Query(default=1, description="Chain ID")):
    """Scan an ERC-20 token contract for risk signals."""
    try:
        return scan_token(address.lower(), chain_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "contract_address": address.lower()}


# ── Contract Auditor ─────────────────────────────────────────────────────────

@app.get("/contract-audit/{address}")
def contract_security_audit(address: str, chain_id: int = Query(default=1, description="Chain ID")):
    """Run a static security audit on a smart contract."""
    try:
        return audit_contract(address.lower(), chain_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "contract_address": address.lower()}


@app.post("/batch/csv")
def batch_csv_analysis(req: BatchCsvRequest):
    """Analyze addresses from CSV content."""
    addresses = parse_csv_addresses(req.csv_content)
    if not addresses:
        return {"error": "No valid addresses found in CSV"}
    return analyze_batch(
        addresses=addresses,
        chain_id=req.chain_id,
        quick=req.quick,
    )


# ── Wallet Watchlist ─────────────────────────────────────────────────────────

@app.get("/watchlist/quick-score/{address}")
def watchlist_quick_score(address: str, chain_id: int = Query(default=1, description="Chain ID")):
    """Lightweight wallet risk check for watchlist monitoring."""
    try:
        return quick_score(address.lower(), chain_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "address": address.lower()}


# ── Shareable Report Links ──────────────────────────────────────────────────

@app.post("/share")
def create_shared_report(req: ShareRequest, db=Depends(get_db)):
    """
    Save an analysis result and return a short shareable link ID.
    The frontend sends the full analysis JSON after running /analyze.
    """
    data = req.data
    address = data.get("address", "unknown")
    chain_id = data.get("chain", {}).get("id", 1) if isinstance(data.get("chain"), dict) else 1
    chain_name = data.get("chain", {}).get("name", "Ethereum") if isinstance(data.get("chain"), dict) else "Ethereum"
    risk_score = data.get("risk_score", 0)
    risk_label = data.get("risk_label", "Unknown")

    report_id = _generate_report_id()
    # Ensure uniqueness (extremely unlikely collision)
    while db.query(SharedReport).filter(SharedReport.id == report_id).first():
        report_id = _generate_report_id()

    report = SharedReport(
        id=report_id,
        address=address,
        chain_id=chain_id,
        chain_name=chain_name,
        risk_score=risk_score,
        risk_label=risk_label,
        data=json.dumps(data),
    )
    db.add(report)
    db.commit()

    return {
        "report_id": report_id,
        "url": f"/report/{report_id}",
        "address": address,
        "risk_score": risk_score,
        "risk_label": risk_label,
    }


@app.get("/shared/{report_id}")
def get_shared_report(report_id: str, db=Depends(get_db)):
    """Retrieve a shared report by its short ID."""
    report = db.query(SharedReport).filter(SharedReport.id == report_id).first()
    if not report:
        return {"error": "Report not found", "report_id": report_id}

    # Increment view count
    report.views = (report.views or 0) + 1
    db.commit()

    return {
        "report_id": report.id,
        "address": report.address,
        "chain_id": report.chain_id,
        "chain_name": report.chain_name,
        "risk_score": report.risk_score,
        "risk_label": report.risk_label,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "views": report.views,
        "data": json.loads(report.data),
    }


@app.get("/shared/{report_id}/meta")
def get_shared_report_meta(report_id: str, db=Depends(get_db)):
    """Lightweight metadata for OG tags / link previews (no full data)."""
    report = db.query(SharedReport).filter(SharedReport.id == report_id).first()
    if not report:
        return {"error": "Report not found", "report_id": report_id}

    return {
        "report_id": report.id,
        "address": report.address,
        "chain_name": report.chain_name,
        "risk_score": report.risk_score,
        "risk_label": report.risk_label,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "views": report.views,
    }
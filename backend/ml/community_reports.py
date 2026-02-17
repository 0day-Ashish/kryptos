"""
community_reports.py — Collaborative flagging / community reporting system.

Allows users to submit scam reports that feed back into the scoring model.
Reports are stored in a local JSON file and aggregated per address.

Report types: scam, phishing, rug_pull, honeypot, impersonation, wash_trading, other
"""

import json
import time
import hashlib
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from collections import defaultdict

# Data directory
DATA_DIR = Path(__file__).parent.parent / ".data"
DATA_DIR.mkdir(exist_ok=True)
REPORTS_FILE = DATA_DIR / "community_reports.json"
VOTES_FILE = DATA_DIR / "report_votes.json"

# Allowed report categories
REPORT_CATEGORIES = [
    "scam",
    "phishing",
    "rug_pull",
    "honeypot",
    "impersonation",
    "wash_trading",
    "drainer",
    "fake_token",
    "ponzi",
    "other",
]

# Minimum reports before a community flag affects scoring
MIN_REPORTS_THRESHOLD = 2
# Maximum community risk modifier
MAX_COMMUNITY_MODIFIER = 30


# ── Storage helpers ─────────────────────────────────────────────────────────

def _load_reports() -> List[Dict]:
    if REPORTS_FILE.exists():
        try:
            return json.loads(REPORTS_FILE.read_text())
        except (json.JSONDecodeError, Exception):
            return []
    return []


def _save_reports(reports: List[Dict]):
    REPORTS_FILE.write_text(json.dumps(reports, indent=2))


def _load_votes() -> Dict[str, Dict]:
    if VOTES_FILE.exists():
        try:
            return json.loads(VOTES_FILE.read_text())
        except (json.JSONDecodeError, Exception):
            return {}
    return {}


def _save_votes(votes: Dict):
    VOTES_FILE.write_text(json.dumps(votes, indent=2))


def _generate_report_id(address: str, reporter: str, category: str) -> str:
    raw = f"{address.lower()}:{reporter}:{category}:{time.time()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


# ── Public API ──────────────────────────────────────────────────────────────

def submit_report(
    address: str,
    category: str,
    description: str = "",
    reporter_id: str = "anonymous",
    evidence_urls: List[str] = None,
    chain_id: int = 1,
) -> Dict[str, Any]:
    """
    Submit a community scam report for an address.

    Returns the created report record.
    """
    address = address.lower()
    category = category.lower().strip()

    if category not in REPORT_CATEGORIES:
        return {
            "error": f"Invalid category. Must be one of: {', '.join(REPORT_CATEGORIES)}",
            "valid_categories": REPORT_CATEGORIES,
        }

    if len(description) > 2000:
        return {"error": "Description too long (max 2000 characters)"}

    report_id = _generate_report_id(address, reporter_id, category)

    report = {
        "id": report_id,
        "address": address,
        "category": category,
        "description": description[:2000],
        "reporter_id": reporter_id,
        "evidence_urls": (evidence_urls or [])[:5],
        "chain_id": chain_id,
        "timestamp": time.time(),
        "date": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "upvotes": 0,
        "downvotes": 0,
        "status": "pending",  # pending, confirmed, disputed, dismissed
    }

    reports = _load_reports()
    reports.append(report)
    _save_reports(reports)

    return {"success": True, "report": report}


def get_reports(
    address: str,
    limit: int = 50,
) -> Dict[str, Any]:
    """Get all community reports for a specific address."""
    address = address.lower()
    reports = _load_reports()

    matching = [r for r in reports if r["address"] == address]
    matching.sort(key=lambda r: r.get("timestamp", 0), reverse=True)

    # Aggregate by category
    category_counts: Dict[str, int] = defaultdict(int)
    for r in matching:
        category_counts[r["category"]] += 1

    total = len(matching)
    # Compute community risk modifier
    risk_modifier = 0
    if total >= MIN_REPORTS_THRESHOLD:
        # More reports → higher modifier (logarithmic scaling)
        import math
        risk_modifier = min(int(math.log2(total + 1) * 8), MAX_COMMUNITY_MODIFIER)

    return {
        "address": address,
        "total_reports": total,
        "category_breakdown": dict(category_counts),
        "risk_modifier": risk_modifier,
        "reports": matching[:limit],
        "threshold_met": total >= MIN_REPORTS_THRESHOLD,
    }


def vote_report(report_id: str, vote: str, voter_id: str = "anonymous") -> Dict[str, Any]:
    """
    Upvote or downvote a report.
    vote must be 'up' or 'down'.
    """
    if vote not in ("up", "down"):
        return {"error": "Vote must be 'up' or 'down'"}

    reports = _load_reports()
    target = None
    for r in reports:
        if r["id"] == report_id:
            target = r
            break

    if not target:
        return {"error": "Report not found"}

    # Check if voter already voted
    votes = _load_votes()
    vote_key = f"{report_id}:{voter_id}"
    if vote_key in votes:
        return {"error": "Already voted on this report", "previous_vote": votes[vote_key]}

    # Apply vote
    if vote == "up":
        target["upvotes"] = target.get("upvotes", 0) + 1
    else:
        target["downvotes"] = target.get("downvotes", 0) + 1

    # Auto-confirm if enough upvotes
    if target.get("upvotes", 0) >= 5 and target.get("status") == "pending":
        target["status"] = "confirmed"

    # Auto-dismiss if enough downvotes
    if target.get("downvotes", 0) >= 5 and target.get("status") == "pending":
        target["status"] = "dismissed"

    _save_reports(reports)

    votes[vote_key] = vote
    _save_votes(votes)

    return {"success": True, "report_id": report_id, "new_status": target["status"]}


def get_recent_reports(limit: int = 20) -> List[Dict]:
    """Get the most recent community reports across all addresses."""
    reports = _load_reports()
    reports.sort(key=lambda r: r.get("timestamp", 0), reverse=True)
    return reports[:limit]


def get_community_risk_modifier(address: str) -> int:
    """Get the risk score modifier from community reports (0 - MAX_COMMUNITY_MODIFIER)."""
    result = get_reports(address)
    return result["risk_modifier"]


def get_flagged_addresses(min_reports: int = 2, limit: int = 50) -> List[Dict]:
    """Get addresses with the most community reports."""
    reports = _load_reports()

    addr_counts: Dict[str, Dict] = defaultdict(lambda: {"count": 0, "categories": set()})
    for r in reports:
        addr_counts[r["address"]]["count"] += 1
        addr_counts[r["address"]]["categories"].add(r["category"])

    flagged = []
    for addr, data in sorted(addr_counts.items(), key=lambda x: x[1]["count"], reverse=True):
        if data["count"] >= min_reports:
            flagged.append({
                "address": addr,
                "report_count": data["count"],
                "categories": list(data["categories"]),
            })

    return flagged[:limit]

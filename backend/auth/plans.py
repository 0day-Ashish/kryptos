"""
Kryptos – Plan enforcement.

Plan tiers:
  anonymous   – no wallet connection required (IP-based rate limiting)
  free        – wallet connected but free tier
  pro         – paid plan ($9/month in CELO)
  enterprise  – institutional plan

Anonymous users can scan wallets, use token scanner, contract auditor,
community reports, and get basic (watermarked) PDFs.  Connecting a wallet
unlocks higher limits, watchlist, batch analysis, and full PDFs.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

try:
    from backend.db.models import get_db, User
    from backend.auth.auth import get_current_user, get_optional_user
except ModuleNotFoundError:
    from db.models import get_db, User
    from auth.auth import get_current_user, get_optional_user


# ── Plan definitions ─────────────────────────────────────────────────────────

PLAN_LIMITS = {
    "anonymous": {
        "daily_scans": 15,
        "allowed_chains": "all",            # All 14 chains
        "batch_max": 0,                     # no batch
        "watchlist_max": 0,                 # no watchlist
        "pdf_reports": "watermarked",       # basic PDF with watermark
        "fund_flow": False,
        "on_chain_reports": False,
        "api_access": False,
        "csv_export": False,
        "contract_audit": True,             # open to all
        "token_scanner": True,              # open to all
        "community_reports": True,          # open to all
    },
    "free": {
        "daily_scans": 50,
        "allowed_chains": "all",            # All 14 chains
        "batch_max": 10,
        "watchlist_max": 5,
        "pdf_reports": True,                # full PDF, no watermark
        "fund_flow": False,
        "on_chain_reports": True,
        "api_access": False,
        "csv_export": True,
        "contract_audit": True,
        "token_scanner": True,
        "community_reports": True,
    },
    "pro": {
        "daily_scans": -1,                  # unlimited
        "allowed_chains": "all",
        "batch_max": 50,
        "watchlist_max": 50,
        "pdf_reports": True,
        "fund_flow": True,
        "on_chain_reports": True,
        "api_access": True,
        "csv_export": True,
        "contract_audit": True,
        "token_scanner": True,
        "community_reports": True,
    },
    "enterprise": {
        "daily_scans": -1,                  # unlimited
        "allowed_chains": "all",
        "batch_max": 50,
        "watchlist_max": -1,                # unlimited
        "pdf_reports": True,
        "fund_flow": True,
        "on_chain_reports": True,
        "api_access": True,
        "csv_export": True,
        "contract_audit": True,
        "token_scanner": True,
        "community_reports": True,
    },
}

VALID_PLANS = set(PLAN_LIMITS.keys())


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_plan_limits(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["anonymous"])


def _reset_daily_scans_if_needed(user: User, db: Session):
    """Reset the daily counter if the last reset was before today."""
    now = datetime.now(timezone.utc)
    reset_dt = user.daily_scan_reset
    if reset_dt is None or reset_dt.date() < now.date():
        user.daily_scan_count = 0
        user.daily_scan_reset = now
        db.commit()


def _get_user_from_wallet(wallet: str, db: Session) -> User:
    user = db.query(User).filter(User.wallet_address == wallet).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── Anonymous (IP-based) rate-limit tracking ─────────────────────────────────
# In-memory store; resets when the server restarts.  For production you'd use
# Redis, but this is fine for the current scale.

_anon_scan_counts: dict[str, dict] = defaultdict(lambda: {"count": 0, "date": None})

ANON_DAILY_LIMIT = PLAN_LIMITS["anonymous"]["daily_scans"]


def _get_client_ip(request: Request) -> str:
    """Extract the real client IP, respecting X-Forwarded-For from proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_anon_quota(ip: str) -> None:
    """Check and increment IP-based daily scan counter for anonymous users."""
    today = datetime.now(timezone.utc).date()
    entry = _anon_scan_counts[ip]

    # Reset if it's a new day
    if entry["date"] != today:
        entry["count"] = 0
        entry["date"] = today

    if entry["count"] >= ANON_DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Daily scan limit reached ({ANON_DAILY_LIMIT} scans/day for "
                f"anonymous users). Connect your wallet for 50 scans/day — free!"
            ),
        )

    entry["count"] += 1


# ── FastAPI dependencies ─────────────────────────────────────────────────────

def require_plan(*allowed_plans: str):
    """
    Dependency factory — returns a dep that rejects users whose plan
    is not in `allowed_plans`.

    Usage:
        @app.get("/trace/{address}", dependencies=[Depends(require_plan("pro", "enterprise"))])
    """
    async def _check(
        wallet: str = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        user = _get_user_from_wallet(wallet, db)
        plan = user.plan or "free"
        if plan not in allowed_plans:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires a {' or '.join(allowed_plans)} plan. You are on the {plan} plan.",
            )
        return user
    return _check


def require_feature(feature_key: str):
    """
    Dependency factory — rejects users whose plan does not include
    a boolean feature.  Requires authentication.

    Usage:
        @app.get("/trace/{addr}", dependencies=[Depends(require_feature("fund_flow"))])
    """
    async def _check(
        wallet: str = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        user = _get_user_from_wallet(wallet, db)
        limits = get_plan_limits(user.plan or "free")
        if not limits.get(feature_key, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your plan ({user.plan or 'free'}) does not include this feature. Upgrade to access it.",
            )
        return user
    return _check


async def check_scan_quota(
    wallet: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency that checks & increments the daily scan counter.
    Free users: 50/day.  Pro/Enterprise: unlimited.
    """
    user = _get_user_from_wallet(wallet, db)
    limits = get_plan_limits(user.plan or "free")
    daily_limit = limits["daily_scans"]

    if daily_limit == -1:
        return user

    _reset_daily_scans_if_needed(user, db)

    if user.daily_scan_count >= daily_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily scan limit reached ({daily_limit} scans/day on the {user.plan or 'free'} plan). Upgrade for unlimited scans.",
        )

    user.daily_scan_count += 1
    db.commit()
    return user


async def check_scan_quota_flexible(
    request: Request,
    wallet: Optional[str] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Flexible scan quota — works for BOTH authenticated and anonymous users.

    - Anonymous: IP-based rate limiting (15 scans/day, all chains)
    - Authenticated free: 50 scans/day
    - Pro/Enterprise: unlimited

    Returns the User object if authenticated, or None for anonymous.
    """
    if wallet is None:
        # Anonymous user → IP-based rate limiting
        ip = _get_client_ip(request)
        _check_anon_quota(ip)
        return None

    # Authenticated user → standard plan-based quota
    user = db.query(User).filter(User.wallet_address == wallet).first()
    if user is None:
        # Token is valid but user record missing — treat as anonymous
        ip = _get_client_ip(request)
        _check_anon_quota(ip)
        return None

    limits = get_plan_limits(user.plan or "free")
    daily_limit = limits["daily_scans"]

    if daily_limit == -1:
        return user

    _reset_daily_scans_if_needed(user, db)

    if user.daily_scan_count >= daily_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily scan limit reached ({daily_limit} scans/day on the {user.plan or 'free'} plan). Upgrade for unlimited scans.",
        )

    user.daily_scan_count += 1
    db.commit()
    return user


async def check_pdf_access(
    request: Request,
    wallet: Optional[str] = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    PDF access check — allows everyone, but tags whether it should be watermarked.

    Returns:
        {"user": User | None, "watermark": bool}
    """
    if wallet is None:
        # Anonymous → allowed but watermarked
        ip = _get_client_ip(request)
        _check_anon_quota(ip)
        return {"user": None, "watermark": True, "plan": "anonymous"}

    user = db.query(User).filter(User.wallet_address == wallet).first()
    if user is None:
        ip = _get_client_ip(request)
        _check_anon_quota(ip)
        return {"user": None, "watermark": True, "plan": "anonymous"}

    plan = user.plan or "free"
    limits = get_plan_limits(plan)
    pdf_access = limits.get("pdf_reports", False)

    if pdf_access == "watermarked":
        return {"user": user, "watermark": True, "plan": plan}
    elif pdf_access:
        return {"user": user, "watermark": False, "plan": plan}
    else:
        # Plan doesn't include PDFs at all — still allow with watermark
        return {"user": user, "watermark": True, "plan": plan}


async def check_chain_access(
    chain_id: int,
    wallet: str = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Check that the user's plan allows the requested chain."""
    user = _get_user_from_wallet(wallet, db)
    limits = get_plan_limits(user.plan or "free")
    allowed = limits["allowed_chains"]

    if allowed != "all" and chain_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Chain {chain_id} is not available on the {user.plan or 'free'} plan. Upgrade to Pro for multi-chain support.",
        )
    return user


def get_batch_limit(
    wallet: str,
    db: Session,
) -> int:
    """Return the max batch size for the user's plan."""
    user = _get_user_from_wallet(wallet, db)
    limits = get_plan_limits(user.plan or "free")
    return limits["batch_max"]


def get_watchlist_limit(
    wallet: str,
    db: Session,
) -> int:
    """Return the max watchlist items for the user's plan."""
    user = _get_user_from_wallet(wallet, db)
    limits = get_plan_limits(user.plan or "free")
    return limits["watchlist_max"]

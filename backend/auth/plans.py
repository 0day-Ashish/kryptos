"""
Kryptos – Plan enforcement.

Defines plan tiers (free / pro / enterprise), their limits, and FastAPI
dependencies that gate endpoints by plan.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

try:
    from backend.db.models import get_db, User
    from backend.auth.auth import get_current_user, get_optional_user
except ModuleNotFoundError:
    from db.models import get_db, User
    from auth.auth import get_current_user, get_optional_user


# ── Plan definitions ─────────────────────────────────────────────────────────

PLAN_LIMITS = {
    "free": {
        "daily_scans": 5,
        "allowed_chains": [1],              # Ethereum mainnet only
        "batch_max": 0,                     # no batch
        "watchlist_max": 0,                 # no watchlist
        "pdf_reports": False,
        "fund_flow": False,
        "on_chain_reports": False,
        "api_access": False,
        "csv_export": False,
        "contract_audit": False,
    },
    "pro": {
        "daily_scans": -1,                  # unlimited
        "allowed_chains": "all",
        "batch_max": 10,
        "watchlist_max": 20,
        "pdf_reports": True,
        "fund_flow": True,
        "on_chain_reports": True,
        "api_access": False,
        "csv_export": True,
        "contract_audit": True,
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
    },
}

VALID_PLANS = set(PLAN_LIMITS.keys())


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_plan_limits(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


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
    a boolean feature.

    Usage:
        @app.get("/report/{addr}/pdf", dependencies=[Depends(require_feature("pdf_reports"))])
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
    Free users: 5/day.  Pro/Enterprise: unlimited.
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

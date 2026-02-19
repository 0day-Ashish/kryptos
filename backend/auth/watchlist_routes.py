"""
Kryptos – Authenticated watchlist CRUD routes.
All routes require a valid JWT in Authorization: Bearer <token>.

GET    /watchlist/items             → list user's watchlist
POST   /watchlist/items             → add a wallet
PUT    /watchlist/items/{item_id}   → update label / threshold
DELETE /watchlist/items/{item_id}   → remove a wallet
POST   /watchlist/items/{item_id}/refresh → refresh score for one item
POST   /watchlist/refresh-all       → refresh all items
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

try:
    from backend.db.models import get_db, User, WatchlistItem
    from backend.auth.auth import get_current_user
    from backend.ml.watchlist import quick_score
except ModuleNotFoundError:
    from db.models import get_db, User, WatchlistItem
    from auth.auth import get_current_user
    from ml.watchlist import quick_score

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class AddItemRequest(BaseModel):
    address: str
    label: str = ""
    chain_id: int = 1
    chain_name: str = "Ethereum"
    alert_threshold: int = 70

class UpdateItemRequest(BaseModel):
    label: Optional[str] = None
    alert_threshold: Optional[int] = None

class WatchlistItemOut(BaseModel):
    id: int
    address: str
    label: str
    chain_id: int
    chain_name: str
    alert_threshold: int
    added_at: str
    risk_score: Optional[float]
    risk_label: Optional[str]
    prev_score: Optional[float]
    flags: list
    balance: Optional[str]
    ens_name: Optional[str]
    tx_count: Optional[int]
    last_checked: Optional[str]
    is_sanctioned: bool


def _item_to_dict(item: WatchlistItem) -> dict:
    """Convert a DB WatchlistItem to a serializable dict."""
    try:
        flags = json.loads(item.flags) if item.flags else []
    except (json.JSONDecodeError, TypeError):
        flags = []
    return {
        "id": item.id,
        "address": item.address,
        "label": item.label,
        "chain_id": item.chain_id,
        "chain_name": item.chain_name,
        "alert_threshold": item.alert_threshold,
        "added_at": item.added_at.isoformat() if item.added_at else "",
        "risk_score": item.risk_score,
        "risk_label": item.risk_label,
        "prev_score": item.prev_score,
        "flags": flags,
        "balance": item.balance,
        "ens_name": item.ens_name,
        "tx_count": item.tx_count,
        "last_checked": item.last_checked.isoformat() if item.last_checked else None,
        "is_sanctioned": item.is_sanctioned,
    }


def _get_user(db: Session, wallet: str) -> User:
    user = db.query(User).filter(User.wallet_address == wallet).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/items")
def list_items(wallet: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return all watchlist items for the authenticated user."""
    user = _get_user(db, wallet)
    items = db.query(WatchlistItem).filter(WatchlistItem.user_id == user.id).order_by(WatchlistItem.added_at.desc()).all()
    return {"items": [_item_to_dict(i) for i in items]}


@router.post("/items")
def add_item(body: AddItemRequest, wallet: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Add a wallet to the watchlist."""
    user = _get_user(db, wallet)
    address = body.address.strip().lower()

    if not address.startswith("0x") or len(address) != 42:
        raise HTTPException(status_code=400, detail="Invalid address")

    # Check duplicate
    existing = db.query(WatchlistItem).filter(
        WatchlistItem.user_id == user.id,
        WatchlistItem.address == address,
        WatchlistItem.chain_id == body.chain_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already in watchlist")

    item = WatchlistItem(
        user_id=user.id,
        address=address,
        label=body.label or address[:6] + "..." + address[-4:],
        chain_id=body.chain_id,
        chain_name=body.chain_name,
        alert_threshold=body.alert_threshold,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return _item_to_dict(item)


@router.put("/items/{item_id}")
def update_item(item_id: int, body: UpdateItemRequest, wallet: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update label or alert threshold."""
    user = _get_user(db, wallet)
    item = db.query(WatchlistItem).filter(WatchlistItem.id == item_id, WatchlistItem.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if body.label is not None:
        item.label = body.label
    if body.alert_threshold is not None:
        item.alert_threshold = body.alert_threshold

    db.commit()
    db.refresh(item)
    return _item_to_dict(item)


@router.delete("/items/{item_id}")
def delete_item(item_id: int, wallet: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Remove a wallet from the watchlist."""
    user = _get_user(db, wallet)
    item = db.query(WatchlistItem).filter(WatchlistItem.id == item_id, WatchlistItem.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/items/{item_id}/refresh")
def refresh_item(item_id: int, wallet: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Refresh the risk score for a single watchlist item."""
    user = _get_user(db, wallet)
    item = db.query(WatchlistItem).filter(WatchlistItem.id == item_id, WatchlistItem.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    try:
        data = quick_score(item.address, item.chain_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Store previous score
    item.prev_score = item.risk_score
    item.risk_score = data.get("risk_score")
    item.risk_label = data.get("risk_label")
    item.flags = json.dumps(data.get("flags", []))
    item.balance = str(data.get("balance", ""))
    item.ens_name = data.get("ens_name") or item.ens_name
    item.tx_count = data.get("tx_count")
    item.last_checked = datetime.now(timezone.utc)
    item.is_sanctioned = data.get("is_sanctioned", False)

    db.commit()
    db.refresh(item)
    return _item_to_dict(item)


@router.post("/refresh-all")
def refresh_all(wallet: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Refresh risk scores for all watchlist items."""
    user = _get_user(db, wallet)
    items = db.query(WatchlistItem).filter(WatchlistItem.user_id == user.id).all()

    results = []
    for item in items:
        try:
            data = quick_score(item.address, item.chain_id)
            item.prev_score = item.risk_score
            item.risk_score = data.get("risk_score")
            item.risk_label = data.get("risk_label")
            item.flags = json.dumps(data.get("flags", []))
            item.balance = str(data.get("balance", ""))
            item.ens_name = data.get("ens_name") or item.ens_name
            item.tx_count = data.get("tx_count")
            item.last_checked = datetime.now(timezone.utc)
            item.is_sanctioned = data.get("is_sanctioned", False)
            results.append({"address": item.address, "status": "ok"})
        except Exception as e:
            results.append({"address": item.address, "status": "error", "error": str(e)})

    db.commit()
    return {"refreshed": len(results), "results": results}

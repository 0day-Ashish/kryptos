"""
Kryptos – Auth API routes.
POST /auth/nonce   → get a nonce for the wallet
POST /auth/verify  → verify signature, return JWT
GET  /auth/me      → return current user info
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

try:
    from backend.db.models import (
        get_db,
        User,
        DiscordLinkRequest,
        DiscordWalletLink,
    )
    from backend.auth.auth import (
        build_siwe_message, verify_signature, create_jwt, get_current_user,
    )
except ModuleNotFoundError:
    from db.models import get_db, User, DiscordLinkRequest, DiscordWalletLink
    from auth.auth import (
        build_siwe_message, verify_signature, create_jwt, get_current_user,
    )

router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])


# ── Request / Response schemas ───────────────────────────────────────────────

class NonceRequest(BaseModel):
    address: str

class NonceResponse(BaseModel):
    nonce: str
    message: str

class VerifyRequest(BaseModel):
    address: str
    signature: str
    message: str

class VerifyResponse(BaseModel):
    token: str
    address: str

class MeResponse(BaseModel):
    address: str
    created_at: str


class DiscordLinkRequestBody(BaseModel):
    discord_id: str


class DiscordLinkRequestResponse(BaseModel):
    token: str
    nonce: str
    message: str
    expires_at: str


class DiscordVerifyRequest(BaseModel):
    token: str
    address: str
    signature: str
    message: str


class DiscordVerifyResponse(BaseModel):
    linked: bool
    discord_id: str
    wallet_address: str


class DiscordUserResponse(BaseModel):
    discord_id: str
    wallet_address: str
    linked_at: str


class PremiumStatusResponse(BaseModel):
    discord_id: str
    wallet_address: str
    is_premium: bool
    premium_expires_at: str | None


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/nonce", response_model=NonceResponse)
def request_nonce(body: NonceRequest, db: Session = Depends(get_db)):
    """Generate a fresh nonce for the wallet to sign."""
    address = body.address.strip().lower()
    if not address.startswith("0x") or len(address) != 42:
        raise HTTPException(status_code=400, detail="Invalid Ethereum address")

    nonce = secrets.token_hex(16)

    # Upsert user
    user = db.query(User).filter(User.wallet_address == address).first()
    if user:
        user.nonce = nonce
    else:
        user = User(wallet_address=address, nonce=nonce)
        db.add(user)
    db.commit()

    message = build_siwe_message(address, nonce)
    return NonceResponse(nonce=nonce, message=message)


@router.post("/verify", response_model=VerifyResponse)
def verify_and_login(body: VerifyRequest, db: Session = Depends(get_db)):
    """Verify the signed message and return a JWT."""
    address = body.address.strip().lower()

    # Recover signer
    recovered = verify_signature(body.message, body.signature)
    if recovered is None or recovered != address:
        raise HTTPException(status_code=401, detail="Signature verification failed")

    # Check nonce matches
    user = db.query(User).filter(User.wallet_address == address).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Nonce not found – request /auth/nonce first")

    # Verify the nonce is in the message
    if user.nonce not in body.message:
        raise HTTPException(status_code=401, detail="Nonce mismatch")

    # Rotate nonce (single use)
    user.nonce = secrets.token_hex(16)
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    token = create_jwt(address)
    return VerifyResponse(token=token, address=address)


@router.get("/me", response_model=MeResponse)
def get_me(wallet: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the current authenticated user."""
    user = db.query(User).filter(User.wallet_address == wallet).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return MeResponse(
        address=user.wallet_address,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.post("/discord-link-request", response_model=DiscordLinkRequestResponse)
def create_discord_link_request(body: DiscordLinkRequestBody, db: Session = Depends(get_db)):
    """Create a one-time token + SIWE-style message for Discord wallet linking."""
    discord_id = body.discord_id.strip()
    if not discord_id:
        raise HTTPException(status_code=400, detail="discord_id is required")

    token = secrets.token_urlsafe(24)
    nonce = secrets.token_hex(16)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=10)
    issued_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    expires_at_iso = expires_at.strftime("%Y-%m-%dT%H:%M:%SZ")

    message = (
        "Kryptos wants you to sign this message to link your wallet with Discord.\n\n"
        f"Discord ID: {discord_id}\n"
        f"Token: {token}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at}\n"
        f"Expiration Time: {expires_at_iso}"
    )

    request_row = DiscordLinkRequest(
        discord_id=discord_id,
        token=token,
        nonce=nonce,
        message=message,
        expires_at=expires_at,
    )
    db.add(request_row)
    db.commit()

    return DiscordLinkRequestResponse(
        token=token,
        nonce=nonce,
        message=message,
        expires_at=expires_at.isoformat(),
    )


@router.post("/discord-verify", response_model=DiscordVerifyResponse)
def verify_discord_link(body: DiscordVerifyRequest, db: Session = Depends(get_db)):
    """Verify SIWE signature and link a wallet to the Discord user."""
    address = body.address.strip().lower()
    if not address.startswith("0x") or len(address) != 42:
        raise HTTPException(status_code=400, detail="Invalid Ethereum address")

    req = db.query(DiscordLinkRequest).filter(DiscordLinkRequest.token == body.token).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Link token not found")

    now = datetime.now(timezone.utc)
    expires_at = req.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if req.used_at is not None:
        raise HTTPException(status_code=409, detail="Link token already used")
    if expires_at < now:
        raise HTTPException(status_code=410, detail="Link token expired")

    if body.message.strip() != req.message.strip():
        raise HTTPException(status_code=401, detail="Signed message mismatch")

    recovered = verify_signature(body.message, body.signature)
    if recovered is None or recovered != address:
        raise HTTPException(status_code=401, detail="Signature verification failed")

    wallet_conflict = (
        db.query(DiscordWalletLink)
        .filter(
            DiscordWalletLink.wallet_address == address,
            DiscordWalletLink.discord_id != req.discord_id,
        )
        .first()
    )
    if wallet_conflict is not None:
        raise HTTPException(
            status_code=409,
            detail="Wallet is already linked to a different Discord account",
        )

    # Keep auth user in sync for existing SIWE/JWT flows.
    user = db.query(User).filter(User.wallet_address == address).first()
    if user:
        user.last_login = now
        user.nonce = secrets.token_hex(16)
    else:
        user = User(wallet_address=address, nonce=secrets.token_hex(16), last_login=now)
        db.add(user)

    link = db.query(DiscordWalletLink).filter(DiscordWalletLink.discord_id == req.discord_id).first()
    if link:
        link.wallet_address = address
        link.last_verified_at = now
    else:
        link = DiscordWalletLink(
            discord_id=req.discord_id,
            wallet_address=address,
            linked_at=now,
            last_verified_at=now,
        )
        db.add(link)

    req.used_at = now
    req.wallet_address = address
    db.commit()

    return DiscordVerifyResponse(linked=True, discord_id=req.discord_id, wallet_address=address)


@router.get("/discord-user/{discord_id}", response_model=DiscordUserResponse)
def get_discord_linked_user(discord_id: str, db: Session = Depends(get_db)):
    """Return wallet linked to a Discord user ID."""
    link = db.query(DiscordWalletLink).filter(DiscordWalletLink.discord_id == discord_id).first()
    if link is None:
        raise HTTPException(status_code=404, detail="Discord user is not linked")

    return DiscordUserResponse(
        discord_id=link.discord_id,
        wallet_address=link.wallet_address,
        linked_at=link.linked_at.isoformat() if link.linked_at else "",
    )


@users_router.get("/{discord_id}/premium", response_model=PremiumStatusResponse)
def get_discord_premium_status(discord_id: str, db: Session = Depends(get_db)):
    """Return premium subscription status for a Discord user."""
    link = db.query(DiscordWalletLink).filter(DiscordWalletLink.discord_id == discord_id).first()
    if link is None:
        raise HTTPException(status_code=404, detail="Discord user is not linked")

    now = datetime.now(timezone.utc)
    premium_expires_at = link.premium_expires_at
    premium_active = bool(link.is_premium)

    if premium_expires_at is not None:
        exp = premium_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        premium_active = premium_active and exp > now

    return PremiumStatusResponse(
        discord_id=link.discord_id,
        wallet_address=link.wallet_address,
        is_premium=premium_active,
        premium_expires_at=link.premium_expires_at.isoformat() if link.premium_expires_at else None,
    )

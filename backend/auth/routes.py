"""
Kryptos – Auth API routes.
POST /auth/nonce   → get a nonce for the wallet
POST /auth/verify  → verify signature, return JWT
GET  /auth/me      → return current user info
"""

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

try:
    from backend.db.models import get_db, User
    from backend.auth.auth import (
        build_siwe_message, verify_signature, create_jwt, get_current_user,
    )
except ModuleNotFoundError:
    from db.models import get_db, User
    from auth.auth import (
        build_siwe_message, verify_signature, create_jwt, get_current_user,
    )

router = APIRouter(prefix="/auth", tags=["auth"])


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

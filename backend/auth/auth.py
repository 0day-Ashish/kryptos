"""
Kryptos – Authentication helpers.
JWT creation / verification  +  Ethereum signature (SIWE) verification.
"""

import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from eth_account.messages import encode_defunct
from eth_account import Account
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# ── Config ───────────────────────────────────────────────────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72

security = HTTPBearer(auto_error=False)


# ── JWT helpers ──────────────────────────────────────────────────────────────

def create_jwt(wallet_address: str) -> str:
    """Create a signed JWT for the given wallet address."""
    payload = {
        "sub": wallet_address.lower(),
        "iat": int(time.time()),
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt(token: str) -> Optional[str]:
    """Verify a JWT and return the wallet address, or None if invalid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# ── SIWE signature verification ──────────────────────────────────────────────

def verify_signature(message: str, signature: str) -> Optional[str]:
    """
    Verify an Ethereum personal_sign signature and return the recovered address.
    Returns None on failure.
    """
    try:
        encoded = encode_defunct(text=message)
        recovered = Account.recover_message(encoded, signature=signature)
        return recovered.lower()
    except Exception:
        return None


def build_siwe_message(address: str, nonce: str, domain: str = "localhost") -> str:
    """Build a human-readable Sign-In With Ethereum message."""
    issued_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return (
        f"{domain} wants you to sign in with your Ethereum account:\n"
        f"{address}\n\n"
        f"Sign in to Kryptos – Web3 Wallet Risk Analysis\n\n"
        f"URI: http://{domain}\n"
        f"Version: 1\n"
        f"Chain ID: 1\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at}"
    )


# ── FastAPI dependencies ─────────────────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    Require a valid JWT.  Returns the wallet address (lowercase).
    Raises 401 if missing or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    wallet = verify_jwt(credentials.credentials)
    if wallet is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return wallet


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[str]:
    """Allow unauthenticated access. Returns wallet address or None."""
    if credentials is None:
        return None
    return verify_jwt(credentials.credentials)

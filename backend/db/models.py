"""
Kryptos – Database models (SQLAlchemy).
Tables: users, watchlist_items, shared_reports

Supports Neon PostgreSQL (via DATABASE_URL env var) with SQLite fallback.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, create_engine, UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import os

# ── Database connection ─────────────────────────────────────────────────────
# Prefer DATABASE_URL (Neon Postgres) from environment; fall back to SQLite.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(BASE_DIR, '..', 'kryptos.db')}"
)

# SQLite needs check_same_thread; Postgres needs pool_pre_ping for serverless
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), unique=True, nullable=False, index=True)
    nonce = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime, nullable=True)

    watchlist = relationship("WatchlistItem", back_populates="owner", cascade="all, delete-orphan")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    address = Column(String(42), nullable=False)
    label = Column(String(128), default="")
    chain_id = Column(Integer, default=1)
    chain_name = Column(String(64), default="Ethereum")
    alert_threshold = Column(Integer, default=70)
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Cached score data
    risk_score = Column(Float, nullable=True)
    risk_label = Column(String(32), nullable=True)
    prev_score = Column(Float, nullable=True)
    flags = Column(Text, default="[]")  # JSON array stored as text
    balance = Column(String(64), nullable=True)
    ens_name = Column(String(128), nullable=True)
    tx_count = Column(Integer, nullable=True)
    last_checked = Column(DateTime, nullable=True)
    is_sanctioned = Column(Boolean, default=False)

    # Unique per user+address+chain
    __table_args__ = (
        UniqueConstraint("user_id", "address", "chain_id", name="uq_user_addr_chain"),
    )

    owner = relationship("User", back_populates="watchlist")


class SharedReport(Base):
    """Cached analysis results for shareable report links."""
    __tablename__ = "shared_reports"

    id = Column(String(12), primary_key=True, index=True)  # nanoid-style short ID
    address = Column(String(42), nullable=False, index=True)
    chain_id = Column(Integer, default=1)
    chain_name = Column(String(64), default="Ethereum")
    risk_score = Column(Float, nullable=False)
    risk_label = Column(String(32), nullable=False)
    data = Column(Text, nullable=False)  # Full JSON analysis result
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    views = Column(Integer, default=0)


class DiscordLinkRequest(Base):
    """One-time Discord wallet-link challenges."""
    __tablename__ = "discord_link_requests"

    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String(64), nullable=False, index=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    nonce = Column(String(64), nullable=False)
    message = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    used_at = Column(DateTime, nullable=True)
    wallet_address = Column(String(42), nullable=True)


class DiscordWalletLink(Base):
    """Maps a Discord user to a linked wallet and premium status."""
    __tablename__ = "discord_wallet_links"

    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String(64), unique=True, nullable=False, index=True)
    wallet_address = Column(String(42), nullable=False, index=True)
    linked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_verified_at = Column(DateTime, nullable=True)
    is_premium = Column(Boolean, default=False)
    premium_expires_at = Column(DateTime, nullable=True)


# ── Helpers ──────────────────────────────────────────────────────────────────

def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency – yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

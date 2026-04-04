"""
embeds.py — All Kryptos Discord embed builders.

Custom emoji usage
──────────────────
Discord custom emojis are referenced as <:name:id> strings.
E(key) returns the correct string from the registry, or a Unicode fallback.
Run /setupemojis (admin) once to upload the favicon-based PNGs and auto-fill IDs.
"""
from __future__ import annotations
import discord
import datetime
from typing import Any


# ══════════════════════════════════════════════════════════════════════════════
#  EMOJI REGISTRY   format: "key": (discord_id_or_None, fallback_unicode)
# ══════════════════════════════════════════════════════════════════════════════
_EMOJI: dict[str, tuple[int | None, str]] = {
    "kryptos":   (None, "◈"),
    "scan":      (None, "◎"),
    "safe":      (None, "◈"),
    "warn":      (None, "◆"),
    "highrisk":  (None, "▲"),
    "critical":  (None, "■"),
    "pending":   (None, "◷"),
    "error":     (None, "✕"),
    "check":     (None, "✦"),
    "chain":     (None, "⬡"),
    "tx":        (None, "⇄"),
    "wallet":    (None, "◎"),
    "time":      (None, "◷"),
    "flag":      (None, "⚑"),
    "mev":       (None, "⚡"),
    "bridge":    (None, "⇌"),
    "model":     (None, "◈"),
    "link":      (None, "↗"),
    "report":    (None, "◉"),
    "batch":     (None, "▦"),
    "sanction":  (None, "◼"),
    "alert":     (None, "◈"),
    "admin":     (None, "◆"),
    "help":      (None, "◈"),
    "uptime":    (None, "◷"),
    "developer": (None, "◆"),
    "arrow":     (None, "›"),
    "server":    (None, "⬡"),
}


def register_emoji(key: str, emoji_id: int) -> None:
    """Called by setup_emojis cog after uploading to update live IDs."""
    if key in _EMOJI:
        _EMOJI[key] = (emoji_id, _EMOJI[key][1])


def E(key: str) -> str:
    """Return <:kryptos_key:id> if ID known, else the Unicode fallback."""
    entry = _EMOJI.get(key)
    if not entry:
        return "◈"
    eid, fallback = entry
    return f"<:kryptos_{key}:{eid}>" if eid else fallback


# ══════════════════════════════════════════════════════════════════════════════
#  BRAND PALETTE  (zero discord built-in colors)
# ══════════════════════════════════════════════════════════════════════════════
class C:
    LOW      = discord.Color(0x00D26A)
    MEDIUM   = discord.Color(0xF5A623)
    HIGH     = discord.Color(0xFF6B35)
    CRITICAL = discord.Color(0xFF2D55)
    BRAND    = discord.Color(0x5865F2)
    DARK     = discord.Color(0x2B2D42)
    GOLD     = discord.Color(0xFFD700)


# ══════════════════════════════════════════════════════════════════════════════
#  CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════
FOOTER      = "Kryptos  ·  AI-Powered Multi-Chain Blockchain Intelligence"
SCORE_MODEL = "60% Random Forest + 10% Isolation Forest + 30% Heuristics  ·  GNN + Temporal + MEV"

RISK_BANDS: dict[str, dict] = {
    "low": {
        "label":   "Low Risk",
        "range":   (0,  30),
        "color":   C.LOW,
        "ekey":    "safe",
        "summary": "Normal on-chain activity.  No significant threats detected.",
    },
    "medium": {
        "label":   "Medium Risk",
        "range":   (31, 60),
        "color":   C.MEDIUM,
        "ekey":    "warn",
        "summary": "Unusual behavioural patterns detected.  Exercise caution.",
    },
    "high": {
        "label":   "High Risk",
        "range":   (61, 80),
        "color":   C.HIGH,
        "ekey":    "highrisk",
        "summary": "Multiple suspicious indicators flagged.  Proceed with care.",
    },
    "critical": {
        "label":   "Critical Risk",
        "range":   (81, 100),
        "color":   C.CRITICAL,
        "ekey":    "critical",
        "summary": "Strong fraud / scam signals.  High-confidence threat.",
    },
}


# ══════════════════════════════════════════════════════════════════════════════
#  PRIVATE HELPERS
# ══════════════════════════════════════════════════════════════════════════════
def _band(score: int) -> dict:
    for b in RISK_BANDS.values():
        if b["range"][0] <= score <= b["range"][1]:
            return b
    return RISK_BANDS["critical"]


def _bar(score: int, length: int = 14) -> str:
    filled = round((score / 100) * length)
    return "█" * filled + "░" * (length - filled)


def _ts() -> str:
    return datetime.datetime.utcnow().strftime("%d %b %Y  %H:%M UTC")


def _footer(embed: discord.Embed) -> discord.Embed:
    embed.set_footer(text=f"{FOOTER}   ·   {_ts()}")
    return embed


# ══════════════════════════════════════════════════════════════════════════════
#  PUBLIC EMBED BUILDERS
# ══════════════════════════════════════════════════════════════════════════════

def build_pending_embed(address: str, title: str = "Scanning address...") -> discord.Embed:
    e = discord.Embed(
        title=f"{E('pending')}  {title}",
        description=(
            f"**Target**\n"
            f"```\n{address}\n```\n"
            f"  {E('chain')}  Pulling history across **14+ EVM chains**\n"
            f"  {E('model')}  Extracting **32+ behavioural features**\n"
            f"  {E('scan')}  Running **Random Forest + GNN + Isolation Forest** pipeline\n"
            f"  {E('flag')}  Temporal, MEV, Bridge & Sanctions analysis\n\n"
            f"*Analysis typically completes in 3 – 8 seconds.*"
        ),
        color=C.BRAND,
    )
    return _footer(e)


def build_error_embed(title: str, description: str) -> discord.Embed:
    e = discord.Embed(
        title=f"{E('error')}  {title}",
        description=description,
        color=C.CRITICAL,
    )
    return _footer(e)


def build_scan_embed(address: str, data: dict[str, Any]) -> discord.Embed:
    # Map backend response fields (v4 schema) — handles all optional fields gracefully
    score: int       = int(data.get("risk_score", data.get("score", 0)))
    band             = _band(score)
    flags: list[str] = data.get("flags", [])
    addr_type: str   = "EOA" if data.get("address_type") == "EOA" else data.get("address_type", "Unknown")
    
    # Chain can be dict or string
    chain_obj        = data.get("chain", {})
    if isinstance(chain_obj, dict):
        chain: str = chain_obj.get("name", "Ethereum Mainnet")
    else:
        chain: str = str(chain_obj) if chain_obj else "Ethereum Mainnet"
    
    dash_url: str    = data.get("dashboard_url", "")
    chain_url: str   = data.get("on_chain_report_url", "")
    
    # Feature summary (nested object)
    feature_summary  = data.get("feature_summary", {})
    tx_count: int    = int(data.get("tx_count", feature_summary.get("tx_count", 0)))
    cparts: int      = int(data.get("unique_counterparties", feature_summary.get("unique_counterparties", 0)))
    token_transfers: int = int(data.get("token_transfers", 0))
    
    # Token holdings — count unique tokens held (from tokens endpoint or inferred)
    # If tokens array exists in response, use it; otherwise estimate from transfers
    tokens_obj       = data.get("tokens", [])
    token_holdings: int = len(tokens_obj) if isinstance(tokens_obj, list) else int(data.get("token_count", 0))
    
    # Timeline data for first/last seen
    timeline         = data.get("timeline", [])
    first_seen: str  = timeline[0]["date"] if timeline else "—"
    last_seen: str   = timeline[-1]["date"] if timeline else "—"
    
    # MEV and bridge detection
    mev_obj          = data.get("mev", {})
    mev: bool        = mev_obj.get("is_mev_bot", False) if isinstance(mev_obj, dict) else False
    
    bridges_obj      = data.get("bridges", {})
    cross: bool      = bridges_obj.get("total_bridge_txns", 0) > 0 if isinstance(bridges_obj, dict) else False
    
    ens: str         = data.get("ens_name", "")

    sym = E(band["ekey"])

    e = discord.Embed(
        title=f"{sym}  Risk Assessment  —  {band['label']}",
        description=(
            f"**{band['summary']}**\n\n"
            f"```\n"
            f"  Score  {score:>3} / 100\n"
            f"  {_bar(score)}  {band['label'].upper()}\n"
            f"```"
        ),
        color=band["color"],
    )

    addr_val = f"`{address}`" + (f"\n{E('arrow')}  **{ens}**" if ens else "")
    e.add_field(name=f"{E('wallet')}  Address",        value=addr_val,        inline=False)
    e.add_field(name=f"{E('chain')}  Chain",           value=chain,           inline=True)
    e.add_field(name=f"{E('tx')}  Transactions",       value=f"{tx_count:,}", inline=True)
    e.add_field(name=f"{E('report')}  Counterparties", value=f"{cparts:,}",   inline=True)
    e.add_field(name=f"{E('batch')}  Token Transfers", value=f"{token_transfers:,}", inline=True)
    e.add_field(name=f"{E('wallet')}  Tokens Held",    value=f"{token_holdings:,}", inline=True)
    e.add_field(name=f"{E('time')}  First Seen",       value=first_seen,      inline=True)
    e.add_field(name=f"{E('time')}  Last Seen",        value=last_seen,       inline=True)

    # ── ML Pipeline Breakdown ──
    trained_model = data.get("trained_model") or {}
    gnn_obj       = data.get("gnn", {}) or {}
    gnn_score_val = gnn_obj.get("gnn_score", None) if isinstance(gnn_obj, dict) else None
    rf_prob       = trained_model.get("trained_scam_probability", None) if isinstance(trained_model, dict) else None
    rf_risk       = trained_model.get("trained_risk_score", None) if isinstance(trained_model, dict) else None
    anomaly_flag  = trained_model.get("anomaly_flag", None) if isinstance(trained_model, dict) else None
    ml_raw        = data.get("ml_raw_score", None)
    heur_score    = data.get("heuristic_score", None)

    pipeline_lines = []
    if rf_risk is not None:
        pipeline_lines.append(f"  {E('model')}  **Random Forest** — Risk: `{rf_risk}/100`  ·  Scam Prob: `{rf_prob:.2%}`")
    if gnn_score_val is not None:
        pipeline_lines.append(f"  {E('model')}  **GNN (Graph)** — Score: `{gnn_score_val}/100`")
    if ml_raw is not None and ml_raw > 0:
        pipeline_lines.append(f"  {E('model')}  **Isolation Forest** — Raw: `{ml_raw}`  ·  Anomaly: `{'Yes' if anomaly_flag else 'No'}`")
    if heur_score is not None:
        pipeline_lines.append(f"  {E('model')}  **Heuristics** — Score: `{heur_score}`")

    community_mod = data.get("community_risk_modifier", 0)
    if community_mod and community_mod > 0:
        pipeline_lines.append(f"  {E('flag')}  **Community Reports** — Modifier: `+{community_mod}`")

    if pipeline_lines:
        e.add_field(name=f"{E('model')}  ML Pipeline Breakdown", value="\n".join(pipeline_lines), inline=False)

    # ── Advanced Detectors ──
    detectors = []
    if mev:   detectors.append(f"{E('mev')}  MEV / Sandwich Attack Detected")
    if cross: detectors.append(f"{E('bridge')}  Cross-Chain Bridging Activity")

    sanctions_obj = data.get("sanctions", {})
    if isinstance(sanctions_obj, dict) and sanctions_obj.get("is_sanctioned"):
        detectors.append(f"{E('sanction')}  ADDRESS ON SANCTIONS LIST")

    temporal_obj = data.get("temporal", {})
    if isinstance(temporal_obj, dict):
        temporal_score = temporal_obj.get("temporal_risk_score", 0)
        if temporal_score > 70:
            detectors.append(f"{E('flag')}  Temporal Anomalies (Score: {temporal_score})")

    mixer_list = data.get("mixer_interactions", [])
    if mixer_list:
        detectors.append(f"{E('flag')}  Mixer Interactions: {', '.join(mixer_list[:3])}")

    cp_sanctions = data.get("counterparty_sanctions", {})
    if isinstance(cp_sanctions, dict) and cp_sanctions.get("sanctioned_count", 0) > 0:
        detectors.append(f"{E('sanction')}  {cp_sanctions['sanctioned_count']} sanctioned counterpart{'ies' if cp_sanctions['sanctioned_count'] > 1 else 'y'}")

    if detectors:
        e.add_field(name=f"{E('scan')}  Advanced Detectors", value="\n".join(detectors), inline=False)

    # ── Behavioural Flags ──
    if flags:
        lines = "\n".join(f"  {E('flag')}  {f}" for f in flags[:10])
        if len(flags) > 10:
            lines += f"\n  *{len(flags) - 10} additional signals omitted*"
        e.add_field(name=f"{E('flag')}  Behavioural Flags  ({len(flags)})", value=lines, inline=False)
    else:
        e.add_field(name=f"{E('check')}  Behavioural Flags", value="No suspicious behaviours detected.", inline=False)

    e.add_field(name=f"{E('model')}  Scoring Model", value=f"`{SCORE_MODEL}`", inline=False)

    links = []
    if dash_url:  links.append(f"[{E('link')}  Web Dashboard]({dash_url})")
    if chain_url: links.append(f"[{E('link')}  On-Chain Report — Base Sepolia]({chain_url})")
    if links:
        e.add_field(name=f"{E('report')}  Reports", value="   ".join(links), inline=False)

    return _footer(e)


def build_sanctions_embed(address: str, data: dict[str, Any]) -> discord.Embed:
    flagged: bool    = data.get("flagged", False)
    lists: list[str] = data.get("lists", [])
    details: str     = data.get("details", "")

    if flagged:
        e = discord.Embed(
            title=f"{E('sanction')}  Sanctions Match Detected",
            description=(
                f"**Address `{address}` is present on one or more sanctions lists.**\n\n"
                f"  {E('flag')}  Interaction may violate OFAC regulations.\n"
                f"  {E('flag')}  Treat this address as untouchable until verified."
            ),
            color=C.CRITICAL,
        )
        if lists:
            e.add_field(
                name=f"{E('sanction')}  Matched Lists",
                value="\n".join(f"  •  {l}" for l in lists),
                inline=False,
            )
        if details:
            e.add_field(name=f"{E('arrow')}  Details", value=details, inline=False)
    else:
        e = discord.Embed(
            title=f"{E('check')}  No Sanctions Match",
            description=(
                f"Address `{address}` was **not found** on any monitored list.\n\n"
                f"```\n"
                f"  Checked  OFAC SDN List\n"
                f"           EU Consolidated Sanctions List\n"
                f"           Kryptos Heuristic Blacklist\n"
                f"```"
            ),
            color=C.LOW,
        )

    return _footer(e)


def build_batch_embed(results: list[dict], truncated: bool = False) -> discord.Embed:
    total    = len(results)
    low      = sum(1 for r in results if 0  <= r.get("score", 0) <= 30)
    medium   = sum(1 for r in results if 31 <= r.get("score", 0) <= 60)
    high     = sum(1 for r in results if 61 <= r.get("score", 0) <= 80)
    critical = sum(1 for r in results if 81 <= r.get("score", 0) <= 100)

    color = C.LOW
    if medium:   color = C.MEDIUM
    if high:     color = C.HIGH
    if critical: color = C.CRITICAL

    pct = lambda n: int(n / total * 100) if total else 0

    e = discord.Embed(
        title=f"{E('batch')}  Batch Scan Complete",
        description=(
            ("**Warning:** Results truncated to the first 50 addresses.\n\n" if truncated else "") +
            f"Analysed **{total}** address{'es' if total != 1 else ''}.\n\n"
            f"```\n"
            f"  Low Risk       0 – 30    {low:>3}   {_bar(pct(low),  8)}\n"
            f"  Medium Risk   31 – 60    {medium:>3}   {_bar(pct(medium), 8)}\n"
            f"  High Risk     61 – 80    {high:>3}   {_bar(pct(high),  8)}\n"
            f"  Critical     81 – 100    {critical:>3}   {_bar(pct(critical), 8)}\n"
            f"```"
        ),
        color=color,
    )

    top5 = sorted(results, key=lambda r: r.get("score", 0), reverse=True)[:5]
    if top5:
        rows = "\n".join(
            f"  {E('arrow')}  `{r.get('address','?')}` — **{r.get('score','?')}**/100  ·  {r.get('risk_band','—')}"
            for r in top5
        )
        e.add_field(name=f"{E('critical')}  Top 5 Highest Risk", value=rows, inline=False)

    e.add_field(
        name=f"{E('report')}  Full Report",
        value="A detailed CSV report has been attached below.",
        inline=False,
    )
    return _footer(e)


def build_help_embed(
    bot_user: discord.ClientUser,
    uptime_str: str,
    guild_count: int,
) -> discord.Embed:
    e = discord.Embed(
        title=f"{E('kryptos')}  Kryptos  —  Command Reference",
        description=(
            "AI-powered multi-chain blockchain intelligence terminal.\n"
            "Scan wallets, tokens, and contracts across **14+ EVM chains** in seconds.\n"
            "\u200b"
        ),
        color=C.BRAND,
    )

    e.add_field(
        name=f"{E('scan')}  /scan  `[address]`",
        value=(
            "Full AI risk assessment on any EVM wallet, token, or contract.\n"
            "*Returns a 0–100 score from Random Forest + GNN + Isolation Forest, "
            "32+ behavioural flags, MEV/temporal/bridge detection, and report links.*"
        ),
        inline=False,
    )
    e.add_field(
        name=f"{E('sanction')}  /sanctions  `[address]`",
        value=(
            "Cross-references against OFAC SDN, EU Consolidated, and Kryptos heuristic blacklists.\n"
            "*Returns a clean pass or a flagged warning with matched list names.*"
        ),
        inline=False,
    )
    e.add_field(
        name=f"{E('batch')}  /batch  `[file]`",
        value=(
            "Upload a `.csv` or `.txt` with up to **50 addresses** (one per line).\n"
            "*Returns a risk distribution summary + downloadable CSV report.*"
        ),
        inline=False,
    )
    e.add_field(
        name=f"{E('flag')}  /report  `[address]` `[reason]`",
        value=(
            "Flag a suspicious address to the Kryptos community intelligence database.\n"
            "*Feeds the crowdsourced heuristic pipeline.  Cooldown: 30s per user.*"
        ),
        inline=False,
    )
    e.add_field(
        name=f"{E('admin')}  /sync  ·  /status  ·  /alert  `[admin]`",
        value=(
            "Re-sync slash commands, check backend health, or broadcast alpha alerts.\n"
            "*Requires server Administrator permission.*"
        ),
        inline=False,
    )

    e.add_field(name="\u200b", value="\u200b", inline=False)

    e.add_field(name=f"{E('developer')}  Developer",  value="**Kryptos Team**", inline=True)
    e.add_field(name=f"{E('uptime')}  Uptime",        value=uptime_str,         inline=True)
    e.add_field(name=f"{E('server')}  Servers",       value=f"{guild_count:,}", inline=True)
    e.add_field(name=f"{E('model')}  Engine",         value=f"`{SCORE_MODEL}`", inline=False)

    e.set_thumbnail(url=bot_user.display_avatar.url)
    return _footer(e)

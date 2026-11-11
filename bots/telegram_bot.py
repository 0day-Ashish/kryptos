"""
telegram_bot.py — Kryptos Telegram Bot (Production)

Features:
  /scan <address>      — Scan a wallet, show risk score
  /sanctions <address> — Check sanctions status
  /protect             — Toggle auto-scan mode (admin only): scans every 0x address posted
  /watch <address>     — Watch an address, alert group if risk changes
  /unwatch <address>   — Stop watching an address
  /watchlist           — Show all watched addresses in this chat
  /leaderboard         — Top scanners in this chat
  /stats               — Bot usage stats
  /help                — Show help

Environment:
  KRYPTOS_TELEGRAM_TOKEN  — Bot token from @BotFather
  KRYPTOS_API_URL         — Backend API URL (default: http://localhost:8000)

Usage:
  pip install python-telegram-bot aiohttp
  python telegram_bot.py
"""

import os
import re
import json
import asyncio
import logging
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import aiohttp

try:
    from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
    from telegram.ext import (
        Application, CommandHandler, MessageHandler,
        CallbackQueryHandler, ContextTypes, filters,
    )
except ImportError:
    print("Install: pip install python-telegram-bot[job-queue] aiohttp")
    raise

# ── Config ───────────────────────────────────────────────────────────────────
API_URL = os.getenv("KRYPTOS_API_URL", "http://localhost:8000")
TELEGRAM_TOKEN = os.getenv("KRYPTOS_TELEGRAM_TOKEN", "")
DATA_DIR = Path(__file__).parent / ".tg_data"
DATA_DIR.mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("kryptos-tg")

# Regex to match 0x Ethereum addresses in messages
ETH_ADDR_RE = re.compile(r"\b(0x[a-fA-F0-9]{40})\b")

# ── Persistent State (JSON files per chat) ───────────────────────────────────

def _state_path(chat_id: int) -> Path:
    return DATA_DIR / f"chat_{chat_id}.json"

def load_state(chat_id: int) -> dict:
    p = _state_path(chat_id)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    return {
        "protect_mode": False,
        "watched": {},          # address -> {label, last_score, added_by, added_at}
        "scan_counts": {},      # user_id -> count
        "total_scans": 0,
    }

def save_state(chat_id: int, state: dict):
    _state_path(chat_id).write_text(json.dumps(state, indent=2, default=str))

# ── Helpers ──────────────────────────────────────────────────────────────────

def risk_emoji(score: int) -> str:
    if score >= 80: return "🔴"
    if score >= 60: return "🟠"
    if score >= 30: return "🟡"
    return "🟢"

def risk_bar(score: int) -> str:
    filled = score // 10
    return "█" * filled + "░" * (10 - filled)

async def api_get(path: str) -> dict:
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(f"{API_URL}{path}", timeout=aiohttp.ClientTimeout(total=60)) as r:
                if r.status == 200:
                    return await r.json()
                return {"error": f"HTTP {r.status}"}
    except Exception as e:
        return {"error": str(e)}

def format_scan_result(data: dict, address: str) -> str:
    if "error" in data:
        return f"❌ Error scanning `{address[:12]}...`: {data['error']}"

    score = data.get("risk_score", 0)
    label = data.get("risk_label", "Unknown")
    flags = data.get("flags", [])
    fs = data.get("feature_summary", {})
    addr = data.get("address", address)
    emoji = risk_emoji(score)
    bar = risk_bar(score)

    lines = [
        f"{emoji} *Risk Score: {score}/100*",
        f"`{bar}` — {label}",
        f"",
        f"Address: `{addr}`",
        f"ML: {data.get('ml_raw_score', '—')} | Heuristic: {data.get('heuristic_score', '—')}",
    ]

    if fs:
        txns = fs.get("tx_count", "—")
        cps = fs.get("unique_counterparties", "—")
        lines.append(f"Txns: {txns} | Counterparties: {cps}")

    if flags:
        lines.append(f"\n⚠️ *Flags ({len(flags)}):*")
        for f in flags[:5]:
            # Escape markdown special chars in flags
            f_safe = f.replace("*", "").replace("_", "").replace("`", "")
            lines.append(f"  • {f_safe}")
        if len(flags) > 5:
            lines.append(f"  ... +{len(flags) - 5} more")

    sanctions = data.get("sanctions", {})
    if sanctions.get("is_sanctioned"):
        lines.append("\n🚫 *ADDRESS IS ON OFAC SANCTIONS LIST*")

    lines.append(f"\n🔗 [Full Report](https://kryptos.xyz/analyze?addr={addr})")

    return "\n".join(lines)

def _track_scan(state: dict, user_id: int):
    uid = str(user_id)
    state["scan_counts"][uid] = state.get("scan_counts", {}).get(uid, 0) + 1
    state["total_scans"] = state.get("total_scans", 0) + 1

# ── Command Handlers ─────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = (
        "🔍 *Kryptos — AI Blockchain Intelligence*\n\n"
        "I scan wallet addresses for scam risk using ML, GNN, and heuristic analysis.\n\n"
        "*Commands:*\n"
        "/scan `<address>` — Scan a wallet\n"
        "/sanctions `<address>` — Check sanctions\n"
        "/protect — Toggle auto\\-scan mode \\(admin\\)\n"
        "/watch `<address>` — Monitor a wallet\n"
        "/unwatch `<address>` — Stop monitoring\n"
        "/watchlist — Show watched wallets\n"
        "/leaderboard — Top scanners\n"
        "/stats — Bot stats\n"
        "/help — This message\n\n"
        "Or just paste any 0x address and I'll scan it\\!\n\n"
        "_Powered by Kryptos AI — 14 chains supported_"
    )
    await update.message.reply_text(text, parse_mode="MarkdownV2")


async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await cmd_start(update, ctx)


async def cmd_scan(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: /scan <address or ENS name>")
        return

    address = ctx.args[0]
    chat_id = update.effective_chat.id
    state = load_state(chat_id)
    msg = await update.message.reply_text(f"⏳ Scanning `{address[:16]}...`", parse_mode="Markdown")

    data = await api_get(f"/analyze/{address}")
    text = format_scan_result(data, address)

    _track_scan(state, update.effective_user.id)
    save_state(chat_id, state)

    # Add watch button
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("👀 Watch", callback_data=f"watch:{address[:42]}"),
        InlineKeyboardButton("📄 PDF", callback_data=f"pdf:{address[:42]}"),
    ]])

    try:
        await msg.edit_text(text, parse_mode="Markdown", reply_markup=keyboard,
                           disable_web_page_preview=True)
    except Exception:
        # Fallback without markdown if formatting fails
        await msg.edit_text(text.replace("*", "").replace("`", ""), reply_markup=keyboard)


async def cmd_sanctions(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: /sanctions <address>")
        return

    address = ctx.args[0]
    data = await api_get(f"/sanctions/{address}")

    if data.get("is_sanctioned"):
        text = f"🚫 `{address}` is *SANCTIONED* (OFAC SDN)"
    elif data.get("is_known_scam"):
        text = f"⚠️ `{address}` is on known *scam lists*"
    elif "error" in data:
        text = f"❌ Error: {data['error']}"
    else:
        text = f"✅ `{address}` is *not sanctioned*"

    await update.message.reply_text(text, parse_mode="Markdown")


# ── Protect Mode (Auto-Scan) ────────────────────────────────────────────────

async def cmd_protect(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Toggle auto-scan mode. Only group admins can toggle."""
    chat = update.effective_chat
    user = update.effective_user

    # In private chats, always allow
    if chat.type == "private":
        state = load_state(chat.id)
        state["protect_mode"] = not state["protect_mode"]
        save_state(chat.id, state)
        status = "ON ✅" if state["protect_mode"] else "OFF ❌"
        await update.message.reply_text(f"🛡️ Protect mode: *{status}*\n\nI'll auto-scan any 0x address you paste.", parse_mode="Markdown")
        return

    # In groups, check if user is admin
    try:
        member = await chat.get_member(user.id)
        if member.status not in ("administrator", "creator"):
            await update.message.reply_text("⚠️ Only group admins can toggle protect mode.")
            return
    except Exception:
        await update.message.reply_text("⚠️ I need admin rights to check permissions.")
        return

    state = load_state(chat.id)
    state["protect_mode"] = not state["protect_mode"]
    save_state(chat.id, state)

    status = "ON ✅" if state["protect_mode"] else "OFF ❌"
    msg = (
        f"🛡️ *Protect Mode: {status}*\n\n"
    )
    if state["protect_mode"]:
        msg += "I'll now auto-scan every wallet address posted in this group and warn about risky ones."
    else:
        msg += "Auto-scanning disabled. Use /scan to manually check addresses."

    await update.message.reply_text(msg, parse_mode="Markdown")


async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Intercept messages to auto-scan addresses when protect mode is on."""
    if not update.message or not update.message.text:
        return

    chat_id = update.effective_chat.id
    state = load_state(chat_id)

    if not state.get("protect_mode", False):
        return

    # Find all 0x addresses in the message
    addresses = ETH_ADDR_RE.findall(update.message.text)
    if not addresses:
        return

    # Deduplicate
    addresses = list(dict.fromkeys(addresses))[:3]  # Max 3 per message

    for address in addresses:
        data = await api_get(f"/analyze/{address}")
        score = data.get("risk_score", 0)

        # Only auto-reply for medium+ risk (don't spam for safe wallets)
        if score >= 30:
            text = format_scan_result(data, address)
            prefix = "🛡️ *Auto-Protect Scan:*\n\n"
            await update.message.reply_text(
                prefix + text, parse_mode="Markdown",
                disable_web_page_preview=True,
            )
        else:
            # Low risk — just a quick green checkmark reply
            emoji = risk_emoji(score)
            await update.message.reply_text(
                f"{emoji} `{address[:8]}...{address[-4:]}` — Score: {score}/100 (Low Risk)",
                parse_mode="Markdown",
            )

        _track_scan(state, update.effective_user.id)

    save_state(chat_id, state)


# ── Watch / Unwatch ──────────────────────────────────────────────────────────

async def cmd_watch(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: /watch <address> [label]")
        return

    address = ctx.args[0].lower()
    label = " ".join(ctx.args[1:]) if len(ctx.args) > 1 else ""
    chat_id = update.effective_chat.id
    state = load_state(chat_id)
    watched = state.setdefault("watched", {})

    if len(watched) >= 20:
        await update.message.reply_text("⚠️ Maximum 20 watched addresses per chat. Use /unwatch to remove one.")
        return

    # Do an initial scan
    data = await api_get(f"/analyze/{address}")
    score = data.get("risk_score", 0)

    watched[address] = {
        "label": label or address[:8],
        "last_score": score,
        "added_by": update.effective_user.first_name,
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    save_state(chat_id, state)

    emoji = risk_emoji(score)
    await update.message.reply_text(
        f"👀 *Watching:* `{address}`\n"
        f"Label: {label or '—'}\n"
        f"Current score: {emoji} {score}/100\n\n"
        f"I'll alert this chat if the risk score changes significantly.",
        parse_mode="Markdown",
    )


async def cmd_unwatch(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: /unwatch <address>")
        return

    address = ctx.args[0].lower()
    chat_id = update.effective_chat.id
    state = load_state(chat_id)
    watched = state.get("watched", {})

    if address in watched:
        del watched[address]
        save_state(chat_id, state)
        await update.message.reply_text(f"✅ Stopped watching `{address[:12]}...`", parse_mode="Markdown")
    else:
        await update.message.reply_text("⚠️ That address is not on the watchlist.")


async def cmd_watchlist(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    state = load_state(chat_id)
    watched = state.get("watched", {})

    if not watched:
        await update.message.reply_text("📋 Watchlist is empty. Use /watch <address> to add one.")
        return

    lines = ["📋 *Watchlist:*\n"]
    for addr, info in watched.items():
        score = info.get("last_score", 0)
        emoji = risk_emoji(score)
        label = info.get("label", "")
        short = f"{addr[:8]}...{addr[-4:]}"
        lines.append(f"{emoji} `{short}` — Score: {score} ({label})")

    lines.append(f"\n_{len(watched)} address(es) watched_")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ── Leaderboard ──────────────────────────────────────────────────────────────

async def cmd_leaderboard(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    state = load_state(chat_id)
    counts = state.get("scan_counts", {})

    if not counts:
        await update.message.reply_text("📊 No scans yet. Be the first — /scan <address>")
        return

    # Sort by count descending
    sorted_users = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:10]

    lines = ["🏆 *Scan Leaderboard:*\n"]
    medals = ["🥇", "🥈", "🥉"]
    for i, (uid, count) in enumerate(sorted_users):
        medal = medals[i] if i < 3 else f"{i+1}."
        # Try to get user info
        try:
            member = await update.effective_chat.get_member(int(uid))
            name = member.user.first_name or f"User {uid}"
        except Exception:
            name = f"User {uid[:8]}"
        lines.append(f"{medal} {name} — {count} scans")

    lines.append(f"\n_Total: {state.get('total_scans', 0)} scans_")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_stats(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    state = load_state(chat_id)

    protect = "ON ✅" if state.get("protect_mode") else "OFF ❌"
    watched = len(state.get("watched", {}))
    scanners = len(state.get("scan_counts", {}))
    total = state.get("total_scans", 0)

    text = (
        f"📊 *Kryptos Bot Stats:*\n\n"
        f"🛡️ Protect mode: {protect}\n"
        f"👀 Watched addresses: {watched}\n"
        f"👥 Unique scanners: {scanners}\n"
        f"🔍 Total scans: {total}\n"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


# ── Callback (inline button) handlers ────────────────────────────────────────

async def handle_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    data = query.data
    if data.startswith("watch:"):
        address = data.split(":", 1)[1]
        chat_id = query.message.chat_id
        state = load_state(chat_id)
        watched = state.setdefault("watched", {})

        if address in watched:
            await query.answer("Already watching this address!", show_alert=True)
            return

        if len(watched) >= 20:
            await query.answer("Watchlist full (20 max)!", show_alert=True)
            return

        api_data = await api_get(f"/analyze/{address}")
        score = api_data.get("risk_score", 0)

        watched[address] = {
            "label": address[:8],
            "last_score": score,
            "added_by": query.from_user.first_name,
            "added_at": datetime.now(timezone.utc).isoformat(),
        }
        save_state(chat_id, state)
        await query.answer(f"👀 Now watching {address[:12]}... (score: {score})", show_alert=True)

    elif data.startswith("pdf:"):
        address = data.split(":", 1)[1]
        await query.answer(f"📄 Download PDF at:\nhttps://kryptos.xyz/report/{address}/pdf", show_alert=True)


# ── Watchlist Re-check Job ───────────────────────────────────────────────────

async def watchlist_recheck(ctx: ContextTypes.DEFAULT_TYPE):
    """Periodic job: re-score all watched addresses, alert on significant changes."""
    for state_file in DATA_DIR.glob("chat_*.json"):
        try:
            chat_id = int(state_file.stem.replace("chat_", ""))
            state = load_state(chat_id)
            watched = state.get("watched", {})
            if not watched:
                continue

            alerts = []
            for addr, info in watched.items():
                old_score = info.get("last_score", 0)
                data = await api_get(f"/analyze/{addr}")
                new_score = data.get("risk_score", old_score)
                delta = new_score - old_score

                if abs(delta) >= 10:
                    direction = "📈 INCREASED" if delta > 0 else "📉 decreased"
                    emoji = risk_emoji(new_score)
                    label = info.get("label", addr[:8])
                    alerts.append(
                        f"{emoji} *{label}* (`{addr[:8]}...{addr[-4:]}`)\n"
                        f"   {direction}: {old_score} → {new_score} (Δ{delta:+d})"
                    )

                info["last_score"] = new_score

            save_state(chat_id, state)

            if alerts:
                text = "🔔 *Watchlist Alert:*\n\n" + "\n\n".join(alerts)
                try:
                    await ctx.bot.send_message(chat_id, text, parse_mode="Markdown")
                except Exception as e:
                    log.warning(f"Failed to send alert to {chat_id}: {e}")

        except Exception as e:
            log.error(f"Watchlist recheck error for {state_file}: {e}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not TELEGRAM_TOKEN:
        print("Set KRYPTOS_TELEGRAM_TOKEN environment variable")
        print("Get one from @BotFather on Telegram")
        return

    log.info(f"Starting Kryptos Telegram bot (API: {API_URL})")

    app = Application.builder().token(TELEGRAM_TOKEN).build()

    # Commands
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("scan", cmd_scan))
    app.add_handler(CommandHandler("sanctions", cmd_sanctions))
    app.add_handler(CommandHandler("protect", cmd_protect))
    app.add_handler(CommandHandler("watch", cmd_watch))
    app.add_handler(CommandHandler("unwatch", cmd_unwatch))
    app.add_handler(CommandHandler("watchlist", cmd_watchlist))
    app.add_handler(CommandHandler("leaderboard", cmd_leaderboard))
    app.add_handler(CommandHandler("stats", cmd_stats))

    # Inline button callbacks
    app.add_handler(CallbackQueryHandler(handle_callback))

    # Auto-scan messages (protect mode) — must be last
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Periodic watchlist re-check every 6 hours
    if app.job_queue:
        app.job_queue.run_repeating(watchlist_recheck, interval=6 * 3600, first=300)
        log.info("Watchlist re-check job scheduled (every 6h)")

    log.info("Bot is running. Press Ctrl+C to stop.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()

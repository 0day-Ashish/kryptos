"""
discord_bot.py — Kryptos Discord Bot for on-demand wallet scanning.

Commands:
  /scan <address>     — Scan a wallet and show risk score
  /sanctions <address> — Check sanctions status
  /batch <addr1,addr2> — Quick batch scan
  /help               — Show help

Environment variables:
  KRYPTOS_DISCORD_TOKEN  — Discord bot token
  KRYPTOS_API_URL        — Backend API URL (default: http://localhost:8000)

Usage:
  pip install discord.py aiohttp
  export KRYPTOS_DISCORD_TOKEN=your_token
  python discord_bot.py
"""

import os
import asyncio
import aiohttp

try:
    import discord
    from discord import app_commands
    HAS_DISCORD = True
except ImportError:
    HAS_DISCORD = False

API_URL = os.getenv("KRYPTOS_API_URL", "http://localhost:8000")
DISCORD_TOKEN = os.getenv("KRYPTOS_DISCORD_TOKEN", "")


def risk_emoji(score: int) -> str:
    if score >= 75:
        return "🚨"
    elif score >= 40:
        return "⚠️"
    return "✅"


def risk_color(score: int) -> int:
    if score >= 75:
        return 0xEF4444  # red
    elif score >= 40:
        return 0xF59E0B  # amber
    return 0x22C55E  # green


if HAS_DISCORD:

    class KryptosBot(discord.Client):
        def __init__(self):
            intents = discord.Intents.default()
            intents.message_content = True
            super().__init__(intents=intents)
            self.tree = app_commands.CommandTree(self)
            self.session: aiohttp.ClientSession | None = None

        async def setup_hook(self):
            self.session = aiohttp.ClientSession()
            await self.tree.sync()
            print(f"Kryptos bot ready! Synced {len(self.tree.get_commands())} commands.")

        async def close(self):
            if self.session:
                await self.session.close()
            await super().close()

    client = KryptosBot()

    @client.tree.command(name="scan", description="Scan a wallet address for scam risk")
    @app_commands.describe(address="Ethereum address or ENS name to scan")
    async def scan_command(interaction: discord.Interaction, address: str):
        await interaction.response.defer(thinking=True)

        try:
            async with client.session.get(f"{API_URL}/analyze/{address}") as resp:
                if resp.status != 200:
                    await interaction.followup.send(f"❌ API error: HTTP {resp.status}")
                    return
                data = await resp.json()

            score = data.get("risk_score", 0)
            label = data.get("risk_label", "Unknown")
            flags = data.get("flags", [])
            fs = data.get("feature_summary", {})
            emoji = risk_emoji(score)

            embed = discord.Embed(
                title=f"{emoji} Risk Score: {score}/100",
                description=f"**{label}**",
                color=risk_color(score),
            )
            embed.set_author(name="Kryptos Scam Detector")

            # Address
            addr = data.get("address", address)
            embed.add_field(name="Address", value=f"`{addr}`", inline=False)

            # ENS
            if data.get("ens_name"):
                embed.add_field(name="ENS", value=data["ens_name"], inline=True)

            # Scores
            embed.add_field(name="ML Score", value=str(data.get("ml_raw_score", "—")), inline=True)
            embed.add_field(name="Heuristic", value=str(data.get("heuristic_score", "—")), inline=True)

            # Stats
            if fs:
                embed.add_field(
                    name="Stats",
                    value=f"Txns: {fs.get('tx_count', '—')} | "
                          f"Counterparties: {fs.get('unique_counterparties', '—')}\n"
                          f"Sent: {fs.get('total_value_sent_eth', 0):.4f} ETH | "
                          f"Received: {fs.get('total_value_received_eth', 0):.4f} ETH",
                    inline=False,
                )

            # Flags
            if flags:
                flag_text = "\n".join(f"• {f}" for f in flags[:8])
                embed.add_field(name="⚠️ Flags", value=flag_text, inline=False)

            # Sanctions
            if data.get("is_sanctioned"):
                embed.add_field(
                    name="🚫 SANCTIONED",
                    value="This address is on the OFAC SDN list!",
                    inline=False,
                )

            embed.set_footer(text="Powered by Kryptos AI • github.com/ashishranjandas/kryptos")

            await interaction.followup.send(embed=embed)

        except aiohttp.ClientError as e:
            await interaction.followup.send(
                f"❌ Could not reach Kryptos API at `{API_URL}`.\n"
                f"Make sure the backend is running.\n`{e}`"
            )
        except Exception as e:
            await interaction.followup.send(f"❌ Error: `{e}`")

    @client.tree.command(name="sanctions", description="Check if an address is sanctioned")
    @app_commands.describe(address="Ethereum address to check")
    async def sanctions_command(interaction: discord.Interaction, address: str):
        await interaction.response.defer(thinking=True)

        try:
            async with client.session.get(f"{API_URL}/sanctions/{address}") as resp:
                data = await resp.json()

            is_sanctioned = data.get("is_sanctioned", False)
            on_scam_list = data.get("is_known_scam", False)

            if is_sanctioned:
                embed = discord.Embed(
                    title="🚫 SANCTIONED ADDRESS",
                    description=f"`{address}` is on the OFAC SDN list!",
                    color=0xEF4444,
                )
                if data.get("ofac_match"):
                    embed.add_field(name="Match", value=data["ofac_match"], inline=False)
            elif on_scam_list:
                embed = discord.Embed(
                    title="⚠️ Known Scam Address",
                    description=f"`{address}` is on known scam lists.",
                    color=0xF59E0B,
                )
            else:
                embed = discord.Embed(
                    title="✅ Not Sanctioned",
                    description=f"`{address}` is not on any sanctions or scam lists.",
                    color=0x22C55E,
                )

            embed.set_footer(text="Powered by Kryptos AI")
            await interaction.followup.send(embed=embed)

        except Exception as e:
            await interaction.followup.send(f"❌ Error: `{e}`")

    @client.tree.command(name="batch", description="Quick scan multiple addresses (comma-separated)")
    @app_commands.describe(addresses="Comma-separated list of addresses")
    async def batch_command(interaction: discord.Interaction, addresses: str):
        await interaction.response.defer(thinking=True)

        addr_list = [a.strip() for a in addresses.split(",") if a.strip()]
        if not addr_list:
            await interaction.followup.send("❌ No valid addresses provided.")
            return
        if len(addr_list) > 10:
            await interaction.followup.send("❌ Maximum 10 addresses per batch in Discord.")
            return

        try:
            payload = {"addresses": addr_list, "chain_id": 1, "quick": True}
            async with client.session.post(f"{API_URL}/batch", json=payload) as resp:
                data = await resp.json()

            results = data.get("results", [])
            summary = data.get("summary", {})

            embed = discord.Embed(
                title=f"📦 Batch Scan: {len(results)} addresses",
                description=f"Avg Score: **{summary.get('avg_risk_score', 0):.0f}** | "
                          f"High Risk: {summary.get('high_risk_count', 0)} | "
                          f"Medium: {summary.get('medium_risk_count', 0)} | "
                          f"Low: {summary.get('low_risk_count', 0)}",
                color=0x3B82F6,
            )

            for r in results[:10]:
                addr = r.get("address", "?")
                score = r.get("risk_score")
                if score is not None:
                    emoji = risk_emoji(score)
                    label = r.get("risk_label", "")
                    embed.add_field(
                        name=f"{emoji} {addr[:8]}...{addr[-4:]}",
                        value=f"Score: **{score}** ({label})",
                        inline=True,
                    )
                else:
                    embed.add_field(
                        name=f"❓ {addr[:8]}...{addr[-4:]}",
                        value=r.get("error", "Failed"),
                        inline=True,
                    )

            embed.set_footer(text="Powered by Kryptos AI")
            await interaction.followup.send(embed=embed)

        except Exception as e:
            await interaction.followup.send(f"❌ Error: `{e}`")

    @client.tree.command(name="help", description="Show Kryptos bot help")
    async def help_command(interaction: discord.Interaction):
        embed = discord.Embed(
            title="🔍 Kryptos Bot — Commands",
            description="AI-powered multi-chain blockchain scam detection.",
            color=0x3B82F6,
        )
        embed.add_field(name="/scan <address>", value="Scan a wallet for scam risk", inline=False)
        embed.add_field(name="/sanctions <address>", value="Check OFAC sanctions status", inline=False)
        embed.add_field(name="/batch <addr1,addr2,...>", value="Quick scan up to 10 addresses", inline=False)
        embed.add_field(name="/help", value="Show this help message", inline=False)
        embed.set_footer(text="github.com/ashishranjandas/kryptos")
        await interaction.followup.send(embed=embed)


# ── Telegram Bot (alternative) ──────────────────────────────────────────────
# Uses python-telegram-bot library

TELEGRAM_TOKEN = os.getenv("KRYPTOS_TELEGRAM_TOKEN", "")


async def run_telegram_bot():
    """
    Run the Telegram bot.
    Requires: pip install python-telegram-bot aiohttp
    """
    try:
        from telegram import Update
        from telegram.ext import Application, CommandHandler, ContextTypes
    except ImportError:
        print("python-telegram-bot not installed. Run: pip install python-telegram-bot")
        return

    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            "🔍 *Kryptos Scam Detector*\n\n"
            "Send /scan <address> to analyze a wallet.\n"
            "Send /sanctions <address> to check sanctions.\n\n"
            "Powered by AI • Multi-chain support",
            parse_mode="Markdown",
        )

    async def scan(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not context.args:
            await update.message.reply_text("Usage: /scan <address or ENS name>")
            return

        address = context.args[0]
        msg = await update.message.reply_text(f"⏳ Scanning `{address[:12]}...`", parse_mode="Markdown")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{API_URL}/analyze/{address}") as resp:
                    data = await resp.json()

            score = data.get("risk_score", 0)
            label = data.get("risk_label", "Unknown")
            flags = data.get("flags", [])
            emoji = risk_emoji(score)
            fs = data.get("feature_summary", {})

            text = f"{emoji} *Risk Score: {score}/100*\n"
            text += f"Label: *{label}*\n"
            text += f"Address: `{data.get('address', address)}`\n\n"
            text += f"ML Score: {data.get('ml_raw_score', '—')} | Heuristic: {data.get('heuristic_score', '—')}\n"

            if fs:
                text += f"Txns: {fs.get('tx_count', '—')} | Counterparties: {fs.get('unique_counterparties', '—')}\n"

            if flags:
                text += "\n⚠️ *Flags:*\n"
                for f in flags[:6]:
                    text += f"• {f}\n"

            if data.get("is_sanctioned"):
                text += "\n🚫 *SANCTIONED — OFAC SDN LIST*\n"

            await msg.edit_text(text, parse_mode="Markdown")

        except Exception as e:
            await msg.edit_text(f"❌ Error: {e}")

    async def sanctions_check(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not context.args:
            await update.message.reply_text("Usage: /sanctions <address>")
            return

        address = context.args[0]
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{API_URL}/sanctions/{address}") as resp:
                    data = await resp.json()

            if data.get("is_sanctioned"):
                await update.message.reply_text(f"🚫 `{address}` is *SANCTIONED* (OFAC SDN)", parse_mode="Markdown")
            elif data.get("is_known_scam"):
                await update.message.reply_text(f"⚠️ `{address}` is on known *scam lists*", parse_mode="Markdown")
            else:
                await update.message.reply_text(f"✅ `{address}` is *not sanctioned*", parse_mode="Markdown")

        except Exception as e:
            await update.message.reply_text(f"❌ Error: {e}")

    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("scan", scan))
    app.add_handler(CommandHandler("sanctions", sanctions_check))

    print("Kryptos Telegram bot starting...")
    await app.run_polling()


# ── Main entry point ────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "telegram":
        if not TELEGRAM_TOKEN:
            print("Set KRYPTOS_TELEGRAM_TOKEN environment variable")
            sys.exit(1)
        asyncio.run(run_telegram_bot())
    else:
        if not HAS_DISCORD:
            print("discord.py not installed. Run: pip install discord.py aiohttp")
            sys.exit(1)
        if not DISCORD_TOKEN:
            print("Set KRYPTOS_DISCORD_TOKEN environment variable")
            sys.exit(1)
        client.run(DISCORD_TOKEN)

"""
setup_emojis.py — /setupemojis (admin only)

Uploads kryptos_*.png files from bot/assets/emojis/ to the guild as custom
emojis, then calls register_emoji() so every embed builder switches from the
Unicode fallbacks to the real <:kryptos_key:id> strings immediately.

Usage:
  1. Drop 32×32 or 64×64 PNG files into  bot/assets/emojis/
     Name them exactly:  kryptos.png  scan.png  safe.png  ...
  2. Run  /setupemojis  in Discord (needs Manage Emojis permission).
"""
from __future__ import annotations
import os
import discord
from discord import app_commands
from discord.ext import commands

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from utils.embeds import register_emoji, E, C, FOOTER, _ts

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "emojis")

# All keys the setup command will try to upload
EMOJI_KEYS = [
    "kryptos", "scan", "safe", "warn", "highrisk", "critical",
    "pending", "error", "check", "chain", "tx", "wallet", "time",
    "flag", "mev", "bridge", "model", "link", "report", "batch",
    "sanction", "alert", "admin", "help", "uptime", "developer",
    "arrow", "server",
]


class SetupEmojis(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(
        name="setupemojis",
        description="[Admin] Upload Kryptos custom emojis to this server from bot/assets/emojis/.",
    )
    @app_commands.checks.has_permissions(administrator=True)
    async def setupemojis(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)

        guild = interaction.guild
        if guild is None:
            await interaction.followup.send("This command must be used inside a server.", ephemeral=True)
            return

        if not os.path.isdir(ASSETS_DIR):
            await interaction.followup.send(
                f"Assets directory not found:\n```\n{ASSETS_DIR}\n```\n"
                "Create it and drop your `kryptos_*.png` files there.",
                ephemeral=True,
            )
            return

        ok:   list[str] = []
        skip: list[str] = []
        fail: list[str] = []

        for key in EMOJI_KEYS:
            png_path = os.path.join(ASSETS_DIR, f"{key}.png")
            if not os.path.isfile(png_path):
                skip.append(key)
                continue
            try:
                with open(png_path, "rb") as f:
                    image_bytes = f.read()
                emoji = await guild.create_custom_emoji(
                    name=f"kryptos_{key}",
                    image=image_bytes,
                    reason="Kryptos /setupemojis",
                )
                register_emoji(key, emoji.id)
                ok.append(f"  {E(key)}  kryptos_{key}")
            except discord.HTTPException as exc:
                fail.append(f"  ✕  kryptos_{key}  ({exc.status}: {exc.text})")

        lines = []
        if ok:
            lines.append(f"**Uploaded ({len(ok)})**\n" + "\n".join(ok))
        if skip:
            lines.append(f"**Skipped — no PNG ({len(skip)})**\n" + "  ".join(skip))
        if fail:
            lines.append(f"**Failed ({len(fail)})**\n" + "\n".join(fail))

        embed = discord.Embed(
            title=f"{E('admin')}  Emoji Setup Results",
            description="\n\n".join(lines) or "Nothing to do.",
            color=C.BRAND,
        )
        embed.set_footer(text=f"{FOOTER}   ·   {_ts()}")
        await interaction.followup.send(embed=embed, ephemeral=True)

    @setupemojis.error
    async def _err(self, interaction: discord.Interaction, error: app_commands.AppCommandError) -> None:
        if isinstance(error, app_commands.MissingPermissions):
            await interaction.response.send_message(
                f"{E('error')}  Administrator permission required.", ephemeral=True
            )
        else:
            await interaction.response.send_message(f"{E('error')}  {error}", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(SetupEmojis(bot))

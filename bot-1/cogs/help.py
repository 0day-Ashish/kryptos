"""
help.py — /help command
"""
from __future__ import annotations
import datetime
import discord
from discord import app_commands
from discord.ext import commands

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from utils.embeds import build_help_embed


def _fmt_uptime(start: datetime.datetime) -> str:
    delta = datetime.datetime.utcnow() - start
    d = delta.days
    h, rem = divmod(delta.seconds, 3600)
    m, _   = divmod(rem, 60)
    parts  = []
    if d: parts.append(f"{d}d")
    if h: parts.append(f"{h}h")
    parts.append(f"{m}m")
    return "  ".join(parts)


class Help(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="help", description="Show all Kryptos commands, uptime, and bot info.")
    async def help(self, interaction: discord.Interaction) -> None:
        start = getattr(self.bot, "start_time", datetime.datetime.utcnow())
        uptime_str  = _fmt_uptime(start)
        guild_count = len(self.bot.guilds)
        embed = build_help_embed(self.bot.user, uptime_str, guild_count)
        await interaction.response.send_message(embed=embed)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Help(bot))

import datetime
import logging

import discord
from discord.ext import commands

log = logging.getLogger("kryptos.events")

_FOOTER = "Kryptos  •  AI-Powered Multi-Chain Blockchain Intelligence"
_NEUTRAL = discord.Color(0x5865F2)
_YELLOW = discord.Color(0xF5A623)
_RED = discord.Color(0xFF2D55)


def _ts() -> str:
    return datetime.datetime.utcnow().strftime("%d %b %Y  %H:%M UTC")


class Events(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild):
        log.info(f"Joined guild: {guild.name} (ID: {guild.id})")

        target = guild.system_channel
        if target is None:
            me = guild.me
            for ch in guild.text_channels:
                if me and ch.permissions_for(me).send_messages:
                    target = ch
                    break

        if not target:
            return

        embed = discord.Embed(
            title="Kryptos  •  AI-Powered Blockchain Intelligence",
            description=(
                "A full-stack intelligence platform combining **Machine Learning**, "
                "on-chain data analysis, and community reporting — identifying risky wallets, "
                "scam tokens, and vulnerable smart contracts across **14+ EVM blockchains**.\n"
                "\u200b"
            ),
            color=_NEUTRAL,
        )
        embed.add_field(
            name="Commands",
            value=(
                "`/scan`        •  AI risk assessment\n"
                "`/sanctions`   •  OFAC & sanctions check\n"
                "`/batch`       •  Bulk scan via CSV\n"
                "`/report`      •  Flag a suspicious address"
            ),
            inline=False,
        )
        embed.set_footer(text=f"{_FOOTER}   •   {_ts()}")

        await target.send(embed=embed)

    @commands.Cog.listener()
    async def on_app_command_error(
        self,
        interaction: discord.Interaction,
        error: discord.app_commands.AppCommandError,
    ):
        if isinstance(error, discord.app_commands.CommandOnCooldown):
            embed = discord.Embed(
                title="Rate Limited",
                description=(
                    f"Please wait **{error.retry_after:.1f}s** before using this command again.\n\n"
                    "*Cooldowns protect the backend analysis pipeline from overload.*"
                ),
                color=_YELLOW,
            )
            embed.set_footer(text=f"{_FOOTER}   •   {_ts()}")
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed, ephemeral=True)
            else:
                await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        if isinstance(
            error,
            (
                discord.app_commands.MissingPermissions,
                discord.app_commands.CheckFailure,
            ),
        ):
            embed = discord.Embed(
                title="Access Denied",
                description="You do not have the required permissions to run this command.",
                color=_RED,
            )
            embed.set_footer(text=_FOOTER)
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed, ephemeral=True)
            else:
                await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        log.exception("Unhandled app command error: %s", error)
        embed = discord.Embed(
            title="Unexpected Error",
            description=(
                "An internal error occurred. Please try again in a moment.\n"
                "If this persists, contact a server administrator."
            ),
            color=_RED,
        )
        embed.set_footer(text=_FOOTER)
        if not interaction.response.is_done():
            await interaction.response.send_message(embed=embed, ephemeral=True)
        else:
            await interaction.followup.send(embed=embed, ephemeral=True)

    @commands.Cog.listener()
    async def on_command_error(self, ctx: commands.Context, error: commands.CommandError):
        if isinstance(error, commands.CommandNotFound):
            return
        log.error("Prefix command error: %s", error)


async def setup(bot: commands.Bot):
    await bot.add_cog(Events(bot))
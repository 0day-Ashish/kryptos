import discord
from discord import app_commands
from discord.ext import commands
import logging
import os
import datetime

log = logging.getLogger("kryptos.admin")

_NEUTRAL = discord.Color(0x5865F2)
_GREEN   = discord.Color(0x00D26A)
_YELLOW  = discord.Color(0xF5A623)
_RED     = discord.Color(0xFF2D55)
_GOLD    = discord.Color(0xFFD700)
_FOOTER  = "Kryptos  ·  Admin Panel"

def _ts() -> str:
    return datetime.datetime.utcnow().strftime("%d %b %Y  %H:%M UTC")


def is_admin():
    async def predicate(interaction: discord.Interaction) -> bool:
        return interaction.user.guild_permissions.administrator
    return app_commands.check(predicate)


class Admin(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(
        name="sync",
        description="[Admin] Force-sync slash commands to this guild.",
    )
    @is_admin()
    async def sync_commands(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True, thinking=True)

        try:
            # Sync fresh to this guild only from the localized tree
            self.bot.tree.copy_global_to(guild=interaction.guild)
            synced = await self.bot.tree.sync(guild=interaction.guild)
            
            embed = discord.Embed(
                title="◈  Commands Synced",
                description=f"Successfully synced **{len(synced)}** command(s) to **{interaction.guild.name}**.",
                color=_GREEN,
            )
            embed.set_footer(text=f"{_FOOTER}   ·   {_ts()}")
            await interaction.followup.send(embed=embed, ephemeral=True)
        except Exception as e:
            log.error(f"Sync error: {e}")
            await interaction.followup.send(f"❌ Failed to sync: {str(e)}", ephemeral=True)

    @app_commands.command(
        name="status",
        description="[Admin] Check the Kryptos bot and backend health.",
    )
    @is_admin()
    async def status(self, interaction: discord.Interaction):
        import aiohttp
        import time
        await interaction.response.defer(ephemeral=True, thinking=True)

        api_base = os.getenv("API_BASE_URL", "http://localhost:8000")
        backend_label  = "Offline"
        backend_color  = "✕"
        latency_str    = "—"

        try:
            async with aiohttp.ClientSession() as session:
                t0 = time.monotonic()
                async with session.get(
                    f"{api_base}/health",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    elapsed = (time.monotonic() - t0) * 1000
                    if resp.status == 200:
                        backend_label = "Online"
                        backend_color = "◈"
                        latency_str   = f"{elapsed:.1f} ms"
                    else:
                        backend_label = f"Degraded  ({resp.status})"
                        backend_color = "◆"
                        latency_str   = f"{elapsed:.1f} ms"
        except Exception:
            backend_label = "Offline"
            backend_color = "✕"

        embed = discord.Embed(
            title="◆  System Status",
            description=(
                f"```\n"
                f"  Bot Gateway     {self.bot.latency * 1000:.1f} ms\n"
                f"  Backend API     {latency_str}\n"
                f"  Backend State   {backend_color}  {backend_label}\n"
                f"  Backend URL     {api_base}\n"
                f"```"
            ),
            color=_GREEN if backend_label == "Online" else _RED,
        )
        embed.set_footer(text=f"{_FOOTER}   ·   {_ts()}")
        await interaction.followup.send(embed=embed, ephemeral=True)

    @app_commands.command(
        name="alert",
        description="[Admin] Broadcast a custom alert to the #alpha-alerts channel.",
    )
    @app_commands.describe(message="The alert message to broadcast.")
    @is_admin()
    async def alert(self, interaction: discord.Interaction, message: str):
        channel_id = os.getenv("ALPHA_ALERTS_CHANNEL_ID")
        if not channel_id or not channel_id.isdigit():
            await interaction.response.send_message(
                "Configuration error: `ALPHA_ALERTS_CHANNEL_ID` is not set in `.env`.",
                ephemeral=True,
            )
            return

        channel = interaction.guild.get_channel(int(channel_id))
        if not channel:
            await interaction.response.send_message(
                "Could not locate the alpha-alerts channel. Verify the channel ID.",
                ephemeral=True,
            )
            return

        embed = discord.Embed(
            title="◈  Alpha Alert",
            description=message,
            color=_GOLD,
        )
        embed.add_field(
            name="› Issued By",
            value=f"{interaction.user.mention}  ·  `{interaction.user}`",
            inline=False,
        )
        embed.set_footer(text=f"Kryptos  ·  Intelligence Broadcast   ·   {_ts()}")
        await channel.send(embed=embed)
        await interaction.response.send_message(
            f"Alert dispatched to {channel.mention}.", ephemeral=True
        )

    @sync_commands.error
    @status.error
    @alert.error
    async def admin_error(self, interaction: discord.Interaction, error: app_commands.AppCommandError):
        if isinstance(error, app_commands.CheckFailure):
            embed = discord.Embed(
                title="✕  Access Denied",
                description="Server **Administrator** permission is required for this command.",
                color=_RED,
            )
            embed.set_footer(text=_FOOTER)
            await interaction.response.send_message(embed=embed, ephemeral=True)
        else:
            log.exception(f"Admin command error: {error}")
            await interaction.response.send_message(
                "An unexpected error occurred.", ephemeral=True
            )




def is_admin():
    async def predicate(interaction: discord.Interaction) -> bool:
        return interaction.user.guild_permissions.administrator
    return app_commands.check(predicate)


class Admin(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(
        name="sync",
        description="[Admin] Force sync slash commands to this guild.",
    )
    @is_admin()
    async def sync_commands(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True, thinking=True)
        synced = await self.bot.tree.sync(guild=interaction.guild)
        await interaction.followup.send(
            f"✅ Synced **{len(synced)}** command(s) to **{interaction.guild.name}**.",
            ephemeral=True,
        )

    @app_commands.command(
        name="status",
        description="[Admin] Check the Kryptos bot and backend status.",
    )
    @is_admin()
    async def status(self, interaction: discord.Interaction):
        import aiohttp
        await interaction.response.defer(ephemeral=True, thinking=True)

        api_base = os.getenv("API_BASE_URL", "http://localhost:8000")
        backend_status = "🔴 Offline"
        latency_str = "N/A"

        try:
            import time
            async with aiohttp.ClientSession() as session:
                start = time.monotonic()
                async with session.get(
                    f"{api_base}/health",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    elapsed = (time.monotonic() - start) * 1000
                    if resp.status == 200:
                        backend_status = "🟢 Online"
                        latency_str = f"{elapsed:.1f}ms"
                    else:
                        backend_status = f"🟡 Degraded ({resp.status})"
        except Exception:
            backend_status = "🔴 Offline"

        embed = discord.Embed(title="🤖 Kryptos Bot Status", color=discord.Color.blurple())
        embed.add_field(name="Bot Latency", value=f"{self.bot.latency * 1000:.1f}ms", inline=True)
        embed.add_field(name="Backend Status", value=backend_status, inline=True)
        embed.add_field(name="Backend Latency", value=latency_str, inline=True)
        embed.add_field(name="Backend URL", value=f"`{api_base}`", inline=False)
        embed.set_footer(text="Kryptos · Admin Panel")
        await interaction.followup.send(embed=embed, ephemeral=True)

    @app_commands.command(
        name="alert",
        description="[Admin] Broadcast a custom alert to the #alpha-alerts channel.",
    )
    @app_commands.describe(message="The alert message to broadcast.")
    @is_admin()
    async def alert(self, interaction: discord.Interaction, message: str):
        channel_id = os.getenv("ALPHA_ALERTS_CHANNEL_ID")
        if not channel_id or not channel_id.isdigit():
            await interaction.response.send_message(
                "⚠️ `ALPHA_ALERTS_CHANNEL_ID` is not configured in `.env`.",
                ephemeral=True,
            )
            return

        channel = interaction.guild.get_channel(int(channel_id))
        if not channel:
            await interaction.response.send_message(
                "⚠️ Could not find the alpha-alerts channel. Check the channel ID.",
                ephemeral=True,
            )
            return

        embed = discord.Embed(
            title="🚨 Kryptos Alpha Alert",
            description=message,
            color=discord.Color.red(),
        )
        embed.set_footer(text=f"Issued by {interaction.user} · Kryptos Intelligence")
        await channel.send(embed=embed)
        await interaction.response.send_message(
            f"✅ Alert sent to {channel.mention}.", ephemeral=True
        )

    @sync_commands.error
    @status.error
    @alert.error
    async def admin_error(self, interaction: discord.Interaction, error: app_commands.AppCommandError):
        if isinstance(error, app_commands.CheckFailure):
            await interaction.response.send_message(
                "🚫 You must be a server **Administrator** to use this command.",
                ephemeral=True,
            )
        else:
            log.exception(f"Admin command error: {error}")
            await interaction.response.send_message(
                "An unexpected error occurred.", ephemeral=True
            )


async def setup(bot: commands.Bot):
    await bot.add_cog(Admin(bot))

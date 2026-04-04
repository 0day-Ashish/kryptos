import discord
from discord import app_commands
from discord.ext import commands
import aiohttp
import asyncio
import logging
import os
import datetime
from utils.embeds import build_error_embed
from utils.image_gen import generate_report_image, generate_error_image
from utils.validators import is_valid_evm_address
from utils.cooldown import user_cooldown

log = logging.getLogger("kryptos.report")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

_GREEN  = discord.Color(0x00D26A)
_ORANGE = discord.Color(0xFF6B35)
_FOOTER = "Kryptos  ·  Community Intelligence"

def _ts() -> str:
    return datetime.datetime.utcnow().strftime("%d %b %Y  %H:%M UTC")

REASON_CHOICES = [
    app_commands.Choice(name="Scam / Phishing", value="scam_phishing"),
    app_commands.Choice(name="Rug Pull", value="rug_pull"),
    app_commands.Choice(name="MEV / Front-Running", value="mev_frontrunning"),
    app_commands.Choice(name="Mixer / Tornado Cash Usage", value="mixer_usage"),
    app_commands.Choice(name="Wash Trading", value="wash_trading"),
    app_commands.Choice(name="Suspicious Drainer", value="drainer"),
    app_commands.Choice(name="Other", value="other"),
]


class Report(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(
        name="report",
        description="Flag a suspicious address to contribute to the Kryptos community intelligence.",
    )
    @app_commands.describe(
        address="The EVM address you want to report (0x...)",
        reason="The reason for flagging this address.",
        details="Optional: Any additional details or transaction hashes.",
    )
    @app_commands.choices(reason=REASON_CHOICES)
    @user_cooldown(seconds=30)
    async def report(
        self,
        interaction: discord.Interaction,
        address: str,
        reason: app_commands.Choice[str],
        details: str = "",
    ):
        address = address.strip()

        if not is_valid_evm_address(address):
            buf = generate_error_image(
                "Invalid Address",
                f"`{address}` is not a valid EVM address.",
            )
            file = discord.File(fp=buf, filename="error.png")
            await interaction.response.send_message(
                file=file,
                ephemeral=True,
            )
            return

        await interaction.response.defer(thinking=True, ephemeral=False)

        payload = {
            "address": address,
            "category": reason.value,
            "description": details,
            "reporter_id": str(interaction.user.id),
            "evidence_urls": [],
            "chain_id": 1,
        }

        try:
            async with aiohttp.ClientSession() as session:
                headers = {"Content-Type": "application/json"}
                api_key = os.getenv("API_KEY")
                if api_key:
                    headers["X-API-Key"] = api_key

                async with session.post(
                    f"{API_BASE_URL}/community/report",
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status in (200, 201):
                        buf = generate_report_image(address, reason.name, details, str(interaction.user))
                        file = discord.File(fp=buf, filename="kryptos_report.png")
                        await interaction.followup.send(content=f"{interaction.user.mention}, your intelligence report has been received.", file=file)

                        # Echo to community-reporting channel if configured
                        report_channel_id = os.getenv("COMMUNITY_REPORTING_CHANNEL_ID")
                        if report_channel_id and report_channel_id.isdigit():
                            channel = interaction.guild.get_channel(int(report_channel_id))
                            if channel:
                                buf2 = generate_report_image(address, reason.name, details, str(interaction.user))
                                file2 = discord.File(fp=buf2, filename="kryptos_community_report.png")
                                await channel.send(content="**New Community Report**", file=file2)
                    else:
                        text = await resp.text()
                        log.error(f"Report backend error {resp.status}: {text}")
                        buf = generate_error_image(
                            "Submission Failed",
                            f"Backend returned status `{resp.status}`. Please try again."
                        )
                        file = discord.File(fp=buf, filename="error.png")
                        await interaction.followup.send(file=file)

        except asyncio.TimeoutError:
            buf = generate_error_image("Timeout", "Report submission timed out. Please try again.")
            file = discord.File(fp=buf, filename="error.png")
            await interaction.followup.send(file=file)
        except aiohttp.ClientConnectorError:
            buf = generate_error_image("Connection Error", "Could not reach the Kryptos backend.")
            file = discord.File(fp=buf, filename="error.png")
            await interaction.followup.send(file=file)
        except Exception as e:
            log.exception(f"Unexpected error in /report: {e}")
            buf = generate_error_image("Unexpected Error", "An unexpected error occurred.")
            file = discord.File(fp=buf, filename="error.png")
            await interaction.followup.send(file=file)


async def setup(bot: commands.Bot):
    await bot.add_cog(Report(bot))

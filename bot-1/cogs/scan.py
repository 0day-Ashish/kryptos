import discord
from discord import app_commands
from discord.ext import commands
import aiohttp
import asyncio
import logging
import os
from utils.embeds import (
    build_scan_embed,
    build_error_embed,
    build_pending_embed,
)
from utils.image_gen import generate_scan_image, generate_error_image, generate_error_image
from utils.validators import is_valid_evm_address
from utils.cooldown import user_cooldown

log = logging.getLogger("kryptos.scan")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


class Scan(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(
        name="scan",
        description="AI risk assessment on an EVM wallet, token, or contract. Scores 0–100 across 14+ chains.",
    )
    @app_commands.describe(address="The EVM address to scan (0x...)")
    @user_cooldown(seconds=10)
    async def scan(self, interaction: discord.Interaction, address: str):
        address = address.strip()

        if not is_valid_evm_address(address):
            await interaction.response.send_message(
                embed=build_error_embed(
                    "Invalid Address",
                    f"`{address}` is not a valid EVM address. Make sure it starts with `0x` and is 42 characters long.",
                ),
                ephemeral=True,
            )
            return

        # Send a pending embed immediately
        await interaction.response.send_message(embed=build_pending_embed(address))
        pending_msg = await interaction.original_response()

        try:
            async with aiohttp.ClientSession() as session:
                headers = {}
                api_key = os.getenv("API_KEY")
                if api_key:
                    headers["X-API-Key"] = api_key

                async with session.get(
                    f"{API_BASE_URL}/analyze/{address}",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        image_buf = generate_scan_image(address, data)
                        file = discord.File(fp=image_buf, filename="kryptos_scan.png")
                        
                        # Remove the pending embed and attach the image instead
                        await pending_msg.edit(embed=None, attachments=[file])
                    elif resp.status == 429:
                        buf = generate_error_image(
                            "Rate Limited",
                            "The Kryptos backend is currently rate-limited. Please try again shortly."
                        )
                        file = discord.File(fp=buf, filename="error.png")
                        await pending_msg.edit(embed=None, attachments=[file])
                    elif resp.status == 404:
                        buf = generate_error_image(
                            "Not Found",
                            f"No data found for address `{address}`. It may be a new or inactive address."
                        )
                        file = discord.File(fp=buf, filename="error.png")
                        await pending_msg.edit(embed=None, attachments=[file])
                    else:
                        text = await resp.text()
                        log.error(f"Backend error {resp.status}: {text}")
                        buf = generate_error_image(
                            "Backend Error",
                            f"Received status `{resp.status}` from the Kryptos backend. Please try again later."
                        )
                        file = discord.File(fp=buf, filename="error.png")
                        await pending_msg.edit(embed=None, attachments=[file])
        except asyncio.TimeoutError:
            buf = generate_error_image(
                "Timeout",
                "The analysis is taking longer than expected. The backend may be under load. Please try again in a moment."
            )
            file = discord.File(fp=buf, filename="error.png")
            await pending_msg.edit(embed=None, attachments=[file])
        except aiohttp.ClientConnectorError:
            buf = generate_error_image(
                "Connection Error",
                "Could not reach the Kryptos backend. Please contact an administrator."
            )
            file = discord.File(fp=buf, filename="error.png")
            await pending_msg.edit(embed=None, attachments=[file])
        except Exception as e:
            log.exception(f"Unexpected error in /scan: {e}")
            buf = generate_error_image(
                "Unexpected Error",
                "An unexpected error occurred. Our team has been notified."
            )
            file = discord.File(fp=buf, filename="error.png")
            await pending_msg.edit(embed=None, attachments=[file])


async def setup(bot: commands.Bot):
    await bot.add_cog(Scan(bot))

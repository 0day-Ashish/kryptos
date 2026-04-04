import discord
from discord import app_commands
from discord.ext import commands
import aiohttp
import asyncio
import logging
import os
from utils.embeds import build_error_embed, build_pending_embed
from utils.image_gen import generate_sanctions_image, generate_error_image
from utils.validators import is_valid_evm_address
from utils.cooldown import user_cooldown

log = logging.getLogger("kryptos.sanctions")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


class Sanctions(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(
        name="sanctions",
        description="Cross-reference an address against OFAC and other sanctions lists.",
    )
    @app_commands.describe(address="The EVM address to check (0x...)")
    @user_cooldown(seconds=10)
    async def sanctions(self, interaction: discord.Interaction, address: str):
        address = address.strip()

        if not is_valid_evm_address(address):
            await interaction.response.send_message(
                embed=build_error_embed(
                    "Invalid Address",
                    f"`{address}` is not a valid EVM address.",
                ),
                ephemeral=True,
            )
            return

        await interaction.response.send_message(
            embed=build_pending_embed(address, title="Checking Sanctions Lists...")
        )
        pending_msg = await interaction.original_response()

        try:
            async with aiohttp.ClientSession() as session:
                headers = {}
                api_key = os.getenv("API_KEY")
                if api_key:
                    headers["X-API-Key"] = api_key

                async with session.get(
                    f"{API_BASE_URL}/sanctions/{address}",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        buf = generate_sanctions_image(address, data)
                        file = discord.File(fp=buf, filename="kryptos_sanctions.png")
                        await pending_msg.edit(embed=None, attachments=[file])
                    else:
                        text = await resp.text()
                        log.error(f"Backend error {resp.status}: {text}")
                        buf = generate_error_image(
                            "Backend Error",
                            f"Received status `{resp.status}`. Please try again later."
                        )
                        file = discord.File(fp=buf, filename="error.png")
                        await pending_msg.edit(embed=None, attachments=[file])
        except asyncio.TimeoutError:
            buf = generate_error_image("Timeout", "Sanctions check timed out. Please try again.")
            file = discord.File(fp=buf, filename="error.png")
            await pending_msg.edit(embed=None, attachments=[file])
        except aiohttp.ClientConnectorError:
            buf = generate_error_image("Connection Error", "Could not reach the Kryptos backend.")
            file = discord.File(fp=buf, filename="error.png")
            await pending_msg.edit(embed=None, attachments=[file])
        except Exception as e:
            log.exception(f"Unexpected error in /sanctions: {e}")
            buf = generate_error_image("Unexpected Error", "An unexpected error occurred.")
            file = discord.File(fp=buf, filename="error.png")
            await pending_msg.edit(embed=None, attachments=[file])


async def setup(bot: commands.Bot):
    await bot.add_cog(Sanctions(bot))

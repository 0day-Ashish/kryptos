"""
verify.py — /verify command for Discord + MetaMask wallet linking

Users click /verify → get a unique link → sign with MetaMask → wallet linked to Discord account
"""
import discord
from discord import app_commands
from discord.ext import commands
import aiohttp
import os
import logging

log = logging.getLogger("kryptos.verify")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class Verify(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(
        name="verify",
        description="Link your MetaMask wallet to your Discord account for premium features.",
    )
    async def verify(self, interaction: discord.Interaction) -> None:
        """Generate a one-time verification link for wallet linking."""
        await interaction.response.defer(ephemeral=True, thinking=True)

        try:
            async with aiohttp.ClientSession() as session:
                # Request a one-time token from backend
                async with session.post(
                    f"{API_BASE_URL}/auth/discord-link-request",
                    json={"discord_id": str(interaction.user.id)},
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status != 200:
                        text = await resp.text()
                        log.error(f"Backend error {resp.status}: {text}")
                        await interaction.followup.send(
                            "❌ Backend unavailable. Please try again later.",
                            ephemeral=True,
                        )
                        return

                    data = await resp.json()
                    token = data.get("token")

                    if not token:
                        await interaction.followup.send(
                            "❌ Failed to generate verification link.",
                            ephemeral=True,
                        )
                        return

            # Build the verification URL
            verify_url = f"{FRONTEND_URL}/discord-verify?token={token}&discord_id={interaction.user.id}"

            # Create embed
            embed = discord.Embed(
                title="🔐  Link Your Wallet",
                description=(
                    "Connect your **MetaMask** wallet to unlock:\n"
                    "  ◈  Persistent watchlist\n"
                    "  ◈  Wallet history & favorites\n"
                    "  ◈  Community reputation\n\n"
                    "Click the button below to verify ownership."
                ),
                color=discord.Color(0x7C3AED),
            )
            embed.add_field(
                name="⏱️  Expires in",
                value="**10 minutes**",
                inline=True,
            )
            embed.add_field(
                name="🔒  Security",
                value="**Your wallet is never shared.** Only you can sign.",
                inline=True,
            )
            embed.set_footer(
                text="Kryptos  ·  Sign with MetaMask to verify wallet ownership"
            )

            # Create button view
            view = discord.ui.View()
            view.add_item(
                discord.ui.Button(
                    label="Connect with MetaMask",
                    url=verify_url,
                    style=discord.ButtonStyle.link,
                    emoji="🦊",
                )
            )

            await interaction.followup.send(embed=embed, view=view, ephemeral=True)

        except aiohttp.ClientConnectorError:
            await interaction.followup.send(
                "❌ Could not reach backend. Please try again.",
                ephemeral=True,
            )
        except Exception as e:
            log.exception(f"Unexpected error in /verify: {e}")
            await interaction.followup.send(
                "❌ An unexpected error occurred.",
                ephemeral=True,
            )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(Verify(bot))

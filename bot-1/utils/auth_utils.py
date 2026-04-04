"""
auth_utils.py — Verification and premium tier checking for gated commands

Provides decorators to enforce:
1. User must have verified wallet (linked via /verify)
2. User must have active premium subscription (for premium features)
"""
import discord
from discord import app_commands
from discord.ext import commands
import aiohttp
import os
import logging
from functools import wraps
from typing import Callable, Any

log = logging.getLogger("kryptos.auth_utils")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


async def get_linked_wallet(discord_id: str) -> str | None:
    """
    Fetch the Ethereum wallet linked to a Discord account.
    Returns wallet address if linked, None otherwise.
    """
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{API_BASE_URL}/auth/discord-user/{discord_id}",
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("address")
    except Exception as e:
        log.error(f"Error fetching linked wallet for {discord_id}: {e}")
    return None


async def check_premium_status(discord_id: str) -> bool:
    """
    Check if a Discord user has an active premium subscription.
    Queries the backend for premium tier status.
    """
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{API_BASE_URL}/users/{discord_id}/premium",
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("is_premium", False)
    except Exception as e:
        log.error(f"Error checking premium status for {discord_id}: {e}")
    return False


def require_verification(func: Callable) -> Callable:
    """
    Decorator: Command requires verified wallet.
    Usage:
        @require_verification
        async def my_command(interaction: discord.Interaction):
            ...
    """
    @wraps(func)
    async def wrapper(self, interaction: discord.Interaction, *args, **kwargs):
        wallet = await get_linked_wallet(str(interaction.user.id))
        if not wallet:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="🔐  Verification Required",
                    description=(
                        "This command requires wallet verification.\n\n"
                        "Run `/verify` to link your MetaMask wallet to your Discord account."
                    ),
                    color=discord.Color(0xFF6B35),
                ),
                ephemeral=True,
            )
            return
        return await func(self, interaction, *args, **kwargs)
    return wrapper


def require_premium(func: Callable) -> Callable:
    """
    Decorator: Command requires active premium subscription.
    Usage:
        @require_premium
        async def my_premium_command(interaction: discord.Interaction):
            ...
    """
    @wraps(func)
    async def wrapper(self, interaction: discord.Interaction, *args, **kwargs):
        discord_id = str(interaction.user.id)
        
        # First check: must be verified
        wallet = await get_linked_wallet(discord_id)
        if not wallet:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="🔐  Verification Required",
                    description="Run `/verify` first to link your wallet.",
                    color=discord.Color(0xFF6B35),
                ),
                ephemeral=True,
            )
            return
        
        # Second check: must have premium
        is_premium = await check_premium_status(discord_id)
        if not is_premium:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="⭐  Premium Required",
                    description=(
                        "This feature is only available to premium members.\n\n"
                        "📌  [Upgrade to Premium](https://kryptos.com/premium)"
                    ),
                    color=discord.Color(0xFFD700),
                ),
                ephemeral=True,
            )
            return
        
        return await func(self, interaction, *args, **kwargs)
    return wrapper


def requires_verification(func: Callable) -> Callable:
    """
    Slash command check for verification requirement.
    Usage in slash commands:
        @app_commands.command(...)
        @requires_verification
        async def my_command(interaction: discord.Interaction):
            ...
    """
    async def check_verified(interaction: discord.Interaction) -> bool:
        wallet = await get_linked_wallet(str(interaction.user.id))
        if not wallet:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="🔐  Verification Required",
                    description="Run `/verify` to link your MetaMask wallet.",
                    color=discord.Color(0xFF6B35),
                ),
                ephemeral=True,
            )
            return False
        return True
    
    app_commands.check(check_verified)(func)
    return func


def requires_premium(func: Callable) -> Callable:
    """
    Slash command check for premium requirement.
    Usage in slash commands:
        @app_commands.command(...)
        @requires_premium
        async def my_premium_command(interaction: discord.Interaction):
            ...
    """
    async def check_premium(interaction: discord.Interaction) -> bool:
        discord_id = str(interaction.user.id)
        
        wallet = await get_linked_wallet(discord_id)
        if not wallet:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="🔐  Verification Required",
                    description="Run `/verify` first.",
                    color=discord.Color(0xFF6B35),
                ),
                ephemeral=True,
            )
            return False
        
        is_premium = await check_premium_status(discord_id)
        if not is_premium:
            await interaction.response.send_message(
                embed=discord.Embed(
                    title="⭐  Premium Required",
                    description="[Upgrade to Premium](https://kryptos.com/premium)",
                    color=discord.Color(0xFFD700),
                ),
                ephemeral=True,
            )
            return False
        
        return True
    
    app_commands.check(check_premium)(func)
    return func

"""
Per-user slash command cooldown decorator using discord.py's app_commands.checks.cooldown.
"""
import discord
from discord import app_commands
from functools import wraps


def user_cooldown(seconds: float, key_func=None):
    """
    Apply a per-user cooldown to an app_commands slash command.

    Usage:
        @user_cooldown(seconds=10)
        async def my_command(self, interaction: discord.Interaction, ...):
            ...
    """
    def cooldown_key(interaction: discord.Interaction):
        if key_func:
            return key_func(interaction)
        return interaction.user.id

    return app_commands.checks.cooldown(1, seconds, key=lambda i: cooldown_key(i))

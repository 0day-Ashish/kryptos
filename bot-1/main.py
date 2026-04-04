import discord
from discord.ext import commands
import os
import asyncio
import datetime
from dotenv import load_dotenv
import logging

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("kryptos.log"),
    ],
)
log = logging.getLogger("kryptos")

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)
bot.start_time = datetime.datetime.utcnow()

COGS = [
    "cogs.scan",
    "cogs.sanctions",
    "cogs.batch",
    "cogs.report",
    "cogs.admin",
    "cogs.events",
    "cogs.help",
    "cogs.setup_emojis",
]

# Cycling presence messages — no default emoji blocks
PRESENCES = [
    discord.Activity(type=discord.ActivityType.watching, name="14+ EVM chains"),
    discord.Activity(type=discord.ActivityType.watching, name="wallets   ·   /scan"),
    discord.Activity(
        type=discord.ActivityType.listening, name="/scan  /sanctions  /batch"
    ),
    discord.Activity(
        type=discord.ActivityType.watching, name="the blockchain for threats"
    ),
    discord.Activity(type=discord.ActivityType.watching, name="for scams  ·   /scan"),
]

_presence_index = 0


async def _cycle_presence():
    global _presence_index
    await bot.wait_until_ready()
    while not bot.is_closed():
        await bot.change_presence(
            status=discord.Status.online,
            activity=PRESENCES[_presence_index % len(PRESENCES)],
        )
        _presence_index += 1
        await asyncio.sleep(60)  # rotate every 60 seconds


@bot.event
async def on_ready():
    log.info(f"Kryptos bot online as {bot.user} (ID: {bot.user.id})")

    guild_id = os.getenv("KRYPTOS_GUILD_ID")
    try:
        if guild_id and guild_id.isdigit():
            guild_obj = discord.Object(id=int(guild_id))
            # Copy the globally-registered commands into the guild tree, then
            # sync ONLY to the guild.  No global sync = no duplicates.
            bot.tree.copy_global_to(guild=guild_obj)
            # Clear any previously-pushed global commands from Discord's side
            bot.tree.clear_commands(guild=None)
            await bot.tree.sync(guild=None)  # pushes empty list → removes globals
            guild_synced = await bot.tree.sync(guild=guild_obj)
            log.info(
                f"Synced {len(guild_synced)} guild slash command(s) to guild {guild_id}."
            )
        else:
            global_synced = await bot.tree.sync()
            log.info(f"Synced {len(global_synced)} global slash command(s).")
    except Exception as e:
        log.error(f"Failed to sync commands: {e}")


async def load_cogs():
    for cog in COGS:
        try:
            await bot.load_extension(cog)
            log.info(f"Loaded cog: {cog}")
        except Exception as e:
            log.error(f"Failed to load cog {cog}: {e}")


async def main():
    async with bot:
        await load_cogs()
        token = os.getenv("DISCORD_BOT_TOKEN")
        if not token:
            raise ValueError("DISCORD_BOT_TOKEN not set in environment.")
        bot.loop.create_task(_cycle_presence())
        await bot.start(token)


if __name__ == "__main__":
    asyncio.run(main())

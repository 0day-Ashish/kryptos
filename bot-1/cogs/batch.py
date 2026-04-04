import discord
from discord import app_commands
from discord.ext import commands
import aiohttp
import asyncio
import logging
import os
import io
from utils.embeds import build_error_embed
from utils.image_gen import generate_batch_image, generate_error_image
from utils.validators import is_valid_evm_address

log = logging.getLogger("kryptos.batch")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
MAX_ADDRESSES = 50


class Batch(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(
        name="batch",
        description="Upload a .csv or .txt file of up to 50 addresses for bulk risk assessment.",
    )
    @app_commands.describe(file="A .csv or .txt file containing one EVM address per line.")
    async def batch(self, interaction: discord.Interaction, file: discord.Attachment):
        # Validate file type
        if not (file.filename.endswith(".csv") or file.filename.endswith(".txt")):
            buf = generate_error_image(
                "Invalid File Type",
                "Please upload a `.csv` or `.txt` file with one address per line."
            )
            img_file = discord.File(fp=buf, filename="error.png")
            await interaction.response.send_message(
                file=img_file,
                ephemeral=True,
            )
            return

        # Validate file size (max 500KB)
        if file.size > 500_000:
            buf = generate_error_image(
                "File Too Large",
                "File size must be under 500KB."
            )
            img_file = discord.File(fp=buf, filename="error.png")
            await interaction.response.send_message(
                file=img_file,
                ephemeral=True,
            )
            return

        await interaction.response.defer(thinking=True)

        try:
            raw = await file.read()
            content = raw.decode("utf-8", errors="ignore")
            lines = [l.strip() for l in content.splitlines() if l.strip()]

            # Parse addresses — handle CSV with multiple columns
            addresses = []
            for line in lines:
                parts = line.split(",")
                addr = parts[0].strip()
                if is_valid_evm_address(addr):
                    addresses.append(addr)

            if not addresses:
                buf = generate_error_image(
                    "No Valid Addresses",
                    "The file contained no valid EVM addresses."
                )
                img_file = discord.File(fp=buf, filename="error.png")
                await interaction.followup.send(file=img_file)
                return

            if len(addresses) > MAX_ADDRESSES:
                addresses = addresses[:MAX_ADDRESSES]
                truncated = True
            else:
                truncated = False

            # Notify user we're processing
            processing_embed = discord.Embed(
                title="⏳ Batch Analysis In Progress",
                description=(
                    f"Processing **{len(addresses)}** address{'es' if len(addresses) != 1 else ''}...\n"
                    f"{'⚠️ Truncated to first 50 addresses.' if truncated else ''}\n\n"
                    "This may take a moment. Results will appear below."
                ),
                color=discord.Color.blurple(),
            )
            processing_embed.set_footer(text="Kryptos · Decentralized Intelligence Terminal")
            await interaction.followup.send(embed=processing_embed)

            # Call backend
            async with aiohttp.ClientSession() as session:
                headers = {"Content-Type": "application/json"}
                api_key = os.getenv("API_KEY")
                if api_key:
                    headers["X-API-Key"] = api_key

                async with session.post(
                    f"{API_BASE_URL}/batch",
                    json={"addresses": addresses},
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        results = data.get("results", [])

                        # Build CSV report
                        csv_lines = ["address,score,risk_band,flags"]
                        for r in results:
                            flags = "|".join(r.get("flags", []))
                            csv_lines.append(
                                f"{r.get('address','')},{r.get('score','N/A')},{r.get('risk_band','N/A')},{flags}"
                            )
                        csv_content = "\n".join(csv_lines)
                        csv_bytes = csv_content.encode("utf-8")
                        csv_file = discord.File(
                            io.BytesIO(csv_bytes), filename="kryptos_batch_report.csv"
                        )

                        # Build summary image
                        buf = generate_batch_image(results, truncated)
                        img_file = discord.File(fp=buf, filename="kryptos_batch.png")
                        await interaction.followup.send(files=[csv_file, img_file])

                    else:
                        text = await resp.text()
                        log.error(f"Batch backend error {resp.status}: {text}")
                        buf = generate_error_image(
                            "Backend Error",
                            f"Received status `{resp.status}` from the backend."
                        )
                        file = discord.File(fp=buf, filename="error.png")
                        await interaction.followup.send(file=file)

        except asyncio.TimeoutError:
            buf = generate_error_image(
                "Timeout",
                "Batch analysis timed out. Try a smaller file or try again later."
            )
            file = discord.File(fp=buf, filename="error.png")
            await interaction.followup.send(file=file)
        except Exception as e:
            log.exception(f"Unexpected error in /batch: {e}")
            buf = generate_error_image("Unexpected Error", "An unexpected error occurred.")
            file = discord.File(fp=buf, filename="error.png")
            await interaction.followup.send(file=file)


async def setup(bot: commands.Bot):
    await bot.add_cog(Batch(bot))

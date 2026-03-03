import json
import pandas as pd

INPUT_FILE = "blacklist/all.json"
OUTPUT_FILE = "data/scam_wallets.csv"

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

addresses = set()

def extract(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in ("address", "addresses"):
                if isinstance(v, str) and v.startswith("0x"):
                    addresses.add(v.lower())
                elif isinstance(v, list):
                    for addr in v:
                        if isinstance(addr, str) and addr.startswith("0x"):
                            addresses.add(addr.lower())
            extract(v)
    elif isinstance(obj, list):
        for item in obj:
            extract(item)

extract(data)

df = pd.DataFrame({"address": list(addresses)})
df["label"] = 1

df.to_csv(OUTPUT_FILE, index=False)

print("Extracted", len(df), "scam wallets")
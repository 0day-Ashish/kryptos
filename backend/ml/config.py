"""
Kryptos ML configuration — chain and API settings.
"""
import os

# Default chain (Base Sepolia testnet)
CHAIN_ID = int(os.getenv("CHAIN_ID", "84532"))

# Etherscan V2 unified API key (works across all supported chains)
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "86PQ988S2PM22W4RDZM6HRZXQSY7SRSPT1")

# Etherscan V2 API base URL (multi-chain via ?chainid=)
ETHERSCAN_API_URL = "https://api.etherscan.io/v2/api"

# ---------------------------------------------------------------------------
# Supported chains — Etherscan V2 API supports these via the chainid param.
# Each entry: { id, name, short, explorer, native_symbol }
# ---------------------------------------------------------------------------
SUPPORTED_CHAINS = [
    {"id": 1,      "name": "Ethereum Mainnet",       "short": "ETH",      "explorer": "https://etherscan.io",                  "native": "ETH"},
    {"id": 8453,   "name": "Base",                    "short": "BASE",     "explorer": "https://basescan.org",                  "native": "ETH"},
    {"id": 84532,  "name": "Base Sepolia",            "short": "BASE_SEP", "explorer": "https://sepolia.basescan.org",          "native": "ETH"},
    {"id": 137,    "name": "Polygon",                 "short": "MATIC",    "explorer": "https://polygonscan.com",               "native": "MATIC"},
    {"id": 42161,  "name": "Arbitrum One",            "short": "ARB",      "explorer": "https://arbiscan.io",                   "native": "ETH"},
    {"id": 10,     "name": "Optimism",                "short": "OP",       "explorer": "https://optimistic.etherscan.io",       "native": "ETH"},
    {"id": 56,     "name": "BNB Smart Chain",         "short": "BSC",      "explorer": "https://bscscan.com",                   "native": "BNB"},
    {"id": 43114,  "name": "Avalanche C-Chain",       "short": "AVAX",     "explorer": "https://snowtrace.io",                  "native": "AVAX"},
    {"id": 250,    "name": "Fantom",                  "short": "FTM",      "explorer": "https://ftmscan.com",                   "native": "FTM"},
    {"id": 59144,  "name": "Linea",                   "short": "LINEA",    "explorer": "https://lineascan.build",               "native": "ETH"},
    {"id": 324,    "name": "zkSync Era",              "short": "ZKSYNC",   "explorer": "https://explorer.zksync.io",            "native": "ETH"},
    {"id": 5000,   "name": "Mantle",                  "short": "MNT",      "explorer": "https://explorer.mantle.xyz",           "native": "MNT"},
    {"id": 534352, "name": "Scroll",                  "short": "SCROLL",   "explorer": "https://scrollscan.com",                "native": "ETH"},
    {"id": 11155111, "name": "Sepolia (Testnet)",     "short": "SEP",      "explorer": "https://sepolia.etherscan.io",          "native": "ETH"},
]

def get_chain_by_id(chain_id: int) -> dict:
    """Look up a chain config by its chain ID. Returns default if not found."""
    for chain in SUPPORTED_CHAINS:
        if chain["id"] == chain_id:
            return chain
    return {"id": chain_id, "name": f"Chain {chain_id}", "short": "UNKNOWN", "explorer": "", "native": "ETH"}

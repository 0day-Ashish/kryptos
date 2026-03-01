"""
on_chain.py — Write and read risk reports on the RiskRegistry contract (Base).
"""

from web3 import Web3
import os
import time
import json

# ── Config ──────────────────────────────────────────────────────────────────
CONTRACT_ADDRESS = "0xFc3528536bfA705Ae0E40946Fe26A1F86fBAAF74"
RPC_URL = os.getenv("BASE_SEPOLIA_RPC", "https://base-sepolia-rpc.publicnode.com")
PRIVATE_KEY = os.getenv("DEPLOYER_PRIVATE_KEY", "")

# Minimal ABI – only the functions we call
CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "wallet", "type": "bytes32"},
            {"internalType": "uint8", "name": "riskScore", "type": "uint8"},
            {"internalType": "string", "name": "ipfsHash", "type": "string"},
            {"internalType": "uint64", "name": "timestamp", "type": "uint64"},
        ],
        "name": "storeReport",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32[]", "name": "wallets", "type": "bytes32[]"},
            {"internalType": "uint8[]", "name": "riskScores", "type": "uint8[]"},
            {"internalType": "string[]", "name": "ipfsHashes", "type": "string[]"},
            {"internalType": "uint64[]", "name": "timestamps", "type": "uint64[]"},
        ],
        "name": "storeReportsBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "wallet", "type": "bytes32"}],
        "name": "getReport",
        "outputs": [
            {"internalType": "uint8", "name": "riskScore", "type": "uint8"},
            {"internalType": "string", "name": "ipfsHash", "type": "string"},
            {"internalType": "uint64", "name": "timestamp", "type": "uint64"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]

# ── Helpers ─────────────────────────────────────────────────────────────────
w3 = Web3(Web3.HTTPProvider(RPC_URL))
contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)


def _wallet_key(address: str) -> bytes:
    """Convert an 0x address string to a bytes32 keccak256 key."""
    return Web3.solidity_keccak(["address"], [Web3.to_checksum_address(address)])


def store_report_on_chain(
    wallet_address: str,
    risk_score: int,
    ipfs_hash: str = "",
) -> dict:
    """
    Submit a risk report to the RiskRegistry contract on Base.

    Returns a dict with tx_hash and block explorer link.
    """
    if not PRIVATE_KEY:
        return {"error": "DEPLOYER_PRIVATE_KEY not set – skipping on-chain write"}

    account = w3.eth.account.from_key(PRIVATE_KEY)
    wallet_key = _wallet_key(wallet_address)
    timestamp = int(time.time())

    tx = contract.functions.storeReport(
        wallet_key,
        risk_score,
        ipfs_hash,
        timestamp,
    ).build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 200_000,
            "maxFeePerGas": w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": w3.eth.gas_price,
        }
    )

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

    hex_hash = tx_hash.hex()
    print(f"✅ Report stored on-chain! tx: {hex_hash}")

    return {
        "tx_hash": hex_hash,
        "explorer": f"https://sepolia.basescan.org/tx/0x{hex_hash}",
        "block": receipt["blockNumber"],
    }


def get_report_from_chain(wallet_address: str) -> dict:
    """
    Read a risk report from the RiskRegistry contract.
    """
    wallet_key = _wallet_key(wallet_address)
    risk_score, ipfs_hash, timestamp = contract.functions.getReport(wallet_key).call()

    return {
        "risk_score": risk_score,
        "ipfs_hash": ipfs_hash,
        "timestamp": timestamp,
        "on_chain": risk_score > 0,
        "contract": CONTRACT_ADDRESS,
        "explorer": f"https://sepolia.basescan.org/address/{CONTRACT_ADDRESS}",
    }


def store_reports_batch_on_chain(
    wallet_addresses: list[str],
    risk_scores: list[int],
    ipfs_hashes: list[str] | None = None,
) -> dict:
    """
    Batch-store multiple risk reports in a single transaction (V2 feature).
    Saves gas compared to calling storeReport N times.
    """
    if not PRIVATE_KEY:
        return {"error": "DEPLOYER_PRIVATE_KEY not set – skipping on-chain write"}

    n = len(wallet_addresses)
    if ipfs_hashes is None:
        ipfs_hashes = [""] * n

    account = w3.eth.account.from_key(PRIVATE_KEY)
    wallet_keys = [_wallet_key(addr) for addr in wallet_addresses]
    timestamps = [int(time.time())] * n

    tx = contract.functions.storeReportsBatch(
        wallet_keys,
        risk_scores,
        ipfs_hashes,
        timestamps,
    ).build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 150_000 + 80_000 * n,  # scale gas with batch size
            "maxFeePerGas": w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": w3.eth.gas_price,
        }
    )

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    hex_hash = tx_hash.hex()
    print(f"✅ Batch of {n} reports stored on-chain! tx: {hex_hash}")

    return {
        "tx_hash": hex_hash,
        "explorer": f"https://sepolia.basescan.org/tx/0x{hex_hash}",
        "block": receipt["blockNumber"],
        "count": n,
    }

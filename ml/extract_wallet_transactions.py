"""
Wallet Transaction Extractor

Extracts transaction data for wallets in the dataset and saves to JSON
for contract risk computation in the ML pipeline.

Usage:
    python extract_wallet_transactions.py --input ../data/wallet_features.csv --output ../data/wallet_transactions.json --max-wallets 100
"""

import argparse
import json
import pandas as pd
from typing import Dict, List
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from ml.fetcher import fetch_transactions, fetch_token_transfers


def extract_transactions_for_wallet(
    address: str,
    chain_id: int = 1,
    max_results: int = 200
) -> List[Dict]:
    """
    Fetch transactions for a single wallet.
    
    Args:
        address: Wallet address
        chain_id: Blockchain chain ID
        max_results: Max transactions to fetch
    
    Returns:
        List of transaction dicts
    """
    try:
        # Fetch normal + internal transactions
        normal_txns = fetch_transactions(address, chain_id, max_results)
        
        # Fetch token transfers
        token_txns = fetch_token_transfers(address, chain_id, max_results // 2)
        
        # Combine
        all_txns = normal_txns + token_txns
        
        print(f"  ✓ {address[:10]}... → {len(all_txns)} txs")
        return all_txns
    
    except Exception as e:
        print(f"  ✗ {address[:10]}... → Error: {e}")
        return []


def extract_wallet_transactions(
    wallet_addresses: List[str],
    chain_id: int = 1,
    max_wallets: int = None,
    max_txns_per_wallet: int = 200
) -> Dict[str, List[Dict]]:
    """
    Extract transactions for multiple wallets.
    
    Args:
        wallet_addresses: List of wallet addresses
        chain_id: Blockchain chain ID
        max_wallets: Limit number of wallets to process
        max_txns_per_wallet: Max transactions per wallet
    
    Returns:
        Dict of {wallet_address: [transactions]}
    """
    wallet_transactions = {}
    
    # Limit wallets if specified
    if max_wallets:
        wallet_addresses = wallet_addresses[:max_wallets]
    
    total = len(wallet_addresses)
    print(f"\nExtracting transactions for {total} wallets...")
    print(f"Chain ID: {chain_id}")
    print("-" * 60)
    
    for i, address in enumerate(wallet_addresses, 1):
        print(f"[{i}/{total}]", end=" ")
        
        txns = extract_transactions_for_wallet(
            address,
            chain_id,
            max_txns_per_wallet
        )
        
        wallet_transactions[address] = txns
    
    print("-" * 60)
    print(f"✅ Extracted transactions for {len(wallet_transactions)} wallets")
    
    # Stats
    total_txns = sum(len(txns) for txns in wallet_transactions.values())
    avg_txns = total_txns / len(wallet_transactions) if wallet_transactions else 0
    print(f"   Total transactions: {total_txns}")
    print(f"   Average per wallet: {avg_txns:.1f}")
    
    return wallet_transactions


def main():
    parser = argparse.ArgumentParser(description="Extract wallet transactions for contract risk analysis")
    parser.add_argument(
        "--input",
        type=str,
        default="../data/wallet_features.csv",
        help="Input CSV with wallet addresses (must have 'address' column)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="../data/wallet_transactions.json",
        help="Output JSON file path"
    )
    parser.add_argument(
        "--chain-id",
        type=int,
        default=1,
        help="Blockchain chain ID (default: 1 = Ethereum)"
    )
    parser.add_argument(
        "--max-wallets",
        type=int,
        default=None,
        help="Maximum number of wallets to process (default: all)"
    )
    parser.add_argument(
        "--max-txns",
        type=int,
        default=200,
        help="Maximum transactions per wallet (default: 200)"
    )
    
    args = parser.parse_args()
    
    print("="*60)
    print("WALLET TRANSACTION EXTRACTOR")
    print("="*60)
    
    # Load wallet addresses
    print(f"\nLoading wallet addresses from {args.input}...")
    df = pd.read_csv(args.input)
    
    if "address" not in df.columns:
        print("ERROR: Input CSV must have 'address' column")
        sys.exit(1)
    
    wallet_addresses = df["address"].dropna().unique().tolist()
    print(f"Found {len(wallet_addresses)} unique wallet addresses")
    
    # Extract transactions
    wallet_transactions = extract_wallet_transactions(
        wallet_addresses,
        chain_id=args.chain_id,
        max_wallets=args.max_wallets,
        max_txns_per_wallet=args.max_txns
    )
    
    # Save to JSON
    print(f"\nSaving to {args.output}...")
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(wallet_transactions, f, indent=2)
    
    print(f"✅ Saved {len(wallet_transactions)} wallet transaction records")
    print(f"   File size: {output_path.stat().st_size / 1024:.1f} KB")
    print("="*60)
    print("\nNext step: Run combine_models.py to integrate contract risk")


if __name__ == "__main__":
    main()

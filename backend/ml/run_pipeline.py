#!/usr/bin/env python3
"""
run_pipeline.py — CLI entry point for the Kryptos ML pipeline.

Usage:
    python -m ml.run_pipeline                                 # synthetic data
    python -m ml.run_pipeline -f data.json                    # from file
    python -m ml.run_pipeline --address 0xABC...              # real wallet (depth=1)
    python -m ml.run_pipeline --address 0xABC... --depth 2    # wallet + neighbors
    python -m ml.run_pipeline --address 0xABC... --save tx.json  # fetch & save
    python -m ml.run_pipeline --json                          # raw JSON output

This file is intentionally minimal — all logic lives in the ml/ package.
"""

import argparse
import json
import sys
import os

# Ensure the backend directory is on the path so `ml` resolves as a package.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ml.synthetic_data import generate_synthetic_transactions
from ml.pipeline import run_pipeline, pipeline_to_json
from ml.data_loader import fetch_neighborhood, save_transactions


def _pretty_print_report(output: dict) -> None:
    """Human-friendly console output."""
    print("\n" + "=" * 72)
    print("  KRYPTOS — Coordinated Anomaly Detection Report")
    print("=" * 72)

    print(f"\n  Graph : {output['graph_summary']['num_wallets']} wallets, "
          f"{output['graph_summary']['num_transactions']} transactions")
    print(f"  Anomalous wallets : {output['anomalous_wallets']} / {output['total_wallets']}")
    print(f"  Clusters found    : {len(output['clusters'])}")

    for cluster in output["clusters"]:
        print("\n" + "-" * 60)
        print(f"  Cluster : {cluster['cluster_id']}")
        print(f"  Risk    : {cluster['risk_score']} / 100")
        print(f"  Size    : {len(cluster['wallets'])} wallets")
        print(f"  Wallets : {', '.join(cluster['wallets'][:8])}"
              + (" ..." if len(cluster["wallets"]) > 8 else ""))

        sigs = cluster["signals"]
        print("  Signals:")
        for key, val in sigs.items():
            print(f"    {key:35s} : {val}")

        if cluster["predicted_exits"]:
            print(f"  Predicted exits : {', '.join(cluster['predicted_exits'])}")
        else:
            print("  Predicted exits : (none)")

    print("\n" + "=" * 72)
    print("  Top 10 wallet anomaly scores:")
    print("  " + "-" * 50)
    sorted_scores = sorted(
        output["wallet_scores"].items(), key=lambda x: x[1], reverse=True
    )
    for wallet, score in sorted_scores[:10]:
        bar = "█" * int(score * 30)
        print(f"  {wallet:30s}  {score:.4f}  {bar}")

    print("=" * 72 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Kryptos ML Pipeline")
    parser.add_argument(
        "-f", "--file",
        type=str,
        default=None,
        help="Path to a JSON file containing transactions.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON instead of a pretty report.",
    )
    parser.add_argument(
        "--contamination",
        type=float,
        default=0.15,
        help="Isolation Forest contamination parameter (default: 0.15).",
    )
    parser.add_argument(
        "--no-labels",
        action="store_true",
        help="Disable hybrid scoring (pure unsupervised mode).",
    )
    parser.add_argument(
        "--analyst-labels",
        type=str,
        default=None,
        help="Path to a JSON file with manual analyst labels.",
    )
    parser.add_argument(
        "--address",
        type=str,
        default=None,
        help="Ethereum wallet address to fetch real transactions for.",
    )
    parser.add_argument(
        "--depth",
        type=int,
        default=1,
        help="Neighborhood expansion depth (1=wallet only, 2=+neighbors). Default: 1.",
    )
    parser.add_argument(
        "--save",
        type=str,
        default=None,
        help="Save fetched transactions to this JSON file for reuse.",
    )
    args = parser.parse_args()

    # Load transactions.
    if args.address:
        if not args.json:
            print(f"Fetching real transactions for {args.address} (depth={args.depth})...\n")
        transactions = fetch_neighborhood(
            seed_address=args.address,
            depth=args.depth,
            verbose=not args.json,
        )
        if not transactions:
            print("ERROR: No transactions found for this address.")
            sys.exit(1)
        if args.save:
            save_transactions(transactions, args.save)
        if not args.json:
            print(f"\nFetched {len(transactions)} transactions.\n")
    elif args.file:
        with open(args.file, "r") as f:
            transactions = json.load(f)
        if not args.json:
            print(f"Loaded {len(transactions)} transactions from {args.file}")
    else:
        if not args.json:
            print("No input file provided — using synthetic test data.\n")
        transactions = generate_synthetic_transactions()

    # Run pipeline.
    output = run_pipeline(
        transactions,
        contamination=args.contamination,
        verbose=not args.json,
        use_labels=not args.no_labels,
        analyst_file=args.analyst_labels,
    )

    # Output.
    if args.json:
        print(pipeline_to_json(output))
    else:
        _pretty_print_report(output)


if __name__ == "__main__":
    main()

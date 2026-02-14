"""
graph_builder.py — Constructs a directed transaction graph from raw transactions.

WHY a graph?
Blockchain transactions are inherently relational: money flows between wallets.
A directed graph (DiGraph) preserves directionality (who sent to whom) and allows
us to compute topological features that are invisible in flat tabular data—
things like fan-in/fan-out patterns, pass-through behavior, and tightly-connected
clusters that often signal coordinated manipulation (wash-trading, layering, etc.).

We use a MultiDiGraph because two wallets can transact more than once, and each
edge carries its own amount + timestamp.  Collapsing to a simple DiGraph would
lose that temporal & volumetric granularity.
"""

from typing import List, Dict, Any
import networkx as nx


def build_transaction_graph(transactions: List[Dict[str, Any]]) -> nx.MultiDiGraph:
    """
    Build a directed multigraph from a list of transaction dicts.

    Parameters
    ----------
    transactions : list of dict
        Each dict must have keys: "from", "to", "value" (float), "timestamp" (int).

    Returns
    -------
    nx.MultiDiGraph
        Nodes = wallet addresses (str).
        Each edge stores {"value": float, "timestamp": int}.
    """
    G = nx.MultiDiGraph()

    for tx in transactions:
        sender = tx["from"].lower().strip()
        receiver = tx["to"].lower().strip()
        value = float(tx["value"])
        timestamp = int(tx["timestamp"])

        # Add nodes idempotently; NetworkX handles duplicates.
        G.add_node(sender)
        G.add_node(receiver)

        # Each call adds a *new* parallel edge (key auto-incremented).
        G.add_edge(sender, receiver, value=value, timestamp=timestamp)

    return G


def get_graph_summary(G: nx.MultiDiGraph) -> Dict[str, Any]:
    """Quick summary stats for sanity checking."""
    return {
        "num_wallets": G.number_of_nodes(),
        "num_transactions": G.number_of_edges(),
        "density": nx.density(G),
        "is_weakly_connected": nx.is_weakly_connected(G) if G.number_of_nodes() > 0 else False,
        "num_weakly_connected_components": nx.number_weakly_connected_components(G),
    }

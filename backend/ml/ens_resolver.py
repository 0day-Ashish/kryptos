"""
ens_resolver.py — Resolve ENS names to Ethereum addresses and vice versa.
Uses public ENS API (no dependency on web3 provider for resolution).
"""
import requests
from typing import Optional
import re

try:
    from backend.ml.fetcher import _get_cached, _set_cache, _cache_key
except ModuleNotFoundError:
    from ml.fetcher import _get_cached, _set_cache, _cache_key


# ENS subgraph endpoint (The Graph — decentralized)
ENS_SUBGRAPH = "https://api.thegraph.com/subgraphs/name/ensdomains/ens"

# Fallback: Cloudflare's public Ethereum RPC (supports eth_call for ENS)
CLOUDFLARE_ETH_RPC = "https://cloudflare-eth.com"

# Regex patterns
ENS_PATTERN = re.compile(r"^[a-zA-Z0-9\-]+\.eth$")
ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")


def is_ens_name(name: str) -> bool:
    """Check if the input looks like an ENS name (e.g., vitalik.eth)."""
    return bool(ENS_PATTERN.match(name.strip().lower()))


def is_address(value: str) -> bool:
    """Check if the input is a valid Ethereum address."""
    return bool(ADDRESS_PATTERN.match(value.strip()))


def resolve_ens(name: str) -> Optional[str]:
    """
    Resolve an ENS name to an Ethereum address.
    Tries multiple methods for reliability.

    Returns
    -------
    Lowercase hex address, or None if resolution fails.
    """
    name = name.strip().lower()
    if not is_ens_name(name):
        return None

    # Check cache
    cache_key = f"ens_forward_{name}"
    cached = _get_cached(cache_key)
    if cached is not None and cached:
        return cached[0]

    # Method 1: Use Cloudflare JSON-RPC (eth_call to ENS resolver)
    address = _resolve_via_rpc(name)
    if address:
        _set_cache(cache_key, [address])
        return address

    # Method 2: Use ENS API
    address = _resolve_via_api(name)
    if address:
        _set_cache(cache_key, [address])
        return address

    return None


def reverse_resolve(address: str) -> Optional[str]:
    """
    Reverse-resolve an Ethereum address to an ENS name.

    Returns
    -------
    ENS name (e.g., "vitalik.eth"), or None.
    """
    address = address.strip().lower()
    if not is_address(address):
        return None

    cache_key = f"ens_reverse_{address}"
    cached = _get_cached(cache_key)
    if cached is not None and cached:
        return cached[0] if cached[0] else None

    ens_name = _reverse_via_api(address)
    _set_cache(cache_key, [ens_name or ""])
    return ens_name


def resolve_input(user_input: str) -> dict:
    """
    Smart resolver: accepts either an ENS name or an address.
    If ENS name, resolves to address. If address, tries reverse resolve.

    Returns
    -------
    {
        input: str,
        address: str | None,
        ens_name: str | None,
        resolved: bool,
    }
    """
    user_input = user_input.strip()

    if is_ens_name(user_input):
        address = resolve_ens(user_input)
        return {
            "input": user_input,
            "address": address,
            "ens_name": user_input if address else None,
            "resolved": address is not None,
        }
    elif is_address(user_input):
        ens_name = reverse_resolve(user_input)
        return {
            "input": user_input,
            "address": user_input.lower(),
            "ens_name": ens_name,
            "resolved": True,
        }
    else:
        return {
            "input": user_input,
            "address": None,
            "ens_name": None,
            "resolved": False,
        }


# ── Internal methods ─────────────────────────────────────────────────────────

def _resolve_via_rpc(name: str) -> Optional[str]:
    """Resolve ENS via JSON-RPC eth_call to the ENS registry."""
    try:
        # Use a simple HTTP call to a JSON-RPC endpoint that supports ENS
        # The 1ns resolver approach using eth_call
        payload = {
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{
                "to": "0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41",  # ENS Public Resolver 2
                "data": _encode_ens_resolve(name),
            }, "latest"],
            "id": 1,
        }
        resp = requests.post(CLOUDFLARE_ETH_RPC, json=payload, timeout=5)
        data = resp.json()
        result = data.get("result", "0x")

        if result and len(result) >= 66 and result != "0x" + "0" * 64:
            # Extract address from the response (last 40 hex chars of 32-byte word)
            address = "0x" + result[-40:]
            if address != "0x" + "0" * 40:
                return address.lower()
    except Exception:
        pass
    return None


def _resolve_via_api(name: str) -> Optional[str]:
    """Resolve ENS via public API fallback."""
    try:
        resp = requests.get(
            f"https://api.ensideas.com/ens/resolve/{name}",
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            addr = data.get("address")
            if addr and addr != "0x" + "0" * 40:
                return addr.lower()
    except Exception:
        pass
    return None


def _reverse_via_api(address: str) -> Optional[str]:
    """Reverse-resolve via public API."""
    try:
        resp = requests.get(
            f"https://api.ensideas.com/ens/resolve/{address}",
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            name = data.get("name")
            if name and name.endswith(".eth"):
                return name
    except Exception:
        pass
    return None


def _encode_ens_resolve(name: str) -> str:
    """
    Encode an ENS name lookup call.
    This is a simplified version — uses namehash.
    """
    import hashlib

    def namehash(name: str) -> bytes:
        if not name:
            return b"\x00" * 32
        labels = name.split(".")
        node = b"\x00" * 32
        for label in reversed(labels):
            label_hash = hashlib.sha3_256(label.encode()).digest()
            node = hashlib.sha3_256(node + label_hash).digest()
        return node

    node = namehash(name)
    # addr(bytes32) function selector = 0x3b3b57de
    return "0x3b3b57de" + node.hex()

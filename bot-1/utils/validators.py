import re

# EVM address: 0x followed by exactly 40 hex characters
_EVM_ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def is_valid_evm_address(address: str) -> bool:
    """Return True if the string is a valid EVM address (0x + 40 hex chars)."""
    return bool(_EVM_ADDRESS_RE.match(address))


def checksum_address(address: str) -> str:
    """
    Return EIP-55 checksummed version of an address.
    Falls back to the original if web3 is not available.
    """
    try:
        from web3 import Web3
        return Web3.to_checksum_address(address)
    except ImportError:
        return address
    except Exception:
        return address

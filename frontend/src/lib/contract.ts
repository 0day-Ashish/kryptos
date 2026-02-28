import { ethers } from "ethers";

// ── Contract config ──────────────────────────────────────────────────────────

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x015ffC4Bb2E5238A1646EC8860030bfb86650Ad2";

export const BASE_SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
  "https://base-sepolia-rpc.publicnode.com";

export const BASE_SEPOLIA_CHAIN_ID = 84532;

// ── Minimal ABI ──────────────────────────────────────────────────────────────

export const RISK_REGISTRY_ABI = [
  {
    name: "storeReport",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wallet", type: "bytes32" },
      { name: "riskScore", type: "uint8" },
      { name: "ipfsHash", type: "string" },
      { name: "timestamp", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "getReport",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "bytes32" }],
    outputs: [
      { name: "riskScore", type: "uint8" },
      { name: "ipfsHash", type: "string" },
      { name: "timestamp", type: "uint64" },
    ],
  },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Matches the backend's Web3.solidity_keccak(["address"], [checksumAddress])
 * i.e., keccak256(abi.encodePacked(address))
 */
export function walletKey(address: string): string {
  return ethers.solidityPackedKeccak256(["address"], [ethers.getAddress(address)]);
}

/** Read-only contract instance via public RPC — no wallet needed */
export function getReadContract(): ethers.Contract {
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  return new ethers.Contract(CONTRACT_ADDRESS, RISK_REGISTRY_ABI, provider);
}

/**
 * Fetch an existing on-chain report for a wallet.
 * Returns null if no report has been stored yet (timestamp === 0).
 */
export async function fetchOnChainReport(
  walletAddress: string
): Promise<{ riskScore: number; ipfsHash: string; timestamp: number } | null> {
  try {
    const contract = getReadContract();
    const key = walletKey(walletAddress);
    const [riskScore, ipfsHash, timestamp] = await contract.getReport(key);
    if (Number(timestamp) === 0) return null;
    return {
      riskScore: Number(riskScore),
      ipfsHash: String(ipfsHash),
      timestamp: Number(timestamp),
    };
  } catch {
    return null;
  }
}

/**
 * Base chain configuration.
 * Wallet management is now handled by Hardhat's signer system.
 * This file exports shared config constants for use across scripts.
 */

export const CONFIG = {
  baseSepolia: {
    chainId: 84532,
    rpc: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
  },
  base: {
    chainId: 8453,
    rpc: process.env.BASE_RPC || "https://mainnet.base.org",
    explorer: "https://basescan.org",
  },
};
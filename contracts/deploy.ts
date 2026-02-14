import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting Deployment to Base...");

  const [deployer] = await ethers.getSigners();
  console.log(`📍 Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  const RiskRegistry = await ethers.getContractFactory("RiskRegistry");
  console.log("🏗️ Deploying RiskRegistry...");

  const registry = await RiskRegistry.deploy();
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  console.log(`\n✅ DEPLOYED SUCCESSFULLY!`);
  console.log(`📜 Contract Address: ${contractAddress}`);
  console.log(`🔗 Block Explorer: https://sepolia.basescan.org/address/${contractAddress}`);
  console.log(`\nTo verify on BaseScan:\n  npx hardhat verify --network baseSepolia ${contractAddress}`);
}

main().catch((error) => {
  console.error("❌ Failed:", error);
  process.exitCode = 1;
});
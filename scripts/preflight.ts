import { ethers } from "hardhat";
async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const block = await ethers.provider.getBlock("latest");
  const network = await ethers.provider.getNetwork();
  console.log("Network:  ", network.name, `(chainId: ${network.chainId})`);
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", ethers.formatEther(balance), "ETH");
  console.log("Block:    ", block?.number);
  const MIN_ETH = ethers.parseEther("0.05");
  if (balance < MIN_ETH) {
    console.error("⚠ WARNING: Balance below 0.05 ETH — may not be enough for deployment");
    console.error("  Get Sepolia ETH: https://faucets.chain.link/sepolia");
  } else {
    console.log("Balance OK ✓ (>= 0.05 ETH)");
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });

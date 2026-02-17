import { ethers } from "hardhat";

/**
 * Deploy AAS contracts to the target network.
 *
 * Steps:
 *   1. Deploy AASZKVerifier
 *   2. Deploy AASRegistry (with EAS, SchemaRegistry, ZKVerifier, and CRE orchestrator addresses)
 *   3. Log deployed addresses for .env update
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deploy.ts --network sepolia
 *   npx hardhat run scripts/deploy/deploy.ts --network hardhat
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // ─── Configuration ─────────────────────────────────────────────
  // EAS contract addresses on Sepolia (from tech spec)
  const EAS_ADDRESS = process.env.EAS_CONTRACT_ADDRESS || "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
  const SCHEMA_REGISTRY_ADDRESS = process.env.EAS_SCHEMA_REGISTRY_ADDRESS || "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";

  // CRE orchestrator — for MVP, use deployer address
  // In production, this would be the CRE workflow EOA
  const CRE_ORCHESTRATOR = process.env.CRE_ORCHESTRATOR_ADDRESS || deployer.address;

  // ─── Step 1: Deploy AASZKVerifier ──────────────────────────────
  console.log("\n--- Deploying AASZKVerifier ---");
  const AASZKVerifier = await ethers.getContractFactory("AASZKVerifier");
  const zkVerifier = await AASZKVerifier.deploy();
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();
  console.log("AASZKVerifier deployed to:", zkVerifierAddress);

  // ─── Step 2: Deploy AASRegistry ────────────────────────────────
  console.log("\n--- Deploying AASRegistry ---");
  const AASRegistry = await ethers.getContractFactory("AASRegistry");
  const registry = await AASRegistry.deploy(
    EAS_ADDRESS,
    SCHEMA_REGISTRY_ADDRESS,
    zkVerifierAddress,
    CRE_ORCHESTRATOR
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AASRegistry deployed to:", registryAddress);

  // ─── Summary ───────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(`AASZKVerifier:  ${zkVerifierAddress}`);
  console.log(`AASRegistry:    ${registryAddress}`);
  console.log(`CRE Orchestrator: ${CRE_ORCHESTRATOR}`);
  console.log(`EAS Contract:   ${EAS_ADDRESS}`);
  console.log(`Schema Registry: ${SCHEMA_REGISTRY_ADDRESS}`);
  console.log("\nUpdate your .env file:");
  console.log(`AAS_ZK_VERIFIER_ADDRESS=${zkVerifierAddress}`);
  console.log(`AAS_REGISTRY_ADDRESS=${registryAddress}`);
  console.log("========================================");

  // ─── Verify on Etherscan (if not hardhat network) ──────────────
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 31337n) {
    console.log("\nWaiting for block confirmations before verification...");
    // Wait for 5 block confirmations
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      const { run } = await import("hardhat");
      console.log("Verifying AASZKVerifier...");
      await run("verify:verify", {
        address: zkVerifierAddress,
        constructorArguments: [],
      });

      console.log("Verifying AASRegistry...");
      await run("verify:verify", {
        address: registryAddress,
        constructorArguments: [
          EAS_ADDRESS,
          SCHEMA_REGISTRY_ADDRESS,
          zkVerifierAddress,
          CRE_ORCHESTRATOR,
        ],
      });
      console.log("Verification complete!");
    } catch (error) {
      console.log("Verification failed (can be retried manually):", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

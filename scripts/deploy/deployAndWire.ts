import { ethers } from "hardhat";

/**
 * Full production deployment: AASZKVerifier + HonkVerifier + AASRegistry
 *
 * Deploys all three contracts and wires the HonkVerifier into the AASZKVerifier
 * so that on-chain proof verification is active (no more dev-mode fallback).
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deployAndWire.ts --network sepolia
 *   npx hardhat run scripts/deploy/deployAndWire.ts --network hardhat
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    (await ethers.provider.getBalance(deployer.address)).toString()
  );

  // ─── Configuration ─────────────────────────────────────────────
  const EAS_ADDRESS =
    process.env.EAS_CONTRACT_ADDRESS ||
    "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
  const SCHEMA_REGISTRY_ADDRESS =
    process.env.EAS_SCHEMA_REGISTRY_ADDRESS ||
    "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";
  const CRE_ORCHESTRATOR =
    process.env.CRE_ORCHESTRATOR_ADDRESS || deployer.address;

  // ─── Step 1: Deploy HonkVerifier (auto-generated) ──────────────
  console.log("\n--- Deploying HonkVerifier (UltraHonk) ---");
  const HonkVerifier = await ethers.getContractFactory("HonkVerifier");
  const honkVerifier = await HonkVerifier.deploy();
  await honkVerifier.waitForDeployment();
  const honkVerifierAddress = await honkVerifier.getAddress();
  console.log("HonkVerifier deployed to:", honkVerifierAddress);

  // ─── Step 2: Deploy AASZKVerifier ──────────────────────────────
  console.log("\n--- Deploying AASZKVerifier ---");
  const AASZKVerifier = await ethers.getContractFactory("AASZKVerifier");
  const zkVerifier = await AASZKVerifier.deploy();
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();
  console.log("AASZKVerifier deployed to:", zkVerifierAddress);

  // ─── Step 3: Wire HonkVerifier into AASZKVerifier ──────────────
  console.log("\n--- Wiring HonkVerifier → AASZKVerifier ---");
  const tx = await zkVerifier.setHonkVerifier(honkVerifierAddress);
  await tx.wait();
  console.log("HonkVerifier wired! vkInitialized =", await zkVerifier.vkInitialized());

  // ─── Step 4: Deploy AASRegistry ────────────────────────────────
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
  console.log("FULL DEPLOYMENT COMPLETE (production mode)");
  console.log("========================================");
  console.log(`HonkVerifier:    ${honkVerifierAddress}`);
  console.log(`AASZKVerifier:   ${zkVerifierAddress}`);
  console.log(`AASRegistry:     ${registryAddress}`);
  console.log(`CRE Orchestrator: ${CRE_ORCHESTRATOR}`);
  console.log(`EAS:             ${EAS_ADDRESS}`);
  console.log(`SchemaRegistry:  ${SCHEMA_REGISTRY_ADDRESS}`);
  console.log("\nUpdate your .env file:");
  console.log(`HONK_VERIFIER_ADDRESS=${honkVerifierAddress}`);
  console.log(`AAS_ZK_VERIFIER_ADDRESS=${zkVerifierAddress}`);
  console.log(`AAS_REGISTRY_ADDRESS=${registryAddress}`);
  console.log("========================================");

  // ─── Etherscan verification ────────────────────────────────────
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 31337n) {
    console.log("\nWaiting for block confirmations...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      const { run } = await import("hardhat");
      console.log("Verifying HonkVerifier...");
      await run("verify:verify", {
        address: honkVerifierAddress,
        constructorArguments: [],
      });
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
      console.log("Verification failed (retry manually):", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

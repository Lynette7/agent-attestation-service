import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import type { Contract } from "ethers";

dotenv.config();

/**
 * All-in-one Sepolia deployment script for AAS.
 *
 * Steps:
 *   1. Deploy HonkVerifier (UltraHonk proof verifier)
 *   2. Deploy AASZKVerifier + wire in HonkVerifier
 *   3. Deploy AASRegistry (wired to Sepolia EAS + SchemaRegistry)
 *   4. Register all 4 EAS schemas (idempotent — skips if already registered)
 *   5. Call setSchemaUIDs() on AASRegistry
 *   6. Write deployments/sepolia.json manifest
 *   7. Verify contracts on Etherscan
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deploySepolia.ts --network sepolia
 */

// ─── EAS Schema Registry ABI ─────────────────────────────────────────────────
const SCHEMA_REGISTRY_ABI = [
  "function register(string calldata schema, address resolver, bool revocable) external returns (bytes32)",
  "function getSchema(bytes32 uid) external view returns (tuple(bytes32 uid, address resolver, bool revocable, string schema))",
];

function computeSchemaUID(schema: string, resolver: string, revocable: boolean): string {
  return ethers.keccak256(
    ethers.solidityPacked(["string", "address", "bool"], [schema, resolver, revocable])
  );
}

async function registerSchemaIfNeeded(
  schemaRegistry: Contract,
  name: string,
  schema: string,
  resolver: string,
  revocable: boolean
): Promise<string> {
  const uid = computeSchemaUID(schema, resolver, revocable);

  try {
    const existing = await schemaRegistry.getSchema(uid);
    if (existing.uid === uid) {
      console.log(`  ✓ ${name} already registered — UID: ${uid}`);
      return uid;
    }
  } catch {
    // getSchema reverts for non-existent schema — proceed to register
  }

  const tx = await schemaRegistry.register(schema, resolver, revocable);
  const receipt = await tx.wait();
  const registeredUID = receipt?.logs?.[0]?.topics?.[1] ?? uid;
  console.log(`  ✓ ${name} registered — TX: ${tx.hash}`);
  console.log(`  ✓ UID: ${registeredUID}`);
  return registeredUID;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const startTime = new Date();

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║         AAS Full Sepolia Deployment              ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`Network:    ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer:   ${deployer.address}`);
  console.log(
    `Balance:    ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`
  );
  console.log(`Started:    ${startTime.toISOString()}`);
  console.log();

  // ─── Config ──────────────────────────────────────────────────────────────
  const EAS_ADDRESS =
    process.env.EAS_CONTRACT_ADDRESS || "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
  const SCHEMA_REGISTRY_ADDRESS =
    process.env.EAS_SCHEMA_REGISTRY_ADDRESS ||
    "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";
  const CRE_ORCHESTRATOR =
    process.env.CRE_ORCHESTRATOR_ADDRESS || deployer.address;

  console.log(`EAS:              ${EAS_ADDRESS}`);
  console.log(`SchemaRegistry:   ${SCHEMA_REGISTRY_ADDRESS}`);
  console.log(`CRE Orchestrator: ${CRE_ORCHESTRATOR}`);
  console.log();

  // ─── Step 1: Deploy HonkVerifier ─────────────────────────────────────────
  console.log("━━━ Step 1: Deploy HonkVerifier ━━━");
  const HonkVerifier = await ethers.getContractFactory("HonkVerifier");
  const honkVerifier = await HonkVerifier.deploy();
  await honkVerifier.waitForDeployment();
  const honkVerifierAddress = await honkVerifier.getAddress();
  console.log(`  HonkVerifier:   ${honkVerifierAddress}`);

  // ─── Step 2: Deploy AASZKVerifier + wire ─────────────────────────────────
  console.log("\n━━━ Step 2: Deploy AASZKVerifier ━━━");
  const AASZKVerifier = await ethers.getContractFactory("AASZKVerifier");
  const zkVerifier = await AASZKVerifier.deploy();
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();
  console.log(`  AASZKVerifier:  ${zkVerifierAddress}`);

  console.log("  Wiring HonkVerifier → AASZKVerifier...");
  const wireTx = await zkVerifier.setHonkVerifier(honkVerifierAddress);
  await wireTx.wait();
  console.log(`  vkInitialized:  ${await zkVerifier.vkInitialized()}`);

  // ─── Step 3: Deploy AASRegistry ──────────────────────────────────────────
  console.log("\n━━━ Step 3: Deploy AASRegistry ━━━");
  const AASRegistry = await ethers.getContractFactory("AASRegistry");
  const registry = await AASRegistry.deploy(
    EAS_ADDRESS,
    SCHEMA_REGISTRY_ADDRESS,
    zkVerifierAddress,
    CRE_ORCHESTRATOR
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`  AASRegistry:    ${registryAddress}`);

  // ─── Step 4: Register EAS Schemas ────────────────────────────────────────
  console.log("\n━━━ Step 4: Register EAS Schemas ━━━");
  const schemaRegistry = new ethers.Contract(
    SCHEMA_REGISTRY_ADDRESS,
    SCHEMA_REGISTRY_ABI,
    deployer
  );
  const ZERO = ethers.ZeroAddress;

  const stdUID = await registerSchemaIfNeeded(
    schemaRegistry,
    "StandardTierAttestation",
    "bytes32 agentId, uint8 tier, uint64 taskThreshold, uint64 rateThresholdBps, bytes zkProof, bytes32[] publicInputs, uint64 issuedAt, uint64 expiresAt",
    ZERO,
    true
  );

  const verUID = await registerSchemaIfNeeded(
    schemaRegistry,
    "VerifiedTierAttestation",
    "bytes32 agentId, uint8 tier, uint64 taskThreshold, uint64 rateThresholdBps, bytes zkProof, bytes32[] publicInputs, uint64 issuedAt, uint64 expiresAt, uint64 verifiedSince",
    ZERO,
    true
  );

  const endUID = await registerSchemaIfNeeded(
    schemaRegistry,
    "EndorsementAttestation",
    "bytes32 endorserAgentId, bytes32 endorsedAgentId, string endorsementType, string context",
    ZERO,
    true
  );

  const taskUID = await registerSchemaIfNeeded(
    schemaRegistry,
    "TaskCompletionAttestation",
    "bytes32 agentId, bytes32 taskId, bytes32 outcomeHash, bool success",
    ZERO,
    true
  );

  // ─── Step 5: Set schema UIDs on AASRegistry ──────────────────────────────
  console.log("\n━━━ Step 5: Wire schema UIDs into AASRegistry ━━━");
  const setTx = await registry.setSchemaUIDs(stdUID, verUID, endUID, taskUID);
  await setTx.wait();
  console.log(`  Schema UIDs set! TX: ${setTx.hash}`);

  // ─── Step 6: Write deployment manifest ───────────────────────────────────
  console.log("\n━━━ Step 6: Writing deployment manifest ━━━");
  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const block = await ethers.provider.getBlock("latest");
  const manifest = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployedAt: startTime.toISOString(),
    block: block?.number,
    deployer: deployer.address,
    contracts: {
      HonkVerifier: honkVerifierAddress,
      AASZKVerifier: zkVerifierAddress,
      AASRegistry: registryAddress,
    },
    external: {
      EASContract: EAS_ADDRESS,
      EASSchemaRegistry: SCHEMA_REGISTRY_ADDRESS,
      CREOrchestrator: CRE_ORCHESTRATOR,
    },
    schemas: {
      StandardTierAttestation: stdUID,
      VerifiedTierAttestation: verUID,
      EndorsementAttestation: endUID,
      TaskCompletionAttestation: taskUID,
    },
    etherscan: {
      HonkVerifier: `https://sepolia.etherscan.io/address/${honkVerifierAddress}`,
      AASZKVerifier: `https://sepolia.etherscan.io/address/${zkVerifierAddress}`,
      AASRegistry: `https://sepolia.etherscan.io/address/${registryAddress}`,
    },
    easScan: {
      StandardTier: `https://sepolia.easscan.org/schema/view/${stdUID}`,
      VerifiedTier: `https://sepolia.easscan.org/schema/view/${verUID}`,
      Endorsement: `https://sepolia.easscan.org/schema/view/${endUID}`,
      TaskCompletion: `https://sepolia.easscan.org/schema/view/${taskUID}`,
    },
  };

  const manifestPath = path.join(deploymentsDir, "sepolia.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  Manifest written: deployments/sepolia.json`);

  // ─── Step 7: Etherscan verification ──────────────────────────────────────
  if (network.chainId !== 31337n) {
    console.log("\n━━━ Step 7: Etherscan Verification ━━━");
    console.log("  Waiting 30s for block confirmations...");
    await new Promise((resolve) => setTimeout(resolve, 30_000));

    try {
      const { run } = await import("hardhat");

      await run("verify:verify", { address: honkVerifierAddress, constructorArguments: [] });
      console.log("  ✓ HonkVerifier verified");

      await run("verify:verify", { address: zkVerifierAddress, constructorArguments: [] });
      console.log("  ✓ AASZKVerifier verified");

      await run("verify:verify", {
        address: registryAddress,
        constructorArguments: [EAS_ADDRESS, SCHEMA_REGISTRY_ADDRESS, zkVerifierAddress, CRE_ORCHESTRATOR],
      });
      console.log("  ✓ AASRegistry verified");
    } catch (error) {
      console.log("  ⚠ Verification failed — retry with:");
      console.log(`    npx hardhat verify --network sepolia ${honkVerifierAddress}`);
      console.log(`    npx hardhat verify --network sepolia ${zkVerifierAddress}`);
      console.log(`    npx hardhat verify --network sepolia ${registryAddress} "${EAS_ADDRESS}" "${SCHEMA_REGISTRY_ADDRESS}" "${zkVerifierAddress}" "${CRE_ORCHESTRATOR}"`);
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime.getTime()) / 1000).toFixed(1);
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                  DEPLOYMENT COMPLETE ✓                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`Elapsed: ${elapsed}s\n`);

  console.log("Add the following to your .env (root):");
  console.log("─────────────────────────────────────────");
  console.log(`HONK_VERIFIER_ADDRESS=${honkVerifierAddress}`);
  console.log(`AAS_ZK_VERIFIER_ADDRESS=${zkVerifierAddress}`);
  console.log(`AAS_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`STANDARD_TIER_SCHEMA_UID=${stdUID}`);
  console.log(`VERIFIED_TIER_SCHEMA_UID=${verUID}`);
  console.log(`ENDORSEMENT_SCHEMA_UID=${endUID}`);
  console.log(`TASK_COMPLETION_SCHEMA_UID=${taskUID}`);
  console.log("─────────────────────────────────────────");
  console.log("\nEtherscan links:");
  console.log(`  HonkVerifier:  https://sepolia.etherscan.io/address/${honkVerifierAddress}`);
  console.log(`  AASZKVerifier: https://sepolia.etherscan.io/address/${zkVerifierAddress}`);
  console.log(`  AASRegistry:   https://sepolia.etherscan.io/address/${registryAddress}`);
  console.log("\nEASScan schema links:");
  console.log(`  StandardTier:  https://sepolia.easscan.org/schema/view/${stdUID}`);
  console.log(`  VerifiedTier:  https://sepolia.easscan.org/schema/view/${verUID}`);
  console.log("\nFull manifest saved to: deployments/sepolia.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

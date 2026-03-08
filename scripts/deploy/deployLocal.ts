import { ethers } from "hardhat";

/**
 * Full local deployment with EAS mocks for Hardhat node testing.
 *
 * Deploys:
 *   1. SchemaRegistryMock
 *   2. EASMock
 *   3. AASZKVerifier
 *   4. AASRegistry (wired to mocks)
 *   5. Registers all 4 schemas on SchemaRegistryMock
 *   6. Calls setSchemaUIDs() on AASRegistry
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deployLocal.ts --network localhost
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying LOCAL dev stack with account:", deployer.address);
  console.log(
    "Account balance:",
    (await ethers.provider.getBalance(deployer.address)).toString()
  );

  // ─── Step 1: Deploy SchemaRegistryMock ─────────────────────────
  console.log("\n--- Deploying SchemaRegistryMock ---");
  const SchemaRegistryMock = await ethers.getContractFactory("SchemaRegistryMock");
  const schemaRegistry = await SchemaRegistryMock.deploy();
  await schemaRegistry.waitForDeployment();
  const schemaRegistryAddress = await schemaRegistry.getAddress();
  console.log("SchemaRegistryMock deployed to:", schemaRegistryAddress);

  // ─── Step 2: Deploy EASMock ────────────────────────────────────
  console.log("\n--- Deploying EASMock ---");
  const EASMock = await ethers.getContractFactory("EASMock");
  const eas = await EASMock.deploy();
  await eas.waitForDeployment();
  const easAddress = await eas.getAddress();
  console.log("EASMock deployed to:", easAddress);

  // ─── Step 3: Deploy AASZKVerifier ──────────────────────────────
  console.log("\n--- Deploying AASZKVerifier ---");
  const AASZKVerifier = await ethers.getContractFactory("AASZKVerifier");
  const zkVerifier = await AASZKVerifier.deploy();
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();
  console.log("AASZKVerifier deployed to:", zkVerifierAddress);

  // ─── Step 4: Deploy AASRegistry ────────────────────────────────
  const CRE_ORCHESTRATOR = deployer.address; // deployer = orchestrator for local dev
  console.log("\n--- Deploying AASRegistry ---");
  const AASRegistry = await ethers.getContractFactory("AASRegistry");
  const registry = await AASRegistry.deploy(
    easAddress,
    schemaRegistryAddress,
    zkVerifierAddress,
    CRE_ORCHESTRATOR
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AASRegistry deployed to:", registryAddress);

  // ─── Step 5: Register schemas on SchemaRegistryMock ────────────
  console.log("\n--- Registering schemas on SchemaRegistryMock ---");
  const ZERO = ethers.ZeroAddress;

  const standardTierSchema =
    "bytes32 agentId, uint8 tier, uint64 taskThreshold, uint64 rateThresholdBps, bytes zkProof, bytes32[] publicInputs, uint64 issuedAt, uint64 expiresAt";
  const verifiedTierSchema =
    "bytes32 agentId, uint8 tier, uint64 taskThreshold, uint64 rateThresholdBps, bytes zkProof, bytes32[] publicInputs, uint64 issuedAt, uint64 expiresAt, uint64 verifiedSince";
  const endorsementSchema =
    "bytes32 endorserAgentId, bytes32 endorsedAgentId, string endorsementType, string context";
  const taskCompletionSchema =
    "bytes32 agentId, bytes32 taskId, bytes32 outcomeHash, bool success";

  const tx1 = await schemaRegistry.register(standardTierSchema, ZERO, true);
  const r1 = await tx1.wait();
  const stdUID = r1?.logs?.[0]?.topics?.[1] || computeUID(standardTierSchema, ZERO, true);
  console.log("  StandardTier UID:", stdUID);

  const tx2 = await schemaRegistry.register(verifiedTierSchema, ZERO, true);
  const r2 = await tx2.wait();
  const verUID = r2?.logs?.[0]?.topics?.[1] || computeUID(verifiedTierSchema, ZERO, true);
  console.log("  VerifiedTier UID:", verUID);

  const tx3 = await schemaRegistry.register(endorsementSchema, ZERO, true);
  const r3 = await tx3.wait();
  const endUID = r3?.logs?.[0]?.topics?.[1] || computeUID(endorsementSchema, ZERO, true);
  console.log("  Endorsement UID:", endUID);

  const tx4 = await schemaRegistry.register(taskCompletionSchema, ZERO, true);
  const r4 = await tx4.wait();
  const taskUID = r4?.logs?.[0]?.topics?.[1] || computeUID(taskCompletionSchema, ZERO, true);
  console.log("  TaskCompletion UID:", taskUID);

  // ─── Step 6: Set schema UIDs on AASRegistry ────────────────────
  console.log("\n--- Setting schema UIDs on AASRegistry ---");
  const setTx = await registry.setSchemaUIDs(stdUID, verUID, endUID, taskUID);
  await setTx.wait();
  console.log("  Schema UIDs set!");

  // ─── Summary ───────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("LOCAL DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(`SchemaRegistryMock: ${schemaRegistryAddress}`);
  console.log(`EASMock:            ${easAddress}`);
  console.log(`AASZKVerifier:      ${zkVerifierAddress}`);
  console.log(`AASRegistry:        ${registryAddress}`);
  console.log(`CRE Orchestrator:   ${CRE_ORCHESTRATOR}`);
  console.log("\nUpdate your .env file:");
  console.log(`EAS_CONTRACT_ADDRESS=${easAddress}`);
  console.log(`EAS_SCHEMA_REGISTRY_ADDRESS=${schemaRegistryAddress}`);
  console.log(`AAS_ZK_VERIFIER_ADDRESS=${zkVerifierAddress}`);
  console.log(`AAS_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`CRE_ORCHESTRATOR_ADDRESS=${CRE_ORCHESTRATOR}`);
  console.log(`STANDARD_TIER_SCHEMA_UID=${stdUID}`);
  console.log(`VERIFIED_TIER_SCHEMA_UID=${verUID}`);
  console.log(`ENDORSEMENT_SCHEMA_UID=${endUID}`);
  console.log(`TASK_COMPLETION_SCHEMA_UID=${taskUID}`);
  console.log("========================================");
}

/** Compute deterministic schema UID (matches SchemaRegistryMock) */
function computeUID(schema: string, resolver: string, revocable: boolean): string {
  return ethers.solidityPackedKeccak256(
    ["string", "address", "bool"],
    [schema, resolver, revocable]
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

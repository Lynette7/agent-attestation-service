import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import type { Contract } from "ethers";

dotenv.config();

/**
 * Register AAS EAS schemas on the target network (v2 — two-tier system).
 *
 * Schemas:
 *   1. StandardTierAttestation — STANDARD tier (10+ tasks, 70%+ rate, no expiry)
 *   2. VerifiedTierAttestation — VERIFIED tier (100+ tasks, 95%+ rate, 90-day expiry)
 *   3. EndorsementAttestation — agent-to-agent endorsements
 *   4. TaskCompletionAttestation — individual task completion records
 *
 * Usage:
 *   npx hardhat run scripts/eas/registerSchemas.ts --network sepolia
 *   npx hardhat run scripts/eas/registerSchemas.ts --network hardhat
 */

// EAS Schema Registry ABI (register + getSchema for existence checks)
const SCHEMA_REGISTRY_ABI = [
  "function register(string calldata schema, address resolver, bool revocable) external returns (bytes32)",
  "function getSchema(bytes32 uid) external view returns (tuple(bytes32 uid, address resolver, bool revocable, string schema))",
  "event Registered(bytes32 indexed uid, address indexed registerer, tuple(bytes32 uid, address resolver, bool revocable, string schema) schema)",
];

/**
 * Compute the deterministic EAS schema UID (matches SchemaRegistry logic):
 *   keccak256(abi.encodePacked(schema, resolver, revocable))
 */
function computeSchemaUID(
  schema: string,
  resolver: string,
  revocable: boolean
): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      ["string", "address", "bool"],
      [schema, resolver, revocable]
    )
  );
}

/**
 * Register a schema if it doesn't already exist.
 * Returns the schema UID whether newly registered or pre-existing.
 */
async function registerIfNeeded(
  schemaRegistry: Contract,
  name: string,
  schema: string,
  resolver: string,
  revocable: boolean
): Promise<string> {
  const uid = computeSchemaUID(schema, resolver, revocable);

  // Check if already registered
  try {
    const existing = await schemaRegistry.getSchema(uid);
    if (existing.uid === uid) {
      console.log(`  ✓ Already registered — UID: ${uid}`);
      return uid;
    }
  } catch {
    // getSchema reverts or returns empty for non-existent — proceed to register
  }

  // Register
  const tx = await schemaRegistry.register(schema, resolver, revocable);
  const receipt = await tx.wait();
  const registeredUID = receipt?.logs?.[0]?.topics?.[1] || uid;
  console.log(`  ✓ Registered — TX: ${tx.hash}`);
  console.log(`  ✓ UID: ${registeredUID}`);
  return registeredUID;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Registering EAS schemas (v2 two-tier) with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Schema Registry address (Sepolia)
  const SCHEMA_REGISTRY_ADDRESS =
    process.env.EAS_SCHEMA_REGISTRY_ADDRESS ||
    "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";

  const schemaRegistry = new ethers.Contract(
    SCHEMA_REGISTRY_ADDRESS,
    SCHEMA_REGISTRY_ABI,
    deployer
  );

  // ─── Schema 1: StandardTierAttestation ─────────────────────────
  // NOTE: includes `uint8 tier` to differentiate from VerifiedTier schema
  console.log("\n--- StandardTierAttestation Schema ---");
  const standardTierSchema =
    "bytes32 agentId, uint8 tier, uint64 taskThreshold, uint64 rateThresholdBps, bytes zkProof, bytes32[] publicInputs, uint64 issuedAt, uint64 expiresAt";
  const stdSchemaUID = await registerIfNeeded(
    schemaRegistry,
    "StandardTierAttestation",
    standardTierSchema,
    ethers.ZeroAddress,
    true
  );

  // ─── Schema 2: VerifiedTierAttestation ─────────────────────────
  // NOTE: includes `uint8 tier` + `uint64 verifiedSince` to differentiate
  console.log("\n--- VerifiedTierAttestation Schema ---");
  const verifiedTierSchema =
    "bytes32 agentId, uint8 tier, uint64 taskThreshold, uint64 rateThresholdBps, bytes zkProof, bytes32[] publicInputs, uint64 issuedAt, uint64 expiresAt, uint64 verifiedSince";
  const verSchemaUID = await registerIfNeeded(
    schemaRegistry,
    "VerifiedTierAttestation",
    verifiedTierSchema,
    ethers.ZeroAddress,
    true
  );

  // ─── Schema 3: EndorsementAttestation ──────────────────────────
  console.log("\n--- EndorsementAttestation Schema ---");
  const endorsementSchema =
    "bytes32 endorserAgentId, bytes32 endorsedAgentId, string endorsementType, string context";
  const endSchemaUID = await registerIfNeeded(
    schemaRegistry,
    "EndorsementAttestation",
    endorsementSchema,
    ethers.ZeroAddress,
    true
  );

  // ─── Schema 4: TaskCompletionAttestation ───────────────────────
  console.log("\n--- TaskCompletionAttestation Schema ---");
  const taskCompletionSchema =
    "bytes32 agentId, bytes32 taskId, bytes32 outcomeHash, bool success";
  const taskSchemaUID = await registerIfNeeded(
    schemaRegistry,
    "TaskCompletionAttestation",
    taskCompletionSchema,
    ethers.ZeroAddress,
    true
  );

  // ─── Summary ───────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("EAS SCHEMA REGISTRATION COMPLETE (v2)");
  console.log("========================================");
  console.log(`StandardTierAttestation UID:     ${stdSchemaUID}`);
  console.log(`VerifiedTierAttestation UID:     ${verSchemaUID}`);
  console.log(`EndorsementAttestation UID:      ${endSchemaUID}`);
  console.log(`TaskCompletionAttestation UID:   ${taskSchemaUID}`);
  console.log("\nUpdate your .env file:");
  console.log(`STANDARD_TIER_SCHEMA_UID=${stdSchemaUID}`);
  console.log(`VERIFIED_TIER_SCHEMA_UID=${verSchemaUID}`);
  console.log(`ENDORSEMENT_SCHEMA_UID=${endSchemaUID}`);
  console.log(`TASK_COMPLETION_SCHEMA_UID=${taskSchemaUID}`);
  console.log("========================================");

  // ─── Set Schema UIDs on AASRegistry (if deployed) ──────────────
  const registryAddress = process.env.AAS_REGISTRY_ADDRESS;
  if (registryAddress) {
    console.log("\nSetting schema UIDs on AASRegistry...");
    const AASRegistry = await ethers.getContractFactory("AASRegistry");
    const registry = AASRegistry.attach(registryAddress);
    const setTx = await registry.setSchemaUIDs(
      stdSchemaUID,
      verSchemaUID,
      endSchemaUID,
      taskSchemaUID
    );
    await setTx.wait();
    console.log("Schema UIDs set on AASRegistry! TX:", setTx.hash);
  } else {
    console.log(
      "\nNote: AAS_REGISTRY_ADDRESS not set in .env — run deploy.ts first, then re-run this script to configure the registry."
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

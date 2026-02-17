import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Register AAS EAS schemas on the target network.
 *
 * Schemas:
 *   1. CapabilityAttestation — agent capability proof with ZK data
 *   2. EndorsementAttestation — agent-to-agent endorsements
 *   3. TaskCompletionAttestation — individual task completion records
 *
 * Usage:
 *   npx hardhat run scripts/eas/registerSchemas.ts --network sepolia
 *   npx hardhat run scripts/eas/registerSchemas.ts --network hardhat
 */

// EAS Schema Registry ABI (only the register function we need)
const SCHEMA_REGISTRY_ABI = [
  "function register(string calldata schema, address resolver, bool revocable) external returns (bytes32)",
  "event Registered(bytes32 indexed uid, address indexed registerer, tuple(bytes32 uid, address resolver, bool revocable, string schema) schema)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Registering EAS schemas with account:", deployer.address);

  // Schema Registry address (Sepolia)
  const SCHEMA_REGISTRY_ADDRESS =
    process.env.EAS_SCHEMA_REGISTRY_ADDRESS ||
    "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";

  const schemaRegistry = new ethers.Contract(
    SCHEMA_REGISTRY_ADDRESS,
    SCHEMA_REGISTRY_ABI,
    deployer
  );

  // ─── Schema 1: CapabilityAttestation ───────────────────────────
  console.log("\n--- Registering CapabilityAttestation Schema ---");
  const capabilitySchema =
    "bytes32 agentId, uint64 taskThreshold, uint64 rateThresholdBps, bytes zkProof, bytes32 publicInputsHash";

  const capTx = await schemaRegistry.register(
    capabilitySchema,
    ethers.ZeroAddress, // No resolver for MVP
    true // Revocable
  );
  const capReceipt = await capTx.wait();
  const capSchemaUID = capReceipt?.logs?.[0]?.topics?.[1] || "PARSE_MANUALLY";
  console.log("CapabilityAttestation schema registered!");
  console.log("  TX hash:", capTx.hash);
  console.log("  Schema UID:", capSchemaUID);

  // ─── Schema 2: EndorsementAttestation ──────────────────────────
  console.log("\n--- Registering EndorsementAttestation Schema ---");
  const endorsementSchema =
    "bytes32 endorserAgentId, bytes32 endorsedAgentId, string endorsementType, string context";

  const endTx = await schemaRegistry.register(
    endorsementSchema,
    ethers.ZeroAddress,
    true
  );
  const endReceipt = await endTx.wait();
  const endSchemaUID = endReceipt?.logs?.[0]?.topics?.[1] || "PARSE_MANUALLY";
  console.log("EndorsementAttestation schema registered!");
  console.log("  TX hash:", endTx.hash);
  console.log("  Schema UID:", endSchemaUID);

  // ─── Schema 3: TaskCompletionAttestation ───────────────────────
  console.log("\n--- Registering TaskCompletionAttestation Schema ---");
  const taskCompletionSchema =
    "bytes32 agentId, bytes32 taskId, bytes32 outcomeHash, bool success";

  const taskTx = await schemaRegistry.register(
    taskCompletionSchema,
    ethers.ZeroAddress,
    true
  );
  const taskReceipt = await taskTx.wait();
  const taskSchemaUID = taskReceipt?.logs?.[0]?.topics?.[1] || "PARSE_MANUALLY";
  console.log("TaskCompletionAttestation schema registered!");
  console.log("  TX hash:", taskTx.hash);
  console.log("  Schema UID:", taskSchemaUID);

  // ─── Summary ───────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("EAS SCHEMA REGISTRATION COMPLETE");
  console.log("========================================");
  console.log(`CapabilityAttestation UID:       ${capSchemaUID}`);
  console.log(`EndorsementAttestation UID:      ${endSchemaUID}`);
  console.log(`TaskCompletionAttestation UID:   ${taskSchemaUID}`);
  console.log("\nUpdate your .env file:");
  console.log(`CAPABILITY_SCHEMA_UID=${capSchemaUID}`);
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
      capSchemaUID,
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

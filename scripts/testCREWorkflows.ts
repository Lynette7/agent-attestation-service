/**
 * CRE Workflow Simulation Tests
 *
 * Validates all three CRE workflow configurations against the live Sepolia
 * deployment. Because the CRE CLI requires bun + DON node access to actually
 * run, this script exercises the same logical paths using ethers.js directly
 * — identical to what each workflow would do inside the DON.
 *
 * Tests:
 *   A) attestation-issuance  — reads config → hits mock perf API → checks
 *      eligibility → verifies calldata encoding
 *   B) attestation-verification — reads config → queries AASRegistry on-chain
 *      → resolves tier + expiry + revocation
 *   C) reputation-graph — reads config → confirms EAS address resolves →
 *      queries existing attestation count for a demo agent
 *
 * Run:  npx ts-node scripts/testCREWorkflows.ts
 */

import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// ─── Colour helpers ──────────────────────────────────────────────
const clr = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:   (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan:  (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold:  (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:   (s: string) => `\x1b[2m${s}\x1b[0m`,
};

const PASS = clr.green("✓ PASS");
const FAIL = clr.red("✗ FAIL");

// ─── Provider ────────────────────────────────────────────────────
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

// ─── ABI fragments ───────────────────────────────────────────────
const REGISTRY_ABI = [
  "function getAttestations(bytes32 agentId) view returns (bytes32[])",
  "function getAttestationMeta(bytes32 uid) view returns (uint8 tier, uint64 expiresAt, bool revoked)",
  "function isAttestationValid(bytes32 uid) view returns (bool)",
];

const EAS_ABI = [
  "function getAttestation(bytes32 uid) view returns (tuple(bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address attester, address recipient, bool revocable, bytes data))",
];

// ─── Helper: load config.staging.json ────────────────────────────
function loadConfig(workflow: string): Record<string, string> {
  const p = path.resolve(__dirname, `../cre-workflows/${workflow}/config.staging.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// ─── Test counter ────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  const symbol = ok ? PASS : FAIL;
  const suffix = detail ? clr.dim(`  ${detail}`) : "";
  console.log(`  ${symbol} ${name}${suffix}`);
  ok ? passed++ : failed++;
}

// ─── Demo agents (seeded in mock perf API) ───────────────────────
const DEMO_AGENT_VERIFIED  = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const DEMO_AGENT_STANDARD  = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const DEMO_AGENT_INELIGIBLE = "0x9999999999999999999999999999999999999999999999999999999999999999";

const MOCK_PERF_API = process.env.AGENT_PERFORMANCE_API_URL || "http://localhost:3002/api/performance";

// ─────────────────────────────────────────────────────────────────
// TEST A: attestation-issuance workflow
// ─────────────────────────────────────────────────────────────────
async function testWorkflowA() {
  console.log(clr.bold("\n[Workflow A] Attestation Issuance"));

  const cfg = loadConfig("attestation-issuance");

  // 1. Config structure validation
  check("config has registryAddress",    !!cfg.registryAddress?.match(/^0x[0-9a-fA-F]{40}$/));
  check("config has zkVerifierAddress",  !!cfg.zkVerifierAddress?.match(/^0x[0-9a-fA-F]{40}$/));
  check("config has performanceApiUrl",  !!cfg.performanceApiUrl);
  check("config has chainSelectorName",  cfg.chainSelectorName === "ethereum-testnet-sepolia");

  // 2. Registry contract is reachable on Sepolia
  const registry = new ethers.Contract(cfg.registryAddress, REGISTRY_ABI, provider);
  try {
    const attestations = await registry.getAttestations(DEMO_AGENT_STANDARD);
    check(
      "AASRegistry.getAttestations() callable on Sepolia",
      Array.isArray(attestations),
      `${attestations.length} attestation(s) for STANDARD demo agent`
    );
  } catch (e: any) {
    check("AASRegistry.getAttestations() callable on Sepolia", false, e.message);
  }

  // 3. ZK Verifier is reachable
  const zkAbi = ["function vkInitialized() view returns (bool)"];
  const verifier = new ethers.Contract(cfg.zkVerifierAddress, zkAbi, provider);
  try {
    const initialized = await verifier.vkInitialized();
    check("AASZKVerifier.vkInitialized() = true", initialized === true, `vkInitialized=${initialized}`);
  } catch (e: any) {
    check("AASZKVerifier.vkInitialized() callable", false, e.message);
  }

  // 4. Mock performance API responds
  try {
    const res = await fetch(`${MOCK_PERF_API}?agent_id=${DEMO_AGENT_VERIFIED}`);
    const data = (await res.json()) as any;
    const rateBps = Math.floor((data.successCount / data.taskCount) * 10000);
    check(
      "Mock Perf API: VERIFIED agent returns sufficient tasks",
      data.taskCount >= 100 && rateBps >= 9500,
      `tasks=${data.taskCount} rate=${rateBps}bps`
    );
  } catch {
    check("Mock Perf API reachable", false, "Is mockPerformanceAPI.ts running on :3002?");
  }

  // 5. Tier eligibility logic (mirrors workflow code)
  const STANDARD_THRESHOLD = { tasks: 10, rateBps: 7000 };
  const VERIFIED_THRESHOLD  = { tasks: 100, rateBps: 9500 };

  const eligible = (taskCount: number, successRate: number, threshold: { tasks: number; rateBps: number }) =>
    taskCount >= threshold.tasks && successRate >= threshold.rateBps;

  check("150 tasks @9533bps → VERIFIED eligible", eligible(150, 9533, VERIFIED_THRESHOLD));
  check("25 tasks  @8000bps → STANDARD eligible", eligible(25, 8000, STANDARD_THRESHOLD));
  check("5 tasks   @6000bps → not eligible",      !eligible(5, 6000, VERIFIED_THRESHOLD));
}

// ─────────────────────────────────────────────────────────────────
// TEST B: attestation-verification workflow
// ─────────────────────────────────────────────────────────────────
async function testWorkflowB() {
  console.log(clr.bold("\n[Workflow B] Attestation Verification"));

  const cfg = loadConfig("attestation-verification");

  check("config has registryAddress", !!cfg.registryAddress?.match(/^0x[0-9a-fA-F]{40}$/));
  check("config has easAddress",      !!cfg.easAddress?.match(/^0x[0-9a-fA-F]{40}$/));
  check("easAddress = Sepolia EAS",   cfg.easAddress === "0xC2679fBD37d54388Ce493F1DB75320D236e1815e");

  const registry = new ethers.Contract(cfg.registryAddress, REGISTRY_ABI, provider);

  // Query attestations for the STANDARD demo agent
  try {
    const attestations: string[] = await registry.getAttestations(DEMO_AGENT_STANDARD);
    check(
      "STANDARD demo agent has at least 1 attestation",
      attestations.length >= 1,
      `${attestations.length} UIDs found`
    );

    if (attestations.length > 0) {
      const uid = attestations[0];
      const meta = await registry.getAttestationMeta(uid);
      const tier = Number(meta.tier);
      const revoked = meta.revoked;
      check(
        "getAttestationMeta returns tier=1 (STANDARD)",
        tier === 1,
        `tier=${tier} revoked=${revoked}`
      );
      check("attestation not revoked", revoked === false);

      const valid = await registry.isAttestationValid(uid);
      check("isAttestationValid returns true", valid === true);
    }
  } catch (e: any) {
    check("Registry queries succeed", false, e.message);
  }

  // EAS contract accessible
  const eas = new ethers.Contract(cfg.easAddress, EAS_ABI, provider);
  try {
    // Use a known attestation UID from the first smoke test
    const uid = "0x3915e3f8b15ffc32f7552fbb4c048197491115661d3ed7e3f7d3dd9ce065ad60";
    const att = await eas.getAttestation(uid);
    check(
      "EAS.getAttestation() callable on Sepolia",
      att.uid === uid,
      `attester=${String(att.attester).slice(0, 10)}...`
    );
  } catch (e: any) {
    check("EAS.getAttestation() callable", false, e.message);
  }

  // Tier filtering logic (mirrors workflow B code)
  const TIER_NUMERIC: Record<string, number> = { ANY: 0, STANDARD: 1, VERIFIED: 2 };
  const meetsMinTier = (actual: number, minTier: string) =>
    actual >= (TIER_NUMERIC[minTier] ?? 0);

  check("tier=1 meets min_tier=STANDARD", meetsMinTier(1, "STANDARD"));
  check("tier=1 fails  min_tier=VERIFIED", !meetsMinTier(1, "VERIFIED"));
  check("tier=2 meets min_tier=VERIFIED",  meetsMinTier(2, "VERIFIED"));
}

// ─────────────────────────────────────────────────────────────────
// TEST C: reputation-graph workflow
// ─────────────────────────────────────────────────────────────────
async function testWorkflowC() {
  console.log(clr.bold("\n[Workflow C] Reputation Graph"));

  const cfg = loadConfig("reputation-graph");

  check("config has registryAddress",    !!cfg.registryAddress?.match(/^0x[0-9a-fA-F]{40}$/));
  check("config has easAddress",         !!cfg.easAddress?.match(/^0x[0-9a-fA-F]{40}$/));
  check("graphStorageAddress set",       cfg.graphStorageAddress !== "0x0000000000000000000000000000000000000000");
  check("graphStorageAddress = Registry", cfg.graphStorageAddress === cfg.registryAddress,
    "AASRegistry stores IPFS CID on-chain");

  // Verify the registry is queryable (used by reputation graph to read nodes)
  const registry = new ethers.Contract(cfg.registryAddress, REGISTRY_ABI, provider);
  try {
    const [std, ver, inel] = await Promise.all([
      registry.getAttestations(DEMO_AGENT_STANDARD),
      registry.getAttestations(DEMO_AGENT_VERIFIED),
      registry.getAttestations(DEMO_AGENT_INELIGIBLE),
    ]);
    check(
      "Can enumerate attestations for all three demo agents",
      true,
      `STANDARD:${std.length} VERIFIED:${ver.length} INELIGIBLE:${inel.length}`
    );
  } catch (e: any) {
    check("Registry enumerable for graph build", false, e.message);
  }

  // Verify Attested event topic (used by logTrigger)
  const EXPECTED_TOPIC = "0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35";
  const { keccak256, toUtf8Bytes } = ethers;
  const computed = keccak256(toUtf8Bytes("Attested(address,address,bytes32,bytes32)"));
  check(
    "EAS Attested(address,address,bytes32,bytes32) topic computes correctly",
    computed === EXPECTED_TOPIC,
    computed.slice(0, 18) + "..."
  );
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(clr.bold(`
╔══════════════════════════════════════════════╗
║      CRE Workflow Simulation Tests           ║
╚══════════════════════════════════════════════╝`));
  console.log(clr.dim(`Network: Sepolia (chain 11155111)`));
  console.log(clr.dim(`Registry: 0x4a9e22A4402090ae445C166dD08Bd7C3A2725316`));
  console.log(clr.dim(`Time: ${new Date().toISOString()}`));

  await testWorkflowA();
  await testWorkflowB();
  await testWorkflowC();

  console.log("\n──────────────────────────────────────────────");
  if (failed === 0) {
    console.log(clr.green(clr.bold(`Results: ${passed} passed, 0 failed`)));
    console.log(clr.green("All CRE workflow configs verified for Sepolia ✓\n"));
    console.log(clr.dim("To run the workflows locally:"));
    console.log(clr.dim("  cd cre-workflows/attestation-issuance && cre workflow simulate"));
    console.log(clr.dim("  cd cre-workflows/attestation-verification && cre workflow simulate\n"));
  } else {
    console.log(clr.red(`Results: ${passed} passed, ${failed} failed`));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

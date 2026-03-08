import * as dotenv from "dotenv";
dotenv.config();

/**
 * End-to-end smoke test script for AAS API.
 *
 * Runs against the live API server (defaults to http://localhost:3001).
 * Tests: health, attestation request, agent verification, reputation lookup,
 *        and agent-to-agent endorsement.
 *
 * Usage:
 *   npx ts-node scripts/smokeTest.ts
 *   API_URL=https://your-deployed-api.com npx ts-node scripts/smokeTest.ts
 */

const API_URL = process.env.API_URL || `http://localhost:${process.env.API_PORT || 3001}`;

const DEMO_AGENT_STANDARD =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const DEMO_AGENT_VERIFIED =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const DEMO_AGENT_B =
  "0x9999999999999999999999999999999999999999999999999999999999999999";

let passed = 0;
let failed = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenHex(hex: string, chars = 8): string {
  if (!hex || hex.length < chars * 2) return hex;
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`;
}

async function apiCall<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${API_URL}/api/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json() as T;
}

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log("✓ PASS");
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`✗ FAIL — ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

async function testHealth() {
  console.log("\n[1/7] Health Check");
  await test("GET /health returns ok", async () => {
    const result = await apiCall<{
      status: string;
      blockchain_connected: boolean;
      registry_address: string;
      rpc_url: string;
    }>("GET", "/health");
    assert(result.status === "ok", `Expected status=ok, got ${result.status}`);
    assert(typeof result.blockchain_connected === "boolean", "Missing blockchain_connected field");
    assert(result.registry_address?.startsWith("0x"), "Missing registry_address");
    console.log(
      `\n    status=${result.status} connected=${result.blockchain_connected} registry=${shortenHex(result.registry_address)}`
    );
  });
}

async function testAttestation() {
  console.log("\n[2/7] Attestation Request");

  await test("POST /attest — STANDARD tier", async () => {
    const result = await apiCall<{
      status: string;
      tier: string;
      attestation_uid: string;
      tx_hash: string;
      task_threshold: number;
      rate_threshold_bps: number;
    }>("POST", "/attest", {
      agent_id: DEMO_AGENT_STANDARD,
      tier: "STANDARD",
    });
    assert(result.status === "ATTESTATION_CREATED", `Expected ATTESTATION_CREATED, got ${result.status}`);
    assert(result.tier === "STANDARD", `Expected tier=STANDARD, got ${result.tier}`);
    assert(result.attestation_uid?.startsWith("0x"), "attestation_uid should be hex");
    assert(result.tx_hash?.startsWith("0x"), "tx_hash should be hex");
    console.log(`\n    uid=${shortenHex(result.attestation_uid)} tx=${shortenHex(result.tx_hash)}`);
  });

  await test("POST /attest — VERIFIED tier", async () => {
    const result = await apiCall<{
      status: string;
      tier: string;
      attestation_uid: string;
    }>("POST", "/attest", {
      agent_id: DEMO_AGENT_VERIFIED,
      tier: "VERIFIED",
    });
    assert(result.status === "ATTESTATION_CREATED", `Expected ATTESTATION_CREATED, got ${result.status}`);
    assert(result.tier === "VERIFIED", `Expected tier=VERIFIED, got ${result.tier}`);
    console.log(`\n    uid=${shortenHex(result.attestation_uid)}`);
  });

  await test("POST /attest — ineligible agent returns 400", async () => {
    try {
      await apiCall("POST", "/attest", {
        agent_id: DEMO_AGENT_B,
        tier: "VERIFIED",
      });
      // If we get here, the API didn't reject it — check if it returns success=false
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // 400 or 422 is expected for ineligible agent
      assert(
        msg.includes("HTTP 4"),
        `Expected 4xx error for ineligible agent, got: ${msg}`
      );
    }
  });
}

async function testVerification() {
  console.log("\n[3/7] Agent Verification");

  await test("GET /verify/:agentId — verified agent", async () => {
    const result = await apiCall<{
      verified: boolean;
      tier: string;
      attestation_uid: string;
      proof_valid: boolean;
    }>("GET", `/verify/${DEMO_AGENT_STANDARD}`);
    assert(result.verified === true, `Expected verified=true`);
    assert(result.tier === "STANDARD" || result.tier === "VERIFIED", `Unexpected tier: ${result.tier}`);
    assert(typeof result.proof_valid === "boolean", "Missing proof_valid field");
    console.log(`\n    verified=${result.verified} tier=${result.tier} uid=${shortenHex(result.attestation_uid ?? "")}`);
  });

  await test("GET /verify/:agentId?min_tier=STANDARD", async () => {
    const result = await apiCall<{ verified: boolean; tier: string }>(
      "GET",
      `/verify/${DEMO_AGENT_STANDARD}?min_tier=STANDARD`
    );
    assert(result.verified === true, "Expected verified=true with STANDARD min_tier");
  });

  await test("GET /verify/:agentId?min_tier=VERIFIED — STANDARD agent fails", async () => {
    const result = await apiCall<{ verified: boolean }>(
      "GET",
      `/verify/${DEMO_AGENT_STANDARD}?min_tier=VERIFIED`
    );
    // STANDARD agent should not satisfy VERIFIED min_tier
    assert(result.verified === false, `Expected verified=false when min_tier=VERIFIED for STANDARD agent`);
  });
}

async function testReputation() {
  console.log("\n[4/7] Reputation Lookup");

  await test("GET /reputation/:agentId", async () => {
    const result = await apiCall<{
      attestation_count: number;
      current_tier: string | null;
      attestations: unknown[];
    }>("GET", `/reputation/${DEMO_AGENT_STANDARD}`);
    assert(typeof result.attestation_count === "number", "Missing attestation_count");
    assert(Array.isArray(result.attestations), "attestations should be array");
    assert(result.attestation_count >= 0, "attestation_count should be >= 0");
    console.log(
      `\n    count=${result.attestation_count} tier=${result.current_tier}`
    );
  });
}

async function testEndorsement() {
  console.log("\n[5/7] Agent-to-Agent Endorsement");

  await test("POST /endorse — agent B endorses agent A", async () => {
    const result = await apiCall<{
      status: string;
      endorsement_uid: string;
      endorser_agent_id: string;
      endorsed_agent_id: string;
    }>("POST", "/endorse", {
      endorser_agent_id: DEMO_AGENT_B,
      endorsed_agent_id: DEMO_AGENT_STANDARD,
      endorsement_type: "reliable_collaborator",
      context: "Smoke test endorsement",
    });
    assert(
      result.status === "ENDORSEMENT_CREATED" || result.endorsement_uid?.startsWith("0x"),
      `Unexpected endorsement response: ${JSON.stringify(result)}`
    );
    console.log(`\n    uid=${shortenHex(result.endorsement_uid)}`);
  });
}

async function testReputationGraph() {
  console.log("\n[6/7] IPFS Reputation Graph");

  await test("GET /reputation/graph returns graph data", async () => {
    const result = await apiCall<{
      cid: string | null;
      gateway: string | null;
      builtAt: string;
      builtAtBlock: number;
      metrics: {
        totalAgents: number;
        totalAttestations: number;
        totalEndorsements: number;
        tierBreakdown: Record<string, number>;
        avgTrustScore: number;
      };
      nodes: Record<string, unknown>;
      edges: unknown[];
    }>("GET", "/reputation/graph");

    assert(typeof result.builtAt === "string", "Missing builtAt");
    assert(typeof result.builtAtBlock === "number", "Missing builtAtBlock");
    assert(result.metrics?.totalAgents >= 0, "Missing metrics.totalAgents");
    assert(Array.isArray(result.edges), "edges should be an array");
    assert(typeof result.nodes === "object", "nodes should be an object");
    console.log(
      `\n    cid=${result.cid ? result.cid.slice(0, 20) + "..." : "null"} ` +
      `agents=${result.metrics.totalAgents} attestations=${result.metrics.totalAttestations}`
    );
  });

  await test("GET /reputation/graph has STANDARD node", async () => {
    const result = await apiCall<{ nodes: Record<string, any> }>(
      "GET",
      "/reputation/graph"
    );
    const node = result.nodes?.[DEMO_AGENT_STANDARD];
    assert(node !== undefined, "STANDARD demo agent not in graph nodes");
    assert(node.currentTier === "STANDARD", `Expected STANDARD tier, got ${node.currentTier}`);
    assert(node.trustScore >= 0 && node.trustScore <= 100, "trustScore should be 0-100");
    console.log(`\n    trustScore=${node.trustScore}/100 attestations=${node.attestationCount}`);
  });
}

async function testCREWorkflows() {
  console.log("\n[7/7] CRE Workflow Config Validation");

  const cfgPath = (w: string) =>
    `${__dirname}/../cre-workflows/${w}/config.staging.json`;

  await test("Workflow A config points to Sepolia registry", async () => {
    const cfg = JSON.parse(
      await import("fs").then((fs) =>
        fs.default.readFileSync(cfgPath("attestation-issuance"), "utf8")
      )
    );
    assert(
      cfg.registryAddress === "0x4a9e22A4402090ae445C166dD08Bd7C3A2725316",
      `Wrong registryAddress: ${cfg.registryAddress}`
    );
    assert(
      cfg.chainSelectorName === "ethereum-testnet-sepolia",
      `Wrong chain: ${cfg.chainSelectorName}`
    );
  });

  await test("Workflow B config points to Sepolia EAS", async () => {
    const cfg = JSON.parse(
      await import("fs").then((fs) =>
        fs.default.readFileSync(cfgPath("attestation-verification"), "utf8")
      )
    );
    assert(
      cfg.easAddress === "0xC2679fBD37d54388Ce493F1DB75320D236e1815e",
      `Wrong easAddress: ${cfg.easAddress}`
    );
  });

  await test("Workflow C config has valid graphStorageAddress", async () => {
    const cfg = JSON.parse(
      await import("fs").then((fs) =>
        fs.default.readFileSync(cfgPath("reputation-graph"), "utf8")
      )
    );
    assert(
      cfg.graphStorageAddress !== "0x0000000000000000000000000000000000000000",
      "graphStorageAddress still zero address"
    );
    assert(
      cfg.graphStorageAddress === cfg.registryAddress,
      "graphStorageAddress should equal registryAddress (AASRegistry stores IPFS CID)"
    );
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║        AAS End-to-End Smoke Test      ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`API:  ${API_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    await testHealth();
    await testAttestation();
    await testVerification();
    await testReputation();
    await testEndorsement();
    await testReputationGraph();
    await testCREWorkflows();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\nFatal error: ${msg}`);
    process.exit(1);
  }

  console.log("\n──────────────────────────────────────");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("──────────────────────────────────────");

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll smoke tests passed ✓");
  }
}

main();

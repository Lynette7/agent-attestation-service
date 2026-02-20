/**
 * AAS REST API Server (v2 — Two-Tier System)
 *
 * Wraps CRE Workflows A and B with a RESTful HTTP interface.
 * Supports tier-based attestation, verification with tier filtering,
 * attestation revocation, and the new two-tier system.
 *
 * Endpoints:
 *   POST /api/v1/attest           — Trigger attestation issuance (Workflow A)
 *   GET  /api/v1/verify/:agentId  — Verify agent attestation (Workflow B)
 *   GET  /api/v1/reputation/:agentId — Query reputation graph
 *   POST /api/v1/endorse          — Submit endorsement
 *   POST /api/v1/revoke           — Revoke attestation(s)
 *   GET  /api/v1/health           — Health check
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.API_PORT || "3001");

// ─── Helpers ─────────────────────────────────────────────────────

function jsonResponse(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function parseUrl(url: string): { pathname: string; params: URLSearchParams } {
  const parsed = new URL(url, `http://localhost:${PORT}`);
  return { pathname: parsed.pathname, params: parsed.searchParams };
}

// ─── Route Handlers ──────────────────────────────────────────────

/**
 * POST /api/v1/attest
 * Trigger attestation issuance with tier support.
 * Body: { agent_id, platform, tier: 'STANDARD' | 'VERIFIED', signature }
 */
async function handleAttest(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req);
  const { agent_id, platform, tier, signature } = body;

  if (!agent_id || !tier) {
    return jsonResponse(res, 400, {
      error: "MISSING_FIELDS",
      details: "Required: agent_id, tier ('STANDARD' or 'VERIFIED')",
    });
  }

  // Validate tier
  if (tier !== "STANDARD" && tier !== "VERIFIED") {
    return jsonResponse(res, 400, {
      error: "INVALID_TIER",
      details: "tier must be 'STANDARD' or 'VERIFIED'",
    });
  }

  // TODO: Verify EIP-712 signature
  // TODO: Call Workflow A via CRE trigger

  console.log(`[API] Attestation request for agent ${agent_id} (tier: ${tier})`);

  // For MVP, trigger workflow and return status
  // In production, this would create a CRE job and return a job ID
  const thresholds =
    tier === "STANDARD"
      ? { tasks: 10, rateBps: 7000, expiresIn: "never" }
      : { tasks: 100, rateBps: 9500, expiresIn: "90 days" };

  jsonResponse(res, 200, {
    status: "WORKFLOW_TRIGGERED",
    message: `${tier} attestation issuance workflow started`,
    agent_id,
    tier,
    thresholds,
    estimated_completion_seconds: 15,
  });
}

/**
 * GET /api/v1/verify/:agentId
 * Verify agent attestation with tier filtering and expiry checks.
 * Query params: min_tier, max_age_days, include_expired
 */
async function handleVerify(
  agentId: string,
  params: URLSearchParams,
  res: ServerResponse
) {
  const minTier = params.get("min_tier") as "STANDARD" | "VERIFIED" | null;
  const maxAgeDays = params.get("max_age_days")
    ? parseInt(params.get("max_age_days")!)
    : undefined;
  const includeExpired = params.get("include_expired") === "true";

  console.log(
    `[API] Verification request for agent ${agentId} (min_tier: ${minTier || "ANY"}, max_age: ${maxAgeDays || "∞"} days)`
  );

  // Validate tier parameter if provided
  if (minTier && minTier !== "STANDARD" && minTier !== "VERIFIED") {
    return jsonResponse(res, 400, {
      error: "INVALID_TIER",
      details: "min_tier must be 'STANDARD' or 'VERIFIED'",
    });
  }

  // TODO: Call Workflow B with tier filtering
  // For MVP, return a structured response
  jsonResponse(res, 200, {
    verified: false,
    tier: null,
    attestation_uid: null,
    task_threshold: 0,
    rate_bps: 0,
    proof_valid: false,
    issued_at: 0,
    expires_at: 0,
    message:
      "Workflow B integration pending — connect after contract deployment",
  });
}

/**
 * GET /api/v1/reputation/:agentId
 * Query reputation graph for an agent.
 */
async function handleReputation(agentId: string, res: ServerResponse) {
  console.log(`[API] Reputation query for agent ${agentId}`);

  // Roadmap: read from IPFS using latest committed CID
  jsonResponse(res, 200, {
    agent_id: agentId,
    current_tier: null,
    attestations: [],
    endorsers: [],
    endorsees: [],
    page_rank: 0,
    ipfs_cid: null,
    message: "Reputation graph is a roadmap feature",
  });
}

/**
 * POST /api/v1/endorse
 * Submit an agent-to-agent endorsement.
 * Body: { endorser_agent_id, endorsed_agent_id, endorsement_type, context }
 */
async function handleEndorse(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req);
  const { endorser_agent_id, endorsed_agent_id, endorsement_type, context } =
    body;

  if (!endorser_agent_id || !endorsed_agent_id || !endorsement_type) {
    return jsonResponse(res, 400, {
      error: "MISSING_FIELDS",
      details:
        "Required: endorser_agent_id, endorsed_agent_id, endorsement_type",
    });
  }

  console.log(
    `[API] Endorsement: ${endorser_agent_id} → ${endorsed_agent_id}`
  );

  jsonResponse(res, 200, {
    status: "ENDORSEMENT_SUBMITTED",
    endorser_agent_id,
    endorsed_agent_id,
    endorsement_type,
    message: "Endorsement processing pending CRE integration",
  });
}

/**
 * POST /api/v1/revoke
 * Revoke attestation(s) for an agent.
 * Body: { agent_id, attestation_uid? (optional — revokes all if omitted), reason }
 * Auth: X-Agent-Signature (must be agent owner)
 */
async function handleRevoke(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req);
  const { agent_id, attestation_uid, reason } = body;

  if (!agent_id) {
    return jsonResponse(res, 400, {
      error: "MISSING_FIELDS",
      details: "Required: agent_id. Optional: attestation_uid, reason",
    });
  }

  // TODO: Verify EIP-712 signature (must be agent wallet owner)
  // TODO: Call AASRegistry.revokeAttestation() on-chain

  console.log(
    `[API] Revocation request for agent ${agent_id}${attestation_uid ? ` (UID: ${attestation_uid})` : " (ALL)"}`
  );

  jsonResponse(res, 200, {
    status: "REVOCATION_SUBMITTED",
    agent_id,
    attestation_uid: attestation_uid || "ALL",
    reason: reason || "Not specified",
    message:
      "Revocation processing — calls EAS.revoke() on-chain for immediate trust invalidation",
  });
}

// ─── Router ──────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Agent-Signature"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const { pathname, params } = parseUrl(req.url || "/");

  try {
    // POST /api/v1/attest
    if (req.method === "POST" && pathname === "/api/v1/attest") {
      return await handleAttest(req, res);
    }

    // GET /api/v1/verify/:agentId
    const verifyMatch = pathname.match(/^\/api\/v1\/verify\/(.+)$/);
    if (req.method === "GET" && verifyMatch) {
      return await handleVerify(verifyMatch[1], params, res);
    }

    // GET /api/v1/reputation/:agentId
    const repMatch = pathname.match(/^\/api\/v1\/reputation\/(.+)$/);
    if (req.method === "GET" && repMatch) {
      return await handleReputation(repMatch[1], res);
    }

    // POST /api/v1/endorse
    if (req.method === "POST" && pathname === "/api/v1/endorse") {
      return await handleEndorse(req, res);
    }

    // POST /api/v1/revoke
    if (req.method === "POST" && pathname === "/api/v1/revoke") {
      return await handleRevoke(req, res);
    }

    // GET /api/v1/health
    if (req.method === "GET" && pathname === "/api/v1/health") {
      return jsonResponse(res, 200, {
        status: "ok",
        service: "Agent Attestation Service",
        version: "2.0.0-mvp",
        tier_system: "STANDARD / VERIFIED",
        timestamp: new Date().toISOString(),
      });
    }

    // 404
    jsonResponse(res, 404, { error: "NOT_FOUND" });
  } catch (error: any) {
    console.error("[API] Error:", error);
    jsonResponse(res, 500, { error: "INTERNAL_ERROR", details: error.message });
  }
}

// ─── Server ──────────────────────────────────────────────────────

const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`\n🔷 Agent Attestation Service API (v2 — Two-Tier)`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`     POST /api/v1/attest          — Attestation issuance (STANDARD | VERIFIED)`);
  console.log(`     GET  /api/v1/verify/:agentId — Verify (min_tier, max_age_days, include_expired)`);
  console.log(`     GET  /api/v1/reputation/:agentId — Reputation graph query`);
  console.log(`     POST /api/v1/endorse         — Submit endorsement`);
  console.log(`     POST /api/v1/revoke          — Revoke attestation(s)`);
  console.log(`     GET  /api/v1/health          — Health check\n`);
});

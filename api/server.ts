/**
 * AAS REST API Server
 *
 * Wraps CRE Workflows A and B with a RESTful HTTP interface.
 *
 * Endpoints:
 *   POST /api/v1/attest         — Trigger attestation issuance (Workflow A)
 *   GET  /api/v1/verify/:agentId — Verify agent attestation (Workflow B)
 *   GET  /api/v1/reputation/:agentId — Query reputation graph
 *   POST /api/v1/endorse        — Submit endorsement
 *   GET  /api/v1/health         — Health check
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

async function handleAttest(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req);
  const { agent_id, platform, task_threshold, rate_threshold_bps, signature } = body;

  if (!agent_id || !task_threshold || !rate_threshold_bps) {
    return jsonResponse(res, 400, {
      error: "MISSING_FIELDS",
      details: "Required: agent_id, task_threshold, rate_threshold_bps",
    });
  }

  // TODO: Verify EIP-712 signature
  // TODO: Call Workflow A via CRE trigger

  console.log(`[API] Attestation request for agent ${agent_id}`);

  // For MVP, return a mock response indicating the workflow was triggered
  jsonResponse(res, 200, {
    status: "WORKFLOW_TRIGGERED",
    message: "Attestation issuance workflow started",
    agent_id,
    task_threshold,
    rate_threshold_bps,
    estimated_completion_seconds: 15,
  });
}

async function handleVerify(agentId: string, params: URLSearchParams, res: ServerResponse) {
  const minTasks = parseInt(params.get("min_tasks") || "0");
  const minRateBps = parseInt(params.get("min_rate_bps") || "0");
  const maxAgeDays = params.get("max_age_days")
    ? parseInt(params.get("max_age_days")!)
    : undefined;

  console.log(`[API] Verification request for agent ${agentId}`);

  // TODO: Call Workflow B
  // For MVP, return a structured response
  jsonResponse(res, 200, {
    verified: false,
    attestation_uid: null,
    task_threshold: minTasks,
    rate_bps: minRateBps,
    proof_valid: false,
    issued_at: 0,
    message: "Workflow B integration pending — connect after contract deployment",
  });
}

async function handleReputation(agentId: string, res: ServerResponse) {
  console.log(`[API] Reputation query for agent ${agentId}`);

  // Roadmap: read from IPFS using committed CID
  jsonResponse(res, 200, {
    agent_id: agentId,
    attestations: [],
    endorsers: [],
    endorsees: [],
    page_rank: 0,
    ipfs_cid: null,
    message: "Reputation graph is a roadmap feature",
  });
}

async function handleEndorse(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req);
  const { endorser_agent_id, endorsed_agent_id, endorsement_type, context } = body;

  if (!endorser_agent_id || !endorsed_agent_id || !endorsement_type) {
    return jsonResponse(res, 400, {
      error: "MISSING_FIELDS",
      details: "Required: endorser_agent_id, endorsed_agent_id, endorsement_type",
    });
  }

  console.log(`[API] Endorsement: ${endorser_agent_id} → ${endorsed_agent_id}`);

  jsonResponse(res, 200, {
    status: "ENDORSEMENT_SUBMITTED",
    endorser_agent_id,
    endorsed_agent_id,
    endorsement_type,
    message: "Endorsement processing pending CRE integration",
  });
}

// ─── Router ──────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Agent-Signature");

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

    // GET /api/v1/health
    if (req.method === "GET" && pathname === "/api/v1/health") {
      return jsonResponse(res, 200, {
        status: "ok",
        service: "Agent Attestation Service",
        version: "1.0.0-mvp",
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
  console.log(`\n🔷 Agent Attestation Service API`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`     POST /api/v1/attest`);
  console.log(`     GET  /api/v1/verify/:agentId`);
  console.log(`     GET  /api/v1/reputation/:agentId`);
  console.log(`     POST /api/v1/endorse`);
  console.log(`     GET  /api/v1/health\n`);
});

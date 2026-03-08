/**
 * Mock Agent Performance API Server
 *
 * Simulates the external agent platform API that CRE Confidential HTTP
 * would fetch performance data from in production.
 *
 * In the real system, this API represents platforms like OpenClaw, LangChain,
 * or custom agent runtimes that track agent task completion statistics.
 *
 * CRE Confidential HTTP would call this API inside the TEE — the response
 * data (task_count, success_count) is treated as private and never leaves
 * the enclave. Only the ZK proof derived from this data is made public.
 *
 * Endpoints:
 *   GET /api/performance?agent_id=<agentId>  — Get agent performance data
 *   POST /api/task-complete                  — Record a task completion
 *   GET /api/agents                          — List all tracked agents
 *   GET /health                              — Health check
 *
 * Usage:
 *   npx ts-node api/mockPerformanceAPI.ts
 *   # or
 *   MOCK_API_PORT=3002 npx ts-node api/mockPerformanceAPI.ts
 */

import { createServer, IncomingMessage, ServerResponse } from "http";

// Railway injects PORT; fall back to MOCK_API_PORT for local dev
const PORT = parseInt(process.env.PORT || process.env.MOCK_API_PORT || "3002");

// ─── In-Memory Agent Performance Store ───────────────────────────

interface AgentPerformance {
  agentId: string;
  taskCount: number;
  successCount: number;
  failureCount: number;
  avgResponseTimeMs: number;
  lastTaskTimestamp: number;
  platform: string;
}

// Pre-seed with demo agents covering both tiers
const agentStore: Map<string, AgentPerformance> = new Map();

// Demo agent A — qualifies for VERIFIED tier (150 tasks, 95.3% success)
const demoAgentA =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
agentStore.set(demoAgentA, {
  agentId: demoAgentA,
  taskCount: 150,
  successCount: 143,
  failureCount: 7,
  avgResponseTimeMs: 1200,
  lastTaskTimestamp: Math.floor(Date.now() / 1000),
  platform: "openclaw",
});

// Demo agent B — qualifies for STANDARD tier only (25 tasks, 80%)
const demoAgentB =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
agentStore.set(demoAgentB, {
  agentId: demoAgentB,
  taskCount: 25,
  successCount: 20,
  failureCount: 5,
  avgResponseTimeMs: 2400,
  lastTaskTimestamp: Math.floor(Date.now() / 1000) - 3600,
  platform: "langchain",
});

// Demo agent C — new agent, does NOT qualify for any tier (5 tasks, 60%)
const demoAgentC =
  "0x9999999999999999999999999999999999999999999999999999999999999999";
agentStore.set(demoAgentC, {
  agentId: demoAgentC,
  taskCount: 5,
  successCount: 3,
  failureCount: 2,
  avgResponseTimeMs: 5000,
  lastTaskTimestamp: Math.floor(Date.now() / 1000) - 86400,
  platform: "custom",
});

// ─── Helpers ─────────────────────────────────────────────────────

function jsonResponse(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: string) => (body += chunk));
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
 * GET /api/performance?agent_id=<agentId>
 * Returns performance data for a specific agent.
 * This is what CRE Confidential HTTP fetches inside the TEE.
 */
function handleGetPerformance(
  params: URLSearchParams,
  res: ServerResponse
) {
  const agentId = params.get("agent_id");

  if (!agentId) {
    return jsonResponse(res, 400, {
      error: "MISSING_AGENT_ID",
      details: "Query parameter 'agent_id' is required",
    });
  }

  const agent = agentStore.get(agentId);

  if (!agent) {
    // For unknown agents, generate random performance data
    // This simulates dynamic agent onboarding
    const taskCount = Math.floor(Math.random() * 200) + 5;
    const successRate = 0.7 + Math.random() * 0.28; // 70-98%
    const successCount = Math.floor(taskCount * successRate);

    const newAgent: AgentPerformance = {
      agentId,
      taskCount,
      successCount,
      failureCount: taskCount - successCount,
      avgResponseTimeMs: Math.floor(Math.random() * 3000) + 500,
      lastTaskTimestamp: Math.floor(Date.now() / 1000),
      platform: "unknown",
    };

    agentStore.set(agentId, newAgent);
    console.log(
      `[Mock API] Created new agent ${agentId.slice(0, 10)}... with ${taskCount} tasks, ${Math.floor(successRate * 10000)} bps`
    );

    return jsonResponse(res, 200, {
      taskCount: newAgent.taskCount,
      successCount: newAgent.successCount,
      failureCount: newAgent.failureCount,
      avgResponseTimeMs: newAgent.avgResponseTimeMs,
      lastTaskTimestamp: newAgent.lastTaskTimestamp,
    });
  }

  console.log(
    `[Mock API] Performance query for ${agentId.slice(0, 10)}...: ${agent.taskCount} tasks, ${Math.floor((agent.successCount / agent.taskCount) * 10000)} bps`
  );

  jsonResponse(res, 200, {
    taskCount: agent.taskCount,
    successCount: agent.successCount,
    failureCount: agent.failureCount,
    avgResponseTimeMs: agent.avgResponseTimeMs,
    lastTaskTimestamp: agent.lastTaskTimestamp,
  });
}

/**
 * POST /api/task-complete
 * Record a task completion for an agent.
 * Body: { agent_id, task_id, success, response_time_ms }
 */
async function handleTaskComplete(
  req: IncomingMessage,
  res: ServerResponse
) {
  const body = await parseBody(req);
  const { agent_id, task_id, success, response_time_ms } = body;

  if (!agent_id || task_id === undefined || success === undefined) {
    return jsonResponse(res, 400, {
      error: "MISSING_FIELDS",
      details: "Required: agent_id, task_id, success",
    });
  }

  let agent = agentStore.get(agent_id);

  if (!agent) {
    agent = {
      agentId: agent_id,
      taskCount: 0,
      successCount: 0,
      failureCount: 0,
      avgResponseTimeMs: 0,
      lastTaskTimestamp: 0,
      platform: "unknown",
    };
    agentStore.set(agent_id, agent);
  }

  // Update stats
  agent.taskCount++;
  if (success) {
    agent.successCount++;
  } else {
    agent.failureCount++;
  }

  const rt = response_time_ms || 1000;
  agent.avgResponseTimeMs = Math.floor(
    ((agent.avgResponseTimeMs * (agent.taskCount - 1)) + rt) / agent.taskCount
  );
  agent.lastTaskTimestamp = Math.floor(Date.now() / 1000);

  const rateBps = Math.floor(
    (agent.successCount / agent.taskCount) * 10000
  );

  console.log(
    `[Mock API] Task ${task_id} completed for ${agent_id.slice(0, 10)}...: ${success ? "SUCCESS" : "FAILURE"} (${agent.taskCount} total, ${rateBps} bps)`
  );

  jsonResponse(res, 200, {
    status: "RECORDED",
    agent_id,
    task_id,
    success,
    current_stats: {
      taskCount: agent.taskCount,
      successCount: agent.successCount,
      failureCount: agent.failureCount,
      successRate: rateBps,
      tier_eligibility: {
        STANDARD:
          agent.taskCount >= 10 && rateBps >= 7000
            ? "ELIGIBLE"
            : "NOT_ELIGIBLE",
        VERIFIED:
          agent.taskCount >= 100 && rateBps >= 9500
            ? "ELIGIBLE"
            : "NOT_ELIGIBLE",
      },
    },
  });
}

/**
 * GET /api/agents
 * List all tracked agents and their tier eligibility.
 */
function handleListAgents(res: ServerResponse) {
  const agents = Array.from(agentStore.values()).map((agent) => {
    const rateBps = Math.floor(
      (agent.successCount / agent.taskCount) * 10000
    );
    return {
      agentId: agent.agentId,
      platform: agent.platform,
      taskCount: agent.taskCount,
      successRate: rateBps,
      tier_eligibility: {
        STANDARD:
          agent.taskCount >= 10 && rateBps >= 7000
            ? "ELIGIBLE"
            : "NOT_ELIGIBLE",
        VERIFIED:
          agent.taskCount >= 100 && rateBps >= 9500
            ? "ELIGIBLE"
            : "NOT_ELIGIBLE",
      },
    };
  });

  jsonResponse(res, 200, { agents, count: agents.length });
}

// ─── Router ──────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const { pathname, params } = parseUrl(req.url || "/");

  try {
    // GET /api/performance
    if (req.method === "GET" && pathname === "/api/performance") {
      return handleGetPerformance(params, res);
    }

    // POST /api/task-complete
    if (req.method === "POST" && pathname === "/api/task-complete") {
      return await handleTaskComplete(req, res);
    }

    // GET /api/agents
    if (req.method === "GET" && pathname === "/api/agents") {
      return handleListAgents(res);
    }

    // GET /health
    if (req.method === "GET" && pathname === "/health") {
      return jsonResponse(res, 200, {
        status: "ok",
        service: "Mock Agent Performance API",
        description:
          "Simulates external agent platform API for CRE Confidential HTTP",
        agents_tracked: agentStore.size,
        timestamp: new Date().toISOString(),
      });
    }

    jsonResponse(res, 404, { error: "NOT_FOUND" });
  } catch (error: any) {
    console.error("[Mock API] Error:", error);
    jsonResponse(res, 500, {
      error: "INTERNAL_ERROR",
      details: error.message,
    });
  }
}

// ─── Server ──────────────────────────────────────────────────────

const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`\n📊 Mock Agent Performance API`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Simulates CRE Confidential HTTP target API\n`);
  console.log(`   Pre-seeded agents:`);
  for (const [id, agent] of agentStore) {
    const rate = Math.floor((agent.successCount / agent.taskCount) * 10000);
    const stdOk = agent.taskCount >= 10 && rate >= 7000;
    const verOk = agent.taskCount >= 100 && rate >= 9500;
    console.log(
      `     ${id.slice(0, 10)}... — ${agent.taskCount} tasks, ${rate} bps [${stdOk ? "STANDARD ✓" : "STANDARD ✗"} | ${verOk ? "VERIFIED ✓" : "VERIFIED ✗"}]`
    );
  }
  console.log(`\n   Endpoints:`);
  console.log(`     GET  /api/performance?agent_id=<id> — Get performance data`);
  console.log(`     POST /api/task-complete             — Record task completion`);
  console.log(`     GET  /api/agents                    — List all agents`);
  console.log(`     GET  /health                        — Health check\n`);
});

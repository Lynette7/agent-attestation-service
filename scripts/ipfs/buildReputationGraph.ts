/**
 * AAS Reputation Graph Builder
 *
 * Queries the live Sepolia AASRegistry and EAS contracts to build a
 * structured reputation graph from on-chain attestation + endorsement data.
 *
 * Graph structure:
 *   nodes: { [agentId]: ReputationNode }
 *   edges: Array<{ from, to, type, uid }>
 *   metrics: { totalAgents, totalAttestations, totalEndorsements }
 *
 * Output: data/reputation-graph.json
 *
 * Run: npx ts-node scripts/ipfs/buildReputationGraph.ts
 */

import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const REGISTRY_ADDRESS = process.env.AAS_REGISTRY_ADDRESS!;
const EAS_ADDRESS      = process.env.EAS_CONTRACT_ADDRESS!;
const RPC_URL          = process.env.SEPOLIA_RPC_URL!;

const provider = new ethers.JsonRpcProvider(RPC_URL);

// ─── ABIs ────────────────────────────────────────────────────────

const REGISTRY_ABI = [
  "event AttestationCreated(bytes32 indexed agentId, bytes32 indexed uid, uint64 taskThreshold, uint64 rateThresholdBps, string tier, uint64 expiresAt)",
  "event EndorsementCreated(bytes32 indexed endorserAgentId, bytes32 indexed endorsedAgentId, bytes32 indexed uid)",
  "function getAttestations(bytes32 agentId) view returns (bytes32[])",
  "function getAttestationMeta(bytes32 uid) view returns (uint8 tier, uint64 expiresAt, bool revoked)",
  "function isAttestationValid(bytes32 uid) view returns (bool)",
  "function getAttestationCount(bytes32 agentId) view returns (uint256)",
];

const EAS_ABI = [
  "function getAttestation(bytes32 uid) view returns (tuple(bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address attester, address recipient, bool revocable, bytes data))",
];

// ─── Types ───────────────────────────────────────────────────────

const TIER_NAMES: Record<number, string> = { 0: "NONE", 1: "STANDARD", 2: "VERIFIED" };

interface ReputationNode {
  agentId: string;
  currentTier: string;
  attestationCount: number;
  validAttestationUIDs: string[];
  attestationMeta: Array<{ uid: string; tier: string; expiresAt: number; revoked: boolean }>;
  endorsedBy: string[];
  endorses: string[];
  trustScore: number; // 0-100 normalised
  lastAttested: number; // unix timestamp
}

interface ReputationEdge {
  from: string;
  to: string;
  type: "ATTESTATION" | "ENDORSEMENT";
  uid: string;
  tier?: string;
  timestamp?: number;
}

interface ReputationGraph {
  version: "1.0";
  network: "sepolia";
  chainId: 11155111;
  registry: string;
  eas: string;
  builtAt: string;
  builtAtBlock: number;
  nodes: Record<string, ReputationNode>;
  edges: ReputationEdge[];
  metrics: {
    totalAgents: number;
    totalAttestations: number;
    totalEndorsements: number;
    tierBreakdown: Record<string, number>;
    avgTrustScore: number;
  };
}

// ─── PageRank-inspired trust scoring ─────────────────────────────

/**
 * Simplified trust score (0-100):
 *   - VERIFIED = 70 base
 *   - STANDARD = 40 base
 *   - +1 per endorser
 *   - +2 per VERIFIED endorser
 *   - capped at 100
 */
function computeTrustScore(
  node: Pick<ReputationNode, "currentTier" | "endorsedBy">,
  nodeMap: Record<string, Pick<ReputationNode, "currentTier">>
): number {
  let score = node.currentTier === "VERIFIED" ? 70 : node.currentTier === "STANDARD" ? 40 : 5;
  for (const endorserId of node.endorsedBy) {
    const endorser = nodeMap[endorserId];
    score += endorser?.currentTier === "VERIFIED" ? 2 : 1;
  }
  return Math.min(100, score);
}

// ─── Main ────────────────────────────────────────────────────────

async function buildReputationGraph(): Promise<void> {
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const eas = new ethers.Contract(EAS_ADDRESS, EAS_ABI, provider);

  const currentBlock = await provider.getBlockNumber();
  const deployBlock  = 10342928; // AASRegistry deployment block (from sepolia.json)

  console.log(`Building reputation graph from block ${deployBlock} → ${currentBlock}`);
  console.log(`Registry: ${REGISTRY_ADDRESS}`);

  // ── Step 1: Discover all attested agents via event logs ─────────────
  console.log("\n[1/4] Scanning AttestationCreated events...");

  const attestationFilter = registry.filters.AttestationCreated();
  const attestationLogs = await registry.queryFilter(attestationFilter, deployBlock, currentBlock);

  const agentIds = new Set<string>();
  const attestationEdges: ReputationEdge[] = [];

  for (const log of attestationLogs) {
    const e = log as ethers.EventLog;
    const agentId = e.args[0] as string;
    const uid     = e.args[1] as string;
    const tier    = e.args[4] as string; // string tier name (e.g. "STANDARD")
    const block   = await provider.getBlock(e.blockNumber);
    agentIds.add(agentId);
    attestationEdges.push({
      from: REGISTRY_ADDRESS.toLowerCase(),
      to: agentId,
      type: "ATTESTATION",
      uid,
      tier,
      timestamp: block?.timestamp ?? 0,
    });
  }

  console.log(`  Found ${attestationLogs.length} attestation events across ${agentIds.size} agent(s)`);

  // ── Step 2: Discover endorsements ────────────────────────────────────
  console.log("\n[2/4] Scanning EndorsementCreated events...");

  const endorsementFilter = registry.filters.EndorsementCreated();
  const endorsementLogs = await registry.queryFilter(endorsementFilter, deployBlock, currentBlock);
  const endorsementEdges: ReputationEdge[] = [];

  for (const log of endorsementLogs) {
    const e = log as ethers.EventLog;
    const endorserAgentId = e.args[0] as string;
    const endorsedAgentId = e.args[1] as string;
    const uid             = e.args[2] as string;
    agentIds.add(endorserAgentId);
    agentIds.add(endorsedAgentId);
    endorsementEdges.push({
      from: endorserAgentId,
      to: endorsedAgentId,
      type: "ENDORSEMENT",
      uid,
    });
  }

  console.log(`  Found ${endorsementLogs.length} endorsement event(s)`);

  // ── Step 3: Build nodes ───────────────────────────────────────────────
  console.log(`\n[3/4] Building ${agentIds.size} node(s)...`);

  const nodes: Record<string, ReputationNode> = {};

  for (const agentId of agentIds) {
    const attestations = await registry.getAttestations(agentId) as string[];
    const metaList: ReputationNode["attestationMeta"] = [];
    let bestTier = 0;
    let lastAttested = 0;
    const validUIDs: string[] = [];

    for (const uid of attestations) {
      const meta = await registry.getAttestationMeta(uid);
      const tier = Number(meta.tier);
      const expiresAt = Number(meta.expiresAt);
      const revoked = meta.revoked as boolean;

      const valid = await registry.isAttestationValid(uid);
      if (valid) {
        validUIDs.push(uid);
        if (tier > bestTier) bestTier = tier;
        // Find timestamp from edge data
        const edge = attestationEdges.find(e => e.uid === uid);
        if (edge?.timestamp && edge.timestamp > lastAttested) lastAttested = edge.timestamp;
      }

      metaList.push({ uid, tier: TIER_NAMES[tier], expiresAt, revoked });
    }

    const endorsedBy = endorsementEdges.filter(e => e.to === agentId).map(e => e.from);
    const endorses   = endorsementEdges.filter(e => e.from === agentId).map(e => e.to);

    nodes[agentId] = {
      agentId,
      currentTier: TIER_NAMES[bestTier],
      attestationCount: attestations.length,
      validAttestationUIDs: validUIDs,
      attestationMeta: metaList,
      endorsedBy,
      endorses,
      trustScore: 0, // computed below
      lastAttested,
    };
  }

  // ── Step 4: Compute trust scores ─────────────────────────────────────
  for (const node of Object.values(nodes)) {
    node.trustScore = computeTrustScore(node, nodes);
  }

  // ── Step 5: Build metrics ─────────────────────────────────────────────
  const tierBreakdown: Record<string, number> = { NONE: 0, STANDARD: 0, VERIFIED: 0 };
  let totalTrustScore = 0;
  for (const node of Object.values(nodes)) {
    tierBreakdown[node.currentTier] = (tierBreakdown[node.currentTier] ?? 0) + 1;
    totalTrustScore += node.trustScore;
  }
  const agentCount = Object.keys(nodes).length;

  // ── Step 6: Assemble graph ────────────────────────────────────────────
  const graph: ReputationGraph = {
    version: "1.0",
    network: "sepolia",
    chainId: 11155111,
    registry: REGISTRY_ADDRESS,
    eas: EAS_ADDRESS,
    builtAt: new Date().toISOString(),
    builtAtBlock: currentBlock,
    nodes,
    edges: [...attestationEdges, ...endorsementEdges],
    metrics: {
      totalAgents:       agentCount,
      totalAttestations: attestationLogs.length,
      totalEndorsements: endorsementLogs.length,
      tierBreakdown,
      avgTrustScore:     agentCount > 0 ? Math.round(totalTrustScore / agentCount) : 0,
    },
  };

  // ── Step 7: Write to disk ─────────────────────────────────────────────
  console.log("\n[4/4] Writing graph to disk...");
  const outDir  = path.resolve(__dirname, "../../data");
  const outPath = path.join(outDir, "reputation-graph.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(graph, null, 2));

  console.log(`\n✓ Reputation graph written to: data/reputation-graph.json`);
  console.log(`  Agents: ${graph.metrics.totalAgents}`);
  console.log(`  Attestations: ${graph.metrics.totalAttestations}`);
  console.log(`  Endorsements: ${graph.metrics.totalEndorsements}`);
  console.log(`  Tier breakdown: ${JSON.stringify(graph.metrics.tierBreakdown)}`);
  console.log(`  Avg trust score: ${graph.metrics.avgTrustScore}/100`);
  console.log(`\nNext: npx ts-node scripts/ipfs/pinReputationGraph.ts`);
}

buildReputationGraph().catch((e) => { console.error("Build failed:", e); process.exit(1); });

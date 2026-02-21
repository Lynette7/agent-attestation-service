/**
 * CRE Workflow C — Reputation Graph Update (Roadmap / Post-MVP)
 *
 * A planned CRE workflow using the official @chainlink/cre-sdk.
 * STATUS: Roadmap item — not included in MVP build.
 *
 * Trigger: EVM Log — listens for EAS AttestationMade events on-chain
 * Flow:
 *   1. EVM Log trigger fires when a new attestation is created
 *   2. Read attestation data from EAS and AASRegistry
 *   3. Fetch current reputation graph from IPFS via HTTP
 *   4. Compute updated graph metrics (PageRank, centrality)
 *   5. Upload updated graph to IPFS
 *   6. Write new IPFS CID to on-chain graph storage contract
 *
 * @see https://docs.chain.link/cre
 */

import {
  EVMClient,
  HTTPClient,
  handler,
  getNetwork,
  hexToBase64,
  encodeCallMsg,
  bytesToHex,
  LAST_FINALIZED_BLOCK_NUMBER,
  consensusIdenticalAggregation,
  Runner,
  type Runtime,
  type EVMLog,
} from "@chainlink/cre-sdk"
import {
  encodeFunctionData,
  decodeFunctionResult,
  parseAbi,
  parseAbiItem,
  keccak256,
  toHex,
  zeroAddress,
  type Address,
} from "viem"
import { z } from "zod"

// ─── Configuration ───────────────────────────────────────────────

const configSchema = z.object({
  registryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  easAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  graphStorageAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  chainSelectorName: z.string(),
})

type Config = z.infer<typeof configSchema>

// ─── Types ───────────────────────────────────────────────────────

interface ReputationNode {
  agentId: string
  attestationUIDs: string[]
  currentTier: "STANDARD" | "VERIFIED" | null
  endorsedBy: string[]
  endorses: string[]
  pageRankScore: number
  lastUpdated: number
}

interface ReputationGraph {
  nodes: Record<string, ReputationNode>
  edges: Array<{ from: string; to: string; type: string; uid: string }>
  lastUpdated: number
  ipfsCID: string
}

// ─── Contract ABIs ───────────────────────────────────────────────

const registryAbi = parseAbi([
  "function getAttestationMeta(bytes32 uid) view returns (uint8 tier, uint64 expiresAt, bool revoked)",
])

// EAS Attested event for EVM Log Trigger
// Compute the topic0 hash from the event signature rather than hardcoding
const _attestedEvent = parseAbiItem(
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaId)"
)
const ATTESTED_EVENT_TOPIC = keccak256(
  toHex("Attested(address,address,bytes32,bytes32)")
)

// ─── Workflow Callback (PLACEHOLDER) ─────────────────────────────

interface GraphUpdateResult {
  status: string
  message: string
  updatedNodes: number
}

const onNewAttestation = (
  runtime: Runtime<Config>,
  /* EVM Log Trigger payload contains the event data */
  logEvent: EVMLog
): GraphUpdateResult => {
  runtime.log("Reputation graph update triggered by EAS AttestationMade event")
  runtime.log("STATUS: This workflow is a roadmap item and is not yet fully implemented")

  // TODO: Post-MVP implementation steps:
  //
  // 1. Decode event log to extract attestation UID and agent ID
  //    const uid = bytesToHex(logEvent.topics[2]) as `0x${string}`
  //
  // 2. Read attestation metadata from AASRegistry
  //    const meta = evmClient.callContract(...)
  //
  // 3. Fetch current graph from IPFS
  //    const graph = http.sendRequest({ url: `https://ipfs.io/ipfs/${currentCID}` })
  //
  // 4. Update graph with new attestation data
  //    - Add/update node for the attested agent
  //    - Add edge from attester to recipient
  //    - Recompute PageRank scores
  //
  // 5. Upload updated graph to IPFS (via pinning service)
  //    const newCID = http.sendRequest({ url: "https://api.pinata.cloud/...", method: "POST", body: graph })
  //
  // 6. Write new CID to on-chain storage
  //    evmClient.writeReport(...) to update the graph CID on-chain

  return {
    status: "placeholder",
    message: "Reputation graph workflow is a post-MVP roadmap item",
    updatedNodes: 0,
  }
}

// ─── Workflow Initialization (uses EVM Log Trigger — roadmap) ────

const initWorkflow = (config: Config) => {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: true,
  })

  if (!network) {
    throw new Error(`Network not found: ${config.chainSelectorName}`)
  }

  const evmClient = new EVMClient(network.chainSelector.selector)

  // EVM Log Trigger: listens for EAS Attested events
  // Uses the official logTrigger pattern with addresses + hexToBase64
  // This is the planned trigger configuration for post-MVP
  return [
    handler(
      evmClient.logTrigger({
        addresses: [hexToBase64(config.easAddress)],
        // Optionally filter by topic0 (Attested event signature):
        // topics: [ATTESTED_EVENT_TOPIC],
      }),
      onNewAttestation
    ),
  ]
}

// ─── Entry Point ─────────────────────────────────────────────────

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}

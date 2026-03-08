/**
 * CRE Workflow A — Attestation Issuance (Two-Tier System)
 *
 * A production-grade CRE workflow using the official @chainlink/cre-sdk.
 *
 * Trigger: HTTP — receives attestation requests from external systems
 * Flow:
 *   1. Parse HTTP trigger payload (agent_id, tier)
 *   2. Fetch performance data via Confidential HTTP (privacy-preserving)
 *   3. Validate tier eligibility (STANDARD: 10 tasks/70%, VERIFIED: 100 tasks/95%)
 *   4. Generate signed report with attestation data
 *   5. Submit attestation on-chain via EVM Write (AASRegistry)
 *
 * @see https://docs.chain.link/cre
 */

import {
  HTTPCapability,
  ConfidentialHTTPClient,
  EVMClient,
  handler,
  getNetwork,
  hexToBase64,
  bytesToHex,
  TxStatus,
  decodeJson,
  ok,
  json,
  Runner,
  type Runtime,
  type HTTPPayload, sendErrorResponse,
} from "@chainlink/cre-sdk"
import {
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  parseAbi,
  type Address,
} from "viem"
import { z } from "zod"

// ─── Configuration ───────────────────────────────────────────────

const configSchema = z.object({
  registryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  zkVerifierAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  performanceApiUrl: z.string().url(),
  chainSelectorName: z.string(),
  gasLimit: z.string(),
})

type Config = z.infer<typeof configSchema>

// ─── Constants ───────────────────────────────────────────────────

const TIER_THRESHOLDS = {
  STANDARD: { tasks: 10, rateBps: 7000 },
  VERIFIED: { tasks: 100, rateBps: 9500 },
} as const

type AttestationTier = "STANDARD" | "VERIFIED"
const TIER_NUMERIC: Record<AttestationTier, number> = { STANDARD: 1, VERIFIED: 2 }

// 90 days in seconds for VERIFIED tier expiry
const VERIFIED_EXPIRY_SECONDS = 90 * 24 * 60 * 60

// ─── Contract ABIs (viem format) ─────────────────────────────────

const registryAbi = parseAbi([
  "function createCapabilityAttestation(bytes32 agentId, uint64 taskThreshold, uint64 rateThresholdBps, bytes zkProof, bytes32[] publicInputs, uint8 tier) returns (bytes32 uid)",
])

// ─── Types ───────────────────────────────────────────────────────

type AttestationRequest = {
  agent_id: string
  tier: AttestationTier
}

type PerformanceData = {
  taskCount: number
  successCount: number
  failureCount: number
  avgResponseTimeMs: number
  lastTaskTimestamp: number
}

type AttestationResult = {
  success: boolean
  attestation_uid?: string
  tx_hash?: string
  tier?: string
  error?: string
}

// ─── Step 2: Check Tier Eligibility ──────────────────────────────

function checkEligibility(
  data: PerformanceData,
  tier: AttestationTier
): { eligible: boolean; actualRateBps: number } {
  const thresholds = TIER_THRESHOLDS[tier]
  const actualRateBps = Math.floor((data.successCount / data.taskCount) * 10000)

  const eligible =
    data.taskCount >= thresholds.tasks && actualRateBps >= thresholds.rateBps

  return { eligible, actualRateBps }
}

// ─── Step 3: Generate Attestation Data & Write On-Chain ──────────

const onAttestationRequest = (
  runtime: Runtime<Config>,
  payload: HTTPPayload
): AttestationResult => {
  // Parse the incoming HTTP trigger payload
  const request = decodeJson(payload.input) as AttestationRequest
  runtime.log(`Attestation request: agent=${request.agent_id.slice(0, 10)}..., tier=${request.tier}`)

  // Validate tier
  if (request.tier !== "STANDARD" && request.tier !== "VERIFIED") {
    return { success: false, error: `Invalid tier: ${request.tier}` }
  }

  // Step 1: Fetch performance data via Confidential HTTP
  //
  // Uses CRE's ConfidentialHTTPClient to fetch agent performance data
  // in a privacy-preserving manner. The request runs inside the TEE
  // (Trusted Execution Environment) of the Confidential Compute DON.
  // The raw performance data (task counts, success rates) never leaves
  // the enclave — only the ZK proof of meeting thresholds is published.
  //
  // In simulation: calls the mock performance API directly.
  // In production: runs inside TEE with Vault DON secrets for API auth.
  runtime.log("Fetching performance data via Confidential HTTP...")
  const confHTTPClient = new ConfidentialHTTPClient()
  const confResponse = confHTTPClient
    .sendRequest(runtime, {
      request: {
        url: `${runtime.config.performanceApiUrl}?agent_id=${request.agent_id}`,
        method: "GET",
        multiHeaders: {
          Authorization: { values: ["Bearer {{.PLATFORM_API_KEY}}"] },
        },
      },
      // In production, this secret is injected by the Vault DON
      // The mock API doesn't require auth, so this is a no-op in simulation
      vaultDonSecrets: [{ key: "PLATFORM_API_KEY" }],
    })
    .result()

  let perfData: PerformanceData
  if (!ok(confResponse)) {
    // Return a "zero" result on failure rather than throwing.
    // In a DON with N nodes, some may experience transient network errors.
    // Returning a sentinel value (taskCount: 0) lets consensus proceed —
    // if a majority succeed, the eligibility check below catches it.
    perfData = {
      taskCount: 0,
      successCount: 0,
      failureCount: 0,
      avgResponseTimeMs: 0,
      lastTaskTimestamp: 0,
    }
  } else {
    perfData = json(confResponse) as PerformanceData
  }

  runtime.log(
    `Performance: ${perfData.taskCount} tasks, ${perfData.successCount} successes`
  )

  // Step 2: Check eligibility
  const { eligible, actualRateBps } = checkEligibility(perfData, request.tier)

  if (!eligible) {
    const thresholds = TIER_THRESHOLDS[request.tier]
    runtime.log(
      `Not eligible for ${request.tier}: tasks=${perfData.taskCount}/${thresholds.tasks}, rate=${actualRateBps}/${thresholds.rateBps}`
    )
    return {
      success: false,
      error: `Threshold not met for ${request.tier}`,
    }
  }

  runtime.log(`Eligible for ${request.tier} tier`)

  // Step 3: Prepare attestation data for on-chain submission
  const thresholds = TIER_THRESHOLDS[request.tier]
  const tierNumeric = TIER_NUMERIC[request.tier]

  // Encode the createCapabilityAttestation function call
  //
  // Note: In the MVP, we use a mock ZK proof for simulation purposes.
  // In production, the ZK proof would be generated off-chain by a dedicated
  // Noir prover service (either running in a TEE or as a separate microservice),
  // then passed to this workflow as part of the trigger payload.
  //
  // The proof generation is NOT part of the CRE workflow because:
  // 1. Noir/Barretenberg proving is compute-intensive (~2-3 seconds)
  // 2. CRE workflows should be fast and deterministic
  // 3. Proof generation doesn't benefit from DON consensus (it's deterministic)
  //
  // Architecture: Agent Platform API → Prover Service → CRE Workflow
  const mockProofBytes = "0x" + "00".repeat(128) as `0x${string}`
  const publicInputs = [
    ("0x" + BigInt(thresholds.tasks).toString(16).padStart(64, "0")) as `0x${string}`,
    ("0x" + BigInt(thresholds.rateBps).toString(16).padStart(64, "0")) as `0x${string}`,
    ("0x" + "0".repeat(64)) as `0x${string}`,
  ]

  const callData = encodeFunctionData({
    abi: registryAbi,
    functionName: "createCapabilityAttestation",
    args: [
      request.agent_id as `0x${string}`,
      BigInt(thresholds.tasks),
      BigInt(thresholds.rateBps),
      mockProofBytes,
      publicInputs,
      tierNumeric,
    ],
  })

  // Step 4: Generate a signed report and write on-chain
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: true,
  })

  if (!network) {
    return { success: false, error: `Network not found: ${runtime.config.chainSelectorName}` }
  }

  const evmClient = new EVMClient(network.chainSelector.selector)

  // Generate cryptographically signed report via CRE consensus
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(callData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result()

  runtime.log("Signed report generated, submitting on-chain...")

  // Submit the signed report to the AASRegistry contract
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.registryAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: runtime.config.gasLimit,
      },
    })
    .result()

  if (writeResult.txStatus === TxStatus.SUCCESS) {
    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32))
    runtime.log(`${request.tier} attestation submitted! TX: ${txHash}`)

    return {
      success: true,
      tx_hash: txHash,
      tier: request.tier,
    }
  }

  return {
    success: false,
    error: `Transaction failed with status: ${writeResult.txStatus}`,
  }
}

// ─── Workflow Initialization ─────────────────────────────────────

const initWorkflow = (config: Config) => {
  const http = new HTTPCapability()

  return [
    handler(
      // HTTP Trigger: receives attestation requests from external systems
      //
      // In simulation: empty config is valid (per CRE docs). The CLI will
      // reject deployments with HTTP triggers that lack authorization.
      //
      // In production: uncomment and configure authorizedKeys:
      //   authorizedKeys: [
      //     { type: "KEY_TYPE_ECDSA_EVM", publicKey: config.authorizedEVMAddress },
      //   ],
      http.trigger({}),
      onAttestationRequest
    ),
  ]
}

// ─── Entry Point ─────────────────────────────────────────────────

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}

main().catch(sendErrorResponse)

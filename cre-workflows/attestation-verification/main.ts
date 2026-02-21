/**
 * CRE Workflow B — Attestation Verification (Two-Tier System)
 *
 * A production-grade CRE workflow using the official @chainlink/cre-sdk.
 *
 * Trigger: HTTP — receives verification requests from agents or systems
 * Flow:
 *   1. Parse HTTP trigger payload (agent_id, min_tier, max_age_days)
 *   2. Read attestations from AASRegistry via EVM Read
 *   3. Filter by tier, expiry, revocation status
 *   4. Read attestation data from EAS via EVM Read
 *   5. Verify ZK proof on-chain via AASZKVerifier
 *   6. Return structured trust verdict
 *
 * Use cases:
 *   - Agent B wants to verify Agent A before accepting a delegated task
 *   - Smart contract needs to gate access based on attestation tier
 *   - Dashboard verifies an agent's current trust status
 *
 * @see https://docs.chain.link/cre
 */

import {
  HTTPCapability,
  EVMClient,
  handler,
  getNetwork,
  encodeCallMsg,
  bytesToHex,
  LAST_FINALIZED_BLOCK_NUMBER,
  decodeJson,
  Runner,
  type Runtime,
  type HTTPPayload,
} from "@chainlink/cre-sdk"
import {
  encodeFunctionData,
  decodeFunctionResult,
  decodeAbiParameters,
  parseAbi,
  parseAbiParameters,
  zeroAddress,
  type Address,
} from "viem"
import { z } from "zod"

// ─── Configuration ───────────────────────────────────────────────

const configSchema = z.object({
  registryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  easAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  zkVerifierAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  chainSelectorName: z.string(),
})

type Config = z.infer<typeof configSchema>

// ─── Constants ───────────────────────────────────────────────────

type AttestationTier = "STANDARD" | "VERIFIED"
const TIER_NUMERIC: Record<AttestationTier, number> = { STANDARD: 1, VERIFIED: 2 }

// ─── Contract ABIs (viem format) ─────────────────────────────────

const registryAbi = parseAbi([
  "function getAttestations(bytes32 agentId) view returns (bytes32[])",
  "function getAttestationMeta(bytes32 uid) view returns (uint8 tier, uint64 expiresAt, bool revoked)",
  "function isAttestationValid(bytes32 uid) view returns (bool)",
])

const easAbi = parseAbi([
  "function getAttestation(bytes32 uid) view returns ((bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address attester, address recipient, bool revocable, bytes data))",
])

const zkVerifierAbi = parseAbi([
  "function verifyCapabilityProof(bytes proof, bytes32[] publicInputs) view returns (bool)",
])

// ─── Types ───────────────────────────────────────────────────────

type VerificationRequest = {
  agent_id: string
  min_tier?: AttestationTier
  max_age_days?: number
  include_expired?: boolean
}

type VerificationResult = {
  verified: boolean
  tier: string
  attestation_uid: string
  task_threshold: number
  rate_bps: number
  issued_at: number
  expires_at: number
  proof_valid: boolean
}

// ─── Workflow Callback ───────────────────────────────────────────

const onVerificationRequest = (
  runtime: Runtime<Config>,
  payload: HTTPPayload
): VerificationResult => {
  // Parse the incoming HTTP trigger payload
  const request = decodeJson(payload.input) as VerificationRequest
  runtime.log(
    `Verification request: agent=${request.agent_id.slice(0, 10)}..., ` +
    `min_tier=${request.min_tier || "ANY"}, max_age=${request.max_age_days || "∞"} days`
  )

  const nullResult: VerificationResult = {
    verified: false,
    tier: "",
    attestation_uid: "",
    task_threshold: 0,
    rate_bps: 0,
    issued_at: 0,
    expires_at: 0,
    proof_valid: false,
  }

  // Set up EVM client
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: true,
  })

  if (!network) {
    runtime.log(`Network not found: ${runtime.config.chainSelectorName}`)
    return nullResult
  }

  const evmClient = new EVMClient(network.chainSelector.selector)

  // ─── Step 1: Query attestations from AASRegistry ───────────────

  runtime.log("Querying attestations from AASRegistry...")

  const getAttestationsCallData = encodeFunctionData({
    abi: registryAbi,
    functionName: "getAttestations",
    args: [request.agent_id as `0x${string}`],
  })

  const attestationsResult = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: runtime.config.registryAddress as Address,
        data: getAttestationsCallData,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result()

  const attestationUids = decodeFunctionResult({
    abi: registryAbi,
    functionName: "getAttestations",
    data: bytesToHex(attestationsResult.data),
  }) as readonly `0x${string}`[]

  runtime.log(`Found ${attestationUids.length} attestation(s)`)

  if (attestationUids.length === 0) {
    return nullResult
  }

  // ─── Step 2: Fetch metadata and filter attestations ────────────

  const now = Math.floor(Date.now() / 1000)
  const validAttestations: Array<{
    uid: `0x${string}`
    tier: number
    expiresAt: number
  }> = []

  for (const uid of attestationUids) {
    const metaCallData = encodeFunctionData({
      abi: registryAbi,
      functionName: "getAttestationMeta",
      args: [uid],
    })

    const metaResult = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: runtime.config.registryAddress as Address,
          data: metaCallData,
        }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    const [tier, expiresAt, revoked] = decodeFunctionResult({
      abi: registryAbi,
      functionName: "getAttestationMeta",
      data: bytesToHex(metaResult.data),
    }) as [number, bigint, boolean]

    // Filter: skip revoked
    if (revoked) {
      runtime.log(`Skipping revoked attestation ${uid.slice(0, 10)}...`)
      continue
    }

    // Filter: skip expired (unless include_expired)
    const expiresAtNum = Number(expiresAt)
    if (!request.include_expired && expiresAtNum > 0 && now > expiresAtNum) {
      runtime.log(`Skipping expired attestation ${uid.slice(0, 10)}...`)
      continue
    }

    // Filter: minimum tier
    if (request.min_tier) {
      const requiredTier = TIER_NUMERIC[request.min_tier]
      if (tier < requiredTier) {
        runtime.log(`Skipping tier ${tier} attestation (requires ${request.min_tier})`)
        continue
      }
    }

    validAttestations.push({ uid, tier, expiresAt: expiresAtNum })
  }

  if (validAttestations.length === 0) {
    runtime.log("No attestations match the requested criteria")
    return nullResult
  }

  // Sort by tier (highest first)
  validAttestations.sort((a, b) => b.tier - a.tier)

  // ─── Step 3: Read attestation data from EAS ────────────────────

  const best = validAttestations[0]
  const tierName: AttestationTier = best.tier === 2 ? "VERIFIED" : "STANDARD"
  runtime.log(`Checking ${tierName} attestation ${best.uid.slice(0, 10)}...`)

  const getAttestationCallData = encodeFunctionData({
    abi: easAbi,
    functionName: "getAttestation",
    args: [best.uid],
  })

  const easResult = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: runtime.config.easAddress as Address,
        data: getAttestationCallData,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result()

  const attestation = decodeFunctionResult({
    abi: easAbi,
    functionName: "getAttestation",
    data: bytesToHex(easResult.data),
  }) as {
    uid: `0x${string}`
    schema: `0x${string}`
    time: bigint
    expirationTime: bigint
    revocationTime: bigint
    refUID: `0x${string}`
    attester: Address
    recipient: Address
    revocable: boolean
    data: `0x${string}`
  }

  const issuedAt = Number(attestation.time)

  // Check recency
  if (request.max_age_days) {
    const maxAge = request.max_age_days * 86400
    if (now - issuedAt > maxAge) {
      runtime.log(`Attestation too old: ${Math.floor((now - issuedAt) / 86400)} days`)
      return nullResult
    }
  }

  // ─── Step 4: Decode attestation data & verify ZK proof ─────────

  runtime.log("Decoding attestation data and verifying ZK proof...")

  // Decode the ABI-encoded attestation data from EAS
  // Schema: abi.encode(agentId, taskThreshold, rateThresholdBps, zkProof, publicInputs, issuedAt, expiresAt)
  const decodedData = decodeAbiParameters(
    parseAbiParameters("bytes32, uint64, uint64, bytes, bytes32[], uint64, uint64"),
    attestation.data
  ) as readonly [`0x${string}`, bigint, bigint, `0x${string}`, readonly `0x${string}`[], bigint, bigint]

  const [, taskThreshold, rateThresholdBps, zkProof, publicInputs] = decodedData

  // Check on-chain validity (expiry + revocation) via AASRegistry
  const validCallData = encodeFunctionData({
    abi: registryAbi,
    functionName: "isAttestationValid",
    args: [best.uid],
  })

  const validResult = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: runtime.config.registryAddress as Address,
        data: validCallData,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result()

  const registryValid = decodeFunctionResult({
    abi: registryAbi,
    functionName: "isAttestationValid",
    data: bytesToHex(validResult.data),
  }) as boolean

  // Additionally verify ZK proof directly via AASZKVerifier
  let zkProofValid = false
  if (zkProof && zkProof.length > 2) {
    const zkCallData = encodeFunctionData({
      abi: zkVerifierAbi,
      functionName: "verifyCapabilityProof",
      args: [zkProof, publicInputs as `0x${string}`[]],
    })

    const zkResult = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: runtime.config.zkVerifierAddress as Address,
          data: zkCallData,
        }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    zkProofValid = decodeFunctionResult({
      abi: zkVerifierAbi,
      functionName: "verifyCapabilityProof",
      data: bytesToHex(zkResult.data),
    }) as boolean
  }

  const isValid = registryValid && zkProofValid

  // ─── Return verification verdict ──────────────────────────────

  const result: VerificationResult = {
    verified: isValid,
    tier: tierName,
    attestation_uid: best.uid,
    task_threshold: Number(taskThreshold),
    rate_bps: Number(rateThresholdBps),
    issued_at: issuedAt,
    expires_at: best.expiresAt,
    proof_valid: zkProofValid,
  }

  runtime.log(
    `Verification verdict: ${isValid ? "TRUSTED" : "UNTRUSTED"} (${tierName})` +
    ` | tasks≥${taskThreshold} rate≥${rateThresholdBps}bps zkProof=${zkProofValid}`
  )
  return result
}

// ─── Workflow Initialization ─────────────────────────────────────

const initWorkflow = (config: Config) => {
  const http = new HTTPCapability()

  return [
    handler(
      // HTTP Trigger: receives verification requests
      //
      // In simulation: empty config is valid (per CRE docs). The CLI will
      // reject deployments with HTTP triggers that lack authorization.
      //
      // In production: uncomment and configure authorizedKeys:
      //   authorizedKeys: [
      //     { type: "KEY_TYPE_ECDSA_EVM", publicKey: config.authorizedEVMAddress },
      //   ],
      http.trigger({}),
      onVerificationRequest
    ),
  ]
}

// ─── Entry Point ─────────────────────────────────────────────────

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}

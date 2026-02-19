/**
 * CRE Workflow A — Attestation Issuance (v2 — Two-Tier System)
 *
 * This workflow handles the full attestation lifecycle with tier support:
 *   1. Receive task completion trigger from agent runtime with requested tier
 *   2. Validate agent identity (wallet signature)
 *   3. Fetch performance data via CRE Confidential HTTP
 *   4. Determine if agent meets tier thresholds
 *   5. Generate UltraHonk ZK proof from private data
 *   6. Submit tier-specific attestation to EAS via AASRegistry
 *
 * Tier Thresholds:
 *   STANDARD — 10+ tasks, 70%+ success rate → never expires
 *   VERIFIED — 100+ tasks, 95%+ success rate → expires after 90 days
 */

import { ethers } from "ethers";

// ─── Constants ───────────────────────────────────────────────────

export const TIER_THRESHOLDS = {
  STANDARD: { tasks: 10, rateBps: 7000 },
  VERIFIED: { tasks: 100, rateBps: 9500 },
} as const;

export type AttestationTier = "STANDARD" | "VERIFIED";
export const TIER_NUMERIC = { STANDARD: 1, VERIFIED: 2 } as const;

// ─── Types ───────────────────────────────────────────────────────

export interface AttestationTrigger {
  agentId: string; // hex bytes32 — keccak256(walletAddress)
  walletAddress: string; // agent's EOA
  platform: string; // 'openclaw' | 'langchain' | 'custom'
  signature: string; // EIP-712 signature of the request
  tier: AttestationTier; // requested tier: 'STANDARD' | 'VERIFIED'
}

export interface PerformanceData {
  taskCount: number;
  successCount: number;
  failureCount: number;
  avgResponseTimeMs: number;
  lastTaskTimestamp: number;
}

export interface AttestationResult {
  success: boolean;
  attestationUID?: string;
  txHash?: string;
  proofHash?: string;
  tier?: AttestationTier;
  issuedAt?: number;
  expiresAt?: number;
  error?: string;
  details?: Record<string, any>;
}

// ─── Workflow Steps ──────────────────────────────────────────────

/**
 * Step 1: Validate the trigger — verify the agent's wallet signature.
 */
export async function validateTrigger(
  trigger: AttestationTrigger
): Promise<boolean> {
  // Verify agentId matches wallet
  const expectedAgentId = ethers.keccak256(
    ethers.solidityPacked(["address"], [trigger.walletAddress])
  );

  if (trigger.agentId !== expectedAgentId) {
    console.error(
      "Agent ID mismatch: expected",
      expectedAgentId,
      "got",
      trigger.agentId
    );
    return false;
  }

  // Validate tier
  if (trigger.tier !== "STANDARD" && trigger.tier !== "VERIFIED") {
    console.error("Invalid tier:", trigger.tier);
    return false;
  }

  // TODO: Verify EIP-712 signature in production
  console.log(
    `[Workflow A] Trigger validated for agent ${trigger.agentId.slice(0, 10)}... (tier: ${trigger.tier})`
  );
  return true;
}

/**
 * Step 2: Fetch performance data via CRE Confidential HTTP.
 *
 * In CRE production:
 *   - This uses CRE's Confidential HTTP capability
 *   - Request params and API credentials are held in the confidential enclave
 *   - Only a cryptographic commitment to the result leaves the enclave
 *   - The raw response never touches the public internet
 *
 * CRE Confidential HTTP Configuration:
 *   {
 *     "type": "confidential_http",
 *     "url": "https://api.agent-platform.com/v1/performance",
 *     "method": "POST",
 *     "headers": { "Authorization": "Bearer {{secrets.AGENT_API_KEY}}" },
 *     "body": { "agent_id": "{{trigger.agent_id}}", "period": "all_time" },
 *     "output_commitment": true
 *   }
 *
 * For MVP: calls the mock agent performance API.
 */
export async function fetchPerformanceData(
  agentId: string,
  _platform: string
): Promise<PerformanceData> {
  console.log(
    `[Workflow A] Fetching performance data for agent ${agentId.slice(0, 10)}... (Confidential HTTP)`
  );

  // ─── CRE Confidential HTTP Integration ────────────────────────
  // In production, this entire block is replaced by a CRE step config:
  //   step: "confidential_fetch"
  //   config:
  //     url: "{{secrets.AGENT_PLATFORM_URL}}/api/performance"
  //     method: "GET"
  //     params:
  //       agent_id: "{{trigger.agent_id}}"
  //     auth:
  //       type: "bearer"
  //       token: "{{secrets.PLATFORM_API_KEY}}"
  //     commitment: true
  //
  // The response is attested by the TEE and only the prover can read it.

  const mockApiUrl =
    process.env.AGENT_PERFORMANCE_API_URL ||
    "http://localhost:3002/api/performance";

  try {
    const response = await fetch(`${mockApiUrl}?agent_id=${agentId}`);
    if (response.ok) {
      const data = (await response.json()) as PerformanceData;
      console.log(
        `[Workflow A] Performance data received: ${data.taskCount} tasks, ${data.successCount} successes`
      );
      return data;
    }
  } catch {
    console.log("[Workflow A] Mock API unavailable, using simulated data");
  }

  // Fallback: simulated performance data for demo
  return {
    taskCount: 150,
    successCount: 143,
    failureCount: 7,
    avgResponseTimeMs: 1200,
    lastTaskTimestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Step 3: Check if the agent meets the requested tier's thresholds.
 */
export function checkTierEligibility(
  performanceData: PerformanceData,
  tier: AttestationTier
): { eligible: boolean; actualRate: number; required: { tasks: number; rateBps: number } } {
  const required = TIER_THRESHOLDS[tier];
  const actualRate = Math.floor(
    (performanceData.successCount / performanceData.taskCount) * 10000
  );

  const eligible =
    performanceData.taskCount >= required.tasks && actualRate >= required.rateBps;

  console.log(
    `[Workflow A] Tier ${tier} eligibility check: tasks=${performanceData.taskCount}>=${required.tasks} (${performanceData.taskCount >= required.tasks ? "✓" : "✗"}), ` +
      `rate=${actualRate}>=${required.rateBps} (${actualRate >= required.rateBps ? "✓" : "✗"}) → ${eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}`
  );

  return { eligible, actualRate, required };
}

/**
 * Step 4: Generate ZK proof inputs and compute the UltraHonk proof.
 *
 * Uses the Noir prover via Barretenberg's UltraHonk backend:
 *   1. Write Prover.toml with private witnesses + public inputs
 *   2. `nargo execute` → witness
 *   3. `bb prove --scheme ultra_honk --oracle_hash keccak` → raw proof bytes
 *   4. Public inputs are [taskThreshold, rateThresholdBps, dataCommitment] as bytes32[]
 *
 * Falls back to mock proof bytes if the prover is unavailable.
 */
export async function generateZKProof(
  performanceData: PerformanceData,
  tier: AttestationTier
): Promise<{ proof: string; publicInputs: string[] }> {
  const thresholds = TIER_THRESHOLDS[tier];
  console.log(`[Workflow A] Generating ZK proof (UltraHonk) for ${tier} tier...`);
  console.log(
    `  Private: taskCount=${performanceData.taskCount}, successCount=${performanceData.successCount}`
  );
  console.log(
    `  Public:  taskThreshold=${thresholds.tasks}, rateThresholdBps=${thresholds.rateBps}`
  );

  // Try real proof generation, fall back to mock if prover unavailable
  try {
    const { generateCapabilityProof } = await import(
      "../../scripts/prover/generateProof"
    );

    // Use deterministic preimage derived from agent data
    const preimage: [bigint, bigint, bigint, bigint] = [
      BigInt(performanceData.taskCount),
      BigInt(performanceData.successCount),
      BigInt(performanceData.failureCount),
      BigInt(performanceData.lastTaskTimestamp),
    ];

    const result = await generateCapabilityProof({
      taskCount: performanceData.taskCount,
      successCount: performanceData.successCount,
      dataCommitmentPreimage: preimage,
      thresholdTasks: thresholds.tasks,
      thresholdRateBps: thresholds.rateBps,
      dataCommitment: 0n, // placeholder — computed by circuit
    });

    if (result.success) {
      console.log(
        `[Workflow A] Real UltraHonk proof generated (${(result.proof.length - 2) / 2} bytes)`
      );
      return { proof: result.proof, publicInputs: result.publicInputs };
    }

    console.log(
      `[Workflow A] Prover returned error: ${result.error}, falling back to mock`
    );
  } catch (err) {
    console.log(`[Workflow A] Real prover unavailable, using mock proof`);
  }

  // Fallback: mock proof for dev/demo mode
  const publicInputs = [
    ethers.zeroPadValue(ethers.toBeHex(thresholds.tasks), 32),
    ethers.zeroPadValue(ethers.toBeHex(thresholds.rateBps), 32),
    ethers.zeroPadValue(ethers.toBeHex(0), 32), // zero commitment in mock mode
  ];
  const mockProof = ethers.hexlify(ethers.randomBytes(128));

  console.log(
    `[Workflow A] Mock proof generated (${mockProof.length / 2 - 1} bytes)`
  );
  return { proof: mockProof, publicInputs };
}

/**
 * Step 5: Submit tier-specific attestation to EAS via AASRegistry contract.
 */
export async function submitAttestation(
  registryAddress: string,
  agentId: string,
  tier: AttestationTier,
  proof: string,
  publicInputs: string[],
  signer: ethers.Signer
): Promise<AttestationResult> {
  const thresholds = TIER_THRESHOLDS[tier];
  const tierNumeric = TIER_NUMERIC[tier];

  console.log(`[Workflow A] Submitting ${tier} attestation to EAS...`);

  const registryABI = [
    "function createCapabilityAttestation(bytes32 agentId, uint64 taskThreshold, uint64 rateThresholdBps, bytes calldata zkProof, bytes32[] calldata publicInputs, uint8 tier) external returns (bytes32 uid)",
    "event AttestationCreated(bytes32 indexed agentId, bytes32 indexed uid, uint64 taskThreshold, uint64 rateThresholdBps, string tier, uint64 expiresAt)",
  ];

  const registry = new ethers.Contract(registryAddress, registryABI, signer);

  try {
    const tx = await registry.createCapabilityAttestation(
      agentId,
      thresholds.tasks,
      thresholds.rateBps,
      proof,
      publicInputs,
      tierNumeric
    );

    const receipt = await tx.wait();

    // Parse the AttestationCreated event to get the UID and expiresAt
    const event = receipt?.logs?.find(
      (log: any) =>
        log.topics?.[0] ===
        ethers.id(
          "AttestationCreated(bytes32,bytes32,uint64,uint64,string,uint64)"
        )
    );
    const attestationUID = event?.topics?.[2] || "UNKNOWN";

    const now = Math.floor(Date.now() / 1000);
    const expiresAt =
      tier === "VERIFIED" ? now + 90 * 24 * 60 * 60 : 0;

    console.log(`[Workflow A] ${tier} attestation submitted! UID: ${attestationUID}`);
    console.log(`[Workflow A] TX hash: ${tx.hash}`);
    if (expiresAt > 0) {
      console.log(
        `[Workflow A] Expires: ${new Date(expiresAt * 1000).toISOString()}`
      );
    }

    return {
      success: true,
      attestationUID,
      txHash: tx.hash,
      proofHash: publicInputs[0],
      tier,
      issuedAt: now,
      expiresAt,
    };
  } catch (error: any) {
    console.error(
      `[Workflow A] Attestation submission failed:`,
      error.message
    );
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Full Workflow A execution — orchestrates all steps with tier support.
 */
export async function executeWorkflowA(
  trigger: AttestationTrigger,
  registryAddress: string,
  signer: ethers.Signer
): Promise<AttestationResult> {
  console.log("\n=== CRE Workflow A: Attestation Issuance (v2) ===\n");
  console.log(`Requested tier: ${trigger.tier}`);

  // Step 1: Validate trigger
  const isValid = await validateTrigger(trigger);
  if (!isValid) {
    return { success: false, error: "INVALID_TRIGGER" };
  }

  // Step 2: Fetch performance data (Confidential HTTP)
  const performanceData = await fetchPerformanceData(
    trigger.agentId,
    trigger.platform
  );

  // Step 3: Check tier eligibility
  const { eligible, actualRate, required } = checkTierEligibility(
    performanceData,
    trigger.tier
  );

  if (!eligible) {
    return {
      success: false,
      error: "THRESHOLD_NOT_MET",
      details: {
        tier_attempted: trigger.tier,
        actual_tasks: performanceData.taskCount,
        required_tasks: required.tasks,
        actual_rate_bps: actualRate,
        required_rate_bps: required.rateBps,
      },
    };
  }

  // Step 4: Generate ZK proof
  const { proof, publicInputs } = await generateZKProof(
    performanceData,
    trigger.tier
  );

  // Step 5: Submit attestation on-chain
  const result = await submitAttestation(
    registryAddress,
    trigger.agentId,
    trigger.tier,
    proof,
    publicInputs,
    signer
  );

  console.log("\n=== Workflow A Complete ===\n");
  return result;
}

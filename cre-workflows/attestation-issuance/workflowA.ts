/**
 * CRE Workflow A — Attestation Issuance
 *
 * This workflow handles the full attestation lifecycle:
 *   1. Receive task completion trigger from agent runtime
 *   2. Validate agent identity (wallet signature)
 *   3. Fetch performance data via Confidential HTTP
 *   4. Generate ZK proof from private data
 *   5. Submit attestation to EAS via AASRegistry
 *
 */

import { ethers } from "ethers";

// ─── Types ───────────────────────────────────────────────────────

export interface AttestationTrigger {
  agentId: string;          // hex bytes32 — keccak256(walletAddress)
  walletAddress: string;    // agent's EOA
  platform: string;         // 'openclaw' | 'langchain' | 'custom'
  signature: string;        // EIP-712 signature of the request
  taskThreshold: number;    // requested minimum task count
  rateThresholdBps: number; // requested minimum success rate (bps)
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
  issuedAt?: number;
  error?: string;
}

// ─── Workflow Steps ──────────────────────────────────────────────

/**
 * Step 1: Validate the trigger — verify the agent's wallet signature.
 */
export async function validateTrigger(trigger: AttestationTrigger): Promise<boolean> {
  // Verify agentId matches wallet
  const expectedAgentId = ethers.keccak256(
    ethers.solidityPacked(["address"], [trigger.walletAddress])
  );

  if (trigger.agentId !== expectedAgentId) {
    console.error("Agent ID mismatch: expected", expectedAgentId, "got", trigger.agentId);
    return false;
  }

  // TODO: Verify EIP-712 signature in production
  // For MVP, we trust the signed HTTP trigger
  console.log(`[Workflow A] Trigger validated for agent ${trigger.agentId.slice(0, 10)}...`);
  return true;
}

/**
 * Step 2: Fetch performance data via Confidential HTTP.
 *
 * In CRE production:
 *   - This uses CRE's Confidential HTTP capability
 *   - Request params and API credentials are kept in the confidential enclave
 *   - Only a cryptographic commitment to the result leaves the enclave
 *
 * For MVP: calls a mock agent performance API.
 */
export async function fetchPerformanceData(
  agentId: string,
  _platform: string
): Promise<PerformanceData> {
  console.log(`[Workflow A] Fetching performance data for agent ${agentId.slice(0, 10)}...`);

  // ─── CRE Confidential HTTP Simulation ──────────────────────
  // In production, this would be:
  // {
  //   "type": "confidential_http",
  //   "url": "https://api.agent-platform.com/v1/performance",
  //   "method": "POST",
  //   "headers": { "Authorization": "Bearer {{secrets.AGENT_API_KEY}}" },
  //   "body": { "agent_id": "{{trigger.agent_id}}", "period": "all_time" },
  //   "output_commitment": true
  // }

  // MVP: Call mock API or return simulated data
  const mockApiUrl = process.env.AGENT_PERFORMANCE_API_URL || "http://localhost:3002/api/performance";

  try {
    const response = await fetch(`${mockApiUrl}?agent_id=${agentId}`);
    if (response.ok) {
      return (await response.json()) as PerformanceData;
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
 * Step 3: Generate ZK proof inputs and compute the proof.
 *
 * Uses the Noir prover via Barretenberg's UltraHonk backend:
 *   1. Write Prover.toml with private witnesses + public inputs
 *   2. `nargo execute` → witness
 *   3. `bb prove --scheme ultra_honk` → raw proof bytes
 *   4. Public inputs are [taskThreshold, rateThresholdBps, dataCommitment] as bytes32[]
 *
 * Falls back to mock proof bytes if the prover is unavailable.
 */
export async function generateZKProof(
  performanceData: PerformanceData,
  taskThreshold: number,
  rateThresholdBps: number
): Promise<{ proof: string; publicInputs: string[]; meetsThreshold: boolean }> {
  console.log(`[Workflow A] Generating ZK proof (UltraHonk)...`);
  console.log(`  Private: taskCount=${performanceData.taskCount}, successCount=${performanceData.successCount}`);
  console.log(`  Public:  taskThreshold=${taskThreshold}, rateThresholdBps=${rateThresholdBps}`);

  // Check if agent meets thresholds
  const actualRate = Math.floor(
    (performanceData.successCount / performanceData.taskCount) * 10000
  );
  const meetsThreshold =
    performanceData.taskCount >= taskThreshold && actualRate >= rateThresholdBps;

  if (!meetsThreshold) {
    console.log(`[Workflow A] Agent does not meet thresholds (actual rate: ${actualRate} bps)`);
    return {
      proof: "0x",
      publicInputs: [],
      meetsThreshold: false,
    };
  }

  // Try real proof generation, fall back to mock if prover unavailable
  try {
    const { generateCapabilityProof } = await import("../../scripts/prover/generateProof");

    // Use deterministic preimage derived from agent data for reproducibility
    const preimage: [bigint, bigint, bigint, bigint] = [
      BigInt(performanceData.taskCount),
      BigInt(performanceData.successCount),
      BigInt(performanceData.failureCount),
      BigInt(performanceData.lastTaskTimestamp),
    ];

    // Compute data commitment (poseidon2 hash happens inside the circuit)
    // For the public input, we need to pass the expected commitment value.
    // In production, this would be computed off-chain with a poseidon2 lib.
    // For now, let nargo execute compute it — the commitment is a circuit output.
    const result = await generateCapabilityProof({
      taskCount: performanceData.taskCount,
      successCount: performanceData.successCount,
      dataCommitmentPreimage: preimage,
      thresholdTasks: taskThreshold,
      thresholdRateBps: rateThresholdBps,
      dataCommitment: 0n, // placeholder — computed by circuit
    });

    if (result.success) {
      console.log(`[Workflow A] Real UltraHonk proof generated (${(result.proof.length - 2) / 2} bytes)`);
      return { proof: result.proof, publicInputs: result.publicInputs, meetsThreshold: true };
    }

    console.log(`[Workflow A] Prover returned error: ${result.error}, falling back to mock`);
  } catch (err) {
    console.log(`[Workflow A] Real prover unavailable, using mock proof`);
  }

  // Fallback: mock proof for dev/demo mode
  const publicInputs = [
    ethers.zeroPadValue(ethers.toBeHex(taskThreshold), 32),
    ethers.zeroPadValue(ethers.toBeHex(rateThresholdBps), 32),
    ethers.zeroPadValue(ethers.toBeHex(0), 32), // zero commitment in mock mode
  ];
  const mockProof = ethers.hexlify(ethers.randomBytes(128));

  console.log(`[Workflow A] Mock proof generated (${mockProof.length / 2 - 1} bytes)`);
  return { proof: mockProof, publicInputs, meetsThreshold: true };
}

/**
 * Step 4: Submit attestation to EAS via AASRegistry contract.
 */
export async function submitAttestation(
  registryAddress: string,
  agentId: string,
  taskThreshold: number,
  rateThresholdBps: number,
  proof: string,
  publicInputs: string[],
  signer: ethers.Signer
): Promise<AttestationResult> {
  console.log(`[Workflow A] Submitting attestation to EAS...`);

  const registryABI = [
    "function createCapabilityAttestation(bytes32 agentId, uint64 taskThreshold, uint64 rateThresholdBps, bytes calldata zkProof, bytes32[] calldata publicInputs) external returns (bytes32 uid)",
    "event AttestationCreated(bytes32 indexed agentId, bytes32 indexed uid, uint64 taskThreshold, uint64 rateThresholdBps)",
  ];

  const registry = new ethers.Contract(registryAddress, registryABI, signer);

  try {
    const tx = await registry.createCapabilityAttestation(
      agentId,
      taskThreshold,
      rateThresholdBps,
      proof,
      publicInputs
    );

    const receipt = await tx.wait();

    // Parse the AttestationCreated event to get the UID
    const event = receipt?.logs?.find(
      (log: any) => log.topics?.[0] === ethers.id("AttestationCreated(bytes32,bytes32,uint64,uint64)")
    );
    const attestationUID = event?.topics?.[2] || "UNKNOWN";

    console.log(`[Workflow A] Attestation submitted! UID: ${attestationUID}`);
    console.log(`[Workflow A] TX hash: ${tx.hash}`);

    return {
      success: true,
      attestationUID,
      txHash: tx.hash,
      proofHash: publicInputs[0],
      issuedAt: Math.floor(Date.now() / 1000),
    };
  } catch (error: any) {
    console.error(`[Workflow A] Attestation submission failed:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Full Workflow A execution — orchestrates all steps.
 */
export async function executeWorkflowA(
  trigger: AttestationTrigger,
  registryAddress: string,
  signer: ethers.Signer
): Promise<AttestationResult> {
  console.log("\n=== CRE Workflow A: Attestation Issuance ===\n");

  // Step 1: Validate trigger
  const isValid = await validateTrigger(trigger);
  if (!isValid) {
    return { success: false, error: "INVALID_TRIGGER" };
  }

  // Step 2: Fetch performance data (Confidential HTTP)
  const performanceData = await fetchPerformanceData(trigger.agentId, trigger.platform);

  // Step 3: Generate ZK proof
  const { proof, publicInputs, meetsThreshold } = await generateZKProof(
    performanceData,
    trigger.taskThreshold,
    trigger.rateThresholdBps
  );

  if (!meetsThreshold) {
    return { success: false, error: "THRESHOLD_NOT_MET" };
  }

  // Step 4: Submit attestation on-chain
  const result = await submitAttestation(
    registryAddress,
    trigger.agentId,
    trigger.taskThreshold,
    trigger.rateThresholdBps,
    proof,
    publicInputs,
    signer
  );

  console.log("\n=== Workflow A Complete ===\n");
  return result;
}

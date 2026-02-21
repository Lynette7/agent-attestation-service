/**
 * CRE Workflow B — Attestation Verification (v2 — Two-Tier System)
 *
 * This workflow enables agent-to-agent trust verification with tier filtering:
 *   1. Receive verification request (agent_id + optional tier filter)
 *   2. Query AASRegistry for the agent's attestations
 *   3. Fetch attestation metadata (tier, expiry, revocation status)
 *   4. Filter by requested tier, recency, and expiry
 *   5. Verify ZK proof on-chain via AASZKVerifier
 *   6. Return structured trust verdict with tier information
 *
 * Verification Rules:
 *   - STANDARD attestations never expire
 *   - VERIFIED attestations expire after 90 days (must check expiresAt)
 *   - Revoked attestations are always rejected
 *   - If min_tier=VERIFIED, only VERIFIED attestations are accepted
 *   - If min_tier not specified, any valid attestation is accepted
 */

import { ethers } from "ethers";
import { AttestationTier, TIER_NUMERIC } from "../attestation-issuance/workflowA";

// ─── Types ───────────────────────────────────────────────────────

export interface VerificationRequest {
  agentId: string; // hex bytes32
  minTier?: AttestationTier; // optional: 'STANDARD' | 'VERIFIED'
  maxAttestationAgeDays?: number; // optional recency filter
  includeExpired?: boolean; // optional: include expired attestations
}

export interface VerificationResponse {
  verified: boolean;
  tier: AttestationTier | null;
  attestationUID: string | null;
  taskThreshold: number;
  rateBps: number;
  issuedAt: number;
  expiresAt: number; // 0 for STANDARD (never expires)
  proofValid: boolean;
}

// ─── Workflow Steps ──────────────────────────────────────────────

/**
 * Step 1: Query AASRegistry for agent attestations and their metadata.
 */
export async function queryAttestationsWithMeta(
  registryAddress: string,
  agentId: string,
  provider: ethers.Provider
): Promise<Array<{ uid: string; tier: number; expiresAt: number; revoked: boolean }>> {
  console.log(
    `[Workflow B] Querying attestations for agent ${agentId.slice(0, 10)}...`
  );

  const registryABI = [
    "function getAttestations(bytes32 agentId) external view returns (bytes32[] memory)",
    "function getAttestationMeta(bytes32 uid) external view returns (uint8 tier, uint64 expiresAt, bool revoked)",
    "function isAttestationValid(bytes32 uid) external view returns (bool)",
  ];

  const registry = new ethers.Contract(registryAddress, registryABI, provider);
  const uids: string[] = await registry.getAttestations(agentId);

  console.log(`[Workflow B] Found ${uids.length} attestation(s)`);

  // Fetch metadata for each attestation
  const results: Array<{ uid: string; tier: number; expiresAt: number; revoked: boolean }> = [];
  for (const uid of uids) {
    const meta = await registry.getAttestationMeta(uid);
    results.push({
      uid,
      tier: Number(meta.tier),
      expiresAt: Number(meta.expiresAt),
      revoked: meta.revoked,
    });
  }

  return results;
}

/**
 * Step 2: Filter attestations by tier, expiry, revocation, and recency.
 */
export function filterAttestations(
  attestations: Array<{ uid: string; tier: number; expiresAt: number; revoked: boolean }>,
  request: VerificationRequest
): Array<{ uid: string; tier: number; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);

  return attestations.filter((att) => {
    // 1. Skip revoked attestations (always)
    if (att.revoked) {
      console.log(`[Workflow B] Skipping revoked attestation ${att.uid.slice(0, 10)}...`);
      return false;
    }

    // 2. Check expiry (unless includeExpired is set)
    if (!request.includeExpired && att.expiresAt > 0 && now > att.expiresAt) {
      console.log(
        `[Workflow B] Skipping expired attestation ${att.uid.slice(0, 10)}... (expired ${new Date(att.expiresAt * 1000).toISOString()})`
      );
      return false;
    }

    // 3. Filter by minimum tier
    if (request.minTier) {
      const requiredTierNum = TIER_NUMERIC[request.minTier];
      if (att.tier < requiredTierNum) {
        console.log(
          `[Workflow B] Skipping tier ${att.tier} attestation (requires ${request.minTier}=${requiredTierNum})`
        );
        return false;
      }
    }

    return true;
  });
}

/**
 * Step 3: Fetch attestation data from EAS and verify thresholds.
 */
export async function fetchAttestationData(
  easAddress: string,
  uid: string,
  request: VerificationRequest,
  provider: ethers.Provider
): Promise<{
  taskThreshold: number;
  rateBps: number;
  issuedAt: number;
  data: string;
} | null> {
  const easABI = [
    "function getAttestation(bytes32 uid) external view returns (tuple(bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address attester, address recipient, bool revocable, bytes data))",
  ];

  const eas = new ethers.Contract(easAddress, easABI, provider);

  try {
    const attestation = await eas.getAttestation(uid);

    // Decode the attestation data (v2 schema with issuedAt + expiresAt)
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ["bytes32", "uint64", "uint64", "bytes", "bytes32[]", "uint64", "uint64"],
      attestation.data
    );

    const taskThreshold = Number(decoded[1]);
    const rateBps = Number(decoded[2]);
    const issuedAt = Number(decoded[5]) || Number(attestation.time);

    // Check recency if requested
    if (request.maxAttestationAgeDays) {
      const maxAge = request.maxAttestationAgeDays * 86400;
      const now = Math.floor(Date.now() / 1000);
      if (now - issuedAt > maxAge) {
        console.log(
          `[Workflow B] Attestation ${uid.slice(0, 10)}... too old (${Math.floor((now - issuedAt) / 86400)} days > ${request.maxAttestationAgeDays} days)`
        );
        return null;
      }
    }

    return {
      taskThreshold,
      rateBps,
      issuedAt,
      data: attestation.data,
    };
  } catch (error) {
    console.log(
      `[Workflow B] Error reading attestation ${uid.slice(0, 10)}:`,
      error
    );
    return null;
  }
}

/**
 * Step 4: Verify ZK proof on-chain via AASZKVerifier (UltraHonk).
 */
export async function verifyProofOnChain(
  zkVerifierAddress: string,
  attestationData: string,
  provider: ethers.Provider
): Promise<boolean> {
  console.log(`[Workflow B] Verifying ZK proof on-chain (UltraHonk)...`);

  const verifierABI = [
    "function verifyCapabilityProof(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool)",
  ];

  const verifier = new ethers.Contract(
    zkVerifierAddress,
    verifierABI,
    provider
  );

  try {
    // Decode proof and public inputs from attestation data (v2 schema)
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ["bytes32", "uint64", "uint64", "bytes", "bytes32[]", "uint64", "uint64"],
      attestationData
    );

    const proofBytes = decoded[3]; // raw UltraHonk proof bytes
    const publicInputs = decoded[4]; // bytes32[] public inputs

    const result = await verifier.verifyCapabilityProof(
      proofBytes,
      publicInputs
    );

    console.log(`[Workflow B] Proof verification result: ${result}`);
    return result;
  } catch (error) {
    console.error(`[Workflow B] Proof verification failed:`, error);
    return false;
  }
}

/**
 * Full Workflow B execution — orchestrates verification with tier support.
 */
export async function executeWorkflowB(
  request: VerificationRequest,
  registryAddress: string,
  easAddress: string,
  zkVerifierAddress: string,
  provider: ethers.Provider
): Promise<VerificationResponse> {
  console.log("\n=== CRE Workflow B: Attestation Verification (v2) ===\n");
  console.log(
    `Agent: ${request.agentId.slice(0, 10)}..., Min tier: ${request.minTier || "ANY"}, Max age: ${request.maxAttestationAgeDays || "∞"} days`
  );

  const nullResponse: VerificationResponse = {
    verified: false,
    tier: null,
    attestationUID: null,
    taskThreshold: 0,
    rateBps: 0,
    issuedAt: 0,
    expiresAt: 0,
    proofValid: false,
  };

  // Step 1: Query attestations with metadata
  const attestations = await queryAttestationsWithMeta(
    registryAddress,
    request.agentId,
    provider
  );

  if (attestations.length === 0) {
    console.log("[Workflow B] No attestations found");
    return nullResponse;
  }

  // Step 2: Filter attestations by tier, expiry, revocation
  const validAttestations = filterAttestations(attestations, request);

  if (validAttestations.length === 0) {
    console.log(
      "[Workflow B] No attestations match the requested criteria"
    );
    return nullResponse;
  }

  // Sort by tier (highest first), then by most recent
  validAttestations.sort((a, b) => {
    if (b.tier !== a.tier) return b.tier - a.tier;
    return b.expiresAt - a.expiresAt; // most recent first
  });

  // Step 3: Try each valid attestation until one passes full verification
  for (const att of validAttestations) {
    const tierName: AttestationTier =
      att.tier === 2 ? "VERIFIED" : "STANDARD";

    console.log(
      `[Workflow B] Checking ${tierName} attestation ${att.uid.slice(0, 10)}...`
    );

    const data = await fetchAttestationData(
      easAddress,
      att.uid,
      request,
      provider
    );

    if (!data) continue;

    // Step 4: Verify ZK proof on-chain
    const proofValid = await verifyProofOnChain(
      zkVerifierAddress,
      data.data,
      provider
    );

    const response: VerificationResponse = {
      verified: true,
      tier: tierName,
      attestationUID: att.uid,
      taskThreshold: data.taskThreshold,
      rateBps: data.rateBps,
      issuedAt: data.issuedAt,
      expiresAt: att.expiresAt,
      proofValid,
    };

    console.log(`[Workflow B] Verification result:`, response);
    console.log("\n=== Workflow B Complete ===\n");
    return response;
  }

  console.log("[Workflow B] No attestations passed full verification");
  return nullResponse;
}

/**
 * AAS API Client — connects frontend to the AAS backend server.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ─── Types ───────────────────────────────────────────────────────

export type TierName = "STANDARD" | "VERIFIED";

export interface AttestationResult {
  attestation_uid: string;
  tier: TierName;
  task_threshold: number;
  rate_threshold_bps: number;
  issued_at: string;
  expires_at: string;
  tx_hash: string;
}

export interface VerifyResult {
  verified: boolean;
  tier: TierName | null;
  attestation_uid: string | null;
  task_threshold: number;
  rate_bps: number;
  issued_at: number;
  expires_at: number;
  is_expired: boolean;
  is_revoked: boolean;
  proof_valid: boolean;
}

export interface ReputationResult {
  agent_id: string;
  total_attestations: number;
  standard_count: number;
  verified_count: number;
  endorsement_count: number;
  revoked_count: number;
  attestations: {
    uid: string;
    tier: number;
    task_threshold: number;
    rate_bps: number;
    issued_at: number;
    expires_at: number;
    revoked: boolean;
  }[];
}

export interface HealthResult {
  status: string;
  blockchain: boolean;
  registry: string;
  signer: string;
  chain_id: number;
}

export interface EndorsementResult {
  endorsement_uid: string;
  tx_hash: string;
}

export interface RevokeResult {
  revoked: boolean;
  tx_hash: string;
}

export interface RegisterResult {
  agent_id: string;
  tx_hash: string;
}

// ─── API Functions ───────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `API error ${res.status}`);
  }
  return data as T;
}

/** POST /api/v1/attest — trigger full attestation flow */
export async function requestAttestation(
  agentId: string,
  tier: TierName
): Promise<AttestationResult> {
  return apiFetch<AttestationResult>("/api/v1/attest", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, tier }),
  });
}

/** GET /api/v1/verify/:agentId — verify agent attestation */
export async function verifyAgent(
  agentId: string,
  options?: {
    min_tier?: TierName;
    max_age_days?: number;
    include_expired?: boolean;
  }
): Promise<VerifyResult> {
  const params = new URLSearchParams();
  if (options?.min_tier) params.set("min_tier", options.min_tier);
  if (options?.max_age_days)
    params.set("max_age_days", String(options.max_age_days));
  if (options?.include_expired) params.set("include_expired", "true");
  const qs = params.toString();
  return apiFetch<VerifyResult>(
    `/api/v1/verify/${agentId}${qs ? `?${qs}` : ""}`
  );
}

/** GET /api/v1/reputation/:agentId — get reputation graph */
export async function getReputation(
  agentId: string
): Promise<ReputationResult> {
  return apiFetch<ReputationResult>(`/api/v1/reputation/${agentId}`);
}

/** POST /api/v1/endorse — submit endorsement */
export async function submitEndorsement(
  endorserAgentId: string,
  endorsedAgentId: string,
  endorsementType: string,
  context: string
): Promise<EndorsementResult> {
  return apiFetch<EndorsementResult>("/api/v1/endorse", {
    method: "POST",
    body: JSON.stringify({
      endorser_agent_id: endorserAgentId,
      endorsed_agent_id: endorsedAgentId,
      endorsement_type: endorsementType,
      context,
    }),
  });
}

/** POST /api/v1/revoke — revoke attestation */
export async function revokeAttestation(
  agentId: string,
  attestationUid: string,
  reason: string
): Promise<RevokeResult> {
  return apiFetch<RevokeResult>("/api/v1/revoke", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agentId,
      attestation_uid: attestationUid,
      reason,
    }),
  });
}

/** POST /api/v1/register — register agent */
export async function registerAgent(
  walletAddress: string
): Promise<RegisterResult> {
  return apiFetch<RegisterResult>("/api/v1/register", {
    method: "POST",
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
}

/** GET /api/v1/health — health check */
export async function healthCheck(): Promise<HealthResult> {
  return apiFetch<HealthResult>("/api/v1/health");
}

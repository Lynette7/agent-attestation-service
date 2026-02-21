"use client";

import { useState } from "react";
import { verifyAgent, getReputation, type VerifyResult, type ReputationResult, type TierName } from "@/lib/api";
import { AttestationCard } from "@/components/ui/AttestationCard";
import { TierBadge } from "@/components/ui/TierBadge";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { shortenHex } from "@/lib/utils";

export default function VerifyPage() {
  const [agentId, setAgentId] = useState("");
  const [minTier, setMinTier] = useState<TierName | "">("");
  const [maxAgeDays, setMaxAgeDays] = useState("");
  const [includeExpired, setIncludeExpired] = useState(false);

  const [loading, setLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [reputation, setReputation] = useState<ReputationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    if (!agentId.trim()) return;
    setLoading(true);
    setError(null);
    setVerifyResult(null);
    setReputation(null);

    try {
      const [vResult, rResult] = await Promise.all([
        verifyAgent(agentId, {
          min_tier: minTier || undefined,
          max_age_days: maxAgeDays ? parseInt(maxAgeDays) : undefined,
          include_expired: includeExpired || undefined,
        }),
        getReputation(agentId).catch(() => null),
      ]);
      setVerifyResult(vResult);
      setReputation(rResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  // Pre-seeded demo agents from mock API
  const DEMO_AGENTS = [
    {
      id: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      label: "Demo Agent (STANDARD eligible)",
    },
    {
      id: "0x1111111111111111111111111111111111111111111111111111111111111111",
      label: "High-performer (VERIFIED eligible)",
    },
    {
      id: "0x2222222222222222222222222222222222222222222222222222222222222222",
      label: "New agent (not eligible)",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Verify Agent</h1>
        <p className="text-gray-400">
          Look up an agent&apos;s on-chain attestations, check tier status, and
          verify ZK proofs.
        </p>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#111118] p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Agent ID (bytes32 hex)</label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="0xabcdef1234567890..."
            className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 font-mono"
          />
        </div>

        {/* Quick select demo agents */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Quick select:</p>
          <div className="flex flex-wrap gap-2">
            {DEMO_AGENTS.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setAgentId(agent.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-gray-700"
              >
                {agent.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Min Tier</label>
            <select
              value={minTier}
              onChange={(e) => setMinTier(e.target.value as TierName | "")}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="">Any</option>
              <option value="STANDARD">STANDARD</option>
              <option value="VERIFIED">VERIFIED</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-500">Max Age (days)</label>
            <input
              type="number"
              value={maxAgeDays}
              onChange={(e) => setMaxAgeDays(e.target.value)}
              placeholder="No limit"
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-500">Include Expired</label>
            <label className="flex items-center gap-2 h-[38px]">
              <input
                type="checkbox"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-sm text-gray-400">Show expired</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || !agentId.trim()}
          className="w-full py-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-medium hover:bg-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Verifying..." : "Verify Agent"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Querying on-chain attestations..." />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {verifyResult && (
        <div className="space-y-6">
          {/* Verification Verdict */}
          <div
            className={`rounded-xl border p-6 ${
              verifyResult.verified
                ? "border-green-500/20 bg-green-500/5 glow-green"
                : "border-red-500/20 bg-red-500/5"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  verifyResult.verified ? "bg-green-500/20" : "bg-red-500/20"
                }`}
              >
                {verifyResult.verified ? (
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {verifyResult.verified ? "Verified" : "Not Verified"}
                </h3>
                <p className="text-sm text-gray-400">
                  Agent {shortenHex(agentId)}
                </p>
              </div>
              {verifyResult.tier && <TierBadge tier={verifyResult.tier} size="lg" />}
            </div>
          </div>

          {/* Attestation Detail */}
          {verifyResult.attestation_uid && verifyResult.tier && (
            <AttestationCard
              uid={verifyResult.attestation_uid}
              tier={verifyResult.tier}
              taskThreshold={verifyResult.task_threshold}
              rateBps={verifyResult.rate_bps}
              issuedAt={verifyResult.issued_at}
              expiresAt={verifyResult.expires_at}
              revoked={verifyResult.is_revoked}
            />
          )}

          {/* Reputation Summary */}
          {reputation && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">
                Reputation Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Total"
                  value={reputation.total_attestations}
                  color="gray"
                />
                <StatCard
                  label="Standard"
                  value={reputation.standard_count}
                  color="blue"
                />
                <StatCard
                  label="Verified"
                  value={reputation.verified_count}
                  color="amber"
                />
                <StatCard
                  label="Revoked"
                  value={reputation.revoked_count}
                  color="red"
                />
              </div>

              {/* All Attestations */}
              {reputation.attestations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm text-gray-400 font-medium">
                    All Attestations
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reputation.attestations.map((att) => (
                      <AttestationCard
                        key={att.uid}
                        uid={att.uid}
                        tier={att.tier}
                        taskThreshold={att.task_threshold}
                        rateBps={att.rate_bps}
                        issuedAt={att.issued_at}
                        expiresAt={att.expires_at}
                        revoked={att.revoked}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

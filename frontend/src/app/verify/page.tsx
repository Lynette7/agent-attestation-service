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

  const DEMO_AGENTS = [
    {
      id: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      label: "Demo Agent (STANDARD)",
    },
    {
      id: "0x1111111111111111111111111111111111111111111111111111111111111111",
      label: "High-performer (VERIFIED)",
    },
    {
      id: "0x2222222222222222222222222222222222222222222222222222222222222222",
      label: "New agent (not eligible)",
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 xl:space-y-10 px-4 lg:px-0">
      <div className="space-y-1.5">
        <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight">
          Verify Agent
        </h1>
        <p className="text-[15px] md:text-base text-muted leading-relaxed">
          Look up an agent&apos;s on-chain attestations, check tier status, and
          verify ZK proofs.
        </p>
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-card-border bg-card card-shadow p-6 md:p-7 space-y-5 md:space-y-6">
        <div className="space-y-2">
          <label className="text-[11px] md:text-xs font-semibold text-muted uppercase tracking-wider">
            Agent ID (bytes32 hex)
          </label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="0xabcdef1234567890…"
            className="input-base w-full border rounded-lg px-4 py-2.5 text-sm md:text-[15px] font-mono focus:ring-2 focus:ring-cl-blue/20 transition-all"
          />
        </div>

        {/* Quick select demo agents */}
        <div className="space-y-2">
          <p className="text-[11px] md:text-xs font-semibold text-muted uppercase tracking-wider">
            Quick select:
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_AGENTS.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setAgentId(agent.id)}
                className="text-[11px] md:text-xs px-3 py-1.5 rounded-lg bg-card-hover text-muted hover:text-foreground hover:bg-[#0C1824] border border-card-border hover:border-input-border transition-all"
              >
                {agent.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] md:text-xs font-semibold text-muted uppercase tracking-wider">
              Min Tier
            </label>
            <select
              value={minTier}
              onChange={(e) => setMinTier(e.target.value as TierName | "")}
              className="input-base w-full border rounded-lg px-3 py-2 text-sm md:text-[15px] focus:ring-2 focus:ring-cl-blue/20 transition-all"
            >
              <option value="">Any</option>
              <option value="STANDARD">STANDARD</option>
              <option value="VERIFIED">VERIFIED</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] md:text-xs font-semibold text-muted uppercase tracking-wider">
              Max Age (days)
            </label>
            <input
              type="number"
              value={maxAgeDays}
              onChange={(e) => setMaxAgeDays(e.target.value)}
              placeholder="No limit"
              className="input-base w-full border rounded-lg px-3 py-2 text-sm md:text-[15px] focus:ring-2 focus:ring-cl-blue/20 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] md:text-xs font-semibold text-muted uppercase tracking-wider">
              Include Expired
            </label>
            <label className="flex items-center gap-2 h-[38px] cursor-pointer">
              <input
                type="checkbox"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
                className="rounded border-input-border accent-cl-blue w-4 h-4"
              />
              <span className="text-sm md:text-[15px] text-muted">Show expired</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || !agentId.trim()}
          className="w-full py-3 rounded-lg bg-[#00C2FF] text-[#021019] font-semibold text-sm md:text-[15px] tracking-wide hover:bg-[#22D1FF] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Verifying…" : "Verify Agent"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Querying on-chain attestations…" />
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
            className={`rounded-xl border p-6 card-shadow ${
              verifyResult.verified
                ? "border-cl-green/20 bg-cl-green/5 glow-green"
                : "border-red-500/20 bg-red-500/5"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                  verifyResult.verified ? "bg-cl-green/15" : "bg-red-500/15"
                }`}
              >
                {verifyResult.verified ? (
                  <svg className="w-5 h-5 text-cl-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground">
                  {verifyResult.verified ? "Verified" : "Not Verified"}
                </h3>
                <p className="text-xs text-muted font-mono">
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
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Reputation Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total" value={reputation.total_attestations} color="gray" />
                <StatCard label="Standard" value={reputation.standard_count} color="blue" />
                <StatCard label="Verified" value={reputation.verified_count} color="amber" />
                <StatCard label="Revoked" value={reputation.revoked_count} color="red" />
              </div>

              {reputation.attestations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
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

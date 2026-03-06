"use client";

import { useState } from "react";
import { requestAttestation, type AttestationResult, type TierName } from "@/lib/api";
import { TierBadge } from "@/components/ui/TierBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { TIER_CONFIG } from "@/lib/constants";
import { shortenHex } from "@/lib/utils";

type AttestStep = {
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
};

export default function AttestPage() {
  const [agentId, setAgentId] = useState(
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  );
  const [tier, setTier] = useState<TierName>("STANDARD");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AttestationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<AttestStep[]>([]);

  async function handleAttest() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSteps([
      { label: "Fetching performance data", status: "active" },
      { label: "Checking eligibility", status: "pending" },
      { label: "Generating ZK proof", status: "pending" },
      { label: "Submitting on-chain", status: "pending" },
    ]);

    const stepTimers = [800, 1500, 2500];
    for (let i = 0; i < stepTimers.length; i++) {
      await new Promise((r) => setTimeout(r, stepTimers[i]));
      setSteps((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx <= i ? "done" : idx === i + 1 ? "active" : "pending",
        }))
      );
    }

    try {
      const res = await requestAttestation(agentId, tier);
      setResult(res);
      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Attestation failed";
      setError(msg);
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "active" ? { ...s, status: "error" as const, detail: msg } : s
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 xl:space-y-10 px-4 lg:px-0">
      <div className="space-y-1.5">
        <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight">
          Request Attestation
        </h1>
        <p className="text-[15px] md:text-base text-muted leading-relaxed">
          Trigger the full attestation flow: fetch performance data, check eligibility,
          generate ZK proof, and submit on-chain.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-card-border bg-card card-shadow p-6 md:p-7 space-y-6 md:space-y-7">
        <div className="space-y-2">
          <label className="text-[11px] md:text-xs font-semibold text-muted uppercase tracking-wider">
            Agent ID (bytes32 hex)
          </label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="0x..."
            className="input-base w-full border rounded-lg px-4 py-2.5 text-sm md:text-[15px] font-mono focus:ring-2 focus:ring-cl-blue/20 transition-all"
          />
        </div>

        {/* Tier Selection */}
        <div className="space-y-3">
          <label className="text-[11px] md:text-xs font-semibold text-muted uppercase tracking-wider">
            Select Tier
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(["STANDARD", "VERIFIED"] as const).map((t) => {
              const config = TIER_CONFIG[t];
              const selected = tier === t;
              return (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`rounded-xl border p-4 md:p-5 text-left transition-all ${
                    selected
                      ? "border-[#00727F] bg-card text-foreground"
                      : "border-card-border bg-card text-muted"
                  } dark:hover:border-[#00727F] dark:hover:bg-[#0C1824] dark:hover:text-[#ECF6FF]`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TierBadge tier={t} size="sm" />
                    {selected && (
                      <svg className="w-4 h-4 text-cl-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs md:text-[13px] text-muted mt-1">
                    {config.taskThreshold}+ tasks, {config.rateThreshold}%+ success
                  </p>
                  <p className="text-[10px] md:text-[11px] text-muted/70 mt-0.5">
                    {config.expiryLabel}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleAttest}
          disabled={loading || !agentId.trim()}
          className="w-full py-3 rounded-lg font-semibold text-sm md:text-[15px] tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-[#00727F] text-white hover:bg-[#008A99] dark:bg-[#00C2FF] dark:text-[#021019] dark:hover:bg-[#22D1FF]"
        >
          {loading ? "Processing…" : `Request ${tier} Attestation`}
        </button>
      </div>

      {/* Progress Steps */}
      {steps.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card card-shadow p-6 space-y-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Attestation Pipeline
          </h3>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                {step.status === "done" && (
                  <div className="w-6 h-6 rounded-full bg-cl-green/15 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-cl-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {step.status === "active" && (
                  <div className="w-6 h-6 flex-shrink-0">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
                {step.status === "pending" && (
                  <div className="w-6 h-6 rounded-full border-2 border-card-border flex-shrink-0" />
                )}
                {step.status === "error" && (
                  <div className="w-6 h-6 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${
                      step.status === "done"
                        ? "text-cl-green"
                        : step.status === "active"
                        ? "text-foreground"
                        : step.status === "error"
                        ? "text-red-400"
                        : "text-muted"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.detail && (
                    <p className="text-xs text-red-400/70 mt-0.5">{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-cl-green/20 bg-cl-green/5 glow-green card-shadow p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cl-green/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-cl-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground">Attestation Created</h3>
              <p className="text-xs text-muted">On-chain via EAS</p>
            </div>
            <TierBadge tier={result.tier} size="lg" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] text-muted font-semibold uppercase tracking-wider mb-0.5">Attestation UID</p>
              <p className="font-mono text-foreground text-xs">{shortenHex(result.attestation_uid, 12)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted font-semibold uppercase tracking-wider mb-0.5">Transaction</p>
              <p className="font-mono text-foreground text-xs">{shortenHex(result.tx_hash, 12)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted font-semibold uppercase tracking-wider mb-0.5">Task Threshold</p>
              <p className="text-foreground text-sm font-medium">{result.task_threshold}+ tasks</p>
            </div>
            <div>
              <p className="text-[11px] text-muted font-semibold uppercase tracking-wider mb-0.5">Rate Threshold</p>
              <p className="text-foreground text-sm font-medium">{(result.rate_threshold_bps / 100).toFixed(1)}%+ success</p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

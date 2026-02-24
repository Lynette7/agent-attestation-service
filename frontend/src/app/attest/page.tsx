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

    // Simulate step progression (the API does all 4 steps)
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
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Request Attestation</h1>
        <p className="text-gray-400">
          Trigger the full attestation flow: fetch performance data, check
          eligibility, generate ZK proof, and submit on-chain.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-card-border bg-card p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm text-slate-400">Agent ID (bytes32 hex)</label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="0x..."
            className="w-full bg-cl-dark border border-card-border rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cl-blue/50 font-mono"
          />
        </div>

        {/* Tier Selection */}
        <div className="space-y-3">
          <label className="text-sm text-gray-400">Select Tier</label>
          <div className="grid grid-cols-2 gap-4">
            {(["STANDARD", "VERIFIED"] as const).map((t) => {
              const config = TIER_CONFIG[t];
              const selected = tier === t;
              return (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selected
                      ? config.bgClass + " ring-1 ring-offset-0 " +
                        (t === "STANDARD" ? "ring-cl-blue/50" : "ring-cl-yellow/50")
                      : "border-card-border bg-cl-dark hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TierBadge tier={t} size="sm" />
                    {selected && (
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {config.taskThreshold}+ tasks, {config.rateThreshold}%+
                    success
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
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
          className={`w-full py-3 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            tier === "VERIFIED"
              ? "bg-cl-yellow/10 border border-cl-yellow/30 text-cl-yellow hover:bg-cl-yellow/20"
              : "bg-cl-blue/10 border border-cl-blue/30 text-cl-blue-light hover:bg-cl-blue/20"
          }`}
        >
          {loading ? "Processing..." : `Request ${tier} Attestation`}
        </button>
      </div>

      {/* Progress Steps */}
      {steps.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-medium text-slate-400">
            Attestation Pipeline
          </h3>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                {step.status === "done" && (
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-cl-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  <div className="w-6 h-6 rounded-full bg-gray-800 flex-shrink-0" />
                )}
                {step.status === "error" && (
                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                <div>
                  <p
                    className={`text-sm ${
                      step.status === "done"
                        ? "text-cl-green"
                        : step.status === "active"
                        ? "text-white"
                        : step.status === "error"
                        ? "text-red-400"
                        : "text-gray-600"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.detail && (
                    <p className="text-xs text-red-400/70 mt-0.5">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-cl-green/20 bg-cl-green/5 glow-green p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cl-green/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-cl-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Attestation Created!
              </h3>
              <p className="text-sm text-gray-400">
                On-chain via EAS
              </p>
            </div>
            <TierBadge tier={result.tier} size="lg" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Attestation UID</p>
              <p className="font-mono text-gray-300">
                {shortenHex(result.attestation_uid, 12)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Transaction</p>
              <p className="font-mono text-gray-300">
                {shortenHex(result.tx_hash, 12)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Task Threshold</p>
              <p className="text-gray-300">{result.task_threshold}+ tasks</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Rate Threshold</p>
              <p className="text-gray-300">
                {(result.rate_threshold_bps / 100).toFixed(1)}%+ success
              </p>
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

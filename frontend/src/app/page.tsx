"use client";

import { useEffect, useState } from "react";
import { healthCheck, type HealthResult } from "@/lib/api";
import { TIER_CONFIG } from "@/lib/constants";
import { shortenHex } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    healthCheck()
      .then(setHealth)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">
          Agent Attestation Service
        </h1>
        <p className="text-gray-400 max-w-2xl">
          Verifiable reputation &amp; trust layer for autonomous AI agents.
          Two-tier attestation system powered by CRE, EAS, and UltraHonk ZK
          proofs.
        </p>
      </div>

      {/* Connection Status */}
      <div className="rounded-xl border border-card-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                health?.blockchain
                  ? "bg-cl-green animate-pulse"
                  : error
                  ? "bg-red-500"
                  : "bg-gray-600"
              }`}
            />
            <span className="text-sm text-gray-300">
              {health?.blockchain
                ? "Connected to blockchain"
                : error
                ? "Backend offline"
                : "Connecting..."}
            </span>
          </div>
          {health && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Registry: {shortenHex(health.registry)}</span>
              <span>Chain: {health.chain_id}</span>
            </div>
          )}
        </div>
      </div>

      {/* Two-Tier System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(["STANDARD", "VERIFIED"] as const).map((tier) => {
          const config = TIER_CONFIG[tier];
          return (
            <div
              key={tier}
              className={`rounded-xl border p-6 space-y-4 ${config.bgClass} ${
                tier === "VERIFIED" ? "glow-gold" : "glow-blue"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${config.dotClass}`} />
                <h3 className="text-lg font-semibold text-white">
                  {config.label} Tier
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    Min Tasks
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {config.taskThreshold}+
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    Min Success Rate
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {config.rateThreshold}%+
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-400">{config.expiryLabel}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/verify"
          className="group rounded-xl border border-card-border bg-card p-5 hover:border-cl-blue/30 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <svg
              className="w-5 h-5 text-cl-blue-light"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
            <h3 className="font-medium text-white group-hover:text-cl-blue-light transition-colors">
              Verify Agent
            </h3>
          </div>
          <p className="text-sm text-gray-500">
            Look up an agent&apos;s attestations and verify their tier status
          </p>
        </Link>

        <Link
          href="/attest"
          className="group rounded-xl border border-card-border bg-card p-5 hover:border-cl-yellow/30 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <svg
              className="w-5 h-5 text-cl-yellow"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            <h3 className="font-medium text-white group-hover:text-cl-yellow transition-colors">
              Request Attestation
            </h3>
          </div>
          <p className="text-sm text-gray-500">
            Request a STANDARD or VERIFIED attestation with ZK proof
          </p>
        </Link>

        <Link
          href="/demo"
          className="group rounded-xl border border-card-border bg-card p-5 hover:border-cl-green/30 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <svg
              className="w-5 h-5 text-cl-green"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
            <h3 className="font-medium text-white group-hover:text-cl-green transition-colors">
              Agent-to-Agent Demo
            </h3>
          </div>
          <p className="text-sm text-gray-500">
            Watch Agent B verify Agent A before accepting a task
          </p>
        </Link>
      </div>

      {/* How It Works */}
      <div className="rounded-xl border border-card-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              step: "1",
              title: "Task Completion",
              desc: "Agent completes tasks on supported platforms",
              color: "text-cl-blue-light",
            },
            {
              step: "2",
              title: "CRE Workflow",
              desc: "Confidential HTTP fetches private performance data",
              color: "text-cl-yellow",
            },
            {
              step: "3",
              title: "ZK Proof",
              desc: "UltraHonk proves threshold claims without revealing data",
              color: "text-cl-green",
            },
            {
              step: "4",
              title: "EAS Attestation",
              desc: "Tier-stamped credential anchored on-chain via EAS",
              color: "text-cl-purple",
            },
          ].map((item) => (
            <div key={item.step} className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold ${item.color} bg-white/5 rounded-full w-6 h-6 flex items-center justify-center`}
                >
                  {item.step}
                </span>
                <p className="text-sm font-medium text-white">{item.title}</p>
              </div>
              <p className="text-xs text-gray-500 pl-8">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

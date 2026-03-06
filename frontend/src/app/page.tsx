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
    <div className="w-full max-w-6xl mx-auto space-y-8 xl:space-y-10 px-4 lg:px-0">
      {/* ── Page heading ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight">
            Agent Attestation Service
          </h1>
          <p className="text-[15px] md:text-base text-muted mt-1 leading-relaxed">
            Verifiable reputation &amp; trust layer for autonomous AI agents.
            Two-tier attestation system powered by CRE, EAS, and UltraHonk ZK proofs.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1 rounded-full border border-card-border/80 bg-card/60 px-3 py-1.5 backdrop-blur">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              health?.blockchain
                ? "bg-cl-green animate-pulse"
                : error
                ? "bg-red-500"
                : "bg-muted"
            }`}
          />
          <span className="text-xs text-muted whitespace-nowrap">
            {health?.blockchain
              ? `Registry ${shortenHex(health.registry)} · Chain ${health.chain_id}`
              : error
              ? "Backend offline"
              : "Connecting…"}
          </span>
        </div>
      </div>

      {/* ── Two-Tier Overview ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {(["STANDARD", "VERIFIED"] as const).map((tier) => {
          const config = TIER_CONFIG[tier];
          const isVerified = tier === "VERIFIED";
          const accentColor = isVerified ? "text-cl-yellow" : "text-cl-blue-light";

          return (
            <div
              key={tier}
              className="group rounded-2xl border border-card-border bg-card card-shadow p-6 space-y-5 transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#00727F] hover:bg-[#0C1824]"
            >
              {/* Tier name + badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cl-blue/15 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    {isVerified ? (
                      <svg className={`w-5 h-5 ${accentColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                      </svg>
                    ) : (
                      <svg className={`w-5 h-5 ${accentColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{config.label} Tier</h3>
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                  isVerified
                    ? "bg-cl-yellow/10 text-cl-yellow border-cl-yellow/25"
                    : "bg-cl-blue/10 text-cl-blue-light border-cl-blue/25"
                }`}>
                  {tier}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] md:text-xs text-muted uppercase tracking-wider font-semibold mb-1">
                    Min Tasks
                  </p>
                  <p className="text-[26px] md:text-[30px] font-bold text-foreground leading-none">
                    {config.taskThreshold}+
                  </p>
                </div>
                <div>
                  <p className="text-[11px] md:text-xs text-muted uppercase tracking-wider font-semibold mb-1">
                    Min Success Rate
                  </p>
                  <p className="text-[26px] md:text-[30px] font-bold text-foreground leading-none">
                    {config.rateThreshold}%+
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted border-t border-card-border pt-4">{config.expiryLabel}</p>
            </div>
          );
        })}
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            href: "/verify",
            accentColor: "text-cl-blue-light",
            iconBg: "bg-cl-blue/15 dark:bg-cl-blue/10",
            hoverBorder: "hover:border-[#00727F] hover:bg-[#0C1824]",
            label: "Verify Agent",
            desc: "Look up an agent's attestations and verify their tier status",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            ),
          },
          {
            href: "/attest",
            accentColor: "text-cl-yellow",
            iconBg: "bg-cl-yellow/15 dark:bg-cl-yellow/10",
            hoverBorder: "hover:border-[#00727F] hover:bg-[#0C1824]",
            label: "Request Attestation",
            desc: "Request a STANDARD or VERIFIED attestation with ZK proof",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            href: "/demo",
            accentColor: "text-cl-green",
            iconBg: "bg-cl-green/15 dark:bg-cl-green/10",
            hoverBorder: "hover:border-[#00727F] hover:bg-[#0C1824]",
            label: "Agent-to-Agent Demo",
            desc: "Watch Agent B verify Agent A before accepting a task",
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            ),
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`group rounded-2xl border border-card-border bg-card card-shadow p-5 transition-all duration-200 ${item.hoverBorder} hover:-translate-y-0.5`}
          >
            {/* Icon left of title — matches approved layout */}
            <div className="flex items-center gap-3 mb-2.5">
              <div
                className={`w-9 h-9 rounded-full ${item.iconBg} flex items-center justify-center ${item.accentColor} flex-shrink-0 group-hover:brightness-110`}
              >
                {item.icon}
              </div>
              <h3 className="font-semibold text-foreground text-[15px] md:text-[17px] group-hover:text-foreground">
                {item.label}
              </h3>
            </div>
            <p className="text-[13px] md:text-[14px] text-muted leading-relaxed group-hover:text-foreground/80">
              {item.desc}
            </p>
          </Link>
        ))}
      </div>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-card-border bg-card card-shadow p-6">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-5">How It Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 lg:gap-6">
          {[
            {
              step: "01",
              title: "Task Completion",
              desc: "Agent completes tasks on supported platforms",
              pillBg: "#00B3FF",
            },
            {
              step: "02",
              title: "CRE Workflow",
              desc: "Confidential HTTP fetches private performance data",
              pillBg: "#12B886",
            },
            {
              step: "03",
              title: "ZK Proof",
              desc: "UltraHonk proves threshold claims without revealing data",
              pillBg: "#FFB400",
            },
            {
              step: "04",
              title: "EAS Attestation",
              desc: "Tier-stamped credential anchored on-chain via EAS",
              pillBg: "#B674FF",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="group flex items-start gap-3 rounded-lg px-3 py-2 -mx-3 transition-colors duration-150 hover:bg-[#0C1824]"
            >
              <span
                className="w-8 h-8 rounded-full text-[11px] font-semibold flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: item.pillBg, color: "#0B1220" }}
              >
                {item.step}
              </span>
              <div>
                <p className="text-sm md:text-[15px] font-semibold text-foreground mb-1 group-hover:text-foreground">
                  {item.title}
                </p>
                <p className="text-[12px] md:text-[13px] text-muted leading-relaxed group-hover:text-foreground/80">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

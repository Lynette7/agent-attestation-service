"use client";

import { useState } from "react";
import {
  requestAttestation,
  verifyAgent,
  submitEndorsement,
} from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { shortenHex } from "@/lib/utils";

interface LogEntry {
  timestamp: string;
  actor: "A" | "B" | "system";
  message: string;
  type: "info" | "success" | "error" | "action";
}

const AGENT_A_ID =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const AGENT_B_ID =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

export default function DemoPage() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [phase, setPhase] = useState<string>("");
  const [result, setResult] = useState<"accepted" | "rejected" | null>(null);

  function addLog(
    actor: LogEntry["actor"],
    message: string,
    type: LogEntry["type"] = "info"
  ) {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, actor, message, type }]);
  }

  async function runDemo() {
    setRunning(true);
    setLogs([]);
    setResult(null);

    try {
      setPhase("Phase 1: Agent A earns STANDARD attestation");
      addLog("A", "Requesting STANDARD attestation...", "action");
      await sleep(500);

      try {
        const attestResult = await requestAttestation(AGENT_A_ID, "STANDARD");
        addLog(
          "system",
          `Attestation created: ${shortenHex(attestResult.attestation_uid, 8)}`,
          "success"
        );
        addLog(
          "system",
          `Tasks: ${attestResult.task_threshold}+, Rate: ${(
            attestResult.rate_threshold_bps / 100
          ).toFixed(1)}%+`,
          "info"
        );
      } catch (e: unknown) {
        addLog(
          "system",
          `Attestation: ${e instanceof Error ? e.message : "failed"}`,
          "error"
        );
      }

      await sleep(1000);

      setPhase("Phase 2: Agent A delegates task to Agent B");
      addLog("A", "Task request: Analyze sentiment data (priority: medium)", "action");
      addLog("B", "Task received. Verifying Agent A credentials...", "action");
      await sleep(1000);

      setPhase("Phase 3: Agent B verifies Agent A on-chain");
      addLog("B", "Querying on-chain attestations for Agent A...", "action");
      await sleep(500);

      try {
        const verifyResult = await verifyAgent(AGENT_A_ID, {
          min_tier: "STANDARD",
        });

        if (verifyResult.verified && verifyResult.tier) {
          addLog("B", "On-chain verification successful!", "success");
          addLog(
            "system",
            `Tier: ${verifyResult.tier}, Proof valid: ${verifyResult.proof_valid}`,
            "info"
          );
          addLog(
            "system",
            `UID: ${shortenHex(verifyResult.attestation_uid || "", 8)}`,
            "info"
          );

          await sleep(800);

          setPhase("Phase 4: Task accepted — trust established");
          addLog("B", "Trust verified. Accepting task delegation.", "success");
          addLog("A", "Task delegation confirmed. Work beginning.", "success");

          await sleep(1000);

          setPhase("Phase 5: Agent B endorses Agent A");
          addLog("B", "Submitting on-chain endorsement for Agent A...", "action");

          try {
            const endorseResult = await submitEndorsement(
              AGENT_B_ID,
              AGENT_A_ID,
              "reliable_collaborator",
              "Successfully completed delegated sentiment analysis task"
            );
            addLog(
              "system",
              `Endorsement created: ${shortenHex(endorseResult.endorsement_uid, 8)}`,
              "success"
            );
          } catch {
            addLog(
              "B",
              "Endorsement submitted (mock — agent not registered on-chain)",
              "info"
            );
          }

          setResult("accepted");
        } else {
          addLog("B", "Verification failed — no valid attestation found.", "error");
          addLog("B", "Rejecting task delegation.", "error");
          setResult("rejected");
        }
      } catch (e: unknown) {
        addLog(
          "B",
          `Verification error: ${e instanceof Error ? e.message : "unknown"}`,
          "error"
        );
        addLog("B", "Rejecting task — cannot verify credentials.", "error");
        setResult("rejected");
      }
    } finally {
      setPhase("");
      setRunning(false);
    }
  }

  const actorColors = {
    A: "text-cl-blue-light",
    B: "text-cl-yellow",
    system: "text-muted",
  };

  const actorLabels = {
    A: "Agent A",
    B: "Agent B",
    system: "System ",
  };

  const typeStyles = {
    info: "text-muted",
    success: "text-cl-green",
    error: "text-red-400",
    action: "text-foreground",
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 xl:space-y-10 px-4 lg:px-0">
      <div className="space-y-1.5">
        <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight">
          Agent-to-Agent Verification Demo
        </h1>
        <p className="text-[15px] md:text-base text-muted leading-relaxed">
          Watch Agent B verify Agent A&apos;s on-chain credentials before accepting a delegated
          task. This demonstrates the full trust verification flow.
        </p>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="group rounded-2xl border border-card-border bg-card card-shadow p-5 md:p-6 space-y-3 transition-colors duration-150 dark:hover:border-[#00727F] dark:hover:bg-[#0C1824]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00B3FF] flex items-center justify-center text-[#021019] font-bold text-sm flex-shrink-0">
              A
            </div>
            <div>
              <p className="font-semibold text-foreground text-[15px] md:text-[16px]">
                Agent A — Task Delegator
              </p>
              <p className="text-[12px] md:text-[13px] text-muted font-mono mt-0.5">
                {shortenHex(AGENT_A_ID, 8)}
              </p>
            </div>
          </div>
          <p className="text-[13px] md:text-[14px] text-muted leading-relaxed">
            25 tasks at 80% success. STANDARD eligible. Wants to delegate work.
          </p>
        </div>

        <div className="group rounded-2xl border border-card-border bg-card card-shadow p-5 md:p-6 space-y-3 transition-colors duration-150 dark:hover:border-[#00727F] dark:hover:bg-[#0C1824]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FF4B81] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              B
            </div>
            <div>
              <p className="font-semibold text-foreground text-[15px] md:text-[16px]">
                Agent B — Verifier
              </p>
              <p className="text-[12px] md:text-[13px] text-muted font-mono mt-0.5">
                {shortenHex(AGENT_B_ID, 8)}
              </p>
            </div>
          </div>
          <p className="text-[13px] md:text-[14px] text-muted leading-relaxed">
            Requires STANDARD tier minimum to accept delegated tasks. Checks on-chain.
          </p>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={runDemo}
        disabled={running}
        className="w-full py-3 rounded-xl bg-[#00727F] text-white font-semibold text-sm md:text-[15px] tracking-wide hover:bg-[#008A99] dark:bg-[#00C2FF] dark:text-[#021019] dark:hover:bg-[#22D1FF] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {running ? (
          <span className="flex items-center justify-center gap-3">
            <LoadingSpinner size="sm" />
            Running Demo...
          </span>
        ) : (
          "Run Agent-to-Agent Demo"
        )}
      </button>

      {/* Phase Indicator */}
      {phase && (
        <div className="rounded-lg border border-cl-purple/20 bg-cl-purple/5 px-4 py-2.5">
          <p className="text-sm text-cl-purple font-semibold">{phase}</p>
        </div>
      )}

      {/* Log Output */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-card-border bg-input-bg p-4 space-y-1.5 font-mono text-sm max-h-96 overflow-y-auto card-shadow">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted/60 flex-shrink-0 hidden sm:inline sm:w-20 text-xs">
                {log.timestamp}
              </span>
              <span
                className={`flex-shrink-0 sm:w-20 font-semibold text-xs ${actorColors[log.actor]}`}
              >
                [{actorLabels[log.actor]}]
              </span>
              <span className={`${typeStyles[log.type]} min-w-0 break-words text-xs`}>{log.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`rounded-xl border p-6 card-shadow ${
            result === "accepted"
              ? "border-cl-green/20 bg-cl-green/5 glow-green"
              : "border-red-500/20 bg-red-500/5"
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                result === "accepted" ? "bg-cl-green/15" : "bg-red-500/15"
              }`}
            >
              {result === "accepted" ? (
                <svg className="w-5 h-5 text-cl-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {result === "accepted"
                  ? "Task Delegation Accepted"
                  : "Task Delegation Rejected"}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                {result === "accepted"
                  ? "Agent B verified Agent A's on-chain credentials and accepted the task."
                  : "Agent B could not verify Agent A's credentials. Task rejected."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="rounded-2xl border border-card-border bg-card card-shadow p-6 md:p-7 space-y-4">
        <h3 className="text-[11px] md:text-xs font-semibold text-muted uppercase tracking-wider">
          What This Demonstrates
        </h3>
        <ul className="space-y-3">
          {[
            {
              color: "text-cl-blue-light",
              num: "1",
              text: "Agent A earns a STANDARD attestation via the full pipeline: performance fetch → eligibility check → ZK proof → EAS on-chain",
            },
            {
              color: "text-cl-yellow",
              num: "2",
              text: "Agent B queries Agent A's on-chain attestations, filtering by tier and checking for revocation/expiry",
            },
            {
              color: "text-cl-green",
              num: "3",
              text: "Trust is established cryptographically — no raw data shared, no central authority needed",
            },
            {
              color: "text-cl-purple",
              num: "4",
              text: "Agent B submits an on-chain endorsement after successful collaboration",
            },
          ].map((item) => (
            <li key={item.num} className="flex items-start gap-3">
              <span className={`${item.color} font-bold text-xs md:text-[13px] mt-0.5 flex-shrink-0`}>
                {item.num}.
              </span>
              <span className="text-muted text-[13px] md:text-[14px] leading-relaxed">
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

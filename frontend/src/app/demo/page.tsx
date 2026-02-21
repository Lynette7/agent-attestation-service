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
      // ─── Phase 1: Agent A gets attestation ──────────────
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

      // ─── Phase 2: Agent B receives task request ─────────
      setPhase("Phase 2: Agent A delegates task to Agent B");
      addLog("A", "Task request: Analyze sentiment data (priority: medium)", "action");
      addLog("B", "Task received. Verifying Agent A credentials...", "action");
      await sleep(1000);

      // ─── Phase 3: Agent B verifies Agent A ──────────────
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

          // ─── Phase 4: Task accepted ───────────────────────
          setPhase("Phase 4: Task accepted — trust established");
          addLog("B", "Trust verified. Accepting task delegation.", "success");
          addLog("A", "Task delegation confirmed. Work beginning.", "success");

          await sleep(1000);

          // ─── Phase 5: Endorsement ─────────────────────────
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
    A: "text-blue-400",
    B: "text-amber-400",
    system: "text-gray-500",
  };

  const actorLabels = {
    A: "Agent A",
    B: "Agent B",
    system: "System",
  };

  const typeStyles = {
    info: "text-gray-400",
    success: "text-green-400",
    error: "text-red-400",
    action: "text-white",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">
          Agent-to-Agent Verification Demo
        </h1>
        <p className="text-gray-400">
          Watch Agent B verify Agent A&apos;s on-chain credentials before
          accepting a delegated task. This demonstrates the full trust
          verification flow.
        </p>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
              A
            </div>
            <div>
              <p className="font-medium text-white">Agent A (Task Delegator)</p>
              <p className="text-xs text-gray-500 font-mono">
                {shortenHex(AGENT_A_ID, 8)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Has 25 tasks at 80% success. STANDARD eligible. Wants to delegate
            work.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
              B
            </div>
            <div>
              <p className="font-medium text-white">Agent B (Verifier)</p>
              <p className="text-xs text-gray-500 font-mono">
                {shortenHex(AGENT_B_ID, 8)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Requires STANDARD tier minimum to accept delegated tasks. Checks
            on-chain.
          </p>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={runDemo}
        disabled={running}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-amber-500/10 border border-gray-700 text-white font-medium hover:from-blue-500/20 hover:to-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-2">
          <p className="text-sm text-purple-400 font-medium">{phase}</p>
        </div>
      )}

      {/* Log Output */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4 space-y-1.5 font-mono text-sm max-h-96 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-gray-600 flex-shrink-0 w-20">
                {log.timestamp}
              </span>
              <span
                className={`flex-shrink-0 w-20 font-semibold ${actorColors[log.actor]}`}
              >
                [{actorLabels[log.actor]}]
              </span>
              <span className={typeStyles[log.type]}>{log.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`rounded-xl border p-6 ${
            result === "accepted"
              ? "border-green-500/20 bg-green-500/5 glow-green"
              : "border-red-500/20 bg-red-500/5"
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                result === "accepted" ? "bg-green-500/20" : "bg-red-500/20"
              }`}
            >
              {result === "accepted" ? (
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
                {result === "accepted"
                  ? "Task Delegation Accepted"
                  : "Task Delegation Rejected"}
              </h3>
              <p className="text-sm text-gray-400">
                {result === "accepted"
                  ? "Agent B verified Agent A's on-chain credentials and accepted the task."
                  : "Agent B could not verify Agent A's credentials. Task rejected."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#111118] p-6 space-y-3">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          What This Demonstrates
        </h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-1">1.</span>
            <span>
              Agent A earns a STANDARD attestation via the full pipeline:
              performance fetch → eligibility check → ZK proof → EAS on-chain
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 mt-1">2.</span>
            <span>
              Agent B queries Agent A&apos;s on-chain attestations, filtering by
              tier and checking for revocation/expiry
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-1">3.</span>
            <span>
              Trust is established cryptographically — no raw data shared, no
              central authority needed
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-1">4.</span>
            <span>
              Agent B submits an on-chain endorsement after successful
              collaboration
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

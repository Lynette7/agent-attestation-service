"use client";

import { TierBadge } from "./TierBadge";
import { ExpiryCountdown } from "./ExpiryCountdown";
import { shortenHex, bpsToPercent, formatTimestamp } from "@/lib/utils";
import type { TierName } from "@/lib/api";

interface AttestationCardProps {
  uid: string;
  tier: TierName | number;
  taskThreshold: number;
  rateBps: number;
  issuedAt: number;
  expiresAt: number;
  revoked?: boolean;
  onRevoke?: (uid: string) => void;
}

function tierFromNumber(t: number | TierName): TierName {
  if (typeof t === "string") return t;
  return t === 2 ? "VERIFIED" : "STANDARD";
}

export function AttestationCard({
  uid,
  tier,
  taskThreshold,
  rateBps,
  issuedAt,
  expiresAt,
  revoked,
  onRevoke,
}: AttestationCardProps) {
  const tierName = tierFromNumber(tier);
  const isVerified = tierName === "VERIFIED";

  return (
    <div
      className={`rounded-xl border p-5 space-y-4 card-shadow transition-all duration-200 ${
        revoked
          ? "border-red-500/20 bg-red-500/5 opacity-60"
          : isVerified
          ? "border-cl-yellow/20 bg-cl-yellow/5 glow-gold"
          : "border-cl-blue/20 bg-cl-blue/5 glow-blue"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <TierBadge tier={tierName} />
            {revoked && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-500/15 text-red-400 border border-red-500/25 font-bold uppercase tracking-wide">
                Revoked
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted font-mono">{shortenHex(uid, 10)}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
            Tasks Required
          </p>
          <p className="text-lg font-bold text-foreground">{taskThreshold}+</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
            Success Rate
          </p>
          <p className="text-lg font-bold text-foreground">
            {bpsToPercent(rateBps)}+
          </p>
        </div>
      </div>

      {/* Expiry */}
      <ExpiryCountdown expiresAt={expiresAt} />

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-card-border">
        <p className="text-[11px] text-muted">
          Issued: {formatTimestamp(issuedAt)}
        </p>
        {onRevoke && !revoked && (
          <button
            onClick={() => onRevoke(uid)}
            className="text-[11px] text-red-400/50 hover:text-red-400 transition-colors font-medium"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

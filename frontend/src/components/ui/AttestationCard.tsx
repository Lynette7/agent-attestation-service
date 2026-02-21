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
      className={`rounded-xl border p-5 space-y-4 transition-all duration-200 ${
        revoked
          ? "border-red-500/20 bg-red-500/5 opacity-60"
          : isVerified
          ? "border-amber-500/20 bg-amber-500/5 glow-amber"
          : "border-blue-500/20 bg-blue-500/5 glow-blue"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TierBadge tier={tierName} />
            {revoked && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-semibold">
                REVOKED
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-mono">{shortenHex(uid, 10)}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">
            Tasks Required
          </p>
          <p className="text-lg font-semibold text-white">{taskThreshold}+</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">
            Success Rate
          </p>
          <p className="text-lg font-semibold text-white">
            {bpsToPercent(rateBps)}+
          </p>
        </div>
      </div>

      {/* Expiry */}
      <ExpiryCountdown expiresAt={expiresAt} />

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-800">
        <p className="text-[11px] text-gray-600">
          Issued: {formatTimestamp(issuedAt)}
        </p>
        {onRevoke && !revoked && (
          <button
            onClick={() => onRevoke(uid)}
            className="text-[11px] text-red-500/60 hover:text-red-400 transition-colors"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

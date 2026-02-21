"use client";

import { useEffect, useState } from "react";
import { timeUntilExpiry } from "@/lib/utils";

interface ExpiryCountdownProps {
  expiresAt: number; // Unix timestamp, 0 = never
}

export function ExpiryCountdown({ expiresAt }: ExpiryCountdownProps) {
  const [expiry, setExpiry] = useState(() => timeUntilExpiry(expiresAt));

  useEffect(() => {
    if (!expiresAt || expiresAt === 0) return;

    const interval = setInterval(() => {
      setExpiry(timeUntilExpiry(expiresAt));
    }, 60_000); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt || expiresAt === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Never expires</span>
      </div>
    );
  }

  if (expiry.expired) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span className="font-medium">Expired</span>
      </div>
    );
  }

  // Calculate progress (of 90-day duration)
  const totalDuration = 90 * 86400;
  const now = Math.floor(Date.now() / 1000);
  const remaining = expiresAt - now;
  const progressPct = Math.max(0, Math.min(100, (remaining / totalDuration) * 100));

  const urgencyColor =
    expiry.days < 7
      ? "text-red-400"
      : expiry.days < 30
      ? "text-amber-400"
      : "text-green-400";

  const barColor =
    expiry.days < 7
      ? "bg-red-500"
      : expiry.days < 30
      ? "bg-amber-500"
      : "bg-green-500";

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-2 text-sm ${urgencyColor}`}>
        <svg
          className={`w-4 h-4 ${expiry.days < 7 ? "animate-pulse-slow" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="font-medium">{expiry.label}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

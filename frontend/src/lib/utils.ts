/** Utility functions */

/** Shorten a hex string like 0xabcdef...1234 */
export function shortenHex(hex: string, chars = 6): string {
  if (!hex || hex.length < chars * 2 + 2) return hex;
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`;
}

/** Format basis points to percentage string */
export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

/** Format a Unix timestamp to human-readable date */
export function formatTimestamp(ts: number): string {
  if (!ts) return "N/A";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Calculate time remaining until expiry */
export function timeUntilExpiry(expiresAt: number): {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  label: string;
} {
  if (!expiresAt || expiresAt === 0)
    return { expired: false, days: 0, hours: 0, minutes: 0, label: "Never" };

  const now = Math.floor(Date.now() / 1000);
  const diff = expiresAt - now;

  if (diff <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, label: "Expired" };
  }

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  let label: string;
  if (days > 0) label = `${days}d ${hours}h remaining`;
  else if (hours > 0) label = `${hours}h ${minutes}m remaining`;
  else label = `${minutes}m remaining`;

  return { expired: false, days, hours, minutes, label };
}

/** Validate a bytes32 hex string */
export function isValidBytes32(hex: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(hex);
}

/** cn-like class merger (simple version) */
export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

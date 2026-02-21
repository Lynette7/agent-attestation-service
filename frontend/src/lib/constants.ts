/** Shared constants for the AAS frontend */

export const TIER_CONFIG = {
  STANDARD: {
    label: "STANDARD",
    color: "blue",
    bgClass: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    badgeClass: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
    dotClass: "bg-blue-400",
    taskThreshold: 10,
    rateThreshold: 70,
    rateBps: 7000,
    expiryLabel: "Never expires",
  },
  VERIFIED: {
    label: "VERIFIED",
    color: "amber",
    bgClass: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
    dotClass: "bg-amber-400",
    taskThreshold: 100,
    rateThreshold: 95,
    rateBps: 9500,
    expiryLabel: "90-day expiry",
  },
} as const;

export const SEPOLIA_CHAIN_ID = 11155111;
export const LOCAL_CHAIN_ID = 31337;

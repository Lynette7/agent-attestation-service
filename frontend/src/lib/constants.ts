/**
 * Shared constants for the AAS frontend
 * Colors aligned with official Chainlink brand:
 *   - STANDARD tier: Chainlink Blue (#0847F7)
 *   - VERIFIED tier: Chainlink Yellow (#F7B808)
 */

export const TIER_CONFIG = {
  STANDARD: {
    label: "STANDARD",
    color: "blue",
    bgClass: "bg-cl-blue/10 border-cl-blue/30 text-cl-blue-light",
    badgeClass: "bg-cl-blue/20 text-cl-blue-light border border-cl-blue/40",
    dotClass: "bg-cl-blue",
    taskThreshold: 10,
    rateThreshold: 70,
    rateBps: 7000,
    expiryLabel: "Never expires",
  },
  VERIFIED: {
    label: "VERIFIED",
    color: "gold",
    bgClass: "bg-cl-yellow/10 border-cl-yellow/30 text-cl-yellow",
    badgeClass: "bg-cl-yellow/20 text-cl-yellow border border-cl-yellow/40",
    dotClass: "bg-cl-yellow",
    taskThreshold: 100,
    rateThreshold: 95,
    rateBps: 9500,
    expiryLabel: "90-day expiry",
  },
} as const;

export const SEPOLIA_CHAIN_ID = 11155111;
export const LOCAL_CHAIN_ID = 31337;

"use client";

import { TIER_CONFIG } from "@/lib/constants";
import type { TierName } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier: TierName;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export function TierBadge({ tier, size = "md", showIcon = true }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-3 py-1 text-xs",
    lg: "px-4 py-1.5 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-full tracking-wider uppercase",
        config.badgeClass,
        sizeClasses[size],
        tier === "VERIFIED" && "glow-gold",
        tier === "STANDARD" && "glow-blue"
      )}
    >
      {showIcon && (
        <span className={cn("w-1.5 h-1.5 rounded-full", config.dotClass)} />
      )}
      {config.label}
    </span>
  );
}

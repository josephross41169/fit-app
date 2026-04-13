// 🏆 Tier calculation engine
// Tiers are EARNED through activity — never purchasable
//
// Default     → everyone starts here
// 🟣 Active   → 3+ logs/week for 4 weeks (12+ in last 28 days)
// 🔥 Grinder  → top 25% in a group (client-side: 30+ logs in last 28 days)
// ⚡ Elite    → top 10% app-wide (client-side: 50+ logs in last 28 days)
// 💀 Untouchable → legendary (80+ logs in last 28 days OR 7-day streak 4x/week x 12 weeks)

export type Tier = "default" | "active" | "grinder" | "elite" | "untouchable";

export interface TierInfo {
  tier: Tier;
  label: string;
  icon: string;
  title: string;
  description: string;
  nextTier: Tier | null;
  nextDescription: string | null;
  progress: number; // 0-100 toward next tier
}

/** Compute tier from recent 28-day log count (fast, client-side) */
export function computeTier(logsLast28Days: number, longestStreak: number): Tier {
  if (logsLast28Days >= 80 || longestStreak >= 84) return "untouchable";
  if (logsLast28Days >= 50) return "elite";
  if (logsLast28Days >= 30) return "grinder";
  if (logsLast28Days >= 12) return "active";
  return "default";
}

export const TIER_INFO: Record<Tier, Omit<TierInfo, "nextTier" | "nextDescription" | "progress">> = {
  default: {
    tier: "default",
    label: "Default",
    icon: "🩶",
    title: "",
    description: "Log 12+ activities in 28 days to reach Active tier",
  },
  active: {
    tier: "active",
    label: "Active",
    icon: "🟣",
    title: "Active",
    description: "Logging 3x/week consistently",
  },
  grinder: {
    tier: "grinder",
    label: "Grinder",
    icon: "🔥",
    title: "The Grinder",
    description: "Top 25% activity — elite work ethic",
  },
  elite: {
    tier: "elite",
    label: "Elite",
    icon: "⚡",
    title: "Elite",
    description: "Top 10% app-wide — seriously impressive",
  },
  untouchable: {
    tier: "untouchable",
    label: "Untouchable",
    icon: "💀",
    title: "Untouchable",
    description: "Legendary tier — stuff most people haven't seen",
  },
};

const TIER_ORDER: Tier[] = ["default", "active", "grinder", "elite", "untouchable"];
const TIER_THRESHOLDS: Record<Tier, number> = {
  default: 0,
  active: 12,
  grinder: 30,
  elite: 50,
  untouchable: 80,
};

export function getTierInfo(logsLast28Days: number, longestStreak: number): TierInfo {
  const tier = computeTier(logsLast28Days, longestStreak);
  const idx = TIER_ORDER.indexOf(tier);
  const nextTier = idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
  const currentThreshold = TIER_THRESHOLDS[tier];
  const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : TIER_THRESHOLDS.untouchable;
  const progress = nextTier
    ? Math.min(100, Math.round(((logsLast28Days - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100;

  return {
    ...TIER_INFO[tier],
    nextTier,
    nextDescription: nextTier
      ? `${nextThreshold - logsLast28Days} more logs needed in 28 days to reach ${TIER_INFO[nextTier].label}`
      : null,
    progress,
  };
}

/** Tier colors — matches TierActivityCard */
export const TIER_COLORS: Record<Tier, {
  border: string;
  glow: string;
  badge: string;
  badgeText: string;
  accent: string;
}> = {
  default: {
    border: "#2D2D2D",
    glow: "transparent",
    badge: "#2D2D2D",
    badgeText: "#9CA3AF",
    accent: "#6B7280",
  },
  active: {
    border: "#7C3AED",
    glow: "rgba(124,58,237,0.3)",
    badge: "#2D1B69",
    badgeText: "#A78BFA",
    accent: "#7C3AED",
  },
  grinder: {
    border: "#F59E0B",
    glow: "rgba(245,158,11,0.35)",
    badge: "#3D2200",
    badgeText: "#FCD34D",
    accent: "#F59E0B",
  },
  elite: {
    border: "#38BDF8",
    glow: "rgba(56,189,248,0.4)",
    badge: "#0A1628",
    badgeText: "#7DD3FC",
    accent: "#38BDF8",
  },
  untouchable: {
    border: "#E879F9",
    glow: "rgba(232,121,249,0.5)",
    badge: "#1A0035",
    badgeText: "#F0ABFC",
    accent: "#E879F9",
  },
};

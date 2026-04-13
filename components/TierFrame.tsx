"use client";
import React from "react";
import type { Tier } from "@/lib/tiers";
import { TIER_COLORS } from "@/lib/tiers";

interface TierFrameProps {
  tier: Tier;
  size?: number;
  children: React.ReactNode;
}

const FRAME_ANIMATIONS: Record<Tier, string | null> = {
  default: null,
  active: "tier-pulse",
  grinder: "tier-fire",
  elite: "tier-shimmer",
  untouchable: "tier-galaxy",
};

const ANIMATION_CSS = `
  @keyframes tier-pulse {
    0%, 100% { box-shadow: 0 0 6px rgba(124,58,237,0.3); }
    50% { box-shadow: 0 0 18px rgba(124,58,237,0.6), 0 0 32px rgba(124,58,237,0.2); }
  }
  @keyframes tier-fire {
    0%, 100% { box-shadow: 0 0 10px rgba(245,158,11,0.4), 0 0 24px rgba(245,158,11,0.15); }
    33% { box-shadow: 0 0 16px rgba(239,68,68,0.55), 0 0 36px rgba(245,158,11,0.25); }
    66% { box-shadow: 0 0 14px rgba(245,158,11,0.6), 0 0 28px rgba(251,191,36,0.2); }
  }
  @keyframes tier-shimmer {
    0% { border-color: #38BDF8; box-shadow: 0 0 12px rgba(56,189,248,0.4); }
    25% { border-color: #818CF8; box-shadow: 0 0 20px rgba(129,140,248,0.4); }
    50% { border-color: #38BDF8; box-shadow: 0 0 16px rgba(56,189,248,0.6); }
    75% { border-color: #34D399; box-shadow: 0 0 20px rgba(52,211,153,0.4); }
    100% { border-color: #38BDF8; box-shadow: 0 0 12px rgba(56,189,248,0.4); }
  }
  @keyframes tier-galaxy {
    0% { border-color: #E879F9; box-shadow: 0 0 16px rgba(232,121,249,0.5), 0 0 40px rgba(139,92,246,0.2); }
    33% { border-color: #C084FC; box-shadow: 0 0 24px rgba(192,132,252,0.6), 0 0 56px rgba(232,121,249,0.3); }
    66% { border-color: #F472B6; box-shadow: 0 0 20px rgba(244,114,182,0.5), 0 0 48px rgba(232,121,249,0.25); }
    100% { border-color: #E879F9; box-shadow: 0 0 16px rgba(232,121,249,0.5), 0 0 40px rgba(139,92,246,0.2); }
  }
`;

/** Wraps any avatar with a tier-appropriate animated border frame */
export function TierFrame({ tier, size = 80, children }: TierFrameProps) {
  const colors = TIER_COLORS[tier];
  const animation = FRAME_ANIMATIONS[tier];
  const borderWidth = tier === "untouchable" ? 4 : tier === "elite" ? 3 : tier === "grinder" ? 3 : 2.5;

  return (
    <>
      {animation && <style>{ANIMATION_CSS}</style>}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `${borderWidth}px solid ${colors.border}`,
          boxShadow: animation ? undefined : `0 0 8px ${colors.glow}`,
          animation: animation ? `${animation} 2.5s ease-in-out infinite` : undefined,
          overflow: "hidden",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {children}
      </div>
    </>
  );
}

/** Inline tier badge chip — shows icon + label */
export function TierBadgeChip({ tier, small = false }: { tier: Tier; small?: boolean }) {
  if (tier === "default") return null;
  const colors = TIER_COLORS[tier];
  const ICONS: Record<Tier, string> = {
    default: "",
    active: "🟣",
    grinder: "🔥",
    elite: "⚡",
    untouchable: "💀",
  };
  const LABELS: Record<Tier, string> = {
    default: "",
    active: "Active",
    grinder: "Grinder",
    elite: "Elite",
    untouchable: "Untouchable",
  };

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      padding: small ? "1px 6px" : "2px 9px",
      borderRadius: 20,
      background: colors.badge,
      border: `1px solid ${colors.border}`,
      color: colors.badgeText,
      fontSize: small ? 9 : 11,
      fontWeight: 800,
      letterSpacing: 0.5,
      textTransform: "uppercase" as const,
      boxShadow: `0 0 5px ${colors.glow}`,
      flexShrink: 0,
    }}>
      {ICONS[tier]} {LABELS[tier]}
    </span>
  );
}

/** Title shown under the username (e.g. "The Grinder") */
export function TierTitle({ tier, accentColor }: { tier: Tier; accentColor?: string }) {
  const TITLES: Record<Tier, string> = {
    default: "",
    active: "Active",
    grinder: "The Grinder",
    elite: "Elite",
    untouchable: "Untouchable",
  };
  const title = TITLES[tier];
  if (!title) return null;
  const color = accentColor || TIER_COLORS[tier].accent;
  return (
    <span style={{
      fontSize: 11,
      color,
      fontWeight: 700,
      letterSpacing: 0.5,
      display: "block",
      marginTop: 1,
    }}>
      {title}
    </span>
  );
}


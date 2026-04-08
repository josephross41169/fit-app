"use client";
import React from "react";

export type Tier = "default" | "active" | "grinder" | "elite" | "untouchable";

export interface ActivityCardData {
  username: string;
  displayName: string;
  tier: Tier;
  type: "workout" | "nutrition" | "wellness";
  title: string;
  subtitle: string;
  stats: { label: string; value: string }[];
  timeAgo: string;
  avatarUrl?: string;
}

// ── Tier config ──────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<Tier, {
  label: string;
  title: string;
  cardBg: string;
  borderColor: string;
  glowColor: string;
  nameBadgeBg: string;
  nameBadgeText: string;
  accentColor: string;
  statsBg: string;
  icon: string;
  animated: boolean;
  frameStyle: "none" | "pulse" | "shimmer" | "fire" | "galaxy";
}> = {
  default: {
    label: "Default",
    title: "",
    cardBg: "#1A1A1A",
    borderColor: "#2D2D2D",
    glowColor: "transparent",
    nameBadgeBg: "#2D2D2D",
    nameBadgeText: "#9CA3AF",
    accentColor: "#6B7280",
    statsBg: "#111111",
    icon: "",
    animated: false,
    frameStyle: "none",
  },
  active: {
    label: "Active",
    title: "Active",
    cardBg: "#1A1228",
    borderColor: "#7C3AED",
    glowColor: "rgba(124,58,237,0.3)",
    nameBadgeBg: "#2D1B69",
    nameBadgeText: "#A78BFA",
    accentColor: "#7C3AED",
    statsBg: "#110D1E",
    icon: "🟣",
    animated: false,
    frameStyle: "pulse",
  },
  grinder: {
    label: "Grinder",
    title: "The Grinder",
    cardBg: "linear-gradient(145deg, #1C1008 0%, #2A1500 100%)",
    borderColor: "#F59E0B",
    glowColor: "rgba(245,158,11,0.35)",
    nameBadgeBg: "#3D2200",
    nameBadgeText: "#FCD34D",
    accentColor: "#F59E0B",
    statsBg: "#150E00",
    icon: "🔥",
    animated: true,
    frameStyle: "fire",
  },
  elite: {
    label: "Elite",
    title: "Elite",
    cardBg: "linear-gradient(145deg, #050A1C 0%, #0A1628 50%, #050A1C 100%)",
    borderColor: "#38BDF8",
    glowColor: "rgba(56,189,248,0.4)",
    nameBadgeBg: "#0A1628",
    nameBadgeText: "#7DD3FC",
    accentColor: "#38BDF8",
    statsBg: "#03070F",
    icon: "⚡",
    animated: true,
    frameStyle: "shimmer",
  },
  untouchable: {
    label: "Untouchable",
    title: "Untouchable",
    cardBg: "linear-gradient(145deg, #0D0020 0%, #1A0035 40%, #0A001A 100%)",
    borderColor: "#E879F9",
    glowColor: "rgba(232,121,249,0.5)",
    nameBadgeBg: "#1A0035",
    nameBadgeText: "#F0ABFC",
    accentColor: "#E879F9",
    statsBg: "#07001A",
    icon: "💀",
    animated: true,
    frameStyle: "galaxy",
  },
};

// ── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, url, tier, size = 42 }: { name: string; url?: string; tier: Tier; size?: number }) {
  const cfg = TIER_CONFIG[tier];
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2.5px solid ${cfg.borderColor}`,
      boxShadow: `0 0 10px ${cfg.glowColor}`,
      overflow: "hidden", flexShrink: 0,
      background: cfg.nameBadgeBg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 800, color: cfg.accentColor,
    }}>
      {url
        ? <img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={name} />
        : initials}
    </div>
  );
}

// ── Tier badge ───────────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: Tier }) {
  const cfg = TIER_CONFIG[tier];
  if (!cfg.label || tier === "default") return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20,
      background: cfg.nameBadgeBg,
      border: `1px solid ${cfg.borderColor}`,
      color: cfg.nameBadgeText,
      fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
      textTransform: "uppercase",
      boxShadow: `0 0 6px ${cfg.glowColor}`,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Main card ────────────────────────────────────────────────────────────────
export function TierActivityCard({ card }: { card: ActivityCardData }) {
  const cfg = TIER_CONFIG[card.tier];
  const typeIcon = card.type === "workout" ? "💪" : card.type === "nutrition" ? "🥗" : "🌿";

  return (
    <>
      <style>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 8px ${cfg.glowColor}; }
          50% { box-shadow: 0 0 22px ${cfg.glowColor}, 0 0 40px ${cfg.glowColor}; }
        }
        @keyframes fire-flicker {
          0%, 100% { box-shadow: 0 0 12px rgba(245,158,11,0.4), 0 0 30px rgba(245,158,11,0.15); }
          33% { box-shadow: 0 0 20px rgba(239,68,68,0.5), 0 0 45px rgba(245,158,11,0.25); }
          66% { box-shadow: 0 0 16px rgba(245,158,11,0.6), 0 0 35px rgba(251,191,36,0.2); }
        }
        @keyframes shimmer-border {
          0% { border-color: #38BDF8; box-shadow: 0 0 15px rgba(56,189,248,0.4); }
          25% { border-color: #818CF8; box-shadow: 0 0 25px rgba(129,140,248,0.4); }
          50% { border-color: #38BDF8; box-shadow: 0 0 20px rgba(56,189,248,0.6); }
          75% { border-color: #34D399; box-shadow: 0 0 25px rgba(52,211,153,0.4); }
          100% { border-color: #38BDF8; box-shadow: 0 0 15px rgba(56,189,248,0.4); }
        }
        @keyframes galaxy-glow {
          0% { border-color: #E879F9; box-shadow: 0 0 20px rgba(232,121,249,0.5), 0 0 60px rgba(139,92,246,0.2); }
          33% { border-color: #C084FC; box-shadow: 0 0 30px rgba(192,132,252,0.6), 0 0 80px rgba(232,121,249,0.3); }
          66% { border-color: #F472B6; box-shadow: 0 0 25px rgba(244,114,182,0.5), 0 0 70px rgba(232,121,249,0.25); }
          100% { border-color: #E879F9; box-shadow: 0 0 20px rgba(232,121,249,0.5), 0 0 60px rgba(139,92,246,0.2); }
        }
        @keyframes stat-shine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      <div style={{
        background: cfg.cardBg,
        border: `2px solid ${cfg.borderColor}`,
        borderRadius: 20,
        overflow: "hidden",
        position: "relative",
        animation: cfg.frameStyle === "pulse" ? "pulse-border 2.5s ease-in-out infinite"
          : cfg.frameStyle === "fire" ? "fire-flicker 1.8s ease-in-out infinite"
          : cfg.frameStyle === "shimmer" ? "shimmer-border 3s ease-in-out infinite"
          : cfg.frameStyle === "galaxy" ? "galaxy-glow 2.5s ease-in-out infinite"
          : "none",
      }}>

        {/* Untouchable starfield overlay */}
        {card.tier === "untouchable" && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
            background: "radial-gradient(ellipse at 20% 20%, rgba(232,121,249,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.1) 0%, transparent 60%)",
          }} />
        )}

        {/* Elite shimmer overlay */}
        {card.tier === "elite" && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
            background: "linear-gradient(135deg, rgba(56,189,248,0.04) 0%, rgba(129,140,248,0.06) 50%, rgba(56,189,248,0.04) 100%)",
          }} />
        )}

        {/* Header */}
        <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
          <Avatar name={card.displayName} url={card.avatarUrl} tier={card.tier} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: "#F0F0F0" }}>{card.displayName}</span>
              <TierBadge tier={card.tier} />
            </div>
            {cfg.title && (
              <div style={{ fontSize: 10, color: cfg.accentColor, fontWeight: 700, letterSpacing: 0.5, marginTop: 1 }}>
                {cfg.title}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", flexShrink: 0 }}>{card.timeAgo}</div>
        </div>

        {/* Type banner */}
        <div style={{
          margin: "0 16px",
          padding: "8px 14px",
          borderRadius: 12,
          background: cfg.statsBg,
          border: `1px solid ${cfg.borderColor}22`,
          display: "flex", alignItems: "center", gap: 8,
          position: "relative", zIndex: 1,
        }}>
          <span style={{ fontSize: 18 }}>{typeIcon}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#F0F0F0" }}>{card.title}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{card.subtitle}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: "flex", gap: 8, padding: "10px 16px 14px",
          position: "relative", zIndex: 1,
        }}>
          {card.stats.map((stat, i) => (
            <div key={i} style={{
              flex: 1,
              background: cfg.statsBg,
              border: `1px solid ${cfg.borderColor}33`,
              borderRadius: 12,
              padding: "8px 10px",
              textAlign: "center",
              ...(card.tier === "untouchable" ? {
                background: `linear-gradient(135deg, ${cfg.statsBg}, #1A0035)`,
              } : {}),
            }}>
              <div style={{
                fontWeight: 900, fontSize: 16,
                color: cfg.accentColor,
                ...(card.tier === "elite" || card.tier === "untouchable" ? {
                  background: `linear-gradient(90deg, ${cfg.accentColor}, #fff, ${cfg.accentColor})`,
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  animation: "stat-shine 2.5s linear infinite",
                } : {}),
              }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 9, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Grinder fire bar at bottom */}
        {card.tier === "grinder" && (
          <div style={{ height: 3, background: "linear-gradient(90deg, #EF4444, #F59E0B, #EF4444)", backgroundSize: "200% 100%", animation: "stat-shine 1.5s linear infinite" }} />
        )}
        {/* Elite blue line */}
        {card.tier === "elite" && (
          <div style={{ height: 3, background: "linear-gradient(90deg, #38BDF8, #818CF8, #34D399, #38BDF8)", backgroundSize: "200% 100%", animation: "stat-shine 2s linear infinite" }} />
        )}
        {/* Untouchable galaxy line */}
        {card.tier === "untouchable" && (
          <div style={{ height: 3, background: "linear-gradient(90deg, #E879F9, #C084FC, #F472B6, #E879F9)", backgroundSize: "200% 100%", animation: "stat-shine 1.2s linear infinite" }} />
        )}
      </div>
    </>
  );
}

// ── Preview page (all 5 tiers side by side for design review) ────────────────
const DEMO_CARDS: ActivityCardData[] = [
  {
    username: "user1", displayName: "Alex Kim", tier: "default",
    type: "workout", title: "Push Day", subtitle: "Chest · Shoulders · Triceps",
    stats: [{ label: "Sets", value: "18" }, { label: "Volume", value: "6,240" }, { label: "Time", value: "52m" }],
    timeAgo: "2h ago",
  },
  {
    username: "user2", displayName: "Jordan Lee", tier: "active",
    type: "nutrition", title: "Meal Logged", subtitle: "Post-workout · 4 items",
    stats: [{ label: "Calories", value: "680" }, { label: "Protein", value: "54g" }, { label: "Carbs", value: "72g" }],
    timeAgo: "1h ago",
  },
  {
    username: "user3", displayName: "Marcus Webb", tier: "grinder",
    type: "workout", title: "Leg Day 🔥", subtitle: "Quads · Hamstrings · Glutes",
    stats: [{ label: "Sets", value: "24" }, { label: "Volume", value: "14,800" }, { label: "Time", value: "1h 14m" }],
    timeAgo: "45m ago",
  },
  {
    username: "user4", displayName: "Zara Chen", tier: "elite",
    type: "wellness", title: "Ice Bath + Breathwork", subtitle: "Recovery · 35 min",
    stats: [{ label: "Duration", value: "35m" }, { label: "Mood", value: "💪" }, { label: "Streak", value: "42d" }],
    timeAgo: "30m ago",
  },
  {
    username: "user5", displayName: "Joey Ross", tier: "untouchable",
    type: "workout", title: "Full Send 💀", subtitle: "Everything · No days off",
    stats: [{ label: "Volume", value: "28,400" }, { label: "PRs", value: "3" }, { label: "Streak", value: "91d" }],
    timeAgo: "just now",
  },
];

export default function TierCardPreview() {
  return (
    <div style={{ background: "#0D0D0D", minHeight: "100vh", padding: "32px 20px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ fontWeight: 900, fontSize: 22, color: "#F0F0F0", marginBottom: 6, textAlign: "center" }}>
          Activity Card Tiers
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 32, textAlign: "center" }}>
          Each tier has its own look — earned, never bought.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {DEMO_CARDS.map((card, i) => (
            <TierActivityCard key={i} card={card} />
          ))}
        </div>
      </div>
    </div>
  );
}

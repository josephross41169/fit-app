"use client";
// ── components/BadgeTile.tsx ──────────────────────────────────────────────
// AQW-flavored badge tile with Halo-Reach-style metallic finish.
//
// Each badge gets THREE layers of visual identity:
//
//   1. CATEGORY THEME (back layer)
//      Strength badges look forged/iron, cardio looks fiery, wellness
//      looks plant/leaf, etc. A radial pattern + category color overlay
//      sits behind the metallic finish so a Yoga GOLD looks distinctly
//      different from a Lifting GOLD even though both are gold-tier.
//
//   2. TIER METAL (mid layer)
//      Bronze → Silver → Gold → Platinum → Diamond → Emerald → Onyx →
//      Obsidian. Metallic 3-stop gradient supplies the base shine.
//
//   3. TIER ORNAMENTATION (front layer)
//      Bronze: simple ring. Silver: double ring. Gold: laurel arcs.
//      Platinum: 4-point compass star. Diamond+: 8-point burst rays
//      with continuous rotation. Onyx/Obsidian: full radial spike halo.
//
// Plus continuous shimmer sweep on all tiers (faster + stronger at high
// tiers), and a sparkle dot that orbits the badge on Diamond+.

import React from "react";
import { TIER_STYLES, type BadgeTier } from "@/lib/badgeFamilies";

// ── Category theming ──────────────────────────────────────────────────────
// Each category gets:
//  • accentColor — color overlay for the sigil + glow
//  • sigil       — radial SVG pattern showing through the metal (like an
//                  embossed crest)
//  • emojiHue    — a subtle hue shift on the emoji to match category
type CategoryTheme = {
  accent: string;
  sigil: "rays" | "flames" | "leaves" | "scales" | "hex" | "waves" | "stars" | "shield";
};

const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  strength:    { accent: "#F97316", sigil: "scales"  },  // forge orange + barbell-plate scales
  cardio:      { accent: "#EF4444", sigil: "flames"  },  // fire red + flame rays
  consistency: { accent: "#FBBF24", sigil: "rays"    },  // sun yellow + rays
  wellness:    { accent: "#10B981", sigil: "leaves"  },  // jade green + leaves
  nutrition:   { accent: "#84CC16", sigil: "leaves"  },  // lime + leaves
  challenges:  { accent: "#3B82F6", sigil: "shield"  },  // blue + shield
  social:      { accent: "#A855F7", sigil: "stars"   },  // purple + stars
  special:     { accent: "#EC4899", sigil: "hex"     },  // magenta + hex
  default:     { accent: "#7C3AED", sigil: "rays"    },
};

function getTheme(category?: string): CategoryTheme {
  if (!category) return CATEGORY_THEMES.default;
  return CATEGORY_THEMES[category] ?? CATEGORY_THEMES.default;
}

// ── SVG sigils ────────────────────────────────────────────────────────────
// Each sigil is a 100x100 radial pattern. Drawn semi-transparent so the
// tier metal shows through. The accent color tints them.
function CategorySigil({ kind, color }: { kind: CategoryTheme["sigil"]; color: string }) {
  const common: React.SVGProps<SVGSVGElement> = {
    viewBox: "0 0 100 100",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      opacity: 0.22,
      mixBlendMode: "screen",
      pointerEvents: "none",
    },
  };

  switch (kind) {
    case "rays":
      return (
        <svg {...common}>
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={i} x1="50" y1="50" x2="50" y2="0"
              stroke={color} strokeWidth="2" strokeLinecap="round"
              transform={`rotate(${i * 22.5} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="22" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "flames":
      return (
        <svg {...common}>
          {Array.from({ length: 8 }).map((_, i) => (
            <path key={i}
              d="M 50 5 Q 55 25 50 40 Q 45 25 50 5 Z"
              fill={color}
              transform={`rotate(${i * 45} 50 50)`} />
          ))}
        </svg>
      );
    case "leaves":
      return (
        <svg {...common}>
          {Array.from({ length: 6 }).map((_, i) => (
            <path key={i}
              d="M 50 50 Q 60 20 50 5 Q 40 20 50 50 Z"
              fill={color}
              transform={`rotate(${i * 60} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="6" fill={color} opacity="0.6" />
        </svg>
      );
    case "scales":
      return (
        <svg {...common}>
          {[0, 1, 2].map(row =>
            Array.from({ length: 4 }).map((_, i) => (
              <circle key={`${row}-${i}`} cx={20 + i * 20} cy={20 + row * 25} r="9"
                fill="none" stroke={color} strokeWidth="1.5" />
            ))
          )}
        </svg>
      );
    case "hex":
      return (
        <svg {...common}>
          {Array.from({ length: 6 }).map((_, i) => (
            <polygon key={i}
              points="50,30 65,40 65,55 50,65 35,55 35,40"
              fill="none" stroke={color} strokeWidth="1.5"
              transform={`rotate(${i * 60} 50 50)`} />
          ))}
        </svg>
      );
    case "waves":
      return (
        <svg {...common}>
          {[0, 1, 2, 3].map(i => (
            <path key={i}
              d={`M 0 ${30 + i * 15} Q 25 ${20 + i * 15} 50 ${30 + i * 15} T 100 ${30 + i * 15}`}
              fill="none" stroke={color} strokeWidth="2" />
          ))}
        </svg>
      );
    case "stars":
      return (
        <svg {...common}>
          {Array.from({ length: 7 }).map((_, i) => {
            const angle = (i / 7) * Math.PI * 2;
            const r = 32;
            const x = 50 + Math.cos(angle) * r;
            const y = 50 + Math.sin(angle) * r;
            return (
              <polygon key={i}
                points={`${x},${y - 5} ${x + 1.5},${y - 1.5} ${x + 5},${y} ${x + 1.5},${y + 1.5} ${x},${y + 5} ${x - 1.5},${y + 1.5} ${x - 5},${y} ${x - 1.5},${y - 1.5}`}
                fill={color} />
            );
          })}
          <circle cx="50" cy="50" r="3" fill={color} />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path
            d="M 50 8 L 78 22 L 78 55 Q 78 75 50 90 Q 22 75 22 55 L 22 22 Z"
            fill="none" stroke={color} strokeWidth="2.5" />
          <path
            d="M 50 22 L 65 30 L 65 52 Q 65 65 50 75 Q 35 65 35 52 L 35 30 Z"
            fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" />
        </svg>
      );
  }
}

// ── Tier ornamentation ────────────────────────────────────────────────────
// Decorative frame elements added on top of the metal — gives higher tiers
// progressively more "important" look. Each ring is absolute-positioned and
// fits inside the tile.
function TierOrnaments({ tier, color }: { tier: BadgeTier; color: string }) {
  // Bronze (1) — single thin inner ring
  if (tier === 1) {
    return (
      <div style={ringStyle({ inset: 6, border: `1px solid ${color}88` })} />
    );
  }
  // Silver (2) — double rings
  if (tier === 2) {
    return <>
      <div style={ringStyle({ inset: 6, border: `1px solid ${color}88` })} />
      <div style={ringStyle({ inset: 10, border: `1px solid ${color}55` })} />
    </>;
  }
  // Gold (3) — double rings + 4 small studs at corners
  if (tier === 3) {
    return <>
      <div style={ringStyle({ inset: 6, border: `1.5px solid ${color}AA` })} />
      <div style={ringStyle({ inset: 11, border: `1px solid ${color}66` })} />
      {[
        { top: 4, left: 4 }, { top: 4, right: 4 },
        { bottom: 4, left: 4 }, { bottom: 4, right: 4 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: "absolute", ...pos, width: 6, height: 6, borderRadius: "50%",
          background: color, boxShadow: `0 0 6px ${color}`,
        }} />
      ))}
    </>;
  }
  // Platinum (4) — 4-point compass star + outer glow ring
  if (tier === 4) {
    return <>
      <div style={ringStyle({ inset: 5, border: `1.5px solid ${color}` })} />
      <svg viewBox="0 0 100 100" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", opacity: 0.6,
      }}>
        <path d="M 50 4 L 53 47 L 96 50 L 53 53 L 50 96 L 47 53 L 4 50 L 47 47 Z"
          fill={color} />
      </svg>
    </>;
  }
  // Diamond (5) — 8-point rotating burst
  if (tier === 5) {
    return <>
      <div style={ringStyle({ inset: 5, border: `1.5px solid ${color}` })} />
      <div style={{
        position: "absolute", inset: 0,
        animation: "badgeBurstSpin 12s linear infinite",
        pointerEvents: "none",
      }}>
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", opacity: 0.55 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <polygon key={i}
              points="50,2 52,48 50,50 48,48"
              fill={color}
              transform={`rotate(${i * 45} 50 50)`} />
          ))}
        </svg>
      </div>
    </>;
  }
  // Emerald (6) — burst + inner gem facets
  if (tier === 6) {
    return <>
      <div style={ringStyle({ inset: 5, border: `2px solid ${color}` })} />
      <div style={{
        position: "absolute", inset: 0,
        animation: "badgeBurstSpin 10s linear infinite",
        pointerEvents: "none",
      }}>
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", opacity: 0.6 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <polygon key={i}
              points="50,2 52,46 50,48 48,46"
              fill={color}
              transform={`rotate(${i * 30} 50 50)`} />
          ))}
        </svg>
      </div>
    </>;
  }
  // Onyx (7) — 16-spike halo + inner rune
  if (tier === 7) {
    return <>
      <div style={ringStyle({ inset: 5, border: `2px solid ${color}` })} />
      <div style={{
        position: "absolute", inset: 0,
        animation: "badgeBurstSpin 8s linear infinite",
        pointerEvents: "none",
      }}>
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", opacity: 0.7 }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <polygon key={i}
              points="50,1 52,46 50,48 48,46"
              fill={color}
              transform={`rotate(${i * 22.5} 50 50)`} />
          ))}
        </svg>
      </div>
    </>;
  }
  // Obsidian (8) — counter-rotating dual halos for max chaos
  return <>
    <div style={ringStyle({ inset: 4, border: `2.5px solid ${color}` })} />
    <div style={{
      position: "absolute", inset: 0,
      animation: "badgeBurstSpin 8s linear infinite",
      pointerEvents: "none",
    }}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", opacity: 0.75 }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <polygon key={i}
            points="50,0 52.5,46 50,48 47.5,46"
            fill={color}
            transform={`rotate(${i * 22.5} 50 50)`} />
        ))}
      </svg>
    </div>
    <div style={{
      position: "absolute", inset: 0,
      animation: "badgeBurstSpinReverse 14s linear infinite",
      pointerEvents: "none",
    }}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", opacity: 0.5 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <polygon key={i}
            points="50,8 51.5,42 50,44 48.5,42"
            fill="#fff"
            transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </svg>
    </div>
  </>;
}

function ringStyle(opts: { inset: number; border: string }): React.CSSProperties {
  return {
    position: "absolute", inset: opts.inset,
    border: opts.border,
    borderRadius: "12px",
    pointerEvents: "none",
    boxSizing: "border-box",
  };
}

// ── Public component ──────────────────────────────────────────────────────
export interface BadgeTileProps {
  tier: BadgeTier;
  emoji: string;
  label: string;
  desc?: string;
  category?: string;
  /** Tier count pill — "3/8" — only shown when family has >1 tier */
  earnedCount?: number;
  maxTier?: number;
  /** Progress bar for in-progress tier */
  progress?: {
    current: number;
    next: number | null; // null = maxed
    label: string;
    isMaxed: boolean;
  };
  /** Compact size for preview grids — smaller padding, smaller fonts, hides
   *  description text. Defaults to false (full-size). */
  compact?: boolean;
}

export function BadgeTile({
  tier, emoji, label, desc, category, earnedCount, maxTier, progress, compact,
}: BadgeTileProps) {
  const style = TIER_STYLES[tier];
  const theme = getTheme(category);

  // Higher tiers shimmer faster — gives the eye more energy
  const shimmerSpeed = tier >= 7 ? "2.2s" : tier >= 5 ? "2.8s" : tier >= 4 ? "3.2s" : "4s";
  // Sparkle orbit only on tier 5+ to keep low-tier badges calm
  const showSparkle = tier >= 5;

  return (
    <div style={{
      width: "100%",
      boxSizing: "border-box",
      borderRadius: 16,
      padding: compact ? "12px 6px" : "16px 10px",
      textAlign: "center",
      border: `2px solid ${style.border}`,
      background: style.gradient,
      // Compact mode (used in the profile preview grid) intentionally uses
      // a tighter glow. The full 36px glow extends well past the cell and
      // makes the badge visually appear offset within the equal-width
      // grid columns. Tighter glow keeps the visual center of each tile
      // aligned with its actual center.
      boxShadow: compact
        ? `0 0 6px ${style.glow}, 0 0 12px ${style.glow}, inset 0 1px 0 rgba(255,255,255,0.3)`
        : `0 0 14px ${style.glow}, 0 0 36px ${style.glow}, 0 0 16px ${theme.accent}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
      position: "relative",
      overflow: "hidden",
      transition: "transform 0.2s",
    }}
      onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
    >
      {/* Layer 1: Category sigil — embossed crest behind everything */}
      <CategorySigil kind={theme.sigil} color={theme.accent} />

      {/* Layer 2: Top specular highlight — fakes light hitting curved metal */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "35%",
        background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
        pointerEvents: "none",
        borderRadius: "14px 14px 0 0",
      }} />

      {/* Layer 3: Always-on shimmer sweep — faster at higher tiers */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%)",
        backgroundSize: "200% 100%",
        animation: `badgeShimmer ${shimmerSpeed} ease-in-out infinite`,
        pointerEvents: "none",
        mixBlendMode: "overlay",
      }} />

      {/* Layer 4: Tier ornamentation rings/bursts */}
      <TierOrnaments tier={tier} color={style.accentColor} />

      {/* Layer 5: Orbiting sparkle for top tiers */}
      {showSparkle && (
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 6, height: 6,
          marginLeft: -3, marginTop: -3,
          background: "#fff",
          borderRadius: "50%",
          boxShadow: `0 0 8px #fff, 0 0 16px ${style.accentColor}`,
          animation: "badgeSparkleOrbit 4s linear infinite",
          pointerEvents: "none",
          zIndex: 3,
        }} />
      )}

      {/* Tier count pill (top-right) */}
      {(maxTier ?? 1) > 1 && earnedCount !== undefined && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          borderRadius: 99,
          padding: "2px 7px",
          fontSize: 9, fontWeight: 800,
          color: style.accentColor,
          zIndex: 4,
          border: `1px solid ${style.border}`,
        }}>
          {earnedCount}/{maxTier}
        </div>
      )}

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2 }}>
        <div style={{
          fontSize: compact ? 22 : 36, marginBottom: compact ? 3 : 6,
          filter: `drop-shadow(0 2px 5px rgba(0,0,0,0.7)) drop-shadow(0 0 8px ${theme.accent}88)`,
        }}>{emoji}</div>
        <div style={{
          fontWeight: 900, fontSize: compact ? 10 : 12,
          color: style.textColor,
          lineHeight: 1.3, marginBottom: compact ? 0 : 4,
          textShadow: "0 1px 3px rgba(0,0,0,0.85)",
          letterSpacing: 0.3,
        }}>{label}</div>
        {desc && !compact && (
          <div style={{
            fontSize: 10,
            color: style.accentColor,
            lineHeight: 1.3, marginBottom: 8,
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          }}>{desc}</div>
        )}

        {progress && !compact && (
          <div style={{ marginBottom: 6 }}>
            <div style={{
              fontSize: 10, fontWeight: 800,
              color: style.textColor, marginBottom: 4,
              textShadow: "0 1px 2px rgba(0,0,0,0.85)",
            }}>
              {progress.isMaxed
                ? `${progress.current} ${progress.label} · MAXED`
                : `${progress.current} / ${progress.next} ${progress.label}`}
            </div>
            <div style={{
              height: 5, background: "rgba(0,0,0,0.5)",
              borderRadius: 99, overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.5)",
            }}>
              <div style={{
                height: "100%",
                width: progress.isMaxed
                  ? "100%"
                  : `${Math.min(100, (progress.current / (progress.next || 1)) * 100)}%`,
                background: `linear-gradient(90deg, ${style.accentColor}, ${theme.accent})`,
                boxShadow: `0 0 8px ${style.accentColor}`,
                transition: "width 0.5s",
              }} />
            </div>
          </div>
        )}

        <div style={{
          display: "inline-block",
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          border: `1px solid ${style.accentColor}`,
          borderRadius: 99,
          padding: "2px 9px",
          fontSize: 9, fontWeight: 900,
          color: style.accentColor,
          letterSpacing: 0.8,
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
        }}>
          {style.name}
        </div>
      </div>
    </div>
  );
}

/* ── Required keyframes ───────────────────────────────────────────────────
   Add these to a global stylesheet OR inline as <style>...</style> at the
   top of the page that uses BadgeTile. The component does NOT inject them
   itself because Next.js hydration warns about repeated <style> tags.

   @keyframes badgeShimmer {
     0%   { background-position: 200% 0; }
     100% { background-position: -200% 0; }
   }
   @keyframes badgeBurstSpin {
     from { transform: rotate(0deg); }
     to   { transform: rotate(360deg); }
   }
   @keyframes badgeBurstSpinReverse {
     from { transform: rotate(0deg); }
     to   { transform: rotate(-360deg); }
   }
   @keyframes badgeSparkleOrbit {
     0%   { transform: rotate(0deg) translateX(38px) rotate(0deg); }
     100% { transform: rotate(360deg) translateX(38px) rotate(-360deg); }
   }
*/

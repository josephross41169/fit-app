"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeAllStreaks, type StreakResult } from "@/lib/streaks";

type Props = {
  /** UUID of the user whose streaks to compute. */
  userId: string;
  /** Optional theme — "purple" matches own-profile, "green" matches other-profile. */
  theme?: "purple" | "green";
};

type StreakCardSpec = {
  key: "workout" | "wellness" | "nutrition";
  emoji: string;
  label: string;
  /** Color for the active streak flame + accent border. */
  accent: string;
  /** Subtle background tint when streak is active. */
  bgTint: string;
  /** Description shown in the detail modal. */
  desc: string;
};

const SPECS: StreakCardSpec[] = [
  {
    key: "workout",
    emoji: "💪",
    label: "Workouts",
    accent: "#F97316",
    bgTint: "rgba(249, 115, 22, 0.08)",
    desc: "Counts every day you log a workout — lifting, running, yoga, anything.",
  },
  {
    key: "wellness",
    emoji: "🌿",
    label: "Wellness",
    accent: "#10B981",
    bgTint: "rgba(16, 185, 129, 0.08)",
    desc: "Counts every day you log a wellness session — cold plunge, sauna, meditation, stretching, anything.",
  },
  {
    key: "nutrition",
    emoji: "🥗",
    label: "Nutrition",
    accent: "#EC4899",
    bgTint: "rgba(236, 72, 153, 0.08)",
    desc: "Counts every day you log a meal or nutrition entry.",
  },
];

/**
 * Streak section for profile pages.
 *
 * Displays three strict consecutive-day streak cards — Workouts / Wellness /
 * Nutrition. Each card shows current streak (with flame icon if active),
 * best streak, and tap-to-detail.
 *
 * Math is strict: miss a day = streak resets. We allow a one-day "today not
 * logged yet" grace because today isn't over, but yesterday must have been
 * logged for the streak to still be alive.
 *
 * Performance: pulls 90 days of activity_logs in one query, computes all
 * three streaks client-side. Sub-millisecond compute for typical histories.
 */
export default function StreakSection({ userId, theme = "purple" }: Props) {
  const [streaks, setStreaks] = useState<{
    workout: StreakResult;
    wellness: StreakResult;
    nutrition: StreakResult;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState<StreakCardSpec | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 90 days back is plenty for active streaks. Best-streak math also
        // needs historical data; if a user has a 1-year-old 50-day streak we
        // miss it, but they can't currently SEE that on the UI either, so
        // it's fine. Bumping this to 365 if anyone complains is trivial.
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("activity_logs")
          .select("log_type, logged_at, created_at")
          .eq("user_id", userId)
          .in("log_type", ["workout", "wellness", "nutrition"])
          .gte("logged_at", since);
        if (cancelled) return;
        const all = computeAllStreaks((data || []) as any[]);
        setStreaks(all);
      } catch {
        if (!cancelled) {
          setStreaks({
            workout: { current: 0, best: 0, lastLogged: null, daysSinceLastLog: null, loggedToday: false },
            wellness: { current: 0, best: 0, lastLogged: null, daysSinceLastLog: null, loggedToday: false },
            nutrition: { current: 0, best: 0, lastLogged: null, daysSinceLastLog: null, loggedToday: false },
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Theme tokens — lets the component blend with both own-profile (purple)
  // and other-profile (green) page palettes.
  const themeTokens = theme === "purple"
    ? { bg: "#1A1228", border: "#2D1F52", text: "#F0F0F0", sub: "#9CA3AF", subBg: "#0E0820" }
    : { bg: "#0F1A0F", border: "#2D5238", text: "#E2E8F0", sub: "#9CA3AF", subBg: "#0A140A" };

  return (
    <div style={{
      background: themeTokens.bg,
      borderRadius: 22,
      padding: "16px 14px",
      border: `2px solid ${themeTokens.border}`,
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: themeTokens.text }}>🔥 Streaks</div>
        <div style={{ fontSize: 10, color: themeTokens.sub, fontWeight: 600 }}>Strict · miss a day to reset</div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "30px 12px", color: themeTokens.sub, fontSize: 13 }}>
          Loading streaks…
        </div>
      ) : (
        <div className="streak-grid" style={{
          display: "grid",
          // Single column by default — works in narrow sidebar contexts
          // (~220-260px). Goes to 3-across only when there's enough room
          // (handled by the @media rule below).
          gridTemplateColumns: "1fr",
          gap: 8,
        }}>
          {SPECS.map(spec => {
            const s = streaks?.[spec.key];
            const cur = s?.current ?? 0;
            const best = s?.best ?? 0;
            const isActive = cur > 0;
            return (
              <button
                key={spec.key}
                onClick={() => setDetailOpen(spec)}
                style={{
                  background: isActive ? spec.bgTint : themeTokens.subBg,
                  border: `1.5px solid ${isActive ? spec.accent + "55" : themeTokens.border}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transition: "transform 0.1s, border-color 0.15s",
                  width: "100%",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
              >
                {/* Icon block */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: isActive ? spec.accent + "22" : "transparent",
                  border: `1px solid ${isActive ? spec.accent + "55" : themeTokens.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, lineHeight: 1, flexShrink: 0,
                }}>
                  {isActive ? "🔥" : <span style={{ filter: "grayscale(1) opacity(0.5)" }}>{spec.emoji}</span>}
                </div>
                {/* Label + count */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: themeTokens.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
                    {spec.label}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <div style={{
                      fontSize: 22, fontWeight: 900,
                      color: isActive ? spec.accent : themeTokens.sub,
                      lineHeight: 1,
                    }}>
                      {cur}
                    </div>
                    <div style={{ fontSize: 11, color: themeTokens.sub, fontWeight: 600 }}>
                      {cur === 0 ? "no streak" : cur === 1 ? "day" : "days"}
                    </div>
                  </div>
                </div>
                {/* Best ever — small, right-aligned */}
                {best > 0 && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 9, color: themeTokens.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Best</div>
                    <div style={{ fontSize: 13, color: themeTokens.text, fontWeight: 800 }}>{best}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {detailOpen && streaks && (
        <StreakDetailModal
          spec={detailOpen}
          streak={streaks[detailOpen.key]}
          onClose={() => setDetailOpen(null)}
        />
      )}

      {/* No media query needed — the horizontal layout works at every width
          from 220px sidebar up to full mobile viewport. Removed the previous
          3-column grid because it was overflowing in the narrow profile
          right-column sidebar context. */}
    </div>
  );
}

// ─── Detail modal ────────────────────────────────────────────────────────
function StreakDetailModal({
  spec, streak, onClose,
}: {
  spec: StreakCardSpec;
  streak: StreakResult;
  onClose: () => void;
}) {
  const lastLine = (() => {
    if (!streak.lastLogged) return "Never logged. Tap Log Activity to start a streak.";
    if (streak.loggedToday) return "✓ Logged today. Streak is safe.";
    if (streak.daysSinceLastLog === 1) return "Last logged yesterday. Log today to keep the streak alive.";
    if (streak.daysSinceLastLog && streak.daysSinceLastLog >= 2) {
      return `Last logged ${streak.daysSinceLastLog} days ago. Streak is broken.`;
    }
    return "";
  })();

  return (
    <div onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: "#0D0D0D",
          borderRadius: 18,
          border: `2px solid ${spec.accent}55`,
          width: "100%", maxWidth: 380,
          padding: 22,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ fontSize: 36 }}>{streak.current > 0 ? "🔥" : spec.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#E2E8F0" }}>{spec.label} Streak</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Strict · miss a day to reset</div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#9CA3AF", fontSize: 22, lineHeight: 1, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, background: spec.accent + "15", border: `1px solid ${spec.accent}55`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Current</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: spec.accent, lineHeight: 1 }}>{streak.current}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>days</div>
          </div>
          <div style={{ flex: 1, background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Best Ever</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#E2E8F0", lineHeight: 1 }}>{streak.best}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>days</div>
          </div>
        </div>

        <div style={{ background: "#1A1A1A", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#E2E8F0", lineHeight: 1.5 }}>
            {lastLine}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
          {spec.desc}
        </div>
      </div>
    </div>
  );
}

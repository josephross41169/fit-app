"use client";

// ─── components/RecapView.tsx ──────────────────────────────────────────────
// Renders the full weekly recap UI. Used by both /recap (latest week) and
// /recap/[week] (deep link to a specific past week). Data fetching happens
// here (not in the route components) so both routes share identical UX.
//
// The component is intentionally self-contained — it owns the data fetch,
// the chart rendering, the share button modal, and the "no activity" state.
// Routes just mount it and pass the week start.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  buildRecap,
  getPreviousWeekStart,
  getSundayOfWeek,
  parseIsoDateLocal,
  isoDateLocal,
  type Recap,
} from "@/lib/recap";
import { computeAllStreaks, type StreakResult } from "@/lib/streaks";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from "recharts";

type Props = {
  /** Sunday-midnight Date for the week to render. If omitted, uses last week. */
  weekStart?: Date;
};

const COLORS = {
  bg: "#0D0D0D",
  card: "#15131D",
  border: "#2D1F52",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  purple: "#7C3AED",
  purpleLight: "#A78BFA",
  // Activity type colors — used by chart, donut, and stat cards
  lifting: "#F97316",   // orange
  cardio: "#3B82F6",    // blue
  wellness: "#10B981",  // green
  pink: "#EC4899",
};

export default function RecapView({ weekStart: weekStartProp }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [streaks, setStreaks] = useState<{
    workout: StreakResult;
    wellness: StreakResult;
    nutrition: StreakResult;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Resolve the target week. Default = previous week (recap of the just-
  // ended week, which is what users want when they tap "View Recap").
  const weekStart = useMemo(() => {
    if (weekStartProp) return weekStartProp;
    return getPreviousWeekStart();
  }, [weekStartProp]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Compute the week range in UTC ISO strings for the query
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const startIso = weekStart.toISOString();
        const endIso = weekEnd.toISOString();

        // Pull all activity logs in the week + all prior workout logs for
        // PR detection. Two queries in parallel for speed.
        const [weekLogsRes, historyLogsRes, badgesRes] = await Promise.all([
          supabase
            .from("activity_logs")
            .select("id, log_type, workout_category, workout_type, workout_duration_min, exercises, cardio, wellness_type, wellness_duration_min, logged_at, created_at")
            .eq("user_id", user.id)
            .gte("logged_at", startIso)
            .lte("logged_at", endIso),
          supabase
            .from("activity_logs")
            .select("log_type, exercises")
            .eq("user_id", user.id)
            .eq("log_type", "workout")
            .lt("logged_at", startIso),
          supabase
            .from("badges")
            .select("id, badge_id, created_at")
            .eq("user_id", user.id)
            .gte("created_at", startIso)
            .lte("created_at", endIso),
        ]);
        if (cancelled) return;

        const built = buildRecap(
          weekStart,
          (weekLogsRes.data || []) as any[],
          (historyLogsRes.data || []) as any[],
          (badgesRes.data || []) as any[]
        );
        setRecap(built);

        // Streaks are pulled separately because the streak helper expects
        // current-time data, not week-bounded. We just want to display
        // current streak counts on the recap.
        const streakSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data: streakLogs } = await supabase
          .from("activity_logs")
          .select("log_type, logged_at, created_at")
          .eq("user_id", user.id)
          .in("log_type", ["workout", "wellness", "nutrition"])
          .gte("logged_at", streakSince);
        if (cancelled) return;
        setStreaks(computeAllStreaks((streakLogs || []) as any[]));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Couldn't load recap");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, weekStart]);

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: COLORS.sub }}>
        Sign in to view your weekly recap.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: COLORS.sub }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: `4px solid ${COLORS.border}`, borderTopColor: COLORS.purple, animation: "rspin 0.8s linear infinite", margin: "0 auto 14px" }} />
        <style>{`@keyframes rspin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Loading your recap…</div>
      </div>
    );
  }

  if (error || !recap) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#FCA5A5" }}>
        ⚠️ {error || "Recap not available"}
      </div>
    );
  }

  return (
    <>
      <RecapBody recap={recap} streaks={streaks} onShare={() => setShareOpen(true)} />
      {shareOpen && <ShareModal recap={recap} onClose={() => setShareOpen(false)} />}
    </>
  );
}

// ─── The actual recap body ────────────────────────────────────────────────
// Split out so it can be rendered into a hidden offscreen div for image
// generation (sharing to social media).
function RecapBody({
  recap,
  streaks,
  onShare,
  forShare = false,
}: {
  recap: Recap;
  streaks: { workout: StreakResult; wellness: StreakResult; nutrition: StreakResult } | null;
  onShare?: () => void;
  forShare?: boolean;
}) {
  // For the share image rendering we want the recap content but not the
  // share button itself (since that wouldn't make sense in a static image).
  return (
    <div style={{
      maxWidth: 720,
      margin: "0 auto",
      padding: forShare ? 32 : "20px 16px 60px",
      color: COLORS.text,
      background: forShare ? COLORS.bg : "transparent",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: COLORS.purpleLight, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
          📊 Weekly Recap
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.text, lineHeight: 1.1 }}>
          {recap.rangeLabel}
        </div>
        <div style={{ fontSize: 13, color: COLORS.sub, marginTop: 6 }}>
          {recap.activeDays} active {recap.activeDays === 1 ? "day" : "days"} · {recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions} total sessions
        </div>
      </div>

      {/* Empty week state */}
      {!recap.hasActivity && (
        <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 18, padding: "40px 24px", textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💤</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>No activity logged this week</div>
          <div style={{ fontSize: 13, color: COLORS.sub, lineHeight: 1.5 }}>Rest weeks count too. Get back at it next week.</div>
        </div>
      )}

      {/* Stat cards */}
      {recap.hasActivity && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
          <StatCard color={COLORS.lifting} icon="💪" label="Lifts" value={recap.lifts.sessions} sub={`${Math.round(recap.lifts.totalMinutes)}m total`} />
          <StatCard color={COLORS.cardio} icon="🏃" label="Cardio" value={recap.cardio.sessions} sub={recap.cardio.totalMiles > 0 ? `${recap.cardio.totalMiles.toFixed(1)} mi` : `${Math.round(recap.cardio.totalMinutes)}m`} />
          <StatCard color={COLORS.wellness} icon="🌿" label="Wellness" value={recap.wellness.sessions} sub={`${Math.round(recap.wellness.totalMinutes)}m total`} />
        </div>
      )}

      {/* Daily activity bar chart */}
      {recap.hasActivity && (
        <ChartCard title="Your Week at a Glance" subtitle="Sessions per day · stacked by activity type">
          <DailyBarChart recap={recap} />
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 12, fontSize: 11, fontWeight: 700, color: COLORS.sub }}>
            <LegendDot color={COLORS.lifting} label="Lifting" />
            <LegendDot color={COLORS.cardio} label="Cardio" />
            <LegendDot color={COLORS.wellness} label="Wellness" />
          </div>
        </ChartCard>
      )}

      {/* Activity-type donut */}
      {recap.hasActivity && (recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions > 0) && (
        <ChartCard title="Activity Split" subtitle="By session count">
          <ActivitySplitDonut recap={recap} />
        </ChartCard>
      )}

      {/* PRs & lifts */}
      {recap.lifts.sessions > 0 && (
        <ChartCard title="Lifting" subtitle={`${recap.lifts.sessions} ${recap.lifts.sessions === 1 ? "session" : "sessions"}`}>
          {recap.lifts.prs.length > 0 ? (
            <>
              <SectionLabel>🎯 New PRs</SectionLabel>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {recap.lifts.prs.map((pr, i) => (
                  <li key={i} style={liftRowStyle}>
                    <span style={{ flex: 1, fontWeight: 700 }}>{pr.exercise}</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: COLORS.lifting }}>{pr.weight} lbs</span>
                    <span style={{ fontSize: 12, color: COLORS.sub, marginLeft: 8 }}>×{pr.reps}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : recap.lifts.bestLifts.length > 0 ? (
            <>
              <SectionLabel>Best Lifts This Week</SectionLabel>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {recap.lifts.bestLifts.map((l, i) => (
                  <li key={i} style={liftRowStyle}>
                    <span style={{ flex: 1, fontWeight: 700 }}>{l.exercise}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>{l.weight} lbs</span>
                    <span style={{ fontSize: 12, color: COLORS.sub, marginLeft: 8 }}>×{l.reps}</span>
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: 11, color: COLORS.sub, textAlign: "center", marginTop: 12, fontStyle: "italic" }}>
                No new PRs this week — keep grinding 💪
              </div>
            </>
          ) : null}
        </ChartCard>
      )}

      {/* Cardio breakdown per type */}
      {recap.cardio.sessions > 0 && (
        <ChartCard title="Cardio" subtitle={`${recap.cardio.sessions} ${recap.cardio.sessions === 1 ? "session" : "sessions"} · ${formatMinutes(recap.cardio.totalMinutes)} total`}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {recap.cardio.byType.map((c, i) => (
              <li key={i} style={liftRowStyle}>
                <span style={{ flex: 1, fontWeight: 700, textTransform: "capitalize" }}>{c.type}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
                  <span style={{ color: COLORS.sub }}>{c.sessions}× sessions</span>
                  {c.avgMiles > 0 && <span style={{ color: COLORS.cardio, fontWeight: 700 }}>{c.avgMiles.toFixed(1)} mi avg</span>}
                  <span style={{ color: COLORS.sub }}>{formatMinutes(c.totalMinutes)}</span>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      {/* Wellness breakdown per type */}
      {recap.wellness.sessions > 0 && (
        <ChartCard title="Wellness" subtitle={`${recap.wellness.sessions} ${recap.wellness.sessions === 1 ? "session" : "sessions"} · ${formatMinutes(recap.wellness.totalMinutes)} total`}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {recap.wellness.byType.map((w, i) => (
              <li key={i} style={liftRowStyle}>
                <span style={{ flex: 1, fontWeight: 700 }}>{w.type}</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: COLORS.wellness }}>{w.sessions}×</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      {/* Streaks */}
      {streaks && (recap.hasActivity || streaks.workout.current > 0 || streaks.wellness.current > 0 || streaks.nutrition.current > 0) && (
        <ChartCard title="🔥 Current Streaks" subtitle="Where you stand right now">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <StreakMini label="Workout" current={streaks.workout.current} accent={COLORS.lifting} />
            <StreakMini label="Wellness" current={streaks.wellness.current} accent={COLORS.wellness} />
            <StreakMini label="Nutrition" current={streaks.nutrition.current} accent={COLORS.pink} />
          </div>
        </ChartCard>
      )}

      {/* Badges earned */}
      {recap.badgesEarned.length > 0 && (
        <ChartCard title="🏆 Badges Earned" subtitle={`${recap.badgesEarned.length} new ${recap.badgesEarned.length === 1 ? "badge" : "badges"}`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {recap.badgesEarned.map((b, i) => (
              <div key={i} style={{
                padding: "8px 14px",
                background: COLORS.purple + "22",
                border: `1px solid ${COLORS.purple}55`,
                borderRadius: 99,
                fontSize: 12, fontWeight: 700, color: COLORS.purpleLight,
              }}>
                {prettyBadgeId(b.badge_id)}
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Share + nav buttons. Hidden in the share-image render path. */}
      {!forShare && (
        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          {onShare && (
            <button
              onClick={onShare}
              style={{
                flex: 1,
                minWidth: 160,
                background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.purpleLight})`,
                border: "none",
                color: "#fff",
                padding: "14px 20px",
                fontSize: 15,
                fontWeight: 800,
                borderRadius: 14,
                cursor: "pointer",
                boxShadow: `0 4px 14px ${COLORS.purple}55`,
              }}
            >
              📤 Share This Recap
            </button>
          )}
          <Link
            href="/feed"
            style={{
              padding: "14px 20px",
              background: COLORS.card,
              border: `1.5px solid ${COLORS.border}`,
              borderRadius: 14,
              color: COLORS.text,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ← Back to feed
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function StatCard({ color, icon, label, value, sub }: { color: string; icon: string; label: string; value: number | string; sub?: string }) {
  return (
    <div style={{
      background: COLORS.card,
      border: `1.5px solid ${color}33`,
      borderRadius: 16,
      padding: "14px 12px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: COLORS.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.sub, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: COLORS.card,
      border: `1.5px solid ${COLORS.border}`,
      borderRadius: 18,
      padding: "18px 18px 16px",
      marginBottom: 14,
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 14, color: COLORS.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: COLORS.sub, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

const liftRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: `1px solid ${COLORS.border}66`,
  fontSize: 13,
  color: COLORS.text,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.purpleLight, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

function StreakMini({ label, current, accent }: { label: string; current: number; accent: string }) {
  const active = current > 0;
  return (
    <div style={{
      background: active ? accent + "11" : COLORS.bg,
      border: `1px solid ${active ? accent + "55" : COLORS.border}`,
      borderRadius: 12,
      padding: "10px 8px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 18, marginBottom: 2 }}>{active ? "🔥" : "·"}</div>
      <div style={{ fontSize: 9, fontWeight: 800, color: COLORS.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: active ? accent : COLORS.sub }}>
        {current}
      </div>
    </div>
  );
}

function DailyBarChart({ recap }: { recap: Recap }) {
  // Chart shows SESSION COUNTS, not minutes. Reasoning: a single 8-hour
  // sleep log dwarfs everything else and made the bar chart visually
  // dishonest about week-to-week consistency. Counting sessions normalizes
  // a cold plunge and a workout to "1 thing did" each, which is the right
  // unit for "how active was I this day?".
  const data = recap.daily.map(d => ({
    day: d.label,
    Lifting: d.liftingSessions,
    Cardio: d.cardioSessions,
    Wellness: d.wellnessSessions,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 4 }}>
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: COLORS.sub }} stroke={COLORS.border} />
        <YAxis tick={{ fontSize: 10, fill: COLORS.sub }} stroke={COLORS.border} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: COLORS.text, fontWeight: 700 }}
          formatter={(value: any, name: any) => [`${value} ${value === 1 ? "session" : "sessions"}`, name]}
        />
        <Bar dataKey="Lifting" stackId="a" fill={COLORS.lifting} radius={[0, 0, 0, 0]} />
        <Bar dataKey="Cardio" stackId="a" fill={COLORS.cardio} radius={[0, 0, 0, 0]} />
        <Bar dataKey="Wellness" stackId="a" fill={COLORS.wellness} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ActivitySplitDonut({ recap }: { recap: Recap }) {
  const data = [
    { name: "Lifting", value: recap.lifts.sessions, color: COLORS.lifting },
    { name: "Cardio", value: recap.cardio.sessions, color: COLORS.cardio },
    { name: "Wellness", value: recap.wellness.sessions, color: COLORS.wellness },
  ].filter(d => d.value > 0);

  if (data.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }}
            formatter={(value: any, name: any) => [`${value} sessions`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ flex: 1, minWidth: 140 }}>
        {data.map((d, i) => {
          const total = data.reduce((s, x) => s + x.value, 0);
          const pct = Math.round((d.value / total) * 100);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
              <span style={{ flex: 1, color: COLORS.text }}>{d.name}</span>
              <span style={{ color: COLORS.sub, fontSize: 12 }}>{d.value} · {pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Share modal ──────────────────────────────────────────────────────────
// Web Share API on mobile (native share sheet). Desktop falls back to a
// download button. We render the recap to PNG using html2canvas.
function ShareModal({ recap, onClose }: { recap: Recap; onClose: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [aspectChoice, setAspectChoice] = useState<"story" | "square" | "portrait">("story");
  const [error, setError] = useState<string | null>(null);

  // Aspect ratio specs for each platform. The story (9:16) works for IG
  // Story, Snap, FB Story. Square (1:1) for IG feed and Messages.
  // Portrait (4:5) is the IG feed sweet spot for tall content.
  const aspects: Record<typeof aspectChoice, { width: number; height: number; label: string }> = {
    story: { width: 1080, height: 1920, label: "Story · 9:16" },
    square: { width: 1080, height: 1080, label: "Square · 1:1" },
    portrait: { width: 1080, height: 1350, label: "Portrait · 4:5" },
  };

  async function generateAndShare(mode: "share" | "download") {
    setError(null);
    setGenerating(true);
    try {
      const blob = await generateShareImage(recap, aspects[aspectChoice]);
      if (!blob) throw new Error("Couldn't render image");

      if (mode === "share" && typeof navigator !== "undefined" && (navigator as any).share && (navigator as any).canShare) {
        const file = new File([blob], `livelee-recap-${recap.weekStart}.png`, { type: "image/png" });
        if ((navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({
            files: [file],
            title: "My Livelee Weekly Recap",
            text: `${recap.rangeLabel} · ${recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions} sessions`,
          });
          return;
        }
      }
      // Fallback: download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `livelee-recap-${recap.weekStart}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Couldn't share");
    } finally {
      setGenerating(false);
    }
  }

  const isMobileShare = typeof navigator !== "undefined" && (navigator as any).share;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.9)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLORS.bg,
        border: `2px solid ${COLORS.border}`,
        borderRadius: 18,
        width: "100%", maxWidth: 420,
        padding: 22,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: COLORS.text }}>📤 Share Recap</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: COLORS.sub, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            Format
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {(Object.keys(aspects) as Array<keyof typeof aspects>).map(k => (
              <button
                key={k}
                onClick={() => setAspectChoice(k)}
                style={{
                  background: aspectChoice === k ? COLORS.purple : COLORS.card,
                  border: `1.5px solid ${aspectChoice === k ? COLORS.purple : COLORS.border}`,
                  borderRadius: 10,
                  padding: "10px 6px",
                  color: aspectChoice === k ? "#fff" : COLORS.text,
                  fontSize: 11, fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {aspects[k].label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: COLORS.sub, marginBottom: 16, lineHeight: 1.5 }}>
          {aspectChoice === "story"
            ? "Best for IG Story, Snap, FB Story"
            : aspectChoice === "square"
              ? "Best for IG Feed, iMessage"
              : "Best for IG Feed (tall)"}
        </div>

        {error && (
          <div style={{ background: "#3F1F1F", border: "1px solid #EF4444", color: "#FCA5A5", padding: "10px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {isMobileShare && (
            <button
              disabled={generating}
              onClick={() => generateAndShare("share")}
              style={{
                background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.purpleLight})`,
                border: "none", color: "#fff",
                padding: "12px 20px", borderRadius: 12,
                fontSize: 14, fontWeight: 800,
                cursor: generating ? "wait" : "pointer",
                opacity: generating ? 0.6 : 1,
              }}
            >
              {generating ? "Generating…" : "📲 Share to apps"}
            </button>
          )}
          <button
            disabled={generating}
            onClick={() => generateAndShare("download")}
            style={{
              background: COLORS.card,
              border: `1.5px solid ${COLORS.border}`,
              color: COLORS.text,
              padding: "12px 20px", borderRadius: 12,
              fontSize: 14, fontWeight: 800,
              cursor: generating ? "wait" : "pointer",
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? "Generating…" : "💾 Download image"}
          </button>
        </div>

        <div style={{ fontSize: 11, color: COLORS.sub, marginTop: 14, textAlign: "center", lineHeight: 1.5 }}>
          {isMobileShare
            ? "Tap Share to post directly to Instagram, Snap, Messages, etc."
            : "Download the image, then upload it to your favorite app."}
        </div>
      </div>
    </div>
  );
}

// ─── Image generation ─────────────────────────────────────────────────────
// Generates a PNG of the recap at the given dimensions. Implementation:
// render the RecapBody component into a hidden offscreen div, then use the
// Canvas API to draw it directly. We hand-roll this rather than pulling
// in html2canvas (200KB) — for our specific layout, a custom canvas
// renderer is both smaller and more controllable.
async function generateShareImage(recap: Recap, dims: { width: number; height: number }): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { resolve(null); return; }

    // ─── Background ──────────────────────────────────────────────────────
    const grad = ctx.createLinearGradient(0, 0, 0, dims.height);
    grad.addColorStop(0, "#1A0F2E");
    grad.addColorStop(0.4, "#150B22");
    grad.addColorStop(1, "#0A0612");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dims.width, dims.height);
    // Subtle radial accent in top-right for visual interest
    const accent = ctx.createRadialGradient(dims.width * 0.85, dims.height * 0.15, 0, dims.width * 0.85, dims.height * 0.15, dims.width * 0.7);
    accent.addColorStop(0, "rgba(124, 58, 237, 0.18)");
    accent.addColorStop(1, "rgba(124, 58, 237, 0)");
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, dims.width, dims.height);

    // ─── Layout planning ─────────────────────────────────────────────────
    // We compute every section's height first, then evenly distribute any
    // leftover space as padding. This ensures the image fills its full
    // height regardless of aspect ratio (1:1, 9:16, 4:5).
    const pad = Math.round(dims.width * 0.06);
    const usableW = dims.width - pad * 2;
    const totalSessions = recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions;

    // Section height estimates — relative to image height
    const headerH = Math.round(dims.height * 0.13);
    const statsH = Math.round(dims.height * 0.11);
    const chartH = Math.round(dims.height * 0.20);
    const breakdownsH = Math.round(dims.height * 0.36);
    const footerH = Math.round(dims.height * 0.04);

    // Total used vertical space — anything left becomes inter-section padding
    const totalSectionsH = headerH + statsH + chartH + breakdownsH + footerH;
    const extraSpace = dims.height - totalSectionsH - pad * 2;
    // Distribute leftover into 4 gaps between sections (header→stats, stats→
    // chart, chart→breakdowns, breakdowns→footer)
    const interGap = Math.max(pad * 0.6, extraSpace / 4);

    let y = pad;

    // ─── HEADER ──────────────────────────────────────────────────────────
    // Brand label
    ctx.fillStyle = "#A78BFA";
    ctx.font = `900 ${Math.round(dims.width * 0.026)}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("LIVELEE · WEEKLY RECAP", pad, y + Math.round(dims.width * 0.03));
    y += Math.round(dims.width * 0.045);

    // Date range — biggest text on the image
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `900 ${Math.round(dims.width * 0.058)}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(recap.rangeLabel, pad, y + Math.round(dims.width * 0.05));
    y += Math.round(dims.width * 0.07);

    // Subtitle
    ctx.fillStyle = "#9CA3AF";
    ctx.font = `600 ${Math.round(dims.width * 0.024)}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${recap.activeDays} active ${recap.activeDays === 1 ? "day" : "days"} · ${totalSessions} total sessions`, pad, y + Math.round(dims.width * 0.025));
    y = pad + headerH + interGap;

    // ─── STAT CARDS ──────────────────────────────────────────────────────
    const cardW = (usableW - pad / 2 * 2) / 3;
    const stats = [
      { color: "#F97316", label: "LIFTS", value: recap.lifts.sessions },
      { color: "#3B82F6", label: "CARDIO", value: recap.cardio.sessions },
      { color: "#10B981", label: "WELLNESS", value: recap.wellness.sessions },
    ];
    stats.forEach((s, i) => {
      const x = pad + i * (cardW + pad / 2);
      // Card body
      ctx.fillStyle = "rgba(21, 19, 29, 0.85)";
      roundRect(ctx, x, y, cardW, statsH, 18);
      ctx.fill();
      // Border
      ctx.strokeStyle = s.color + "60";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Big value number
      ctx.fillStyle = s.color;
      ctx.font = `900 ${Math.round(statsH * 0.45)}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(s.value), x + cardW / 2, y + statsH * 0.62);
      // Label
      ctx.fillStyle = "#9CA3AF";
      ctx.font = `800 ${Math.round(statsH * 0.13)}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(s.label, x + cardW / 2, y + statsH * 0.88);
    });
    ctx.textAlign = "left";
    y += statsH + interGap;

    // ─── DAILY BAR CHART ─────────────────────────────────────────────────
    // Shows session counts per day. Keeps the chart honest — sleep logs
    // (which can be 8h+) don't dominate the visual.
    drawDailyChart(ctx, recap, pad, y, usableW, chartH);
    y += chartH + interGap;

    // ─── BREAKDOWNS ──────────────────────────────────────────────────────
    // Multi-section panel: PRs, cardio per type, wellness per type.
    // Designed to fill the entire breakdownsH height — internal layout
    // adapts based on what data exists.
    drawBreakdowns(ctx, recap, pad, y, usableW, breakdownsH);
    y += breakdownsH + interGap;

    // ─── FOOTER ──────────────────────────────────────────────────────────
    ctx.fillStyle = "#A78BFA";
    ctx.font = `800 ${Math.round(dims.width * 0.026)}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("liveleeapp.com", dims.width / 2, dims.height - pad * 0.8);
    ctx.textAlign = "left";

    canvas.toBlob(b => resolve(b), "image/png", 0.95);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawDailyChart(ctx: CanvasRenderingContext2D, recap: Recap, x: number, y: number, w: number, h: number) {
  // Background card
  ctx.fillStyle = "rgba(21, 19, 29, 0.85)";
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(45, 31, 82, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const innerPad = Math.round(w * 0.04);

  // Title
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 ${Math.round(h * 0.10)}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Your Week at a Glance", x + innerPad, y + Math.round(h * 0.13));

  // Subtitle
  ctx.fillStyle = "#9CA3AF";
  ctx.font = `600 ${Math.round(h * 0.06)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText("Sessions per day", x + innerPad, y + Math.round(h * 0.21));

  // Find max sessions per day for scaling. Sessions, not minutes — keeps
  // the chart honest when one big sleep log would otherwise dominate.
  const maxSessions = Math.max(
    1,
    ...recap.daily.map(d => d.liftingSessions + d.cardioSessions + d.wellnessSessions)
  );

  // Chart area sits below the title — leave room for day labels at bottom
  const chartTop = y + Math.round(h * 0.30);
  const chartBottom = y + h - Math.round(h * 0.13);
  const chartH = chartBottom - chartTop;
  const barAreaW = w - innerPad * 2;
  const barW = (barAreaW / 7) * 0.65;
  const gap = (barAreaW / 7) - barW;

  recap.daily.forEach((d, i) => {
    const baseX = x + innerPad + i * (barW + gap) + gap / 2;
    let curY = chartBottom;

    // Wellness (bottom segment)
    if (d.wellnessSessions > 0) {
      const segH = (d.wellnessSessions / maxSessions) * chartH;
      ctx.fillStyle = "#10B981";
      ctx.fillRect(baseX, curY - segH, barW, segH);
      curY -= segH;
    }
    // Cardio (middle)
    if (d.cardioSessions > 0) {
      const segH = (d.cardioSessions / maxSessions) * chartH;
      ctx.fillStyle = "#3B82F6";
      ctx.fillRect(baseX, curY - segH, barW, segH);
      curY -= segH;
    }
    // Lifting (top — rounded corners)
    if (d.liftingSessions > 0) {
      const segH = (d.liftingSessions / maxSessions) * chartH;
      ctx.fillStyle = "#F97316";
      ctx.fillRect(baseX, curY - segH, barW, segH);
      curY -= segH;
    }

    // Day label below the chart
    ctx.fillStyle = "#9CA3AF";
    ctx.font = `700 ${Math.round(h * 0.06)}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(d.label, baseX + barW / 2, chartBottom + Math.round(h * 0.10));
  });
  ctx.textAlign = "left";
}

/**
 * Draws the breakdown panel — the bottom half of the share image. Contains
 * up to 4 sub-sections (PRs / Best lifts, Cardio, Wellness, Streaks). Each
 * sub-section gets adaptive height so the panel always fills the height
 * we were given.
 *
 * The previous version (drawHighlights) just rendered top-to-bottom and
 * left empty space at the bottom. This version pre-counts which sections
 * have data, then divides the available space evenly among them.
 */
function drawBreakdowns(
  ctx: CanvasRenderingContext2D,
  recap: Recap,
  x: number, y: number, w: number, h: number
) {
  // Background panel
  ctx.fillStyle = "rgba(21, 19, 29, 0.85)";
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(45, 31, 82, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const innerPad = Math.round(w * 0.04);

  // Determine which sections have data
  const sections: Array<{
    label: string;
    accent: string;
    lines: string[];
  }> = [];

  // Lifts: PRs preferred, else best lifts, else "no lifts this week"
  if (recap.lifts.prs.length > 0) {
    sections.push({
      label: "🎯 NEW PRs",
      accent: "#F97316",
      lines: recap.lifts.prs.slice(0, 3).map(pr => `${pr.exercise}: ${pr.weight} lbs × ${pr.reps}`),
    });
  } else if (recap.lifts.bestLifts.length > 0) {
    sections.push({
      label: "💪 BEST LIFTS",
      accent: "#F97316",
      lines: recap.lifts.bestLifts.slice(0, 3).map(l => `${l.exercise}: ${l.weight} lbs × ${l.reps}`),
    });
  }

  // Cardio breakdown
  if (recap.cardio.byType.length > 0) {
    sections.push({
      label: "🏃 CARDIO",
      accent: "#3B82F6",
      lines: recap.cardio.byType.slice(0, 3).map(c => {
        const distPart = c.avgMiles > 0 ? ` · ${c.avgMiles.toFixed(1)}mi avg` : "";
        return `${capitalize(c.type)} · ${c.sessions}× · ${formatMinutes(c.totalMinutes)}${distPart}`;
      }),
    });
  }

  // Wellness breakdown — flatten into a comma list since each entry is short
  if (recap.wellness.byType.length > 0) {
    const summary = recap.wellness.byType
      .slice(0, 5)
      .map(wt => `${wt.sessions}× ${wt.type}`)
      .join(", ");
    sections.push({
      label: "🌿 WELLNESS",
      accent: "#10B981",
      lines: [summary],
    });
  }

  // Badges
  if (recap.badgesEarned.length > 0) {
    const badgeNames = recap.badgesEarned
      .slice(0, 8)
      .map(b => prettyBadgeId(b.badge_id))
      .join(", ");
    sections.push({
      label: "🏆 BADGES EARNED",
      accent: "#A78BFA",
      lines: [badgeNames],
    });
  }

  // Empty fallback — at least say SOMETHING so the panel isn't blank
  if (sections.length === 0) {
    sections.push({
      label: "💤 REST WEEK",
      accent: "#9CA3AF",
      lines: ["No activity logged this week.", "Rest weeks count too — get back at it next week!"],
    });
  }

  // Layout: divide vertical space evenly across sections.
  // Reserve top padding for title, then split remaining height.
  const totalLines = sections.reduce((s, sec) => s + 1 + sec.lines.length, 0); // 1 for label
  const lineH = Math.round((h - innerPad * 2) / Math.max(totalLines, 1));
  // Cap line height — too-tall lines look empty
  const cappedLineH = Math.min(lineH, Math.round(w * 0.05));
  const labelFontPx = Math.round(cappedLineH * 0.65);
  const lineFontPx = Math.round(cappedLineH * 0.62);

  let curY = y + innerPad + cappedLineH * 0.2;

  sections.forEach((sec, idx) => {
    // Section label
    ctx.fillStyle = sec.accent;
    ctx.font = `900 ${labelFontPx}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(sec.label, x + innerPad, curY + cappedLineH * 0.7);
    curY += cappedLineH;

    // Section lines
    sec.lines.forEach(line => {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `700 ${lineFontPx}px -apple-system, system-ui, sans-serif`;
      // Wrap long lines so they don't overflow the panel width
      curY = wrapTextLine(ctx, line, x + innerPad, curY, w - innerPad * 2, cappedLineH);
    });

    // Spacer between sections (skip after last)
    if (idx < sections.length - 1) curY += cappedLineH * 0.3;
  });
}

/** Like wrapText but tracks vertical position and returns the new y. */
function wrapTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  maxWidth: number, lineH: number
): number {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + (line ? " " : "") + words[i];
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, curY + lineH * 0.7);
      curY += lineH;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, curY + lineH * 0.7);
    curY += lineH;
  }
  return curY;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineH: number) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + (line ? " " : "") + words[i];
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line, x, curY);
      line = words[i];
      curY += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, curY);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatMinutes(m: number): string {
  m = Math.round(m);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Convert badge_id like "first-post" to "First Post" or "partner-50" to "Partner 50".
function prettyBadgeId(id: string): string {
  return id
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

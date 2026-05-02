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
        <ChartCard title="Your Week at a Glance" subtitle="Minutes by day · stacked by activity type">
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
  const data = recap.daily.map(d => ({
    day: d.label,
    Lifting: Math.round(d.liftingMinutes),
    Cardio: Math.round(d.cardioMinutes),
    Wellness: Math.round(d.wellnessMinutes),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 4 }}>
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: COLORS.sub }} stroke={COLORS.border} />
        <YAxis tick={{ fontSize: 10, fill: COLORS.sub }} stroke={COLORS.border} />
        <Tooltip
          contentStyle={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: COLORS.text, fontWeight: 700 }}
          formatter={(value: any, name: any) => [`${value} min`, name]}
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

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, dims.height);
    grad.addColorStop(0, "#1A0F2E");
    grad.addColorStop(1, "#0D0D0D");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dims.width, dims.height);

    // Padding & font helpers
    const pad = Math.round(dims.width * 0.06);
    let y = pad * 2;

    // Brand
    ctx.fillStyle = "#A78BFA";
    ctx.font = `800 ${Math.round(dims.width * 0.024)}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("LIVELEE · WEEKLY RECAP", pad, y);
    y += pad * 1.2;

    // Date range
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `900 ${Math.round(dims.width * 0.05)}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(recap.rangeLabel, pad, y);
    y += pad * 0.5;

    // Subtitle
    ctx.fillStyle = "#9CA3AF";
    ctx.font = `600 ${Math.round(dims.width * 0.022)}px -apple-system, system-ui, sans-serif`;
    const totalSessions = recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions;
    ctx.fillText(`${recap.activeDays} active days · ${totalSessions} total sessions`, pad, y);
    y += pad * 1.4;

    // Stat cards — three columns
    const cardW = (dims.width - pad * 4) / 3;
    const cardH = Math.round(dims.height * 0.11);
    const stats = [
      { color: "#F97316", icon: "💪", label: "LIFTS", value: recap.lifts.sessions },
      { color: "#3B82F6", icon: "🏃", label: "CARDIO", value: recap.cardio.sessions },
      { color: "#10B981", icon: "🌿", label: "WELLNESS", value: recap.wellness.sessions },
    ];
    stats.forEach((s, i) => {
      const x = pad + i * (cardW + pad / 2);
      // Card bg
      ctx.fillStyle = "#15131D";
      roundRect(ctx, x, y, cardW, cardH, 16);
      ctx.fill();
      // Border
      ctx.strokeStyle = s.color + "55";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Icon
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `${Math.round(cardH * 0.3)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(s.icon, x + cardW / 2, y + cardH * 0.4);
      // Value
      ctx.fillStyle = s.color;
      ctx.font = `900 ${Math.round(cardH * 0.32)}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(String(s.value), x + cardW / 2, y + cardH * 0.78);
      // Label
      ctx.fillStyle = "#9CA3AF";
      ctx.font = `700 ${Math.round(cardH * 0.13)}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(s.label, x + cardW / 2, y + cardH * 0.95);
      ctx.textAlign = "left";
    });
    y += cardH + pad;

    // Daily bar chart
    const chartH = Math.round(dims.height * 0.22);
    drawDailyChart(ctx, recap, pad, y, dims.width - pad * 2, chartH);
    y += chartH + pad * 0.8;

    // Highlights area — PRs / wellness types / streaks
    drawHighlights(ctx, recap, pad, y, dims.width - pad * 2, dims.height - y - pad * 1.5);

    // Footer
    ctx.fillStyle = "#A78BFA";
    ctx.font = `800 ${Math.round(dims.width * 0.022)}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("liveleeapp.com", dims.width / 2, dims.height - pad * 0.6);
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
  ctx.fillStyle = "#15131D";
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = "#2D1F52";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Title
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 ${Math.round(h * 0.08)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText("Your Week at a Glance", x + 16, y + 24);

  // Find max minutes for scaling
  const maxMin = Math.max(
    1,
    ...recap.daily.map(d => d.liftingMinutes + d.cardioMinutes + d.wellnessMinutes)
  );
  const chartTop = y + 40;
  const chartBottom = y + h - 28;
  const chartH = chartBottom - chartTop;
  const barAreaW = w - 32;
  const barW = barAreaW / 7 * 0.65;
  const gap = (barAreaW / 7 - barW);

  recap.daily.forEach((d, i) => {
    const baseX = x + 16 + i * (barW + gap);
    const total = d.liftingMinutes + d.cardioMinutes + d.wellnessMinutes;
    const totalH = (total / maxMin) * chartH;
    let curY = chartBottom;

    // Wellness (bottom)
    if (d.wellnessMinutes > 0) {
      const segH = (d.wellnessMinutes / maxMin) * chartH;
      ctx.fillStyle = "#10B981";
      ctx.fillRect(baseX, curY - segH, barW, segH);
      curY -= segH;
    }
    if (d.cardioMinutes > 0) {
      const segH = (d.cardioMinutes / maxMin) * chartH;
      ctx.fillStyle = "#3B82F6";
      ctx.fillRect(baseX, curY - segH, barW, segH);
      curY -= segH;
    }
    if (d.liftingMinutes > 0) {
      const segH = (d.liftingMinutes / maxMin) * chartH;
      ctx.fillStyle = "#F97316";
      ctx.fillRect(baseX, curY - segH, barW, segH);
      curY -= segH;
    }

    // Day label
    ctx.fillStyle = "#9CA3AF";
    ctx.font = `700 ${Math.round(h * 0.07)}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(d.label, baseX + barW / 2, chartBottom + 16);
  });
  ctx.textAlign = "left";
}

function drawHighlights(ctx: CanvasRenderingContext2D, recap: Recap, x: number, y: number, w: number, h: number) {
  let curY = y;
  const lineH = Math.round(h * 0.06);

  // PRs
  if (recap.lifts.prs.length > 0) {
    ctx.fillStyle = "#A78BFA";
    ctx.font = `800 ${Math.round(lineH * 0.6)}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("🎯 NEW PRs", x, curY + lineH);
    curY += lineH * 1.3;
    recap.lifts.prs.slice(0, 3).forEach(pr => {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `700 ${Math.round(lineH * 0.55)}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(`${pr.exercise}: ${pr.weight} lbs × ${pr.reps}`, x, curY + lineH);
      curY += lineH;
    });
    curY += lineH * 0.4;
  }

  // Cardio rollup
  if (recap.cardio.byType.length > 0 && curY < y + h - lineH * 3) {
    ctx.fillStyle = "#A78BFA";
    ctx.font = `800 ${Math.round(lineH * 0.6)}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("🏃 CARDIO", x, curY + lineH);
    curY += lineH * 1.3;
    recap.cardio.byType.slice(0, 2).forEach(c => {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `700 ${Math.round(lineH * 0.55)}px -apple-system, system-ui, sans-serif`;
      const txt = `${capitalize(c.type)} · ${c.sessions}× · ${formatMinutes(c.totalMinutes)}${c.avgMiles > 0 ? ` · ${c.avgMiles.toFixed(1)}mi avg` : ""}`;
      ctx.fillText(txt, x, curY + lineH);
      curY += lineH;
    });
    curY += lineH * 0.4;
  }

  // Wellness rollup
  if (recap.wellness.byType.length > 0 && curY < y + h - lineH * 2) {
    ctx.fillStyle = "#A78BFA";
    ctx.font = `800 ${Math.round(lineH * 0.6)}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("🌿 WELLNESS", x, curY + lineH);
    curY += lineH * 1.3;
    const summary = recap.wellness.byType.slice(0, 3).map(w => `${w.sessions}× ${w.type}`).join(" · ");
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 ${Math.round(lineH * 0.55)}px -apple-system, system-ui, sans-serif`;
    // Wrap if too long
    wrapText(ctx, summary, x, curY + lineH, w, lineH);
  }
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

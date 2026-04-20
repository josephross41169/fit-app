"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

const C = {
  purple: "#7C3AED",
  purpleDark: "#6D28D9",
  gold: "#F5A623",
  cyan: "#06B6D4",
  green: "#22C55E",
  red: "#EF4444",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  bg: "#0D0D0D",
  card: "#111111",
  border: "#1A1228",
};

type TimeRange = "1M" | "3M" | "6M" | "1Y";

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function formatDate(iso: string, short = false) {
  const d = new Date(iso);
  return short
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function rangeToIso(r: TimeRange) {
  const days = r === "1M" ? 30 : r === "3M" ? 90 : r === "6M" ? 180 : 365;
  return daysAgo(days);
}

function pluralize(n: number, word: string) {
  return `${n} ${word}${n !== 1 ? "s" : ""}`;
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = C.purple }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: C.card, borderRadius: 16, padding: "18px 16px",
      border: `1.5px solid ${C.border}`, flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── WorkoutHeatmap ───────────────────────────────────────────────────────────

function WorkoutHeatmap({ dates }: { dates: string[] }) {
  const today = new Date();
  const cells: { date: string; count: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = dates.filter(dt => dt.startsWith(key)).length;
    cells.push({ date: key, count });
  }

  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  function cellColor(count: number) {
    if (count === 0) return "#1A1228";
    if (count === 1) return "#4C1D95";
    if (count === 2) return "#6D28D9";
    return "#7C3AED";
  }

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {week.map((cell, di) => (
              <div
                key={di}
                title={`${cell.date}: ${cell.count} log${cell.count !== 1 ? "s" : ""}`}
                style={{
                  width: 14, height: 14, borderRadius: 3,
                  background: cellColor(cell.count),
                  border: cell.date === today.toISOString().slice(0, 10)
                    ? `1.5px solid ${C.gold}` : "none",
                  cursor: "default",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: C.sub }}>Less</span>
        {[0, 1, 2, 3].map(v => (
          <div key={v} style={{ width: 12, height: 12, borderRadius: 2, background: cellColor(v) }} />
        ))}
        <span style={{ fontSize: 10, color: C.sub }}>More</span>
      </div>
    </div>
  );
}

// ─── CustomTooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1A1228", border: `1px solid ${C.border}`, borderRadius: 10,
      padding: "8px 12px", fontSize: 12, color: C.text,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || C.purple }}>
          {p.name}: {p.value?.toLocaleString()}{p.unit || ""}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [range, setRange] = useState<TimeRange>("3M");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"workout" | "nutrition" | "wellness">("workout");

  // --- Workout state ---
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);
  const [prList, setPrList] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  // --- Nutrition state ---
  const [nutritionLogs, setNutritionLogs] = useState<any[]>([]);

  // --- Wellness state ---
  const [wellnessLogs, setWellnessLogs] = useState<any[]>([]);

  // --- Weight state ---
  const [weightLogs, setWeightLogs] = useState<any[]>([]);

  // ── Load data ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const since = rangeToIso(range);

    try {
      // Activity logs
      const { data: logs } = await supabase
        .from("activity_logs")
        .select("id, log_type, logged_at, duration_min, calories_burned, total_volume_lbs, exercises, meals")
        .eq("user_id", user.id)
        .gte("logged_at", since)
        .order("logged_at", { ascending: true });

      if (logs) {
        setWorkoutLogs(logs.filter((l: any) => l.log_type === "workout"));
        setNutritionLogs(logs.filter((l: any) => l.log_type === "nutrition"));
        setWellnessLogs(logs.filter((l: any) => l.log_type === "wellness"));
      }

      // PRs
      const { data: prs } = await supabase
        .from("personal_records")
        .select("exercise_name, weight, reps, volume, logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(20);
      if (prs) setPrList(prs);

      // Weight logs
      const { data: wl } = await supabase
        .from("weight_logs")
        .select("weight_lbs, logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", since)
        .order("logged_at", { ascending: true });
      if (wl) setWeightLogs(wl);

      // Streak: all workout logs ever
      const { data: allLogs } = await supabase
        .from("activity_logs")
        .select("logged_at")
        .eq("user_id", user.id)
        .eq("log_type", "workout")
        .order("logged_at", { ascending: false });

      if (allLogs) {
        const uniqueDays = [...new Set(allLogs.map((l: any) => l.logged_at.slice(0, 10)))];
        let cur = 0, best = 0, prev = "";
        const today = new Date().toISOString().slice(0, 10);
        for (const day of uniqueDays) {
          if (!prev) {
            cur = (day === today || dayDiff(today, day) === 1) ? 1 : 0;
          } else {
            cur = dayDiff(prev, day) === 1 ? cur + 1 : 1;
          }
          best = Math.max(best, cur);
          prev = day;
        }
        setStreak(uniqueDays[0] === today || (uniqueDays[0] && dayDiff(today, uniqueDays[0]) === 1) ? cur : 0);
        setLongestStreak(best);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [user, range]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  function dayDiff(a: string, b: string) {
    return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
  }

  // Weekly volume chart
  function getWeeklyVolume() {
    const weeks: Record<string, number> = {};
    for (const log of workoutLogs) {
      const d = new Date(log.logged_at);
      // Week starts Monday
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const key = monday.toISOString().slice(0, 10);
      weeks[key] = (weeks[key] || 0) + (log.total_volume_lbs || 0);
    }
    return Object.entries(weeks).sort().map(([date, vol]) => ({
      date: formatDate(date, true),
      volume: Math.round(vol),
    }));
  }

  // Daily calorie chart
  function getDailyCalories() {
    const days: Record<string, { calories: number; protein: number }> = {};
    for (const log of nutritionLogs) {
      const key = log.logged_at.slice(0, 10);
      const meals: any[] = log.meals || [];
      const cal = meals.reduce((s: number, m: any) =>
        s + (m.items || []).reduce((a: number, it: any) => a + (Number(it.calories) || 0), 0), 0);
      const prot = meals.reduce((s: number, m: any) =>
        s + (m.items || []).reduce((a: number, it: any) => a + (Number(it.protein) || 0), 0), 0);
      days[key] = { calories: cal, protein: prot };
    }
    return Object.entries(days).sort().slice(-30).map(([date, v]) => ({
      date: formatDate(date, true),
      calories: Math.round(v.calories),
      protein: Math.round(v.protein),
    }));
  }

  // Workout frequency by day of week
  function getFrequencyByDay() {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const log of workoutLogs) {
      const d = new Date(log.logged_at).getDay(); // 0=Sun
      const idx = d === 0 ? 6 : d - 1;
      counts[idx]++;
    }
    return labels.map((l, i) => ({ day: l, count: counts[i] }));
  }

  // Avg weekly workout count
  const totalWorkouts = workoutLogs.length;
  const rangeWeeks = range === "1M" ? 4 : range === "3M" ? 13 : range === "6M" ? 26 : 52;
  const avgPerWeek = (totalWorkouts / rangeWeeks).toFixed(1);

  // Avg duration
  const totalDuration = workoutLogs.reduce((s, l) => s + (l.duration_min || 0), 0);
  const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;

  // Total volume
  const totalVolume = workoutLogs.reduce((s, l) => s + (l.total_volume_lbs || 0), 0);

  // Nutrition averages
  function getNutritionAvgs() {
    if (nutritionLogs.length === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const totals = nutritionLogs.reduce((s, log) => {
      const meals: any[] = log.meals || [];
      const cal = meals.reduce((a: number, m: any) =>
        a + (m.items || []).reduce((b: number, it: any) => b + (Number(it.calories) || 0), 0), 0);
      const prot = meals.reduce((a: number, m: any) =>
        a + (m.items || []).reduce((b: number, it: any) => b + (Number(it.protein) || 0), 0), 0);
      const carbs = meals.reduce((a: number, m: any) =>
        a + (m.items || []).reduce((b: number, it: any) => b + (Number(it.carbs) || 0), 0), 0);
      const fat = meals.reduce((a: number, m: any) =>
        a + (m.items || []).reduce((b: number, it: any) => b + (Number(it.fat) || 0), 0), 0);
      return { calories: s.calories + cal, protein: s.protein + prot, carbs: s.carbs + carbs, fat: s.fat + fat };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const n = nutritionLogs.length;
    return {
      calories: Math.round(totals.calories / n),
      protein: Math.round(totals.protein / n),
      carbs: Math.round(totals.carbs / n),
      fat: Math.round(totals.fat / n),
    };
  }

  const nutrAvg = getNutritionAvgs();

  // Weight trend
  const firstWeight = weightLogs[0]?.weight_lbs;
  const lastWeight = weightLogs[weightLogs.length - 1]?.weight_lbs;
  const weightDelta = firstWeight && lastWeight ? (lastWeight - firstWeight).toFixed(1) : null;

  const heatmapDates = workoutLogs.map(l => l.logged_at);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.sub, fontSize: 15 }}>Sign in to see your stats</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(13,13,13,0.95)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontWeight: 900, fontSize: 22, color: C.text }}>📊 Stats</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["1M", "3M", "6M", "1Y"] as TimeRange[]).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 12,
              background: range === r ? C.purple : "#1A1228",
              color: range === r ? "#fff" : C.sub,
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, background: C.card }}>
        {(["workout", "nutrition", "wellness"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "12px 0", border: "none", background: "transparent", cursor: "pointer",
            fontWeight: 700, fontSize: 13, textTransform: "capitalize",
            color: tab === t ? C.purple : C.sub,
            borderBottom: tab === t ? `2px solid ${C.purple}` : "2px solid transparent",
          }}>
            {t === "workout" ? "🏋️ Workout" : t === "nutrition" ? "🥗 Nutrition" : "🌿 Wellness"}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 680, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: C.sub }}>Loading your stats...</div>
        ) : (
          <>
            {/* ── WORKOUT TAB ── */}
            {tab === "workout" && (
              <>
                {/* Summary cards */}
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <StatCard label="🔥 Current Streak" value={`${streak}d`} sub="days in a row" color={C.gold} />
                  <StatCard label="🏆 Best Streak" value={`${longestStreak}d`} sub="personal best" color={C.cyan} />
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <StatCard label="Total Workouts" value={totalWorkouts} sub={`in last ${range}`} />
                  <StatCard label="Avg / Week" value={avgPerWeek} sub="workouts per week" />
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
                  <StatCard label="Avg Duration" value={`${avgDuration}m`} sub="per session" color={C.green} />
                  <StatCard label="Total Volume" value={totalVolume > 0 ? `${(totalVolume / 1000).toFixed(1)}k` : "0"} sub="lbs lifted total" />
                </div>

                {/* Activity Heatmap */}
                <Section title="📅 Activity (last 12 weeks)">
                  {heatmapDates.length > 0 ? (
                    <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
                      <WorkoutHeatmap dates={heatmapDates} />
                    </div>
                  ) : (
                    <EmptyState text="Log workouts to see your activity heatmap" />
                  )}
                </Section>

                {/* Weekly Volume Chart */}
                <Section title="📈 Weekly Volume (lbs)">
                  {workoutLogs.length > 1 ? (
                    <div style={{ background: C.card, borderRadius: 16, padding: "16px 8px 8px", border: `1px solid ${C.border}` }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={getWeeklyVolume()} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1A1228" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.sub }} />
                          <YAxis tick={{ fontSize: 10, fill: C.sub }} width={40} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="volume" name="Volume" fill={C.purple} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState text="Log at least 2 workouts to see volume trends" />
                  )}
                </Section>

                {/* Day of Week Frequency */}
                <Section title="📅 Workout Frequency by Day">
                  {workoutLogs.length > 0 ? (
                    <div style={{ background: C.card, borderRadius: 16, padding: "16px 8px 8px", border: `1px solid ${C.border}` }}>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={getFrequencyByDay()} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                          <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.sub }} />
                          <YAxis tick={{ fontSize: 11, fill: C.sub }} width={24} allowDecimals={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="count" name="Workouts" radius={[4, 4, 0, 0]}>
                            {getFrequencyByDay().map((entry, i) => (
                              <Cell key={i} fill={entry.count === Math.max(...getFrequencyByDay().map(d => d.count)) ? C.gold : C.purple} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ fontSize: 11, color: C.sub, textAlign: "center", marginTop: 4 }}>
                        Gold = your most frequent training day
                      </div>
                    </div>
                  ) : (
                    <EmptyState text="Log workouts to see your preferred training days" />
                  )}
                </Section>

                {/* PR History */}
                <Section title="🏆 Personal Records">
                  {prList.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {prList.slice(0, 10).map((pr, i) => (
                        <div key={i} style={{
                          background: C.card, borderRadius: 12, padding: "12px 14px",
                          border: `1px solid ${C.border}`,
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{pr.exercise_name}</div>
                            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                              {formatDate(pr.logged_at, true)}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 900, fontSize: 15, color: C.gold }}>
                              {pr.weight}lbs × {pr.reps}
                            </div>
                            <div style={{ fontSize: 11, color: C.sub }}>
                              {Math.round(pr.volume)} vol
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="No PRs recorded yet — keep lifting!" />
                  )}
                </Section>

                {/* Body Weight */}
                {weightLogs.length > 1 && (
                  <Section title="⚖️ Body Weight Trend">
                    <div style={{ background: C.card, borderRadius: 16, padding: "16px 8px 8px", border: `1px solid ${C.border}` }}>
                      {weightDelta !== null && (
                        <div style={{
                          textAlign: "center", marginBottom: 10, fontSize: 13, fontWeight: 700,
                          color: Number(weightDelta) < 0 ? C.green : Number(weightDelta) > 0 ? C.red : C.sub,
                        }}>
                          {Number(weightDelta) >= 0 ? "+" : ""}{weightDelta} lbs over this period
                        </div>
                      )}
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={weightLogs.map(w => ({
                          date: formatDate(w.logged_at, true),
                          weight: Number(w.weight_lbs),
                        }))} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1A1228" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.sub }} />
                          <YAxis tick={{ fontSize: 10, fill: C.sub }} width={36} domain={["auto", "auto"]} />
                          <Tooltip content={<ChartTooltip />} />
                          <Line dataKey="weight" name="Weight (lbs)" stroke={C.cyan} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Section>
                )}
              </>
            )}

            {/* ── NUTRITION TAB ── */}
            {tab === "nutrition" && (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <StatCard label="Avg Daily Calories" value={nutrAvg.calories > 0 ? nutrAvg.calories.toLocaleString() : "—"} sub="kcal per logged day" color={C.gold} />
                  <StatCard label="Avg Protein" value={nutrAvg.protein > 0 ? `${nutrAvg.protein}g` : "—"} sub="per logged day" color={C.green} />
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
                  <StatCard label="Avg Carbs" value={nutrAvg.carbs > 0 ? `${nutrAvg.carbs}g` : "—"} sub="per logged day" />
                  <StatCard label="Avg Fat" value={nutrAvg.fat > 0 ? `${nutrAvg.fat}g` : "—"} sub="per logged day" color={C.cyan} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <StatCard label="Days Logged" value={nutritionLogs.length} sub={`out of ${range} range`} />
                </div>

                <Section title="📈 Daily Calories">
                  {nutritionLogs.length > 1 ? (
                    <div style={{ background: C.card, borderRadius: 16, padding: "16px 8px 8px", border: `1px solid ${C.border}` }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={getDailyCalories()} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1A1228" />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.sub }} />
                          <YAxis tick={{ fontSize: 10, fill: C.sub }} width={40} />
                          <Tooltip content={<ChartTooltip />} />
                          <Line dataKey="calories" name="Calories" stroke={C.gold} strokeWidth={2} dot={false} />
                          <Line dataKey="protein" name="Protein (g)" stroke={C.green} strokeWidth={2} dot={false} strokeDasharray="4 2" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState text="Log nutrition to see calorie trends" />
                  )}
                </Section>
              </>
            )}

            {/* ── WELLNESS TAB ── */}
            {tab === "wellness" && (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <StatCard label="Wellness Days Logged" value={wellnessLogs.length} sub={`in ${range}`} color={C.green} />
                  <StatCard
                    label="Most Common Type"
                    value={wellnessLogs.length > 0 ? getMostCommon(wellnessLogs.map(l => l.exercises?.[0]?.name || "Unknown")) : "—"}
                    sub="activity"
                    color={C.cyan}
                  />
                </div>

                <Section title="🌿 Wellness Activity Heatmap">
                  {wellnessLogs.length > 0 ? (
                    <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
                      <WorkoutHeatmap dates={wellnessLogs.map(l => l.logged_at)} />
                    </div>
                  ) : (
                    <EmptyState text="Log wellness activities to see your consistency" />
                  )}
                </Section>

                {weightLogs.length > 1 && (
                  <Section title="⚖️ Body Weight Trend">
                    <div style={{ background: C.card, borderRadius: 16, padding: "16px 8px 8px", border: `1px solid ${C.border}` }}>
                      {weightDelta !== null && (
                        <div style={{
                          textAlign: "center", marginBottom: 10, fontSize: 13, fontWeight: 700,
                          color: Number(weightDelta) < 0 ? C.green : Number(weightDelta) > 0 ? C.red : C.sub,
                        }}>
                          {Number(weightDelta) >= 0 ? "+" : ""}{weightDelta} lbs this period
                        </div>
                      )}
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={weightLogs.map(w => ({
                          date: formatDate(w.logged_at, true),
                          weight: Number(w.weight_lbs),
                        }))} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1A1228" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.sub }} />
                          <YAxis tick={{ fontSize: 10, fill: C.sub }} width={36} domain={["auto", "auto"]} />
                          <Tooltip content={<ChartTooltip />} />
                          <Line dataKey="weight" name="Weight (lbs)" stroke={C.cyan} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function getMostCommon(arr: string[]) {
  const freq: Record<string, number> = {};
  arr.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      background: "#111", borderRadius: 16, padding: "32px 20px",
      border: "1px solid #1A1228", textAlign: "center",
      color: "#4B5563", fontSize: 13,
    }}>
      {text}
    </div>
  );
}

"use client";
import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────
// Workout Progress Graphs
//
// Default view = current calendar MONTH. Resets on the 1st of each month.
// Users can flip to recent months or rolling windows via the picker.
//
// Stats are computed from raw activity_logs rows (one per individual workout)
// so multi-workout days count correctly — two workouts in one day = 2.
// ─────────────────────────────────────────────────────────────────────────

type WorkoutData = {
  date: string; exercise: string; weight: number;
  reps: number; sets: number; volume: number;
};
type ExerciseStats = {
  name: string; bestWeight: number; lastWeight: number;
  totalVolume: number; pr: { weight: number; date: string } | null;
  history: WorkoutData[]; isCardio: boolean;
};

const C = {
  purple: "#7C3AED", purpleDark: "#1E1530", purpleMid: "#2D1F52",
  purpleBorder: "#4C3A7A", gold: "#F5A623", cyan: "#06B6D4",
  text: "#F0F0F0", sub: "#9CA3AF", green: "#4ADE80",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function fmtWeekRange(weekStart: Date): string {
  const startMonth = MONTHS[weekStart.getMonth()];
  const startDay = weekStart.getDate();
  const endDate = new Date(weekStart);
  endDate.setDate(weekStart.getDate() + 6);
  const endMonth = MONTHS[endDate.getMonth()];
  const endDay = endDate.getDate();
  if (endDate.getMonth() === weekStart.getMonth()) {
    return `${startMonth} ${startDay}–${endDay}`;
  }
  return `${startMonth} ${startDay}–${endMonth} ${endDay}`;
}

// Range key: encodes which window the user has selected.
//   "month:YYYY-M"    → specific calendar month (m is 0-indexed)
//   "rolling:3"       → last 3 months rolling
//   "rolling:6"       → last 6 months rolling
//   "all"             → everything
type RangeKey = string;

interface WorkoutProgressGraphsProps {
  workouts: any[];
}

export default function WorkoutProgressGraphs({ workouts }: WorkoutProgressGraphsProps) {
  const now = new Date();
  // Default to current calendar month — resets on the 1st.
  const defaultRange: RangeKey = `month:${now.getFullYear()}-${now.getMonth()}`;
  const [rangeKey, setRangeKey] = useState<RangeKey>(defaultRange);
  const [activeGraph, setActiveGraph] = useState<"lifting" | "cardio">("lifting");

  // ── Active date window ──────────────────────────────────────────────────
  const { rangeStart, rangeEnd, rangeLabel, isCalendarMonth } = useMemo(() => {
    if (rangeKey.startsWith("month:")) {
      const [, ym] = rangeKey.split(":");
      const [y, m] = ym.split("-").map(Number);
      const start = new Date(y, m, 1, 0, 0, 0, 0);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      const isCurrent = y === now.getFullYear() && m === now.getMonth();
      return {
        rangeStart: start,
        rangeEnd: end,
        rangeLabel: isCurrent ? MONTHS_FULL[m] : `${MONTHS_FULL[m]} ${y}`,
        isCalendarMonth: true,
      };
    }
    if (rangeKey.startsWith("rolling:")) {
      const months = parseInt(rangeKey.split(":")[1]) || 3;
      const start = new Date(now);
      start.setMonth(now.getMonth() - months);
      return {
        rangeStart: start,
        rangeEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        rangeLabel: `Last ${months} months`,
        isCalendarMonth: false,
      };
    }
    return {
      rangeStart: new Date(2000, 0, 1),
      rangeEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      rangeLabel: "All time",
      isCalendarMonth: false,
    };
  }, [rangeKey, now.getFullYear(), now.getMonth()]);

  // Build the picker options: This Month, Last Month, prior 4 months, then 3mo/6mo/All.
  // Only show prior months that actually have data so the picker doesn't sprawl.
  const monthOptions = useMemo(() => {
    const opts: { key: RangeKey; label: string }[] = [];
    const seen = new Set<string>();
    // This + last 5 calendar months
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `month:${d.getFullYear()}-${d.getMonth()}`;
      const hasData = workouts.some((w: any) => {
        const wd = new Date(w.logged_at || w.created_at || w.id || 0);
        return wd.getFullYear() === d.getFullYear() && wd.getMonth() === d.getMonth();
      });
      if (i === 0 || hasData) {
        const label = i === 0 ? "This Mo" : i === 1 ? "Last Mo" : MONTHS[d.getMonth()];
        opts.push({ key: k, label });
        seen.add(k);
      }
    }
    return opts;
  }, [workouts, now.getFullYear(), now.getMonth()]);

  // ── Filter workouts to active window ────────────────────────────────────
  const filteredWorkouts = useMemo(() => {
    return workouts.filter((w: any) => {
      const d = new Date(w.logged_at || w.created_at || w.id || 0);
      return !isNaN(d.getTime()) && d >= rangeStart && d <= rangeEnd;
    });
  }, [workouts, rangeStart, rangeEnd]);

  // ── Build exercise stats from filtered set ──────────────────────────────
  const { exerciseMap, totalCalories } = useMemo(() => {
    const m = new Map<string, ExerciseStats>();
    let cals = 0;

    filteredWorkouts.forEach((w: any) => {
      const logIso = w.logged_at || w.created_at || w.id || "";
      const logDate = fmtDate(logIso);
      cals += parseFloat(String(w.workout_calories ?? w.workout?.calories ?? 0)) || 0;

      const exList: any[] = w.exercises || w.workout?.exercises || [];
      exList.forEach((ex: any) => {
        if (!ex.name) return;
        if (!m.has(ex.name)) {
          m.set(ex.name, { name: ex.name, bestWeight: 0, lastWeight: 0, totalVolume: 0, pr: null, history: [], isCardio: false });
        }
        const stats = m.get(ex.name)!;
        const weightsArr: any[] = Array.isArray(ex.weights) ? ex.weights : [ex.weight];
        weightsArr.forEach(wRaw => {
          const weight = parseFloat(String(wRaw)) || 0;
          const reps = parseInt(String(ex.reps)) || 0;
          const sets = parseInt(String(ex.sets)) || 0;
          const volume = weight * reps * sets;
          stats.history.push({ date: logDate, exercise: ex.name, weight, reps, sets, volume });
          stats.totalVolume += volume;
          if (weight > stats.bestWeight) { stats.bestWeight = weight; stats.pr = { weight, date: logDate }; }
          stats.lastWeight = weight;
        });
      });

      const cardioList: any[] = w.cardio || w.workout?.cardio || [];
      cardioList.forEach((cardio: any) => {
        if (!cardio.type) return;
        const key = cardio.type;
        if (!m.has(key)) {
          m.set(key, { name: key, bestWeight: 0, lastWeight: 0, totalVolume: 0, pr: null, history: [], isCardio: true });
        }
        const stats = m.get(key)!;
        const distance = parseFloat(String(cardio.distance)) || 0;
        const duration = parseInt(String(cardio.duration)) || 0;
        stats.history.push({ date: logDate, exercise: key, weight: distance, reps: duration, sets: 1, volume: distance * duration });
        stats.lastWeight = distance;
        if (distance > stats.bestWeight) { stats.bestWeight = distance; stats.pr = { weight: distance, date: logDate }; }
      });
    });

    return { exerciseMap: m, totalCalories: cals };
  }, [filteredWorkouts]);

  const allExercises = Array.from(exerciseMap.values());
  const liftingExercises = allExercises.filter(e => !e.isCardio);
  const cardioExercises = allExercises.filter(e => e.isCardio);
  const totalWorkouts = filteredWorkouts.length;

  // ── Avg/Week — divide by weeks elapsed within the actual window ─────────
  // For current month: weeks elapsed since the 1st (capped at the window).
  // For past months: full weeks in that month.
  // For rolling/all: oldest workout → now span.
  const avgPerWeek = useMemo(() => {
    if (filteredWorkouts.length === 0) return "—";
    let weeksElapsed: number;
    if (isCalendarMonth) {
      const refEnd = rangeEnd > now ? now : rangeEnd;
      weeksElapsed = Math.max(1, (refEnd.getTime() - rangeStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    } else {
      // Find oldest workout in the filtered set
      let oldest = filteredWorkouts[0];
      filteredWorkouts.forEach((w: any) => {
        const wd = new Date(w.logged_at || w.created_at || w.id || 0);
        const od = new Date(oldest.logged_at || oldest.created_at || oldest.id || 0);
        if (wd < od) oldest = w;
      });
      const oldestDate = new Date(oldest.logged_at || oldest.created_at || oldest.id || 0);
      weeksElapsed = Math.max(1, (now.getTime() - oldestDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    }
    return (filteredWorkouts.length / weeksElapsed).toFixed(1);
  }, [filteredWorkouts, isCalendarMonth, rangeStart, rangeEnd, now]);

  // ── Workout TYPES this period (for the chip cloud) ──────────────────────
  // Replaces the old "Chest Workout (+2 more)" with a clean wrap of pills.
  const periodTypes = useMemo(() => {
    const counts = new Map<string, number>();
    filteredWorkouts.forEach((w: any) => {
      const raw = w.workout_type || w.workout?.type;
      if (!raw) return;
      // Strip a trailing "Day"/"day" — "Chest Day" → "Chest"
      const clean = String(raw).replace(/\s*(Day|day)\s*$/, '').trim();
      if (!clean) return;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    });
    // Sort by count desc, alphabetical tiebreak
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t, n]) => ({ type: t, count: n }));
  }, [filteredWorkouts]);

  // ── Sessions per week (lifting) ─────────────────────────────────────────
  const liftingFreqData = useMemo(() => {
    const buckets: Record<string, { count: number; startDate: Date }> = {};
    filteredWorkouts.forEach((w: any) => {
      const d = new Date(w.logged_at || w.created_at || w.id || 0);
      if (isNaN(d.getTime())) return;
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay()); weekStart.setHours(0,0,0,0);
      const key = weekStart.toISOString();
      if (!buckets[key]) buckets[key] = { count: 0, startDate: weekStart };
      buckets[key].count++;
    });
    return Object.values(buckets)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .slice(-8)
      .map(b => ({ week: fmtWeekRange(b.startDate), workouts: b.count }));
  }, [filteredWorkouts]);

  // ── Sessions per week (cardio) ──────────────────────────────────────────
  const cardioFreqData = useMemo(() => {
    const buckets: Record<string, { count: number; startDate: Date; totalDist: number }> = {};
    filteredWorkouts.forEach((w: any) => {
      const d = new Date(w.logged_at || w.created_at || w.id || 0);
      if (isNaN(d.getTime())) return;
      const cardioList: any[] = w.cardio || w.workout?.cardio || [];
      if (!cardioList.length) return;
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay()); weekStart.setHours(0,0,0,0);
      const key = weekStart.toISOString();
      if (!buckets[key]) buckets[key] = { count: 0, startDate: weekStart, totalDist: 0 };
      buckets[key].count++;
      cardioList.forEach((c: any) => {
        const dist = parseFloat(String(c.distance)) || 0;
        buckets[key].totalDist += dist;
      });
    });
    return Object.values(buckets)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .slice(-8)
      .map(b => ({ week: fmtWeekRange(b.startDate), sessions: b.count, distance: parseFloat(b.totalDist.toFixed(1)) }));
  }, [filteredWorkouts]);

  const hasLifting = liftingExercises.length > 0;
  const hasCardio = cardioExercises.length > 0;

  const tooltipStyle = {
    contentStyle: { background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 8, color: C.text },
    labelStyle: { color: C.text },
  };

  return (
    <div style={{ padding: "8px 0", color: C.text }}>
      {/* Heading shows the active window — "📊 April · Workout Progress" */}
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
        📊 {rangeLabel} · Workout Progress
      </div>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 14 }}>
        {isCalendarMonth ? "Stats reset at the start of each month." : "Rolling window."}
      </div>

      {/* Key stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
        <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Workouts</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.purple }}>{totalWorkouts}</div>
        </div>
        <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Workout Types</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>{periodTypes.length || "—"}</div>
        </div>
        <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Avg/Week</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{avgPerWeek}</div>
        </div>
      </div>

      {/* Chip cloud — shows ALL workout types in the period with their counts.
          Replaces the old single-line "Chest (+2 more)" truncation. Wraps
          naturally — handles 1 type or 12 types without breaking layout. */}
      {periodTypes.length > 0 && (
        <div style={{
          background: C.purpleDark, border: `1px solid ${C.purpleBorder}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
            What you trained
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {periodTypes.map(({ type, count }) => (
              <span key={type} style={{
                background: C.purpleMid, color: C.gold,
                fontSize: 12, fontWeight: 700,
                padding: "5px 10px", borderRadius: 999,
                border: `1px solid ${C.purpleBorder}`,
                whiteSpace: "nowrap",
              }}>
                {type}{count > 1 && <span style={{ color: C.sub, marginLeft: 5, fontWeight: 600 }}>×{count}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {totalCalories > 0 && (
        <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: C.sub }}>🔥 Calories Burned</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#FF6B6B" }}>{totalCalories.toLocaleString()} cal</span>
        </div>
      )}

      {/* Range picker — month options first, then rolling windows + All */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {monthOptions.map(({ key, label }) => (
          <button key={key} onClick={() => setRangeKey(key)} style={{
            padding: "6px 11px", fontSize: 12, fontWeight: 700,
            background: rangeKey === key ? C.purple : C.purpleDark,
            color: rangeKey === key ? "#fff" : C.sub,
            border: `1px solid ${rangeKey === key ? C.purple : C.purpleBorder}`,
            borderRadius: 8, cursor: "pointer",
          }}>
            {label}
          </button>
        ))}
        {/* Visual divider */}
        <div style={{ width: 1, background: C.purpleBorder, margin: "0 2px" }}/>
        {([
          { k: "rolling:3", lbl: "3 Mo" },
          { k: "rolling:6", lbl: "6 Mo" },
          { k: "all",       lbl: "All"  },
        ] as const).map(({ k, lbl }) => (
          <button key={k} onClick={() => setRangeKey(k)} style={{
            padding: "6px 11px", fontSize: 12, fontWeight: 700,
            background: rangeKey === k ? C.purple : C.purpleDark,
            color: rangeKey === k ? "#fff" : C.sub,
            border: `1px solid ${rangeKey === k ? C.purple : C.purpleBorder}`,
            borderRadius: 8, cursor: "pointer",
          }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Lifting/Cardio toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, background: C.purpleDark, borderRadius: 12, padding: 4, border: `1px solid ${C.purpleBorder}` }}>
        {[
          { key: "lifting" as const, icon: "💪", label: `Lifting${hasLifting ? ` (${liftingExercises.length})` : ""}` },
          { key: "cardio"  as const, icon: "🏃", label: `Cardio${hasCardio   ? ` (${cardioExercises.length})` : ""}`  },
        ].map(({ key, icon, label }) => (
          <button key={key} onClick={() => setActiveGraph(key)} style={{
            flex: 1, padding: "8px 0", border: "none", cursor: "pointer", borderRadius: 9,
            fontWeight: 700, fontSize: 13,
            background: activeGraph === key ? C.purple : "transparent",
            color: activeGraph === key ? "#fff" : C.sub,
            transition: "all 0.15s",
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* LIFTING graph */}
      {activeGraph === "lifting" && (<>
        {liftingFreqData.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📅 Sessions per Week</div>
            <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 4px 8px" }}>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={liftingFreqData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.purpleMid} vertical={false} />
                  <XAxis dataKey="week" stroke={C.sub} tick={{ fontSize: 9 }} interval={0} />
                  <YAxis stroke={C.sub} tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} itemStyle={{ color: C.purple }} />
                  <Bar dataKey="workouts" name="Sessions" fill={C.purple} radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "20px 16px", textAlign: "center", color: C.sub, fontSize: 13, marginBottom: 20 }}>
            No lifting sessions logged in this period 💪
          </div>
        )}
      </>)}

      {/* CARDIO graph */}
      {activeGraph === "cardio" && (<>
        {cardioFreqData.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🏃 Cardio Sessions per Week</div>
            <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 4px 8px" }}>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={cardioFreqData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.purpleMid} vertical={false} />
                  <XAxis dataKey="week" stroke={C.sub} tick={{ fontSize: 9 }} interval={0} />
                  <YAxis stroke={C.sub} tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} itemStyle={{ color: C.cyan }} />
                  <Bar dataKey="sessions" name="Sessions" fill={C.cyan} radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {cardioFreqData.some(d => d.distance > 0) && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: C.sub }}>📏 Distance per Week (miles)</div>
                <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 4px 8px" }}>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={cardioFreqData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.purpleMid} vertical={false} />
                      <XAxis dataKey="week" stroke={C.sub} tick={{ fontSize: 9 }} interval={0} />
                      <YAxis stroke={C.sub} tick={{ fontSize: 10 }} />
                      <Tooltip {...tooltipStyle} itemStyle={{ color: C.green }} />
                      <Line dataKey="distance" name="Distance (mi)" stroke={C.green} strokeWidth={2.5} dot={{ fill: C.green, r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "20px 16px", textAlign: "center", color: C.sub, fontSize: 13, marginBottom: 20 }}>
            No cardio logged in this period 🏃
          </div>
        )}
      </>)}
    </div>
  );
}

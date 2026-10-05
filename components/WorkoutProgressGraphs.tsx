"use client";
import { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Workout Progress Graphs
//
// Default view = current calendar MONTH. Resets on the 1st of each month.
// Users can flip to recent months or rolling windows via the picker.
//
// Stats are computed from raw activity_logs rows (one per individual workout)
// so multi-workout days count correctly — two workouts in one day = 2.
// ─────────────────────────────────────────────────────────────────────────

// Exercise→muscle-group + cardio-label helpers live in lib/workoutStats so
// the profile's Activity box can compute the same headline stats without
// pulling this chart-heavy component into the main bundle.
import { categoryForExercise, cardioChipLabel } from "@/lib/workoutStats";

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
  purple: "#5BBE93", purpleDark: "#1E1530", purpleMid: "#1B231E",
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

  // ── Headline counts: Lifts + Cardio ───────────────────────────────────
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

  // ── Muscle groups + cardio types this period (for the chip cloud) ───────
  // Replaces the old chip cloud that read `workout_type` (the freeform title
  // the user typed when logging). That meant if someone titled a workout
  // "imgay" the chip would literally say "imgay". Now we derive categories
  // from the actual exercise data:
  //   • lifting exercises → look up category in EXERCISES (Chest, Back, …)
  //   • cardio entries     → use cardio.type directly (Run, Cycling, …)
  //
  // The chip used to also show the most-recent date trained ("Running ×4 · May 7"),
  // but Joey reported users misread that as "did 4 runs ON May 7" rather than
  // "last ran May 7". Dates are dropped — count is the only number on the chip.
  // Lifting and cardio chips are returned as separate arrays so the render
  // can section them under their own headers.
  const { liftingChips, cardioChips } = useMemo(() => {
    type Bucket = { count: number };
    const liftBuckets = new Map<string, Bucket>();
    const cardioBuckets = new Map<string, Bucket>();

    // Per-workout dedupe — a single workout containing 5 chest exercises
    // should count as ONE Chest session, not 5. We collect all categories
    // hit per workout into a Set, then bump each bucket once.
    filteredWorkouts.forEach((w: any) => {
      const hitCategories = new Set<string>();
      const hitCardio = new Set<string>();

      const exList: any[] = w.exercises || w.workout?.exercises || [];
      exList.forEach((ex: any) => {
        const cat = categoryForExercise(ex?.name || '');
        if (cat) hitCategories.add(cat);
      });

      const cardioList: any[] = w.cardio || w.workout?.cardio || [];
      cardioList.forEach((c: any) => {
        // Running entries split by run_type (Outdoor / Treadmill / Trail /
        // HIIT Run) so subtypes read as distinct chips; other cardio and
        // legacy runs without a run_type fall back to the canonical label.
        const t = cardioChipLabel(c);
        if (t) hitCardio.add(t);
      });

      hitCategories.forEach(cat => {
        const b = liftBuckets.get(cat) || { count: 0 };
        b.count += 1;
        liftBuckets.set(cat, b);
      });
      hitCardio.forEach(t => {
        const b = cardioBuckets.get(t) || { count: 0 };
        b.count += 1;
        cardioBuckets.set(t, b);
      });
    });

    // Sort by sessions desc, then alphabetical.
    const sortChips = (m: Map<string, Bucket>) =>
      Array.from(m.entries())
        .sort((a, b) => b[1].count !== a[1].count ? b[1].count - a[1].count : a[0].localeCompare(b[0]))
        .map(([name, b]) => ({ name, count: b.count }));

    return { liftingChips: sortChips(liftBuckets), cardioChips: sortChips(cardioBuckets) };
  }, [filteredWorkouts]);

  // ── Headline counts: Lifts + Cardio ───────────────────────────────────
  // These tally the chips above so users can verify by adding the chip
  // counts. Earlier the count was "distinct workout sessions containing
  // a lift" which led to confusing math: a user who saw chips for
  // Biceps ×1, Chest ×1, Legs ×1 expected Lifts: 3 but got Lifts: 2
  // because two of those happened in a single session. Joey's note:
  // "How does it say ive worked out chest, legs, and biceps but Im at
  // 2 lifts?" Reading the chip-sum makes the number match what's on
  // screen — every muscle-group ×1 is a +1 to Lifts. Same for Cardio.
  //
  // Note: a single workout containing biceps + chest contributes 2 to
  // the Lifts count, since the chip cloud shows two separate ×1
  // entries. That's the user's mental model; we follow it.
  const liftingSessionCount = useMemo(
    () => liftingChips.reduce((sum, c) => sum + c.count, 0),
    [liftingChips]
  );
  const cardioSessionCount = useMemo(
    () => cardioChips.reduce((sum, c) => sum + c.count, 0),
    [cardioChips]
  );

  // ── Week-by-week summaries (newest first) ───────────────────────────────
  // One card per week instead of bar/line charts: how many sessions, and
  // how much (distance + time for cardio; sets, volume, muscles for lifting).
  const weeks = useMemo(() => {
    type Wk = { start: Date; lift: number; sets: number; volume: number; groups: Record<string, number>;
                cardio: number; miles: number; minutes: number; types: Record<string, number> };
    const map: Record<string, Wk> = {};
    const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return isNaN(n) ? 0 : n; };
    filteredWorkouts.forEach((w: any) => {
      const d = new Date(w.logged_at || w.created_at || w.id || 0);
      if (isNaN(d.getTime())) return;
      const ws = new Date(d); ws.setDate(d.getDate() - d.getDay()); ws.setHours(0, 0, 0, 0);
      const key = ws.toISOString();
      const wk = map[key] ||= { start: ws, lift: 0, sets: 0, volume: 0, groups: {}, cardio: 0, miles: 0, minutes: 0, types: {} };
      const exs: any[] = (w.exercises || w.workout?.exercises || []).filter((e: any) => e?.name);
      if (exs.length) {
        wk.lift++;
        const hit = new Set<string>();
        exs.forEach((e: any) => {
          const n = parseInt(e.sets) || 0; wk.sets += n;
          const reps: any[] = Array.isArray(e.repsArr) && e.repsArr.length ? e.repsArr : Array(n).fill(e.reps);
          const wts: any[] = Array.isArray(e.weights) && e.weights.length ? e.weights : Array(n).fill(e.weight);
          if (!e.bodyweight && !e.timed) for (let k = 0; k < n; k++) wk.volume += num(wts[k]) * num(reps[k]);
          const g = categoryForExercise(e.name); if (g && g !== "Cardio") hit.add(g);
        });
        hit.forEach(g => { wk.groups[g] = (wk.groups[g] || 0) + 1; });
      }
      const cs: any[] = (w.cardio || w.workout?.cardio || []).filter(Boolean);
      if (cs.length) {
        wk.cardio++;
        cs.forEach((c: any) => {
          if (!/swim/i.test(String(c.type || ""))) wk.miles += num(c.distance);
          else if (c.miles) wk.miles += num(c.miles);
          wk.minutes += num(c.duration);
          const t = cardioChipLabel(c) || "Cardio"; wk.types[t] = (wk.types[t] || 0) + 1;
        });
      }
    });
    return Object.values(map).sort((a, b) => b.start.getTime() - a.start.getTime());
  }, [filteredWorkouts]);
  const liftWeeks = weeks.filter(w => w.lift > 0);
  const cardioWeeks = weeks.filter(w => w.cardio > 0);
  const thisWeekStart = (() => { const t = new Date(); t.setDate(t.getDate() - t.getDay()); t.setHours(0, 0, 0, 0); return t.getTime(); })();
  const weekName = (d: Date) => d.getTime() === thisWeekStart ? "This week" : d.getTime() === thisWeekStart - 7 * 86400000 ? "Last week" : fmtWeekRange(d);
  const fmtMin = (m: number) => { const h = Math.floor(m / 60), r = Math.round(m % 60); return h ? `${h}h${r ? ` ${r}m` : ""}` : `${r}m`; };
  const fmtVol = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v));

  const hasLifting = liftingExercises.length > 0;
  const hasCardio = cardioExercises.length > 0;


  return (
    <div style={{ padding: "8px 0", color: C.text }}>
      {/* Heading shows the active window — "📊 April · Workout Progress" */}
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
        📊 {rangeLabel} · Workout Progress
      </div>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 14 }}>
        {isCalendarMonth ? "Stats reset at the start of each month." : "Rolling window."}
      </div>

      {/* Key stats — 4-up grid: Lifts / Cardio / Muscle Groups / Avg/Week.
          Previously this was a 3-up showing "Workouts" (the total
          activity_log row count) which double-counted any day that had
          both lifts and cardio. Users couldn't reconcile the number
          with what they'd actually done — "I trained biceps, chest,
          legs and ran a few times, why does it say 5?" Splitting into
          two peer stats (lift sessions + cardio sessions) reads cleanly
          regardless of overlap. Cardio gets a cyan accent matching the
          chip cloud below so the visual link is obvious.

          On narrow viewports the 4-col grid wraps to 2x2 thanks to
          minmax(0, 1fr) so cards never collapse below readable size. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 10, marginBottom: 12,
      }}>
        <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>💪 Lifts</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>{liftingSessionCount}</div>
        </div>
        <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>🏃 Cardio</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.cyan }}>{cardioSessionCount}</div>
        </div>
        <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Muscle Groups</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.purple }}>{liftingChips.length || "—"}</div>
        </div>
        <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Avg/Week</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{avgPerWeek}</div>
        </div>
      </div>

      {/* Chip cloud — derived from real exercise + cardio data, NOT the user's
          freeform workout title. Splits into two rows: Lifting (per muscle
          group) and Cardio (per type). Each chip shows just the count —
          dates were removed because users were reading "×4 · May 7" as
          "4 sessions on May 7" rather than "4 sessions, last on May 7".
          Per-cardio-type emoji (🏊 Swimming, 🚴 Cycling, …) replaces the
          generic 🏃 so swimming doesn't show with a runner icon. */}
      {(liftingChips.length > 0 || cardioChips.length > 0) && (
        <div style={{
          background: C.purpleDark, border: `1px solid ${C.purpleBorder}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 14,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 1.2 }}>
            What you trained
          </div>

          {liftingChips.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                💪 Lifting
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {liftingChips.map(({ name, count }) => (
                  <span key={name} style={{
                    background: C.purpleMid,
                    color: C.gold,
                    fontSize: 12, fontWeight: 700,
                    padding: "5px 10px", borderRadius: 999,
                    border: `1px solid ${C.purpleBorder}`,
                    whiteSpace: "nowrap",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
                    <span>{name}</span>
                    <span style={{ color: C.sub, fontWeight: 600 }}>×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {cardioChips.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.cyan, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                🏃 Cardio
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {cardioChips.map(({ name, count }) => {
                  // Per-discipline emoji so the chip reads clearly. Falls
                  // back to a generic 🏃 for unknown types.
                  const emoji =
                    name === "Running"      ? "🏃" :
                    name === "Walking"      ? "🚶" :
                    name === "Cycling"      ? "🚴" :
                    name === "Swimming"     ? "🏊" :
                    name === "Rowing"       ? "🚣" :
                    name === "Hiking"       ? "🥾" :
                    name === "Elliptical"   ? "🌀" :
                    name === "Stair Climber"? "🪜" :
                    name === "HIIT"         ? "⚡" :
                                              "🏃";
                  return (
                    <span key={name} style={{
                      background: C.purpleMid,
                      color: C.cyan,
                      fontSize: 12, fontWeight: 700,
                      padding: "5px 10px", borderRadius: 999,
                      border: `1px solid ${C.purpleBorder}`,
                      whiteSpace: "nowrap",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                      <span>{emoji} {name}</span>
                      <span style={{ color: C.sub, fontWeight: 600 }}>×{count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
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
          { key: "lifting" as const, icon: "💪", label: `Lifting${liftingSessionCount > 0 ? ` (${liftingSessionCount})` : ""}` },
          { key: "cardio"  as const, icon: "🏃", label: `Cardio${cardioSessionCount > 0  ? ` (${cardioSessionCount})` : ""}`  },
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

      {/* Week-by-week cards (replaces the bar/line charts) */}
      {(() => {
        const isLift = activeGraph === "lifting";
        const list = isLift ? liftWeeks : cardioWeeks;
        const accent = isLift ? C.gold : C.cyan;
        if (!list.length) return (
          <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "20px 16px", textAlign: "center", color: C.sub, fontSize: 13, marginBottom: 20 }}>
            {isLift ? "No lifting sessions logged in this period 💪" : "No cardio logged in this period 🏃"}
          </div>
        );
        const tot = list.reduce((a, w) => ({ s: a.s + (isLift ? w.lift : w.cardio), x: a.x + (isLift ? w.sets : w.miles), y: a.y + (isLift ? w.volume : w.minutes) }), { s: 0, x: 0, y: 0 });
        const best = Math.max(...list.map(w => isLift ? w.volume || w.sets : w.miles || w.minutes), 1);
        const totals = isLift
          ? [{ l: "Sessions", v: String(tot.s) }, { l: "Sets", v: String(tot.x) }, { l: "Volume", v: tot.y ? `${fmtVol(tot.y)} lbs` : "—" }]
          : [{ l: "Sessions", v: String(tot.s) }, { l: "Distance", v: `${Math.round(tot.x * 10) / 10} mi` }, { l: "Time", v: tot.y ? fmtMin(tot.y) : "—" }];
        return (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
              {totals.map(t => (
                <div key={t.l} style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 19, fontWeight: 900, color: accent }}>{t.v}</div>
                  <div style={{ fontSize: 10.5, color: C.sub, fontWeight: 700, marginTop: 2 }}>{t.l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Week by week</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map(w => {
                const count = isLift ? w.lift : w.cardio;
                const size = isLift ? (w.volume || w.sets) : (w.miles || w.minutes);
                const chips = Object.entries(isLift ? w.groups : w.types).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={w.start.toISOString()} style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{weekName(w.start)}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                          {Array.from({ length: 7 }, (_, i) => (
                            <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < count ? accent : C.purpleMid, border: i < count ? "none" : `1px solid ${C.purpleBorder}` }} />
                          ))}
                          <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginLeft: 6 }}>{count} session{count === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: accent, lineHeight: 1.1 }}>
                          {isLift ? `${w.sets} sets` : w.miles ? `${Math.round(w.miles * 10) / 10} mi` : w.minutes ? fmtMin(w.minutes) : `${count}×`}
                        </div>
                        <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>
                          {isLift ? (w.volume ? `${fmtVol(w.volume)} lbs moved` : "bodyweight") : (w.miles && w.minutes ? fmtMin(w.minutes) : "")}
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 6, background: C.purpleMid, borderRadius: 99, overflow: "hidden", margin: "10px 0 8px" }}>
                      <div style={{ height: "100%", width: `${Math.max(4, (size / best) * 100)}%`, background: `linear-gradient(90deg, ${accent}, ${accent}99)`, borderRadius: 99 }} />
                    </div>
                    {chips.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {chips.map(([n, c]) => (
                          <span key={n} style={{ fontSize: 11, fontWeight: 700, color: C.text, background: C.purpleMid, border: `1px solid ${C.purpleBorder}`, borderRadius: 99, padding: "2px 8px" }}>
                            {n}{c > 1 ? <span style={{ color: C.sub }}> ×{c}</span> : null}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

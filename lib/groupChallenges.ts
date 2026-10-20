// ─── lib/groupChallenges.ts ─────────────────────────────────────────────────
// Shared definitions + scoring for group challenges (v2). Used by the API
// (scoring from activity_logs) and the UI (task picker, presets, summaries).
//
// Two kinds of challenge:
//   points — tasks earn points per unit (10 / workout, 3 / mile…). Most wins.
//   daily  — a checklist every day. Tasks with a `metric` tick themselves from
//            what people log; tasks with `manual` can be checked off by hand.
//            `strict` challenges reset you to day 1 when you miss a day.

// ── Metrics we can read from activity_logs, per person per day ──────────────
export type MetricKey =
  | "workout" | "lift" | "run_mi" | "walk_mi" | "bike_mi" | "active_min" | "steps"
  | "meal" | "protein_g" | "water_oz"
  | "cold_plunge" | "sauna" | "meditation" | "yoga" | "wellness"
  // "day" metrics: 1 on days a threshold is hit
  | "steps_10k_day" | "protein_day" | "water_day";

export type TaskDef = {
  key: MetricKey;
  label: string;
  emoji: string;
  unit: string;          // "workout", "mile", "meal"…
  group: "Physical" | "Meals" | "Wellness";
  defaultPoints: number;
  decimals?: boolean;    // miles can be fractional
};

// Tasks offered in "Make your own" (points challenges), grouped for the picker.
export const TASKS: TaskDef[] = [
  { key: "workout",       label: "Workout",          emoji: "💪", unit: "workout", group: "Physical", defaultPoints: 10 },
  { key: "lift",          label: "Lift session",     emoji: "🏋️", unit: "session", group: "Physical", defaultPoints: 10 },
  { key: "run_mi",        label: "Miles run",        emoji: "🏃", unit: "mile",    group: "Physical", defaultPoints: 3, decimals: true },
  { key: "walk_mi",       label: "Miles walked",     emoji: "🚶", unit: "mile",    group: "Physical", defaultPoints: 1, decimals: true },
  { key: "bike_mi",       label: "Miles biked",      emoji: "🚴", unit: "mile",    group: "Physical", defaultPoints: 1, decimals: true },
  { key: "active_min",    label: "Active minutes",   emoji: "⏱️", unit: "minute",  group: "Physical", defaultPoints: 1 },
  { key: "steps_10k_day", label: "10K-step day",     emoji: "👟", unit: "day",     group: "Physical", defaultPoints: 5 },
  { key: "meal",          label: "Meal logged",      emoji: "🥗", unit: "meal",    group: "Meals",    defaultPoints: 2 },
  { key: "protein_day",   label: "100g protein day", emoji: "🥩", unit: "day",     group: "Meals",    defaultPoints: 5 },
  { key: "water_day",     label: "64 oz water day",  emoji: "💧", unit: "day",     group: "Meals",    defaultPoints: 3 },
  { key: "cold_plunge",   label: "Cold plunge",      emoji: "🧊", unit: "session", group: "Wellness", defaultPoints: 5 },
  { key: "sauna",         label: "Sauna",            emoji: "🔥", unit: "session", group: "Wellness", defaultPoints: 3 },
  { key: "meditation",    label: "Meditation",       emoji: "🧘", unit: "session", group: "Wellness", defaultPoints: 3 },
  { key: "yoga",          label: "Yoga",             emoji: "🤸", unit: "session", group: "Wellness", defaultPoints: 5 },
  { key: "wellness",      label: "Any wellness",     emoji: "🌿", unit: "session", group: "Wellness", defaultPoints: 2 },
];
export const TASK_BY_KEY: Record<string, TaskDef> = Object.fromEntries(TASKS.map(t => [t.key, t]));

// ── Challenge task shapes stored in gchallenges.tasks ───────────────────────
export type PointsTask = { key: MetricKey; points: number };
export type DailyTask = {
  id: string;            // stable id for check-ins ("workouts", "water"…)
  label: string;
  emoji: string;
  metric?: MetricKey;    // auto-tracked when the day's metric >= min
  min?: number;
  manual?: boolean;      // can be checked off by hand
  restPerWeek?: number;  // allowed misses per 7-day block (75 Soft workouts)
};

export type ChallengeRow = {
  id: string; group_id: string; created_by: string | null;
  name: string; emoji: string; description: string | null;
  kind: "points" | "daily"; preset: string | null;
  tasks: any[]; target: number | null;
  start_date: string; days: number; strict: boolean; created_at?: string;
};

// ── Presets ("Popular") ─────────────────────────────────────────────────────
export type Preset = {
  id: string; name: string; emoji: string; blurb: string;
  kind: "points" | "daily"; days: number; strict: boolean;
  tasks: any[]; target?: number;
};

export const PRESETS: Preset[] = [
  {
    id: "75_hard", name: "75 Hard", emoji: "🔥", kind: "daily", days: 75, strict: true,
    blurb: "2 workouts, clean eating, water, reading — 75 days, no misses",
    tasks: [
      { id: "workouts", label: "Do 2 workouts", emoji: "💪", metric: "workout", min: 2 },
      { id: "meals", label: "Log every meal (3+)", emoji: "🥗", metric: "meal", min: 3 },
      { id: "water", label: "Drink a gallon of water", emoji: "💧", metric: "water_oz", min: 128, manual: true },
      { id: "read", label: "Read 10 pages", emoji: "📖", manual: true },
    ],
  },
  {
    id: "75_soft", name: "75 Soft", emoji: "🌤️", kind: "daily", days: 75, strict: true,
    blurb: "1 workout a day with 1 rest day a week, eat well — 75 days",
    tasks: [
      { id: "workout", label: "Work out (1 rest day a week)", emoji: "💪", metric: "workout", min: 1, restPerWeek: 1 },
      { id: "meals", label: "Log your meals (2+)", emoji: "🥗", metric: "meal", min: 2 },
      { id: "water", label: "Drink 3 liters of water", emoji: "💧", metric: "water_oz", min: 101, manual: true },
      { id: "read", label: "Read 10 pages", emoji: "📖", manual: true },
    ],
  },
  {
    id: "100_mile_month", name: "100 Mile Month", emoji: "🏃", kind: "points", days: 30, strict: false, target: 100,
    blurb: "Run or walk 100 miles in 30 days",
    tasks: [{ key: "run_mi", points: 1 }, { key: "walk_mi", points: 1 }],
  },
  {
    id: "30_day_streak", name: "30-Day Streak", emoji: "📅", kind: "daily", days: 30, strict: true,
    blurb: "Work out every day for 30 days",
    tasks: [{ id: "workout", label: "Log a workout", emoji: "💪", metric: "workout", min: 1 }],
  },
  {
    id: "21_cold_plunge", name: "21-Day Cold Plunge", emoji: "🧊", kind: "daily", days: 21, strict: true,
    blurb: "Cold plunge every day for 21 days",
    tasks: [{ id: "plunge", label: "Cold plunge", emoji: "🧊", metric: "cold_plunge", min: 1 }],
  },
  {
    id: "clean_eating_30", name: "Clean Eating 30", emoji: "🥗", kind: "daily", days: 30, strict: false,
    blurb: "Log every meal for 30 days",
    tasks: [{ id: "meals", label: "Log 3+ meals", emoji: "🥗", metric: "meal", min: 3 }],
  },
  {
    id: "10k_steps", name: "10K Steps a Day", emoji: "👟", kind: "daily", days: 30, strict: false,
    blurb: "10,000 steps daily for 30 days",
    tasks: [{ id: "steps", label: "Walk 10,000 steps", emoji: "👟", metric: "steps", min: 10000 }],
  },
];
export const PRESET_BY_ID: Record<string, Preset> = Object.fromEntries(PRESETS.map(p => [p.id, p]));

// ── Dates ───────────────────────────────────────────────────────────────────
// Days are "YYYY-MM-DD" strings. The viewer's timezone offset (minutes, as
// from Date#getTimezoneOffset) is used to bucket log timestamps into days.
export function dayOf(iso: string, tzOffsetMin = 0): string {
  const t = new Date(iso).getTime() - tzOffsetMin * 60000;
  return new Date(t).toISOString().slice(0, 10);
}
export function todayStr(tzOffsetMin = 0): string {
  return dayOf(new Date().toISOString(), tzOffsetMin);
}
export function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
}
export function endDate(c: { start_date: string; days: number }): string {
  return addDays(c.start_date, c.days - 1);
}
export function statusOf(c: { start_date: string; days: number }, today: string): "upcoming" | "live" | "ended" {
  if (today < c.start_date) return "upcoming";
  if (today > endDate(c)) return "ended";
  return "live";
}

// ── Turning activity_logs rows into per-day metrics ─────────────────────────
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return isNaN(n) ? 0 : n; };

export const LOG_COLUMNS =
  "user_id, log_type, logged_at, created_at, exercises, cardio, workout_category, workout_duration_min, wellness_type, wellness_duration_min, steps, meal_type, protein_g, water_oz, notes";

export type DayMetrics = Partial<Record<MetricKey, number>>;

export function metricsByUserDay(logs: any[], tzOffsetMin = 0): Record<string, Record<string, DayMetrics>> {
  const out: Record<string, Record<string, DayMetrics>> = {};
  const bump = (m: DayMetrics, k: MetricKey, v: number) => { if (v) m[k] = (m[k] || 0) + v; };
  for (const r of logs || []) {
    const ts = r.logged_at || r.created_at;
    if (!ts || !r.user_id) continue;
    const day = dayOf(ts, tzOffsetMin);
    const m = ((out[r.user_id] ||= {})[day] ||= {});
    if (r.log_type === "workout") {
      bump(m, "workout", 1);
      const exs = Array.isArray(r.exercises) ? r.exercises.filter((e: any) => e?.name) : [];
      if (exs.length) bump(m, "lift", 1);
      const cardio = Array.isArray(r.cardio) ? r.cardio.filter(Boolean) : [];
      let cardioMin = 0;
      for (const c of cardio) {
        const kind = `${c.type || ""} ${c.run_type || ""}`.toLowerCase();
        const dist = num(c.distance) || num(c.miles);
        if (/run|jog|treadmill/.test(kind)) bump(m, "run_mi", dist);
        else if (/walk|hik/.test(kind)) bump(m, "walk_mi", dist);
        else if (/bik|cycl|spin/.test(kind)) bump(m, "bike_mi", dist);
        cardioMin += num(c.duration);
      }
      bump(m, "active_min", Math.round(num(r.workout_duration_min) || cardioMin));
    } else if (r.log_type === "nutrition") {
      if (!/supplement/i.test(String(r.meal_type || ""))) bump(m, "meal", 1);
      bump(m, "protein_g", num(r.protein_g));
      bump(m, "water_oz", num(r.water_oz));
    } else if (r.log_type === "wellness") {
      const t = String(r.wellness_type || "").toLowerCase();
      if (t === "steps") { bump(m, "steps", num(r.steps) || num(String(r.notes || "").replace(/[^\d]/g, ""))); continue; }
      if (t === "calories_burned" || t === "calories") continue;
      bump(m, "wellness", 1);
      if (/cold|ice bath|cryo/.test(t)) bump(m, "cold_plunge", 1);
      if (/sauna|steam/.test(t)) bump(m, "sauna", 1);
      if (/meditat|breath|mindful|nidra/.test(t)) bump(m, "meditation", 1);
      if (/yoga|pilates/.test(t)) bump(m, "yoga", 1);
    }
  }
  // Threshold "day" metrics
  for (const days of Object.values(out)) for (const m of Object.values(days)) {
    if ((m.steps || 0) >= 10000) m.steps_10k_day = 1;
    if ((m.protein_g || 0) >= 100) m.protein_day = 1;
    if ((m.water_oz || 0) >= 64) m.water_day = 1;
  }
  return out;
}

// ── Scoring ─────────────────────────────────────────────────────────────────
export type PointsResult = { points: number; breakdown: Partial<Record<MetricKey, number>> };

export function scorePoints(c: ChallengeRow, days: Record<string, DayMetrics> | undefined, through: string): PointsResult {
  const tasks = (c.tasks || []) as PointsTask[];
  const end = through < endDate(c) ? through : endDate(c);
  const breakdown: Partial<Record<MetricKey, number>> = {};
  let points = 0;
  for (const [day, m] of Object.entries(days || {})) {
    if (day < c.start_date || day > end) continue;
    for (const t of tasks) {
      const v = m[t.key] || 0;
      if (!v) continue;
      breakdown[t.key] = (breakdown[t.key] || 0) + v;
      points += v * (Number(t.points) || 0);
    }
  }
  for (const k of Object.keys(breakdown) as MetricKey[]) breakdown[k] = Math.round((breakdown[k] || 0) * 100) / 100;
  return { points: Math.round(points * 10) / 10, breakdown };
}

export type DailyTaskState = { id: string; done: boolean; auto: boolean; value?: number };
export type DailyResult = {
  completedDays: number;   // total days fully completed
  streak: number;          // current run (strict challenges rank by this)
  restarts: number;        // how many times a strict run broke
  lastBreak: string | null;
  today: DailyTaskState[]; // checklist for today
};

/** checks: set of `${day}|${taskId}` this person checked off by hand. */
export function scoreDaily(
  c: ChallengeRow, days: Record<string, DayMetrics> | undefined, checks: Set<string>, today: string,
): DailyResult {
  const tasks = (c.tasks || []) as DailyTask[];
  const end = endDate(c);
  const taskDone = (t: DailyTask, day: string) => {
    const m = days?.[day] || {};
    const auto = !!t.metric && (m[t.metric] || 0) >= (t.min ?? 1);
    return { done: auto || (!!t.manual && checks.has(`${day}|${t.id}`)), auto };
  };
  let completedDays = 0, streak = 0, restarts = 0;
  let lastBreak: string | null = null;
  const restUsed: Record<string, number> = {}; // per task per 7-day block
  const last = today < end ? today : end;
  for (let day = c.start_date; day <= last; day = addDays(day, 1)) {
    const block = Math.floor(daysBetween(c.start_date, day) / 7);
    let ok = true;
    for (const t of tasks) {
      if (taskDone(t, day).done) continue;
      const key = `${t.id}|${block}`;
      if (t.restPerWeek && (restUsed[key] || 0) < t.restPerWeek && day < today) { restUsed[key] = (restUsed[key] || 0) + 1; continue; }
      ok = false;
    }
    if (ok) { completedDays++; streak++; continue; }
    if (day === today) continue; // today isn't over yet
    if (c.strict) { if (streak > 0 || completedDays > 0) restarts++; streak = 0; lastBreak = day; }
  }
  const todayState = tasks.map(t => {
    const s = taskDone(t, today);
    const value = t.metric ? (days?.[today]?.[t.metric] || 0) : undefined;
    return { id: t.id, done: s.done, auto: s.auto, value };
  });
  return { completedDays, streak, restarts, lastBreak, today: todayState };
}

// ── Plain-English summary for the builder ───────────────────────────────────
export function pointsSummary(tasks: PointsTask[]): string {
  const parts = tasks.map(t => {
    const d = TASK_BY_KEY[t.key];
    return d ? `${t.points} pts per ${d.unit === "mile" ? "mile " + d.label.replace(/^Miles /i, "").toLowerCase() : d.label.toLowerCase()}` : "";
  }).filter(Boolean);
  if (parts.length <= 1) return parts.join("");
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

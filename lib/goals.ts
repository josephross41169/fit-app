// ─── lib/goals.ts ────────────────────────────────────────────────────────
// Goal computation + auto-tracking against activity_logs. Single source
// of truth for what counts as "progress" on a goal — keeps the API
// route, client UI, and any future cron job in sync.

export type GoalMetric =
  | "workout_count"     // count workouts in window
  | "cardio_distance"   // sum cardio distance (filtered by category)
  | "cardio_duration"   // sum cardio duration (filtered by category)
  | "workout_streak"    // current streak (recomputed, not summed)
  | "lift_pr"           // best weight on a specific exercise
  | "nutrition_avg";    // avg macro per day over window

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  emoji: string | null;
  metric: GoalMetric;
  /** Filter — for cardio: category name; for lift_pr: exercise name; for
   *  nutrition_avg: "protein"|"calories"|"carbs"|"fat". Null otherwise. */
  filter: string | null;
  unit: string;
  target: number;
  current: number;
  window_start: string;
  window_end: string | null;
  is_completed: boolean;
  completed_at: string | null;
  is_public: boolean;
  feed_post_id: string | null;
  created_at: string;
};

/** Activity log row — only the fields we need for goal computation. */
export type ActivityLog = {
  id?: string;
  user_id: string;
  log_type: string;
  logged_at: string;
  workout_category?: string | null;
  workout_type?: string | null;
  exercises?: any[] | null;
  cardio?: any[] | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  calories_total?: number | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────

function parseNum(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

/** Returns true if the activity log falls inside the goal's time window. */
function inWindow(log: ActivityLog, goal: Goal): boolean {
  const ts = new Date(log.logged_at).getTime();
  const start = new Date(goal.window_start).getTime();
  if (ts < start) return false;
  if (goal.window_end) {
    const end = new Date(goal.window_end).getTime();
    if (ts > end) return false;
  }
  return true;
}

// ─── Per-log progress contribution ──────────────────────────────────────
/**
 * Given a single activity log, return how much it advances a goal.
 * Returns 0 if the log doesn't apply to this goal.
 *
 * Used both at log-insert time (incremental update of goals.current)
 * and during full goal recompute (sum across all logs in window).
 */
export function progressFromLog(goal: Goal, log: ActivityLog): number {
  if (!inWindow(log, goal)) return 0;

  switch (goal.metric) {
    case "workout_count": {
      return log.log_type === "workout" ? 1 : 0;
    }

    case "cardio_distance": {
      if (log.log_type !== "workout") return 0;
      // If the goal has a category filter, the log's workout_category
      // must match (running/biking/walking/swimming/rowing).
      if (goal.filter && log.workout_category !== goal.filter) return 0;
      const cardio = Array.isArray(log.cardio) ? log.cardio : [];
      let total = 0;
      for (const c of cardio) {
        // If filter is set, only count cardio entries whose type matches
        // (case-insensitive). e.g. goal.filter = "running" → only count
        // cardio entries with type matching "running".
        if (goal.filter) {
          const ctype = String((c as any).type || "").toLowerCase();
          if (!ctype.includes(goal.filter.toLowerCase())) continue;
        }
        total += parseNum((c as any).distance);
      }
      return total;
    }

    case "cardio_duration": {
      if (log.log_type !== "workout") return 0;
      if (goal.filter && log.workout_category !== goal.filter) return 0;
      const cardio = Array.isArray(log.cardio) ? log.cardio : [];
      let total = 0;
      for (const c of cardio) {
        if (goal.filter) {
          const ctype = String((c as any).type || "").toLowerCase();
          if (!ctype.includes(goal.filter.toLowerCase())) continue;
        }
        total += parseNum((c as any).duration);
      }
      return total;
    }

    case "lift_pr": {
      if (log.log_type !== "workout") return 0;
      if (!goal.filter) return 0;
      const exercises = Array.isArray(log.exercises) ? log.exercises : [];
      const targetName = goal.filter.toLowerCase().trim();
      let best = 0;
      for (const ex of exercises) {
        const name = String((ex as any).name || "").toLowerCase().trim();
        if (!name.includes(targetName)) continue;
        const weights = Array.isArray((ex as any).weights) ? (ex as any).weights : [(ex as any).weight];
        for (const w of weights) {
          const n = parseNum(w);
          if (n > best) best = n;
        }
      }
      // For lift_pr we don't sum — caller takes Math.max instead.
      return best;
    }

    case "nutrition_avg": {
      // For averages we contribute the day's value; caller handles the
      // averaging when summing across multiple logs. Filter selects macro.
      if (log.log_type !== "nutrition") return 0;
      if (!goal.filter) return 0;
      const macro = goal.filter.toLowerCase();
      if (macro === "protein")  return parseNum(log.protein_g);
      if (macro === "carbs")    return parseNum(log.carbs_g);
      if (macro === "fat")      return parseNum(log.fat_g);
      if (macro === "calories") return parseNum(log.calories_total);
      return 0;
    }

    case "workout_streak": {
      // Streaks aren't computed per-log — we recompute from scratch on
      // the goal page. This function returns 0 here; streak goals get
      // their `current` updated by recomputeGoalProgress instead.
      return 0;
    }

    default:
      return 0;
  }
}

// ─── Full recompute ─────────────────────────────────────────────────────
/**
 * Recompute a goal's `current` from the user's full log history. Used
 * when:
 *   • A user creates a new goal (some past logs may already count)
 *   • A user deletes a log (we don't track which logs contributed)
 *   • Periodic correctness check
 *
 * The incremental progressFromLog() is faster for the common case of
 * "user just added a workout, bump goals" — recompute is the safety net.
 */
export function recomputeGoalProgress(goal: Goal, logs: ActivityLog[]): number {
  if (goal.metric === "lift_pr") {
    // Take max across all logs in window
    let best = 0;
    for (const log of logs) {
      const v = progressFromLog(goal, log);
      if (v > best) best = v;
    }
    return best;
  }
  if (goal.metric === "nutrition_avg") {
    // Group by day, average daily values
    const byDay = new Map<string, number>();
    for (const log of logs) {
      if (!inWindow(log, goal)) continue;
      if (log.log_type !== "nutrition") continue;
      const v = progressFromLog(goal, log);
      const day = new Date(log.logged_at).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + v);
    }
    if (byDay.size === 0) return 0;
    const values = Array.from(byDay.values());
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  if (goal.metric === "workout_streak") {
    // Compute current streak: count consecutive days from today backward
    // that have at least one workout log.
    const days = new Set<string>();
    for (const log of logs) {
      if (log.log_type !== "workout") continue;
      const d = new Date(log.logged_at);
      d.setHours(0, 0, 0, 0);
      days.add(d.toISOString().slice(0, 10));
    }
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) streak++;
      else if (i === 0) continue; // allow today to be missing
      else break;
    }
    return streak;
  }
  // Default: sum
  let total = 0;
  for (const log of logs) {
    total += progressFromLog(goal, log);
  }
  return total;
}

/** Returns true if `current` meets or exceeds `target`. */
export function isGoalComplete(goal: Pick<Goal, "current" | "target">): boolean {
  return goal.current >= goal.target;
}

/** Format the progress number for display. Trims unnecessary decimals. */
export function formatProgress(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

/** Goal templates — pre-filled goal options the user can pick from
 *  instead of building from scratch. Aligned with how rivals categories
 *  are presented. */
export const GOAL_TEMPLATES: Array<{
  id: string;
  emoji: string;
  title: string;
  metric: GoalMetric;
  filter: string | null;
  unit: string;
  defaultTarget: number;
  defaultDays: number;
}> = [
  { id: "workouts_week",  emoji: "💪", title: "Workouts this week",  metric: "workout_count",    filter: null,        unit: "workouts", defaultTarget: 4,    defaultDays: 7   },
  { id: "workouts_month", emoji: "💪", title: "Workouts this month", metric: "workout_count",    filter: null,        unit: "workouts", defaultTarget: 16,   defaultDays: 30  },
  { id: "run_miles_week", emoji: "🏃", title: "Running miles",       metric: "cardio_distance",  filter: "running",   unit: "miles",    defaultTarget: 15,   defaultDays: 7   },
  { id: "bike_miles_week",emoji: "🚴", title: "Cycling miles",       metric: "cardio_distance",  filter: "biking",    unit: "miles",    defaultTarget: 50,   defaultDays: 7   },
  { id: "walk_miles_week",emoji: "🚶", title: "Walking miles",       metric: "cardio_distance",  filter: "walking",   unit: "miles",    defaultTarget: 20,   defaultDays: 7   },
  { id: "run_min_month",  emoji: "🏃", title: "Running minutes",     metric: "cardio_duration",  filter: "running",   unit: "min",      defaultTarget: 600,  defaultDays: 30  },
  { id: "bench_pr",       emoji: "🏋️", title: "Bench press goal",    metric: "lift_pr",          filter: "bench",     unit: "lbs",      defaultTarget: 225,  defaultDays: 90  },
  { id: "squat_pr",       emoji: "🏋️", title: "Squat goal",          metric: "lift_pr",          filter: "squat",     unit: "lbs",      defaultTarget: 315,  defaultDays: 90  },
  { id: "deadlift_pr",    emoji: "🏋️", title: "Deadlift goal",       metric: "lift_pr",          filter: "deadlift",  unit: "lbs",      defaultTarget: 405,  defaultDays: 90  },
  { id: "streak_30",      emoji: "🔥", title: "30-day workout streak", metric: "workout_streak", filter: null,        unit: "days",     defaultTarget: 30,   defaultDays: 30  },
  { id: "protein_avg",    emoji: "🥩", title: "Daily protein avg",   metric: "nutrition_avg",    filter: "protein",   unit: "g",        defaultTarget: 180,  defaultDays: 7   },
];

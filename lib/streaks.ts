// ─── lib/streaks.ts ─────────────────────────────────────────────────────────
// Weekly streak math for activity_logs.
//
// Definition:
//   • Weeks run Sunday → Saturday (local time), matching the app's week views.
//   • A week "counts" for a category when the user logged that category on
//     at least WEEKLY_GOAL different days that week (two meals on the same
//     day count as one day).
//   • The CURRENT streak is the number of consecutive counted weeks going
//     back from this week. This week isn't over, so if it hasn't hit the
//     goal yet the streak is still alive as long as last week counted.
//   • The streak breaks when a full week ends without hitting the goal.
//   • The BEST streak is the longest run of consecutive counted weeks.

export type StreakCategory = "workout" | "wellness" | "nutrition";

/** Days per week a category must be logged to keep its streak. */
export const WEEKLY_GOAL = 2;

export type StreakResult = {
  /** Current consecutive-week streak. 0 if broken or never started. */
  current: number;
  /** Longest run of consecutive weeks ever recorded. */
  best: number;
  /** ISO timestamp of the most recent log, or null if no logs at all. */
  lastLogged: string | null;
  /** Days since last log. 0 = today, 1 = yesterday, etc. null if never. */
  daysSinceLastLog: number | null;
  /** True if they've logged this category today. */
  loggedToday: boolean;
  /** Distinct days logged so far this week. */
  thisWeekDays: number;
  /** Days needed per week (WEEKLY_GOAL). */
  weekGoal: number;
  /** True once this week has hit the goal. */
  weekDone: boolean;
};

type LogRow = {
  log_type: string | null;
  logged_at: string | null;
  created_at?: string | null;
};

/** Local-date key like "2026-05-01". */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local-date key of the Sunday that starts the week containing d. */
function weekKey(d: Date): string {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay());
  return dayKey(s);
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Sunday key of the week before the given Sunday key. */
function prevWeekKey(key: string): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() - 7);
  return dayKey(d);
}

export const EMPTY_STREAK: StreakResult = {
  current: 0, best: 0, lastLogged: null, daysSinceLastLog: null,
  loggedToday: false, thisWeekDays: 0, weekGoal: WEEKLY_GOAL, weekDone: false,
};

/**
 * Compute the weekly streak for one category. Pass in the user's logs
 * (mixed types are fine — we filter). Order doesn't matter.
 */
export function computeStreak(rows: LogRow[], category: StreakCategory): StreakResult {
  // week key → set of distinct day keys logged that week
  const weeks = new Map<string, Set<string>>();
  let mostRecentTs: string | null = null;
  for (const r of rows) {
    if (r.log_type !== category) continue;
    const ts = r.logged_at || r.created_at;
    if (!ts) continue;
    const d = new Date(ts);
    if (isNaN(d.getTime())) continue;
    const wk = weekKey(d);
    if (!weeks.has(wk)) weeks.set(wk, new Set());
    weeks.get(wk)!.add(dayKey(d));
    if (!mostRecentTs || ts > mostRecentTs) mostRecentTs = ts;
  }

  if (weeks.size === 0) return { ...EMPTY_STREAK };

  const now = new Date();
  const today = dayKey(now);
  const thisWeek = weekKey(now);
  const met = (wk: string) => (weeks.get(wk)?.size ?? 0) >= WEEKLY_GOAL;

  const thisWeekDays = weeks.get(thisWeek)?.size ?? 0;
  const weekDone = thisWeekDays >= WEEKLY_GOAL;

  // Current streak: start at this week if it's already met, otherwise at
  // last week (this week is still in progress). Walk back until a miss.
  let current = 0;
  let cursor = weekDone ? thisWeek : prevWeekKey(thisWeek);
  while (met(cursor)) {
    current++;
    cursor = prevWeekKey(cursor);
  }

  // Best streak: longest run of consecutive met weeks.
  const metWeeks = Array.from(weeks.keys()).filter(met).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const wk of metWeeks) {
    run = prev && prevWeekKey(wk) === prev ? run + 1 : 1;
    if (run > best) best = run;
    prev = wk;
  }
  if (best < current) best = current;

  let daysSinceLastLog: number | null = null;
  if (mostRecentTs) {
    const lastDay = parseDayKey(dayKey(new Date(mostRecentTs)));
    const todayD = parseDayKey(today);
    daysSinceLastLog = Math.max(0, Math.round((todayD.getTime() - lastDay.getTime()) / 86400000));
  }

  return {
    current,
    best,
    lastLogged: mostRecentTs,
    daysSinceLastLog,
    loggedToday: weeks.get(thisWeek)?.has(today) ?? false,
    thisWeekDays,
    weekGoal: WEEKLY_GOAL,
    weekDone,
  };
}

/** Convenience: compute all three streaks at once from a single log set. */
export function computeAllStreaks(rows: LogRow[]): {
  workout: StreakResult;
  wellness: StreakResult;
  nutrition: StreakResult;
} {
  return {
    workout: computeStreak(rows, "workout"),
    wellness: computeStreak(rows, "wellness"),
    nutrition: computeStreak(rows, "nutrition"),
  };
}

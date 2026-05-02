// ─── lib/streaks.ts ─────────────────────────────────────────────────────────
// Strict consecutive-day streak math for activity_logs.
//
// Strict definition:
//   • A "streak day" = the user logged at least one entry of the given type
//     on that calendar day (local time).
//   • The CURRENT streak is the count of consecutive days going backward
//     from today (or yesterday, if today isn't logged yet — today isn't
//     over, so we don't penalize until they go to bed without logging).
//   • The streak BREAKS at the first day with no log. No grace days, no
//     streak freezes. Miss a day, lose the streak.
//   • The BEST streak is the longest run of consecutive days ever, looking
//     back through all rows passed in.
//
// Why strict: per product decision, users need to FEEL the consequence of
// missing a day. Forgiving streaks reward gaming the system; strict ones
// reward genuine consistency.

export type StreakCategory = "workout" | "wellness" | "nutrition";

export type StreakResult = {
  /** Current consecutive day streak. 0 if broken or never started. */
  current: number;
  /** Longest run ever recorded. */
  best: number;
  /** ISO date string of the most recent log, or null if no logs at all. */
  lastLogged: string | null;
  /** Days since last log. 0 = today, 1 = yesterday, etc. null if never. */
  daysSinceLastLog: number | null;
  /** True if they've logged today (drives "🔥 active" indicator). */
  loggedToday: boolean;
};

type LogRow = {
  log_type: string | null;
  logged_at: string | null;
  created_at?: string | null;
};

/** Convert an ISO timestamp to a local-date key like "2026-05-01". */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's local-date key. */
function todayKey(): string {
  return dayKey(new Date().toISOString());
}

/** Yesterday's local-date key. */
function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d.toISOString());
}

/**
 * Compute streak data for a single category. Pass in ALL the user's logs of
 * that type — the function buckets by day internally. Order doesn't matter.
 *
 * Performance: O(n) over the rows passed in. For N=1000 logs this is sub-ms.
 * The caller should already have filtered the rows by log_type for efficiency
 * but we tolerate mixed inputs (we re-filter).
 */
export function computeStreak(rows: LogRow[], category: StreakCategory): StreakResult {
  // Filter to just this category and bucket by day.
  const days = new Set<string>();
  let mostRecentTs: string | null = null;
  for (const r of rows) {
    if (r.log_type !== category) continue;
    const ts = r.logged_at || r.created_at;
    if (!ts) continue;
    days.add(dayKey(ts));
    if (!mostRecentTs || ts > mostRecentTs) mostRecentTs = ts;
  }

  if (days.size === 0) {
    return {
      current: 0,
      best: 0,
      lastLogged: null,
      daysSinceLastLog: null,
      loggedToday: false,
    };
  }

  const today = todayKey();
  const yesterday = yesterdayKey();
  const loggedToday = days.has(today);
  const loggedYesterday = days.has(yesterday);

  // Current streak — strict math.
  // Walk backward starting from today (if logged) or yesterday (if today
  // isn't logged yet but yesterday was — gives them grace until end of day).
  // Stop at the first missing day.
  let current = 0;
  if (loggedToday || loggedYesterday) {
    const cursor = new Date();
    if (!loggedToday) cursor.setDate(cursor.getDate() - 1);
    while (true) {
      if (!days.has(dayKey(cursor.toISOString()))) break;
      current++;
      cursor.setDate(cursor.getDate() - 1);
      // Safety bound — strict streak can't exceed total active days
      if (current >= days.size) break;
    }
  }

  // Best streak — longest run of consecutive days in the full set.
  // Sort the day keys ascending, then sweep counting consecutive days.
  const sorted = Array.from(days).sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDayKey(sorted[i - 1]);
    const curr = parseDayKey(sorted[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  if (best < current) best = current; // current streak is always part of history

  // Days since last log.
  let daysSinceLastLog: number | null = null;
  if (mostRecentTs) {
    const lastDay = new Date(dayKey(mostRecentTs) + "T00:00:00");
    const todayD = new Date(today + "T00:00:00");
    daysSinceLastLog = Math.max(0, Math.round((todayD.getTime() - lastDay.getTime()) / 86400000));
  }

  return {
    current,
    best,
    lastLogged: mostRecentTs,
    daysSinceLastLog,
    loggedToday,
  };
}

function parseDayKey(key: string): Date {
  // "2026-05-01" → midnight local time
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
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

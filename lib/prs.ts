// ─── lib/prs.ts ──────────────────────────────────────────────────────────
// Personal Record (PR) detection logic. Strict definition: a PR is when
// the user logs a HEAVIER weight on an exercise than they've EVER lifted
// before. First-time logs are NOT PRs — that's the "loose" logic we're
// replacing. A first lift establishes a baseline; you have to beat the
// baseline to set a record.
//
// Why heaviest-weight-only and not 1RM-equivalent or volume-PR:
// - 95% of lifters mean "heaviest weight" when they say "PR"
// - Adding rep/volume PRs creates "you got 5 PRs!" spam on every session
// - Gold-standard definition is simple, predictable, and matches gym culture
//
// This file is the SINGLE SOURCE OF TRUTH for what counts as a PR. Every
// surface in the app (feed badge, profile, recap, stats, share card) MUST
// use these functions — no copy-pasted logic elsewhere.

// ─── Types ─────────────────────────────────────────────────────────────

/** A lift entry as stored in activity_logs.exercises jsonb. The shape is
 *  loose — different code paths historically produced different shapes —
 *  so we accept either `weight` (single string) or `weights` (array). */
export type LiftEntry = {
  name?: string;
  weight?: string | number;
  weights?: Array<string | number>;
  reps?: string | number;
  sets?: string | number;
};

/** A row from public.activity_logs — only the fields we care about. */
export type ActivityLogRow = {
  id?: string;
  logged_at?: string | null;
  created_at?: string | null;
  log_type?: string | null;
  workout_category?: string | null;
  workout_type?: string | null;
  exercises?: LiftEntry[] | null;
};

/** A row from public.personal_records. */
export type PersonalRecord = {
  id?: string;
  user_id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  /** Legacy "1RM proxy" column. We compute it as weight × reps even though
   *  that's not a true 1RM — the existing PRs page reads this column for
   *  ranking, so we keep populating it for backward compatibility. */
  volume: number;
  logged_at?: string;
};

/** Result of running detection on a single workout log. */
export type DetectedPR = {
  exercise_name: string;
  /** The new heaviest weight, in lbs. */
  weight: number;
  /** Reps performed at that weight. If multiple sets at the new max, picks the highest rep count. */
  reps: number;
  /** weight × reps for the legacy `volume` column. */
  volume: number;
  /** When the lift happened. ISO string. */
  logged_at: string;
  /** What the previous max was, for "+15 lbs from prior" display. Null if first-ever. */
  priorWeight: number | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────

/** Parse the first number out of any value type. Used for weights/reps/sets
 *  fields that can come as numbers, plain strings, or strings with units. */
export function parseNumeric(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

/** Normalize an exercise name for matching. "Bench Press" and "bench press"
 *  and "  Bench  Press " all collapse to the same canonical form. We DON'T
 *  lowercase the display name — we keep the user's casing for what they
 *  see — but we use the normalized form to compare history.
 *
 *  Returns empty string for unparseable input. */
export function normalizeExerciseName(name: any): string {
  if (typeof name !== "string") return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Find the heaviest set in a single exercise entry. Returns the weight
 *  + the rep count at that weight. Falls back to 0 if no parseable weight. */
export function bestSetInExercise(ex: LiftEntry): { weight: number; reps: number } {
  if (!ex) return { weight: 0, reps: 0 };
  // Reps come from the entry-level `reps` field; we treat all sets as having
  // the same rep target since that's how the app currently structures it.
  // If users start logging different reps per set we'd need a per-set rep
  // array (which the schema doesn't track yet).
  const reps = parseNumeric(ex.reps);
  let best = 0;
  if (Array.isArray(ex.weights) && ex.weights.length > 0) {
    for (const w of ex.weights) {
      const num = parseNumeric(w);
      if (num > best) best = num;
    }
  } else {
    best = parseNumeric(ex.weight);
  }
  return { weight: best, reps };
}

// ─── Core detection ────────────────────────────────────────────────────

/** Build a map of exercise → all-time max weight from a list of historical
 *  workout logs. Used to compare a new workout's lifts against history.
 *
 *  Pass logs that occurred BEFORE the workout being checked, not the
 *  workout itself — otherwise we'd compare a lift against itself and
 *  nothing would ever be a PR. */
export function buildHistoricalMaxes(historyLogs: ActivityLogRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const log of historyLogs) {
    if (log.log_type !== "workout") continue;
    const exercises = Array.isArray(log.exercises) ? log.exercises : [];
    for (const ex of exercises) {
      const key = normalizeExerciseName(ex.name);
      if (!key) continue;
      const { weight } = bestSetInExercise(ex);
      if (weight <= 0) continue;
      if (!out[key] || weight > out[key]) out[key] = weight;
    }
  }
  return out;
}

/**
 * Detect strict PRs in a single new workout log against the user's history.
 *
 * STRICT means:
 *   - User must have lifted this exercise BEFORE (we need prior history)
 *   - The new max weight for the exercise must EXCEED (>) the prior max
 *   - First-ever lifts of an exercise are NOT PRs
 *
 * @param newLog     - The just-submitted workout log to check
 * @param historicalMaxes - Map of exercise → all-time max BEFORE this log
 *                          Get from buildHistoricalMaxes(historyLogs).
 * @returns Array of PRs — empty if the workout had none
 */
export function detectStrictPRs(
  newLog: ActivityLogRow,
  historicalMaxes: Record<string, number>
): DetectedPR[] {
  if (newLog.log_type !== "workout") return [];
  const exercises = Array.isArray(newLog.exercises) ? newLog.exercises : [];
  const loggedAt = newLog.logged_at || newLog.created_at || new Date().toISOString();

  // Group exercises by normalized name within THIS log — if the user did
  // bench three different ways (flat, incline, etc.) those count separately.
  // But if they recorded "bench press" twice in one log, take the heavier.
  const bestByExercise: Record<string, { weight: number; reps: number; displayName: string }> = {};
  for (const ex of exercises) {
    const key = normalizeExerciseName(ex.name);
    if (!key) continue;
    const { weight, reps } = bestSetInExercise(ex);
    if (weight <= 0) continue;
    const existing = bestByExercise[key];
    if (!existing || weight > existing.weight) {
      // Keep the original display name (preserves user's casing for the UI)
      bestByExercise[key] = { weight, reps, displayName: (ex.name || "").trim() };
    }
  }

  const prs: DetectedPR[] = [];
  for (const [key, entry] of Object.entries(bestByExercise)) {
    const prior = historicalMaxes[key];
    // STRICT: prior must EXIST and be exceeded. No prior history = no PR.
    if (prior === undefined || prior === null) continue;
    if (entry.weight <= prior) continue;
    prs.push({
      exercise_name: entry.displayName,
      weight: entry.weight,
      reps: entry.reps,
      volume: entry.weight * entry.reps,
      logged_at: loggedAt,
      priorWeight: prior,
    });
  }
  // Sort heaviest first
  prs.sort((a, b) => b.weight - a.weight);
  return prs;
}

/**
 * Recompute the FULL PR history for a user from scratch. Used by the
 * backfill job and by /recompute_user_prs admin action.
 *
 * Walks every workout log chronologically, tracks the running max per
 * exercise, and emits a PR record EVERY TIME the max increases. The
 * output is the full set of records that should be in personal_records
 * for this user — older PR rows can be deleted before inserting these.
 *
 * @param logs - All of a user's workout logs, any order. Will be sorted
 *               internally by logged_at ASC.
 */
export function recomputeAllPRs(logs: ActivityLogRow[]): PersonalRecord[] {
  const sorted = [...logs]
    .filter(l => l.log_type === "workout")
    .sort((a, b) => {
      const aTs = a.logged_at || a.created_at || "";
      const bTs = b.logged_at || b.created_at || "";
      return aTs.localeCompare(bTs);
    });

  const runningMax: Record<string, number> = {};
  // Keep display name from first appearance — handles slight casing variations
  const displayName: Record<string, string> = {};
  const out: Omit<PersonalRecord, "user_id">[] = [];

  for (const log of sorted) {
    const exercises = Array.isArray(log.exercises) ? log.exercises : [];
    const loggedAt = log.logged_at || log.created_at || new Date().toISOString();

    // Best per exercise within this log
    const bestThisLog: Record<string, { weight: number; reps: number; displayName: string }> = {};
    for (const ex of exercises) {
      const key = normalizeExerciseName(ex.name);
      if (!key) continue;
      const { weight, reps } = bestSetInExercise(ex);
      if (weight <= 0) continue;
      const existing = bestThisLog[key];
      if (!existing || weight > existing.weight) {
        bestThisLog[key] = { weight, reps, displayName: (ex.name || "").trim() };
      }
      if (!displayName[key]) displayName[key] = (ex.name || "").trim();
    }

    for (const [key, entry] of Object.entries(bestThisLog)) {
      const prior = runningMax[key];
      // STRICT: skip if no prior history (first-ever lift)
      if (prior === undefined) {
        runningMax[key] = entry.weight;
        continue;
      }
      // STRICT: must exceed
      if (entry.weight <= prior) continue;
      runningMax[key] = entry.weight;
      out.push({
        exercise_name: entry.displayName || displayName[key] || key,
        weight: entry.weight,
        reps: entry.reps,
        volume: entry.weight * entry.reps,
        logged_at: loggedAt,
      });
    }
  }
  // Caller adds user_id
  return out as PersonalRecord[];
}

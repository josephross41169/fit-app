// ─── lib/recap.ts ──────────────────────────────────────────────────────────
// Builds a structured weekly recap from raw activity_logs + badges data.
//
// Week boundary: Sunday 12:00 AM through Saturday 11:59:59 PM (local time).
// "Week of YYYY-MM-DD" always refers to the SUNDAY that starts the week.
// This matches Apple Health and Strava's convention.
//
// Notes on the data we operate on:
//   • activity_logs.log_type ∈ {workout, wellness, nutrition}
//   • workout logs carry: workout_category (lifting/running/biking/etc),
//     exercises (jsonb array of {name, sets, reps, weight, weights[]}),
//     cardio (jsonb array of {type, duration, distance, miles, mph}),
//     duration (minutes)
//   • wellness logs carry: wellness_type (free text Title Case),
//     duration (minutes)
//   • nutrition logs carry: cals/protein/carbs/fat fields
//
// All math is pure — no DB calls. The caller fetches data and passes it in.
// Components render this output directly.

export type LogRow = {
  id?: string;
  log_type: string | null;
  // Workout categorization. Schema has both `workout_category` and
  // `workout_type` columns — both exist, populated by different code paths.
  // We check workout_category first (post-page writes here) and fall back
  // to workout_type for older entries.
  workout_category?: string | null;
  workout_type?: string | null;
  exercises?: Array<{ name?: string; sets?: string; reps?: string; weight?: string; weights?: string[] }> | null;
  cardio?: Array<{ type?: string; duration?: string | number; distance?: string; miles?: number; mph?: number }> | null;
  wellness_type?: string | null;
  // Real duration columns from the schema. Workouts and wellness sessions
  // have separate per-type duration fields (in minutes). The previous
  // `duration` field referenced a column that doesn't exist — that bug
  // caused every recap to show 0 minutes for everything.
  workout_duration_min?: number | string | null;
  wellness_duration_min?: number | string | null;
  /** Legacy / unused — kept for backwards compatibility with old code paths
   *  that may have read this. Real reads should use the *_min columns. */
  duration?: number | string | null;
  logged_at?: string | null;
  created_at?: string | null;
};

export type BadgeRow = {
  id?: string;
  badge_id: string;
  user_id?: string;
  created_at?: string | null;
  // Optional fields different code paths may include:
  tier?: string | null;
};

export type Recap = {
  /** ISO date string (YYYY-MM-DD) of the Sunday that starts this recap's week. */
  weekStart: string;
  /** ISO date string of the Saturday that ends this week. */
  weekEnd: string;
  /** Display string like "Apr 27 – May 3, 2026". */
  rangeLabel: string;

  /** Lifts breakdown — count of lifting workouts + per-exercise PRs. */
  lifts: {
    sessions: number;
    totalMinutes: number;
    /** Strict PRs: max weight beat the user's prior all-time max. */
    prs: Array<{ exercise: string; weight: number; reps: number }>;
    /** Best lifts of the week (used as fallback when no PRs). */
    bestLifts: Array<{ exercise: string; weight: number; reps: number }>;
    /** Total volume across the week: sum of (weight × reps) for every set
     *  with a numeric weight. The bigger-is-better number that matters. */
    totalVolume: number;
    /** Total set count across all sessions this week. */
    totalSets: number;
    /** Heaviest single set this week (one row from the lifts log). */
    heaviestSet: { exercise: string; weight: number; reps: number } | null;
    /** Most-trained exercise (most sets logged for it). */
    mostTrained: { exercise: string; sets: number } | null;
    /** Number of unique exercises logged. */
    uniqueExercises: number;
  };

  /** Cardio breakdown — per-type (running, biking, etc) aggregates. */
  cardio: {
    sessions: number;
    totalMinutes: number;
    totalMiles: number;
    /** Per-type rollup: count, average distance per session, total time. */
    byType: Array<{
      type: string;
      sessions: number;
      avgMiles: number;
      totalMinutes: number;
    }>;
    /** Longest single cardio session this week (by miles when available,
     *  else by minutes). */
    longestSession: { type: string; miles: number; minutes: number } | null;
    /** Average pace across all cardio with both time AND distance —
     *  reported as min/mile. Null if no distance-tracked sessions. */
    avgPaceMinPerMi: number | null;
    /** Days of the week the user did cardio. ISO weekday names sorted Sun→Sat. */
    cardioDays: string[];
  };

  /** Wellness breakdown — per-type counts. */
  wellness: {
    sessions: number;
    totalMinutes: number;
    /** Per-type rollup, sorted by count desc. */
    byType: Array<{ type: string; sessions: number }>;
    /** Number of distinct wellness types logged this week (variety score). */
    varietyCount: number;
    /** Day with the most wellness sessions. */
    bestDay: { date: string; label: string; sessions: number } | null;
    /** Longest single session this week by minutes. */
    longestSession: { type: string; minutes: number } | null;
  };

  /** Day-by-day chart data. 7 entries (Sunday → Saturday). */
  daily: Array<{
    /** Day label like "Sun", "Mon"... */
    label: string;
    /** ISO date string (YYYY-MM-DD). */
    date: string;
    /** Total minutes by category — kept for any place that wants raw time. */
    liftingMinutes: number;
    cardioMinutes: number;
    wellnessMinutes: number;
    /** Session counts by category — used by the bar chart since minutes
     *  let a single sleep log dwarf an entire week of workouts. Counting
     *  sessions makes the chart honest about consistency, not duration. */
    liftingSessions: number;
    cardioSessions: number;
    wellnessSessions: number;
  }>;

  /** Badges newly earned during this week. */
  badgesEarned: BadgeRow[];

  /** Photos from posts the user shared this week. Used by the Photos card
   *  to render a mosaic grid of the week's content. Newest first. */
  photos: Array<{
    url: string;
    caption: string | null;
    likes: number;
    /** Vertical crop offset (0-100) if the user repositioned the photo
     *  when posting. Used so the mosaic shows the framed portion. */
    position?: number;
  }>;

  /** Total likes received across all this week's posts. */
  totalLikes: number;

  /** The most-liked post of the week. Null if no posts. */
  topPost: { url: string; likes: number; caption: string | null; position?: number } | null;

  /** Unique locations tagged in this week's posts. Used by the
   *  Achievements card to show "places visited." Limited to ~5 unique. */
  placesTagged: Array<{
    name: string;
    city: string | null;
  }>;

  /** Most-active day of the week — most total sessions. */
  mostActiveDay: { date: string; label: string; sessions: number } | null;

  /** Comparison to last week. Computed only when caller passes prior-week
   *  logs to buildRecap. Used for "+23% from last week" callouts. Null
   *  if no comparison data was supplied. */
  vsLastWeek: {
    /** % change in total session count. Positive = up. */
    sessionsPct: number;
    /** % change in active days. */
    activeDaysPct: number;
    /** Raw sessions delta (this week - last week). */
    sessionsDelta: number;
    /** Raw active-day delta. */
    activeDaysDelta: number;
    /** Last week's totals for direct callout ("12 sessions vs 8 last week"). */
    lastWeekSessions: number;
    lastWeekActiveDays: number;
  } | null;

  /** True if user has any activity at all this week. False = "rest week". */
  hasActivity: boolean;

  /** Total active days (any log type) in the week. 0..7 */
  activeDays: number;
};

// ─── Date helpers ─────────────────────────────────────────────────────────

/** Returns the Sunday at 00:00:00 local time of the week containing `d`. */
export function getSundayOfWeek(d: Date): Date {
  const sun = new Date(d);
  sun.setHours(0, 0, 0, 0);
  // getDay() returns 0=Sunday..6=Saturday. Subtracting that gives us Sunday.
  sun.setDate(sun.getDate() - sun.getDay());
  return sun;
}

/** Returns the Sunday of the PREVIOUS week relative to today. */
export function getPreviousWeekStart(): Date {
  const thisSun = getSundayOfWeek(new Date());
  const prev = new Date(thisSun);
  prev.setDate(prev.getDate() - 7);
  return prev;
}

/** YYYY-MM-DD in local time. */
export function isoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse YYYY-MM-DD as local-midnight. */
export function parseIsoDateLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format like "Apr 27 – May 3, 2026" or "Dec 28 – Jan 3, 2027" across year boundary. */
function formatRange(start: Date, end: Date): string {
  const monthShort = (d: Date) => d.toLocaleString("en-US", { month: "short" });
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${monthShort(start)} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${monthShort(start)} ${start.getDate()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`;
}

/** Shape of a post row pulled for the photos card / places tagged. */
export type PostRow = {
  id?: string;
  user_id?: string;
  caption?: string | null;
  media_url?: string | null;
  media_urls?: string[] | null;
  media_types?: ('image' | 'video')[] | null;
  media_positions?: number[] | null;
  likes_count?: number | null;
  created_at?: string | null;
  /** Joined location row (from posts.location_id → locations) */
  locationData?: {
    name?: string | null;
    city?: string | null;
  } | null;
};

// ─── Core builder ─────────────────────────────────────────────────────────

/**
 * Build a recap object for a specific week.
 *
 * @param weekStart — A Date representing the Sunday at 00:00:00 local time.
 *                   Use getSundayOfWeek(...) or getPreviousWeekStart() to derive.
 * @param weekLogs — All activity_logs for the user falling within Sun-Sat.
 *                   The caller is responsible for filtering by user_id +
 *                   logged_at. We re-filter defensively but trust the input.
 * @param historyLogs — All workout activity_logs for the user BEFORE weekStart.
 *                      Used for strict-PR detection (must beat all prior max
 *                      weights for an exercise to count as a PR).
 * @param badgesThisWeek — All badges rows whose created_at falls within the week.
 * @param weekPosts — All public posts the user made this week. Used for the
 *                    Photos card and Places Tagged section.
 * @param priorWeekLogs — OPTIONAL. activity_logs for the WEEK BEFORE weekStart
 *                        (Sun-Sat of the prior 7 days). Used to compute
 *                        vsLastWeek comparison stats. Pass [] or omit to
 *                        skip comparison; the recap.vsLastWeek field will
 *                        be null in that case.
 */
export function buildRecap(
  weekStart: Date,
  weekLogs: LogRow[],
  historyLogs: LogRow[],
  badgesThisWeek: BadgeRow[],
  weekPosts: PostRow[] = [],
  priorWeekLogs: LogRow[] = []
): Recap {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const startMs = weekStart.getTime();
  const endMs = weekEnd.getTime();

  // ─── Filter weekLogs to ONLY rows actually in range. Defensive ────────
  // We trust the caller but the query window can be off by a day in edge
  // cases (DST transitions etc). This guarantees correctness.
  const inRange: LogRow[] = weekLogs.filter(r => {
    const ts = r.logged_at || r.created_at;
    if (!ts) return false;
    const ms = new Date(ts).getTime();
    return ms >= startMs && ms <= endMs;
  });

  // ─── Lifts ────────────────────────────────────────────────────────────
  // A "lifting session" = a workout log whose exercises array has entries.
  // Note: a lifting log may also have cardio attached (workout-mode "log
  // both"). We count it as 1 lifting session AND 1 cardio session in that
  // case; this is correct per the user's mental model.
  const liftingLogs = inRange.filter(
    r => r.log_type === "workout" && Array.isArray(r.exercises) && r.exercises.length > 0
  );
  const liftingMinutesByDay: Record<string, number> = {};
  // Session counts per day for the bar chart. We can't reuse the minutes
  // record because a 0-minute log still counts as 1 session.
  const liftingSessionsByDay: Record<string, number> = {};
  liftingLogs.forEach(l => {
    const k = isoDateLocal(new Date(l.logged_at || l.created_at!));
    // Real column is workout_duration_min (integer minutes). Fall back to
    // legacy `duration` field for any rows that might still have it.
    const dur = parseDurationToMinutes(l.workout_duration_min ?? l.duration);
    liftingMinutesByDay[k] = (liftingMinutesByDay[k] || 0) + dur;
    liftingSessionsByDay[k] = (liftingSessionsByDay[k] || 0) + 1;
  });

  // Best max-weight per exercise THIS WEEK
  const weekMaxByExercise: Record<string, { weight: number; reps: number }> = {};
  liftingLogs.forEach(l => {
    (l.exercises || []).forEach(ex => {
      const name = (ex.name || "").trim();
      if (!name) return;
      const maxFromArr = bestSetWeightFromExercise(ex);
      if (!maxFromArr) return;
      const cur = weekMaxByExercise[name];
      if (!cur || maxFromArr.weight > cur.weight) {
        weekMaxByExercise[name] = maxFromArr;
      }
    });
  });

  // Strict PR detection: weekMax > all-time historical max for that exercise.
  // historyLogs is everything BEFORE weekStart, so we don't accidentally
  // compare a PR against itself.
  const historicalMaxByExercise: Record<string, number> = {};
  historyLogs.forEach(l => {
    if (l.log_type !== "workout") return;
    (l.exercises || []).forEach(ex => {
      const name = (ex.name || "").trim();
      if (!name) return;
      const m = bestSetWeightFromExercise(ex);
      if (!m) return;
      if (!historicalMaxByExercise[name] || m.weight > historicalMaxByExercise[name]) {
        historicalMaxByExercise[name] = m.weight;
      }
    });
  });

  const prs: Recap["lifts"]["prs"] = [];
  Object.entries(weekMaxByExercise).forEach(([name, { weight, reps }]) => {
    const prior = historicalMaxByExercise[name] || 0;
    if (weight > prior) {
      prs.push({ exercise: name, weight, reps });
    }
  });
  // Sort PRs by weight desc — biggest PRs first
  prs.sort((a, b) => b.weight - a.weight);

  // Best lifts (fallback display when no PRs) — top 5 max-weight lifts of the week
  const bestLifts: Recap["lifts"]["bestLifts"] = Object.entries(weekMaxByExercise)
    .map(([name, { weight, reps }]) => ({ exercise: name, weight, reps }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  const liftingTotalMinutes = Object.values(liftingMinutesByDay).reduce((a, b) => a + b, 0);

  // ─── Advanced lift stats ──────────────────────────────────────────────
  // Compute total volume (sum of weight × reps across every set), heaviest
  // single set, most-trained exercise, etc. Run a single pass over the
  // exercises arrays to gather all of these at once.
  let totalVolume = 0;
  let totalSets = 0;
  let heaviestSet: Recap["lifts"]["heaviestSet"] = null;
  const setsByExercise: Record<string, number> = {};
  liftingLogs.forEach(l => {
    (l.exercises || []).forEach(ex => {
      const name = (ex.name || "").trim();
      if (!name) return;
      // Each exercise has multiple sets — pull from `weights` array if
      // present (one entry per set), else from the single `weight` string.
      const repsNum = parseFirstNumber(ex.reps) || 0;
      const setsNum = parseFirstNumber(ex.sets) || 0;
      if (Array.isArray(ex.weights) && ex.weights.length > 0) {
        ex.weights.forEach(w => {
          const wn = parseFirstNumber(w);
          if (!wn) return;
          totalVolume += wn * repsNum;
          totalSets += 1;
          if (!heaviestSet || wn > heaviestSet.weight) {
            heaviestSet = { exercise: name, weight: wn, reps: repsNum };
          }
          setsByExercise[name] = (setsByExercise[name] || 0) + 1;
        });
      } else {
        // Fall back to the single `weight` field × number of sets.
        const wn = parseFirstNumber(ex.weight) || 0;
        if (wn > 0 && setsNum > 0) {
          totalVolume += wn * repsNum * setsNum;
          totalSets += setsNum;
          if (!heaviestSet || wn > heaviestSet.weight) {
            heaviestSet = { exercise: name, weight: wn, reps: repsNum };
          }
          setsByExercise[name] = (setsByExercise[name] || 0) + setsNum;
        } else if (setsNum > 0) {
          // No weight (bodyweight movements). Still count sets for "most trained."
          totalSets += setsNum;
          setsByExercise[name] = (setsByExercise[name] || 0) + setsNum;
        }
      }
    });
  });
  // Most-trained exercise = highest set count
  let mostTrained: Recap["lifts"]["mostTrained"] = null;
  Object.entries(setsByExercise).forEach(([name, sets]) => {
    if (!mostTrained || sets > mostTrained.sets) mostTrained = { exercise: name, sets };
  });
  const uniqueExercises = Object.keys(setsByExercise).length;

  // ─── Cardio ───────────────────────────────────────────────────────────
  // Cardio comes from two sources:
  //   1. workout logs whose category ∈ running/walking/biking/swimming/rowing
  //      → these have either a top-level duration or a cardio[] array
  //   2. workout logs in lifting category that ALSO have cardio[] entries
  //      attached (the "log both" feature)
  // We unify them as "cardio entries" — each entry has type + minutes + miles.
  type CardioEntry = { type: string; minutes: number; miles: number; date: string };
  const cardioEntries: CardioEntry[] = [];

  inRange.forEach(l => {
    if (l.log_type !== "workout") return;
    const date = isoDateLocal(new Date(l.logged_at || l.created_at!));
    // Workout categorization can live in either column. Read both, prefer
    // workout_category since it's what the post-page uses for new entries.
    const category = (l.workout_category || l.workout_type || "").toLowerCase();

    // Inline cardio[] entries (the explicit array)
    if (Array.isArray(l.cardio) && l.cardio.length > 0) {
      l.cardio.forEach(c => {
        const minutes = parseDurationToMinutes(c.duration);
        const miles = typeof c.miles === "number" ? c.miles : parseFloat(c.distance || "0") || 0;
        const type = (c.type || category || "cardio").toLowerCase();
        if (minutes > 0 || miles > 0) {
          cardioEntries.push({ type, minutes, miles, date });
        }
      });
    } else if (
      // Cardio category but no explicit entries — synthesize from top-level
      // workout_duration_min. Old rows might use the legacy `duration` field.
      ["running", "walking", "biking", "swimming", "rowing"].includes(category)
    ) {
      const minutes = parseDurationToMinutes(l.workout_duration_min ?? l.duration);
      cardioEntries.push({
        type: category || "cardio",
        minutes,
        miles: 0,
        date,
      });
    }
  });

  const cardioMinutesByDay: Record<string, number> = {};
  const cardioSessionsByDay: Record<string, number> = {};
  cardioEntries.forEach(c => {
    cardioMinutesByDay[c.date] = (cardioMinutesByDay[c.date] || 0) + c.minutes;
    cardioSessionsByDay[c.date] = (cardioSessionsByDay[c.date] || 0) + 1;
  });

  // Aggregate cardio per type — used for the "Running: 4x · 3.2mi avg · 2h 30m" rollup
  const cardioByType: Record<string, { sessions: number; totalMiles: number; totalMinutes: number }> = {};
  cardioEntries.forEach(c => {
    const k = c.type;
    if (!cardioByType[k]) cardioByType[k] = { sessions: 0, totalMiles: 0, totalMinutes: 0 };
    cardioByType[k].sessions += 1;
    cardioByType[k].totalMiles += c.miles;
    cardioByType[k].totalMinutes += c.minutes;
  });
  const cardioByTypeArr: Recap["cardio"]["byType"] = Object.entries(cardioByType)
    .map(([type, agg]) => ({
      type,
      sessions: agg.sessions,
      avgMiles: agg.sessions > 0 ? agg.totalMiles / agg.sessions : 0,
      totalMinutes: agg.totalMinutes,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const cardioTotalMinutes = cardioEntries.reduce((s, c) => s + c.minutes, 0);
  const cardioTotalMiles = cardioEntries.reduce((s, c) => s + c.miles, 0);

  // ─── Advanced cardio stats ────────────────────────────────────────────
  // Longest session by miles (preferred), or by minutes if no distances logged
  let longestCardio: Recap["cardio"]["longestSession"] = null;
  cardioEntries.forEach(c => {
    if (!longestCardio) {
      longestCardio = { type: c.type, miles: c.miles, minutes: c.minutes };
      return;
    }
    // Prefer the entry with more miles; fall back to more minutes
    const better = c.miles > longestCardio.miles ||
      (c.miles === 0 && longestCardio.miles === 0 && c.minutes > longestCardio.minutes);
    if (better) longestCardio = { type: c.type, miles: c.miles, minutes: c.minutes };
  });

  // Average pace (min/mile) — only counts entries with both miles AND minutes
  let avgPaceMinPerMi: number | null = null;
  const pacedEntries = cardioEntries.filter(c => c.miles > 0 && c.minutes > 0);
  if (pacedEntries.length > 0) {
    const totalMin = pacedEntries.reduce((s, c) => s + c.minutes, 0);
    const totalMi = pacedEntries.reduce((s, c) => s + c.miles, 0);
    avgPaceMinPerMi = totalMi > 0 ? totalMin / totalMi : null;
  }

  // Day-of-week breakdown for cardio
  const cardioDayLabels: string[] = (() => {
    const days = new Set<number>();
    cardioEntries.forEach(c => {
      const d = new Date(c.date);
      // c.date is local YYYY-MM-DD; parse it as a local day number
      const parts = c.date.split("-").map(Number);
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      days.add(dt.getDay());
    });
    const allDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return Array.from(days).sort((a, b) => a - b).map(i => allDays[i]);
  })();

  // ─── Wellness ─────────────────────────────────────────────────────────
  const wellnessLogs = inRange.filter(r => r.log_type === "wellness");
  const wellnessMinutesByDay: Record<string, number> = {};
  const wellnessSessionsByDay: Record<string, number> = {};
  const wellnessByType: Record<string, number> = {};
  wellnessLogs.forEach(l => {
    const k = isoDateLocal(new Date(l.logged_at || l.created_at!));
    // Real column is wellness_duration_min. Legacy `duration` checked as
    // a defensive fallback for any old data that might exist.
    const minutes = parseDurationToMinutes(l.wellness_duration_min ?? l.duration);
    wellnessMinutesByDay[k] = (wellnessMinutesByDay[k] || 0) + minutes;
    wellnessSessionsByDay[k] = (wellnessSessionsByDay[k] || 0) + 1;
    const type = (l.wellness_type || "Wellness").trim();
    wellnessByType[type] = (wellnessByType[type] || 0) + 1;
  });
  const wellnessByTypeArr: Recap["wellness"]["byType"] = Object.entries(wellnessByType)
    .map(([type, sessions]) => ({ type, sessions }))
    .sort((a, b) => b.sessions - a.sessions);
  const wellnessTotalMinutes = Object.values(wellnessMinutesByDay).reduce((a, b) => a + b, 0);

  // Longest single wellness session this week
  let longestWellness: Recap["wellness"]["longestSession"] = null;
  wellnessLogs.forEach(l => {
    const min = parseDurationToMinutes(l.wellness_duration_min ?? l.duration);
    const type = (l.wellness_type || "Wellness").trim();
    if (!longestWellness || min > longestWellness.minutes) {
      longestWellness = { type, minutes: min };
    }
  });
  // Best wellness day — most sessions
  let bestWellnessDay: Recap["wellness"]["bestDay"] = null;
  Object.entries(wellnessSessionsByDay).forEach(([date, sessions]) => {
    if (!bestWellnessDay || sessions > bestWellnessDay.sessions) {
      const parts = date.split("-").map(Number);
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      bestWellnessDay = { date, label: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getDay()], sessions };
    }
  });
  const wellnessVarietyCount = Object.keys(wellnessByType).length;

  // ─── Daily breakdown for chart ────────────────────────────────────────
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daily: Recap["daily"] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const k = isoDateLocal(d);
    daily.push({
      label: dayLabels[i],
      date: k,
      liftingMinutes: liftingMinutesByDay[k] || 0,
      cardioMinutes: cardioMinutesByDay[k] || 0,
      wellnessMinutes: wellnessMinutesByDay[k] || 0,
      liftingSessions: liftingSessionsByDay[k] || 0,
      cardioSessions: cardioSessionsByDay[k] || 0,
      wellnessSessions: wellnessSessionsByDay[k] || 0,
    });
  }

  // ─── Active days ──────────────────────────────────────────────────────
  // A day is "active" if any log_type has a row that day.
  const activeDaysSet = new Set<string>();
  inRange.forEach(l => {
    const ts = l.logged_at || l.created_at;
    if (ts) activeDaysSet.add(isoDateLocal(new Date(ts)));
  });

  // ─── Photos & places from posts ──────────────────────────────────────
  // Filter to posts within the week range — defensive in case caller
  // passed a wider window. Then pull the photo info for the Photos card
  // and dedupe location names for the Places Tagged section.
  const postsInRange = weekPosts.filter(p => {
    const ts = p.created_at;
    if (!ts) return false;
    const ms = new Date(ts).getTime();
    return ms >= startMs && ms <= endMs;
  });

  // Photos: each post can have multiple images. We only take the FIRST
  // image per post (lead photo) — showing every image from a 5-photo
  // carousel would crowd the mosaic and make one post look like many.
  // Skip videos in the photo card; they don't grid well as static images.
  const photos: Recap["photos"] = [];
  postsInRange.forEach(p => {
    const urls = (p.media_urls && p.media_urls.length > 0) ? p.media_urls : (p.media_url ? [p.media_url] : []);
    if (urls.length === 0) return;
    const types = p.media_types || [];
    const firstType = types[0] || (urls[0].match(/\.(mp4|mov|webm|m4v)(\?|$)/i) ? 'video' : 'image');
    if (firstType === 'video') return; // skip videos in mosaic
    const positions = p.media_positions;
    photos.push({
      url: urls[0],
      caption: p.caption || null,
      likes: p.likes_count || 0,
      position: typeof positions?.[0] === 'number' ? positions[0] : undefined,
    });
  });

  // Places: dedupe by location name. Lots of users tag the same gym
  // multiple times — we want the Places card to show variety, not
  // duplicates. Cap at 5 to keep the card legible.
  const placeMap = new Map<string, { name: string; city: string | null }>();
  postsInRange.forEach(p => {
    const loc = p.locationData;
    const name = loc?.name?.trim();
    if (!name) return;
    if (!placeMap.has(name)) {
      placeMap.set(name, { name, city: loc?.city || null });
    }
  });
  const placesTagged = Array.from(placeMap.values()).slice(0, 5);

  // Engagement totals
  const totalLikes = photos.reduce((s, p) => s + (p.likes || 0), 0);
  // Top post = highest-likes photo. Tied at 0 falls back to first photo.
  let topPost: Recap["topPost"] = null;
  photos.forEach(p => {
    if (!topPost || p.likes > topPost.likes) {
      topPost = { url: p.url, likes: p.likes, caption: p.caption, position: p.position };
    }
  });

  // ─── Most active day (any log type) ──────────────────────────────────
  // Aggregate all session counts by day, find the day with the most.
  const sessionsByDay: Record<string, number> = {};
  inRange.forEach(l => {
    const ts = l.logged_at || l.created_at;
    if (!ts) return;
    const k = isoDateLocal(new Date(ts));
    sessionsByDay[k] = (sessionsByDay[k] || 0) + 1;
  });
  let mostActiveDay: Recap["mostActiveDay"] = null;
  Object.entries(sessionsByDay).forEach(([date, sessions]) => {
    if (!mostActiveDay || sessions > mostActiveDay.sessions) {
      const parts = date.split("-").map(Number);
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      mostActiveDay = { date, label: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getDay()], sessions };
    }
  });

  // ─── vsLastWeek comparison ────────────────────────────────────────────
  // Only computed when caller passes priorWeekLogs. Compares total session
  // count and active-day count to detect "trending up/down."
  let vsLastWeek: Recap["vsLastWeek"] = null;
  if (priorWeekLogs && priorWeekLogs.length >= 0) {
    // Bound prior logs to the prior week's range to be defensive (caller
    // might have over-fetched). Prior week = weekStart - 7 days through
    // weekStart - 1 ms.
    const priorWeekStart = new Date(weekStart);
    priorWeekStart.setDate(priorWeekStart.getDate() - 7);
    const priorStartMs = priorWeekStart.getTime();
    const priorEndMs = startMs - 1;
    const priorInRange = priorWeekLogs.filter(l => {
      const ts = l.logged_at || l.created_at;
      if (!ts) return false;
      const ms = new Date(ts).getTime();
      return ms >= priorStartMs && ms <= priorEndMs;
    });
    const priorSessions = priorInRange.length;
    const priorActiveDays = new Set<string>();
    priorInRange.forEach(l => {
      const ts = l.logged_at || l.created_at;
      if (ts) priorActiveDays.add(isoDateLocal(new Date(ts)));
    });
    const thisSessions = inRange.length;
    const thisActiveDays = activeDaysSet.size;
    // % change. Avoid divide-by-zero by treating 0 prior as a 100% increase
    // for any nonzero this-week (or 0% if both are 0).
    const sessionsPct = priorSessions === 0
      ? (thisSessions === 0 ? 0 : 100)
      : Math.round(((thisSessions - priorSessions) / priorSessions) * 100);
    const activeDaysPct = priorActiveDays.size === 0
      ? (thisActiveDays === 0 ? 0 : 100)
      : Math.round(((thisActiveDays - priorActiveDays.size) / priorActiveDays.size) * 100);
    // Only set vsLastWeek if we have meaningful prior data, otherwise
    // it's misleading. "100% increase from 0" doesn't read well.
    if (priorSessions > 0 || priorActiveDays.size > 0) {
      vsLastWeek = {
        sessionsPct,
        activeDaysPct,
        sessionsDelta: thisSessions - priorSessions,
        activeDaysDelta: thisActiveDays - priorActiveDays.size,
        lastWeekSessions: priorSessions,
        lastWeekActiveDays: priorActiveDays.size,
      };
    }
  }

  const hasActivity =
    liftingLogs.length > 0 || cardioEntries.length > 0 || wellnessLogs.length > 0;

  return {
    weekStart: isoDateLocal(weekStart),
    weekEnd: isoDateLocal(weekEnd),
    rangeLabel: formatRange(weekStart, weekEnd),
    lifts: {
      sessions: liftingLogs.length,
      totalMinutes: liftingTotalMinutes,
      prs,
      bestLifts,
      totalVolume,
      totalSets,
      heaviestSet,
      mostTrained,
      uniqueExercises,
    },
    cardio: {
      sessions: cardioEntries.length,
      totalMinutes: cardioTotalMinutes,
      totalMiles: cardioTotalMiles,
      byType: cardioByTypeArr,
      longestSession: longestCardio,
      avgPaceMinPerMi,
      cardioDays: cardioDayLabels,
    },
    wellness: {
      sessions: wellnessLogs.length,
      totalMinutes: wellnessTotalMinutes,
      byType: wellnessByTypeArr,
      varietyCount: wellnessVarietyCount,
      bestDay: bestWellnessDay,
      longestSession: longestWellness,
    },
    daily,
    badgesEarned: badgesThisWeek,
    photos,
    totalLikes,
    topPost,
    placesTagged,
    mostActiveDay,
    vsLastWeek,
    hasActivity,
    activeDays: activeDaysSet.size,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────

/** Parse various duration shapes (string "30", number 30, "30:00") to minutes. */
function parseDurationToMinutes(d: any): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === "number") return Math.max(0, d);
  if (typeof d !== "string") return 0;
  const s = d.trim();
  if (!s) return 0;
  // "M:SS" or "H:MM:SS" forms — parse as duration. Mostly we expect plain "30".
  if (s.includes(":")) {
    const parts = s.split(":").map(Number);
    if (parts.length === 2) return (parts[0] || 0) + (parts[1] || 0) / 60;
    if (parts.length === 3) return (parts[0] || 0) * 60 + (parts[1] || 0) + (parts[2] || 0) / 60;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.max(0, n);
}

/** Parse the first number out of any value type. Used for weights/reps/sets
 *  fields that can come as numbers, plain strings, or strings with units. */
function parseFirstNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

/**
 * Find the heaviest set of an exercise. Handles three shapes the data has:
 *   • Per-set weights array: weights[] = ["135","145","155"]
 *   • Single weight string: weight = "225"
 *   • Plain string with units: "225lb" / "225 lbs" — strip non-numeric
 *
 * Returns null if no parseable weight. Reps comes from the reps field
 * (we don't have per-set reps; this is "reps target for the heaviest set").
 */
function bestSetWeightFromExercise(
  ex: { weight?: string; weights?: string[]; reps?: string }
): { weight: number; reps: number } | null {
  const reps = parseFloat((ex.reps || "0").replace(/[^0-9.]/g, "")) || 0;
  let max = 0;
  if (Array.isArray(ex.weights)) {
    ex.weights.forEach(w => {
      const n = parseFloat((w || "").replace(/[^0-9.]/g, ""));
      if (!isNaN(n) && n > max) max = n;
    });
  }
  const single = parseFloat((ex.weight || "").replace(/[^0-9.]/g, ""));
  if (!isNaN(single) && single > max) max = single;
  if (max <= 0) return null;
  return { weight: max, reps };
}

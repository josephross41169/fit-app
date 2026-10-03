// Shared workout-stat helpers (used by WorkoutProgressGraphs and the
// profile Activity box). Keep the math in ONE place so the box and the
// full graphs view always show the same numbers.
import { EXERCISES } from "@/lib/exercises";

// Build a fast lookup of exercise name → category (Chest, Back, Legs, etc.)
// once at module load. Keys are normalized lowercase; on lookup we also try a
// substring match so "Bench Press (heavy)" or "barbell bench press" still
// resolves. This map drives the "What you trained" chip cloud — it shows the
// real muscle group(s) trained based on the exercises logged, instead of
// reading the user's freeform workout title (which could be anything).
const EXERCISE_CATEGORY_MAP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  EXERCISES.forEach(e => m.set(e.name.toLowerCase(), e.category));
  return m;
})();

// Resolve an exercise name to a muscle-group category. Falls back to substring
// matching so partial / messy names still bucket correctly. Returns null if
// nothing matches — the caller can decide how to handle (we ignore it so we
// never invent a category for a typo).
export function categoryForExercise(name: string): string | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  const exact = EXERCISE_CATEGORY_MAP.get(key);
  if (exact) return exact;
  // Substring fallback — match the longest known exercise name contained in
  // the input. Prevents "Squat" matching "Goblet Squat" via prefix when the
  // full name is in the map. We iterate longest-first.
  const candidates: string[] = [];
  EXERCISE_CATEGORY_MAP.forEach((_, k) => {
    if (key.includes(k) || k.includes(key)) candidates.push(k);
  });
  if (candidates.length === 0) return categoryByKeyword(key);
  candidates.sort((a, b) => b.length - a.length);
  return EXERCISE_CATEGORY_MAP.get(candidates[0]) || null;
}

// Last resort for names that aren't in the exercise library ("MTS high row",
// "Diverging lat pull downs", machine brand names…): bucket by keywords.
// Order matters — "leg raise" is core, "leg curl" is legs, "shoulder press"
// is shoulders, a plain "curl" is biceps.
const KEYWORD_CATEGORIES: [RegExp, string][] = [
  [/\b(leg raise|knee raise|crunch|plank|sit ?-?ups?|abs?|oblique|russian twist|ab wheel|hollow|v-?ups?|core)\b/, "Core"],
  [/\b(leg curl|leg extension|leg press|squat|lunge|calf|calves|hamstring|quad|step ?-?ups?|split squat|legs?)\b/, "Legs"],
  [/\b(hip thrust|glute|bridge|kickback|abduct)/, "Glutes"],
  [/\b(rows?|pull ?-?downs?|pull ?-?ups?|chin ?-?ups?|lats?|deadlifts?|back extension|pullover)\b/, "Back"],
  [/\b(shoulders?|overhead press|ohp|military|lateral raise|lat raise|front raise|rear delts?|delts?|face pulls?|arnold|shrugs?|upright row)\b/, "Shoulders"],
  [/\b(bench|chest|fly|flyes?|flys|pec|push ?-?ups?|incline press|decline press)\b/, "Chest"],
  [/\b(curls?|biceps?|preacher|hammer)\b/, "Biceps"],
  [/\b(triceps?|skull ?crushers?|push ?-?downs?|dips?|kickbacks?|close ?-?grip)\b/, "Triceps"],
];
function categoryByKeyword(key: string): string | null {
  // Shoulder / upright-row style names win over the generic "row" → Back rule.
  if (/\b(shoulder|overhead|military|lateral raise|upright row|rear delt|face pull)/.test(key)) return "Shoulders";
  for (const [re, cat] of KEYWORD_CATEGORIES) if (re.test(key)) return cat;
  return null;
}

// Bucket a cardio entry's freeform type string (which can be anything the
// user typed when logging — "Morning Run", "treadmill", "running", "trail
// run", "biking") into one of a fixed set of canonical disciplines. This
// keeps the "What you trained" chip cloud tight: all run subtypes show up
// as a single "Running" chip with a combined session count instead of
// four separate chips.
//
// Mirrors the normalizeCardio function in app/(app)/stats/page.tsx — keep
// them in sync if you add new cardio types in one place. Returns the
// canonical label or null if the input is blank.
function normalizeCardioForChip(raw: string): string | null {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return null;
  const TYPES: { keys: string[]; label: string }[] = [
    { keys: ['run', 'jog', 'sprint', 'treadmill', 'trail'], label: 'Running' },
    { keys: ['cycle', 'bike', 'cycling', 'spin'], label: 'Cycling' },
    { keys: ['swim'], label: 'Swimming' },
    { keys: ['row', 'rowing', 'erg'], label: 'Rowing' },
    { keys: ['elliptical'], label: 'Elliptical' },
    { keys: ['stair'], label: 'Stair Climber' },
    { keys: ['hiit'], label: 'HIIT' },
    { keys: ['walk'], label: 'Walking' },
    { keys: ['hike', 'hiking'], label: 'Hiking' },
  ];
  for (const { keys, label } of TYPES) {
    if (keys.some(k => s.includes(k))) return label;
  }
  // Unknown type — pass it through as-is (capitalized) rather than dropping
  // it, so users still see weird/legacy entries instead of them silently
  // disappearing.
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Run-subtype labels. The post page stores `run_type` on running cardio
// entries (outdoor / treadmill / trail / hiit). We surface those as distinct
// chips so a treadmill run reads differently from an outdoor run, instead of
// everything collapsing into one "Running" chip.
const RUN_TYPE_CHIP_LABELS: Record<string, string> = {
  outdoor:   'Outdoor Run',
  treadmill: 'Treadmill Run',
  trail:     'Trail Run',
  hiit:      'HIIT',
};

// Chip label for a cardio ENTRY (not just its type string). Running entries
// split by run_type; everything else (and runs with no run_type, e.g. legacy
// logs) falls back to the canonical discipline label.
export function cardioChipLabel(c: any): string | null {
  const type = (c?.type || '').toString().toLowerCase();
  const isRun = ['run', 'jog', 'sprint', 'treadmill', 'trail'].some(k => type.includes(k));
  if (isRun && c?.run_type && RUN_TYPE_CHIP_LABELS[c.run_type]) {
    return RUN_TYPE_CHIP_LABELS[c.run_type];
  }
  // No run_type (or non-running cardio) → canonical discipline.
  return normalizeCardioForChip(c?.type || '');
}


/**
 * Headline stats for the CURRENT calendar month — identical math to the
 * 4-up stat row in WorkoutProgressGraphs ("This Mo" view):
 *   lifts        = sum of per-workout muscle-group hits
 *   cardio       = sum of per-workout cardio-type hits
 *   muscleGroups = distinct muscle groups trained
 *   avgPerWeek   = workouts / weeks elapsed since the 1st ("—" if none)
 */
export function currentMonthWorkoutStats(workouts: any[], now: Date = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const inMonth = (workouts || []).filter((w: any) => {
    const d = new Date(w.logged_at || w.created_at || w.id || 0);
    return !isNaN(d.getTime()) && d >= start && d <= end;
  });
  let lifts = 0, cardio = 0;
  const groups = new Set<string>();
  // Per-day workout count (index 0 = the 1st) and per-group session counts,
  // for the Activity box's mini charts.
  const daily: number[] = new Array(end.getDate()).fill(0);
  const groupCounts = new Map<string, number>();
  inMonth.forEach((w: any) => {
    const hitCats = new Set<string>(); const hitCardio = new Set<string>();
    (w.exercises || w.workout?.exercises || []).forEach((ex: any) => { const c = categoryForExercise(ex?.name || ''); if (c) hitCats.add(c); });
    (w.cardio || w.workout?.cardio || []).forEach((c: any) => { const t = cardioChipLabel(c); if (t) hitCardio.add(t); });
    lifts += hitCats.size; cardio += hitCardio.size;
    hitCats.forEach(c => { groups.add(c); groupCounts.set(c, (groupCounts.get(c) || 0) + 1); });
    const d = new Date(w.logged_at || w.created_at || w.id || 0);
    daily[d.getDate() - 1] += 1;
  });
  const refEnd = end > now ? now : end;
  const weeks = Math.max(1, (refEnd.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return {
    monthLabel: now.toLocaleString("en-US", { month: "long" }),
    lifts, cardio, muscleGroups: groups.size,
    daily, today: now.getDate(),
    topGroups: Array.from(groupCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count })),
    avgPerWeek: inMonth.length ? (inMonth.length / weeks).toFixed(1) : "—",
  };
}


const CARDIO_EMOJI: Record<string, string> = {
  Running: "🏃", "Outdoor Run": "🏃", "Treadmill Run": "🏃", "Trail Run": "🏃", Cycling: "🚴", Swimming: "🏊",
  Rowing: "🚣", Walking: "🚶", Hiking: "🥾", HIIT: "⚡", Elliptical: "🔁", "Stair Climber": "🪜",
  Yoga: "🧘", Pilates: "🧘", Boxing: "🥊", Basketball: "🏀", Soccer: "⚽", Tennis: "🎾", Pickleball: "🏓", Golf: "⛳", Climbing: "🧗",
};
const prettyCat = (c: string) => c.replace(/[_-]+/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());

/**
 * One-glance summary of the current month for the profile Activity box:
 * how much you trained, what cardio you did, and your wellness sessions.
 * `logs` = workout + wellness activity_logs rows (any order).
 */
export function monthActivitySummary(logs: any[], now: Date = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const inMonth = (logs || []).filter((l: any) => {
    const d = new Date(l.logged_at || l.created_at || 0);
    return !isNaN(d.getTime()) && d >= start && d <= end;
  });
  const workouts = inMonth.filter((l: any) => l.log_type === "workout");
  const wellnessLogs = inMonth.filter((l: any) => l.log_type === "wellness");
  const days = new Set<string>();
  inMonth.forEach((l: any) => { if (l.log_type === "workout" || l.log_type === "wellness") days.add(new Date(l.logged_at || l.created_at).toDateString()); });

  let liftSessions = 0, cardioSessions = 0, minutes = 0, sets = 0;
  const groupCounts = new Map<string, number>();
  const cardio = new Map<string, { count: number; minutes: number; miles: number }>();
  const addCardio = (label: string, mins: number, miles: number) => {
    const cur = cardio.get(label) || { count: 0, minutes: 0, miles: 0 };
    cur.count += 1; cur.minutes += mins; cur.miles += miles; cardio.set(label, cur);
  };
  workouts.forEach((w: any) => {
    const exs = (w.exercises || []).filter((e: any) => e?.name);
    if (exs.length) {
      liftSessions += 1;
      const hit = new Set<string>();
      exs.forEach((e: any) => {
        sets += parseInt(e.sets) || 0;
        const c = categoryForExercise(e.name);
        if (c && c !== "Cardio") hit.add(c);
      });
      hit.forEach(c => groupCounts.set(c, (groupCounts.get(c) || 0) + 1));
    }
    minutes += Number(w.workout_duration_min) || 0;
    const cs = (w.cardio || []).filter(Boolean);
    if (cs.length) {
      cardioSessions += 1;
      cs.forEach((c: any) => {
        const label = cardioChipLabel(c) || "Cardio";
        const miles = c.miles != null ? Number(c.miles) || 0 : (/swim/i.test(c.type || "") ? 0 : parseFloat(c.distance) || 0);
        addCardio(label, Number(c.duration) || 0, miles);
      });
    } else if (!exs.length && w.workout_category && w.workout_category !== "lifting") {
      // "Other" workouts (HIIT, yoga, sports…) with no cardio entries.
      cardioSessions += 1;
      addCardio(prettyCat(String(w.workout_category)), Number(w.workout_duration_min) || 0, 0);
    }
  });

  const wellness = new Map<string, { count: number; minutes: number }>();
  wellnessLogs.forEach((l: any) => {
    const t = (l.wellness_type || "Wellness").toString();
    const cur = wellness.get(t) || { count: 0, minutes: 0 };
    cur.count += 1; cur.minutes += Number(l.wellness_duration_min) || 0; wellness.set(t, cur);
  });

  const refEnd = end > now ? now : end;
  const weeks = Math.max(1, (refEnd.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const byCount = <T extends { count: number }>(m: Map<string, T>) =>
    Array.from(m.entries()).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).map(([name, v]) => ({ name, ...v }));
  return {
    monthLabel: now.toLocaleString("en-US", { month: "long" }),
    workouts: workouts.length,
    activeDays: days.size,
    liftSessions, cardioSessions, sets, minutes,
    wellnessSessions: wellnessLogs.length,
    avgPerWeek: workouts.length ? (workouts.length / weeks).toFixed(1) : "—",
    muscleGroups: byCount(new Map(Array.from(groupCounts.entries()).map(([k, v]) => [k, { count: v }]))),
    cardio: byCount(cardio).map(c => ({ ...c, emoji: CARDIO_EMOJI[c.name] || "🔥" })),
    wellness: byCount(wellness),
  };
}

/** "95 min" → "1h 35m"; 0 → "—". */
export function fmtMinutes(m: number): string {
  if (!m) return "—";
  const h = Math.floor(m / 60), r = Math.round(m % 60);
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}

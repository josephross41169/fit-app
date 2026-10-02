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
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.length - a.length);
  return EXERCISE_CATEGORY_MAP.get(candidates[0]) || null;
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
  inMonth.forEach((w: any) => {
    const hitCats = new Set<string>(); const hitCardio = new Set<string>();
    (w.exercises || w.workout?.exercises || []).forEach((ex: any) => { const c = categoryForExercise(ex?.name || ''); if (c) hitCats.add(c); });
    (w.cardio || w.workout?.cardio || []).forEach((c: any) => { const t = cardioChipLabel(c); if (t) hitCardio.add(t); });
    lifts += hitCats.size; cardio += hitCardio.size;
    hitCats.forEach(c => groups.add(c));
  });
  const refEnd = end > now ? now : end;
  const weeks = Math.max(1, (refEnd.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return {
    monthLabel: now.toLocaleString("en-US", { month: "long" }),
    lifts, cardio, muscleGroups: groups.size,
    avgPerWeek: inMonth.length ? (inMonth.length / weeks).toFixed(1) : "—",
  };
}

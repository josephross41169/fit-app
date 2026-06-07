// Fit App — AI Workout Plan Generator
// 100% client-side logic — no API, no cost, instant
// Competes with Fitbod / Dr. Muscle

import { EXERCISES, Exercise, Equipment, Category } from "./exercises";

// ── Types ──────────────────────────────────────────────────────────────────────

export type Goal = "strength" | "hypertrophy" | "fat_loss" | "endurance" | "athletic";
export type Level = "beginner" | "intermediate" | "advanced";
export type Split = "full_body" | "upper_lower" | "ppl" | "ppl_x2" | "bro" | "hybrid";
export type Sex = "male" | "female" | "other";
export type Injury = "knee" | "shoulder" | "lower_back" | "elbow" | "wrist" | "neck" | "hip" | "ankle";

export interface PlanConfig {
  goal: Goal;
  level: Level;
  daysPerWeek: 3 | 4 | 5 | 6;
  equipment: Equipment[];
  focusMuscles?: Category[]; // optional bias
  // ── Personalization (all optional — each one refines the plan when given) ──
  sex?: Sex;                   // sets sensible recovery/rest defaults
  age?: number;                // years — older trainees get a bit less volume + more rest
  heightCm?: number;           // for BMI guidance only
  weightKg?: number;           // for BMI guidance only
  minutesPerSession?: number;  // 30 | 45 | 60 | 75 | 90 — drives exercises per day
  injuries?: Injury[];         // areas to protect — violating moves get swapped out
}

export interface PlannedExercise {
  name: string;
  category: Category;
  equipment: Equipment;
  muscles: string[];
  sets: number;
  reps: string;        // e.g. "8-12" or "5"
  rest: string;        // e.g. "60s" or "3 min"
  notes?: string;
}

export interface TrainingDay {
  dayNum: number;
  label: string;       // e.g. "Push Day" or "Full Body A"
  focus: string;       // e.g. "Chest, Shoulders, Triceps"
  exercises: PlannedExercise[];
  estimatedMinutes: number;
}

export interface WeeklyPlan {
  split: Split;
  splitName: string;
  goal: Goal;
  level: Level;
  days: TrainingDay[];
  restDays: number[];  // day numbers that are rest (1=Mon)
  tips: string[];
  weeklyVolume: string;
}

// ── Sets/Reps/Rest by goal ─────────────────────────────────────────────────────

function getWorkParams(goal: Goal, level: Level, isCompound: boolean) {
  const base = {
    strength:    { sets: isCompound ? 5 : 3, reps: isCompound ? "3-5" : "5-8",   rest: isCompound ? "3-5 min" : "2-3 min" },
    hypertrophy: { sets: isCompound ? 4 : 3, reps: isCompound ? "6-10" : "10-15", rest: isCompound ? "90s" : "60s" },
    fat_loss:    { sets: 3,                  reps: "12-15",                        rest: "45s" },
    endurance:   { sets: 2,                  reps: "15-20",                        rest: "30s" },
    athletic:    { sets: isCompound ? 4 : 3, reps: isCompound ? "4-6" : "8-12",   rest: isCompound ? "2-3 min" : "90s" },
  }[goal];

  // Advanced adds a set
  if (level === "advanced" && base.sets < 6) base.sets += 1;
  return base;
}

// ── Compound vs accessory ──────────────────────────────────────────────────────

const COMPOUNDS = new Set([
  "Bench Press", "Incline Bench Press", "Decline Bench Press",
  "Squat", "Front Squat", "Deadlift", "Romanian Deadlift", "Sumo Deadlift",
  "Overhead Press", "Barbell Row", "Pendlay Row", "Pull-Up", "Chin-Up",
  "Hip Thrust", "Bulgarian Split Squat", "Leg Press", "Dips (Chest)",
  "Push Press", "Power Clean", "Clean and Jerk", "Snatch", "Thruster",
  "T-Bar Row", "Close Grip Bench Press",
]);

function isCompound(name: string) { return COMPOUNDS.has(name); }

// ── Filter exercises by equipment ──────────────────────────────────────────────

function filterByEquipment(exList: Exercise[], equipment: Equipment[]): Exercise[] {
  if (equipment.length === 0) return exList;
  return exList.filter(e => equipment.includes(e.equipment));
}

// ── Pick best exercises for a muscle group ─────────────────────────────────────

function pickExercises(
  categories: Category[],
  equipment: Equipment[],
  count: number,
  goal: Goal,
  preferCompound = true,
): Exercise[] {
  const pool = filterByEquipment(
    EXERCISES.filter(e => categories.includes(e.category) && e.category !== "Cardio" && e.category !== "Stretching"),
    equipment,
  );

  // Shuffle pool first so regenerate gives different exercises
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Then sort: compounds first for strength/athletic/hypertrophy goals (stable within shuffle)
  const sorted = shuffled.sort((a, b) => {
    const aComp = isCompound(a.name) ? 1 : 0;
    const bComp = isCompound(b.name) ? 1 : 0;
    if (preferCompound && (goal === "strength" || goal === "athletic" || goal === "hypertrophy")) {
      return bComp - aComp;
    }
    return 0;
  });

  // Deduplicate categories — prefer variety
  const picked: Exercise[] = [];
  const usedNames = new Set<string>();
  const usedCategories: Record<string, number> = {};

  for (const ex of sorted) {
    if (picked.length >= count) break;
    if (usedNames.has(ex.name)) continue;
    const catCount = usedCategories[ex.category] ?? 0;
    // Max 3 of the same category in one day (prevents e.g. 6 chest exercises)
    if (catCount >= 3) continue;
    picked.push(ex);
    usedNames.add(ex.name);
    usedCategories[ex.category] = catCount + 1;
  }
  return picked;
}

// ── Build a training day ──────────────────────────────────────────────────────

function buildDay(
  dayNum: number,
  label: string,
  focus: string,
  categories: Category[],
  equipment: Equipment[],
  goal: Goal,
  level: Level,
  exerciseCount: number,
): TrainingDay {
  const exercises = pickExercises(categories, equipment, exerciseCount, goal);

  const planned: PlannedExercise[] = exercises.map(ex => {
    const compound = isCompound(ex.name);
    const params = getWorkParams(goal, level, compound);
    return {
      name: ex.name,
      category: ex.category,
      equipment: ex.equipment,
      muscles: ex.muscles,
      sets: params.sets,
      reps: params.reps,
      rest: params.rest,
    };
  });

  const estimatedMinutes = planned.reduce((acc, ex) => {
    const restSecs = ex.rest === "3-5 min" ? 240 : ex.rest === "2-3 min" ? 150 : ex.rest === "90s" ? 90 : ex.rest === "60s" ? 60 : 45;
    return acc + ex.sets * (45 + restSecs / 1000 * 60);
  }, 0) / 60 + 10; // +10 warmup

  return { dayNum, label, focus, exercises: planned, estimatedMinutes: Math.round(estimatedMinutes) };
}

// ── Personalization helpers ────────────────────────────────────────────────────
// Injury → exercise-name keywords to avoid (matched case-insensitively as
// substrings, so this is robust to the exact names in the library). We keep the
// staple compounds (e.g. we do NOT blanket-ban squats for knees) and instead
// drop the higher-risk movements, then swap in a safer same-category option.
const INJURY_AVOID: Record<Injury, string[]> = {
  knee:       ["jump", "plyo", "sprint", "box ", "lunge", "leg extension", "pistol", "skater", "step-up", "step up"],
  shoulder:   ["overhead press", "behind", "upright row", "dip", "snatch", "jerk", "push press", "arnold"],
  lower_back: ["deadlift", "barbell row", "pendlay", "good morning", "bent over", "bent-over", "t-bar"],
  elbow:      ["skullcrusher", "skull crusher", "close grip", "close-grip", "preacher", "overhead extension", "overhead tricep"],
  wrist:      ["barbell curl", "reverse curl", "front squat", "upright row"],
  neck:       ["behind the neck", "behind-the-neck", "behind neck", "overhead press"],
  hip:        ["good morning", "sumo", "deficit", "deep"],
  ankle:      ["jump", "plyo", "sprint", "box ", "standing calf", "calf raise"],
};

function violatesInjury(name: string, injuries?: Injury[]): boolean {
  if (!injuries || injuries.length === 0) return false;
  const n = name.toLowerCase();
  return injuries.some(inj => (INJURY_AVOID[inj] || []).some(kw => n.includes(kw)));
}

// Swap any exercise that loads an injured area for a safe same-category,
// same-equipment alternative. If no safe alternative exists in the user's
// equipment, the exercise is left in place — a partial plan beats an empty day.
function applyInjuries(days: TrainingDay[], injuries: Injury[] | undefined, equipment: Equipment[]) {
  if (!injuries || injuries.length === 0) return;
  for (const day of days) {
    const dayNames = new Set(day.exercises.map(e => e.name));
    for (let i = 0; i < day.exercises.length; i++) {
      const ex = day.exercises[i];
      if (!violatesInjury(ex.name, injuries)) continue;
      const candidates = EXERCISES.filter(e =>
        e.category === ex.category &&
        e.category !== "Cardio" && e.category !== "Stretching" &&
        equipment.includes(e.equipment) &&
        !dayNames.has(e.name) &&
        !violatesInjury(e.name, injuries)
      );
      if (candidates.length === 0) continue;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      dayNames.delete(ex.name);
      dayNames.add(pick.name);
      day.exercises[i] = { ...ex, name: pick.name, category: pick.category, equipment: pick.equipment, muscles: pick.muscles };
    }
  }
}

// Rest tiers low → high. Nudges rest up (older = more recovery) or down (women
// recover faster between sets on isolation work).
const REST_TIERS = ["30s", "45s", "60s", "90s", "2-3 min", "3-5 min"];
function shiftRest(rest: string, dir: 1 | -1): string {
  const i = REST_TIERS.indexOf(rest);
  if (i === -1) return rest;
  return REST_TIERS[Math.max(0, Math.min(REST_TIERS.length - 1, i + dir))];
}

// Age & sex tuning — conservative by design. Older trainees get a touch less
// volume on the big lifts and a bit more rest (recovery capacity declines with
// age). Women recover faster between sets, so we trim rest slightly on isolation
// work. These set sensible defaults; they don't overhaul the programming.
function applyAgeSex(days: TrainingDay[], age?: number, sex?: Sex) {
  for (const day of days) {
    for (const ex of day.exercises) {
      const compound = isCompound(ex.name);
      if (age && age >= 60) {
        if (ex.sets > 2) ex.sets -= 1;
        ex.rest = shiftRest(ex.rest, 1);
      } else if (age && age >= 50) {
        if (compound && ex.sets > 3) ex.sets -= 1;
        ex.rest = shiftRest(ex.rest, 1);
      }
      if (sex === "female" && !compound) ex.rest = shiftRest(ex.rest, -1);
    }
  }
}

// Recompute a day's time estimate after sets/rest were adjusted — mirrors the
// formula in buildDay so estimates stay consistent across the app.
function recalcMinutes(day: TrainingDay) {
  const mins = day.exercises.reduce((acc, ex) => {
    const restSecs = ex.rest === "3-5 min" ? 240 : ex.rest === "2-3 min" ? 150 : ex.rest === "90s" ? 90 : ex.rest === "60s" ? 60 : 45;
    return acc + ex.sets * (45 + restSecs / 1000 * 60);
  }, 0) / 60 + 10;
  day.estimatedMinutes = Math.round(mins);
}

// Exercises per day from session length (falls back to the level default).
function exercisesForSession(minutes: number | undefined, level: Level): number {
  const base = level === "beginner" ? 5 : level === "intermediate" ? 6 : 7;
  if (!minutes) return base;
  if (minutes <= 30) return Math.max(3, Math.min(base, 4));
  if (minutes <= 45) return Math.min(base, 5);
  if (minutes <= 60) return base;
  if (minutes <= 75) return base + 1;
  return Math.min(9, base + 2);
}

// ── Split strategies ──────────────────────────────────────────────────────────

export function generatePlan(config: PlanConfig): WeeklyPlan {
  const { goal, level, daysPerWeek, equipment, sex, age, minutesPerSession, injuries, heightCm, weightKg } = config;
  const exPerDay = exercisesForSession(minutesPerSession, level);

  let days: TrainingDay[] = [];
  let split: Split;
  let splitName: string;
  let restDays: number[] = [];

  // ── 3 days ─────────────────────────────────────────────────────────────────
  if (daysPerWeek === 3) {
    if (level === "beginner" || goal === "fat_loss" || goal === "endurance") {
      split = "full_body";
      splitName = "Full Body 3x";
      const fullBodyCats: Category[] = ["Chest", "Back", "Legs", "Shoulders", "Core"];
      days = [
        buildDay(1, "Full Body A", "Quads, Chest, Back", fullBodyCats, equipment, goal, level, exPerDay),
        buildDay(3, "Full Body B", "Hamstrings, Shoulders, Back", fullBodyCats, equipment, goal, level, exPerDay),
        buildDay(5, "Full Body C", "Full Body + Core", [...fullBodyCats, "Core", "Biceps", "Triceps"], equipment, goal, level, exPerDay),
      ];
      restDays = [2, 4, 6, 7];
    } else {
      split = "ppl";
      splitName = "Push / Pull / Legs";
      days = [
        buildDay(1, "Push", "Chest, Shoulders, Triceps", ["Chest", "Shoulders", "Triceps"], equipment, goal, level, exPerDay),
        buildDay(3, "Pull", "Back, Biceps, Rear Delts", ["Back", "Biceps"], equipment, goal, level, exPerDay),
        buildDay(5, "Legs", "Quads, Hamstrings, Glutes, Calves", ["Legs", "Glutes", "Core"], equipment, goal, level, exPerDay),
      ];
      restDays = [2, 4, 6, 7];
    }
  }

  // ── 4 days ─────────────────────────────────────────────────────────────────
  else if (daysPerWeek === 4) {
    split = "upper_lower";
    splitName = "Upper / Lower";
    days = [
      buildDay(1, "Upper A", "Chest, Back, Shoulders", ["Chest", "Back", "Shoulders", "Biceps", "Triceps"], equipment, goal, level, exPerDay),
      buildDay(2, "Lower A", "Quads, Hamstrings, Glutes", ["Legs", "Glutes", "Core"], equipment, goal, level, exPerDay),
      buildDay(4, "Upper B", "Back, Chest, Arms", ["Back", "Chest", "Biceps", "Triceps", "Shoulders"], equipment, goal, level, exPerDay),
      buildDay(5, "Lower B", "Hamstrings, Glutes, Calves, Core", ["Legs", "Glutes", "Core"], equipment, goal, level, exPerDay),
    ];
    restDays = [3, 6, 7];
  }

  // ── 5 days ─────────────────────────────────────────────────────────────────
  else if (daysPerWeek === 5) {
    split = "hybrid";
    splitName = "Upper / Lower + PPL";
    days = [
      buildDay(1, "Push", "Chest, Shoulders, Triceps", ["Chest", "Shoulders", "Triceps"], equipment, goal, level, exPerDay),
      buildDay(2, "Pull", "Back, Biceps, Rear Delts", ["Back", "Biceps"], equipment, goal, level, exPerDay),
      buildDay(3, "Legs A", "Quads, Glutes, Core", ["Legs", "Glutes", "Core"], equipment, goal, level, exPerDay),
      buildDay(5, "Upper", "Chest, Back, Arms", ["Chest", "Back", "Biceps", "Triceps", "Shoulders"], equipment, goal, level, exPerDay),
      buildDay(6, "Legs B", "Hamstrings, Glutes, Calves", ["Legs", "Glutes"], equipment, goal, level, exPerDay),
    ];
    restDays = [4, 7];
  }

  // ── 6 days ─────────────────────────────────────────────────────────────────
  else {
    split = "ppl_x2";
    splitName = "Push / Pull / Legs × 2";
    days = [
      buildDay(1, "Push A", "Chest, Shoulders, Triceps", ["Chest", "Shoulders", "Triceps"], equipment, goal, level, exPerDay),
      buildDay(2, "Pull A", "Back, Biceps", ["Back", "Biceps"], equipment, goal, level, exPerDay),
      buildDay(3, "Legs A", "Quads, Glutes, Core", ["Legs", "Glutes", "Core"], equipment, goal, level, exPerDay),
      buildDay(4, "Push B", "Shoulders, Chest, Triceps", ["Shoulders", "Chest", "Triceps"], equipment, goal, level, exPerDay),
      buildDay(5, "Pull B", "Back, Biceps, Forearms", ["Back", "Biceps", "Forearms"], equipment, goal, level, exPerDay),
      buildDay(6, "Legs B", "Hamstrings, Glutes, Calves", ["Legs", "Glutes"], equipment, goal, level, exPerDay),
    ];
    restDays = [7];
  }

  // ── Personalization post-pass ─────────────────────────────────────────────
  // Runs before volume/time are tallied so the totals reflect the adjustments.
  applyInjuries(days, injuries, equipment);
  applyAgeSex(days, age, sex);
  days.forEach(recalcMinutes);

  // ── Tips by goal ─────────────────────────────────────────────────────────
  const TIPS: Record<Goal, string[]> = {
    strength: [
      "Log your lifts every session — progressive overload drives everything.",
      "Rest fully between sets. 3-5 min on the big lifts is not optional.",
      "Eat at a slight calorie surplus and hit 0.8-1g protein per lb bodyweight.",
      "Deload every 4-6 weeks: drop volume by 40% to let your CNS recover.",
    ],
    hypertrophy: [
      "Train each muscle 2x/week for maximum growth stimulus.",
      "Focus on the eccentric (lowering) — 2-3 seconds down on each rep.",
      "Aim for 10-20 sets per muscle group per week.",
      "Sleep 7-9 hours — muscle is built during recovery, not the gym.",
    ],
    fat_loss: [
      "Cardio is a bonus — diet is 80% of fat loss. Hit your calorie deficit first.",
      "Keep protein high (1g/lb) to preserve muscle while cutting.",
      "Shorter rest periods keep heart rate elevated and burn more calories.",
      "Progressive overload still matters — don't let strength drop significantly.",
    ],
    endurance: [
      "Add cardio on rest days — 20-30 min moderate intensity.",
      "Circuit training: move from exercise to exercise with minimal rest.",
      "Stay hydrated — endurance training increases fluid loss significantly.",
      "Build aerobic base first, then layer in strength work.",
    ],
    athletic: [
      "Prioritize multi-joint compound movements — they build real-world strength.",
      "Train explosively: the concentric (lifting) phase should be fast and powerful.",
      "Add agility or sport-specific drills on off days.",
      "Mobility work 10 min daily prevents injury and improves performance.",
    ],
  };

  const totalSets = days.flatMap(d => d.exercises).reduce((acc, ex) => acc + ex.sets, 0);

  // Tailored tips from the personalization inputs — shown ahead of the goal tips
  // so the plan visibly reflects what the user told us.
  const personalTips: string[] = [];
  if (injuries && injuries.length > 0) {
    const NAME: Record<Injury, string> = { knee:"knees", shoulder:"shoulders", lower_back:"lower back", elbow:"elbows", wrist:"wrists", neck:"neck", hip:"hips", ankle:"ankles" };
    personalTips.push(`Your plan steers around movements that stress your ${injuries.map(i => NAME[i]).join(", ")}. If anything still bothers you, tap 🔄 to swap it.`);
  }
  if (age && age >= 50) personalTips.push("We trimmed a little volume and added rest — recovery matters more past 50. Warm up thoroughly before the heavy sets.");
  if (sex === "female") personalTips.push("Shorter rests on isolation work suit faster between-set recovery — push the reps on those.");
  if (minutesPerSession && minutesPerSession <= 45) personalTips.push("Tight on time? Superset opposing muscles (e.g. chest + back) to fit the work into your window.");
  if (heightCm && weightKg) {
    const m = heightCm / 100;
    const bmi = weightKg / (m * m);
    if (bmi >= 30) personalTips.push("Starting lighter and lower-impact is the smart play — protect the joints now, build intensity as you progress.");
    else if (bmi < 18.5) personalTips.push("Eating enough to support training is half the battle at your bodyweight — prioritize protein and a slight calorie surplus.");
  }

  return {
    split,
    splitName,
    goal,
    level,
    days,
    restDays,
    tips: [...personalTips, ...TIPS[goal]],
    weeklyVolume: `${totalSets} sets / week`,
  };
}

// ── Swap a single exercise for a different one ────────────────────────────────
// Used by the AI Plan UI's per-exercise "🔄 Recycle" button. Picks a fresh
// exercise from the same category that the user hasn't already got in their
// day. Falls back to allowing duplicates only if the pool is too small.
//
// `excludeNames` should include the current exercise name AND every other
// exercise in that day, so we don't pick something that's already there.
export function swapExercise(
  current: PlannedExercise,
  equipment: Equipment[],
  excludeNames: string[] = [],
): PlannedExercise | null {
  const exclude = new Set([current.name, ...excludeNames]);

  // Pull from the same category — that keeps the swap meaningful (chest stays
  // chest, back stays back). Filter to user's available equipment.
  const pool = EXERCISES.filter(e =>
    e.category === current.category &&
    e.category !== "Cardio" &&
    e.category !== "Stretching" &&
    !exclude.has(e.name) &&
    equipment.includes(e.equipment)
  );

  if (pool.length === 0) {
    // Nothing left after excluding the day's other exercises — try again
    // ignoring the day exclude list (still skip the current exercise itself
    // so it actually swaps to something different).
    const fallback = EXERCISES.filter(e =>
      e.category === current.category &&
      e.category !== "Cardio" &&
      e.category !== "Stretching" &&
      e.name !== current.name &&
      equipment.includes(e.equipment)
    );
    if (fallback.length === 0) return null;
    const pick = fallback[Math.floor(Math.random() * fallback.length)];
    return {
      ...current,
      name: pick.name,
      category: pick.category,
      equipment: pick.equipment,
      muscles: pick.muscles,
    };
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...current,
    name: pick.name,
    category: pick.category,
    equipment: pick.equipment,
    muscles: pick.muscles,
  };
}

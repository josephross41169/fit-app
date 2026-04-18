// Fit App — AI Workout Plan Generator
// 100% client-side logic — no API, no cost, instant
// Competes with Fitbod / Dr. Muscle

import { EXERCISES, Exercise, Equipment, Category } from "./exercises";

// ── Types ──────────────────────────────────────────────────────────────────────

export type Goal = "strength" | "hypertrophy" | "fat_loss" | "endurance" | "athletic";
export type Level = "beginner" | "intermediate" | "advanced";
export type Split = "full_body" | "upper_lower" | "ppl" | "ppl_x2" | "bro" | "hybrid";

export interface PlanConfig {
  goal: Goal;
  level: Level;
  daysPerWeek: 3 | 4 | 5 | 6;
  equipment: Equipment[];
  focusMuscles?: Category[]; // optional bias
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

  // Sort: compounds first for strength/athletic/hypertrophy goals
  const sorted = [...pool].sort((a, b) => {
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

// ── Split strategies ──────────────────────────────────────────────────────────

export function generatePlan(config: PlanConfig): WeeklyPlan {
  const { goal, level, daysPerWeek, equipment } = config;
  const exPerDay = level === "beginner" ? 5 : level === "intermediate" ? 6 : 7;

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

  return {
    split,
    splitName,
    goal,
    level,
    days,
    restDays,
    tips: TIPS[goal],
    weeklyVolume: `${totalSets} sets / week`,
  };
}

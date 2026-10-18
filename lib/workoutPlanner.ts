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
/** Finer-grained experience than Level. Maps onto Level for the base programming. */
export type Experience = "new" | "novice" | "intermediate" | "advanced" | "elite";
/** What the user is training toward (optional). */
export type TrainingFor =
  | "none" | "5k_10k" | "marathon" | "powerlifting" | "bodybuilding"
  | "hyrox" | "team_sport" | "hiking" | "event";

export function levelForExperience(e: Experience): Level {
  return e === "new" || e === "novice" ? "beginner" : e === "intermediate" ? "intermediate" : "advanced";
}

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
  // ── Depth options ──
  experience?: Experience;     // finer level; tunes volume + intensity notes
  returningFromBreak?: boolean;// 3+ weeks off — eases volume back in
  secondaryGoal?: Goal;        // blended into the primary goal
  trainingFor?: TrainingFor;   // event / sport the plan prepares for
  weeksOut?: number;           // weeks until the event (drives the phase)
}

/** A non-lifting session placed on a rest day (runs, rucks, agility…). */
export interface ExtraSession {
  dayNum: number;
  emoji: string;
  title: string;
  detail: string;
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
  /** Optional conditioning finisher at the end of the session. */
  finisher?: string;
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
  secondaryGoal?: Goal;
  experience?: Experience;
  trainingFor?: TrainingFor;
  /** e.g. "Peak & taper · 3 weeks out" */
  phase?: string;
  /** Sessions on non-lifting days. */
  extraSessions?: ExtraSession[];
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
    const restSecs = ex.rest === "3-5 min" ? 240 : ex.rest === "2-3 min" ? 150 : ex.rest === "90s" ? 90 : ex.rest === "60s" ? 60 : ex.rest === "30s" ? 30 : 45;
    return acc + ex.sets * (45 + restSecs);
  }, 0) / 60 + 10; // 45s work + rest per set, +10 warmup

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
    return acc + ex.sets * (45 + restSecs);
  }, 0) / 60 + 10;
  day.estimatedMinutes = Math.round(mins);
}

// Keep sessions realistic: only the first two lifts of a day keep more than 4
// sets, then accessories are trimmed from the end until the day fits the time
// budget (the chosen session length, or 75 min). Never below 3 exercises.
function fitToTime(day: TrainingDay, minutes?: number) {
  day.exercises.forEach((ex, i) => { if (i >= 2 && ex.sets > 4) ex.sets = 4; });
  recalcMinutes(day);
  const budget = (minutes || 75) + 5;
  while (day.estimatedMinutes > budget && day.exercises.length > 3) {
    day.exercises.pop();
    recalcMinutes(day);
  }
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

// ── Depth options: experience, secondary goal, training target ────────────────

/** Turn a library exercise into a planned one with explicit params. */
function planned(name: string, sets: number, reps: string, rest: string, notes?: string): PlannedExercise | null {
  const ex = EXERCISES.find(e => e.name === name);
  if (!ex) return null;
  return { name: ex.name, category: ex.category, equipment: ex.equipment, muscles: ex.muscles, sets, reps, rest, notes };
}

/** First candidate the user has equipment for, isn't already in the day and
 *  doesn't load an injured area. */
function firstAvailable(names: string[], equipment: Equipment[], day: TrainingDay, injuries?: Injury[]): string | null {
  const have = new Set(day.exercises.map(e => e.name));
  for (const n of names) {
    const ex = EXERCISES.find(e => e.name === n);
    if (!ex || have.has(n)) continue;
    if (equipment.length && !equipment.includes(ex.equipment)) continue;
    if (violatesInjury(n, injuries)) continue;
    return n;
  }
  return null;
}

/** Put an exercise at the front of the day (or move it there if present),
 *  dropping the last accessory so the session length stays about the same. */
function leadWith(day: TrainingDay, ex: PlannedExercise, keepCount = true) {
  const idx = day.exercises.findIndex(e => e.name === ex.name);
  if (idx >= 0) day.exercises.splice(idx, 1);
  else if (keepCount && day.exercises.length > 3) day.exercises.pop();
  day.exercises.unshift(ex);
}

const isLowerDay = (d: TrainingDay) => /leg|lower|full/i.test(d.label);
const isUpperPushDay = (d: TrainingDay) => /push|upper|full/i.test(d.label);
const isPullDay = (d: TrainingDay) => /pull|lower b|full body b/i.test(d.label);

function applyExperience(days: TrainingDay[], experience?: Experience, returning?: boolean) {
  for (const day of days) {
    day.exercises.forEach((ex, i) => {
      const compound = isCompound(ex.name);
      if (experience === "new") {
        ex.sets = Math.min(ex.sets, 3);
        if (compound && !ex.notes) ex.notes = "Learn the movement — light weight, leave 3 reps in the tank.";
      } else if (experience === "novice") {
        if (compound && !ex.notes) ex.notes = "Add a little weight each session while form stays clean.";
      } else if (experience === "advanced") {
        if (compound && i === 0 && !ex.notes) ex.notes = "Work up to one heavy top set, then back-off sets at -10%.";
      } else if (experience === "elite") {
        if (i === 0 && ex.sets < 6) ex.sets += 1;
        if (i === 0 && !ex.notes) ex.notes = "Top set at RPE 8-9, then back-offs. Rotate variations every 4-6 weeks.";
      }
      if (returning) ex.sets = Math.max(2, ex.sets - 1);
    });
  }
}

function applySecondaryGoal(
  days: TrainingDay[], primary: Goal, secondary: Goal | undefined, level: Level,
  equipment: Equipment[], injuries?: Injury[],
) {
  if (!secondary || secondary === primary) return;
  for (const day of days) {
    if (secondary === "strength") {
      // Lead compound becomes a heavy strength lift.
      const first = day.exercises.find(e => isCompound(e.name));
      if (first) {
        first.sets = level === "advanced" ? 5 : 4;
        first.reps = "3-5";
        first.rest = "2-3 min";
        first.notes = first.notes || "Strength focus — heavy, full rest.";
      }
    } else if (secondary === "hypertrophy") {
      for (const ex of day.exercises) {
        if (isCompound(ex.name)) continue;
        ex.sets = Math.max(ex.sets, 3);
        ex.reps = "10-15";
        ex.rest = "60s";
      }
    } else if (secondary === "fat_loss") {
      for (const ex of day.exercises) if (!isCompound(ex.name)) ex.rest = shiftRest(ex.rest, -1);
      day.finisher = day.finisher || "8-min finisher: 30s on / 30s off — kettlebell swings, mountain climbers, jump rope (or bike).";
    } else if (secondary === "endurance") {
      day.finisher = day.finisher || "12-min AMRAP: 10 goblet squats, 10 push-ups, 10 rows, 200m row or run.";
    } else if (secondary === "athletic" && isLowerDay(day)) {
      const name = firstAvailable(
        level === "beginner" ? ["Box Jump", "Kettlebell Swing"] : ["Box Jump", "Power Clean", "Hang Clean", "Kettlebell Swing"],
        equipment, day, injuries,
      );
      const ex = name && planned(name, 3, "3-5", "90s", "Explosive — stop every set before speed drops.");
      if (ex) leadWith(day, ex);
    }
  }
}

/** Returns a picker that hands out free rest days, trying each session's
 *  preferred days first (1=Mon … 7=Sun). */
function restSlots(restDays: number[]) {
  const used = new Set<number>();
  return (prefer: number[]): number | undefined => {
    for (const d of [...prefer, 1, 2, 3, 4, 5, 6, 7]) {
      if (restDays.includes(d) && !used.has(d)) { used.add(d); return d; }
    }
    return undefined;
  };
}

function phaseFor(weeksOut?: number): { label: string; tip: string } | null {
  if (!weeksOut) return null;
  if (weeksOut <= 4) return { label: `Peak & taper · ${weeksOut} weeks out`, tip: "You're close — keep intensity, cut volume ~30-40% in the final week so you show up fresh." };
  if (weeksOut <= 8) return { label: `Intensify · ${weeksOut} weeks out`, tip: "Intensify phase: push the weights and the pace now, then back off as the date gets close." };
  if (weeksOut <= 12) return { label: `Build · ${weeksOut} weeks out`, tip: "Build phase: steady progression every week. Every 4th week, deload by dropping a set per exercise." };
  return { label: `Base · ${weeksOut}+ weeks out`, tip: "Base phase: plenty of time — build consistent habits and work capacity before getting specific." };
}

function applyTrainingFor(
  days: TrainingDay[], restDays: number[], target: TrainingFor | undefined,
  level: Level, equipment: Equipment[], injuries?: Injury[],
): { extra: ExtraSession[]; tips: string[] } {
  const extra: ExtraSession[] = [];
  const tips: string[] = [];
  const slot = restSlots(restDays);
  const add = (dayNum: number | undefined, emoji: string, title: string, detail: string) => {
    if (dayNum) extra.push({ dayNum, emoji, title, detail });
  };
  if (!target || target === "none") return { extra, tips };

  if (target === "5k_10k") {
    add(slot([6, 7]), "🛣️", "Long run", "45-60 min easy. Add 5 min each week.");
    add(slot([2, 3]), "🏃", "Easy run", "25-40 min conversational pace.");
    add(slot([4, 3, 5]), "⚡", "Intervals", "Warm up, then 6×400m at 5K pace with 90s jog. Cool down.");
    for (const d of days.filter(isLowerDay)) {
      const name = firstAvailable(["Bulgarian Split Squat", "Step Ups", "Reverse Lunges"], equipment, d, injuries);
      const ex = name && planned(name, 3, "8-10 each leg", "60s", "Single-leg strength = a stronger, injury-resistant stride.");
      if (ex) { d.exercises.pop(); d.exercises.push(ex); }
    }
    tips.push("Keep lifting heavy-ish but low volume on legs — save your legs for the key runs.");
  } else if (target === "marathon") {
    add(slot([7, 6]), "🛣️", "Long run", "Build to 90 min+ (half) or 2-3 hrs (full). Practice fueling.");
    add(slot([2, 3]), "🏃", "Easy run", "40-60 min conversational pace.");
    add(slot([4, 3, 5]), "⏱️", "Tempo run", "10 min easy, 20-30 min comfortably hard, 10 min easy.");
    for (const d of days.filter(isLowerDay)) d.exercises.forEach(e => { if (isCompound(e.name)) e.sets = Math.max(2, e.sets - 1); });
    tips.push("Leg volume is trimmed so the long run stays the priority. Never lift legs the day before a long run.");
  } else if (target === "powerlifting") {
    const params = { sets: level === "advanced" ? 5 : 4, reps: level === "beginner" ? "5" : "3-5", rest: "3-5 min" };
    const lower = days.filter(isLowerDay);
    const push = days.filter(d => /push|upper|full/i.test(d.label));
    const sq = planned("Squat", params.sets, params.reps, params.rest, "Competition lift — practice depth and commands.");
    const bp = planned("Bench Press", params.sets, params.reps, params.rest, "Competition lift — pause on the chest.");
    const dl = planned("Deadlift", params.sets, params.reps, params.rest, "Competition lift — reset each rep.");
    if (sq && lower[0] && !violatesInjury("Squat", injuries)) leadWith(lower[0], sq);
    if (bp && push[0] && !violatesInjury("Bench Press", injuries)) leadWith(push[0], bp);
    const dlDay = lower[1] || days.find(isPullDay) || lower[0];
    if (dl && dlDay && !violatesInjury("Deadlift", injuries)) leadWith(dlDay, dl);
    tips.push("Squat, bench and deadlift lead your week. Train them in competition style: depth, pause, lockout.");
  } else if (target === "bodybuilding") {
    for (const d of days) for (const e of d.exercises) {
      if (!isCompound(e.name)) { e.reps = "10-15"; e.rest = "60s"; e.notes = e.notes || "Slow negative, squeeze at the top."; }
    }
    add(slot([3, 6, 7]), "🪞", "Posing + cardio", "15 min posing practice, then 30-40 min incline walk.");
    tips.push("Track bodyweight daily and photos weekly — small changes are easy to miss in the mirror.");
  } else if (target === "hyrox") {
    for (const d of days) d.finisher = d.finisher || "Hyrox finisher: 3 rounds — 500m row or ski, 20 wall balls, 20m sled push (or heavy farmers walk), 10 burpee broad jumps.";
    add(slot([6, 7, 4]), "🏃", "Compromised running", "4 × (1 km run + 1 station). Practice running on tired legs.");
    add(slot([3, 4, 2, 7]), "🫀", "Zone 2", "40-50 min easy run, bike or row.");
    tips.push("Hyrox is 8 km of running plus 8 stations — your running engine matters as much as your strength.");
  } else if (target === "team_sport") {
    for (const d of days.filter(isLowerDay)) {
      const name = firstAvailable(level === "beginner" ? ["Box Jump", "Kettlebell Swing"] : ["Box Jump", "Power Clean", "Hang Clean", "Kettlebell Swing"], equipment, d, injuries);
      const ex = name && planned(name, 3, "3-5", "90s", "Explosive — quality over fatigue.");
      if (ex) leadWith(d, ex);
    }
    add(slot([3, 4, 2]), "⚡", "Speed & agility", "Warm up, 6×20m sprints, ladder drills, 5-10-5 shuttles. Full rest between reps.");
    tips.push("In season, cut lifting to 2 days and keep it heavy but short. Off season is when you build.");
  } else if (target === "hiking") {
    for (const d of days.filter(isLowerDay)) {
      const name = firstAvailable(["Step Ups", "Walking Lunges", "Bulgarian Split Squat"], equipment, d, injuries);
      const ex = name && planned(name, 3, "12 each leg", "60s", "Mimics climbing — add a backpack for load.");
      if (ex) { d.exercises.pop(); d.exercises.push(ex); }
      d.finisher = d.finisher || "Loaded carry: 4 × 40m farmers walk, heavy.";
    }
    add(slot([6, 7]), "🎒", "Ruck / hike", "60-120 min with a loaded pack. Add 1-2 lb each week.");
    tips.push("Train downhills too — slow step-downs build the quads that save your knees on the descent.");
  } else if (target === "event") {
    for (const d of days) d.finisher = d.finisher || "10-min conditioning: alternate 1 min bike sprint / 1 min easy.";
    add(slot([3, 6, 7]), "🚶", "Steps + cardio", "45 min brisk walk or easy cardio. Aim for 10k steps daily.");
    tips.push("The week of your event: keep training, sleep 8 hours, keep sodium and water consistent.");
  }
  return { extra, tips };
}

// ── Split strategies ──────────────────────────────────────────────────────────

export function generatePlan(config: PlanConfig): WeeklyPlan {
  const { goal, level, daysPerWeek, equipment, sex, age, minutesPerSession, injuries, heightCm, weightKg,
    experience, returningFromBreak, secondaryGoal, trainingFor, weeksOut } = config;
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
  applySecondaryGoal(days, goal, secondaryGoal, level, equipment, injuries);
  const target = applyTrainingFor(days, restDays, trainingFor, level, equipment, injuries);
  applyExperience(days, experience, returningFromBreak);
  days.forEach(d => fitToTime(d, minutesPerSession));
  const phase = trainingFor && trainingFor !== "none" ? phaseFor(weeksOut) : null;

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

  if (returningFromBreak) personalTips.push("Coming back from a break: volume is trimmed. Start around 70% of your old weights for 2 weeks, then build back up.");
  if (experience === "new") personalTips.push("New to lifting: master form first. Film a set or ask someone to watch — weight comes fast once the pattern is right.");
  if (experience === "elite") personalTips.push("Elite: autoregulate with RPE, and rotate main-lift variations every 4-6 weeks to keep progressing.");
  const secondaryTips = secondaryGoal && secondaryGoal !== goal ? TIPS[secondaryGoal].slice(0, 2) : [];

  return {
    split,
    splitName,
    goal,
    level,
    days,
    restDays,
    tips: [...personalTips, ...(phase ? [phase.tip] : []), ...target.tips, ...TIPS[goal], ...secondaryTips],
    weeklyVolume: `${totalSets} sets / week`,
    secondaryGoal: secondaryGoal && secondaryGoal !== goal ? secondaryGoal : undefined,
    experience,
    trainingFor: trainingFor && trainingFor !== "none" ? trainingFor : undefined,
    phase: phase?.label,
    extraSessions: target.extra.length ? target.extra : undefined,
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

// ─────────────────────────────────────────────────────────────────────────────
// Apple Health workout helpers.
//  • mapHealthWorkout — Apple's workout type ("highIntensityIntervalTraining")
//    → Livelee's label + workout_category.
//  • prettyWorkoutType — display fix for rows imported before the mapping
//    existed (raw camelCase names in workout_type).
//  • workoutSource — "Orangetheory" from a synced row's notes, for the
//    "from Orangetheory" label on workout cards.
// ─────────────────────────────────────────────────────────────────────────────

type Mapped = { workout_type: string; workout_category: string };

const HK: Record<string, Mapped> = {
  running: { workout_type: "Run", workout_category: "running" },
  walking: { workout_type: "Walk", workout_category: "walking" },
  hiking: { workout_type: "Hike", workout_category: "walking" },
  wheelchairWalkPace: { workout_type: "Walk", workout_category: "walking" },
  wheelchairRunPace: { workout_type: "Run", workout_category: "running" },
  cycling: { workout_type: "Bike", workout_category: "biking" },
  handCycling: { workout_type: "Bike", workout_category: "biking" },
  swimming: { workout_type: "Swim", workout_category: "swimming" },
  rowing: { workout_type: "Row", workout_category: "rowing" },
  yoga: { workout_type: "Yoga", workout_category: "yoga" },
  pilates: { workout_type: "Pilates", workout_category: "pilates" },
  barre: { workout_type: "Barre", workout_category: "pilates" },
  boxing: { workout_type: "Boxing", workout_category: "boxing" },
  kickboxing: { workout_type: "Kickboxing", workout_category: "boxing" },
  martialArts: { workout_type: "Martial Arts", workout_category: "boxing" },
  traditionalStrengthTraining: { workout_type: "Lifting", workout_category: "lifting" },
  functionalStrengthTraining: { workout_type: "Functional Strength", workout_category: "lifting" },
  coreTraining: { workout_type: "Core", workout_category: "lifting" },
  highIntensityIntervalTraining: { workout_type: "HIIT", workout_category: "hiit" },
  crossTraining: { workout_type: "Cross Training", workout_category: "hiit" },
  mixedCardio: { workout_type: "Cardio", workout_category: "hiit" },
  mixedMetabolicCardioTraining: { workout_type: "Cardio", workout_category: "hiit" },
  jumpRope: { workout_type: "Jump Rope", workout_category: "hiit" },
  elliptical: { workout_type: "Elliptical", workout_category: "other" },
  stairClimbing: { workout_type: "Stair Climber", workout_category: "other" },
  stairs: { workout_type: "Stairs", workout_category: "other" },
  stepTraining: { workout_type: "Step Training", workout_category: "other" },
  flexibility: { workout_type: "Stretching", workout_category: "other" },
  cooldown: { workout_type: "Cooldown", workout_category: "other" },
  preparationAndRecovery: { workout_type: "Recovery", workout_category: "other" },
  mindAndBody: { workout_type: "Mind & Body", workout_category: "yoga" },
  taiChi: { workout_type: "Tai Chi", workout_category: "yoga" },
  dance: { workout_type: "Dance", workout_category: "other" },
  cardioDance: { workout_type: "Dance", workout_category: "other" },
  socialDance: { workout_type: "Dance", workout_category: "other" },
  climbing: { workout_type: "Climbing", workout_category: "other" },
  swimBikeRun: { workout_type: "Triathlon", workout_category: "other" },
};

const SPORTS = new Set([
  "americanFootball", "australianFootball", "badminton", "baseball", "basketball",
  "cricket", "golf", "handball", "hockey", "lacrosse", "pickleball", "racquetball",
  "rugby", "soccer", "softball", "squash", "tableTennis", "tennis", "volleyball",
  "waterPolo", "discSports", "trackAndField",
]);

/** "highIntensityIntervalTraining" → "High Intensity Interval Training" */
function humanize(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

export function mapHealthWorkout(hkType: string | null | undefined): Mapped {
  const raw = String(hkType || "").trim();
  if (HK[raw]) return HK[raw];
  if (SPORTS.has(raw)) return { workout_type: humanize(raw), workout_category: "sports" };
  // Loose matches (other plugin versions / casing).
  const t = raw.toLowerCase();
  if (t.includes("highintensity") || t.includes("hiit")) return HK.highIntensityIntervalTraining;
  if (t.includes("run")) return HK.running;
  if (t.includes("walk")) return HK.walking;
  if (t.includes("cycl") || t.includes("bik")) return HK.cycling;
  if (t.includes("swim")) return HK.swimming;
  if (t.includes("row")) return HK.rowing;
  if (t.includes("strength") || t.includes("lifting")) return HK.traditionalStrengthTraining;
  if (t.includes("cardio")) return HK.mixedCardio;
  return { workout_type: raw && raw !== "other" ? humanize(raw) : "Workout", workout_category: "other" };
}

/** Fixes how already-imported raw Apple names show; leaves everything else alone. */
export function prettyWorkoutType(t: string | null | undefined): string {
  const raw = String(t || "").trim();
  if (!raw) return "Workout";
  if (HK[raw] || SPORTS.has(raw) || /^[a-z]+[A-Z]/.test(raw)) return mapHealthWorkout(raw).workout_type;
  return raw;
}

/** The app a synced workout came from, e.g. "Orangetheory" (null for manual logs). */
export function workoutSource(row: { notes?: string | null; external_source?: string | null } | null | undefined): string | null {
  const notes = String(row?.notes || "");
  const m = notes.match(/^Synced from ([^•\n]+)/);
  if (!m) return row?.external_source === "healthkit" ? "Apple Health" : null;
  const name = m[1].trim();
  // Watch/phone recordings are named after the device ("Joey's Apple Watch").
  if (/apple watch/i.test(name)) return "Apple Watch";
  if (/iphone|^health$/i.test(name)) return "Apple Health";
  return name;
}

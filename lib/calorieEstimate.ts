// ─── Cardio calorie estimation + swim distance helpers ──────────────────────
// One shared module so the Post page and Stats page compute identically
// (avoids the "works here but not there" drift the project has hit before).
//
// Two independent helpers:
//   1. estimateCardioCalories() — kcal burned for a cardio session
//   2. swimDistance()          — laps + pool length → meters & miles
//
// All inputs are defensive: missing/garbage values return null rather than
// NaN, so callers can simply hide the estimate when data is insufficient.

// ── Body metrics shape (mirrors the users-table columns) ────────────────────
export type BodyMetrics = {
  body_weight_lbs?: number | null;
  height_in?: number | null;
  date_of_birth?: string | null;     // ISO date
  biological_sex?: string | null;    // 'male' | 'female'
  resting_hr?: number | null;
  body_fat_pct?: number | null;
  lean_mass_lbs?: number | null;
  bmr_kcal?: number | null;          // if a scan already gives BMR, prefer it
};

const num = (v: any): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Age in years from a date-of-birth string.
function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const yrs = diff / (365.25 * 24 * 3600 * 1000);
  return yrs > 0 && yrs < 130 ? yrs : null;
}

// Basal Metabolic Rate (kcal/day) via Mifflin-St Jeor.
// Prefers a scan-provided BMR; otherwise computes from weight/height/age/sex.
export function estimateBMR(m: BodyMetrics): number | null {
  const scanBmr = num(m.bmr_kcal);
  if (scanBmr) return scanBmr;

  const wLbs = num(m.body_weight_lbs);
  const hIn = num(m.height_in);
  const age = ageFromDob(m.date_of_birth);
  if (!wLbs || !hIn || !age) return null;

  const kg = wLbs * 0.453592;
  const cm = hIn * 2.54;
  // Mifflin-St Jeor: men +5, women -161. Default to the average if unknown.
  const sex = (m.biological_sex || "").toLowerCase();
  const sexConst = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + sexConst;
  return bmr > 0 ? Math.round(bmr) : null;
}

// MET (metabolic equivalent) values by cardio type. Mid-range, moderate
// effort. These are the standard Compendium-of-Physical-Activities ballparks.
const MET: Record<string, number> = {
  running: 9.8,
  walking: 3.8,
  biking: 7.5,
  cycling: 7.5,      // alias: the Post form uses "cycling"; keep in sync with biking
  swimming: 7.0,
  rowing: 7.0,
  elliptical: 5.0,
  stairclimber: 8.0,
  hiking: 6.0,
  hiit: 8.0,
  boxing: 7.8,
  sports: 7.0,
  yoga: 3.0,
  pilates: 3.5,
  other: 6.0,
};

// ── Cycling resistance multipliers ──────────────────────────────────────────
// Stationary-bike resistance has no universal unit, so we model it as an effort
// tier that scales the base biking MET. Light spinning burns a bit less than the
// 7.5 moderate baseline; heavy/standing climbs burn substantially more. The
// baseline ("moderate") stays at 1.0 so existing logs are unaffected.
const CYCLING_RESISTANCE_MULT: Record<string, number> = {
  light: 0.8,        // easy spin, low resistance
  moderate: 1.0,     // baseline (unchanged from before)
  heavy: 1.25,       // hard effort, high resistance
  max: 1.5,          // standing climb / sprint resistance
};

// ── Walking incline adjustment ─────────────────────────────────────────────
// Each 1% of grade adds roughly 0.6 MET to walking at a typical pace (from the
// ACSM walking equation at ~3 mph). We cap the grade we honor at 15% so a stray
// large value can't produce a wild estimate.
function walkingMetForIncline(baseMet: number, inclinePct: number | null): number {
  const g = inclinePct == null ? 0 : Math.max(0, Math.min(inclinePct, 15));
  return baseMet + g * 0.6;
}

// Typical moderate pace in minutes per 100 m, used ONLY to estimate a session
// duration when distance is known but no time was logged — so a swim tracked
// by laps (distance only) can still show an approximate calorie burn.
const PACE_MIN_PER_100M: Record<string, number> = {
  swimming: 2.2, // ~2:12 / 100 m, moderate recreational pace
};

// Estimate session minutes from a distance in meters using the activity's
// typical pace. Returns null when no pace is defined for the type.
export function estimateMinutesFromMeters(
  type: string,
  meters: number | null | undefined,
): number | null {
  const m = num(meters);
  const pace = PACE_MIN_PER_100M[type];
  if (!m || !pace) return null;
  return (m / 100) * pace;
}

export type CalorieEstimate = {
  kcal: number;
  method: "heart_rate" | "met";
};

// Estimate kcal burned for a cardio session.
//   type:        cardio category id (e.g. "swimming")
//   minutes:     session duration in minutes
//   metrics:     the user's body metrics
//   avgHr:       optional average heart rate for the session (most accurate)
// Returns null when there isn't enough data (no weight, or no duration).
export function estimateCardioCalories(
  type: string,
  minutes: number | null | undefined,
  metrics: BodyMetrics,
  avgHr?: number | null,
  distanceMeters?: number | null,
  opts?: { resistance?: string | null; inclinePct?: number | null },
): CalorieEstimate | null {
  // If no duration was logged but the distance is known (e.g. a swim tracked
  // by laps), estimate a duration from a typical pace so we can still show an
  // approximate burn instead of nothing.
  let mins = num(minutes);
  if (!mins && distanceMeters != null) mins = estimateMinutesFromMeters(type, distanceMeters);
  const wLbs = num(metrics.body_weight_lbs);
  if (!mins) return null;

  const kg = wLbs ? wLbs * 0.453592 : null;
  const age = ageFromDob(metrics.date_of_birth);
  const sex = (metrics.biological_sex || "").toLowerCase();
  const hr = num(avgHr);

  // ── Method 1: heart-rate based (Keytel et al.) — most accurate when we
  // have HR + weight + age. Separate male/female regressions.
  if (hr && kg && age && (sex === "male" || sex === "female")) {
    let perMin: number;
    if (sex === "male") {
      perMin = (-55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * age) / 4.184;
    } else {
      perMin = (-20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * age) / 4.184;
    }
    const kcal = perMin * mins;
    if (kcal > 0) return { kcal: Math.round(kcal), method: "heart_rate" };
  }

  // ── Method 2: MET based — needs only weight + duration + activity type.
  if (kg) {
    let met = MET[type] ?? MET.other;

    // Cycling: scale by the selected resistance tier (moderate = unchanged).
    if ((type === "cycling" || type === "biking") && opts?.resistance) {
      met *= CYCLING_RESISTANCE_MULT[opts.resistance] ?? 1;
    }

    // Walking: add grade-based effort from the average incline.
    if (type === "walking") {
      met = walkingMetForIncline(met, num(opts?.inclinePct));
    }

    // kcal = MET * 3.5 * kg / 200 per minute
    const kcal = (met * 3.5 * kg / 200) * mins;
    if (kcal > 0) return { kcal: Math.round(kcal), method: "met" };
  }

  return null;
}

// ── Swim distance from laps + pool length ───────────────────────────────────
// A "lap" here = there AND back = 2 × pool length (per the user's definition).
export type PoolUnit = "ft" | "m" | "yd";

export type SwimResult = {
  meters: number;
  miles: number;
  yards: number;
};

const POOL_TO_METERS: Record<PoolUnit, number> = {
  ft: 0.3048,
  m: 1,
  yd: 0.9144,
};

// laps: number of there-and-back laps
// poolLength: numeric length of the pool
// unit: the unit the pool length is given in
export function swimDistance(
  laps: number | null | undefined,
  poolLength: number | null | undefined,
  unit: PoolUnit,
): SwimResult | null {
  const l = num(laps);
  const p = num(poolLength);
  if (!l || !p) return null;

  const oneLengthMeters = p * (POOL_TO_METERS[unit] ?? 1);
  // there-and-back = 2 lengths per lap
  const meters = l * oneLengthMeters * 2;
  return {
    meters: Math.round(meters * 10) / 10,
    miles: Math.round((meters / 1609.344) * 1000) / 1000,
    yards: Math.round((meters / 0.9144) * 10) / 10,
  };
}
// ─── Cardio calorie estimation + swim distance helpers ──────────────────────
// One shared module so the Post page and Stats page compute identically
// (avoids the "works here but not there" drift the project has hit before).
//
// Two independent helpers:
//   1. estimateCardioCalories() — kcal burned for a cardio session
//   2. swimDistance()          — laps + pool length → meters & miles
//
// All inputs are defensive: missing/garbage values return null rather than
// NaN, so callers can simply hide the estimate when data is insufficient.

// ── Body metrics shape (mirrors the users-table columns) ────────────────────
export type BodyMetrics = {
  body_weight_lbs?: number | null;
  height_in?: number | null;
  date_of_birth?: string | null;     // ISO date
  biological_sex?: string | null;    // 'male' | 'female'
  resting_hr?: number | null;
  body_fat_pct?: number | null;
  lean_mass_lbs?: number | null;
  bmr_kcal?: number | null;          // if a scan already gives BMR, prefer it
};

const num = (v: any): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Age in years from a date-of-birth string.
function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const yrs = diff / (365.25 * 24 * 3600 * 1000);
  return yrs > 0 && yrs < 130 ? yrs : null;
}

// Basal Metabolic Rate (kcal/day) via Mifflin-St Jeor.
// Prefers a scan-provided BMR; otherwise computes from weight/height/age/sex.
export function estimateBMR(m: BodyMetrics): number | null {
  const scanBmr = num(m.bmr_kcal);
  if (scanBmr) return scanBmr;

  const wLbs = num(m.body_weight_lbs);
  const hIn = num(m.height_in);
  const age = ageFromDob(m.date_of_birth);
  if (!wLbs || !hIn || !age) return null;

  const kg = wLbs * 0.453592;
  const cm = hIn * 2.54;
  // Mifflin-St Jeor: men +5, women -161. Default to the average if unknown.
  const sex = (m.biological_sex || "").toLowerCase();
  const sexConst = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + sexConst;
  return bmr > 0 ? Math.round(bmr) : null;
}

// MET (metabolic equivalent) values by cardio type. Mid-range, moderate
// effort. These are the standard Compendium-of-Physical-Activities ballparks.
const MET: Record<string, number> = {
  running: 9.8,
  walking: 3.8,
  biking: 7.5,
  swimming: 7.0,
  rowing: 7.0,
  hiit: 8.0,
  boxing: 7.8,
  sports: 7.0,
  yoga: 3.0,
  pilates: 3.5,
  other: 6.0,
};

// Typical moderate pace in minutes per 100 m, used ONLY to estimate a session
// duration when distance is known but no time was logged — so a swim tracked
// by laps (distance only) can still show an approximate calorie burn.
const PACE_MIN_PER_100M: Record<string, number> = {
  swimming: 2.2, // ~2:12 / 100 m, moderate recreational pace
};

// Estimate session minutes from a distance in meters using the activity's
// typical pace. Returns null when no pace is defined for the type.
export function estimateMinutesFromMeters(
  type: string,
  meters: number | null | undefined,
): number | null {
  const m = num(meters);
  const pace = PACE_MIN_PER_100M[type];
  if (!m || !pace) return null;
  return (m / 100) * pace;
}

export type CalorieEstimate = {
  kcal: number;
  method: "heart_rate" | "met";
};

// Estimate kcal burned for a cardio session.
//   type:        cardio category id (e.g. "swimming")
//   minutes:     session duration in minutes
//   metrics:     the user's body metrics
//   avgHr:       optional average heart rate for the session (most accurate)
// Returns null when there isn't enough data (no weight, or no duration).
export function estimateCardioCalories(
  type: string,
  minutes: number | null | undefined,
  metrics: BodyMetrics,
  avgHr?: number | null,
  distanceMeters?: number | null,
): CalorieEstimate | null {
  // If no duration was logged but the distance is known (e.g. a swim tracked
  // by laps), estimate a duration from a typical pace so we can still show an
  // approximate burn instead of nothing.
  let mins = num(minutes);
  if (!mins && distanceMeters != null) mins = estimateMinutesFromMeters(type, distanceMeters);
  const wLbs = num(metrics.body_weight_lbs);
  if (!mins) return null;

  const kg = wLbs ? wLbs * 0.453592 : null;
  const age = ageFromDob(metrics.date_of_birth);
  const sex = (metrics.biological_sex || "").toLowerCase();
  const hr = num(avgHr);

  // ── Method 1: heart-rate based (Keytel et al.) — most accurate when we
  // have HR + weight + age. Separate male/female regressions.
  if (hr && kg && age && (sex === "male" || sex === "female")) {
    let perMin: number;
    if (sex === "male") {
      perMin = (-55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * age) / 4.184;
    } else {
      perMin = (-20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * age) / 4.184;
    }
    const kcal = perMin * mins;
    if (kcal > 0) return { kcal: Math.round(kcal), method: "heart_rate" };
  }

  // ── Method 2: MET based — needs only weight + duration + activity type.
  if (kg) {
    const met = MET[type] ?? MET.other;
    // kcal = MET * 3.5 * kg / 200 per minute
    const kcal = (met * 3.5 * kg / 200) * mins;
    if (kcal > 0) return { kcal: Math.round(kcal), method: "met" };
  }

  return null;
}

// ── Swim distance from laps + pool length ───────────────────────────────────
// A "lap" here = there AND back = 2 × pool length (per the user's definition).
export type PoolUnit = "ft" | "m" | "yd";

export type SwimResult = {
  meters: number;
  miles: number;
  yards: number;
};

const POOL_TO_METERS: Record<PoolUnit, number> = {
  ft: 0.3048,
  m: 1,
  yd: 0.9144,
};

// laps: number of there-and-back laps
// poolLength: numeric length of the pool
// unit: the unit the pool length is given in
export function swimDistance(
  laps: number | null | undefined,
  poolLength: number | null | undefined,
  unit: PoolUnit,
): SwimResult | null {
  const l = num(laps);
  const p = num(poolLength);
  if (!l || !p) return null;

  const oneLengthMeters = p * (POOL_TO_METERS[unit] ?? 1);
  // there-and-back = 2 lengths per lap
  const meters = l * oneLengthMeters * 2;
  return {
    meters: Math.round(meters * 10) / 10,
    miles: Math.round((meters / 1609.344) * 1000) / 1000,
    yards: Math.round((meters / 0.9144) * 10) / 10,
  };
}

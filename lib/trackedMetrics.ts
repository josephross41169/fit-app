// ── lib/trackedMetrics.ts ───────────────────────────────────────────────────
// Central catalog of metrics that can be auto-tracked from activity_logs.
// Used by:
//   - Create Goal form (group_challenges.metric)
//   - Create Challenge form (challenges.metric_key)
//   - groupGoalSync.ts (decides which records to auto-update)
//
// Adding a new metric here requires also adding its computation in
// lib/groupGoalSync.ts::computeContribution(). If you add one without
// updating the sync, the form will let users pick it but their progress
// will always be 0.

export type TrackedMetricKey =
  | "miles_run"
  | "miles_walked"
  | "miles_biked"
  | "miles_swum"
  | "runs"
  | "workouts"
  | "lift_sessions"
  | "yoga_sessions"
  | "cold_plunges"
  | "sauna_sessions"
  | "meditation_sessions"
  | "wellness_sessions"
  | "total_minutes"
  | "nutrition_logs";

export interface TrackedMetric {
  key: TrackedMetricKey;
  label: string;  // Human label shown in dropdown + saved as metric_label
  unit: string;   // Unit of measure, saved as metric_unit
  emoji: string;
  category: "cardio" | "strength" | "wellness" | "consistency" | "nutrition";
}

export const TRACKED_METRICS: TrackedMetric[] = [
  // ── CARDIO ─────────────────────────────────────────────
  { key: "miles_run",          label: "Miles Run",        unit: "mi",       emoji: "🏃", category: "cardio" },
  { key: "miles_walked",       label: "Miles Walked",     unit: "mi",       emoji: "🚶", category: "cardio" },
  { key: "miles_biked",        label: "Miles Biked",      unit: "mi",       emoji: "🚴", category: "cardio" },
  { key: "miles_swum",         label: "Miles Swum",       unit: "mi",       emoji: "🏊", category: "cardio" },
  { key: "runs",               label: "Runs Completed",   unit: "runs",     emoji: "🏁", category: "cardio" },

  // ── CONSISTENCY ───────────────────────────────────────
  { key: "workouts",           label: "Workouts Completed", unit: "workouts", emoji: "💪", category: "consistency" },
  { key: "total_minutes",      label: "Total Minutes",    unit: "min",      emoji: "⏱️", category: "consistency" },

  // ── STRENGTH ──────────────────────────────────────────
  { key: "lift_sessions",      label: "Lifting Sessions", unit: "sessions", emoji: "🏋️", category: "strength" },

  // ── WELLNESS ──────────────────────────────────────────
  { key: "yoga_sessions",      label: "Yoga Sessions",    unit: "sessions", emoji: "🧘", category: "wellness" },
  { key: "cold_plunges",       label: "Cold Plunges",     unit: "sessions", emoji: "🧊", category: "wellness" },
  { key: "sauna_sessions",     label: "Sauna Sessions",   unit: "sessions", emoji: "🔥", category: "wellness" },
  { key: "meditation_sessions",label: "Meditation Sessions", unit: "sessions", emoji: "🕉️", category: "wellness" },
  { key: "wellness_sessions",  label: "Wellness Sessions",   unit: "sessions", emoji: "🌿", category: "wellness" },

  // ── NUTRITION ─────────────────────────────────────────
  { key: "nutrition_logs",     label: "Nutrition Logs",   unit: "logs",     emoji: "🥗", category: "nutrition" },
];

/** Look up a metric by its key. Returns undefined for unknown keys. */
export function getTrackedMetric(key: string | null | undefined): TrackedMetric | undefined {
  if (!key) return undefined;
  return TRACKED_METRICS.find(m => m.key === key);
}

/** Used in UI dropdowns — returns metrics grouped by category for nicer display. */
export function metricsByCategory(): Record<string, TrackedMetric[]> {
  const grouped: Record<string, TrackedMetric[]> = {};
  for (const m of TRACKED_METRICS) {
    (grouped[m.category] ||= []).push(m);
  }
  return grouped;
}

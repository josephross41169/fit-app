// ─────────────────────────────────────────────────────────────────────────────
// Display helpers for wellness rows — mainly the ones Apple Health writes
// automatically (lib/healthkit.ts: wellness_type 'steps' / 'calories_burned',
// external_source 'healthkit'). Raw DB values stay untouched; these only
// change how they're shown.
// ─────────────────────────────────────────────────────────────────────────────
export const APPLE_HEALTH_LABEL = "Uploaded from Apple Health";

const AUTO: Record<string, { name: string; emoji: string; accent: string }> = {
  steps:           { name: "Steps",           emoji: "👟", accent: "#F472B6" },
  calories_burned: { name: "Active Calories", emoji: "🔥", accent: "#FB923C" },
  active_calories: { name: "Active Calories", emoji: "🔥", accent: "#FB923C" },
};

const key = (t: string | null | undefined) => (t || "").toLowerCase().trim();

/** "steps" → "Steps", "calories_burned" → "Active Calories"; others unchanged. */
export function wellnessLabel(t: string | null | undefined): string {
  return AUTO[key(t)]?.name || (t || "Wellness");
}

/** Emoji + accent for the auto-imported types, or null for everything else. */
export function autoWellnessStyle(t: string | null | undefined): { emoji: string; accent: string } | null {
  const s = AUTO[key(t)];
  return s ? { emoji: s.emoji, accent: s.accent } : null;
}

/** True for rows imported from Apple Health (row or mapped entry). */
export function isAppleHealth(x: any): boolean {
  return x?.external_source === "healthkit" || x?.source === "healthkit";
}

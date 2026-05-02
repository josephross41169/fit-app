// ─── components/recap/wellness-icons.ts ───────────────────────────────────
// Maps wellness_type strings (free-text Title Case from the wellness picker)
// to specific emojis for richer card rendering. Falls back to a generic 🌿
// if an unmapped type comes through.
//
// Why hardcode this? Because the wellness picker in the post page already
// shows an emoji per option — but the value stored in DB is just a string,
// not the emoji. Re-deriving the emoji on display means we can preserve
// the visual richness in the recap.
//
// If you add new wellness types in the post page, ADD THEM HERE TOO. Until
// then they fall back to the generic icon.

const WELLNESS_EMOJI_MAP: Record<string, string> = {
  // Cold therapy
  "cold plunge": "❄️",
  "ice bath": "🧊",
  "cold shower": "🚿",
  // Heat therapy
  "sauna": "🧖",
  "steam room": "♨️",
  "infrared sauna": "🔥",
  // Mind / breath
  "meditation": "🧘",
  "breathwork": "🌬️",
  "yoga": "🧘‍♀️",
  // Recovery / passive
  "stretching": "🤸",
  "stretch": "🤸",
  "foam rolling": "💆",
  "massage": "💆‍♂️",
  "compression therapy": "🦵",
  "compression": "🦵",
  // Sleep
  "sleep": "😴",
  "nap": "💤",
  // Nutrition-adjacent
  "fasting": "⏱️",
  "hydration": "💧",
  "supplements": "💊",
  // Outdoor / active recovery
  "walk": "🚶",
  "walking": "🚶",
  "hiking": "🥾",
  "sun exposure": "☀️",
  "grounding": "🌱",
  // Other
  "journaling": "📓",
  "reading": "📖",
  "therapy": "🛋️",
};

/** Returns the emoji for a wellness_type. Case-insensitive. Falls back to 🌿. */
export function wellnessEmoji(wellnessType: string | null | undefined): string {
  if (!wellnessType) return "🌿";
  const key = wellnessType.trim().toLowerCase();
  return WELLNESS_EMOJI_MAP[key] || "🌿";
}

/** Maps cardio type strings to emojis. */
const CARDIO_EMOJI_MAP: Record<string, string> = {
  "running": "🏃",
  "run": "🏃",
  "morning run": "🌅",
  "walk": "🚶",
  "walking": "🚶",
  "biking": "🚴",
  "cycling": "🚴",
  "bike": "🚴",
  "swimming": "🏊",
  "swim": "🏊",
  "rowing": "🚣",
  "row": "🚣",
  "elliptical": "🏃‍♀️",
  "stairmaster": "🪜",
};

/** Returns the emoji for a cardio type. */
export function cardioEmoji(cardioType: string | null | undefined): string {
  if (!cardioType) return "🏃";
  const key = cardioType.trim().toLowerCase();
  return CARDIO_EMOJI_MAP[key] || "🏃";
}

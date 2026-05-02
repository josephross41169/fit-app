// ─── components/recap/themes.ts ───────────────────────────────────────────
// Six theme presets for the weekly recap carousel. Each theme defines a
// palette + decorative motifs + typography weights. A theme is picked at
// recap-build time based on the week's dominant activity, so a heavy-cardio
// week feels visually different from a heavy-wellness week.
//
// v2 (Spotify Wrapped style): Themes are now BOLD. Saturated color combos,
// optical illusion patterns, brutalist typography. The previous pastel /
// "tasteful" approach was washed out and forgettable.

import type { Recap } from "@/lib/recap";

export type Theme = {
  /** Internal name for debugging. */
  id: ThemeId;
  /** Human-readable name shown nowhere but kept for clarity. */
  name: string;
  /** Subtitle that goes under "Weekly Recap" on the title card. */
  vibeWord: string;

  // Palette — every theme defines these slots
  /** Primary background gradient (top of card). */
  bgTop: string;
  /** Primary background gradient (bottom of card). */
  bgBottom: string;
  /** Accent color — used for big numbers, headlines. */
  accent: string;
  /** Secondary accent — for sub-stats, complementary highlights. */
  accent2: string;
  /** Tertiary accent — used for chips, marker highlights. */
  accent3: string;
  /** Text color for headlines (very high contrast on bg). */
  text: string;
  /** Text color for sub-text (lower contrast). */
  textSub: string;
  /** Color of decorative shapes / dividers. */
  decor: string;

  // Typography — each theme has its own personality here
  numberWeight: string;
  headerLetterSpacing: string;
  headlineTransform: "uppercase" | "none" | "capitalize";
  numberStyle: "italic" | "normal";

  // Decorative element preferences
  decorMotif: MotifId;
  motifIntensity: "ambient" | "bold" | "loud";
};

export type ThemeId = "velocity" | "iron" | "chromatic" | "apex" | "inferno" | "spectrum";

export type MotifId =
  | "warpedCircles"
  | "checkerboard"
  | "spiral"
  | "starburst"
  | "diagonalSplit"
  | "dotMatrix"
  | "wavyLines"
  | "halfMoons";

// ────────────────────────────────────────────────────────────────────────
// THEME 1 — VELOCITY (cardio-dominant weeks)
// ────────────────────────────────────────────────────────────────────────
const VELOCITY: Theme = {
  id: "velocity", name: "Velocity", vibeWord: "IN MOTION",
  bgTop: "#CCFF00", bgBottom: "#0A0A0A",
  accent: "#FF1F8F", accent2: "#0A0A0A", accent3: "#CCFF00",
  text: "#0A0A0A", textSub: "#1F2810", decor: "#FF1F8F",
  numberWeight: "900", headerLetterSpacing: "-0.03em",
  headlineTransform: "uppercase", numberStyle: "italic",
  decorMotif: "diagonalSplit", motifIntensity: "loud",
};

// ────────────────────────────────────────────────────────────────────────
// THEME 2 — IRON (lifting-dominant weeks)
// ────────────────────────────────────────────────────────────────────────
const IRON: Theme = {
  id: "iron", name: "Iron", vibeWord: "HEAVY",
  bgTop: "#0A0A0A", bgBottom: "#1A1A1A",
  accent: "#E8C547", accent2: "#F5F1E8", accent3: "#7A7A7A",
  text: "#F5F1E8", textSub: "#9C9C9C", decor: "#E8C547",
  numberWeight: "900", headerLetterSpacing: "0.02em",
  headlineTransform: "uppercase", numberStyle: "normal",
  decorMotif: "checkerboard", motifIntensity: "bold",
};

// ────────────────────────────────────────────────────────────────────────
// THEME 3 — CHROMATIC (wellness-dominant weeks, replaces washed-out Stillness)
// ────────────────────────────────────────────────────────────────────────
const CHROMATIC: Theme = {
  id: "chromatic", name: "Chromatic", vibeWord: "VIVID",
  bgTop: "#1947D1", bgBottom: "#0A1247",
  accent: "#FF4DA6", accent2: "#FFD600", accent3: "#FFF1E0",
  text: "#FFF1E0", textSub: "#B8C4F0", decor: "#FF4DA6",
  numberWeight: "900", headerLetterSpacing: "-0.02em",
  headlineTransform: "uppercase", numberStyle: "normal",
  decorMotif: "spiral", motifIntensity: "loud",
};

// ────────────────────────────────────────────────────────────────────────
// THEME 4 — APEX (PR-heavy weeks)
// ────────────────────────────────────────────────────────────────────────
const APEX: Theme = {
  id: "apex", name: "Apex", vibeWord: "PEAK",
  bgTop: "#3A1B6B", bgBottom: "#0A0420",
  accent: "#E8FF1A", accent2: "#9F5BFF", accent3: "#C0C9D6",
  text: "#FFFFFF", textSub: "#B8B0D6", decor: "#E8FF1A",
  numberWeight: "900", headerLetterSpacing: "0.06em",
  headlineTransform: "uppercase", numberStyle: "normal",
  decorMotif: "warpedCircles", motifIntensity: "loud",
};

// ────────────────────────────────────────────────────────────────────────
// THEME 5 — INFERNO (long-streak weeks)
// ────────────────────────────────────────────────────────────────────────
const INFERNO: Theme = {
  id: "inferno", name: "Inferno", vibeWord: "ON FIRE",
  bgTop: "#B30E1F", bgBottom: "#260000",
  accent: "#FFB627", accent2: "#FFE4A6", accent3: "#FF6B1A",
  text: "#FFF8E7", textSub: "#FFB89C", decor: "#FFB627",
  numberWeight: "900", headerLetterSpacing: "0.04em",
  headlineTransform: "uppercase", numberStyle: "italic",
  decorMotif: "starburst", motifIntensity: "loud",
};

// ────────────────────────────────────────────────────────────────────────
// THEME 6 — SPECTRUM (balanced weeks)
// ────────────────────────────────────────────────────────────────────────
const SPECTRUM: Theme = {
  id: "spectrum", name: "Spectrum", vibeWord: "ALL AROUND",
  bgTop: "#FF6B9D", bgBottom: "#3A1B6B",
  accent: "#FFD93D", accent2: "#5AE0FF", accent3: "#FFFFFF",
  text: "#FFFFFF", textSub: "#F8E0F0", decor: "#FFD93D",
  numberWeight: "900", headerLetterSpacing: "-0.02em",
  headlineTransform: "uppercase", numberStyle: "normal",
  decorMotif: "halfMoons", motifIntensity: "loud",
};

const ALL_THEMES: Record<ThemeId, Theme> = {
  velocity: VELOCITY,
  iron: IRON,
  chromatic: CHROMATIC,
  apex: APEX,
  inferno: INFERNO,
  spectrum: SPECTRUM,
};

/**
 * Pick the right theme for a recap based on the week's dominant pattern.
 * Priority: PRs > long streak > cardio-heavy > lifting-heavy > wellness-heavy > balanced.
 */
export function pickTheme(
  recap: Recap,
  currentStreaks?: { workout: number; wellness: number; nutrition: number }
): Theme {
  if (recap.lifts.prs.length >= 3) return APEX;

  const longestStreak = currentStreaks
    ? Math.max(currentStreaks.workout, currentStreaks.wellness, currentStreaks.nutrition)
    : 0;
  if (longestStreak >= 7) return INFERNO;

  const totalSessions = recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions;
  if (totalSessions === 0) return SPECTRUM;

  const cardioPct = recap.cardio.sessions / totalSessions;
  const liftingPct = recap.lifts.sessions / totalSessions;
  const wellnessPct = recap.wellness.sessions / totalSessions;

  if (cardioPct >= 0.6) return VELOCITY;
  if (liftingPct >= 0.5) return IRON;
  if (wellnessPct >= 0.5) return CHROMATIC;

  return SPECTRUM;
}

export function getTheme(id: ThemeId): Theme {
  return ALL_THEMES[id];
}

export function getAllThemes(): Theme[] {
  return Object.values(ALL_THEMES);
}

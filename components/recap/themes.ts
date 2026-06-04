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
  | "halfMoons"
  | "paintSplash";

// ────────────────────────────────────────────────────────────────────────
// THEME 1 — VELOCITY (cardio-dominant weeks)
// ────────────────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════
// PAINT-SPLASH FAMILY — soft baby-blue canvas, splattered-paint motif, with
// pink / yellow / lavender / coral / mint accents. Every theme shares the
// same blue gradient base and light text (so text stays legible), and just
// leans on a different splash accent so a cardio week still looks a little
// different from a lifting or balanced week. All use the "paintSplash" motif.
// Shared base values pulled into a helper to keep the six themes consistent.
// ════════════════════════════════════════════════════════════════════════
const PAINT_BASE = {
  // Soft blue gradient — reads "baby blue" up top, deepens toward the bottom
  // so light text has contrast across the whole card.
  bgTop: "#5C93D6", bgBottom: "#16335F",
  text: "#FFFFFF", textSub: "#DCEBFB",
  numberWeight: "900", headerLetterSpacing: "-0.01em",
  headlineTransform: "uppercase" as const, numberStyle: "normal" as const,
  decorMotif: "paintSplash" as const, motifIntensity: "loud" as const,
};

// THEME 1 — VELOCITY (cardio) → pink-forward splashes
const VELOCITY: Theme = {
  ...PAINT_BASE,
  id: "velocity", name: "Velocity", vibeWord: "IN MOTION",
  accent: "#FFE070", accent2: "#FF9EC8", accent3: "#BFE3FF", decor: "#FF9EC8",
  numberStyle: "italic",
};

// THEME 2 — IRON (lifting) → yellow-forward splashes
const IRON: Theme = {
  ...PAINT_BASE,
  id: "iron", name: "Iron", vibeWord: "HEAVY",
  accent: "#FFE070", accent2: "#BFE3FF", accent3: "#C9B6FF", decor: "#FFE070",
};

// THEME 3 — CHROMATIC (wellness) → lavender/mint splashes
const CHROMATIC: Theme = {
  ...PAINT_BASE,
  id: "chromatic", name: "Chromatic", vibeWord: "VIVID",
  accent: "#C9B6FF", accent2: "#9FE8D2", accent3: "#FFB3D9", decor: "#C9B6FF",
};

// THEME 4 — APEX (PRs) → bright sky-blue + yellow splashes
const APEX: Theme = {
  ...PAINT_BASE,
  id: "apex", name: "Apex", vibeWord: "PEAK",
  accent: "#FFE070", accent2: "#8ECBFF", accent3: "#FFB3D9", decor: "#8ECBFF",
  headerLetterSpacing: "0.02em",
};

// THEME 5 — INFERNO (long streak) → warm coral/pink + yellow splashes
const INFERNO: Theme = {
  ...PAINT_BASE,
  id: "inferno", name: "Inferno", vibeWord: "ON FIRE",
  accent: "#FFD15C", accent2: "#FFA98A", accent3: "#FF9EC8", decor: "#FFA98A",
  numberStyle: "italic",
};

// THEME 6 — SPECTRUM (balanced) → the full mix: pink + yellow + mint + sky
const SPECTRUM: Theme = {
  ...PAINT_BASE,
  id: "spectrum", name: "Spectrum", vibeWord: "ALL AROUND",
  accent: "#FFE070", accent2: "#FF9EC8", accent3: "#9FE8D2", decor: "#BFE3FF",
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

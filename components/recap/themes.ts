// ─── components/recap/themes.ts ───────────────────────────────────────────
// Six theme presets for the weekly recap carousel. Each theme defines a
// palette + decorative motifs + typography weights. A theme is picked at
// recap-build time based on the week's dominant activity, so a heavy-cardio
// week feels visually different from a heavy-wellness week.
//
// This is the "AI-feels" magic — variety without an LLM call. Same data
// shape, dramatically different visual identity each week.
//
// Design philosophy: themes should be JARRING different from each other.
// Same purple-accent variations would feel boring. We borrow Spotify
// Wrapped's approach of using unexpected color combos (lime + black,
// hot pink + brown) to create memorable share assets.

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
  /** Text color for headlines (very high contrast on bg). */
  text: string;
  /** Text color for sub-text (lower contrast). */
  textSub: string;
  /** Color of decorative shapes / dividers. */
  decor: string;

  // Typography — each theme has its own personality here
  /** Font weight for the BIG numbers (700, 800, 900, "italic 900", etc). */
  numberWeight: string;
  /** Optional CSS letter-spacing for headers (e.g. "0.06em"). */
  headerLetterSpacing: string;
  /** Headline transform — 'uppercase' / 'none' / 'capitalize'. */
  headlineTransform: "uppercase" | "none" | "capitalize";
  /** "italic" or "normal" — italic feels kinetic, normal feels solid. */
  numberStyle: "italic" | "normal";

  // Decorative element preferences
  /** Which decorative shapes the theme prefers (rendered as SVG). */
  decorMotif: "stripes" | "circles" | "grid" | "starburst" | "waves" | "geometric";
  /** Where to position the motif on cards. */
  motifIntensity: "subtle" | "bold";
};

export type ThemeId = "velocity" | "iron" | "stillness" | "apex" | "inferno" | "spectrum";

// ────────────────────────────────────────────────────────────────────────
// THEME 1 — VELOCITY (cardio-dominant weeks)
// Lime green + magenta + cream. Italic display type, motion stripes.
// Vibe: speed, kinetic energy, runner's high.
// ────────────────────────────────────────────────────────────────────────
const VELOCITY: Theme = {
  id: "velocity",
  name: "Velocity",
  vibeWord: "IN MOTION",
  bgTop: "#D4FF00",
  bgBottom: "#1A1F00",
  accent: "#FF2D87",
  accent2: "#1A1F00",
  text: "#1A1F00",
  textSub: "#3D2D5C",
  decor: "#FF2D87",
  numberWeight: "900",
  headerLetterSpacing: "-0.02em",
  headlineTransform: "uppercase",
  numberStyle: "italic",
  decorMotif: "stripes",
  motifIntensity: "bold",
};

// ────────────────────────────────────────────────────────────────────────
// THEME 2 — IRON (lifting-dominant weeks)
// Black + brushed steel + brass. Heavy serif weights, hard right angles.
// Vibe: weight, gravity, premium, industrial.
// ────────────────────────────────────────────────────────────────────────
const IRON: Theme = {
  id: "iron",
  name: "Iron",
  vibeWord: "HEAVY",
  bgTop: "#1A1A1A",
  bgBottom: "#0A0A0A",
  accent: "#D4A24C",
  accent2: "#7A7A7A",
  text: "#F5F1E8",
  textSub: "#9C9C9C",
  decor: "#D4A24C",
  numberWeight: "900",
  headerLetterSpacing: "0.08em",
  headlineTransform: "uppercase",
  numberStyle: "normal",
  decorMotif: "geometric",
  motifIntensity: "subtle",
};

// ────────────────────────────────────────────────────────────────────────
// THEME 3 — STILLNESS (wellness-dominant weeks)
// Sage + cream + clay. Soft typography, organic curves.
// Vibe: calm, recovery, breath.
// ────────────────────────────────────────────────────────────────────────
const STILLNESS: Theme = {
  id: "stillness",
  name: "Stillness",
  vibeWord: "GROUNDED",
  bgTop: "#E8E4D9",
  bgBottom: "#A8B8A0",
  accent: "#5A4A3A",
  accent2: "#7A8B6F",
  text: "#2D2419",
  textSub: "#5A4A3A",
  decor: "#7A8B6F",
  numberWeight: "800",
  headerLetterSpacing: "0.04em",
  headlineTransform: "none",
  numberStyle: "normal",
  decorMotif: "waves",
  motifIntensity: "subtle",
};

// ────────────────────────────────────────────────────────────────────────
// THEME 4 — APEX (PR-heavy weeks, multiple new records)
// Deep purple + silver + electric blue. Sharp geometric, mountain feel.
// Vibe: peak performance, achievement, summit.
// ────────────────────────────────────────────────────────────────────────
const APEX: Theme = {
  id: "apex",
  name: "Apex",
  vibeWord: "PEAK FORM",
  bgTop: "#2D1B4E",
  bgBottom: "#0A0518",
  accent: "#C0C9D6",
  accent2: "#7C9AFF",
  text: "#FFFFFF",
  textSub: "#A8B0C2",
  decor: "#7C9AFF",
  numberWeight: "900",
  headerLetterSpacing: "0.12em",
  headlineTransform: "uppercase",
  numberStyle: "normal",
  decorMotif: "starburst",
  motifIntensity: "bold",
};

// ────────────────────────────────────────────────────────────────────────
// THEME 5 — INFERNO (long-streak weeks, especially when alive 7+ days)
// Deep red + amber + flame orange. Heat, fire, persistence.
// Vibe: streak alive, don't break it, burning.
// ────────────────────────────────────────────────────────────────────────
const INFERNO: Theme = {
  id: "inferno",
  name: "Inferno",
  vibeWord: "ON FIRE",
  bgTop: "#8B1A0E",
  bgBottom: "#1A0A05",
  accent: "#FFB627",
  accent2: "#FF6B1A",
  text: "#FFF8E7",
  textSub: "#E8B894",
  decor: "#FF6B1A",
  numberWeight: "900",
  headerLetterSpacing: "0.06em",
  headlineTransform: "uppercase",
  numberStyle: "italic",
  decorMotif: "starburst",
  motifIntensity: "bold",
};

// ────────────────────────────────────────────────────────────────────────
// THEME 6 — SPECTRUM (balanced weeks — no single dominant activity)
// Multi-color gradient, vibrant, playful. Default fallback theme.
// Vibe: variety, well-rounded, lifestyle.
// ────────────────────────────────────────────────────────────────────────
const SPECTRUM: Theme = {
  id: "spectrum",
  name: "Spectrum",
  vibeWord: "ALL AROUND",
  bgTop: "#7C3AED",
  bgBottom: "#0F1F4F",
  accent: "#FFD93D",
  accent2: "#FF6B9D",
  text: "#FFFFFF",
  textSub: "#C9C5DC",
  decor: "#FFD93D",
  numberWeight: "900",
  headerLetterSpacing: "-0.02em",
  headlineTransform: "uppercase",
  numberStyle: "normal",
  decorMotif: "circles",
  motifIntensity: "bold",
};

const ALL_THEMES: Record<ThemeId, Theme> = {
  velocity: VELOCITY,
  iron: IRON,
  stillness: STILLNESS,
  apex: APEX,
  inferno: INFERNO,
  spectrum: SPECTRUM,
};

/**
 * Pick the right theme for a recap based on the week's dominant pattern.
 *
 * Decision tree (in priority order):
 *   1. 3+ PRs this week → APEX (peak form)
 *   2. Active streak ≥ 7 days → INFERNO (on fire)
 *   3. Heavy cardio (≥60% of sessions) → VELOCITY
 *   4. Heavy lifting (≥50% of sessions) → IRON
 *   5. Heavy wellness (≥50% of sessions) → STILLNESS
 *   6. Balanced or unclear → SPECTRUM
 *
 * The thresholds are tuned to give variety — most weeks fall into 4-6
 * since 50/50 splits are common. PRs and streaks are RARE enough to
 * feel special when they trigger, which is the point.
 */
export function pickTheme(recap: Recap, currentStreaks?: { workout: number; wellness: number; nutrition: number }): Theme {
  // Tier 1: PR-heavy week → APEX
  if (recap.lifts.prs.length >= 3) return APEX;

  // Tier 2: long streak alive → INFERNO
  const longestStreak = currentStreaks
    ? Math.max(currentStreaks.workout, currentStreaks.wellness, currentStreaks.nutrition)
    : 0;
  if (longestStreak >= 7) return INFERNO;

  const totalSessions = recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions;
  if (totalSessions === 0) return SPECTRUM; // empty week — give them something colorful

  const cardioPct = recap.cardio.sessions / totalSessions;
  const liftingPct = recap.lifts.sessions / totalSessions;
  const wellnessPct = recap.wellness.sessions / totalSessions;

  // Tier 3-5: dominance check
  if (cardioPct >= 0.6) return VELOCITY;
  if (liftingPct >= 0.5) return IRON;
  if (wellnessPct >= 0.5) return STILLNESS;

  // Tier 6: balanced — no clear winner
  return SPECTRUM;
}

/** Direct theme lookup. Used for previews / debugging. */
export function getTheme(id: ThemeId): Theme {
  return ALL_THEMES[id];
}

/** All themes, used by a "preview all themes" debug page. */
export function getAllThemes(): Theme[] {
  return Object.values(ALL_THEMES);
}

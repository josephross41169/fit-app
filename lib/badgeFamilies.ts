// ── lib/badgeFamilies.ts ────────────────────────────────────────────────────
// Groups earned badges into display slots for the profile.
//
// Three rendering styles:
//
//  1. PROGRESSION (tiered)
//     Stackable achievements you can keep doing — runs, lifts, cold plunges.
//     Rendered with bronze/silver/gold/platinum/diamond tiers based on how
//     many of the family's milestones you've cleared. Tier is capped at the
//     family's size, so a 1-tier family never shows DIAMOND.
//
//  2. CREDENTIAL (prestige)
//     Things about you that can only happen once in your life — veteran,
//     personal trainer certification, body transformation. Rendered with a
//     holographic "rare card" look, no tier pill.
//
//  3. YEARLY (year-stamped)
//     Events that recur every year — the birthday workout. Each year is its
//     own row (enabled by the badges.year column). Rendered with the year
//     stamped on the badge itself. Holidays will join this category in a
//     future update with per-holiday theming.
//
// This is a DISPLAY LAYER. The database keeps every earned badge row.

import { BADGES } from "./badges";

// ── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export type BadgeTier = 1 | 2 | 3 | 4 | 5;
export type BadgeRenderType = "progression" | "credential" | "yearly";

// An earned badge row as it comes back from the DB. We need year here so
// yearly badges can stamp the year on their display.
export interface EarnedBadge {
  badge_id: string;
  year: number | null;
}

// Visual style per progression tier. Higher tiers = more dramatic.
export const TIER_STYLES: Record<BadgeTier, {
  name: string;
  gradient: string;
  border: string;
  glow: string;
  textColor: string;
  accentColor: string;
}> = {
  1: {
    name: "BRONZE",
    gradient: "linear-gradient(135deg, #3D2A1F, #6B4423)",
    border: "#B87333",
    glow: "rgba(184,115,51,0.35)",
    textColor: "#F5A76B",
    accentColor: "#B87333",
  },
  2: {
    name: "SILVER",
    gradient: "linear-gradient(135deg, #3A3A42, #5C5C66)",
    border: "#C0C0C0",
    glow: "rgba(192,192,192,0.4)",
    textColor: "#E8E8E8",
    accentColor: "#C0C0C0",
  },
  3: {
    name: "GOLD",
    gradient: "linear-gradient(135deg, #3D2D00, #6B5000)",
    border: "#FFD700",
    glow: "rgba(255,215,0,0.5)",
    textColor: "#FFE55C",
    accentColor: "#FFD700",
  },
  4: {
    name: "PLATINUM",
    gradient: "linear-gradient(135deg, #1A1F3A, #2D3D6B)",
    border: "#7CC4FF",
    glow: "rgba(124,196,255,0.55)",
    textColor: "#A8D9FF",
    accentColor: "#7CC4FF",
  },
  5: {
    name: "DIAMOND",
    gradient: "linear-gradient(135deg, #1A0F30, #4A2D8A, #1A0F30)",
    border: "#C084FC",
    glow: "rgba(192,132,252,0.6)",
    textColor: "#E9D5FF",
    accentColor: "#C084FC",
  },
};

// ── CREDENTIAL & YEARLY BADGE CLASSIFICATION ────────────────────────────────

// Credentials are things about *you* that can only happen once in your life.
// These never tier up — they're one-and-done. Rendered with holographic look.
const CREDENTIAL_BADGE_IDS = new Set<string>([
  "veteran",
  "coach",
  "personal-trainer",
  "transformation",
  "comeback-story",
]);

// Yearly badges recur each year — you can earn the "same" badge multiple
// years in a row. DB stores each year as its own row. The year column on
// badges table distinguishes them.
const YEARLY_BADGE_IDS = new Set<string>([
  "birthday-workout",
]);

// ── PROGRESSION FAMILIES ────────────────────────────────────────────────────
// Maps related badges into evolving tiers. Order matters — the first entry
// is tier 1, last entry is the peak tier of the family.
//
// `thresholds` parallels `members`: thresholds[i] is the number required to
// earn members[i]. When provided, the UI can show "14 / 20 runs" style
// progress text instead of just "2/5 tiers earned".
//
// `counterSource` tells the profile page which SQL-backed counter to use
// to compute the user's current total. Matches the keys returned by
// `fetchBadgeCounters()` (in the profile page).

export interface BadgeFamily {
  key: string;
  name: string;
  category: string;
  members: string[];
  thresholds?: number[];
  counterSource?: string; // key into the counters map
}

export const BADGE_FAMILIES: BadgeFamily[] = [
  // ── STRENGTH ────────────────────────────────────────────
  { key: "lifting-progression", name: "Lifter",           category: "strength",  members: ["first-lift", "lifts-10", "lifts-25", "lifts-50", "lifts-100"], thresholds: [1, 10, 25, 50, 100], counterSource: "liftSessions" },
  { key: "bench-progression",   name: "Bench Press",      category: "strength",  members: ["bench-200", "heavy-lifter"] },
  { key: "squat-progression",   name: "Squat",            category: "strength",  members: ["squat-300"] },
  { key: "deadlift-progression",name: "Deadlift",         category: "strength",  members: ["deadlift-400", "iron-maiden"] },
  { key: "one-rep-max",         name: "One Rep Max",      category: "strength",  members: ["1rm-pr", "pb-crusher"] },
  { key: "overhead-pull",       name: "Overhead & Pull",  category: "strength",  members: ["overhead-bw", "weighted-pullup"] },
  { key: "kettlebell",          name: "Kettlebell",       category: "strength",  members: ["kettlebell-king"] },
  { key: "powerlifting",        name: "Powerlifter",      category: "strength",  members: ["powerlifter", "1k-club"] },

  // ── CARDIO / RUNNING ─────────────────────────────────────
  { key: "runs",                name: "Runs",             category: "cardio",    members: ["first-run", "runs-5", "runs-20", "runs-50", "runs-100"], thresholds: [1, 5, 20, 50, 100], counterSource: "runs" },
  { key: "run-distance",        name: "Distance Runner",  category: "cardio",    members: ["5k", "10k", "half-marathon", "marathon", "ultra"] },
  { key: "speed",               name: "Speed",            category: "cardio",    members: ["6min-mile"] },
  { key: "biking",              name: "Cyclist",          category: "cardio",    members: ["century-ride"] },
  { key: "swimming",            name: "Swimmer",          category: "cardio",    members: ["swim-mile"] },
  { key: "rowing",              name: "Rower",            category: "cardio",    members: ["rowing-10k"] },
  { key: "multi-sport",         name: "Multi-Sport",      category: "cardio",    members: ["triathlon", "ironman"] },

  // ── CONSISTENCY ─────────────────────────────────────────
  { key: "total-workouts",      name: "Total Workouts",   category: "consistency", members: ["first-workout", "workouts-10", "workouts-25", "centurion-half", "centurion", "500-workouts"], thresholds: [1, 10, 25, 50, 100, 500], counterSource: "totalWorkouts" },
  { key: "streaks",             name: "Streak",           category: "consistency", members: ["7day-streak", "30day-streak", "90day-streak", "365day"], thresholds: [7, 30, 90, 365], counterSource: "currentStreak" },
  { key: "no-days-off",         name: "No Days Off",      category: "consistency", members: ["no-days-off", "weekend-warrior"] },
  { key: "early-bird-general",  name: "Early Bird",       category: "consistency", members: ["early-bird"] },
  { key: "comeback-streak",     name: "Comeback",         category: "consistency", members: ["comeback"] },

  // ── WELLNESS ────────────────────────────────────────────
  { key: "yoga",                name: "Yoga",             category: "wellness",  members: ["first-yoga", "yoga-10", "yoga-lover", "yoga-queen"], thresholds: [1, 10, 30, 100], counterSource: "yogaSessions" },
  { key: "meditation",          name: "Meditation",       category: "wellness",  members: ["first-meditation", "meditation-10", "meditation-master"], thresholds: [1, 10, 30], counterSource: "meditationSessions" },
  { key: "cold-plunge",         name: "Cold Plunge",      category: "wellness",  members: ["first-cold-plunge", "ice-bath", "cold-plunge-20"], thresholds: [1, 5, 20], counterSource: "coldPlunges" },
  { key: "sauna",               name: "Sauna",            category: "wellness",  members: ["first-sauna"], thresholds: [1], counterSource: "saunaSessions" },
  { key: "breathwork",          name: "Breathwork",       category: "wellness",  members: ["first-breathwork"], thresholds: [1], counterSource: "breathworkSessions" },
  { key: "walking",             name: "Walking",          category: "wellness",  members: ["first-walk"], thresholds: [1], counterSource: "walks" },
  { key: "stretching",          name: "Stretching",       category: "wellness",  members: ["first-stretch", "stretch-it-out"], thresholds: [1, 20], counterSource: "stretchingSessions" },
  { key: "wellness-general",    name: "Wellness",         category: "wellness",  members: ["wellness-50"], thresholds: [50], counterSource: "totalWellness" },
  { key: "recovery",            name: "Recovery",         category: "wellness",  members: ["sleep-champ", "hydration-hero"] },

  // ── NUTRITION ───────────────────────────────────────────
  { key: "nutrition-logging",   name: "Nutrition Logs",   category: "nutrition", members: ["first-nutrition-log", "nutrition-week", "nutrition-pro", "nutrition-100"], thresholds: [1, 7, 14, 100], counterSource: "nutritionLogs" },
  { key: "nutrition-goals",     name: "Nutrition Goals",  category: "nutrition", members: ["calorie-goals", "protein-streak", "macro-master"] },
  { key: "meal-prep",           name: "Meal Prep",        category: "nutrition", members: ["meal-prep"] },
  { key: "plant-based",         name: "Plant-Based",      category: "nutrition", members: ["plant-week"] },
  { key: "clean-eating",        name: "Clean Eating",     category: "nutrition", members: ["sugar-free", "clean-30"] },
  { key: "barcode-scanner",     name: "Scanner",          category: "nutrition", members: ["barcode-10", "barcode-100"] },
  { key: "fasting",             name: "Fasting",          category: "nutrition", members: ["fasting"] },

  // ── CHALLENGES & EVENTS ─────────────────────────────────
  { key: "challenges-programs", name: "Programs",         category: "challenges", members: ["iron-will", "75-hard"] },
  { key: "challenges-events",   name: "Events",           category: "challenges", members: ["murph", "spartan", "tough-mudder", "crossfit-open"] },
  { key: "pushup",              name: "Push-Ups",         category: "challenges", members: ["pushup-100"] },
  { key: "plank",               name: "Plank",            category: "challenges", members: ["plank-5min"] },
  { key: "burpee",              name: "Burpees",          category: "challenges", members: ["burpee-100"] },
  { key: "pullup",              name: "Pull-Ups",         category: "challenges", members: ["pullup-20"] },

  // ── SOCIAL ──────────────────────────────────────────────
  { key: "posts",               name: "Posts",            category: "social",    members: ["first-post", "10-posts"], thresholds: [1, 10], counterSource: "postCount" },
  { key: "followers",           name: "Followers",        category: "social",    members: ["first-follower", "100-followers"], thresholds: [1, 100], counterSource: "followerCount" },
  { key: "groups",              name: "Groups",           category: "social",    members: ["group-member", "group-leader"] },
  { key: "likes",               name: "Likes",            category: "social",    members: ["first-like", "motivator"] },

  // ── SPECIAL (progression) ───────────────────────────────
  // Credentials are handled separately below, not here.
  { key: "gym-rat",             name: "Gym Rat",          category: "special",   members: ["first-gym"] },
  { key: "new-year",            name: "New Year",         category: "special",   members: ["new-years"] },
  { key: "holiday",             name: "Holiday",          category: "special",   members: ["holiday-hustle"] },
  { key: "workout-partner",     name: "Workout Partner",  category: "special",   members: ["collab"] },
  { key: "outdoor",             name: "Outdoor",          category: "special",   members: ["outdoor-adventurer"] },
  { key: "competitor",          name: "Competitor",       category: "special",   members: ["sport-competitor"] },
];

// Reverse lookup for quick membership checks
const BADGE_TO_FAMILY: Map<string, string> = new Map();
for (const family of BADGE_FAMILIES) {
  for (const memberId of family.members) {
    BADGE_TO_FAMILY.set(memberId, family.key);
  }
}

// ── DISPLAY OUTPUT TYPES ────────────────────────────────────────────────────

// Map of counter source keys to current user counts. Profile page fills this.
// Keys match `counterSource` values on BadgeFamily entries.
export type BadgeCounters = Record<string, number>;

export interface DisplayBadge {
  key: string;                    // unique key for React rendering
  renderType: BadgeRenderType;
  emoji: string;
  label: string;
  desc: string;
  category: string;

  // Progression-only
  tier?: BadgeTier;
  earnedCount?: number;
  maxTier?: number;

  // Progression progress — only set when the family has thresholds + a counter
  currentValue?: number;     // current user count (e.g. 14 runs)
  currentThreshold?: number; // threshold for the tier they're at (e.g. 5 for runs-5)
  nextThreshold?: number;    // threshold for the next tier (e.g. 20 for runs-20)
  isMaxed?: boolean;         // true if they've hit the top tier
  progressLabel?: string;    // e.g. "runs", "sessions", "workouts"

  // Yearly-only
  year?: number;
}

// What label to show as the progress unit. Falls back to "earned".
const PROGRESS_LABEL_BY_COUNTER: Record<string, string> = {
  runs: "runs",
  liftSessions: "sessions",
  totalWorkouts: "workouts",
  currentStreak: "day streak",
  yogaSessions: "sessions",
  meditationSessions: "sessions",
  coldPlunges: "plunges",
  saunaSessions: "sessions",
  breathworkSessions: "sessions",
  walks: "walks",
  stretchingSessions: "sessions",
  totalWellness: "activities",
  nutritionLogs: "logs",
  postCount: "posts",
  followerCount: "followers",
};

// ── GROUPING LOGIC ──────────────────────────────────────────────────────────

/** Turn an earned-badges list (from DB) into display-ready slots.
 *  Accepts either string[] (badge_id only, for backwards compat) or
 *  EarnedBadge[] (with year). Optional counters map adds progress info. */
export function groupBadgesIntoFamilies(
  earned: string[] | EarnedBadge[],
  counters: BadgeCounters = {}
): DisplayBadge[] {
  // Normalize input: turn legacy string[] into EarnedBadge[]
  const earnedBadges: EarnedBadge[] = (earned as any[]).map((e) =>
    typeof e === "string" ? { badge_id: e, year: null } : e
  );
  const earnedIds = new Set(earnedBadges.map((e) => e.badge_id));

  const result: DisplayBadge[] = [];
  const consumedIds = new Set<string>(); // track what we've already placed

  // 1. Yearly badges — each (badge_id, year) combo is its own slot
  for (const eb of earnedBadges) {
    if (!YEARLY_BADGE_IDS.has(eb.badge_id)) continue;
    const badge = BADGES.find((b) => b.id === eb.badge_id);
    if (!badge) continue;

    const year = eb.year;
    const yearLabel = year ? `${year}` : "Unknown Year";

    result.push({
      key: `${eb.badge_id}-${year ?? "null"}`,
      renderType: "yearly",
      emoji: badge.emoji,
      label: `${yearLabel} ${badge.label}`,
      desc: badge.desc,
      category: badge.category,
      year: year ?? undefined,
    });
    consumedIds.add(eb.badge_id);
  }

  // 2. Credential badges — one slot each, no tier
  for (const credId of CREDENTIAL_BADGE_IDS) {
    if (!earnedIds.has(credId)) continue;
    const badge = BADGES.find((b) => b.id === credId);
    if (!badge) continue;

    result.push({
      key: credId,
      renderType: "credential",
      emoji: badge.emoji,
      label: badge.label,
      desc: badge.desc,
      category: badge.category,
    });
    consumedIds.add(credId);
  }

  // 3. Progression families — group related milestones into one slot
  for (const family of BADGE_FAMILIES) {
    const earnedMembers = family.members.filter((id) => earnedIds.has(id));
    if (earnedMembers.length === 0) continue;

    // Peak = furthest-along member in family order
    const maxDefinedIndex = earnedMembers.reduce((max, id) => {
      const idx = family.members.indexOf(id);
      return idx > max ? idx : max;
    }, -1);
    const peakId = family.members[maxDefinedIndex];

    // Tier capped at family size
    const familySize = family.members.length;
    const maxTierForFamily = Math.min(5, familySize) as BadgeTier;
    const positionInFamily = maxDefinedIndex + 1;
    const tier = Math.max(1, Math.min(maxTierForFamily, positionInFamily)) as BadgeTier;

    const peakBadge = BADGES.find((b) => b.id === peakId);
    if (!peakBadge) continue;

    // Compute progress if the family has thresholds + a counter
    let currentValue: number | undefined;
    let currentThreshold: number | undefined;
    let nextThreshold: number | undefined;
    let isMaxed: boolean | undefined;
    let progressLabel: string | undefined;

    if (family.thresholds && family.counterSource && counters[family.counterSource] !== undefined) {
      currentValue = counters[family.counterSource];
      currentThreshold = family.thresholds[positionInFamily - 1];
      nextThreshold = family.thresholds[positionInFamily]; // undefined if maxed
      isMaxed = positionInFamily >= familySize;
      progressLabel = PROGRESS_LABEL_BY_COUNTER[family.counterSource] ?? "earned";
    }

    result.push({
      key: family.key,
      renderType: "progression",
      emoji: peakBadge.emoji,
      label: peakBadge.label,
      desc: peakBadge.desc,
      category: family.category,
      tier,
      earnedCount: earnedMembers.length,
      maxTier: familySize,
      currentValue,
      currentThreshold,
      nextThreshold,
      isMaxed,
      progressLabel,
    });

    for (const memberId of family.members) consumedIds.add(memberId);
  }

  // 4. Orphans — earned badges that aren't in any family and aren't credentials/yearly
  for (const eb of earnedBadges) {
    if (consumedIds.has(eb.badge_id)) continue;
    const badge = BADGES.find((b) => b.id === eb.badge_id);
    if (!badge) continue;

    result.push({
      key: `orphan-${eb.badge_id}`,
      renderType: "progression",
      emoji: badge.emoji,
      label: badge.label,
      desc: badge.desc,
      category: badge.category,
      tier: 1,
      earnedCount: 1,
      maxTier: 1,
    });
  }

  // Sort: credentials first, then yearly (newest first), then progression by tier
  result.sort((a, b) => {
    const typeOrder = { credential: 0, yearly: 1, progression: 2 };
    if (typeOrder[a.renderType] !== typeOrder[b.renderType]) {
      return typeOrder[a.renderType] - typeOrder[b.renderType];
    }
    if (a.renderType === "yearly" && b.renderType === "yearly") {
      return (b.year ?? 0) - (a.year ?? 0);
    }
    if (a.renderType === "progression" && b.renderType === "progression") {
      if ((b.tier ?? 0) !== (a.tier ?? 0)) return (b.tier ?? 0) - (a.tier ?? 0);
      if (a.category !== b.category) return a.category.localeCompare(b.category);
    }
    return a.label.localeCompare(b.label);
  });

  return result;
}

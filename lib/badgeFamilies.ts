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

export type BadgeTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type BadgeRenderType = "progression" | "credential" | "yearly";

// An earned badge row as it comes back from the DB. We need year here so
// yearly badges can stamp the year on their display.
export interface EarnedBadge {
  badge_id: string;
  year: number | null;
}

// Visual style per progression tier. Higher tiers = more dramatic.
// Updated Oct 2026: expanded from 5 → 8 tiers to support 1/5/20/50/100/200/500/1000
// progression for the big-grind families (runs, workouts, nutrition, etc.)
//
// SHINY UPGRADE: Each tier now uses a metallic 3-stop gradient (dark base →
// bright mid → dark base) simulating light hitting curved metal. Borders use
// a complementary bright color. Glow is doubled (close + wide halo) for
// depth. `shimmer` field controls whether the badge gets an animated
// highlight sweep — reserved for Platinum and above since too much motion
// would distract from progress info on common tiers.
export const TIER_STYLES: Record<BadgeTier, {
  name: string;
  gradient: string;
  border: string;
  glow: string;
  textColor: string;
  accentColor: string;
  shimmer?: boolean;
}> = {
  1: {
    // BRONZE — warm copper with a bright highlight band
    name: "BRONZE",
    gradient: "linear-gradient(135deg, #4A2E1C 0%, #A66D39 45%, #D4915A 50%, #A66D39 55%, #4A2E1C 100%)",
    border: "#E5A572",
    glow: "rgba(229,165,114,0.55)",
    textColor: "#FFE0C2",
    accentColor: "#FFC58A",
  },
  2: {
    // SILVER — cool steel with a white-hot shine streak
    name: "SILVER",
    gradient: "linear-gradient(135deg, #2A2D38 0%, #8A9098 45%, #E8ECEF 50%, #8A9098 55%, #2A2D38 100%)",
    border: "#F0F2F5",
    glow: "rgba(220,225,230,0.65)",
    textColor: "#FFFFFF",
    accentColor: "#E8ECEF",
  },
  3: {
    // GOLD — rich yellow-orange with a molten highlight
    name: "GOLD",
    gradient: "linear-gradient(135deg, #4A3200 0%, #D4A017 40%, #FFEB7A 50%, #D4A017 60%, #4A3200 100%)",
    border: "#FFE066",
    glow: "rgba(255,224,102,0.75)",
    textColor: "#FFF9C4",
    accentColor: "#FFEB7A",
  },
  4: {
    // PLATINUM — icy blue-white, mirror-bright
    name: "PLATINUM",
    gradient: "linear-gradient(135deg, #12194A 0%, #5E8AC9 40%, #C4DFFF 50%, #5E8AC9 60%, #12194A 100%)",
    border: "#D6ECFF",
    glow: "rgba(198,227,255,0.85)",
    textColor: "#F0F8FF",
    accentColor: "#C4DFFF",
    shimmer: true,
  },
  5: {
    // DIAMOND — prismatic purple-pink with animated shine
    name: "DIAMOND",
    gradient: "linear-gradient(135deg, #1A0F30 0%, #7C3AED 35%, #E9D5FF 50%, #C084FC 65%, #1A0F30 100%)",
    border: "#F3E8FF",
    glow: "rgba(233,213,255,0.9)",
    textColor: "#FAF5FF",
    accentColor: "#E9D5FF",
    shimmer: true,
  },
  6: {
    // EMERALD — deep jungle green with a jade highlight
    name: "EMERALD",
    gradient: "linear-gradient(135deg, #022C1B 0%, #0E9F6E 40%, #6EE7B7 50%, #0E9F6E 60%, #022C1B 100%)",
    border: "#A7F3D0",
    glow: "rgba(110,231,183,0.95)",
    textColor: "#ECFDF5",
    accentColor: "#6EE7B7",
    shimmer: true,
  },
  7: {
    // ONYX — obsidian black with molten red-orange fire
    name: "ONYX",
    gradient: "linear-gradient(135deg, #0A0A0A 0%, #B91C1C 38%, #FCA5A5 50%, #B91C1C 62%, #0A0A0A 100%)",
    border: "#FECACA",
    glow: "rgba(252,165,165,1)",
    textColor: "#FFF1F1",
    accentColor: "#FCA5A5",
    shimmer: true,
  },
  8: {
    // OBSIDIAN — all-prism, maximum shine, reserved for 1000+ achievements
    name: "OBSIDIAN",
    gradient: "linear-gradient(135deg, #000 0%, #8B5CF6 20%, #EC4899 35%, #FDE047 50%, #22D3EE 65%, #8B5CF6 80%, #000 100%)",
    border: "#FFFFFF",
    glow: "rgba(255,255,255,1)",
    textColor: "#FFFFFF",
    accentColor: "#FDE047",
    shimmer: true,
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
  { key: "lifting-progression", name: "Lifter",           category: "strength",  members: ["first-lift", "lifts-10", "lifts-25", "lifts-50", "lifts-100", "lifts-200", "lifts-500", "lifts-1000"], thresholds: [1, 10, 25, 50, 100, 200, 500, 1000], counterSource: "liftSessions" },
  { key: "bench-progression",   name: "Bench Press",      category: "strength",  members: ["bench-200", "heavy-lifter"] },
  { key: "squat-progression",   name: "Squat",            category: "strength",  members: ["squat-300"] },
  { key: "deadlift-progression",name: "Deadlift",         category: "strength",  members: ["deadlift-400", "iron-maiden"] },
  { key: "one-rep-max",         name: "One Rep Max",      category: "strength",  members: ["1rm-pr", "pb-crusher"] },
  { key: "overhead-pull",       name: "Overhead & Pull",  category: "strength",  members: ["overhead-bw", "weighted-pullup"] },
  { key: "kettlebell",          name: "Kettlebell",       category: "strength",  members: ["kettlebell-king"] },
  { key: "powerlifting",        name: "Powerlifter",      category: "strength",  members: ["powerlifter", "1k-club"] },

  // ── CARDIO / RUNNING ─────────────────────────────────────
  { key: "runs",                name: "Runs",             category: "cardio",    members: ["first-run", "runs-5", "runs-20", "runs-50", "runs-100", "runs-200", "runs-500", "runs-1000"], thresholds: [1, 5, 20, 50, 100, 200, 500, 1000], counterSource: "runs" },
  { key: "run-distance",        name: "Distance Runner",  category: "cardio",    members: ["5k", "10k", "half-marathon", "marathon", "ultra"] },
  { key: "speed",               name: "Speed",            category: "cardio",    members: ["6min-mile"] },
  { key: "biking",              name: "Cyclist",          category: "cardio",    members: ["century-ride"] },
  { key: "swimming",            name: "Swimmer",          category: "cardio",    members: ["swim-mile"] },
  { key: "rowing",              name: "Rower",            category: "cardio",    members: ["rowing-10k"] },
  { key: "multi-sport",         name: "Multi-Sport",      category: "cardio",    members: ["triathlon", "ironman"] },

  // ── CONSISTENCY ─────────────────────────────────────────
  { key: "total-workouts",      name: "Total Workouts",   category: "consistency", members: ["first-workout", "workouts-10", "workouts-25", "centurion-half", "centurion", "centurion-2x", "500-workouts", "1000-workouts"], thresholds: [1, 10, 25, 50, 100, 200, 500, 1000], counterSource: "totalWorkouts" },
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

    // Tier capped at family size
    const familySize = family.members.length;
    const maxTierForFamily = Math.min(8, familySize) as BadgeTier;
    let positionInFamily = maxDefinedIndex + 1;

    // If we have a live counter, recompute tier from actual count — this catches
    // cases where the user's activity has outpaced the badge-award job, e.g.
    // user has 19 nutrition logs but the DB only granted them 2 of the 4 tiers.
    // The actual count is the source of truth; badge rows are DB lag.
    if (family.thresholds && family.counterSource && counters[family.counterSource] !== undefined) {
      const count = counters[family.counterSource];
      let actualPosition = 0;
      for (let i = 0; i < family.thresholds.length; i++) {
        if (count >= family.thresholds[i]) actualPosition = i + 1;
      }
      // Use whichever is higher: earned-badge position or counter-computed position
      positionInFamily = Math.max(positionInFamily, actualPosition);
    }

    const tier = Math.max(1, Math.min(maxTierForFamily, positionInFamily)) as BadgeTier;
    const adjustedPeakIndex = Math.max(0, positionInFamily - 1);
    const peakId = family.members[Math.min(adjustedPeakIndex, familySize - 1)];

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
      currentThreshold = family.thresholds[Math.max(0, positionInFamily - 1)];
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

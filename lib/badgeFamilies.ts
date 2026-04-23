// ── lib/badgeFamilies.ts ────────────────────────────────────────────────────
// Groups related badges into "families" so the profile only shows one evolving
// badge slot per achievement. Example: earning "First Run" + "5 Runs" + "20 Runs"
// shows up as a single "Runs" badge at tier 3, not three separate squares.
//
// This is a PURE DISPLAY LAYER. The database is untouched — every earned badge
// row still exists. We just group them at render time.

import { BADGES } from "./badges";

export type BadgeTier = 1 | 2 | 3 | 4 | 5;

// Visual style per tier — higher tiers get more dramatic treatment.
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

// ── FAMILY DEFINITIONS ──────────────────────────────────────────────────────
// Maps each earned badge_id to a family. Badges in the same family share a
// single display slot; the slot's tier = how many of that family's badges
// the user has earned.
//
// Tier numbers (1-5) are assigned by the order of badge_ids in each array.
// First entry = tier 1, last entry = highest tier.

export const BADGE_FAMILIES: { key: string; name: string; category: string; members: string[] }[] = [
  // ── STRENGTH ────────────────────────────────────────────
  { key: "lifting-progression", name: "Lifter",           category: "strength",  members: ["first-lift", "lifts-10", "lifts-25", "lifts-50", "lifts-100"] },
  { key: "bench-progression",   name: "Bench Press",      category: "strength",  members: ["bench-200", "heavy-lifter"] },
  { key: "squat-progression",   name: "Squat",            category: "strength",  members: ["squat-300"] },
  { key: "deadlift-progression",name: "Deadlift",         category: "strength",  members: ["deadlift-400", "iron-maiden"] },
  { key: "one-rep-max",         name: "One Rep Max",      category: "strength",  members: ["1rm-pr", "pb-crusher"] },
  { key: "overhead-pull",       name: "Overhead & Pull",  category: "strength",  members: ["overhead-bw", "weighted-pullup"] },
  { key: "kettlebell",          name: "Kettlebell",       category: "strength",  members: ["kettlebell-king"] },
  { key: "powerlifting",        name: "Powerlifter",      category: "strength",  members: ["powerlifter", "1k-club"] },

  // ── CARDIO / RUNNING ─────────────────────────────────────
  { key: "runs",                name: "Runs",             category: "cardio",    members: ["first-run", "runs-5", "runs-20", "runs-50", "runs-100"] },
  { key: "run-distance",        name: "Distance Runner",  category: "cardio",    members: ["5k", "10k", "half-marathon", "marathon", "ultra"] },
  { key: "speed",               name: "Speed",            category: "cardio",    members: ["6min-mile"] },
  { key: "biking",              name: "Cyclist",          category: "cardio",    members: ["century-ride"] },
  { key: "swimming",            name: "Swimmer",          category: "cardio",    members: ["swim-mile"] },
  { key: "rowing",              name: "Rower",            category: "cardio",    members: ["rowing-10k"] },
  { key: "multi-sport",         name: "Multi-Sport",      category: "cardio",    members: ["triathlon", "ironman"] },

  // ── CONSISTENCY ─────────────────────────────────────────
  { key: "total-workouts",      name: "Total Workouts",   category: "consistency", members: ["first-workout", "workouts-10", "workouts-25", "centurion-half", "centurion", "500-workouts"] },
  { key: "streaks",             name: "Streak",           category: "consistency", members: ["7day-streak", "30day-streak", "90day-streak", "365day"] },
  { key: "no-days-off",         name: "No Days Off",      category: "consistency", members: ["no-days-off", "weekend-warrior"] },
  { key: "early-bird-general",  name: "Early Bird",       category: "consistency", members: ["early-bird"] },
  { key: "comeback",            name: "Comeback",         category: "consistency", members: ["comeback"] },

  // ── WELLNESS ────────────────────────────────────────────
  { key: "yoga",                name: "Yoga",             category: "wellness",  members: ["first-yoga", "yoga-10", "yoga-lover", "yoga-queen"] },
  { key: "meditation",          name: "Meditation",       category: "wellness",  members: ["first-meditation", "meditation-10", "meditation-master"] },
  { key: "cold-plunge",         name: "Cold Plunge",      category: "wellness",  members: ["first-cold-plunge", "ice-bath", "cold-plunge-20"] },
  { key: "sauna",               name: "Sauna",            category: "wellness",  members: ["first-sauna"] },
  { key: "breathwork",          name: "Breathwork",       category: "wellness",  members: ["first-breathwork"] },
  { key: "walking",             name: "Walking",          category: "wellness",  members: ["first-walk"] },
  { key: "stretching",          name: "Stretching",       category: "wellness",  members: ["first-stretch", "stretch-it-out"] },
  { key: "wellness-general",    name: "Wellness",         category: "wellness",  members: ["wellness-50"] },
  { key: "recovery",            name: "Recovery",         category: "wellness",  members: ["sleep-champ", "hydration-hero"] },

  // ── NUTRITION ───────────────────────────────────────────
  { key: "nutrition-logging",   name: "Nutrition Logs",   category: "nutrition", members: ["first-nutrition-log", "nutrition-week", "nutrition-pro", "nutrition-100"] },
  { key: "nutrition-goals",     name: "Nutrition Goals",  category: "nutrition", members: ["calorie-goals", "protein-streak", "macro-master"] },
  { key: "meal-prep",           name: "Meal Prep",        category: "nutrition", members: ["meal-prep"] },
  { key: "plant-based",         name: "Plant-Based",      category: "nutrition", members: ["plant-week"] },
  { key: "clean-eating",        name: "Clean Eating",     category: "nutrition", members: ["sugar-free", "clean-30"] },
  { key: "barcode-scanner",     name: "Scanner",          category: "nutrition", members: ["barcode-10", "barcode-100"] },
  { key: "fasting",             name: "Fasting",          category: "nutrition", members: ["fasting"] },

  // ── CHALLENGES ──────────────────────────────────────────
  { key: "challenges-programs", name: "Programs",         category: "challenges", members: ["iron-will", "75-hard"] },
  { key: "challenges-events",   name: "Events",           category: "challenges", members: ["murph", "spartan", "tough-mudder", "crossfit-open"] },
  { key: "pushup",              name: "Push-Ups",         category: "challenges", members: ["pushup-100"] },
  { key: "plank",               name: "Plank",            category: "challenges", members: ["plank-5min"] },
  { key: "burpee",              name: "Burpees",          category: "challenges", members: ["burpee-100"] },
  { key: "pullup",              name: "Pull-Ups",         category: "challenges", members: ["pullup-20"] },

  // ── SOCIAL ──────────────────────────────────────────────
  { key: "posts",               name: "Posts",            category: "social",    members: ["first-post", "10-posts"] },
  { key: "followers",           name: "Followers",        category: "social",    members: ["first-follower", "100-followers"] },
  { key: "groups",              name: "Groups",           category: "social",    members: ["group-member", "group-leader"] },
  { key: "likes",               name: "Likes",            category: "social",    members: ["first-like", "motivator"] },

  // ── SPECIAL (all standalone, 1-tier families) ───────────
  { key: "veteran",             name: "Veteran",          category: "special",   members: ["veteran"] },
  { key: "gym-rat",             name: "Gym Rat",          category: "special",   members: ["first-gym"] },
  { key: "coaching",            name: "Coaching",         category: "special",   members: ["coach", "personal-trainer"] },
  { key: "transformation",      name: "Transformation",   category: "special",   members: ["transformation", "comeback-story"] },
  { key: "birthday",            name: "Birthday",         category: "special",   members: ["birthday-workout"] },
  { key: "new-year",            name: "New Year",         category: "special",   members: ["new-years"] },
  { key: "holiday",             name: "Holiday",          category: "special",   members: ["holiday-hustle"] },
  { key: "workout-partner",     name: "Workout Partner",  category: "special",   members: ["collab"] },
  { key: "outdoor",             name: "Outdoor",          category: "special",   members: ["outdoor-adventurer"] },
  { key: "competitor",          name: "Competitor",       category: "special",   members: ["sport-competitor"] },
];

// Build a reverse lookup: badge_id -> family
const BADGE_TO_FAMILY: Map<string, string> = new Map();
for (const family of BADGE_FAMILIES) {
  for (const memberId of family.members) {
    BADGE_TO_FAMILY.set(memberId, family.key);
  }
}

// ── GROUPING LOGIC ──────────────────────────────────────────────────────────

export interface GroupedBadge {
  familyKey: string;
  familyName: string;
  category: string;
  peakBadgeId: string;        // the highest tier member they've earned
  peakBadgeEmoji: string;
  peakBadgeLabel: string;
  peakBadgeDesc: string;
  tier: BadgeTier;            // 1-5
  maxTier: number;            // total possible tiers in this family
  earnedCount: number;        // how many of the family members they've earned
  orphan: boolean;            // true if this badge isn't in any family (safety fallback)
}

/** Group a list of earned badge IDs into family slots.
 *  Returns one GroupedBadge per family with at least one earned member.
 *  Orphan badges (not in any family definition) get their own 1-tier slot. */
export function groupBadgesIntoFamilies(earnedIds: string[]): GroupedBadge[] {
  const earnedSet = new Set(earnedIds);
  const result: GroupedBadge[] = [];

  // Process defined families
  for (const family of BADGE_FAMILIES) {
    // Find which members are earned, preserving the family's tier order
    const earnedMembers = family.members.filter((id) => earnedSet.has(id));
    if (earnedMembers.length === 0) continue;

    // Peak tier = the last earned member in the family's defined order.
    // This handles out-of-order earning (e.g. user earned "marathon" before "5k").
    const maxDefinedIndex = earnedMembers.reduce((max, id) => {
      const idx = family.members.indexOf(id);
      return idx > max ? idx : max;
    }, -1);
    const peakId = family.members[maxDefinedIndex];

    // Normalize tier to 1-5 range based on position within the family
    const tierRatio = (maxDefinedIndex + 1) / family.members.length;
    const tier: BadgeTier = Math.max(1, Math.min(5, Math.ceil(tierRatio * 5))) as BadgeTier;

    const peakBadge = BADGES.find((b) => b.id === peakId);
    if (!peakBadge) continue;

    result.push({
      familyKey: family.key,
      familyName: family.name,
      category: family.category,
      peakBadgeId: peakBadge.id,
      peakBadgeEmoji: peakBadge.emoji,
      peakBadgeLabel: peakBadge.label,
      peakBadgeDesc: peakBadge.desc,
      tier,
      maxTier: family.members.length,
      earnedCount: earnedMembers.length,
      orphan: false,
    });
  }

  // Handle orphans: earned badges not mapped to any family.
  // This protects against new badges being added without updating BADGE_FAMILIES.
  for (const earnedId of earnedIds) {
    if (!BADGE_TO_FAMILY.has(earnedId)) {
      const badge = BADGES.find((b) => b.id === earnedId);
      if (!badge) continue;
      result.push({
        familyKey: earnedId, // use badge id as family key for orphans
        familyName: badge.label,
        category: badge.category,
        peakBadgeId: badge.id,
        peakBadgeEmoji: badge.emoji,
        peakBadgeLabel: badge.label,
        peakBadgeDesc: badge.desc,
        tier: 1,
        maxTier: 1,
        earnedCount: 1,
        orphan: true,
      });
    }
  }

  // Sort: higher tier first, then by category, then by name
  result.sort((a, b) => {
    if (b.tier !== a.tier) return b.tier - a.tier;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.familyName.localeCompare(b.familyName);
  });

  return result;
}

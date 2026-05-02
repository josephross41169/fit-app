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
  // ── EASY COUNTER LADDERS (8 tiers @ 1/5/20/50/100/200/500/1000) ───────
  // All auto-awarded based on counterSource. Tier 1 IS the first earn —
  // no separate "first-X" badges. Old IDs renamed: first-run → runs-1, etc.

  // STRENGTH
  { key: "lifts",        name: "Lifting",          category: "strength",    members: ["lifts-1","lifts-5","lifts-20","lifts-50","lifts-100","lifts-200","lifts-500","lifts-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "liftSessions" },

  // CARDIO
  { key: "runs",         name: "Runs",             category: "cardio",      members: ["runs-1","runs-5","runs-20","runs-50","runs-100","runs-200","runs-500","runs-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "runs" },
  { key: "walks",        name: "Walking",          category: "cardio",      members: ["walks-1","walks-5","walks-20","walks-50","walks-100","walks-200","walks-500","walks-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "walks" },
  { key: "biking",       name: "Biking",           category: "cardio",      members: ["biking-1","biking-5","biking-20","biking-50","biking-100","biking-200","biking-500","biking-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "bikingSessions" },
  { key: "swimming",     name: "Swimming",         category: "cardio",      members: ["swimming-1","swimming-5","swimming-20","swimming-50","swimming-100","swimming-200","swimming-500","swimming-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "swimmingSessions" },
  { key: "rowing",       name: "Rowing",           category: "cardio",      members: ["rowing-1","rowing-5","rowing-20","rowing-50","rowing-100","rowing-200","rowing-500","rowing-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "rowingSessions" },
  { key: "hiit",         name: "HIIT",             category: "cardio",      members: ["hiit-1","hiit-5","hiit-20","hiit-50","hiit-100","hiit-200","hiit-500","hiit-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "hiitSessions" },
  { key: "boxing",       name: "Boxing",           category: "cardio",      members: ["boxing-1","boxing-5","boxing-20","boxing-50","boxing-100","boxing-200","boxing-500","boxing-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "boxingSessions" },
  { key: "sports",       name: "Sports",           category: "cardio",      members: ["sports-1","sports-5","sports-20","sports-50","sports-100","sports-200","sports-500","sports-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "sportsSessions" },

  // WELLNESS
  { key: "yoga",         name: "Yoga",             category: "wellness",    members: ["yoga-1","yoga-5","yoga-20","yoga-50","yoga-100","yoga-200","yoga-500","yoga-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "yogaSessions" },
  { key: "meditation",   name: "Meditation",       category: "wellness",    members: ["meditation-1","meditation-5","meditation-20","meditation-50","meditation-100","meditation-200","meditation-500","meditation-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "meditationSessions" },
  { key: "cold-plunge",  name: "Cold Plunge",      category: "wellness",    members: ["cold-plunge-1","cold-plunge-5","cold-plunge-20","cold-plunge-50","cold-plunge-100","cold-plunge-200","cold-plunge-500","cold-plunge-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "coldPlunges" },
  { key: "sauna",        name: "Sauna",            category: "wellness",    members: ["sauna-1","sauna-5","sauna-20","sauna-50","sauna-100","sauna-200","sauna-500","sauna-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "saunaSessions" },
  { key: "breathwork",   name: "Breathwork",       category: "wellness",    members: ["breathwork-1","breathwork-5","breathwork-20","breathwork-50","breathwork-100","breathwork-200","breathwork-500","breathwork-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "breathworkSessions" },
  { key: "stretching",   name: "Stretching",       category: "wellness",    members: ["stretching-1","stretching-5","stretching-20","stretching-50","stretching-100","stretching-200","stretching-500","stretching-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "stretchingSessions" },
  { key: "pilates",      name: "Pilates",          category: "wellness",    members: ["pilates-1","pilates-5","pilates-20","pilates-50","pilates-100","pilates-200","pilates-500","pilates-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "pilatesSessions" },
  // New wellness modalities (Apr 2026)
  { key: "infrared-sauna", name: "Infrared Sauna", category: "wellness",    members: ["infrared-sauna-1","infrared-sauna-5","infrared-sauna-20","infrared-sauna-50","infrared-sauna-100","infrared-sauna-200","infrared-sauna-500","infrared-sauna-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "infraredSaunaSessions" },
  { key: "red-light",    name: "Red Light Therapy", category: "wellness",   members: ["red-light-1","red-light-5","red-light-20","red-light-50","red-light-100","red-light-200","red-light-500","red-light-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "redLightSessions" },
  { key: "massage",      name: "Massage",          category: "wellness",    members: ["massage-1","massage-5","massage-20","massage-50","massage-100","massage-200","massage-500","massage-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "massageSessions" },
  { key: "float-tank",   name: "Float Tank",       category: "wellness",    members: ["float-tank-1","float-tank-5","float-tank-20","float-tank-50","float-tank-100","float-tank-200","float-tank-500","float-tank-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "floatTankSessions" },
  { key: "mobility",     name: "Mobility Work",    category: "wellness",    members: ["mobility-1","mobility-5","mobility-20","mobility-50","mobility-100","mobility-200","mobility-500","mobility-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "mobilitySessions" },
  { key: "journaling",   name: "Journaling",       category: "wellness",    members: ["journaling-1","journaling-5","journaling-20","journaling-50","journaling-100","journaling-200","journaling-500","journaling-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "journalingSessions" },
  { key: "sunlight",     name: "Sunlight & Grounding", category: "wellness", members: ["sunlight-1","sunlight-5","sunlight-20","sunlight-50","sunlight-100","sunlight-200","sunlight-500","sunlight-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "sunlightSessions" },
  { key: "wellness",     name: "Total Wellness",   category: "wellness",    members: ["wellness-1","wellness-5","wellness-20","wellness-50","wellness-100","wellness-200","wellness-500","wellness-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "totalWellness" },

  // NUTRITION
  { key: "nutrition",    name: "Nutrition Logs",   category: "nutrition",   members: ["nutrition-1","nutrition-5","nutrition-20","nutrition-50","nutrition-100","nutrition-200","nutrition-500","nutrition-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "nutritionLogs" },
  { key: "fasting-12h",  name: "Fasting Discipline", category: "nutrition", members: ["fasting-12h-1","fasting-12h-5","fasting-12h-20","fasting-12h-50","fasting-12h-100","fasting-12h-200","fasting-12h-500","fasting-12h-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "fastingCount" },

  // CONSISTENCY
  { key: "workouts",     name: "Total Workouts",   category: "consistency", members: ["workouts-1","workouts-5","workouts-20","workouts-50","workouts-100","workouts-200","workouts-500","workouts-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "totalWorkouts" },
  { key: "streak",       name: "Streak",           category: "consistency", members: ["streak-3","streak-7","streak-14","streak-30","streak-60","streak-90","streak-180","streak-365"], thresholds: [3,7,14,30,60,90,180,365], counterSource: "currentStreak" },
  { key: "early-bird",   name: "Early Bird",       category: "consistency", members: ["early-bird-1","early-bird-5","early-bird-20","early-bird-50","early-bird-100","early-bird-200","early-bird-500","early-bird-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "earlyBirdCount" },

  // SOCIAL
  { key: "posts",        name: "Posts",            category: "social",      members: ["posts-1","posts-5","posts-20","posts-50","posts-100","posts-200","posts-500","posts-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "postCount" },
  { key: "followers",    name: "Followers",        category: "social",      members: ["followers-1","followers-5","followers-20","followers-50","followers-100","followers-200","followers-500","followers-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "followerCount" },
  { key: "likes",        name: "Likes",            category: "social",      members: ["likes-1","likes-5","likes-20","likes-50","likes-100","likes-200","likes-500","likes-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "likesReceived" },
  { key: "comments",     name: "Comments",         category: "social",      members: ["comments-1","comments-5","comments-20","comments-50","comments-100","comments-200","comments-500","comments-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "commentsMade" },

  // ── STRENGTH WEIGHT LADDERS (4 tiers @ weight thresholds) ──────────────
  // Auto-detected from logged exercises with weight recorded.
  { key: "bench",        name: "Bench Press",      category: "strength",    members: ["bench-200","bench-300","bench-400","bench-500"], thresholds: [200,300,400,500], counterSource: "benchMax" },
  { key: "squat",        name: "Squat",            category: "strength",    members: ["squat-200","squat-300","squat-400","squat-500"], thresholds: [200,300,400,500], counterSource: "squatMax" },
  { key: "deadlift",     name: "Deadlift",         category: "strength",    members: ["deadlift-200","deadlift-300","deadlift-400","deadlift-500"], thresholds: [200,300,400,500], counterSource: "deadliftMax" },
  { key: "total",        name: "Total Lift Club",  category: "strength",    members: ["total-800","total-1000","total-1300","total-1500"], thresholds: [800,1000,1300,1500], counterSource: "totalLiftMax" },

  // ── HARD EVENT LADDERS (5 tiers @ 1/3/5/10/20) — manual claim ─────────
  { key: "marathon",       name: "Marathons",       category: "cardio",      members: ["marathon-1","marathon-3","marathon-5","marathon-10","marathon-20"],                                       thresholds: [1,3,5,10,20] },
  { key: "ultra",          name: "Ultras",          category: "cardio",      members: ["ultra-1","ultra-3","ultra-5","ultra-10","ultra-20"],                                                      thresholds: [1,3,5,10,20] },
  { key: "half-marathon",  name: "Half Marathons",  category: "cardio",      members: ["half-marathon-1","half-marathon-3","half-marathon-5","half-marathon-10","half-marathon-20"],              thresholds: [1,3,5,10,20] },
  { key: "5k",            name: "5K Runs",           category: "cardio",      members: ["5k-1","5k-5","5k-20","5k-50","5k-100","5k-200","5k-500","5k-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "fiveKCount" },
  { key: "10k-events",     name: "10K Races",       category: "cardio",      members: ["10k-1","10k-3","10k-5","10k-10","10k-20"],                                                                thresholds: [1,3,5,10,20] },
  { key: "ironman",        name: "Ironman",         category: "cardio",      members: ["ironman-1","ironman-3","ironman-5","ironman-10","ironman-20"],                                            thresholds: [1,3,5,10,20] },
  { key: "triathlon",      name: "Triathlon",       category: "cardio",      members: ["triathlon-1","triathlon-3","triathlon-5","triathlon-10","triathlon-20"],                                  thresholds: [1,3,5,10,20] },
  { key: "century-ride",   name: "Century Rides",   category: "cardio",      members: ["century-ride-1","century-ride-3","century-ride-5","century-ride-10","century-ride-20"],                   thresholds: [1,3,5,10,20] },
  { key: "swim-mile",      name: "Open Water",      category: "cardio",      members: ["swim-mile-1","swim-mile-3","swim-mile-5","swim-mile-10","swim-mile-20"],                                  thresholds: [1,3,5,10,20] },
  { key: "75-hard",        name: "75 Hard",         category: "challenges",  members: ["75-hard-1","75-hard-3","75-hard-5","75-hard-10","75-hard-20"],                                            thresholds: [1,3,5,10,20] },
  { key: "murph",          name: "Murph",           category: "challenges",  members: ["murph-1","murph-3","murph-5","murph-10","murph-20"],                                                      thresholds: [1,3,5,10,20] },
  { key: "spartan",        name: "Spartan Race",    category: "challenges",  members: ["spartan-1","spartan-3","spartan-5","spartan-10","spartan-20"],                                            thresholds: [1,3,5,10,20] },
  { key: "tough-mudder",   name: "Tough Mudder",    category: "challenges",  members: ["tough-mudder-1","tough-mudder-3","tough-mudder-5","tough-mudder-10","tough-mudder-20"],                   thresholds: [1,3,5,10,20] },
  { key: "crossfit-open",  name: "CrossFit Open",   category: "challenges",  members: ["crossfit-open-1","crossfit-open-3","crossfit-open-5","crossfit-open-10","crossfit-open-20"],              thresholds: [1,3,5,10,20] },
  { key: "powerlifter",    name: "Powerlifting Meet", category: "strength",  members: ["powerlifter-1","powerlifter-3","powerlifter-5","powerlifter-10","powerlifter-20"],                        thresholds: [1,3,5,10,20] },

  // ── SINGLE-SHOT CREDENTIALS ────────────────────────────────────────────
  // 1-member families render as `credential` style (holographic, no tier pill).
  { key: "iron-maiden",     name: "Iron Maiden",        category: "strength",    members: ["iron-maiden"] },
  { key: "overhead-bw",     name: "Overhead Master",    category: "strength",    members: ["overhead-bw"] },
  { key: "weighted-pullup", name: "Weighted Pull-Up",   category: "strength",    members: ["weighted-pullup"] },
  { key: "kettlebell-king", name: "Kettlebell King",    category: "strength",    members: ["kettlebell-king"] },
  { key: "6min-mile",       name: "6 Minute Mile",      category: "cardio",      members: ["6min-mile"] },
  { key: "plank-5min",      name: "Plank Legend",       category: "challenges",  members: ["plank-5min"] },
  { key: "burpee-100",      name: "Burpee Beast",       category: "challenges",  members: ["burpee-100"] },
  { key: "pullup-20",       name: "Pull-Up Pro",        category: "challenges",  members: ["pullup-20"] },
  { key: "pushup-100",      name: "100 Push-Ups",       category: "challenges",  members: ["pushup-100"] },
  { key: "iron-will",       name: "Iron Will",          category: "challenges",  members: ["iron-will"] },
  { key: "calorie-goals",   name: "On Target",          category: "nutrition",   members: ["calorie-goals"] },
  { key: "protein-streak",  name: "Protein Streak",     category: "nutrition",   members: ["protein-streak"] },
  { key: "meal-prep",       name: "Meal Prepper",       category: "nutrition",   members: ["meal-prep"] },
  { key: "plant-week",      name: "Plant Week",         category: "nutrition",   members: ["plant-week"] },
  { key: "sugar-free",      name: "Sugar Free",         category: "nutrition",   members: ["sugar-free"] },
  { key: "macro-master",    name: "Macro Master",       category: "nutrition",   members: ["macro-master"] },
  { key: "fasting",         name: "Fasting Pro",        category: "nutrition",   members: ["fasting"] },
  { key: "clean-30",        name: "Clean 30",           category: "nutrition",   members: ["clean-30"] },
  { key: "group-member",    name: "Group Member",       category: "social",      members: ["group-member"] },
  { key: "group-leader",    name: "Group Leader",       category: "social",      members: ["group-leader"] },
  { key: "new-years",       name: "New Year",           category: "special",     members: ["new-years"] },
  { key: "holiday-hustle",  name: "Holiday Hustle",     category: "special",     members: ["holiday-hustle"] },
  // Workout Partner — 8-tier easyLadder driven by partnerWorkouts counter.
  { key: "partner",         name: "Workout Partner",    category: "social",      members: ["partner-1","partner-5","partner-20","partner-50","partner-100","partner-200","partner-500","partner-1000"], thresholds: [1,5,20,50,100,200,500,1000], counterSource: "partnerWorkouts" },
  { key: "outdoor",         name: "Outdoor Adventurer", category: "special",     members: ["outdoor-adventurer"] },
  { key: "competitor",      name: "Competitor",         category: "special",     members: ["sport-competitor"] },
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
  infraredSaunaSessions: "sessions",
  redLightSessions: "sessions",
  massageSessions: "massages",
  floatTankSessions: "sessions",
  mobilitySessions: "sessions",
  journalingSessions: "entries",
  sunlightSessions: "sessions",
  breathworkSessions: "sessions",
  walks: "walks",
  stretchingSessions: "sessions",
  totalWellness: "activities",
  nutritionLogs: "logs",
  fastingCount: "fasts",
  postCount: "posts",
  followerCount: "followers",
  // New ladders added in Apr 2026 rewrite
  bikingSessions: "rides",
  swimmingSessions: "swims",
  rowingSessions: "sessions",
  hiitSessions: "sessions",
  pilatesSessions: "sessions",
  boxingSessions: "rounds",
  sportsSessions: "games",
  likesReceived: "likes",
  commentsMade: "comments",
  earlyBirdCount: "pre-7am",
  fiveKCount: "5Ks",
  // Workout Partner ladder — counts workouts where tagged_user_ids has length>=1
  partnerWorkouts: "partner workouts",
  // Strength weight-based (uses different units)
  benchMax: "lbs",
  squatMax: "lbs",
  deadliftMax: "lbs",
  totalLiftMax: "lbs total",
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

    // Single-member family → render as credential (no "1/1" tier pill).
    // Skip if it's already a CREDENTIAL_BADGE_IDS entry — already handled above.
    if (family.members.length === 1) {
      const onlyId = family.members[0];
      if (CREDENTIAL_BADGE_IDS.has(onlyId) || consumedIds.has(onlyId)) continue;
      const badge = BADGES.find((b) => b.id === onlyId);
      if (!badge) continue;
      result.push({
        key: family.key,
        renderType: "credential",
        emoji: badge.emoji,
        label: badge.label,
        desc: badge.desc,
        category: family.category,
      });
      consumedIds.add(onlyId);
      continue;
    }

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

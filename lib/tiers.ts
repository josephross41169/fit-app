// ─────────────────────────────────────────────────────────────────────────────
// LEVEL SYSTEM v2 — 6 levels
// Levels 1-2: pure XP (no challenges)
// Levels 3-6: XP threshold + ALL challenges complete
// XP RESETS to 0 on level up — does not carry over
//
// XP earned per category per day, capped at 3 XP per category, max 5
// categories = 15 XP/day. Categories: workout, cardio, nutrition, wellness,
// feed_post.
// ─────────────────────────────────────────────────────────────────────────────

export type Level = 1 | 2 | 3 | 4 | 5 | 6;

// XP needed to advance FROM this level to the next.
// L6 is the cap — no L7 yet.
export const XP_FOR_NEXT: Record<Level, number | null> = {
  1: 36,
  2: 60,
  3: 90,
  4: 120,
  5: 150,
  6: null, // max
};

// XP categories (one award per category per day)
export const XP_CATEGORIES = [
  { key: "workout",   label: "Workout",        xp: 3, icon: "💪" },
  { key: "cardio",    label: "Run / Cardio",   xp: 3, icon: "🏃" },
  { key: "nutrition", label: "Nutrition",      xp: 3, icon: "🥗" },
  { key: "wellness",  label: "Wellness",       xp: 3, icon: "🌿" },
  { key: "feed_post", label: "Post to Feed",   xp: 3, icon: "📸" },
] as const;
export type XpCategory = typeof XP_CATEGORIES[number]["key"];

// ── Counter data the app reads from users table ──────────────────────────────
export interface CounterData {
  xpInLevel:           number;
  currentLevel:        Level;
  workoutsCount:       number;
  wellnessCount:       number;
  nutritionCount:      number;
  yogaCount:           number;
  swimCount:           number;
  sportsCount:         number;
  feedPostsCount:      number;
  rivalWinsCount:      number;
  groupsJoinedCount:   number;
  eventsRsvpCount:     number;
  badgesEarnedCount:   number;
  groupWarsParticipated:       number;
  groupChallengesParticipated: number;
  followingCount:      number;
  // Dynamic / computed (still passed in — usually computed on profile load)
  workoutStreak:       number; // longest consecutive day workout streak
  nutritionStreak:     number; // longest consecutive day nutrition streak
}

// ── Challenge definition ─────────────────────────────────────────────────────
export interface Challenge {
  key: string;
  label: string;
  icon: string;
  description: string;
  // current / required count for live progress (used to render "3 / 5")
  progress: (d: CounterData) => { have: number; need: number };
}

const c = (
  key: string, icon: string, label: string, description: string,
  progress: Challenge["progress"],
): Challenge => ({ key, icon, label, description, progress });

// Helpers for cleaner table below
const at = (have: number, need: number) => ({ have: Math.min(have, need), need });

export const LEVEL_CHALLENGES: Record<3 | 4 | 5 | 6, Challenge[]> = {
  3: [
    c("follow_5",     "➕", "Follow 5 People",            "Follow 5 other users on the app",
      d => at(d.followingCount, 5)),
    c("rsvp_event_1", "🎟️", "RSVP for 1 Event",           "RSVP to any community event",
      d => at(d.eventsRsvpCount, 1)),
    c("photos_5",     "📸", "Post 5 Photos to Feed",     "Share 5 photos on your activity feed",
      d => at(d.feedPostsCount, 5)),
    c("workout_4day_streak", "💪", "Log a Workout 4 Days in a Row", "Workout 4 consecutive days",
      d => at(d.workoutStreak, 4)),
    c("nutrition_7",  "🥗", "Log Nutrition 7 Days in a Row", "7-day nutrition streak",
      d => at(d.nutritionStreak, 7)),
    c("wellness_4_in_7", "🌿", "Log 4 Wellness Activities in 7 Days", "Cumulative — 4 wellness logs in any 7-day window",
      d => at(d.wellnessCount, 4)),
    c("rival_win_1",  "🥊", "Win 1 Rivalry",              "Win a head-to-head rivalry",
      d => at(d.rivalWinsCount, 1)),
    c("join_group_1", "👥", "Join a Group",               "Become a member of any group",
      d => at(d.groupsJoinedCount, 1)),
  ],
  4: [
    c("follow_30",        "➕", "Follow 30 People",       "Follow 30 users",
      d => at(d.followingCount, 30)),
    c("nutrition_14",     "🥗", "Log Nutrition 14 Days in a Row", "14-day nutrition streak",
      d => at(d.nutritionStreak, 14)),
    c("rival_wins_3",     "🥊", "Win 3 Rivalries",        "Win 3 rivalries total",
      d => at(d.rivalWinsCount, 3)),
    c("wellness_25",      "🌿", "Log 25 Wellness Activities", "25 wellness logs total",
      d => at(d.wellnessCount, 25)),
    c("workouts_25",      "💪", "Log 25 Workouts",        "25 workouts total",
      d => at(d.workoutsCount, 25)),
    c("group_challenges_3", "🏆", "Participate in 3 Group Challenges", "Participate in 3 group challenges",
      d => at(d.groupChallengesParticipated, 3)),
  ],
  5: [
    c("follow_50",   "➕", "Follow 50 People",            "Follow 50 users",
      d => at(d.followingCount, 50)),
    c("rival_wins_7", "🥊", "Win 7 Rivalries",            "Win 7 rivalries total",
      d => at(d.rivalWinsCount, 7)),
    c("badges_20",   "🏅", "Earn 20 Badges",              "Collect 20 badges across all categories",
      d => at(d.badgesEarnedCount, 20)),
    c("rsvp_8",      "🎟️", "RSVP for 8 Events",           "RSVP to 8 events",
      d => at(d.eventsRsvpCount, 8)),
    c("group_wars_5", "⚔️", "Participate in 5 Group Wars", "Take part in 5 group wars",
      d => at(d.groupWarsParticipated, 5)),
    c("swim_5",      "🏊", "Log 5 Swims",                 "5 swim sessions",
      d => at(d.swimCount, 5)),
    c("yoga_1",      "🧘", "Log 1 Yoga Session",          "Any yoga session",
      d => at(d.yogaCount, 1)),
    c("sports_1",    "⚽", "Log 1 Sports Session",        "Any sports session",
      d => at(d.sportsCount, 1)),
  ],
  6: [
    c("rival_wins_10",     "🥊", "Win 10 Rivalries",          "Win 10 rivalries total",
      d => at(d.rivalWinsCount, 10)),
    c("groups_3",          "👥", "Join 3 Groups",              "Be a member of 3 groups",
      d => at(d.groupsJoinedCount, 3)),
    c("rsvp_20",           "🎟️", "RSVP for 20 Events",         "RSVP to 20 events",
      d => at(d.eventsRsvpCount, 20)),
    c("workout_5day_streak","💪", "Log Workouts 5 Days in a Row","5 consecutive workout days",
      d => at(d.workoutStreak, 5)),
    c("nutrition_30",      "🥗", "Log Nutrition 30 Days in a Row","30-day nutrition streak",
      d => at(d.nutritionStreak, 30)),
    c("sports_3",          "⚽", "Log 3 Sports Sessions",      "3 sports sessions",
      d => at(d.sportsCount, 3)),
    c("yoga_3",            "🧘", "Log 3 Yoga Sessions",        "3 yoga sessions",
      d => at(d.yogaCount, 3)),
    c("group_wars_10",     "⚔️", "Participate in 10 Group Wars","10 group wars",
      d => at(d.groupWarsParticipated, 10)),
    c("group_challenges_20","🏆", "Participate in 20 Group Challenges","20 group challenges",
      d => at(d.groupChallengesParticipated, 20)),
    c("photos_10",         "📸", "Post 10 Photos to Feed",     "10 main feed photos",
      d => at(d.feedPostsCount, 10)),
  ],
};

// ── Compute the actual current level from counter data ───────────────────────
// In v2, current_level lives in the database (users.current_level).
// This function computes "what level SHOULD this user be at" from counters,
// for use in syncing / level-up logic. Normally the DB value is the source.
export function computeLevelFromCounters(d: CounterData): Level {
  // Walk up from db's current_level. If they meet next-level requirements, advance.
  let lvl: Level = d.currentLevel;
  while (lvl < 6) {
    const xpNeeded = XP_FOR_NEXT[lvl];
    if (xpNeeded === null) break;
    const xpReady = d.xpInLevel >= xpNeeded;
    const challengesDone = lvl < 3
      ? true // L1→2 and L2→3 are pure XP
      : LEVEL_CHALLENGES[(lvl) as 3 | 4 | 5].every(ch => {
          const p = ch.progress(d);
          return p.have >= p.need;
        });
    if (xpReady && challengesDone) {
      lvl = (lvl + 1) as Level;
      // Note: this client-side function does not reset xpInLevel; the server's
      // level_up RPC handles that. This is just a "ready to advance?" check.
      break;
    } else {
      break;
    }
  }
  return lvl;
}

// ── Progress info for UI ─────────────────────────────────────────────────────
export interface LevelProgressInfo {
  level: Level;
  xpInLevel: number;
  xpNeeded: number | null;          // null = max level
  xpPercent: number;                // 0–100
  isMaxLevel: boolean;
  // Challenges only present for levels 3+
  challenges: Array<Challenge & { have: number; need: number; complete: boolean }>;
  challengesComplete: number;
  challengesTotal: number;
  // True if user has met BOTH XP and challenges and is ready to level up
  readyToLevelUp: boolean;
}

export function getLevelProgress(d: CounterData): LevelProgressInfo {
  const level = d.currentLevel;
  const xpNeeded = XP_FOR_NEXT[level];
  const isMax = xpNeeded === null;
  const xpPercent = xpNeeded ? Math.min(100, Math.round((d.xpInLevel / xpNeeded) * 100)) : 100;

  // Challenges live on the level you're working TOWARD if it's 3+.
  // Working toward L3 from L2? You see L3's challenges.
  // Working toward L7 doesn't exist (capped at 6).
  const nextLevel = level + 1;
  const showChallenges = nextLevel >= 3 && nextLevel <= 6;
  const rawChallenges = showChallenges
    ? LEVEL_CHALLENGES[(nextLevel) as 3 | 4 | 5 | 6]
    : [];
  const challenges = rawChallenges.map(ch => {
    const { have, need } = ch.progress(d);
    return { ...ch, have, need, complete: have >= need };
  });
  const challengesComplete = challenges.filter(ch => ch.complete).length;
  const challengesTotal = challenges.length;

  const xpReady = isMax ? false : d.xpInLevel >= (xpNeeded as number);
  const challengesReady = showChallenges ? challengesComplete === challengesTotal : true;
  const readyToLevelUp = !isMax && xpReady && challengesReady;

  return {
    level, xpInLevel: d.xpInLevel, xpNeeded,
    xpPercent, isMaxLevel: isMax,
    challenges, challengesComplete, challengesTotal,
    readyToLevelUp,
  };
}

// ── Visuals ──────────────────────────────────────────────────────────────────
// Level color theme — ascending precious materials.
// L1 Locked (grey) → L2 Bronze → L3 Silver → L4 Gold → L5 Emerald → L6 Diamond.
// Each level has: border (ring color), glow (box-shadow halo), badge (pill bg),
// badgeText (pill text), accent (primary level color), label (display name).
// These colors are wired to LEVEL_REWARDS in profile/page.tsx for cosmetic effects.
export const LEVEL_COLORS: Record<Level, {
  border: string; glow: string; badge: string; badgeText: string; accent: string; label: string;
}> = {
  1: { border: "#2D2D2D", glow: "transparent",            badge: "#1A1A1A", badgeText: "#6B7280", accent: "#6B7280", label: "Level 1"          },
  2: { border: "#CD7F32", glow: "rgba(205,127,50,0.35)",  badge: "#3A2410", badgeText: "#E8A87C", accent: "#CD7F32", label: "Level 2 — Bronze" },
  3: { border: "#C0C0C0", glow: "rgba(220,220,235,0.45)", badge: "#1F2128", badgeText: "#E8E8F0", accent: "#C0C0C0", label: "Level 3 — Silver" },
  4: { border: "#FFD700", glow: "rgba(255,215,0,0.5)",    badge: "#3D2A00", badgeText: "#FCD34D", accent: "#FFD700", label: "Level 4 — Gold"   },
  5: { border: "#10B981", glow: "rgba(16,185,129,0.55)",  badge: "#022C22", badgeText: "#6EE7B7", accent: "#10B981", label: "Level 5 — Emerald"},
  6: { border: "#67E8F9", glow: "rgba(186,230,253,0.65)", badge: "#0A1628", badgeText: "#BAE6FD", accent: "#67E8F9", label: "Level 6 — Diamond"},
};

// ── Backwards compatibility shims ────────────────────────────────────────────
// Old code may still import these. Map old names to new system so nothing breaks
// at compile time. These are NO LONGER USED for level computation.
export type OldTier = "default" | "active" | "grinder" | "elite" | "untouchable";
export type Tier = OldTier;

/** @deprecated kept for old imports; returns Level 1 always */
export function computeTier(logsLast28: number, longestStreak: number): OldTier {
  if (logsLast28 >= 24 || longestStreak >= 21) return "untouchable";
  if (logsLast28 >= 16 || longestStreak >= 14) return "elite";
  if (logsLast28 >= 8 || longestStreak >= 7) return "grinder";
  if (logsLast28 >= 3 || longestStreak >= 3) return "active";
  return "default";
}

/** @deprecated kept for old imports — returns minimal shape */
export function getTierInfo(_a: number, _b: number) {
  const computedTier = computeTier(_a, _b);
  if (computedTier !== "default") return { tier: computedTier, ...TIER_INFO[computedTier] };
  return {
    tier: "default" as OldTier,
    label: "Level 1",
    icon: "🩶",
    title: "Level 1",
    description: "",
    nextTier: "active" as OldTier | null,
    nextDescription: null,
    progress: 0,
  };
}

export const TIER_INFO: Record<OldTier, {
  icon: string;
  label: string;
  title: string;
  description: string;
  nextTier: OldTier | null;
  nextDescription: string | null;
  progress: number;
}> = {
  default: { icon: "", label: "Level 1", title: "Level 1", description: "", nextTier: "active", nextDescription: "Log 3 activities in 28 days", progress: 0 },
  active: { icon: "L2", label: "Level 2", title: "Level 2", description: "Building consistency", nextTier: "grinder", nextDescription: "Log 8 activities in 28 days", progress: 25 },
  grinder: { icon: "L3", label: "Level 3", title: "Level 3", description: "Showing up often", nextTier: "elite", nextDescription: "Log 16 activities in 28 days", progress: 50 },
  elite: { icon: "L4", label: "Level 4", title: "Level 4", description: "High-output training", nextTier: "untouchable", nextDescription: "Log 24 activities in 28 days", progress: 75 },
  untouchable: { icon: "L5", label: "Level 5", title: "Level 5", description: "Top-tier consistency", nextTier: null, nextDescription: null, progress: 100 },
};

export const TIER_COLORS = {
  ...LEVEL_COLORS,
  default: LEVEL_COLORS[1],
  active: LEVEL_COLORS[2],
  grinder: LEVEL_COLORS[3],
  elite: LEVEL_COLORS[4],
  untouchable: LEVEL_COLORS[5],
} as Record<Level | OldTier, typeof LEVEL_COLORS[Level]>;

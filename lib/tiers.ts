// ─────────────────────────────────────────────────────────────────────────────
// TIER / LEVEL SYSTEM
// Levels 1-2: XP based (3 XP per category per day, max ~15/day)
// Level 3+:   Task gates (specific challenges must be completed)
// ─────────────────────────────────────────────────────────────────────────────

export type Tier = "1" | "2" | "3" | "4" | "5";

// ── XP thresholds (cumulative) ────────────────────────────────────────────────
export const XP_THRESHOLDS: Record<Tier, number> = {
  "1": 0,
  "2": 30,
  "3": 90,   // XP gate cleared — but also needs task gate below
  "4": 90,   // same XP floor, task gate is the real bar
  "5": 90,
};

// ── XP categories (one award per category per day) ───────────────────────────
export const XP_CATEGORIES = [
  { key: "workout",   label: "Workout",        xp: 3, icon: "💪" },
  { key: "cardio",    label: "Run / Cardio",   xp: 3, icon: "🏃" },
  { key: "nutrition", label: "Nutrition",      xp: 3, icon: "🥗" },
  { key: "wellness",  label: "Wellness",       xp: 3, icon: "🌿" },
  { key: "feed_post", label: "Post to Feed",   xp: 3, icon: "📸" },
] as const;
export type XpCategory = typeof XP_CATEGORIES[number]["key"];

// ── Task gates ────────────────────────────────────────────────────────────────
export interface TierTask {
  key: string;
  label: string;
  icon: string;
  description: string;
  // How to check completion — evaluated client-side from user data
  check: (data: TierCheckData) => boolean;
}

export interface TierCheckData {
  xp: number;
  rivalWins: number;
  followingCount: number;
  inGroup: boolean;
  nutritionStreak: number;        // consecutive days logged
  workoutsThisWeek: number;
  yogaSessions: number;
  meditationSessions: number;
  photosPosted: number;
  challengeTop3: number;          // times finished top 3 in a group challenge
  workoutsLast14Days: number;
  nutritionStreak14: number;
}

export const TIER_TASKS: Record<"3" | "4", TierTask[]> = {
  "3": [
    {
      key: "rival_wins_2",
      label: "Win 2 Rivalries",
      icon: "🥊",
      description: "Win 2 head-to-head rivalries",
      check: (d) => d.rivalWins >= 2,
    },
    {
      key: "join_group",
      label: "Join a Group",
      icon: "👥",
      description: "Become a member of any group",
      check: (d) => d.inGroup,
    },
    {
      key: "follow_5",
      label: "Follow 5 People",
      icon: "➕",
      description: "Follow at least 5 people on the app",
      check: (d) => d.followingCount >= 5,
    },
    {
      key: "nutrition_7",
      label: "Log Nutrition 7 Days in a Row",
      icon: "🥗",
      description: "Log a meal every day for 7 consecutive days",
      check: (d) => d.nutritionStreak >= 7,
    },
    {
      key: "workouts_week_4",
      label: "4 Workouts in One Week",
      icon: "💪",
      description: "Log 4 workouts or runs in a single week",
      check: (d) => d.workoutsThisWeek >= 4,
    },
  ],
  "4": [
    {
      key: "rival_wins_5",
      label: "Win 5 Rivalries",
      icon: "🥊",
      description: "Win 5 head-to-head rivalries total",
      check: (d) => d.rivalWins >= 5,
    },
    {
      key: "yoga_session",
      label: "Log a Yoga Session",
      icon: "🧘",
      description: "Log at least one yoga wellness session",
      check: (d) => d.yogaSessions >= 1,
    },
    {
      key: "photos_3",
      label: "Post 3 Photos to Feed",
      icon: "📸",
      description: "Share 3 photos on your activity feed",
      check: (d) => d.photosPosted >= 3,
    },
    {
      key: "challenge_top3",
      label: "Top 3 in a Group Challenge × 3",
      icon: "🏆",
      description: "Finish in the top 3 contributors in a group challenge 3 times",
      check: (d) => d.challengeTop3 >= 3,
    },
    {
      key: "meditation_3",
      label: "Log 3 Meditation Sessions",
      icon: "🧠",
      description: "Log 3 meditation wellness sessions",
      check: (d) => d.meditationSessions >= 3,
    },
    {
      key: "nutrition_14",
      label: "Log Nutrition 14 Days in a Row",
      icon: "🥗",
      description: "Log a meal every day for 14 consecutive days",
      check: (d) => d.nutritionStreak14 >= 14,
    },
    {
      key: "workouts_14days_8",
      label: "8 Workouts in 14 Days",
      icon: "💪",
      description: "Log 8 workouts or runs within any 14-day window",
      check: (d) => d.workoutsLast14Days >= 8,
    },
  ],
};

// ── Level info ────────────────────────────────────────────────────────────────
export interface LevelInfo {
  level: number;
  xpRequired: number;       // total XP to reach this level
  xpForNext: number | null; // XP needed to reach next (null = task gated)
  gateType: "xp" | "tasks" | "max";
  tasksRequired: TierTask[] | null;
}

export const LEVEL_INFO: Record<number, LevelInfo> = {
  1: { level: 1, xpRequired: 0,  xpForNext: 30,  gateType: "xp",   tasksRequired: null },
  2: { level: 2, xpRequired: 30, xpForNext: 60,  gateType: "xp",   tasksRequired: null },
  3: { level: 3, xpRequired: 90, xpForNext: null, gateType: "tasks", tasksRequired: TIER_TASKS["3"] },
  4: { level: 4, xpRequired: 90, xpForNext: null, gateType: "tasks", tasksRequired: TIER_TASKS["4"] },
  5: { level: 5, xpRequired: 90, xpForNext: null, gateType: "max",   tasksRequired: null },
};

// ── Compute level from XP + task completion ───────────────────────────────────
export function computeLevel(data: TierCheckData): number {
  const { xp } = data;

  // XP gates for levels 1 → 2 → 3 threshold
  if (xp < 30) return 1;
  if (xp < 90) return 2;

  // Level 3 requires XP ≥ 90 + all Tier 3 tasks
  const tier3Done = TIER_TASKS["3"].every(t => t.check(data));
  if (!tier3Done) return 2; // XP hit but tasks not done — stuck at 2, working toward 3

  // Level 4 requires all Tier 4 tasks
  const tier4Done = TIER_TASKS["4"].every(t => t.check(data));
  if (!tier4Done) return 3;

  return 4; // Level 5 TBD
}

// ── Progress toward next level ────────────────────────────────────────────────
export interface ProgressInfo {
  level: number;
  xp: number;
  gateType: "xp" | "tasks" | "max";
  // XP progress
  xpTowardNext: number;
  xpNeededForNext: number | null;
  xpPercent: number;
  // Task progress (for levels 3+)
  tasks: Array<TierTask & { completed: boolean }> | null;
  tasksCompleted: number;
  tasksTotal: number;
}

export function getProgressInfo(data: TierCheckData): ProgressInfo {
  const level = computeLevel(data);
  const { xp } = data;

  if (level === 1) {
    return {
      level, xp, gateType: "xp",
      xpTowardNext: xp,
      xpNeededForNext: 30,
      xpPercent: Math.min(100, Math.round((xp / 30) * 100)),
      tasks: null, tasksCompleted: 0, tasksTotal: 0,
    };
  }

  if (level === 2) {
    // Could be: XP < 90 (still grinding XP) or XP ≥ 90 but tasks not done
    if (xp < 90) {
      const toward = xp - 30;
      return {
        level, xp, gateType: "xp",
        xpTowardNext: toward,
        xpNeededForNext: 60,
        xpPercent: Math.min(100, Math.round((toward / 60) * 100)),
        tasks: null, tasksCompleted: 0, tasksTotal: 0,
      };
    }
    // XP done, now need tasks
    const tasks = TIER_TASKS["3"].map(t => ({ ...t, completed: t.check(data) }));
    const done = tasks.filter(t => t.completed).length;
    return {
      level, xp, gateType: "tasks",
      xpTowardNext: xp, xpNeededForNext: null, xpPercent: 100,
      tasks, tasksCompleted: done, tasksTotal: tasks.length,
    };
  }

  if (level === 3) {
    const tasks = TIER_TASKS["4"].map(t => ({ ...t, completed: t.check(data) }));
    const done = tasks.filter(t => t.completed).length;
    return {
      level, xp, gateType: "tasks",
      xpTowardNext: xp, xpNeededForNext: null, xpPercent: 100,
      tasks, tasksCompleted: done, tasksTotal: tasks.length,
    };
  }

  return {
    level, xp, gateType: "max",
    xpTowardNext: xp, xpNeededForNext: null, xpPercent: 100,
    tasks: null, tasksCompleted: 0, tasksTotal: 0,
  };
}

// ── Visual config per level ───────────────────────────────────────────────────
export const LEVEL_COLORS: Record<number, {
  border: string; glow: string; badge: string; badgeText: string; accent: string; label: string;
}> = {
  1: { border: "#2D2D2D", glow: "transparent",          badge: "#1A1A1A", badgeText: "#6B7280", accent: "#6B7280",  label: "Level 1" },
  2: { border: "#7C3AED", glow: "rgba(124,58,237,0.3)", badge: "#2D1B69", badgeText: "#A78BFA", accent: "#7C3AED",  label: "Level 2" },
  3: { border: "#F59E0B", glow: "rgba(245,158,11,0.35)",badge: "#3D2200", badgeText: "#FCD34D", accent: "#F59E0B",  label: "Level 3" },
  4: { border: "#38BDF8", glow: "rgba(56,189,248,0.4)", badge: "#0A1628", badgeText: "#7DD3FC", accent: "#38BDF8",  label: "Level 4" },
  5: { border: "#E879F9", glow: "rgba(232,121,249,0.5)",badge: "#1A0035", badgeText: "#F0ABFC", accent: "#E879F9",  label: "Level 5" },
};

// Keep Tier type alias for backwards compat with any old imports
export type { Tier as TierLegacy };
export const TIER_COLORS = LEVEL_COLORS; // alias

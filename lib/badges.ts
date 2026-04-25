// ── Centralized badge definitions ─────────────────────────────────────────────
// Single source of truth used by profile, public profile, and the badge engine.
//
// ## DESIGN MODEL (Apr 2026 rewrite)
//
// Badges fall into FOUR buckets:
//
//   1. EASY COUNTER LADDER — 8 tiers @ thresholds 1/5/20/50/100/200/500/1000
//      Auto-awarded based on activity counts (workouts, runs, lifts, yoga,
//      sauna, posts, followers, etc). User just posts and badges level up.
//
//   2. STRENGTH LADDER — 4 tiers @ specific weight thresholds
//      Bench/Squat/Deadlift = 200/300/400/500 lbs
//      Total Lift = 800/1000/1300/1500 lbs
//      Auto-detected from logged exercises if weight is recorded; otherwise
//      manually claimable.
//
//   3. HARD EVENT LADDER — 5 tiers @ thresholds 1/3/5/10/20
//      Manual claim only (marathon, ironman, spartan, etc.). Each claim
//      bumps your tier in the family.
//
//   4. SINGLE-SHOT CREDENTIAL — 1 tier, no progression
//      One-and-done achievements (Veteran, Coach, Iron Will, etc.).
//      Manual claim; never tiers up.
//
// ## NAMING
//
// Easy ladder badge IDs follow `<thing>-<threshold>` pattern, e.g.
// `runs-5`, `runs-20`, ... `runs-1000`. The first tier uses threshold 1,
// e.g. `runs-1` (the user's first run). NO MORE "first-X" naming — this
// caused duplicate display rows. Tier 1 IS the "first" badge.
//
// Hard event IDs: `marathon-1`, `marathon-3`, `marathon-5`, `marathon-10`,
// `marathon-20`.
//
// Strength IDs: `bench-200`, `bench-300`, `bench-400`, `bench-500`, etc.

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  category: string;
}

// ── Helper to generate a standard 8-tier easy ladder ──────────────────────
function easyLadder(opts: {
  prefix: string;
  emoji: string;
  noun: string;
  nounPlural: string;
  category: string;
  tierNames: [string, string, string, string, string, string, string, string];
}): Badge[] {
  const thresholds = [1, 5, 20, 50, 100, 200, 500, 1000];
  return thresholds.map((t, i) => ({
    id: `${opts.prefix}-${t}`,
    emoji: opts.emoji,
    label: opts.tierNames[i],
    desc: t === 1 ? `Logged your first ${opts.noun}` : `Logged ${t} ${opts.nounPlural}`,
    category: opts.category,
  }));
}

// Hard event ladder — 5 tiers @ 1/3/5/10/20
function hardLadder(opts: {
  prefix: string;
  category: string;
  tiers: { threshold: 1|3|5|10|20; emoji: string; label: string; desc: string }[];
}): Badge[] {
  return opts.tiers.map(t => ({
    id: `${opts.prefix}-${t.threshold}`,
    emoji: t.emoji,
    label: t.label,
    desc: t.desc,
    category: opts.category,
  }));
}

// ── BADGE CATALOG ─────────────────────────────────────────────────────────
export const BADGES: Badge[] = [

  // ════════════════════════════════════════════════════════════════════════
  //  EASY COUNTER LADDERS (8 tiers, auto-awarded from posts)
  // ════════════════════════════════════════════════════════════════════════

  ...easyLadder({ prefix: "workouts", emoji: "🎉", noun: "workout", nounPlural: "workouts", category: "consistency",
    tierNames: ["First Workout", "Workout Starter", "Workout Regular", "50 Strong", "Centurion", "200 Titan", "500 Legend", "1000 Immortal"] }),

  ...easyLadder({ prefix: "runs", emoji: "👟", noun: "run", nounPlural: "runs", category: "cardio",
    tierNames: ["First Run", "Pavement Starter", "Pavement Regular", "Pavement Hunter", "100 Run Club", "200 Run Society", "500 Run Immortal", "1000 Run Legend"] }),

  ...easyLadder({ prefix: "lifts", emoji: "🏋️", noun: "lift", nounPlural: "lifts", category: "strength",
    tierNames: ["First Lift", "Iron Starter", "Iron Regular", "Iron Devotee", "Iron Veteran", "Iron Dynasty", "Iron Immortal", "Iron God"] }),

  ...easyLadder({ prefix: "yoga", emoji: "🧘", noun: "yoga session", nounPlural: "yoga sessions", category: "wellness",
    tierNames: ["First Yoga", "Yoga Starter", "Yoga Regular", "Yoga Dedicated", "Yoga Lover", "Yoga Devotee", "Yoga Master", "Yoga Immortal"] }),

  ...easyLadder({ prefix: "walks", emoji: "🚶", noun: "walk", nounPlural: "walks", category: "cardio",
    tierNames: ["First Walk", "Walk Starter", "Walk Regular", "Mile Hunter", "Path Devotee", "Trail Master", "Walk Legend", "Walk Immortal"] }),

  ...easyLadder({ prefix: "biking", emoji: "🚴", noun: "ride", nounPlural: "rides", category: "cardio",
    tierNames: ["First Ride", "Pedal Starter", "Pedal Regular", "Saddle Veteran", "Pedal Devotee", "Wheel Master", "Cyclist Legend", "Cyclist Immortal"] }),

  ...easyLadder({ prefix: "swimming", emoji: "🏊", noun: "swim", nounPlural: "swims", category: "cardio",
    tierNames: ["First Swim", "Pool Starter", "Pool Regular", "Lap Hunter", "Pool Devotee", "Stroke Master", "Aqua Legend", "Aqua Immortal"] }),

  ...easyLadder({ prefix: "rowing", emoji: "🚣", noun: "row session", nounPlural: "row sessions", category: "cardio",
    tierNames: ["First Row", "Row Starter", "Row Regular", "Stroke Hunter", "Row Devotee", "Row Master", "Row Legend", "Row Immortal"] }),

  ...easyLadder({ prefix: "hiit", emoji: "🔥", noun: "HIIT session", nounPlural: "HIIT sessions", category: "cardio",
    tierNames: ["First HIIT", "HIIT Starter", "HIIT Regular", "HIIT Hunter", "HIIT Devotee", "Burn Master", "HIIT Legend", "HIIT Immortal"] }),

  ...easyLadder({ prefix: "pilates", emoji: "🤸", noun: "pilates session", nounPlural: "pilates sessions", category: "wellness",
    tierNames: ["First Pilates", "Pilates Starter", "Pilates Regular", "Core Hunter", "Pilates Devotee", "Core Master", "Pilates Legend", "Pilates Immortal"] }),

  ...easyLadder({ prefix: "boxing", emoji: "🥊", noun: "boxing session", nounPlural: "boxing sessions", category: "cardio",
    tierNames: ["First Round", "Boxing Starter", "Boxing Regular", "Combo Hunter", "Boxing Devotee", "Glove Master", "Boxing Legend", "Boxing Immortal"] }),

  ...easyLadder({ prefix: "sports", emoji: "🏀", noun: "sports session", nounPlural: "sports sessions", category: "cardio",
    tierNames: ["First Game", "Sports Starter", "Sports Regular", "Game Hunter", "Sports Devotee", "Game Master", "Sports Legend", "Sports Immortal"] }),

  ...easyLadder({ prefix: "sauna", emoji: "🔆", noun: "sauna session", nounPlural: "sauna sessions", category: "wellness",
    tierNames: ["First Sauna", "Sauna Starter", "Sauna Regular", "Sauna Dedicated", "Sauna Devotee", "Heat Veteran", "Heat Master", "Sauna Immortal"] }),

  ...easyLadder({ prefix: "cold-plunge", emoji: "🧊", noun: "cold plunge", nounPlural: "cold plunges", category: "wellness",
    tierNames: ["First Plunge", "Cold Starter", "Cold Regular", "Ice Warrior", "Ice Veteran", "Ice Devotee", "Ice Master", "Ice Immortal"] }),

  ...easyLadder({ prefix: "meditation", emoji: "🕊️", noun: "meditation", nounPlural: "meditations", category: "wellness",
    tierNames: ["First Meditation", "Mindful Starter", "Mindful Regular", "Mindful Devotee", "Mindful Master", "Zen Veteran", "Zen Legend", "Enlightened"] }),

  ...easyLadder({ prefix: "breathwork", emoji: "🫁", noun: "breathwork session", nounPlural: "breathwork sessions", category: "wellness",
    tierNames: ["First Breath", "Breath Starter", "Breath Regular", "Breath Dedicated", "Breath Devotee", "Breath Master", "Breath Legend", "Breath Immortal"] }),

  ...easyLadder({ prefix: "stretching", emoji: "🤸", noun: "stretch session", nounPlural: "stretch sessions", category: "wellness",
    tierNames: ["First Stretch", "Stretch Starter", "Stretch Regular", "Flexibility Pro", "Stretch Devotee", "Mobility Master", "Stretch Legend", "Stretch Immortal"] }),

  // ── Recovery & therapy modalities ────────────────────────────────────────
  ...easyLadder({ prefix: "infrared-sauna", emoji: "♨️", noun: "infrared sauna session", nounPlural: "infrared sauna sessions", category: "wellness",
    tierNames: ["First Infrared", "Infrared Starter", "Infrared Regular", "Deep Heat Pro", "Infrared Devotee", "Infrared Master", "Infrared Legend", "Infrared Immortal"] }),

  ...easyLadder({ prefix: "red-light", emoji: "🔴", noun: "red light therapy session", nounPlural: "red light therapy sessions", category: "wellness",
    tierNames: ["First Red Light", "Photon Starter", "Photon Regular", "Photon Devotee", "Light Bather", "Photon Master", "Red Light Legend", "Red Light Immortal"] }),

  ...easyLadder({ prefix: "massage", emoji: "💆", noun: "massage", nounPlural: "massages", category: "wellness",
    tierNames: ["First Massage", "Massage Starter", "Massage Regular", "Knot Slayer", "Massage Devotee", "Bodywork Master", "Massage Legend", "Massage Immortal"] }),

  ...easyLadder({ prefix: "float-tank", emoji: "🌊", noun: "float tank session", nounPlural: "float tank sessions", category: "wellness",
    tierNames: ["First Float", "Float Starter", "Float Regular", "Sensory Adept", "Float Devotee", "Float Master", "Float Legend", "Float Immortal"] }),

  ...easyLadder({ prefix: "mobility", emoji: "🦵", noun: "mobility session", nounPlural: "mobility sessions", category: "wellness",
    tierNames: ["First Mobility", "Mobility Starter", "Mobility Regular", "Joint Wizard", "Mobility Devotee", "Mobility Master", "Mobility Legend", "Mobility Immortal"] }),

  ...easyLadder({ prefix: "journaling", emoji: "📓", noun: "journal entry", nounPlural: "journal entries", category: "wellness",
    tierNames: ["First Entry", "Journal Starter", "Journal Regular", "Reflection Pro", "Journal Devotee", "Journal Master", "Journal Legend", "Journal Immortal"] }),

  ...easyLadder({ prefix: "sunlight", emoji: "☀️", noun: "sunlight session", nounPlural: "sunlight sessions", category: "wellness",
    tierNames: ["First Sun", "Sun Starter", "Sun Regular", "Vitamin D Pro", "Sun Devotee", "Sun Master", "Sun Legend", "Sun Immortal"] }),
  // ─────────────────────────────────────────────────────────────────────────

  ...easyLadder({ prefix: "wellness", emoji: "🌱", noun: "wellness activity", nounPlural: "wellness activities", category: "wellness",
    tierNames: ["First Wellness", "Wellness Starter", "Wellness Regular", "Wellness Devotee", "Wellness Dedicated", "Wellness Master", "Wellness Legend", "Wellness Immortal"] }),

  ...easyLadder({ prefix: "nutrition", emoji: "🥗", noun: "nutrition log", nounPlural: "nutrition logs", category: "nutrition",
    tierNames: ["First Log", "Log Starter", "Log Regular", "Log Dedicated", "100 Logs", "Nutrition Devotee", "Nutrition Legend", "Nutrition Immortal"] }),

  // Fasting ladder — counts fasts ≥ 12 hours. Hours don't matter beyond
  // the 12h threshold; every qualifying fast = +1 toward the ladder.
  // The existing "fasting" credential (24h fast) stays separate.
  ...easyLadder({ prefix: "fasting-12h", emoji: "⏳", noun: "12+ hour fast", nounPlural: "12+ hour fasts", category: "nutrition",
    tierNames: ["Fasted Faithful", "Hunger Tamed", "Disciplined Soul", "Hollow Warrior", "Empty Vessel", "Monk Mode", "Ascetic", "Eternal Fasted"] }),

  ...easyLadder({ prefix: "posts", emoji: "📸", noun: "post", nounPlural: "posts", category: "social",
    tierNames: ["First Post", "Content Starter", "Content Creator", "Content Hunter", "Content Devotee", "Feed Master", "Content Legend", "Content Immortal"] }),

  ...easyLadder({ prefix: "followers", emoji: "👥", noun: "follower", nounPlural: "followers", category: "social",
    tierNames: ["First Follower", "Rising", "Rising Star", "Influencer", "Big Following", "Star", "Superstar", "Icon"] }),

  ...easyLadder({ prefix: "likes", emoji: "❤️", noun: "like received", nounPlural: "likes received", category: "social",
    tierNames: ["First Like", "Liked", "Crowd Pleaser", "Fan Favorite", "Motivator", "Inspiration", "Idol", "Legend"] }),

  ...easyLadder({ prefix: "comments", emoji: "💬", noun: "comment", nounPlural: "comments", category: "social",
    tierNames: ["First Comment", "Active Voice", "Conversationalist", "Community Voice", "Pillar", "Mentor", "Sage", "Oracle"] }),

  ...easyLadder({ prefix: "early-bird", emoji: "🌅", noun: "pre-7am workout", nounPlural: "pre-7am workouts", category: "consistency",
    tierNames: ["Early Bird", "Dawn Starter", "Dawn Regular", "Dawn Hunter", "Sunrise Master", "Dawn Devotee", "Dawn Legend", "First Light"] }),

  // ── Streak (different thresholds: 3/7/14/30/60/90/180/365) ──
  { id:"streak-3",   emoji:"🔥", label:"3 Day Streak",    desc:"Logged activity 3 days in a row",   category:"consistency" },
  { id:"streak-7",   emoji:"🔥", label:"7 Day Streak",    desc:"Logged activity 7 days in a row",   category:"consistency" },
  { id:"streak-14",  emoji:"🔥", label:"14 Day Streak",   desc:"Logged activity 14 days in a row",  category:"consistency" },
  { id:"streak-30",  emoji:"🔥", label:"30 Day Streak",   desc:"Logged activity 30 days in a row",  category:"consistency" },
  { id:"streak-60",  emoji:"🔥", label:"60 Day Streak",   desc:"Logged activity 60 days in a row",  category:"consistency" },
  { id:"streak-90",  emoji:"🔥", label:"90 Day Grind",    desc:"Logged activity 90 days in a row",  category:"consistency" },
  { id:"streak-180", emoji:"💎", label:"180 Day Beast",   desc:"Logged activity 180 days in a row", category:"consistency" },
  { id:"streak-365", emoji:"🌋", label:"Year Warrior",    desc:"Logged activity 365 days in a row", category:"consistency" },

  // ════════════════════════════════════════════════════════════════════════
  //  STRENGTH LADDERS (4 tiers @ weight thresholds)
  // ════════════════════════════════════════════════════════════════════════

  { id:"bench-200", emoji:"🪨", label:"Bench 200",  desc:"Bench pressed 200 lbs", category:"strength" },
  { id:"bench-300", emoji:"💪", label:"Bench 300",  desc:"Bench pressed 300 lbs", category:"strength" },
  { id:"bench-400", emoji:"🏋️", label:"Bench 400",  desc:"Bench pressed 400 lbs", category:"strength" },
  { id:"bench-500", emoji:"👹", label:"Bench 500",  desc:"Bench pressed 500 lbs", category:"strength" },

  { id:"squat-200", emoji:"🦵", label:"Squat 200",  desc:"Back squatted 200 lbs", category:"strength" },
  { id:"squat-300", emoji:"💪", label:"Squat 300",  desc:"Back squatted 300 lbs", category:"strength" },
  { id:"squat-400", emoji:"🏋️", label:"Squat 400",  desc:"Back squatted 400 lbs", category:"strength" },
  { id:"squat-500", emoji:"👹", label:"Squat 500",  desc:"Back squatted 500 lbs", category:"strength" },

  { id:"deadlift-200", emoji:"⚓", label:"Deadlift 200", desc:"Deadlifted 200 lbs", category:"strength" },
  { id:"deadlift-300", emoji:"💪", label:"Deadlift 300", desc:"Deadlifted 300 lbs", category:"strength" },
  { id:"deadlift-400", emoji:"🏋️", label:"Deadlift 400", desc:"Deadlifted 400 lbs", category:"strength" },
  { id:"deadlift-500", emoji:"👹", label:"Deadlift 500", desc:"Deadlifted 500 lbs", category:"strength" },

  { id:"total-800",  emoji:"🏆", label:"800 lb Club",   desc:"Squat + Bench + Deadlift ≥ 800 lbs",   category:"strength" },
  { id:"total-1000", emoji:"🏆", label:"1,000 lb Club", desc:"Squat + Bench + Deadlift ≥ 1,000 lbs", category:"strength" },
  { id:"total-1300", emoji:"👑", label:"1,300 lb Club", desc:"Squat + Bench + Deadlift ≥ 1,300 lbs", category:"strength" },
  { id:"total-1500", emoji:"🌋", label:"1,500 lb Club", desc:"Squat + Bench + Deadlift ≥ 1,500 lbs", category:"strength" },

  // ════════════════════════════════════════════════════════════════════════
  //  HARD EVENT LADDERS (5 tiers @ 1/3/5/10/20)
  // ════════════════════════════════════════════════════════════════════════

  ...hardLadder({ prefix: "marathon", category: "cardio", tiers: [
    { threshold: 1,  emoji:"🏅", label:"Marathoner",       desc:"Completed your first marathon" },
    { threshold: 3,  emoji:"🔥", label:"Pavement Pounder", desc:"Completed 3 marathons" },
    { threshold: 5,  emoji:"💀", label:"Asphalt Eater",    desc:"Completed 5 marathons" },
    { threshold: 10, emoji:"⚡", label:"Mile Devourer",    desc:"Completed 10 marathons" },
    { threshold: 20, emoji:"👹", label:"Distance Demon",   desc:"Completed 20 marathons" },
  ]}),

  ...hardLadder({ prefix: "ultra", category: "cardio", tiers: [
    { threshold: 1,  emoji:"🌄", label:"Ultra Animal",     desc:"Completed your first ultra (50K+)" },
    { threshold: 3,  emoji:"🩸", label:"Trail Reaper",     desc:"Completed 3 ultras" },
    { threshold: 5,  emoji:"🗡️", label:"Mountain Killer",   desc:"Completed 5 ultras" },
    { threshold: 10, emoji:"🐺", label:"Wild Born",        desc:"Completed 10 ultras" },
    { threshold: 20, emoji:"🌋", label:"Untamed",          desc:"Completed 20 ultras" },
  ]}),

  ...hardLadder({ prefix: "ironman", category: "cardio", tiers: [
    { threshold: 1,  emoji:"🦾", label:"Ironman",         desc:"Completed your first Ironman" },
    { threshold: 3,  emoji:"⚙️", label:"Tri-Forged",       desc:"Completed 3 Ironmans" },
    { threshold: 5,  emoji:"💀", label:"Iron Phantom",    desc:"Completed 5 Ironmans" },
    { threshold: 10, emoji:"⚔️", label:"Iron Shogun",      desc:"Completed 10 Ironmans" },
    { threshold: 20, emoji:"👑", label:"Iron God",        desc:"Completed 20 Ironmans" },
  ]}),

  ...hardLadder({ prefix: "half-marathon", category: "cardio", tiers: [
    { threshold: 1,  emoji:"🏃", label:"Half Slayer",         desc:"Completed your first half marathon" },
    { threshold: 3,  emoji:"🩸", label:"13.1 Killer",         desc:"Completed 3 half marathons" },
    { threshold: 5,  emoji:"💉", label:"Distance Dealer",     desc:"Completed 5 half marathons" },
    { threshold: 10, emoji:"👻", label:"Endurance Wraith",    desc:"Completed 10 half marathons" },
    { threshold: 20, emoji:"⚰️", label:"13.1 Immortal",        desc:"Completed 20 half marathons" },
  ]}),

  ...hardLadder({ prefix: "5k", category: "cardio", tiers: [
    { threshold: 1,  emoji:"🎽", label:"5K Striker",      desc:"Completed your first 5K" },
    { threshold: 3,  emoji:"🔱", label:"Triple Threat",   desc:"Completed 3 5Ks" },
    { threshold: 5,  emoji:"🎯", label:"5K Hunter",       desc:"Completed 5 5Ks" },
    { threshold: 10, emoji:"🪓", label:"5K Reaper",       desc:"Completed 10 5Ks" },
    { threshold: 20, emoji:"👑", label:"5K Apex",         desc:"Completed 20 5Ks" },
  ]}),

  ...hardLadder({ prefix: "10k", category: "cardio", tiers: [
    { threshold: 1,  emoji:"🏁", label:"10K Crusher",          desc:"Completed your first 10K" },
    { threshold: 3,  emoji:"💣", label:"Double Digit Hitman",  desc:"Completed 3 10Ks" },
    { threshold: 5,  emoji:"🐂", label:"10K Beast",            desc:"Completed 5 10Ks" },
    { threshold: 10, emoji:"🦂", label:"10K Tyrant",           desc:"Completed 10 10Ks" },
    { threshold: 20, emoji:"⚔️", label:"10K Conqueror",         desc:"Completed 20 10Ks" },
  ]}),

  ...hardLadder({ prefix: "triathlon", category: "cardio", tiers: [
    { threshold: 1,  emoji:"🏊", label:"Triathlete",              desc:"Completed your first triathlon" },
    { threshold: 3,  emoji:"🌊", label:"Three-Element Killer",    desc:"Completed 3 triathlons" },
    { threshold: 5,  emoji:"⚡", label:"Tri Hunter",              desc:"Completed 5 triathlons" },
    { threshold: 10, emoji:"🔱", label:"Iron Triad",              desc:"Completed 10 triathlons" },
    { threshold: 20, emoji:"👁️", label:"Triathlon Demigod",        desc:"Completed 20 triathlons" },
  ]}),

  ...hardLadder({ prefix: "century-ride", category: "cardio", tiers: [
    { threshold: 1,  emoji:"🚴", label:"Century Rider",      desc:"Completed your first 100-mile ride" },
    { threshold: 3,  emoji:"🌀", label:"Pedal Phantom",      desc:"Completed 3 century rides" },
    { threshold: 5,  emoji:"🦅", label:"Asphalt Hawk",       desc:"Completed 5 century rides" },
    { threshold: 10, emoji:"⚡", label:"Long Haul Killer",   desc:"Completed 10 century rides" },
    { threshold: 20, emoji:"🏆", label:"Century Tyrant",     desc:"Completed 20 century rides" },
  ]}),

  ...hardLadder({ prefix: "swim-mile", category: "cardio", tiers: [
    { threshold: 1,  emoji:"🌊", label:"Open Water Swimmer",   desc:"Swam 1 mile in open water" },
    { threshold: 3,  emoji:"🌀", label:"Tide Walker",          desc:"Completed 3 open water miles" },
    { threshold: 5,  emoji:"🦈", label:"Saltborn",             desc:"Completed 5 open water miles" },
    { threshold: 10, emoji:"🪼", label:"Deep Water Reaper",    desc:"Completed 10 open water miles" },
    { threshold: 20, emoji:"🔱", label:"Sea God",              desc:"Completed 20 open water miles" },
  ]}),

  ...hardLadder({ prefix: "murph", category: "challenges", tiers: [
    { threshold: 1,  emoji:"🇺🇸", label:"Murph Survivor",     desc:"Completed your first Murph" },
    { threshold: 3,  emoji:"🎖️", label:"Hero Workout",         desc:"Completed Murph 3 times" },
    { threshold: 5,  emoji:"💥", label:"Murph Mauler",         desc:"Completed Murph 5 times" },
    { threshold: 10, emoji:"🦅", label:"Memorial Beast",       desc:"Completed Murph 10 times" },
    { threshold: 20, emoji:"🛡️", label:"Hero Made Flesh",      desc:"Completed Murph 20 times" },
  ]}),

  ...hardLadder({ prefix: "75-hard", category: "challenges", tiers: [
    { threshold: 1,  emoji:"🔩", label:"75 Hard Survivor",   desc:"Completed 75 Hard once" },
    { threshold: 3,  emoji:"🧊", label:"Mental Steel",       desc:"Completed 75 Hard 3 times" },
    { threshold: 5,  emoji:"⚙️", label:"Discipline Engine",   desc:"Completed 75 Hard 5 times" },
    { threshold: 10, emoji:"👹", label:"75 Hard Tyrant",     desc:"Completed 75 Hard 10 times" },
    { threshold: 20, emoji:"💎", label:"Unbreakable",        desc:"Completed 75 Hard 20 times" },
  ]}),

  ...hardLadder({ prefix: "spartan", category: "challenges", tiers: [
    { threshold: 1,  emoji:"🏔️", label:"Spartan",              desc:"Completed your first Spartan Race" },
    { threshold: 3,  emoji:"🛡️", label:"Phalanx",              desc:"Completed 3 Spartan Races" },
    { threshold: 5,  emoji:"🩸", label:"300 Bloodline",        desc:"Completed 5 Spartan Races" },
    { threshold: 10, emoji:"⚔️", label:"Spartan Centurion",     desc:"Completed 10 Spartan Races" },
    { threshold: 20, emoji:"👑", label:"Spartan King",         desc:"Completed 20 Spartan Races" },
  ]}),

  ...hardLadder({ prefix: "tough-mudder", category: "challenges", tiers: [
    { threshold: 1,  emoji:"🪤", label:"Mud Slayer",         desc:"Completed your first Tough Mudder" },
    { threshold: 3,  emoji:"🩸", label:"Filth Forged",       desc:"Completed 3 Tough Mudders" },
    { threshold: 5,  emoji:"🪓", label:"Mud Reaper",         desc:"Completed 5 Tough Mudders" },
    { threshold: 10, emoji:"🌩️", label:"Storm Born",          desc:"Completed 10 Tough Mudders" },
    { threshold: 20, emoji:"🐗", label:"Mudborn Legend",     desc:"Completed 20 Tough Mudders" },
  ]}),

  ...hardLadder({ prefix: "crossfit-open", category: "challenges", tiers: [
    { threshold: 1,  emoji:"🏅", label:"Open Athlete",     desc:"Competed in your first CrossFit Open" },
    { threshold: 3,  emoji:"🔥", label:"Open Veteran",     desc:"Competed in 3 CrossFit Opens" },
    { threshold: 5,  emoji:"💀", label:"Box Killer",       desc:"Competed in 5 CrossFit Opens" },
    { threshold: 10, emoji:"🦍", label:"Open Beast",       desc:"Competed in 10 CrossFit Opens" },
    { threshold: 20, emoji:"👑", label:"Open Legend",      desc:"Competed in 20 CrossFit Opens" },
  ]}),

  ...hardLadder({ prefix: "powerlifter", category: "strength", tiers: [
    { threshold: 1,  emoji:"🏆", label:"Meet Veteran",       desc:"Competed in your first powerlifting meet" },
    { threshold: 3,  emoji:"🦁", label:"Platform Beast",     desc:"Competed in 3 powerlifting meets" },
    { threshold: 5,  emoji:"🦾", label:"Iron Champion",      desc:"Competed in 5 powerlifting meets" },
    { threshold: 10, emoji:"👹", label:"Meet Tyrant",        desc:"Competed in 10 powerlifting meets" },
    { threshold: 20, emoji:"👑", label:"Platform God",       desc:"Competed in 20 powerlifting meets" },
  ]}),

  // ════════════════════════════════════════════════════════════════════════
  //  SINGLE-SHOT CREDENTIALS
  // ════════════════════════════════════════════════════════════════════════

  // Strength singles
  { id:"iron-maiden",     emoji:"⚒️", label:"Iron Maiden",      desc:"Deadlifted 2x your bodyweight",          category:"strength" },
  { id:"overhead-bw",     emoji:"🙌", label:"Overhead Master",  desc:"Overhead pressed your bodyweight",       category:"strength" },
  { id:"weighted-pullup", emoji:"🧲", label:"Weighted Pull-Up", desc:"Completed a pull-up with added weight",  category:"strength" },
  { id:"kettlebell-king", emoji:"🔔", label:"Kettlebell King",  desc:"Completed 100 kettlebell swings in a row", category:"strength" },
  { id:"6min-mile",       emoji:"⚡", label:"6 Minute Mile",     desc:"Ran a mile in under 6 minutes",          category:"cardio" },

  // Single-session feats
  { id:"plank-5min",  emoji:"⏱️", label:"Plank Legend",  desc:"Held a plank for 5 minutes",           category:"challenges" },
  { id:"burpee-100",  emoji:"🌀", label:"Burpee Beast",  desc:"Completed 100 burpees in one session", category:"challenges" },
  { id:"pullup-20",   emoji:"⬆️", label:"Pull-Up Pro",   desc:"Did 20 consecutive pull-ups",          category:"challenges" },
  { id:"pushup-100",  emoji:"⬇️", label:"100 Push-Ups",  desc:"Did 100 push-ups in one session",      category:"challenges" },
  { id:"iron-will",   emoji:"🪖", label:"Iron Will",     desc:"Completed a 30-day challenge",         category:"challenges" },

  // Personal credentials
  { id:"veteran",         emoji:"🎖️", label:"Veteran",          desc:"US Military Service",                       category:"special" },
  { id:"coach",           emoji:"🎓", label:"Coach",             desc:"Became a certified fitness coach",          category:"special" },
  { id:"personal-trainer",emoji:"📋", label:"Personal Trainer",  desc:"Earned a personal training certification",  category:"special" },
  { id:"transformation",  emoji:"🦋", label:"Transformation",    desc:"Completed a 90-day body transformation",    category:"special" },
  { id:"comeback-story",  emoji:"💫", label:"Comeback Story",    desc:"Returned from injury and hit a new PR",     category:"special" },

  // Lifestyle / event
  { id:"birthday-workout",  emoji:"🎂", label:"Birthday Grind",      desc:"Worked out on your birthday",                   category:"special" },
  { id:"new-years",         emoji:"🎆", label:"New Year, New Me",    desc:"Logged a workout on January 1st",               category:"special" },
  { id:"holiday-hustle",    emoji:"🎄", label:"Holiday Hustle",      desc:"Worked out on a major holiday",                 category:"special" },
  { id:"collab",            emoji:"🤜", label:"Workout Partner",     desc:"Logged a workout with a friend",                category:"special" },
  { id:"outdoor-adventurer",emoji:"🧗", label:"Outdoor Adventurer",  desc:"Completed a hike, climb, or outdoor adventure", category:"special" },
  { id:"sport-competitor",  emoji:"🏆", label:"Competitor",          desc:"Competed in any athletic event",                category:"special" },

  // Social one-offs
  { id:"group-member", emoji:"🤝",  label:"Group Member", desc:"Joined your first group", category:"social" },
  { id:"group-leader", emoji:"🎙️", label:"Group Leader", desc:"Created a group",         category:"social" },

  // Nutrition one-offs
  { id:"calorie-goals",  emoji:"🎯", label:"On Target",         desc:"Hit calorie goal 7 days in a row",      category:"nutrition" },
  { id:"protein-streak", emoji:"🥩", label:"Protein Streak",    desc:"Hit protein goal 14 days in a row",     category:"nutrition" },
  { id:"meal-prep",      emoji:"🍱", label:"Meal Prepper",      desc:"Logged 10 weeks of meal prep",          category:"nutrition" },
  { id:"plant-week",     emoji:"🌱", label:"Plant Week",        desc:"Ate plant-based for 7 days",            category:"nutrition" },
  { id:"sugar-free",     emoji:"🚫", label:"Sugar Free",        desc:"Avoided added sugar for 14 days",       category:"nutrition" },
  { id:"macro-master",   emoji:"⚖️", label:"Macro Master",       desc:"Hit all 3 macro goals in a single day", category:"nutrition" },
  { id:"fasting",        emoji:"⏳", label:"Fasting Pro",       desc:"Completed a 24-hour fast",              category:"nutrition" },
  { id:"clean-30",       emoji:"🥦", label:"Clean 30",          desc:"Ate clean for 30 days straight",        category:"nutrition" },
];

// ── BADGE CLASSIFICATION HELPERS ─────────────────────────────────────────

export const EASY_LADDER_PREFIXES = [
  "workouts", "runs", "lifts", "yoga", "walks", "biking", "swimming", "rowing",
  "hiit", "pilates", "boxing", "sports", "sauna", "cold-plunge", "meditation",
  "breathwork", "stretching",
  // New wellness modalities (Apr 2026 expansion)
  "infrared-sauna", "red-light", "massage", "float-tank", "mobility",
  "journaling", "sunlight",
  "wellness", "nutrition", "fasting-12h", "posts",
  "followers", "likes", "comments", "early-bird",
];

export const EASY_LADDER_THRESHOLDS = [1, 5, 20, 50, 100, 200, 500, 1000];

export const STREAK_THRESHOLDS = [3, 7, 14, 30, 60, 90, 180, 365];

export const HARD_LADDER_PREFIXES = [
  "marathon", "ultra", "ironman", "half-marathon", "5k", "10k",
  "triathlon", "century-ride", "swim-mile", "murph", "75-hard",
  "spartan", "tough-mudder", "crossfit-open", "powerlifter",
];
export const HARD_LADDER_THRESHOLDS = [1, 3, 5, 10, 20];

export const STRENGTH_LADDER_PREFIXES = ["bench", "squat", "deadlift"];
export const STRENGTH_LADDER_WEIGHTS = [200, 300, 400, 500];
export const TOTAL_LADDER_WEIGHTS = [800, 1000, 1300, 1500];

const ALL_KNOWN_PREFIXES = [
  ...EASY_LADDER_PREFIXES,
  ...HARD_LADDER_PREFIXES,
  ...STRENGTH_LADDER_PREFIXES,
  "streak", "total",
];

/** Get the family prefix from a badge ID, e.g. "yoga-50" → "yoga".
 *  Uses longest-prefix match so "cold-plunge-5" maps to "cold-plunge". */
export function getBadgePrefix(badgeId: string): string | null {
  const parts = badgeId.split("-");
  if (parts.length < 2) return null;
  for (let i = parts.length - 1; i > 0; i--) {
    const candidate = parts.slice(0, i).join("-");
    if (ALL_KNOWN_PREFIXES.includes(candidate)) return candidate;
  }
  return null;
}

/** All easy-ladder + streak badge IDs (auto-awarded by post-page engine). */
export const AUTO_AWARDED_BADGE_IDS = new Set<string>(
  BADGES.filter(b => {
    const prefix = getBadgePrefix(b.id);
    return prefix !== null && (
      EASY_LADDER_PREFIXES.includes(prefix) || prefix === "streak"
    );
  }).map(b => b.id)
);

/** All hard-event ladder badge IDs (manually claimable, level up). */
export const MANUAL_LADDER_BADGE_IDS = new Set<string>(
  BADGES.filter(b => {
    const prefix = getBadgePrefix(b.id);
    return prefix !== null && HARD_LADDER_PREFIXES.includes(prefix);
  }).map(b => b.id)
);

/** Just the tier-1 entry IDs of each manual ladder (what shows in modal). */
export const MANUAL_LADDER_ENTRY_IDS = new Set<string>(
  HARD_LADDER_PREFIXES.map(prefix => `${prefix}-1`)
);

/** Strength ladder + total ladder badge IDs (auto-detectable from logged exercises with weight). */
export const STRENGTH_LADDER_BADGE_IDS = new Set<string>(
  BADGES.filter(b => {
    const prefix = getBadgePrefix(b.id);
    return prefix !== null && (STRENGTH_LADDER_PREFIXES.includes(prefix) || prefix === "total");
  }).map(b => b.id)
);

// ── Manual badge family interface (for ladder claim flow) ─────────────────
export interface ManualBadgeFamily {
  key: string;
  entryBadgeId: string;
  tiers: [string, string, string, string, string];
  thresholds: [1, 3, 5, 10, 20];
}

export const MANUAL_BADGE_FAMILIES: ManualBadgeFamily[] = HARD_LADDER_PREFIXES.map(prefix => ({
  key: prefix,
  entryBadgeId: `${prefix}-1`,
  tiers: [`${prefix}-1`, `${prefix}-3`, `${prefix}-5`, `${prefix}-10`, `${prefix}-20`] as [string, string, string, string, string],
  thresholds: [1, 3, 5, 10, 20] as [1, 3, 5, 10, 20],
}));

export function findManualBadgeFamily(badgeId: string): ManualBadgeFamily | null {
  return MANUAL_BADGE_FAMILIES.find(f => f.tiers.includes(badgeId)) ?? null;
}

export function getTierForCount(family: ManualBadgeFamily, count: number): string {
  for (let i = family.thresholds.length - 1; i >= 0; i--) {
    if (count >= family.thresholds[i]) return family.tiers[i];
  }
  return family.tiers[0];
}

/** True if this badge should appear in the "Report Achievement" modal. */
export function isManualBadge(badgeId: string): boolean {
  if (AUTO_AWARDED_BADGE_IDS.has(badgeId)) return false;
  if (STRENGTH_LADDER_BADGE_IDS.has(badgeId)) return false;
  if (MANUAL_LADDER_BADGE_IDS.has(badgeId) && !MANUAL_LADDER_ENTRY_IDS.has(badgeId)) return false;
  return true;
}

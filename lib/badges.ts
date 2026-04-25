// ── Centralized badge definitions ─────────────────────────────────────────────
// Single source of truth used by profile, public profile, and the badge engine

export const BADGES = [
  // ── STRENGTH ──────────────────────────────────────────────────────────────
  { id:"1k-club",        emoji:"🏋️", label:"1,000 lb Club",      desc:"Squat + Bench + Deadlift ≥ 1,000 lbs",   category:"strength" },
  { id:"heavy-lifter",   emoji:"💪", label:"Heavy Lifter",        desc:"Logged a single lift over 300 lbs",       category:"strength" },
  { id:"pb-crusher",     emoji:"🚀", label:"PB Crusher",          desc:"Set 5 personal bests in one month",       category:"strength" },
  { id:"iron-maiden",    emoji:"⚒️", label:"Iron Maiden",         desc:"Deadlifted 2x your bodyweight",           category:"strength" },
  { id:"bench-200",      emoji:"🪨", label:"200 Club",            desc:"Bench pressed 200 lbs",                   category:"strength" },
  { id:"squat-300",      emoji:"🦵", label:"Squat King",          desc:"Back squatted 300 lbs",                   category:"strength" },
  { id:"deadlift-400",   emoji:"⚓", label:"Deadlift Beast",      desc:"Deadlifted 400 lbs",                      category:"strength" },
  { id:"overhead-bw",    emoji:"🙌", label:"Overhead Master",     desc:"Overhead pressed your bodyweight",        category:"strength" },
  { id:"weighted-pullup",emoji:"🧲", label:"Weighted Pull-Up",    desc:"Completed a pull-up with added weight",   category:"strength" },
  { id:"kettlebell-king",emoji:"🔔", label:"Kettlebell King",     desc:"Completed 100 kettlebell swings in a row",category:"strength" },
  { id:"1rm-pr",         emoji:"🎯", label:"One Rep Max",         desc:"Hit a 1RM personal record",               category:"strength" },
  { id:"powerlifter",    emoji:"🏆", label:"Powerlifter",         desc:"Competed in a powerlifting meet",         category:"strength" },
  // Lifting milestones (auto-awarded)
  { id:"first-lift",     emoji:"🏗️", label:"First Lift",         desc:"Logged your first lifting session",       category:"strength" },
  { id:"lifts-10",       emoji:"💪", label:"10 Sessions",         desc:"Logged 10 lifting sessions",              category:"strength" },
  { id:"lifts-25",       emoji:"🔩", label:"Iron Regular",        desc:"Logged 25 lifting sessions",              category:"strength" },
  { id:"lifts-50",       emoji:"⚡", label:"Iron Veteran",        desc:"Logged 50 lifting sessions",              category:"strength" },
  { id:"lifts-100",      emoji:"👑", label:"Iron Legend",         desc:"Logged 100 lifting sessions",             category:"strength" },
  { id:"lifts-200",      emoji:"💎", label:"Iron Dynasty",        desc:"Logged 200 lifting sessions",             category:"strength" },
  { id:"lifts-500",      emoji:"🗿", label:"Iron Immortal",       desc:"Logged 500 lifting sessions",             category:"strength" },
  { id:"lifts-1000",     emoji:"🌋", label:"Iron God",            desc:"Logged 1,000 lifting sessions",           category:"strength" },

  // ── CARDIO ────────────────────────────────────────────────────────────────
  { id:"marathon",       emoji:"🏅", label:"Marathon Runner",     desc:"Completed a 26.2 mile run",               category:"cardio" },
  { id:"6min-mile",      emoji:"⚡", label:"6 Minute Mile",       desc:"Ran a mile in under 6 minutes",           category:"cardio" },
  { id:"half-marathon",  emoji:"🏃", label:"Half Marathoner",     desc:"Completed a 13.1 mile run",               category:"cardio" },
  { id:"5k",             emoji:"🎽", label:"5K Runner",           desc:"Completed your first 5K",                 category:"cardio" },
  { id:"10k",            emoji:"🏁", label:"10K Runner",          desc:"Completed your first 10K",                category:"cardio" },
  { id:"ultra",          emoji:"🌄", label:"Ultra Runner",        desc:"Completed an ultra marathon (50K+)",      category:"cardio" },
  { id:"century-ride",   emoji:"🚴", label:"Century Rider",       desc:"Cycled 100 miles in one ride",            category:"cardio" },
  { id:"triathlon",      emoji:"🏊", label:"Triathlete",          desc:"Completed a triathlon",                   category:"cardio" },
  { id:"ironman",        emoji:"🦾", label:"Ironman",             desc:"Completed a full Ironman",                category:"cardio" },
  { id:"swim-mile",      emoji:"🌊", label:"Open Water Swimmer",  desc:"Swam 1 mile in open water",              category:"cardio" },
  { id:"rowing-10k",     emoji:"🚣", label:"Rower",               desc:"Rowed 10,000 meters in one session",      category:"cardio" },
  // Running milestones (auto-awarded)
  { id:"first-run",      emoji:"👟", label:"First Run",           desc:"Logged your first run",                   category:"cardio" },
  { id:"runs-5",         emoji:"🏃", label:"5 Runs",              desc:"Logged 5 runs",                           category:"cardio" },
  { id:"runs-20",        emoji:"🌟", label:"20 Runs",             desc:"Logged 20 runs",                          category:"cardio" },
  { id:"runs-50",        emoji:"🔥", label:"50 Runs",             desc:"Logged 50 runs",                          category:"cardio" },
  { id:"runs-100",       emoji:"🏆", label:"100 Run Club",        desc:"Logged 100 runs",                         category:"cardio" },
  { id:"runs-200",       emoji:"💎", label:"200 Run Society",     desc:"Logged 200 runs",                         category:"cardio" },
  { id:"runs-500",       emoji:"🗿", label:"500 Run Immortal",    desc:"Logged 500 runs",                         category:"cardio" },
  { id:"runs-1000",      emoji:"🌋", label:"1,000 Run Legend",    desc:"Logged 1,000 runs",                       category:"cardio" },

  // ── CONSISTENCY ───────────────────────────────────────────────────────────
  { id:"7day-streak",    emoji:"🔥", label:"7 Day Streak",        desc:"Logged activity 7 days in a row",         category:"consistency" },
  { id:"early-bird",     emoji:"🌅", label:"Early Bird",          desc:"Logged 5 workouts before 7am",            category:"consistency" },
  { id:"centurion",      emoji:"💯", label:"Centurion",           desc:"Logged 100 workouts total",               category:"consistency" },
  { id:"30day-streak",   emoji:"🗓️", label:"30 Day Streak",      desc:"Logged activity 30 days in a row",        category:"consistency" },
  { id:"90day-streak",   emoji:"💎", label:"90 Day Grind",        desc:"Logged activity 90 days in a row",        category:"consistency" },
  { id:"365day",         emoji:"🌟", label:"Year Warrior",        desc:"Logged activity 365 days in a year",      category:"consistency" },
  { id:"no-days-off",    emoji:"🚫", label:"No Days Off",         desc:"Logged at least one activity every day for 14 days", category:"consistency" },
  { id:"comeback",       emoji:"🔄", label:"Comeback Kid",        desc:"Returned to logging after a 30-day break",category:"consistency" },
  { id:"weekend-warrior",emoji:"⚔️", label:"Weekend Warrior",    desc:"Worked out every weekend for a month",    category:"consistency" },
  // Total workout milestones (auto-awarded)
  { id:"first-workout",  emoji:"🎉", label:"First Workout",       desc:"Logged your very first workout",          category:"consistency" },
  { id:"workouts-10",    emoji:"📈", label:"10 Workouts",         desc:"Logged 10 total workouts",                category:"consistency" },
  { id:"workouts-25",    emoji:"⭐", label:"25 Workouts",         desc:"Logged 25 total workouts",                category:"consistency" },
  { id:"centurion-half", emoji:"🥈", label:"50 Strong",           desc:"Logged 50 total workouts",                category:"consistency" },
  { id:"centurion-2x",   emoji:"💎", label:"200 Titan",           desc:"Logged 200 total workouts",               category:"consistency" },
  { id:"500-workouts",   emoji:"👑", label:"500 Legend",          desc:"Logged 500 total workouts",               category:"consistency" },
  { id:"1000-workouts",  emoji:"🌋", label:"1,000 Immortal",      desc:"Logged 1,000 total workouts",             category:"consistency" },

  // ── WELLNESS ──────────────────────────────────────────────────────────────
  { id:"yoga-lover",     emoji:"🧘", label:"Yoga Lover",          desc:"Logged 30 yoga sessions",                 category:"wellness" },
  { id:"yoga-queen",     emoji:"🪷", label:"Yoga Queen",          desc:"Logged 100 yoga sessions",                category:"wellness" },
  { id:"meditation-master",emoji:"🕊️",label:"Meditation Master", desc:"Logged 30 meditation sessions",           category:"wellness" },
  { id:"sleep-champ",    emoji:"😴", label:"Sleep Champion",      desc:"Logged 8+ hours of sleep 7 nights in a row",category:"wellness" },
  { id:"hydration-hero", emoji:"💧", label:"Hydration Hero",      desc:"Hit daily water goal 14 days in a row",  category:"wellness" },
  { id:"stretch-it-out", emoji:"🤸", label:"Stretch It Out",      desc:"Logged 20 stretching sessions",           category:"wellness" },
  { id:"ice-bath",       emoji:"🧊", label:"Ice Bath Club",       desc:"Took 5 ice baths or cold plunges",        category:"wellness" },
  { id:"ice-warrior",    emoji:"❄️", label:"Ice Warrior",         desc:"Completed 50 cold plunges",               category:"wellness" },
  { id:"sauna",          emoji:"🔆", label:"Sauna Regular",       desc:"Logged 10 sauna sessions",                category:"wellness" },
  { id:"sauna-30",       emoji:"🌡️", label:"Sauna Devotee",      desc:"Logged 30 sauna sessions",                category:"wellness" },
  { id:"breathwork",     emoji:"🫁", label:"Breathwork Practitioner",desc:"Completed 10 breathwork sessions",     category:"wellness" },
  { id:"breathwork-30",  emoji:"🌬️", label:"Breath Master",      desc:"Completed 30 breathwork sessions",        category:"wellness" },
  { id:"zero-alcohol",   emoji:"🫗", label:"Sober Streak",        desc:"Logged 30 alcohol-free days",             category:"wellness" },
  { id:"step-10k",       emoji:"👟", label:"10K Steps",           desc:"Hit 10,000 steps daily for 7 days",       category:"wellness" },
  { id:"step-15k",       emoji:"🦿", label:"Step Master",         desc:"Hit 15,000 steps in a single day",        category:"wellness" },
  { id:"posture",        emoji:"🪑", label:"Posture Pro",         desc:"Completed 20 posture/mobility workouts",  category:"wellness" },
  { id:"nature-walk",    emoji:"🌿", label:"Nature Walker",       desc:"Logged 10 outdoor walks",                 category:"wellness" },
  { id:"wellness-10",    emoji:"🌱", label:"10 Wellness Activities",desc:"Logged 10 wellness activities",         category:"wellness" },
  // Note: walks-50 and wellness-50 moved into the full-ladder section below
  // First-time wellness (auto-awarded)
  // Note Oct 2026: expanded to full 8-tier ladder 1/5/20/50/100/200/500/1000.
  // Old IDs like "sauna" and "sauna-30" remain (below) so users don't lose
  // badges they already earned, but they're no longer part of the progression
  // family — the new *-5/*-20/... IDs are canonical for tier display.

  // ── YOGA LADDER ──
  { id:"first-yoga",        emoji:"🧘", label:"First Yoga",       desc:"Logged your first yoga session",          category:"wellness" },
  { id:"yoga-5",            emoji:"🧘", label:"Yoga Starter",     desc:"Logged 5 yoga sessions",                  category:"wellness" },
  { id:"yoga-10",           emoji:"🪷", label:"Yoga Regular",     desc:"Logged 20 yoga sessions",                 category:"wellness" },
  { id:"yoga-50",           emoji:"🪷", label:"Yoga Dedicated",   desc:"Logged 50 yoga sessions",                 category:"wellness" },
  { id:"yoga-100",          emoji:"🪷", label:"Yoga Lover",       desc:"Logged 100 yoga sessions",                category:"wellness" },
  { id:"yoga-200",          emoji:"🧘", label:"Yoga Devotee",     desc:"Logged 200 yoga sessions",                category:"wellness" },
  { id:"yoga-500",          emoji:"🧘", label:"Yoga Master",      desc:"Logged 500 yoga sessions",                category:"wellness" },
  { id:"yoga-1000",         emoji:"🧘", label:"Yoga Immortal",    desc:"Logged 1,000 yoga sessions",              category:"wellness" },

  // ── MEDITATION LADDER ──
  { id:"first-meditation",  emoji:"🕊️",label:"First Meditation", desc:"Logged your first meditation",            category:"wellness" },
  { id:"meditation-5",      emoji:"🕊️",label:"Mindful Starter", desc:"Logged 5 meditations",                    category:"wellness" },
  { id:"meditation-10",     emoji:"🧠", label:"Mindful Regular",  desc:"Logged 20 meditations",                   category:"wellness" },
  { id:"meditation-50",     emoji:"🧠", label:"Mindful Practitioner",desc:"Logged 50 meditations",               category:"wellness" },
  { id:"meditation-100",    emoji:"🕊️",label:"Mindful Devotee",  desc:"Logged 100 meditations",                  category:"wellness" },
  { id:"meditation-200",    emoji:"🕊️",label:"Mindful Master",   desc:"Logged 200 meditations",                  category:"wellness" },
  { id:"meditation-500",    emoji:"🧘", label:"Zen Legend",       desc:"Logged 500 meditations",                  category:"wellness" },
  { id:"meditation-1000",   emoji:"🧘", label:"Enlightened",      desc:"Logged 1,000 meditations",                category:"wellness" },

  // ── COLD PLUNGE LADDER ──
  { id:"first-cold-plunge", emoji:"🧊", label:"First Cold Plunge",desc:"Took your first cold plunge",             category:"wellness" },
  { id:"cold-plunge-5",     emoji:"🧊", label:"Cold Starter",     desc:"Took 5 cold plunges",                     category:"wellness" },
  { id:"cold-plunge-20",    emoji:"💦", label:"Cold Plunge Addict",desc:"Completed 20 cold plunges",              category:"wellness" },
  { id:"cold-plunge-50",    emoji:"❄️", label:"Ice Warrior",      desc:"Completed 50 cold plunges",               category:"wellness" },
  { id:"cold-plunge-100",   emoji:"❄️", label:"Ice Veteran",      desc:"Completed 100 cold plunges",              category:"wellness" },
  { id:"cold-plunge-200",   emoji:"❄️", label:"Ice Devotee",      desc:"Completed 200 cold plunges",              category:"wellness" },
  { id:"cold-plunge-500",   emoji:"🥶", label:"Ice Master",       desc:"Completed 500 cold plunges",              category:"wellness" },
  { id:"cold-plunge-1000",  emoji:"🥶", label:"Ice Immortal",     desc:"Completed 1,000 cold plunges",            category:"wellness" },

  // ── SAUNA LADDER ──
  { id:"first-sauna",       emoji:"🔆", label:"First Sauna",      desc:"Logged your first sauna session",         category:"wellness" },
  { id:"sauna-5",           emoji:"🔆", label:"Sauna Starter",    desc:"Logged 5 sauna sessions",                 category:"wellness" },
  { id:"sauna-20",          emoji:"🌡️",label:"Sauna Regular",    desc:"Logged 20 sauna sessions",                category:"wellness" },
  { id:"sauna-50",          emoji:"🌡️",label:"Sauna Dedicated",  desc:"Logged 50 sauna sessions",                category:"wellness" },
  { id:"sauna-100",         emoji:"🔥", label:"Sauna Devotee",    desc:"Logged 100 sauna sessions",               category:"wellness" },
  { id:"sauna-200",         emoji:"🔥", label:"Heat Chamber Vet", desc:"Logged 200 sauna sessions",               category:"wellness" },
  { id:"sauna-500",         emoji:"🔥", label:"Heat Master",      desc:"Logged 500 sauna sessions",               category:"wellness" },
  { id:"sauna-1000",        emoji:"🔥", label:"Sauna Immortal",   desc:"Logged 1,000 sauna sessions",             category:"wellness" },

  // ── BREATHWORK LADDER ──
  { id:"first-breathwork",  emoji:"🫁", label:"First Breathwork", desc:"Logged your first breathwork session",    category:"wellness" },
  { id:"breathwork-5",      emoji:"🫁", label:"Breath Starter",   desc:"Completed 5 breathwork sessions",         category:"wellness" },
  { id:"breathwork-20",     emoji:"🌬️",label:"Breath Regular",   desc:"Completed 20 breathwork sessions",        category:"wellness" },
  { id:"breathwork-50",     emoji:"🌬️",label:"Breath Dedicated", desc:"Completed 50 breathwork sessions",        category:"wellness" },
  { id:"breathwork-100",    emoji:"🌪️",label:"Breath Devotee",   desc:"Completed 100 breathwork sessions",       category:"wellness" },
  { id:"breathwork-200",    emoji:"🌪️",label:"Breath Master",    desc:"Completed 200 breathwork sessions",       category:"wellness" },
  { id:"breathwork-500",    emoji:"🌪️",label:"Breath Legend",    desc:"Completed 500 breathwork sessions",       category:"wellness" },
  { id:"breathwork-1000",   emoji:"🌪️",label:"Breath Immortal",  desc:"Completed 1,000 breathwork sessions",     category:"wellness" },

  // ── STRETCHING LADDER ──
  { id:"first-stretch",     emoji:"🤸", label:"First Stretch",    desc:"Logged your first stretching session",    category:"wellness" },
  { id:"stretch-5",         emoji:"🤸", label:"Stretch Starter",  desc:"Logged 5 stretching sessions",            category:"wellness" },
  { id:"stretch-20",        emoji:"🤸", label:"Stretch It Out",   desc:"Logged 20 stretching sessions",           category:"wellness" },
  { id:"stretch-50",        emoji:"🧎", label:"Flexibility Pro",  desc:"Logged 50 stretching sessions",           category:"wellness" },
  { id:"stretch-100",       emoji:"🧎", label:"Mobility Devotee", desc:"Logged 100 stretching sessions",          category:"wellness" },
  { id:"stretch-200",       emoji:"🧎", label:"Mobility Master",  desc:"Logged 200 stretching sessions",          category:"wellness" },
  { id:"stretch-500",       emoji:"🧎", label:"Flex Legend",      desc:"Logged 500 stretching sessions",          category:"wellness" },
  { id:"stretch-1000",      emoji:"🧎", label:"Flex Immortal",    desc:"Logged 1,000 stretching sessions",        category:"wellness" },

  // ── WALKING LADDER ──
  { id:"first-walk",        emoji:"🌿", label:"First Walk",       desc:"Logged your first walk",                  category:"wellness" },
  { id:"walks-5",           emoji:"🌿", label:"Walker Starter",   desc:"Logged 5 walks",                          category:"wellness" },
  { id:"walks-20",          emoji:"🚶", label:"Walker Regular",   desc:"Logged 20 walks",                         category:"wellness" },
  { id:"walks-50",          emoji:"🌍", label:"Wanderer",         desc:"Logged 50 walks",                         category:"wellness" },
  { id:"walks-100",         emoji:"🗺️",label:"Explorer",         desc:"Logged 100 walks",                        category:"wellness" },
  { id:"walks-200",         emoji:"🗺️",label:"Path Seeker",      desc:"Logged 200 walks",                        category:"wellness" },
  { id:"walks-500",         emoji:"🧭", label:"Nomad",            desc:"Logged 500 walks",                        category:"wellness" },
  { id:"walks-1000",        emoji:"🧭", label:"Walking Immortal", desc:"Logged 1,000 walks",                      category:"wellness" },

  // ── WELLNESS OVERALL LADDER ──
  { id:"wellness-1",        emoji:"🌱", label:"First Wellness",   desc:"Logged your first wellness activity",     category:"wellness" },
  { id:"wellness-5",        emoji:"🌱", label:"Wellness Starter", desc:"Logged 5 wellness activities",            category:"wellness" },
  { id:"wellness-20",       emoji:"🌿", label:"Wellness Regular", desc:"Logged 20 wellness activities",           category:"wellness" },
  { id:"wellness-50",       emoji:"🌳", label:"Wellness Devotee", desc:"Logged 50 wellness activities",           category:"wellness" },
  { id:"wellness-100",      emoji:"🌳", label:"Wellness Dedicated",desc:"Logged 100 wellness activities",         category:"wellness" },
  { id:"wellness-200",      emoji:"🌺", label:"Wellness Master",  desc:"Logged 200 wellness activities",          category:"wellness" },
  { id:"wellness-500",      emoji:"🌸", label:"Wellness Legend",  desc:"Logged 500 wellness activities",          category:"wellness" },
  { id:"wellness-1000",     emoji:"🌸", label:"Wellness Immortal",desc:"Logged 1,000 wellness activities",        category:"wellness" },

  // ── NUTRITION ─────────────────────────────────────────────────────────────
  { id:"calorie-goals",  emoji:"🎯", label:"On Target",           desc:"Hit calorie goal 7 days in a row",        category:"nutrition" },
  { id:"protein-streak", emoji:"🥩", label:"Protein Streak",      desc:"Hit protein goal 14 days in a row",       category:"nutrition" },
  { id:"meal-prep",      emoji:"🍱", label:"Meal Prepper",         desc:"Logged 10 weeks of meal prep",            category:"nutrition" },
  { id:"plant-week",     emoji:"🌱", label:"Plant Week",          desc:"Ate plant-based for 7 days",              category:"nutrition" },
  { id:"sugar-free",     emoji:"🚫", label:"Sugar Free",          desc:"Avoided added sugar for 14 days",         category:"nutrition" },
  { id:"macro-master",   emoji:"⚖️", label:"Macro Master",        desc:"Hit all 3 macro goals in a single day",   category:"nutrition" },
  { id:"barcode-10",     emoji:"📱", label:"Scanner",             desc:"Logged 10 foods via barcode scan",         category:"nutrition" },
  { id:"barcode-100",    emoji:"📊", label:"Data Logger",         desc:"Logged 100 foods via barcode scan",        category:"nutrition" },
  { id:"fasting",        emoji:"⏳", label:"Fasting Pro",         desc:"Completed a 24-hour fast",                category:"nutrition" },
  { id:"clean-30",       emoji:"🥦", label:"Clean 30",            desc:"Ate clean for 30 days straight",          category:"nutrition" },
  // Nutrition logging milestones (auto-awarded) — full 8-tier ladder
  { id:"first-nutrition-log",emoji:"🥗", label:"First Log",         desc:"Logged your first nutrition entry",       category:"nutrition" },
  { id:"nutrition-5",    emoji:"🥗", label:"Log Starter",           desc:"Logged 5 nutrition entries",              category:"nutrition" },
  { id:"nutrition-20",   emoji:"📋", label:"Log Regular",           desc:"Logged 20 nutrition entries",             category:"nutrition" },
  { id:"nutrition-50",   emoji:"📋", label:"Log Dedicated",         desc:"Logged 50 nutrition entries",             category:"nutrition" },
  { id:"nutrition-100",  emoji:"💪", label:"100 Nutrition Logs",    desc:"Logged nutrition 100 times",              category:"nutrition" },
  { id:"nutrition-200",  emoji:"💪", label:"Nutrition Devotee",     desc:"Logged 200 nutrition entries",            category:"nutrition" },
  { id:"nutrition-500",  emoji:"🏆", label:"Nutrition Legend",      desc:"Logged 500 nutrition entries",            category:"nutrition" },
  { id:"nutrition-1000", emoji:"🏆", label:"Nutrition Immortal",    desc:"Logged 1,000 nutrition entries",          category:"nutrition" },
  // Kept for historical earned badges (previously in family, now orphan credentials)
  { id:"nutrition-week", emoji:"📅", label:"Nutrition Week",        desc:"Logged nutrition 7 days in a row",        category:"nutrition" },
  { id:"nutrition-pro",  emoji:"🏅", label:"Nutrition Pro",         desc:"Hit macro goals 14 days in a row",        category:"nutrition" },

  // ── CHALLENGES ────────────────────────────────────────────────────────────
  { id:"iron-will",      emoji:"🪖", label:"Iron Will",           desc:"Completed a 30-day challenge",            category:"challenges" },
  { id:"75-hard",        emoji:"🔩", label:"75 Hard",             desc:"Completed the 75 Hard program",           category:"challenges" },
  { id:"murph",          emoji:"🇺🇸", label:"Murph",             desc:"Completed the Murph workout",             category:"challenges" },
  { id:"spartan",        emoji:"🏔️", label:"Spartan",            desc:"Completed a Spartan Race",                category:"challenges" },
  { id:"tough-mudder",   emoji:"🪤", label:"Tough Mudder",        desc:"Completed a Tough Mudder",                category:"challenges" },
  { id:"crossfit-open",  emoji:"🏅", label:"CrossFit Open",       desc:"Competed in the CrossFit Open",           category:"challenges" },
  { id:"pushup-100",     emoji:"⬇️", label:"100 Push-Ups",       desc:"Did 100 push-ups in one session",         category:"challenges" },
  { id:"plank-5min",     emoji:"⏱️", label:"Plank Legend",       desc:"Held a plank for 5 minutes",              category:"challenges" },
  { id:"burpee-100",     emoji:"🌀", label:"Burpee Beast",        desc:"Completed 100 burpees in one session",    category:"challenges" },
  { id:"pullup-20",      emoji:"⬆️", label:"Pull-Up Pro",        desc:"Did 20 consecutive pull-ups",             category:"challenges" },

  // ── SOCIAL ────────────────────────────────────────────────────────────────
  { id:"first-post",     emoji:"📸", label:"First Post",          desc:"Made your first post on the feed",        category:"social" },
  { id:"10-posts",       emoji:"📷", label:"Content Creator",     desc:"Made 10 posts on the feed",               category:"social" },
  { id:"first-follower", emoji:"👥", label:"First Follower",      desc:"Got your first follower",                 category:"social" },
  { id:"100-followers",  emoji:"🌐", label:"Rising Star",         desc:"Reached 100 followers",                   category:"social" },
  { id:"group-member",   emoji:"🤝", label:"Group Member",        desc:"Joined your first group",                 category:"social" },
  { id:"group-leader",   emoji:"🎙️", label:"Group Leader",       desc:"Created a group",                         category:"social" },
  { id:"first-like",     emoji:"❤️", label:"Liked",              desc:"Received your first like",                category:"social" },
  { id:"motivator",      emoji:"🙌", label:"Motivator",           desc:"Had a post liked 50+ times",              category:"social" },

  // ── SPECIAL ───────────────────────────────────────────────────────────────
  { id:"veteran",        emoji:"🎖️", label:"Veteran",            desc:"US Military Service",                     category:"special" },
  { id:"first-gym",      emoji:"🏟️", label:"Gym Rat",            desc:"Checked into a gym for the first time",   category:"special" },
  { id:"coach",          emoji:"🎓", label:"Coach",               desc:"Became a certified fitness coach",        category:"special" },
  { id:"personal-trainer",emoji:"📋",label:"Personal Trainer",    desc:"Earned a personal training certification",category:"special" },
  { id:"transformation", emoji:"🦋", label:"Transformation",      desc:"Completed a 90-day body transformation",  category:"special" },
  { id:"comeback-story", emoji:"💫", label:"Comeback Story",      desc:"Returned from injury and hit a new PR",   category:"special" },
  { id:"birthday-workout",emoji:"🎂",label:"Birthday Grind",      desc:"Worked out on your birthday",             category:"special" },
  { id:"new-years",      emoji:"🎆", label:"New Year, New Me",    desc:"Logged a workout on January 1st",         category:"special" },
  { id:"holiday-hustle", emoji:"🎄", label:"Holiday Hustle",      desc:"Worked out on a major holiday",           category:"special" },
  { id:"collab",         emoji:"🤜", label:"Workout Partner",     desc:"Logged a workout with a friend",          category:"special" },
  { id:"outdoor-adventurer",emoji:"🧗",label:"Outdoor Adventurer",desc:"Completed a hike, climb, or outdoor adventure",category:"special" },
  { id:"sport-competitor",emoji:"🏆",label:"Competitor",          desc:"Competed in any athletic event",          category:"special" },

  // ── HARD-EVENT LADDERS (1/3/5/10/20) ─────────────────────────────────────
  // These are physically grueling events users report manually. Each ladder
  // has 5 tiers — first time you report it you get tier 1, and reporting more
  // levels you up. The backend looks up the family by parent ID and awards
  // the next unclaimed tier when claimBadge fires.

  // Marathon ladder
  { id:"marathon-1",  emoji:"🏅", label:"Marathoner",        desc:"Completed your first marathon",       category:"cardio" },
  { id:"marathon-3",  emoji:"🔥", label:"Pavement Pounder",  desc:"Completed 3 marathons",               category:"cardio" },
  { id:"marathon-5",  emoji:"💀", label:"Asphalt Eater",     desc:"Completed 5 marathons",               category:"cardio" },
  { id:"marathon-10", emoji:"⚡", label:"Mile Devourer",     desc:"Completed 10 marathons",              category:"cardio" },
  { id:"marathon-20", emoji:"👹", label:"Distance Demon",    desc:"Completed 20 marathons",              category:"cardio" },

  // Ultra ladder
  { id:"ultra-1",  emoji:"🌄", label:"Ultra Animal",     desc:"Completed your first ultra (50K+)",   category:"cardio" },
  { id:"ultra-3",  emoji:"🩸", label:"Trail Reaper",     desc:"Completed 3 ultras",                  category:"cardio" },
  { id:"ultra-5",  emoji:"🗡️", label:"Mountain Killer",   desc:"Completed 5 ultras",                  category:"cardio" },
  { id:"ultra-10", emoji:"🐺", label:"Wild Born",        desc:"Completed 10 ultras",                 category:"cardio" },
  { id:"ultra-20", emoji:"🌋", label:"Untamed",          desc:"Completed 20 ultras",                 category:"cardio" },

  // Ironman ladder
  { id:"ironman-1",  emoji:"🦾", label:"Ironman",         desc:"Completed your first Ironman",        category:"cardio" },
  { id:"ironman-3",  emoji:"⚙️", label:"Tri-Forged",       desc:"Completed 3 Ironmans",                category:"cardio" },
  { id:"ironman-5",  emoji:"💀", label:"Iron Phantom",    desc:"Completed 5 Ironmans",                category:"cardio" },
  { id:"ironman-10", emoji:"⚔️", label:"Iron Shogun",      desc:"Completed 10 Ironmans",               category:"cardio" },
  { id:"ironman-20", emoji:"👑", label:"Iron God",        desc:"Completed 20 Ironmans",               category:"cardio" },

  // Half Marathon ladder
  { id:"half-marathon-1",  emoji:"🏃", label:"Half Slayer",         desc:"Completed your first half marathon", category:"cardio" },
  { id:"half-marathon-3",  emoji:"🩸", label:"13.1 Killer",         desc:"Completed 3 half marathons",         category:"cardio" },
  { id:"half-marathon-5",  emoji:"💉", label:"Distance Dealer",     desc:"Completed 5 half marathons",         category:"cardio" },
  { id:"half-marathon-10", emoji:"👻", label:"Endurance Wraith",    desc:"Completed 10 half marathons",        category:"cardio" },
  { id:"half-marathon-20", emoji:"⚰️", label:"13.1 Immortal",        desc:"Completed 20 half marathons",        category:"cardio" },

  // 5K ladder
  { id:"5k-1",  emoji:"🎽", label:"5K Striker",      desc:"Completed your first 5K",   category:"cardio" },
  { id:"5k-3",  emoji:"🔱", label:"Triple Threat",   desc:"Completed 3 5Ks",           category:"cardio" },
  { id:"5k-5",  emoji:"🎯", label:"5K Hunter",       desc:"Completed 5 5Ks",           category:"cardio" },
  { id:"5k-10", emoji:"🪓", label:"5K Reaper",       desc:"Completed 10 5Ks",          category:"cardio" },
  { id:"5k-20", emoji:"👑", label:"5K Apex",         desc:"Completed 20 5Ks",          category:"cardio" },

  // 10K ladder
  { id:"10k-1",  emoji:"🏁", label:"10K Crusher",          desc:"Completed your first 10K",  category:"cardio" },
  { id:"10k-3",  emoji:"💣", label:"Double Digit Hitman",  desc:"Completed 3 10Ks",          category:"cardio" },
  { id:"10k-5",  emoji:"🐂", label:"10K Beast",            desc:"Completed 5 10Ks",          category:"cardio" },
  { id:"10k-10", emoji:"🦂", label:"10K Tyrant",           desc:"Completed 10 10Ks",         category:"cardio" },
  { id:"10k-20", emoji:"⚔️", label:"10K Conqueror",         desc:"Completed 20 10Ks",         category:"cardio" },

  // Triathlon ladder
  { id:"triathlon-1",  emoji:"🏊", label:"Triathlete",              desc:"Completed your first triathlon", category:"cardio" },
  { id:"triathlon-3",  emoji:"🌊", label:"Three-Element Killer",    desc:"Completed 3 triathlons",         category:"cardio" },
  { id:"triathlon-5",  emoji:"⚡", label:"Tri Hunter",              desc:"Completed 5 triathlons",         category:"cardio" },
  { id:"triathlon-10", emoji:"🔱", label:"Iron Triad",              desc:"Completed 10 triathlons",        category:"cardio" },
  { id:"triathlon-20", emoji:"👁️", label:"Triathlon Demigod",        desc:"Completed 20 triathlons",        category:"cardio" },

  // Murph ladder
  { id:"murph-1",  emoji:"🇺🇸", label:"Murph Survivor",     desc:"Completed your first Murph", category:"challenges" },
  { id:"murph-3",  emoji:"🎖️", label:"Hero Workout",         desc:"Completed Murph 3 times",    category:"challenges" },
  { id:"murph-5",  emoji:"💥", label:"Murph Mauler",         desc:"Completed Murph 5 times",    category:"challenges" },
  { id:"murph-10", emoji:"🦅", label:"Memorial Beast",       desc:"Completed Murph 10 times",   category:"challenges" },
  { id:"murph-20", emoji:"🛡️", label:"Hero Made Flesh",      desc:"Completed Murph 20 times",   category:"challenges" },

  // 75 Hard ladder
  { id:"75-hard-1",  emoji:"🔩", label:"75 Hard Survivor",   desc:"Completed 75 Hard once",     category:"challenges" },
  { id:"75-hard-3",  emoji:"🧊", label:"Mental Steel",       desc:"Completed 75 Hard 3 times",  category:"challenges" },
  { id:"75-hard-5",  emoji:"⚙️", label:"Discipline Engine",   desc:"Completed 75 Hard 5 times",  category:"challenges" },
  { id:"75-hard-10", emoji:"👹", label:"75 Hard Tyrant",     desc:"Completed 75 Hard 10 times", category:"challenges" },
  { id:"75-hard-20", emoji:"💎", label:"Unbreakable",        desc:"Completed 75 Hard 20 times", category:"challenges" },

  // Spartan ladder
  { id:"spartan-1",  emoji:"🏔️", label:"Spartan",              desc:"Completed your first Spartan Race", category:"challenges" },
  { id:"spartan-3",  emoji:"🛡️", label:"Phalanx",              desc:"Completed 3 Spartan Races",         category:"challenges" },
  { id:"spartan-5",  emoji:"🩸", label:"300 Bloodline",        desc:"Completed 5 Spartan Races",         category:"challenges" },
  { id:"spartan-10", emoji:"⚔️", label:"Spartan Centurion",     desc:"Completed 10 Spartan Races",        category:"challenges" },
  { id:"spartan-20", emoji:"👑", label:"Spartan King",         desc:"Completed 20 Spartan Races",        category:"challenges" },

  // Tough Mudder ladder
  { id:"tough-mudder-1",  emoji:"🪤", label:"Mud Slayer",         desc:"Completed your first Tough Mudder", category:"challenges" },
  { id:"tough-mudder-3",  emoji:"🩸", label:"Filth Forged",       desc:"Completed 3 Tough Mudders",         category:"challenges" },
  { id:"tough-mudder-5",  emoji:"🪓", label:"Mud Reaper",         desc:"Completed 5 Tough Mudders",         category:"challenges" },
  { id:"tough-mudder-10", emoji:"🌩️", label:"Storm Born",          desc:"Completed 10 Tough Mudders",        category:"challenges" },
  { id:"tough-mudder-20", emoji:"🐗", label:"Mudborn Legend",     desc:"Completed 20 Tough Mudders",        category:"challenges" },

  // Century Ride ladder
  { id:"century-ride-1",  emoji:"🚴", label:"Century Rider",      desc:"Completed your first 100-mile ride", category:"cardio" },
  { id:"century-ride-3",  emoji:"🌀", label:"Pedal Phantom",      desc:"Completed 3 century rides",          category:"cardio" },
  { id:"century-ride-5",  emoji:"🦅", label:"Asphalt Hawk",       desc:"Completed 5 century rides",          category:"cardio" },
  { id:"century-ride-10", emoji:"⚡", label:"Long Haul Killer",   desc:"Completed 10 century rides",         category:"cardio" },
  { id:"century-ride-20", emoji:"🏆", label:"Century Tyrant",     desc:"Completed 20 century rides",         category:"cardio" },

  // Open Water Swim ladder
  { id:"swim-mile-1",  emoji:"🌊", label:"Open Water Swimmer",   desc:"Swam 1 mile in open water",          category:"cardio" },
  { id:"swim-mile-3",  emoji:"🌀", label:"Tide Walker",          desc:"Completed 3 open water miles",       category:"cardio" },
  { id:"swim-mile-5",  emoji:"🦈", label:"Saltborn",             desc:"Completed 5 open water miles",       category:"cardio" },
  { id:"swim-mile-10", emoji:"🪼", label:"Deep Water Reaper",    desc:"Completed 10 open water miles",      category:"cardio" },
  { id:"swim-mile-20", emoji:"🔱", label:"Sea God",              desc:"Completed 20 open water miles",      category:"cardio" },

  // CrossFit Open ladder
  { id:"crossfit-open-1",  emoji:"🏅", label:"Open Athlete",     desc:"Competed in your first CrossFit Open", category:"challenges" },
  { id:"crossfit-open-3",  emoji:"🔥", label:"Open Veteran",     desc:"Competed in 3 CrossFit Opens",         category:"challenges" },
  { id:"crossfit-open-5",  emoji:"💀", label:"Box Killer",       desc:"Competed in 5 CrossFit Opens",         category:"challenges" },
  { id:"crossfit-open-10", emoji:"🦍", label:"Open Beast",       desc:"Competed in 10 CrossFit Opens",        category:"challenges" },
  { id:"crossfit-open-20", emoji:"👑", label:"Open Legend",      desc:"Competed in 20 CrossFit Opens",        category:"challenges" },

  // Powerlifting Meet ladder
  { id:"powerlifter-1",  emoji:"🏆", label:"Meet Veteran",       desc:"Competed in your first powerlifting meet", category:"strength" },
  { id:"powerlifter-3",  emoji:"🦁", label:"Platform Beast",     desc:"Competed in 3 powerlifting meets",         category:"strength" },
  { id:"powerlifter-5",  emoji:"🦾", label:"Iron Champion",      desc:"Competed in 5 powerlifting meets",         category:"strength" },
  { id:"powerlifter-10", emoji:"👹", label:"Meet Tyrant",        desc:"Competed in 10 powerlifting meets",        category:"strength" },
  { id:"powerlifter-20", emoji:"👑", label:"Platform God",       desc:"Competed in 20 powerlifting meets",        category:"strength" },
];

export type Badge = typeof BADGES[0];

// ── MANUAL BADGE FAMILIES (1/3/5/10/20 hard-event ladders) ─────────────────
// Each entry maps a parent key (used in the modal) to its 5 tier badge IDs.
// The modal shows ONLY tier 1 of each family (the entry point). When a user
// claims tier 1, they actually get awarded the highest tier they qualify for
// based on how many they've reported before. This way reporting your 5th
// marathon awards "Asphalt Eater" automatically.
export interface ManualBadgeFamily {
  /** Stable key — used in claim handler to look up the next tier to award */
  key: string;
  /** First-tier (entry) badge ID — what shows in the modal */
  entryBadgeId: string;
  /** All 5 tier badge IDs in order: [tier1, tier2, tier3, tier4, tier5] */
  tiers: [string, string, string, string, string];
  /** Required count for each tier — typically [1, 3, 5, 10, 20] */
  thresholds: [1, 3, 5, 10, 20];
}

export const MANUAL_BADGE_FAMILIES: ManualBadgeFamily[] = [
  { key: "marathon",       entryBadgeId: "marathon-1",       tiers: ["marathon-1","marathon-3","marathon-5","marathon-10","marathon-20"],                      thresholds: [1,3,5,10,20] },
  { key: "ultra",          entryBadgeId: "ultra-1",          tiers: ["ultra-1","ultra-3","ultra-5","ultra-10","ultra-20"],                                     thresholds: [1,3,5,10,20] },
  { key: "ironman",        entryBadgeId: "ironman-1",        tiers: ["ironman-1","ironman-3","ironman-5","ironman-10","ironman-20"],                           thresholds: [1,3,5,10,20] },
  { key: "half-marathon",  entryBadgeId: "half-marathon-1",  tiers: ["half-marathon-1","half-marathon-3","half-marathon-5","half-marathon-10","half-marathon-20"], thresholds: [1,3,5,10,20] },
  { key: "5k",             entryBadgeId: "5k-1",             tiers: ["5k-1","5k-3","5k-5","5k-10","5k-20"],                                                    thresholds: [1,3,5,10,20] },
  { key: "10k",            entryBadgeId: "10k-1",            tiers: ["10k-1","10k-3","10k-5","10k-10","10k-20"],                                               thresholds: [1,3,5,10,20] },
  { key: "triathlon",      entryBadgeId: "triathlon-1",      tiers: ["triathlon-1","triathlon-3","triathlon-5","triathlon-10","triathlon-20"],                 thresholds: [1,3,5,10,20] },
  { key: "murph",          entryBadgeId: "murph-1",          tiers: ["murph-1","murph-3","murph-5","murph-10","murph-20"],                                     thresholds: [1,3,5,10,20] },
  { key: "75-hard",        entryBadgeId: "75-hard-1",        tiers: ["75-hard-1","75-hard-3","75-hard-5","75-hard-10","75-hard-20"],                           thresholds: [1,3,5,10,20] },
  { key: "spartan",        entryBadgeId: "spartan-1",        tiers: ["spartan-1","spartan-3","spartan-5","spartan-10","spartan-20"],                           thresholds: [1,3,5,10,20] },
  { key: "tough-mudder",   entryBadgeId: "tough-mudder-1",   tiers: ["tough-mudder-1","tough-mudder-3","tough-mudder-5","tough-mudder-10","tough-mudder-20"],  thresholds: [1,3,5,10,20] },
  { key: "century-ride",   entryBadgeId: "century-ride-1",   tiers: ["century-ride-1","century-ride-3","century-ride-5","century-ride-10","century-ride-20"], thresholds: [1,3,5,10,20] },
  { key: "swim-mile",      entryBadgeId: "swim-mile-1",      tiers: ["swim-mile-1","swim-mile-3","swim-mile-5","swim-mile-10","swim-mile-20"],                 thresholds: [1,3,5,10,20] },
  { key: "crossfit-open",  entryBadgeId: "crossfit-open-1",  tiers: ["crossfit-open-1","crossfit-open-3","crossfit-open-5","crossfit-open-10","crossfit-open-20"], thresholds: [1,3,5,10,20] },
  { key: "powerlifter",    entryBadgeId: "powerlifter-1",    tiers: ["powerlifter-1","powerlifter-3","powerlifter-5","powerlifter-10","powerlifter-20"],       thresholds: [1,3,5,10,20] },
];

/** Set of ALL badge IDs that are part of a manual ladder. Used to filter
 *  out non-entry tiers from the modal. */
export const MANUAL_LADDER_BADGE_IDS = new Set<string>(
  MANUAL_BADGE_FAMILIES.flatMap(f => f.tiers)
);

/** Set of just the entry-point badge IDs (tier 1 of each ladder). The modal
 *  shows these so users can report a marathon/spartan/etc and the backend
 *  awards them the right tier based on their existing claim count. */
export const MANUAL_LADDER_ENTRY_IDS = new Set<string>(
  MANUAL_BADGE_FAMILIES.map(f => f.entryBadgeId)
);

/** Find which family a badge ID belongs to. Returns null if not a ladder badge. */
export function findManualBadgeFamily(badgeId: string): ManualBadgeFamily | null {
  return MANUAL_BADGE_FAMILIES.find(f => f.tiers.includes(badgeId)) ?? null;
}

/** Given a count of how many times a user has claimed badges in a family,
 *  return which tier badge ID they should currently be at.
 *
 *  Examples:
 *   - count = 1  → tiers[0] (Marathoner)
 *   - count = 2  → tiers[0] (still Marathoner, haven't hit 3 yet)
 *   - count = 3  → tiers[1] (Pavement Pounder)
 *   - count = 6  → tiers[2] (Asphalt Eater, between 5 and 10)
 *   - count = 25 → tiers[4] (Distance Demon, capped at 20+)
 */
export function getTierForCount(family: ManualBadgeFamily, count: number): string {
  // Walk thresholds from highest to lowest to find the highest one met
  for (let i = family.thresholds.length - 1; i >= 0; i--) {
    if (count >= family.thresholds[i]) return family.tiers[i];
  }
  return family.tiers[0]; // fallback (count=0 shouldn't happen in claim flow)
}

// IDs the badge engine awards automatically based on counters (lift sessions,
// runs, sauna count, etc.). These should NOT show in the "Report an
// Achievement" modal — users earn them by logging activities, not by claiming.
// Keep in sync with lib/badgeFamilies.ts entries that have counterSource.
export const AUTO_AWARDED_BADGE_IDS = new Set<string>([
  // Lifting progression
  "first-lift", "lifts-10", "lifts-25", "lifts-50", "lifts-100", "lifts-200", "lifts-500", "lifts-1000",
  // Running progression
  "first-run", "runs-5", "runs-20", "runs-50", "runs-100", "runs-200", "runs-500", "runs-1000",
  // Total workouts
  "first-workout", "workouts-10", "workouts-25", "centurion-half", "centurion", "centurion-2x", "500-workouts", "1000-workouts",
  // Streaks
  "7day-streak", "30day-streak", "90day-streak", "365day",
  // Wellness ladders (yoga, meditation, cold plunge, sauna, breathwork, walks, stretching, total wellness)
  "first-yoga", "yoga-5", "yoga-10", "yoga-50", "yoga-100", "yoga-200", "yoga-500", "yoga-1000",
  "first-meditation", "meditation-5", "meditation-10", "meditation-50", "meditation-100", "meditation-200", "meditation-500", "meditation-1000",
  "first-cold-plunge", "cold-plunge-5", "cold-plunge-20", "cold-plunge-50", "cold-plunge-100", "cold-plunge-200", "cold-plunge-500", "cold-plunge-1000",
  "first-sauna", "sauna-5", "sauna-20", "sauna-50", "sauna-100", "sauna-200", "sauna-500", "sauna-1000",
  "first-breathwork", "breathwork-5", "breathwork-20", "breathwork-50", "breathwork-100", "breathwork-200", "breathwork-500", "breathwork-1000",
  "first-walk", "walks-5", "walks-20", "walks-50", "walks-100", "walks-200", "walks-500", "walks-1000",
  "first-stretch", "stretch-5", "stretch-20", "stretch-50", "stretch-100", "stretch-200", "stretch-500", "stretch-1000",
  "wellness-1", "wellness-5", "wellness-20", "wellness-50", "wellness-100", "wellness-200", "wellness-500", "wellness-1000",
  // Nutrition logging
  "first-nutrition-log", "nutrition-5", "nutrition-20", "nutrition-50", "nutrition-100", "nutrition-200", "nutrition-500", "nutrition-1000",
  // Social (auto-tracked from posts/follows)
  "first-post", "10-posts", "first-follower", "100-followers", "first-like", "motivator",
  // Legacy single-tier hard event IDs — replaced by the new -1/-3/-5/-10/-20
  // ladder entries below. Kept here so old earned-badges still show in
  // displays but they're hidden from the report modal.
  "marathon", "5k", "10k", "half-marathon", "ultra", "century-ride", "triathlon",
  "ironman", "swim-mile", "rowing-10k",
  "75-hard", "murph", "spartan", "tough-mudder", "crossfit-open", "powerlifter",
]);

/** True if a badge is honor-system / manually claimed by the user.
 *
 *  This includes:
 *    - Standalone credentials (Veteran, Bench 200, Iron Will, etc.)
 *    - Tier-1 entry badges of hard-event ladders (marathon-1, spartan-1, etc.)
 *
 *  Hidden from the modal:
 *    - Auto-awarded counter-tracked progression badges
 *    - Mid/upper tiers of hard-event ladders (marathon-3, marathon-5, etc.)
 *      Those auto-award when you report enough times via the entry badge.
 */
export function isManualBadge(badgeId: string): boolean {
  if (AUTO_AWARDED_BADGE_IDS.has(badgeId)) return false;
  // Hide non-entry tiers of manual ladders from the modal
  if (MANUAL_LADDER_BADGE_IDS.has(badgeId) && !MANUAL_LADDER_ENTRY_IDS.has(badgeId)) return false;
  return true;
}

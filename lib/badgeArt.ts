// Custom illustrated art for badges. Files live in public/badges/.
// Badges without art fall back to their emoji.
import { getBadgePrefix } from "./badges";

const EXACT: Record<string, string> = {
  "bench-200": "bench-200",
  "bench-300": "bench-300",
  "bench-400": "bench-400",
  "founder": "founder",
  "veteran": "veteran",
  "fasting": "fasting",
  "group-leader": "group-leader",
  "new-years": "new-year",
  "holiday-hustle": "christmas",
  "halloween": "halloween",
  "group-member": "group-member",
  "birthday-workout": "birthday-workout",
  "personal-trainer": "personal-trainer",
  "6min-mile": "6min-mile",
};

const BY_PREFIX: Record<string, string> = {
  "cold-plunge": "cold-plunge",
  "sauna": "sauna",
  "infrared-sauna": "sauna",
  "runs": "runs",
  "fasting-12h": "fasting",
  "nutrition": "nutrition",
  "wellness": "self-care",
  "workouts": "workouts",
  "lifts": "lifts",
  "posts": "posts",
  "walks": "walks",
  "followers": "followers",
  "meditation": "meditation",
  "partner": "partner",
  "streak": "streak",
  "early-bird": "early-bird",
  "yoga": "yoga",
  "stretching": "stretching",
  "hiit": "hiit",
  "biking": "biking",
  "swimming": "swimming",
  "rowing": "rowing",
  "boxing": "boxing",
  "sports": "sports",
  "likes": "likes",
  "5k": "5k",
  "10k": "10k",
  "marathon": "marathon",
  "pilates": "pilates",
  "massage": "massage",
  "journaling": "journaling",
  "float-tank": "float-tank",
};

export function badgeArt(id: string | null | undefined): string | null {
  if (!id) return null;
  const file = EXACT[id] ?? BY_PREFIX[getBadgePrefix(id) ?? ""];
  return file ? `/badges/${file}.webp` : null;
}

// ── Activity → badge art ────────────────────────────────────────────────────
// Used for the small icons on activity logs: a cold plunge log shows the cold
// plunge badge, a run shows the running badge, etc. Returns null when no badge
// fits so callers can fall back to their emoji.
const ACTIVITY_ART: [RegExp, string][] = [
  [/float/i, "float-tank"],
  [/massage/i, "massage"],
  [/journal/i, "journaling"],
  [/pilates/i, "pilates"],
  [/cold\s*plunge|ice\s*bath|cryo/i, "cold-plunge"],
  [/sauna|steam/i, "sauna"],
  [/fast/i, "fasting"],
  [/meditat|breath|yoga\s*nidra|sound\s*bath|mindful/i, "meditation"],
  [/yoga/i, "yoga"],
  [/stretch|mobility|foam|chiro|cupping|acupunct/i, "stretching"],
  [/swim/i, "swimming"],
  [/bik|cycl|spin/i, "biking"],
  [/row/i, "rowing"],
  [/box|kickbox|mma|martial/i, "boxing"],
  [/hiit|interval|circuit|crossfit|bootcamp/i, "hiit"],
  [/run|jog|treadmill|sprint|track/i, "runs"],
  [/walk|hik|stair/i, "walks"],
  [/basketball|soccer|football|tennis|pickleball|golf|volleyball|baseball|hockey|sport/i, "sports"],
  [/lift|weight|strength|workout/i, "lifts"],
  [/meal|nutrition|food|breakfast|lunch|dinner|snack/i, "nutrition"],
];

export function artForActivity(name: string | null | undefined): string | null {
  if (!name) return null;
  for (const [re, file] of ACTIVITY_ART) if (re.test(name)) return `/badges/${file}.webp`;
  return null;
}

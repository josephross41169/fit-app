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
};

export function badgeArt(id: string | null | undefined): string | null {
  if (!id) return null;
  const file = EXACT[id] ?? BY_PREFIX[getBadgePrefix(id) ?? ""];
  return file ? `/badges/${file}.webp` : null;
}

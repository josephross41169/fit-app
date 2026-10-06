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
};

const BY_PREFIX: Record<string, string> = {
  "cold-plunge": "cold-plunge",
  "sauna": "sauna",
  "infrared-sauna": "sauna",
  "runs": "runs",
  "fasting-12h": "fasting",
  "nutrition": "nutrition",
  "wellness": "self-care",
};

export function badgeArt(id: string | null | undefined): string | null {
  if (!id) return null;
  const file = EXACT[id] ?? BY_PREFIX[getBadgePrefix(id) ?? ""];
  return file ? `/badges/${file}.webp` : null;
}

// lib/exerciseImages.ts
// Looks up exercise images from the free wger.de API.
// Caches the catalog in localStorage for 7 days so we hit the network once per week, max.
// Public endpoint, no auth needed.

const WGER_BASE = "https://wger.de";
const CACHE_KEY = "wger-exercise-image-map-v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type ImageMap = Record<string, string>; // normalized name -> image url

interface CachedMap {
  builtAt: number;
  map: ImageMap;
}

// In-memory cache for the current session (avoids re-parsing localStorage repeatedly)
let memoryCache: ImageMap | null = null;
let inflight: Promise<ImageMap> | null = null;

// Normalize names so "Bench Press" and "bench press" and "BENCH-PRESS" all collide
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Build the map by hitting wger's exerciseinfo endpoint.
// /api/v2/exerciseinfo/ returns full exercises with their `images` array embedded.
// We page through it (default page size is 20, we bump to 100).
async function buildMap(): Promise<ImageMap> {
  const map: ImageMap = {};
  let next: string | null = `${WGER_BASE}/api/v2/exerciseinfo/?language=2&limit=100`;
  let safety = 20; // hard cap of 20 pages = 2000 exercises

  while (next && safety-- > 0) {
    const res: Response = await fetch(next);
    if (!res.ok) break;
    const data = await res.json();
    for (const ex of data.results ?? []) {
      // Each exercise has translations[] with name in different languages,
      // and images[] with full image URLs. Pick main image if present.
      const imgs = ex.images ?? [];
      if (!imgs.length) continue;
      const main = imgs.find((i: { is_main?: boolean }) => i.is_main) ?? imgs[0];
      const url: string | undefined = main?.image;
      if (!url) continue;

      // Names live in translations[]; English (lang 2) preferred
      const translations: { language: number; name: string }[] = ex.translations ?? [];
      for (const t of translations) {
        if (t.language !== 2 || !t.name) continue;
        const key = normalize(t.name);
        if (key && !map[key]) map[key] = url;
      }
    }
    next = data.next ?? null;
  }
  return map;
}

function readCache(): ImageMap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedMap = JSON.parse(raw);
    if (Date.now() - parsed.builtAt > CACHE_TTL_MS) return null;
    return parsed.map;
  } catch {
    return null;
  }
}

function writeCache(map: ImageMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ builtAt: Date.now(), map }),
    );
  } catch {
    // quota exceeded etc. — silent failure is fine, we'll just refetch next session
  }
}

// Get (or build) the full map. Subsequent calls share the inflight promise.
async function ensureMap(): Promise<ImageMap> {
  if (memoryCache) return memoryCache;
  const cached = readCache();
  if (cached) {
    memoryCache = cached;
    return cached;
  }
  if (!inflight) {
    inflight = buildMap()
      .then(m => {
        memoryCache = m;
        writeCache(m);
        return m;
      })
      .catch(() => ({}))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Try a few name variations before giving up.
// e.g. "Incline Dumbbell Press" -> try "incline dumbbell press" -> "incline dumbbell bench press"
function candidates(name: string): string[] {
  const base = normalize(name);
  const variants = new Set<string>([base]);

  // common aliasing wger uses
  if (base.includes("dumbbell press") && !base.includes("bench")) {
    variants.add(base.replace("dumbbell press", "dumbbell bench press"));
  }
  if (base.includes("ohp")) variants.add(base.replace("ohp", "overhead press"));
  if (base.startsWith("bb ")) variants.add("barbell " + base.slice(3));
  if (base.startsWith("db ")) variants.add("dumbbell " + base.slice(3));

  // strip leading equipment word — "barbell row" -> "row"
  const equipPrefixes = ["barbell", "dumbbell", "cable", "machine", "smith machine"];
  for (const p of equipPrefixes) {
    if (base.startsWith(p + " ")) variants.add(base.slice(p.length + 1));
  }

  // try plural/singular flips
  if (base.endsWith("s")) variants.add(base.slice(0, -1));
  else variants.add(base + "s");

  return [...variants];
}

/**
 * Resolve an exercise name to an image URL, or null if no match.
 * Safe to call repeatedly — uses in-memory + localStorage cache.
 */
export async function getExerciseImage(name: string): Promise<string | null> {
  if (!name) return null;
  const map = await ensureMap();
  for (const key of candidates(name)) {
    if (map[key]) return map[key];
  }
  // last-ditch: substring match on any key
  const base = normalize(name);
  for (const key of Object.keys(map)) {
    if (key.includes(base) || base.includes(key)) return map[key];
  }
  return null;
}

/** For debugging / dev tooling */
export function _clearExerciseImageCache() {
  memoryCache = null;
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(CACHE_KEY); } catch {}
  }
}

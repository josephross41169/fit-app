// lib/exerciseImages.ts
// Looks up exercise images via our own /api/exercise-images route,
// which proxies wger.de server-side (avoids CORS, gets shared edge caching).
// Browser also caches the full map in localStorage for 7 days.

const API_URL = "/api/exercise-images";
const CACHE_KEY = "wger-exercise-image-map-v2";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type ImageMap = Record<string, string>; // normalized name -> image url

interface CachedMap {
  builtAt: number;
  map: ImageMap;
}

let memoryCache: ImageMap | null = null;
let inflight: Promise<ImageMap> | null = null;

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchMap(): Promise<ImageMap> {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      console.warn("[exerciseImages] API returned", res.status);
      return {};
    }
    const data = await res.json();
    if (data && typeof data.map === "object" && data.map) {
      return data.map as ImageMap;
    }
    return {};
  } catch (err) {
    console.warn("[exerciseImages] fetch failed:", err);
    return {};
  }
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
    // quota exceeded etc. — silent, refetch next session
  }
}

async function ensureMap(): Promise<ImageMap> {
  if (memoryCache) return memoryCache;
  const cached = readCache();
  if (cached && Object.keys(cached).length > 0) {
    memoryCache = cached;
    return cached;
  }
  if (!inflight) {
    inflight = fetchMap()
      .then(m => {
        memoryCache = m;
        if (Object.keys(m).length > 0) writeCache(m);
        return m;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Try a few name variations before giving up.
function candidates(name: string): string[] {
  const base = normalize(name);
  const variants = new Set<string>([base]);

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
  if (!map || Object.keys(map).length === 0) return null;

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

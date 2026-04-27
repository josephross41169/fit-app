// app/api/exercise-images/route.ts
// Server-side proxy that builds a merged exercise-name -> image-url map
// from TWO public sources:
//   1. yuhonas/free-exercise-db on GitHub (real-photo JPGs, ~800 exercises) — PRIMARY
//   2. wger.de  (illustrated SVGs, ~400 exercises) — FALLBACK
// Free-exercise-db has the bigger catalog so we use it first, and wger fills
// in anything the primary source doesn't cover.
//
// Cached for 7 days at the edge (Vercel) so we hit the upstream sources
// at most once per week per region. Hitting this URL directly in the browser
// is the easiest way to debug:
//   https://fit-app-ecru.vercel.app/api/exercise-images

import { NextResponse } from "next/server";

const WGER_BASE = "https://wger.de";
const FREE_DB_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const FREE_DB_IMG_PREFIX =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const REVALIDATE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const revalidate = REVALIDATE_SECONDS;
// Run at request time, not build time. force-static was making Next try to
// fetch from GitHub + wger.de during the build, which routinely timed out
// the build worker (60s limit) and failed deploys. The 7-day Cache-Control
// header in the response still gives us edge caching, just on first request
// per region instead of at build.
export const dynamic = "force-dynamic";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Source 1: free-exercise-db (PRIMARY — bigger catalog) ─────────────────────
interface FreeDbExercise {
  name?: string;
  images?: string[]; // e.g. ["Air_Bike/0.jpg", "Air_Bike/1.jpg"]
}

async function fetchFreeDbMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const res = await fetch(FREE_DB_URL, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return map;
  const exercises: FreeDbExercise[] = await res.json();

  for (const ex of exercises) {
    if (!ex.name || !ex.images?.length) continue;
    const imgPath = ex.images[0]; // first image is usually the start position
    const fullUrl = FREE_DB_IMG_PREFIX + imgPath;
    const key = normalize(ex.name);
    if (key && !map[key]) map[key] = fullUrl;
  }
  return map;
}

// ── Source 2: wger (FALLBACK) ─────────────────────────────────────────────────
async function fetchWgerMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  let next: string | null = `${WGER_BASE}/api/v2/exerciseinfo/?language=2&limit=100`;
  let safety = 20;

  while (next && safety-- > 0) {
    const res: Response = await fetch(next, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) break;
    const data = await res.json();

    for (const ex of data.results ?? []) {
      const imgs = ex.images ?? [];
      if (!imgs.length) continue;
      const main = imgs.find((i: { is_main?: boolean }) => i.is_main) ?? imgs[0];
      const url: string | undefined = main?.image;
      if (!url) continue;

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

// ── Merge: free-db wins ties; wger fills gaps ─────────────────────────────────
export async function GET() {
  try {
    // Fetch both sources in parallel — if one fails, we still get the other
    const [freeDbResult, wgerResult] = await Promise.allSettled([
      fetchFreeDbMap(),
      fetchWgerMap(),
    ]);

    const freeDbMap = freeDbResult.status === "fulfilled" ? freeDbResult.value : {};
    const wgerMap = wgerResult.status === "fulfilled" ? wgerResult.value : {};

    // Start with wger, then overlay free-db so free-db wins on collisions
    const map: Record<string, string> = { ...wgerMap, ...freeDbMap };

    return NextResponse.json(
      {
        map,
        count: Object.keys(map).length,
        freeDbCount: Object.keys(freeDbMap).length,
        wgerCount: Object.keys(wgerMap).length,
      },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    return NextResponse.json(
      { map: {}, error: String(err) },
      { status: 500 },
    );
  }
}

// app/api/exercise-images/route.ts
// Server-side proxy to wger.de — fetches the exercise catalog and returns
// a flat { normalized_name: image_url } map. Cached for 7 days at the edge
// so we hit wger at most once per week per Vercel region.
//
// Hitting this route directly in the browser is also the easiest way to debug:
//   https://fit-app-ecru.vercel.app/api/exercise-images
// It should return a JSON object with hundreds of keys.

import { NextResponse } from "next/server";

const WGER_BASE = "https://wger.de";
const REVALIDATE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Tell Next.js to cache this route's response for a week
export const revalidate = REVALIDATE_SECONDS;
export const dynamic = "force-static";

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  const map: Record<string, string> = {};
  let next: string | null = `${WGER_BASE}/api/v2/exerciseinfo/?language=2&limit=100`;
  let safety = 20; // hard cap of 20 pages = 2000 exercises
  let pagesFetched = 0;

  try {
    while (next && safety-- > 0) {
      // Use Next.js fetch caching at this level too
      const res: Response = await fetch(next, {
        next: { revalidate: REVALIDATE_SECONDS },
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) break;
      const data = await res.json();
      pagesFetched++;

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

    return NextResponse.json(
      { map, count: Object.keys(map).length, pagesFetched },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    return NextResponse.json(
      { map: {}, error: String(err), pagesFetched },
      { status: 500 },
    );
  }
}

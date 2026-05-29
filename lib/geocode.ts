// ─────────────────────────────────────────────────────────────────────────────
// lib/geocode.ts
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight forward-geocoding helper: turns a place/city/address string into
// { lat, lng } coordinates. Used so events can store coordinates (for radius
// search on the Discover page) and so a user's profile city can be resolved to
// a point to measure distance from.
//
// Strategy (in order):
//   1. Mapbox forward geocoding (precise) — requires NEXT_PUBLIC_MAPBOX_TOKEN.
//   2. CITY_CENTERS fallback table (approx city-center coords) — works offline
//      / without a token for the most common US cities.
//   3. null — caller should fall back to non-distance (e.g. city-name) matching.
//
// This is intentionally dependency-free and safe to call from both client
// components and effects. It never throws; on any failure it returns null.
// ─────────────────────────────────────────────────────────────────────────────

export type Coords = { lat: number; lng: number };

// Approx city-center coordinates for common US cities. Mirrors the table in
// components/LocationPicker.tsx so behavior is consistent. Far from exhaustive;
// any miss falls through to Mapbox (if available) or null.
const CITY_CENTERS: Record<string, [number, number]> = {
  "las vegas": [36.1699, -115.1398],
  "henderson": [36.0395, -114.9817],
  "north las vegas": [36.1989, -115.1175],
  "summerlin": [36.1340, -115.3280],
  "los angeles": [34.0522, -118.2437],
  "new york": [40.7128, -74.006],
  "brooklyn": [40.6782, -73.9442],
  "chicago": [41.8781, -87.6298],
  "houston": [29.7604, -95.3698],
  "phoenix": [33.4484, -112.074],
  "philadelphia": [39.9526, -75.1652],
  "san antonio": [29.4241, -98.4936],
  "san diego": [32.7157, -117.1611],
  "dallas": [32.7767, -96.797],
  "san jose": [37.3382, -121.8863],
  "austin": [30.2672, -97.7431],
  "san francisco": [37.7749, -122.4194],
  "seattle": [47.6062, -122.3321],
  "denver": [39.7392, -104.9903],
  "miami": [25.7617, -80.1918],
  "atlanta": [33.749, -84.388],
  "boston": [42.3601, -71.0589],
  "portland": [45.5152, -122.6784],
  "nashville": [36.1627, -86.7816],
  "charlotte": [35.2271, -80.8431],
  "detroit": [42.3314, -83.0458],
  "minneapolis": [44.9778, -93.265],
  "tampa": [27.9506, -82.4572],
  "orlando": [28.5383, -81.3792],
  "sacramento": [38.5816, -121.4944],
};

/** Haversine distance in miles between two coordinate pairs. */
export function distanceMiles(a: Coords, b: Coords): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Look up approximate city-center coords from the fallback table. */
export function cityCenter(cityRaw: string | null | undefined): Coords | null {
  if (!cityRaw) return null;
  const key = cityRaw.toLowerCase().split(",")[0].trim();
  const hit = CITY_CENTERS[key];
  return hit ? { lat: hit[0], lng: hit[1] } : null;
}

/**
 * Resolve a place/city/address string to coordinates.
 * Tries Mapbox first (if a token is configured), then the city-center table.
 * Returns null if nothing matches — callers should treat null as "unknown
 * location" and fall back to city-name matching rather than hiding content.
 */
export async function geocode(query: string | null | undefined): Promise<Coords | null> {
  if (!query || !query.trim()) return null;
  const q = query.trim();

  const token =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_MAPBOX_TOKEN) || "";

  if (token) {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?` +
          `access_token=${token}` +
          `&types=poi,address,place,neighborhood,locality` +
          `&limit=1`
      );
      const data = await res.json();
      const center = data?.features?.[0]?.center; // [lng, lat]
      if (Array.isArray(center) && center.length === 2) {
        return { lat: center[1], lng: center[0] };
      }
    } catch {
      /* fall through to city-center table */
    }
  }

  return cityCenter(q);
}

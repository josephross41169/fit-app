"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────
export type Location = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  kind: "business" | "user_pin";
  business_user_id?: string | null;
};

// Suggestion from the Mapbox geocoding API. Not yet a real pin in our DB —
// rendered with a ✨ icon as "tap to pin." On tap, we call find-or-create
// which converts it to a real Location row.
type MapboxSuggestion = {
  name: string;       // Short name e.g. "Red Rock Canyon"
  fullAddress: string; // "Red Rock Canyon, Las Vegas, NV"
  lat: number;
  lng: number;
  city: string;       // Best-guess city extracted from Mapbox context
};

/** Haversine distance in miles. Used to dedup Mapbox suggestions against
 *  existing pins so the dropdown doesn't show "tap to pin" for a place
 *  someone already pinned 50ft away. */
function distanceMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type Props = {
  /** Currently selected location, or null if none. Controlled by parent. */
  value: Location | null;
  /** Called when the parent should update the selected location. */
  onChange: (next: Location | null) => void;
  /** Current user id — required to create new pins. */
  userId: string;
  /** Profile city of the current user. Used as default map center + city
   *  field when creating a pin (user can override). */
  defaultCity: string;
  /** Optional: lat/lng to bias proximity search toward. Falls back to a
   *  city-center lookup if not provided. */
  defaultLat?: number;
  defaultLng?: number;
};

// City-center fallback coords for major US cities. Used when defaultLat/Lng
// aren't provided so proximity search has SOMETHING to anchor on. Far from
// exhaustive — any city not in this map gets generic US center coords.
const CITY_CENTERS: Record<string, [number, number]> = {
  "las vegas": [36.1699, -115.1398],
  "los angeles": [34.0522, -118.2437],
  "new york": [40.7128, -74.0060],
  "chicago": [41.8781, -87.6298],
  "houston": [29.7604, -95.3698],
  "phoenix": [33.4484, -112.0740],
  "philadelphia": [39.9526, -75.1652],
  "san antonio": [29.4241, -98.4936],
  "san diego": [32.7157, -117.1611],
  "dallas": [32.7767, -96.7970],
  "san francisco": [37.7749, -122.4194],
  "seattle": [47.6062, -122.3321],
  "denver": [39.7392, -104.9903],
  "miami": [25.7617, -80.1918],
  "atlanta": [33.7490, -84.3880],
  "boston": [42.3601, -71.0589],
  "portland": [45.5152, -122.6784],
  "austin": [30.2672, -97.7431],
  "nashville": [36.1627, -86.7816],
  "charlotte": [35.2271, -80.8431],
};
const US_CENTER: [number, number] = [39.8283, -98.5795];

function getCityCenter(cityRaw: string): [number, number] {
  const key = cityRaw.toLowerCase().split(",")[0].trim();
  return CITY_CENTERS[key] || US_CENTER;
}

/**
 * Location picker for tagging a single place on a post.
 *
 * Flow:
 *   1. User types name/address → debounced API search → results dropdown
 *   2. User taps a result → it's selected (parent's value updates)
 *   3. User taps "Drop a pin instead" → opens map view (lazy-loaded mapbox-gl)
 *   4. On the map, tap-and-hold drops a marker → user names it → server
 *      either creates a new pin OR returns an existing pin within 1mi
 *
 * Mapbox token: requires NEXT_PUBLIC_MAPBOX_TOKEN env var. If missing,
 * the map view shows a friendly "map unavailable" state and the rest
 * of the picker (search/select existing) still works.
 */
export default function LocationPicker({
  value, onChange, userId, defaultCity, defaultLat, defaultLng,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  // Real-world places matched via Mapbox forward geocoding. Rendered with
  // a ✨ "tap to pin" affordance — distinct from existing pins (📍/🏢).
  const [mapboxSuggestions, setMapboxSuggestions] = useState<MapboxSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Anchor coords for proximity search ranking
  // Mapbox token — same env var used for the map display. We use it here
  // for forward geocoding (place-name → coordinates), which is what powers
  // the "✨ tap to add" suggestions for places nobody has pinned yet.
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  const [anchorLat, anchorLng] = (() => {
    if (typeof defaultLat === "number" && typeof defaultLng === "number") {
      return [defaultLat, defaultLng];
    }
    return getCityCenter(defaultCity);
  })();

  // Search runs both sources in parallel:
  //   1. Our DB (existing pins — businesses + previously-created user pins)
  //   2. Mapbox geocoding (real-world places not yet in our DB)
  // Results merge with existing pins first (since they have community context),
  // then Mapbox suggestions for one-tap pinning.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q || q.length < 2) {
      setResults([]);
      setMapboxSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        // Fire both queries in parallel — neither blocks the other.
        const [dbRes, mapboxRes] = await Promise.allSettled([
          fetch("/api/db", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "search_locations",
              payload: { query: q, nearLat: anchorLat, nearLng: anchorLng },
            }),
          }).then(r => r.json()),
          // Mapbox forward-geocoding. `proximity` biases results toward our
          // anchor coords (profile city center). `types` narrows to relevant
          // POIs + addresses; we skip countries/regions which are too broad.
          // `limit=5` keeps the dropdown manageable.
          mapboxToken
            ? fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?` +
                `access_token=${mapboxToken}` +
                `&proximity=${anchorLng},${anchorLat}` +
                `&types=poi,address,place,neighborhood,locality` +
                `&limit=5`
              ).then(r => r.json())
            : Promise.resolve(null),
        ]);

        // DB results
        const dbList: Location[] = dbRes.status === "fulfilled" && Array.isArray(dbRes.value?.locations)
          ? dbRes.value.locations : [];
        setResults(dbList);

        // Mapbox results — filter out any that are within 1mi of an existing
        // pin we already returned (avoids "tap to add the same place twice").
        const mapboxList: MapboxSuggestion[] = (() => {
          if (mapboxRes.status !== "fulfilled" || !mapboxRes.value?.features) return [];
          return mapboxRes.value.features
            .map((f: any) => {
              const [lng, lat] = f.center || [0, 0];
              const place = f.place_name || f.text || "";
              // Pull the city out of context. Mapbox returns context as an
              // array of {id, text} where the place-type 'place' is the city.
              const cityCtx = (f.context || []).find((c: any) => c.id?.startsWith("place"));
              const city = cityCtx?.text || "";
              return {
                name: f.text || place,
                fullAddress: place,
                lat,
                lng,
                city,
              } as MapboxSuggestion;
            })
            .filter((s: MapboxSuggestion) => {
              // Drop suggestions that overlap an existing DB pin within 1mi
              return !dbList.some(d => distanceMi(d.lat, d.lng, s.lat, s.lng) < 1.0);
            });
        })();
        setMapboxSuggestions(mapboxList);
      } catch {
        setResults([]);
        setMapboxSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, anchorLat, anchorLng, mapboxToken]);

  // When user taps a Mapbox suggestion, we send those coords through the
  // server's find-or-create endpoint. Server still does its own dedup check
  // so we get correct community-pin-reuse behavior automatically.
  async function pinFromMapbox(suggestion: MapboxSuggestion) {
    const cityToUse = suggestion.city || defaultCity;
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "find_or_create_location",
          payload: {
            name: suggestion.name,
            lat: suggestion.lat,
            lng: suggestion.lng,
            city: cityToUse,
            userId,
          },
        }),
      });
      const data = await res.json();
      if (data.location) {
        onChange(data.location as Location);
        setQuery("");
        setResults([]);
        setMapboxSuggestions([]);
      }
    } catch {
      // Silent fail — picker stays open, user can try again or drop a pin.
    }
  }

  if (value) {
    // Already selected — show chip with × to remove
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", background: "#1A2A1A",
        border: "1.5px solid #2D5238", borderRadius: 12,
      }}>
        <span style={{ fontSize: 18 }}>{value.kind === "business" ? "🏢" : "📍"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.name}</div>
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{value.city}{value.kind === "business" ? " · Verified business" : ""}</div>
        </div>
        <button onClick={() => onChange(null)} aria-label="Remove location"
          style={{ background: "transparent", border: "none", color: "#9CA3AF", fontSize: 18, lineHeight: 1, cursor: "pointer", padding: "0 4px" }}>×</button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search a place or business name…"
        style={{
          width: "100%", padding: "10px 14px",
          background: "#1A1228", border: "1.5px solid #2D1F52",
          borderRadius: 12, color: "#E2E8F0",
          fontSize: 14, outline: "none",
        }}
      />

      {/* Results dropdown */}
      {query.trim().length >= 2 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#111118", border: "1.5px solid #2D1F52", borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 50,
          maxHeight: 320, overflowY: "auto",
        }}>
          {searching ? (
            <div style={{ padding: 14, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Searching…</div>
          ) : (results.length > 0 || mapboxSuggestions.length > 0) ? (
            <>
              {/* Existing pins — businesses + previously-pinned community spots */}
              {results.map(loc => (
                <button key={loc.id} onMouseDown={() => { onChange(loc); setQuery(""); setResults([]); setMapboxSuggestions([]); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "12px 14px",
                    background: "transparent", border: "none",
                    borderBottom: "1px solid #2D1F52",
                    cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#2D1F52")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{loc.kind === "business" ? "🏢" : "📍"}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {loc.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                      {loc.city}{loc.kind === "business" ? " · Verified business" : ""}
                    </div>
                  </div>
                </button>
              ))}
              {/* Mapbox geocoding suggestions — places not yet pinned. Tap
                  one to create a new pin instantly using the geocoded coords.
                  Visually distinct (✨ accent color) so users know these are
                  fresh suggestions vs. community-pinned places. */}
              {mapboxSuggestions.map((s, idx) => (
                <button key={`mb-${idx}-${s.lat}-${s.lng}`} onMouseDown={() => pinFromMapbox(s)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "12px 14px",
                    background: "transparent", border: "none",
                    borderBottom: "1px solid #2D1F52",
                    cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#1F1A2E")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>✨</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.fullAddress.replace(s.name + ", ", "") || s.city}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#A78BFA", flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.6 }}>Tap to pin</span>
                </button>
              ))}
            </>
          ) : (
            <div style={{ padding: 14, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
              No matches. Drop a pin on the map to create this spot.
            </div>
          )}
        </div>
      )}

      {/* Drop-a-pin entry point — fallback for edge cases (unmarked outdoor
          spots, etc.). Most users will use search-by-name above which now
          surfaces both existing pins AND Mapbox geocoding suggestions, so
          this button gets de-emphasized but stays available. */}
      <button onClick={() => setMapOpen(true)}
        style={{
          marginTop: 8, padding: "6px 14px",
          background: "transparent", border: "none",
          color: "#9CA3AF", fontWeight: 600, fontSize: 12,
          cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3,
        }}>
        Can't find it? Drop a pin on the map manually →
      </button>

      {mapOpen && (
        <MapPickerModal
          userId={userId}
          defaultCity={defaultCity}
          defaultLat={anchorLat}
          defaultLng={anchorLng}
          onClose={() => setMapOpen(false)}
          onPicked={(loc) => { onChange(loc); setMapOpen(false); }}
        />
      )}
    </div>
  );
}

// ─── Map picker modal ─────────────────────────────────────────────────────
// Lazy-loads mapbox-gl + react-map-gl on first open so the bundle cost
// only hits users who actually drop a pin. Static import would balloon the
// post page bundle by ~150KB which is wasted on users who only tag businesses.

function MapPickerModal({
  userId, defaultCity, defaultLat, defaultLng, onClose, onPicked,
}: {
  userId: string;
  defaultCity: string;
  defaultLat: number;
  defaultLng: number;
  onClose: () => void;
  onPicked: (loc: Location) => void;
}) {
  const [MapModule, setMapModule] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  // Tap-target state: where the user has dropped a pin
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  // Naming step
  const [name, setName] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoadError("Map is unavailable. The Mapbox token isn't configured. Use the search field to pick an existing place instead.");
        return;
      }
      try {
        // Dynamic imports — these are big and we only want to pay when
        // the user actually opens the map. react-map-gl exports Map as
        // default + Marker as named; we destructure both.
        const reactMapGl = await import("react-map-gl");
        await import("mapbox-gl/dist/mapbox-gl.css");
        if (!cancelled) setMapModule(reactMapGl);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || "Couldn't load the map. Try again later.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function submitPin() {
    if (pinLat === null || pinLng === null) return;
    if (!name.trim()) { setSubmitError("Give this spot a name first."); return; }
    if (!city.trim()) { setSubmitError("What city is this in?"); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "find_or_create_location",
          payload: { name: name.trim(), lat: pinLat, lng: pinLng, city: city.trim(), userId },
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSubmitError(data.error);
        return;
      }
      if (data.location) {
        // If the server says `reused: true`, we silently use the existing
        // pin — no need to confuse the user with "we picked a different
        // pin nearby." It's the same spot, just already named.
        onPicked(data.location as Location);
      }
    } catch (e: any) {
      setSubmitError(e?.message || "Couldn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.85)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "#0D0D0D", borderRadius: 18,
        border: "1.5px solid #2D1F52", overflow: "hidden",
        width: "100%", maxWidth: 540, display: "flex", flexDirection: "column",
        maxHeight: "90vh",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #2D1F52", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#E2E8F0" }}>Drop a pin</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
              Tap the map to place your pin. We'll group nearby pins automatically.
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "#9CA3AF", fontSize: 24, lineHeight: 1, cursor: "pointer" }}>×</button>
        </div>

        {/* Map area */}
        <div style={{ height: 360, background: "#1A1228", position: "relative" }}>
          {loadError ? (
            <div style={{ padding: 24, color: "#9CA3AF", fontSize: 13, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              {loadError}
            </div>
          ) : !MapModule ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9CA3AF", fontSize: 13 }}>
              Loading map…
            </div>
          ) : (
            <MapModule.default
              mapboxAccessToken={token}
              initialViewState={{ latitude: defaultLat, longitude: defaultLng, zoom: 12 }}
              style={{ width: "100%", height: "100%" }}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              onClick={(e: any) => {
                setPinLat(e.lngLat.lat);
                setPinLng(e.lngLat.lng);
              }}
            >
              {pinLat !== null && pinLng !== null && (
                <MapModule.Marker latitude={pinLat} longitude={pinLng} anchor="bottom">
                  <div style={{ fontSize: 32, lineHeight: 1, transform: "translateY(4px)" }}>📍</div>
                </MapModule.Marker>
              )}
            </MapModule.default>
          )}
        </div>

        {/* Naming form — only shown once a pin is placed */}
        {pinLat !== null && pinLng !== null && (
          <div style={{ padding: 18, borderTop: "1px solid #2D1F52", display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>Name this spot</label>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={200}
                placeholder="e.g. Red Rock Canyon trailhead"
                style={{ width: "100%", padding: "10px 14px", background: "#1A1228", border: "1.5px solid #2D1F52", borderRadius: 10, color: "#E2E8F0", fontSize: 14, outline: "none" }}/>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 }}>City</label>
              <input value={city} onChange={e => setCity(e.target.value)} maxLength={100}
                placeholder="Las Vegas"
                style={{ width: "100%", padding: "10px 14px", background: "#1A1228", border: "1.5px solid #2D1F52", borderRadius: 10, color: "#E2E8F0", fontSize: 14, outline: "none" }}/>
            </div>
            {submitError && (
              <div style={{ fontSize: 12, color: "#FCA5A5", padding: "6px 10px", background: "#3B1F1F", borderRadius: 8 }}>⚠️ {submitError}</div>
            )}
            <button disabled={submitting} onClick={submitPin}
              style={{
                marginTop: 4, padding: "12px 16px",
                background: "linear-gradient(135deg,#7C3AED,#A78BFA)",
                border: "none", borderRadius: 12, color: "#fff",
                fontWeight: 800, fontSize: 14, cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}>
              {submitting ? "Saving…" : "Tag this spot"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

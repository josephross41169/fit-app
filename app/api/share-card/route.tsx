// app/api/share-card/route.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Server-side activity share-card image generator.
//
// Uses next/og (Satori + resvg) with AUTO-HEIGHT so the card can never clip,
// no matter how much someone logs. We pass `height: undefined` to
// ImageResponse; Satori then skips setting a fixed root height and computes
// the natural height from the content (it calls yoga's setHeightAuto + reads
// getComputedHeight). resvg renders the resulting SVG at that exact height.
// The canvas grows to contain whatever was rendered — long meal names that
// wrap, six exercises, two tall photos, all of it.
//
// Why this matters: the earlier versions guessed the height from content
// counts (meals * 72px, etc). Any content that rendered taller than the guess
// — a wrapping meal name, an extra exercise — got clipped. Auto-height removes
// the guess entirely, so clipping is structurally impossible.
//
// Contract:
//   POST /api/share-card   body: ShareCardData   →   image/png
//
// Satori constraints: flexbox only (no grid, no aspect-ratio); remote images
// are fetched server-side and inlined as data URIs; emoji via twemoji.
// ─────────────────────────────────────────────────────────────────────────────

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

interface ShareCardData {
  dateLabel: string;
  monthShort: string;
  dayNum: number;
  username?: string;
  displayName?: string;
  workout?: {
    type?: string;
    duration?: string;
    calories?: number;
    exercises?: { name: string; sets: number; reps: number; weight: string }[];
    cardio?: { type: string; duration?: string; distance?: string }[];
    photoUrls?: string[];
  } | null;
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    meals?: { key: string; name: string; cal: number; emoji?: string }[];
    photoUrls?: string[];
  } | null;
  wellness?: {
    entries?: { activity: string; emoji?: string; notes?: string; duration?: number }[];
    photoUrls?: string[];
  } | null;
}

const C = {
  text: "#F0F0F0",
  sub: "#9CA3AF",
  gold: "#F5A623",
  green: "#4ADE80",
  purple: "#7C3AED",
  purpleLt: "#A78BFA",
  card: "#160F28",
  cardBg2: "#1E1438",
  border: "#2D1F52",
};

const ALLOWED_PHOTO_HOST = "biqsvrrnnoyulrrhgitc.supabase.co";

// Nutrition photos may be plain URLs OR a per-meal JSON object string like
// {"Dinner":"url","Lunch":"url"}. Flatten both into plain URLs.
function extractPhotoUrls(raw: string[] | undefined): string[] {
  if (!raw || raw.length === 0) return [];
  const out: string[] = [];
  for (const entry of raw) {
    if (!entry) continue;
    const t = entry.trim();
    if (t.startsWith("{")) {
      try {
        const obj = JSON.parse(t);
        for (const v of Object.values(obj)) {
          if (typeof v === "string" && v) out.push(v);
        }
      } catch { /* not JSON, skip */ }
    } else {
      out.push(entry);
    }
  }
  return out;
}

// Fetch a photo server-side → data URI. Only our Supabase host is allowed.
// Returns null on failure so a broken photo is skipped, not fatal.
async function toDataUri(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== ALLOWED_PHOTO_HOST) return null;
    const res = await fetch(parsed.toString(), { credentials: "omit" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buf = await res.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function TileHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLt})`,
        padding: "18px 24px",
      }}
    >
      <div style={{ display: "flex", fontSize: 34, marginRight: 14 }}>{emoji}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontWeight: 800, fontSize: 24, color: "#fff" }}>{title}</div>
        {subtitle ? (
          <div style={{ display: "flex", fontSize: 15, color: "rgba(255,255,255,0.85)", marginTop: 3 }}>{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

function Macro({ value, label, unit, color, last }: { value: number; label: string; unit: string; color: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
        background: "#0D0D0D",
        borderRadius: 14,
        padding: "14px 8px",
        border: `1px solid ${C.border}`,
        marginRight: last ? 0 : 10,
      }}
    >
      <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ display: "flex", fontSize: 11, color: C.sub, marginTop: 3 }}>{unit}</div>
      <div style={{ display: "flex", fontSize: 11, color: C.sub, marginTop: 2, fontWeight: 700 }}>{label.toUpperCase()}</div>
    </div>
  );
}

export async function POST(req: NextRequest) {
  let data: ShareCardData;
  try {
    data = (await req.json()) as ShareCardData;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Pre-fetch nutrition photos (cap 2 for layout) as data URIs.
  const rawNutritionPhotos = extractPhotoUrls(data.nutrition?.photoUrls).slice(0, 2);
  const nutritionPhotos = (
    await Promise.all(rawNutritionPhotos.map(toDataUri))
  ).filter((u): u is string => !!u);

  const meals = (data.nutrition?.meals || []).slice(0, 8);
  const cardio = data.workout?.cardio || [];
  const exercises = (data.workout?.exercises || []).slice(0, 8);
  const wellnessEntries = (data.wellness?.entries || []).slice(0, 6);

  const hasWorkout = exercises.length > 0 || cardio.length > 0;
  const workoutSubtitle = [
    data.workout?.duration && data.workout.duration !== "—" ? `⏱ ${data.workout.duration}` : null,
    data.workout?.calories ? `🔥 ${data.workout.calories} cal` : null,
  ].filter(Boolean).join("   ");

  // Fixed per-photo height. With auto-height on the canvas, the nutrition row
  // grows to contain whichever column (meals vs photos) is taller — so these
  // never cause clipping regardless of how they compare to the meal count.
  const perPhotoH = nutritionPhotos.length === 1 ? 300 : 175;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          // NO height set → root sizes to content (auto-height).
          background: "linear-gradient(135deg, #0D0D0D 0%, #1A1230 100%)",
          padding: 40,
          fontFamily: "sans-serif",
          color: C.text,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 92,
              height: 92,
              borderRadius: 22,
              background: `linear-gradient(135deg, ${C.green}, ${C.purple})`,
              marginRight: 22,
            }}
          >
            <div style={{ display: "flex", color: "#fff", fontWeight: 800, fontSize: 36 }}>{data.dayNum}</div>
            <div style={{ display: "flex", color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 700, marginTop: 2 }}>
              {data.monthShort}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontWeight: 800, fontSize: 38, color: C.text }}>{data.dateLabel}</div>
            {data.displayName ? (
              <div style={{ display: "flex", fontSize: 19, color: C.sub, marginTop: 4 }}>
                {data.displayName}{data.username ? ` · @${data.username}` : ""}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: C.purpleLt }}>Livelee</div>
            <div style={{ display: "flex", fontSize: 14, color: C.sub, marginTop: 4 }}>liveleeapp.com</div>
          </div>
        </div>

        {/* Workout + Wellness row */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", marginBottom: 22 }}>
          {/* Workout */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              marginRight: 22,
              background: C.card,
              borderRadius: 20,
              border: `1px solid ${C.border}`,
              overflow: "hidden",
            }}
          >
            <TileHeader emoji="💪" title={data.workout?.type || "Workout"} subtitle={hasWorkout ? (workoutSubtitle || undefined) : undefined} />
            <div style={{ display: "flex", flexDirection: "column", padding: 20 }}>
              {!hasWorkout ? (
                <div style={{ display: "flex", fontSize: 16, color: C.sub, justifyContent: "center", padding: "20px 0" }}>
                  Rest day
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {cardio.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 8 }}>🏃 CARDIO</div>
                      {cardio.map((c, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 6, paddingBottom: 6 }}>
                          <div style={{ display: "flex", fontWeight: 700, color: C.text, fontSize: 16 }}>{c.type}</div>
                          <div style={{ display: "flex", flexDirection: "row" }}>
                            {c.distance ? <div style={{ display: "flex", color: C.gold, fontWeight: 800, fontSize: 15, marginRight: 14 }}>{c.distance} mi</div> : null}
                            {c.duration ? <div style={{ display: "flex", color: C.purpleLt, fontWeight: 800, fontSize: 15 }}>{c.duration} min</div> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {exercises.map((e, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, paddingBottom: 8, borderTop: i > 0 || cardio.length > 0 ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ display: "flex", fontWeight: 700, color: C.text, fontSize: 15 }}>{e.name}</div>
                      <div style={{ display: "flex", color: C.gold, fontWeight: 800, fontSize: 14 }}>{e.weight || `${e.sets}×${e.reps}`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Wellness */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: C.card,
              borderRadius: 20,
              border: `1px solid ${C.border}`,
              overflow: "hidden",
            }}
          >
            <TileHeader emoji="🌿" title="Wellness" subtitle={wellnessEntries.length > 0 ? wellnessEntries.map(e => e.activity).slice(0, 3).join(" · ") : undefined} />
            <div style={{ display: "flex", flexDirection: "column", padding: 20 }}>
              {wellnessEntries.length === 0 ? (
                <div style={{ display: "flex", fontSize: 16, color: C.sub, justifyContent: "center", padding: "20px 0" }}>
                  None logged
                </div>
              ) : (
                wellnessEntries.map((e, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "row", alignItems: "center", paddingTop: 8, paddingBottom: 8 }}>
                    <div style={{ display: "flex", fontSize: 22, marginRight: 12 }}>{e.emoji || "🌿"}</div>
                    <div style={{ display: "flex", flex: 1, fontWeight: 700, color: C.text, fontSize: 16 }}>{e.activity}</div>
                    {typeof e.duration === "number" && e.duration > 0 ? (
                      <div style={{ display: "flex", fontSize: 14, fontWeight: 800, color: C.purpleLt }}>{e.duration} min</div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Nutrition */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: C.card,
            borderRadius: 20,
            border: `1px solid ${C.border}`,
            overflow: "hidden",
          }}
        >
          <TileHeader
            emoji="🥗"
            title="Nutrition"
            subtitle={data.nutrition ? `${data.nutrition.calories} kcal · ${data.nutrition.protein}g protein` : undefined}
          />
          <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", padding: 20 }}>
            {/* Left: macros + meals */}
            <div style={{ display: "flex", flexDirection: "column", flex: nutritionPhotos.length > 0 ? 1.4 : 1, marginRight: nutritionPhotos.length > 0 ? 20 : 0 }}>
              {/* Macros */}
              <div style={{ display: "flex", flexDirection: "row", marginBottom: 16 }}>
                <Macro value={data.nutrition?.calories ?? 0} label="Calories" unit="kcal" color={C.gold} />
                <Macro value={data.nutrition?.protein ?? 0} label="Protein" unit="g" color="#3B82F6" />
                <Macro value={data.nutrition?.carbs ?? 0} label="Carbs" unit="g" color={C.purpleLt} />
                <Macro value={data.nutrition?.fat ?? 0} label="Fat" unit="g" color={C.green} last />
              </div>
              {/* Meals */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {meals.map((m, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "row", alignItems: "center", background: C.cardBg2, borderRadius: 12, padding: "12px 16px", marginBottom: 8, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", fontSize: 20, marginRight: 12 }}>{m.emoji || "🍽️"}</div>
                    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                      <div style={{ display: "flex", fontWeight: 800, fontSize: 15, color: C.text }}>{m.key}</div>
                      {m.name ? (
                        <div style={{ display: "flex", fontSize: 13, color: C.sub, marginTop: 2 }}>{m.name}</div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", fontSize: 15, fontWeight: 800, color: C.gold, marginLeft: 10 }}>{m.cal} kcal</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: photos */}
            {nutritionPhotos.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                {nutritionPhotos.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    style={{
                      width: "100%",
                      height: perPhotoH,
                      objectFit: "cover",
                      borderRadius: 14,
                      border: `1px solid ${C.border}`,
                      marginBottom: i < nutritionPhotos.length - 1 ? 12 : 0,
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      // height OMITTED on purpose → forwarded to satori as undefined →
      // satori auto-computes the natural height → nothing ever clips.
      height: undefined,
      emoji: "twemoji",
    },
  );
}

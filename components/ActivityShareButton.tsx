"use client";
// ─────────────────────────────────────────────────────────────────────────────
// components/ActivityShareButton.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Generates a 2x1-grid share image of an activity day card and downloads it
// as a PNG. Layout:
//
//     ┌─────────────┬─────────────┐
//     │  Workout    │   Wellness  │
//     ├─────────────┴─────────────┤
//     │      Nutrition (wide)     │
//     └───────────────────────────┘
//
// Why this layout:
//   - Workout + Wellness on top: both fit comfortably in half-widths since
//     wellness usually has 1-3 short entries and workout has tabular data.
//   - Nutrition full-width on the bottom: meals plus photos need horizontal
//     space; food pics look better laid out in a row than cropped narrow.
//   - Result is roughly 1.4:1 — works as Instagram feed post, X, Facebook.
//
// CORS handling:
//   Supabase storage serves photos with CORS headers, but if any image
//   fails to load with crossOrigin='anonymous' it would taint the canvas
//   and html2canvas would throw. We pre-validate each photo URL before
//   render and silently drop any that won't load — better to ship a
//   share image without a broken photo than crash the share entirely.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// What the caller passes in. All sections optional — missing ones render
// an empty-state tile so the layout stays consistent.
export interface ShareCardData {
  dateLabel: string;
  monthShort: string;
  dayNum: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;

  workout?: {
    type?: string;
    duration?: string;
    calories?: number;
    exercises?: { name: string; sets: number; reps: number; weight: string }[];
    cardio?: { type: string; duration?: string; distance?: string }[];
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
  } | null;
}

interface Props {
  data: ShareCardData;
  filename?: string;
  style?: React.CSSProperties;
}

// ─── Composition dimensions ──────────────────────────────────────────────────
const SHARE_W = 1600;

const C = {
  bg:       "#0D0D0D",
  card:     "#1A1230",
  cardBg2:  "#1E1530",
  border:   "#3D2A6E",
  purple:   "#7C3AED",
  purpleLt: "#A78BFA",
  text:     "#F0F0F0",
  sub:      "#9CA3AF",
  gold:     "#F5A623",
  green:    "#22C55E",
};

// Pre-validate a photo URL: try to load it with crossOrigin='anonymous' and
// return true iff it loaded without a CORS taint. We use this to filter
// out any URLs that would crash html2canvas. 4-second timeout per image
// so a hanging URL can't hang the share flow.
function probeImage(url: string): Promise<boolean> {
  return new Promise(resolve => {
    if (!url) return resolve(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    img.onload = () => finish(img.naturalWidth > 0);
    img.onerror = () => finish(false);
    img.src = url;
    setTimeout(() => finish(false), 4000);
  });
}

// ─── Main button + portal trigger ────────────────────────────────────────────
export default function ActivityShareButton({
  data,
  filename = "livelee-activity",
  style,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [safePhotos, setSafePhotos] = useState<string[]>([]);
  const shareNodeRef = useRef<HTMLDivElement | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);

    try {
      // Pre-flight: filter photo URLs to ones that load cleanly with CORS.
      // Anything that fails (404, CORS denied, slow-as-mud) is dropped so
      // it can't taint the canvas later. We do this BEFORE mounting the
      // share composition so the composition only renders safe images.
      const candidatePhotos = (data.nutrition?.photoUrls || []).slice(0, 4);
      const probes = await Promise.all(candidatePhotos.map(probeImage));
      const safe = candidatePhotos.filter((_, i) => probes[i]);
      setSafePhotos(safe);

      // Now mount the off-screen composition.
      setSnapshotMode(true);

      // Wait for React commit + paint.
      await new Promise(r => setTimeout(r, 400));

      const node = shareNodeRef.current;
      if (!node) throw new Error("Share composition failed to mount");

      // Wait for any <img> inside the composition to fully paint. After the
      // probe filter above, all remaining images load cleanly — but they
      // still need a moment to actually render in the DOM.
      const imgs = Array.from(node.querySelectorAll("img"));
      await Promise.all(
        imgs.map(img =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>(resolve => {
                const done = () => resolve();
                img.addEventListener("load", done, { once: true });
                img.addEventListener("error", done, { once: true });
                setTimeout(done, 3000);
              })
        )
      );

      // Dynamic import — keeps html2canvas (~50KB gz) out of main bundle.
      const html2canvasMod = await import("html2canvas");
      const html2canvas = html2canvasMod.default;

      const canvas = await html2canvas(node, {
        backgroundColor: "#0D0D0D",
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: false,
        windowWidth: SHARE_W,
        windowHeight: node.offsetHeight,
        // Ignore any element that html2canvas might choke on. We don't
        // expect this list to do much given the composition is built from
        // simple divs + validated images, but it's a safety net.
        ignoreElements: (el) => {
          // Skip iframes and videos which html2canvas can't render.
          const tag = el.tagName.toLowerCase();
          return tag === "iframe" || tag === "video";
        },
      });

      const blob: Blob | null = await new Promise(resolve => {
        canvas.toBlob(b => resolve(b), "image/png", 0.95);
      });
      if (!blob) throw new Error("Failed to encode PNG");

      const fname = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
      const url = URL.createObjectURL(blob);

      const isIOSSafari =
        typeof navigator !== "undefined" &&
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

      if (isIOSSafari) {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("[share] capture failed", err);
      alert("Couldn't generate the share image. Try again, or take a regular screenshot.");
    } finally {
      setSnapshotMode(false);
      setBusy(false);
      setSafePhotos([]);
    }
  }

  // Build the data passed to the composition with only the safe photos.
  const dataForRender: ShareCardData = {
    ...data,
    nutrition: data.nutrition
      ? { ...data.nutrition, photoUrls: safePhotos }
      : data.nutrition,
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={busy}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: busy ? "#2D1F52" : "rgba(124,58,237,0.15)",
          border: "1.5px solid rgba(124,58,237,0.4)",
          color: "#A78BFA",
          fontSize: 15,
          cursor: busy ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          ...style,
        }}
        aria-label="Download activity card as image"
        title="Download as image"
      >
        {busy ? "⏳" : "📸"}
      </button>

      {snapshotMode && typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: -99999,
              width: SHARE_W,
              zIndex: -1,
              pointerEvents: "none",
            }}
          >
            <ShareComposition data={dataForRender} forwardedRef={shareNodeRef} />
          </div>,
          document.body
        )
      }
    </>
  );
}

// ─── Composition: the actual shareable layout ────────────────────────────────
function ShareComposition({
  data,
  forwardedRef,
}: {
  data: ShareCardData;
  forwardedRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={forwardedRef}
      style={{
        width: SHARE_W,
        background: `linear-gradient(135deg, #0D0D0D 0%, #1A1230 100%)`,
        padding: 40,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: C.text,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32 }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 22,
            background: `linear-gradient(135deg, #4ADE80, ${C.green})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 20px rgba(74,222,128,0.35)",
            flexShrink: 0,
          }}
        >
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 36, lineHeight: 1 }}>{data.dayNum}</div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 700, marginTop: 2 }}>{data.monthShort}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 38, color: C.text, lineHeight: 1.1 }}>{data.dateLabel}</div>
          {data.displayName && (
            <div style={{ fontSize: 20, color: C.sub, marginTop: 6 }}>
              {data.displayName}{data.username ? ` · @${data.username}` : ""}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: C.purpleLt, letterSpacing: -0.5 }}>Livelee</div>
          <div style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>liveleeapp.com</div>
        </div>
      </div>

      {/* Top row: workout + wellness */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WorkoutTile workout={data.workout} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WellnessTile wellness={data.wellness} />
        </div>
      </div>

      {/* Bottom: nutrition full width */}
      <NutritionTile nutrition={data.nutrition} />
    </div>
  );
}

function TileHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLt})`,
        padding: "20px 26px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 38, lineHeight: 1 }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 24, color: "#fff", lineHeight: 1.1 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

function WorkoutTile({ workout }: { workout: ShareCardData["workout"] }) {
  if (!workout || (!workout.exercises?.length && !workout.cardio?.length)) {
    return <EmptyTile emoji="💪" title="Workout" message="Rest day" />;
  }
  const subtitle = [
    workout.duration && workout.duration !== "—" ? `⏱ ${workout.duration}` : null,
    workout.calories ? `🔥 ${workout.calories} cal` : null,
  ].filter(Boolean).join("  ·  ");

  return (
    <div style={{ background: C.card, borderRadius: 22, overflow: "hidden", border: `2px solid ${C.border}` }}>
      <TileHeader emoji="💪" title={workout.type || "Workout"} subtitle={subtitle || undefined} />
      <div style={{ padding: 22 }}>
        {workout.exercises && workout.exercises.length > 0 && (
          <div style={{ marginBottom: workout.cardio && workout.cardio.length > 0 ? 18 : 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 100px", gap: 8, fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, padding: "0 4px" }}>
              <div>Exercise</div>
              <div style={{ textAlign: "center" }}>Sets</div>
              <div style={{ textAlign: "center" }}>Reps</div>
              <div style={{ textAlign: "right" }}>Weight</div>
            </div>
            {workout.exercises.slice(0, 8).map((e, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 100px", gap: 8, padding: "10px 4px", borderTop: `1px solid ${C.border}`, fontSize: 15, alignItems: "center" }}>
                <div style={{ fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                <div style={{ textAlign: "center", color: C.purpleLt, fontWeight: 800 }}>{e.sets}</div>
                <div style={{ textAlign: "center", color: C.purpleLt, fontWeight: 800 }}>{e.reps}</div>
                <div style={{ textAlign: "right", color: C.gold, fontWeight: 800, fontSize: 14 }}>{e.weight || "—"}</div>
              </div>
            ))}
            {workout.exercises.length > 8 && (
              <div style={{ padding: "10px 4px", fontSize: 13, color: C.sub, textAlign: "center", fontStyle: "italic" }}>+{workout.exercises.length - 8} more</div>
            )}
          </div>
        )}

        {workout.cardio && workout.cardio.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🏃 Cardio</div>
            {workout.cardio.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{c.type}</div>
                <div style={{ display: "flex", gap: 14, fontSize: 14 }}>
                  {c.distance && <span style={{ color: C.gold, fontWeight: 800 }}>{c.distance} mi</span>}
                  {c.duration && <span style={{ color: C.purpleLt, fontWeight: 800 }}>{c.duration} min</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WellnessTile({ wellness }: { wellness: ShareCardData["wellness"] }) {
  if (!wellness || !wellness.entries || wellness.entries.length === 0) {
    return <EmptyTile emoji="🌿" title="Wellness" message="None logged" />;
  }
  return (
    <div style={{ background: C.card, borderRadius: 22, overflow: "hidden", border: `2px solid ${C.border}` }}>
      <TileHeader
        emoji="🌿"
        title="Wellness"
        subtitle={wellness.entries.map(e => e.activity).slice(0, 3).join(" · ")}
      />
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        {wellness.entries.map((e, i) => (
          <div key={i} style={{ background: C.cardBg2, borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, border: `1px solid ${C.border}` }}>
            <div style={{ width: 52, height: 52, borderRadius: 13, background: "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
              {e.emoji || "🌿"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: C.text }}>{e.activity}</div>
              {e.notes && <div style={{ fontSize: 14, color: C.sub, marginTop: 3 }}>{e.notes}</div>}
            </div>
            {typeof e.duration === "number" && e.duration > 0 && (
              <div style={{ fontSize: 14, fontWeight: 800, color: C.purpleLt, padding: "6px 12px", borderRadius: 12, background: "rgba(124,58,237,0.15)" }}>
                {e.duration} min
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NutritionTile({ nutrition }: { nutrition: ShareCardData["nutrition"] }) {
  if (!nutrition || (!nutrition.meals?.length && !nutrition.calories)) {
    return <EmptyTile emoji="🥗" title="Nutrition" message="None logged" />;
  }
  // Photos are already pre-validated by the parent — only safe ones reach
  // here. Cap at 4 for layout (2x2 grid).
  const photos = (nutrition.photoUrls || []).slice(0, 4);
  return (
    <div style={{ background: C.card, borderRadius: 22, overflow: "hidden", border: `2px solid ${C.border}` }}>
      <TileHeader
        emoji="🥗"
        title="Nutrition"
        subtitle={`${nutrition.calories} kcal · ${nutrition.protein}g protein`}
      />
      <div style={{ padding: 22, display: "flex", gap: 24 }}>
        <div style={{ flex: photos.length > 0 ? "1.5" : "1", minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
            <Macro value={nutrition.calories} label="Calories" unit="kcal" color={C.gold} />
            <Macro value={nutrition.protein} label="Protein" unit="g" color="#3B82F6" />
            <Macro value={nutrition.carbs} label="Carbs" unit="g" color={C.purpleLt} />
            <Macro value={nutrition.fat} label="Fat" unit="g" color={C.green} />
          </div>

          {nutrition.meals && nutrition.meals.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {nutrition.meals.slice(0, 5).map((m, i) => (
                <div key={i} style={{ background: C.cardBg2, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, border: `1px solid ${C.border}` }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {m.emoji || "🍽️"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{m.key}</div>
                    <div style={{ fontSize: 13, color: C.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: C.gold, flexShrink: 0 }}>{m.cal} kcal</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {photos.length > 0 && (
          <div style={{ flex: "1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignContent: "start" }}>
            {photos.map((url, i) => (
              <div key={i} style={{ aspectRatio: "1 / 1", borderRadius: 14, overflow: "hidden", border: `2px solid ${C.border}` }}>
                <img
                  src={url}
                  crossOrigin="anonymous"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  alt=""
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Macro({ value, label, unit, color }: { value: number; label: string; unit: string; color: string }) {
  return (
    <div style={{ background: "#0D0D0D", borderRadius: 14, padding: "14px 12px", textAlign: "center", border: `1.5px solid ${C.border}` }}>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{unit}</div>
      <div style={{ fontSize: 11, color: C.sub, marginTop: 2, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function EmptyTile({ emoji, title, message }: { emoji: string; title: string; message: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 22, overflow: "hidden", border: `2px solid ${C.border}`, height: "100%" }}>
      <TileHeader emoji={emoji} title={title} />
      <div style={{ padding: "44px 22px", textAlign: "center" }}>
        <div style={{ fontSize: 17, color: C.sub, fontStyle: "italic" }}>{message}</div>
      </div>
    </div>
  );
}

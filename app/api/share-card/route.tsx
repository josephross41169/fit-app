// app/api/share-card/route.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Share my day" image. POST a ShareCardV2 (lib/shareCard.ts) → PNG.
//
// One FIXED layout so every card looks the same, whether or not there are
// photos:
//   story = 1080×1920 (Instagram/TikTok stories), post = 1080×1350 (feed 4:5)
//   ┌ photo area (2 photos side by side │ 1 photo │ branded background) ┐
//   │ name · date                                                         │
//   │ [Weight lifting] [Cardio] [Wellness]  ← only the ones logged        │
//   │ [Badges today]                                                      │
//   └ Livelee footer ─────────────────────────────────────────────────────┘
// Because the size is fixed, long days are trimmed to fit with "+N more"
// rather than growing the image (see fitToHeight).
//
// Older callers that still POST the v1 shape are converted (fromLegacy).
// Satori constraints: flexbox only; remote images are inlined as data URIs.
// ─────────────────────────────────────────────────────────────────────────────

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import type { ShareCardV2 } from "@/lib/shareCard";

export const runtime = "edge";

const W = 1080;
const SIZES = { story: { h: 1920, hero: 640 }, post: { h: 1350, hero: 450 } } as const;
const PAD = 48;                 // left/right page padding
const FOOT_H = 110;
const GAP = 22;                 // between section boxes
const SEC_PAD_Y = 26, SEC_PAD_X = 32;
const SEC_HEAD_H = 54;
const ROW_H = 56;
const MORE_H = 44;
const CHIP_H = 64, CHIP_GAP = 14;
const BADGE_SZ = 116;

const C = {
  bg: "#0B100D", card: "#111813", border: "#1C2721", text: "#F0F0F0", sub: "#8A968F",
  rowText: "#C9D1CC", green: "#4A9D6E", mint: "#8FD6AE", gold: "#F5A623", blue: "#5BC0EB", purple: "#C49BFF",
};

const EMOJI_RE = new RegExp("[\\p{Extended_Pictographic}\\u{FE0F}\\u{200D}]", "gu");
const PHOTO_HOST = "biqsvrrnnoyulrrhgitc.supabase.co";

// Nunito (the app font) from Google Fonts, cached per server instance. If it
// can't be loaded the card still renders in the built-in font.
const fontCache = new Map<number, Promise<ArrayBuffer | null>>();
function loadNunito(weight: number): Promise<ArrayBuffer | null> {
  let p = fontCache.get(weight);
  if (!p) {
    p = (async () => {
      try {
        const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Nunito:wght@${weight}`)).text();
        const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
        if (!url) return null;
        const res = await fetch(url);
        return res.ok ? await res.arrayBuffer() : null;
      } catch { return null; }
    })();
    p.then(v => { if (!v) fontCache.delete(weight); });
    fontCache.set(weight, p);
  }
  return p;
}

function b64(buf: ArrayBuffer): string {
  let s = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(s);
}

/** Fetch an image → data URI. Only our Supabase storage, our own site, or data: URIs. */
async function inline(src: string | null | undefined, origin: string): Promise<string | null> {
  if (!src) return null;
  try {
    if (src.startsWith("data:image/")) return /^data:image\/(png|jpeg|gif|svg\+xml)[;,]/.test(src) && src.length < 6_000_000 ? src : null;
    const url = new URL(src, origin);
    if (url.hostname !== PHOTO_HOST && url.origin !== origin) return null;
    const res = await fetch(url.toString(), { credentials: "omit" });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    // The image renderer only understands PNG / JPEG / GIF / SVG.
    if (!["image/png", "image/jpeg", "image/gif", "image/svg+xml"].includes(type)) return null;
    return `data:${type};base64,${b64(await res.arrayBuffer())}`;
  } catch { return null; }
}

// ── v1 → v2 (for callers that haven't been updated) ──
function fromLegacy(d: any): ShareCardV2 {
  const ex = (d?.workout?.exercises || []).filter((e: any) => e?.name);
  const cardio = d?.workout?.cardio || [];
  const well = d?.wellness?.entries || [];
  return {
    v: 2, format: "story",
    name: d?.displayName || d?.username || "Livelee athlete", username: d?.username, avatarUrl: d?.avatarUrl || null,
    dateLabel: d?.dateLabel || "",
    photos: [...(d?.workout?.photoUrls || []).slice(0, 1).map((url: string) => ({ url, label: "💪 Workout" })),
             ...(d?.wellness?.photoUrls || []).slice(0, 1).map((url: string) => ({ url, label: "🧘 Wellness" }))],
    lifting: ex.length ? { meta: d?.workout?.duration && d.workout.duration !== "—" ? d.workout.duration : "", rows: ex.map((e: any) => ({ name: e.name, detail: e.sets ? `${e.sets} × ${e.reps || "—"}` : "" })) } : null,
    cardio: cardio.length ? { meta: "", rows: cardio.map((c: any) => ({ name: c.type || "Cardio", detail: [c.distance, c.duration].filter((x: any) => x && x !== "—").join(" · ") })) } : null,
    wellness: well.length ? { meta: "", items: well.map((e: any) => ({ emoji: e.emoji || "🌿", name: e.activity || "Wellness", detail: e.duration ? `${e.duration} min` : "" })) } : null,
    badges: [], badgeNote: "",
  };
}

// ── Fit everything into the fixed height ──
// Estimates each box's height and trims the longest list (adding "+N more")
// until the stack fits. Estimates are deliberately a little generous.
function chipRows(items: { name: string; detail: string }[], innerW: number): number {
  let rows = 1, x = 0;
  for (const it of items) {
    const w = 70 + (it.name.length + (it.detail ? it.detail.length + 1 : 0)) * 19;
    if (x > 0 && x + w > innerW) { rows++; x = 0; }
    x += w + CHIP_GAP;
  }
  return rows;
}
function fitToHeight(d: ShareCardV2, avail: number) {
  const innerW = W - PAD * 2 - SEC_PAD_X * 2;
  let lift = d.lifting?.rows.length || 0, card = d.cardio?.rows.length || 0, well = d.wellness?.items.length || 0;
  let badges = d.badges.length > 0;
  const box = (rows: number, total: number) => SEC_PAD_Y * 2 + SEC_HEAD_H + rows * ROW_H + (total > rows ? MORE_H : 0);
  const height = () => {
    const parts: number[] = [];
    if (d.lifting) parts.push(box(lift, d.lifting.rows.length));
    if (d.cardio) parts.push(box(card, d.cardio.rows.length));
    if (d.wellness) parts.push(SEC_PAD_Y * 2 + SEC_HEAD_H + chipRows(d.wellness.items.slice(0, well), innerW) * (CHIP_H + CHIP_GAP) + (d.wellness.items.length > well ? MORE_H : 0));
    if (badges) parts.push(SEC_PAD_Y * 2 + SEC_HEAD_H + BADGE_SZ);
    return parts.reduce((a, b) => a + b, 0) + Math.max(0, parts.length - 1) * GAP;
  };
  let guard = 200;
  while (height() > avail && guard-- > 0) {
    if (lift > 2 && lift >= card) lift--;
    else if (card > 2) card--;
    else if (well > 2) well--;
    else if (badges) badges = false;
    else if (lift > 1) lift--;
    else if (card > 1) card--;
    else if (well > 1) well--;
    else break;
  }
  return { lift, card, well, badges };
}

function Section({ title, color, meta, children }: { title: string; color: string; meta?: string; children: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", background: C.card, border: `2px solid ${C.border}`, borderRadius: 34, padding: `${SEC_PAD_Y}px ${SEC_PAD_X}px` }}>
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: SEC_HEAD_H }}>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 900, letterSpacing: 3, color }}>{title}</div>
        {meta ? <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: C.sub, maxWidth: 560, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{meta}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Rows({ rows, shown }: { rows: { name: string; detail: string }[]; shown: number }) {
  const extra = rows.length - shown;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.slice(0, shown).map((r, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: ROW_H }}>
          <div style={{ display: "flex", flex: 1, fontSize: 36, fontWeight: 800, color: C.text, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", marginRight: 24 }}>{r.name}</div>
          {r.detail ? <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: C.rowText, whiteSpace: "nowrap" }}>{r.detail}</div> : null}
        </div>
      ))}
      {extra > 0 ? <div style={{ display: "flex", height: MORE_H, alignItems: "center", fontSize: 30, fontWeight: 800, color: C.sub }}>+{extra} more</div> : null}
    </div>
  );
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const d: ShareCardV2 = body?.v === 2 ? body : fromLegacy(body);
  const size = SIZES[d.format === "post" ? "post" : "story"];
  const origin = req.nextUrl.origin;

  const [f800, f900, logo, avatar, ...rest] = await Promise.all([
    loadNunito(800), loadNunito(900),
    inline("/logo-icon.svg", origin),
    inline(d.avatarUrl, origin),
    ...d.photos.slice(0, 2).map(p => inline(p.url, origin)),
    // Badge art is WebP on the site, which the renderer can't read, so the
    // share screen converts each badge to a PNG data URL before sending.
    ...d.badges.slice(0, 5).map(b => inline(b.img, origin)),
  ]);
  const nPhotos = Math.min(2, d.photos.length);
  const photos = d.photos.slice(0, 2).map((p, i) => ({ ...p, src: rest[i] as string | null })).filter(p => p.src);
  const badgeImgs = (rest.slice(nPhotos) as (string | null)[]).filter(Boolean) as string[];

  const avail = size.h - size.hero - FOOT_H - 26 /* top gap */ - 10;
  const fit = fitToHeight({ ...d, badges: badgeImgs.map(img => ({ img })) }, avail);

  const logged = [d.lifting && "Lift", d.cardio && "Cardio", d.wellness && "Wellness"].filter(Boolean) as string[];
  const initial = (d.name || "?").trim().charAt(0).toUpperCase();

  // strip=true removes emoji (used if the emoji CDN can't be reached, since
  // the renderer would otherwise try to download a font for them).
  const buildTree = (strip: boolean) => {
  const E = (t: string) => strip ? t.replace(EMOJI_RE, "").replace(/\s+/g, " ").trim() : t;
  return (
      <div style={{ display: "flex", flexDirection: "column", width: W, height: size.h, background: C.bg, fontFamily: "Nunito", color: C.text }}>
        {/* ── Photo area (always the same height) ── */}
        <div style={{ display: "flex", position: "relative", width: W, height: size.hero, overflow: "hidden" }}>
          {photos.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "row", width: W, height: size.hero }}>
              {photos.map((p, i) => (
                <div key={i} style={{ display: "flex", position: "relative", width: photos.length === 2 ? (W - 8) / 2 : W, height: size.hero, marginLeft: i === 1 ? 8 : 0 }}>
                  <img src={p.src as string} width={photos.length === 2 ? (W - 8) / 2 : W} height={size.hero} style={{ objectFit: "cover" }} />
                  <div style={{ display: "flex", position: "absolute", top: 30, left: 30, background: "rgba(0,0,0,0.55)", borderRadius: 99, padding: "10px 24px", fontSize: 30, fontWeight: 900 }}>{E(p.label)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", width: W, height: size.hero, backgroundImage: "radial-gradient(circle at 78% 25%, #2E7D54 0%, #123322 42%, #0B100D 78%)" }}>
              {strip ? null : <div style={{ display: "flex", position: "absolute", right: -40, top: -30, fontSize: 440, opacity: 0.14 }}>💪</div>}
              {/* Headline sits in the top part, clear of the name row at the bottom. */}
              <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: PAD, top: size.hero > 500 ? 70 : 50 }}>
                <div style={{ display: "flex", fontSize: 32, fontWeight: 900, letterSpacing: 4, color: C.mint, marginBottom: 6 }}>TODAY</div>
                {size.hero > 500
                  ? (logged.length ? logged : ["Rest day"]).map(l => (
                      <div key={l} style={{ display: "flex", fontSize: 84, fontWeight: 900, lineHeight: 1 }}>{l}</div>
                    ))
                  : <div style={{ display: "flex", fontSize: 68, fontWeight: 900, lineHeight: 1 }}>{(logged.length ? logged : ["Rest day"]).join(" · ")}</div>}
              </div>
            </div>
          )}
          {/* fade into the page + who */}
          <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, height: 280, backgroundImage: "linear-gradient(to bottom, rgba(11,16,13,0), #0B100D)" }} />
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", position: "absolute", left: PAD, right: PAD, bottom: 26 }}>
            {avatar
              ? <img src={avatar} width={104} height={104} style={{ borderRadius: 52, border: `5px solid ${C.green}`, objectFit: "cover" }} />
              : <div style={{ display: "flex", width: 104, height: 104, borderRadius: 52, background: "#2E5E45", border: `5px solid ${C.green}`, alignItems: "center", justifyContent: "center", fontSize: 46, fontWeight: 900 }}>{initial}</div>}
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 26 }}>
              <div style={{ display: "flex", fontSize: 50, fontWeight: 900 }}>{E(d.name)}</div>
              <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: C.mint }}>{[d.dateLabel, d.username ? `@${d.username}` : ""].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
        </div>

        {/* ── Sections ── */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: `26px ${PAD}px 0` }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {d.lifting ? (
              <div style={{ display: "flex", marginBottom: GAP, flexDirection: "column" }}>
                <Section title={E("🏋️ WEIGHT LIFTING")} color={C.gold} meta={d.lifting.meta}><Rows rows={d.lifting.rows.map(r => ({ name: E(r.name), detail: E(r.detail) }))} shown={fit.lift} /></Section>
              </div>
            ) : null}
            {d.cardio ? (
              <div style={{ display: "flex", marginBottom: GAP, flexDirection: "column" }}>
                <Section title={E("🏃 CARDIO")} color={C.blue} meta={d.cardio.meta}><Rows rows={d.cardio.rows.map(r => ({ name: E(r.name), detail: E(r.detail) }))} shown={fit.card} /></Section>
              </div>
            ) : null}
            {d.wellness ? (
              <div style={{ display: "flex", marginBottom: GAP, flexDirection: "column" }}>
                <Section title={E("🧘 WELLNESS")} color={C.purple} meta={d.wellness.meta}>
                  <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap" }}>
                    {d.wellness.items.slice(0, fit.well).map((it, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "row", alignItems: "center", height: CHIP_H, padding: "0 26px", marginRight: CHIP_GAP, marginBottom: CHIP_GAP, borderRadius: 99, background: "#17211B", border: "2px solid #243329", fontSize: 32, fontWeight: 800 }}>
                        {strip ? null : <span style={{ marginRight: 12 }}>{it.emoji}</span>}
                        <span>{E(it.name)}</span>
                        {it.detail ? <span style={{ marginLeft: 12, color: C.purple }}>{it.detail}</span> : null}
                      </div>
                    ))}
                  </div>
                  {d.wellness.items.length > fit.well ? <div style={{ display: "flex", height: MORE_H, alignItems: "center", fontSize: 30, fontWeight: 800, color: C.sub }}>+{d.wellness.items.length - fit.well} more</div> : null}
                </Section>
              </div>
            ) : null}
            {fit.badges && badgeImgs.length ? (
              <Section title={E("🏅 BADGES TODAY")} color={C.mint}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", height: BADGE_SZ }}>
                  {badgeImgs.map((src, i) => <img key={i} src={src} width={BADGE_SZ} height={BADGE_SZ} style={{ marginRight: 18 }} />)}
                  {d.badgeNote ? <div style={{ display: "flex", flex: 1, fontSize: 30, fontWeight: 800, color: C.sub, marginLeft: 8 }}>{d.badgeNote}</div> : null}
                </div>
              </Section>
            ) : null}
          </div>

          {/* ── Footer ── */}
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: FOOT_H, borderTop: `2px solid ${C.border}` }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", fontSize: 44, fontWeight: 900, color: C.green }}>
              {logo ? <img src={logo} width={52} height={52} style={{ marginRight: 14, borderRadius: 12 }} /> : null}Livelee
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: C.sub }}>liveleeapp.com</div>
          </div>
        </div>
      </div>
    );
  };
  const fonts = [
    ...(f800 ? [{ name: "Nunito", data: f800, weight: 800 as const, style: "normal" as const }] : []),
    ...(f900 ? [{ name: "Nunito", data: f900, weight: 900 as const, style: "normal" as const }] : []),
  ];
  // Render fully before replying so a failure can be retried: emoji images
  // come from a CDN, and if that's unreachable we still return a card
  // (just without emoji) instead of an error.
  const render = async (withEmoji: boolean) => {
    const img = new ImageResponse(buildTree(!withEmoji), { width: W, height: size.h, ...(fonts.length ? { fonts } : {}), ...(withEmoji ? { emoji: "twemoji" as const } : {}) });
    return await img.arrayBuffer();
  };
  let png: ArrayBuffer;
  try { png = await render(true); }
  catch (e) { console.warn("[share-card] retrying without emoji", e); png = await render(false); }
  return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}

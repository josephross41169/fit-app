"use client";
// ─────────────────────────────────────────────────────────────────────────────
// Profile "boxes" layout (mobile).
//
// The profile body (phone AND desktop) is a 2×2 grid of tiles — Highlights, Activity,
// Badges, Goals. Tapping a tile slides in a full-screen sheet holding that
// section. The existing section JSX in profile/page.tsx is wrapped in
// <InTile slot="…"> and PORTALED into the sheet, so the sections keep their
// state/data and nothing had to be rewritten. Phones get a full-screen
// sheet; desktop (`wide`) gets a right-side drawer over a dimmed backdrop.
//
// Closed sheets stay mounted (slid off-screen + visibility:hidden, not
// display:none) so charts inside still measure their width correctly.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { createPortal } from "react-dom";

export type TileId = "photos" | "activity" | "badges" | "goals";

const SHEETS: { id: TileId; title: string; slots: string[] }[] = [
  { id: "photos",   title: "📸 Highlights", slots: ["photos"] },
  { id: "activity", title: "📋 Activity",   slots: ["activity-top", "activity", "activity-bottom"] },
  { id: "badges",   title: "🏆 Badges",     slots: ["badges"] },
  { id: "goals",    title: "🎯 Goals",      slots: ["goals"] },
];

type Slots = Record<string, HTMLElement | null>;
const Ctx = createContext<{ mobile: boolean; slots: Slots } | null>(null);

/** Renders children in place on desktop; inside the tile's sheet on mobile. */
export function InTile({ slot, children }: { slot: string; children: ReactNode }) {
  const c = useContext(Ctx);
  if (!c || !c.mobile) return <>{children}</>;
  const node = c.slots[slot];
  return node ? createPortal(children, node) : null;
}

export function TileProvider({ mobile, wide = false, open, onClose, children }: {
  /** true = portal sections into sheets (boxes layout on). */
  mobile: boolean; wide?: boolean; open: TileId | null; onClose: () => void; children: ReactNode;
}) {
  const [slots, setSlots] = useState<Slots>({});
  // Stable callback refs (a new ref fn every render would ping-pong state).
  const regs = useRef<Record<string, (el: HTMLElement | null) => void>>({});
  const reg = (k: string) =>
    (regs.current[k] ||= (el: HTMLElement | null) => setSlots(s => (s[k] === el ? s : { ...s, [k]: el })));

  // Escape closes the open sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Ctx.Provider value={{ mobile, slots }}>
      {children}
      {mobile && wide && (
        <div onClick={onClose} aria-hidden
          style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(0,0,0,0.6)",
            opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s" }} />
      )}
      {mobile && SHEETS.map(s => {
        const isOpen = open === s.id;
        return (
          <div key={s.id} role="dialog" aria-label={s.title} aria-hidden={!isOpen}
            style={{
              position: "fixed", top: 0, bottom: 0, right: 0, left: wide ? "auto" : 0,
              width: wide ? "min(680px, 100vw)" : undefined,
              zIndex: 200, background: "#0E1311",
              borderLeft: wide ? "1px solid #243329" : undefined,
              boxShadow: wide ? "-20px 0 60px rgba(0,0,0,0.5)" : undefined,
              overflowY: "auto", WebkitOverflowScrolling: "touch" as any,
              transform: isOpen ? "translateX(0)" : "translateX(100%)",
              visibility: isOpen ? "visible" : "hidden",
              transition: isOpen
                ? "transform 0.26s cubic-bezier(.2,.8,.2,1), visibility 0s"
                : "transform 0.22s ease-in, visibility 0s linear 0.22s",
            }}>
            <div style={{
              position: "sticky", top: 0, zIndex: 5, background: "rgba(14,19,17,0.96)",
              backdropFilter: "blur(10px)", borderBottom: "1px solid #1E2A23",
              padding: "calc(env(safe-area-inset-top, 0px) + 8px) 8px 8px",
              display: "flex", alignItems: "center",
            }}>
              <button onClick={onClose} aria-label="Back"
                style={{ height: 44, minWidth: 44, padding: "0 10px", border: "none", background: "transparent",
                  color: "#5BBE93", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 26, lineHeight: 1, marginTop: -2 }}>{wide ? "×" : "‹"}</span> {wide ? "Close" : "Back"}
              </button>
              <div style={{ flex: 1, textAlign: "center", fontWeight: 900, fontSize: 17, color: "#F0F0F0", marginRight: 76 }}>{s.title}</div>
            </div>
            <div style={{ padding: wide ? "20px 24px 60px" : "16px 16px 120px" }}>
              {s.slots.map(k => <div key={k} ref={reg(k)} />)}
            </div>
          </div>
        );
      })}
    </Ctx.Provider>
  );
}

export type TileSpec = { id: TileId; emoji: string; title: string; meta?: ReactNode; preview: ReactNode };

/** The 2×2 grid of boxes on the mobile profile. */
export function TileGrid({ tiles, onOpen, wide = false }: { tiles: TileSpec[]; onOpen: (id: TileId) => void; wide?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: wide ? 16 : 12, marginBottom: 16 }}>
      {tiles.map(t => (
        <button key={t.id} onClick={() => onOpen(t.id)}
          style={{
            aspectRatio: wide ? "16 / 9" : "1 / 1", minWidth: 0, position: "relative", background: "#141C18", border: "1.5px solid #243329",
            borderRadius: 20, padding: 14, display: "flex", flexDirection: "column", textAlign: "left",
            color: "#F0F0F0", cursor: "pointer", overflow: "hidden", WebkitTapHighlightColor: "transparent",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 15, marginBottom: 10 }}>
            <span>{t.emoji}</span><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
            <span style={{ color: "#5BBE93", fontSize: 20, lineHeight: 1 }}>›</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>{t.preview}</div>
          {t.meta != null && <div style={{ fontSize: 12, color: "#8FA39A", marginTop: 8, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.meta}</div>}
        </button>
      ))}
    </div>
  );
}

/**
 * Highlights preview: photos laid out in uniform-height rows ("justified"
 * rows) using each photo's REAL aspect ratio, so portrait, landscape and
 * square shots coexist with identical heights and gaps and nothing is
 * cropped. Rows are packed greedily (skipping photos that don't fit so the
 * next one can fill the gap) and centered.
 */
export function JustifiedThumbs({ urls, rows = 2, gap = 6, isVideo }: {
  urls: string[]; rows?: number; gap?: number; isVideo: (u: string) => boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [ars, setArs] = useState<Record<string, number>>({});
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const setAr = (u: string, w: number, h: number) => {
    // -1 marks a photo that failed to load — it's skipped in the layout.
    setArs(a => (a[u] !== undefined ? a : { ...a, [u]: w > 0 && h > 0 ? w / h : -1 }));
  };
  // Wait until every photo's size is known (or 1.5s) so rows don't reshuffle.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => { const t = setTimeout(() => setTimedOut(true), 1500); return () => clearTimeout(t); }, []);
  const ready = timedOut || urls.every(u => ars[u] !== undefined);
  const H = box.h ? Math.floor((box.h - gap * (rows - 1)) / rows) : 0;
  const layout: { u: string; w: number }[][] = [];
  if (ready && H > 0 && box.w > 0) {
    const used = new Set<string>();
    for (let r = 0; r < rows; r++) {
      const row: { u: string; w: number }[] = []; let width = 0;
      for (const u of urls) {
        if (used.has(u) || !(ars[u] > 0)) continue;
        const w = Math.round(ars[u] * H);
        const add = (row.length ? gap : 0) + w;
        if (width + add <= box.w) { row.push({ u, w }); used.add(u); width += add; }
      }
      if (row.length) layout.push(row);
    }
  }
  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap, overflow: "hidden" }}>
      {layout.map((row, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "center", gap, height: H, flexShrink: 0 }}>
          {row.map(({ u, w }) => isVideo(u)
            ? <video key={u} src={u} muted playsInline preload="metadata" style={{ width: w, height: H, borderRadius: 8, objectFit: "contain", background: "#000", flexShrink: 0 }} />
            : <img key={u} src={u} alt="" style={{ width: w, height: H, borderRadius: 8, objectFit: "contain", flexShrink: 0 }} />)}
        </div>
      ))}
      {/* Off-screen loaders that read each photo's natural size. */}
      <div aria-hidden style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
        {urls.map(u => isVideo(u)
          ? <video key={u} src={u} muted playsInline preload="metadata" onLoadedMetadata={e => setAr(u, e.currentTarget.videoWidth, e.currentTarget.videoHeight)} onError={() => setAr(u, 0, 0)} />
          : <img key={u} src={u} alt="" onLoad={e => setAr(u, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} onError={() => setAr(u, 0, 0)} />)}
      </div>
    </div>
  );
}

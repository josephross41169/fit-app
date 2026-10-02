"use client";
// ─────────────────────────────────────────────────────────────────────────────
// Profile "boxes" layout (mobile).
//
// On phones the profile body is a 2×2 grid of tiles — Highlights, Activity,
// Badges, Goals. Tapping a tile slides in a full-screen sheet holding that
// section. The existing section JSX in profile/page.tsx is wrapped in
// <InTile slot="…"> and PORTALED into the sheet, so the sections keep their
// state/data and nothing had to be rewritten. On desktop <InTile> renders
// its children in place, so the 3-column desktop layout is unchanged.
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

export function TileProvider({ mobile, open, onClose, children }: {
  mobile: boolean; open: TileId | null; onClose: () => void; children: ReactNode;
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
      {mobile && SHEETS.map(s => {
        const isOpen = open === s.id;
        return (
          <div key={s.id} role="dialog" aria-label={s.title} aria-hidden={!isOpen}
            style={{
              position: "fixed", inset: 0, zIndex: 200, background: "#0E1311",
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
                <span style={{ fontSize: 26, lineHeight: 1, marginTop: -2 }}>‹</span> Back
              </button>
              <div style={{ flex: 1, textAlign: "center", fontWeight: 900, fontSize: 17, color: "#F0F0F0", marginRight: 76 }}>{s.title}</div>
            </div>
            <div style={{ padding: "16px 16px 120px" }}>
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
export function TileGrid({ tiles, onOpen }: { tiles: TileSpec[]; onOpen: (id: TileId) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
      {tiles.map(t => (
        <button key={t.id} onClick={() => onOpen(t.id)}
          style={{
            aspectRatio: "1 / 1", minWidth: 0, background: "#141C18", border: "1.5px solid #243329",
            borderRadius: 20, padding: 14, display: "flex", flexDirection: "column", textAlign: "left",
            color: "#F0F0F0", cursor: "pointer", overflow: "hidden", WebkitTapHighlightColor: "transparent",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 15, marginBottom: 10 }}>
            <span>{t.emoji}</span><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
            <span style={{ color: "#5BBE93", fontSize: 20, lineHeight: 1 }}>›</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>{t.preview}</div>
          {t.meta != null && <div style={{ fontSize: 12, color: "#8FA39A", marginTop: 8, fontWeight: 600 }}>{t.meta}</div>}
        </button>
      ))}
    </div>
  );
}

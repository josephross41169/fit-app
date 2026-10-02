"use client";
// ─────────────────────────────────────────────────────────────────────────────
// "Photos in your box" — lets the owner choose exactly which photos show in
// the Highlights box on their profile. Shown at the top of the Highlights
// sheet (owner only).
//
// Stored in users.highlight_box (jsonb string[]). null = automatic
// (favorites first, then newest post photos).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";

const C = { green: "#5BBE93", card: "#161D19", dark: "#0E1311", border: "#2A3A2A", text: "#F0F0F0", sub: "#9CA3AF" };
const MAX = 16;

function Thumb({ src, isVideo, h }: { src: string; isVideo: (u: string) => boolean; h: number }) {
  return isVideo(src)
    ? <video src={src} muted playsInline preload="metadata" style={{ height: h, width: "auto", maxWidth: h * 2, borderRadius: 8, display: "block", background: "#000" }} />
    : <img src={src} alt="" loading="lazy" style={{ height: h, width: "auto", maxWidth: h * 2, borderRadius: 8, display: "block" }} />;
}

export default function HighlightBoxEditor({ shown, all, isCustom, onSave, isVideo }: {
  shown: string[];                 // what the box shows right now
  all: string[];                   // every photo the owner can pick from
  isCustom: boolean;               // true when the owner has picked manually
  onSave: (list: string[] | null) => Promise<boolean>;
  isVideo: (u: string) => boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (list: string[] | null) => { setBusy(true); await onSave(list); setBusy(false); };
  const remove = (u: string) => save(shown.filter(x => x !== u));
  const toggleAdd = (u: string) => {
    if (shown.includes(u)) return save(shown.filter(x => x !== u));
    if (shown.length >= MAX) { alert(`Up to ${MAX} photos can be in your box.`); return; }
    return save([...shown, u]);
  };
  const btn = { fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 20, cursor: "pointer" } as const;

  return (
    <div style={{ background: C.card, borderRadius: 22, padding: 20, border: `2px solid ${C.border}`, marginBottom: 16, opacity: busy ? 0.7 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: C.text }}>🖼️ Photos in your box</div>
        <button onClick={() => setPicking(p => !p)} style={{ ...btn, border: "none", background: picking ? C.green : "linear-gradient(135deg,#5BBE93,#86CFAE)", color: "#fff" }}>
          {picking ? "✓ Done" : "+ Add photos"}
        </button>
      </div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>
        {isCustom ? "You picked these. Tap × to remove one." : "Picked automatically right now. Tap × to remove one, or add your own."}
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: "18px 10px", textAlign: "center", border: `1.5px dashed ${C.border}`, borderRadius: 12, color: C.sub, fontSize: 13 }}>
          No photos in your box. Tap “+ Add photos”.
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {shown.map(u => (
            <div key={u} style={{ position: "relative" }}>
              <Thumb src={u} isVideo={isVideo} h={84} />
              <button onClick={() => remove(u)} aria-label="Remove from box"
                style={{ position: "absolute", top: 4, right: 4, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 16, lineHeight: "26px", padding: 0, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {isCustom && (
        <button onClick={() => save(null)} style={{ ...btn, marginTop: 12, border: `1.5px solid ${C.border}`, background: "transparent", color: C.sub }}>
          ↺ Go back to automatic
        </button>
      )}

      {picking && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>Tap a photo to add it (tap again to remove). {shown.length}/{MAX}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 360, overflowY: "auto" }}>
            {all.map(u => {
              const on = shown.includes(u);
              return (
                <button key={u} onClick={() => toggleAdd(u)} style={{ position: "relative", padding: 0, border: `3px solid ${on ? C.green : "transparent"}`, borderRadius: 11, background: "transparent", cursor: "pointer" }}>
                  <Thumb src={u} isVideo={isVideo} h={72} />
                  {on && <span style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: C.green, color: "#fff", fontSize: 13, lineHeight: "22px", fontWeight: 900 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

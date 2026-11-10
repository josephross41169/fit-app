"use client";
// components/ShareCardSheet.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Share my day" screen. Shows a live preview of the card image and lets the
// person pick:
//   • Size: Story (9:16) or Post (4:5)
//   • Photos: up to 2 of the day's photos, or none
// then Save image or Share… (phone share sheet → Instagram, TikTok, Messages…).
// The image itself is drawn by /api/share-card from lib/shareCard.ts data.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { buildShareCard, defaultSharePhotos, sharePhotoOptions, type ShareFormat } from "@/lib/shareCard";
import { ImagePresets } from "@/lib/imageUrls";

type Owner = { name: string; username?: string; avatarUrl?: string | null };

const isNative = () => { try { return !!(window as any).Capacitor?.isNativePlatform?.(); } catch { return false; } };
const isMobile = () => typeof navigator !== "undefined" && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ((navigator as any).maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
  return btoa(s);
}

// Badge art is WebP; the card renderer only reads PNG/JPEG, so convert each
// badge to a small PNG in the browser (cached for the session).
const badgePngCache = new Map<string, Promise<string | null>>();
function badgeToPng(src: string): Promise<string | null> {
  if (src.startsWith("data:image/png")) return Promise.resolve(src);
  let p = badgePngCache.get(src);
  if (!p) {
    p = new Promise<string | null>(resolve => {
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = 128; c.height = 128;
          const ctx = c.getContext("2d");
          if (!ctx) return resolve(null);
          const s = Math.min(128 / im.naturalWidth, 128 / im.naturalHeight);
          const w = im.naturalWidth * s, h = im.naturalHeight * s;
          ctx.drawImage(im, (128 - w) / 2, (128 - h) / 2, w, h);
          resolve(c.toDataURL("image/png"));
        } catch { resolve(null); }
      };
      im.onerror = () => resolve(null);
      im.src = src;
    });
    badgePngCache.set(src, p);
  }
  return p;
}

export default function ShareCardSheet({ day, owner, earnedBadgeIds, onClose }: {
  day: any; owner: Owner; earnedBadgeIds: string[]; onClose: () => void;
}) {
  const options = useMemo(() => sharePhotoOptions(day), [day]);
  const [format, setFormat] = useState<ShareFormat>("story");
  const [picked, setPicked] = useState<string[]>(() => defaultSharePhotos(options));
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const seq = useRef(0);

  // The card data as a string, so the preview only re-renders when something
  // on the card actually changes (not on every parent re-render).
  const cardJson = useMemo(
    () => JSON.stringify(buildShareCard(day, owner, earnedBadgeIds, picked, format)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, owner.name, owner.username, owner.avatarUrl, earnedBadgeIds.join(","), picked.join("|"), format],
  );

  // Re-render the preview whenever the size or photos change.
  useEffect(() => {
    const my = ++seq.current;
    setLoading(true); setError(null);
    const t = setTimeout(async () => {
      try {
        const card = JSON.parse(cardJson);
        const pngs = await Promise.all((card.badges || []).map((b: any) => badgeToPng(b.img)));
        card.badges = pngs.filter(Boolean).map(img => ({ img }));
        if (my !== seq.current) return;
        const res = await fetch("/api/share-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(card) });
        if (!res.ok) throw new Error(`share-card ${res.status}`);
        const blob = await res.blob();
        if (my !== seq.current) return;
        setImg(prev => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), blob }; });
      } catch (e) {
        if (my === seq.current) setError("Couldn't make the image. Check your connection and try again.");
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [cardJson]);

  useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fileName = `livelee-${(day?._date ? new Date(day._date) : new Date()).toISOString().slice(0, 10)}.png`;

  function togglePhoto(url: string) {
    setPicked(p => p.includes(url) ? p.filter(x => x !== url) : [...p, url].slice(-2));
  }

  /** Native app: write the PNG to the cache folder and open the phone's share sheet. */
  async function nativeShare(): Promise<boolean> {
    if (!img || !isNative()) return false;
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const saved = await Filesystem.writeFile({ path: fileName, data: await blobToBase64(img.blob), directory: Directory.Cache });
    await Share.share({ title: "My day on Livelee", files: [saved.uri] });
    return true;
  }

  async function share() {
    if (!img) return;
    setNote(null);
    try {
      if (await nativeShare()) return;
    } catch (e: any) {
      if (/cancel/i.test(String(e?.message || e))) return;
    }
    const file = new File([img.blob], fileName, { type: "image/png" });
    const nav = navigator as any;
    if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
      try { await nav.share({ files: [file], title: "My day on Livelee" }); return; }
      catch (e: any) { if (e?.name === "AbortError") return; }
    }
    save();
  }

  async function save() {
    if (!img) return;
    setNote(null);
    // In the app, saving to Photos goes through the share sheet ("Save Image").
    if (isNative()) { try { if (await nativeShare()) return; } catch { /* fall through */ } }
    if (isMobile()) {
      window.open(img.url, "_blank");
      setNote("Press and hold the image, then tap Save to Photos.");
      return;
    }
    const a = document.createElement("a");
    a.href = img.url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  const chip = (on: boolean): React.CSSProperties => ({
    flex: 1, padding: "10px 12px", borderRadius: 999, border: `1.5px solid ${on ? "#4A9D6E" : "#1B231E"}`,
    background: on ? "#1F5F3F" : "#111", color: on ? "#fff" : "#F0F0F0", fontWeight: 800, fontSize: 14, cursor: "pointer",
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "94vh", overflowY: "auto", background: "#0D0D0D", border: "1px solid #1B231E", borderRadius: "22px 22px 0 0", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #1B231E", position: "sticky", top: 0, background: "#0D0D0D", zIndex: 1 }}>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer", width: 28 }}>✕</button>
          <b style={{ fontSize: 16, color: "#F0F0F0" }}>Share your day</b>
          <span style={{ width: 28 }} />
        </div>

        <div style={{ padding: "16px 18px 0" }}>
          {/* Preview */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative", width: format === "story" ? 220 : 280, aspectRatio: format === "story" ? "9 / 16" : "4 / 5", borderRadius: 14, overflow: "hidden", border: "1px solid #1B231E", background: "#0B100D" }}>
              {img && <img src={img.url} alt="Your share card" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: loading ? 0.5 : 1, transition: "opacity .15s" }} />}
              {loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontWeight: 800, fontSize: 13 }}>Making your card…</div>}
              {error && !loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16, color: "#FCA5A5", fontWeight: 800, fontSize: 13 }}>{error}</div>}
            </div>
          </div>

          {/* Size */}
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: "#9CA3AF", textTransform: "uppercase", margin: "16px 0 8px" }}>Size</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={chip(format === "story")} onClick={() => setFormat("story")}>📱 Story 9:16</button>
            <button style={chip(format === "post")} onClick={() => setFormat("post")}>🟩 Post 4:5</button>
          </div>

          {/* Photos */}
          {options.length > 0 && (<>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: "#9CA3AF", textTransform: "uppercase", margin: "16px 0 8px" }}>Photos (up to 2)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {options.map(o => {
                const on = picked.includes(o.url);
                return (
                  <button key={o.url} onClick={() => togglePhoto(o.url)} aria-pressed={on} aria-label={`${o.label} photo`}
                    style={{ position: "relative", width: 64, height: 64, padding: 0, borderRadius: 12, overflow: "hidden", border: `2.5px solid ${on ? "#4A9D6E" : "#1B231E"}`, background: "#111", cursor: "pointer" }}>
                    <img src={ImagePresets.thumb(o.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: on ? 1 : 0.55 }} />
                    {on && <span style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 9, background: "#4A9D6E", color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>}
                  </button>
                );
              })}
              <button onClick={() => setPicked([])} aria-pressed={picked.length === 0}
                style={{ width: 64, height: 64, borderRadius: 12, border: `2.5px solid ${picked.length === 0 ? "#4A9D6E" : "#1B231E"}`, background: "radial-gradient(circle at 70% 30%,#2E7D54,#0B100D)", color: "#fff", fontWeight: 900, fontSize: 11, cursor: "pointer", lineHeight: 1.2 }}>No<br />photo</button>
            </div>
          </>)}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={save} disabled={!img || loading} style={{ flex: 1, padding: 14, borderRadius: 14, border: "1.5px solid #1B231E", background: "#111", color: "#F0F0F0", fontWeight: 900, fontSize: 15, cursor: "pointer", opacity: !img || loading ? 0.6 : 1 }}>⬇️ Save image</button>
            <button onClick={share} disabled={!img || loading} style={{ flex: 1, padding: 14, borderRadius: 14, border: "none", background: "linear-gradient(135deg,#1F5F3F,#4A9D6E)", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", opacity: !img || loading ? 0.6 : 1 }}>📤 Share…</button>
          </div>
          {note && <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 700, textAlign: "center", marginTop: 8 }}>{note}</div>}
        </div>
      </div>
    </div>
  );
}

"use client";
// components/HighlightAlbums.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Profile highlights, organized three ways (Instagram-style):
//   ⭐ Favorites — the hand-picked strip (users.highlights). Rendered by the
//                 profile page and passed in as `favorites`.
//   📁 Albums    — custom named albums; the owner picks the photos/videos.
//   🗓 Monthly   — automatic: every photo/video posted lands in that month's
//                 album. The owner can hide items or add extra ones.
//
// Albums + monthly edits live in one jsonb column, users.highlight_albums:
//   { custom: [{ id, title, items: string[] }],
//     monthly: { "YYYY-MM": { hidden: string[], added: string[] } } }
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { isVideoUrl } from "@/components/GroupHighlights";

const C = {
  green: "#5BBE93", greenLight: "#86CFAE", card: "#161D19", dark: "#0E1311",
  chip: "#1B231E", border: "#2A3A2A", text: "#F0F0F0", sub: "#9CA3AF", red: "#EF4444",
};

type CustomAlbum = { id: string; title: string; items: string[] };
type MonthEdits = { hidden: string[]; added: string[] };
type AlbumData = { custom: CustomAlbum[]; monthly: Record<string, MonthEdits> };
type Media = { url: string; at: number };
type OpenAlbum = { kind: "custom"; id: string } | { kind: "monthly"; key: string };

const EMPTY: AlbumData = { custom: [], monthly: {} };

function normalize(raw: any): AlbumData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { custom: [], monthly: {} };
  const custom: CustomAlbum[] = Array.isArray(raw.custom)
    ? raw.custom
        .filter((a: any) => a && typeof a.id === "string")
        .map((a: any) => ({ id: a.id, title: String(a.title || "Album"), items: Array.isArray(a.items) ? a.items.filter((u: any) => typeof u === "string") : [] }))
    : [];
  const monthly: Record<string, MonthEdits> = {};
  if (raw.monthly && typeof raw.monthly === "object") {
    for (const [k, v] of Object.entries<any>(raw.monthly)) {
      monthly[k] = {
        hidden: Array.isArray(v?.hidden) ? v.hidden.filter((u: any) => typeof u === "string") : [],
        added: Array.isArray(v?.added) ? v.added.filter((u: any) => typeof u === "string") : [],
      };
    }
  }
  return { custom, monthly };
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string, long = false): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: long ? "long" : "short", year: "numeric" });
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function Thumb({ src, size, radius = 10 }: { src: string; size?: number | string; radius?: number }) {
  const style: React.CSSProperties = { width: size ?? "100%", height: size ?? "100%", objectFit: "cover", display: "block", borderRadius: radius, background: "#000" };
  return isVideoUrl(src)
    ? <video src={src} muted playsInline preload="metadata" style={style} />
    : <img src={src} alt="" loading="lazy" style={style} />;
}

// Round Instagram-style album bubble.
function Bubble({ cover, label, sub, onClick, dashed }: { cover?: string; label: string; sub?: string; onClick: () => void; dashed?: boolean }) {
  return (
    <button onClick={onClick} style={{ width: 76, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ width: 68, height: 68, borderRadius: "50%", padding: 3, background: dashed ? "transparent" : `linear-gradient(135deg, ${C.green}, ${C.greenLight})`, border: dashed ? `2px dashed ${C.border}` : "none", boxSizing: "border-box" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: C.chip, border: dashed ? "none" : `2px solid ${C.card}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", color: C.green, fontSize: 24, fontWeight: 800 }}>
          {cover ? <Thumb src={cover} radius={0} /> : (dashed ? "+" : "📷")}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.text, maxWidth: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: C.sub, marginTop: -4 }}>{sub}</div>}
    </button>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column" };
const sheetHeader: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "calc(14px + env(safe-area-inset-top, 0px)) 16px 12px", borderBottom: `1px solid ${C.border}`, background: C.dark };
const pillBtn = (primary = false): React.CSSProperties => ({ fontSize: 12, fontWeight: 800, padding: "7px 13px", borderRadius: 20, cursor: "pointer", border: primary ? "none" : `1.5px solid ${C.border}`, background: primary ? `linear-gradient(135deg, ${C.green}, ${C.greenLight})` : C.chip, color: primary ? "#04342C" : C.greenLight, whiteSpace: "nowrap" });
const closeBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: "50%", border: "none", background: C.chip, color: C.text, fontSize: 20, cursor: "pointer", flexShrink: 0 };

export default function HighlightAlbums({
  viewUserId, isOwn, favorites, favoritesActions, favoritesCount,
}: {
  viewUserId: string;
  isOwn: boolean;
  favorites: ReactNode;
  favoritesActions?: ReactNode;
  favoritesCount: number;
}) {
  const [tab, setTab] = useState<"favorites" | "albums" | "monthly">("favorites");
  const [data, setData] = useState<AlbumData>(EMPTY);
  const [media, setMedia] = useState<Media[]>([]);
  const [open, setOpen] = useState<OpenAlbum | null>(null);
  const [editing, setEditing] = useState(false);
  const [viewer, setViewer] = useState<{ items: string[]; idx: number } | null>(null);
  const [picker, setPicker] = useState<{ mode: "create" } | { mode: "add"; target: OpenAlbum } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Load albums + the user's posted media ──
  useEffect(() => {
    if (!viewUserId) return;
    let alive = true;
    supabase.from("users").select("highlight_albums").eq("id", viewUserId).single()
      .then(({ data: row }: any) => { if (alive && row) setData(normalize(row.highlight_albums)); });
    let q = supabase.from("posts").select("media_url, media_urls, created_at").eq("user_id", viewUserId).order("created_at", { ascending: false });
    if (!isOwn) q = q.eq("is_public", true);
    q.then(({ data: rows }: any) => {
      if (!alive || !rows) return;
      const out: Media[] = [];
      const seen = new Set<string>();
      for (const p of rows) {
        const at = new Date(p.created_at).getTime() || Date.now();
        const urls: string[] = Array.isArray(p.media_urls) && p.media_urls.length ? p.media_urls : (p.media_url ? [p.media_url] : []);
        for (const u of urls) {
          if (typeof u === "string" && u.startsWith("http") && !seen.has(u)) { seen.add(u); out.push({ url: u, at }); }
        }
      }
      setMedia(out);
    });
    return () => { alive = false; };
  }, [viewUserId, isOwn]);

  // ── Monthly albums: auto-grouped posts, minus hidden, plus added ──
  const months = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const m of media) (groups[monthKey(m.at)] ||= []).push(m.url);
    for (const k of Object.keys(data.monthly)) groups[k] ||= [];
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const ed = data.monthly[key] || { hidden: [], added: [] };
        const uniq = Array.from(new Set([...groups[key].filter((u) => !ed.hidden.includes(u)), ...ed.added]));
        return { key, items: uniq, hiddenCount: ed.hidden.length };
      })
      .filter((m) => m.items.length > 0 || (isOwn && m.hiddenCount > 0));
  }, [media, data.monthly, isOwn]);

  async function persist(next: AlbumData) {
    const prev = data;
    setData(next);
    setSaving(true);
    const { error } = await supabase.from("users").update({ highlight_albums: next } as any).eq("id", viewUserId);
    setSaving(false);
    if (error) {
      setData(prev);
      alert("Couldn't save your highlights. Try again.");
      return false;
    }
    return true;
  }

  // Resolve the album currently open in the sheet.
  const current = useMemo(() => {
    if (!open) return null;
    if (open.kind === "custom") {
      const a = data.custom.find((x) => x.id === open.id);
      return a ? { title: a.title, items: a.items } : null;
    }
    const m = months.find((x) => x.key === open.key);
    return { title: monthLabel(open.key, true), items: m?.items || [] };
  }, [open, data.custom, months]);

  function removeItem(target: OpenAlbum, url: string) {
    if (target.kind === "custom") {
      persist({ ...data, custom: data.custom.map((a) => a.id === target.id ? { ...a, items: a.items.filter((u) => u !== url) } : a) });
    } else {
      const ed = data.monthly[target.key] || { hidden: [], added: [] };
      const next: MonthEdits = ed.added.includes(url)
        ? { ...ed, added: ed.added.filter((u) => u !== url) }
        : { ...ed, hidden: Array.from(new Set([...ed.hidden, url])) };
      persist({ ...data, monthly: { ...data.monthly, [target.key]: next } });
    }
  }

  function addItems(target: OpenAlbum, urls: string[]) {
    if (!urls.length) return;
    if (target.kind === "custom") {
      persist({ ...data, custom: data.custom.map((a) => a.id === target.id ? { ...a, items: Array.from(new Set([...a.items, ...urls])) } : a) });
    } else {
      const ed = data.monthly[target.key] || { hidden: [], added: [] };
      // Re-adding a hidden item just un-hides it; anything else is an extra.
      const hidden = ed.hidden.filter((u) => !urls.includes(u));
      const autoInMonth = new Set(media.filter((m) => monthKey(m.at) === target.key).map((m) => m.url));
      const added = Array.from(new Set([...ed.added, ...urls.filter((u) => !autoInMonth.has(u))]));
      persist({ ...data, monthly: { ...data.monthly, [target.key]: { hidden, added } } });
    }
  }

  function restoreMonth(key: string) {
    const ed = data.monthly[key] || { hidden: [], added: [] };
    persist({ ...data, monthly: { ...data.monthly, [key]: { ...ed, hidden: [] } } });
  }

  function renameAlbum(id: string, title: string) {
    const t = title.trim();
    if (!t) return;
    persist({ ...data, custom: data.custom.map((a) => a.id === id ? { ...a, title: t.slice(0, 40) } : a) });
  }

  async function deleteAlbum(id: string) {
    if (!confirm("Delete this album? Your posts won't be deleted.")) return;
    const ok = await persist({ ...data, custom: data.custom.filter((a) => a.id !== id) });
    if (ok) { setOpen(null); setEditing(false); }
  }

  async function createAlbum() {
    const title = newTitle.trim() || "New album";
    const album: CustomAlbum = { id: newId(), title: title.slice(0, 40), items: picked };
    const ok = await persist({ ...data, custom: [album, ...data.custom] });
    if (ok) { setPicker(null); setPicked([]); setNewTitle(""); setTab("albums"); }
  }

  const tabs: { key: typeof tab; label: string; count: number }[] = [
    { key: "favorites", label: "⭐ Favorites", count: favoritesCount },
    { key: "albums", label: "📁 Albums", count: data.custom.length },
    { key: "monthly", label: "🗓 Monthly", count: months.length },
  ];

  return (
    <div>
      {/* Segmented tabs — wrap instead of scrolling sideways. */}
      <div style={{ display: "flex", gap: 4, background: C.dark, borderRadius: 12, padding: 4, marginBottom: 12 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, minWidth: 0, padding: "8px 4px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800, background: tab === t.key ? C.chip : "transparent", color: tab === t.key ? C.greenLight : C.sub, boxShadow: tab === t.key ? `inset 0 0 0 1.5px ${C.border}` : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {t.label}{t.count > 0 && <span style={{ color: C.sub, fontWeight: 600, marginLeft: 4 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "favorites" && (
        <div>
          {favoritesActions && <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 10 }}>{favoritesActions}</div>}
          {favorites}
        </div>
      )}

      {tab === "albums" && (
        data.custom.length === 0 && !isOwn ? (
          <div style={{ padding: "22px 14px", borderRadius: 14, border: `2px dashed ${C.border}`, color: C.sub, fontWeight: 700, fontSize: 13, textAlign: "center" }}>No albums yet</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {isOwn && <Bubble dashed label="New" onClick={() => { setPicked([]); setNewTitle(""); setPicker({ mode: "create" }); }} />}
            {data.custom.map((a) => (
              <Bubble key={a.id} cover={a.items[0]} label={a.title} sub={`${a.items.length}`} onClick={() => { setEditing(false); setOpen({ kind: "custom", id: a.id }); }} />
            ))}
          </div>
        )
      )}

      {tab === "monthly" && (
        months.length === 0 ? (
          <div style={{ padding: "22px 14px", borderRadius: 14, border: `2px dashed ${C.border}`, color: C.sub, fontWeight: 700, fontSize: 13, textAlign: "center" }}>
            {isOwn ? "Post a photo or video — it lands in this month's album automatically" : "No monthly highlights yet"}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {months.map((m) => (
              <Bubble key={m.key} cover={m.items[0]} label={monthLabel(m.key)} sub={`${m.items.length}`} onClick={() => { setEditing(false); setOpen({ kind: "monthly", key: m.key }); }} />
            ))}
          </div>
        )
      )}

      {/* ── Album sheet ── */}
      {open && current && (
        <div style={overlay} onClick={() => { setOpen(null); setEditing(false); }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.dark, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={sheetHeader}>
              {editing && open.kind === "custom" ? (
                <input
                  defaultValue={current.title}
                  maxLength={40}
                  onBlur={(e) => renameAlbum(open.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  style={{ flex: 1, minWidth: 0, background: C.chip, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 16, fontWeight: 800, padding: "8px 10px" }}
                />
              ) : (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 18, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current.title}</div>
                  <div style={{ fontSize: 12, color: C.sub }}>{current.items.length} {current.items.length === 1 ? "item" : "items"}{saving ? " · saving…" : ""}</div>
                </div>
              )}
              {isOwn && (
                <button onClick={() => setEditing((e) => !e)} style={pillBtn(editing)}>{editing ? "✓ Done" : "✏️ Edit"}</button>
              )}
              <button onClick={() => { setOpen(null); setEditing(false); }} style={closeBtn}>×</button>
            </div>

            {editing && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 16px 0" }}>
                <button onClick={() => { setPicked([]); setPicker({ mode: "add", target: open }); }} style={pillBtn(true)}>+ Add photos</button>
                {open.kind === "monthly" && (data.monthly[open.key]?.hidden.length ?? 0) > 0 && (
                  <button onClick={() => restoreMonth(open.key)} style={pillBtn()}>↺ Restore {data.monthly[open.key].hidden.length} hidden</button>
                )}
                {open.kind === "custom" && (
                  <button onClick={() => deleteAlbum(open.id)} style={{ ...pillBtn(), color: C.red }}>Delete album</button>
                )}
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {current.items.length === 0 ? (
                <div style={{ textAlign: "center", color: C.sub, padding: "40px 10px", fontSize: 14 }}>
                  {isOwn ? "Nothing here yet — tap Edit, then + Add photos" : "Nothing here yet"}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                  {current.items.map((u, i) => (
                    <div key={u} style={{ position: "relative", aspectRatio: "1 / 1" }}>
                      <button onClick={() => !editing && setViewer({ items: current.items, idx: i })} style={{ width: "100%", height: "100%", padding: 0, border: "none", background: "none", cursor: editing ? "default" : "pointer" }}>
                        <Thumb src={u} radius={8} />
                      </button>
                      {isVideoUrl(u) && <div style={{ position: "absolute", bottom: 5, left: 5, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 99 }}>▶</div>}
                      {editing && (
                        <button onClick={() => removeItem(open, u)} aria-label="Remove" style={{ position: "absolute", top: 5, right: 5, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.85)", color: "#fff", fontSize: 16, lineHeight: "26px", padding: 0, cursor: "pointer" }}>×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Photo picker (create album / add to album) ── */}
      {picker && (
        <div style={{ ...overlay, zIndex: 10001 }} onClick={() => setPicker(null)}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.dark, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={sheetHeader}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>{picker.mode === "create" ? "New album" : "Add photos"}</div>
                <div style={{ fontSize: 12, color: C.sub }}>{picked.length} selected</div>
              </div>
              <button
                disabled={saving || (picker.mode === "add" && picked.length === 0)}
                onClick={() => {
                  if (picker.mode === "create") createAlbum();
                  else { addItems(picker.target, picked); setPicker(null); setPicked([]); }
                }}
                style={{ ...pillBtn(true), opacity: picker.mode === "add" && picked.length === 0 ? 0.5 : 1 }}
              >
                {picker.mode === "create" ? "Create" : `Add${picked.length ? ` ${picked.length}` : ""}`}
              </button>
              <button onClick={() => setPicker(null)} style={closeBtn}>×</button>
            </div>
            {picker.mode === "create" && (
              <div style={{ padding: "12px 16px 0" }}>
                <input
                  autoFocus
                  value={newTitle}
                  maxLength={40}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Album name (e.g. Leg day, Race season)"
                  style={{ width: "100%", boxSizing: "border-box", background: C.chip, border: `1.5px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 16, fontWeight: 700, padding: "11px 12px" }}
                />
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {media.length === 0 ? (
                <div style={{ textAlign: "center", color: C.sub, padding: "40px 10px", fontSize: 14 }}>Post photos or videos first, then add them to albums</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                  {media.map((m) => {
                    const sel = picked.indexOf(m.url);
                    const already = picker.mode === "add" && current?.items.includes(m.url);
                    return (
                      <button
                        key={m.url}
                        disabled={already}
                        onClick={() => setPicked((p) => sel >= 0 ? p.filter((u) => u !== m.url) : [...p, m.url])}
                        style={{ position: "relative", aspectRatio: "1 / 1", padding: 0, border: "none", background: "none", cursor: already ? "default" : "pointer", opacity: already ? 0.35 : 1 }}
                      >
                        <Thumb src={m.url} radius={8} />
                        <div style={{ position: "absolute", top: 5, right: 5, width: 24, height: 24, borderRadius: "50%", border: "2px solid #fff", background: sel >= 0 ? C.green : "rgba(0,0,0,0.35)", color: "#04342C", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {sel >= 0 ? sel + 1 : ""}
                        </div>
                        {isVideoUrl(m.url) && <div style={{ position: "absolute", bottom: 5, left: 5, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 99 }}>▶</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Full-screen viewer ── */}
      {viewer && (
        <div style={{ ...overlay, zIndex: 10002, alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.96)" }} onClick={() => setViewer(null)}>
          <button onClick={() => setViewer(null)} style={{ ...closeBtn, position: "absolute", top: "calc(14px + env(safe-area-inset-top, 0px))", right: 16 }}>×</button>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
            {isVideoUrl(viewer.items[viewer.idx])
              ? <video key={viewer.items[viewer.idx]} src={viewer.items[viewer.idx]} controls autoPlay playsInline style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12 }} />
              : <img src={viewer.items[viewer.idx]} alt="" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, objectFit: "contain" }} />}
          </div>
          {viewer.items.length > 1 && (
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 16 }}>
              <button disabled={viewer.idx === 0} onClick={() => setViewer((v) => v && { ...v, idx: v.idx - 1 })} style={{ ...closeBtn, opacity: viewer.idx === 0 ? 0.3 : 1 }}>‹</button>
              <span style={{ color: C.sub, fontSize: 13, fontWeight: 700 }}>{viewer.idx + 1} / {viewer.items.length}</span>
              <button disabled={viewer.idx === viewer.items.length - 1} onClick={() => setViewer((v) => v && { ...v, idx: v.idx + 1 })} style={{ ...closeBtn, opacity: viewer.idx === viewer.items.length - 1 ? 0.3 : 1 }}>›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

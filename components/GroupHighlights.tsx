// components/GroupHighlights.tsx
//
// Renders a 27-slot photo grid for a group. Empty slots are dashed
// placeholders. Owners and moderators see an "Edit Highlights" button
// that opens a modal where they can pick photos from the group's full
// photo pool (posts + notes + war media, surfaced via /api/group-photos).
//
// Storage: `groups.highlights` is a jsonb array of URLs. The picker
// stages changes locally; clicking Save fires `save_group_highlights`
// to replace the full array. We don't try to do partial updates — the
// grid is small (max 27) so writing the whole array is fine.

"use client";

import { useEffect, useState, useCallback } from "react";

type Photo = {
  url: string;
  source: "post" | "note" | "war";
  source_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  caption: string | null;
  meta?: Record<string, any>;
};

type SourceFilter = "all" | "post" | "note" | "war";

const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: "All",
  post: "Posts",
  note: "Notes",
  war: "Wars",
};

const SOURCE_EMOJI: Record<Photo["source"], string> = {
  post: "📷",
  note: "📝",
  war: "⚔️",
};

// Theme tokens — matches the rest of the group page.
const C = {
  card: "#181028",
  cardElev: "#241636",
  border: "#2D1F52",
  borderHi: "#4C3A7A",
  text: "#F0F0F0",
  sub: "#8E8AA1",
  purple: "#7C3AED",
  purpleDim: "rgba(124,58,237,0.18)",
  gold: "#F5A623",
  red: "#EF4444",
};

const MAX_SLOTS = 27;

export type GroupHighlightsProps = {
  groupId: string;
  groupName?: string;
  /** URLs to show in the grid right now. Pass them down from the parent. */
  highlights: string[];
  /** "owner" | "moderator" | "member" | null. If null/member, edit is hidden. */
  role: string | null;
  /** Auth user id, needed to call save_group_highlights. */
  currentUserId: string | null;
  /** Called after a successful save with the new array so the parent can update. */
  onSaved?: (urls: string[]) => void;
};

export default function GroupHighlights({
  groupId,
  groupName,
  highlights,
  role,
  currentUserId,
  onSaved,
}: GroupHighlightsProps) {
  const [editing, setEditing] = useState(false);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [staged, setStaged] = useState<string[]>(highlights);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canEdit = role === "owner" || role === "moderator";

  // Sync staged with parent highlights any time the modal isn't open.
  // While editing, staged is the source of truth and we don't overwrite it.
  useEffect(() => {
    if (!editing) setStaged(highlights);
  }, [highlights, editing]);

  // Fetch full photo pool the first time the user opens the editor. Cached
  // for the lifetime of the modal so we don't refetch when they toggle filters.
  const loadPhotos = useCallback(async () => {
    if (photosLoaded) return;
    setPhotosLoading(true);
    try {
      const res = await fetch("/api/group-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_group_photos", payload: { groupId } }),
      });
      const data = await res.json();
      if (Array.isArray(data.photos)) {
        setAllPhotos(data.photos);
        setPhotosLoaded(true);
      } else {
        setAllPhotos([]);
      }
    } catch {
      setAllPhotos([]);
    }
    setPhotosLoading(false);
  }, [groupId, photosLoaded]);

  function openEditor() {
    if (!canEdit) return;
    setStaged(highlights);
    setSaveError(null);
    setEditing(true);
    loadPhotos();
  }

  function toggleStaged(url: string) {
    setStaged(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      if (prev.length >= MAX_SLOTS) return prev; // grid full, ignore
      return [...prev, url];
    });
  }

  function moveStaged(idx: number, dir: -1 | 1) {
    setStaged(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function clearStaged(url: string) {
    setStaged(prev => prev.filter(u => u !== url));
  }

  async function save() {
    if (!currentUserId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/group-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_group_highlights",
          payload: { userId: currentUserId, groupId, urls: staged },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSaveError(data.error || "Save failed");
        setSaving(false);
        return;
      }
      onSaved?.(staged);
      setEditing(false);
    } catch (e: any) {
      setSaveError(e?.message || "Save failed");
    }
    setSaving(false);
  }

  const filteredPhotos = filter === "all"
    ? allPhotos
    : allPhotos.filter(p => p.source === filter);

  return (
    <div style={{ background: C.card, borderRadius: 14, padding: 14, border: `1px solid ${C.border}` }}>
      {/* Header — title + edit button (mods only) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>📸</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Highlights</span>
          <span style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>
            {highlights.length} / {MAX_SLOTS}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={openEditor}
            style={{
              fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 8,
              border: `1px solid ${C.borderHi}`, background: C.purpleDim,
              color: C.text, cursor: "pointer",
            }}
          >
            ✏️ Edit
          </button>
        )}
      </div>

      {/* Grid — 3 cols × 9 rows = 27 slots. Empty slots are dashed boxes. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 4,
        }}
      >
        {Array.from({ length: MAX_SLOTS }).map((_, i) => {
          const url = highlights[i];
          if (!url) {
            return (
              <div
                key={`empty-${i}`}
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: 6,
                  border: `1px dashed ${C.border}`,
                  background: "rgba(255,255,255,0.02)",
                }}
              />
            );
          }
          return (
            <div
              key={i}
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 6,
                overflow: "hidden",
                border: `1px solid ${C.border}`,
                background: C.cardElev,
              }}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          );
        })}
      </div>

      {/* Editor modal */}
      {editing && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !saving && setEditing(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0F0820", borderRadius: 16, border: `1px solid ${C.border}`,
              maxWidth: 900, width: "100%", maxHeight: "100%",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal header */}
            <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>
                  Edit Highlights{groupName ? ` — ${groupName}` : ""}
                </div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>
                  Pick up to {MAX_SLOTS} photos from this group's media. Selected: {staged.length}/{MAX_SLOTS}
                </div>
              </div>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                style={{
                  fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8,
                  border: `1px solid ${C.borderHi}`, background: "transparent",
                  color: C.sub, cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Selected strip — shows current selections in order, with reorder/remove */}
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
                Selected ({staged.length})
              </div>
              {staged.length === 0 ? (
                <div style={{ fontSize: 12, color: C.sub, padding: "10px 0" }}>
                  Tap photos below to add them to highlights.
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                  {staged.map((url, idx) => (
                    <div key={url} style={{ position: "relative", flexShrink: 0, width: 70 }}>
                      <img
                        src={url}
                        alt=""
                        style={{
                          width: 70, height: 70, objectFit: "cover", borderRadius: 8,
                          border: `2px solid ${C.purple}`, display: "block",
                        }}
                      />
                      <div style={{
                        position: "absolute", top: 2, left: 2,
                        background: C.purple, color: "#fff",
                        fontSize: 10, fontWeight: 800,
                        borderRadius: 99, padding: "1px 6px",
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, gap: 2 }}>
                        <button
                          onClick={() => moveStaged(idx, -1)}
                          disabled={idx === 0}
                          style={{
                            flex: 1, padding: "2px 0", borderRadius: 4,
                            background: C.cardElev, color: idx === 0 ? C.sub : C.text,
                            border: "none", fontSize: 10, cursor: idx === 0 ? "default" : "pointer",
                          }}
                        >
                          ←
                        </button>
                        <button
                          onClick={() => moveStaged(idx, 1)}
                          disabled={idx === staged.length - 1}
                          style={{
                            flex: 1, padding: "2px 0", borderRadius: 4,
                            background: C.cardElev, color: idx === staged.length - 1 ? C.sub : C.text,
                            border: "none", fontSize: 10, cursor: idx === staged.length - 1 ? "default" : "pointer",
                          }}
                        >
                          →
                        </button>
                        <button
                          onClick={() => clearStaged(url)}
                          style={{
                            flex: 1, padding: "2px 0", borderRadius: 4,
                            background: "rgba(239,68,68,0.18)", color: C.red,
                            border: "none", fontSize: 10, cursor: "pointer", fontWeight: 700,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Source filter chips */}
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 6, overflowX: "auto" }}>
              {(Object.keys(SOURCE_LABELS) as SourceFilter[]).map(s => {
                const active = filter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    style={{
                      flexShrink: 0, padding: "6px 12px", borderRadius: 99,
                      border: `1px solid ${active ? C.purple : C.border}`,
                      background: active ? C.purple : "transparent",
                      color: active ? "#fff" : C.sub,
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    {SOURCE_LABELS[s]}
                  </button>
                );
              })}
            </div>

            {/* Photo pool */}
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {photosLoading && (
                <div style={{ textAlign: "center", padding: 40, color: C.sub, fontSize: 13 }}>
                  Loading photos...
                </div>
              )}
              {!photosLoading && filteredPhotos.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: C.sub, fontSize: 13 }}>
                  No {filter === "all" ? "" : SOURCE_LABELS[filter].toLowerCase() + " "}photos posted in this group yet.
                </div>
              )}
              {!photosLoading && filteredPhotos.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                  {filteredPhotos.map(p => {
                    const selected = staged.includes(p.url);
                    return (
                      <button
                        key={p.url}
                        onClick={() => toggleStaged(p.url)}
                        style={{
                          position: "relative", aspectRatio: "1 / 1", borderRadius: 8,
                          overflow: "hidden", border: selected ? `3px solid ${C.purple}` : `1px solid ${C.border}`,
                          background: C.cardElev, cursor: "pointer", padding: 0,
                        }}
                      >
                        <img
                          src={p.url}
                          alt=""
                          loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                        {/* Source badge top-left */}
                        <div style={{
                          position: "absolute", top: 4, left: 4,
                          fontSize: 11, color: "#fff",
                          background: "rgba(0,0,0,0.55)",
                          padding: "1px 6px", borderRadius: 99, fontWeight: 700,
                        }}>
                          {SOURCE_EMOJI[p.source]} {p.source}
                        </div>
                        {/* Selected check */}
                        {selected && (
                          <div style={{
                            position: "absolute", top: 4, right: 4,
                            fontSize: 11, color: "#fff", background: C.purple,
                            padding: "1px 7px", borderRadius: 99, fontWeight: 800,
                          }}>
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer — save / cancel */}
            <div style={{ padding: 14, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {saveError ? (
                <div style={{ fontSize: 12, color: C.red, flex: 1 }}>{saveError}</div>
              ) : (
                <div style={{ fontSize: 11, color: C.sub, flex: 1 }}>
                  Drag arrows to reorder. Tap a photo to toggle.
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  style={{
                    fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: 10,
                    border: `1px solid ${C.borderHi}`, background: "transparent",
                    color: C.sub, cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  style={{
                    fontSize: 13, fontWeight: 800, padding: "9px 22px", borderRadius: 10,
                    border: "none", background: `linear-gradient(135deg, ${C.purple}, #A78BFA)`,
                    color: "#fff", cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Saving…" : "💾 Save Highlights"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// components/GroupHighlights.tsx
//
// Renders a horizontally-scrollable strip of curated highlights for a
// group. Owners and moderators can pick from any photo OR video posted
// in the group (across posts, notes, and war media). Members see only
// the curated strip — no empty placeholders, no edit affordances.
//
// Videos autoplay muted when scrolled into view (standard mobile feed
// pattern — Instagram, TikTok, etc.). Tap to unmute. We use a single
// IntersectionObserver per tile so we can pause off-screen ones to save
// bandwidth and CPU.
//
// Storage: `groups.highlights` is a jsonb array of media URLs (photos
// AND videos mixed). We rely on file extension to distinguish at render
// time — no separate type field needed.

"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type MediaKind = "photo" | "video";

type GroupPhoto = {
  url: string;
  kind: MediaKind;
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
type KindFilter = "all" | "photo" | "video";

const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: "All",
  post: "Posts",
  note: "Notes",
  war: "Wars",
};

const SOURCE_EMOJI: Record<GroupPhoto["source"], string> = {
  post: "📷",
  note: "📝",
  war: "⚔️",
};

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

// Detect whether a URL points at a video. Most uploads land in supabase
// storage with predictable extensions, but the path may contain a hash
// or live under a /videos/ folder without an extension at all. We accept:
//   - explicit video extensions (mp4/mov/webm/m4v/hevc)
//   - any path segment containing /video or /videos
//   - any URL with `kind=video` or `type=video` query string
// Falls back to photo so we never silently break a known-good image.
export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  const path = lower.split("?")[0];
  if (/\.(mp4|mov|webm|m4v|hevc)(\b|$)/.test(path)) return true;
  if (/\/videos?\//.test(path)) return true;
  if (/[?&](kind|type)=video/.test(lower)) return true;
  return false;
}

export type GroupHighlightsProps = {
  groupId: string;
  groupName?: string;
  highlights: string[];
  role: string | null;
  currentUserId: string | null;
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
  const [allMedia, setAllMedia] = useState<GroupPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [staged, setStaged] = useState<string[]>(highlights);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canEdit = role === "owner" || role === "moderator";

  // Mirror parent highlights into staged when the modal isn't open. Inside
  // the modal, staged is the source of truth and we don't overwrite.
  useEffect(() => {
    if (!editing) setStaged(highlights);
  }, [highlights, editing]);

  const loadMedia = useCallback(async () => {
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
        // Determine kind. Prefer the API's `media_type` field (which comes
        // from the source row's media_type column) over URL extension
        // sniffing — supabase storage URLs don't always include an
        // extension, so URL-only detection misses uploads. Fall back to
        // URL extension when media_type is null (legacy rows pre-date
        // the column).
        const tagged: GroupPhoto[] = data.photos.map((p: any) => ({
          ...p,
          kind: p.media_type === 'video' || (p.media_type == null && isVideoUrl(p.url))
            ? 'video'
            : 'photo',
        }));
        setAllMedia(tagged);
        setPhotosLoaded(true);
      } else {
        setAllMedia([]);
      }
    } catch {
      setAllMedia([]);
    }
    setPhotosLoading(false);
  }, [groupId, photosLoaded]);

  function openEditor() {
    if (!canEdit) return;
    setStaged(highlights);
    setSaveError(null);
    setEditing(true);
    loadMedia();
  }

  function toggleStaged(url: string) {
    setStaged(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      if (prev.length >= MAX_SLOTS) return prev;
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
    // The database is sometimes slow/overloaded, which made the save fail and
    // the removed highlight reappear on reload. Retry transient failures a few
    // times; bail immediately on a 403 (permission) since retrying won't help.
    let lastErr = "Save failed";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch("/api/group-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_group_highlights",
            payload: { userId: currentUserId, groupId, urls: staged },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && !data.error) {
          onSaved?.(staged);
          setEditing(false);
          setSaving(false);
          return;
        }
        lastErr = data.error || "Save failed";
        if (res.status === 403) break;
      } catch (e: any) {
        lastErr = e?.message || "Save failed";
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
    setSaveError(lastErr);
    setSaving(false);
  }

  const filteredMedia = allMedia.filter(p => {
    if (filter !== "all" && p.source !== filter) return false;
    if (kindFilter !== "all" && p.kind !== kindFilter) return false;
    return true;
  });

  // Don't render anything when there are no highlights and the viewer
  // can't edit — keeps non-curated groups from showing an empty shell.
  if (highlights.length === 0 && !canEdit) return null;

  return (
    <div style={{ background: C.card, borderRadius: 14, padding: 14, border: `1px solid ${C.border}` }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>📸</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Highlights</span>
          {highlights.length > 0 && (
            <span style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>
              {highlights.length}
            </span>
          )}
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

      {/* Body — horizontal scroller (no empty placeholders). Empty state
          shown only to mods/owners; members short-circuited above. */}
      {highlights.length === 0 ? (
        <div style={{ padding: "20px 14px", textAlign: "center", fontSize: 13, color: C.sub, border: `1px dashed ${C.border}`, borderRadius: 10 }}>
          No highlights yet — tap Edit to feature photos and videos from this group.
        </div>
      ) : (
        <HighlightsStrip urls={highlights} />
      )}

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
                  Pick up to {MAX_SLOTS} photos or videos. Selected: {staged.length}/{MAX_SLOTS}
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

            {/* Selected strip */}
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
                Selected ({staged.length})
              </div>
              {staged.length === 0 ? (
                <div style={{ fontSize: 12, color: C.sub, padding: "10px 0" }}>
                  Tap items below to add them to highlights.
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                  {staged.map((url, idx) => {
                    const isVid = isVideoUrl(url);
                    return (
                      <div key={url} style={{ position: "relative", flexShrink: 0, width: 70 }}>
                        {isVid ? (
                          <video
                            src={url}
                            muted
                            playsInline
                            preload="metadata"
                            style={{
                              width: 70, height: 70, objectFit: "cover", borderRadius: 8,
                              border: `2px solid ${C.purple}`, display: "block", background: "#000",
                            }}
                          />
                        ) : (
                          <img
                            src={url}
                            alt=""
                            style={{
                              width: 70, height: 70, objectFit: "cover", borderRadius: 8,
                              border: `2px solid ${C.purple}`, display: "block",
                            }}
                          />
                        )}
                        {/* Order badge */}
                        <div style={{
                          position: "absolute", top: 2, left: 2,
                          background: C.purple, color: "#fff",
                          fontSize: 10, fontWeight: 800,
                          borderRadius: 99, padding: "1px 6px",
                        }}>
                          {idx + 1}
                        </div>
                        {isVid && (
                          <div style={{
                            position: "absolute", top: 2, right: 2,
                            background: "rgba(0,0,0,0.7)", color: "#fff",
                            fontSize: 9, fontWeight: 700,
                            borderRadius: 4, padding: "1px 4px",
                          }}>▶</div>
                        )}
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
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filters: source + kind */}
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(SOURCE_LABELS) as SourceFilter[]).map(s => {
                const active = filter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    style={{
                      padding: "6px 12px", borderRadius: 99,
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
              <div style={{ width: 1, background: C.border, alignSelf: "stretch", margin: "0 4px" }} />
              {(["all", "photo", "video"] as KindFilter[]).map(k => {
                const active = kindFilter === k;
                return (
                  <button
                    key={k}
                    onClick={() => setKindFilter(k)}
                    style={{
                      padding: "6px 12px", borderRadius: 99,
                      border: `1px solid ${active ? C.gold : C.border}`,
                      background: active ? "rgba(245,166,35,0.2)" : "transparent",
                      color: active ? C.gold : C.sub,
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    {k === "all" ? "📸+▶" : k === "photo" ? "📸 Photos" : "▶ Videos"}
                  </button>
                );
              })}
            </div>

            {/* Media pool */}
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {photosLoading && (
                <div style={{ textAlign: "center", padding: 40, color: C.sub, fontSize: 13 }}>
                  Loading media...
                </div>
              )}
              {!photosLoading && filteredMedia.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: C.sub, fontSize: 13 }}>
                  No matching media in this group yet.
                </div>
              )}
              {!photosLoading && filteredMedia.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                  {filteredMedia.map(p => {
                    const selected = staged.includes(p.url);
                    return (
                      <button
                        key={p.url + p.source_id}
                        onClick={() => toggleStaged(p.url)}
                        style={{
                          position: "relative", aspectRatio: "1 / 1", borderRadius: 8,
                          overflow: "hidden", border: selected ? `3px solid ${C.purple}` : `1px solid ${C.border}`,
                          background: C.cardElev, cursor: "pointer", padding: 0,
                        }}
                      >
                        {p.kind === "video" ? (
                          // Preview-only — autoplay happens in the public strip.
                          <video
                            src={p.url}
                            muted
                            playsInline
                            preload="metadata"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
                          />
                        ) : (
                          <img
                            src={p.url}
                            alt=""
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        )}
                        {/* Source badge */}
                        <div style={{
                          position: "absolute", top: 4, left: 4,
                          fontSize: 10, color: "#fff",
                          background: "rgba(0,0,0,0.55)",
                          padding: "1px 6px", borderRadius: 99, fontWeight: 700,
                        }}>
                          {SOURCE_EMOJI[p.source]} {p.source}
                        </div>
                        {p.kind === "video" && (
                          <div style={{
                            position: "absolute", bottom: 4, left: 4,
                            fontSize: 11, color: "#fff",
                            background: "rgba(0,0,0,0.7)",
                            padding: "1px 6px", borderRadius: 99, fontWeight: 800,
                          }}>▶</div>
                        )}
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

            {/* Footer */}
            <div style={{ padding: 14, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {saveError ? (
                <div style={{ fontSize: 12, color: C.red, flex: 1 }}>{saveError}</div>
              ) : (
                <div style={{ fontSize: 11, color: C.sub, flex: 1 }}>
                  Tap an item to toggle. Use ←/→ to reorder selected.
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

// ─────────────────────────────────────────────────────────────────────────
// HighlightsStrip — public-facing horizontal scroller. Re-used by group AND
// profile pages, so it's exported as a named export. Takes a flat URL list,
// renders photos and videos at uniform tile size, autoplays videos when
// they scroll into view.
// ─────────────────────────────────────────────────────────────────────────

export function HighlightsStrip({ urls }: { urls: string[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Recompute whether the arrows should be enabled based on scroll position.
  function updateArrows() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    // 4px fudge so rounding doesn't leave the right arrow stuck "enabled".
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [urls.length]);

  // Scroll by roughly one tile (tile width + gap) in the given direction.
  function nudge(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    // First child is a tile; use its width so the step matches the tile size
    // (which is responsive). Fall back to 208 if we can't measure.
    const firstTile = el.firstElementChild as HTMLElement | null;
    const step = (firstTile?.offsetWidth ?? 200) + 8; // +8 = the flex gap
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  if (urls.length === 0) return null;

  const arrowBtn = (dir: -1 | 1, enabled: boolean): React.CSSProperties => ({
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [dir === -1 ? "left" : "right"]: 6,
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "none",
    background: "rgba(13,13,13,0.72)",
    color: "#fff",
    fontSize: 20,
    lineHeight: 1,
    cursor: enabled ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 2,
    zIndex: 2,
    opacity: enabled ? 1 : 0,
    pointerEvents: enabled ? "auto" : "none",
    transition: "opacity 0.2s",
    boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
  });

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={scrollerRef}
        className="hl-strip"
        style={{
          display: "flex",
          gap: 8,
          // Arrows now drive navigation. We keep the element scrollable (so
          // the arrows have something to scroll, and trackpads/keyboards
          // still work) but hide the scrollbar and disable the swipe-snap
          // feel that the user didn't like.
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 4,
          scrollbarWidth: "none",        // Firefox
          msOverflowStyle: "none",       // IE/Edge legacy
        }}
      >
        {/* Hide the WebKit scrollbar (Chrome/Safari) for this strip only. */}
        <style jsx>{`
          .hl-strip::-webkit-scrollbar { display: none; height: 0; }
        `}</style>
        {urls.map((url, i) => (
          <HighlightTile key={url + i} url={url} />
        ))}
      </div>

      <button type="button" aria-label="Previous highlights" onClick={() => nudge(-1)} style={arrowBtn(-1, canLeft)}>‹</button>
      <button type="button" aria-label="Next highlights" onClick={() => nudge(1)} style={arrowBtn(1, canRight)}>›</button>
    </div>
  );
}

function HighlightTile({ url }: { url: string }) {
  const isVid = isVideoUrl(url);
  const tileRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [showFull, setShowFull] = useState(false);

  // Autoplay-on-scroll for videos. Each tile has its own observer so we
  // can play and pause based on visibility without the parent caring.
  // Threshold 0.5 = play when at least half the tile is visible.
  useEffect(() => {
    if (!isVid || !tileRef.current || !videoRef.current) return;
    const v = videoRef.current;
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // play() can reject if the browser blocks autoplay (rare for
            // muted video but possible on iOS low-power mode). We swallow
            // the rejection so the page doesn't error out.
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(tileRef.current);
    return () => observer.disconnect();
  }, [isVid]);

  // Tap behavior:
  //   photos          → open lightbox
  //   videos (tile)   → open lightbox (full controls + audio)
  //   videos (mute btn) → toggle mute in-place; click is stopped from
  //                       bubbling so it doesn't ALSO open the lightbox
  //
  // Previously the mute toggle was bolted onto the tile click via a
  // "first tap unmutes, second tap opens" pattern, with the visual
  // mute indicator set to pointerEvents:none. That's confusing — users
  // intuitively want the speaker icon to BE the mute control. Splitting
  // it gives a clear contract: tap the icon for mute, tap the video for
  // fullscreen.
  function onTileClick() {
    setShowFull(true);
  }

  function onMuteClick(e: React.MouseEvent) {
    // Stop bubbling so the parent tile doesn't ALSO fire and open the
    // lightbox. Without this, every mute tap would also pop fullscreen.
    e.stopPropagation();
    const next = !muted;
    setMuted(next);
    // Mirror the change directly onto the DOM video so playback reflects
    // it within the same user-gesture frame. Browsers (especially iOS)
    // require the unmute to happen synchronously inside the click event;
    // waiting for the next React render is too late and the unmute gets
    // silently rejected.
    if (videoRef.current) videoRef.current.muted = next;
  }

  // Tile size: ~200px on desktop, scales down to 42vw on mobile so 2-3
  // tiles peek into view at a time and the user understands it scrolls.
  const tileSize = "min(200px, 42vw)";

  return (
    <>
      <div
        ref={tileRef}
        onClick={onTileClick}
        style={{
          position: "relative",
          width: tileSize,
          height: tileSize,
          flexShrink: 0,
          borderRadius: 12,
          overflow: "hidden",
          border: `1px solid ${C.border}`,
          background: "#000",
          cursor: "pointer",
          scrollSnapAlign: "start",
        }}
      >
        {isVid ? (
          <video
            ref={videoRef}
            src={url}
            muted={muted}
            loop
            playsInline
            preload="metadata"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <img
            src={url}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
        {isVid && (
          <button
            onClick={onMuteClick}
            // Mobile browsers sometimes fire pointer/touch events before
            // React's onClick, and stopping propagation only on click can
            // let a phantom touchstart leak through to the parent tile,
            // popping the lightbox. Stopping at pointerdown too closes
            // that gap.
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            aria-label={muted ? "Unmute" : "Mute"}
            style={{
              position: "absolute", bottom: 8, right: 8,
              // 40x40 is large enough to hit reliably on mobile (Apple HIG
              // recommends 44x44 minimum for tap targets; we're close
              // while staying visually unobtrusive on the tile).
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(0,0,0,0.75)",
              color: "#fff",
              fontSize: 18,
              padding: 0,
              border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              // Keep above the video element so taps land on the button,
              // not on the video.
              zIndex: 3,
              // Subtle shadow for visibility against bright video frames
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}
      </div>

      {/* Lightbox modal — full-screen view */}
      {showFull && (
        <div
          onClick={() => setShowFull(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
            zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, cursor: "zoom-out",
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "100%" }}>
            {isVid ? (
              <video
                src={url}
                autoPlay
                loop
                controls
                playsInline
                style={{ maxWidth: "min(900px, 100vw)", maxHeight: "90vh", display: "block", borderRadius: 12 }}
              />
            ) : (
              <img
                src={url}
                alt=""
                style={{ maxWidth: "min(900px, 100vw)", maxHeight: "90vh", display: "block", borderRadius: 12 }}
              />
            )}
          </div>
          <button
            onClick={() => setShowFull(false)}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.15)", border: "none",
              color: "#fff", width: 40, height: 40, borderRadius: 99,
              fontSize: 18, fontWeight: 800, cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

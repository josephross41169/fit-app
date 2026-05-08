"use client";
// ── components/TemplateGallery.tsx ─────────────────────────────────────────
// Halo-3-file-share-style grid of a user's saved workout templates.
// Renders on the profile page (own + public). Tapping a card opens an
// inline preview that lists every day and the exercises within. Owners
// see their full library; viewers see only is_public templates.
//
// Why a shared component (vs inlining on each page):
//   • The card visual + preview modal are non-trivial; duplicating means
//     drift between own/public profile views
//   • The post page's Browse Templates flow (Session 4 part 2) reuses
//     the same preview modal — having one source of truth keeps it
//     consistent and lets us evolve the design once
//
// SCHEMA REQUIREMENTS
// Reads from workout_templates with the V2 columns added by
// migration-template-builder.sql:
//   • cover_emoji, description, is_public, days, use_count, updated_at
// Falls back gracefully on legacy templates that only have `exercises`.

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── Types (mirror the post page's WorkoutTemplate shape) ─────────────────
type ExLite = { name: string; sets: string; reps: string; weight?: string; notes?: string };
type DayLite = { day_name: string; exercises: ExLite[] };
type TemplateRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_emoji: string | null;
  is_public: boolean;
  use_count: number | null;
  days: DayLite[] | null;
  exercises: ExLite[] | null; // legacy single-day fallback
  updated_at: string | null;
  created_at: string;
};

type Props = {
  /** Profile being viewed. Filters which templates load. */
  ownerId: string;
  /** When true, show non-public templates AND render owner-only controls
   *  (delete, edit launches builder). When false, public templates only. */
  isOwner: boolean;
  /** Callback when the owner taps the "+ New" button. The post page is
   *  the canonical authoring surface — this just routes the user there.
   *  Provided as a callback so the embedder controls the navigation
   *  (could be a Link or a router.push). */
  onCreateNew?: () => void;
  /** Callback for "Use this day" inside the preview. Receives the
   *  template's full row and the day index the user picked. The
   *  embedder typically routes to /post and pre-fills the form.
   *  Hidden when not provided (e.g. on a public profile when nobody's
   *  signed in). */
  onUseDay?: (template: TemplateRow, dayIndex: number) => void;
};

const C = {
  card: "#FFFFFF",
  cardBg: "rgba(124,58,237,0.06)",
  border: "#2D1F52",
  borderMid: "#3D2A6E",
  purple: "#7C3AED",
  purpleLight: "#A78BFA",
  text: "#1A1228",
  sub: "#6B7280",
  subMuted: "#9CA3AF",
  gold: "#F59E0B",
  greenLight: "#D1FAE5",
};

export default function TemplateGallery({ ownerId, isOwner, onCreateNew, onUseDay }: Props) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<TemplateRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // Owners see all their templates (public + private). Viewers see
      // only public ones — RLS would also enforce this, but filtering
      // client-side avoids a round-trip when we already know the
      // viewer isn't the owner.
      let q = supabase
        .from("workout_templates")
        .select("id, user_id, name, description, cover_emoji, is_public, use_count, days, exercises, updated_at, created_at")
        .eq("user_id", ownerId)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (!isOwner) q = q.eq("is_public", true);
      const { data } = await q;
      setTemplates((data as TemplateRow[]) || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [ownerId, isOwner]);

  useEffect(() => { reload(); }, [reload]);

  // Owner-only delete. Soft-confirms via window.confirm; the row is
  // gone permanently after this so we don't want a stray tap to nuke
  // a Push/Pull/Legs the user spent 10 minutes building.
  async function handleDelete(id: string) {
    if (!isOwner) return;
    if (!window.confirm("Delete this template? This can't be undone.")) return;
    try {
      await supabase.from("workout_templates").delete().eq("id", id).eq("user_id", ownerId);
      setTemplates(t => t.filter(x => x.id !== id));
      if (previewing?.id === id) setPreviewing(null);
    } catch (e) {
      console.error("[TemplateGallery] delete failed", e);
    }
  }

  // ── Card stat helpers ───────────────────────────────────────────────────
  // Count days/exercises off whichever shape is populated. V2 templates
  // have `days`; legacy ones only have `exercises`.
  function countStats(t: TemplateRow) {
    const days = Array.isArray(t.days) ? t.days : [];
    if (days.length > 0) {
      const exCount = days.reduce((sum, d) => sum + (d.exercises?.length || 0), 0);
      return { dayCount: days.length, exCount };
    }
    return { dayCount: 1, exCount: (t.exercises || []).length };
  }

  return (
    <div>
      {/* ── Empty / loading states ─────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.sub, fontSize: 13 }}>
          Loading templates…
        </div>
      ) : templates.length === 0 ? (
        // Different empty copy depending on viewing context. Owner gets
        // a CTA; viewer just sees a quiet "nothing to show."
        isOwner ? (
          <button
            onClick={onCreateNew}
            style={{
              width: "100%", padding: "22px 14px",
              borderRadius: 14, border: `2px dashed ${C.borderMid}`,
              background: "rgba(124,58,237,0.04)",
              color: C.purple, fontWeight: 700, fontSize: 13, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}
          >
            <span style={{ fontSize: 24 }}>+</span>
            <span>Build your first template</span>
            <span style={{ fontSize: 11, color: C.subMuted, fontWeight: 500 }}>
              Save a workout once, reuse it forever
            </span>
          </button>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0", color: C.sub, fontSize: 12 }}>
            No public templates yet
          </div>
        )
      ) : (
        // ── Card grid — 2-up on narrow viewports ────────────────────────
        // Cards aren't full-width because templates are a glanceable list
        // (you scan the names/emojis, you don't read each one). 2 columns
        // gives 4 above the fold on mobile which is enough to gauge
        // whether the user has a library going.
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 10,
        }}>
          {templates.map(t => {
            const { dayCount, exCount } = countStats(t);
            return (
              <button
                key={t.id}
                onClick={() => setPreviewing(t)}
                style={{
                  textAlign: "left", padding: 12, borderRadius: 14,
                  background: C.cardBg, border: `1.5px solid ${C.border}`,
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  gap: 8, minHeight: 110, transition: "transform 0.1s, border 0.1s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.purpleLight; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `linear-gradient(135deg, ${C.purple}, #4ADE80)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, flexShrink: 0,
                  }}>
                    {t.cover_emoji || "📋"}
                  </div>
                  {!t.is_public && isOwner && (
                    // Private chip — only the owner sees this. Viewers
                    // never see private templates at all (RLS + client
                    // filter both gate on is_public for non-owners).
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: C.subMuted,
                      padding: "2px 6px", borderRadius: 99,
                      background: "rgba(0,0,0,0.05)", border: `1px solid ${C.borderMid}`,
                      whiteSpace: "nowrap", marginLeft: "auto",
                    }}>🔒 Private</span>
                  )}
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, color: C.text, lineHeight: 1.3 }}>
                  {t.name}
                </div>
                {t.description && (
                  <div style={{
                    fontSize: 11, color: C.sub, lineHeight: 1.4,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                  }}>
                    {t.description}
                  </div>
                )}
                <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: C.subMuted, fontWeight: 600 }}>
                    {dayCount > 1 ? `${dayCount} days · ${exCount} exercises` : `${exCount} exercise${exCount !== 1 ? "s" : ""}`}
                  </span>
                  {(t.use_count ?? 0) > 0 && (
                    <span style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>
                      · used {t.use_count}×
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Preview modal ─────────────────────────────────────────────── */}
      {previewing && (
        <TemplatePreview
          template={previewing}
          isOwner={isOwner}
          onClose={() => setPreviewing(null)}
          onUseDay={onUseDay ? (dayIndex) => {
            // Hand the parent the full row + day index. Parent decides
            // routing (post page autofill, etc) and is responsible for
            // any side effects like incrementing use_count.
            onUseDay(previewing, dayIndex);
            setPreviewing(null);
          } : undefined}
          onDelete={isOwner ? () => handleDelete(previewing.id) : undefined}
        />
      )}
    </div>
  );
}

// ── Preview modal ────────────────────────────────────────────────────────
// Shows the template's metadata + every day expanded with its exercises.
// Owner gets a Delete button. When onUseDay is provided (i.e. someone is
// shopping for a workout to do today), each day gets a "Use this day"
// CTA that bubbles up to the parent.
function TemplatePreview({
  template,
  isOwner,
  onClose,
  onUseDay,
  onDelete,
}: {
  template: TemplateRow;
  isOwner: boolean;
  onClose: () => void;
  onUseDay?: (dayIndex: number) => void;
  onDelete?: () => void;
}) {
  // Resolve days from V2 shape, falling back to legacy single-day.
  const days: DayLite[] = Array.isArray(template.days) && template.days.length > 0
    ? template.days
    : [{ day_name: "Day 1", exercises: template.exercises || [] }];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0F0820", borderRadius: 20,
          maxWidth: 520, width: "100%", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          border: `1.5px solid ${C.border}`,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.purple}, #4ADE80)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, flexShrink: 0,
          }}>
            {template.cover_emoji || "📋"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 17, color: "#F0F0F0" }}>
              {template.name}
            </div>
            {template.description && (
              <div style={{ fontSize: 12, color: C.subMuted, marginTop: 4, lineHeight: 1.4 }}>
                {template.description}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 10, color: C.subMuted, fontWeight: 600 }}>
              <span>{days.length} day{days.length !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{days.reduce((s, d) => s + (d.exercises?.length || 0), 0)} exercises</span>
              {(template.use_count ?? 0) > 0 && (<><span>·</span><span style={{ color: C.gold }}>{template.use_count}× used</span></>)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.subMuted, fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1, width: 28, flexShrink: 0 }}
          >×</button>
        </div>

        {/* Days list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 14px" }}>
          {days.map((day, idx) => (
            <div key={idx} style={{
              marginBottom: 14, padding: 14,
              borderRadius: 14,
              background: "rgba(124,58,237,0.08)",
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#F0F0F0" }}>
                  {day.day_name || `Day ${idx + 1}`}
                </div>
                {onUseDay && (
                  <button
                    onClick={() => onUseDay(idx)}
                    style={{
                      padding: "6px 12px", borderRadius: 99,
                      background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
                      border: "none", color: "#fff",
                      fontWeight: 800, fontSize: 11, cursor: "pointer",
                      whiteSpace: "nowrap" as const,
                    }}
                  >Use this day →</button>
                )}
              </div>
              {(day.exercises || []).length === 0 ? (
                <div style={{ fontSize: 11, color: C.subMuted, fontStyle: "italic" }}>No exercises</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(day.exercises || []).map((ex, exIdx) => (
                    <div key={exIdx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#E2E8F0" }}>
                      <div style={{ flex: 1, minWidth: 0, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ex.name || <em style={{ color: C.subMuted }}>(unnamed)</em>}
                      </div>
                      <div style={{ fontSize: 11, color: C.subMuted, fontWeight: 600, flexShrink: 0 }}>
                        {ex.sets}×{ex.reps}
                        {ex.weight ? ` · ${ex.weight}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer — owner controls */}
        {isOwner && onDelete && (
          <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={onDelete}
              style={{
                padding: "8px 14px", borderRadius: 10,
                background: "rgba(255,68,68,0.15)", color: "#FF6666",
                border: "1px solid rgba(255,68,68,0.3)",
                fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}
            >Delete template</button>
          </div>
        )}
      </div>
    </div>
  );
}

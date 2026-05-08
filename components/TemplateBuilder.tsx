"use client";
// ── components/TemplateBuilder.tsx ────────────────────────────────────────
// Full-screen modal for building/editing a multi-day workout template.
//
// A template is the user's reusable workout blueprint — e.g. "Push/Pull/
// Legs 3-Day Split" — saved once, then loaded onto a workout post page so
// they don't have to re-enter sets/reps/exercises every session. This
// builder is the authoring surface; the consumer side (Browse Templates +
// Pick a Day) lives on the post page and is built in Session 4.
//
// Schema (workout_templates table; see migration-template-builder.sql):
//   • name           text    — "Push/Pull/Legs"
//   • description    text    — owner's blurb shown in the profile gallery
//   • cover_emoji    text    — quick visual identifier
//   • is_public      bool    — gates the profile-gallery view
//   • days           jsonb   — [{ day_name, exercises: [{ name, sets, reps,
//                                                           weight, notes }] }]
//
// The legacy `exercises` jsonb column is also written to with day-1's
// exercises so older readers (the existing Load Template dropdown that
// hasn't been upgraded yet) still see something useful.
//
// PROPS
//   • open / onClose       — modal visibility control owned by parent
//   • userId               — current user, written as `user_id` on the row
//   • initialDay1          — pre-populate Day 1 with the user's current
//                             workout-form exercises. Lets "Save as Template"
//                             open the builder pre-filled instead of empty.
//   • initialName, initialDescription, initialCoverEmoji — edit mode
//   • templateId           — when set, save updates the existing row; when
//                             null, a new row is inserted.
//   • onSaved              — fired after a successful save with the new/
//                             updated template; parent can refresh its list

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Mirror the post page's Exercise shape exactly so we can ship Day 1
// pre-populated with the user's current workout form. Optional fields
// are kept optional here too.
export type TemplateExercise = {
  name: string;
  sets: string;
  reps: string;
  weight?: string;
  weights?: string[];
  repsArr?: string[];
  notes?: string;
};

export type TemplateDay = {
  day_name: string;
  exercises: TemplateExercise[];
};

export type Template = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_emoji: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  use_count: number;
  days: TemplateDay[];
  // Legacy single-day shape — readable but no longer the source of truth.
  exercises?: TemplateExercise[];
  created_at?: string;
  updated_at?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  initialDay1?: TemplateExercise[];
  initialName?: string;
  initialDescription?: string;
  initialCoverEmoji?: string;
  initialDays?: TemplateDay[];
  templateId?: string | null;
  onSaved?: (tpl: Template) => void;
};

// A small picker — covers the most common gym categories. Free-form emoji
// input is overkill for the cover slot; a curated set keeps the gallery
// visually consistent.
const COVER_EMOJIS = ["💪", "🏋️", "🦵", "🦾", "🏃", "🚴", "🧘", "🥊", "🏊", "🚣", "🔥", "⚡"];

const C = {
  bg: "#0A0118",
  card: "#1A1228",
  border: "#2D1B69",
  borderActive: "#7C3AED",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  muted: "#6B7280",
  blue: "#7C3AED",
  blueLight: "rgba(124,58,237,0.15)",
  green: "#10B981",
  red: "#EF4444",
  redBg: "rgba(239,68,68,0.10)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1.5px solid ${C.border}`,
  background: "#0F0820",
  color: C.text,
  fontSize: 14,
  fontWeight: 500,
  outline: "none" as const,
};

const smallInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: "7px 10px",
  fontSize: 13,
};

export default function TemplateBuilder({
  open,
  onClose,
  userId,
  initialDay1,
  initialName,
  initialDescription,
  initialCoverEmoji,
  initialDays,
  templateId,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverEmoji, setCoverEmoji] = useState("💪");
  const [days, setDays] = useState<TemplateDay[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the modal opens so old drafts don't bleed
  // through. We seed from initial* props if provided (edit mode or
  // "save as template" flow); otherwise start with an empty Day 1.
  useEffect(() => {
    if (!open) return;
    setName(initialName || "");
    setDescription(initialDescription || "");
    setCoverEmoji(initialCoverEmoji || "💪");
    setError(null);
    if (initialDays && initialDays.length > 0) {
      // Edit mode — load the saved days as-is.
      setDays(initialDays.map(d => ({ ...d, exercises: [...d.exercises] })));
    } else if (initialDay1 && initialDay1.length > 0) {
      // "Save as Template" from the post page — wrap current exercises
      // as Day 1 of a fresh template. User can add more days from here.
      setDays([{ day_name: "Day 1", exercises: initialDay1.map(e => ({ ...e })) }]);
    } else {
      // Fresh from the "Build Template" button — start with one empty
      // day + one empty exercise row so the user has something to type
      // into without hunting for an "Add" button.
      setDays([{
        day_name: "Day 1",
        exercises: [{ name: "", sets: "3", reps: "10" }],
      }]);
    }
  }, [open, initialName, initialDescription, initialCoverEmoji, initialDays, initialDay1]);

  if (!open) return null;

  // ── Day operations ──────────────────────────────────────────────────────
  const addDay = () => {
    setDays(d => [
      ...d,
      {
        day_name: `Day ${d.length + 1}`,
        exercises: [{ name: "", sets: "3", reps: "10" }],
      },
    ]);
  };

  const removeDay = (idx: number) => {
    if (days.length <= 1) return; // keep at least one day
    setDays(d => d.filter((_, i) => i !== idx));
  };

  const updateDayName = (idx: number, dayName: string) => {
    setDays(d => d.map((day, i) => (i === idx ? { ...day, day_name: dayName } : day)));
  };

  // ── Exercise operations ─────────────────────────────────────────────────
  const addExercise = (dayIdx: number) => {
    setDays(d => d.map((day, i) =>
      i === dayIdx
        ? { ...day, exercises: [...day.exercises, { name: "", sets: "3", reps: "10" }] }
        : day
    ));
  };

  const removeExercise = (dayIdx: number, exIdx: number) => {
    setDays(d => d.map((day, i) =>
      i === dayIdx
        ? { ...day, exercises: day.exercises.filter((_, j) => j !== exIdx) }
        : day
    ));
  };

  const updateExercise = (dayIdx: number, exIdx: number, patch: Partial<TemplateExercise>) => {
    setDays(d => d.map((day, i) =>
      i === dayIdx
        ? { ...day, exercises: day.exercises.map((ex, j) => j === exIdx ? { ...ex, ...patch } : ex) }
        : day
    ));
  };

  // ── Save ────────────────────────────────────────────────────────────────
  // Validates required fields (name + at least one exercise across all
  // days), strips empty exercise rows, then upserts. Days with no
  // exercises get pruned automatically — a template with an empty Day
  // 4 doesn't need to be saved.
  const handleSave = async () => {
    if (saving) return;
    setError(null);
    if (!name.trim()) {
      setError("Give your template a name.");
      return;
    }
    // Strip empty rows. An exercise without a name is incomplete and
    // should not be saved (otherwise loaders would have to filter on
    // every read).
    const cleanedDays: TemplateDay[] = days
      .map(d => ({
        day_name: d.day_name.trim() || "Day",
        exercises: d.exercises.filter(ex => ex.name.trim().length > 0).map(ex => ({
          name: ex.name.trim(),
          sets: String(ex.sets || "3"),
          reps: String(ex.reps || "10"),
          ...(ex.weight ? { weight: String(ex.weight) } : {}),
          ...(ex.notes ? { notes: ex.notes } : {}),
        })),
      }))
      .filter(d => d.exercises.length > 0);

    if (cleanedDays.length === 0) {
      setError("Add at least one exercise to a day.");
      return;
    }

    setSaving(true);
    try {
      // Mirror Day 1 into the legacy `exercises` column so that the
      // older Load Template dropdown (still in use until Session 4
      // replaces it) keeps working without a code change. The new
      // Browse Templates flow reads `days` directly.
      const legacyExercises = cleanedDays[0].exercises;

      const payload: any = {
        user_id: userId,
        name: name.trim(),
        description: description.trim() || null,
        cover_emoji: coverEmoji,
        is_public: true,
        days: cleanedDays,
        exercises: legacyExercises,
        updated_at: new Date().toISOString(),
      };

      let saved: Template | null = null;
      if (templateId) {
        // (supabase as any) cast because the new template columns
        // (days, description, cover_emoji, is_public, use_count,
        // updated_at) aren't in the generated database.types.ts yet —
        // running `supabase gen types` post-migration would fix this
        // properly. Same pattern used elsewhere in the codebase.
        const { data, error: upErr } = await (supabase as any)
          .from("workout_templates")
          .update(payload)
          .eq("id", templateId)
          .eq("user_id", userId) // defense in depth — RLS handles this too
          .select()
          .single();
        if (upErr) throw upErr;
        saved = data as Template;
      } else {
        const { data, error: insErr } = await (supabase as any)
          .from("workout_templates")
          .insert(payload)
          .select()
          .single();
        if (insErr) throw insErr;
        saved = data as Template;
      }

      if (saved && onSaved) onSaved(saved);
      onClose();
    } catch (e: any) {
      // The most common cause is the migration not having been run yet —
      // surfacing the message helps Joey diagnose without diving into
      // the console.
      const msg = e?.message || "Couldn't save your template.";
      const looksLikeMissingColumn = /column .* does not exist|days|cover_emoji/i.test(msg);
      setError(looksLikeMissingColumn
        ? "DB needs the template-builder migration. Run migration-template-builder.sql in Supabase."
        : msg);
    } finally {
      setSaving(false);
    }
  };

  // Total exercise count for the header — gives the user a sense of
  // "how big is this template" while they're building it.
  const totalExercises = days.reduce((sum, d) => sum + d.exercises.filter(e => e.name.trim()).length, 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "0 0 0 0",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.bg,
          width: "100%",
          maxWidth: 640,
          maxHeight: "100vh",
          overflowY: "auto" as const,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sticky header — name, close, save count */}
        <div style={{
          position: "sticky" as const,
          top: 0,
          zIndex: 2,
          background: C.bg,
          borderBottom: `1px solid ${C.border}`,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.sub, fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1, width: 28 }}
          >
            ×
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>
              {templateId ? "Edit Template" : "Build a Template"}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {days.length} day{days.length !== 1 ? "s" : ""} · {totalExercises} exercise{totalExercises !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{
              padding: "8px 18px",
              borderRadius: 99,
              border: "none",
              background: !name.trim() || saving ? C.border : `linear-gradient(135deg, ${C.blue}, #A78BFA)`,
              color: "#fff",
              fontWeight: 900,
              fontSize: 13,
              cursor: !name.trim() || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div style={{ padding: "16px 16px 80px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Cover + name + description card */}
          <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `linear-gradient(135deg, ${C.blue}, #4ADE80)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, flexShrink: 0,
              }}>
                {coverEmoji}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Template name (e.g. Push Pull Legs)"
                  style={{ ...inputStyle, fontSize: 15, fontWeight: 700 }}
                  maxLength={60}
                />
                <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                  {COVER_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setCoverEmoji(emoji)}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: coverEmoji === emoji ? `1.5px solid ${C.borderActive}` : `1.5px solid ${C.border}`,
                        background: coverEmoji === emoji ? C.blueLight : "transparent",
                        fontSize: 18, cursor: "pointer", padding: 0,
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe this template — who's it for, what's the goal? (optional)"
              rows={2}
              maxLength={280}
              style={{ ...inputStyle, resize: "vertical" as const, minHeight: 56, fontSize: 13 }}
            />
            <div style={{ fontSize: 10, color: C.muted, textAlign: "right" as const, marginTop: 2 }}>
              {description.length} / 280
            </div>
          </div>

          {/* Days */}
          {days.map((day, dayIdx) => (
            <div key={dayIdx} style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <input
                  value={day.day_name}
                  onChange={e => updateDayName(dayIdx, e.target.value)}
                  placeholder={`Day ${dayIdx + 1}`}
                  style={{ ...inputStyle, fontWeight: 800, fontSize: 14, flex: 1 }}
                  maxLength={40}
                />
                {days.length > 1 && (
                  <button
                    onClick={() => removeDay(dayIdx)}
                    title="Remove this day"
                    style={{
                      background: C.redBg,
                      border: `1px solid ${C.red}`,
                      color: C.red,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "8px 10px",
                      borderRadius: 8,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Remove day
                  </button>
                )}
              </div>

              {/* Exercises */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {day.exercises.map((ex, exIdx) => (
                  <div key={exIdx} style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 60px 60px auto",
                    gap: 6,
                    alignItems: "center",
                  }}>
                    <input
                      value={ex.name}
                      onChange={e => updateExercise(dayIdx, exIdx, { name: e.target.value })}
                      placeholder="Exercise name"
                      style={smallInputStyle}
                    />
                    <input
                      value={ex.sets}
                      onChange={e => updateExercise(dayIdx, exIdx, { sets: e.target.value })}
                      placeholder="Sets"
                      style={smallInputStyle}
                    />
                    <input
                      value={ex.reps}
                      onChange={e => updateExercise(dayIdx, exIdx, { reps: e.target.value })}
                      placeholder="Reps"
                      style={smallInputStyle}
                    />
                    <button
                      onClick={() => removeExercise(dayIdx, exIdx)}
                      title="Remove exercise"
                      disabled={day.exercises.length <= 1}
                      style={{
                        background: "none",
                        border: "none",
                        color: day.exercises.length <= 1 ? C.muted : C.red,
                        fontSize: 18,
                        cursor: day.exercises.length <= 1 ? "not-allowed" : "pointer",
                        padding: 4,
                        lineHeight: 1,
                        opacity: day.exercises.length <= 1 ? 0.4 : 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addExercise(dayIdx)}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1.5px dashed ${C.border}`,
                  background: "transparent",
                  color: C.sub,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                + Add exercise
              </button>

              {/* Subtle column-header hint shown only on the first day so
                  users understand the three input columns without us
                  taking up space repeatedly. */}
              {dayIdx === 0 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 60px 60px 30px",
                  gap: 6,
                  marginTop: 8,
                  fontSize: 9,
                  color: C.muted,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase" as const,
                }}>
                  <span>Exercise</span>
                  <span style={{ textAlign: "center" as const }}>Sets</span>
                  <span style={{ textAlign: "center" as const }}>Reps</span>
                  <span></span>
                </div>
              )}
            </div>
          ))}

          {/* Add another day */}
          <button
            onClick={addDay}
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              border: `1.5px dashed ${C.borderActive}`,
              background: C.blueLight,
              color: C.blue,
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + Add another day
          </button>

          {error && (
            <div style={{
              background: C.redBg,
              border: `1px solid ${C.red}`,
              borderRadius: 10,
              padding: "10px 14px",
              color: "#FCA5A5",
              fontSize: 13,
              fontWeight: 600,
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

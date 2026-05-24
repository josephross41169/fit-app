"use client";

// components/PromptsCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Get-to-know-you prompts for the compete tabs. Asks the next 3 UNANSWERED
// prompts from a pool (so it cycles across challenges), saves them, and shows
// the answered Q&A. Optionally shows the other side's answers read-only (used
// on a 1v1 rivalry to show your opponent's answers).
//
// Used by:
//   • the active rivalry screen (RIVAL_PROMPTS, with the opponent's answers)
//   • the Couples tab (COUPLE_PROMPTS, shared answers, no "other")
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  pickNextPrompts, answeredPrompts,
  type Prompt, type PromptAnswers,
} from "@/lib/rivalPrompts";

const C = {
  text: "#F0F0F0", sub: "#9CA3AF", accent: "#A78BFA",
  card: "#160F28", border: "#2A1F45", input: "#0D0D0D",
};

interface Props {
  title: string;
  pool: Prompt[];
  answers: PromptAnswers;                          // editable set (yours / the couple's)
  onSave: (next: PromptAnswers) => Promise<void> | void;
  askCount?: number;
  /** Optional second answer set to display read-only (e.g. your opponent's). */
  other?: { label: string; answers: PromptAnswers } | null;
  /** Label for the editable side's answers ("Your answers" / "Your story"). */
  mineLabel?: string;
  accent?: string;
}

export default function PromptsCard({ title, pool, answers, onSave, askCount = 3, other = null, mineLabel = "Your answers", accent = C.accent }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const toAsk = pickNextPrompts(pool, answers, askCount);
  const mine = answeredPrompts(pool, answers);
  const theirs = other ? answeredPrompts(pool, other.answers) : [];

  async function handleSave() {
    const filled = Object.entries(drafts).filter(([, v]) => v && v.trim());
    if (filled.length === 0 || saving) return;
    setSaving(true);
    try {
      const next: PromptAnswers = { ...answers };
      for (const [id, v] of filled) next[id] = v.trim();
      await onSave(next);
      setDrafts({});
    } finally {
      setSaving(false);
    }
  }

  const iStyle: React.CSSProperties = {
    background: C.input, border: `1px solid ${C.border}`, borderRadius: 10,
    color: C.text, padding: "9px 11px", fontSize: 13, outline: "none", width: "100%",
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: C.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>
        Answer a few so others know who they're up against. New prompts appear each time.
      </div>

      {/* Asker — next unanswered prompts */}
      {toAsk.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: mine.length > 0 || theirs.length > 0 ? 16 : 0 }}>
          {toAsk.map(p => (
            <div key={p.id}>
              <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 5 }}>{p.text}</div>
              <input
                value={drafts[p.id] || ""}
                onChange={e => setDrafts(d => ({ ...d, [p.id]: e.target.value.slice(0, 140) }))}
                placeholder="Your answer…"
                style={iStyle}
              />
            </div>
          ))}
          <button onClick={handleSave} disabled={saving || Object.values(drafts).every(v => !v || !v.trim())}
            style={{ background: `linear-gradient(135deg, #7C3AED, ${accent})`, border: "none", borderRadius: 10, padding: "10px 0", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            {saving ? "Saving…" : "Save answers"}
          </button>
        </div>
      )}

      {/* The editable side's answered prompts */}
      {mine.length > 0 && (
        <div style={{ marginBottom: theirs.length > 0 ? 14 : 0 }}>
          {toAsk.length > 0 && <div style={{ height: 1, background: C.border, margin: "4px 0 12px" }} />}
          <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{mineLabel}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mine.map(q => (
              <div key={q.id}>
                <div style={{ fontSize: 11, color: C.sub }}>{q.text}</div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{q.answer}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The other side's answers (read-only) */}
      {other && theirs.length > 0 && (
        <div>
          <div style={{ height: 1, background: C.border, margin: "4px 0 12px" }} />
          <div style={{ fontSize: 11, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{other.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {theirs.map(q => (
              <div key={q.id}>
                <div style={{ fontSize: 11, color: C.sub }}>{q.text}</div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{q.answer}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toAsk.length === 0 && mine.length === 0 && !theirs.length && (
        <div style={{ fontSize: 13, color: C.sub }}>You've answered them all! 🎉</div>
      )}
    </div>
  );
}

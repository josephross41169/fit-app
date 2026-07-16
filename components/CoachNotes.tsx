"use client";
// components/CoachNotes.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Private "Coach's notes" — the AI observation card at the bottom of the
// profile activity column. Owner-only (double-enforced: this component
// renders nothing for visitors, AND the ai_notes table's RLS only lets the
// owner read). One note per day, generated lazily on first view.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const C = { card: "#111811", border: "#1B231E", text: "#F0F0F0", sub: "#9CA3AF", green: "#5BBE93" };

export default function CoachNotes({ isOwn }: { isOwn: boolean }) {
  const [note, setNote] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    if (!isOwn) return;
    let alive = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { if (alive) setState("empty"); return; }
        const res = await fetch("/api/ai/coach-note", {
          method: "POST",
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        if (!alive) return;
        if (!res.ok) { setState("error"); return; }
        const json = await res.json();
        if (json?.note) { setNote(json.note); setState("ready"); }
        else setState("empty");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => { alive = false; };
  }, [isOwn]);

  if (!isOwn) return null;                 // never render on someone else's profile
  if (state === "empty" || state === "error") return null; // quiet when there's nothing useful
  if (state === "loading") return null;    // no skeleton — appears when ready

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: C.text }}>🤖 Coach's notes</span>
        <span style={{ fontSize: 11, color: C.sub }}>only you can see this · updates daily</span>
      </div>
      <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>{note}</div>
    </div>
  );
}

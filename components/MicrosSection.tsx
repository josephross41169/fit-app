"use client";
// components/MicrosSection.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Supplements & Micros" card for the profile activity column — separate from
// nutrition, per product decision. Shows:
//   1. Today's micronutrient totals across all logged supplements, as % Daily
//      Value bars, with amber warnings when a total exceeds the safe upper
//      limit (the stacked-zinc problem serious users worry about).
//   2. A 7-day adherence grid per supplement (the habit view).
//
// Data source: activity_logs rows whose `supplements` jsonb carries ingredient
// snapshots (written at log time by post/page.tsx). Owner-only by design —
// supplement regimens are personal.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { nutrientByKey, overUL, fmtAmount, type IngredientRow } from "@/lib/nutrients";

const C = {
  card: "#111811", border: "#1B231E", text: "#F0F0F0", sub: "#9CA3AF",
  green: "#5BBE93", greenBg: "#12291D", amber: "#EF9F27", track: "#1B231E",
};

type LoggedSupp = { name: string; ingredients?: IngredientRow[] | null };
type LogRow = { logged_at: string; supplements: LoggedSupp[] | null };

export default function MicrosSection({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isOwn || !userId) return;
    let alive = true;
    (async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      weekAgo.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("activity_logs")
        .select("logged_at, supplements")
        .eq("user_id", userId)
        .gte("logged_at", weekAgo.toISOString())
        .not("supplements", "is", null);
      if (!alive) return;
      setRows(((data || []) as LogRow[]).filter(r => Array.isArray(r.supplements) && r.supplements.length > 0));
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [userId, isOwn]);

  if (!isOwn) return null; // personal data — never render on someone else's profile
  if (!loaded) return null;
  if (rows.length === 0) return null; // nothing logged this week — stay out of the way

  // ── Today's totals per nutrient ──
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const totals = new Map<string, { name: string; unit: string; amount: number }>();
  for (const r of rows) {
    if (new Date(r.logged_at) < todayStart) continue;
    for (const s of r.supplements || []) {
      for (const ing of s.ingredients || []) {
        const cur = totals.get(ing.key);
        if (cur) cur.amount += ing.amount;
        else totals.set(ing.key, { name: ing.name, unit: ing.unit, amount: ing.amount });
      }
    }
  }
  const totalRows = [...totals.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  // ── 7-day adherence per supplement name ──
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0); days.push(d); }
  const takenByName = new Map<string, Set<number>>();
  for (const r of rows) {
    const t = new Date(r.logged_at); t.setHours(0, 0, 0, 0);
    const idx = days.findIndex(d => d.getTime() === t.getTime());
    if (idx === -1) continue;
    for (const s of r.supplements || []) {
      if (!takenByName.has(s.name)) takenByName.set(s.name, new Set());
      takenByName.get(s.name)!.add(idx);
    }
  }
  const adherence = [...takenByName.entries()].slice(0, 6);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: C.text }}>💊 Supplements &amp; Micros</span>
        <span style={{ fontSize: 11, color: C.sub }}>only you can see this</span>
      </div>

      {totalRows.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: 0.5, marginBottom: 8 }}>TODAY</div>
          {totalRows.map(([key, t]) => {
            const def = nutrientByKey(key);
            const pct = def?.dv ? Math.round((t.amount / def.dv) * 100) : null;
            const over = overUL(key, t.amount);
            const barPct = pct === null ? 100 : Math.min(pct, 100);
            return (
              <div key={key} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: C.text, fontWeight: 700 }}>{t.name}{over ? " ⚠️" : ""}</span>
                  <span style={{ color: over ? C.amber : pct !== null ? (pct >= 100 ? "#86CFAE" : C.sub) : C.sub, fontWeight: 700 }}>
                    {over ? `${fmtAmount(t.amount, t.unit)} — over upper limit` : pct !== null ? `${pct}%` : fmtAmount(t.amount, t.unit)}
                  </span>
                </div>
                <div style={{ height: 6, background: C.track, borderRadius: 3 }}>
                  <div style={{ width: `${barPct}%`, height: 6, background: over ? C.amber : C.green, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>
          Nothing logged today yet — supplements you log will total up here.
          Tip: add Supplement Facts to a favorite (✏️ on its card) so your micros count automatically.
        </div>
      )}

      {adherence.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: 0.5, marginBottom: 8 }}>THIS WEEK</div>
          {adherence.map(([name, set]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ width: 110, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{name}</span>
              {days.map((_, i) => (
                <span key={i} style={{ width: 18, height: 18, borderRadius: 5, background: set.has(i) ? C.greenBg : C.track, color: C.green, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>
                  {set.has(i) ? "✓" : ""}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

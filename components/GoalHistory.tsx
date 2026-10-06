"use client";
// ─────────────────────────────────────────────────────────────────────────────
// Goal history — every logged activity that counted toward a goal, from the
// goal's start to its end (or now). Uses lib/goals.ts progressFromLog, the
// same rule the server uses to compute goals.current, so the list always adds
// up to the progress number shown above it.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { progressFromLog, type Goal, type ActivityLog } from "@/lib/goals";

const C = { text: "#F0F0F0", sub: "#9CA3AF", card: "#161D19", border: "#1B231E" };
const r1 = (n: number) => Math.round(n * 10) / 10;
const cap = (s: string) => (s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const CARDIO_EMOJI: Record<string, string> = { running: "🏃", walking: "🚶", biking: "🚴", cycling: "🚴", swimming: "🏊", rowing: "🚣", hiking: "🥾" };

type Row = { id: string; date: Date; emoji: string; title: string; detail: string; amount: number };

function describe(goal: Goal, log: any, amount: number): Omit<Row, "id" | "date" | "amount"> {
  const unit = goal.unit === "miles" ? "mi" : goal.unit || "";
  if (goal.metric === "cardio_distance" || goal.metric === "cardio_duration") {
    const f = (goal.filter || "").toLowerCase();
    const entries = (Array.isArray(log.cardio) ? log.cardio : []).filter((c: any) => !f || String(c?.type || "").toLowerCase().includes(f));
    const first = entries[0] || {};
    const type = String(first.type || log.workout_category || "Cardio");
    const parts = entries.map((c: any) => [c.distance ? `${c.distance} mi` : "", c.duration ? `${Math.round(Number(c.duration))} min` : ""].filter(Boolean).join(" · ")).filter(Boolean);
    return { emoji: CARDIO_EMOJI[type.toLowerCase()] || "🏃", title: `${cap(type)}${entries.length > 1 ? ` ×${entries.length}` : ""}`, detail: parts.join(", ") || `${r1(amount)} ${unit}` };
  }
  if (goal.metric === "lift_pr") {
    return { emoji: "🏋️", title: cap(goal.filter || "Lift"), detail: `Best set ${r1(amount)} ${unit || "lbs"}` };
  }
  if (goal.metric === "nutrition_avg") {
    return { emoji: "🥗", title: log.meal_type || "Meal", detail: `${r1(amount)} ${unit || goal.filter || ""}`.trim() };
  }
  // workout_count / workout_streak
  const exCount = (Array.isArray(log.exercises) ? log.exercises : []).filter((e: any) => e?.name).length;
  const label = log.workout_type && !/^workout$/i.test(log.workout_type) ? log.workout_type : cap(log.workout_category || "Workout");
  return { emoji: "💪", title: label, detail: [exCount ? `${exCount} exercise${exCount === 1 ? "" : "s"}` : "", log.workout_duration_min ? `${log.workout_duration_min} min` : ""].filter(Boolean).join(" · ") || "Workout logged" };
}

export default function GoalHistory({ goal, accent = "#1F5F3F" }: { goal: any; accent?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const g = goal as Goal;
      const start = g.window_start || (goal as any).created_at;
      let q = supabase.from("activity_logs")
        .select("id, user_id, log_type, logged_at, workout_category, workout_type, workout_duration_min, exercises, cardio, protein_g, carbs_g, fat_g, calories_total, meal_type")
        .eq("user_id", g.user_id).gte("logged_at", start).order("logged_at", { ascending: false }).limit(500);
      if (g.window_end) q = q.lte("logged_at", g.window_end);
      const { data } = await q;
      if (!alive) return;
      const goalForCalc = { ...g, window_start: start } as Goal;
      const out: Row[] = [];
      for (const log of (data || []) as any[]) {
        let amount = 0;
        if (g.metric === "workout_streak") amount = log.log_type === "workout" ? 1 : 0;
        else amount = progressFromLog(goalForCalc, log as ActivityLog);
        if (!(amount > 0)) continue;
        out.push({ id: log.id, date: new Date(log.logged_at), amount, ...describe(goalForCalc, log, amount) });
      }
      setRows(out);
    })();
    return () => { alive = false; };
  }, [goal?.id]);

  const unit = goal.unit === "miles" ? "mi" : goal.unit || "";
  const summable = goal.metric !== "lift_pr" && goal.metric !== "nutrition_avg" && goal.metric !== "workout_streak";

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: C.sub, fontWeight: 800, letterSpacing: 0.5 }}>HISTORY</div>
        {rows && rows.length > 0 && <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>{rows.length} logged</div>}
      </div>
      {rows === null ? (
        <div style={{ fontSize: 12, color: C.sub, padding: "10px 0" }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12, color: C.sub, padding: "14px 12px", textAlign: "center", border: `1px dashed #2A3A2A`, borderRadius: 12 }}>
          Nothing logged toward this goal yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "9px 12px" }}>
              <div style={{ width: 42, flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.sub, fontWeight: 800, textTransform: "uppercase" }}>{r.date.toLocaleDateString("en-US", { month: "short" })}</div>
                <div style={{ fontSize: 17, color: C.text, fontWeight: 900, lineHeight: 1 }}>{r.date.getDate()}</div>
              </div>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{r.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                <div style={{ fontSize: 11, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.detail} · {r.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
              {summable && <div style={{ fontSize: 13, fontWeight: 900, color: accent, flexShrink: 0 }}>+{r1(r.amount)}{unit ? ` ${unit}` : ""}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── components/GoalsTab.tsx ─────────────────────────────────────────────
// The "Goals" tab on the /post page. Lets the user:
//   • Pick from preset goal templates OR build a custom goal
//   • Set target value, time window (default 7 days, custom date allowed)
//   • View active goals with live progress bars
//   • View past goals (completed or expired)
//
// Goal completion is auto-detected by /api/db update_goals_from_log
// after each activity log save (wired from profile/page.tsx).

"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { GOAL_TEMPLATES, type Goal, type GoalMetric } from "@/lib/goals";

const C = {
  purple: "#7C3AED", purpleDim: "#2D1F52", purpleBorder: "#3D2A6E",
  gold: "#F5A623", green: "#4ADE80",
  text: "#F0F0F0", sub: "#9CA3AF",
  card: "#1A1228", bg: "#0D0820",
};

const iStyle: React.CSSProperties = {
  background: "#0D0D0D",
  border: "1.5px solid #3D2A6E",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 14,
  color: "#F0F0F0",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function GoalsTab() {
  const { user } = useAuth();
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [pastGoals, setPastGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"active" | "past">("active");
  const [showCreate, setShowCreate] = useState(false);

  async function loadGoals() {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const all = (data || []) as Goal[];
      const now = Date.now();
      const active: Goal[] = [];
      const past: Goal[] = [];
      for (const g of all) {
        const expired = g.window_end && new Date(g.window_end).getTime() < now;
        if (g.is_completed || expired) past.push(g);
        else active.push(g);
      }
      setActiveGoals(active);
      setPastGoals(past);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadGoals(); }, [user?.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>🎯 Goals</div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: "8px 14px", borderRadius: 12, border: "none",
            background: `linear-gradient(135deg, ${C.purple}, #A78BFA)`,
            color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
          }}
        >+ New Goal</button>
      </div>

      {/* Tab switcher: active / past */}
      <div style={{ display: "flex", gap: 4, padding: 4, background: C.bg, borderRadius: 12, border: `1px solid ${C.purpleBorder}` }}>
        {(["active", "past"] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 9, border: "none",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              background: view === v ? C.purple : "transparent",
              color: view === v ? "#fff" : C.sub,
              transition: "all 0.15s",
            }}
          >
            {v === "active" ? `Active (${activeGoals.length})` : `Past (${pastGoals.length})`}
          </button>
        ))}
      </div>

      {/* Goal list */}
      {loading ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: C.sub, fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          {(view === "active" ? activeGoals : pastGoals).length === 0 ? (
            <div style={{
              padding: "32px 16px", textAlign: "center", color: C.sub, fontSize: 13,
              background: C.card, borderRadius: 14, border: `1px dashed ${C.purpleBorder}`,
            }}>
              {view === "active" ? "No active goals — create one above" : "No past goals yet"}
            </div>
          ) : (
            (view === "active" ? activeGoals : pastGoals).map(g => (
              <GoalCard key={g.id} goal={g} onChange={loadGoals} />
            ))
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && user && (
        <CreateGoalModal
          userId={user.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadGoals(); }}
        />
      )}
    </div>
  );
}

// ─── Goal card ──────────────────────────────────────────────────────────

function GoalCard({ goal, onChange }: { goal: Goal; onChange: () => void }) {
  const pct = Math.min(100, (goal.current / goal.target) * 100);
  const expired = goal.window_end && new Date(goal.window_end).getTime() < Date.now() && !goal.is_completed;
  const endsLabel = goal.window_end
    ? new Date(goal.window_end).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "Open";

  async function deleteGoal() {
    if (!confirm("Delete this goal?")) return;
    await supabase.from("goals").delete().eq("id", goal.id);
    onChange();
  }

  // Color logic: completed = green, expired = gray, active = purple
  const accent = goal.is_completed ? C.green : (expired ? C.sub : C.purple);

  return (
    <div style={{
      background: C.card,
      border: `1.5px solid ${goal.is_completed ? C.green : C.purpleBorder}`,
      borderRadius: 16,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>{goal.emoji || "🎯"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{goal.title}</div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
            Ends {endsLabel}
            {goal.is_completed && <span style={{ color: C.green, fontWeight: 700 }}> · ✓ Completed</span>}
            {expired && <span style={{ color: C.sub, fontWeight: 700 }}> · Expired</span>}
          </div>
        </div>
        <button
          onClick={deleteGoal}
          aria-label="Delete goal"
          style={{
            background: "transparent", border: "none", color: C.sub,
            cursor: "pointer", fontSize: 16, padding: 4,
          }}
        >×</button>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
          <span style={{ color: C.sub }}>Progress</span>
          <span style={{ color: accent }}>
            {Math.round(goal.current * 10) / 10} / {goal.target} {goal.unit}
          </span>
        </div>
        <div style={{ height: 8, background: "#0D0D0D", borderRadius: 99, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            background: accent,
            borderRadius: 99,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Create goal modal ─────────────────────────────────────────────────

function CreateGoalModal({
  userId, onClose, onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  // Step 1: pick template OR custom. Step 2: set target/dates.
  const [step, setStep] = useState<"pick" | "details">("pick");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [metric, setMetric] = useState<GoalMetric>("workout_count");
  const [filter, setFilter] = useState<string>("");
  const [unit, setUnit] = useState("workouts");
  const [target, setTarget] = useState<number>(4);
  const [days, setDays] = useState<number>(7);
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  function pickTemplate(id: string) {
    const t = GOAL_TEMPLATES.find(x => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setTitle(t.title);
    setEmoji(t.emoji);
    setMetric(t.metric);
    setFilter(t.filter || "");
    setUnit(t.unit);
    setTarget(t.defaultTarget);
    setDays(t.defaultDays);
    setStep("details");
  }

  function pickCustom() {
    setTemplateId(null);
    setTitle("");
    setEmoji("🎯");
    setMetric("workout_count");
    setFilter("");
    setUnit("workouts");
    setTarget(1);
    setDays(7);
    setStep("details");
  }

  async function submit() {
    if (!title.trim()) { alert("Add a title"); return; }
    if (target <= 0) { alert("Target must be > 0"); return; }
    setSubmitting(true);
    const startDate = new Date();
    let endDate: Date | null = null;
    if (customEndDate) {
      endDate = new Date(customEndDate);
      // normalize end-of-day so the user's last day counts in full
      endDate.setHours(23, 59, 59, 999);
    } else if (days > 0) {
      endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    const row = {
      user_id: userId,
      title: title.trim(),
      emoji,
      metric,
      filter: filter || null,
      unit,
      target,
      window_start: startDate.toISOString(),
      window_end: endDate ? endDate.toISOString() : null,
      is_public: true,
    };

    const { data, error } = await supabase.from("goals").insert(row).select("id").single();
    if (error) {
      console.error(error);
      alert("Couldn't create goal. " + error.message);
      setSubmitting(false);
      return;
    }
    // Recompute against past logs in case any already count
    if (data?.id) {
      try {
        await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "recompute_goal", payload: { goalId: data.id } }),
        });
      } catch {}
    }
    setSubmitting(false);
    onCreated();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.bg, borderRadius: 22, padding: 22,
        width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto",
        border: `1px solid ${C.purpleBorder}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>
            {step === "pick" ? "Choose a goal" : "Set your goal"}
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: C.sub,
            fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {step === "pick" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {GOAL_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => pickTemplate(t.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 12,
                background: C.card, border: `1px solid ${C.purpleBorder}`,
                cursor: "pointer", textAlign: "left", color: C.text,
              }}>
                <span style={{ fontSize: 22 }}>{t.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>
                    {t.defaultTarget} {t.unit} · {t.defaultDays} days
                  </div>
                </div>
              </button>
            ))}
            <button onClick={pickCustom} style={{
              padding: "12px 14px", borderRadius: 12,
              background: "transparent", border: `1.5px dashed ${C.purpleBorder}`,
              color: C.purple, fontWeight: 800, fontSize: 13, cursor: "pointer",
            }}>+ Custom goal</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5 }}>TITLE</label>
              <input style={iStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Run 15 miles this week" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 100px", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5 }}>EMOJI</label>
                <input style={{ ...iStyle, textAlign: "center" }} value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={3} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5 }}>TARGET</label>
                <input style={iStyle} type="number" value={target} onChange={e => setTarget(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5 }}>UNIT</label>
                <input style={iStyle} value={unit} onChange={e => setUnit(e.target.value)} />
              </div>
            </div>
            {!templateId && (
              // Custom goal: let user pick metric + filter
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5 }}>METRIC</label>
                  <select style={iStyle} value={metric} onChange={e => setMetric(e.target.value as GoalMetric)}>
                    <option value="workout_count">Workout count</option>
                    <option value="cardio_distance">Cardio distance</option>
                    <option value="cardio_duration">Cardio duration</option>
                    <option value="lift_pr">Lift PR</option>
                    <option value="workout_streak">Workout streak</option>
                    <option value="nutrition_avg">Nutrition avg</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5 }}>FILTER (optional)</label>
                  <input style={iStyle} value={filter} onChange={e => setFilter(e.target.value)} placeholder="running, bench, protein…" />
                </div>
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 5 }}>TIME WINDOW</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {[7, 14, 30, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => { setDays(d); setCustomEndDate(""); }}
                    style={{
                      padding: "7px 14px", borderRadius: 99, border: "none",
                      background: !customEndDate && days === d ? C.purple : C.card,
                      color: !customEndDate && days === d ? "#fff" : C.sub,
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}
                  >{d} days</button>
                ))}
              </div>
              <input
                style={iStyle}
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                placeholder="Custom end date"
              />
              <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>
                Leave date empty to use the days preset above.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button
                onClick={() => setStep("pick")}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 12, border: `1.5px solid ${C.purpleBorder}`,
                  background: "transparent", color: C.sub, fontWeight: 700, cursor: "pointer",
                }}
              >Back</button>
              <button
                onClick={submit}
                disabled={submitting}
                style={{
                  flex: 2, padding: "12px 0", borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg, ${C.purple}, #A78BFA)`,
                  color: "#fff", fontWeight: 900, fontSize: 14,
                  cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
                }}
              >{submitting ? "Saving…" : "Create Goal"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

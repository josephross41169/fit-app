"use client";
import { useState, useCallback } from "react";
import { generatePlan, Goal, Level, PlanConfig, WeeklyPlan, PlannedExercise, TrainingDay } from "@/lib/workoutPlanner";
import { Equipment, EQUIPMENT_TYPES } from "@/lib/exercises";

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  purple:     "#7C3AED",
  purpleDark: "#6D28D9",
  purpleBg:   "rgba(124,58,237,0.12)",
  purpleMid:  "#2D1B69",
  gold:       "#F5A623",
  green:      "#10B981",
  red:        "#EF4444",
  bg:         "#0D0D0D",
  card:       "#111111",
  border:     "#1A1228",
  text:       "#F0F0F0",
  sub:        "#9CA3AF",
};

// ── Goal metadata ──────────────────────────────────────────────────────────────
const GOALS: { value: Goal; label: string; desc: string; emoji: string }[] = [
  { value: "strength",    label: "Strength",    desc: "Lift heavier, build raw power",       emoji: "🏋️" },
  { value: "hypertrophy", label: "Build Muscle", desc: "Maximize size and definition",        emoji: "💪" },
  { value: "fat_loss",    label: "Fat Loss",    desc: "Burn fat, preserve muscle",            emoji: "🔥" },
  { value: "endurance",   label: "Endurance",   desc: "Go longer, move better",               emoji: "⚡" },
  { value: "athletic",    label: "Athletic",    desc: "Power, speed, and functional strength", emoji: "🎯" },
];

const LEVELS: { value: Level; label: string; desc: string }[] = [
  { value: "beginner",     label: "Beginner",     desc: "0-1 year lifting" },
  { value: "intermediate", label: "Intermediate", desc: "1-3 years lifting" },
  { value: "advanced",     label: "Advanced",     desc: "3+ years lifting" },
];

const DAYS_OPTIONS: { value: 3 | 4 | 5 | 6; label: string }[] = [
  { value: 3, label: "3 days" },
  { value: 4, label: "4 days" },
  { value: 5, label: "5 days" },
  { value: 6, label: "6 days" },
];

// Equipment groups for UI
const EQUIPMENT_GROUPS = [
  { label: "🏋️ Full Gym",    items: ["Barbell", "Dumbbell", "Cable", "Machine", "Smith Machine", "EZ Bar", "Trap Bar"] as Equipment[] },
  { label: "🏠 Home Gym",    items: ["Barbell", "Dumbbell", "Kettlebell", "Resistance Band", "Pull-up Bar"] as Equipment[] },
  { label: "🤸 Bodyweight",  items: ["Bodyweight", "Pull-up Bar"] as Equipment[] },
  { label: "🎽 Dumbbells Only", items: ["Dumbbell", "Bodyweight"] as Equipment[] },
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CATEGORY_COLORS: Record<string, string> = {
  Chest: "#EC4899", Back: "#3B82F6", Shoulders: "#8B5CF6",
  Biceps: "#F59E0B", Triceps: "#EF4444", Legs: "#10B981",
  Glutes: "#F97316", Core: "#6366F1", "Full Body": "#7C3AED",
  Olympic: "#C4B5FD", Cardio: "#34D399", Forearms: "#D97706",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function CategoryBadge({ cat }: { cat: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px",
      borderRadius: 999, background: `${CATEGORY_COLORS[cat] ?? C.purple}22`,
      color: CATEGORY_COLORS[cat] ?? C.purple, letterSpacing: "0.03em",
    }}>{cat}</span>
  );
}

function ExerciseRow({ ex, idx }: { ex: PlannedExercise; idx: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderRadius: 10, background: "#161616", marginBottom: 6, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "grid",
          gridTemplateColumns: "28px 1fr auto auto auto",
          gap: 8, alignItems: "center",
          padding: "10px 12px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ color: C.sub, fontSize: 12, fontWeight: 700 }}>{idx + 1}</span>
        <div>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{ex.name}</div>
          <CategoryBadge cat={ex.category} />
        </div>
        <span style={{ color: C.gold, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{ex.sets}×{ex.reps}</span>
        <span style={{ color: C.sub, fontSize: 11, whiteSpace: "nowrap" }}>{ex.rest}</span>
        <span style={{ color: C.sub, fontSize: 11 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            {ex.muscles.map(m => (
              <span key={m} style={{ fontSize: 10, color: C.sub, background: "#222", borderRadius: 4, padding: "2px 6px" }}>{m}</span>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: C.sub }}>
            Equipment: <span style={{ color: C.text }}>{ex.equipment}</span>
          </div>
          {ex.notes && <div style={{ marginTop: 4, fontSize: 11, color: C.sub }}>{ex.notes}</div>}
        </div>
      )}
    </div>
  );
}

function DayCard({ day, isRest }: { day?: TrainingDay; isRest: boolean; dayNum: number }) {
  const [expanded, setExpanded] = useState(false);
  if (isRest || !day) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", opacity: 0.5 }}>
        <div style={{ color: C.sub, fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Rest Day</div>
        <div style={{ color: C.sub, fontSize: 11, marginTop: 4 }}>Recovery is training too</div>
      </div>
    );
  }
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
      <button
        onClick={() => setExpanded(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "16px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: C.purpleBg, border: `1.5px solid ${C.purple}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>
          {day.label.includes("Push") ? "🔺" : day.label.includes("Pull") ? "🔻" : day.label.includes("Leg") ? "🦵" : day.label.includes("Upper") ? "💪" : day.label.includes("Full") ? "⚡" : "🏋️"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>{day.label}</div>
          <div style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>{day.focus}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ color: C.purple, fontSize: 12, fontWeight: 700 }}>{day.exercises.length} exercises</div>
          <div style={{ color: C.sub, fontSize: 11 }}>~{day.estimatedMinutes} min</div>
        </div>
        <span style={{ color: C.sub, fontSize: 12, marginLeft: 4 }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ paddingTop: 12 }}>
            {day.exercises.map((ex, i) => <ExerciseRow key={ex.name + i} ex={ex} idx={i} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WorkoutPlanPage() {
  const [goal, setGoal] = useState<Goal>("hypertrophy");
  const [level, setLevel] = useState<Level>("intermediate");
  const [days, setDays] = useState<3 | 4 | 5 | 6>(4);
  const [equipment, setEquipment] = useState<Equipment[]>(["Barbell", "Dumbbell", "Cable", "Machine", "Smith Machine", "EZ Bar"]);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeEquipGroup, setActiveEquipGroup] = useState<string>("🏋️ Full Gym");

  const handleEquipGroup = (groupLabel: string, items: Equipment[]) => {
    setActiveEquipGroup(groupLabel);
    setEquipment(items);
  };

  const toggleEquipment = (eq: Equipment) => {
    setEquipment(prev =>
      prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
    );
    setActiveEquipGroup("Custom");
  };

  const generate = useCallback(() => {
    setGenerating(true);
    // Simulate async to show loading state
    setTimeout(() => {
      const config: PlanConfig = { goal, level, daysPerWeek: days, equipment };
      setPlan(generatePlan(config));
      setGenerating(false);
    }, 600);
  }, [goal, level, days, equipment]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "24px 20px 0", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: C.purpleBg,
            border: `2px solid ${C.purple}`, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 22,
          }}>🤖</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text }}>AI Workout Planner</h1>
            <p style={{ margin: 0, fontSize: 12, color: C.sub }}>Personalized weekly plan — 100% free, instant</p>
          </div>
        </div>
      </div>

      {/* Config Form */}
      <div style={{ padding: "20px", maxWidth: 700, margin: "0 auto" }}>

        {/* Goal */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Your Goal</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
            {GOALS.map(g => (
              <button key={g.value} onClick={() => setGoal(g.value)} style={{
                padding: "12px 10px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                background: goal === g.value ? C.purpleBg : "#161616",
                border: `1.5px solid ${goal === g.value ? C.purple : C.border}`,
                transition: "all 0.15s",
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{g.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{g.label}</div>
                <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{g.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Level */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Experience Level</div>
          <div style={{ display: "flex", gap: 8 }}>
            {LEVELS.map(l => (
              <button key={l.value} onClick={() => setLevel(l.value)} style={{
                flex: 1, padding: "12px 8px", borderRadius: 12, cursor: "pointer", textAlign: "center",
                background: level === l.value ? C.purpleBg : "#161616",
                border: `1.5px solid ${level === l.value ? C.purple : C.border}`,
                transition: "all 0.15s",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{l.label}</div>
                <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{l.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Days per week */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Days Per Week</div>
          <div style={{ display: "flex", gap: 8 }}>
            {DAYS_OPTIONS.map(d => (
              <button key={d.value} onClick={() => setDays(d.value)} style={{
                flex: 1, padding: "12px 8px", borderRadius: 12, cursor: "pointer", textAlign: "center",
                background: days === d.value ? C.purpleBg : "#161616",
                border: `1.5px solid ${days === d.value ? C.purple : C.border}`,
                transition: "all 0.15s",
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{d.value}</div>
                <div style={{ fontSize: 10, color: C.sub }}>days</div>
              </button>
            ))}
          </div>
        </div>

        {/* Equipment */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Equipment Available</div>
          {/* Preset groups */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {EQUIPMENT_GROUPS.map(g => (
              <button key={g.label} onClick={() => handleEquipGroup(g.label, g.items)} style={{
                padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: activeEquipGroup === g.label ? C.purple : "#1A1A1A",
                color: activeEquipGroup === g.label ? "#fff" : C.sub,
                border: `1px solid ${activeEquipGroup === g.label ? C.purple : C.border}`,
                transition: "all 0.15s",
              }}>{g.label}</button>
            ))}
          </div>
          {/* Individual toggles */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EQUIPMENT_TYPES.map(eq => (
              <button key={eq} onClick={() => toggleEquipment(eq)} style={{
                padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: equipment.includes(eq) ? "#2D1B69" : "#161616",
                color: equipment.includes(eq) ? "#C4B5FD" : C.sub,
                border: `1px solid ${equipment.includes(eq) ? C.purple : C.border}`,
                transition: "all 0.15s",
              }}>{eq}</button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button onClick={generate} disabled={generating} style={{
          width: "100%", padding: "16px", borderRadius: 14, cursor: generating ? "not-allowed" : "pointer",
          background: generating ? C.purpleMid : `linear-gradient(135deg, ${C.purple}, #A78BFA)`,
          border: "none", color: "#fff", fontSize: 16, fontWeight: 900, letterSpacing: "0.01em",
          boxShadow: generating ? "none" : `0 4px 24px ${C.purple}44`,
          transition: "all 0.2s",
        }}>
          {generating ? "⚡ Generating your plan..." : "🤖 Generate My Plan"}
        </button>
      </div>

      {/* Plan Output */}
      {plan && (
        <div style={{ padding: "0 20px 80px", maxWidth: 700, margin: "0 auto" }}>
          {/* Plan Header */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{plan.splitName}</div>
                <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>
                  {GOALS.find(g => g.value === plan.goal)?.emoji}{" "}
                  {GOALS.find(g => g.value === plan.goal)?.label} ·{" "}
                  {plan.level.charAt(0).toUpperCase() + plan.level.slice(1)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.purple }}>{plan.weeklyVolume}</div>
                <div style={{ fontSize: 11, color: C.sub }}>weekly total</div>
              </div>
            </div>

            {/* Week grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 16 }}>
              {DAY_NAMES.map((name, i) => {
                const dayNum = i + 1;
                const isRest = plan.restDays.includes(dayNum);
                const trainingDay = plan.days.find(d => d.dayNum === dayNum);
                return (
                  <div key={name} style={{
                    textAlign: "center", padding: "8px 4px", borderRadius: 8,
                    background: isRest ? "#161616" : C.purpleBg,
                    border: `1px solid ${isRest ? C.border : C.purple}`,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, textTransform: "uppercase" }}>{name}</div>
                    <div style={{ fontSize: 10, color: isRest ? C.sub : C.purple, fontWeight: 700, marginTop: 2 }}>
                      {isRest ? "REST" : trainingDay?.label.split(" ")[0] ?? ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Training Days */}
          <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Your Weekly Schedule
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const dayNum = i + 1;
              const isRest = plan.restDays.includes(dayNum);
              const trainingDay = plan.days.find(d => d.dayNum === dayNum);
              return (
                <div key={dayNum} style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 10, alignItems: "start" }}>
                  <div style={{ paddingTop: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase" }}>{DAY_NAMES[i]}</div>
                  </div>
                  <DayCard day={trainingDay} isRest={isRest} dayNum={dayNum} />
                </div>
              );
            })}
          </div>

          {/* Tips */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.purple, marginBottom: 12 }}>💡 Pro Tips for {GOALS.find(g => g.value === plan.goal)?.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {plan.tips.map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: C.gold, flexShrink: 0 }}>→</span>
                  <span style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Regenerate */}
          <button onClick={generate} style={{
            width: "100%", marginTop: 16, padding: "12px", borderRadius: 12, cursor: "pointer",
            background: "#161616", border: `1px solid ${C.border}`,
            color: C.sub, fontSize: 13, fontWeight: 700,
          }}>
            🔄 Regenerate Plan
          </button>
        </div>
      )}
    </div>
  );
}

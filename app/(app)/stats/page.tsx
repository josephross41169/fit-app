"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PieChart, Pie,
} from "recharts";

const C = {
  purple: "#7C3AED", purpleDim: "#2D1F52", purpleBorder: "#3D2A6E",
  gold: "#F5A623", goldDim: "#2A1F08",
  cyan: "#06B6D4", cyanDim: "#0A1F25",
  green: "#4ADE80", greenDim: "#0A1F10",
  red: "#F87171", redDim: "#1F0A0A",
  orange: "#FB923C",
  text: "#F0F0F0", sub: "#6B7280", subLight: "#9CA3AF",
  bg: "#0A0A0F", card: "#111118", cardHi: "#16161F",
  border: "#1E1E2E", borderHi: "#2D1F52",
};

type Tab = "overview" | "workout" | "nutrition" | "wellness" | "prs";
type Range = "1M" | "3M" | "6M" | "1Y";

const MUSCLE_GROUPS: Record<string, string[]> = {
  Chest:     ["chest","bench","push","pec","fly","flye","incline","decline","dip"],
  Back:      ["back","row","pull","lat","deadlift","rdl","rhomboid","trap"],
  Legs:      ["leg","squat","lunge","quad","hamstring","glute","calf","hip thrust","rdl"],
  Shoulders: ["shoulder","press","ohp","overhead","lateral","delt","arnold","shrug"],
  Arms:      ["curl","tricep","bicep","hammer","skull","pushdown","extension","preacher"],
  Core:      ["abs","core","crunch","plank","sit-up","oblique","cable crunch"],
};

function getMuscleGroup(name: string): string {
  const n = name.toLowerCase();
  for (const [group, keywords] of Object.entries(MUSCLE_GROUPS)) {
    if (keywords.some(k => n.includes(k))) return group;
  }
  return "Other";
}

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString();
}
function rangeToIso(r: Range) {
  return daysAgo(r === "1M" ? 30 : r === "3M" ? 90 : r === "6M" ? 180 : 365);
}
function rangeWeeks(r: Range) {
  return r === "1M" ? 4 : r === "3M" ? 13 : r === "6M" ? 26 : 52;
}
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function dayOfWeek(iso: string) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(iso).getDay()];
}
function getMostCommon(arr: string[]): string {
  if (!arr.length) return "—";
  const f: Record<string,number> = {};
  arr.forEach(v => { if(v) f[v] = (f[v]||0)+1; });
  return Object.entries(f).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";
}
function calcVolume(exercises: any[]): number {
  return (exercises||[]).reduce((s,ex) => {
    const w = parseFloat(String(ex.weight)) || 0;
    const r = parseInt(String(ex.reps)) || 0;
    const sets = parseInt(String(ex.sets)) || 0;
    return s + w * r * sets;
  }, 0);
}
function calcStreak(dates: string[]): { current: number; longest: number } {
  const unique = [...new Set(dates.map(d => d.slice(0,10)))].sort().reverse();
  if (!unique.length) return { current: 0, longest: 0 };
  const today = new Date().toISOString().slice(0,10);
  let cur = 0, best = 0, streak = 0;
  let prev = "";
  for (const day of unique) {
    if (!prev) {
      const diff = (new Date(today).getTime() - new Date(day).getTime()) / 86400000;
      streak = diff <= 1 ? 1 : 0;
    } else {
      const diff = (new Date(prev).getTime() - new Date(day).getTime()) / 86400000;
      streak = diff === 1 ? streak + 1 : 1;
    }
    if (!cur && streak > 0 && (!prev || (new Date(today).getTime() - new Date(unique[0]).getTime()) / 86400000 <= 1)) cur = streak;
    best = Math.max(best, streak);
    prev = day;
  }
  const firstDiff = (new Date(today).getTime() - new Date(unique[0]).getTime()) / 86400000;
  return { current: firstDiff <= 1 ? (cur || streak) : 0, longest: best };
}

// ── UI Components ────────────────────────────────────────────────────────────

function BigStat({ label, value, sub, color = C.purple, icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div style={{ background: C.card, borderRadius: 18, padding: "20px 16px", border: `1px solid ${C.border}`, flex: 1, minWidth: 0 }}>
      {icon && <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>}
      <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, color = C.text }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontWeight: 800, fontSize: 14, color: C.subLight, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginTop: 28 }}>
      {title}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, padding: "36px 20px", border: `1px solid ${C.border}`, textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ color: C.sub, fontSize: 13 }}>{text}</div>
    </div>
  );
}

function ChartCard({ children, height = 180 }: { children: React.ReactNode; height?: number }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, padding: "16px 6px 10px 2px", border: `1px solid ${C.border}` }}>
      {children}
    </div>
  );
}

function Tooltip2({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1A1228", border: `1px solid ${C.borderHi}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: C.text }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: C.subLight }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || C.purple }}>{p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong>{p.unit || ""}</div>
      ))}
    </div>
  );
}

function Heatmap({ dates }: { dates: string[] }) {
  const today = new Date();
  const cells: { date: string; count: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0,10);
    cells.push({ date: key, count: dates.filter(dt => dt.startsWith(key)).length });
  }
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7));
  const color = (n: number) => n === 0 ? C.border : n === 1 ? "#4C1D95" : n === 2 ? "#6D28D9" : C.purple;
  const todayStr = today.toISOString().slice(0,10);
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 3 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {week.map((cell, di) => (
              <div key={di} title={`${cell.date}: ${cell.count} log(s)`} style={{
                width: 13, height: 13, borderRadius: 3,
                background: color(cell.count),
                border: cell.date === todayStr ? `1.5px solid ${C.gold}` : "none",
              }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: C.sub }}>Less</span>
        {[0,1,2,3].map(v => <div key={v} style={{ width: 11, height: 11, borderRadius: 2, background: color(v) }} />)}
        <span style={{ fontSize: 10, color: C.sub }}>More</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = C.purple }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background: C.border, borderRadius: 99, height: 6, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const pos = delta > 0;
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99,
      background: pos ? C.greenDim : C.redDim,
      color: pos ? C.green : C.red,
      marginLeft: 6,
    }}>
      {pos ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("3M");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [expandedPR, setExpandedPR] = useState<string | null>(null);

  // Goals (editable inline)
  const [goals, setGoals] = useState({ workoutsPerWeek: 4, proteinPerDay: 180, caloriesPerDay: 2500 });
  const [editingGoals, setEditingGoals] = useState(false);

  // Data
  const [workoutLogs, setWorkoutLogs]   = useState<any[]>([]);
  const [nutritionLogs, setNutritionLogs] = useState<any[]>([]);
  const [wellnessLogs, setWellnessLogs] = useState<any[]>([]);
  const [weightLogs, setWeightLogs]     = useState<any[]>([]);
  const [prList, setPrList]             = useState<any[]>([]);
  const [allWorkoutDates, setAllWorkoutDates] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const since = rangeToIso(range);
    try {
      const { data: logs } = await supabase
        .from("activity_logs")
        .select("id, log_type, logged_at, workout_type, workout_duration_min, workout_calories, exercises, cardio, calories_total, protein_g, carbs_g, fat_g, wellness_type, notes")
        .eq("user_id", user.id)
        .gte("logged_at", since)
        .order("logged_at", { ascending: true });

      if (logs) {
        setWorkoutLogs(logs.filter((l: any) => l.log_type === "workout"));
        setNutritionLogs(logs.filter((l: any) => l.log_type === "nutrition"));
        setWellnessLogs(logs.filter((l: any) => l.log_type === "wellness"));
      }

      const { data: prs } = await supabase
        .from("personal_records")
        .select("exercise_name, weight, reps, volume, logged_at")
        .eq("user_id", user.id)
        .order("weight", { ascending: false });
      if (prs) setPrList(prs);

      const { data: wl } = await supabase
        .from("weight_logs")
        .select("weight_lbs, logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", since)
        .order("logged_at", { ascending: true });
      if (wl) setWeightLogs(wl);

      const { data: allW } = await supabase
        .from("activity_logs")
        .select("logged_at")
        .eq("user_id", user.id)
        .eq("log_type", "workout")
        .order("logged_at", { ascending: false });
      if (allW) setAllWorkoutDates(allW.map((l: any) => l.logged_at));

    } catch(e) { console.error(e); }
    setLoading(false);
  }, [user, range]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const streaks = calcStreak(allWorkoutDates);
  const totalWorkouts = workoutLogs.length;
  const avgPerWeek = (totalWorkouts / rangeWeeks(range)).toFixed(1);
  const totalVolume = workoutLogs.reduce((s, l) => s + calcVolume(Array.isArray(l.exercises) ? l.exercises : []), 0);
  const totalCalBurned = workoutLogs.reduce((s, l) => s + (l.workout_calories || 0), 0);
  const totalDuration = workoutLogs.reduce((s, l) => s + (l.workout_duration_min || 0), 0);
  const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;

  // Favorite day
  const favDay = (() => {
    if (!workoutLogs.length) return "—";
    const counts: Record<string,number> = {};
    workoutLogs.forEach(l => { const d = dayOfWeek(l.logged_at); counts[d] = (counts[d]||0)+1; });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";
  })();

  // Muscle group breakdown
  const muscleGroups = (() => {
    const groups: Record<string,number> = {};
    workoutLogs.forEach(l => {
      (Array.isArray(l.exercises) ? l.exercises : []).forEach((ex: any) => {
        const g = getMuscleGroup(ex.name || "");
        groups[g] = (groups[g]||0) + 1;
      });
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value);
  })();

  // Muscle radar for balance
  const muscleRadar = ["Chest","Back","Legs","Shoulders","Arms","Core"].map(m => ({
    group: m,
    sessions: workoutLogs.filter(l => {
      const exs = Array.isArray(l.exercises) ? l.exercises : [];
      return exs.some((ex: any) => getMuscleGroup(ex.name||"") === m);
    }).length,
  }));

  // Weekly volume
  const weeklyVolume = (() => {
    const weeks: Record<string, { volume: number; calories: number }> = {};
    workoutLogs.forEach(l => {
      const d = new Date(l.logged_at);
      d.setDate(d.getDate() - d.getDay()); // Sunday start
      const key = d.toISOString().slice(0,10);
      if (!weeks[key]) weeks[key] = { volume: 0, calories: 0 };
      weeks[key].volume += calcVolume(Array.isArray(l.exercises) ? l.exercises : []);
      weeks[key].calories += l.workout_calories || 0;
    });
    return Object.entries(weeks).sort().map(([date, v]) => ({
      week: fmt(date), volume: Math.round(v.volume), calories: v.calories,
    }));
  })();

  // Month-over-month volume delta
  const volDelta = (() => {
    if (weeklyVolume.length < 2) return 0;
    const half = Math.floor(weeklyVolume.length / 2);
    const first = weeklyVolume.slice(0, half).reduce((s,w)=>s+w.volume,0);
    const second = weeklyVolume.slice(half).reduce((s,w)=>s+w.volume,0);
    if (!first) return 0;
    return ((second - first) / first) * 100;
  })();

  // Frequency by day of week
  const freqByDay = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day => {
    const dayMap: Record<string,number> = { Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:0 };
    return { day, count: workoutLogs.filter(l => new Date(l.logged_at).getDay() === dayMap[day]).length };
  });

  // Cardio stats
  const cardioLogs = workoutLogs.filter(l => Array.isArray(l.cardio) && l.cardio.length > 0);
  const allCardio = cardioLogs.flatMap(l => Array.isArray(l.cardio) ? l.cardio : []);
  const totalCardioSessions = cardioLogs.length;
  const cardioTypes = allCardio.map((c: any) => c.type || "Other");
  const mostCommonCardio = getMostCommon(cardioTypes);
  const totalCardioMin = allCardio.reduce((s: number, c: any) => s + (parseFloat(String(c.duration))||0), 0);

  // Nutrition
  const daysLogged = nutritionLogs.length;
  const avgCalories = daysLogged > 0 ? Math.round(nutritionLogs.reduce((s,l) => s + (l.calories_total||0), 0) / daysLogged) : 0;
  const avgProtein  = daysLogged > 0 ? Math.round(nutritionLogs.reduce((s,l) => s + (l.protein_g||0), 0) / daysLogged) : 0;
  const avgCarbs    = daysLogged > 0 ? Math.round(nutritionLogs.reduce((s,l) => s + (l.carbs_g||0), 0) / daysLogged) : 0;
  const avgFat      = daysLogged > 0 ? Math.round(nutritionLogs.reduce((s,l) => s + (l.fat_g||0), 0) / daysLogged) : 0;
  const proteinHitDays = nutritionLogs.filter(l => (l.protein_g||0) >= goals.proteinPerDay).length;
  const calorieHitDays = nutritionLogs.filter(l => Math.abs((l.calories_total||0) - goals.caloriesPerDay) < goals.caloriesPerDay * 0.1).length;
  const proteinConsistency = daysLogged > 0 ? Math.round((proteinHitDays / daysLogged) * 100) : 0;
  const calorieConsistency = daysLogged > 0 ? Math.round((calorieHitDays / daysLogged) * 100) : 0;

  // Daily nutrition chart
  const dailyNutrition = nutritionLogs.map(l => ({
    date: fmt(l.logged_at),
    calories: l.calories_total || 0,
    protein: Math.round(l.protein_g || 0),
    carbs: Math.round(l.carbs_g || 0),
    fat: Math.round(l.fat_g || 0),
  }));

  // Macro pie
  const macroPie = avgCalories > 0 ? [
    { name: "Protein", value: avgProtein * 4, color: "#4ADE80" },
    { name: "Carbs",   value: avgCarbs  * 4, color: C.purple },
    { name: "Fat",     value: avgFat    * 9, color: C.gold },
  ] : [];

  // Wellness breakdown
  const wellnessTypes = wellnessLogs.map(l => l.wellness_type || "Other");
  const wellnessByType = (() => {
    const f: Record<string,number> = {};
    wellnessTypes.forEach(t => { f[t] = (f[t]||0)+1; });
    return Object.entries(f).sort((a,b)=>b[1]-a[1]).map(([type, count]) => ({ type, count }));
  })();

  // Weight trend
  const firstW = weightLogs[0]?.weight_lbs;
  const lastW  = weightLogs[weightLogs.length-1]?.weight_lbs;
  const weightDelta = firstW && lastW ? Number((lastW - firstW).toFixed(1)) : null;

  // PRs grouped by exercise
  const prsByExercise = prList.reduce((acc: Record<string, any[]>, pr) => {
    if (!acc[pr.exercise_name]) acc[pr.exercise_name] = [];
    acc[pr.exercise_name].push(pr);
    return acc;
  }, {});

  // Best PR per exercise
  const topPRs = Object.entries(prsByExercise).map(([name, records]) => ({
    name,
    best: records.reduce((b, r) => r.weight > b.weight ? r : b),
    history: records.sort((a,b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()),
  })).sort((a,b) => b.best.weight - a.best.weight);

  const MUSCLE_COLORS: Record<string, string> = {
    Chest: "#F87171", Back: "#60A5FA", Legs: "#4ADE80",
    Shoulders: "#FBBF24", Arms: "#A78BFA", Core: "#F472B6", Other: "#6B7280",
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.sub, fontSize: 15 }}>Sign in to view your stats</div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview",   label: "Overview",   icon: "📊" },
    { key: "workout",    label: "Workout",    icon: "💪" },
    { key: "nutrition",  label: "Nutrition",  icon: "🥗" },
    { key: "wellness",   label: "Wellness",   icon: "🌿" },
    { key: "prs",        label: "PRs",        icon: "🏆" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 100 }}>

      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,15,0.96)", backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "14px 20px 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: C.text }}>📊 Stats</div>
          <div style={{ display: "flex", gap: 5 }}>
            {(["1M","3M","6M","1Y"] as Range[]).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: "5px 11px", borderRadius: 20, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 11,
                background: range === r ? C.purple : C.card,
                color: range === r ? "#fff" : C.sub,
                border: `1px solid ${range === r ? C.purple : C.border}`,
              }}>{r}</button>
            ))}
          </div>
        </div>
        {/* Scrollable tabs */}
        <div style={{ display: "flex", overflowX: "auto", gap: 0, scrollbarWidth: "none" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flexShrink: 0, padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer",
              fontWeight: 700, fontSize: 12, color: tab === t.key ? C.purple : C.sub,
              borderBottom: tab === t.key ? `2px solid ${C.purple}` : "2px solid transparent",
              whiteSpace: "nowrap",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 720, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: C.sub }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Loading your stats...
          </div>
        ) : (

          <>
            {/* ═══════════════════════════════════════════ OVERVIEW ══ */}
            {tab === "overview" && (
              <>
                {/* Hero stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <BigStat icon="🔥" label="Current Streak" value={`${streaks.current}d`} sub="days in a row" color={C.gold} />
                  <BigStat icon="🏆" label="Best Streak" value={`${streaks.longest}d`} sub="personal best" color={C.cyan} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <MiniStat label="Workouts" value={totalWorkouts} color={C.purple} />
                  <MiniStat label="Avg/Week" value={avgPerWeek} color={C.text} />
                  <MiniStat label="Fav Day" value={favDay} color={C.gold} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
                  <MiniStat label="Vol (lbs)" value={totalVolume > 1000 ? `${(totalVolume/1000).toFixed(0)}k` : totalVolume > 0 ? totalVolume.toFixed(0) : "—"} color={C.green} />
                  <MiniStat label="Cal Burned" value={totalCalBurned > 0 ? `${(totalCalBurned/1000).toFixed(1)}k` : "—"} color={C.red} />
                  <MiniStat label="PRs" value={topPRs.length} color={C.gold} />
                </div>

                {/* Heatmap */}
                <SectionHeader title="Activity — Last 12 Weeks" />
                <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                  {allWorkoutDates.length > 0
                    ? <Heatmap dates={allWorkoutDates} />
                    : <div style={{ color: C.sub, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Log workouts to see your consistency heatmap</div>
                  }
                </div>

                {/* Weekly volume */}
                {weeklyVolume.length > 1 && (
                  <>
                    <SectionHeader title={`Volume Trend ${volDelta !== 0 ? "" : ""}`} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: C.sub }}>vs. first half of period</span>
                      <DeltaBadge delta={volDelta} />
                    </div>
                    <ChartCard>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={weeklyVolume} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 9, fill: C.sub }} />
                          <YAxis tick={{ fontSize: 9, fill: C.sub }} />
                          <Tooltip content={<Tooltip2 />} />
                          <Bar dataKey="volume" name="Volume (lbs)" fill={C.purple} radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </>
                )}

                {/* Muscle balance radar */}
                {muscleRadar.some(m => m.sessions > 0) && (
                  <>
                    <SectionHeader title="Muscle Group Balance" />
                    <ChartCard height={220}>
                      <ResponsiveContainer width="100%" height={200}>
                        <RadarChart data={muscleRadar} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                          <PolarGrid stroke={C.border} />
                          <PolarAngleAxis dataKey="group" tick={{ fontSize: 11, fill: C.subLight }} />
                          <Radar dataKey="sessions" stroke={C.purple} fill={C.purple} fillOpacity={0.3} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </>
                )}

                {/* Goals */}
                <SectionHeader title="Goals" />
                <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Weekly Goals</span>
                    <button onClick={() => setEditingGoals(g => !g)} style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, border: `1px solid ${C.borderHi}`, background: editingGoals ? C.purple : "transparent", color: editingGoals ? "#fff" : C.sub, cursor: "pointer" }}>
                      {editingGoals ? "Done" : "⚙️ Edit"}
                    </button>
                  </div>
                  {editingGoals && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {[
                        { label: "Workouts/wk", key: "workoutsPerWeek" as const, unit: "" },
                        { label: "Protein/day (g)", key: "proteinPerDay" as const, unit: "g" },
                        { label: "Calories/day", key: "caloriesPerDay" as const, unit: "" },
                      ].map(({ label, key }) => (
                        <div key={key}>
                          <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>{label}</div>
                          <input
                            type="number"
                            value={goals[key]}
                            onChange={e => setGoals(g => ({ ...g, [key]: Number(e.target.value) }))}
                            style={{ width: "100%", background: "#0A0A0F", border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: "6px 8px", fontSize: 14, color: C.text, outline: "none" }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { label: "💪 Workouts / week", current: parseFloat(avgPerWeek), goal: goals.workoutsPerWeek, unit: "", color: C.purple },
                      { label: "🥩 Protein / day", current: avgProtein, goal: goals.proteinPerDay, unit: "g", color: C.green },
                      { label: "🔥 Calories / day", current: avgCalories, goal: goals.caloriesPerDay, unit: "kcal", color: C.gold },
                    ].map(({ label, current, goal, unit, color }) => (
                      <div key={label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: C.subLight }}>{label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>
                            {current > 0 ? `${current}${unit}` : "—"} <span style={{ color: C.sub, fontWeight: 400 }}>/ {goal}{unit}</span>
                          </span>
                        </div>
                        <ProgressBar value={current} max={goal} color={color} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════ WORKOUT ══ */}
            {tab === "workout" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <BigStat icon="📅" label="Total Workouts" value={totalWorkouts} sub={`in ${range}`} color={C.purple} />
                  <BigStat icon="📈" label="Avg / Week" value={avgPerWeek} sub="sessions/week" color={C.text} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
                  <MiniStat label="Avg Duration" value={avgDuration > 0 ? `${avgDuration}m` : "—"} color={C.cyan} />
                  <MiniStat label="Total Volume" value={totalVolume > 1000 ? `${(totalVolume/1000).toFixed(1)}k lbs` : totalVolume > 0 ? `${totalVolume} lbs` : "—"} color={C.green} />
                  <MiniStat label="Cal Burned" value={totalCalBurned > 0 ? `${totalCalBurned.toLocaleString()}` : "—"} color={C.red} />
                </div>

                {/* Heatmap */}
                <SectionHeader title="Activity Heatmap" />
                <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                  {allWorkoutDates.length > 0
                    ? <Heatmap dates={allWorkoutDates} />
                    : <div style={{ color: C.sub, fontSize: 13, textAlign: "center" }}>No workout data yet</div>
                  }
                </div>

                {/* Volume chart */}
                <SectionHeader title="Weekly Volume (lbs)" />
                {weeklyVolume.length > 1 ? (
                  <ChartCard>
                    <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={weeklyVolume} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 9, fill: C.sub }} />
                        <YAxis tick={{ fontSize: 9, fill: C.sub }} />
                        <Tooltip content={<Tooltip2 />} />
                        <Bar dataKey="volume" name="Volume (lbs)" fill={C.purple} radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                ) : <EmptyState icon="📈" text="Log more workouts to see volume trends" />}

                {/* Day of week frequency */}
                <SectionHeader title="Favorite Training Days" />
                {workoutLogs.length > 0 ? (
                  <ChartCard>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={freqByDay} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.sub }} />
                        <YAxis tick={{ fontSize: 11, fill: C.sub }} allowDecimals={false} />
                        <Tooltip content={<Tooltip2 />} />
                        <Bar dataKey="count" name="Workouts" radius={[4,4,0,0]}>
                          {freqByDay.map((e, i) => (
                            <Cell key={i} fill={e.day === favDay ? C.gold : C.purple} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ fontSize: 11, color: C.sub, textAlign: "center", marginTop: 4 }}>
                      🏅 {favDay} is your most common training day
                    </div>
                  </ChartCard>
                ) : <EmptyState icon="📅" text="Log workouts to see your training schedule" />}

                {/* Muscle group breakdown */}
                <SectionHeader title="Muscle Group Distribution" />
                {muscleGroups.length > 0 ? (
                  <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
                    {muscleGroups.map(({ name, value }) => (
                      <div key={name} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{name}</span>
                          <span style={{ fontSize: 12, color: MUSCLE_COLORS[name] || C.sub, fontWeight: 700 }}>{value} sets</span>
                        </div>
                        <ProgressBar value={value} max={Math.max(...muscleGroups.map(g=>g.value))} color={MUSCLE_COLORS[name] || C.sub} />
                      </div>
                    ))}
                  </div>
                ) : <EmptyState icon="💪" text="Log exercises to see muscle group breakdown" />}

                {/* Cardio */}
                {totalCardioSessions > 0 && (
                  <>
                    <SectionHeader title="Cardio" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <MiniStat label="Sessions" value={totalCardioSessions} color={C.cyan} />
                      <MiniStat label="Most Common" value={mostCommonCardio} color={C.text} />
                      <MiniStat label="Total Time" value={totalCardioMin > 60 ? `${(totalCardioMin/60).toFixed(1)}h` : `${Math.round(totalCardioMin)}m`} color={C.green} />
                    </div>
                  </>
                )}

                {/* Muscle radar */}
                {muscleRadar.some(m => m.sessions > 0) && (
                  <>
                    <SectionHeader title="Training Balance" />
                    <ChartCard height={220}>
                      <ResponsiveContainer width="100%" height={200}>
                        <RadarChart data={muscleRadar} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                          <PolarGrid stroke={C.border} />
                          <PolarAngleAxis dataKey="group" tick={{ fontSize: 11, fill: C.subLight }} />
                          <Radar dataKey="sessions" stroke={C.purple} fill={C.purple} fillOpacity={0.25} strokeWidth={2.5} dot={{ fill: C.purple, r: 3 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                    <div style={{ fontSize: 12, color: C.sub, textAlign: "center", marginTop: 8 }}>
                      Bigger = more sessions targeting that muscle group
                    </div>
                  </>
                )}
              </>
            )}

            {/* ═══════════════════════════════════════ NUTRITION ══ */}
            {tab === "nutrition" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <BigStat icon="🔥" label="Avg Daily Calories" value={avgCalories > 0 ? avgCalories.toLocaleString() : "—"} sub="kcal/day" color={C.gold} />
                  <BigStat icon="🥩" label="Avg Protein" value={avgProtein > 0 ? `${avgProtein}g` : "—"} sub="per day" color={C.green} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
                  <MiniStat label="Avg Carbs" value={avgCarbs > 0 ? `${avgCarbs}g` : "—"} color={C.purple} />
                  <MiniStat label="Avg Fat" value={avgFat > 0 ? `${avgFat}g` : "—"} color={C.gold} />
                  <MiniStat label="Days Logged" value={daysLogged} color={C.text} />
                </div>

                {/* Consistency */}
                <SectionHeader title="Nutrition Consistency" />
                <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                  {[
                    { label: `🥩 Protein goal (≥${goals.proteinPerDay}g/day)`, pct: proteinConsistency, color: C.green },
                    { label: `🔥 Calorie goal (~${goals.caloriesPerDay.toLocaleString()}/day ±10%)`, pct: calorieConsistency, color: C.gold },
                  ].map(({ label, pct, color }) => (
                    <div key={label} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: C.subLight }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color }}>{pct}%</span>
                      </div>
                      <ProgressBar value={pct} max={100} color={color} />
                      <div style={{ fontSize: 10, color: C.sub, marginTop: 3 }}>{daysLogged > 0 ? `${Math.round(pct/100*daysLogged)} of ${daysLogged} days` : "No data"}</div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>
                    Adjust goals in the Overview tab
                  </div>
                </div>

                {/* Daily chart */}
                <SectionHeader title="Daily Calories & Protein" />
                {dailyNutrition.length > 1 ? (
                  <ChartCard>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={dailyNutrition} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.sub }} />
                        <YAxis tick={{ fontSize: 9, fill: C.sub }} />
                        <Tooltip content={<Tooltip2 />} />
                        <Line dataKey="calories" name="Calories" stroke={C.gold} strokeWidth={2} dot={false} />
                        <Line dataKey="protein" name="Protein (g)" stroke={C.green} strokeWidth={2} dot={false} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                ) : <EmptyState icon="🥗" text="Log nutrition to see daily trends" />}

                {/* Macro breakdown */}
                {macroPie.length > 0 && (
                  <>
                    <SectionHeader title="Macro Breakdown (Avg)" />
                    <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 16 }}>
                      <ResponsiveContainer width={120} height={120}>
                        <PieChart>
                          <Pie data={macroPie} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50} strokeWidth={0}>
                            {macroPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ flex: 1 }}>
                        {macroPie.map(m => {
                          const total = macroPie.reduce((s,x)=>s+x.value,0);
                          const pct = total > 0 ? Math.round((m.value/total)*100) : 0;
                          return (
                            <div key={m.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 10, height: 10, borderRadius: 2, background: m.color, display: "inline-block" }} />
                                {m.name}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ═══════════════════════════════════════════ WELLNESS ══ */}
            {tab === "wellness" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                  <BigStat icon="🌿" label="Wellness Sessions" value={wellnessLogs.length} sub={`in ${range}`} color={C.green} />
                  <BigStat icon="⚖️" label="Body Weight" value={lastW ? `${lastW} lbs` : "—"} sub={weightDelta !== null ? `${weightDelta >= 0 ? "+" : ""}${weightDelta} lbs this period` : "no data"} color={weightDelta !== null ? (weightDelta < 0 ? C.green : weightDelta > 0 ? C.red : C.text) : C.text} />
                </div>

                {/* Wellness heatmap */}
                <SectionHeader title="Wellness Activity Heatmap" />
                <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                  {wellnessLogs.length > 0
                    ? <Heatmap dates={wellnessLogs.map(l => l.logged_at)} />
                    : <div style={{ color: C.sub, fontSize: 13, textAlign: "center" }}>Log wellness activities to see your consistency</div>
                  }
                </div>

                {/* By type */}
                {wellnessByType.length > 0 && (
                  <>
                    <SectionHeader title="Activity Breakdown" />
                    <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                      {wellnessByType.map(({ type, count }) => (
                        <div key={type} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{type}</span>
                            <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{count}×</span>
                          </div>
                          <ProgressBar value={count} max={wellnessByType[0].count} color={C.green} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Weight trend */}
                <SectionHeader title="Body Weight Trend" />
                {weightLogs.length > 1 ? (
                  <>
                    {weightDelta !== null && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: weightDelta < 0 ? C.green : weightDelta > 0 ? C.red : C.sub, marginBottom: 8, textAlign: "center" }}>
                        {weightDelta >= 0 ? "+" : ""}{weightDelta} lbs over this period
                      </div>
                    )}
                    <ChartCard>
                      <ResponsiveContainer width="100%" height={150}>
                        <LineChart data={weightLogs.map(w => ({ date: fmt(w.logged_at), weight: Number(w.weight_lbs) }))} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.sub }} />
                          <YAxis tick={{ fontSize: 9, fill: C.sub }} domain={["auto","auto"]} />
                          <Tooltip content={<Tooltip2 />} />
                          <Line dataKey="weight" name="Weight (lbs)" stroke={C.cyan} strokeWidth={2.5} dot={{ fill: C.cyan, r: 3, strokeWidth: 0 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </>
                ) : <EmptyState icon="⚖️" text="Log your weight on the Profile page to track trends here" />}
              </>
            )}

            {/* ═══════════════════════════════════════════════ PRs ══ */}
            {tab === "prs" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                  <BigStat icon="🏆" label="Total PRs" value={topPRs.length} sub="exercises tracked" color={C.gold} />
                  <BigStat icon="💀" label="Top Lift" value={topPRs[0]?.best.weight ? `${topPRs[0].best.weight} lbs` : "—"} sub={topPRs[0]?.name || "no data"} color={C.red} />
                </div>

                {topPRs.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {topPRs.map(({ name, best, history }) => {
                      const isExpanded = expandedPR === name;
                      const muscleGroup = getMuscleGroup(name);
                      const color = MUSCLE_COLORS[muscleGroup] || C.gold;
                      return (
                        <div key={name} style={{ background: C.card, borderRadius: 16, overflow: "hidden", border: `1px solid ${isExpanded ? color : C.border}`, transition: "border-color 0.2s" }}>
                          {/* Row */}
                          <button onClick={() => setExpandedPR(isExpanded ? null : name)} style={{
                            width: "100%", background: "transparent", border: "none", cursor: "pointer",
                            padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                            textAlign: "left",
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 2 }}>{name}</div>
                              <div style={{ fontSize: 11, color: C.sub }}>
                                <span style={{ color, fontWeight: 700 }}>{muscleGroup}</span>
                                {best.logged_at && ` · ${fmt(best.logged_at)}`}
                                {` · ${history.length} session${history.length !== 1 ? "s" : ""}`}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                              <div style={{ fontWeight: 900, fontSize: 18, color }}>{best.weight} lbs</div>
                              <div style={{ fontSize: 11, color: C.sub }}>{best.reps} reps</div>
                            </div>
                            <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.5" style={{ width: 16, height: 16, marginLeft: 10, flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </button>

                          {/* Expanded: progress chart */}
                          {isExpanded && (
                            <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>
                              {history.length > 1 ? (
                                <>
                                  <div style={{ fontSize: 12, color: C.sub, margin: "12px 0 8px" }}>Weight Progress</div>
                                  <ChartCard>
                                    <ResponsiveContainer width="100%" height={140}>
                                      <LineChart data={history.map(r => ({ date: fmt(r.logged_at), weight: r.weight, reps: r.reps }))} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.sub }} />
                                        <YAxis tick={{ fontSize: 9, fill: C.sub }} domain={["auto","auto"]} />
                                        <Tooltip content={<Tooltip2 />} />
                                        <Line dataKey="weight" name="Weight (lbs)" stroke={color} strokeWidth={2.5} dot={{ fill: color, r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </ChartCard>
                                </>
                              ) : (
                                <div style={{ fontSize: 12, color: C.sub, padding: "12px 0" }}>Log this exercise again to see your progress chart 📈</div>
                              )}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
                                <div style={{ background: C.bg, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                                  <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>Sessions</div>
                                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{history.length}</div>
                                </div>
                                <div style={{ background: C.bg, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                                  <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>Best</div>
                                  <div style={{ fontSize: 16, fontWeight: 800, color }}>{best.weight} lbs</div>
                                </div>
                                <div style={{ background: C.bg, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                                  <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>Best Reps</div>
                                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{Math.max(...history.map(r => r.reps))}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon="🏋️" text="No PRs yet — log workouts with specific exercises to track your personal records" />
                )}
              </>
            )}

          </>
        )}
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PieChart, Pie,
} from "recharts";

// ── Color system ─────────────────────────────────────────────────────────────
const C = {
  purple: "#7C3AED", purpleDim: "#2D1F52", purpleBorder: "#3D2A6E",
  gold: "#F5A623",   goldDim: "#2A1F08",
  cyan: "#06B6D4",   cyanDim: "#0A2030",
  green: "#4ADE80",  greenDim: "#0A2010",
  red: "#F87171",    redDim: "#200A0A",
  orange: "#FB923C",
  text: "#F0F0F0", sub: "#6B7280", subLight: "#9CA3AF",
  bg: "#0A0A0F", card: "#111118", cardHi: "#16161F",
  border: "#1E1E2E", borderHi: "#2D2040",
};

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = "today" | "week" | "month" | "prs" | "body";
type Range = "1M" | "3M" | "6M" | "1Y";
type NutritionGoals = {
  calories: number; protein: number; carbs: number; fat: number; water_oz: number;
};

// ── Muscle group detection ───────────────────────────────────────────────────
const MUSCLE_MAP: Record<string, string[]> = {
  Chest:     ["chest","bench","push","pec","fly","flye","incline","decline","dip"],
  Back:      ["back","row","pull","lat","deadlift","rdl","rhomboid","trap","rack pull"],
  Legs:      ["leg","squat","lunge","quad","hamstring","glute","calf","hip thrust","leg press","leg curl","leg extension"],
  Shoulders: ["shoulder","press","ohp","overhead","lateral","delt","arnold","shrug","face pull"],
  Arms:      ["curl","tricep","bicep","hammer","skull","pushdown","extension","preacher","dips","close grip"],
  Core:      ["abs","core","crunch","plank","sit-up","oblique","cable crunch","hanging leg"],
};
const MUSCLE_COLORS: Record<string, string> = {
  Chest:"#F87171", Back:"#60A5FA", Legs:"#4ADE80",
  Shoulders:"#FBBF24", Arms:"#A78BFA", Core:"#F472B6", Other:"#6B7280",
};
function getMuscle(name: string): string {
  const n = name.toLowerCase();
  for (const [group, kws] of Object.entries(MUSCLE_MAP)) {
    if (kws.some(k => n.includes(k))) return group;
  }
  return "Other";
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString();
}
function rangeToIso(r: Range) {
  return daysAgo(r === "1M" ? 30 : r === "3M" ? 90 : r === "6M" ? 180 : 365);
}
function fmt(iso: string, short = true) {
  return new Date(iso).toLocaleDateString("en-US", short
    ? { month: "short", day: "numeric" }
    : { weekday: "short", month: "short", day: "numeric" });
}
function calcVol(exs: any[]): number {
  return (exs || []).reduce((s, ex) => {
    const w = parseFloat(String(ex.weight)) || 0;
    return s + w * (parseInt(String(ex.reps)) || 0) * (parseInt(String(ex.sets)) || 0);
  }, 0);
}
function getMostCommon(arr: string[]): string {
  if (!arr.length) return "—";
  const f: Record<string, number> = {};
  arr.forEach(v => { if (v) f[v] = (f[v] || 0) + 1; });
  return Object.entries(f).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
}
function calcStreak(dates: string[]) {
  const unique = [...new Set(dates.map(d => d.slice(0, 10)))].sort().reverse();
  if (!unique.length) return { current: 0, longest: 0 };
  const today = new Date().toISOString().slice(0, 10);
  let cur = 0, best = 0, streak = 0, prev = "";
  for (const day of unique) {
    const diff = prev
      ? (new Date(prev).getTime() - new Date(day).getTime()) / 86400000
      : (new Date(today).getTime() - new Date(day).getTime()) / 86400000;
    streak = (!prev ? diff <= 1 : diff === 1) ? streak + 1 : 1;
    if (!cur) { const d0 = (new Date(today).getTime() - new Date(unique[0]).getTime()) / 86400000; if (d0 <= 1) cur = streak; }
    best = Math.max(best, streak);
    prev = day;
  }
  const d0 = (new Date(today).getTime() - new Date(unique[0]).getTime()) / 86400000;
  return { current: d0 <= 1 ? (cur || streak) : 0, longest: best };
}

// ── Small UI components ───────────────────────────────────────────────────────
function BigNum({ label, value, sub, color = C.purple, icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div style={{ background: C.card, borderRadius: 18, padding: "18px 16px", border: `1px solid ${C.border}`, flex: 1 }}>
      {icon && <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>}
      <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
function MiniNum({ label, value, color = C.text }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "11px 13px", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 9, color: C.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
function SecHead({ title }: { title: string }) {
  return <div style={{ fontWeight: 800, fontSize: 12, color: C.sub, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10, marginTop: 26 }}>{title}</div>;
}
function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "30px 20px", border: `1px solid ${C.border}`, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ color: C.sub, fontSize: 13 }}>{text}</div>
    </div>
  );
}
function ChartWrap({ children, height = 170 }: { children: React.ReactNode; height?: number }) {
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "14px 4px 8px 0", border: `1px solid ${C.border}` }}>
      {children}
    </div>
  );
}
function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1A1228", border: `1px solid ${C.borderHi}`, borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: C.subLight, fontWeight: 700, marginBottom: 3 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || C.purple }}>{p.name}: <b>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</b>{p.unit || ""}</div>
      ))}
    </div>
  );
}
function Bar2({ value, max, goal, color = C.purple }: { value: number; max: number; goal?: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const goalPct = goal && max > 0 ? Math.min(100, (goal / max) * 100) : null;
  return (
    <div style={{ position: "relative", background: C.border, borderRadius: 99, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
      {goalPct !== null && (
        <div style={{ position: "absolute", top: 0, left: `${goalPct}%`, width: 2, height: "100%", background: C.gold, transform: "translateX(-1px)" }} />
      )}
    </div>
  );
}
function Heatmap({ dates }: { dates: string[] }) {
  const today = new Date();
  const cells = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (83 - i));
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: dates.filter(dt => dt.startsWith(key)).length };
  });
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const col = (n: number) => n === 0 ? C.border : n === 1 ? "#4C1D95" : n === 2 ? "#6D28D9" : C.purple;
  const todayStr = today.toISOString().slice(0, 10);
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 3 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {week.map((cell, di) => (
              <div key={di} title={`${cell.date}: ${cell.count} log(s)`} style={{
                width: 13, height: 13, borderRadius: 3,
                background: col(cell.count),
                border: cell.date === todayStr ? `1.5px solid ${C.gold}` : "none",
              }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: C.sub }}>Less</span>
        {[0, 1, 2, 3].map(v => <div key={v} style={{ width: 11, height: 11, borderRadius: 2, background: col(v) }} />)}
        <span style={{ fontSize: 10, color: C.sub }}>More</span>
      </div>
    </div>
  );
}

// ── Macro target bar ─────────────────────────────────────────────────────────
function MacroRow({ label, current, goal, color, unit }: {
  label: string; current: number; goal: number; color: string; unit: string;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const over = current > goal;
  const barColor = over ? C.red : pct >= 90 ? C.green : color;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: barColor }}>
            {current > 0 ? current.toLocaleString() : "0"}{unit}
          </span>
          <span style={{ fontSize: 11, color: C.sub }}>/ {goal.toLocaleString()}{unit}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
            background: over ? C.redDim : pct >= 90 ? C.greenDim : C.purpleDim,
            color: over ? C.red : pct >= 90 ? C.green : C.purple,
          }}>{pct}%</span>
        </div>
      </div>
      <div style={{ background: C.border, borderRadius: 99, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 99, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("today");
  const [range, setRange] = useState<Range>("1M");
  const [loading, setLoading] = useState(true);
  const [expandedPR, setExpandedPR] = useState<string | null>(null);

  // Raw data
  const [goals, setGoals]           = useState<NutritionGoals | null>(null);
  const [editGoals, setEditGoals]   = useState<NutritionGoals>({ calories: 2500, protein: 180, carbs: 250, fat: 70, water_oz: 100 });
  const [savingGoals, setSavingGoals] = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [todayNut, setTodayNut]     = useState<{ calories: number; protein: number; carbs: number; fat: number; water_oz: number } | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<any | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);
  const [nutritionLogs, setNutritionLogs] = useState<any[]>([]);
  const [wellnessLogs, setWellnessLogs]   = useState<any[]>([]);
  const [weightLogs, setWeightLogs]       = useState<any[]>([]);
  const [prList, setPrList]               = useState<any[]>([]);
  const [allWorkoutDates, setAllWorkoutDates] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const since = rangeToIso(range);

    try {
      // User goals from users table
      const { data: userData } = await supabase
        .from("users").select("nutrition_goals").eq("id", user.id).single();
      if (userData?.nutrition_goals) {
        setGoals(userData.nutrition_goals as NutritionGoals);
        setEditGoals(userData.nutrition_goals as NutritionGoals);
      }

      // Today's nutrition totals
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const { data: todayNutData } = await supabase
        .from("activity_logs")
        .select("calories_total, protein_g, carbs_g, fat_g, water_oz")
        .eq("user_id", user.id).eq("log_type", "nutrition")
        .gte("logged_at", todayStart.toISOString())
        .lte("logged_at", todayEnd.toISOString());
      if (todayNutData && todayNutData.length > 0) {
        setTodayNut(todayNutData.reduce((acc: any, l: any) => ({
          calories: acc.calories + (l.calories_total || 0),
          protein:  acc.protein  + (l.protein_g    || 0),
          carbs:    acc.carbs    + (l.carbs_g      || 0),
          fat:      acc.fat      + (l.fat_g        || 0),
          water_oz: acc.water_oz + (l.water_oz     || 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0, water_oz: 0 }));
      } else {
        setTodayNut(null);
      }

      // Today's workout
      const { data: todayWoData } = await supabase
        .from("activity_logs")
        .select("workout_type, workout_duration_min, workout_calories, exercises, cardio")
        .eq("user_id", user.id).eq("log_type", "workout")
        .gte("logged_at", todayStart.toISOString())
        .lte("logged_at", todayEnd.toISOString())
        .limit(1).single().throwOnError();
      setTodayWorkout(todayWoData || null);

      // Range activity logs
      const { data: logs } = await supabase
        .from("activity_logs")
        .select("id, log_type, logged_at, workout_type, workout_duration_min, workout_calories, exercises, cardio, calories_total, protein_g, carbs_g, fat_g, water_oz, wellness_type, wellness_data")
        .eq("user_id", user.id).gte("logged_at", since)
        .order("logged_at", { ascending: true });
      if (logs) {
        setWorkoutLogs(logs.filter((l: any) => l.log_type === "workout"));
        setNutritionLogs(logs.filter((l: any) => l.log_type === "nutrition"));
        setWellnessLogs(logs.filter((l: any) => l.log_type === "wellness"));
      }

      // PRs
      const { data: prs } = await supabase
        .from("personal_records")
        .select("exercise_name, weight, reps, volume, logged_at")
        .eq("user_id", user.id).order("weight", { ascending: false });
      if (prs) setPrList(prs);

      // Weight logs
      const { data: wl } = await supabase
        .from("weight_logs").select("weight_lbs, logged_at")
        .eq("user_id", user.id).gte("logged_at", since)
        .order("logged_at", { ascending: true });
      if (wl) setWeightLogs(wl);

      // All workout dates for streak + heatmap
      const { data: allW } = await supabase
        .from("activity_logs").select("logged_at")
        .eq("user_id", user.id).eq("log_type", "workout")
        .order("logged_at", { ascending: false });
      if (allW) setAllWorkoutDates(allW.map((l: any) => l.logged_at));

    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user, range]);

  useEffect(() => { load(); }, [load]);

  async function saveGoals() {
    if (!user) return;
    setSavingGoals(true);
    try {
      await supabase.from("users").update({ nutrition_goals: editGoals }).eq("id", user.id);
      setGoals(editGoals);
      setShowGoalEditor(false);
    } catch (e) { console.error(e); }
    setSavingGoals(false);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const streaks = calcStreak(allWorkoutDates);
  const totalWorkouts = workoutLogs.length;
  const rangeWeeks = range === "1M" ? 4 : range === "3M" ? 13 : range === "6M" ? 26 : 52;
  const avgPerWeek = totalWorkouts > 0 ? (totalWorkouts / rangeWeeks).toFixed(1) : "0";
  const totalVolume = workoutLogs.reduce((s, l) => s + calcVol(Array.isArray(l.exercises) ? l.exercises : []), 0);
  const totalCalBurned = workoutLogs.reduce((s, l) => s + (l.workout_calories || 0), 0);
  const avgDuration = totalWorkouts > 0
    ? Math.round(workoutLogs.reduce((s, l) => s + (l.workout_duration_min || 0), 0) / totalWorkouts)
    : 0;

  const favDay = (() => {
    if (!workoutLogs.length) return "—";
    const map = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const c: Record<string, number> = {};
    workoutLogs.forEach(l => { const d = map[new Date(l.logged_at).getDay()]; c[d] = (c[d]||0)+1; });
    return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";
  })();

  // Muscle groups
  const muscleGroups = (() => {
    const g: Record<string, number> = {};
    workoutLogs.forEach(l => (Array.isArray(l.exercises) ? l.exercises : []).forEach((ex: any) => {
      const m = getMuscle(ex.name || "");
      g[m] = (g[m]||0) + 1;
    }));
    return Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([name, value]) => ({ name, value }));
  })();

  const muscleRadar = ["Chest","Back","Legs","Shoulders","Arms","Core"].map(m => ({
    group: m,
    sessions: workoutLogs.filter(l => (Array.isArray(l.exercises) ? l.exercises : []).some((ex: any) => getMuscle(ex.name||"") === m)).length,
  }));

  // Weekly volume
  const weeklyVolume = (() => {
    const weeks: Record<string, number> = {};
    workoutLogs.forEach(l => {
      const d = new Date(l.logged_at); d.setDate(d.getDate() - d.getDay());
      const key = d.toISOString().slice(0,10);
      weeks[key] = (weeks[key]||0) + calcVol(Array.isArray(l.exercises) ? l.exercises : []);
    });
    return Object.entries(weeks).sort().map(([date, vol]) => ({ week: fmt(date), volume: Math.round(vol) }));
  })();

  // Day of week frequency
  const freqByDay = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day => {
    const idx = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(day);
    const jsDay = idx < 6 ? idx + 1 : 0;
    return { day, count: workoutLogs.filter(l => new Date(l.logged_at).getDay() === jsDay).length };
  });

  // Nutrition averages
  const daysLogged = nutritionLogs.length;
  const avgCal  = daysLogged > 0 ? Math.round(nutritionLogs.reduce((s,l)=>s+(l.calories_total||0),0)/daysLogged) : 0;
  const avgProt = daysLogged > 0 ? Math.round(nutritionLogs.reduce((s,l)=>s+(l.protein_g||0),0)/daysLogged) : 0;
  const avgCarbs= daysLogged > 0 ? Math.round(nutritionLogs.reduce((s,l)=>s+(l.carbs_g||0),0)/daysLogged) : 0;
  const avgFat  = daysLogged > 0 ? Math.round(nutritionLogs.reduce((s,l)=>s+(l.fat_g||0),0)/daysLogged) : 0;

  // Consistency
  const proteinHit  = goals ? nutritionLogs.filter(l=>(l.protein_g||0) >= goals.protein).length : 0;
  const calorieHit  = goals ? nutritionLogs.filter(l=>Math.abs((l.calories_total||0)-goals.calories) <= goals.calories*0.1).length : 0;
  const proteinPct  = daysLogged > 0 ? Math.round((proteinHit/daysLogged)*100) : 0;
  const caloriePct  = daysLogged > 0 ? Math.round((calorieHit/daysLogged)*100) : 0;

  // Daily nutrition chart data
  const dailyNutrition = nutritionLogs.map(l => ({
    date: fmt(l.logged_at),
    calories: Math.round(l.calories_total || 0),
    protein: Math.round(l.protein_g || 0),
    calGoal: goals?.calories || 0,
    protGoal: goals?.protein || 0,
  }));

  // Macro pie
  const macroPie = avgCal > 0 ? [
    { name: "Protein", value: Math.round(avgProt * 4), color: C.green },
    { name: "Carbs",   value: Math.round(avgCarbs * 4), color: C.purple },
    { name: "Fat",     value: Math.round(avgFat * 9),   color: C.gold },
  ] : [];

  // PRs grouped
  const prsByEx = prList.reduce((acc: Record<string, any[]>, pr) => {
    if (!acc[pr.exercise_name]) acc[pr.exercise_name] = [];
    acc[pr.exercise_name].push(pr);
    return acc;
  }, {});
  const topPRs = Object.entries(prsByEx).map(([name, records]) => ({
    name,
    best: records.reduce((b, r) => r.weight > b.weight ? r : b),
    history: records.sort((a,b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()),
  })).sort((a,b) => b.best.weight - a.best.weight);

  // Weight
  const firstW  = weightLogs[0]?.weight_lbs;
  const lastW   = weightLogs[weightLogs.length - 1]?.weight_lbs;
  const wDelta  = firstW && lastW ? Number((lastW - firstW).toFixed(1)) : null;

  // Wellness by type
  const wellnessByType = (() => {
    const f: Record<string, number> = {};
    wellnessLogs.forEach(l => { const t = l.wellness_type || "Other"; f[t] = (f[t]||0)+1; });
    return Object.entries(f).sort((a,b)=>b[1]-a[1]).map(([type, count]) => ({ type, count }));
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  if (!user) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.sub }}>Sign in to view your stats</div>
    </div>
  );

  const TABS: { key: Tab; icon: string; label: string }[] = [
    { key: "today",  icon: "☀️", label: "Today"   },
    { key: "week",   icon: "📅", label: "Workout"  },
    { key: "month",  icon: "📊", label: "Nutrition"},
    { key: "prs",    icon: "🏆", label: "PRs"      },
    { key: "body",   icon: "⚖️", label: "Body"     },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 100 }}>

      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,15,0.97)", backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${C.border}`, padding: "14px 18px 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 21, color: C.text }}>📊 Stats</div>
          {(tab === "week" || tab === "month" || tab === "body") && (
            <div style={{ display: "flex", gap: 4 }}>
              {(["1M","3M","6M","1Y"] as Range[]).map(r => (
                <button key={r} onClick={() => setRange(r)} style={{
                  padding: "4px 10px", borderRadius: 20, border: `1px solid ${range === r ? C.purple : C.border}`,
                  background: range === r ? C.purple : "transparent",
                  color: range === r ? "#fff" : C.sub, fontWeight: 700, fontSize: 11, cursor: "pointer",
                }}>{r}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flexShrink: 0, padding: "9px 14px", border: "none", background: "transparent",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
              color: tab === t.key ? C.purple : C.sub,
              borderBottom: tab === t.key ? `2px solid ${C.purple}` : "2px solid transparent",
              whiteSpace: "nowrap",
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "18px 16px", maxWidth: 720, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: C.sub }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
            Loading your stats...
          </div>
        ) : (<>

          {/* ════════════════════════════════════════════ TODAY ══ */}
          {tab === "today" && (<>
            {/* Streak banner */}
            <div style={{ background: `linear-gradient(135deg, ${C.purpleDim}, #1A0F30)`, borderRadius: 18, padding: "18px 20px", border: `1px solid ${C.purpleBorder}`, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: C.subLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Current Streak</div>
                <div style={{ fontSize: 38, fontWeight: 900, color: C.gold, lineHeight: 1 }}>{streaks.current}<span style={{ fontSize: 18, color: C.sub, marginLeft: 4 }}>days</span></div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>Best: {streaks.longest} days</div>
              </div>
              <div style={{ fontSize: 52 }}>🔥</div>
            </div>

            {/* Today's workout */}
            <SecHead title="Today's Workout" />
            {todayWorkout ? (
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{todayWorkout.workout_type || "Workout"}</div>
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
                      {todayWorkout.workout_duration_min ? `⏱ ${todayWorkout.workout_duration_min} min` : ""}
                      {todayWorkout.workout_calories ? ` · 🔥 ${todayWorkout.workout_calories} cal` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: 28 }}>💪</div>
                </div>
                {Array.isArray(todayWorkout.exercises) && todayWorkout.exercises.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {todayWorkout.exercises.map((ex: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: C.bg, borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: C.text }}>{ex.name}</span>
                        <span style={{ fontSize: 12, color: C.sub }}>{ex.sets}×{ex.reps} @ {ex.weight} lbs</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: C.card, borderRadius: 14, padding: "20px 16px", border: `1px solid ${C.border}`, marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 28 }}>😴</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>No workout logged today</div>
                  <button onClick={() => router.push("/post")} style={{ fontSize: 12, color: C.purple, fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}>
                    + Log a workout →
                  </button>
                </div>
              </div>
            )}

            {/* Today's nutrition vs targets */}
            <SecHead title="Today's Nutrition" />
            {!goals ? (
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>No goals set yet</div>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>Set your daily calorie and macro targets to track progress here.</div>
                <button onClick={() => { setTab("month"); setTimeout(() => setShowGoalEditor(true), 100); }} style={{
                  padding: "8px 16px", borderRadius: 10, border: "none",
                  background: `linear-gradient(135deg, ${C.purple}, #A78BFA)`,
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>⚙️ Set Nutrition Goals</button>
              </div>
            ) : (
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                {todayNut ? (<>
                  <MacroRow label="🔥 Calories" current={Math.round(todayNut.calories)} goal={goals.calories} color={C.gold} unit=" kcal" />
                  <MacroRow label="🥩 Protein"  current={Math.round(todayNut.protein)}  goal={goals.protein}  color={C.green} unit="g" />
                  <MacroRow label="🍞 Carbs"    current={Math.round(todayNut.carbs)}    goal={goals.carbs}    color={C.purple} unit="g" />
                  <MacroRow label="🥑 Fat"      current={Math.round(todayNut.fat)}      goal={goals.fat}      color={C.gold} unit="g" />
                  {goals.water_oz > 0 && (
                    <MacroRow label="💧 Water" current={Math.round(todayNut.water_oz)} goal={goals.water_oz} color={C.cyan} unit=" oz" />
                  )}
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 4, textAlign: "center" }}>
                    Gold line = your target · Green = on track · Red = over
                  </div>
                </>) : (
                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🥗</div>
                    <div style={{ fontSize: 14, color: C.subLight, fontWeight: 700, marginBottom: 4 }}>Nothing logged yet today</div>
                    <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>
                      Your targets: {goals.calories.toLocaleString()} kcal · {goals.protein}g protein · {goals.carbs}g carbs · {goals.fat}g fat
                    </div>
                    <button onClick={() => router.push("/post")} style={{
                      padding: "7px 16px", borderRadius: 10, border: "none",
                      background: `linear-gradient(135deg, ${C.purple}, #A78BFA)`,
                      color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>+ Log Nutrition</button>
                  </div>
                )}
              </div>
            )}

            {/* Quick stats row */}
            <SecHead title="This Period" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              <MiniNum label="Workouts" value={totalWorkouts} color={C.purple} />
              <MiniNum label="Avg/Week" value={avgPerWeek} color={C.text} />
              <MiniNum label="PRs" value={topPRs.length} color={C.gold} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <MiniNum label="Volume (lbs)" value={totalVolume > 1000 ? `${(totalVolume/1000).toFixed(1)}k` : totalVolume > 0 ? String(Math.round(totalVolume)) : "—"} color={C.green} />
              <MiniNum label="Cal Burned" value={totalCalBurned > 0 ? totalCalBurned.toLocaleString() : "—"} color={C.red} />
            </div>
          </>)}

          {/* ════════════════════════════════════════════ WORKOUT ══ */}
          {tab === "week" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <BigNum icon="🔥" label="Current Streak" value={`${streaks.current}d`} sub={`best: ${streaks.longest}d`} color={C.gold} />
              <BigNum icon="💪" label="Total Workouts" value={totalWorkouts} sub={`in ${range}`} color={C.purple} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
              <MiniNum label="Avg/Week" value={avgPerWeek} color={C.text} />
              <MiniNum label="Avg Duration" value={avgDuration > 0 ? `${avgDuration}m` : "—"} color={C.cyan} />
              <MiniNum label="Fav Day" value={favDay} color={C.gold} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
              <MiniNum label="Total Volume" value={totalVolume > 1000 ? `${(totalVolume/1000).toFixed(1)}k lbs` : totalVolume > 0 ? `${Math.round(totalVolume)} lbs` : "—"} color={C.green} />
              <MiniNum label="Cal Burned" value={totalCalBurned > 0 ? `${totalCalBurned.toLocaleString()}` : "—"} color={C.red} />
            </div>

            <SecHead title="Activity Heatmap (12 weeks)" />
            <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 20 }}>
              {allWorkoutDates.length > 0 ? <Heatmap dates={allWorkoutDates} /> : <div style={{ color: C.sub, fontSize: 13, textAlign: "center" }}>No data yet</div>}
            </div>

            <SecHead title="Weekly Volume Trend" />
            {weeklyVolume.length > 1 ? (
              <ChartWrap>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={weeklyVolume} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 9, fill: C.sub }} />
                    <YAxis tick={{ fontSize: 9, fill: C.sub }} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="volume" name="Volume (lbs)" fill={C.purple} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrap>
            ) : <Empty icon="📈" text="Log more workouts to see volume trends" />}

            <SecHead title="Training Days" />
            {workoutLogs.length > 0 ? (
              <ChartWrap>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={freqByDay} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.sub }} />
                    <YAxis tick={{ fontSize: 10, fill: C.sub }} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="count" name="Sessions" radius={[4,4,0,0]}>
                      {freqByDay.map((e, i) => <Cell key={i} fill={e.day === favDay ? C.gold : C.purple} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 11, color: C.sub, textAlign: "center", marginTop: 4 }}>🏅 Gold = most frequent day</div>
              </ChartWrap>
            ) : <Empty icon="📅" text="Log workouts to see training patterns" />}

            <SecHead title="Muscle Group Breakdown" />
            {muscleGroups.length > 0 ? (
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                {muscleGroups.map(({ name, value }) => (
                  <div key={name} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: MUSCLE_COLORS[name] || C.sub }}>{value} sets</span>
                    </div>
                    <Bar2 value={value} max={muscleGroups[0].value} color={MUSCLE_COLORS[name] || C.sub} />
                  </div>
                ))}
              </div>
            ) : <Empty icon="💪" text="Log exercises to see muscle group breakdown" />}

            {muscleRadar.some(m => m.sessions > 0) && (<>
              <SecHead title="Training Balance" />
              <ChartWrap height={210}>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={muscleRadar} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                    <PolarGrid stroke={C.border} />
                    <PolarAngleAxis dataKey="group" tick={{ fontSize: 11, fill: C.subLight }} />
                    <Radar dataKey="sessions" stroke={C.purple} fill={C.purple} fillOpacity={0.25} strokeWidth={2.5} dot={{ fill: C.purple, r: 3 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartWrap>
            </>)}
          </>)}

          {/* ════════════════════════════════════════ NUTRITION ══ */}
          {tab === "month" && (<>
            {/* Goals editor */}
            <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${showGoalEditor ? C.purple : C.border}`, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showGoalEditor ? 16 : 0 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>⚙️ Nutrition Goals</div>
                  {!showGoalEditor && goals && (
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
                      {goals.calories.toLocaleString()} kcal · {goals.protein}g protein · {goals.carbs}g carbs · {goals.fat}g fat
                    </div>
                  )}
                  {!showGoalEditor && !goals && (
                    <div style={{ fontSize: 12, color: C.red, marginTop: 3 }}>No goals set — tap Edit to add targets</div>
                  )}
                </div>
                <button onClick={() => setShowGoalEditor(g => !g)} style={{
                  padding: "6px 14px", borderRadius: 20, border: `1px solid ${C.borderHi}`,
                  background: showGoalEditor ? C.purple : "transparent",
                  color: showGoalEditor ? "#fff" : C.sub, fontWeight: 700, fontSize: 12, cursor: "pointer",
                }}>{showGoalEditor ? "Cancel" : "✏️ Edit"}</button>
              </div>

              {showGoalEditor && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    {([
                      { label: "🔥 Calories (kcal)", key: "calories" as keyof NutritionGoals },
                      { label: "🥩 Protein (g)",     key: "protein"  as keyof NutritionGoals },
                      { label: "🍞 Carbs (g)",        key: "carbs"    as keyof NutritionGoals },
                      { label: "🥑 Fat (g)",          key: "fat"      as keyof NutritionGoals },
                      { label: "💧 Water (oz)",       key: "water_oz" as keyof NutritionGoals },
                    ] as { label: string; key: keyof NutritionGoals }[]).map(({ label, key }) => (
                      <div key={key}>
                        <div style={{ fontSize: 11, color: C.sub, marginBottom: 5, fontWeight: 600 }}>{label}</div>
                        <input
                          type="number"
                          value={editGoals[key]}
                          onChange={e => setEditGoals(g => ({ ...g, [key]: Number(e.target.value) }))}
                          style={{
                            width: "100%", background: C.bg, border: `1px solid ${C.borderHi}`,
                            borderRadius: 10, padding: "8px 10px", fontSize: 15, fontWeight: 700,
                            color: C.text, outline: "none", boxSizing: "border-box",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <button onClick={saveGoals} disabled={savingGoals} style={{
                    width: "100%", padding: "11px 0", borderRadius: 12, border: "none",
                    background: `linear-gradient(135deg, ${C.purple}, #A78BFA)`,
                    color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer",
                  }}>{savingGoals ? "Saving..." : "💾 Save Goals"}</button>
                </>
              )}
            </div>

            {/* Averages */}
            <SecHead title={`Averages — ${range}`} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <BigNum icon="🔥" label="Avg Daily Calories" value={avgCal > 0 ? avgCal.toLocaleString() : "—"} sub={goals ? `goal: ${goals.calories.toLocaleString()} kcal` : "no goal set"} color={C.gold} />
              <BigNum icon="🥩" label="Avg Protein" value={avgProt > 0 ? `${avgProt}g` : "—"} sub={goals ? `goal: ${goals.protein}g` : "no goal set"} color={C.green} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
              <MiniNum label="Avg Carbs" value={avgCarbs > 0 ? `${avgCarbs}g` : "—"} color={C.purple} />
              <MiniNum label="Avg Fat" value={avgFat > 0 ? `${avgFat}g` : "—"} color={C.gold} />
              <MiniNum label="Days Logged" value={daysLogged} color={C.text} />
            </div>

            {/* Consistency vs goals */}
            {goals && daysLogged > 0 && (<>
              <SecHead title="Goal Consistency" />
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                {[
                  { label: `🥩 Protein ≥ ${goals.protein}g`, pct: proteinPct, hit: proteinHit, color: C.green },
                  { label: `🔥 Calories within 10% of ${goals.calories.toLocaleString()}`, pct: caloriePct, hit: calorieHit, color: C.gold },
                ].map(({ label, pct, hit, color }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: C.subLight }}>{label}</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color }}>{pct}%</span>
                    </div>
                    <div style={{ background: C.border, borderRadius: 99, height: 8, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>{hit} of {daysLogged} days</div>
                  </div>
                ))}
              </div>
            </>)}

            {/* Daily chart */}
            <SecHead title="Daily Calories & Protein" />
            {dailyNutrition.length > 1 ? (
              <ChartWrap>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={dailyNutrition} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.sub }} />
                    <YAxis tick={{ fontSize: 9, fill: C.sub }} />
                    <Tooltip content={<Tip />} />
                    <Line dataKey="calories" name="Calories" stroke={C.gold} strokeWidth={2} dot={false} />
                    <Line dataKey="protein" name="Protein (g)" stroke={C.green} strokeWidth={2} dot={false} strokeDasharray="4 2" />
                    {goals && <Line dataKey="calGoal" name="Cal Goal" stroke={C.gold} strokeWidth={1} dot={false} strokeDasharray="2 4" opacity={0.4} />}
                    {goals && <Line dataKey="protGoal" name="Protein Goal" stroke={C.green} strokeWidth={1} dot={false} strokeDasharray="2 4" opacity={0.4} />}
                  </LineChart>
                </ResponsiveContainer>
                {goals && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 6, paddingRight: 8 }}>
                    <div style={{ fontSize: 10, color: C.gold }}>━━ Calories (solid = actual, dashed = goal)</div>
                    <div style={{ fontSize: 10, color: C.green }}>━━ Protein</div>
                  </div>
                )}
              </ChartWrap>
            ) : <Empty icon="🥗" text="Log nutrition to see daily trends" />}

            {/* Macro breakdown pie */}
            {macroPie.length > 0 && (<>
              <SecHead title="Average Macro Split" />
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 16 }}>
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie data={macroPie} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={48} strokeWidth={0}>
                      {macroPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {macroPie.map(m => {
                    const total = macroPie.reduce((s,x)=>s+x.value,0);
                    const pct = total > 0 ? Math.round((m.value/total)*100) : 0;
                    return (
                      <div key={m.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: m.color, display: "inline-block" }} />
                          {m.name}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{pct}%</span>
                      </div>
                    );
                  })}
                  {goals && (
                    <div style={{ fontSize: 11, color: C.sub, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                      Target: {Math.round((goals.protein*4/(goals.calories||1))*100)}P / {Math.round((goals.carbs*4/(goals.calories||1))*100)}C / {Math.round((goals.fat*9/(goals.calories||1))*100)}F %
                    </div>
                  )}
                </div>
              </div>
            </>)}
          </>)}

          {/* ════════════════════════════════════════════════ PRs ══ */}
          {tab === "prs" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <BigNum icon="🏆" label="Total PRs Tracked" value={topPRs.length} sub="exercises" color={C.gold} />
              <BigNum icon="💀" label="Heaviest Lift" value={topPRs[0]?.best.weight ? `${topPRs[0].best.weight} lbs` : "—"} sub={topPRs[0]?.name || "no data"} color={C.red} />
            </div>

            {topPRs.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topPRs.map(({ name, best, history }) => {
                  const expanded = expandedPR === name;
                  const muscle = getMuscle(name);
                  const color = MUSCLE_COLORS[muscle] || C.gold;
                  const improvement = history.length > 1
                    ? ((history[history.length-1].weight - history[0].weight) / history[0].weight * 100).toFixed(1)
                    : null;
                  return (
                    <div key={name} style={{ background: C.card, borderRadius: 16, overflow: "hidden", border: `1px solid ${expanded ? color : C.border}`, transition: "border-color 0.2s" }}>
                      <button onClick={() => setExpandedPR(expanded ? null : name)} style={{
                        width: "100%", background: "transparent", border: "none", cursor: "pointer",
                        padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left",
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 3 }}>{name}</div>
                          <div style={{ fontSize: 11, color: C.sub }}>
                            <span style={{ color, fontWeight: 700 }}>{muscle}</span>
                            {best.logged_at && ` · ${fmt(best.logged_at)}`}
                            {improvement && Number(improvement) > 0 && <span style={{ color: C.green, marginLeft: 6 }}>▲ +{improvement}%</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                          <div style={{ fontWeight: 900, fontSize: 20, color }}>{best.weight} lbs</div>
                          <div style={{ fontSize: 11, color: C.sub }}>{best.reps} reps · {history.length} sessions</div>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.5" style={{ width: 16, height: 16, marginLeft: 10, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>

                      {expanded && (
                        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>
                          {history.length > 1 ? (<>
                            <div style={{ fontSize: 11, color: C.sub, margin: "12px 0 8px" }}>Weight progression</div>
                            <ChartWrap>
                              <ResponsiveContainer width="100%" height={130}>
                                <LineChart data={history.map(r => ({ date: fmt(r.logged_at), weight: r.weight, reps: r.reps }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.sub }} />
                                  <YAxis tick={{ fontSize: 9, fill: C.sub }} domain={["auto","auto"]} />
                                  <Tooltip content={<Tip />} />
                                  <Line dataKey="weight" name="Weight (lbs)" stroke={color} strokeWidth={2.5} dot={{ fill: color, r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </ChartWrap>
                          </>) : (
                            <div style={{ fontSize: 12, color: C.sub, padding: "12px 0" }}>Log this exercise again to see a progress chart 📈</div>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
                            {[
                              { label: "Sessions", value: history.length, color: C.text },
                              { label: "PR",        value: `${best.weight} lbs`, color },
                              { label: "Best Reps", value: Math.max(...history.map(r=>r.reps)), color: C.text },
                              { label: "Gained",    value: improvement && Number(improvement) > 0 ? `+${improvement}%` : "—", color: Number(improvement) > 0 ? C.green : C.sub },
                            ].map(({ label, value, color: c }) => (
                              <div key={label} style={{ background: C.bg, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                                <div style={{ fontSize: 9, color: C.sub, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty icon="🏋️" text="No PRs yet — log workouts with specific exercises to track your personal records" />
            )}
          </>)}

          {/* ════════════════════════════════════════════════ BODY ══ */}
          {tab === "body" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <BigNum icon="⚖️" label="Current Weight" value={lastW ? `${lastW} lbs` : "—"} sub={wDelta !== null ? `${wDelta >= 0 ? "+" : ""}${wDelta} lbs in ${range}` : "no data"} color={wDelta !== null ? (wDelta < 0 ? C.green : wDelta > 0 ? C.red : C.text) : C.text} />
              <BigNum icon="🌿" label="Wellness Sessions" value={wellnessLogs.length} sub={`in ${range}`} color={C.green} />
            </div>

            {/* Weight trend */}
            <SecHead title="Body Weight Trend" />
            {weightLogs.length > 1 ? (
              <ChartWrap>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={weightLogs.map(w => ({ date: fmt(w.logged_at), weight: Number(w.weight_lbs) }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.sub }} />
                    <YAxis tick={{ fontSize: 9, fill: C.sub }} domain={["auto","auto"]} />
                    <Tooltip content={<Tip />} />
                    <Line dataKey="weight" name="Weight (lbs)" stroke={C.cyan} strokeWidth={2.5} dot={{ fill: C.cyan, r: 3, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartWrap>
            ) : (
              <Empty icon="⚖️" text="Log weight on your Profile page to see the trend here" />
            )}
            {wDelta !== null && (
              <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, fontWeight: 700, color: wDelta < 0 ? C.green : wDelta > 0 ? C.red : C.sub }}>
                {wDelta < 0 ? "📉" : wDelta > 0 ? "📈" : "→"} {wDelta >= 0 ? "+" : ""}{wDelta} lbs over {range}
              </div>
            )}

            {/* Wellness heatmap */}
            <SecHead title="Wellness Consistency" />
            <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 20 }}>
              {wellnessLogs.length > 0
                ? <Heatmap dates={wellnessLogs.map(l => l.logged_at)} />
                : <div style={{ color: C.sub, fontSize: 13, textAlign: "center" }}>Log wellness activities to track consistency</div>
              }
            </div>

            {/* Wellness by type */}
            {wellnessByType.length > 0 && (<>
              <SecHead title="Activity Breakdown" />
              <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                {wellnessByType.map(({ type, count }) => (
                  <div key={type} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{type}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{count}×</span>
                    </div>
                    <Bar2 value={count} max={wellnessByType[0].count} color={C.green} />
                  </div>
                ))}
              </div>
            </>)}
          </>)}

        </>)}
      </div>
    </div>
  );
}

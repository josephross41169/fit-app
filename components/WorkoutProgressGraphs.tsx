"use client";
import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

type WorkoutData = {
  date: string; exercise: string; weight: number;
  reps: number; sets: number; volume: number;
};
type ExerciseStats = {
  name: string; bestWeight: number; lastWeight: number;
  totalVolume: number; pr: { weight: number; date: string } | null;
  history: WorkoutData[]; isCardio: boolean;
};

const C = {
  purple: "#7C3AED", purpleDark: "#1E1530", purpleMid: "#2D1F52",
  purpleBorder: "#4C3A7A", gold: "#F5A623", cyan: "#06B6D4",
  text: "#F0F0F0", sub: "#9CA3AF", green: "#4ADE80",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseId(raw: string): Date | null {
  const parts = raw.split("/");
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(raw: string): string {
  const d = parseId(raw);
  if (!d) return raw.slice(0, 8);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// Format a week as "Apr 14–20"
function fmtWeekRange(weekStartStr: string): string {
  const parts = weekStartStr.split(" ");
  if (parts.length !== 2) return weekStartStr;
  const month = MONTHS.indexOf(parts[0]);
  const startDay = parseInt(parts[1]);
  if (isNaN(startDay) || month < 0) return weekStartStr;
  const startDate = new Date(new Date().getFullYear(), month, startDay);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  const endMonth = MONTHS[endDate.getMonth()];
  const endDay = endDate.getDate();
  if (endDate.getMonth() === startDate.getMonth()) {
    return `${parts[0]} ${startDay}–${endDay}`;
  }
  return `${parts[0]} ${startDay}–${endMonth} ${endDay}`;
}

interface WorkoutProgressGraphsProps {
  workouts: any[];
}

export default function WorkoutProgressGraphs({ workouts }: WorkoutProgressGraphsProps) {
  const [timeRange, setTimeRange] = useState<"1m" | "3m" | "6m" | "all">("3m");
  const [activeGraph, setActiveGraph] = useState<"lifting" | "cardio">("lifting");

  // Time range filter
  const now = new Date();
  const cutoff = new Date();
  if (timeRange === "1m") cutoff.setMonth(now.getMonth() - 1);
  else if (timeRange === "3m") cutoff.setMonth(now.getMonth() - 3);
  else if (timeRange === "6m") cutoff.setMonth(now.getMonth() - 6);
  else cutoff.setFullYear(2000);

  const filteredWorkouts = workouts.filter((w: any) => {
    const d = parseId(w.id || w.created_at || "");
    return d ? d >= cutoff : true;
  });

  // Build exercise map
  const exerciseMap = new Map<string, ExerciseStats>();

  filteredWorkouts.forEach((w: any) => {
    const logDate = fmtDate(w.id || w.created_at || "");
    const exList: any[] = w.workout?.exercises || w.exercises || [];

    exList.forEach((ex: any) => {
      if (!ex.name) return;
      if (!exerciseMap.has(ex.name)) {
        exerciseMap.set(ex.name, { name: ex.name, bestWeight: 0, lastWeight: 0, totalVolume: 0, pr: null, history: [], isCardio: false });
      }
      const stats = exerciseMap.get(ex.name)!;
      const weight = parseFloat(String(ex.weight)) || 0;
      const reps = parseInt(String(ex.reps)) || 0;
      const sets = parseInt(String(ex.sets)) || 0;
      const volume = weight * reps * sets;
      stats.history.push({ date: logDate, exercise: ex.name, weight, reps, sets, volume });
      stats.totalVolume += volume;
      if (weight > stats.bestWeight) { stats.bestWeight = weight; stats.pr = { weight, date: logDate }; }
      stats.lastWeight = weight;
    });

    const cardioList: any[] = w.workout?.cardio || w.cardio || [];
    cardioList.forEach((cardio: any) => {
      if (!cardio.type) return;
      const key = cardio.type;
      if (!exerciseMap.has(key)) {
        exerciseMap.set(key, { name: key, bestWeight: 0, lastWeight: 0, totalVolume: 0, pr: null, history: [], isCardio: true });
      }
      const stats = exerciseMap.get(key)!;
      const distance = parseFloat(String(cardio.distance)) || 0;
      const duration = parseInt(String(cardio.duration)) || 0;
      stats.history.push({ date: logDate, exercise: key, weight: distance, reps: duration, sets: 1, volume: distance * duration });
      stats.lastWeight = distance;
      if (distance > stats.bestWeight) { stats.bestWeight = distance; stats.pr = { weight: distance, date: logDate }; }
    });
  });

  const allExercises = Array.from(exerciseMap.values());
  const liftingExercises = allExercises.filter(e => !e.isCardio);
  const cardioExercises = allExercises.filter(e => e.isCardio);

  const totalWorkouts = filteredWorkouts.length;
  const totalVolume = liftingExercises.reduce((s, ex) => s + ex.totalVolume, 0);
  const totalCalories = filteredWorkouts.reduce((s: number, w: any) => s + (w.workout?.calories || 0), 0);

  // Avg per week
  let avgPerWeek = "—";
  if (filteredWorkouts.length >= 1) {
    const oldest = filteredWorkouts[filteredWorkouts.length - 1];
    const oldestDate = parseId(oldest.id || oldest.created_at || "");
    if (oldestDate) {
      const weeks = Math.max(1, (now.getTime() - oldestDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      avgPerWeek = (filteredWorkouts.length / weeks).toFixed(1);
    }
  }

  // ── LIFTING frequency chart — bucketed by week with range labels ──────────
  const liftingWeekBuckets: Record<string, { count: number; startDate: Date }> = {};
  filteredWorkouts.forEach((w: any) => {
    const d = parseId(w.id || w.created_at || "");
    if (!d) return;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay()); // Sunday
    const key = `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`;
    if (!liftingWeekBuckets[key]) liftingWeekBuckets[key] = { count: 0, startDate: weekStart };
    liftingWeekBuckets[key].count++;
  });

  const liftingFreqData = Object.entries(liftingWeekBuckets)
    .sort((a, b) => a[1].startDate.getTime() - b[1].startDate.getTime())
    .slice(-8)
    .map(([week, { count }]) => ({ week: fmtWeekRange(week), workouts: count }));

  // ── CARDIO frequency chart — bucketed by week ────────────────────────────
  const cardioWeekBuckets: Record<string, { count: number; startDate: Date; totalDist: number }> = {};
  filteredWorkouts.forEach((w: any) => {
    const d = parseId(w.id || w.created_at || "");
    if (!d) return;
    const cardioList: any[] = w.workout?.cardio || w.cardio || [];
    if (!cardioList.length) return;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`;
    if (!cardioWeekBuckets[key]) cardioWeekBuckets[key] = { count: 0, startDate: weekStart, totalDist: 0 };
    cardioWeekBuckets[key].count++;
    cardioList.forEach((c: any) => { cardioWeekBuckets[key].totalDist += parseFloat(String(c.distance)) || 0; });
  });

  const cardioFreqData = Object.entries(cardioWeekBuckets)
    .sort((a, b) => a[1].startDate.getTime() - b[1].startDate.getTime())
    .slice(-8)
    .map(([week, { count, totalDist }]) => ({
      week: fmtWeekRange(week),
      sessions: count,
      distance: Math.round(totalDist * 10) / 10,
    }));

  const hasLifting = liftingExercises.length > 0;
  const hasCardio  = cardioExercises.length > 0;

  const tooltipStyle = {
    contentStyle: { background: "#1A1A1A", border: `1px solid ${C.purple}`, borderRadius: 8, fontSize: 12 },
    labelStyle: { color: C.text },
  };

  return (
    <div style={{ padding: "8px 0", color: C.text }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>📊 Workout Progress</div>

      {/* Key stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {(()=>{
          // Get this week's workout types (Mon–Sun)
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          weekStart.setHours(0,0,0,0);
          const thisWeekWorkouts = workouts.filter((w:any) => {
            const d = new Date(w.created_at || w.id || 0);
            return d >= weekStart;
          });
          // Collect workout types logged this week
          const weekTypes = [...new Set(
            thisWeekWorkouts
              .map((w:any) => w.workout?.type || w.workout_type)
              .filter(Boolean)
              .map((t:string) => t.replace(/\s*(Day|day)\s*$/,'').trim())
          )].slice(0, 4);

          return (
            <>
              <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Workouts</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.purple }}>{totalWorkouts}</div>
              </div>
              <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center", gridColumn: "span 1" }}>
                <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>This Week</div>
                {weekTypes.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {weekTypes.map((t:string) => (
                      <div key={t} style={{ fontSize: 11, fontWeight: 700, color: C.gold,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.sub }}>—</div>
                )}
              </div>
              <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Avg/Week</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{avgPerWeek}</div>
              </div>
            </>
          );
        })()}
      </div>

      {totalCalories > 0 && (
        <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: C.sub }}>🔥 Calories Burned</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#FF6B6B" }}>{totalCalories.toLocaleString()} cal</span>
        </div>
      )}

      {/* Time range */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["1m","3m","6m","all"] as const).map(r => (
          <button key={r} onClick={() => { setTimeRange(r); }} style={{
            padding: "6px 12px", fontSize: 12, fontWeight: 700,
            background: timeRange === r ? C.purple : C.purpleDark,
            color: timeRange === r ? "#fff" : C.sub,
            border: `1px solid ${timeRange === r ? C.purple : C.purpleBorder}`,
            borderRadius: 8, cursor: "pointer",
          }}>
            {r === "1m" ? "1 Mo" : r === "3m" ? "3 Mo" : r === "6m" ? "6 Mo" : "All"}
          </button>
        ))}
      </div>

      {/* ── Graph toggle tabs ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, background: C.purpleDark, borderRadius: 12, padding: 4, border: `1px solid ${C.purpleBorder}` }}>
        {[
          { key: "lifting" as const, icon: "💪", label: `Lifting${hasLifting ? ` (${liftingExercises.length})` : ""}` },
          { key: "cardio"  as const, icon: "🏃", label: `Cardio${hasCardio   ? ` (${cardioExercises.length})` : ""}`  },
        ].map(({ key, icon, label }) => (
          <button key={key} onClick={() => { setActiveGraph(key); }} style={{
            flex: 1, padding: "8px 0", border: "none", cursor: "pointer", borderRadius: 9,
            fontWeight: 700, fontSize: 13,
            background: activeGraph === key ? C.purple : "transparent",
            color: activeGraph === key ? "#fff" : C.sub,
            transition: "all 0.15s",
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── LIFTING graph ──────────────────────────────────────────────── */}
      {activeGraph === "lifting" && (<>
        {liftingFreqData.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📅 Sessions per Week</div>
            <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 4px 8px" }}>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={liftingFreqData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.purpleMid} vertical={false} />
                  <XAxis dataKey="week" stroke={C.sub} tick={{ fontSize: 9 }} interval={0} />
                  <YAxis stroke={C.sub} tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} itemStyle={{ color: C.purple }} />
                  <Bar dataKey="workouts" name="Sessions" fill={C.purple} radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "20px 16px", textAlign: "center", color: C.sub, fontSize: 13, marginBottom: 20 }}>
            No lifting sessions logged yet 💪
          </div>
        )}
      </>)}

      {/* ── CARDIO graph ───────────────────────────────────────────────── */}
      {activeGraph === "cardio" && (<>
        {cardioFreqData.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🏃 Cardio Sessions per Week</div>
            <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 4px 8px" }}>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={cardioFreqData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.purpleMid} vertical={false} />
                  <XAxis dataKey="week" stroke={C.sub} tick={{ fontSize: 9 }} interval={0} />
                  <YAxis stroke={C.sub} tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} itemStyle={{ color: C.cyan }} />
                  <Bar dataKey="sessions" name="Sessions" fill={C.cyan} radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Distance line chart */}
            {cardioFreqData.some(d => d.distance > 0) && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: C.sub }}>📏 Distance per Week (miles)</div>
                <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 4px 8px" }}>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={cardioFreqData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.purpleMid} vertical={false} />
                      <XAxis dataKey="week" stroke={C.sub} tick={{ fontSize: 9 }} interval={0} />
                      <YAxis stroke={C.sub} tick={{ fontSize: 10 }} />
                      <Tooltip {...tooltipStyle} itemStyle={{ color: C.green }} />
                      <Line dataKey="distance" name="Distance (mi)" stroke={C.green} strokeWidth={2.5} dot={{ fill: C.green, r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "20px 16px", textAlign: "center", color: C.sub, fontSize: 13, marginBottom: 20 }}>
            No cardio logged yet 🏃
          </div>
        )}
      </>)}

    </div>
  );
}

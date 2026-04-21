"use client";
import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type WorkoutData = {
  date: string;
  exercise: string;
  weight: number;
  reps: number;
  sets: number;
  volume: number;
};

type ExerciseStats = {
  name: string;
  bestWeight: number;
  lastWeight: number;
  totalVolume: number;
  pr: { weight: number; date: string } | null;
  history: WorkoutData[];
};

const C = {
  purple: "#7C3AED",
  purpleDark: "#1E1530",
  purpleMid: "#2D1F52",
  purpleBorder: "#4C3A7A",
  gold: "#F5A623",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  green: "#4ADE80",
};

interface WorkoutProgressGraphsProps {
  workouts: any[];
}

export default function WorkoutProgressGraphs({ workouts }: WorkoutProgressGraphsProps) {
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"1m" | "3m" | "6m" | "all">("3m");

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Parse a day id like "04/20/2026" (MM/DD/YYYY) into a Date
  function parseId(raw: string): Date | null {
    const parts = raw.split("/");
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(raw: string): string {
    const d = parseId(raw);
    if (!d) return raw.slice(0, 8);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }

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

  // Build exercise map from filtered workouts
  const exerciseMap = new Map<string, ExerciseStats>();

  filteredWorkouts.forEach((w: any) => {
    const logDate = formatDate(w.id || w.created_at || "");
    const exList: any[] = w.workout?.exercises || w.exercises || [];

    exList.forEach((ex: any) => {
      if (!ex.name) return;
      if (!exerciseMap.has(ex.name)) {
        exerciseMap.set(ex.name, { name: ex.name, bestWeight: 0, lastWeight: 0, totalVolume: 0, pr: null, history: [] });
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
      const key = `🏃 ${cardio.type}`;
      if (!exerciseMap.has(key)) {
        exerciseMap.set(key, { name: key, bestWeight: 0, lastWeight: 0, totalVolume: 0, pr: null, history: [] });
      }
      const stats = exerciseMap.get(key)!;
      const distance = parseFloat(String(cardio.distance)) || 0;
      const duration = parseInt(String(cardio.duration)) || 0;
      stats.history.push({ date: logDate, exercise: key, weight: distance, reps: duration, sets: 1, volume: distance * duration });
      stats.lastWeight = distance;
      if (distance > stats.bestWeight) { stats.bestWeight = distance; stats.pr = { weight: distance, date: logDate }; }
    });
  });

  const exercises = Array.from(exerciseMap.values());
  const totalWorkouts = filteredWorkouts.length;
  const totalVolume = exercises.reduce((s, ex) => s + ex.totalVolume, 0);
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

  // Frequency chart bucketed by week
  const weekBuckets: Record<string, number> = {};
  filteredWorkouts.forEach((w: any) => {
    const d = parseId(w.id || w.created_at || "");
    if (!d) return;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`;
    weekBuckets[key] = (weekBuckets[key] || 0) + 1;
  });

  const freqData = Object.entries(weekBuckets).slice(-8).map(([week, count]) => ({ week, workouts: count }));

  return (
    <div style={{ padding: "8px 0", color: C.text }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: C.text }}>📊 Workout Progress</div>

      {/* Key Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Workouts", value: String(totalWorkouts), color: C.purple },
          { label: "Total Volume", value: totalVolume > 0 ? `${(totalVolume/1000).toFixed(0)}k lbs` : "—", color: C.gold },
          { label: "Avg/Week", value: avgPerWeek, color: C.green },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: value.length > 5 ? 15 : 20, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {totalCalories > 0 && (
        <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: C.sub }}>🔥 Calories Burned</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#FF6B6B" }}>{totalCalories.toLocaleString()} cal</span>
        </div>
      )}

      {/* Time Range */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["1m", "3m", "6m", "all"] as const).map((range) => (
          <button key={range} onClick={() => setTimeRange(range)} style={{
            padding: "6px 12px", fontSize: 12, fontWeight: 700,
            background: timeRange === range ? C.purple : C.purpleDark,
            color: timeRange === range ? "#fff" : C.sub,
            border: `1px solid ${timeRange === range ? C.purple : C.purpleBorder}`,
            borderRadius: 8, cursor: "pointer",
          }}>
            {range === "1m" ? "1 Mo" : range === "3m" ? "3 Mo" : range === "6m" ? "6 Mo" : "All"}
          </button>
        ))}
      </div>

      {/* Frequency Chart */}
      {freqData.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: C.text }}>📅 Workout Frequency</div>
          <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "12px 4px 8px" }}>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={freqData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.purpleMid} vertical={false} />
                <XAxis dataKey="week" stroke={C.sub} tick={{ fontSize: 10 }} />
                <YAxis stroke={C.sub} tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1A1A1A", border: `1px solid ${C.purple}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.text }} itemStyle={{ color: C.purple }} />
                <Bar dataKey="workouts" fill={C.purple} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Exercise Breakdown */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: C.text }}>💪 Exercises ({exercises.length})</div>

        {exercises.length === 0 && (
          <div style={{ background: C.purpleDark, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: "20px 16px", textAlign: "center", color: C.sub, fontSize: 13 }}>
            Log workouts with exercises to see your progress here 📈
          </div>
        )}

        {exercises.map((ex) => (
          <div key={ex.name} style={{ marginBottom: 10 }}>
            {expandedExercise !== ex.name ? (
              <div onClick={() => setExpandedExercise(ex.name)} style={{
                background: C.purpleDark, border: `1px solid ${C.purpleBorder}`,
                borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>
                    Best: <span style={{ color: C.gold }}>{ex.bestWeight > 0 ? `${ex.bestWeight} lbs` : "—"}</span>
                    {" · "}Last: <span style={{ color: C.purple }}>{ex.lastWeight > 0 ? `${ex.lastWeight} lbs` : "—"}</span>
                    {" · "}{ex.history.length} session{ex.history.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.5" style={{ width: 16, height: 16 }}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            ) : (
              <div style={{ background: C.purpleDark, border: `1px solid ${C.purple}`, borderRadius: 10, padding: "14px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, cursor: "pointer" }} onClick={() => setExpandedExercise(null)}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 3 }}>{ex.name}</div>
                    <div style={{ fontSize: 11, color: C.sub }}>
                      Best: <span style={{ color: C.gold, fontWeight: 700 }}>{ex.bestWeight > 0 ? `${ex.bestWeight} lbs` : "—"}</span>
                      {" · "}Last: <span style={{ color: C.purple, fontWeight: 700 }}>{ex.lastWeight > 0 ? `${ex.lastWeight} lbs` : "—"}</span>
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2.5" style={{ width: 16, height: 16, transform: "rotate(180deg)" }}><path d="M6 9l6 6 6-6"/></svg>
                </div>

                {ex.history.length > 1 ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: C.sub, marginBottom: 6 }}>Weight Progress</div>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={ex.history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.purpleMid} vertical={false} />
                        <XAxis dataKey="date" stroke={C.sub} tick={{ fontSize: 10 }} />
                        <YAxis stroke={C.sub} tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#1A1A1A", border: `1px solid ${C.purple}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.text }} formatter={(val: any) => [`${val} lbs`, "Weight"]} />
                        <Line type="monotone" dataKey="weight" stroke={C.gold} dot={{ fill: C.gold, r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 10, padding: "8px 12px", background: "#0D0D0D", borderRadius: 8 }}>
                    Log this exercise again to see your progress chart 📈
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {[
                    { label: "Sessions", value: String(ex.history.length), color: C.text },
                    { label: "Volume", value: ex.totalVolume > 0 ? `${(ex.totalVolume/1000).toFixed(1)}k` : "—", color: C.gold },
                    { label: "PR", value: ex.pr ? `${ex.pr.weight} lbs` : "—", color: C.gold },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "#0D0D0D", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from "recharts";

type WorkoutData = {
  date: string;
  exercise: string;
  weight: number;
  reps: number;
  sets: number;
  volume: number; // weight * reps * sets
  duration?: number;
  calories?: number;
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
  blue: "#7C3AED", greenLight: "#1A2A1A", greenMid: "#2A3A2A",
  gold: "#F5A623", goldLight: "#FFFBEE",
  text: "#F0F0F0", sub: "#9CA3AF", white: "#1A1A1A", bg: "#0D0D0D",
  purple: "#7C3AED", purpleLight: "#8B5CF6",
};

interface WorkoutProgressGraphsProps {
  workouts: any[]; // Array of workout activity logs
}

export default function WorkoutProgressGraphs({ workouts }: WorkoutProgressGraphsProps) {
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"1m" | "3m" | "6m" | "all">("3m");

  // Parse workout data and aggregate by exercise
  const exerciseMap = new Map<string, ExerciseStats>();
  
  workouts.forEach((w: any) => {
    const logDate = new Date(w.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    (w.exercises || []).forEach((ex: any) => {
      if (!exerciseMap.has(ex.name)) {
        exerciseMap.set(ex.name, {
          name: ex.name,
          bestWeight: 0,
          lastWeight: 0,
          totalVolume: 0,
          pr: null,
          history: [],
        });
      }

      const stats = exerciseMap.get(ex.name)!;
      const weight = parseFloat(ex.weight) || 0;
      const reps = ex.reps || 0;
      const sets = ex.sets || 0;
      const volume = weight * reps * sets;

      stats.history.push({
        date: logDate,
        exercise: ex.name,
        weight,
        reps,
        sets,
        volume,
      });

      stats.totalVolume += volume;
      if (weight > stats.bestWeight) {
        stats.bestWeight = weight;
        stats.pr = { weight, date: logDate };
      }
      stats.lastWeight = weight;
    });

    // Cardio stats
    (w.cardio || []).forEach((cardio: any) => {
      const cardioKey = `${cardio.type} (cardio)`;
      if (!exerciseMap.has(cardioKey)) {
        exerciseMap.set(cardioKey, {
          name: cardioKey,
          bestWeight: 0,
          lastWeight: 0,
          totalVolume: 0,
          pr: null,
          history: [],
        });
      }

      const stats = exerciseMap.get(cardioKey)!;
      const distance = parseFloat(cardio.distance) || 0;
      const duration = cardio.duration ? parseInt(cardio.duration.split(" ")[0]) : 0;

      stats.history.push({
        date: logDate,
        exercise: cardioKey,
        weight: distance,
        reps: duration,
        sets: 1,
        volume: distance * duration,
      });

      stats.lastWeight = distance;
      if (distance > stats.bestWeight) {
        stats.bestWeight = distance;
        stats.pr = { weight: distance, date: logDate };
      }
    });
  });

  const exercises = Array.from(exerciseMap.values());

  // Filter by time range
  const filterByRange = (history: WorkoutData[]) => {
    const now = new Date();
    let cutoff = new Date();
    if (timeRange === "1m") cutoff.setMonth(now.getMonth() - 1);
    else if (timeRange === "3m") cutoff.setMonth(now.getMonth() - 3);
    else if (timeRange === "6m") cutoff.setMonth(now.getMonth() - 6);
    else cutoff = new Date("2020-01-01"); // all

    return history; // Simplified — in production, compare dates properly
  };

  // Overall stats
  const totalWorkouts = workouts.length;
  const totalVolume = exercises.reduce((sum, ex) => sum + ex.totalVolume, 0);
  const avgWeeklyWorkouts = (totalWorkouts / ((new Date().getTime() - new Date(workouts[workouts.length - 1]?.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000))).toFixed(1);

  return (
    <div style={{ padding: "16px 0", color: C.text }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: C.gold }}>📊 Workout Progress</div>
        
        {/* Key Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          <div style={{ background: C.greenLight, border: `1px solid ${C.greenMid}`, borderRadius: 8, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Total Workouts</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.blue }}>{totalWorkouts}</div>
          </div>
          <div style={{ background: C.greenLight, border: `1px solid ${C.greenMid}`, borderRadius: 8, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Total Volume</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>{(totalVolume / 1000).toFixed(0)}k lbs</div>
          </div>
          <div style={{ background: C.greenLight, border: `1px solid ${C.greenMid}`, borderRadius: 8, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Avg/Week</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.purple }}>{avgWeeklyWorkouts}</div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
          {(["1m", "3m", "6m", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                background: timeRange === range ? C.purple : C.greenLight,
                color: timeRange === range ? "#fff" : C.sub,
                border: `1px solid ${timeRange === range ? C.purple : C.greenMid}`,
                borderRadius: 6,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {range === "1m" ? "1 Month" : range === "3m" ? "3 Months" : range === "6m" ? "6 Months" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise Breakdown */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: C.text }}>💪 Exercises ({exercises.length})</div>
        
        {exercises.map((ex) => (
          <div key={ex.name} style={{ marginBottom: 12 }}>
            {/* Collapsed */}
            {!expandedExercise?.includes(ex.name) && (
              <div
                onClick={() => setExpandedExercise(ex.name)}
                style={{
                  background: C.greenLight,
                  border: `1px solid ${C.greenMid}`,
                  borderRadius: 10,
                  padding: 12,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>
                    Best: {ex.bestWeight} lbs | Last: {ex.lastWeight} lbs
                  </div>
                </div>
                <div style={{ fontSize: 20 }}>▼</div>
              </div>
            )}

            {/* Expanded */}
            {expandedExercise?.includes(ex.name) && (
              <div
                onClick={() => setExpandedExercise(null)}
                style={{
                  background: C.greenLight,
                  border: `1px solid ${C.gold}`,
                  borderRadius: 10,
                  padding: 12,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{ex.name}</div>
                    <div style={{ fontSize: 11, color: C.sub }}>
                      Best: <span style={{ color: C.gold, fontWeight: 700 }}>{ex.bestWeight} lbs</span> | Last: <span style={{ color: C.blue, fontWeight: 700 }}>{ex.lastWeight} lbs</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 20 }}>▲</div>
                </div>

                {/* Mini Chart */}
                {ex.history.length > 0 && (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={ex.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.greenMid} />
                      <XAxis dataKey="date" stroke={C.sub} style={{ fontSize: 10 }} />
                      <YAxis stroke={C.sub} style={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: C.white, border: `1px solid ${C.goldLight}`, borderRadius: 6 }}
                        labelStyle={{ color: C.text }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke={C.gold}
                        dot={{ fill: C.gold, r: 3 }}
                        activeDot={{ r: 5 }}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}

                {/* Stats */}
                <div style={{ marginTop: 12, fontSize: 11, color: C.sub }}>
                  <div>Total Volume: <span style={{ color: C.text, fontWeight: 600 }}>{(ex.totalVolume / 1000).toFixed(1)}k lbs</span></div>
                  {ex.pr && <div>PR: <span style={{ color: C.gold, fontWeight: 600 }}>{ex.pr.weight} lbs</span> on {ex.pr.date}</div>}
                  <div>Sessions: <span style={{ color: C.text, fontWeight: 600 }}>{ex.history.length}</span></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Workout Frequency Chart */}
      {workouts.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: C.text }}>📅 Workout Frequency</div>
          
          {/* Simple week view */}
          <div style={{ background: C.greenLight, border: `1px solid ${C.greenMid}`, borderRadius: 10, padding: 12 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workouts.slice(-7).map((w, i) => ({
                day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i % 7],
                workouts: 1,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.greenMid} />
                <XAxis dataKey="day" stroke={C.sub} style={{ fontSize: 10 }} />
                <YAxis stroke={C.sub} style={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.goldLight}`, borderRadius: 6 }} />
                <Bar dataKey="workouts" fill={C.purple} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}



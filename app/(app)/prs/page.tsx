"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const C = {
  purple: "#7C3AED",
  gold: "#F5A623",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  bg: "#0D0D0D",
  card: "#111111",
  border: "#1A1228",
};

type PR = {
  id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  volume: number;
  logged_at: string;
};

type GroupedPR = {
  exercise: string;
  best: PR;
  history: PR[];
  muscle?: string;
};

const MUSCLE_GROUPS: Record<string, string> = {
  "bench press": "Chest",
  "incline": "Chest",
  "cable fly": "Chest",
  "chest": "Chest",
  "squat": "Legs",
  "leg press": "Legs",
  "rdl": "Legs",
  "deadlift": "Back",
  "row": "Back",
  "lat pulldown": "Back",
  "pull": "Back",
  "overhead press": "Shoulders",
  "lateral raise": "Shoulders",
  "shoulder": "Shoulders",
  "curl": "Arms",
  "tricep": "Arms",
  "extension": "Arms",
  "dip": "Arms",
  "run": "Cardio",
  "plank": "Core",
  "crunch": "Core",
};

function guessMuscle(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, group] of Object.entries(MUSCLE_GROUPS)) {
    if (lower.includes(key)) return group;
  }
  return "Other";
}

const MUSCLE_COLORS: Record<string, string> = {
  Chest: "#EF4444",
  Legs: "#3B82F6",
  Back: "#10B981",
  Shoulders: "#8B5CF6",
  Arms: "#F59E0B",
  Core: "#EC4899",
  Cardio: "#06B6D4",
  Other: "#6B7280",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function VolumeBar({ volume, max }: { volume: number; max: number }) {
  const pct = max > 0 ? Math.round((volume / max) * 100) : 0;
  return (
    <div style={{ background: "#1A1228", borderRadius: 4, height: 6, overflow: "hidden", marginTop: 6 }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 4,
        background: "linear-gradient(90deg, #7C3AED, #A78BFA)",
        transition: "width 0.5s ease",
      }} />
    </div>
  );
}

export default function PRsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [prs, setPRs] = useState<GroupedPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMuscle, setSelectedMuscle] = useState<string>("All");
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"volume" | "date" | "alpha">("volume");

  const fetchPRs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("personal_records")
        .select("*")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false });

      if (!data) { setLoading(false); return; }

      // Group by exercise name, keep all history
      const grouped: Record<string, PR[]> = {};
      for (const pr of data) {
        if (!grouped[pr.exercise_name]) grouped[pr.exercise_name] = [];
        grouped[pr.exercise_name].push(pr);
      }

      // Build GroupedPR array — best = highest volume
      const result: GroupedPR[] = Object.entries(grouped).map(([exercise, history]) => {
        const sorted = [...history].sort((a, b) => b.volume - a.volume);
        return {
          exercise,
          best: sorted[0],
          history: sorted,
          muscle: guessMuscle(exercise),
        };
      });

      setPRs(result);
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);

  // Filter + sort
  const muscles = ["All", ...Array.from(new Set(prs.map(p => p.muscle || "Other")))].sort();
  const filtered = prs
    .filter(p => selectedMuscle === "All" || p.muscle === selectedMuscle)
    .sort((a, b) => {
      if (sortBy === "volume") return b.best.volume - a.best.volume;
      if (sortBy === "date") return new Date(b.best.logged_at).getTime() - new Date(a.best.logged_at).getTime();
      return a.exercise.localeCompare(b.exercise);
    });

  const maxVolume = Math.max(...filtered.map(p => p.best.volume), 1);

  // Stats summary
  const totalPRs = prs.length;
  const totalLifts = prs.reduce((s, p) => s + p.history.length, 0);
  const heaviestPR = prs.reduce<GroupedPR | null>((best, p) =>
    !best || p.best.weight > best.best.weight ? p : best, null);
  const recentPR = prs.reduce<GroupedPR | null>((recent, p) =>
    !recent || p.best.logged_at > recent.best.logged_at ? p : recent, null);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: "20px 20px 0",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "none", border: "none", color: C.sub, fontSize: 22, cursor: "pointer", padding: 0 }}
          >←</button>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: 0 }}>🏆 PR Hall of Fame</h1>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
              {totalPRs} exercises · {totalLifts} PRs logged
            </div>
          </div>
        </div>

        {/* Sort bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["volume", "date", "alpha"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              style={{
                padding: "6px 14px", borderRadius: 20,
                border: `1.5px solid ${sortBy === s ? C.purple : "#2A2A2A"}`,
                background: sortBy === s ? "rgba(124,58,237,0.15)" : "transparent",
                color: sortBy === s ? "#A78BFA" : C.sub,
                fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}
            >
              {s === "volume" ? "Top Volume" : s === "date" ? "Recent" : "A–Z"}
            </button>
          ))}
        </div>

        {/* Muscle filter chips */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14, marginRight: -20, paddingRight: 20 }}>
          {muscles.map(m => {
            const color = MUSCLE_COLORS[m] || "#6B7280";
            const active = selectedMuscle === m;
            return (
              <button
                key={m}
                onClick={() => setSelectedMuscle(m)}
                style={{
                  flexShrink: 0,
                  padding: "6px 14px", borderRadius: 20,
                  border: `1.5px solid ${active ? color : "#2A2A2A"}`,
                  background: active ? `${color}22` : "transparent",
                  color: active ? color : C.sub,
                  fontWeight: 700, fontSize: 12, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Summary stats */}
        {prs.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
            {heaviestPR && (
              <div style={{ background: C.card, borderRadius: 16, padding: "14px 16px", border: `1.5px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Heaviest Lift</div>
                <div style={{ fontWeight: 900, fontSize: 18, color: C.gold }}>{heaviestPR.best.weight} lbs</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{heaviestPR.exercise}</div>
              </div>
            )}
            {recentPR && (
              <div style={{ background: C.card, borderRadius: 16, padding: "14px 16px", border: `1.5px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Latest PR</div>
                <div style={{ fontWeight: 900, fontSize: 18, color: "#A78BFA" }}>{recentPR.exercise}</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{formatDate(recentPR.best.logged_at)}</div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.sub, fontSize: 15 }}>
            Loading your PRs...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: C.card, borderRadius: 20, border: `1.5px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏋️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 6 }}>
              No PRs yet
            </div>
            <div style={{ fontSize: 14, color: C.sub, marginBottom: 20 }}>
              {prs.length === 0
                ? "Log your first workout to start tracking PRs automatically."
                : `No PRs in ${selectedMuscle}. Try another muscle group.`
              }
            </div>
            {prs.length === 0 && (
              <button
                onClick={() => router.push("/post")}
                style={{
                  padding: "12px 24px", borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
                  color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer",
                }}
              >
                Log a Workout →
              </button>
            )}
          </div>
        ) : (
          filtered.map((pr, idx) => {
            const muscle = pr.muscle || "Other";
            const color = MUSCLE_COLORS[muscle] || "#6B7280";
            const isExpanded = expandedExercise === pr.exercise;
            const rank = idx + 1;

            return (
              <div
                key={pr.exercise}
                style={{
                  background: C.card, borderRadius: 20,
                  border: `1.5px solid ${rank <= 3 ? color + "44" : C.border}`,
                  overflow: "hidden",
                }}
              >
                {/* Main row */}
                <button
                  onClick={() => setExpandedExercise(isExpanded ? null : pr.exercise)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "16px 16px",
                    background: "transparent", border: "none",
                    cursor: "pointer", width: "100%", textAlign: "left",
                  }}
                >
                  {/* Rank / trophy */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: rank === 1 ? "linear-gradient(135deg, #F5A623, #FBBF24)"
                      : rank === 2 ? "linear-gradient(135deg, #9CA3AF, #D1D5DB)"
                      : rank === 3 ? "linear-gradient(135deg, #D97706, #F59E0B)"
                      : `${color}22`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: rank <= 3 ? 16 : 13,
                    fontWeight: 900, color: rank <= 3 ? "#fff" : color,
                  }}>
                    {rank <= 3 ? (rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉") : `#${rank}`}
                  </div>

                  {/* Exercise info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {pr.exercise}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 3, alignItems: "center" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color, padding: "2px 7px",
                        background: `${color}22`, borderRadius: 6,
                      }}>{muscle}</span>
                      <span style={{ fontSize: 11, color: C.sub }}>{formatDate(pr.best.logged_at)}</span>
                    </div>
                    <VolumeBar volume={pr.best.volume} max={maxVolume} />
                  </div>

                  {/* Best stats */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 18, color: C.gold }}>
                      {pr.best.weight} lbs
                    </div>
                    <div style={{ fontSize: 12, color: C.sub }}>
                      × {pr.best.reps} reps
                    </div>
                    <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, marginTop: 1 }}>
                      {Math.round(pr.best.volume).toLocaleString()} vol
                    </div>
                  </div>

                  <div style={{ fontSize: 16, color: C.sub, flexShrink: 0 }}>
                    {isExpanded ? "▲" : "▼"}
                  </div>
                </button>

                {/* Expanded history */}
                {isExpanded && pr.history.length > 1 && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                      PR History ({pr.history.length} records)
                    </div>
                    {pr.history.map((h, i) => (
                      <div
                        key={h.id}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 0",
                          borderBottom: i < pr.history.length - 1 ? `1px solid ${C.border}` : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {i === 0 && (
                            <span style={{ fontSize: 14 }}>🏆</span>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: i === 0 ? C.gold : C.text }}>
                              {h.weight} lbs × {h.reps} reps
                            </div>
                            <div style={{ fontSize: 11, color: C.sub }}>{formatDate(h.logged_at)}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? C.purple : C.sub }}>
                          {Math.round(h.volume).toLocaleString()} vol
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Single PR message */}
                {isExpanded && pr.history.length === 1 && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px" }}>
                    <div style={{ fontSize: 13, color: C.sub }}>
                      First PR set on {formatDate(pr.best.logged_at)}. Keep logging to track your progress!
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

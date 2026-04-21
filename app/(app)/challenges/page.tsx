"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const C = {
  purple: "#7C3AED",
  purpleDark: "#1E1530",
  purpleMid: "#2D1F52",
  purpleBorder: "#4C3A7A",
  gold: "#F5A623",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  white: "#1A1A1A",
  bg: "#0D0D0D",
  green: "#4ADE80",
};

export default function OpenChallengesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all">("active");

  useEffect(() => {
    loadChallenges();
  }, [filter]);

  async function loadChallenges() {
    setLoading(true);
    try {
      let query = supabase
        .from("challenges")
        .select("*, groups(id, name, emoji)")
        .order("created_at", { ascending: false });

      if (filter === "active") {
        query = query.eq("is_active", true);
      }

      const { data } = await query;
      setChallenges(data || []);
    } catch (e) {
      console.error("Failed to load challenges:", e);
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: "24px", background: C.bg, minHeight: "100vh", paddingBottom: 120 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: C.text, marginBottom: 8 }}>
            🏆 Open Challenges
          </h1>
          <p style={{ fontSize: 14, color: C.sub, marginBottom: 20 }}>
            Join group challenges, compete with your community, and earn badges
          </p>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "Active", value: "active" as const },
              { label: "All", value: "all" as const },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: filter === f.value ? C.purple : C.purpleMid,
                  color: filter === f.value ? "#fff" : C.sub,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: `4px solid ${C.purpleMid}`,
                borderTopColor: C.purple,
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 14, color: C.sub }}>Loading challenges...</div>
          </div>
        ) : challenges.length === 0 ? (
          <div
            style={{
              background: C.white,
              borderRadius: 20,
              padding: 48,
              textAlign: "center",
              border: `2px solid ${C.purpleMid}`,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
              No challenges yet
            </div>
            <p style={{ fontSize: 13, color: C.sub }}>
              Groups will create challenges soon. Check back later!
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
            {challenges.map((ch) => {
              const group = ch.groups;
              const isEnded = ch.deadline && new Date(ch.deadline) < new Date();
              return (
                <div
                  key={ch.id}
                  onClick={() => router.push(`/groups/${group?.id}`)}
                  style={{
                    background: C.white,
                    borderRadius: 20,
                    padding: 20,
                    border: `2px solid ${ch.is_active ? C.purple : C.purpleMid}`,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: ch.is_active ? `0 0 16px rgba(124,58,237,0.2)` : "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px rgba(124,58,237,0.3)`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = ch.is_active
                      ? `0 0 16px rgba(124,58,237,0.2)`
                      : "none";
                  }}
                >
                  {/* Group tag */}
                  {group && (
                    <div
                      style={{
                        display: "inline-block",
                        background: `${C.purple}20`,
                        color: C.purple,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 12px",
                        borderRadius: 20,
                        marginBottom: 12,
                        border: `1px solid ${C.purple}40`,
                      }}
                    >
                      {group.emoji} {group.name}
                    </div>
                  )}

                  {/* Challenge header */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 32, lineHeight: 1 }}>{ch.emoji || "🏆"}</span>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 4 }}>
                        {ch.name}
                      </h3>
                      <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
                        {ch.description}
                      </p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    {[
                      {
                        label: "Participants",
                        value: ch.participants_count || 0,
                        icon: "👥",
                      },
                      {
                        label: "Prize",
                        value: ch.prize || "Badge",
                        icon: "🎁",
                      },
                      {
                        label: "Ends",
                        value: ch.deadline
                          ? new Date(ch.deadline).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "—",
                        icon: "📅",
                      },
                      {
                        label: "Status",
                        value: isEnded ? "Ended" : ch.is_active ? "Active" : "Upcoming",
                        icon: ch.is_active ? "🔥" : "⏳",
                      },
                    ].map((stat, i) => (
                      <div
                        key={i}
                        style={{
                          background: C.bg,
                          borderRadius: 12,
                          padding: 10,
                          border: `1px solid ${C.purpleMid}`,
                        }}
                      >
                        <div style={{ fontSize: 11, color: C.sub, marginBottom: 3 }}>
                          {stat.icon} {stat.label}
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: stat.label === "Status" && ch.is_active ? C.gold : C.text,
                          }}
                        >
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar (if active) */}
                  {ch.is_active && (
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          color: C.sub,
                          marginBottom: 6,
                        }}
                      >
                        <span>Team Progress</span>
                        <span>{Math.round(ch.progress_percent || 0)}%</span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: C.purpleMid,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            background: C.gold,
                            width: `${ch.progress_percent || 0}%`,
                            transition: "width 0.4s",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* CTA button */}
                  <button
                    style={{
                      width: "100%",
                      padding: "12px 0",
                      borderRadius: 14,
                      border: "none",
                      background: ch.is_active ? C.purple : C.purpleMid,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (ch.is_active) {
                        (e.currentTarget as HTMLButtonElement).style.background = "#A78BFA";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = ch.is_active
                        ? C.purple
                        : C.purpleMid;
                    }}
                  >
                    {isEnded ? "View Results" : "View Details →"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

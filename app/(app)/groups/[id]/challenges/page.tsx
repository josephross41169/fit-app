"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const C = {
  purple: "#7C3AED",
  purpleDark: "#1E1530",
  purpleMid: "#2D1F52",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  white: "#1A1A1A",
  bg: "#0D0D0D",
  gold: "#F5A623",
};

export default function ChallengesPage() {
  const params = useParams();
  const groupId = params.id as string;
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    loadChallenges();
  }, [groupId]);

  async function loadChallenges() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("challenges")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      setChallenges(data || []);
    } catch (e) {
      console.error("Failed to load challenges:", e);
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: "24px", background: C.bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: C.text, marginBottom: 8 }}>
            🏆 Challenges
          </h1>
          <p style={{ fontSize: 14, color: C.sub }}>
            Group challenges to earn badges and compete together
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 14, color: C.sub }}>Loading challenges...</div>
          </div>
        ) : challenges.length === 0 ? (
          <div
            style={{
              background: C.white,
              borderRadius: 16,
              padding: 40,
              textAlign: "center",
              border: `1px solid ${C.purpleMid}`,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>🏆</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>
              No active challenges
            </div>
            <p style={{ fontSize: 13, color: C.sub }}>
              Challenges will appear here when your group creates them
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {challenges.map((ch) => (
              <div
                key={ch.id}
                style={{
                  background: C.white,
                  borderRadius: 16,
                  padding: 20,
                  border: `1px solid ${C.purpleMid}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>{ch.emoji || "🏆"}</span>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 900, color: C.text }}>
                      {ch.name}
                    </h2>
                    <p style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                      {ch.description}
                    </p>
                  </div>
                </div>

                {/* Challenge details */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  {[
                    { label: "Ends", value: ch.deadline ? new Date(ch.deadline).toLocaleDateString() : "—" },
                    { label: "Participants", value: ch.participants_count || 0 },
                    { label: "Prize", value: ch.prize || "Badge" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      style={{
                        background: C.bg,
                        borderRadius: 12,
                        padding: 12,
                        textAlign: "center",
                        border: `1px solid ${C.purpleMid}`,
                      }}
                    >
                      <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>
                        {stat.label}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.purple }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                {ch.is_active && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>
                      Team Progress
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 4,
                        background: C.purpleMid,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          background: C.gold,
                          width: "60%",
                        }}
                      />
                    </div>
                  </div>
                )}

                <button
                  style={{
                    width: "100%",
                    padding: "12px 0",
                    borderRadius: 12,
                    border: "none",
                    background: C.purple,
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {ch.is_active ? "View Details" : "View Results"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

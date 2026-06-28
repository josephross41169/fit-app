"use client";
import { useState } from "react";

export interface Rival {
  name: string;
  username: string;
  tier: string;
  workoutsThisWeek: number;
  myWorkoutsThisWeek: number;
  loggedToday: boolean;
  myLoggedToday: boolean;
  record: { wins: number; losses: number };
  streak: number;
}

const TIER_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  grinder:  { label: "Grinder",   color: "#5BBE93", emoji: "⚙️" },
  beast:    { label: "Beast",     color: "#EF4444", emoji: "🔥" },
  warrior:  { label: "Warrior",   color: "#F5A623", emoji: "⚔️" },
  legend:   { label: "Legend",    color: "#FFD700", emoji: "👑" },
  rookie:   { label: "Rookie",    color: "#5BBE93", emoji: "🌱" },
};

function getTier(tier: string) {
  return TIER_CONFIG[tier.toLowerCase()] ?? { label: tier, color: "#5BBE93", emoji: "⚔️" };
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

interface RivalCardProps {
  rival: Rival;
  /** Optional CSS class name */
  className?: string;
}

export default function RivalCard({ rival, className }: RivalCardProps) {
  const [challenged, setChallenged] = useState(false);

  const tierInfo = getTier(rival.tier);
  const imWinning = rival.myWorkoutsThisWeek > rival.workoutsThisWeek;
  const tied      = rival.myWorkoutsThisWeek === rival.workoutsThisWeek;
  const theyTaunt = rival.loggedToday && !rival.myLoggedToday;

  // Head-to-head bar percentages
  const total = rival.workoutsThisWeek + rival.myWorkoutsThisWeek || 1;
  const myPct  = Math.round((rival.myWorkoutsThisWeek / total) * 100);
  const theirPct = 100 - myPct;

  // Win-rate
  const totalMatches = rival.record.wins + rival.record.losses || 1;
  const winRate = Math.round((rival.record.wins / totalMatches) * 100);

  return (
    <>
      {/* Keyframe injection */}
      <style>{`
        @keyframes rivalGlowWinning {
          0%   { box-shadow: 0 0 16px 3px #5BBE9366, 0 0 32px 6px #5BBE9333; }
          50%  { box-shadow: 0 0 28px 8px #5BBE9399, 0 0 56px 16px #5BBE9344; }
          100% { box-shadow: 0 0 16px 3px #5BBE9366, 0 0 32px 6px #5BBE9333; }
        }
        @keyframes rivalGlowLosing {
          0%   { box-shadow: 0 0 16px 3px #EF444466, 0 0 32px 6px #EF444433; }
          50%  { box-shadow: 0 0 28px 8px #EF444499, 0 0 56px 16px #EF444444; }
          100% { box-shadow: 0 0 16px 3px #EF444466, 0 0 32px 6px #EF444433; }
        }
        @keyframes rivalGlowTied {
          0%   { box-shadow: 0 0 16px 3px #5BBE9366, 0 0 32px 6px #5BBE9333; }
          50%  { box-shadow: 0 0 28px 8px #5BBE9399, 0 0 56px 16px #5BBE9344; }
          100% { box-shadow: 0 0 16px 3px #5BBE9366, 0 0 32px 6px #5BBE9333; }
        }
        @keyframes rivalPulse {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        @keyframes tauntSlideIn {
          0%   { opacity: 0; transform: translateY(-6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className={className}
        style={{
          background: "#161D19",
          borderRadius: 20,
          border: `2px solid ${imWinning ? "#5BBE93" : tied ? "#5BBE93" : "#EF4444"}`,
          padding: "20px",
          position: "relative",
          overflow: "hidden",
          animation: imWinning
            ? "rivalGlowWinning 2.4s ease-in-out infinite"
            : tied
            ? "rivalGlowTied 2.4s ease-in-out infinite"
            : "rivalGlowLosing 2.4s ease-in-out infinite",
        }}
      >
        {/* Background accent */}
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: imWinning ? "#5BBE9308" : tied ? "#5BBE9308" : "#EF444408",
          pointerEvents: "none",
        }} />

        {/* ── Header row ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          {/* Avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: `linear-gradient(135deg, ${tierInfo.color}, ${tierInfo.color}99)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, color: "#fff", flexShrink: 0,
            border: `2px solid ${tierInfo.color}66`,
          }}>
            {getInitials(rival.name)}
          </div>

          {/* Name + tier */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#F0F0F0" }}>{rival.name}</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>@{rival.username}</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: `${tierInfo.color}22`,
              border: `1px solid ${tierInfo.color}55`,
              borderRadius: 99, padding: "2px 10px", marginTop: 5,
            }}>
              <span style={{ fontSize: 11 }}>{tierInfo.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: tierInfo.color }}>{tierInfo.label}</span>
            </div>
          </div>

          {/* Streak badge */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            background: "#1E3D34", borderRadius: 12, padding: "8px 12px",
            border: "1px solid #5BBE9344",
          }}>
            <span style={{ fontSize: 16 }}>🔥</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: "#5BBE93" }}>{rival.streak}</span>
            <span style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700 }}>STREAK</span>
          </div>
        </div>

        {/* ── Taunt / Status banner ── */}
        {theyTaunt && (
          <div style={{
            background: "linear-gradient(135deg, #3B1219, #1A0A0A)",
            border: "1px solid #EF444455",
            borderRadius: 12, padding: "10px 14px", marginBottom: 14,
            animation: "tauntSlideIn 0.35s ease-out",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>😤</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#EF4444" }}>
                They worked out today. Have you?
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                {rival.name} already logged today — don't fall behind.
              </div>
            </div>
          </div>
        )}

        {imWinning && !theyTaunt && (
          <div style={{
            background: "linear-gradient(135deg, #1E3D34, #3D2B7A)",
            border: "1px solid #5BBE9355",
            borderRadius: 12, padding: "10px 14px", marginBottom: 14,
            animation: "tauntSlideIn 0.35s ease-out",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20, animation: "rivalPulse 1.8s ease-in-out infinite" }}>💪</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#5BBE93" }}>
                You're ahead this week 💪
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                Keep the pressure on — don't let up now.
              </div>
            </div>
          </div>
        )}

        {tied && !theyTaunt && (
          <div style={{
            background: "linear-gradient(135deg, #1A1230, #0D0D1A)",
            border: "1px solid #5BBE9355",
            borderRadius: 12, padding: "10px 14px", marginBottom: 14,
            animation: "tauntSlideIn 0.35s ease-out",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>⚖️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#5BBE93" }}>
                Dead even — someone has to blink first
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                This week is anyone's game. Go log something.
              </div>
            </div>
          </div>
        )}

        {/* ── This Week: workout bars ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            This Week
          </div>

          {/* Me row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#5BBE93,#9D5CF0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff", flexShrink: 0 }}>
              ME
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#F0F0F0" }}>You</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: imWinning ? "#5BBE93" : "#F0F0F0" }}>
                  {rival.myWorkoutsThisWeek} workouts
                </span>
              </div>
              <div style={{ height: 7, background: "#1E3D34", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${myPct}%`,
                  background: imWinning ? "#5BBE93" : "#5BBE93",
                  borderRadius: 99, transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          </div>

          {/* Rival row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: `linear-gradient(135deg, ${tierInfo.color}, ${tierInfo.color}99)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 900, color: "#fff", flexShrink: 0,
            }}>
              {getInitials(rival.name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#F0F0F0" }}>{rival.name.split(" ")[0]}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: !imWinning && !tied ? "#EF4444" : "#F0F0F0" }}>
                  {rival.workoutsThisWeek} workouts
                </span>
              </div>
              <div style={{ height: 7, background: "#1A0A0A", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${theirPct}%`,
                  background: !imWinning && !tied ? "#EF4444" : "#9CA3AF",
                  borderRadius: 99, transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Win/Loss Record ── */}
        <div style={{
          display: "flex", gap: 10, marginBottom: 16,
        }}>
          <div style={{
            flex: 1, background: "#0A1F14", border: "1px solid #5BBE9333",
            borderRadius: 12, padding: "10px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#5BBE93" }}>{rival.record.wins}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>WINS</div>
          </div>
          <div style={{
            flex: 1, background: "#0E1311", border: "1px solid #1E3D34",
            borderRadius: 12, padding: "10px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#F0F0F0" }}>{winRate}%</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>WIN RATE</div>
          </div>
          <div style={{
            flex: 1, background: "#1A0A0A", border: "1px solid #EF444433",
            borderRadius: 12, padding: "10px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#EF4444" }}>{rival.record.losses}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>LOSSES</div>
          </div>
        </div>

        {/* ── Today status dots ── */}
        <div style={{
          display: "flex", gap: 8, marginBottom: 16,
          background: "#0E1311", borderRadius: 12, padding: "10px 14px",
          border: "1px solid #1E3D34",
        }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: rival.myLoggedToday ? "#5BBE93" : "#EF4444",
              boxShadow: rival.myLoggedToday ? "0 0 8px #5BBE93" : "0 0 8px #EF4444",
            }} />
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>
              You — <strong style={{ color: rival.myLoggedToday ? "#5BBE93" : "#EF4444" }}>
                {rival.myLoggedToday ? "Logged today ✓" : "Not yet"}
              </strong>
            </span>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: rival.loggedToday ? "#EF4444" : "#5BBE93",
              boxShadow: rival.loggedToday ? "0 0 8px #EF4444" : "0 0 8px #5BBE93",
            }} />
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>
              Them — <strong style={{ color: rival.loggedToday ? "#EF4444" : "#5BBE93" }}>
                {rival.loggedToday ? "Logged today" : "Not yet"}
              </strong>
            </span>
          </div>
        </div>

        {/* ── CTA ── */}
        <button
          onClick={() => setChallenged(true)}
          style={{
            width: "100%", padding: "12px",
            borderRadius: 13, border: "none",
            background: challenged
              ? "rgba(124,58,237,0.15)"
              : "linear-gradient(135deg, #5BBE93, #9D5CF0)",
            color: challenged ? "#5BBE93" : "#fff",
            fontWeight: 800, fontSize: 14, cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: challenged ? "none" : "0 4px 18px #5BBE9355",
          }}
        >
          {challenged ? "⚔️ Challenge Sent — Game On!" : "⚔️ Send a Challenge"}
        </button>
      </div>
    </>
  );
}


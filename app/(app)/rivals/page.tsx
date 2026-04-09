"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const ME = {
  name: "Joey Ross",
  username: "joey",
  tier: "grinder",
  workoutsThisWeek: 3,
  loggedToday: false,
  streak: 8,
  record: { wins: 3, losses: 2 },
};

const RIVAL = {
  name: "Marcus Webb",
  username: "marcuswebb",
  tier: "grinder",
  workoutsThisWeek: 4,
  loggedToday: true,
  streak: 12,
  record: { wins: 2, losses: 3 },
};

const POTENTIAL_RIVALS = [
  { name: "Marcus Webb", tier: "grinder", workoutsPerWeek: 4, streak: 12, winRate: 68, match: 94 },
  { name: "Dani Torres", tier: "active", workoutsPerWeek: 3, streak: 5, winRate: 55, match: 87 },
  { name: "Ray Kim", tier: "grinder", workoutsPerWeek: 3, streak: 9, winRate: 61, match: 82 },
];

const MOCK_CHAT = [
  { id: "1", from: "rival", text: "Bro I'm already up 4-3 on the week. You slipping? 😂", time: "Today 9:14 AM" },
  { id: "2", from: "me", text: "Relax, I've got 3 days left. Watch this.", time: "Today 9:22 AM" },
  { id: "3", from: "rival", text: "12 day streak btw. Just saying 👀🔥", time: "Today 9:45 AM" },
  { id: "4", from: "me", text: "Enjoy it while it lasts. Season's not over.", time: "Today 10:01 AM" },
  { id: "5", from: "rival", text: "You logged yet today? Didn't think so 😤", time: "Today 11:30 AM" },
];

const MOCK_NOTIFICATIONS = [
  { id: "1", icon: "💪", text: "Marcus logged Leg Day — 14,800 lbs volume", time: "2h ago", type: "warning" },
  { id: "2", icon: "🏆", text: "Marcus hit a PR on Squat — 315 lbs", time: "5h ago", type: "danger" },
  { id: "3", icon: "⚠️", text: "You're down 3-1 this week. 1 day left.", time: "Yesterday", type: "danger" },
  { id: "4", icon: "🔥", text: "Marcus is on a 12-day streak", time: "Yesterday", type: "danger" },
  { id: "5", icon: "😴", text: "Marcus hasn't logged in 2 days — you're pulling ahead", time: "2 days ago", type: "success" },
];

// ─────────────────────────────────────────────────────────────────────────────
// BADGE CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const BADGES = [
  {
    id: "first_blood",
    emoji: "⚔️",
    name: "First Blood",
    desc: "Challenged your first rival",
    earned: true,
    gradient: "linear-gradient(135deg, #9CA3AF, #E5E7EB)",
    border: "#9CA3AF",
    glow: "#9CA3AF44",
    label: "SILVER",
  },
  {
    id: "on_notice",
    emoji: "🔥",
    name: "On Notice",
    desc: "Won your first week",
    earned: true,
    gradient: "linear-gradient(135deg, #F5A623, #F59E0B)",
    border: "#F5A623",
    glow: "#F5A62344",
    label: "GOLD",
  },
  {
    id: "back_to_back",
    emoji: "💥",
    name: "Back to Back",
    desc: "Won 2 weeks in a row",
    earned: false,
    gradient: "linear-gradient(135deg, #EF4444, #F97316)",
    border: "#EF4444",
    glow: "#EF444444",
    label: "FIRE",
  },
  {
    id: "running_it",
    emoji: "👊",
    name: "Running It",
    desc: "Won 5 total weeks",
    earned: false,
    gradient: "linear-gradient(135deg, #7C3AED, #A855F7)",
    border: "#7C3AED",
    glow: "#7C3AED44",
    label: "ELECTRIC",
  },
  {
    id: "dominant",
    emoji: "😤",
    name: "Dominant",
    desc: "Won 4 straight weeks",
    earned: false,
    gradient: "linear-gradient(135deg, #B91C1C, #EF4444)",
    border: "#B91C1C",
    glow: "#B91C1C44",
    label: "CRIMSON",
  },
  {
    id: "untouchable",
    emoji: "💀",
    name: "Untouchable",
    desc: "8-week undefeated streak",
    earned: false,
    gradient: "linear-gradient(135deg, #1E1B4B, #312E81, #4338CA)",
    border: "#4338CA",
    glow: "#4338CA44",
    label: "COSMIC",
  },
  {
    id: "the_goat",
    emoji: "🏆",
    name: "The GOAT",
    desc: "Legendary status — 20 total wins",
    earned: false,
    gradient: "linear-gradient(135deg, #FFD700, #FF6B6B, #A855F7, #06B6D4)",
    border: "#FFD700",
    glow: "#FFD70055",
    label: "GALAXY",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const TIER_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  grinder: { label: "Grinder", color: "#7C3AED", emoji: "⚙️" },
  active:  { label: "Active",  color: "#10B981", emoji: "⚡" },
  beast:   { label: "Beast",   color: "#EF4444", emoji: "🔥" },
  warrior: { label: "Warrior", color: "#F5A623", emoji: "⚔️" },
  legend:  { label: "Legend",  color: "#FFD700", emoji: "👑" },
};

function getTier(tier: string) {
  return TIER_CONFIG[tier.toLowerCase()] ?? { label: tier, color: "#7C3AED", emoji: "⚔️" };
}

function getContextualMessage() {
  const rivalAhead = RIVAL.workoutsThisWeek > ME.workoutsThisWeek;
  const iAhead = ME.workoutsThisWeek > RIVAL.workoutsThisWeek;
  const tied = ME.workoutsThisWeek === RIVAL.workoutsThisWeek;
  if (RIVAL.loggedToday && !ME.loggedToday && rivalAhead) {
    return { text: "They logged today and you haven't 👀", color: "#EF4444" };
  }
  if (iAhead && ME.loggedToday) {
    return { text: "You're up this week 💪 keep it going", color: "#10B981" };
  }
  if (tied || (!RIVAL.loggedToday && !ME.loggedToday)) {
    return { text: "Neck and neck — whoever logs next gets the edge ⚖️", color: "#7C3AED" };
  }
  if (rivalAhead) {
    return { text: "They're ahead — time to grind 🔥", color: "#EF4444" };
  }
  return { text: "You're holding it down 💪", color: "#10B981" };
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHMAKING SECTION
// ─────────────────────────────────────────────────────────────────────────────

function MatchmakingSection({ onChallenge }: { onChallenge: (name: string) => void }) {
  const [challenging, setChallenging] = useState<string | null>(null);

  function handleChallenge(name: string) {
    setChallenging(name);
    setTimeout(() => {
      onChallenge(name);
    }, 900);
  }

  return (
    <div>
      <style>{`
        @keyframes matchPulse {
          0%   { box-shadow: 0 0 0 0 rgba(124,58,237,0.4); }
          70%  { box-shadow: 0 0 0 10px rgba(124,58,237,0); }
          100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanLine {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
      `}</style>

      {/* Hero banner */}
      <div style={{
        background: "linear-gradient(135deg, #1A0D3E, #2D1B69, #1A0D3E)",
        borderRadius: 24, padding: "32px 28px", marginBottom: 32,
        border: "1px solid #7C3AED55",
        position: "relative", overflow: "hidden",
        boxShadow: "0 8px 40px rgba(124,58,237,0.2)",
      }}>
        {/* Scan line effect */}
        <div style={{
          position: "absolute", left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg, transparent, #7C3AED66, transparent)",
          animation: "scanLine 3s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, #7C3AED22 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⚔️</div>
          <div style={{ fontWeight: 900, fontSize: 26, color: "#fff", marginBottom: 8, letterSpacing: -0.5 }}>
            Find Your Rival
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto 16px" }}>
            Pick someone at your level. Track them every week. Make every workout a battle.
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(124,58,237,0.2)", border: "1px solid #7C3AED55",
            borderRadius: 99, padding: "6px 16px", fontSize: 12, color: "#C4B5FD",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7C3AED", animation: "matchPulse 1.5s infinite" }} />
            Matched within your tier range • Similar activity level
          </div>
        </div>
      </div>

      {/* Potential rivals */}
      <div style={{ marginBottom: 8, fontWeight: 800, fontSize: 14, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>
        🎯 Suggested Rivals
      </div>

      {POTENTIAL_RIVALS.map((pr, idx) => {
        const tierInfo = getTier(pr.tier);
        const isChallengingThis = challenging === pr.name;
        return (
          <div
            key={pr.name}
            style={{
              background: "#1A1A1A",
              borderRadius: 20,
              border: `2px solid ${isChallengingThis ? "#7C3AED" : "#2D1B69"}`,
              padding: "20px 22px",
              marginBottom: 16,
              animation: `slideUp 0.4s ease ${idx * 0.1}s both`,
              transition: "border-color 0.2s",
              boxShadow: isChallengingThis ? "0 0 24px rgba(124,58,237,0.4)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Avatar */}
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: `linear-gradient(135deg, ${tierInfo.color}, ${tierInfo.color}88)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 900, color: "#fff", flexShrink: 0,
                border: `2px solid ${tierInfo.color}55`,
              }}>
                {getInitials(pr.name)}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 900, fontSize: 16, color: "#F0F0F0" }}>{pr.name}</span>
                  <span style={{
                    background: `${tierInfo.color}22`, border: `1px solid ${tierInfo.color}55`,
                    borderRadius: 99, padding: "2px 9px", fontSize: 10, fontWeight: 800, color: tierInfo.color,
                  }}>
                    {tierInfo.emoji} {tierInfo.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9CA3AF", flexWrap: "wrap" }}>
                  <span>📅 {pr.workoutsPerWeek}/week</span>
                  <span>🔥 {pr.streak}-day streak</span>
                  <span>📊 {pr.winRate}% win rate</span>
                </div>
              </div>

              {/* Challenge button */}
              <button
                onClick={() => handleChallenge(pr.name)}
                disabled={!!challenging}
                style={{
                  padding: "10px 18px", borderRadius: 13, border: "none",
                  background: isChallengingThis
                    ? "linear-gradient(135deg, #10B981, #059669)"
                    : "linear-gradient(135deg, #7C3AED, #9D5CF0)",
                  color: "#fff", fontWeight: 800, fontSize: 13,
                  cursor: challenging ? "default" : "pointer",
                  flexShrink: 0,
                  boxShadow: isChallengingThis ? "0 4px 14px #10B98155" : "0 4px 14px #7C3AED55",
                  transition: "all 0.25s",
                  opacity: challenging && !isChallengingThis ? 0.4 : 1,
                }}
              >
                {isChallengingThis ? "⚡ Challenging..." : "⚔️ Challenge"}
              </button>
            </div>

            {/* Compatibility bar */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>Compatibility</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: pr.match >= 90 ? "#10B981" : pr.match >= 80 ? "#F5A623" : "#9CA3AF" }}>
                  {pr.match}% matched
                </span>
              </div>
              <div style={{ height: 8, background: "#2D1B69", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${pr.match}%`,
                  background: pr.match >= 90
                    ? "linear-gradient(90deg, #10B981, #34D399)"
                    : pr.match >= 80
                    ? "linear-gradient(90deg, #F5A623, #FBBF24)"
                    : "linear-gradient(90deg, #7C3AED, #9D5CF0)",
                  borderRadius: 99,
                  transition: "width 1s ease",
                }} />
              </div>
            </div>
          </div>
        );
      })}

      {/* Chat locked state */}
      <div style={{
        marginTop: 32, background: "#1A1A1A", borderRadius: 20,
        border: "1px solid #2D1B69", padding: "24px",
        textAlign: "center", opacity: 0.7,
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#F0F0F0", marginBottom: 6 }}>
          Chat unlocks when you accept a rival
        </div>
        <div style={{ fontSize: 13, color: "#9CA3AF" }}>
          Pick one of the rivals above to unlock trash talk.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAD TO HEAD PANEL
// ─────────────────────────────────────────────────────────────────────────────

function HeadToHeadPanel() {
  const rivalAhead = RIVAL.workoutsThisWeek > ME.workoutsThisWeek;
  const iAhead = ME.workoutsThisWeek > RIVAL.workoutsThisWeek;
  const msg = getContextualMessage();
  const myTier = getTier(ME.tier);
  const rivalTier = getTier(RIVAL.tier);
  const totalW = ME.workoutsThisWeek + RIVAL.workoutsThisWeek || 1;
  const myPct = Math.round((ME.workoutsThisWeek / totalW) * 100);
  const rivalPct = 100 - myPct;
  const totalRecord = ME.record.wins + ME.record.losses || 1;

  return (
    <div>
      <style>{`
        @keyframes h2hGlow {
          0%   { box-shadow: 0 0 20px 4px #EF444433, 0 0 40px 10px #7C3AED22; }
          50%  { box-shadow: 0 0 30px 8px #EF444455, 0 0 60px 18px #7C3AED33; }
          100% { box-shadow: 0 0 20px 4px #EF444433, 0 0 40px 10px #7C3AED22; }
        }
        @keyframes vsFloat {
          0%   { transform: scale(1) rotate(-3deg); }
          50%  { transform: scale(1.08) rotate(3deg); }
          100% { transform: scale(1) rotate(-3deg); }
        }
        @keyframes statusPulse {
          0%   { opacity: 1; }
          50%  { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* Section title */}
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        ⚔️ Head-to-Head
        <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", background: "#EF444422", padding: "2px 8px", borderRadius: 99, border: "1px solid #EF444444" }}>
          LIVE
        </span>
      </div>

      {/* Main battle card */}
      <div style={{
        background: "linear-gradient(135deg, #1A0D3E, #1A1A1A, #1A0A0A)",
        borderRadius: 24, border: "2px solid #EF444455",
        padding: "24px", marginBottom: 20,
        animation: "h2hGlow 3s ease-in-out infinite",
        position: "relative", overflow: "hidden",
      }}>
        {/* Background cross */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 30% 50%, #7C3AED08 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, #EF444408 0%, transparent 60%)",
        }} />

        {/* Players row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, position: "relative", zIndex: 1 }}>
          {/* Me */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", margin: "0 auto 10px",
              background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 900, color: "#fff",
              border: iAhead ? "3px solid #10B981" : "3px solid #7C3AED44",
              boxShadow: iAhead ? "0 0 20px #10B98155" : "none",
            }}>
              {getInitials(ME.name)}
            </div>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#F0F0F0" }}>You</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>@{ME.username}</div>
            <div style={{
              marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4,
              background: `${myTier.color}22`, border: `1px solid ${myTier.color}44`,
              borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: myTier.color,
            }}>
              {myTier.emoji} {myTier.label}
            </div>
          </div>

          {/* VS badge */}
          <div style={{
            width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #1A1A1A, #2D1B69)",
            border: "2px solid #7C3AED66",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 14, color: "#7C3AED",
            animation: "vsFloat 3s ease-in-out infinite",
            boxShadow: "0 0 20px #7C3AED33",
          }}>
            VS
          </div>

          {/* Rival */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", margin: "0 auto 10px",
              background: `linear-gradient(135deg, ${rivalTier.color}, ${rivalTier.color}88)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 900, color: "#fff",
              border: rivalAhead ? "3px solid #EF4444" : "3px solid #7C3AED44",
              boxShadow: rivalAhead ? "0 0 20px #EF444455" : "none",
            }}>
              {getInitials(RIVAL.name)}
            </div>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#F0F0F0" }}>{RIVAL.name.split(" ")[0]}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>@{RIVAL.username}</div>
            <div style={{
              marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4,
              background: `${rivalTier.color}22`, border: `1px solid ${rivalTier.color}44`,
              borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: rivalTier.color,
            }}>
              {rivalTier.emoji} {rivalTier.label}
            </div>
          </div>
        </div>

        {/* Contextual message */}
        <div style={{
          background: `${msg.color}11`, border: `1px solid ${msg.color}33`,
          borderRadius: 12, padding: "10px 16px", marginBottom: 20,
          textAlign: "center", fontWeight: 700, fontSize: 13, color: msg.color,
        }}>
          {msg.text}
        </div>

        {/* This week workouts */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Workouts This Week
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 900, fontSize: 22, color: iAhead ? "#10B981" : "#7C3AED", minWidth: 24, textAlign: "center" }}>
              {ME.workoutsThisWeek}
            </span>
            <div style={{ flex: 1, height: 12, background: "#0D0D0D", borderRadius: 99, overflow: "hidden", display: "flex" }}>
              <div style={{
                width: `${myPct}%`, background: iAhead ? "linear-gradient(90deg, #7C3AED, #10B981)" : "linear-gradient(90deg, #7C3AED, #9D5CF0)",
                transition: "width 0.8s ease",
              }} />
              <div style={{
                flex: 1, background: rivalAhead ? "#EF4444" : "#EF444455",
                transition: "all 0.8s ease",
              }} />
            </div>
            <span style={{ fontWeight: 900, fontSize: 22, color: rivalAhead ? "#EF4444" : "#9CA3AF", minWidth: 24, textAlign: "center" }}>
              {RIVAL.workoutsThisWeek}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>YOU {myPct}%</span>
            <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>{rivalPct}% THEM</span>
          </div>
        </div>

        {/* Streaks */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, marginBottom: 16, alignItems: "center" }}>
          <div style={{ background: "#0D0D0D", borderRadius: 12, padding: "12px", textAlign: "center", border: "1px solid #2D1B69" }}>
            <div style={{ fontSize: 20 }}>🔥</div>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#7C3AED" }}>{ME.streak}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>YOUR STREAK</div>
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>VS</div>
          <div style={{ background: "#0D0D0D", borderRadius: 12, padding: "12px", textAlign: "center", border: "1px solid #EF444433" }}>
            <div style={{ fontSize: 20 }}>🔥</div>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#EF4444" }}>{RIVAL.streak}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>THEIR STREAK</div>
          </div>
        </div>

        {/* All-time record */}
        <div style={{ background: "#0D0D0D", borderRadius: 14, padding: "14px 18px", marginBottom: 16, border: "1px solid #2D1B69" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            All-Time Record
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 28, color: "#10B981" }}>{ME.record.wins}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>WINS</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#9CA3AF" }}>—</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 28, color: "#EF4444" }}>{ME.record.losses}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>LOSSES</div>
            </div>
            <div style={{ height: 40, width: 1, background: "#2D1B69" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 28, color: "#F5A623" }}>
                {Math.round((ME.record.wins / totalRecord) * 100)}%
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>WIN RATE</div>
            </div>
          </div>
        </div>

        {/* Today status */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{
            flex: 1, background: "#0D0D0D", borderRadius: 12, padding: "12px 14px",
            border: `1px solid ${ME.loggedToday ? "#10B98144" : "#EF444433"}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 12, height: 12, borderRadius: "50%",
              background: ME.loggedToday ? "#10B981" : "#EF4444",
              boxShadow: ME.loggedToday ? "0 0 10px #10B981" : "0 0 10px #EF4444",
              animation: "statusPulse 1.5s ease-in-out infinite",
              flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: ME.loggedToday ? "#10B981" : "#EF4444" }}>
                {ME.loggedToday ? "Logged Today ✓" : "Not Logged Yet"}
              </div>
              <div style={{ fontSize: 10, color: "#9CA3AF" }}>You</div>
            </div>
          </div>
          <div style={{
            flex: 1, background: "#0D0D0D", borderRadius: 12, padding: "12px 14px",
            border: `1px solid ${RIVAL.loggedToday ? "#EF444444" : "#10B98133"}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 12, height: 12, borderRadius: "50%",
              background: RIVAL.loggedToday ? "#EF4444" : "#10B981",
              boxShadow: RIVAL.loggedToday ? "0 0 10px #EF4444" : "0 0 10px #10B981",
              animation: "statusPulse 1.5s ease-in-out infinite",
              flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: RIVAL.loggedToday ? "#EF4444" : "#10B981" }}>
                {RIVAL.loggedToday ? "Logged Today ⚠️" : "Not Yet 😴"}
              </div>
              <div style={{ fontSize: 10, color: "#9CA3AF" }}>{RIVAL.name.split(" ")[0]}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGES PANEL
// ─────────────────────────────────────────────────────────────────────────────

function BadgesPanel() {
  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 6 }}>
        🏅 Rival Badges
      </div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
        Earn badges by dominating your rivals. Lock in that legacy.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
        {BADGES.map((badge) => (
          <div
            key={badge.id}
            style={{
              borderRadius: 18, padding: "18px 14px",
              background: badge.earned ? badge.gradient : "#1A1A1A",
              border: `2px solid ${badge.earned ? badge.border : "#2D2D2D"}`,
              textAlign: "center", position: "relative", overflow: "hidden",
              boxShadow: badge.earned ? `0 4px 20px ${badge.glow}` : "none",
              opacity: badge.earned ? 1 : 0.55,
              transition: "all 0.2s",
            }}
          >
            {/* Locked overlay */}
            {!badge.earned && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 16, zIndex: 2,
              }}>
                <div style={{ fontSize: 22, filter: "grayscale(1)" }}>🔒</div>
              </div>
            )}

            {/* Shine effect for earned */}
            {badge.earned && (
              <div style={{
                position: "absolute", top: -20, left: -20, width: 60, height: 60,
                background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />
            )}

            <div style={{
              fontSize: 32, marginBottom: 8,
              filter: badge.earned ? "none" : "grayscale(1)",
            }}>
              {badge.emoji}
            </div>
            <div style={{
              fontWeight: 900, fontSize: 13,
              color: badge.earned ? "#fff" : "#6B7280",
              marginBottom: 4,
              textShadow: badge.earned ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
            }}>
              {badge.name}
            </div>
            <div style={{
              fontSize: 10, color: badge.earned ? "rgba(255,255,255,0.8)" : "#4B5563",
              lineHeight: 1.4, marginBottom: 8,
            }}>
              {badge.desc}
            </div>
            {badge.earned && (
              <div style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.25)", borderRadius: 99,
                padding: "2px 8px", fontSize: 9, fontWeight: 900,
                color: "#fff", letterSpacing: 0.5,
              }}>
                {badge.label}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT PANEL
// ─────────────────────────────────────────────────────────────────────────────

function ChatPanel() {
  const [messages, setMessages] = useState(MOCK_CHAT);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        from: "me",
        text: trimmed,
        time: "Just now",
      },
    ]);
    setInput("");
  }

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 6 }}>
        💬 Rival Chat
      </div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
        Talk your trash. Back it up.
      </div>

      <div style={{
        background: "#1A1A1A", borderRadius: 20,
        border: "1px solid #2D1B69", overflow: "hidden",
      }}>
        {/* Chat thread */}
        <div style={{
          padding: "16px", height: 320, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          {messages.map((msg) => {
            const isMe = msg.from === "me";
            return (
              <div key={msg.id} style={{
                display: "flex", flexDirection: isMe ? "row-reverse" : "row",
                alignItems: "flex-end", gap: 8,
              }}>
                {!isMe && (
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, #EF4444, #EF444488)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 900, color: "#fff",
                  }}>
                    MW
                  </div>
                )}
                <div style={{ maxWidth: "72%" }}>
                  <div style={{
                    padding: "10px 14px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isMe
                      ? "linear-gradient(135deg, #7C3AED, #9D5CF0)"
                      : "#2D2D2D",
                    color: "#fff", fontSize: 13, lineHeight: 1.5,
                    boxShadow: isMe ? "0 4px 12px #7C3AED44" : "none",
                  }}>
                    {msg.text}
                  </div>
                  <div style={{
                    fontSize: 10, color: "#6B7280", marginTop: 4,
                    textAlign: isMe ? "right" : "left",
                  }}>
                    {msg.time}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "12px 16px", borderTop: "1px solid #2D1B69",
          display: "flex", gap: 10, alignItems: "center",
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Say something... 😤"
            style={{
              flex: 1, background: "#0D0D0D", border: "1px solid #2D1B69",
              borderRadius: 24, padding: "10px 16px", fontSize: 13,
              color: "#F0F0F0", outline: "none", fontFamily: "inherit",
            }}
          />
          <button
            onClick={sendMessage}
            style={{
              width: 40, height: 40, borderRadius: "50%", border: "none",
              background: "linear-gradient(135deg, #7C3AED, #9D5CF0)",
              color: "#fff", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 12px #7C3AED55",
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS PANEL
// ─────────────────────────────────────────────────────────────────────────────

function NotificationsPanel() {
  const typeColors: Record<string, string> = {
    warning: "#F5A623",
    danger: "#EF4444",
    success: "#10B981",
  };

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
        📡 Rival Activity
        <span style={{
          background: "#EF444422", color: "#EF4444",
          fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99,
          border: "1px solid #EF444444",
        }}>
          LIVE
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
        Real-time intel on what your rival is doing.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MOCK_NOTIFICATIONS.map((notif) => {
          const color = typeColors[notif.type] ?? "#9CA3AF";
          return (
            <div
              key={notif.id}
              style={{
                background: "#1A1A1A", borderRadius: 14,
                border: `1px solid ${color}22`, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 14,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: `${color}15`, border: `1px solid ${color}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20,
              }}>
                {notif.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#F0F0F0", lineHeight: 1.4 }}>
                  {notif.text}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                  {notif.time}
                </div>
              </div>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: color, flexShrink: 0,
                boxShadow: `0 0 8px ${color}`,
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE RIVAL VIEW
// ─────────────────────────────────────────────────────────────────────────────

function ActiveRivalView({ onDropRival }: { onDropRival: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <HeadToHeadPanel />
      <BadgesPanel />
      <ChatPanel />
      <NotificationsPanel />

      {/* Drop rival */}
      <div style={{ textAlign: "center", paddingBottom: 20 }}>
        <button
          onClick={onDropRival}
          style={{
            background: "transparent", border: "1px solid #2D1B69",
            borderRadius: 12, padding: "10px 24px", color: "#6B7280",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          Drop Rival
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function RivalsPage() {
  const [hasRival, setHasRival] = useState(false);
  const [rivalName, setRivalName] = useState("");

  function handleChallenge(name: string) {
    setRivalName(name);
    setHasRival(true);
  }

  return (
    <div style={{ background: "#0D0D0D", minHeight: "100vh" }}>
      <style>{`
        @keyframes headerPulse {
          0%   { box-shadow: 0 0 0 0 rgba(124,58,237,0.3); }
          70%  { box-shadow: 0 0 0 12px rgba(124,58,237,0); }
          100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
        }
      `}</style>

      {/* Page header */}
      <div style={{
        background: "linear-gradient(135deg, #1A0D3E, #0D0D0D)",
        borderBottom: "1px solid #2D1B69",
        padding: "20px 24px 0",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Link href="/connect" style={{
              color: "#9CA3AF", fontSize: 20, textDecoration: "none",
              display: "flex", alignItems: "center",
            }}>
              ←
            </Link>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 22, color: "#F0F0F0", letterSpacing: -0.5 }}>
                ⚔️ Rivals
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                {hasRival
                  ? `You vs ${rivalName || RIVAL.name} · Season 1`
                  : "Find your competition"}
              </div>
            </div>
            {hasRival && (
              <div style={{
                background: "#EF444422", border: "1px solid #EF444444",
                borderRadius: 99, padding: "4px 12px",
                fontSize: 11, fontWeight: 800, color: "#EF4444",
                animation: "headerPulse 2s infinite",
              }}>
                🔴 ACTIVE
              </div>
            )}
          </div>

          {/* Mode tabs */}
          {hasRival && (
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #2D1B69" }}>
              {["Battle", "Badges", "Chat", "Feed"].map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => {
                    const el = document.getElementById(`section-${i}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  style={{
                    padding: "8px 18px", background: "none", border: "none",
                    borderBottom: "2px solid transparent", color: "#9CA3AF",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 120px" }}>
        {!hasRival ? (
          <MatchmakingSection onChallenge={handleChallenge} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            <div id="section-0"><HeadToHeadPanel /></div>
            <div id="section-1"><BadgesPanel /></div>
            <div id="section-2"><ChatPanel /></div>
            <div id="section-3"><NotificationsPanel /></div>
            <div style={{ textAlign: "center", paddingBottom: 20 }}>
              <button
                onClick={() => setHasRival(false)}
                style={{
                  background: "transparent", border: "1px solid #2D1B69",
                  borderRadius: 12, padding: "10px 24px", color: "#6B7280",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                Drop Rival
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

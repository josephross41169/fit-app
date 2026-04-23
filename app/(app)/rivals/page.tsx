"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  joinQueue, leaveQueue, getQueueEntry,
  getActiveRivalry, getLiveScores, getUserRecord,
  getMessages, sendTextMessage, sendPhotoMessage,
  unblurPhoto, subscribeToMessages,
  getRivalryBadges,
  formatTimeLeft, formatScore,
  COMPETITIONS,
  type RivalCategory, type RivalTier,
  type RivalryWithOpponent, type RivalMessage,
  type UserRivalryRecord, type RivalryBadge,
} from "@/lib/rivalries";

// ─────────────────────────────────────────────────────────────────────────────
// STATIC CONFIG (unchanged from original — just the visual catalog)
// ─────────────────────────────────────────────────────────────────────────────

type MatchStep = "category" | "competition" | "tier" | "matching" | "active";

const CATEGORIES: { id: RivalCategory; emoji: string; name: string; desc: string }[] = [
  { id: "running",   emoji: "🏃", name: "Running",       desc: "Miles, pace, and endurance"     },
  { id: "walking",   emoji: "🚶", name: "Walking",       desc: "Steps, distance, consistency"    },
  { id: "biking",    emoji: "🚴", name: "Biking",        desc: "Miles, climbs, and speed"        },
  { id: "lifting",   emoji: "🏋️", name: "Lifting",       desc: "Volume, PRs, and raw strength"  },
  { id: "swimming",  emoji: "🏊", name: "Swimming",      desc: "Laps, distance, and stroke"      },
  { id: "combat",    emoji: "🥊", name: "Combat Sports", desc: "Rounds, sessions, and intensity" },
  { id: "wellness",  emoji: "🧘", name: "Wellness",      desc: "Meditation, mobility, recovery"  },
];

const TIERS: {
  id: RivalTier;
  emoji: string;
  name: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}[] = [
  { id: "beginner",     emoji: "🌱", name: "Beginner",     desc: "Just getting started — building the habit",
    color: "#7C3AED", bg: "linear-gradient(135deg, #064E3B, #065F46)", border: "#7C3AED55", glow: "#7C3AED33" },
  { id: "intermediate", emoji: "⚡", name: "Intermediate", desc: "Consistent and climbing — real competition",
    color: "#7C3AED", bg: "linear-gradient(135deg, #1A0D3E, #2D1B69)", border: "#7C3AED88", glow: "#7C3AED44" },
  { id: "mayhem",       emoji: "💀", name: "Mayhem",       desc: "No days off. Absolute grind. Not for everyone.",
    color: "#EF4444", bg: "linear-gradient(135deg, #1A0000, #3B0A0A, #1A0000)", border: "#EF444488", glow: "#EF444455" },
];

// Rivalry-specific badges (separate from app-wide badge catalog).
// These are the ones you can earn inside a single 7-day rivalry.
const RIVALRY_BADGE_CATALOG: { key: string; emoji: string; name: string; desc: string;
  gradient: string; border: string; glow: string; label: string }[] = [
  { key: "first_blood",  emoji: "⚔️", name: "First Blood",  desc: "First log of the rivalry",
    gradient: "linear-gradient(135deg,#9CA3AF,#E5E7EB)", border: "#9CA3AF", glow: "#9CA3AF44", label: "SILVER" },
  { key: "early_bird",   emoji: "🌅", name: "Early Bird",   desc: "Logged a morning workout 2 days in a row",
    gradient: "linear-gradient(135deg,#F5A623,#F59E0B)", border: "#F5A623", glow: "#F5A62344", label: "GOLD" },
  { key: "dominant",     emoji: "😤", name: "Dominant",     desc: "Ahead by 3+ sessions by midweek",
    gradient: "linear-gradient(135deg,#B91C1C,#EF4444)", border: "#B91C1C", glow: "#B91C1C44", label: "CRIMSON" },
  { key: "comeback",     emoji: "🔄", name: "Comeback",     desc: "Flipped a deficit to a lead",
    gradient: "linear-gradient(135deg,#7C3AED,#A855F7)", border: "#7C3AED", glow: "#7C3AED44", label: "ELECTRIC" },
  { key: "untouchable",  emoji: "💀", name: "Untouchable",  desc: "Won without ever being behind",
    gradient: "linear-gradient(135deg,#1E1B4B,#312E81,#4338CA)", border: "#4338CA", glow: "#4338CA44", label: "COSMIC" },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function getCategoryLabel(cat: RivalCategory) { return CATEGORIES.find((c) => c.id === cat)!; }
function getTierLabel(tier: RivalTier)         { return TIERS.find((t) => t.id === tier)!; }
function getCompetitionLabel(cat: RivalCategory, id: string) {
  return COMPETITIONS[cat].find((c) => c.id === id)?.label ?? id;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY SELECT
// ─────────────────────────────────────────────────────────────────────────────

function CategorySelect({ onSelect }: { onSelect: (c: RivalCategory) => void }) {
  const [hovered, setHovered] = useState<RivalCategory | null>(null);
  return (
    <div>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scanLine { 0% { transform: translateY(-100%); } 100% { transform: translateY(600%); } }
      `}</style>
      <div style={{ background: "linear-gradient(135deg, #1A0D3E, #2D1B69, #1A0D3E)", borderRadius: 24, padding: "32px 28px", marginBottom: 32, border: "1px solid #7C3AED55", position: "relative", overflow: "hidden", boxShadow: "0 8px 40px rgba(124,58,237,0.2)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, transparent, #7C3AED66, transparent)", animation: "scanLine 3s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⚔️</div>
          <div style={{ fontWeight: 900, fontSize: 26, color: "#fff", marginBottom: 8, letterSpacing: -0.5 }}>Choose Your Battleground</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>Pick your sport. Then pick how you want to compete.</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {CATEGORIES.map((cat, i) => {
          const isHov = hovered === cat.id;
          return (
            <button key={cat.id} onClick={() => onSelect(cat.id)}
              onMouseEnter={() => setHovered(cat.id)} onMouseLeave={() => setHovered(null)}
              style={{ background: isHov ? "linear-gradient(135deg, #1A0D3E, #2D1B69)" : "#1A1A1A", border: `2px solid ${isHov ? "#7C3AED" : "#2D1B69"}`, borderRadius: 20, padding: "22px 16px", cursor: "pointer", textAlign: "center", animation: `fadeUp 0.4s ease ${i * 0.06}s both`, transition: "all 0.2s", boxShadow: isHov ? "0 0 24px rgba(124,58,237,0.35)" : "none", outline: "none" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>{cat.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#F0F0F0", marginBottom: 4 }}>{cat.name}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.4 }}>{cat.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPETITION SELECT (new step — picks the metric)
// ─────────────────────────────────────────────────────────────────────────────

function CompetitionSelect({ category, onBack, onSelect }: {
  category: RivalCategory; onBack: () => void; onSelect: (id: string) => void;
}) {
  const cat = getCategoryLabel(category);
  const options = COMPETITIONS[category];
  return (
    <div>
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: "#1A1A1A", border: "1px solid #2D1B69", borderRadius: 12, width: 40, height: 40, color: "#9CA3AF", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#F0F0F0" }}>{cat.emoji} {cat.name}</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>Pick your competition</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {options.map((opt, i) => (
          <button key={opt.id} onClick={() => onSelect(opt.id)}
            style={{ background: "#1A1A1A", border: "2px solid #2D1B69", borderRadius: 16, padding: "18px 20px", cursor: "pointer", textAlign: "left", animation: `fadeUp 0.35s ease ${i * 0.06}s both`, transition: "border-color 0.2s, box-shadow 0.2s", outline: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.boxShadow = "0 0 20px rgba(124,58,237,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2D1B69"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#F0F0F0" }}>{opt.label}</div>
            <div style={{ color: "#7C3AED", fontSize: 18, fontWeight: 900 }}>→</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER SELECT
// ─────────────────────────────────────────────────────────────────────────────

function TierSelect({ category, competition, onBack, onSelect }: {
  category: RivalCategory; competition: string; onBack: () => void; onSelect: (t: RivalTier) => void;
}) {
  const cat = getCategoryLabel(category);
  const [hovered, setHovered] = useState<RivalTier | null>(null);
  return (
    <div>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mayhemFlicker { 0%,100% { opacity: 1; } 92% { opacity: 1; } 93% { opacity: 0.7; } 94% { opacity: 1; } 96% { opacity: 0.85; } 97% { opacity: 1; } }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: "#1A1A1A", border: "1px solid #2D1B69", borderRadius: 12, width: 40, height: 40, color: "#9CA3AF", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#F0F0F0" }}>{cat.emoji} {cat.name} · {getCompetitionLabel(category, competition)}</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>Choose your tier</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {TIERS.map((tier, i) => {
          const isHov = hovered === tier.id;
          const isMayhem = tier.id === "mayhem";
          return (
            <button key={tier.id} onClick={() => onSelect(tier.id)} onMouseEnter={() => setHovered(tier.id)} onMouseLeave={() => setHovered(null)}
              style={{ background: isHov || isMayhem ? tier.bg : "#1A1A1A", border: `2px solid ${isHov ? tier.color : tier.border}`, borderRadius: 20, padding: "24px 22px", cursor: "pointer", textAlign: "left", animation: `fadeUp 0.35s ease ${i * 0.1}s both${isMayhem ? ", mayhemFlicker 6s ease-in-out infinite" : ""}`, transition: "border-color 0.2s, box-shadow 0.2s", boxShadow: isHov ? `0 0 28px ${tier.glow}` : isMayhem ? `0 4px 24px ${tier.glow}` : "none", outline: "none", position: "relative", overflow: "hidden" }}>
              {isMayhem && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(239,68,68,0.03) 2px, rgba(239,68,68,0.03) 4px)" }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: `${tier.color}18`, border: `2px solid ${tier.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: isMayhem ? `0 0 16px ${tier.glow}` : "none" }}>{tier.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: isMayhem ? 20 : 18, color: tier.color, marginBottom: 4, textShadow: isMayhem ? `0 0 12px ${tier.color}88` : "none", letterSpacing: isMayhem ? 0.5 : 0 }}>{tier.name}</div>
                  <div style={{ fontSize: 13, color: isMayhem ? "#FCA5A5" : "#9CA3AF", lineHeight: 1.5 }}>{tier.desc}</div>
                </div>
                <div style={{ color: tier.color, fontSize: 20, fontWeight: 900, opacity: isHov ? 1 : 0.4, transition: "opacity 0.2s" }}>→</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHING SCREEN (now real — polls for a match or times out gracefully)
// ─────────────────────────────────────────────────────────────────────────────

function MatchingScreen({ category, tier, onMatched, onCancel }: {
  category: RivalCategory; tier: RivalTier;
  onMatched: () => void; onCancel: () => void;
}) {
  const cat = getCategoryLabel(category);
  const t = getTierLabel(tier);
  const [elapsed, setElapsed] = useState(0);

  // Poll for active rivalry every 3 seconds (someone else might match with us)
  useEffect(() => {
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      const rivalry = await getActiveRivalry();
      if (rivalry) {
        clearInterval(interval);
        onMatched();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [onMatched]);

  async function handleCancel() {
    await leaveQueue();
    onCancel();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 32, textAlign: "center" }}>
      <style>{`
        @keyframes radarPing { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes dotBounce { 0%,80%,100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
      `}</style>
      <div style={{ position: "relative", width: 120, height: 120 }}>
        {[0, 0.4, 0.8].map((delay) => (
          <div key={delay} style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${t.color}`, animation: `radarPing 1.8s ease-out ${delay}s infinite` }} />
        ))}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `${t.color}18`, border: `2px solid ${t.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, animation: "spinSlow 4s linear infinite" }}>
          {cat.emoji}
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 900, fontSize: 22, color: "#F0F0F0", marginBottom: 8 }}>Searching for your rival...</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${t.color}18`, border: `1px solid ${t.color}44`, borderRadius: 99, padding: "6px 16px", fontSize: 13, color: t.color, fontWeight: 700 }}>
          {cat.emoji} {cat.name} · {t.emoji} {t.name}
        </div>
        {elapsed > 15 && (
          <div style={{ marginTop: 16, fontSize: 12, color: "#9CA3AF", maxWidth: 320 }}>
            Still looking. No one else is queued for your exact pick yet — leave the queue and try a different metric, or keep waiting.
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 0.2, 0.4].map((delay) => (
          <div key={delay} style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, animation: `dotBounce 1.2s ease-in-out ${delay}s infinite` }} />
        ))}
      </div>
      <button onClick={handleCancel} style={{ background: "transparent", border: "1px solid #2D1B69", borderRadius: 12, padding: "10px 24px", color: "#9CA3AF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        Cancel search
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAD-TO-HEAD PANEL (real data)
// ─────────────────────────────────────────────────────────────────────────────

function HeadToHeadPanel({ rivalry, myRecord, theirRecord }: {
  rivalry: RivalryWithOpponent;
  myRecord: UserRivalryRecord;
  theirRecord: UserRivalryRecord;
}) {
  const cat = getCategoryLabel(rivalry.category);
  const t = getTierLabel(rivalry.tier);
  const [liveScores, setLiveScores] = useState({ my_score: rivalry.my_score, their_score: rivalry.their_score });
  const [timeLeft, setTimeLeft] = useState(formatTimeLeft(rivalry.ends_at));

  // Refresh live scores every 30 seconds
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const scores = await getLiveScores(rivalry);
      if (!cancelled) setLiveScores(scores);
    }
    tick();
    const interval = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [rivalry]);

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(formatTimeLeft(rivalry.ends_at)), 60_000);
    return () => clearInterval(interval);
  }, [rivalry.ends_at]);

  const iAhead = liveScores.my_score > liveScores.their_score;
  const rivalAhead = liveScores.their_score > liveScores.my_score;
  const myRecordTotal = myRecord.wins + myRecord.losses;
  const myWinRate = myRecordTotal > 0 ? Math.round((myRecord.wins / myRecordTotal) * 100) : 0;
  const theirRecordTotal = theirRecord.wins + theirRecord.losses;
  const theirWinRate = theirRecordTotal > 0 ? Math.round((theirRecord.wins / theirRecordTotal) * 100) : 0;

  return (
    <div>
      <style>{`
        @keyframes h2hGlow { 0% { box-shadow: 0 0 20px 4px #EF444433, 0 0 40px 10px #7C3AED22; } 50% { box-shadow: 0 0 30px 8px #EF444455, 0 0 60px 18px #7C3AED33; } 100% { box-shadow: 0 0 20px 4px #EF444433, 0 0 40px 10px #7C3AED22; } }
        @keyframes vsFloat { 0% { transform: scale(1) rotate(-3deg); } 50% { transform: scale(1.08) rotate(3deg); } 100% { transform: scale(1) rotate(-3deg); } }
      `}</style>

      {/* Category + competition + tier badges */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1A1A1A", border: "1px solid #2D1B69", borderRadius: 99, padding: "6px 14px", fontSize: 13, color: "#F0F0F0", fontWeight: 800 }}>
          {cat.emoji} {cat.name}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1A1A1A", border: "1px solid #2D1B69", borderRadius: 99, padding: "6px 14px", fontSize: 13, color: "#F0F0F0", fontWeight: 800 }}>
          🎯 {getCompetitionLabel(rivalry.category, rivalry.competition_type)}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${t.color}18`, border: `1px solid ${t.color}44`, borderRadius: 99, padding: "6px 14px", fontSize: 13, color: t.color, fontWeight: 800, boxShadow: `0 0 10px ${t.glow}` }}>
          {t.emoji} {t.name}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EF444418", border: "1px solid #EF444444", borderRadius: 99, padding: "6px 14px", fontSize: 13, color: "#EF4444", fontWeight: 800 }}>
          ⏱ {timeLeft}
        </div>
      </div>

      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        ⚔️ Head-to-Head
        <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", background: "#EF444422", padding: "2px 8px", borderRadius: 99, border: "1px solid #EF444444" }}>LIVE</span>
      </div>

      <div style={{ background: "linear-gradient(135deg, #1A0D3E, #1A1A1A, #1A0A0A)", borderRadius: 24, border: "2px solid #EF444455", padding: "24px", marginBottom: 20, animation: "h2hGlow 3s ease-in-out infinite", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 30% 50%, #7C3AED08 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, #EF444408 0%, transparent 60%)" }} />

        {/* Players row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, position: "relative", zIndex: 1 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 10px", background: "linear-gradient(135deg, #7C3AED, #A78BFA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#fff", border: iAhead ? "3px solid #7C3AED" : "3px solid #7C3AED44", boxShadow: iAhead ? "0 0 20px #7C3AED55" : "none" }}>
              YOU
            </div>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#F0F0F0" }}>You</div>
          </div>
          <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #1A1A1A, #2D1B69)", border: "2px solid #7C3AED66", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#7C3AED", animation: "vsFloat 3s ease-in-out infinite", boxShadow: "0 0 20px #7C3AED33" }}>VS</div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 10px", background: "linear-gradient(135deg, #EF4444, #EF444488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#fff", border: rivalAhead ? "3px solid #EF4444" : "3px solid #7C3AED44", boxShadow: rivalAhead ? "0 0 20px #EF444455" : "none" }}>
              {getInitials(rivalry.opponent.full_name)}
            </div>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#F0F0F0" }}>{rivalry.opponent.full_name.split(" ")[0]}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>@{rivalry.opponent.username}</div>
          </div>
        </div>

        {/* Live scoreboard */}
        <div style={{ background: "#0D0D0D", borderRadius: 14, padding: "18px 20px", marginBottom: 16, border: "1px solid #2D1B69" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, textAlign: "center" }}>
            {getCompetitionLabel(rivalry.category, rivalry.competition_type)} · Live Score
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 26, color: "#7C3AED" }}>
                {formatScore(rivalry.category, rivalry.competition_type, liveScores.my_score)}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>YOU</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#9CA3AF" }}>—</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 26, color: "#EF4444" }}>
                {formatScore(rivalry.category, rivalry.competition_type, liveScores.their_score)}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>{rivalry.opponent.full_name.split(" ")[0].toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* All-time records side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#0D0D0D", borderRadius: 12, padding: "12px", border: "1px solid #7C3AED33" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#7C3AED", textAlign: "center", marginBottom: 6 }}>YOUR RECORD</div>
            <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, color: "#F0F0F0" }}>{myRecord.wins}-{myRecord.losses}</div>
            <div style={{ textAlign: "center", fontSize: 10, color: "#9CA3AF" }}>{myWinRate}% win rate</div>
          </div>
          <div style={{ background: "#0D0D0D", borderRadius: 12, padding: "12px", border: "1px solid #EF444433" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#EF4444", textAlign: "center", marginBottom: 6 }}>{rivalry.opponent.full_name.split(" ")[0].toUpperCase()}'S RECORD</div>
            <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, color: "#F0F0F0" }}>{theirRecord.wins}-{theirRecord.losses}</div>
            <div style={{ textAlign: "center", fontSize: 10, color: "#9CA3AF" }}>{theirWinRate}% win rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGES PANEL (real — reads from rivalry_badges table)
// ─────────────────────────────────────────────────────────────────────────────

function BadgesPanel({ rivalryId, myId, opponentFirstName }: {
  rivalryId: string; myId: string; opponentFirstName: string;
}) {
  const [earned, setEarned] = useState<RivalryBadge[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const badges = await getRivalryBadges(rivalryId);
      if (!cancelled) setEarned(badges);
    }
    load();
    const interval = setInterval(load, 60_000); // poll every minute
    return () => { cancelled = true; clearInterval(interval); };
  }, [rivalryId]);

  const earnedMap = new Map(earned.map((b) => [b.badge_key, b]));

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 6 }}>🏅 Rival Badges</div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
        One person per badge per rivalry. First to earn it locks it.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 14 }}>
        {RIVALRY_BADGE_CATALOG.map((badge) => {
          const earnedBy = earnedMap.get(badge.key);
          const earnedByMe = earnedBy?.user_id === myId;
          const earnedByThem = earnedBy && earnedBy.user_id !== myId;

          return (
            <div key={badge.key} style={{
              borderRadius: 18, padding: "18px 14px",
              background: earnedBy ? badge.gradient : "#1A1A1A",
              border: `2px solid ${earnedBy ? badge.border : "#2D2D2D"}`,
              textAlign: "center", position: "relative", overflow: "hidden",
              boxShadow: earnedBy ? `0 4px 20px ${badge.glow}` : "none",
              opacity: earnedBy ? 1 : 0.55,
            }}>
              {!earnedBy && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, zIndex: 2 }}>
                  <div style={{ fontSize: 22, filter: "grayscale(1)" }}>🔒</div>
                </div>
              )}
              <div style={{ fontSize: 32, marginBottom: 8, filter: earnedBy ? "none" : "grayscale(1)" }}>{badge.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 13, color: earnedBy ? "#fff" : "#6B7280", marginBottom: 4, textShadow: earnedBy ? "0 1px 4px rgba(0,0,0,0.4)" : "none" }}>
                {badge.name}
              </div>
              <div style={{ fontSize: 10, color: earnedBy ? "rgba(255,255,255,0.85)" : "#4B5563", lineHeight: 1.4, marginBottom: 8 }}>
                {badge.desc}
              </div>
              {earnedBy && (
                <div style={{ display: "inline-block", background: "rgba(0,0,0,0.45)", borderRadius: 99, padding: "2px 8px", fontSize: 9, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>
                  {earnedByMe ? "🏆 YOU" : `${opponentFirstName.toUpperCase()} LOCKED`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT PANEL (real — Supabase + realtime + photo blur)
// ─────────────────────────────────────────────────────────────────────────────

function ChatPanel({ rivalryId, myId, rivalFirstName }: {
  rivalryId: string; myId: string; rivalFirstName: string;
}) {
  const [messages, setMessages] = useState<RivalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const msgs = await getMessages(rivalryId);
      if (!cancelled) setMessages(msgs);
    }
    load();

    const unsub = subscribeToMessages(
      rivalryId,
      (newMsg) => setMessages((prev) => {
        if (prev.find((m) => m.id === newMsg.id)) return prev; // dedupe
        return [...prev, newMsg];
      }),
      (updated) => setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m)),
    );

    return () => { cancelled = true; unsub(); };
  }, [rivalryId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSendText() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendTextMessage(rivalryId, trimmed);
      setInput("");
    } catch (e) {
      console.error("Send failed:", e);
    } finally {
      setSending(false);
    }
  }

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || sending) return;
    setSending(true);
    try {
      await sendPhotoMessage(rivalryId, file);
    } catch (err) {
      console.error("Photo send failed:", err);
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleUnblur(messageId: string) {
    // Optimistic update
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, is_blurred: false } : m));
    try {
      await unblurPhoto(messageId);
    } catch (e) {
      // Revert on failure
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, is_blurred: true } : m));
      console.error("Unblur failed:", e);
    }
  }

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 6 }}>💬 Rival Chat</div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>Talk your trash. Back it up.</div>
      <div style={{ background: "#1A1A1A", borderRadius: 20, border: "1px solid #2D1B69", overflow: "hidden" }}>
        <div style={{ padding: "16px", height: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ margin: "auto", color: "#6B7280", fontSize: 13, textAlign: "center" }}>
              No messages yet. Start the trash talk.
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === myId;
            const isBlurredForMe = msg.is_blurred && !isMe; // sender always sees their own photo clearly
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
                {!isMe && (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#EF4444,#EF444488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>
                    {rivalFirstName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ maxWidth: "72%" }}>
                  {msg.photo_url ? (
                    <div onClick={isBlurredForMe ? () => handleUnblur(msg.id) : undefined} style={{ borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", overflow: "hidden", position: "relative", cursor: isBlurredForMe ? "pointer" : "default", border: isMe ? "2px solid #7C3AED66" : "2px solid #2D2D2D", minWidth: 180 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={msg.photo_url} alt="" style={{ display: "block", width: "100%", maxWidth: 240, filter: isBlurredForMe ? "blur(30px)" : "none", transition: "filter 0.3s" }} />
                      {isBlurredForMe && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", color: "#fff", fontWeight: 800, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                          <div style={{ fontSize: 24, marginBottom: 4 }}>👁</div>
                          Tap to reveal
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: "10px 14px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? "linear-gradient(135deg,#7C3AED,#9D5CF0)" : "#2D2D2D", color: "#fff", fontSize: 13, lineHeight: 1.5, boxShadow: isMe ? "0 4px 12px #7C3AED44" : "none" }}>
                      {msg.content}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4, textAlign: isMe ? "right" : "left" }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #2D1B69", display: "flex", gap: 10, alignItems: "center" }}>
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handlePhotoPick} />
          <button onClick={() => fileInputRef.current?.click()} disabled={sending} style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid #2D1B69", background: "#0D0D0D", color: "#9CA3AF", fontSize: 18, cursor: sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            📷
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendText()}
            placeholder="Say something... 😤" disabled={sending}
            style={{ flex: 1, background: "#0D0D0D", border: "1px solid #2D1B69", borderRadius: 24, padding: "10px 16px", fontSize: 13, color: "#F0F0F0", outline: "none", fontFamily: "inherit" }} />
          <button onClick={handleSendText} disabled={sending || !input.trim()} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: input.trim() ? "linear-gradient(135deg,#7C3AED,#9D5CF0)" : "#2D2D2D", color: "#fff", fontSize: 16, cursor: sending || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: input.trim() ? "0 4px 12px #7C3AED55" : "none" }}>
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function RivalsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeRivalry, setActiveRivalry] = useState<RivalryWithOpponent | null>(null);
  const [myRecord, setMyRecord] = useState<UserRivalryRecord>({ wins: 0, losses: 0, ties: 0, cancelled: 0, active: 0 });
  const [theirRecord, setTheirRecord] = useState<UserRivalryRecord>({ wins: 0, losses: 0, ties: 0, cancelled: 0, active: 0 });
  const [queuedAlready, setQueuedAlready] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Matchmaking flow state
  const [matchStep, setMatchStep] = useState<MatchStep>("category");
  const [rivalCategory, setRivalCategory] = useState<RivalCategory | null>(null);
  const [rivalCompetition, setRivalCompetition] = useState<string | null>(null);
  const [rivalTier, setRivalTier] = useState<RivalTier | null>(null);

  // Load initial state: do I have an active rivalry? Am I already queued?
  const loadState = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [rivalry, queueEntry] = await Promise.all([getActiveRivalry(), getQueueEntry()]);
      if (rivalry) {
        setActiveRivalry(rivalry);
        setMatchStep("active");
        const [mine, theirs] = await Promise.all([
          getUserRecord(user.id),
          getUserRecord(rivalry.opponent.id),
        ]);
        setMyRecord(mine);
        setTheirRecord(theirs);
      } else if (queueEntry) {
        // User is waiting in the queue — restore their picks so the UI is consistent
        setActiveRivalry(null);
        setQueuedAlready(true);
        setRivalCategory(queueEntry.category);
        setRivalCompetition(queueEntry.competition_type);
        setRivalTier(queueEntry.tier);
        setMatchStep("matching");
      } else {
        setActiveRivalry(null);
        setQueuedAlready(false);
        setMatchStep("category");
      }
    } catch (e) {
      console.error("Failed to load rivals state:", e);
      setError("Failed to load your rival data. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (!authLoading) loadState(); }, [authLoading, loadState]);

  async function handleSelectTier(t: RivalTier) {
    if (!rivalCategory || !rivalCompetition) return;
    setRivalTier(t);
    setMatchStep("matching");
    setError(null);
    try {
      const matched = await joinQueue({ category: rivalCategory, competition_type: rivalCompetition, tier: t });
      if (matched) {
        // Instant match — skip straight to active view
        await loadState();
      }
      // Otherwise the matching screen's poller will catch the match
    } catch (e: any) {
      setError(e.message || "Failed to join queue");
      setMatchStep("tier");
    }
  }

  function handleCancelMatching() {
    setMatchStep("category");
    setRivalCategory(null);
    setRivalCompetition(null);
    setRivalTier(null);
    setQueuedAlready(false);
  }

  const isActive = matchStep === "active" && activeRivalry && user;

  // ── AUTH / LOADING GUARDS ──
  if (authLoading || loading) {
    return (
      <div style={{ background: "#0D0D0D", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#9CA3AF", fontSize: 14 }}>Loading your rival...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ background: "#0D0D0D", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
        <div style={{ color: "#F0F0F0", fontSize: 18, fontWeight: 800 }}>Sign in to find a rival</div>
        <Link href="/login" style={{ background: "#7C3AED", color: "#fff", padding: "10px 24px", borderRadius: 12, fontWeight: 800, textDecoration: "none" }}>Log in</Link>
      </div>
    );
  }

  return (
    <div style={{ background: "#0D0D0D", minHeight: "100vh" }}>
      <style>{`
        @keyframes headerPulse { 0% { box-shadow: 0 0 0 0 rgba(124,58,237,0.3); } 70% { box-shadow: 0 0 0 12px rgba(124,58,237,0); } 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); } }
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1A0D3E, #0D0D0D)", borderBottom: "1px solid #2D1B69", padding: "20px 24px 0", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Link href="/connect" style={{ color: "#9CA3AF", fontSize: 20, textDecoration: "none", display: "flex", alignItems: "center" }}>←</Link>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 22, color: "#F0F0F0", letterSpacing: -0.5 }}>⚔️ Rivals</div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                {isActive ? `You vs ${activeRivalry!.opponent.full_name}` :
                 matchStep === "matching" ? "Finding your match..." :
                 matchStep === "tier" ? "Pick your tier" :
                 matchStep === "competition" ? "Pick your competition" :
                 "7-day rivalry. No quitting."}
              </div>
            </div>
            {isActive && (
              <div style={{ background: "#EF444422", border: "1px solid #EF444444", borderRadius: 99, padding: "4px 12px", fontSize: 11, fontWeight: 800, color: "#EF4444", animation: "headerPulse 2s infinite" }}>
                🔴 ACTIVE
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 120px" }}>
        {error && (
          <div style={{ background: "#EF444422", border: "1px solid #EF444444", color: "#FCA5A5", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
            {error}
          </div>
        )}

        {matchStep === "category" && (
          <CategorySelect onSelect={(c) => { setRivalCategory(c); setMatchStep("competition"); }} />
        )}

        {matchStep === "competition" && rivalCategory && (
          <CompetitionSelect category={rivalCategory}
            onBack={() => setMatchStep("category")}
            onSelect={(id) => { setRivalCompetition(id); setMatchStep("tier"); }} />
        )}

        {matchStep === "tier" && rivalCategory && rivalCompetition && (
          <TierSelect category={rivalCategory} competition={rivalCompetition}
            onBack={() => setMatchStep("competition")}
            onSelect={handleSelectTier} />
        )}

        {matchStep === "matching" && (
          <MatchingScreen
            category={rivalCategory ?? "running"}
            tier={rivalTier ?? "beginner"}
            onMatched={loadState}
            onCancel={handleCancelMatching}
          />
        )}

        {isActive && activeRivalry && (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            <HeadToHeadPanel rivalry={activeRivalry} myRecord={myRecord} theirRecord={theirRecord} />
            <BadgesPanel rivalryId={activeRivalry.id} myId={user.id} opponentFirstName={activeRivalry.opponent.full_name.split(" ")[0]} />
            <ChatPanel rivalryId={activeRivalry.id} myId={user.id} rivalFirstName={activeRivalry.opponent.full_name.split(" ")[0]} />

            {/* No-cancel reminder */}
            <div style={{ background: "#1A1A1A", borderRadius: 14, border: "1px solid #2D1B69", padding: "14px 18px", fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
              🔒 No cancels. Rivalry auto-resolves {formatTimeLeft(activeRivalry.ends_at).toLowerCase()}.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

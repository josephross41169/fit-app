"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import CouplesPanel from "@/components/CouplesPanel";
import PromptsCard from "@/components/PromptsCard";
import { RIVAL_PROMPTS } from "@/lib/rivalPrompts";
import { supabase } from "@/lib/supabase";
import { forceSyncAllProgress } from "@/lib/syncProgress";
import { BADGES } from "@/lib/badges";
import {
  joinQueue, leaveQueue, getQueueEntry,
  getActiveRivalry, getLiveScores, getUserRecord, resolveExpiredRivalries,
  createChallenge, acceptChallenge, getMyPendingChallenge, cancelChallenge,
  saveMyRivalPromptAnswers,
  getMessages, sendTextMessage, sendPhotoMessage,
  unblurPhoto, subscribeToMessages,
  getRivalryBadges,
  getRivalryActivityStats,
  formatTimeLeft, formatScore,
  COMPETITIONS,
  type RivalCategory, type RivalTier,
  type RivalryWithOpponent, type RivalMessage,
  type UserRivalryRecord, type RivalryBadge,
  type RivalryStat,
} from "@/lib/rivalries";
// Buddy chat counterpart helpers (mirror the rivalries chat API).
// Schema in migration-buddy-chat.sql — table: buddy_chat_messages.
import {
  getBuddyMessages, sendBuddyTextMessage, sendBuddyPhotoMessage,
  unblurBuddyPhoto, subscribeToBuddyMessages,
  type BuddyMessage,
} from "@/lib/buddyChat";

// ─────────────────────────────────────────────────────────────────────────────
// STATIC CONFIG (unchanged from original — just the visual catalog)
// ─────────────────────────────────────────────────────────────────────────────

type MatchStep = "category" | "competition" | "tier" | "launch" | "challenge" | "matching" | "active";

const CATEGORIES: { id: RivalCategory; emoji: string; name: string; desc: string }[] = [
  { id: "running",   emoji: "🏃", name: "Running",       desc: "Miles, pace, and endurance"     },
  { id: "walking",   emoji: "🚶", name: "Walking",       desc: "Steps, distance, consistency"    },
  { id: "biking",    emoji: "🚴", name: "Biking",        desc: "Miles, climbs, and speed"        },
  { id: "lifting",   emoji: "🏋️", name: "Lifting",       desc: "Volume, PRs, and raw strength"  },
  { id: "swimming",  emoji: "🏊", name: "Swimming",      desc: "Laps, distance, and stroke"      },
  { id: "rowing",    emoji: "🚣", name: "Rowing",        desc: "Meters, distance, and power"    },
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
    color: "#5BBE93", bg: "linear-gradient(135deg, #064E3B, #065F46)", border: "#5BBE9355", glow: "#5BBE9333" },
  { id: "intermediate", emoji: "⚡", name: "Intermediate", desc: "Consistent and climbing — real competition",
    color: "#5BBE93", bg: "linear-gradient(135deg, #1A0D3E, #1E3D34)", border: "#5BBE9388", glow: "#5BBE9344" },
  { id: "mayhem",       emoji: "💀", name: "Mayhem",       desc: "No days off. Absolute grind. Not for everyone.",
    color: "#EF4444", bg: "linear-gradient(135deg, #1A0000, #3B0A0A, #1A0000)", border: "#EF444488", glow: "#EF444455" },
];

// Rivalry-specific badges (separate from app-wide badge catalog).
// These are the ones you can earn inside a single 7-day rivalry.
// Rivalry-specific badges (separate from app-wide badge catalog).
// These are the ones you can earn inside a single 7-day rivalry.
// Ordered by narrative: timing (start → daily) → consistency → mid-fight
// drama → endgame.
const RIVALRY_BADGE_CATALOG: { key: string; emoji: string; name: string; desc: string;
  gradient: string; border: string; glow: string; label: string }[] = [
  { key: "first_blood",   emoji: "⚔️", name: "First Blood",   desc: "First log of the rivalry",
    gradient: "linear-gradient(135deg,#9CA3AF,#E5E7EB)", border: "#9CA3AF", glow: "#9CA3AF44", label: "SILVER" },
  { key: "early_bird",    emoji: "🌅", name: "Early Bird",    desc: "Logged a morning workout 2 days in a row",
    gradient: "linear-gradient(135deg,#F5A623,#F59E0B)", border: "#F5A623", glow: "#F5A62344", label: "GOLD" },
  { key: "night_owl",     emoji: "🌙", name: "Night Owl",     desc: "Logged a workout after 10pm 2 days in a row",
    gradient: "linear-gradient(135deg,#1E1B4B,#6366F1)", border: "#6366F1", glow: "#6366F144", label: "MIDNIGHT" },
  { key: "perfect_week",  emoji: "💯", name: "Perfect Week",  desc: "Logged on every day of the rivalry",
    gradient: "linear-gradient(135deg,#059669,#10B981)", border: "#10B981", glow: "#10B98144", label: "EMERALD" },
  { key: "quick_strike",  emoji: "⚡", name: "Quick Strike",  desc: "Logged within 1 hour of your rival's log",
    gradient: "linear-gradient(135deg,#FCD34D,#F59E0B)", border: "#F59E0B", glow: "#F59E0B44", label: "BOLT" },
  { key: "comeback",      emoji: "🔄", name: "Comeback",      desc: "Flipped a deficit to a lead",
    gradient: "linear-gradient(135deg,#5BBE93,#A855F7)", border: "#5BBE93", glow: "#5BBE9344", label: "ELECTRIC" },
  { key: "untouchable",   emoji: "💀", name: "Untouchable",   desc: "Won without ever being behind",
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

// Draft picks are stored in localStorage so users don't lose progress when they
// navigate away mid-selection. Cleared when they actually enter the queue.
const DRAFT_KEY = "rivals:draft";
type Draft = {
  step: MatchStep;
  category: RivalCategory | null;
  competition: string | null;
};
function saveDraft(d: Draft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
}
function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) as Draft : null;
  } catch { return null; }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
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
      <div style={{ background: "linear-gradient(135deg, #1A0D3E, #1E3D34, #1A0D3E)", borderRadius: 24, padding: "32px 28px", marginBottom: 32, border: "1px solid #5BBE9355", position: "relative", overflow: "hidden", boxShadow: "0 8px 40px rgba(124,58,237,0.2)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, transparent, #5BBE9366, transparent)", animation: "scanLine 3s ease-in-out infinite", pointerEvents: "none" }} />
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
              style={{ background: isHov ? "linear-gradient(135deg, #1A0D3E, #1E3D34)" : "#161D19", border: `2px solid ${isHov ? "#5BBE93" : "#1E3D34"}`, borderRadius: 20, padding: "22px 16px", cursor: "pointer", textAlign: "center", animation: `fadeUp 0.4s ease ${i * 0.06}s both`, transition: "all 0.2s", boxShadow: isHov ? "0 0 24px rgba(124,58,237,0.35)" : "none", outline: "none" }}>
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
        <button onClick={onBack} style={{ background: "#161D19", border: "1px solid #1E3D34", borderRadius: 12, width: 40, height: 40, color: "#9CA3AF", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#F0F0F0" }}>{cat.emoji} {cat.name}</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>Pick your competition</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {options.map((opt, i) => (
          <button key={opt.id} onClick={() => onSelect(opt.id)}
            style={{ background: "#161D19", border: "2px solid #1E3D34", borderRadius: 16, padding: "18px 20px", cursor: "pointer", textAlign: "left", animation: `fadeUp 0.35s ease ${i * 0.06}s both`, transition: "border-color 0.2s, box-shadow 0.2s", outline: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#5BBE93"; e.currentTarget.style.boxShadow = "0 0 20px rgba(124,58,237,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1E3D34"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#F0F0F0" }}>{opt.label}</div>
            <div style={{ color: "#5BBE93", fontSize: 18, fontWeight: 900 }}>→</div>
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
        <button onClick={onBack} style={{ background: "#161D19", border: "1px solid #1E3D34", borderRadius: 12, width: 40, height: 40, color: "#9CA3AF", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
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
              style={{ background: isHov || isMayhem ? tier.bg : "#161D19", border: `2px solid ${isHov ? tier.color : tier.border}`, borderRadius: 20, padding: "24px 22px", cursor: "pointer", textAlign: "left", animation: `fadeUp 0.35s ease ${i * 0.1}s both${isMayhem ? ", mayhemFlicker 6s ease-in-out infinite" : ""}`, transition: "border-color 0.2s, box-shadow 0.2s", boxShadow: isHov ? `0 0 28px ${tier.glow}` : isMayhem ? `0 4px 24px ${tier.glow}` : "none", outline: "none", position: "relative", overflow: "hidden" }}>
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

// Invisible poller used on the challenge-code screen: when the recipient
// accepts the code, a rivalry appears, and the challenger auto-advances.
function ChallengePoller({ onMatched }: { onMatched: () => void }) {
  useEffect(() => {
    const interval = setInterval(async () => {
      const rivalry = await getActiveRivalry();
      if (rivalry) { clearInterval(interval); onMatched(); }
    }, 8000);
    return () => clearInterval(interval);
  }, [onMatched]);
  return null;
}

function MatchingScreen({ category, tier, onMatched, onCancel }: {
  category: RivalCategory; tier: RivalTier;
  onMatched: () => void; onCancel: () => void;
}) {
  const cat = getCategoryLabel(category);
  const t = getTierLabel(tier);
  const [elapsed, setElapsed] = useState(0);

  // Poll for active rivalry every 8 seconds (someone else might match with us).
  // Was 3s; the user is staring at a "searching..." spinner so they cannot
  // perceive a difference between 3s and 8s, but the DB query frequency
  // matters at scale.
  useEffect(() => {
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      const rivalry = await getActiveRivalry();
      if (rivalry) {
        clearInterval(interval);
        onMatched();
      }
    }, 8000);
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
      <button onClick={handleCancel} style={{ background: "transparent", border: "1px solid #1E3D34", borderRadius: 12, padding: "10px 24px", color: "#9CA3AF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        Cancel search
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAD-TO-HEAD PANEL (real data) — redesigned with profile face-off cards
// + per-category recent activity comparison
// ─────────────────────────────────────────────────────────────────────────────

// Avatar with photo or initials fallback. Used by both profile cards.
// `accent` is the user's side-color (purple for me, red for opponent) which
// drives the border + glow. `glow` toggles the highlight when this side is
// currently winning the rivalry.
function RivalAvatar({ name, url, videoUrl, accent, glow, size = 88 }: {
  name: string;
  url: string | null;
  /** Optional Live Photo / video URL (avatar_video_url on users).
   *  When set, renders a looping muted <video> in the same slot as
   *  the still <img>. Joey: "make it so the moving profile picture
   *  works everywhere your profile picture is seen." */
  videoUrl?: string | null;
  accent: string;
  glow: boolean;
  size?: number;
}) {
  const initials = (name || "?").split(" ").map(p => p[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "?";
  const baseStyle: React.CSSProperties = {
    width: size, height: size, borderRadius: "50%", margin: "0 auto",
    border: `3px solid ${glow ? accent : `${accent}55`}`,
    boxShadow: glow ? `0 0 24px ${accent}66` : "none",
    transition: "box-shadow 0.3s, border-color 0.3s",
    objectFit: "cover" as const,
    background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 900, fontSize: size * 0.32,
    overflow: "hidden",
  };
  if (videoUrl) {
    // Loop continuously rather than the 10s cycle the big profile-page
    // avatar uses. At this size (88px in the vs card) continuous motion
    // looks smooth; pause-then-replay would feel like glitching.
    return <video src={videoUrl} poster={url || undefined} autoPlay muted loop playsInline preload="metadata" style={baseStyle} />;
  }
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} style={baseStyle} />;
  }
  return <div style={baseStyle}>{initials}</div>;
}

// Per-user profile column inside the face-off card. Compact, info-dense:
// avatar → name + @handle → city pill → record pill → bio.
// Bio is clamped to 2 lines so a long bio doesn't push the layout around.
function RivalProfileCard({
  name, username, avatarUrl, avatarVideoUrl, city, bio,
  record, accent, glow, scoreLabel, score,
}: {
  name: string;
  username: string;
  avatarUrl: string | null;
  /** Optional Live Photo / 5-second video for the avatar. Plumbed down
   *  to RivalAvatar so the rival's animated profile picture shows on
   *  the vs card, not just on their profile page. */
  avatarVideoUrl?: string | null;
  city: string | null;
  bio: string | null;
  record: { wins: number; losses: number };
  accent: string;
  glow: boolean;
  scoreLabel: string;
  score: string;
}) {
  const total = record.wins + record.losses;
  const winRate = total > 0 ? Math.round((record.wins / total) * 100) : 0;
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
      <RivalAvatar name={name} url={avatarUrl} videoUrl={avatarVideoUrl} accent={accent} glow={glow} />
      <div style={{ marginTop: 12, fontWeight: 900, fontSize: 16, color: "#F0F0F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </div>
      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>@{username}</div>

      {/* City + record pills — wrap on narrow screens */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 10 }}>
        {city && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#0E1311", border: `1px solid ${accent}33`, borderRadius: 99, padding: "3px 9px", fontSize: 10, color: "#D1D5DB", fontWeight: 700 }}>
            📍 {city.split(",")[0].trim()}
          </span>
        )}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: `${accent}18`, border: `1px solid ${accent}44`, borderRadius: 99, padding: "3px 9px", fontSize: 10, color: accent, fontWeight: 800 }}>
          {record.wins}-{record.losses} · {winRate}%
        </span>
      </div>

      {/* Bio — italicized so it reads like a tagline. Two-line clamp. */}
      {bio && bio.trim().length > 0 && (
        <div style={{
          fontSize: 11, color: "#9CA3AF", fontStyle: "italic",
          lineHeight: 1.4, marginBottom: 12, padding: "0 4px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          “{bio.trim()}”
        </div>
      )}

      {/* Live score for this side */}
      <div style={{ background: "#0E1311", borderRadius: 12, padding: "10px 8px", border: `1px solid ${accent}33` }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{scoreLabel}</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: accent }}>{score}</div>
      </div>
    </div>
  );
}

// Side-by-side recent-activity comparison. Three rows of stats per side,
// labels in the middle column. Stats come from getRivalryActivityStats —
// label set is determined by category (running gets miles/runs/longest,
// lifting gets sessions/volume/duration, etc).
function RivalStatsCompare({ myStats, theirStats, opponentName }: {
  myStats: RivalryStat[];
  theirStats: RivalryStat[];
  opponentName: string;
}) {
  // Both arrays should be the same length (same category) but defensively
  // pad to the longer one so the grid doesn't get lopsided if one user
  // somehow has fewer stats.
  const maxLen = Math.max(myStats.length, theirStats.length);
  if (maxLen === 0) return null;

  return (
    <div style={{ background: "#1A0D3E33", borderRadius: 18, border: "1px solid #1E3D34", padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, textAlign: "center" }}>
        📊 Last 4 weeks at a glance
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: maxLen }).map((_, i) => {
          const mine  = myStats[i]    || { label: "", value: "—" };
          const theirs = theirStats[i] || { label: "", value: "—" };
          const label = mine.label || theirs.label;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#5BBE93", textAlign: "right" }}>{mine.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5, minWidth: 100 }}>{label}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#EF4444", textAlign: "left" }}>{theirs.value}</div>
            </div>
          );
        })}
      </div>
      {/* Footer hint so users know whose number is whose */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", marginTop: 12, paddingTop: 10, borderTop: "1px solid #1E3D34", fontSize: 10, fontWeight: 700, color: "#6B7280" }}>
        <div style={{ textAlign: "right", color: "#5BBE93" }}>YOU</div>
        <div style={{ minWidth: 100 }}></div>
        <div style={{ textAlign: "left", color: "#EF4444" }}>{opponentName.toUpperCase()}</div>
      </div>
    </div>
  );
}

function HeadToHeadPanel({ rivalry, myRecord, theirRecord }: {
  rivalry: RivalryWithOpponent;
  myRecord: UserRivalryRecord;
  theirRecord: UserRivalryRecord;
}) {
  const { user } = useAuth();
  const cat = getCategoryLabel(rivalry.category);
  const t = getTierLabel(rivalry.tier);
  const [liveScores, setLiveScores] = useState({ my_score: rivalry.my_score, their_score: rivalry.their_score });
  const [timeLeft, setTimeLeft] = useState(formatTimeLeft(rivalry.ends_at));
  const [myStats, setMyStats] = useState<RivalryStat[]>([]);
  const [theirStats, setTheirStats] = useState<RivalryStat[]>([]);

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

  // Load 4-week activity stats for both users in parallel. Runs once on
  // mount + when category changes (which would only happen if the user
  // started a new rivalry, in which case the whole panel remounts anyway).
  // Stats don't need to refresh while the rivalry is live — the live
  // SCORE above already reflects in-rivalry progress; this panel is about
  // historical context for who you're up against.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      getRivalryActivityStats(user.id, rivalry.category),
      getRivalryActivityStats(rivalry.opponent.id, rivalry.category),
    ]).then(([mine, theirs]) => {
      if (cancelled) return;
      setMyStats(mine);
      setTheirStats(theirs);
    });
    return () => { cancelled = true; };
  }, [user, rivalry.category, rivalry.opponent.id]);

  const iAhead = liveScores.my_score > liveScores.their_score;
  const rivalAhead = liveScores.their_score > liveScores.my_score;

  // My profile values — pulled from the auth context. `city` isn't in the
  // typed AuthUser interface but is selected by the `*` query in fetchProfile,
  // so we cast through any to read it. Falls back gracefully if missing.
  const myProfile = (user?.profile as any) || {};
  const myName = myProfile.full_name || "You";
  const myUsername = myProfile.username || "you";
  const myAvatar = myProfile.avatar_url || null;
  // Same plumbing as the opponent's video URL — pulled from the
  // current user's profile so the user's own animated avatar shows
  // on the vs card alongside their opponent's.
  const myAvatarVideoUrl = (myProfile as any).avatar_video_url || null;
  const myCity = myProfile.city || null;
  const myBio = myProfile.bio || null;
  const opponentFirstName = rivalry.opponent.full_name.split(" ")[0];

  return (
    <div>
      <style>{`
        @keyframes h2hGlow { 0% { box-shadow: 0 0 20px 4px #EF444433, 0 0 40px 10px #5BBE9322; } 50% { box-shadow: 0 0 30px 8px #EF444455, 0 0 60px 18px #5BBE9333; } 100% { box-shadow: 0 0 20px 4px #EF444433, 0 0 40px 10px #5BBE9322; } }
        @keyframes vsFloat { 0% { transform: scale(1) rotate(-3deg); } 50% { transform: scale(1.08) rotate(3deg); } 100% { transform: scale(1) rotate(-3deg); } }
      `}</style>

      {/* Category + competition + tier + countdown badges */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#161D19", border: "1px solid #1E3D34", borderRadius: 99, padding: "6px 14px", fontSize: 13, color: "#F0F0F0", fontWeight: 800 }}>
          {cat.emoji} {cat.name}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#161D19", border: "1px solid #1E3D34", borderRadius: 99, padding: "6px 14px", fontSize: 13, color: "#F0F0F0", fontWeight: 800 }}>
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

      {/* ── Profile face-off card ────────────────────────────────────────── */}
      {/* Two-column flex with VS divider in the middle. The columns auto-collapse
          on narrow screens (mobile flex behavior keeps things readable). */}
      <div style={{ background: "linear-gradient(135deg, #1A0D3E, #161D19, #1A0A0A)", borderRadius: 24, border: "2px solid #EF444455", padding: "24px 16px", marginBottom: 20, animation: "h2hGlow 3s ease-in-out infinite", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 30% 50%, #5BBE9314 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, #EF444414 0%, transparent 60%)" }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "relative", zIndex: 1 }}>
          <RivalProfileCard
            name={myName}
            username={myUsername}
            avatarUrl={myAvatar}
            avatarVideoUrl={myAvatarVideoUrl}
            city={myCity}
            bio={myBio}
            record={{ wins: myRecord.wins, losses: myRecord.losses }}
            accent="#5BBE93"
            glow={iAhead}
            scoreLabel="You"
            score={formatScore(rivalry.category, rivalry.competition_type, liveScores.my_score)}
          />

          {/* VS divider — sits at the top so it stays even with the avatars
              regardless of how tall each side's bio/city block grows */}
          <div style={{ flexShrink: 0, paddingTop: 28 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg, #161D19, #1E3D34)", border: "2px solid #5BBE9366", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#5BBE93", animation: "vsFloat 3s ease-in-out infinite", boxShadow: "0 0 20px #5BBE9333" }}>VS</div>
          </div>

          <RivalProfileCard
            name={rivalry.opponent.full_name}
            username={rivalry.opponent.username}
            avatarUrl={rivalry.opponent.avatar_url}
            avatarVideoUrl={(rivalry.opponent as any).avatar_video_url}
            city={rivalry.opponent.city}
            bio={rivalry.opponent.bio}
            record={{ wins: theirRecord.wins, losses: theirRecord.losses }}
            accent="#EF4444"
            glow={rivalAhead}
            scoreLabel={opponentFirstName}
            score={formatScore(rivalry.category, rivalry.competition_type, liveScores.their_score)}
          />
        </div>
      </div>

      {/* ── Last 4 weeks comparison ──────────────────────────────────────── */}
      <RivalStatsCompare myStats={myStats} theirStats={theirStats} opponentName={opponentFirstName} />
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
              background: earnedBy ? badge.gradient : "#161D19",
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
  // Ref to the chat's scrollable container (overflow:auto, height:380).
  // We scroll it DIRECTLY via .scrollTop instead of using scrollIntoView,
  // which had a tendency to bubble up the parent chain and nudge the
  // page window even with block:"nearest". Touching scrollTop on the
  // container itself can't escape the container.
  const chatScrollRef = useRef<HTMLDivElement>(null);
  // Track whether this is the FIRST time messages populated for this
  // rivalry, AND the previous messages.length so we can distinguish
  // "new message arrived" (length grew) from "existing message updated"
  // (length unchanged — e.g. blur reveal, edit, read receipt). Auto-
  // scroll should only fire on net additions, never on the initial load
  // and never on in-place mutations.
  const initialMessagesLoadRef = useRef(true);
  const lastMessagesLengthRef = useRef(0);
  useEffect(() => {
    // Reset both flags whenever the rivalry changes — switching to a
    // different rivalry should also start at the natural top with no
    // auto-scroll.
    initialMessagesLoadRef.current = true;
    lastMessagesLengthRef.current = 0;
  }, [rivalryId]);

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

  useEffect(() => {
    if (initialMessagesLoadRef.current) {
      // First populate of messages for this rivalry — record the length
      // baseline and bail without scrolling.
      initialMessagesLoadRef.current = false;
      lastMessagesLengthRef.current = messages.length;
      return;
    }
    // Only react to net additions, not in-place updates. A blur reveal
    // or message edit fires this effect via setMessages but the array
    // length doesn't change — there's nothing new to scroll to.
    if (messages.length <= lastMessagesLengthRef.current) {
      lastMessagesLengthRef.current = messages.length;
      return;
    }
    lastMessagesLengthRef.current = messages.length;
    // Scroll the chat container DIRECTLY. Touching .scrollTop on the
    // overflow:auto element can't bubble up to the window like
    // scrollIntoView could, so the page never moves.
    const el = chatScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
      <div style={{ background: "#161D19", borderRadius: 20, border: "1px solid #1E3D34", overflow: "hidden" }}>
        <div ref={chatScrollRef} style={{ padding: "16px", height: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
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
                    <div onClick={isBlurredForMe ? () => handleUnblur(msg.id) : undefined} style={{ borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", overflow: "hidden", position: "relative", cursor: isBlurredForMe ? "pointer" : "default", border: isMe ? "2px solid #5BBE9366" : "2px solid #2D2D2D", minWidth: 180 }}>
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
                    <div style={{ padding: "10px 14px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? "linear-gradient(135deg,#5BBE93,#9D5CF0)" : "#2D2D2D", color: "#fff", fontSize: 13, lineHeight: 1.5, boxShadow: isMe ? "0 4px 12px #5BBE9344" : "none" }}>
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
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1E3D34", display: "flex", gap: 10, alignItems: "center" }}>
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handlePhotoPick} />
          <button onClick={() => fileInputRef.current?.click()} disabled={sending} style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid #1E3D34", background: "#0E1311", color: "#9CA3AF", fontSize: 18, cursor: sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            📷
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendText()}
            placeholder="Say something... 😤" disabled={sending}
            style={{ flex: 1, background: "#0E1311", border: "1px solid #1E3D34", borderRadius: 24, padding: "10px 16px", fontSize: 13, color: "#F0F0F0", outline: "none", fontFamily: "inherit" }} />
          <button onClick={handleSendText} disabled={sending || !input.trim()} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: input.trim() ? "linear-gradient(135deg,#5BBE93,#9D5CF0)" : "#2D2D2D", color: "#fff", fontSize: 16, cursor: sending || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: input.trim() ? "0 4px 12px #5BBE9355" : "none" }}>
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDDY CHAT — mirrors RivalChat but for the workout-buddy pairing.
//
// Key differences from RivalChat:
//   - Talks to buddy_chat_messages instead of rival_messages
//     (separate table — see migration-buddy-chat.sql)
//   - Keyed by buddy match.id (matchId), not rivalryId
//   - Friendlier palette (green/blue gradient instead of red/purple
//     trash-talk look) since buddies are cooperative
//   - Default empty-state copy + input placeholder are encouraging,
//     not antagonistic
//   - "buddyFirstName" instead of "rivalFirstName" for avatar initials
//
// Everything else (auto-scroll-only-on-net-additions, blur photos until
// reveal, realtime subscription) intentionally identical so users
// switching between rivals and buddies have a consistent experience.
// ─────────────────────────────────────────────────────────────────────────────
function BuddyChat({ matchId, myId, buddyFirstName }: {
  matchId: string; myId: string; buddyFirstName: string;
}) {
  const [messages, setMessages] = useState<BuddyMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Scroll-management refs — same pattern as RivalChat. We scroll the
  // chat container DIRECTLY via .scrollTop so the page never jumps;
  // initialMessagesLoadRef skips the first-load scroll; length tracking
  // ignores in-place updates (blur reveal) so they don't trigger scrolls.
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const initialMessagesLoadRef = useRef(true);
  const lastMessagesLengthRef = useRef(0);
  useEffect(() => {
    initialMessagesLoadRef.current = true;
    lastMessagesLengthRef.current = 0;
  }, [matchId]);

  // Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const msgs = await getBuddyMessages(matchId);
      if (!cancelled) setMessages(msgs);
    }
    load();

    const unsub = subscribeToBuddyMessages(
      matchId,
      (newMsg) => setMessages((prev) => {
        if (prev.find((m) => m.id === newMsg.id)) return prev; // dedupe
        return [...prev, newMsg];
      }),
      (updated) => setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m)),
    );

    return () => { cancelled = true; unsub(); };
  }, [matchId]);

  useEffect(() => {
    if (initialMessagesLoadRef.current) {
      initialMessagesLoadRef.current = false;
      lastMessagesLengthRef.current = messages.length;
      return;
    }
    if (messages.length <= lastMessagesLengthRef.current) {
      lastMessagesLengthRef.current = messages.length;
      return;
    }
    lastMessagesLengthRef.current = messages.length;
    const el = chatScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSendText() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendBuddyTextMessage(matchId, trimmed);
      setInput("");
    } catch (e) {
      console.error("Buddy send failed:", e);
    } finally {
      setSending(false);
    }
  }

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || sending) return;
    setSending(true);
    try {
      await sendBuddyPhotoMessage(matchId, file);
    } catch (err) {
      console.error("Buddy photo send failed:", err);
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleUnblur(messageId: string) {
    // Optimistic update; revert if server rejects.
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, is_blurred: false } : m));
    try {
      await unblurBuddyPhoto(messageId);
    } catch (e) {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, is_blurred: true } : m));
      console.error("Buddy unblur failed:", e);
    }
  }

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 6 }}>💬 Buddy Chat</div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>Cheer each other on. Share the wins.</div>
      <div style={{ background: "#161D19", borderRadius: 20, border: "1px solid #1E40AF44", overflow: "hidden" }}>
        <div ref={chatScrollRef} style={{ padding: "16px", height: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ margin: "auto", color: "#6B7280", fontSize: 13, textAlign: "center" }}>
              No messages yet. Say hi 👋
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === myId;
            const isBlurredForMe = msg.is_blurred && !isMe;
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
                {!isMe && (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#3B82F6,#4ADE80)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>
                    {buddyFirstName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ maxWidth: "72%" }}>
                  {msg.photo_url ? (
                    <div onClick={isBlurredForMe ? () => handleUnblur(msg.id) : undefined} style={{ borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", overflow: "hidden", position: "relative", cursor: isBlurredForMe ? "pointer" : "default", border: isMe ? "2px solid #3B82F666" : "2px solid #2D2D2D", minWidth: 180 }}>
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
                    <div style={{ padding: "10px 14px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? "linear-gradient(135deg,#3B82F6,#4ADE80)" : "#2D2D2D", color: "#fff", fontSize: 13, lineHeight: 1.5, boxShadow: isMe ? "0 4px 12px #3B82F644" : "none" }}>
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
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1E40AF44", display: "flex", gap: 10, alignItems: "center" }}>
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handlePhotoPick} />
          <button onClick={() => fileInputRef.current?.click()} disabled={sending} style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid #1E40AF44", background: "#0E1311", color: "#9CA3AF", fontSize: 18, cursor: sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            📷
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendText()}
            placeholder="Send your buddy a message... 💪" disabled={sending}
            style={{ flex: 1, background: "#0E1311", border: "1px solid #1E40AF44", borderRadius: 24, padding: "10px 16px", fontSize: 13, color: "#F0F0F0", outline: "none", fontFamily: "inherit" }} />
          <button onClick={handleSendText} disabled={sending || !input.trim()} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: input.trim() ? "linear-gradient(135deg,#3B82F6,#4ADE80)" : "#2D2D2D", color: "#fff", fontSize: 16, cursor: sending || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: input.trim() ? "0 4px 12px #3B82F655" : "none" }}>
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

// ─────────────────────────────────────────────────────────────────────────────
// WORKOUT BUDDY PANEL
// ─────────────────────────────────────────────────────────────────────────────
//
// Cooperative 2-week challenge. Same matchmaking shape as rivals (pick
// category, pick tier, queue) but the result is shared progress —  both
// users hit the target = both win. No head-to-head competition.
//
// Categories supported: running, walking, biking, lifting, swimming, combat.
// Targets defined server-side in /api/db buddy_request_match.

const BUDDY_CATEGORIES: Array<{ id: string; emoji: string; name: string; desc: string }> = [
  { id: "running",  emoji: "🏃", name: "Running",  desc: "Miles together over 14 days" },
  { id: "walking",  emoji: "🚶", name: "Walking",  desc: "Steps & miles, low intensity" },
  { id: "biking",   emoji: "🚴", name: "Biking",   desc: "Cycling miles total" },
  { id: "lifting",  emoji: "🏋️", name: "Lifting",  desc: "Workout sessions" },
  { id: "swimming", emoji: "🏊", name: "Swimming", desc: "Pool time" },
  { id: "rowing",   emoji: "🚣", name: "Rowing",   desc: "Meters together over 14 days" },
  { id: "combat",   emoji: "🥊", name: "Combat",   desc: "Boxing / MMA sessions" },
];

const BUDDY_TIERS: Array<{ id: string; label: string; desc: string }> = [
  { id: "beginner",     label: "🌱 Beginner",     desc: "Lower target, more forgiving" },
  { id: "intermediate", label: "🔥 Intermediate", desc: "Mid-tier · standard difficulty" },
  { id: "elite",        label: "💎 Elite",        desc: "High target · only the committed" },
];

// ─── BUDDY INTAKE FORM ───────────────────────────────────────────────────────
// Shown the first time a user tries to find a buddy. Collects three required
// fields the "Meet your buddy" card uses: city, immediate goal, and hobbies.
// All three are required — Joey's call: people shouldn't be able to queue
// without filling these in, otherwise their match-mate sees a blank profile
// and the personalization card adds nothing.
//
// Inputs are local state, seeded from the parent's `me` row when present so
// users with partial profiles can edit instead of starting from scratch.
// `onSaved` is called after a successful supabase update; the parent then
// refreshes its own state and routes the user to the matchmaking flow.
function BuddyIntakeForm({
  me,
  userId,
  onSaved,
  onCancel,
}: {
  me: any | null;
  userId: string;
  onSaved: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [city, setCity] = useState<string>(me?.city || "");
  const [immediateGoal, setImmediateGoal] = useState<string>(me?.immediate_goal || "");
  const [hobbies, setHobbies] = useState<string>(me?.hobbies || "");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Re-seed inputs when the parent reloads `me` — handles the edge case
  // where the form is open during a poll that fetches updated profile
  // data. Without this, the locally-edited values would silently
  // resync to whatever's on the server.
  useEffect(() => {
    if (!me) return;
    setCity(prev => (prev ? prev : me.city || ""));
    setImmediateGoal(prev => (prev ? prev : me.immediate_goal || ""));
    setHobbies(prev => (prev ? prev : me.hobbies || ""));
  }, [me]);

  const cityTrim = city.trim();
  const goalTrim = immediateGoal.trim();
  const hobbiesTrim = hobbies.trim();
  const allFilled = cityTrim.length > 0 && goalTrim.length > 0 && hobbiesTrim.length > 0;

  async function save() {
    if (!allFilled || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      // Cast `supabase as any` because the generated database types
      // don't yet know about immediate_goal / hobbies. Project has
      // ignoreBuildErrors so this is belt-and-suspenders for local
      // typecheck cleanliness — once types regenerate post-migration
      // the cast can come off.
      const { error } = await (supabase as any)
        .from("users")
        .update({
          city: cityTrim,
          immediate_goal: goalTrim,
          hobbies: hobbiesTrim,
        })
        .eq("id", userId);
      if (error) {
        // Most likely failure mode: the migration adding immediate_goal
        // and hobbies hasn't been run on the database yet. The error
        // message from PostgREST in that case will name the column
        // ("column users.immediate_goal does not exist"), so we surface
        // the raw message instead of a generic "save failed" — easier
        // to diagnose during the rollout.
        setErr(error.message || "Could not save. Please try again.");
        setSubmitting(false);
        return;
      }
      await onSaved();
    } catch (e: any) {
      setErr(e?.message || "Could not save. Please try again.");
      setSubmitting(false);
    }
  }

  // Reused styling for each text input — labelled, dark, full width.
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0E1311",
    border: "1px solid #1E3D34",
    borderRadius: 12,
    padding: "12px 14px",
    color: "#F0F0F0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 800,
    color: "#86CFAE",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  };

  return (
    <div>
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            background: "transparent", border: "none", color: "#9CA3AF",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            marginBottom: 12, padding: 0,
          }}
        >← Back</button>
      )}

      {/* Hero — explains why we're asking before the user can queue */}
      <div style={{
        background: "linear-gradient(135deg, #1A0D3E, #1E3D34, #1A0D3E)",
        borderRadius: 24,
        padding: "28px 24px",
        marginBottom: 18,
        border: "1px solid #5BBE9355",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>👋</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: "#fff", marginBottom: 6, letterSpacing: -0.5 }}>
          Tell your future buddy about you
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, maxWidth: 360, margin: "0 auto" }}>
          Three quick prompts — your buddy sees these on their <em>Meet your buddy</em> card. <strong style={{ color: "#86CFAE" }}>Required before matching.</strong>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label htmlFor="buddy-city" style={labelStyle}>📍 City / State</label>
          <input
            id="buddy-city"
            type="text"
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="e.g. Austin, TX"
            maxLength={80}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="buddy-goal" style={labelStyle}>🎯 Most immediate goal</label>
          <textarea
            id="buddy-goal"
            value={immediateGoal}
            onChange={e => setImmediateGoal(e.target.value)}
            placeholder="What are you training for right now?"
            maxLength={200}
            rows={2}
            style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
          />
          <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4, textAlign: "right" }}>
            {goalTrim.length}/200
          </div>
        </div>

        <div>
          <label htmlFor="buddy-hobbies" style={labelStyle}>🎨 What you do for fun</label>
          <textarea
            id="buddy-hobbies"
            value={hobbies}
            onChange={e => setHobbies(e.target.value)}
            placeholder="Outside the gym — hiking, gaming, cooking, whatever"
            maxLength={200}
            rows={2}
            style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
          />
          <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4, textAlign: "right" }}>
            {hobbiesTrim.length}/200
          </div>
        </div>

        {err && (
          <div style={{
            padding: "10px 12px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 10,
            color: "#FCA5A5",
            fontSize: 12,
            lineHeight: 1.4,
          }}>{err}</div>
        )}

        <button
          onClick={save}
          disabled={!allFilled || submitting}
          style={{
            background: !allFilled || submitting
              ? "rgba(124,58,237,0.25)"
              : "linear-gradient(135deg, #5BBE93, #86CFAE)",
            border: "none",
            borderRadius: 14,
            padding: "14px 20px",
            color: !allFilled || submitting ? "#9CA3AF" : "#fff",
            fontWeight: 900,
            fontSize: 15,
            cursor: !allFilled || submitting ? "not-allowed" : "pointer",
            marginTop: 4,
            letterSpacing: 0.3,
          }}
        >
          {submitting ? "Saving…" : allFilled ? "Continue to matchmaking →" : "Fill in all three to continue"}
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
        You can update these any time from your profile settings.
      </div>
    </div>
  );
}

function BuddyPanel({ userId }: { userId: string }) {
  // ── STATE MACHINE (multi-buddy) ────────────────────────────────────────
  // Three top-level views:
  //   1. List view (default when matches.length > 0): shows every active
  //      buddy as a card, plus a "Find another buddy" CTA. Tapping a
  //      buddy card opens its detail view via selectedMatchId.
  //   2. Detail view (selectedMatchId set): full progress display for
  //      one buddy, with a back button to return to the list.
  //   3. Matchmaking flow (step !== "list"): the original
  //      category → tier → queued chain. Triggered by tapping
  //      "Find another buddy" or by mounting with no matches.
  //
  // `step` drives the matchmaking flow. `selectedMatchId` overrides
  // everything to render detail view. `matches` is the list of every
  // active buddy match this user is in.
  const [step, setStep] = useState<"list" | "intake" | "category" | "tier" | "queued">("category");
  // Current user's own profile fields, returned alongside the buddy
  // matches by buddy_get_active_match. We use city + immediate_goal +
  // hobbies to decide whether the user can proceed to matchmaking, or
  // needs to fill out the intake form first. Refreshed on every
  // loadState() poll so a save in the intake form is reflected next
  // tick without a manual refetch.
  const [me, setMe] = useState<any | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  // Loaded gate prevents the category picker from flashing on screen for
  // users who already have a match — used to be reported as a "random
  // refresh" every time the user switched to the Buddy tab.
  const [loaded, setLoaded] = useState(false);
  // Track the previous matches count so we can auto-return to list view
  // when a new match arrives (poll resolves with a higher length).
  const prevMatchCountRef = useRef(0);
  // Enriched profile card data for the currently-selected buddy (city,
  // bio, level, pinned badges, recent badge, current goal). Loaded lazily
  // when the user opens a detail view so the list view stays cheap.
  // Cleared between selections so a previous buddy's data doesn't flash
  // when switching.
  const [buddyProfile, setBuddyProfile] = useState<any | null>(null);
  const [buddyProfileLoading, setBuddyProfileLoading] = useState(false);

  // Load: pulls every active match for this user plus their queue entry.
  //
  // The server endpoint (`buddy_get_active_match` action) was renamed in
  // intent but kept its action name for backward-compat. It now returns
  // `{ matches: [...], queue: ... }` — see the route handler.
  async function loadState() {
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buddy_get_active_match", payload: { userId } }),
      });
      const data = await res.json();
      const incomingMatches: any[] = Array.isArray(data.matches) ? data.matches : (data.match ? [data.match] : []);
      const previousCount = prevMatchCountRef.current;
      setMatches(incomingMatches);
      prevMatchCountRef.current = incomingMatches.length;
      // Cache the user's own profile so the intake gate has the
      // current values to check against. Server returns me=null if the
      // user row doesn't exist (shouldn't happen post-signup) — we
      // treat that as "incomplete" which forces intake.
      const myProfile = data.me || null;
      setMe(myProfile);

      // Decide whether the user has filled out the buddy intake. Joey's
      // requirement: every user must input city + immediate_goal +
      // hobbies before they can search for a buddy, so other users see
      // a real personality on the "Meet your buddy" card instead of an
      // empty profile.
      const intakeComplete =
        !!myProfile?.city?.trim() &&
        !!myProfile?.immediate_goal?.trim() &&
        !!myProfile?.hobbies?.trim();

      // Decide which view to land on. Priority:
      //   - If we just got a NEW match while queued, jump to the list
      //     so the user sees their fresh buddy. Don't clobber their
      //     selection if they're mid-flow on something else.
      //   - If they're queued (and not in any match), show queued state.
      //   - Otherwise: list when 1+ matches exist; intake when the
      //     profile is incomplete (and they have no buddies); category
      //     picker only when intake is done. Only set this on first
      //     load — once the user navigates within the panel we respect
      //     their choice.
      if (incomingMatches.length > previousCount && previousCount > 0) {
        // A new match arrived during polling — bring them to the list
        setStep("list");
        setSelectedMatchId(null);
      } else if (data.queue && incomingMatches.length === 0) {
        setCategory(data.queue.category);
        setTier(data.queue.tier);
        setStep("queued");
      } else if (!loaded) {
        // First load only — don't bounce existing user out of their flow
        if (incomingMatches.length > 0) {
          setStep("list");
        } else {
          setStep(intakeComplete ? "category" : "intake");
        }
      } else if (incomingMatches.length === 0 && step === "list") {
        // List view became empty (all matches ended) — fall back to
        // intake if needed, picker otherwise
        setStep(intakeComplete ? "category" : "intake");
      }
      setLoaded(true);
    } catch (e) { console.error(e); setLoaded(true); }
  }
  // Mount: load buddy state AND kick off self-healing progress sync.
  // The sync recomputes user_a_progress / user_b_progress on every
  // active match from full history, so any logs that didn't tick up
  // their match (e.g. logged offline, save errored mid-flow) are
  // self-corrected. The next loadState poll picks up the new values.
  useEffect(() => {
    loadState();
    if (userId) forceSyncAllProgress(userId);
    /* eslint-disable-next-line */
  }, [userId]);

  // Poll for updates in views where state can change server-side:
  //   - "queued": waiting for a match to appear
  //   - "list":   buddy progress increments need to show up; also picks
  //               up newly-found matches if the user joined a queue
  //               from another device
  // 8s is fine — these views aren't time-critical and the interval
  // would otherwise add load to /api/db.
  useEffect(() => {
    if (step !== "queued" && step !== "list") return;
    setPolling(true);
    const id = setInterval(loadState, 8000);
    return () => { clearInterval(id); setPolling(false); };
    // eslint-disable-next-line
  }, [step]);

  // Fetch enriched profile card whenever the user opens a detail view.
  // Pulls city/bio/level/pinned-badges/recent-badge/current-goal for the
  // BUDDY (not the current user) so the detail view can render an
  // intro card. Cleared on close so the previous buddy's data doesn't
  // flash when the user opens a different match.
  useEffect(() => {
    if (!selectedMatchId) {
      setBuddyProfile(null);
      return;
    }
    const match = matches.find(m => m.id === selectedMatchId);
    if (!match) return;
    const isUserA = match.user_a?.id === userId;
    const buddyId = isUserA ? match.user_b?.id : match.user_a?.id;
    if (!buddyId) return;

    setBuddyProfileLoading(true);
    setBuddyProfile(null);
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_buddy_profile_card", payload: { userId: buddyId } }),
    })
      .then(r => r.json())
      .then(data => { setBuddyProfile(data); })
      .catch(() => { setBuddyProfile(null); })
      .finally(() => { setBuddyProfileLoading(false); });
    // eslint-disable-next-line
  }, [selectedMatchId, matches]);

  async function findMatch(tierOverride?: string) {
    // tierOverride lets the caller pass the tier directly so we don't
    // race React's setState — the on-click handler fires findMatch right
    // after setTier, and the closure captures the OLD tier value. Passing
    // it as an argument avoids the "have to double-click" bug.
    const useTier = tierOverride || tier;
    if (!category || !useTier) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/db", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buddy_request_match", payload: { userId, category, tier: useTier } }),
      });
      const data = await res.json();
      if (data.status === "matched" || data.status === "already_matched") {
        await loadState();
        // If we successfully matched, send the user back to the list so
        // they see all their buddies including the new one. Without this
        // they stay stuck on the tier picker after a fast match.
        setStep("list");
        setCategory(null); setTier(null);
      } else {
        setStep("queued");
      }
    } catch (e) { console.error(e); }
    setSubmitting(false);
  }

  async function cancelQueue() {
    if (!confirm("Cancel matchmaking?")) return;
    await fetch("/api/db", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "buddy_cancel_queue", payload: { userId, category, tier } }),
    });
    // After cancelling, return to the list if there are still other
    // buddies, otherwise back to the picker.
    setStep(matches.length > 0 ? "list" : "category");
    setCategory(null);
    setTier(null);
  }

  // Forfeit/end a single buddy match. Optimistically removes it from the
  // local list so the UI updates immediately, then reloads from the
  // server to confirm. If the server rejects the leave (rare — only on
  // network issues), the next loadState will restore it.
  async function leaveMatch(matchId: string) {
    if (!confirm("Leave this buddy match? You can find a new one anytime.")) return;
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setSelectedMatchId(null);
    try {
      await fetch("/api/db", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buddy_leave_match", payload: { userId, matchId } }),
      });
    } catch (e) { console.error(e); }
    await loadState();
  }

  // ── INITIAL LOADING SKELETON ──────────────────────────────────────────
  // Render this while the very first loadState() is in flight. Prevents
  // the category picker from flashing on screen for users who already
  // have a match / are queued. Once `loaded` flips, we fall through to
  // whichever real view applies based on `step`.
  if (!loaded) {
    return (
      <div style={{ background: "#161D19", border: "1px solid #1E3D34", borderRadius: 22, padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.5 }}>🤝</div>
        <div style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 700 }}>Loading your buddy status…</div>
      </div>
    );
  }

  // ── DETAIL VIEW (one specific buddy match) ─────────────────────────────
  // Open via tap on a list card. Sticky-positioned back button at top
  // returns to the list. Renders the same dual-progress UI as the old
  // single-match view, but inside the list/detail navigation.
  const selectedMatch = selectedMatchId ? matches.find(m => m.id === selectedMatchId) : null;
  if (selectedMatch) {
    const isUserA = selectedMatch.user_a?.id === userId;
    const me      = isUserA ? selectedMatch.user_a : selectedMatch.user_b;
    const buddy   = isUserA ? selectedMatch.user_b : selectedMatch.user_a;
    const myProgress     = isUserA ? selectedMatch.user_a_progress : selectedMatch.user_b_progress;
    const buddyProgress  = isUserA ? selectedMatch.user_b_progress : selectedMatch.user_a_progress;
    const target  = selectedMatch.target_value;
    const unit    = selectedMatch.target_unit;
    const myPct    = Math.min(100, ((myProgress || 0) / target) * 100);
    const buddyPct = Math.min(100, ((buddyProgress || 0) / target) * 100);
    const endsLabel = new Date(selectedMatch.ends_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const daysLeft = Math.max(0, Math.ceil((new Date(selectedMatch.ends_at).getTime() - Date.now()) / 86400000));
    const catEmoji = BUDDY_CATEGORIES.find(c => c.id === selectedMatch.category)?.emoji || "🤝";
    const catName = BUDDY_CATEGORIES.find(c => c.id === selectedMatch.category)?.name || selectedMatch.category;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Back to list — explicit button so the user knows they have
            multiple buddies to navigate between. */}
        <button
          onClick={() => setSelectedMatchId(null)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none",
            color: "#9CA3AF", fontSize: 13, fontWeight: 700,
            padding: "4px 0", cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >← All buddies</button>

        {/* Hero card — category + buddy name + days left + target */}
        <div style={{ background: "linear-gradient(135deg, #1A0D3E, #1E3D34)", border: "1px solid #5BBE9355", borderRadius: 22, padding: "24px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>{catEmoji}</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#fff", marginBottom: 4 }}>
            {catName} buddy
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>
            with <strong style={{ color: "#fff" }}>{buddy?.full_name || `@${buddy?.username || "buddy"}`}</strong>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            Hit <strong style={{ color: "#fff" }}>{target} {unit}</strong> each by {endsLabel} · {daysLeft}d left
          </div>
        </div>

        {/* ─── MEET YOUR BUDDY ───────────────────────────────────────────
            Personalization card so this feels like meeting a person, not
            a username on a leaderboard. Renders whatever data the buddy
            has filled in (city, bio, level, badges) and silently hides
            sections that have no data. While the fetch is in flight we
            show a low-key skeleton — never a blocking spinner — so the
            existing match progress below stays interactive.

            Loaded lazily via /api/db get_buddy_profile_card when the
            user opens this detail view; cleared on close so the next
            buddy doesn't flash with stale data. */}
        {(() => {
          const profileUser = buddyProfile?.user;
          const pinned: any[] = buddyProfile?.pinned_badges || [];
          const recent = buddyProfile?.recent_badge;
          const goal = buddyProfile?.current_goal;
          // Look up display metadata for each badge_id from the catalog.
          // Fallback to a generic medal if catalog doesn't have it (older
          // badges that may have been renamed).
          const badgeMeta = (badgeId: string) => {
            const b = BADGES.find(x => x.id === badgeId);
            return b ? { emoji: b.emoji, label: b.label } : { emoji: "🏅", label: badgeId };
          };
          // Filter pinned to ones the catalog knows about + cap at 4
          const pinnedDisplay = pinned
            .map((p: any) => ({ ...p, meta: badgeMeta(p.badge_id) }))
            .slice(0, 4);

          // If we have nothing yet (loading state OR user has no profile
          // data at all), show a compact skeleton so the section isn't
          // a jarring empty space.
          if (buddyProfileLoading && !buddyProfile) {
            return (
              <div style={{ background: "#161D19", border: "1px solid #1E3D34", borderRadius: 18, padding: "20px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#1E3D3455" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: 120, height: 12, background: "#1E3D3455", borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ width: 80, height: 9, background: "#1E3D3444", borderRadius: 4 }} />
                </div>
              </div>
            );
          }

          // Fall back to the buddy data we have on the match itself if
          // the profile-card endpoint didn't return enriched data (e.g.,
          // network blip, or the new endpoint hasn't deployed yet).
          // Better to render a basic identity card than nothing.
          const u = profileUser || buddy;
          if (!u) return null;

          const initials = ((u.full_name || u.username || "?").trim()[0] || "?").toUpperCase();
          // Whether we have any "personality" data — bio, goal, badges,
          // city, level. Drives whether we show the icebreaker prompt
          // instead of the rich sub-sections.
          const hasPersonality = !!(u.city || u.bio || u.current_level || u.immediate_goal || u.hobbies || pinnedDisplay.length > 0 || recent || goal);

          return (
            <div style={{
              background: "linear-gradient(135deg, #161D19, #1A0D3E22)",
              border: "1px solid #5BBE9344",
              borderRadius: 20,
              padding: 0,
              overflow: "hidden",
            }}>
              {/* Section heading bar — sets the conversational frame */}
              <div style={{
                background: "rgba(124,58,237,0.12)",
                padding: "10px 16px",
                borderBottom: "1px solid #5BBE9322",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>👋</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#86CFAE", letterSpacing: 1, textTransform: "uppercase" as const }}>
                  Meet your buddy
                </span>
              </div>

              {/* Identity row — big avatar, name, username, level, city.
                  Always renders. The sub-rows below it (bio, goal, badges)
                  hide individually when empty. */}
              <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "center", gap: 14 }}>
                {u.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u.avatar_url}
                    alt=""
                    style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid #5BBE9355", flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%",
                    background: "linear-gradient(135deg, #5BBE93, #86CFAE)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 900, fontSize: 24, flexShrink: 0,
                    border: "2px solid #5BBE9355",
                  }}>{initials}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 17, color: "#F0F0F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.full_name || u.username}
                  </div>
                  {u.username && u.full_name && (
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: u.current_level != null || u.city ? 6 : 0 }}>@{u.username}</div>
                  )}
                  {(u.current_level != null || u.city) && (
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                      {u.current_level != null && (
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 99,
                          background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.4)",
                          color: "#F5A623",
                        }}>⚡ Lvl {u.current_level}</span>
                      )}
                      {u.city && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99,
                          background: "#0E1311", border: "1px solid #1E3D34",
                          color: "#9CA3AF",
                        }}>📍 {u.city}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bio — italic quote-style. Only renders when set so we
                  don't show empty quotes for users who skipped this. */}
              {u.bio && (
                <div style={{ padding: "0 18px 12px" }}>
                  <div style={{
                    fontSize: 13, color: "#D1D5DB", fontStyle: "italic" as const,
                    lineHeight: 1.5, paddingLeft: 10, borderLeft: "2px solid #5BBE9355",
                  }}>"{u.bio}"</div>
                </div>
              )}

              {/* Immediate goal — what the buddy is training for right
                  now. Comes from the intake form, separate from their
                  personal goals table — this is a free-text "what's
                  driving you" line. Renders as a labelled mini-card so
                  it stands apart from the bio. */}
              {u.immediate_goal && (
                <div style={{
                  margin: "0 14px 10px",
                  padding: "10px 12px",
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  borderRadius: 12,
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <div style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>🎯</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#86CFAE", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 2 }}>
                      Training for
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#F0F0F0", lineHeight: 1.4 }}>
                      {u.immediate_goal}
                    </div>
                  </div>
                </div>
              )}

              {/* What they do for fun — light-touch personal angle so
                  the buddy feels like a person rather than a workout
                  metric. Same mini-card pattern as immediate_goal but
                  with a softer accent color (gray vs purple). */}
              {u.hobbies && (
                <div style={{
                  margin: "0 14px 10px",
                  padding: "10px 12px",
                  background: "#0E1311",
                  border: "1px solid #1E3D34",
                  borderRadius: 12,
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <div style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>🎨</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 2 }}>
                      For fun
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#F0F0F0", lineHeight: 1.4 }}>
                      {u.hobbies}
                    </div>
                  </div>
                </div>
              )}

              {/* Current goal — surfaced as a "what they're chasing" card
                  with progress so the user sees what motivates this buddy.
                  Different from the buddy match itself; this is the
                  buddy's PERSONAL goal (run miles per week, etc). */}
              {goal && (
                <div style={{
                  margin: "0 14px 12px",
                  padding: "10px 12px",
                  background: "#0E1311",
                  border: "1px solid #1E3D34",
                  borderRadius: 12,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{ fontSize: 22, flexShrink: 0 }}>{goal.emoji || "🎯"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 2 }}>
                      Currently chasing
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#F0F0F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {goal.title}
                    </div>
                    {goal.target > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <div style={{ flex: 1, height: 4, background: "#1E3D3455", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{
                            width: `${Math.min(100, ((goal.current || 0) / goal.target) * 100)}%`,
                            height: "100%", background: "#86CFAE", borderRadius: 99,
                          }} />
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF" }}>
                          {Math.round((goal.current || 0) * 10) / 10}/{goal.target} {goal.unit}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pinned badges row — small tiles. Caps at 4 so the card
                  doesn't blow out vertically. Includes the "Just earned"
                  badge as a separate accent if it's not already pinned. */}
              {(pinnedDisplay.length > 0 || recent) && (
                <div style={{ padding: "0 16px 14px" }}>
                  {pinnedDisplay.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 6 }}>
                        Pinned badges
                      </div>
                      <div style={{ display: "flex", gap: 6, marginBottom: recent ? 10 : 0 }}>
                        {pinnedDisplay.map((p: any) => (
                          <div key={p.id} title={p.meta.label} style={{
                            flex: 1, padding: "8px 4px", textAlign: "center" as const,
                            background: "#0E1311", border: "1px solid #1E3D34", borderRadius: 10,
                          }}>
                            <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 4 }}>{p.meta.emoji}</div>
                            <div style={{
                              fontSize: 9, fontWeight: 700, color: "#9CA3AF",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>{p.meta.label}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {recent && !pinnedDisplay.some((p: any) => p.badge_id === recent.badge_id) && (
                    <div style={{
                      padding: "8px 12px",
                      background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)",
                      borderRadius: 10,
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ fontSize: 20 }}>{badgeMeta(recent.badge_id).emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#F5A623", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>
                          Just earned
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#F0F0F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {badgeMeta(recent.badge_id).label}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Icebreaker prompt — shown when the buddy hasn't filled
                  in any personality data (no bio, goal, badges, etc).
                  Without this the card would look weirdly empty after
                  the identity row, and users couldn't tell whether the
                  feature was even working. The prompt does double duty:
                  fills the visual space, and tees up a real reason to
                  message the buddy. */}
              {!hasPersonality && (
                <div style={{
                  margin: "0 14px 14px",
                  padding: "12px 14px",
                  background: "#0E1311",
                  border: "1px dashed #1E3D34",
                  borderRadius: 12,
                  textAlign: "center" as const,
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>💬</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#F0F0F0", marginBottom: 3 }}>
                    Break the ice
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.5 }}>
                    {(u.full_name?.split(" ")[0] || u.username || "Your buddy")} hasn't filled in their profile yet. Say hi and find out what they're training for.
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Two progress cards stacked — me + buddy */}
        {[
          { user: me, progress: myProgress || 0, pct: myPct, isMe: true },
          { user: buddy, progress: buddyProgress || 0, pct: buddyPct, isMe: false },
        ].map((row, i) => (
          <div key={i} style={{ background: "#161D19", border: "1px solid #1E3D34", borderRadius: 18, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              {row.user?.avatar_video_url ? (
                <video src={row.user.avatar_video_url} poster={row.user.avatar_url || undefined} autoPlay muted loop playsInline preload="metadata"
                  style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
              ) : row.user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.user.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #5BBE93, #86CFAE)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900 }}>
                  {(row.user?.full_name || row.user?.username || "?")[0]?.toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#F0F0F0" }}>
                  {row.isMe ? "You" : (row.user?.full_name || `@${row.user?.username || "buddy"}`)}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                  {Math.round(row.progress * 10) / 10} / {target} {unit}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: row.pct >= 100 ? "#4ADE80" : "#86CFAE" }}>
                {row.pct >= 100 ? "✓" : `${Math.round(row.pct)}%`}
              </div>
            </div>
            <div style={{ height: 8, background: "#0E1311", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${row.pct}%`,
                background: row.pct >= 100 ? "#4ADE80" : "linear-gradient(90deg, #5BBE93, #86CFAE)",
                borderRadius: 99,
                transition: "width 0.4s",
              }} />
            </div>
          </div>
        ))}

        {/* Buddy chat — same shape as the rivalry chat below the
            vs-card on the rivals page, but cooperative palette and
            copy. Mounted in detail view only since the list view
            shouldn't fire 1 realtime subscription per buddy card. */}
        <BuddyChat
          matchId={selectedMatch.id}
          myId={userId}
          buddyFirstName={(buddy?.full_name?.split(' ')[0]) || (buddy?.username) || 'Buddy'}
        />

        {/* Leave button — destructive, kept low-prominence so it's not
            the obvious tap. Confirms before firing. */}
        <button
          onClick={() => leaveMatch(selectedMatch.id)}
          style={{
            background: "transparent", border: "1px solid #EF444466",
            color: "#EF4444", fontSize: 12, fontWeight: 700,
            padding: "10px 0", borderRadius: 12, marginTop: 4,
            cursor: "pointer",
          }}
        >Leave this match</button>
      </div>
    );
  }

  // ── LIST VIEW (all active buddies) ─────────────────────────────────────
  // Default landing page when the user has 1+ active buddy matches.
  // Shows each buddy as a compact card with their progress at a glance.
  // Tapping a card opens detail view. "Find another buddy" CTA at the
  // bottom lets the user enter the matchmaking flow without leaving
  // their existing buddies behind.
  if (step === "list") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Header strip — count + intro */}
        <div style={{ padding: "4px 4px 8px" }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#F0F0F0", marginBottom: 2 }}>
            Your buddies <span style={{ color: "#86CFAE" }}>·</span> {matches.length}
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>
            Tap a card to see progress. You can pair up across categories — running buddy, lifting buddy, etc.
          </div>
        </div>

        {/* Buddy cards */}
        {matches.map((m: any) => {
          const isUserA = m.user_a?.id === userId;
          const buddy = isUserA ? m.user_b : m.user_a;
          const myProgress = isUserA ? (m.user_a_progress || 0) : (m.user_b_progress || 0);
          const buddyProgress = isUserA ? (m.user_b_progress || 0) : (m.user_a_progress || 0);
          const target = m.target_value;
          const unit = m.target_unit;
          const myPct = Math.min(100, (myProgress / target) * 100);
          const buddyPct = Math.min(100, (buddyProgress / target) * 100);
          const daysLeft = Math.max(0, Math.ceil((new Date(m.ends_at).getTime() - Date.now()) / 86400000));
          const catEmoji = BUDDY_CATEGORIES.find(c => c.id === m.category)?.emoji || "🤝";
          const catName = BUDDY_CATEGORIES.find(c => c.id === m.category)?.name || m.category;
          const bothDone = myPct >= 100 && buddyPct >= 100;

          return (
            <button
              key={m.id}
              onClick={() => setSelectedMatchId(m.id)}
              style={{
                background: bothDone ? "linear-gradient(135deg, #052e1a, #064e3b)" : "#161D19",
                border: bothDone ? "1px solid #4ADE8055" : "1px solid #1E3D34",
                borderRadius: 18,
                padding: "14px 16px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Top row: category + buddy name + days left */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, flexShrink: 0,
                }}>{catEmoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#F0F0F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {catName} · {buddy?.full_name || `@${buddy?.username || "buddy"}`}
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                    {bothDone ? "🎉 Both hit goal!" : `${daysLeft}d left · target ${target} ${unit}`}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: "#6B7280", flexShrink: 0 }}>›</div>
              </div>

              {/* Mini dual progress bars: you on top, buddy below */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "You", val: myProgress, pct: myPct },
                  { label: buddy?.full_name?.split(" ")[0] || buddy?.username || "Buddy", val: buddyProgress, pct: buddyPct },
                ].map((row, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", width: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</div>
                    <div style={{ flex: 1, height: 6, background: "#0E1311", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${row.pct}%`,
                        background: row.pct >= 100 ? "#4ADE80" : "linear-gradient(90deg, #5BBE93, #86CFAE)",
                        borderRadius: 99,
                      }} />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: row.pct >= 100 ? "#4ADE80" : "#86CFAE", width: 36, textAlign: "right" }}>
                      {row.pct >= 100 ? "✓" : `${Math.round(row.pct)}%`}
                    </div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}

        {/* Find another buddy CTA — lets the user kick off matchmaking
            without losing their existing buddies. Routes through the
            intake form first if their profile is missing fields, since
            we never want them to queue without prompts being completed. */}
        <button
          onClick={() => {
            const intakeComplete =
              !!me?.city?.trim() &&
              !!me?.immediate_goal?.trim() &&
              !!me?.hobbies?.trim();
            setCategory(null);
            setTier(null);
            setStep(intakeComplete ? "category" : "intake");
          }}
          style={{
            background: "rgba(124,58,237,0.12)",
            border: "1.5px dashed rgba(124,58,237,0.5)",
            borderRadius: 18,
            padding: "16px 18px",
            color: "#86CFAE",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          + Find another buddy
        </button>
      </div>
    );
  }

  // ── QUEUED VIEW ────────────────────────────────────────────────────────
  if (step === "queued") {
    return (
      <div style={{ background: "linear-gradient(135deg, #1A0D3E, #1E3D34)", border: "1px solid #5BBE9355", borderRadius: 22, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>🔍</div>
        <div style={{ fontWeight: 900, fontSize: 20, color: "#fff", marginBottom: 6 }}>Looking for a buddy…</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 24 }}>
          {(BUDDY_CATEGORIES.find(c => c.id === category)?.name) || category} · {(BUDDY_TIERS.find(t => t.id === tier)?.label || tier)?.replace(/^\S+\s/, "")}
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ height: "100%", width: "40%", background: "#86CFAE", borderRadius: 99, animation: "buddyPulse 1.5s ease-in-out infinite" }} />
        </div>
        <style>{`@keyframes buddyPulse { 0%,100% { transform: translateX(-50%); } 50% { transform: translateX(150%); } }`}</style>
        <button onClick={cancelQueue} style={{
          background: "transparent", border: "1.5px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.85)",
          padding: "10px 22px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>Cancel</button>
      </div>
    );
  }

  // ── INTAKE ─────────────────────────────────────────────────────────────
  // Required first-time form before a user can search for a buddy. Asks
  // for city/state, what they're training for, and what they do for fun.
  // The values are saved straight into users.city, users.immediate_goal,
  // users.hobbies via supabase update — no separate endpoint needed
  // since the user is updating their own row and RLS allows it.
  //
  // Inputs are kept inside this component (not the parent) so navigating
  // away from the buddy tab and back doesn't lose drafts. State is seeded
  // from the loaded `me` row whenever it changes, so users with partial
  // profiles get pre-filled fields they can edit.
  if (step === "intake") {
    return (
      <BuddyIntakeForm
        me={me}
        userId={userId}
        onSaved={async () => {
          // Refresh state so the intake-complete check upstream now
          // passes, then proceed to the matchmaking flow. We don't
          // assume the next step — loadState picks list vs category
          // based on whether this user already has buddies.
          await loadState();
          setStep("category");
        }}
        onCancel={matches.length > 0 ? () => setStep("list") : undefined}
      />
    );
  }

  // ── PICK CATEGORY ──────────────────────────────────────────────────────
  if (step === "category") {
    // Categories already taken — same-category dual matches are blocked
    // server-side, so we visually mark them so the user knows. We don't
    // hide them entirely (might confuse users) — just disable.
    const takenCategories = new Set(matches.map((m: any) => m.category));
    const hasExistingBuddies = matches.length > 0;

    // Per-category accent colors. Used for the card border + emoji halo.
    // Picks a hue that vibes with the activity (green for outdoor,
    // blue for water, red for combat, etc) so the picker reads as a
    // proper menu rather than a wall of identical tiles.
    const CAT_COLORS: Record<string, string> = {
      running: "#16A34A",
      walking: "#0EA5E9",
      biking:  "#F59E0B",
      lifting: "#EF4444",
      swimming:"#06B6D4",
      combat:  "#DC2626",
    };

    return (
      <div>
        {/* Back to list — only when there are existing buddies. Reuses
            the matchmaking flow's standard back-link styling. */}
        {hasExistingBuddies && (
          <button
            onClick={() => setStep("list")}
            style={{
              background: "transparent", border: "none", color: "#9CA3AF",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              marginBottom: 12, padding: 0,
            }}
          >← All buddies ({matches.length})</button>
        )}

        {/* Hero — big intro with a visible "you BOTH win" framing so
            users get the cooperative angle (vs Rivals which is 1v1). */}
        <div style={{ background: "linear-gradient(135deg, #1A0D3E, #1E3D34, #1A0D3E)", borderRadius: 24, padding: "32px 28px", marginBottom: 16, border: "1px solid #5BBE9355", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🤝</div>
          <div style={{ fontWeight: 900, fontSize: 24, color: "#fff", marginBottom: 6, letterSpacing: -0.5 }}>
            {hasExistingBuddies ? "Find another buddy" : "Find a Workout Buddy"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
            Get matched with someone chasing the same goal. <strong style={{ color: "#86CFAE" }}>Both of you hit the target → both of you win.</strong>
          </div>
        </div>

        {/* "How it works" 3-step strip. Hidden once the user has buddies
            since they already know — the strip is for first-timers. */}
        {!hasExistingBuddies && (
          <div style={{
            background: "#161D19",
            border: "1px solid #1E3D34",
            borderRadius: 16,
            padding: "14px 16px",
            marginBottom: 20,
            display: "flex",
            gap: 12,
            alignItems: "stretch",
          }}>
            {[
              { n: "1", emoji: "🎯", title: "Pick category + tier", desc: "Running, lifting, swimming, etc. Tier sets the target." },
              { n: "2", emoji: "🔍", title: "Get matched", desc: "Paired with someone at the same level usually within minutes." },
              { n: "3", emoji: "🏆", title: "Both hit target", desc: "14 days to reach the goal. You both win together." },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid #1E3D3455" : "none", paddingRight: i < 2 ? 8 : 0 }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#86CFAE", letterSpacing: 0.5, marginBottom: 2 }}>STEP {s.n}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#F0F0F0", marginBottom: 3, lineHeight: 1.2 }}>{s.title}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF", lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* Section heading right above the grid so the picker reads
            as a list of choices and not just a wall of tiles. */}
        <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 10, padding: "0 4px" }}>
          Pick a category
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {BUDDY_CATEGORIES.map(cat => {
            const taken = takenCategories.has(cat.id);
            const accent = CAT_COLORS[cat.id] || "#5BBE93";
            return (
              <button
                key={cat.id}
                onClick={() => { if (!taken) { setCategory(cat.id); setStep("tier"); } }}
                disabled={taken}
                title={taken ? `You already have a ${cat.name} buddy` : undefined}
                style={{
                  background: taken
                    ? "#161D19"
                    : `linear-gradient(135deg, #161D19, ${accent}11)`,
                  border: taken ? "2px dashed #1E3D34" : `2px solid ${accent}55`,
                  borderRadius: 18, padding: "18px 14px",
                  cursor: taken ? "not-allowed" : "pointer",
                  textAlign: "center", color: "#F0F0F0",
                  opacity: taken ? 0.45 : 1,
                  position: "relative" as const,
                  transition: "transform 0.15s, border-color 0.15s",
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: taken ? "transparent" : `${accent}22`,
                  border: taken ? "none" : `1px solid ${accent}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, margin: "0 auto 10px",
                }}>
                  {cat.emoji}
                </div>
                <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 3, color: taken ? "#9CA3AF" : "#F0F0F0" }}>{cat.name}</div>
                <div style={{ fontSize: 10, color: taken ? "#6B7280" : "#9CA3AF", lineHeight: 1.4 }}>
                  {taken ? "✓ Already paired" : cat.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footnote — quick reminder about what tier you'll pick next */}
        {!hasExistingBuddies && (
          <div style={{ fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
            Next you'll pick a difficulty tier — beginner, intermediate, or elite — which sets the 14-day target.
          </div>
        )}
      </div>
    );
  }

  // ── PICK TIER ──────────────────────────────────────────────────────────
  // Mirrors the server-side TARGETS map in /api/db buddy_request_match
  // so we can show the actual goal target on each tier card. Keep these
  // in sync with the server — if you add a category, add it here too.
  const BUDDY_TARGETS: Record<string, Record<string, { value: number; unit: string }>> = {
    running:  { beginner: { value: 10,  unit: "mi"       }, intermediate: { value: 25,  unit: "mi" },       elite: { value: 50,  unit: "mi" } },
    walking:  { beginner: { value: 20,  unit: "mi"       }, intermediate: { value: 50,  unit: "mi" },       elite: { value: 100, unit: "mi" } },
    biking:   { beginner: { value: 30,  unit: "mi"       }, intermediate: { value: 100, unit: "mi" },       elite: { value: 200, unit: "mi" } },
    lifting:  { beginner: { value: 6,   unit: "workouts" }, intermediate: { value: 10,  unit: "workouts" }, elite: { value: 14,  unit: "workouts" } },
    swimming: { beginner: { value: 60,  unit: "min"      }, intermediate: { value: 180, unit: "min" },      elite: { value: 360, unit: "min" } },
    combat:   { beginner: { value: 4,   unit: "sessions" }, intermediate: { value: 8,   unit: "sessions" }, elite: { value: 12,  unit: "sessions" } },
  };
  const tierAccent: Record<string, string> = {
    beginner:     "#10B981",
    intermediate: "#F59E0B",
    elite:        "#A855F7",
  };
  const catData = BUDDY_CATEGORIES.find(c => c.id === category);
  const targets = category ? BUDDY_TARGETS[category] : null;

  return (
    <div>
      <button onClick={() => { setStep(matches.length > 0 ? "list" : "category"); setCategory(null); }} style={{
        background: "transparent", border: "none", color: "#9CA3AF", fontSize: 13, fontWeight: 700,
        cursor: "pointer", marginBottom: 12, padding: 0,
      }}>← Back</button>

      {/* Hero — restated category so the user remembers what they picked */}
      <div style={{ background: "linear-gradient(135deg, #1A0D3E, #1E3D34)", borderRadius: 22, padding: "24px 22px", marginBottom: 18, border: "1px solid #5BBE9355", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{catData?.emoji}</div>
        <div style={{ fontWeight: 900, fontSize: 18, color: "#fff", marginBottom: 4 }}>{catData?.name} buddy</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>How hard do you want to push? You and your buddy will share a 14-day target.</div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 10, padding: "0 4px" }}>
        Pick a tier
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {BUDDY_TIERS.map(t => {
          const tgt = targets?.[t.id];
          const accent = tierAccent[t.id] || "#5BBE93";
          return (
            <button
              key={t.id}
              onClick={() => { setTier(t.id); findMatch(t.id); }}
              disabled={submitting}
              style={{
                background: `linear-gradient(135deg, #161D19, ${accent}11)`,
                border: `2px solid ${accent}55`,
                borderRadius: 16,
                padding: "16px 18px",
                cursor: submitting ? "not-allowed" : "pointer",
                textAlign: "left",
                color: "#F0F0F0",
                opacity: submitting ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              {/* Tier badge — accent-colored circle with the emoji from
                  the label string. The tier labels include their emoji
                  prefix (e.g. "🌱 Beginner") so we split on space. */}
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                background: `${accent}22`, border: `1px solid ${accent}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, flexShrink: 0,
              }}>
                {t.label.split(" ")[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 3, color: "#F0F0F0" }}>
                  {t.label.split(" ").slice(1).join(" ")}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: tgt ? 4 : 0 }}>{t.desc}</div>
                {/* The actual target — what the user is signing up for.
                    Was the missing piece on the old picker: users had no
                    idea Beginner running was 10mi vs Elite at 50. */}
                {tgt && (
                  <div style={{ fontSize: 12, fontWeight: 800, color: accent }}>
                    🎯 {tgt.value} {tgt.unit} together · 14 days
                  </div>
                )}
              </div>
              <div style={{ fontSize: 18, color: "#6B7280", flexShrink: 0 }}>›</div>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
        After you pick, we'll match you with another user at the same tier. Usually under a minute.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RivalsPage() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();
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

  // Top-level page tab — Rivals (1v1 matchmaking, 7 days) vs
  // Workout Buddy (cooperative 2-week shared challenge). Same matchmaking
  // skeleton but the buddy outcome is win-together rather than head-to-head.
  const [pageTab, setPageTab] = useState<"rivals" | "buddy" | "couples">("rivals");

  // Load initial state: do I have an active rivalry? Am I already queued?
  //
  // PERF: own record is fetched in parallel with the rivalry+queue check
  // because it's keyed only on user.id and doesn't depend on either of the
  // other queries' results. Was previously sequential — fetched only after
  // we knew there was an active rivalry — which added a round-trip onto
  // the cold load. Opponent record still has to wait since we need the
  // opponent's id from the rivalry first.
  const loadState = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // First, resolve any rivalry whose time has expired but that the DB
      // still marks "active" (the resolver cron isn't scheduled, so we kick
      // it on load). This stamps the winner + flips status to completed, so
      // getActiveRivalry below returns null and the page returns to the
      // queue/matchmaking state — and the user is no longer blocked from
      // starting a new rivalry.
      await resolveExpiredRivalries();

      const [rivalry, queueEntry, myRecPrefetched] = await Promise.all([
        getActiveRivalry(),
        getQueueEntry(),
        getUserRecord(user.id),
      ]);
      // Always set my record — relevant even without an active rivalry
      // (e.g. shows on the matchmaking page eventually).
      setMyRecord(myRecPrefetched);
      if (rivalry) {
        setActiveRivalry(rivalry);
        setMatchStep("active");
        // Only the opponent's record needs waiting on now.
        const theirs = await getUserRecord(rivalry.opponent.id);
        setTheirRecord(theirs);
        clearDraft();
      } else if (queueEntry) {
        // User is waiting in the queue — restore their picks so the UI is consistent
        setActiveRivalry(null);
        setQueuedAlready(true);
        setRivalCategory(queueEntry.category);
        setRivalCompetition(queueEntry.competition_type);
        setRivalTier(queueEntry.tier);
        setMatchStep("matching");
        clearDraft();
      } else {
        // Not in queue — check for a saved in-progress draft
        setActiveRivalry(null);
        setQueuedAlready(false);
        const draft = loadDraft();
        if (draft && (draft.step === "competition" || draft.step === "tier")) {
          setRivalCategory(draft.category);
          setRivalCompetition(draft.competition);
          setMatchStep(draft.step);
        } else {
          setMatchStep("category");
        }
      }
    } catch (e) {
      console.error("Failed to load rivals state:", e);
      setError("Failed to load your rival data. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mount: kick off self-healing sync for the user's progress data
  // (backfills missing workout_category, recomputes wars/buddies/goals,
  // scans for rivalry badges that should have been awarded but weren't).
  // Runs in parallel with loadState — we don't make the UI wait on it.
  // If sync writes new badges/scores while the page is open, the next
  // 30s liveScores poll will pick them up. See lib/syncProgress.ts.
  useEffect(() => {
    if (authLoading) return;
    loadState();
    if (user?.id) forceSyncAllProgress(user.id);
  }, [authLoading, user?.id, loadState]);

  // Direct-challenge state
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [acceptCode, setAcceptCode] = useState("");
  const [acceptingChallenge, setAcceptingChallenge] = useState(false);
  const [copiedChallenge, setCopiedChallenge] = useState(false);

  // Picking a tier now lands on the "launch" choice (find any rival, or
  // challenge a friend directly) rather than queuing immediately.
  async function handleSelectTier(t: RivalTier) {
    if (!rivalCategory || !rivalCompetition) return;
    setRivalTier(t);
    setError(null);
    setMatchStep("launch");
  }

  // "Find any rival" — the original open-queue matchmaking path.
  async function handleFindAnyRival() {
    if (!rivalCategory || !rivalCompetition || !rivalTier) return;
    setMatchStep("matching");
    setError(null);
    clearDraft();
    try {
      const matched = await joinQueue({ category: rivalCategory, competition_type: rivalCompetition, tier: rivalTier });
      if (matched) await loadState();
    } catch (e: any) {
      setError(e.message || "Failed to join queue");
      setMatchStep("launch");
    }
  }

  // "Challenge a friend" — generate a shareable code, then poll for acceptance.
  async function handleCreateChallenge() {
    if (!rivalCategory || !rivalCompetition || !rivalTier || creatingChallenge) return;
    setCreatingChallenge(true);
    setError(null);
    try {
      const code = await createChallenge({ category: rivalCategory, competition_type: rivalCompetition, tier: rivalTier });
      setChallengeCode(code);
      clearDraft();
      setMatchStep("challenge");
    } catch (e: any) {
      setError(e.message || "Failed to create challenge");
    } finally {
      setCreatingChallenge(false);
    }
  }

  // Accept a challenge by code → jumps straight into the rivalry.
  async function handleAcceptCode() {
    const code = acceptCode.trim();
    if (!code || acceptingChallenge) return;
    setAcceptingChallenge(true);
    setError(null);
    try {
      await acceptChallenge(code);
      setAcceptCode("");
      await loadState(); // now have an active rivalry → active view
    } catch (e: any) {
      setError(e.message || "Couldn't accept that code");
    } finally {
      setAcceptingChallenge(false);
    }
  }

  function handleCancelMatching() {
    setMatchStep("category");
    setRivalCategory(null);
    setRivalCompetition(null);
    setRivalTier(null);
    setQueuedAlready(false);
    clearDraft();
  }

  const isActive = matchStep === "active" && activeRivalry && user;

  // ── AUTH / LOADING GUARDS ──
  if (authLoading || loading) {
    // Shape-shifting skeleton — matches the rivalry page layout so the
    // user sees the silhouette of what's about to appear instead of a
    // blank screen with a "Loading…" label. Same shimmer style as the
    // profile and groups skeletons so the app feels consistent.
    const shimmer: React.CSSProperties = {
      background: "linear-gradient(90deg, #1A1230 0%, #1B231E 50%, #1A1230 100%)",
      backgroundSize: "200% 100%",
      animation: "skeletonShimmer 1.4s ease-in-out infinite",
    };
    return (
      <div style={{ background: "#0E1311", minHeight: "100vh", paddingBottom: 80 }}>
        <style jsx global>{`
          @keyframes skeletonShimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        {/* Sticky header bar */}
        <div style={{ position: "sticky", top: 0, background: "#0E1311", padding: "16px 16px 0", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ ...shimmer, width: 160, height: 28, borderRadius: 8 }} />
            <div style={{ ...shimmer, width: 70, height: 22, borderRadius: 11 }} />
          </div>
          {/* Rivals / Workout Buddy tab toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ ...shimmer, flex: 1, height: 56, borderRadius: 14 }} />
            <div style={{ ...shimmer, flex: 1, height: 56, borderRadius: 14 }} />
          </div>
        </div>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 16px" }}>
          {/* You vs Opponent card */}
          <div style={{ ...shimmer, height: 220, borderRadius: 18, marginBottom: 20 }} />
          {/* Score row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ ...shimmer, height: 90, borderRadius: 14 }} />
            <div style={{ ...shimmer, height: 90, borderRadius: 14 }} />
          </div>
          {/* Badge grid header + tiles */}
          <div style={{ ...shimmer, width: 160, height: 22, borderRadius: 8, marginBottom: 14 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ ...shimmer, aspectRatio: "1 / 1.1", borderRadius: 14 }} />
            ))}
          </div>
          {/* Chat panel */}
          <div style={{ ...shimmer, height: 160, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ background: "#0E1311", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
        <div style={{ color: "#F0F0F0", fontSize: 18, fontWeight: 800 }}>Sign in to find a rival</div>
        <Link href="/login" style={{ background: "#5BBE93", color: "#fff", padding: "10px 24px", borderRadius: 12, fontWeight: 800, textDecoration: "none" }}>Log in</Link>
      </div>
    );
  }

  return (
    <div style={{ background: "#0E1311", minHeight: "100vh" }}>
      <style>{`
        @keyframes headerPulse { 0% { box-shadow: 0 0 0 0 rgba(124,58,237,0.3); } 70% { box-shadow: 0 0 0 12px rgba(124,58,237,0); } 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); } }
      `}</style>

      {/* Header — sticky, contains both the page title and the rivals/buddy
          tab toggle. Tabs were previously below the header in the scrolling
          content area, which meant they disappeared as soon as the user
          scrolled into the active rivalry view. Pulling them up here keeps
          them reachable from anywhere on the page. */}
      <div style={{ background: "linear-gradient(135deg, #1A0D3E, #0E1311)", borderBottom: "1px solid #1E3D34", padding: "20px 24px 16px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            {/* Back button — uses real browser history so it returns to
                wherever the user came from (groups, feed, profile, etc).
                Falls back to /feed when the rivals page is the entry point
                of the session, since router.back() with no history is a
                no-op and would leave the user stuck. */}
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/feed");
                }
              }}
              aria-label="Go back"
              style={{ background: "transparent", border: "none", color: "#9CA3AF", fontSize: 22, cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
            >←</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 22, color: "#F0F0F0", letterSpacing: -0.5 }}>
                {pageTab === "couples" ? "💜 Couples" : pageTab === "buddy" ? "🤝 Workout Buddy" : "⚔️ Rivals"}
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pageTab === "couples"
                  ? "You & your partner 💕"
                  : pageTab === "buddy"
                  ? "Team up · 14-day shared challenge"
                  : isActive ? `You vs ${activeRivalry!.opponent.full_name}` :
                 matchStep === "matching" ? "Finding your match..." :
                 matchStep === "tier" ? "Pick your tier" :
                 matchStep === "competition" ? "Pick your competition" :
                 "7-day rivalry. No quitting."}
              </div>
            </div>
            {isActive && pageTab === "rivals" && (
              <div style={{ background: "#EF444422", border: "1px solid #EF444444", borderRadius: 99, padding: "4px 12px", fontSize: 11, fontWeight: 800, color: "#EF4444", animation: "headerPulse 2s infinite", flexShrink: 0 }}>
                🔴 ACTIVE
              </div>
            )}
          </div>

          {/* Rivals / Workout Buddy tab toggle — lives in the sticky header
              so users can switch between modes from anywhere on the page,
              including deep inside an active rivalry's chat. Mirrors the
              Connect page tab pattern. */}
          <div style={{ display: "flex", gap: 6, padding: 4, background: "#161D19", borderRadius: 12, border: "1px solid #1E3D34" }}>
            {([
              { k: "rivals", label: "⚔️ Rivals", desc: "1v1 · 7 days" },
              { k: "buddy",  label: "🤝 Workout Buddy", desc: "Team · 14 days" },
              { k: "couples", label: "💜 Couples", desc: "You & your partner" },
            ] as const).map(t => (
              <button
                key={t.k}
                onClick={() => setPageTab(t.k as any)}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 9, border: "none",
                  background: pageTab === t.k ? "linear-gradient(135deg, #1A0D3E, #1E3D34)" : "transparent",
                  color: pageTab === t.k ? "#fff" : "#9CA3AF",
                  fontWeight: 800, fontSize: 12, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {t.label}
                <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.7, marginTop: 1 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 120px" }}>
        {error && (
          <div style={{ background: "#EF444422", border: "1px solid #EF444444", color: "#FCA5A5", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
            {error}
          </div>
        )}

        {pageTab === "couples" ? (
          <CouplesPanel />
        ) : pageTab === "buddy" ? (
          <BuddyPanel userId={user.id} />
        ) : (<>
        {matchStep === "category" && (
          <>
            {/* Accept a direct challenge by code */}
            <div style={{ background: "#160F28", border: "1px solid #2A1F45", borderRadius: 16, padding: 16, marginBottom: 20, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#86CFAE", marginBottom: 8 }}>🔗 Got a challenge code?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={acceptCode}
                  onChange={e => setAcceptCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="ENTER CODE"
                  style={{ flex: 1, background: "#0E1311", border: "1px solid #2A1F45", borderRadius: 10, color: "#fff", padding: "11px 12px", fontSize: 16, fontWeight: 800, letterSpacing: 3, fontFamily: "monospace", outline: "none", textTransform: "uppercase" }}
                />
                <button onClick={handleAcceptCode} disabled={acceptCode.trim().length < 4 || acceptingChallenge}
                  style={{ background: acceptCode.trim().length < 4 || acceptingChallenge ? "#3A2D5C" : "linear-gradient(135deg,#5BBE93,#86CFAE)", border: "none", borderRadius: 10, padding: "0 18px", color: "#fff", fontWeight: 800, cursor: acceptCode.trim().length < 4 ? "default" : "pointer" }}>
                  {acceptingChallenge ? "…" : "Accept"}
                </button>
              </div>
              {error && matchStep === "category" && <div style={{ color: "#FCA5A5", fontSize: 12, marginTop: 8 }}>{error}</div>}
            </div>

            <CategorySelect onSelect={(c) => {
              setRivalCategory(c);
              setMatchStep("competition");
              saveDraft({ step: "competition", category: c, competition: null });
            }} />
          </>
        )}

        {matchStep === "competition" && rivalCategory && (
          <CompetitionSelect category={rivalCategory}
            onBack={() => {
              setMatchStep("category");
              setRivalCategory(null);
              clearDraft();
            }}
            onSelect={(id) => {
              setRivalCompetition(id);
              setMatchStep("tier");
              saveDraft({ step: "tier", category: rivalCategory, competition: id });
            }} />
        )}

        {matchStep === "tier" && rivalCategory && rivalCompetition && (
          <TierSelect category={rivalCategory} competition={rivalCompetition}
            onBack={() => {
              setMatchStep("competition");
              setRivalCompetition(null);
              saveDraft({ step: "competition", category: rivalCategory, competition: null });
            }}
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

        {/* LAUNCH — choose open queue or a direct challenge */}
        {matchStep === "launch" && rivalCategory && rivalCompetition && rivalTier && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 460, margin: "0 auto" }}>
            <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 14, marginBottom: 4 }}>
              How do you want to find your rival?
            </div>
            <button onClick={handleFindAnyRival}
              style={{ background: "linear-gradient(135deg,#5BBE93,#86CFAE)", border: "none", borderRadius: 16, padding: "18px 20px", color: "#fff", cursor: "pointer", textAlign: "left" }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>🎲 Find any rival</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 3 }}>Get matched with anyone who picked the same challenge.</div>
            </button>
            <button onClick={handleCreateChallenge} disabled={creatingChallenge}
              style={{ background: "#160F28", border: "1.5px solid #5BBE93", borderRadius: 16, padding: "18px 20px", color: "#F0F0F0", cursor: "pointer", textAlign: "left" }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: "#86CFAE" }}>🔗 {creatingChallenge ? "Creating…" : "Challenge a friend"}</div>
              <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 3 }}>Get a code to send someone — they go head-to-head with you directly.</div>
            </button>
            <button onClick={() => { setMatchStep("tier"); }}
              style={{ background: "transparent", border: "none", color: "#9CA3AF", fontSize: 13, cursor: "pointer", marginTop: 4 }}>← Back</button>
            {error && <div style={{ color: "#FCA5A5", fontSize: 13, textAlign: "center" }}>{error}</div>}
          </div>
        )}

        {/* CHALLENGE — show the shareable code; poll for acceptance */}
        {matchStep === "challenge" && challengeCode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
            <ChallengePoller onMatched={loadState} />
            <div style={{ fontSize: 15, color: "#9CA3AF" }}>Send this code to whoever you want to challenge. When they enter it, your rivalry starts.</div>
            <div style={{ background: "#160F28", border: "2px solid #5BBE93", borderRadius: 18, padding: "24px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8 }}>Challenge code</div>
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 8, color: "#fff", fontFamily: "monospace" }}>{challengeCode}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { try { navigator.clipboard.writeText(challengeCode); setCopiedChallenge(true); setTimeout(() => setCopiedChallenge(false), 1500); } catch {} }}
                style={{ flex: 1, background: "#1F1636", border: "1.5px solid #2A1F45", borderRadius: 12, padding: "12px 0", color: "#F0F0F0", fontWeight: 800, cursor: "pointer" }}>
                {copiedChallenge ? "✓ Copied" : "📋 Copy code"}
              </button>
              <button onClick={async () => {
                const msg = `I'm challenging you to a rivalry on Livelee! Enter code ${challengeCode} in the Rivals tab. https://liveleeapp.com`;
                try { if (navigator.share) { await navigator.share({ title: "Livelee Rivalry Challenge", text: msg }); } else { await navigator.clipboard.writeText(msg); setCopiedChallenge(true); setTimeout(() => setCopiedChallenge(false), 1500); } } catch {}
              }}
                style={{ flex: 1, background: "linear-gradient(135deg,#5BBE93,#86CFAE)", border: "none", borderRadius: 12, padding: "12px 0", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                📤 Share
              </button>
            </div>
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>⏳ Waiting for them to accept… this screen updates automatically.</div>
            <button onClick={async () => { await cancelChallenge(); setChallengeCode(null); setMatchStep("category"); setRivalCategory(null); setRivalCompetition(null); setRivalTier(null); }}
              style={{ background: "transparent", border: "none", color: "#FCA5A5", fontSize: 13, cursor: "pointer" }}>Cancel challenge</button>
          </div>
        )}

        {isActive && activeRivalry && (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            <HeadToHeadPanel rivalry={activeRivalry} myRecord={myRecord} theirRecord={theirRecord} />

            {/* Get to know your rival — cycling prompts */}
            <PromptsCard
              title={`🤝 Get to know ${activeRivalry.opponent.full_name.split(" ")[0]}`}
              pool={RIVAL_PROMPTS}
              answers={((user?.profile as any)?.rival_prompt_answers as Record<string, string>) || {}}
              mineLabel="Your answers"
              other={{ label: `${activeRivalry.opponent.full_name.split(" ")[0]}'s answers`, answers: (activeRivalry.opponent.rival_prompt_answers as Record<string, string>) || {} }}
              onSave={async (next) => { await saveMyRivalPromptAnswers(next); await refreshProfile?.(); await loadState(); }}
            />

            <BadgesPanel rivalryId={activeRivalry.id} myId={user.id} opponentFirstName={activeRivalry.opponent.full_name.split(" ")[0]} />
            <ChatPanel rivalryId={activeRivalry.id} myId={user.id} rivalFirstName={activeRivalry.opponent.full_name.split(" ")[0]} />

            {/* No-cancel reminder */}
            <div style={{ background: "#161D19", borderRadius: 14, border: "1px solid #1E3D34", padding: "14px 18px", fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
              🔒 No cancels. Rivalry auto-resolves {formatTimeLeft(activeRivalry.ends_at).toLowerCase()}.
            </div>
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}

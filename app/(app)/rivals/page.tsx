"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type RivalCategory = "running" | "walking" | "biking" | "lifting" | "swimming" | "combat" | "wellness";
type RivalTier = "beginner" | "intermediate" | "mayhem";
type MatchStep = "category" | "tier" | "matching" | "active";

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES: { id: RivalCategory; emoji: string; name: string; desc: string }[] = [
  { id: "running",   emoji: "🏃", name: "Running",       desc: "Miles, pace, and endurance"         },
  { id: "walking",   emoji: "🚶", name: "Walking",       desc: "Steps, distance, consistency"        },
  { id: "biking",    emoji: "🚴", name: "Biking",        desc: "Miles, climbs, and speed"            },
  { id: "lifting",   emoji: "🏋️", name: "Lifting",       desc: "Volume, PRs, and raw strength"      },
  { id: "swimming",  emoji: "🏊", name: "Swimming",      desc: "Laps, distance, and stroke"          },
  { id: "combat",    emoji: "🥊", name: "Combat Sports", desc: "Rounds, sessions, and intensity"     },
  { id: "wellness",  emoji: "🧘", name: "Wellness",      desc: "Meditation, mobility, recovery"      },
];

// ─────────────────────────────────────────────────────────────────────────────
// TIER CONFIG
// ─────────────────────────────────────────────────────────────────────────────

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
  {
    id: "beginner",
    emoji: "🌱",
    name: "Beginner",
    desc: "Just getting started — building the habit",
    color: "#10B981",
    bg: "linear-gradient(135deg, #064E3B, #065F46)",
    border: "#10B98155",
    glow: "#10B98133",
  },
  {
    id: "intermediate",
    emoji: "⚡",
    name: "Intermediate",
    desc: "Consistent and climbing — real competition",
    color: "#7C3AED",
    bg: "linear-gradient(135deg, #1A0D3E, #2D1B69)",
    border: "#7C3AED88",
    glow: "#7C3AED44",
  },
  {
    id: "mayhem",
    emoji: "💀",
    name: "Mayhem",
    desc: "No days off. Absolute grind. Not for everyone.",
    color: "#EF4444",
    bg: "linear-gradient(135deg, #1A0000, #3B0A0A, #1A0000)",
    border: "#EF444488",
    glow: "#EF444455",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK RIVAL POOL (per category × tier)
// ─────────────────────────────────────────────────────────────────────────────

type MockRival = {
  name: string;
  username: string;
  stats: { label: string; value: string }[];
  streak: number;
  record: { wins: number; losses: number };
  loggedToday: boolean;
};

const MOCK_RIVAL_POOL: Record<RivalCategory, Record<RivalTier, MockRival[]>> = {
  running: {
    beginner:     [{ name: "Aria Chen",    username: "ariachen",   streak: 4,  loggedToday: true,  record: { wins: 1, losses: 2 }, stats: [{ label: "Miles/week", value: "8 mi" },  { label: "Longest Run", value: "3.2 mi" }, { label: "Avg Pace", value: "10:30/mi" }] }],
    intermediate: [{ name: "Marcus Webb",  username: "marcuswebb", streak: 12, loggedToday: true,  record: { wins: 4, losses: 3 }, stats: [{ label: "Miles/week", value: "22 mi" }, { label: "Longest Run", value: "8.5 mi" }, { label: "Avg Pace", value: "8:10/mi"  }] }],
    mayhem:       [{ name: "Dani Torres",  username: "danitorres", streak: 31, loggedToday: true,  record: { wins: 9, losses: 1 }, stats: [{ label: "Miles/week", value: "55 mi" }, { label: "Longest Run", value: "22 mi"  }, { label: "Avg Pace", value: "6:45/mi"  }] }],
  },
  walking: {
    beginner:     [{ name: "Sam Holt",     username: "samholt",    streak: 5,  loggedToday: false, record: { wins: 0, losses: 1 }, stats: [{ label: "Steps/week", value: "28k"   }, { label: "Miles walked", value: "12 mi" }, { label: "Active days", value: "4/7"  }] }],
    intermediate: [{ name: "Priya Nair",   username: "priyanair",  streak: 9,  loggedToday: true,  record: { wins: 3, losses: 2 }, stats: [{ label: "Steps/week", value: "65k"   }, { label: "Miles walked", value: "26 mi" }, { label: "Active days", value: "6/7"  }] }],
    mayhem:       [{ name: "Lou Ferreira", username: "loufit",     streak: 24, loggedToday: true,  record: { wins: 7, losses: 2 }, stats: [{ label: "Steps/week", value: "110k"  }, { label: "Miles walked", value: "46 mi" }, { label: "Active days", value: "7/7"  }] }],
  },
  biking: {
    beginner:     [{ name: "Tyler Nash",   username: "tylernash",  streak: 3,  loggedToday: false, record: { wins: 1, losses: 1 }, stats: [{ label: "Miles/week", value: "20 mi"  }, { label: "Elevation",    value: "400 ft" }, { label: "Rides",       value: "2/week" }] }],
    intermediate: [{ name: "Casey Park",   username: "caseypark",  streak: 10, loggedToday: true,  record: { wins: 4, losses: 2 }, stats: [{ label: "Miles/week", value: "60 mi"  }, { label: "Elevation",    value: "2.1k ft"}, { label: "Rides",       value: "4/week" }] }],
    mayhem:       [{ name: "Ren Calloway", username: "rencal",     streak: 28, loggedToday: true,  record: { wins: 8, losses: 1 }, stats: [{ label: "Miles/week", value: "150 mi" }, { label: "Elevation",    value: "8k ft"  }, { label: "Rides",       value: "7/week" }] }],
  },
  lifting: {
    beginner:     [{ name: "Jamie Fox",    username: "jamiefox",   streak: 4,  loggedToday: false, record: { wins: 0, losses: 2 }, stats: [{ label: "Sessions/wk", value: "2"      }, { label: "Volume/wk",  value: "6,200 lbs" }, { label: "Top PR",    value: "185 lbs"  }] }],
    intermediate: [{ name: "Ray Kim",      username: "raykim",     streak: 9,  loggedToday: true,  record: { wins: 3, losses: 3 }, stats: [{ label: "Sessions/wk", value: "4"      }, { label: "Volume/wk",  value: "18,400 lbs"}, { label: "Top PR",    value: "315 lbs"  }] }],
    mayhem:       [{ name: "Vance Cole",   username: "vancecole",  streak: 35, loggedToday: true,  record: { wins: 11, losses: 0},  stats: [{ label: "Sessions/wk", value: "6"      }, { label: "Volume/wk",  value: "42,000 lbs"}, { label: "Top PR",    value: "495 lbs"  }] }],
  },
  swimming: {
    beginner:     [{ name: "Nora Ellis",   username: "noraellis",  streak: 3,  loggedToday: false, record: { wins: 1, losses: 1 }, stats: [{ label: "Laps/week",  value: "30"      }, { label: "Distance",  value: "0.4 mi"    }, { label: "Sessions", value: "2/week" }] }],
    intermediate: [{ name: "Owen Burke",   username: "owenburke",  streak: 8,  loggedToday: true,  record: { wins: 3, losses: 2 }, stats: [{ label: "Laps/week",  value: "90"      }, { label: "Distance",  value: "1.25 mi"   }, { label: "Sessions", value: "4/week" }] }],
    mayhem:       [{ name: "Zara Osei",    username: "zaraosei",   streak: 22, loggedToday: true,  record: { wins: 8, losses: 1 }, stats: [{ label: "Laps/week",  value: "280"     }, { label: "Distance",  value: "3.9 mi"    }, { label: "Sessions", value: "7/week" }] }],
  },
  combat: {
    beginner:     [{ name: "Milo Grant",   username: "milogrant",  streak: 4,  loggedToday: false, record: { wins: 0, losses: 2 }, stats: [{ label: "Rounds/wk",  value: "6"       }, { label: "Sessions",  value: "2/week"    }, { label: "Style",    value: "Boxing"   }] }],
    intermediate: [{ name: "Leila Moss",   username: "leilamoss",  streak: 11, loggedToday: true,  record: { wins: 4, losses: 2 }, stats: [{ label: "Rounds/wk",  value: "20"      }, { label: "Sessions",  value: "4/week"    }, { label: "Style",    value: "MMA"      }] }],
    mayhem:       [{ name: "Dex Romero",   username: "dexromero",  streak: 30, loggedToday: true,  record: { wins: 10, losses: 1}, stats: [{ label: "Rounds/wk",  value: "50"      }, { label: "Sessions",  value: "7/week"    }, { label: "Style",    value: "Muay Thai"}] }],
  },
  wellness: {
    beginner:     [{ name: "Ivy Sung",     username: "ivysung",    streak: 5,  loggedToday: true,  record: { wins: 1, losses: 1 }, stats: [{ label: "Sessions/wk", value: "3"      }, { label: "Avg length", value: "15 min"    }, { label: "Focus",    value: "Breathing"}] }],
    intermediate: [{ name: "Cal Winters",  username: "calwinters", streak: 10, loggedToday: true,  record: { wins: 3, losses: 2 }, stats: [{ label: "Sessions/wk", value: "5"      }, { label: "Avg length", value: "30 min"    }, { label: "Focus",    value: "Yoga"     }] }],
    mayhem:       [{ name: "Sage Allard",  username: "sageallard", streak: 40, loggedToday: true,  record: { wins: 9, losses: 0 }, stats: [{ label: "Sessions/wk", value: "7"      }, { label: "Avg length", value: "60 min"    }, { label: "Focus",    value: "Mobility" }] }],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC ME DATA
// ─────────────────────────────────────────────────────────────────────────────

const ME = {
  name: "Joey Ross",
  username: "joey",
  workoutsThisWeek: 3,
  loggedToday: false,
  streak: 8,
  record: { wins: 3, losses: 2 },
};

const MOCK_CHAT = [
  { id: "1", from: "rival", text: "Bro I'm already up 4-3 on the week. You slipping? 😂", time: "Today 9:14 AM" },
  { id: "2", from: "me",    text: "Relax, I've got 3 days left. Watch this.",               time: "Today 9:22 AM" },
  { id: "3", from: "rival", text: "You logged yet today? Didn't think so 😤",              time: "Today 11:30 AM" },
];

const MOCK_NOTIFICATIONS = [
  { id: "1", icon: "💪", text: "Your rival logged a session — they mean business",    time: "2h ago",    type: "warning" },
  { id: "2", icon: "⚠️", text: "You're down this week. 3 days left to flip it.",     time: "Yesterday", type: "danger"  },
  { id: "3", icon: "😴", text: "Rival hasn't logged in 2 days — you're pulling ahead", time: "2 days ago", type: "success" },
];

// ─────────────────────────────────────────────────────────────────────────────
// BADGES
// ─────────────────────────────────────────────────────────────────────────────

const BADGES = [
  { id: "first_blood", emoji: "⚔️", name: "First Blood",  desc: "Challenged your first rival",   earned: true,  gradient: "linear-gradient(135deg,#9CA3AF,#E5E7EB)", border: "#9CA3AF", glow: "#9CA3AF44", label: "SILVER"   },
  { id: "on_notice",   emoji: "🔥", name: "On Notice",    desc: "Won your first week",            earned: true,  gradient: "linear-gradient(135deg,#F5A623,#F59E0B)", border: "#F5A623", glow: "#F5A62344", label: "GOLD"     },
  { id: "back2back",   emoji: "💥", name: "Back to Back", desc: "Won 2 weeks in a row",           earned: false, gradient: "linear-gradient(135deg,#EF4444,#F97316)", border: "#EF4444", glow: "#EF444444", label: "FIRE"     },
  { id: "running_it",  emoji: "👊", name: "Running It",   desc: "Won 5 total weeks",              earned: false, gradient: "linear-gradient(135deg,#7C3AED,#A855F7)", border: "#7C3AED", glow: "#7C3AED44", label: "ELECTRIC" },
  { id: "dominant",    emoji: "😤", name: "Dominant",     desc: "Won 4 straight weeks",           earned: false, gradient: "linear-gradient(135deg,#B91C1C,#EF4444)", border: "#B91C1C", glow: "#B91C1C44", label: "CRIMSON"  },
  { id: "untouchable", emoji: "💀", name: "Untouchable",  desc: "8-week undefeated streak",       earned: false, gradient: "linear-gradient(135deg,#1E1B4B,#312E81,#4338CA)", border: "#4338CA", glow: "#4338CA44", label: "COSMIC" },
  { id: "the_goat",    emoji: "🏆", name: "The GOAT",     desc: "Legendary status — 20 total wins", earned: false, gradient: "linear-gradient(135deg,#FFD700,#FF6B6B,#A855F7,#06B6D4)", border: "#FFD700", glow: "#FFD70055", label: "GALAXY" },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function pickRival(category: RivalCategory, tier: RivalTier): MockRival {
  const pool = MOCK_RIVAL_POOL[category][tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

function getCategoryLabel(cat: RivalCategory) {
  return CATEGORIES.find((c) => c.id === cat)!;
}

function getTierLabel(tier: RivalTier) {
  return TIERS.find((t) => t.id === tier)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — CATEGORY SELECTION
// ─────────────────────────────────────────────────────────────────────────────

function CategorySelect({ onSelect }: { onSelect: (c: RivalCategory) => void }) {
  const [hovered, setHovered] = useState<RivalCategory | null>(null);

  return (
    <div>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanLine {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(600%); }
        }
      `}</style>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #1A0D3E, #2D1B69, #1A0D3E)",
        borderRadius: 24, padding: "32px 28px", marginBottom: 32,
        border: "1px solid #7C3AED55", position: "relative", overflow: "hidden",
        boxShadow: "0 8px 40px rgba(124,58,237,0.2)",
      }}>
        <div style={{
          position: "absolute", left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg, transparent, #7C3AED66, transparent)",
          animation: "scanLine 3s ease-in-out infinite", pointerEvents: "none",
        }} />
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⚔️</div>
          <div style={{ fontWeight: 900, fontSize: 26, color: "#fff", marginBottom: 8, letterSpacing: -0.5 }}>
            Choose Your Battleground
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
            Pick your sport. We'll match you with someone at your level.
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
      }}>
        {CATEGORIES.map((cat, i) => {
          const isHov = hovered === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              onMouseEnter={() => setHovered(cat.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: isHov ? "linear-gradient(135deg, #1A0D3E, #2D1B69)" : "#1A1A1A",
                border: `2px solid ${isHov ? "#7C3AED" : "#2D1B69"}`,
                borderRadius: 20, padding: "22px 16px",
                cursor: "pointer", textAlign: "center",
                animation: `fadeUp 0.4s ease ${i * 0.06}s both`,
                transition: "all 0.2s",
                boxShadow: isHov ? "0 0 24px rgba(124,58,237,0.35)" : "none",
                outline: "none",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>{cat.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#F0F0F0", marginBottom: 4 }}>
                {cat.name}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.4 }}>
                {cat.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — TIER SELECTION
// ─────────────────────────────────────────────────────────────────────────────

function TierSelect({
  category,
  onBack,
  onSelect,
}: {
  category: RivalCategory;
  onBack: () => void;
  onSelect: (t: RivalTier) => void;
}) {
  const cat = getCategoryLabel(category);
  const [hovered, setHovered] = useState<RivalTier | null>(null);

  return (
    <div>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mayhemFlicker {
          0%,100% { opacity: 1; }
          92%     { opacity: 1; }
          93%     { opacity: 0.7; }
          94%     { opacity: 1; }
          96%     { opacity: 0.85; }
          97%     { opacity: 1; }
        }
      `}</style>

      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={onBack} style={{
          background: "#1A1A1A", border: "1px solid #2D1B69", borderRadius: 12,
          width: 40, height: 40, color: "#9CA3AF", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#F0F0F0" }}>
            {cat.emoji} {cat.name}
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>Choose your tier</div>
        </div>
      </div>

      {/* Tier cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {TIERS.map((tier, i) => {
          const isHov = hovered === tier.id;
          const isMayhem = tier.id === "mayhem";
          return (
            <button
              key={tier.id}
              onClick={() => onSelect(tier.id)}
              onMouseEnter={() => setHovered(tier.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: isHov || isMayhem ? tier.bg : "#1A1A1A",
                border: `2px solid ${isHov ? tier.color : tier.border}`,
                borderRadius: 20, padding: "24px 22px",
                cursor: "pointer", textAlign: "left",
                animation: `fadeUp 0.35s ease ${i * 0.1}s both${isMayhem ? ", mayhemFlicker 6s ease-in-out infinite" : ""}`,
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxShadow: isHov ? `0 0 28px ${tier.glow}` : isMayhem ? `0 4px 24px ${tier.glow}` : "none",
                outline: "none",
                position: "relative", overflow: "hidden",
              }}
            >
              {/* Mayhem noise overlay */}
              {isMayhem && (
                <div style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(239,68,68,0.03) 2px, rgba(239,68,68,0.03) 4px)",
                }} />
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                  background: `${tier.color}18`,
                  border: `2px solid ${tier.color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26,
                  boxShadow: isMayhem ? `0 0 16px ${tier.glow}` : "none",
                }}>
                  {tier.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 900,
                    fontSize: isMayhem ? 20 : 18,
                    color: tier.color,
                    marginBottom: 4,
                    textShadow: isMayhem ? `0 0 12px ${tier.color}88` : "none",
                    letterSpacing: isMayhem ? 0.5 : 0,
                  }}>
                    {tier.name}
                  </div>
                  <div style={{ fontSize: 13, color: isMayhem ? "#FCA5A5" : "#9CA3AF", lineHeight: 1.5 }}>
                    {tier.desc}
                  </div>
                </div>
                <div style={{
                  color: tier.color, fontSize: 20, fontWeight: 900,
                  opacity: isHov ? 1 : 0.4, transition: "opacity 0.2s",
                }}>→</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — AUTO-MATCHING ANIMATION
// ─────────────────────────────────────────────────────────────────────────────

function MatchingScreen({
  category,
  tier,
  onMatched,
}: {
  category: RivalCategory;
  tier: RivalTier;
  onMatched: (rival: MockRival) => void;
}) {
  const cat = getCategoryLabel(category);
  const t   = getTierLabel(tier);

  useEffect(() => {
    const rival = pickRival(category, tier);
    const timer = setTimeout(() => onMatched(rival), 1800);
    return () => clearTimeout(timer);
  }, [category, tier, onMatched]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 32, textAlign: "center" }}>
      <style>{`
        @keyframes radarPing {
          0%   { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes dotBounce {
          0%,80%,100% { transform: scale(0.6); opacity: 0.4; }
          40%         { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      {/* Radar rings */}
      <div style={{ position: "relative", width: 120, height: 120 }}>
        {[0, 0.4, 0.8].map((delay) => (
          <div key={delay} style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `2px solid ${t.color}`,
            animation: `radarPing 1.8s ease-out ${delay}s infinite`,
          }} />
        ))}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `${t.color}18`, border: `2px solid ${t.color}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40,
          animation: "spinSlow 4s linear infinite",
        }}>
          {cat.emoji}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 900, fontSize: 22, color: "#F0F0F0", marginBottom: 8 }}>
          Searching for your rival...
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${t.color}18`, border: `1px solid ${t.color}44`,
          borderRadius: 99, padding: "6px 16px", fontSize: 13, color: t.color, fontWeight: 700,
        }}>
          {cat.emoji} {cat.name} · {t.emoji} {t.name}
        </div>
      </div>

      {/* Bouncing dots */}
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 0.2, 0.4].map((delay) => (
          <div key={delay} style={{
            width: 10, height: 10, borderRadius: "50%",
            background: t.color,
            animation: `dotBounce 1.2s ease-in-out ${delay}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE — HEAD TO HEAD PANEL (category-aware)
// ─────────────────────────────────────────────────────────────────────────────

function HeadToHeadPanel({ rival, category, tier }: { rival: MockRival; category: RivalCategory; tier: RivalTier }) {
  const cat = getCategoryLabel(category);
  const t   = getTierLabel(tier);
  const rivalAhead = rival.record.wins > ME.record.wins;
  const iAhead     = ME.record.wins > rival.record.wins;
  const totalW     = ME.workoutsThisWeek + 4; // mock rival workouts
  const myPct      = Math.round((ME.workoutsThisWeek / totalW) * 100);

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

      {/* Category + tier badges */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#1A1A1A", border: "1px solid #2D1B69",
          borderRadius: 99, padding: "6px 14px", fontSize: 13, color: "#F0F0F0", fontWeight: 800,
        }}>
          {cat.emoji} {cat.name}
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${t.color}18`, border: `1px solid ${t.color}44`,
          borderRadius: 99, padding: "6px 14px", fontSize: 13, color: t.color, fontWeight: 800,
          boxShadow: `0 0 10px ${t.glow}`,
        }}>
          {t.emoji} {t.name}
        </div>
      </div>

      {/* Section title */}
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        ⚔️ Head-to-Head
        <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", background: "#EF444422", padding: "2px 8px", borderRadius: 99, border: "1px solid #EF444444" }}>
          LIVE
        </span>
      </div>

      {/* Battle card */}
      <div style={{
        background: "linear-gradient(135deg, #1A0D3E, #1A1A1A, #1A0A0A)",
        borderRadius: 24, border: "2px solid #EF444455",
        padding: "24px", marginBottom: 20,
        animation: "h2hGlow 3s ease-in-out infinite",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 30% 50%, #7C3AED08 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, #EF444408 0%, transparent 60%)" }} />

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
          </div>

          {/* VS */}
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
              background: "linear-gradient(135deg, #EF4444, #EF444488)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 900, color: "#fff",
              border: rivalAhead ? "3px solid #EF4444" : "3px solid #7C3AED44",
              boxShadow: rivalAhead ? "0 0 20px #EF444455" : "none",
            }}>
              {getInitials(rival.name)}
            </div>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#F0F0F0" }}>{rival.name.split(" ")[0]}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>@{rival.username}</div>
          </div>
        </div>

        {/* Category stats */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            {cat.emoji} {cat.name} Stats
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {rival.stats.map((s) => (
              <div key={s.label} style={{
                background: "#0D0D0D", borderRadius: 12, padding: "12px 10px",
                border: "1px solid #2D1B69", textAlign: "center",
              }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: "#F0F0F0", marginBottom: 2 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* This week */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Workouts This Week
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 900, fontSize: 22, color: "#7C3AED", minWidth: 24, textAlign: "center" }}>{ME.workoutsThisWeek}</span>
            <div style={{ flex: 1, height: 12, background: "#0D0D0D", borderRadius: 99, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${myPct}%`, background: "linear-gradient(90deg, #7C3AED, #9D5CF0)", transition: "width 0.8s ease" }} />
              <div style={{ flex: 1, background: "#EF444455" }} />
            </div>
            <span style={{ fontWeight: 900, fontSize: 22, color: "#EF4444", minWidth: 24, textAlign: "center" }}>4</span>
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
            <div style={{ fontWeight: 900, fontSize: 20, color: "#EF4444" }}>{rival.streak}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>THEIR STREAK</div>
          </div>
        </div>

        {/* Record */}
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
                {Math.round((ME.record.wins / (ME.record.wins + ME.record.losses)) * 100)}%
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700 }}>WIN RATE</div>
            </div>
          </div>
        </div>

        {/* Today status */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: ME.loggedToday ? "Logged Today ✓" : "Not Logged Yet", sublabel: "You",               logged: ME.loggedToday, isThreat: false },
            { label: rival.loggedToday ? "Logged Today ⚠️" : "Not Yet 😴",  sublabel: rival.name.split(" ")[0], logged: rival.loggedToday, isThreat: true  },
          ].map((s) => (
            <div key={s.sublabel} style={{
              flex: 1, background: "#0D0D0D", borderRadius: 12, padding: "12px 14px",
              border: `1px solid ${(s.logged && s.isThreat) ? "#EF444433" : (s.logged) ? "#10B98144" : "#EF444433"}`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                background: (s.logged && s.isThreat) ? "#EF4444" : s.logged ? "#10B981" : "#EF4444",
                boxShadow: (s.logged && s.isThreat) ? "0 0 10px #EF4444" : s.logged ? "0 0 10px #10B981" : "0 0 10px #EF4444",
                animation: "statusPulse 1.5s ease-in-out infinite",
              }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: (s.logged && s.isThreat) ? "#EF4444" : s.logged ? "#10B981" : "#EF4444" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{s.sublabel}</div>
              </div>
            </div>
          ))}
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
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 6 }}>🏅 Rival Badges</div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
        Earn badges by dominating your rivals. Lock in that legacy.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 14 }}>
        {BADGES.map((badge) => (
          <div key={badge.id} style={{
            borderRadius: 18, padding: "18px 14px",
            background: badge.earned ? badge.gradient : "#1A1A1A",
            border: `2px solid ${badge.earned ? badge.border : "#2D2D2D"}`,
            textAlign: "center", position: "relative", overflow: "hidden",
            boxShadow: badge.earned ? `0 4px 20px ${badge.glow}` : "none",
            opacity: badge.earned ? 1 : 0.55,
          }}>
            {!badge.earned && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, zIndex: 2 }}>
                <div style={{ fontSize: 22, filter: "grayscale(1)" }}>🔒</div>
              </div>
            )}
            {badge.earned && (
              <div style={{ position: "absolute", top: -20, left: -20, width: 60, height: 60, background: "radial-gradient(circle,rgba(255,255,255,0.2) 0%,transparent 70%)", pointerEvents: "none" }} />
            )}
            <div style={{ fontSize: 32, marginBottom: 8, filter: badge.earned ? "none" : "grayscale(1)" }}>{badge.emoji}</div>
            <div style={{ fontWeight: 900, fontSize: 13, color: badge.earned ? "#fff" : "#6B7280", marginBottom: 4, textShadow: badge.earned ? "0 1px 4px rgba(0,0,0,0.4)" : "none" }}>
              {badge.name}
            </div>
            <div style={{ fontSize: 10, color: badge.earned ? "rgba(255,255,255,0.8)" : "#4B5563", lineHeight: 1.4, marginBottom: 8 }}>
              {badge.desc}
            </div>
            {badge.earned && (
              <div style={{ display: "inline-block", background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "2px 8px", fontSize: 9, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>
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

function ChatPanel({ rivalFirstName }: { rivalFirstName: string }) {
  const [messages, setMessages] = useState(MOCK_CHAT);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { id: String(Date.now()), from: "me", text: trimmed, time: "Just now" }]);
    setInput("");
  }

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 6 }}>💬 Rival Chat</div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>Talk your trash. Back it up.</div>
      <div style={{ background: "#1A1A1A", borderRadius: 20, border: "1px solid #2D1B69", overflow: "hidden" }}>
        <div style={{ padding: "16px", height: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((msg) => {
            const isMe = msg.from === "me";
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
                {!isMe && (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#EF4444,#EF444488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>
                    {rivalFirstName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ maxWidth: "72%" }}>
                  <div style={{ padding: "10px 14px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? "linear-gradient(135deg,#7C3AED,#9D5CF0)" : "#2D2D2D", color: "#fff", fontSize: 13, lineHeight: 1.5, boxShadow: isMe ? "0 4px 12px #7C3AED44" : "none" }}>
                    {msg.text}
                  </div>
                  <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4, textAlign: isMe ? "right" : "left" }}>{msg.time}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #2D1B69", display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Say something... 😤"
            style={{ flex: 1, background: "#0D0D0D", border: "1px solid #2D1B69", borderRadius: 24, padding: "10px 16px", fontSize: 13, color: "#F0F0F0", outline: "none", fontFamily: "inherit" }}
          />
          <button onClick={sendMessage} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "linear-gradient(135deg,#7C3AED,#9D5CF0)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px #7C3AED55" }}>
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
  const typeColors: Record<string, string> = { warning: "#F5A623", danger: "#EF4444", success: "#10B981" };
  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 18, color: "#F0F0F0", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
        📡 Rival Activity
        <span style={{ background: "#EF444422", color: "#EF4444", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99, border: "1px solid #EF444444" }}>LIVE</span>
      </div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>Real-time intel on what your rival is doing.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MOCK_NOTIFICATIONS.map((notif) => {
          const color = typeColors[notif.type] ?? "#9CA3AF";
          return (
            <div key={notif.id} style={{ background: "#1A1A1A", borderRadius: 14, border: `1px solid ${color}22`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: `${color}15`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                {notif.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#F0F0F0", lineHeight: 1.4 }}>{notif.text}</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{notif.time}</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function RivalsPage() {
  const [matchStep, setMatchStep]           = useState<MatchStep>("category");
  const [rivalCategory, setRivalCategory]   = useState<RivalCategory | null>(null);
  const [rivalTier, setRivalTier]           = useState<RivalTier | null>(null);
  const [activeRival, setActiveRival]       = useState<MockRival | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  function handleSelectCategory(c: RivalCategory) {
    setRivalCategory(c);
    setMatchStep("tier");
  }

  function handleSelectTier(t: RivalTier) {
    setRivalTier(t);
    setMatchStep("matching");
  }

  function handleMatched(rival: MockRival) {
    setActiveRival(rival);
    setMatchStep("active");
  }

  function handleReset() {
    setMatchStep("category");
    setRivalCategory(null);
    setRivalTier(null);
    setActiveRival(null);
    setShowResetConfirm(false);
  }

  const isActive = matchStep === "active" && activeRival && rivalCategory && rivalTier;
  const cat = rivalCategory ? getCategoryLabel(rivalCategory) : null;
  const t   = rivalTier    ? getTierLabel(rivalTier)          : null;

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
            <Link href="/connect" style={{ color: "#9CA3AF", fontSize: 20, textDecoration: "none", display: "flex", alignItems: "center" }}>←</Link>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 22, color: "#F0F0F0", letterSpacing: -0.5 }}>⚔️ Rivals</div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                {isActive
                  ? `You vs ${activeRival.name} · ${cat!.name} · ${t!.name}`
                  : matchStep === "tier"
                  ? `${cat?.emoji} ${cat?.name} — pick your tier`
                  : matchStep === "matching"
                  ? "Finding your match..."
                  : "Choose your battleground"}
              </div>
            </div>
            {isActive && (
              <div style={{ background: "#EF444422", border: "1px solid #EF444444", borderRadius: 99, padding: "4px 12px", fontSize: 11, fontWeight: 800, color: "#EF4444", animation: "headerPulse 2s infinite" }}>
                🔴 ACTIVE
              </div>
            )}
          </div>

          {/* Tab bar for active view */}
          {isActive && (
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #2D1B69" }}>
              {["Battle", "Badges", "Chat", "Feed"].map((tab, i) => (
                <button key={tab} onClick={() => document.getElementById(`section-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  style={{ padding: "8px 18px", background: "none", border: "none", borderBottom: "2px solid transparent", color: "#9CA3AF", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 120px" }}>

        {matchStep === "category" && (
          <CategorySelect onSelect={handleSelectCategory} />
        )}

        {matchStep === "tier" && rivalCategory && (
          <TierSelect
            category={rivalCategory}
            onBack={() => setMatchStep("category")}
            onSelect={handleSelectTier}
          />
        )}

        {matchStep === "matching" && rivalCategory && rivalTier && (
          <MatchingScreen
            category={rivalCategory}
            tier={rivalTier}
            onMatched={handleMatched}
          />
        )}

        {isActive && (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            <div id="section-0">
              <HeadToHeadPanel rival={activeRival} category={rivalCategory!} tier={rivalTier!} />
            </div>
            <div id="section-1"><BadgesPanel /></div>
            <div id="section-2"><ChatPanel rivalFirstName={activeRival.name.split(" ")[0]} /></div>
            <div id="section-3"><NotificationsPanel /></div>

            {/* Change category / drop rival */}
            <div style={{ textAlign: "center", paddingBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {!showResetConfirm ? (
                <>
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    style={{ background: "transparent", border: "1px solid #2D1B69", borderRadius: 12, padding: "10px 24px", color: "#9CA3AF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    🔀 Change Category
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    style={{ background: "transparent", border: "1px solid #2D1B69", borderRadius: 12, padding: "10px 24px", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    Drop Rival
                  </button>
                </>
              ) : (
                <div style={{ background: "#1A1A1A", borderRadius: 16, padding: "20px", border: "1px solid #EF444433" }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#F0F0F0", marginBottom: 8 }}>Are you sure?</div>
                  <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 16 }}>This will drop your current rival and reset your category.</div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button onClick={handleReset} style={{ background: "#EF444422", border: "1px solid #EF444444", borderRadius: 10, padding: "10px 20px", color: "#EF4444", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      Yes, reset
                    </button>
                    <button onClick={() => setShowResetConfirm(false)} style={{ background: "#1A1A1A", border: "1px solid #2D1B69", borderRadius: 10, padding: "10px 20px", color: "#9CA3AF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

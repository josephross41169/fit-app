"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RivalCard, { type Rival } from "@/components/RivalCard";

const C = {
  blue:"#7C3AED", greenLight:"#1A2A1A", greenMid:"#2A3A2A",
  gold:"#F5A623", goldLight:"#FFFBEE",
  text:"#F0F0F0", sub:"#9CA3AF", white:"#1A1A1A", bg:"#0D0D0D",
  green:"#52C97A",
  dark:"#0D0D0D", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA (fallback)
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_GROUPS_MOCK = [
  {
    id: "lv-morning-runners",
    name: "LV Morning Runners",
    category: "Running",
    emoji: "🏃",
    city: "Las Vegas, NV",
    members: 284,
    active: true,
    meetFrequency: "Every Saturday 6AM",
    location: "Red Rock Canyon Trailhead",
    tags: ["#Running","#LasVegas","#5K","#TrailRun"],
    description: "Las Vegas's most active morning run crew. All paces welcome. We meet weekly at Red Rock and host monthly races.",
    nextEvent: { name: "Saturday 5K", date: "Mar 29", time: "6:00 AM" },
    recentPhoto: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80",
    is_local: true,
  },
  {
    id: "summerlin-iron-club",
    name: "Summerlin Iron Club",
    category: "Strength",
    emoji: "🏋️",
    city: "Las Vegas, NV",
    members: 156,
    active: true,
    meetFrequency: "Mon / Wed / Fri 5:30AM",
    location: "24 Hour Fitness · Summerlin",
    tags: ["#Powerlifting","#Summerlin","#Strength"],
    description: "Serious lifters who show up early and push each other. Powerlifting-focused with a supportive community vibe.",
    nextEvent: { name: "Max Out Monday", date: "Mar 31", time: "5:30 AM" },
    recentPhoto: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80",
    is_local: true,
  },
  {
    id: "vegas-yoga-collective",
    name: "Vegas Yoga Collective",
    category: "Yoga",
    emoji: "🧘",
    city: "Las Vegas, NV",
    members: 412,
    active: true,
    meetFrequency: "Every Sunday 8AM",
    location: "Sunset Park · Las Vegas",
    tags: ["#Yoga","#Wellness","#LasVegas","#Mindfulness"],
    description: "Free community yoga every Sunday in the park. All levels, all ages, all bodies. Mats provided for beginners.",
    nextEvent: { name: "Sunday Flow", date: "Mar 30", time: "8:00 AM" },
    recentPhoto: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&q=80",
    is_local: true,
  },
  {
    id: "lv-hiit-squad",
    name: "LV HIIT Squad",
    category: "HIIT",
    emoji: "🔥",
    city: "Las Vegas, NV",
    members: 198,
    active: true,
    meetFrequency: "Tue / Thu 6PM",
    location: "Springs Preserve · Las Vegas",
    tags: ["#HIIT","#LasVegas","#Bootcamp","#Cardio"],
    description: "High intensity, zero judgment. Outdoor bootcamp sessions that leave you completely gassed. Bring water.",
    nextEvent: { name: "Thursday Burnout", date: "Mar 27", time: "6:00 PM" },
    recentPhoto: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&q=80",
    is_local: true,
  },
];

const ONLINE_GROUPS_MOCK = [
  {
    id: "global-gains-community",
    name: "Global Gains Community",
    category: "Bodybuilding",
    emoji: "💪",
    members: 48200,
    isPrivate: false,
    tags: ["#Bodybuilding","#Gains","#Worldwide"],
    description: "The internet's most supportive bodybuilding community. Post your lifts, get form checks, share progress. No judgment zone.",
    nextEvent: { name: "Weekly Check-In Thread", date: "Every Monday", time: "All Day" },
    recentPhoto: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80",
    trending: true,
    is_local: false,
  },
  {
    id: "women-who-lift",
    name: "Women Who Lift",
    category: "Strength",
    emoji: "👊",
    members: 31500,
    isPrivate: false,
    tags: ["#WomenWhoLift","#StrongWomen","#Fitness"],
    description: "A safe, empowering space for women in strength sports. PR celebrations, advice, competitions, and genuine support.",
    nextEvent: { name: "Monthly PR Board", date: "Apr 1", time: "All Day" },
    recentPhoto: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80",
    trending: true,
    is_local: false,
  },
  {
    id: "macro-masters",
    name: "Macro Masters",
    category: "Nutrition",
    emoji: "🥗",
    members: 22800,
    isPrivate: false,
    tags: ["#MacroTracking","#Nutrition","#WeightLoss"],
    description: "Nutrition-focused community for macro tracking, meal prep, and sustainable eating habits. Recipe sharing every Friday.",
    nextEvent: { name: "Meal Prep Sunday", date: "Mar 30", time: "All Day" },
    recentPhoto: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&q=80",
    trending: false,
    is_local: false,
  },
  {
    id: "mindful-movement-collective",
    name: "Mindful Movement",
    category: "Wellness",
    emoji: "🌿",
    members: 18400,
    isPrivate: false,
    tags: ["#Wellness","#Mindfulness","#Recovery","#Yoga"],
    description: "Where fitness meets mental health. Yoga, meditation, recovery, breathwork — taking care of your whole self.",
    nextEvent: { name: "Rest Day Vibes Thread", date: "Every Sunday", time: "All Day" },
    recentPhoto: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&q=80",
    trending: false,
    is_local: false,
  },
  {
    id: "5k-to-marathon",
    name: "5K to Marathon Club",
    category: "Running",
    emoji: "🏅",
    members: 34600,
    isPrivate: false,
    tags: ["#Running","#Marathon","#5K","#Training"],
    description: "From couch to 5K to your first marathon. Structured training plans, running buddies, and race day support worldwide.",
    nextEvent: { name: "Training Plan Drop", date: "Mar 31", time: "9:00 AM" },
    recentPhoto: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80",
    trending: true,
    is_local: false,
  },
  {
    id: "calisthenics-worldwide",
    name: "Calisthenics Worldwide",
    category: "Calisthenics",
    emoji: "🤸",
    members: 56900,
    isPrivate: false,
    tags: ["#Calisthenics","#StreetWorkout","#Bodyweight"],
    description: "No gym needed. The global hub for calisthenics athletes, street workout crews, and bodyweight training enthusiasts.",
    nextEvent: { name: "Skill Challenge: Handstand", date: "Apr 5", time: "All Day" },
    recentPhoto: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80",
    trending: true,
    is_local: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RIVALS — MOCK DATA + COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const mockRival: Rival = {
  name: "Marcus Webb",
  username: "marcuswebb",
  tier: "grinder",
  workoutsThisWeek: 4,
  myWorkoutsThisWeek: 3,
  loggedToday: true,
  myLoggedToday: false,
  record: { wins: 3, losses: 2 },
  streak: 12,
};

const MOCK_RIVAL_FEED = [
  { id: "1", user: "Marcus Webb", avatar: "MW", action: "completed a workout", detail: "Upper Body Strength · 52 min", time: "2h ago", emoji: "🏋️" },
  { id: "2", user: "Marcus Webb", avatar: "MW", action: "hit a new PR", detail: "Bench Press — 225 lbs", time: "1d ago", emoji: "💪" },
  { id: "3", user: "Marcus Webb", avatar: "MW", action: "logged a run", detail: "5.2 miles · 48:20", time: "2d ago", emoji: "🏃" },
];

function RivalsTab() {
  return (
    <div>
      <style>{`
        @keyframes rivalTabPulse {
          0%   { box-shadow: 0 0 12px 2px #7C3AED44; }
          50%  { box-shadow: 0 0 24px 6px #7C3AED77; }
          100% { box-shadow: 0 0 12px 2px #7C3AED44; }
        }
        @keyframes rivalStatusPulse {
          0%   { opacity: 1; }
          50%  { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* Hero CTA */}
      <div style={{
        background: "linear-gradient(135deg, #2D1B69, #1A0D3E)",
        borderRadius: 24, padding: "28px 24px", marginBottom: 24,
        border: "1px solid #7C3AED55",
        animation: "rivalTabPulse 3s ease-in-out infinite",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle, #7C3AED1A 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 44 }}>⚔️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>Rival System</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>
              Pick a rival. Track them. Beat them. Repeat.
            </div>
          </div>
          <div style={{
            background: "#EF444422", border: "1px solid #EF444444",
            borderRadius: 99, padding: "4px 12px",
            fontSize: 11, fontWeight: 800, color: "#EF4444",
            animation: "rivalStatusPulse 1.5s infinite",
          }}>
            🔴 ACTIVE
          </div>
        </div>

        {/* Quick h2h summary */}
        <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: 16, padding: "16px 18px", marginBottom: 20, border: "1px solid rgba(124,58,237,0.2)" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            This Week
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "center", minWidth: 40 }}>
              <div style={{ fontWeight: 900, fontSize: 24, color: "#7C3AED" }}>3</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>YOU</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 10, background: "rgba(0,0,0,0.5)", borderRadius: 99, overflow: "hidden", display: "flex" }}>
                <div style={{ width: "43%", background: "linear-gradient(90deg, #7C3AED, #9D5CF0)" }} />
                <div style={{ flex: 1, background: "#EF4444", opacity: 0.8 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "#7C3AED", fontWeight: 700 }}>43%</span>
                <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 700 }}>57%</span>
              </div>
            </div>
            <div style={{ textAlign: "center", minWidth: 40 }}>
              <div style={{ fontWeight: 900, fontSize: 24, color: "#EF4444" }}>4</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>MARCUS</div>
            </div>
          </div>
          <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "#EF4444", fontWeight: 700 }}>
            They logged today and you haven't 👀
          </div>
        </div>

        {/* Open rivals page CTA */}
        <a href="/rivals" style={{ textDecoration: "none", display: "block" }}>
          <button style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #7C3AED, #9D5CF0)",
            color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer",
            boxShadow: "0 6px 24px #7C3AED55", letterSpacing: 0.3,
          }}>
            ⚔️ Open Full Rivals Page →
          </button>
        </a>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Record", value: "3-2", color: "#7C3AED" },
          { label: "Streak", value: "8🔥", color: "#F5A623" },
          { label: "Win Rate", value: "60%", color: "#7C3AED" },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: "#1A1A1A", borderRadius: 14,
            border: "1px solid #2D1B69", padding: "14px",
            textAlign: "center",
          }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent activity teaser */}
      <div style={{ fontWeight: 800, fontSize: 13, color: "#9CA3AF", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
        📡 Recent Activity
      </div>
      {[
        { emoji: "💪", text: "Marcus logged Leg Day — 14,800 lbs", time: "2h ago", color: "#EF4444" },
        { emoji: "🏆", text: "Marcus hit a PR on Squat — 315 lbs", time: "5h ago", color: "#EF4444" },
        { emoji: "😴", text: "Marcus hasn't logged in 2 days — you're ahead", time: "2d ago", color: "#7C3AED" },
      ].map((item, i) => (
        <div key={i} style={{
          background: "#1A1A1A", borderRadius: 12,
          border: `1px solid ${item.color}22`, padding: "12px 14px",
          marginBottom: 8, display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `${item.color}15`, border: `1px solid ${item.color}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>{item.emoji}</div>
          <div style={{ flex: 1, fontSize: 12, color: "#F0F0F0" }}>{item.text}</div>
          <div style={{ fontSize: 10, color: "#6B7280", flexShrink: 0 }}>{item.time}</div>
        </div>
      ))}

      <a href="/rivals" style={{ textDecoration: "none", display: "block", marginTop: 16 }}>
        <div style={{
          textAlign: "center", color: "#7C3AED", fontWeight: 800,
          fontSize: 13, padding: "12px", borderRadius: 12,
          border: "1px solid #7C3AED44", background: "rgba(124,58,237,0.08)",
          cursor: "pointer",
        }}>
          View Full Battle Screen →
        </div>
      </a>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  "Running":      "#7C3AED",
  "Strength":     "#7C3AED",
  "Yoga":         "#52C97A",
  "HIIT":         "#EF4444",
  "Bodybuilding": "#F5A623",
  "Nutrition":    "#7C3AED",
  "Wellness":     "#4ADE80",
  "Calisthenics": "#7C3AED",
  "General":      "#7C3AED",
};

// Normalize a DB group to display format
function normalizeDbGroup(g: any) {
  return {
    id: g.id,
    name: g.name,
    category: g.category || 'General',
    emoji: g.emoji || '💪',
    city: g.location || 'Online',
    members: g.member_count || 0,
    active: true,
    meetFrequency: g.meet_frequency || '',
    location: g.location || '',
    tags: g.tags || [],
    description: g.description || '',
    nextEvent: null,
    recentPhoto: g.banner_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
    is_local: !g.is_online,
    trending: false,
    isPrivate: false,
    is_member: g.is_member || false,
    db_id: g.id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function GroupCard({ group, onJoin }: { group: any; onJoin?: (id: string) => void }) {
  const [joined, setJoined] = useState(group.is_member || false);
  const [joining, setJoining] = useState(false);
  const router = useRouter();
  const catColor = CATEGORY_COLORS[group.category] ?? C.blue;

  async function handleJoin(e: React.MouseEvent) {
    e.stopPropagation();
    if (joined || joining) {
      router.push(`/groups/${group.id}`);
      return;
    }
    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && group.db_id) {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'join_group', payload: { userId: user.id, groupId: group.db_id } }),
        });
      }
      setJoined(true);
      onJoin?.(group.id);
    } catch {
      setJoined(true);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div
      style={{ background:C.white, borderRadius:20, border:`2px solid ${C.greenMid}`, marginBottom:24, overflow:"hidden", boxShadow:"0 4px 20px rgba(22,163,74,0.09)", cursor:"pointer", transition:"transform 0.15s, box-shadow 0.15s" }}
      onClick={() => router.push(`/groups/${group.id}`)}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(22,163,74,0.18)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(22,163,74,0.09)"; }}
    >
      {/* Photo banner */}
      <div style={{ width:"100%", aspectRatio:"16/7", overflow:"hidden", position:"relative", background:"#111" }}>
        <img src={group.recentPhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65))" }} />
        <div style={{ position:"absolute", top:12, left:14, background:catColor, borderRadius:99, padding:"4px 12px", fontSize:11, fontWeight:800, color:"#fff" }}>
          {group.emoji} {group.category}
        </div>
        {group.active && (
          <div style={{ position:"absolute", top:12, right:14, display:"flex", alignItems:"center", gap:5, background:"rgba(0,0,0,0.5)", borderRadius:99, padding:"4px 10px", backdropFilter:"blur(4px)" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#52C97A" }} />
            <span style={{ fontSize:10, fontWeight:700, color:"#fff" }}>Active</span>
          </div>
        )}
        {group.trending && (
          <div style={{ position:"absolute", top:12, right:14, display:"flex", alignItems:"center", gap:5, background:"rgba(245,158,11,0.9)", borderRadius:99, padding:"4px 10px" }}>
            <span style={{ fontSize:10, fontWeight:800, color:"#fff" }}>🔥 Trending</span>
          </div>
        )}
        <div style={{ position:"absolute", bottom:14, left:16, right:16 }}>
          <div style={{ fontWeight:900, fontSize:18, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,0.4)" }}>{group.name}</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginTop:2 }}>
            {group.is_local ? `📍 ${group.city}` : "🌍 Online · Worldwide"}
          </div>
        </div>
      </div>

      <div style={{ padding:"14px 18px 16px" }}>
        <div style={{ display:"flex", gap:20, marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:14 }}>👥</span>
            <span style={{ fontWeight:800, fontSize:13, color:C.text }}>{(group.members || 0).toLocaleString()}</span>
            <span style={{ fontSize:12, color:C.sub }}>members</span>
          </div>
          {group.meetFrequency && (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:14 }}>🗓️</span>
              <span style={{ fontSize:12, color:C.sub }}>{group.meetFrequency}</span>
            </div>
          )}
        </div>

        <p style={{ fontSize:13, color:C.sub, lineHeight:1.6, marginBottom:12 }}>{group.description}</p>

        {group.nextEvent && (
          <div style={{ display:"flex", alignItems:"center", gap:10, background:C.greenLight, borderRadius:12, padding:"10px 14px", marginBottom:14, border:`1px solid ${C.greenMid}` }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${catColor},${catColor}CC)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{group.emoji}</div>
            <div>
              <div style={{ fontSize:11, color:C.sub, fontWeight:600 }}>Next Event</div>
              <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{group.nextEvent.name}</div>
              <div style={{ fontSize:11, color:C.sub }}>{group.nextEvent.date} · {group.nextEvent.time}</div>
            </div>
          </div>
        )}

        {group.tags && group.tags.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
            {group.tags.map((t: string) => (
              <span key={t} style={{ background:C.greenLight, color:C.blue, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, border:`1px solid ${C.greenMid}` }}>{t}</span>
            ))}
          </div>
        )}

        <button
          onClick={handleJoin}
          style={{ width:"100%", padding:"11px", borderRadius:13, border:"none", background:joined?"rgba(22,163,74,0.12)":"linear-gradient(135deg,#7C3AED,#A78BFA)", color:joined?"#7C3AED":"#fff", fontWeight:800, fontSize:14, cursor:"pointer", transition:"all 0.15s", boxShadow:joined?"none":"0 4px 14px rgba(22,163,74,0.35)", opacity:joining?0.7:1 }}
        >
          {joining ? "Joining..." : joined ? "✓ Joined — View Group" : "Join Group"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE GROUP MODAL
// ─────────────────────────────────────────────────────────────────────────────
const EMOJI_OPTIONS = ["💪","🏃","🧘","🔥","🏋️","🥗","🌿","🤸","🏅","⚡","🌱","🦾","🏆","🚀","❤️","🧠"];

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (group: any) => void }) {
  const [form, setForm] = useState({
    name: '', description: '', category: 'General', emoji: '💪',
    location: '', meet_frequency: '', is_online: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('You must be logged in'); setSubmitting(false); return; }

      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_group', payload: { userId: user.id, ...form } }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setSubmitting(false); return; }
      onCreated(data.group);
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:"#1A1D2E", borderRadius:24, border:"1px solid #2A2D3E", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", padding:"28px 24px" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:900, fontSize:18, color:"#E2E8F0", marginBottom:6 }}>Create a Group</div>
        <div style={{ fontSize:13, color:"#8892A4", marginBottom:20 }}>Build your fitness community</div>

        <form onSubmit={handleSubmit}>
          {/* Emoji picker */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, color:"#8892A4", fontWeight:700, marginBottom:8 }}>Choose an Emoji</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {EMOJI_OPTIONS.map(em => (
                <button key={em} type="button" onClick={() => setForm(f=>({...f,emoji:em}))}
                  style={{ width:40, height:40, borderRadius:10, border:`2px solid ${form.emoji===em?"#7C3AED":"#2A2D3E"}`, background:form.emoji===em?"rgba(22,163,74,0.2)":"transparent", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, color:"#8892A4", fontWeight:700, display:"block", marginBottom:6 }}>Group Name *</label>
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
              placeholder="e.g. Vegas Morning Runners" required
              style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
          </div>

          {/* Description */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, color:"#8892A4", fontWeight:700, display:"block", marginBottom:6 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))}
              placeholder="What's this group about?" rows={3}
              style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit", resize:"vertical", boxSizing:"border-box" }} />
          </div>

          {/* Category */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, color:"#8892A4", fontWeight:700, display:"block", marginBottom:6 }}>Category</label>
            <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}
              style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit" }}>
              {Object.keys(CATEGORY_COLORS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* Location + Meet Frequency */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:12, color:"#8892A4", fontWeight:700, display:"block", marginBottom:6 }}>Location</label>
              <input value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))}
                placeholder="Las Vegas, NV"
                style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ fontSize:12, color:"#8892A4", fontWeight:700, display:"block", marginBottom:6 }}>Meet Frequency</label>
              <input value={form.meet_frequency} onChange={e => setForm(f=>({...f,meet_frequency:e.target.value}))}
                placeholder="Every Saturday 6AM"
                style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
            </div>
          </div>

          {/* Online toggle */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, padding:"12px 14px", background:"#252A3D", borderRadius:10, border:"1px solid #2A2D3E" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13, color:"#E2E8F0" }}>Online Group</div>
              <div style={{ fontSize:11, color:"#8892A4" }}>Members join from anywhere worldwide</div>
            </div>
            <button type="button" onClick={() => setForm(f=>({...f,is_online:!f.is_online}))}
              style={{ width:44, height:24, borderRadius:12, background:form.is_online?"#7C3AED":"#2A2D3E", border:"none", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
              <div style={{ position:"absolute", top:2, left:form.is_online?22:2, width:20, height:20, borderRadius:10, background:"#fff", transition:"left 0.2s" }} />
            </button>
          </div>

          {error && <div style={{ color:"#EF4444", fontSize:12, marginBottom:12 }}>{error}</div>}

          <div style={{ display:"flex", gap:10 }}>
            <button type="button" onClick={onClose}
              style={{ flex:1, padding:"11px", borderRadius:12, border:"1px solid #2A2D3E", background:"transparent", color:"#8892A4", fontWeight:700, fontSize:13, cursor:"pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              style={{ flex:2, padding:"11px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#7C3AED,#A78BFA)", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", opacity:submitting?0.7:1 }}>
              {submitting ? "Creating..." : "Create Group 🚀"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEARBY PLACES WIDGET
// ─────────────────────────────────────────────────────────────────────────────
const PLACE_CATEGORIES = ["Gym","Yoga","Recovery","Nutrition","Running","Cycling","Martial Arts","CrossFit"];

const MOCK_PLACES: Record<string, { name:string; category:string; distance:string; rating:number; address:string; emoji:string; }[]> = {
  "89101": [
    { name:"24 Hour Fitness Summerlin", category:"Gym", distance:"1.2 mi", rating:4.3, address:"2101 S Fort Apache Rd", emoji:"🏋️" },
    { name:"CorePower Yoga Las Vegas", category:"Yoga", distance:"0.8 mi", rating:4.7, address:"8925 W Sahara Ave", emoji:"🧘" },
    { name:"Orangetheory Fitness", category:"Gym", distance:"2.1 mi", rating:4.5, address:"9484 W Flamingo Rd", emoji:"🔥" },
    { name:"Floyd's Nutrition", category:"Nutrition", distance:"0.4 mi", rating:4.6, address:"4440 E Sunset Rd", emoji:"🥗" },
    { name:"The Cryotherapy Clinic", category:"Recovery", distance:"3.2 mi", rating:4.8, address:"7465 W Lake Mead Blvd", emoji:"❄️" },
    { name:"Las Vegas Running Club", category:"Running", distance:"1.5 mi", rating:4.9, address:"Craig Ranch Regional Park", emoji:"🏃" },
  ],
  "default": [
    { name:"Local Gym", category:"Gym", distance:"0.5 mi", rating:4.2, address:"Near your location", emoji:"🏋️" },
    { name:"Yoga Studio", category:"Yoga", distance:"0.8 mi", rating:4.5, address:"Near your location", emoji:"🧘" },
    { name:"Nutrition Store", category:"Nutrition", distance:"1.1 mi", rating:4.3, address:"Near your location", emoji:"🥗" },
    { name:"Recovery Center", category:"Recovery", distance:"1.4 mi", rating:4.6, address:"Near your location", emoji:"❄️" },
  ],
};

function NearbyPlaces() {
  const [zip, setZip] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  const places = submitted ? (MOCK_PLACES[zip] || MOCK_PLACES["default"]) : [];
  const filtered = activeCategory === "All" ? places : places.filter(p => p.category === activeCategory);

  return (
    <div style={{ background:C.darkCard, borderRadius:16, border:`1px solid ${C.darkBorder}`, padding:"16px" }}>
      <div style={{ fontWeight:900, fontSize:14, color:"#E2E8F0", marginBottom:4 }}>📍 Discover Places Near You</div>
      <p style={{ fontSize:11, color:C.darkSub, lineHeight:1.5, marginBottom:12 }}>Enter your zip code to find gyms, studios, recovery centers, and nutrition spots near you.</p>

      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        <input value={zip} onChange={e => setZip(e.target.value.replace(/\D/g,"").slice(0,5))} onKeyDown={e => e.key==="Enter" && zip.length===5 && setSubmitted(true)}
          placeholder="Enter zip code..." maxLength={5}
          style={{ flex:1, background:"#252A3D", border:`1px solid ${C.darkBorder}`, borderRadius:10, padding:"8px 12px", fontSize:12, color:"#E2E8F0", outline:"none", fontFamily:"inherit" }} />
        <button onClick={() => zip.length===5 && setSubmitted(true)}
          style={{ padding:"8px 14px", borderRadius:10, background:"linear-gradient(135deg,#7C3AED,#A78BFA)", border:"none", color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer", opacity:zip.length===5?1:0.5 }}>
          Search
        </button>
      </div>

      {submitted && (
        <>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
            {["All",...PLACE_CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding:"4px 10px", borderRadius:99, border:`1px solid ${activeCategory===cat?"#7C3AED":C.darkBorder}`, background:activeCategory===cat?"rgba(22,163,74,0.2)":"transparent", color:activeCategory===cat?"#4ADE80":C.darkSub, fontSize:10, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"16px 0", color:C.darkSub, fontSize:12 }}>No {activeCategory} spots found near {zip}</div>
            ) : filtered.map((place, i) => (
              <div key={i} style={{ background:"#252A3D", borderRadius:12, padding:"10px 12px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", border:`1px solid transparent`, transition:"border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#7C3AED"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "transparent"}>
                <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#7C3AED,#A78BFA)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{place.emoji}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:12, color:"#E2E8F0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{place.name}</div>
                  <div style={{ fontSize:10, color:C.darkSub, marginTop:1 }}>{place.address}</div>
                  <div style={{ display:"flex", gap:8, marginTop:3, alignItems:"center" }}>
                    <span style={{ background:"rgba(22,163,74,0.2)", color:"#4ADE80", fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:99 }}>{place.category}</span>
                    <span style={{ fontSize:10, color:C.gold }}>★ {place.rating}</span>
                    <span style={{ fontSize:10, color:C.darkSub }}>{place.distance}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setSubmitted(false); setZip(""); setActiveCategory("All"); }}
            style={{ width:"100%", marginTop:10, padding:"7px", borderRadius:10, background:"transparent", border:`1px solid ${C.darkBorder}`, color:C.darkSub, fontSize:11, fontWeight:700, cursor:"pointer" }}>
            Clear Search
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
function ConnectSidebar({ tab, onCreateGroup }: { tab: "local" | "online" | "joined" | "rivals"; onCreateGroup: () => void }) {
  const effectiveTab = (tab === "joined" || tab === "rivals") ? "online" : tab;
  return (
    <div className="connect-sidebar" style={{ width:320, flexShrink:0, paddingTop:20, paddingBottom:20 }}>
      {/* Create a group CTA */}
      <div style={{ background:`linear-gradient(135deg,#7C3AED,#A78BFA)`, borderRadius:18, padding:"20px", marginBottom:20, boxShadow:"0 4px 20px rgba(22,163,74,0.3)" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>{effectiveTab==="local"?"📍":"🌍"}</div>
        <div style={{ fontWeight:900, fontSize:16, color:"#fff", marginBottom:6 }}>
          {effectiveTab==="local" ? "Start a Local Group" : "Create an Online Group"}
        </div>
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.85)", lineHeight:1.6, marginBottom:14 }}>
          {effectiveTab==="local"
            ? "Organize your city's fitness community. Free to create, forever."
            : "Build your worldwide tribe. Any goal, any timezone, any level."}
        </p>
        <button onClick={onCreateGroup} style={{ width:"100%", padding:"10px", borderRadius:12, background:"rgba(255,255,255,0.2)", border:"1.5px solid rgba(255,255,255,0.4)", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}>
          + Create Group
        </button>
      </div>

      {/* Stats panel */}
      <div style={{ background:C.darkCard, borderRadius:16, border:`1px solid ${C.darkBorder}`, padding:"16px", marginBottom:16 }}>
        <div style={{ fontWeight:900, fontSize:14, color:"#E2E8F0", marginBottom:12 }}>
          {effectiveTab==="local" ? "📍 Las Vegas Groups" : "🌍 Global Stats"}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { val: effectiveTab==="local" ? "4+" : "6+", label: effectiveTab==="local" ? "Active Groups" : "Featured Groups" },
            { val: effectiveTab==="local" ? "1,050+" : "211K+", label:"Total Members" },
            { val: effectiveTab==="local" ? "4" : "3", label: effectiveTab==="local" ? "Events This Week" : "Trending Now" },
            { val:"Free", label:"To Join" },
          ].map((s,i) => (
            <div key={i} style={{ background:"#252A3D", borderRadius:10, padding:"12px 10px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.blue }}>{s.val}</div>
              <div style={{ fontSize:10, color:C.darkSub, marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Popular categories */}
      <div style={{ background:C.darkCard, borderRadius:16, border:`1px solid ${C.darkBorder}`, padding:"16px", marginBottom:16 }}>
        <div style={{ fontWeight:900, fontSize:14, color:"#E2E8F0", marginBottom:12 }}>Browse by Category</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <button key={cat} style={{ padding:"6px 14px", borderRadius:99, border:`1.5px solid ${color}44`, background:`${color}18`, color:color, fontSize:11, fontWeight:800, cursor:"pointer" }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <NearbyPlaces />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ConnectPage() {
  const [tab, setTab] = useState<"local"|"online"|"joined"|"rivals">("local");
  const [search, setSearch] = useState("");
  const [dbGroups, setDbGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinedGroups, setJoinedGroups] = useState<any[]>([]);
  const [loadingJoined, setLoadingJoined] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (tab === 'joined' && currentUserId) {
      loadJoinedGroups();
    }
  }, [tab, currentUserId]);

  async function loadJoinedGroups() {
    setLoadingJoined(true);
    try {
      const res = await fetch(`/api/db?action=get_user_groups&userId=${currentUserId}`);
      const data = await res.json();
      if (data.groups) {
        setJoinedGroups(data.groups.map((g: any) => normalizeDbGroup({ ...g, is_member: true })));
      }
    } catch {
      // ignore
    } finally {
      setLoadingJoined(false);
    }
  }

  async function loadGroups() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const params = new URLSearchParams({ action: 'get_groups' });
      if (user) params.append('userId', user.id);
      const res = await fetch(`/api/db?${params}`);
      const data = await res.json();
      if (data.groups && data.groups.length > 0) {
        setDbGroups(data.groups.map(normalizeDbGroup));
      }
    } catch {
      // Use mock data fallback
    } finally {
      setLoadingGroups(false);
    }
  }

  // Merge DB groups with mock groups (DB groups take precedence)
  const dbIds = new Set(dbGroups.map(g => g.db_id));
  const allLocal = [
    ...dbGroups.filter(g => g.is_local),
    ...LOCAL_GROUPS_MOCK.filter(g => !dbIds.has(g.id)),
  ];
  const allOnline = [
    ...dbGroups.filter(g => !g.is_local),
    ...ONLINE_GROUPS_MOCK.filter(g => !dbIds.has(g.id)),
  ];

  const filteredLocal = allLocal.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.category.toLowerCase().includes(search.toLowerCase())
  );
  const filteredOnline = allOnline.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.category.toLowerCase().includes(search.toLowerCase())
  );

  function handleGroupCreated(group: any) {
    setShowCreateModal(false);
    const normalized = normalizeDbGroup({ ...group, is_member: true });
    setDbGroups(prev => [normalized, ...prev]);
  }

  return (
    <div style={{ background:C.bg, minHeight:"100vh" }}>
      <style jsx global>{`
        @media (max-width: 767px) {
          .connect-layout { flex-direction: column !important; padding: 0 16px !important; }
          .connect-layout > * { width: 100% !important; }
          .connect-sidebar { width: 100% !important; }
        }
      `}</style>

      {showCreateModal && (
        <CreateGroupModal onClose={() => setShowCreateModal(false)} onCreated={handleGroupCreated} />
      )}

      {/* ── Sticky Header ── */}
      <div style={{ position:"sticky", top:0, zIndex:100, background:C.white, borderBottom:`2px solid ${C.greenLight}` }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"14px 24px 0", display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:8 }}>
            <span style={{ fontSize:20 }}>🤝</span>
            <span style={{ fontWeight:900, fontSize:20, color:C.text }}>Connect</span>
          </div>
          <div style={{ flex:1, maxWidth:380, display:"flex", alignItems:"center", gap:10, background:C.greenLight, borderRadius:24, padding:"8px 16px", border:`1.5px solid ${C.greenMid}` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:16, height:16, flexShrink:0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups by name or category..."
              style={{ background:"none", border:"none", outline:"none", fontSize:13, color:C.text, flex:1 }} />
          </div>
          <button onClick={() => setShowCreateModal(true)}
            style={{ padding:"9px 18px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#7C3AED,#A78BFA)", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", flexShrink:0 }}>
            + Create Group
          </button>
        </div>

        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 24px", display:"flex", gap:0, marginTop:12 }}>
          {([
            { key:"local", label:"📍 Local Groups" },
            { key:"online", label:"🌍 Online Groups" },
            { key:"joined", label:"✅ My Groups" },
            { key:"rivals", label:"⚔️ Rivals" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:"10px 28px", fontWeight:800, fontSize:14, background:"none", border:"none", cursor:"pointer",
              color: tab===t.key ? (t.key==="rivals" ? "#7C3AED" : C.blue) : C.sub,
              borderBottom: tab===t.key ? `3px solid ${t.key==="rivals" ? "#7C3AED" : C.blue}` : "3px solid transparent",
              transition:"all 0.15s",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="connect-layout" style={{ display:"flex", gap:48, maxWidth:1200, margin:"0 auto", padding:"24px 24px 60px", alignItems:"flex-start" }}>

        <div style={{ flex:1, minWidth:0 }}>
          {/* ── RIVALS TAB ── */}
          {tab === "rivals" && (
            <RivalsTab />
          )}

          {/* Banner */}
          {tab !== "joined" && tab !== "rivals" && (
            <div style={{ background:"linear-gradient(135deg,#7C3AED,#A78BFA)", borderRadius:18, padding:"18px 22px", marginBottom:24, display:"flex", alignItems:"center", gap:16, boxShadow:"0 4px 20px rgba(22,163,74,0.3)" }}>
              <div style={{ fontSize:40 }}>{tab==="local"?"📍":"🌍"}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:900, fontSize:18, color:"#fff" }}>
                  {tab==="local" ? "Las Vegas, NV — Local Groups" : "Online Groups — Worldwide"}
                </div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginTop:3 }}>
                  {tab==="local"
                    ? `${filteredLocal.length} active groups near you · Real people, real meetups`
                    : `${filteredOnline.length} featured groups · Connect with anyone, anywhere`}
                </div>
              </div>
              {tab==="local" && (
                <button style={{ background:"rgba(255,255,255,0.2)", border:"1.5px solid rgba(255,255,255,0.4)", borderRadius:10, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer", flexShrink:0 }}>
                  Change City
                </button>
              )}
            </div>
          )}

          {tab === "joined" && (
            <div style={{ background:"linear-gradient(135deg,#7C3AED,#A78BFA)", borderRadius:18, padding:"18px 22px", marginBottom:24, display:"flex", alignItems:"center", gap:16, boxShadow:"0 4px 20px rgba(22,163,74,0.3)" }}>
              <div style={{ fontSize:40 }}>✅</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:900, fontSize:18, color:"#fff" }}>My Groups</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginTop:3 }}>
                  {joinedGroups.length > 0 ? `${joinedGroups.length} groups you've joined` : "Groups you've joined will appear here"}
                </div>
              </div>
            </div>
          )}

          {loadingGroups && tab !== "joined" && tab !== "rivals" && (
            <div style={{ textAlign:"center", padding:"40px 0", color:C.sub, fontSize:14 }}>Loading groups...</div>
          )}

          {tab === "joined" && (
            loadingJoined
              ? <div style={{ textAlign:"center", padding:"40px 0", color:C.sub, fontSize:14 }}>Loading your groups...</div>
              : !currentUserId
                ? (
                  <div style={{ textAlign:"center", padding:"40px 24px", background:C.white, borderRadius:18, border:`2px dashed ${C.greenMid}` }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>🔐</div>
                    <div style={{ fontWeight:800, fontSize:15, color:C.text, marginBottom:6 }}>Sign in to see your groups</div>
                    <div style={{ fontSize:13, color:C.sub }}>Log in to view and manage the groups you've joined.</div>
                  </div>
                )
                : joinedGroups.length === 0
                  ? (
                    <div style={{ textAlign:"center", padding:"40px 24px", background:C.white, borderRadius:18, border:`2px dashed ${C.greenMid}` }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>🤝</div>
                      <div style={{ fontWeight:800, fontSize:15, color:C.text, marginBottom:6 }}>You haven't joined any groups yet.</div>
                      <div style={{ fontSize:13, color:C.sub }}>Browse Local or Online groups to find your community!</div>
                    </div>
                  )
                  : joinedGroups.map(g => <GroupCard key={g.id} group={g} onJoin={() => loadJoinedGroups()} />)
          )}

          {!loadingGroups && tab !== "joined" && tab !== "rivals" && (
            tab === "local"
              ? filteredLocal.map(g => <GroupCard key={g.id} group={g} onJoin={() => loadGroups()} />)
              : filteredOnline.map(g => <GroupCard key={g.id} group={g} onJoin={() => loadGroups()} />)
          )}
        </div>

        <ConnectSidebar tab={tab as "local" | "online" | "joined" | "rivals"} onCreateGroup={() => setShowCreateModal(true)} />
      </div>
    </div>
  );
}



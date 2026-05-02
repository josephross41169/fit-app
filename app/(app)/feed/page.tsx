"use client";
import { useState, useRef, useEffect, useMemo, memo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { compressImage } from "@/lib/compressImage";
import { track } from "@/components/PostHogProvider";
import FollowButton from "@/components/FollowButton";
import ActivityComments from "@/components/ActivityComments";
import { TierFrame, TierBadgeChip, TierTitle } from "@/components/TierFrame";
import { computeTier, TIER_COLORS } from "@/lib/tiers";
import type { Tier } from "@/lib/tiers";
import { loadBlockedUsers } from "@/lib/blocks";
import ReportModal, { ReportTarget } from "@/components/ReportModal";
import { ImagePresets } from "@/lib/imageUrls";

const C = {
  blue:"#7C3AED", greenLight:"#1A1228", greenMid:"#2D1F52",
  gold:"#F5A623", goldLight:"#FFFBEE",
  text:"#F0F0F0", sub:"#9CA3AF", white:"#1A1A1A", bg:"#0D0D0D",
  green:"#7C3AED",
  // Dark sidebar palette
  dark:"#0D0D0D", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Emoji Reaction Config ─────────────────────────────────────────────────────
const REACTION_EMOJIS = [
  { key: "heart",  emoji: "❤️",  label: "Heart"  },
  { key: "fire",   emoji: "🔥",  label: "Fire"   },
  { key: "flex",   emoji: "💪",  label: "Strong" },
  { key: "clap",   emoji: "👏",  label: "Clap"   },
  { key: "rocket", emoji: "🚀",  label: "LFG"    },
] as const;
type ReactionKey = "heart" | "fire" | "flex" | "clap" | "rocket";
type ReactionCounts = Record<ReactionKey, number>;
type MyReactions = Set<ReactionKey>;

// ── Reaction Bar Component ────────────────────────────────────────────────────
function ReactionBar({
  postId,
  currentUserId,
  initialCounts,
  initialMine,
}: {
  postId: string | number;
  currentUserId?: string;
  initialCounts: ReactionCounts;
  initialMine: MyReactions;
}) {
  const [counts, setCounts] = useState<ReactionCounts>(initialCounts);
  const [mine, setMine] = useState<MyReactions>(new Set(initialMine));
  const [loading, setLoading] = useState<ReactionKey | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const isDbPost = typeof postId === 'string' && postId.includes('-');

  // Load reaction counts from Supabase on mount (for real db posts)
  useEffect(() => {
    if (!isDbPost) return;
    async function loadCounts() {
      const { data } = await supabase
        .from('reactions')
        .select('emoji, user_id')
        .eq('post_id', postId as string);
      if (!data) return;
      const c: ReactionCounts = { heart: 0, fire: 0, flex: 0, clap: 0, rocket: 0 };
      const m: MyReactions = new Set();
      for (const row of data) {
        if (row.emoji in c) c[row.emoji as ReactionKey]++;
        if (row.user_id === currentUserId) m.add(row.emoji as ReactionKey);
      }
      setCounts(c);
      setMine(m);
    }
    loadCounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0);

  async function toggleReaction(key: ReactionKey) {
    if (!currentUserId || loading) return;
    setLoading(key);
    const had = mine.has(key);
    // Optimistic update
    const newMine = new Set(mine);
    const newCounts = { ...counts };
    if (had) {
      newMine.delete(key);
      newCounts[key] = Math.max(0, newCounts[key] - 1);
    } else {
      newMine.add(key);
      newCounts[key]++;
    }
    setMine(newMine);
    setCounts(newCounts);
    setShowPicker(false);

    if (isDbPost) {
      if (had) {
        await supabase.from('reactions').delete()
          .eq('post_id', postId as string)
          .eq('user_id', currentUserId)
          .eq('emoji', key);
      } else {
        await supabase.from('reactions').upsert({
          post_id: postId as string,
          user_id: currentUserId,
          emoji: key,
        }, { onConflict: 'post_id,user_id,emoji' });
      }
    }
    setLoading(null);
  }

  // Which emojis have any reactions?
  const activeEmojis = REACTION_EMOJIS.filter(r => counts[r.key] > 0 || mine.has(r.key));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {/* All 5 reactions always visible. No "React" button — tap any emoji
          to toggle. Active ones (you've reacted OR has count) show the
          count and purple highlight; inactive ones are dimmed. */}
      {REACTION_EMOJIS.map(r => {
        const count = counts[r.key];
        const userHas = mine.has(r.key);
        const isActive = count > 0 || userHas;
        return (
          <button
            key={r.key}
            onClick={() => toggleReaction(r.key)}
            disabled={!!loading}
            title={r.label}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 99,
              border: userHas ? "1.5px solid #7C3AED" : "1.5px solid #2D1F52",
              background: userHas ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.04)",
              cursor: loading ? "default" : "pointer",
              transition: "all 0.15s",
              opacity: loading === r.key ? 0.6 : (isActive ? 1 : 0.55),
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>{r.emoji}</span>
            {count > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: userHas ? "#A78BFA" : "#9CA3AF" }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type Comment = { id: number; user: string; avatar: string; text: string; time: string; };
type Exercise = { name: string; sets: number; reps: number; weight: string; };
type Meal = { key: string; emoji: string; name: string; cal: number; };
type Post = {
  id: number;
  user: string;
  username: string;
  avatar: string;
  tier?: Tier;
  time: string;
  dateShort: string;
  dayLabel: string;
  photos: string[];
  mediaTypes?: ('image' | 'video')[];
  // Per-photo vertical crop offset (0..100% from top). Parallel to photos[].
  // Defaults to 50 (centered) for any missing entries. Used by feed/discover/
  // post-detail/profile renders to show the right slice of each photo.
  mediaPositions?: number[];
  caption: string;
  likes: number;
  liked: boolean;
  comments: Comment[];
  workout: { type: string; duration: string; calories: number; exercises: Exercise[]; cardio: {type:string;duration:string;distance:string}[]; photoUrls?: string[]; } | null;
  nutrition: { calories: number; protein: number; carbs: number; fat: number; sugar: number; meals: Meal[]; photoUrls?: string[]; } | null;
  wellness: { entries: { emoji: string; activity: string; notes: string; duration?: number; loggedAt?: string; }[]; photoUrls?: string[]; } | null;
};

function normalizePhotoUrls(...sources: any[]): string[] {
  const out: string[] = [];
  const add = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(add);
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (trimmed.startsWith('[')) {
        try {
          add(JSON.parse(trimmed));
          return;
        } catch {}
      }
      if (trimmed.startsWith('{')) {
        try {
          add(JSON.parse(trimmed));
          return;
        } catch {}
      }
      if (trimmed.startsWith('http') || trimmed.startsWith('/')) out.push(trimmed);
    }
  };
  sources.forEach(add);
  return Array.from(new Set(out));
}

// Returns a per-index 'image'|'video' array aligned with the URLs returned by normalizePhotoUrls.
// Priority: media_types array (new column) → media_type single string → URL extension sniff → 'image'.
function mediaTypesFor(urls: string[], mediaTypesRaw: any, mediaTypeSingle: any): ('image' | 'video')[] {
  const VIDEO_EXT = /\.(mp4|mov|webm|m4v|qt)(\?|#|$)/i;

  // Parse the raw media_types value (jsonb may arrive as array OR JSON string)
  let parsed: any[] | null = null;
  if (Array.isArray(mediaTypesRaw)) parsed = mediaTypesRaw;
  else if (typeof mediaTypesRaw === 'string') {
    try {
      const j = JSON.parse(mediaTypesRaw);
      if (Array.isArray(j)) parsed = j;
    } catch {}
  }

  return urls.map((url, i) => {
    if (parsed && (parsed[i] === 'image' || parsed[i] === 'video')) return parsed[i];
    // Single-item legacy fallback
    if (urls.length === 1 && (mediaTypeSingle === 'image' || mediaTypeSingle === 'video')) return mediaTypeSingle;
    // Last resort: sniff URL
    if (typeof url === 'string' && VIDEO_EXT.test(url)) return 'video';
    return 'image';
  });
}

// ── Suggested Users (shown when following feed runs out) ─────────────────────
const SUGGESTED_USERS = [
  { id: 101, user: "Alexis Rivera", username: "alexis_fit", avatar: "AR", followers: "12.4K", specialty: "CrossFit · Olympic Lifting",
    workout: { type: "CrossFit WOD", duration: "45 min", calories: 580, exercises: [
      { name: "Clean & Jerk", sets: 5, reps: 3, weight: "135 lbs" },
      { name: "Box Jumps", sets: 4, reps: 10, weight: "24in" },
      { name: "Pull-Ups", sets: 4, reps: 12, weight: "BW" },
      { name: "Kettlebell Swings", sets: 3, reps: 20, weight: "53 lbs" },
    ], cardio: [] },
    nutrition: { calories: 2640, protein: 210, carbs: 280, fat: 62, sugar: 28,
      meals: [
        { key: "Pre-Workout", emoji: "🍌", name: "Banana + Whey", cal: 380 },
        { key: "Lunch", emoji: "🥩", name: "Steak & Sweet Potato", cal: 860 },
        { key: "Dinner", emoji: "🍚", name: "Rice Bowl", cal: 1400 },
      ] },
    wellness: null },
  { id: 102, user: "Jordan Kim", username: "jordan_gains", avatar: "JK", followers: "8.1K", specialty: "Powerlifting · Nutrition",
    workout: { type: "Pull Day", duration: "72 min", calories: 530, exercises: [
      { name: "Deadlift", sets: 5, reps: 5, weight: "315 lbs" },
      { name: "Barbell Row", sets: 4, reps: 8, weight: "185 lbs" },
      { name: "Lat Pulldown", sets: 4, reps: 12, weight: "150 lbs" },
      { name: "Face Pulls", sets: 3, reps: 20, weight: "40 lbs" },
    ], cardio: [] },
    nutrition: null,
    wellness: { entries: [{ emoji: "🛁", activity: "Ice Bath", notes: "12 min @ 50°F post-lift" }] } },
  { id: 103, user: "Maya Torres", username: "maya_moves", avatar: "MT", followers: "31.2K", specialty: "Yoga · Mindfulness",
    workout: null,
    nutrition: { calories: 1780, protein: 88, carbs: 195, fat: 71, sugar: 42,
      meals: [
        { key: "Breakfast", emoji: "🥑", name: "Avocado Toast + Eggs", cal: 520 },
        { key: "Lunch", emoji: "🥗", name: "Buddha Bowl", cal: 680 },
        { key: "Dinner", emoji: "🍜", name: "Miso Ramen", cal: 580 },
      ] },
    wellness: { entries: [
      { emoji: "🧘", activity: "Vinyasa Flow", notes: "60 min morning practice" },
      { emoji: "🫁", activity: "Breathwork", notes: "Wim Hof · 3 rounds" },
    ] } },
];

const INITIAL_STORIES = [
  { id: 1, username: "You", isYou: true, photo: null as string | null, hasNew: false },
  { id: 2, username: "jake_lifts", photo: null as string | null, hasNew: true },
  { id: 3, username: "sara_runs", photo: null as string | null, hasNew: true },
  { id: 4, username: "mike_gains", photo: null as string | null, hasNew: false },
  { id: 5, username: "lena_fit", photo: null as string | null, hasNew: true },
  { id: 6, username: "chris_rx", photo: null as string | null, hasNew: false },
];

const INITIAL_POSTS: Post[] = [
  {
    id: 1, user: "Jake Morrison", username: "jake_lifts", avatar: "JM",
    time: "2h ago", dateShort: "3.24", dayLabel: "Tuesday",
    photos: [], caption: "Chest & shoulders on FIRE 🔥 PR on bench today! Nothing beats that feeling when the weight just flies up.",
    likes: 47, liked: false,
    comments: [
      { id: 1, user: "Sara Chen", avatar: "SC", text: "Absolute beast mode! What was your PR?", time: "1h ago" },
      { id: 2, user: "Mike Davis", avatar: "MD", text: "Let's gooo!! 💪", time: "45m ago" },
    ],
    workout: {
      type: "Chest Day", duration: "65 min", calories: 490,
      exercises: [
        { name: "Bench Press", sets: 5, reps: 8, weight: "185 lbs" },
        { name: "Incline DB Press", sets: 4, reps: 10, weight: "70 lbs" },
        { name: "Cable Flyes", sets: 3, reps: 15, weight: "35 lbs" },
        { name: "Push-Ups", sets: 3, reps: 20, weight: "BW" },
      ],
      cardio: [],
    },
    nutrition: {
      calories: 2380, protein: 195, carbs: 245, fat: 58, sugar: 32,
      meals: [
        { key: "Breakfast", emoji: "🥣", name: "Protein Oats", cal: 580 },
        { key: "Lunch", emoji: "🌯", name: "Turkey Wrap", cal: 720 },
        { key: "Dinner", emoji: "🍝", name: "Pasta & Chicken", cal: 1080 },
      ],
    },
    wellness: null,
  },
  {
    id: 2, user: "Sara Chen", username: "sara_runs", avatar: "SC",
    time: "4h ago", dateShort: "3.24", dayLabel: "Tuesday",
    photos: [], caption: "Fueling after a 10K this morning ✅ Hitting macros perfectly this week! Consistency is everything.",
    likes: 31, liked: true,
    comments: [
      { id: 1, user: "Lena Torres", avatar: "LT", text: "You're such an inspiration! 🙌", time: "3h ago" },
    ],
    workout: {
      type: "Morning Run", duration: "52 min", calories: 620,
      exercises: [],
      cardio: [{ type: "Running", duration: "52 min", distance: "10 km" }],
    },
    nutrition: {
      calories: 1920, protein: 142, carbs: 210, fat: 52, sugar: 28,
      meals: [
        { key: "Breakfast", emoji: "🍳", name: "Eggs & Toast", cal: 480 },
        { key: "Lunch", emoji: "🍗", name: "Chicken & Rice", cal: 740 },
        { key: "Dinner", emoji: "🥗", name: "Salmon Salad", cal: 700 },
      ],
    },
    wellness: { entries: [{ emoji: "🧘", activity: "Yoga", notes: "30 min post-run stretch" }] },
  },
  {
    id: 3, user: "Mike Davis", username: "mike_gains", avatar: "MD",
    time: "6h ago", dateShort: "3.23", dayLabel: "Monday",
    photos: [], caption: "Nobody said leg day was easy. Nobody said it wasn't worth it. 275 on squats today 💪",
    likes: 89, liked: false,
    comments: [
      { id: 1, user: "Jake Morrison", avatar: "JM", text: "Bro 275 is INSANE. What program are you running?", time: "5h ago" },
      { id: 2, user: "Chris", avatar: "CR", text: "Legend 🐐", time: "4h ago" },
    ],
    workout: {
      type: "Leg Day", duration: "68 min", calories: 510,
      exercises: [
        { name: "Squats", sets: 5, reps: 5, weight: "275 lbs" },
        { name: "Romanian Deadlift", sets: 4, reps: 8, weight: "185 lbs" },
        { name: "Leg Press", sets: 3, reps: 12, weight: "360 lbs" },
        { name: "Calf Raises", sets: 4, reps: 20, weight: "100 lbs" },
      ],
      cardio: [],
    },
    nutrition: null,
    wellness: null,
  },
];

// ── Story Viewer ──────────────────────────────────────────────────────────────
// ── Story types ─────────────────────────────────────────────────────────────
interface Story {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  created_at: string;
  is_you: boolean;
}

// Format "2h ago" / "5m ago" for stories
function timeAgoShort(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function StoryViewer({
  story, onClose, onDelete, onReply,
}: {
  story: Story;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onReply?: (story: Story, text: string) => Promise<void>;
}) {
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Auto-advance progress bar — closes after 8 seconds (Instagram standard)
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const DURATION_MS = 8000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) { clearInterval(interval); onClose(); }
    }, 50);
    return () => clearInterval(interval);
  }, [story.id, onClose]);

  async function handleReplySend() {
    if (!replyText.trim() || sending || !onReply) return;
    setSending(true);
    try {
      await onReply(story, replyText.trim());
      setReplyText("");
      onClose();
    } finally { setSending(false); }
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.95)",display:"flex",alignItems:"center",justifyContent:"center" }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button onClick={onClose} style={{ position:"absolute",top:20,right:24,background:"none",border:"none",color:"#fff",fontSize:32,cursor:"pointer",zIndex:2 }}>×</button>

      <div style={{ width:"100%",maxWidth:400,aspectRatio:"9/16",borderRadius:20,overflow:"hidden",position:"relative",background:"#1A1A2E" }}>
        {/* Progress bar at top */}
        <div style={{ position:"absolute",top:8,left:8,right:8,height:3,borderRadius:99,background:"rgba(255,255,255,0.25)",overflow:"hidden",zIndex:2 }}>
          <div style={{ height:"100%",width:`${progress}%`,background:"#fff",transition:"width 50ms linear" }} />
        </div>

        {story.media_type === 'video' ? (
          <video src={story.media_url} autoPlay muted playsInline
            style={{ width:"100%",height:"100%",objectFit:"cover" }} />
        ) : (
          <img src={ImagePresets.thumb(story.media_url)} loading="lazy" decoding="async" alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
        )}

        {/* Header */}
        <div style={{ position:"absolute",top:18,left:0,right:0,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,zIndex:2 }}>
          <div style={{ width:36,height:36,borderRadius:"50%",overflow:"hidden",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff" }}>
            {story.avatar_url
              ? <img src={ImagePresets.avatarSm(story.avatar_url)} loading="lazy" decoding="async" alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
              : (story.username[0] || "?").toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:"#fff",fontWeight:700,fontSize:14,textShadow:"0 1px 4px rgba(0,0,0,0.5)" }}>{story.username}</div>
            <div style={{ color:"rgba(255,255,255,0.85)",fontSize:11,textShadow:"0 1px 4px rgba(0,0,0,0.5)" }}>{timeAgoShort(story.created_at)}</div>
          </div>
          {/* Delete button — only for your own story */}
          {story.is_you && onDelete && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} style={{ background:"rgba(0,0,0,0.4)",border:"none",borderRadius:8,padding:"4px 10px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer" }}>
              🗑️ Delete
            </button>
          )}
          {confirmDelete && (
            <button onClick={() => onDelete!(story.id)} style={{ background:"#EF4444",border:"none",borderRadius:8,padding:"4px 10px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer" }}>
              Confirm?
            </button>
          )}
        </div>

        {/* Caption — bottom center */}
        {story.caption && (
          <div style={{ position:"absolute",bottom:90,left:16,right:16,padding:"10px 14px",background:"rgba(0,0,0,0.5)",borderRadius:12,zIndex:2 }}>
            <div style={{ color:"#fff",fontSize:13,fontWeight:600,textShadow:"0 1px 4px rgba(0,0,0,0.5)" }}>{story.caption}</div>
          </div>
        )}

        {/* Reply input — only for OTHER people's stories */}
        {!story.is_you && onReply && (
          <div style={{ position:"absolute",bottom:16,left:16,right:16,zIndex:2,display:"flex",gap:8 }}
               onClick={e => e.stopPropagation()}>
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleReplySend(); }}
              placeholder={`Reply to ${story.username}...`}
              style={{
                flex:1, padding:"12px 16px", borderRadius:99,
                background:"rgba(255,255,255,0.1)", border:"1.5px solid rgba(255,255,255,0.3)",
                color:"#fff", fontSize:13, outline:"none",
              }}
            />
            <button
              onClick={handleReplySend}
              disabled={!replyText.trim() || sending}
              style={{
                padding:"10px 16px", borderRadius:99,
                background: replyText.trim() ? C.blue : "rgba(255,255,255,0.15)",
                border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
                opacity: sending ? 0.6 : 1,
              }}
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DARK SIDEBAR: Workout Card ────────────────────────────────────────────────
// ── Wellness style lookup ───────────────────────────────────────────────────
// 26 activities → emoji + accent color. Mirrors the constant in /profile/page.tsx
// and /profile/[username]/page.tsx so wellness cards look identical everywhere.
const WELLNESS_STYLES: Record<string, { emoji: string; accent: string }> = {
  "cold plunge":          { emoji: "❄️", accent: "#38BDF8" },
  "ice bath":             { emoji: "❄️", accent: "#38BDF8" },
  "cryotherapy":          { emoji: "🥶", accent: "#22D3EE" },
  "sauna":                { emoji: "🔥", accent: "#F97316" },
  "infrared sauna":       { emoji: "🌅", accent: "#FB923C" },
  "steam room":           { emoji: "♨️", accent: "#FBBF24" },
  "red light therapy":    { emoji: "🔴", accent: "#EF4444" },
  "meditation":           { emoji: "🧘", accent: "#A78BFA" },
  "breathwork":           { emoji: "💨", accent: "#818CF8" },
  "yoga nidra":           { emoji: "🌙", accent: "#A78BFA" },
  "journaling":           { emoji: "📓", accent: "#C4B5FD" },
  "therapy":              { emoji: "💬", accent: "#A78BFA" },
  "sound bath":           { emoji: "🎵", accent: "#C084FC" },
  "stretching":           { emoji: "🤸", accent: "#34D399" },
  "foam rolling":         { emoji: "🌀", accent: "#10B981" },
  "mobility work":        { emoji: "🦵", accent: "#34D399" },
  "massage":              { emoji: "💆", accent: "#6EE7B7" },
  "chiropractic":         { emoji: "🦴", accent: "#A7F3D0" },
  "acupuncture":          { emoji: "📍", accent: "#34D399" },
  "cupping":              { emoji: "🟣", accent: "#A78BFA" },
  "sunlight exposure":    { emoji: "☀️", accent: "#FBBF24" },
  "grounding":            { emoji: "🌱", accent: "#84CC16" },
  "nature walk":          { emoji: "🌲", accent: "#34D399" },
  "hyperbaric oxygen":    { emoji: "💎", accent: "#06B6D4" },
  "compression therapy":  { emoji: "🦿", accent: "#0EA5E9" },
  "float tank":           { emoji: "🌊", accent: "#0EA5E9" },
  "sleep":                { emoji: "😴", accent: "#6366F1" },
  "fasting":              { emoji: "⏳", accent: "#A78BFA" },
};
function getWellnessStyle(activity: string): { emoji: string; accent: string } {
  return WELLNESS_STYLES[activity.toLowerCase().trim()] || { emoji: "🌿", accent: "#A78BFA" };
}

// ── StreakCard ────────────────────────────────────────────────────────────
// In-app reminder card shown at the top of the For You feed when the user
// has an active streak (>= 2 days) but hasn't logged today. Renders a
// flame, the day count, a "Log now" CTA, and a dismiss button.
//
// Behavior is intentionally non-intrusive: the card is small, doesn't block
// content, and stays dismissed for the rest of the day once tapped away.
// It re-appears the next day if the streak is still alive.
function StreakCard({ days, onDismiss, onLog }: { days: number; onDismiss: () => void; onLog: () => void }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #F97316 0%, #DC2626 100%)",
      borderRadius: 16,
      padding: "14px 16px 14px 18px",
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 14,
      position: "relative",
      boxShadow: "0 4px 16px rgba(249, 115, 22, 0.25)",
    }}>
      <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>🔥</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>
          {days}-day streak
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 3, lineHeight: 1.35 }}>
          Log a workout or wellness session today to keep it alive
        </div>
      </div>
      <button onClick={onLog}
        style={{
          background: "rgba(255,255,255,0.95)",
          color: "#DC2626",
          border: "none",
          borderRadius: 99,
          padding: "8px 16px",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}>
        Log now →
      </button>
      <button onClick={onDismiss} aria-label="Dismiss"
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.7)",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
          padding: 4,
        }}>
        ×
      </button>
    </div>
  );
}

// ── RecapPromptCard ───────────────────────────────────────────────────────
// Shows once per week pointing the user to last week's recap. Same visual
// language as StreakCard (gradient + dismiss × + CTA button) but in the
// purple-pink palette to differentiate from the orange streak card.
//
// onView links to /recap/<weekKey> for deep-linking. We don't auto-navigate
// — the user has to tap "View Recap" so they're never surprised by a
// page change.
function RecapPromptCard({ weekKey, onDismiss }: { weekKey: string; onDismiss: () => void }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)",
      borderRadius: 16,
      padding: "14px 16px 14px 18px",
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 14,
      position: "relative",
      boxShadow: "0 4px 16px rgba(124, 58, 237, 0.25)",
    }}>
      <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>📊</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>
          Your weekly recap is ready
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 3, lineHeight: 1.35 }}>
          See last week's stats, PRs, streaks, and badges
        </div>
      </div>
      {/* "View" button navigates to the recap. We do NOT call onDismiss here
          — viewing should not permanently hide the prompt; only the × should. */}
      <Link href={`/recap/${weekKey}`}
        style={{
          background: "rgba(255,255,255,0.95)",
          color: "#7C3AED",
          border: "none",
          borderRadius: 99,
          padding: "8px 16px",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          textDecoration: "none",
        }}>
        View →
      </Link>
      <button onClick={onDismiss} aria-label="Dismiss"
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.7)",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
          padding: 4,
        }}>
        ×
      </button>
    </div>
  );
}

function SideWorkout({ workout }: { workout: NonNullable<Post["workout"]> }) {
  const [open, setOpen] = useState(false);
  const exercises = workout.exercises || [];
  const cardio = workout.cardio || [];
  const totalSets = exercises.reduce((s, ex) => s + (ex.sets || 0), 0);
  const totalVol = exercises.reduce((s, ex) => {
    const w = parseFloat(String(ex.weight)) || 0;
    return s + (w * (ex.sets || 0) * (ex.reps || 0));
  }, 0);
  const isPR = (workout as any).isPR;
  return (
    <div style={{ borderRadius:14,overflow:"hidden",border:`1px solid ${C.darkBorder}`,marginBottom:10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width:"100%",background:"linear-gradient(135deg,#7C3AED,#15803D)",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10, flex:1, minWidth:0 }}>
          <span style={{ fontSize:18, flexShrink:0 }}>💪</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontWeight:800,fontSize:14,color:"#fff" }}>{workout.type}</span>
              {isPR && <span style={{ fontSize:9, fontWeight:800, background:C.gold, color:"#000", borderRadius:99, padding:"1px 6px", flexShrink:0 }}>🏆 PR</span>}
            </div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.8)" }}>
              {workout.duration}{workout.calories > 0 ? ` · ${workout.calories} cal` : ''}
              {totalSets > 0 && ` · ${totalSets} sets`}
              {totalVol > 0 && ` · ${totalVol >= 1000 ? `${(totalVol/1000).toFixed(1)}k` : totalVol.toFixed(0)} lbs`}
            </div>
          </div>
        </div>
        <div style={{ width:26,height:26,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s",flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ width:13,height:13 }}><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </button>
      {workout.photoUrls && workout.photoUrls.length > 0 && (
        <div style={{ background:"#111827", borderBottom:`1px solid ${C.darkBorder}` }}>
          <img src={ImagePresets.feed(workout.photoUrls[0])} loading="lazy" decoding="async" alt="" style={{ width:"100%", maxHeight:260, objectFit:"cover", display:"block" }} />
        </div>
      )}
      {/* Always-visible summary strip — shows top exercises AND cardio inline
          so the collapsed card actually communicates what was done. Mobile users
          rarely tap to expand, so this is the primary information surface. */}
      {!open && (exercises.length > 0 || cardio.length > 0) && (
        <div style={{ background:"#1E2235", padding:"10px 14px", borderBottom:`1px solid ${C.darkBorder}` }}>
          {exercises.length > 0 && (
            <div style={{ fontSize:11, color:C.darkSub, marginBottom: cardio.length > 0 ? 6 : 0 }}>
              <span style={{ fontWeight:800, color:"#E2E8F0" }}>Exercises:</span>{" "}
              {exercises.slice(0,3).map(e=>e.name).filter(Boolean).join(' · ')}{exercises.length > 3 ? ` +${exercises.length-3}` : ''}
            </div>
          )}
          {cardio.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {cardio.map((c,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, padding:"4px 9px", borderRadius:99, background:"rgba(124,58,237,0.18)", border:"1px solid rgba(124,58,237,0.35)" }}>
                  <span style={{ fontWeight:800, color:"#E2E8F0" }}>{c.type}</span>
                  {c.duration && <span style={{ color:C.blue, fontWeight:700 }}>· {c.duration}</span>}
                  {c.distance && <span style={{ color:C.gold, fontWeight:700 }}>· {c.distance}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {open && (
        <div style={{ background:"#1E2235",padding:"10px 14px" }}>
          {exercises.length > 0 && (<>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 42px 42px 72px",gap:5,paddingBottom:6,marginBottom:4,borderBottom:"1px solid #2A2D3E" }}>
              {["Exercise","Sets","Reps","Weight"].map(h => <span key={h} style={{ fontSize:9,fontWeight:800,color:C.darkSub,textTransform:"uppercase",letterSpacing:0.5 }}>{h}</span>)}
            </div>
            {exercises.map((ex,i) => (
              <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 42px 42px 72px",gap:5,padding:"7px 4px",borderRadius:7,background:i%2===0?"rgba(124,58,237,0.08)":"transparent" }}>
                <span style={{ fontSize:12,fontWeight:600,color:"#E2E8F0" }}>{ex.name}</span>
                <span style={{ fontSize:13,fontWeight:900,color:C.blue,textAlign:"center" }}>{ex.sets}</span>
                <span style={{ fontSize:13,fontWeight:900,color:C.blue,textAlign:"center" }}>{ex.reps}</span>
                <span style={{ fontSize:12,fontWeight:800,color:C.gold,textAlign:"center" }}>{ex.weight}</span>
              </div>
            ))}
            {/* Volume footer */}
            {totalVol > 0 && (
              <div style={{ display:"flex", justifyContent:"flex-end", gap:12, paddingTop:8, marginTop:4, borderTop:"1px solid #2A2D3E", fontSize:11 }}>
                <span style={{ color:C.darkSub }}>{totalSets} sets total</span>
                <span style={{ color:C.gold, fontWeight:800 }}>📊 {totalVol >= 1000 ? `${(totalVol/1000).toFixed(1)}k` : totalVol.toFixed(0)} lbs volume</span>
              </div>
            )}
          </>)}
          {cardio.length > 0 && (
            <div style={{ marginTop:exercises.length?10:0 }}>
              <div style={{ fontSize:10,fontWeight:800,color:C.darkSub,textTransform:"uppercase",letterSpacing:0.6,marginBottom:6 }}>🏃 Cardio</div>
              {cardio.map((c,i) => (
                <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 70px 70px",gap:5,padding:"7px 4px",borderRadius:7,background:i%2===0?"rgba(124,58,237,0.08)":"transparent" }}>
                  <span style={{ fontSize:12,fontWeight:600,color:"#E2E8F0" }}>{c.type}</span>
                  <span style={{ fontSize:12,fontWeight:700,color:C.blue,textAlign:"center" }}>{c.duration}</span>
                  <span style={{ fontSize:12,fontWeight:700,color:C.gold,textAlign:"center" }}>{c.distance}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DARK SIDEBAR: Nutrition Card ─────────────────────────────────────────────
function SideNutrition({ nutrition }: { nutrition: NonNullable<Post["nutrition"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderRadius:14,overflow:"hidden",border:`1px solid ${C.darkBorder}`,marginBottom:10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width:"100%",background:"linear-gradient(135deg,#7C3AED,#15803D)",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:18 }}>🥗</span>
          <div>
            <div style={{ fontWeight:800,fontSize:14,color:"#fff" }}>Nutrition</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.8)" }}>{nutrition.calories} kcal · {nutrition.protein}g protein</div>
          </div>
        </div>
        <div style={{ width:26,height:26,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s",flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ width:13,height:13 }}><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </button>
      {nutrition.photoUrls && nutrition.photoUrls.length > 0 && (
        <div style={{ background:"#111827", borderBottom:`1px solid ${C.darkBorder}` }}>
          <img src={ImagePresets.feed(nutrition.photoUrls[0])} loading="lazy" decoding="async" alt="" style={{ width:"100%", maxHeight:260, objectFit:"cover", display:"block" }} />
        </div>
      )}
      {/* Macro pills always visible */}
      <div style={{ background:"#1E2235",padding:"12px 14px" }}>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:open?12:0 }}>
          {[
            { label:"Cal",val:nutrition.calories,unit:"kcal",color:C.gold,max:3000 },
            { label:"Protein",val:nutrition.protein,unit:"g",color:"#60A5FA",max:250 },
            { label:"Carbs",val:nutrition.carbs,unit:"g",color:C.blue,max:300 },
            { label:"Fat",val:nutrition.fat,unit:"g",color:"#C084FC",max:100 },
          ].map(m => (
            <div key={m.label} style={{ background:"#252A3D",borderRadius:10,padding:"10px 4px",textAlign:"center",border:"1px solid #2A2D3E" }}>
              <div style={{ fontSize:16,fontWeight:900,color:m.color }}>{m.val}</div>
              <div style={{ fontSize:9,color:C.darkSub }}>{m.unit}</div>
              <div style={{ height:3,borderRadius:2,background:"#2A2D3E",margin:"5px 0 3px",overflow:"hidden" }}>
                <div style={{ height:"100%",borderRadius:2,background:m.color,width:`${Math.min((m.val/m.max)*100,100)}%` }}/>
              </div>
              <div style={{ fontSize:9,fontWeight:700,color:C.darkSub }}>{m.label}</div>
            </div>
          ))}
        </div>
        {open && (
          <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
            {nutrition.meals.map(meal => (
              <div key={meal.key} style={{ background:"#252A3D",borderRadius:10,padding:"10px 13px",display:"flex",alignItems:"center",gap:10,border:"1px solid #2A2D3E" }}>
                <div style={{ width:34,height:34,borderRadius:9,background:"#1E2235",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0 }}>{meal.emoji}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",justifyContent:"space-between" }}>
                    <span style={{ fontWeight:800,fontSize:12,color:"#E2E8F0" }}>{meal.key}</span>
                    <span style={{ fontWeight:900,fontSize:12,color:C.gold }}>{meal.cal} kcal</span>
                  </div>
                  <div style={{ fontSize:11,color:C.darkSub,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{meal.name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DARK SIDEBAR: Wellness Card ───────────────────────────────────────────────
function SideWellness({ wellness }: { wellness: NonNullable<Post["wellness"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderRadius:14,overflow:"hidden",border:`1px solid ${C.darkBorder}`,marginBottom:10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width:"100%",background:"linear-gradient(135deg,#7C3AED,#9333EA)",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:18 }}>🌿</span>
          <div>
            <div style={{ fontWeight:800,fontSize:14,color:"#fff" }}>Wellness</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.85)" }}>{wellness.entries.map(e=>e.activity).join(" · ")}</div>
          </div>
        </div>
        <div style={{ width:26,height:26,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s",flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ width:13,height:13 }}><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </button>
      {wellness.photoUrls && wellness.photoUrls.length > 0 && (
        <div style={{ background:"#111827", borderBottom:`1px solid ${C.darkBorder}` }}>
          <img src={ImagePresets.feed(wellness.photoUrls[0])} loading="lazy" decoding="async" alt="" style={{ width:"100%", maxHeight:260, objectFit:"cover", display:"block" }} />
        </div>
      )}
      {/* Always-visible activity pills strip — even when collapsed, the user
          sees a colored chip per activity. Matches the modern profile card
          aesthetic where each activity has its own emoji + accent color. */}
      {!open && (
        <div style={{ background:"#1E2235", padding:"10px 14px", borderBottom:`1px solid ${C.darkBorder}`, display:"flex", flexWrap:"wrap", gap:6 }}>
          {wellness.entries.slice(0, 4).map((e, i) => {
            const s = getWellnessStyle(e.activity || "");
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, padding:"4px 9px", borderRadius:99, background:`${s.accent}22`, border:`1px solid ${s.accent}55` }}>
                <span style={{ fontSize:12 }}>{s.emoji}</span>
                <span style={{ fontWeight:700, color:"#E2E8F0" }}>{e.activity}</span>
                {e.duration ? <span style={{ color:s.accent, fontWeight:800 }}>· {e.duration}m</span> : null}
              </div>
            );
          })}
          {wellness.entries.length > 4 && (
            <span style={{ fontSize:11, color:C.darkSub, alignSelf:"center" }}>+{wellness.entries.length - 4}</span>
          )}
        </div>
      )}
      {open && (
        <div style={{ background:"#1E2235",padding:"10px 14px",display:"flex",flexDirection:"column",gap:7 }}>
          {wellness.entries.map((e, i) => {
            const s = getWellnessStyle(e.activity || "");
            // Lookup wins. The feed loader hardcodes e.emoji='🌿' for every row,
            // so respecting e.emoji first would force every activity to render
            // as a leaf even when WELLNESS_STYLES has the right per-activity icon.
            // Only fall back to e.emoji if the activity name isn't in our table.
            const isMappedActivity = WELLNESS_STYLES[(e.activity || "").toLowerCase().trim()] !== undefined;
            const emoji = isMappedActivity ? s.emoji : (e.emoji || s.emoji);
            const accent = s.accent;
            // Time pill — formatted same as profile cards.
            const timeStr = e.loggedAt ? (() => {
              try { return new Date(e.loggedAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); } catch { return ""; }
            })() : "";
            const dur = e.duration ? `${e.duration} min` : null;
            return (
              <div key={i} style={{ background:"#252A3D", borderRadius:12, padding:"10px 13px", display:"flex", alignItems:"center", gap:11, border:`1.5px solid ${C.darkBorder}`, borderLeft:`4px solid ${accent}` }}>
                <div style={{ width:38, height:38, borderRadius:11, background:`${accent}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, border:`1.5px solid ${accent}55` }}>{emoji}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:13, color:"#E2E8F0" }}>{e.activity}</div>
                  {e.notes && <div style={{ fontSize:11, color:C.darkSub, marginTop:2 }}>{e.notes}</div>}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"flex-end", flexShrink:0 }}>
                  {dur && <span style={{ fontSize:10, fontWeight:800, color:accent, background:`${accent}22`, padding:"2px 7px", borderRadius:99 }}>{dur}</span>}
                  {timeStr && <span style={{ fontSize:10, fontWeight:600, color:C.darkSub, background:"#1A1D2E", padding:"2px 7px", borderRadius:99 }}>{timeStr}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── DARK SIDEBAR: Badge definitions ──────────────────────────────────────────
const BADGE_DEFS: Record<string, { emoji: string; label: string }> = {
  "first-workout": { emoji: "🏋️", label: "First Workout" },
  "7day-streak": { emoji: "🔥", label: "7 Day Streak" },
  "30day-streak": { emoji: "💪", label: "30 Day Streak" },
  "90day-streak": { emoji: "🦁", label: "90 Day Grind" },
  "first-5k": { emoji: "🏃", label: "First 5K" },
  "marathon": { emoji: "🏅", label: "Marathon" },
  "weight-lost-10": { emoji: "⚡", label: "10 lbs Down" },
  "weight-lost-25": { emoji: "🌟", label: "25 lbs Down" },
  "weight-lost-50": { emoji: "👑", label: "50 lbs Down" },
  "macro-week": { emoji: "🥗", label: "Macro Week" },
  "protein-streak": { emoji: "🥩", label: "Protein Streak" },
  "hydration-week": { emoji: "💧", label: "Hydration Week" },
  "zen-week": { emoji: "🧘", label: "Zen Week" },
  "zero-alcohol": { emoji: "🌿", label: "Sober Streak" },
  "sleep-champion": { emoji: "😴", label: "Sleep Champion" },
  "community-100": { emoji: "🤝", label: "Community 100" },
  "personal-trainer": { emoji: "🎓", label: "Personal Trainer" },
};

// ── DARK SIDEBAR: One user's full activity block ──────────────────────────────
function SideUserBlock({ post, userBadges = [] }: { post: Post; userBadges?: string[] }) {
  const hasActivity = post.workout || post.nutrition || post.wellness;
  if (!hasActivity) return null;
  const displayBadges = userBadges.slice(0, 4);
  return (
    <div style={{ background:C.darkCard, borderRadius:18, border:`1px solid ${C.darkBorder}`, overflow:"hidden", marginBottom:16 }}>
      {/* User header */}
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px 12px",borderBottom:`1px solid ${C.darkBorder}` }}>
        <TierFrame tier={(post as any).tier || "default"} size={44}>
          <div style={{ width:"100%",height:"100%",background:"linear-gradient(135deg,#7C3AED,#15803D)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff" }}>
            {(post as any).avatarUrl
              ? <img src={(post as any).avatarUrl} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
              : post.avatar}
          </div>
        </TierFrame>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:5,flexWrap:"wrap" }}>
            <span style={{ fontWeight:800,fontSize:14,color:"#E2E8F0" }}>{post.user}</span>
            <TierBadgeChip tier={(post as any).tier || "default"} small />
          </div>
          <div style={{ fontSize:11,color:C.darkSub }}>@{post.username}</div>
        </div>
        <div style={{ marginLeft:"auto",fontSize:11,color:C.darkSub }}>{post.time}</div>
      </div>
      {/* Activity cards */}
      <div style={{ padding:"12px 14px 4px" }}>
        {post.workout && <SideWorkout workout={post.workout} />}
        {post.nutrition && <SideNutrition nutrition={post.nutrition} />}
        {post.wellness && <SideWellness wellness={post.wellness} />}
      </div>
      {/* Badges */}
      {displayBadges.length > 0 && (
        <div style={{ padding:"8px 14px 12px", borderTop:`1px solid ${C.darkBorder}` }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.darkSub, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Badges</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {displayBadges.map(badgeId => {
              const def = BADGE_DEFS[badgeId] || { emoji: "🏆", label: badgeId };
              return (
                <div key={badgeId} style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(245,166,35,0.12)", border:"1px solid rgba(245,166,35,0.3)", borderRadius:99, padding:"4px 10px" }}>
                  <span style={{ fontSize:12 }}>{def.emoji}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:"#F5A623" }}>{def.label}</span>
                </div>
              );
            })}
            {userBadges.length > 4 && (
              <div style={{ display:"flex", alignItems:"center", background:"rgba(245,166,35,0.08)", border:"1px solid rgba(245,166,35,0.2)", borderRadius:99, padding:"4px 10px" }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#F5A623" }}>+{userBadges.length - 4} more</span>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Comments */}
      <ActivityComments cardId={post.id as string} cardOwnerId={post._userId as string} />
    </div>
  );
}

// ── Post Card (left column — media + social only) ─────────────────────────────
// PERF: PostCard is memoized so it only re-renders when its specific
// post or callbacks change. Without this, every parent state change
// (which happens often — likes, comments, story progress) re-renders
// every visible card on the feed. With ~10-20 cards visible at once
// and 50+ state values on the parent, that's a lot of wasted work.
//
// Custom equality function: re-render only if the post's data changed
// or the user changed. We deliberately ignore callback identity since
// the parent recreates them on every render — comparing by reference
// would defeat the memo entirely.
const PostCard = memo(function PostCard({ post, onUpdate, onDelete, onReport, currentUser, onCommentsRefresh }: { post: Post; onUpdate: (p: Post) => void; onDelete?: () => void; onReport?: () => void; currentUser?: { id: string; profile?: { username?: string }; user_metadata?: { username?: string } }; onCommentsRefresh?: (postId: string | number, comments: any[]) => void }) {
  // Determine ownership. Prefer comparing user IDs (reliable) over username
  // (which can be stale or fall back to "User" if profile data didn't load).
  const isOwner = !!currentUser && (
    (typeof (post as any).user_id === "string" && (post as any).user_id === currentUser.id) ||
    (post.username && (post.username === currentUser?.profile?.username || post.username === currentUser?.user_metadata?.username))
  );
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  // Swipe tracking via ref — survives React's event pooling and is more reliable
  // than stashing properties on e.currentTarget across separate handler calls.
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  // Set true on pointerup if the gesture was a real swipe (>40px horizontal).
  // Cleared on the next pointerdown. This lets us suppress the image's onClick
  // → lightbox handler when the user was actually swiping rather than tapping.
  const justSwipedRef = useRef(false);
  // Clamp currentPhoto if it falls out of bounds (e.g. user removes a photo, or
  // photos array shrinks for any reason). Without this the carousel tries to
  // render undefined and the dots/arrows misbehave.
  useEffect(() => {
    if (currentPhoto > post.photos.length - 1) setCurrentPhoto(Math.max(0, post.photos.length - 1));
  }, [post.photos.length, currentPhoto]);
  const [lightbox, setLightbox] = useState<string|null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [brokenImage, setBrokenImage] = useState(false);
  // Share button state — shows a "✓ Copied" confirmation for 2.5s after
  // the user copies a post link to their clipboard.
  const [shareCopied, setShareCopied] = useState(false);

  /** Share or copy a permalink to this post. Tries native share sheet
   *  on mobile, falls back to clipboard.writeText with a visible toast.
   *  Used by the previously-broken Share button on each feed post.
   *
   *  Builds the URL from the current origin so it works both on
   *  liveleeapp.com and on Vercel preview deployments without baking
   *  the domain in. Mock posts (numeric ids without dashes) skip share
   *  since they don't have public permalinks. */
  async function sharePost() {
    const isRealPost = typeof post.id === "string" && post.id.includes("-");
    if (!isRealPost) return;
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/post/${post.id}`
      : `https://liveleeapp.com/post/${post.id}`;
    const shareData = {
      title: "Check out this post on Livelee",
      text: post.caption ? post.caption.slice(0, 120) : "Check out this post on Livelee",
      url,
    };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      // Other errors → fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      window.prompt("Copy this post link:", url);
    }
  }
  // Carousel video mute toggle. Default muted because browsers refuse to
  // autoplay videos with audio (Chrome/Safari/Firefox all block this), and we
  // want the video to start playing the moment it becomes the active slide.
  // User taps the speaker icon to unmute.
  const [videoMuted, setVideoMuted] = useState(true);
  const [replyTo, setReplyTo] = useState<{id:number|string;user:string}|null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [m, d] = post.dateShort.split(".").map(Number);

  async function toggleLike() {
    if (!currentUser || likeLoading) return;
    setLikeLoading(true);
    const isDbPost = typeof post.id === 'string' && post.id.includes('-');
    if (isDbPost) {
      if (post.liked) {
        await supabase.from('likes').delete().eq('user_id', currentUser.id).eq('post_id', post.id);
      } else {
        await supabase.from('likes').insert({ user_id: currentUser.id, post_id: post.id });
        // Notify post owner (only if not liking own post)
        const postOwnerId = (post as any)._ownerId;
        if (postOwnerId && postOwnerId !== currentUser.id) {
          const name = currentUser?.profile?.full_name || currentUser?.user_metadata?.full_name || 'Someone';
          fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ action:'create_notification', payload:{ userId: postOwnerId, fromUserId: currentUser.id, type:'like', referenceId: post.id, body:`${name} liked your post` }}) });
        }
      }
    }
    onUpdate({ ...post, liked: !post.liked, likes: post.liked ? post.likes - 1 : post.likes + 1 });
    setLikeLoading(false);
  }

  async function submitComment() {
    if (!commentText.trim() || commentLoading) return;
    setCommentLoading(true);
    const isDbPost = typeof post.id === 'string' && post.id.includes('-');
    const displayName = currentUser?.profile?.full_name || currentUser?.user_metadata?.full_name || "You";
    const avatarInitials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase();
    const fullText = replyTo ? `@${replyTo.user.split(' ')[0]} ${commentText.trim()}` : commentText.trim();
    setReplyTo(null);

    if (isDbPost && currentUser) {
      // Submit via /api/db so the admin client bypasses RLS. The server
      // returns the FULL updated comments list for this post, which we use
      // to refresh the parent state authoritatively (no optimistic-state
      // drift bugs — the UI reflects exactly what's in the database).
      try {
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'post_feed_comment',
            payload: {
              postId: post.id,
              commenterId: currentUser.id,
              content: fullText,
              postOwnerId: (post as any)._ownerId || null,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          console.error('[comment] post failed:', data?.error || res.statusText);
          alert(`Couldn't post your comment: ${data?.error || 'Server error'}`);
          setCommentLoading(false);
          return;
        }
        // Refresh the parent's view of this post's comments using the
        // authoritative list returned by the server.
        if (onCommentsRefresh && data.comments) {
          onCommentsRefresh(post.id, data.comments);
        }
        // Analytics: comments are a strong engagement signal — track per
        // post so we can compute "% of users commenting" funnels.
        track("comment_created", {
          post_id: post.id,
          comment_length: fullText.length,
        });
        setCommentText("");
        setCommentLoading(false);
        return;
      } catch (err: any) {
        console.error('[comment] network error:', err);
        alert(`Couldn't post your comment: ${err?.message || 'Network error'}`);
        setCommentLoading(false);
        return;
      }
    }

    // Mock posts (not in DB) — fall back to local-only optimistic update
    const nc: Comment = { id: Date.now(), user: displayName, avatar: avatarInitials, text: fullText, time: "Just now" };
    onUpdate({ ...post, comments: [...post.comments, nc] });
    setCommentText("");
    setCommentLoading(false);
  }
  function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => onUpdate({ ...post, photos: [...post.photos, ev.target!.result as string] });
    r.readAsDataURL(file);
    e.target.value = "";
  }

  const visibleComments = showAllComments ? post.comments : post.comments.slice(0,1);

  return (
    <>
      {lightbox && (
        <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center" }} onClick={() => setLightbox(null)}>
          <img src={ImagePresets.full(lightbox)} loading="eager" style={{ maxWidth:"95vw",maxHeight:"90vh",borderRadius:16,objectFit:"contain" }} alt="" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} style={{ position:"absolute",top:20,right:24,background:"none",border:"none",color:"#fff",fontSize:32,cursor:"pointer" }}>×</button>
        </div>
      )}

      {/* Tier skin: border + glow based on user's tier */}
      <div style={{
        background: C.white,
        border: `2px solid ${post.tier && post.tier !== "default" ? TIER_COLORS[post.tier as Tier]?.border : "#2D1F52"}`,
        boxShadow: post.tier && post.tier !== "default" ? `0 4px 24px ${TIER_COLORS[post.tier as Tier]?.glow}` : "0 4px 24px rgba(124,58,237,0.10)",
        borderRadius: 20, marginBottom: 24, overflow: "hidden" as const,
      }}>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 18px 10px" }}>
          <div onClick={() => window.location.href=`/profile/${post.username}`} style={{ cursor:"pointer",flexShrink:0 }}>
            <TierFrame tier={post.tier || "default"} size={46}>
              <div style={{ width:"100%",height:"100%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff" }}>
                {post.avatar && (post.avatar.startsWith('http') || post.avatar.startsWith('/'))
                  ? <img src={ImagePresets.avatarSm(post.avatar)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                  : post.avatar}
              </div>
            </TierFrame>
          </div>
          <div style={{ flex:1,cursor:"pointer" }} onClick={() => window.location.href=`/profile/${post.username}`}>
            <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
              <span style={{ fontWeight:900,fontSize:15,color:C.text }}>{post.user}</span>
              <TierBadgeChip tier={post.tier || "default"} small />
            </div>
            <TierTitle tier={post.tier || "default"} />
            <div style={{ fontSize:12,color:C.sub }}>@{post.username} · {post.time}</div>
          </div>
          <div style={{ width:50,height:50,borderRadius:13,background:`linear-gradient(135deg,${C.gold},#FFD700)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(245,166,35,0.3)" }}>
            <span style={{ color:"#fff",fontWeight:900,fontSize:18,lineHeight:1 }}>{d}</span>
            <span style={{ color:"rgba(255,255,255,0.85)",fontSize:10,fontWeight:700 }}>{MONTHS[m-1]}</span>
          </div>
          {/* ⋯ menu — owners see Delete, non-owners see Report.
              Report button covers Apple Guideline 1.2 for user-generated content. */}
          {(isOwner || (currentUser && !isOwner)) && (
            <div style={{ position:"relative" }}>
              <button onClick={() => setShowMenu(m => !m)} style={{ background:"none",border:"none",cursor:"pointer",padding:"4px 8px",borderRadius:8,color:C.sub,fontSize:20,lineHeight:1 }}>···</button>
              {showMenu && (
                <div style={{ position:"absolute",right:0,top:"100%",zIndex:50,background:"#111118",border:"1.5px solid #2D1F52",borderRadius:14,boxShadow:"0 8px 24px rgba(0,0,0,0.4)",minWidth:160,overflow:"hidden" }}>
                  {isOwner && onDelete && !confirmDelete && (
                    <button onClick={() => setConfirmDelete(true)} style={{ width:"100%",padding:"12px 16px",background:"none",border:"none",cursor:"pointer",textAlign:"left",fontSize:14,fontWeight:700,color:"#EF4444",display:"flex",alignItems:"center",gap:8 }}>
                      🗑️ Delete Post
                    </button>
                  )}
                  {isOwner && onDelete && confirmDelete && (
                    <div style={{ padding:"12px 16px" }}>
                      <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:10 }}>Delete this post?</div>
                      <div style={{ display:"flex",gap:8 }}>
                        <button onClick={() => { setShowMenu(false); setConfirmDelete(false); onDelete(); }} style={{ flex:1,padding:"8px 0",borderRadius:10,border:"none",background:"#EF4444",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer" }}>Yes, delete</button>
                        <button onClick={() => { setShowMenu(false); setConfirmDelete(false); }} style={{ flex:1,padding:"8px 0",borderRadius:10,border:"1.5px solid #2D1F52",background:"#1A1228",color:C.sub,fontWeight:800,fontSize:13,cursor:"pointer" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {!isOwner && currentUser && (
                    <button onClick={() => { setShowMenu(false); onReport?.(); }} style={{ width:"100%",padding:"12px 16px",background:"none",border:"none",cursor:"pointer",textAlign:"left",fontSize:14,fontWeight:700,color:"#FCA5A5",display:"flex",alignItems:"center",gap:8 }}>
                      🚩 Report Post
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Caption */}
        {post.caption && (
          <div style={{ padding:"0 18px 12px",fontSize:14,color:C.text,lineHeight:1.6 }}>{post.caption}</div>
        )}

        {/* ── MEDIA — square, full width ── */}
        {post.photos.length > 0 ? (
          <div
            style={{ position:"relative",width:"100%",aspectRatio:"1/1",background:"linear-gradient(135deg,#7C3AED,#A78BFA)",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"pan-y" }}
            // Swipe support — uses Pointer Events instead of Touch Events for
            // iOS reliability. iOS Safari has a quirk where touch-action: pan-y
            // can absorb touch sequences if iOS detects any vertical component,
            // killing touchend before our handler runs. Pointer Events with
            // setPointerCapture sidestep this entirely. Mouse drags are filtered
            // out so desktop users still get arrow-button + click behavior.
            onPointerDown={(e) => {
              if (post.photos.length <= 1) return;
              if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
              try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch {}
              justSwipedRef.current = false;
              swipeStartRef.current = {
                x: e.clientX,
                y: e.clientY,
              };
            }}
            onPointerUp={(e) => {
              if (post.photos.length <= 1) return;
              const start = swipeStartRef.current;
              if (!start) return;
              swipeStartRef.current = null;
              const dx = e.clientX - start.x;
              const dy = e.clientY - start.y;
              if (Math.abs(dy) > Math.abs(dx)) return;
              if (dx > 40 && currentPhoto > 0) {
                justSwipedRef.current = true;
                setCurrentPhoto(c => c - 1);
              } else if (dx < -40 && currentPhoto < post.photos.length - 1) {
                justSwipedRef.current = true;
                setCurrentPhoto(c => c + 1);
              }
            }}
            onPointerCancel={() => { swipeStartRef.current = null; }}
          >
            {!brokenImage && (() => {
              const currentUrl = post.photos[currentPhoto];
              const currentType = (post as any).mediaTypes?.[currentPhoto] || 'image';
              if (currentType === 'video') {
                return (
                  <>
                    {/* Carousel video — Instagram-style. autoPlay+loop+muted+playsInline
                        is the only combination browsers will autoplay reliably. The
                        `key` change on swipe-to forces a fresh mount which retriggers
                        autoplay. pointerEvents:'none' is the magic bit — the native
                        <video controls> UI eats touch events, so we drop controls AND
                        block pointer events on the video itself, letting the wrapper
                        div's swipe handlers see every touch. The mute button is a
                        sibling so it gets normal pointer events. */}
                    <video
                      key={currentUrl}
                      src={currentUrl}
                      autoPlay
                      loop
                      muted={videoMuted}
                      playsInline
                      preload="metadata"
                      style={{ width:"100%",height:"100%",objectFit:"cover",background:"#000",pointerEvents:"none" }}
                      onError={() => { setBrokenImage(true); }}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); setVideoMuted(m => !m); }}
                      aria-label={videoMuted ? "Unmute video" : "Mute video"}
                      style={{ position:"absolute",bottom:12,right:12,width:36,height:36,borderRadius:"50%",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",border:"none",color:"#fff",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2 }}
                    >
                      {videoMuted ? "🔇" : "🔊"}
                    </button>
                  </>
                );
              }
              return (
                <img
                  // PERF: serve a feed-sized variant (~800px wide) instead
                  // of the original 2-3MB iPhone photo. Supabase resizes
                  // on the fly. Lightbox click opens the full-resolution.
                  src={ImagePresets.feed(currentUrl)}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width:"100%",height:"100%",objectFit:"cover",cursor:"pointer",
                    // Apply per-photo crop position. Falls back to centered (50)
                    // if the post predates this column or the array is shorter
                    // than expected. Old posts with no media_positions render
                    // exactly as before.
                    objectPosition: `center ${(post as any).mediaPositions?.[currentPhoto] ?? 50}%`,
                  }}
                  alt=""
                  onClick={() => { if (justSwipedRef.current) { justSwipedRef.current = false; return; } setLightbox(currentUrl); }}
                  onError={() => { setBrokenImage(true); }}
                />
              );
            })()}
            {brokenImage && (
              <div style={{ display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12 }}>
                <div style={{ fontSize:60 }}>📸</div>
                <div style={{ fontSize:14,color:"rgba(255,255,255,0.8)",fontWeight:700 }}>Media unavailable</div>
              </div>
            )}
            {post.photos.length > 1 && (<>
              {/* Counter pill — shows "2/4" so users know there's more */}
              <div style={{ position:"absolute",top:12,right:12,padding:"4px 10px",borderRadius:99,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",color:"#fff",fontSize:12,fontWeight:700,pointerEvents:"none" }}>
                {currentPhoto + 1}/{post.photos.length}
              </div>
              <div style={{ position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",display:"flex",gap:6,zIndex:2 }}>
                {post.photos.map((_,i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentPhoto(i); }} style={{ width:i===currentPhoto?20:8,height:8,borderRadius:4,border:"none",background:i===currentPhoto?"#fff":"rgba(255,255,255,0.45)",cursor:"pointer",transition:"width 0.2s",padding:0 }}/>
                ))}
              </div>
              {currentPhoto > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentPhoto(c => c - 1); }}
                  aria-label="Previous"
                  style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",width:38,height:38,borderRadius:"50%",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",border:"none",color:"#fff",fontSize:22,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,paddingBottom:3 }}
                >‹</button>
              )}
              {currentPhoto < post.photos.length-1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentPhoto(c => c + 1); }}
                  aria-label="Next"
                  style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",width:38,height:38,borderRadius:"50%",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",border:"none",color:"#fff",fontSize:22,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,paddingBottom:3 }}
                >›</button>
              )}
            </>)}
          </div>
        ) : (
          <label style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:14,margin:"0 18px 12px",height:340,borderRadius:16,border:"2px dashed #2D1F52",background:"#1A1228",cursor:isOwner?"pointer":"default" }}>
            {isOwner ? (<>
              <span style={{ fontSize:36 }}>📷</span>
              <div>
                <div style={{ fontSize:15,fontWeight:700,color:C.blue }}>Add Photo / Video</div>
                <div style={{ fontSize:12,color:C.sub,marginTop:2 }}>Tap to upload</div>
              </div>
              <input type="file" accept="image/*,video/*" style={{ display:"none" }} onChange={addPhoto} />
            </>) : (
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:40,marginBottom:8 }}>🏋️</div>
                <span style={{ fontSize:13,color:C.sub }}>No photo shared</span>
              </div>
            )}
          </label>
        )}
        {post.photos.length > 0 && isOwner && (
          <div style={{ padding:"6px 18px 0",display:"flex",alignItems:"center",gap:8 }}>
            <label style={{ fontSize:12,fontWeight:700,color:C.blue,cursor:"pointer",padding:"5px 14px",borderRadius:20,background:"#1A1228",border:"1px solid #2D1F52" }}>
              + Add Photo
              <input type="file" accept="image/*,video/*" style={{ display:"none" }} onChange={addPhoto} />
            </label>
            <span style={{ fontSize:12,color:C.sub }}>{post.photos.length} photo{post.photos.length!==1?"s":""}</span>
            <button onClick={() => onUpdate({ ...post, photos: post.photos.filter((_,i) => i !== currentPhoto) })} style={{ marginLeft:"auto",fontSize:12,fontWeight:700,color:"#EF4444",background:"#FEE2E2",border:"none",cursor:"pointer",padding:"5px 14px",borderRadius:20 }}>
              🗑️ Remove Photo
            </button>
          </div>
        )}

        {/* Actions */}
        <div style={{ padding:"12px 18px 8px",borderTop:"1px solid #2D1F52",marginTop:12 }}>
          {/* Reaction bar */}
          <ReactionBar
            postId={post.id}
            currentUserId={currentUser?.id}
            initialCounts={{ heart: post.likes, fire: 0, flex: 0, clap: 0, rocket: 0 }}
            initialMine={post.liked ? new Set<ReactionKey>(["heart"]) : new Set<ReactionKey>()}
          />
          {/* Comment + Share row */}
          <div style={{ display:"flex",alignItems:"center",gap:16,marginTop:10 }}>
            <button onClick={() => document.getElementById(`ci-${post.id}`)?.focus()} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:20,height:20 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span style={{ fontSize:13,fontWeight:700,color:C.sub }}>{post.comments.length > 0 ? post.comments.length : ""} {post.comments.length === 1 ? "comment" : post.comments.length > 1 ? "comments" : "Comment"}</span>
            </button>
            <button
              onClick={sharePost}
              aria-label={shareCopied ? "Link copied" : "Share post"}
              style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0,marginLeft:"auto" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke={shareCopied ? C.green : C.sub} strokeWidth="2" style={{ width:20,height:20, transition: "stroke 0.2s" }}>
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              <span style={{ fontSize:13,fontWeight:700,color: shareCopied ? C.green : C.sub, transition:"color 0.2s" }}>
                {shareCopied ? "Copied" : "Share"}
              </span>
            </button>
          </div>
        </div>

        {/* Comments */}
        {post.comments.length > 0 && (
          <div style={{ padding:"0 18px 10px",display:"flex",flexDirection:"column",gap:10 }}>
            {visibleComments.map(c => (
              <div key={c.id} style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                <div style={{ width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0,overflow:"hidden" }}>
                  {c.avatar && (c.avatar.startsWith('http')||c.avatar.startsWith('/'))
                    ? <img src={ImagePresets.avatarSm(c.avatar)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                    : c.avatar}
                </div>
                <div style={{ flex:1,background:"#1A1228",borderRadius:14,padding:"9px 13px",border:"1px solid #2D1F52" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3 }}>
                    <span style={{ fontWeight:800,fontSize:12,color:C.text }}>{c.user}</span>
                    <span style={{ fontSize:10,color:C.sub }}>{c.time}</span>
                  </div>
                  <p style={{ fontSize:13,color:C.text,margin:0,lineHeight:1.5 }}>{c.text}</p>
                  <div style={{ display:"flex", gap:14, marginTop:2 }}>
                    <button onClick={()=>{ setReplyTo({id:c.id,user:c.user}); setCommentText(`@${c.user.split(' ')[0]} `); setTimeout(()=>commentInputRef.current?.focus(),50); }} style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:C.sub,padding:"4px 0 0" }}>Reply</button>
                    {currentUser && (c as any).user_id === currentUser.id && (
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this comment?")) return;
                          try {
                            const res = await fetch("/api/db", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "delete_post_comment", payload: { commentId: c.id, userId: currentUser.id } }),
                            });
                            const json = await res.json();
                            if (json.error) throw new Error(json.error);
                            // Fetch the fresh comment list and propagate via onCommentsRefresh
                            const freshRes = await fetch("/api/db", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "get_post_comments", payload: { postId: post.id } }),
                            });
                            const fresh = await freshRes.json();
                            onCommentsRefresh?.(post.id, fresh.comments || []);
                          } catch (e: any) {
                            alert(`Could not delete: ${e?.message || "unknown error"}`);
                          }
                        }}
                        style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:"#EF4444",padding:"4px 0 0" }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {post.comments.length > 1 && (
              <button onClick={() => setShowAllComments(s=>!s)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:C.blue,textAlign:"left",padding:0 }}>
                {showAllComments ? "Show less" : `View all ${post.comments.length} comments`}
              </button>
            )}
          </div>
        )}

        {/* Comment input */}
        {replyTo && (
          <div style={{ padding:"0 18px 6px",display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontSize:12,color:C.sub }}>Replying to <strong>{replyTo.user.split(' ')[0]}</strong></span>
            <button onClick={()=>{setReplyTo(null);setCommentText("");}} style={{background:"none",border:"none",cursor:"pointer",color:C.sub,fontSize:14,padding:0,lineHeight:1}}>×</button>
          </div>
        )}
        <div style={{ padding:"0 18px 16px",display:"flex",gap:10,alignItems:"center" }}>
          <div style={{ width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0,overflow:"hidden" }}>
            {currentUser?.profile?.avatar_url
              ? <img src={ImagePresets.avatarSm(currentUser.profile.avatar_url)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
              : ((currentUser?.profile?.full_name || currentUser?.user_metadata?.full_name || "?").split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase())}
          </div>
          <div style={{ flex:1,display:"flex",gap:8,alignItems:"center",background:"#1A1228",borderRadius:24,padding:"8px 16px",border:"1.5px solid #2D1F52" }}>
            <input ref={commentInputRef} id={`ci-${post.id}`} value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&submitComment()} placeholder={replyTo?`Reply to ${replyTo.user.split(' ')[0]}...`:"Add a comment..."} style={{ flex:1,background:"none",border:"none",outline:"none",fontSize:13,color:C.text }} />
            {commentText.trim() && <button onClick={submitComment} disabled={commentLoading} style={{ background:"none",border:"none",cursor:"pointer",color:C.blue,fontWeight:800,fontSize:13,padding:0,opacity:commentLoading?0.5:1 }}>{commentLoading?"...":"Post"}</button>}
          </div>
        </div>
      </div>
    </>
  );
}, (prev, next) => {
  // Custom equality: re-render only when meaningful post data changes.
  // We compare specific fields rather than the whole post object because
  // the parent often passes a fresh object on every render (the same data
  // but a new identity), which would defeat memo.
  const a = prev.post;
  const b = next.post;
  return (
    a.id === b.id &&
    a.likes === b.likes &&
    a.liked === b.liked &&
    a.comments?.length === b.comments?.length &&
    a.caption === b.caption &&
    prev.currentUser?.id === next.currentUser?.id
  );
});

// ── New Members Panel ─────────────────────────────────────────────────────────
interface Member {
  id: string;
  full_name?: string;
  username?: string;
  city?: string;
  created_at: string;
  avatar_url?: string;
}

function NewMembersPanel({ members, currentUser }: { members: Member[]; currentUser: { profile?: { city?: string }; id: string } }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? members : members.slice(0, 3);
  const userCity = currentUser?.profile?.city?.split(",")[0]?.trim()?.toLowerCase() || "";

  return (
    <div style={{ background:C.darkCard, borderRadius:24, border:`1px solid ${C.darkBorder}`, overflow:"hidden", marginBottom:24 }}>
      <div style={{ padding:"14px 18px 10px", borderBottom:`1px solid ${C.darkBorder}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontWeight:900, fontSize:15, color:"#E2E8F0" }}>👋 New Members</div>
          <div style={{ fontSize:11, color:C.darkSub, marginTop:1 }}>Recently joined · your city first</div>
        </div>
        <span style={{ fontSize:11, color:C.darkSub }}>{members.length} new</span>
      </div>
      <div style={{ padding:"6px 12px 10px" }}>
        {visible.map((member: any, i: number) => {
          const name = member.full_name || member.username || "User";
          const ini = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
          const memberCity = member.city?.split(",")[0]?.trim()?.toLowerCase() || "";
          const isLocal = userCity && memberCity && memberCity.includes(userCity);
          const joined = (() => {
            const diff = Date.now() - new Date(member.created_at).getTime();
            if (diff < 3600000) return "just now";
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
            if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
            return new Date(member.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          })();
          return (
            <div key={member.id}
              onClick={() => window.location.href = `/profile/${member.username}`}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 8px", borderRadius:14, cursor:"pointer", transition:"background 0.15s", marginBottom:2 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1E2A1E")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width:16, fontSize:11, fontWeight:900, color:C.darkSub, flexShrink:0, textAlign:"center" }}>#{i+1}</div>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#7C3AED,#4ADE80)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden", border: isLocal ? "2px solid #7C3AED" : "2px solid #2A2D3E" }}>
                {member.avatar_url
                  ? <img src={ImagePresets.avatarSm(member.avatar_url)} loading="lazy" decoding="async" style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : ini}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontWeight:800, fontSize:13, color:"#E2E8F0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</span>
                  {isLocal && <span style={{ fontSize:9, fontWeight:800, color:"#7C3AED", background:"rgba(22,163,74,0.15)", borderRadius:6, padding:"1px 5px", flexShrink:0 }}>LOCAL</span>}
                </div>
                <div style={{ fontSize:11, color:C.darkSub, marginTop:1 }}>@{member.username}{member.city ? ` · ${member.city.split(",")[0]}` : ""}</div>
                <div style={{ fontSize:10, color:"#7C3AED", marginTop:2, fontWeight:700 }}>🆕 Joined {joined}</div>
              </div>
              <FollowButton targetUserId={member.id} size="sm" />
            </div>
          );
        })}
        {members.length > 3 && (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
            style={{ width:"100%", padding:"9px 0", marginTop:4, background:"none", border:`1px solid ${C.darkBorder}`, borderRadius:12, color:C.darkSub, fontSize:12, fontWeight:700, cursor:"pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#1E2A1E")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            {expanded ? "Show less ▲" : `See all ${members.length} new members ▼`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Activity Type Filter Chips ────────────────────────────────────────────────
type ActivityFilter = "all" | "workout" | "nutrition" | "wellness";

function ActivityFilterChips({ value, onChange }: { value: ActivityFilter; onChange: (v: ActivityFilter) => void }) {
  const chips: { key: ActivityFilter; label: string; emoji: string }[] = [
    { key: "all", label: "All", emoji: "⚡" },
    { key: "workout", label: "Workouts", emoji: "🏋️" },
    { key: "nutrition", label: "Nutrition", emoji: "🥗" },
    { key: "wellness", label: "Wellness", emoji: "🌿" },
  ];
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", padding:"0 12px 12px" }}>
      {chips.map(c => (
        <button key={c.key} onClick={() => onChange(c.key)} style={{
          padding:"5px 11px", borderRadius:99, border:"none", cursor:"pointer",
          fontWeight:700, fontSize:11,
          background: value === c.key ? "#7C3AED" : "rgba(124,58,237,0.10)",
          color: value === c.key ? "#fff" : "#9CA3AF",
          transition:"all 0.15s",
        }}>
          {c.emoji} {c.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Feed Page ────────────────────────────────────────────────────────────
export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [dbPosts, setDbPosts] = useState<any[]>([]);
  const [dbPostsPage, setDbPostsPage] = useState(0);
  const [dbPostsHasMore, setDbPostsHasMore] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLogsPage, setActivityLogsPage] = useState(0);
  const [activityLogsHasMore, setActivityLogsHasMore] = useState(true);
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [userBadgeMap, setUserBadgeMap] = useState<Record<string, string[]>>({});
  // Report state — when non-null, ReportModal is shown for that target.
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  // Pull-to-refresh state. Tracked at the page level (not PostCard) because
  // the gesture lives on the feed scroll container. The pull distance is
  // capped at 80px which roughly matches iOS's native PTR. The threshold for
  // commit is 65px — past that, releasing fires the refresh and we show the
  // spinner state until fetchPosts(0) resolves.
  const [ptrPullPx, setPtrPullPx] = useState(0);
  const [ptrRefreshing, setPtrRefreshing] = useState(false);
  const ptrStartYRef = useRef<number | null>(null);
  const [feedTab, setFeedTab] = useState<"foryou" | "following" | "notifications">("foryou");
  const [followingPosts, setFollowingPosts] = useState<any[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  // Streak reminder card — shows at top of For You when user has an active
  // streak AND hasn't logged anything today. The streak is computed from
  // activity_logs (workouts + wellness) over the last 30 days. Set to 0 means
  // "don't show the card." A user who dismisses the card today gets
  // localStorage'd so they don't see it again until tomorrow.
  const [streakInfo, setStreakInfo] = useState<{
    days: number;
    loggedToday: boolean;
  } | null>(null);
  const [streakDismissed, setStreakDismissed] = useState(false);
  // Recap prompt — appears once per week on first feed load showing a CTA
  // to view last week's recap. Persists dismissal in localStorage by week
  // start date so users see exactly one recap prompt per week.
  const [showRecapPrompt, setShowRecapPrompt] = useState(false);
  // The Sunday-ISO of the week we're prompting about. Stored separately
  // so the URL the prompt links to is correct.
  const [recapWeekKey, setRecapWeekKey] = useState<string>("");
  // Stories — real data from /api/db
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [postingStory, setPostingStory] = useState(false);
  const storyFileInputRef = useRef<HTMLInputElement>(null);
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<any>(null);
  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const unreadCount = notifications.filter(n => !n.read).length;
  const [newMembers, setNewMembers] = useState<any[]>([]);

  const PAGE_SIZE = 10;

  // ── For You feed loader ───────────────────────────────────────────────
  // CLEAN REBUILD. Direct supabase query. Only columns we KNOW exist
  // (proven by Discover and Profile working with them). No /api/db dependency
  // — that endpoint had multiple sources of silent failure.
  //
  // Columns selected: id, username, full_name, avatar_url, city — exactly
  // what Discover uses (proven to work). NOT tier (column missing), NOT
  // logs_last_28_days (also potentially missing). Tier is computed in the
  // renderer fallback.
  //
  // No nested comments join — that hits RLS edge cases. Comments load
  // lazily per post when expanded.
  async function fetchPosts(page: number, append = false) {
    if (page === 0) setLoadingFeed(true);
    else setLoadingMorePosts(true);

    let data: any[] | null = null;

    try {
      const FETCH_LIMIT = Math.max((page + 1) * PAGE_SIZE * 4, 60);
      const { data: posts, error: queryErr } = await supabase
        .from('posts')
        .select('id, user_id, caption, media_url, media_urls, media_type, media_types, media_positions, post_type, location, location_id, is_public, created_at, likes_count, users(id, username, full_name, avatar_url, city), locationData:locations(id, name, city, kind)')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT);

      if (queryErr) {
        console.error('[feed] posts query failed:', queryErr.message, queryErr);
      } else if (Array.isArray(posts)) {
        // Score for ranking. Tier 0 = own posts, 1 = follows, 2 = same city, 3 = rest
        let followingIds: string[] = [];
        let viewerCity = '';
        if (user) {
          try {
            const [followsRes, viewerRes] = await Promise.all([
              supabase.from('follows').select('following_id').eq('follower_id', user.id),
              supabase.from('users').select('city').eq('id', user.id).maybeSingle(),
            ]);
            followingIds = (followsRes.data || []).map((f: any) => f.following_id);
            viewerCity = (viewerRes.data?.city || '').split(',')[0]?.trim()?.toLowerCase() || '';
          } catch (followErr) {
            console.warn('[feed] couldnt fetch follows/city for ranking:', followErr);
          }
        }
        const followingSet = new Set(followingIds);

        // Find the user's single most recent post id (if any). Only THAT id
        // gets bucket 0; the user's older posts fall to bucket 3 with everyone
        // else. This prevents the feed from being a wall of your own old
        // content before you ever see anyone you follow. Posts come in already
        // sorted desc by created_at, so the first match is the most recent.
        let mostRecentOwnPostId: string | null = null;
        if (user) {
          const ownPost = posts.find((p: any) => p.user_id === user.id);
          if (ownPost) mostRecentOwnPostId = ownPost.id;
        }

        const ranked = posts
          .map((p: any, index: number) => {
            const postCity = (p.users?.city || '').split(',')[0]?.trim()?.toLowerCase();
            let bucket = 3;
            // Bucket 0 is RESERVED for your single most recent post.
            // All your older posts fall through to follow / city / rest.
            if (mostRecentOwnPostId && p.id === mostRecentOwnPostId) bucket = 0;
            else if (user && p.user_id === user.id) bucket = 3; // your older posts join "rest"
            else if (followingSet.has(p.user_id)) bucket = 1;
            else if (viewerCity && postCity && postCity === viewerCity) bucket = 2;
            return { post: p, bucket, index };
          })
          .sort((a, b) => a.bucket - b.bucket || a.index - b.index)
          .map(r => r.post);

        const pageRows = ranked.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

        // Hydrate _liked client-side
        let likedPostIds: Set<string> = new Set();
        if (user && pageRows.length > 0) {
          try {
            const postIds = pageRows.map((p: any) => p.id);
            const { data: likeData } = await supabase
              .from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds);
            if (likeData) likedPostIds = new Set(likeData.map((l: any) => l.post_id));
          } catch (likeErr) {
            console.warn('[feed] couldnt fetch likes:', likeErr);
          }
        }

        // Batch-load comments for the visible posts so the first-comment
        // preview renders on initial paint instead of waiting for the user
        // to click. One /api/db call per post — done in parallel. We map
        // DB shape (content, users) → display shape (text, user) here so
        // PostCard's existing render code Just Works.
        const postCommentsMap: Record<string, any[]> = {};
        if (pageRows.length > 0) {
          await Promise.all(pageRows.map(async (p: any) => {
            try {
              const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_post_comments', payload: { postId: p.id } }),
              });
              const cdata = await res.json();
              if (Array.isArray(cdata.comments)) {
                postCommentsMap[p.id] = cdata.comments.map((c: any) => {
                  const cu = c.users || c.user || {};
                  const cname = cu.full_name || cu.username || 'User';
                  const cini = cname.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase();
                  // Format time as friendly relative ("5m ago") matching the
                  // display the rest of the feed uses. Falls back to date string
                  // for old comments. Use a defensive guard on created_at because
                  // a missing field would yield "Invalid Date".
                  const t = (() => {
                    if (!c.created_at) return '';
                    const d = new Date(c.created_at);
                    if (isNaN(d.getTime())) return '';
                    const diff = Date.now() - d.getTime();
                    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
                    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
                    return d.toLocaleDateString();
                  })();
                  return {
                    id: c.id,
                    user: cname,
                    avatar: cu.avatar_url || cini,
                    text: c.content || '',
                    time: t,
                    user_id: c.user_id,
                  };
                });
              }
            } catch { /* leave empty on failure */ }
          }));
        }

        data = pageRows.map((p: any) => ({
          ...p,
          _liked: likedPostIds.has(p.id),
          comments: postCommentsMap[p.id] || [],
        }));
      }
    } catch (err) {
      console.error('[feed] fetchPosts unexpected error:', err);
    }

    if (data) {
      let filtered = data;
      if (user) {
        try {
          const blocks = await loadBlockedUsers(user.id);
          if (blocks.size > 0) {
            filtered = data.filter((p: any) => !blocks.has(p.user_id));
          }
        } catch {}
      }
      console.log('[feed] fetchPosts complete:', {
        rawCount: data.length,
        filteredCount: filtered.length,
        page,
        firstPostId: filtered[0]?.id,
      });
      if (append) setDbPosts(prev => [...prev, ...filtered]);
      else setDbPosts(filtered);
      setDbPostsHasMore(data.length === PAGE_SIZE);
      setDbPostsPage(page);
    } else {
      console.warn('[feed] fetchPosts ended with no data');
    }
    if (page === 0) setLoadingFeed(false);
    else setLoadingMorePosts(false);
  }


  // Fetch the For You feed once on mount AND once when user resolves so we
  // get personalized ranking. The first fetch on mount runs with user=null
  // (auth context still resolving) and gives an unranked fallback; the
  // refetch when user.id appears gives the proper bucketed ranking.
  useEffect(() => { fetchPosts(0); }, [user?.id]);

  // ── Stories: load active stories (last 24h) ────────────────────────────
  async function loadStories() {
    if (!user) return;
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_active_stories', payload: { viewerId: user.id } }),
      });
      const data = await res.json();
      if (data.stories) setStories(data.stories as Story[]);
    } catch (err) {
      console.warn('[stories] load failed:', err);
    }
  }
  useEffect(() => { loadStories(); }, [user?.id]);

  // ── Stories: post a new story (called when user picks a photo) ─────────
  async function handlePostStory(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setPostingStory(true);
    try {
      // iPhone photos can be 4-8MB and may be HEIC, both of which break the
      // upload pipeline (Vercel 4.5MB body limit + Supabase rejects HEIC).
      // Re-encode through a canvas to get a clean ~1MB JPEG every time.
      const compressed = await compressImage(file, 1600, 0.85);
      const url = await uploadPhoto(compressed, 'activity', `stories/${user.id}/${Date.now()}.jpg`);
      if (!url) {
        alert("Couldn't upload that photo. Try another one.");
        return;
      }
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post_story',
          payload: { userId: user.id, mediaUrl: url, mediaType: 'image', caption: null },
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Failed to post story: ${data.error}`);
        return;
      }
      await loadStories();
    } catch (err: any) {
      console.warn('[stories] post failed:', err);
      alert(`Story upload error: ${err?.message || String(err)}`);
    } finally {
      setPostingStory(false);
      if (storyFileInputRef.current) storyFileInputRef.current.value = "";
    }
  }

  // ── Stories: delete one of your own ────────────────────────────────────
  async function handleDeleteStory(storyId: string) {
    if (!user) return;
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_my_story', payload: { userId: user.id, storyId } }),
      });
      setViewingStory(null);
      await loadStories();
    } catch (err) {
      console.warn('[stories] delete failed:', err);
    }
  }

  // ── Stories: reply via DM ──────────────────────────────────────────────
  // Encodes the story media URL in the message content using a [story_reply]
  // marker that the messages page knows how to render.
  async function handleStoryReply(story: Story, text: string) {
    if (!user) return;
    try {
      // Find or create a conversation between user and story author
      const convRes = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_conversation',
          payload: { userId: user.id, otherUserId: story.user_id },
        }),
      });
      const convData = await convRes.json();
      const conversationId = convData?.conversationId || convData?.conversation?.id;
      if (!conversationId) {
        alert("Couldn't open DM with that user.");
        return;
      }

      // Send the message with the story-reply marker. The messages page
      // parses [story_reply]: URL out and renders it as a small preview tile.
      const content = `[story_reply]: ${story.media_url}\n${text}`;
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          payload: { conversationId, senderId: user.id, content },
        }),
      });
    } catch (err: any) {
      console.warn('[stories] reply failed:', err);
      alert(`Reply failed: ${err?.message || String(err)}`);
    }
  }

  async function loadMorePosts() {
    if (loadingMorePosts || !dbPostsHasMore) return;
    await fetchPosts(dbPostsPage + 1, true);
  }

  useEffect(() => {
    if (feedTab !== "following" || !user) return;
    setLoadingFollowing(true);
    async function loadFollowingFeed() {
      // Try the unified /api/db endpoint first. Falls back to a direct
      // supabase query if the API fails — same approach as the For You
      // feed so the Following tab keeps working even if the API endpoint
      // is broken (just without comments).
      let posts: any[] | null = null;
      try {
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_feed_posts',
            payload: { viewerId: user!.id, page: 0, pageSize: 20, followingOnly: true },
          }),
        });
        const json = await res.json();
        if (json.error) {
          console.error('[feed] following API error:', json.error);
        } else if (Array.isArray(json.posts)) {
          posts = json.posts;
        }
      } catch (err) {
        console.error('[feed] following network error:', err);
      }

      // Fallback: direct supabase query (no comments — just posts)
      if (posts === null) {
        console.warn('[feed] following falling back to direct supabase query');
        const { data: followData } = await supabase
          .from('follows').select('following_id').eq('follower_id', user!.id);

        if (!followData || followData.length === 0) {
          setFollowingPosts([]);
          setLoadingFollowing(false);
          return;
        }

        const followingIds = followData.map(f => f.following_id);
        const { data: fp } = await supabase
          .from('posts')
          .select('*, users(id, username, full_name, avatar_url), comments (id, content, created_at, user_id, users (id, username, full_name, avatar_url))')
          .in('user_id', followingIds)
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(20);

        posts = fp || [];
      }

      setFollowingPosts(posts);
      setLoadingFollowing(false);
    }
    loadFollowingFeed();
  }, [feedTab, user]);

  // ── Streak loader ─────────────────────────────────────────────────────
  // Computes the user's CURRENT consecutive-day activity streak (workouts
  // OR wellness logs). Runs once when the user resolves; if there's an
  // active streak (>=2 days) and they haven't logged TODAY yet, the
  // reminder card shows on the For You feed.
  //
  // We special-case "started yesterday and haven't logged today yet" — the
  // streak is still alive (today isn't over) but we want to nudge them.
  // If they last logged 2+ days ago the streak is broken; we don't show
  // a card for broken streaks because that's just sad.
  //
  // Dismissal: the user can tap × on the card. We set a localStorage flag
  // keyed by today's date; tomorrow the flag is stale and the card returns
  // (assuming streak is still alive, which it won't be if they kept ignoring).
  useEffect(() => {
    if (!user) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const dismissedKey = `streak_dismissed_${user.id}_${todayKey}`;
    if (typeof window !== "undefined" && localStorage.getItem(dismissedKey)) {
      setStreakDismissed(true);
      return;
    }

    (async () => {
      // Pull the last 30 days of activity logs — enough to compute any
      // reasonable streak without bloating the query.
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('activity_logs')
        .select('logged_at, created_at')
        .eq('user_id', user.id)
        .or('log_type.eq.workout,log_type.eq.wellness')
        .gte('logged_at', thirtyDaysAgo)
        .order('logged_at', { ascending: false });
      if (!data || data.length === 0) {
        setStreakInfo({ days: 0, loggedToday: false });
        return;
      }

      // Bucket logs by local-date string so multiple workouts on the same
      // day count as one "active day" toward the streak.
      const dayKey = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      };
      const activeDays = new Set<string>();
      data.forEach((row: any) => {
        const ts = row.logged_at || row.created_at;
        if (ts) activeDays.add(dayKey(ts));
      });

      // Walk backward from today counting consecutive days. We allow today
      // to be missing (streak alive even if they haven't logged yet today)
      // but stop at the first gap before yesterday.
      const today = new Date();
      const todayK = dayKey(today.toISOString());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayK = dayKey(yesterday.toISOString());

      const loggedToday = activeDays.has(todayK);
      // Streak base: did they log yesterday? Otherwise the streak is broken
      // unless today is the first ever log.
      if (!loggedToday && !activeDays.has(yesterdayK)) {
        setStreakInfo({ days: 0, loggedToday: false });
        return;
      }
      let count = 0;
      const cursor = new Date(today);
      // If they haven't logged today, start counting from yesterday.
      if (!loggedToday) cursor.setDate(cursor.getDate() - 1);
      while (true) {
        if (activeDays.has(dayKey(cursor.toISOString()))) {
          count++;
          cursor.setDate(cursor.getDate() - 1);
        } else break;
        // Safety bound — 30 days back is the most we ever loaded
        if (count >= 30) break;
      }
      setStreakInfo({ days: count, loggedToday });
    })();
  }, [user]);

  function dismissStreakCard() {
    if (!user) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem(`streak_dismissed_${user.id}_${todayKey}`, '1'); } catch {}
    setStreakDismissed(true);
  }

  // ── Recap prompt loader ─────────────────────────────────────────────
  // Shows a card on the For You feed pointing to last week's recap.
  //
  // We always compute and set recapWeekKey so other UI surfaces (e.g. a
  // "Last week's recap" link) can use it regardless of whether the auto-
  // prompt shows.
  //
  // Auto-show logic for the prompt card:
  //   1. Compute the Sunday of the previous week → that's our recap target
  //   2. The prompt auto-shows during the "fresh window" — Sun/Mon/Tue of
  //      the current week. After that it stops auto-showing because by
  //      Wednesday the recap is no longer "new."
  //   3. Within that window, dismissal still suppresses for the rest of
  //      the week (so we don't pester users who've already dismissed).
  //
  // ALSO, defensive cleanup: if a user has stale `recap_seen_*` flags
  // from prior weeks left over in localStorage, those would never expire
  // and could cause confusing behavior if the same week-key was reused
  // (it won't be, but cleanup is cheap and prevents bugs).
  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const thisSun = new Date(today);
    thisSun.setHours(0, 0, 0, 0);
    thisSun.setDate(thisSun.getDate() - thisSun.getDay());
    const prevSun = new Date(thisSun);
    prevSun.setDate(prevSun.getDate() - 7);
    const weekKey = `${prevSun.getFullYear()}-${String(prevSun.getMonth() + 1).padStart(2, "0")}-${String(prevSun.getDate()).padStart(2, "0")}`;

    // Always set the week key — the always-visible "Last week's recap"
    // link uses it. Disconnects the recap link from the auto-prompt logic.
    setRecapWeekKey(weekKey);

    if (typeof window === "undefined") return;

    // One-time recovery: users who dismissed during the buggy v1 recap
    // got locked out from seeing the corrected v2 recap. We do a one-time
    // wipe of all old recap_seen_* keys, gated by a version flag so it
    // only runs ONCE per user. Future dismissals work normally after this.
    const versionFlagKey = `recap_v2_migrated_${user.id}`;
    try {
      if (!localStorage.getItem(versionFlagKey)) {
        const prefix = `recap_seen_${user.id}_`;
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) {
            localStorage.removeItem(k);
          }
        }
        localStorage.setItem(versionFlagKey, "1");
      }
    } catch { /* localStorage may be unavailable in private mode */ }

    // Normal flow: show the prompt if the user hasn't dismissed THIS week's
    // recap yet. After the wipe above this is always true on first load
    // post-migration. Subsequent dismissals via × persist as before.
    const seenKey = `recap_seen_${user.id}_${weekKey}`;
    const alreadyDismissed = !!localStorage.getItem(seenKey);
    if (!alreadyDismissed) {
      setShowRecapPrompt(true);
    }
  }, [user]);

  function dismissRecapPrompt() {
    if (!user || !recapWeekKey) return;
    const seenKey = `recap_seen_${user.id}_${recapWeekKey}`;
    try { localStorage.setItem(seenKey, '1'); } catch {}
    setShowRecapPrompt(false);
  }

  async function fetchActivityLogs(page: number, append = false, filter: ActivityFilter = activityFilter) {
    if (page > 0) setLoadingMoreActivity(true);
    let query = supabase
      .from('activity_logs')
      .select('*, users:user_id(id, username, full_name, avatar_url)')
      .order('logged_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (filter !== "all") query = query.eq('log_type', filter);
    const { data } = await query;
    if (data) {
      // Filter out activity from blocked users in either direction
      let filtered = data;
      if (user) {
        const blocks = await loadBlockedUsers(user.id);
        if (blocks.size > 0) {
          filtered = data.filter((l: any) => !blocks.has(l.user_id));
        }
      }

      if (append) setActivityLogs(prev => [...prev, ...filtered]);
      else setActivityLogs(filtered);
      setActivityLogsHasMore(data.length === PAGE_SIZE);
      setActivityLogsPage(page);
      // badge loading
      if (filtered.length > 0) {
        const userIds = [...new Set(filtered.map((l: any) => l.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const { data: badgeData } = await supabase.from('badges').select('user_id, badge_id, created_at')
            .in('user_id', userIds).gte('created_at', sevenDaysAgo.toISOString()).eq('show_celebration', true);
          if (badgeData) {
            const map: Record<string, string[]> = {};
            badgeData.forEach((b: any) => { if (!map[b.user_id]) map[b.user_id] = []; map[b.user_id].push(b.badge_id); });
            if (append) setUserBadgeMap(prev => ({ ...prev, ...map }));
            else setUserBadgeMap(map);
          }
        }
      }
    }
    if (page > 0) setLoadingMoreActivity(false);
  }

  // Load activity logs for sidebar
  useEffect(() => {
    async function loadActivityFeed() {
      await fetchActivityLogs(0, false, activityFilter);
      // legacy badge load already handled inside fetchActivityLogs
      if (false) {
      const { data } = await supabase
        .from('activity_logs')
        .select('*, users:user_id(id, username, full_name, avatar_url)')
        .order('logged_at', { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        setActivityLogs(data);
        // Load RECENT badges for users in the feed (earned in last 7 days only)
        const userIds = [...new Set(data.map((l: any) => l.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const { data: badgeData } = await supabase
            .from('badges')
            .select('user_id, badge_id, created_at')
            .in('user_id', userIds)
            .gte('created_at', sevenDaysAgo.toISOString())
            .eq('show_celebration', true);
          if (badgeData) {
            const map: Record<string, string[]> = {};
            badgeData.forEach((b: any) => {
              if (!map[b.user_id]) map[b.user_id] = [];
              map[b.user_id].push(b.badge_id);
            });
            setUserBadgeMap(map);
          }
        }
      }
      } // end if (false)
    }
    loadActivityFeed();
  }, []);

  // Re-fetch activity logs when filter changes
  useEffect(() => {
    fetchActivityLogs(0, false, activityFilter);
  }, [activityFilter]);

  // Search users
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      const q = searchQuery.trim();
      const { data } = await supabase.from('users').select('id,username,full_name,avatar_url').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).limit(10);
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  // Load notifications
  useEffect(() => {
    if (!user) return;
    async function loadNotifs() {
      const res = await fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'get_notifications', payload:{ userId: user!.id }}) });
      const json = await res.json();
      setNotifications(json.notifications || []);
    }
    loadNotifs();
    const interval = setInterval(loadNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Load new members — city-first ordering
  useEffect(() => {
    async function loadNewMembers() {
      // Get current user's city for local-first sorting
      const userCity = (user as any)?.profile?.city || null;

      const { data } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url, city, followers_count, created_at')
        .neq('id', user?.id ?? '')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!data) return;

      // Sort: city matches first, then everyone else — both groups by newest
      const cityMatch = userCity
        ? data.filter((u: any) => u.city && u.city.toLowerCase().includes(userCity.toLowerCase().split(',')[0].trim()))
        : [];
      const everyone = data.filter((u: any) => !cityMatch.find((c: any) => c.id === u.id));
      setNewMembers([...cityMatch, ...everyone].slice(0, 10));
    }
    loadNewMembers();
  }, [user]);

  function updatePost(updated: Post) {
    if (dbPosts.find((p: any) => p.id === updated.id)) {
      setDbPosts(prev => prev.map((p: any) => p.id === updated.id
        ? { ...p, likes_count: updated.likes, _liked: updated.liked, comments: updated.comments.map((c: any) => ({ id: c.id, content: c.text, created_at: new Date().toISOString(), users: { full_name: c.user, username: c.user } })) }
        : p));
    } else {
      setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
    }
  }

  // After the server inserts a comment it returns the full updated list of
  // comments for that post. Replace the post's comments with that list in
  // BOTH dbPosts (For You) and followingPosts (Following) so whichever feed
  // the user is on, the comment shows up immediately.
  function refreshPostComments(postId: string | number, comments: any[]) {
    setDbPosts(prev => prev.map((p: any) =>
      p.id === postId ? { ...p, comments } : p
    ));
    setFollowingPosts(prev => prev.map((p: any) =>
      p.id === postId ? { ...p, comments } : p
    ));
  }

  async function deletePost(id: number | string) {
    // Try Supabase first for real posts
    const isDbPost = dbPosts.find((p: any) => p.id === id);
    if (isDbPost) {
      await supabase.from('posts').delete().eq('id', id);
      setDbPosts(prev => prev.filter((p: any) => p.id !== id));
    } else {
      setPosts(prev => prev.filter(p => p.id !== id));
    }
  }

  // Use real DB posts when available, fall back to mock
  // displayPosts: real DB posts only. The "empty state" message below
  // handles the no-posts-yet case. Previously this fell back to mock data,
  // which made the feed look populated with fake profiles when the user
  // actually had nothing to see — confusing and looked broken.
  const displayPosts = dbPosts.map((p: any) => ({
        id: p.id,
        user: p.users?.full_name || p.users?.username || "User",
        username: p.users?.username || "user",
        tier: (p.users?.tier as Tier) || computeTier(p.users?.logs_last_28_days || 0, 0),
        avatar: p.users?.avatar_url && p.users.avatar_url.startsWith('http') ? p.users.avatar_url : (p.users?.full_name || p.users?.username || "U").split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase(),
        time: (() => { const d = new Date(p.created_at); const diff = Date.now()-d.getTime(); if(diff<3600000) return `${Math.floor(diff/60000)}m ago`; if(diff<86400000) return `${Math.floor(diff/3600000)}h ago`; return d.toLocaleDateString(); })(),
        dateShort: `${new Date(p.created_at).getMonth()+1}.${new Date(p.created_at).getDate()}`,
        dayLabel: new Date(p.created_at).toLocaleDateString("en-US", { weekday: "long" }),
        photos: normalizePhotoUrls(p.media_urls, p.media_url, p.photo_url),
        mediaTypes: mediaTypesFor(normalizePhotoUrls(p.media_urls, p.media_url, p.photo_url), p.media_types, p.media_type),
        mediaPositions: Array.isArray(p.media_positions) ? p.media_positions : null,
        caption: p.caption || "",
        likes: p.likes_count || 0,
        liked: p._liked || false,
        comments: (p.comments || []).map((c: any) => {
          // The For You loader already maps DB comments to display shape at
          // ~line 1480 ({user, text, time}). When this outer mapper runs, those
          // comments come in already-mapped, so c.users is undefined and we'd
          // fall through to "User" + new Date(undefined) = "Invalid Date".
          // Detect already-mapped shape and pass it through unchanged.
          if (typeof c.user === 'string' && typeof c.text === 'string') {
            return { id: c.id, user_id: c.user_id, user: c.user, avatar: c.avatar || '?', text: c.text, time: c.time || '' };
          }
          return {
            id: c.id,
            user_id: c.user_id,
            user: c.users?.full_name || c.users?.username || "User",
            avatar: c.users?.avatar_url || (c.users?.full_name || c.users?.username || "U").slice(0,2).toUpperCase(),
            text: c.content || "",
            time: (() => { const d = new Date(c.created_at); const diff = Date.now()-d.getTime(); if(diff<3600000) return `${Math.floor(diff/60000)}m ago`; if(diff<86400000) return `${Math.floor(diff/3600000)}h ago`; return d.toLocaleDateString(); })(),
          };
        }),
        workout: null,
        nutrition: null,
        wellness: null,
        _ownerId: p.user_id,
        user_id: p.user_id,
      } as any));
  // NOTE: We deliberately do NOT filter to "photos only" here. An earlier
  // version had `.filter(p => p.photos.length > 0)` which made For You drop
  // every text-only or activity-only post — including the user's own posts —
  // making the feed look empty even when posts existed. Following uses no
  // such filter, which is exactly why Following showed posts but For You
  // didn't despite querying the same table. If a "Photos only" tab is
  // wanted later, add it as a separate filtered view, not a global drop.

  const activityPosts = displayPosts.filter(p => p.workout || p.nutrition || p.wellness);

  // Group activity logs by user + calendar day so multiple nutrition logs become one card
  const sidebarActivityPosts = (() => {
    const grouped = new Map<string, any>();
    activityLogs.forEach((log: any) => {
      const userId = log.user_id || 'unknown';
      const dayKey = new Date(log.logged_at || log.created_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const key = `${userId}__${dayKey}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          _userId: userId,
          user: log.users?.full_name || log.users?.username || 'User',
          username: log.users?.username || 'user',
          avatarUrl: log.users?.avatar_url || null,
          avatar: (log.users?.full_name || log.users?.username || 'U').slice(0, 2).toUpperCase(),
          time: (() => {
            const d = new Date(log.logged_at || log.created_at);
            const diff = Date.now() - d.getTime();
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
            return d.toLocaleDateString();
          })(),
          _workoutLogs: [] as any[],
          _nutritionLogs: [] as any[],
          _wellnessLogs: [] as any[],
        });
      }
      const entry = grouped.get(key);
      if (log.log_type === 'workout') entry._workoutLogs.push(log);
      if (log.log_type === 'nutrition') entry._nutritionLogs.push(log);
      if (log.log_type === 'wellness') entry._wellnessLogs.push(log);
    });

    return Array.from(grouped.values()).map((entry: any) => {
      const wl = entry._workoutLogs[0];
      const nls = entry._nutritionLogs;
      const wels = entry._wellnessLogs;

      const workout = wl ? {
        type: wl.workout_type || 'Workout',
        duration: wl.workout_duration_min ? `${wl.workout_duration_min} min` : '—',
        calories: wl.workout_calories || 0,
        exercises: Array.isArray(wl.exercises) ? wl.exercises.map((e: any) => ({ name: e.name || '', sets: parseInt(e.sets)||0, reps: parseInt(e.reps)||0, weight: e.weight || '—' })) : [],
        cardio: Array.isArray(wl.cardio) ? wl.cardio.map((c: any) => ({
          type: c.type || 'Cardio',
          duration: c.duration || '—',
          distance: c.distance || '',
        })) : [],
        notes: wl.notes,
        photoUrls: normalizePhotoUrls(wl.photo_url, wl.media_url, wl.media_urls),
      } : null;

      const nutrition = nls.length > 0 ? {
        calories: Math.round(nls.reduce((s: number, l: any) => s + (l.calories_total || 0), 0)),
        protein:  Math.round(nls.reduce((s: number, l: any) => s + (l.protein_g || 0), 0)),
        carbs:    Math.round(nls.reduce((s: number, l: any) => s + (l.carbs_g || 0), 0)),
        fat:      Math.round(nls.reduce((s: number, l: any) => s + (l.fat_g || 0), 0)),
        sugar: 0,
        meals: nls.map((l: any) => ({
          key: l.meal_type || 'Meal',
          emoji: '🍽️',
          name: Array.isArray(l.food_items) && l.food_items.length > 0 ? l.food_items.map((f: any) => f.name).join(', ') : (l.notes || 'Logged meal'),
          cal: l.calories_total || 0,
        })),
        photoUrls: normalizePhotoUrls(...nls.flatMap((l: any) => [l.photo_url, l.media_url, l.media_urls])),
      } : null;

      const wellness = wels.length > 0 ? {
        // duration / loggedAt enable the modern card aesthetic (duration pill +
        // time stamp pill) on mobile and desktop. Falls back to undefined if
        // a row was logged before those fields existed.
        entries: wels.map((l: any) => ({
          activity: l.wellness_type || 'Wellness',
          emoji: '🌿',
          notes: l.notes || '',
          duration: typeof l.wellness_duration_min === 'number' ? l.wellness_duration_min : undefined,
          loggedAt: l.logged_at || l.created_at || undefined,
        })),
        photoUrls: normalizePhotoUrls(...wels.flatMap((l: any) => [l.photo_url, l.media_url, l.media_urls])),
      } : null;

      return { ...entry, workout, nutrition, wellness };
    });
  })();

  // On mobile: interleave posts + activity blocks so both are visible
  // On desktop: keep two-column layout
  const mobileActivityItems = sidebarActivityPosts.length > 0 ? sidebarActivityPosts : activityPosts;
  const mobileItems: Array<{ type: "post"; data: Post } | { type: "activity"; data: Post } | { type: "suggested"; data: typeof SUGGESTED_USERS[0] }> = [];
  const maxLen = Math.max(displayPosts.length, mobileActivityItems.length);
  for (let i = 0; i < maxLen; i++) {
    if (displayPosts[i]) mobileItems.push({ type: "post", data: displayPosts[i] as Post });
    if (mobileActivityItems[i]) mobileItems.push({ type: "activity", data: mobileActivityItems[i] as Post });
  }
  SUGGESTED_USERS.forEach(u => mobileItems.push({ type: "suggested", data: u }));

  return (
    <div style={{ background:C.bg, minHeight:"100vh", paddingBottom:80 }}>
      <style jsx global>{`
        .feed-layout { display:flex; max-width:1200px; margin:0 auto; padding:0 24px; gap:48px; align-items:flex-start; }
        .feed-sidebar { width:340px; flex-shrink:0; padding-top:20px; padding-bottom:20px; }
        .feed-main { flex:1; min-width:0; padding-top:20px; }
        .feed-mobile-only { display:none; }
        .feed-desktop-only { display:block; }
        @media (max-width: 767px) {
          .feed-layout { flex-direction:column; padding:0 12px; gap:0; }
          .feed-sidebar { display:none !important; }
          .feed-main { width:100%; padding-top:12px; }
          .feed-mobile-only { display:block; }
          .feed-desktop-only { display:none; }
          .feed-header-inner { padding:12px 16px !important; }
        }
      `}</style>

      {/* ── Sticky Header ── */}
      <div style={{ position:"sticky",top:0,zIndex:100,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(14px)",borderBottom:`1px solid #2D1F52` }}>
        <div className="feed-header-inner" style={{ padding:"14px 20px 12px",display:"flex",alignItems:"center",gap:14 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
            <span style={{ fontSize:20 }}>⚡</span>
            <span style={{ fontWeight:900,fontSize:22,color:C.blue,letterSpacing:3 }}>FIT</span>
          </div>
          {/* Search bar — sits right next to the FIT logo. Fixed width so it
              doesn't stretch out wide and feel disconnected from the logo. */}
          <div style={{ width:320,maxWidth:"100%",position:"relative",flex:"1 1 auto",minWidth:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,background:"#1A1228",borderRadius:24,padding:"7px 14px",border:`1.5px solid ${searchQuery?C.blue:"#2D1F52"}` }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{width:15,height:15,flexShrink:0}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search people..." style={{background:"none",border:"none",outline:"none",fontSize:13,color:C.text,flex:1,minWidth:0}}/>
              {searchQuery && <button onClick={()=>{setSearchQuery("");setSearchResults([]);}} style={{background:"none",border:"none",cursor:"pointer",color:C.sub,fontSize:16,padding:0,lineHeight:1}}>×</button>}
            </div>
            {searchQuery.trim() && (
              <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#111118",borderRadius:16,border:"1.5px solid #2D1F52",boxShadow:"0 8px 24px rgba(0,0,0,0.4)",zIndex:200,overflow:"hidden",maxHeight:280,overflowY:"auto"}}>
                {searchLoading ? <div style={{padding:"14px",textAlign:"center",color:C.sub,fontSize:13}}>Searching...</div>
                : searchResults.length===0 ? <div style={{padding:"14px",textAlign:"center",color:C.sub,fontSize:13}}>No results</div>
                : searchResults.map(u=>(
                  <div key={u.id} onClick={()=>{setSearchQuery("");setSearchResults([]);window.location.href=`/profile/${u.username}`;}}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #2D1F52"}}
                    onMouseEnter={e=>(e.currentTarget.style.background="#2D1F52")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#fff",flexShrink:0,overflow:"hidden"}}>
                      {u.avatar_url?<img src={ImagePresets.avatarSm(u.avatar_url)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:(u.full_name||u.username||"?")[0].toUpperCase()}
                    </div>
                    <div><div style={{fontWeight:700,fontSize:13,color:C.text}}>{u.full_name}</div><div style={{fontSize:11,color:C.sub}}>@{u.username}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* ── Bell button — prominent, far right of header ──
              Replaces the small inline 🔔 in the tab row. Tapping switches the
              feed tab to "notifications" so the existing in-page notif list
              shows up. Marks unread on click. */}
          <button
            onClick={async () => {
              setFeedTab("notifications");
              if (user) {
                await fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'mark_notifications_read', payload:{ userId: user.id }}) });
                setNotifications(p => p.map(n => ({...n, read: true})));
              }
            }}
            aria-label="Notifications"
            style={{
              position:"relative", flexShrink:0,
              width:42, height:42, borderRadius:14,
              background: feedTab === "notifications" ? "#7C3AED" : "rgba(124,58,237,0.12)",
              border: feedTab === "notifications" ? "1.5px solid #A78BFA" : "1.5px solid rgba(124,58,237,0.35)",
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", padding:0,
              transition:"all 0.15s",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={feedTab === "notifications" ? "#fff" : "#A78BFA"}
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && feedTab !== "notifications" && (
              <span style={{
                position:"absolute", top:-3, right:-3,
                minWidth:18, height:18, borderRadius:9,
                background:"#FF6B6B",
                fontSize:10, fontWeight:900, color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center",
                padding:"0 4px",
                border:"2px solid #0D0D0D",
                lineHeight:1,
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
        {/* Feed tabs — bell removed from here; see prominent bell above */}
        <div style={{ display:"flex",gap:4,padding:"0 20px 10px" }}>
          {[
            { key: "foryou", label: "For You" },
            { key: "following", label: "Following" },
          ].map(t => (
            <button key={t.key} onClick={() => setFeedTab(t.key as any)} style={{
              padding:"8px 20px",borderRadius:99,border:"none",cursor:"pointer",
              fontWeight:800,fontSize:13,
              background:feedTab===t.key?"#7C3AED":"transparent",
              color:feedTab===t.key?"#fff":"#6B7280",
              transition:"all 0.15s",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Story Viewer overlay ── */}
      {viewingStory && (
        <StoryViewer
          story={viewingStory}
          onClose={() => setViewingStory(null)}
          onDelete={handleDeleteStory}
          onReply={handleStoryReply}
        />
      )}

      {/* Hidden file input — clicked programmatically when "+" is tapped */}
      <input
        ref={storyFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePostStory}
      />

      {/* ── Stories Row (visible on all views) ── */}
      <div style={{ padding:"12px 0 0", borderBottom:"1px solid #2D1F52", overflowX:"auto" }}>
        <div style={{ display:"flex", gap:16, padding:"4px 24px 14px", minWidth:"max-content" }}>
          {/* "Your story" tile — always first. Tap to upload (or view if posted). */}
          {(() => {
            const myStory = stories.find(s => s.is_you);
            const tier: Tier = "default";
            return (
              <button
                key="my-story"
                onClick={() => {
                  if (myStory) setViewingStory(myStory);
                  else storyFileInputRef.current?.click();
                }}
                disabled={postingStory}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", flexShrink:0, padding:0, opacity: postingStory ? 0.5 : 1 }}
              >
                <TierFrame tier={tier} size={60}>
                  {myStory ? (
                    <div style={{ width:"100%",height:"100%",position:"relative" }}>
                      <img src={ImagePresets.thumb(myStory.media_url)} loading="lazy" decoding="async" alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                    </div>
                  ) : (
                    <div style={{ width:"100%", height:"100%", background:`linear-gradient(135deg, ${C.blue}, #4ADE80)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:900, color:"#fff" }}>
                      {postingStory ? "…" : "＋"}
                    </div>
                  )}
                </TierFrame>
                <span style={{ fontSize:11, fontWeight:600, color: C.text, maxWidth:60, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {myStory ? "Your story" : "Add story"}
                </span>
              </button>
            );
          })()}

          {/* Other users' stories */}
          {stories.filter(s => !s.is_you).map(story => {
            const tier: Tier = "default";
            return (
              <button
                key={story.id}
                onClick={() => setViewingStory(story)}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", flexShrink:0, padding:0 }}
              >
                <TierFrame tier={tier} size={60}>
                  <div style={{ width:"100%",height:"100%",position:"relative",overflow:"hidden" }}>
                    <img src={ImagePresets.thumb(story.media_url)} loading="lazy" decoding="async" alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                  </div>
                </TierFrame>
                <span style={{ fontSize:11, fontWeight:600, color: C.text, maxWidth:60, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {story.username}
                </span>
              </button>
            );
          })}

          {/* Empty state — only show if NO stories AND user hasn't posted */}
          {stories.length === 0 && (
            <span style={{ alignSelf:"center", fontSize:12, color:C.sub, padding:"0 12px" }}>
              No stories yet · be the first to post one
            </span>
          )}
        </div>
      </div>

      {/* ── Desktop: two-column layout ── */}
      <div className="feed-layout">

        {/* LEFT: Social feed (desktop only) */}
        <div className="feed-main feed-desktop-only">
          <div style={{ height:1,background:"#2D1F52",marginBottom:20 }}/>
          {feedTab === "notifications" ? (
            <div style={{ padding:"16px 20px", maxWidth:600 }}>
              <div style={{ fontWeight:900, fontSize:18, color:C.text, marginBottom:16 }}>🔔 Notifications</div>
              {notifications.length === 0 ? (
                <div style={{ textAlign:"center", padding:"48px 20px", color:C.sub }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>🔔</div>
                  <div style={{ fontWeight:700, fontSize:15 }}>No notifications yet</div>
                  <div style={{ fontSize:13, marginTop:6 }}>Likes, comments and follows will show up here</div>
                </div>
              ) : notifications.map(n => (
                <div key={n.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", background: n.read ? "#1A1A1A" : "#1A2A1A", borderRadius:16, marginBottom:10, border:`1px solid ${n.read ? "#2A2A2A" : "#2A3A2A"}` }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#7C3AED,#4ADE80)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden" }}>
                    {n.from_user?.avatar_url ? <img src={ImagePresets.avatarSm(n.from_user.avatar_url)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/> : (n.from_user?.full_name||"?")[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, color:C.text, lineHeight:1.4 }}>{n.body}</div>
                    <div style={{ fontSize:11, color:C.sub, marginTop:3 }}>{n.type==="like"?"❤️":n.type==="comment"?"💬":n.type==="message"?"✉️":"🔔"} {new Date(n.created_at).toLocaleDateString()}</div>
                  </div>
                  {!n.read && <div style={{width:8,height:8,borderRadius:"50%",background:"#7C3AED",flexShrink:0}}/>}
                </div>
              ))}
            </div>
          ) : feedTab === "following" ? (
            loadingFollowing ? (
              <div style={{ textAlign:"center",padding:"48px 20px",color:"#9CA3AF" }}>
                <div style={{ width:32,height:32,borderRadius:"50%",border:"4px solid #2D1F52",borderTopColor:"#7C3AED",animation:"spin 0.8s linear infinite",margin:"0 auto 12px" }}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <p style={{ fontWeight:600 }}>Loading following feed…</p>
              </div>
            ) : followingPosts.length === 0 ? (
              <div style={{ textAlign:"center",padding:"64px 20px",color:"#9CA3AF" }}>
                <div style={{ fontSize:56,marginBottom:12 }}>👥</div>
                <p style={{ fontWeight:800,fontSize:16,color:"#374151",marginBottom:6 }}>Nothing here yet</p>
                <p style={{ fontSize:14 }}>Follow some people to see their posts here!</p>
              </div>
            ) : (
              followingPosts.map((p: any) => {
                const mockPost = {
                  id: p.id,
                  user: p.users?.full_name || p.users?.username || "User",
                  username: p.users?.username || "user",
                  avatar: p.users?.avatar_url && p.users.avatar_url.startsWith('http') ? p.users.avatar_url : (p.users?.full_name || p.users?.username || "U").split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase(),
                  time: (() => { const d = new Date(p.created_at); const diff = Date.now()-d.getTime(); if(diff<3600000) return `${Math.floor(diff/60000)}m ago`; if(diff<86400000) return `${Math.floor(diff/3600000)}h ago`; return d.toLocaleDateString(); })(),
                  dateShort: new Date(p.created_at).toLocaleDateString('en-US',{month:'numeric',day:'numeric'}),
                  dayLabel: new Date(p.created_at).toLocaleDateString('en-US',{weekday:'long'}),
                  photos: normalizePhotoUrls(p.media_urls, p.media_url, p.photo_url),
                  mediaTypes: mediaTypesFor(normalizePhotoUrls(p.media_urls, p.media_url, p.photo_url), p.media_types, p.media_type),
        mediaPositions: Array.isArray(p.media_positions) ? p.media_positions : null,
                  caption: p.caption || "",
                  likes: p.likes_count || 0,
                  liked: p._liked || false,
                  // Map comments same shape PostCard expects (matching the
                  // For You feed mapping). Already-mapped shapes pass through
                  // — see displayPosts mapper for context.
                  comments: (p.comments || []).map((c: any) => {
                    if (typeof c.user === 'string' && typeof c.text === 'string') {
                      return { id: c.id, user_id: c.user_id, user: c.user, avatar: c.avatar || '?', text: c.text, time: c.time || '' };
                    }
                    return {
                      id: c.id,
                      user_id: c.user_id,
                      user: c.users?.full_name || c.users?.username || "User",
                      avatar: c.users?.avatar_url || (c.users?.full_name || c.users?.username || "U").slice(0,2).toUpperCase(),
                      text: c.content || "",
                      time: (() => { const d = new Date(c.created_at); const diff = Date.now()-d.getTime(); if(diff<3600000) return `${Math.floor(diff/60000)}m ago`; if(diff<86400000) return `${Math.floor(diff/3600000)}h ago`; return d.toLocaleDateString(); })(),
                    };
                  }),
                  workout: null,
                  nutrition: null,
                  wellness: null,
                  _ownerId: p.user_id,
                  user_id: p.user_id,
                };
                return <PostCard key={p.id} post={mockPost} onUpdate={() => {}} currentUser={user} onDelete={() => deletePost(p.id)} onCommentsRefresh={refreshPostComments} />;
              })
            )
          ) : (
            <>
              {loadingFeed ? (
                <div style={{ textAlign:"center",padding:"48px 20px",color:"#9CA3AF" }}>
                  <div style={{ width:32,height:32,borderRadius:"50%",border:"4px solid #2D1F52",borderTopColor:"#7C3AED",animation:"spin 0.8s linear infinite",margin:"0 auto 12px" }}/>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <p style={{ fontWeight:600 }}>Loading feed…</p>
                </div>
              ) : (
                <>
                  {/* Recap prompt — once-per-week link to last week's recap.
                      Goes ABOVE streak card since it's a richer "look what
                      you did" moment vs the streak's nudge. */}
                  {feedTab === "foryou" && showRecapPrompt && recapWeekKey && (
                    <RecapPromptCard weekKey={recapWeekKey} onDismiss={dismissRecapPrompt} />
                  )}
                  {/* Streak reminder card — only on For You feed, only when
                      an active streak exists and the user hasn't logged today.
                      Tapping "Log now" goes to /post. */}
                  {feedTab === "foryou" && streakInfo && streakInfo.days >= 2 && !streakInfo.loggedToday && !streakDismissed && (
                    <StreakCard days={streakInfo.days} onDismiss={dismissStreakCard} onLog={() => router.push('/post')} />
                  )}
                  {/* Empty state only when there's truly nothing — no feed
                      posts AND no activity. Previously this said "no posts"
                      even when the user had logged plenty of activity. */}
                  {displayPosts.length === 0 && (
                    <div style={{ background:"#1A1228",border:"1.5px solid #2D1F52",borderRadius:14,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#7C3AED",fontWeight:600 }}>
                      👋 No posts yet. Share something to the feed to see it here!
                    </div>
                  )}
                  {/* Desktop For You: ONLY feed posts (Share to Feed) in the
                      main column. Activity logs (workouts/nutrition/wellness)
                      live in the right-side Activity Feed sidebar — they do
                      NOT appear here. This matches Instagram-style behavior
                      where the main column is photo posts. Mobile interleaves
                      because there's no sidebar on small screens. */}
                  {displayPosts.map((post: any) => (
                    <PostCard
                      key={`post-${post.id}`}
                      post={post}
                      onUpdate={updatePost}
                      currentUser={user}
                      onDelete={() => deletePost(post.id)}
                      onReport={() => setReportTarget({ type: "post", id: post.id as string })}
                      onCommentsRefresh={refreshPostComments}
                    />
                  ))}
                  {/* Load More posts */}
                  {dbPostsHasMore && dbPosts.length > 0 && (
                    <div style={{ textAlign:"center", marginBottom:24 }}>
                      <button
                        onClick={loadMorePosts}
                        disabled={loadingMorePosts}
                        style={{ padding:"12px 32px", borderRadius:99, background:"#7C3AED", color:"#fff", border:"none", cursor:loadingMorePosts?"default":"pointer", fontWeight:800, fontSize:14, opacity:loadingMorePosts?0.6:1, transition:"opacity 0.15s" }}
                      >
                        {loadingMorePosts ? "Loading…" : "Load More Posts"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* RIGHT: Activity sidebar (desktop only) */}
        <div className="feed-sidebar feed-desktop-only" style={{ background:C.dark, borderRadius:24, padding:"20px 0" }}>
          <div style={{ padding:"0 16px 12px", borderBottom:`1px solid ${C.darkBorder}`, marginBottom:8 }}>
            <div style={{ fontWeight:900,fontSize:16,color:"#E2E8F0",marginBottom:2 }}>Activity Feed</div>
            <div style={{ fontSize:12,color:C.darkSub }}>Workouts, nutrition & wellness</div>
          </div>
          <ActivityFilterChips value={activityFilter} onChange={f => setActivityFilter(f)} />
          <div style={{ padding:"0 12px" }}>
            {sidebarActivityPosts.length > 0
              ? sidebarActivityPosts.map((post: any) => (
                  <SideUserBlock key={post.id} post={post} userBadges={userBadgeMap[post._userId] || []} />
                ))
              : activityPosts.map(post => (
                  <SideUserBlock key={post.id} post={post} userBadges={[]} />
                ))
            }
            {/* Load More activity */}
            {activityLogsHasMore && activityLogs.length > 0 && (
              <div style={{ textAlign:"center", marginBottom:16 }}>
                <button
                  onClick={() => fetchActivityLogs(activityLogsPage + 1, true, activityFilter)}
                  disabled={loadingMoreActivity}
                  style={{ padding:"9px 24px", borderRadius:99, background:"rgba(124,58,237,0.15)", color:"#7C3AED", border:"1px solid rgba(124,58,237,0.3)", cursor:loadingMoreActivity?"default":"pointer", fontWeight:700, fontSize:12, opacity:loadingMoreActivity?0.6:1 }}
                >
                  {loadingMoreActivity ? "Loading…" : "Load More ↓"}
                </button>
              </div>
            )}
            <div style={{ marginTop:8,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${C.darkBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div>
                <div style={{ fontWeight:900,fontSize:15,color:"#E2E8F0",marginBottom:2 }}>Suggested For You</div>
                <div style={{ fontSize:11,color:C.darkSub }}>People you might like</div>
              </div>
              <button style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:C.blue,padding:0 }}>See all</button>
            </div>
            {SUGGESTED_USERS.map(u => (
              <div key={u.id} style={{ background:C.darkCard,borderRadius:18,border:`1px solid ${C.darkBorder}`,overflow:"hidden",marginBottom:16 }}>
                <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px 12px",borderBottom:`1px solid ${C.darkBorder}` }}>
                  <div style={{ width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#4ADE80)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0 }}>{u.avatar}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:800,fontSize:14,color:"#E2E8F0" }}>{u.user}</div>
                    <div style={{ fontSize:11,color:C.darkSub }}>@{u.username}</div>
                    <div style={{ fontSize:10,color:"#7C3AED",marginTop:1,fontWeight:600 }}>{u.specialty}</div>
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0 }}>
                    <div style={{ fontSize:13,fontWeight:900,color:"#E2E8F0" }}>{u.followers}</div>
                    <div style={{ fontSize:10,color:C.darkSub }}>followers</div>
                  </div>
                </div>
                <div style={{ padding:"10px 16px",borderBottom:`1px solid ${C.darkBorder}`,display:"flex",justifyContent:"center" }}>
                  <FollowButton targetUserId={String(u.id)} size="sm" />
                </div>
                <div style={{ padding:"12px 14px 4px" }}>
                  {u.workout && <SideWorkout workout={u.workout} />}
                  {u.nutrition && <SideNutrition nutrition={u.nutrition} />}
                  {u.wellness && <SideWellness wellness={u.wellness} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile: interleaved single-column feed ──
          Pull-to-refresh: native iOS gesture. We listen on touch events instead
          of pointer events because PTR specifically wants to consume vertical
          scroll at the top of the page — pointer events would fight the
          carousel swipe handlers in the PostCards below. The detection is
          gated on `window.scrollY === 0` so mid-feed pulls don't trigger. */}
      <div
        className="feed-mobile-only"
        style={{ padding:"0 12px", touchAction:"pan-y" }}
        onTouchStart={(e) => {
          if (window.scrollY > 0) return;
          ptrStartYRef.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          if (ptrStartYRef.current == null || ptrRefreshing) return;
          const dy = e.touches[0].clientY - ptrStartYRef.current;
          if (dy <= 0) { setPtrPullPx(0); return; }
          // Damping curve — pull feels resistive past ~50px so it doesn't
          // shoot down the page.
          const damped = Math.min(80, dy * 0.55);
          setPtrPullPx(damped);
        }}
        onTouchEnd={async () => {
          const pull = ptrPullPx;
          ptrStartYRef.current = null;
          setPtrPullPx(0);
          if (pull < 65 || ptrRefreshing) return;
          // Commit the refresh. Refresh state is shown until fetchPosts resolves.
          setPtrRefreshing(true);
          try {
            await fetchPosts(0, false);
            // Also reload activity logs so the feed actually feels fresh end-to-end
            try { await fetchActivityLogs(0, false, activityFilter); } catch {}
          } finally {
            setPtrRefreshing(false);
          }
        }}
      >
        {/* PTR indicator — only renders during pull or refresh. The transform
            on the feed content below pushes it down to expose this. */}
        {(ptrPullPx > 0 || ptrRefreshing) && (
          <div style={{
            position:"absolute", top:0, left:0, right:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            height: ptrRefreshing ? 60 : ptrPullPx,
            color: "#A78BFA", fontSize: 13, fontWeight: 700,
            transition: ptrRefreshing ? "height 0.18s" : undefined,
            pointerEvents:"none",
          }}>
            {ptrRefreshing
              ? <div style={{ width:22, height:22, borderRadius:"50%", border:"3px solid #2D1F52", borderTopColor:"#7C3AED", animation:"spin 0.8s linear infinite" }}/>
              : (ptrPullPx >= 65 ? "↑ Release to refresh" : "↓ Pull to refresh")}
          </div>
        )}
        <div style={{
          transform: `translateY(${ptrRefreshing ? 60 : ptrPullPx}px)`,
          transition: ptrPullPx === 0 ? "transform 0.2s ease-out" : undefined,
        }}>
        <div style={{ height:1,background:"#2D1F52",margin:"12px 0 16px" }}/>
        {feedTab === "notifications" ? (
          <div style={{ padding:"16px 4px", maxWidth:600 }}>
            <div style={{ fontWeight:900, fontSize:18, color:C.text, marginBottom:16 }}>🔔 Notifications</div>
            {notifications.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 20px", color:C.sub }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🔔</div>
                <div style={{ fontWeight:700, fontSize:15 }}>No notifications yet</div>
                <div style={{ fontSize:13, marginTop:6 }}>Likes, comments and follows will show up here</div>
              </div>
            ) : notifications.map(n => (
              <div key={n.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", background: n.read ? "#1A1A1A" : "#1A2A1A", borderRadius:16, marginBottom:10, border:`1px solid ${n.read ? "#2A2A2A" : "#2A3A2A"}` }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#7C3AED,#4ADE80)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden" }}>
                  {n.from_user?.avatar_url ? <img src={ImagePresets.avatarSm(n.from_user.avatar_url)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/> : (n.from_user?.full_name||"?")[0]?.toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, color:C.text, lineHeight:1.4 }}>{n.body}</div>
                  <div style={{ fontSize:11, color:C.sub, marginTop:3 }}>{n.type==="like"?"❤️":n.type==="comment"?"💬":n.type==="message"?"✉️":"🔔"} {new Date(n.created_at).toLocaleDateString()}</div>
                </div>
                {!n.read && <div style={{width:8,height:8,borderRadius:"50%",background:"#7C3AED",flexShrink:0}}/>}
              </div>
            ))}
          </div>
        ) : feedTab === "following" ? (
          loadingFollowing ? (
            <div style={{ textAlign:"center",padding:"48px 20px",color:"#9CA3AF" }}>
              <div style={{ width:32,height:32,borderRadius:"50%",border:"4px solid #2D1F52",borderTopColor:"#7C3AED",animation:"spin 0.8s linear infinite",margin:"0 auto 12px" }}/>
              <p style={{ fontWeight:600 }}>Loading following feed…</p>
            </div>
          ) : followingPosts.length === 0 ? (
            <div style={{ textAlign:"center",padding:"64px 20px",color:"#9CA3AF" }}>
              <div style={{ fontSize:56,marginBottom:12 }}>👥</div>
              <p style={{ fontWeight:800,fontSize:16,color:"#374151",marginBottom:6 }}>Nothing here yet</p>
              <p style={{ fontSize:14 }}>Follow some people to see their posts here!</p>
            </div>
          ) : (
            followingPosts.map((p: any) => {
              const mockPost = {
                id: p.id,
                user: p.users?.full_name || p.users?.username || "User",
                username: p.users?.username || "user",
                avatar: p.users?.avatar_url && p.users.avatar_url.startsWith('http') ? p.users.avatar_url : (p.users?.full_name || p.users?.username || "U").split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase(),
                time: (() => { const d = new Date(p.created_at); const diff = Date.now()-d.getTime(); if(diff<3600000) return `${Math.floor(diff/60000)}m ago`; if(diff<86400000) return `${Math.floor(diff/3600000)}h ago`; return d.toLocaleDateString(); })(),
                dateShort: new Date(p.created_at).toLocaleDateString('en-US',{month:'numeric',day:'numeric'}),
                dayLabel: new Date(p.created_at).toLocaleDateString('en-US',{weekday:'long'}),
                photos: normalizePhotoUrls(p.media_urls, p.media_url, p.photo_url),
                mediaTypes: mediaTypesFor(normalizePhotoUrls(p.media_urls, p.media_url, p.photo_url), p.media_types, p.media_type),
        mediaPositions: Array.isArray(p.media_positions) ? p.media_positions : null,
                caption: p.caption || "",
                likes: p.likes_count || 0,
                liked: p._liked || false,
                comments: (p.comments || []).map((c: any) => {
                  if (typeof c.user === 'string' && typeof c.text === 'string') {
                    return { id: c.id, user_id: c.user_id, user: c.user, avatar: c.avatar || '?', text: c.text, time: c.time || '' };
                  }
                  return {
                    id: c.id,
                    user_id: c.user_id,
                    user: c.users?.full_name || c.users?.username || "User",
                    avatar: c.users?.avatar_url || (c.users?.full_name || c.users?.username || "U").slice(0,2).toUpperCase(),
                    text: c.content || "",
                    time: (() => { const d = new Date(c.created_at); const diff = Date.now()-d.getTime(); if(diff<3600000) return `${Math.floor(diff/60000)}m ago`; if(diff<86400000) return `${Math.floor(diff/3600000)}h ago`; return d.toLocaleDateString(); })(),
                  };
                }),
                workout: null,
                nutrition: null,
                wellness: null,
                _ownerId: p.user_id,
                user_id: p.user_id,
              };
              return <PostCard key={p.id} post={mockPost} onUpdate={() => {}} currentUser={user} onDelete={() => deletePost(p.id)} onCommentsRefresh={refreshPostComments} />;
            })
          )
        ) : (
        <>
        {/* Recap prompt — shows once per week, points to last week's recap.
            Lives above the streak card because it's a richer, more rewarding
            CTA (here's what you DID) versus the streak nudge (don't break it). */}
        {feedTab === "foryou" && showRecapPrompt && recapWeekKey && (
          <RecapPromptCard weekKey={recapWeekKey} onDismiss={dismissRecapPrompt} />
        )}
        {/* Streak reminder card — only on For You feed when an active streak
            exists AND the user hasn't logged today AND they haven't dismissed
            it. Dismissed state lives in localStorage for the current day so
            it doesn't keep re-appearing every load. */}
        {feedTab === "foryou" && streakInfo && streakInfo.days >= 2 && !streakInfo.loggedToday && !streakDismissed && (
          <StreakCard days={streakInfo.days} onDismiss={dismissStreakCard} onLog={() => router.push('/post')} />
        )}
        {mobileItems.length === 0 && !loadingFeed && (
          <div style={{ background:"#1A1228",border:"1.5px solid #2D1F52",borderRadius:14,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#7C3AED",fontWeight:600 }}>
            👋 No posts yet. Log a workout or share to feed to see content here!
          </div>
        )}
        {mobileItems.map((item, idx) => {
          if (item.type === "post") {
            return <PostCard key={`post-${item.data.id}`} post={item.data} onUpdate={updatePost} currentUser={user} onDelete={() => deletePost(item.data.id)} onReport={() => setReportTarget({ type: "post", id: item.data.id as string })} onCommentsRefresh={refreshPostComments} />;
          }
          if (item.type === "activity") {
            return (
              <div key={`activity-${item.data.id}-${idx}`} style={{ marginBottom:16 }}>
                <div style={{ background:C.dark,borderRadius:20,overflow:"hidden" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 14px 10px",borderBottom:`1px solid ${C.darkBorder}` }}>
                    <div style={{ width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#15803D)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",flexShrink:0 }}>{item.data.avatar}</div>
                    <div>
                      <div style={{ fontWeight:800,fontSize:13,color:"#E2E8F0" }}>{item.data.user}</div>
                      <div style={{ fontSize:11,color:C.darkSub }}>@{item.data.username} · {item.data.time}</div>
                    </div>
                  </div>
                  <div style={{ padding:"10px 12px 4px" }}>
                    {item.data.workout && <SideWorkout workout={item.data.workout} />}
                    {item.data.nutrition && <SideNutrition nutrition={item.data.nutrition} />}
                    {item.data.wellness && <SideWellness wellness={item.data.wellness} />}
                  </div>
                  <ActivityComments cardId={item.data.id as string} cardOwnerId={(item.data as any)._userId as string} />
                </div>
              </div>
            );
          }
          if (item.type === "suggested") {
            const u = item.data;
            return (
              <div key={`sug-${u.id}`} style={{ background:C.dark,borderRadius:20,overflow:"hidden",marginBottom:16 }}>
                <div style={{ padding:"10px 14px",borderBottom:`1px solid ${C.darkBorder}` }}>
                  <span style={{ fontSize:11,fontWeight:800,color:C.darkSub,letterSpacing:1,textTransform:"uppercase" }}>Suggested</span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderBottom:`1px solid ${C.darkBorder}` }}>
                  <div style={{ width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#4ADE80)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0 }}>{u.avatar}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:800,fontSize:14,color:"#E2E8F0" }}>{u.user}</div>
                    <div style={{ fontSize:11,color:C.darkSub }}>@{u.username} · {u.specialty}</div>
                  </div>
                  <FollowButton targetUserId={String(u.id)} size="sm" />
                </div>
                <div style={{ padding:"10px 12px 4px" }}>
                  {u.workout && <SideWorkout workout={u.workout} />}
                  {u.nutrition && <SideNutrition nutrition={u.nutrition} />}
                  {u.wellness && <SideWellness wellness={u.wellness} />}
                </div>
              </div>
            );
          }
          return null;
        })}
        </>
        )}
        </div>{/* close PTR transform wrapper */}
      </div>

      {/* ReportModal — activated when ⋯ → Report is clicked on a post */}
      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}

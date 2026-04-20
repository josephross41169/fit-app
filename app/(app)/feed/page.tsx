"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import FollowButton from "@/components/FollowButton";
import ActivityComments from "@/components/ActivityComments";
import { TierFrame, TierBadgeChip, TierTitle } from "@/components/TierFrame";
import { computeTier, TIER_COLORS } from "@/lib/tiers";
import type { Tier } from "@/lib/tiers";

const C = {
  blue:"#7C3AED", greenLight:"#F3F0FF", greenMid:"#DDD6FE",
  gold:"#F5A623", goldLight:"#FFFBEE",
  text:"#F0F0F0", sub:"#9CA3AF", white:"#1A1A1A", bg:"#0D0D0D",
  green:"#7C3AED",
  // Dark sidebar palette
  dark:"#0D0D0D", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
  caption: string;
  likes: number;
  liked: boolean;
  comments: Comment[];
  workout: { type: string; duration: string; calories: number; exercises: Exercise[]; cardio: {type:string;duration:string;distance:string}[]; } | null;
  nutrition: { calories: number; protein: number; carbs: number; fat: number; sugar: number; meals: Meal[]; } | null;
  wellness: { entries: { emoji: string; activity: string; notes: string; }[]; } | null;
};

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
function StoryViewer({ story, onClose }: { story: typeof INITIAL_STORIES[0] & { photo: string | null }; onClose: () => void }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.95)",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <button onClick={onClose} style={{ position:"absolute",top:20,right:24,background:"none",border:"none",color:"#fff",fontSize:32,cursor:"pointer" }}>×</button>
      <div style={{ width:"100%",maxWidth:400,aspectRatio:"9/16",borderRadius:20,overflow:"hidden",position:"relative",background:"#1A1A2E" }}>
        {story.photo
          ? <img src={story.photo} style={{ width:"100%",height:"100%",objectFit:"cover" }} alt="" />
          : <div style={{ width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(135deg,${C.blue},#4ADE80)` }}>
              <div style={{ fontSize:80,fontWeight:900,color:"#fff" }}>{story.username[0].toUpperCase()}</div>
            </div>}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"24px 20px 32px",background:"linear-gradient(transparent,rgba(0,0,0,0.7))" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff" }}>{story.username[0].toUpperCase()}</div>
            <div>
              <div style={{ color:"#fff",fontWeight:700,fontSize:14 }}>{story.username}</div>
              <div style={{ color:"rgba(255,255,255,0.7)",fontSize:12 }}>Just now</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DARK SIDEBAR: Workout Card ────────────────────────────────────────────────
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
      {/* Always-visible top-3 strip */}
      {!open && exercises.length > 0 && (
        <div style={{ background:"#1E2235", padding:"8px 14px", fontSize:11, color:C.darkSub, borderBottom:`1px solid ${C.darkBorder}` }}>
          {exercises.slice(0,3).map(e=>e.name).filter(Boolean).join(' · ')}{exercises.length > 3 ? ` +${exercises.length-3}` : ''}
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
      {open && (
        <div style={{ background:"#1E2235",padding:"10px 14px",display:"flex",flexDirection:"column",gap:7 }}>
          {wellness.entries.map((e,i) => (
            <div key={i} style={{ background:"#252A3D",borderRadius:10,padding:"10px 13px",display:"flex",alignItems:"center",gap:10,border:"1px solid #2A2D3E" }}>
              <div style={{ width:34,height:34,borderRadius:9,background:"#1E2235",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{e.emoji}</div>
              <div>
                <div style={{ fontWeight:800,fontSize:12,color:"#E2E8F0" }}>{e.activity}</div>
                {e.notes && <div style={{ fontSize:11,color:C.darkSub,marginTop:1 }}>{e.notes}</div>}
              </div>
            </div>
          ))}
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
function PostCard({ post, onUpdate, onDelete, currentUser }: { post: Post; onUpdate: (p: Post) => void; onDelete?: () => void; currentUser?: { id: string; profile?: { username?: string }; user_metadata?: { username?: string } } }) {
  const isOwner = currentUser && (post.username === currentUser?.profile?.username || post.username === currentUser?.user_metadata?.username);
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [lightbox, setLightbox] = useState<string|null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [brokenImage, setBrokenImage] = useState(false);
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
    const nc: Comment = { id: Date.now(), user: displayName, avatar: avatarInitials, text: fullText, time: "Just now" };
    if (isDbPost && currentUser) {
      const { data } = await supabase.from('comments').insert({
        user_id: currentUser.id,
        post_id: post.id,
        content: fullText,
      }).select('id').single();
      if (data) nc.id = data.id;
      // Notify post owner
      const postOwnerId = (post as any)._ownerId;
      if (postOwnerId && postOwnerId !== currentUser.id) {
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'create_notification', payload:{ userId: postOwnerId, fromUserId: currentUser.id, type:'comment', referenceId: post.id, body:`${displayName} commented: "${commentText.trim().slice(0,50)}"` }}) });
      }
    }
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
          <img src={lightbox} style={{ maxWidth:"95vw",maxHeight:"90vh",borderRadius:16,objectFit:"contain" }} alt="" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} style={{ position:"absolute",top:20,right:24,background:"none",border:"none",color:"#fff",fontSize:32,cursor:"pointer" }}>×</button>
        </div>
      )}

      {/* Tier skin: border + glow based on user's tier */}
      <div style={{
        background: C.white,
        border: `2px solid ${post.tier && post.tier !== "default" ? TIER_COLORS[post.tier as Tier]?.border : C.greenMid}`,
        boxShadow: post.tier && post.tier !== "default" ? `0 4px 24px ${TIER_COLORS[post.tier as Tier]?.glow}` : "0 4px 24px rgba(124,58,237,0.10)",
        borderRadius: 20, marginBottom: 24, overflow: "hidden" as const,
      }}>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 18px 10px" }}>
          <div onClick={() => window.location.href=`/profile/${post.username}`} style={{ cursor:"pointer",flexShrink:0 }}>
            <TierFrame tier={post.tier || "default"} size={46}>
              <div style={{ width:"100%",height:"100%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff" }}>
                {post.avatar && (post.avatar.startsWith('http') || post.avatar.startsWith('/'))
                  ? <img src={post.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
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
          {isOwner && onDelete && (
            <div style={{ position:"relative" }}>
              <button onClick={() => setShowMenu(m => !m)} style={{ background:"none",border:"none",cursor:"pointer",padding:"4px 8px",borderRadius:8,color:C.sub,fontSize:20,lineHeight:1 }}>···</button>
              {showMenu && (
                <div style={{ position:"absolute",right:0,top:"100%",zIndex:50,background:C.white,border:`1.5px solid ${C.greenMid}`,borderRadius:14,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:160,overflow:"hidden" }}>
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)} style={{ width:"100%",padding:"12px 16px",background:"none",border:"none",cursor:"pointer",textAlign:"left",fontSize:14,fontWeight:700,color:"#EF4444",display:"flex",alignItems:"center",gap:8 }}>
                      🗑️ Delete Post
                    </button>
                  ) : (
                    <div style={{ padding:"12px 16px" }}>
                      <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:10 }}>Delete this post?</div>
                      <div style={{ display:"flex",gap:8 }}>
                        <button onClick={() => { setShowMenu(false); setConfirmDelete(false); onDelete(); }} style={{ flex:1,padding:"8px 0",borderRadius:10,border:"none",background:"#EF4444",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer" }}>Yes, delete</button>
                        <button onClick={() => { setShowMenu(false); setConfirmDelete(false); }} style={{ flex:1,padding:"8px 0",borderRadius:10,border:`1.5px solid ${C.greenMid}`,background:C.greenLight,color:C.sub,fontWeight:800,fontSize:13,cursor:"pointer" }}>Cancel</button>
                      </div>
                    </div>
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
          <div style={{ position:"relative",width:"100%",aspectRatio:"1/1",background:"linear-gradient(135deg,#7C3AED,#A78BFA)",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center" }}>
            {!brokenImage && (
              <img src={post.photos[currentPhoto]} style={{ width:"100%",height:"100%",objectFit:"cover",cursor:"pointer" }} alt="" onClick={() => setLightbox(post.photos[currentPhoto])} onError={() => { setBrokenImage(true); }} />
            )}
            {brokenImage && (
              <div style={{ display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12 }}>
                <div style={{ fontSize:60 }}>📸</div>
                <div style={{ fontSize:14,color:"rgba(255,255,255,0.8)",fontWeight:700 }}>Photo unavailable</div>
              </div>
            )}
            {post.photos.length > 1 && (<>
              <div style={{ position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",display:"flex",gap:6 }}>
                {post.photos.map((_,i) => (
                  <button key={i} onClick={() => setCurrentPhoto(i)} style={{ width:i===currentPhoto?20:8,height:8,borderRadius:4,border:"none",background:i===currentPhoto?"#fff":"rgba(255,255,255,0.45)",cursor:"pointer",transition:"width 0.2s",padding:0 }}/>
                ))}
              </div>
              {currentPhoto > 0 && <button onClick={() => setCurrentPhoto(c=>c-1)} style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",width:34,height:34,borderRadius:"50%",background:"rgba(0,0,0,0.45)",border:"none",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>}
              {currentPhoto < post.photos.length-1 && <button onClick={() => setCurrentPhoto(c=>c+1)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",width:34,height:34,borderRadius:"50%",background:"rgba(0,0,0,0.45)",border:"none",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>›</button>}
            </>)}
          </div>
        ) : (
          <label style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:14,margin:"0 18px 12px",height:340,borderRadius:16,border:`2px dashed ${C.greenMid}`,background:C.greenLight,cursor:isOwner?"pointer":"default" }}>
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
            <label style={{ fontSize:12,fontWeight:700,color:C.blue,cursor:"pointer",padding:"5px 14px",borderRadius:20,background:C.greenLight,border:`1px solid ${C.greenMid}` }}>
              + Add Photo
              <input type="file" accept="image/*,video/*" style={{ display:"none" }} onChange={addPhoto} />
            </label>
            <span style={{ fontSize:12,color:C.sub }}>{post.photos.length} photo{post.photos.length!==1?"s":""}</span>
            <button onClick={() => onUpdate({ ...post, photos: post.photos.filter((_,i) => i !== currentPhoto) })} style={{ marginLeft:"auto",fontSize:12,fontWeight:700,color:"#EF4444",background:"#FEE2E2",border:"none",cursor:"pointer",padding:"5px 14px",borderRadius:20 }}>
              🗑️ Remove Photo
            </button>
          </div>
        )}

        {/* ── Workout Stats Strip ── */}
        {post.workout && (() => {
          const exercises = post.workout.exercises || [];
          const cardio = post.workout.cardio || [];
          const totalSets = exercises.reduce((s, ex) => s + (ex.sets || 0), 0);
          const totalVol = exercises.reduce((s, ex) => {
            const w = parseFloat(String(ex.weight)) || 0;
            return s + (w * (ex.sets || 0) * (ex.reps || 0));
          }, 0);
          const top3 = exercises.slice(0, 3).map(e => e.name).filter(Boolean);
          const hasCardio = cardio.length > 0;
          const isPR = (post as any).isPR;
          return (
            <div style={{ margin:"10px 18px 0", borderRadius:14, border:`1.5px solid ${C.greenMid}`, background:C.greenLight, overflow:"hidden" }}>
              {/* Header row */}
              <div style={{ padding:"10px 14px 8px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:17 }}>🏋️</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:900, fontSize:14, color:C.text }}>{post.workout.type}</span>
                    <span style={{ fontSize:12, color:C.sub }}>· {post.workout.duration}</span>
                    {isPR && (
                      <span style={{ fontSize:10, fontWeight:800, background:C.gold, color:"#000", borderRadius:99, padding:"2px 8px", flexShrink:0 }}>🏆 NEW PR</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Stats row */}
              <div style={{ padding:"0 14px 8px", display:"flex", gap:14, flexWrap:"wrap" }}>
                {totalSets > 0 && (
                  <span style={{ fontSize:12, color:C.sub }}>
                    <strong style={{ color:C.text, fontWeight:800 }}>{totalSets}</strong> sets
                  </span>
                )}
                {totalVol > 0 && (
                  <span style={{ fontSize:12, color:C.sub }}>
                    <strong style={{ color:C.text, fontWeight:800 }}>{totalVol >= 1000 ? `${(totalVol/1000).toFixed(1)}k` : totalVol.toFixed(0)}</strong> lbs vol
                  </span>
                )}
                {post.workout.calories > 0 && (
                  <span style={{ fontSize:12, color:C.sub }}>
                    <strong style={{ color:C.text, fontWeight:800 }}>{post.workout.calories}</strong> cal
                  </span>
                )}
                {hasCardio && cardio.slice(0,2).map((c, i) => (
                  <span key={i} style={{ fontSize:12, color:C.sub }}>
                    🏃 {c.distance || c.duration}
                  </span>
                ))}
              </div>
              {/* Top exercises */}
              {top3.length > 0 && (
                <div style={{ padding:"0 14px 10px", fontSize:11, color:C.sub }}>
                  {top3.join(' · ')}{exercises.length > 3 ? ` +${exercises.length - 3} more` : ''}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Nutrition Stats Strip ── */}
        {post.nutrition && (() => {
          const meals = post.nutrition.meals || [];
          return (
            <div style={{ margin:"10px 18px 0", borderRadius:14, border:`1.5px solid ${C.greenMid}`, background:C.greenLight, overflow:"hidden" }}>
              <div style={{ padding:"10px 14px 8px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:17 }}>🥗</span>
                <span style={{ fontWeight:900, fontSize:14, color:C.text }}>Nutrition Log</span>
              </div>
              <div style={{ padding:"0 14px 8px", display:"flex", gap:14, flexWrap:"wrap" }}>
                <span style={{ fontSize:12, color:C.sub }}><strong style={{ color:C.text, fontWeight:800 }}>{post.nutrition.calories}</strong> cal</span>
                <span style={{ fontSize:12, color:C.sub }}><strong style={{ color:C.text, fontWeight:800 }}>{post.nutrition.protein}g</strong> protein</span>
                <span style={{ fontSize:12, color:C.sub }}><strong style={{ color:C.text, fontWeight:800 }}>{post.nutrition.carbs}g</strong> carbs</span>
                <span style={{ fontSize:12, color:C.sub }}><strong style={{ color:C.text, fontWeight:800 }}>{post.nutrition.fat}g</strong> fat</span>
              </div>
              {meals.length > 0 && (
                <div style={{ padding:"0 14px 10px", fontSize:11, color:C.sub }}>
                  {meals.map(m => m.key).join(' · ')}
                </div>
              )}
            </div>
          );
        })()}

        {/* Actions */}
        <div style={{ padding:"12px 18px",display:"flex",alignItems:"center",gap:20,borderTop:`1px solid ${C.greenLight}`,marginTop:12 }}>
          <button onClick={toggleLike} disabled={likeLoading} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:likeLoading?"default":"pointer",padding:0,opacity:likeLoading?0.7:1 }}>
            <svg viewBox="0 0 24 24" fill={post.liked?"#FF6B6B":"none"} stroke={post.liked?"#FF6B6B":C.sub} strokeWidth="2" style={{ width:24,height:24,transition:"all 0.15s",transform:post.liked?"scale(1.15)":"scale(1)" }}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span style={{ fontSize:14,fontWeight:700,color:post.liked?"#FF6B6B":C.sub }}>{post.likes}</span>
          </button>
          <button onClick={() => document.getElementById(`ci-${post.id}`)?.focus()} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:22,height:22 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span style={{ fontSize:14,fontWeight:700,color:C.sub }}>{post.comments.length}</span>
          </button>
          <button style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0,marginLeft:"auto" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:22,height:22 }}>
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>

        {/* Comments */}
        {post.comments.length > 0 && (
          <div style={{ padding:"0 18px 10px",display:"flex",flexDirection:"column",gap:10 }}>
            {visibleComments.map(c => (
              <div key={c.id} style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                <div style={{ width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0,overflow:"hidden" }}>
                  {c.avatar && (c.avatar.startsWith('http')||c.avatar.startsWith('/'))
                    ? <img src={c.avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                    : c.avatar}
                </div>
                <div style={{ flex:1,background:C.greenLight,borderRadius:14,padding:"9px 13px",border:`1px solid ${C.greenMid}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3 }}>
                    <span style={{ fontWeight:800,fontSize:12,color:C.text }}>{c.user}</span>
                    <span style={{ fontSize:10,color:C.sub }}>{c.time}</span>
                  </div>
                  <p style={{ fontSize:13,color:C.text,margin:0,lineHeight:1.5 }}>{c.text}</p>
                  <button onClick={()=>{ setReplyTo({id:c.id,user:c.user}); setCommentText(`@${c.user.split(' ')[0]} `); setTimeout(()=>commentInputRef.current?.focus(),50); }} style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:C.sub,padding:"4px 0 0",marginTop:2 }}>Reply</button>
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
              ? <img src={currentUser.profile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
              : ((currentUser?.profile?.full_name || currentUser?.user_metadata?.full_name || "?").split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase())}
          </div>
          <div style={{ flex:1,display:"flex",gap:8,alignItems:"center",background:C.greenLight,borderRadius:24,padding:"8px 16px",border:`1.5px solid ${C.greenMid}` }}>
            <input ref={commentInputRef} id={`ci-${post.id}`} value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&submitComment()} placeholder={replyTo?`Reply to ${replyTo.user.split(' ')[0]}...`:"Add a comment..."} style={{ flex:1,background:"none",border:"none",outline:"none",fontSize:13,color:C.text }} />
            {commentText.trim() && <button onClick={submitComment} disabled={commentLoading} style={{ background:"none",border:"none",cursor:"pointer",color:C.blue,fontWeight:800,fontSize:13,padding:0,opacity:commentLoading?0.5:1 }}>{commentLoading?"...":"Post"}</button>}
          </div>
        </div>
      </div>
    </>
  );
}

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
                  ? <img src={member.avatar_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedTab, setFeedTab] = useState<"foryou" | "following" | "notifications">("foryou");
  const [followingPosts, setFollowingPosts] = useState<any[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [viewingStory, setViewingStory] = useState<typeof INITIAL_STORIES[0] | null>(null);
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

  async function fetchPosts(page: number, append = false) {
    if (page === 0) setLoadingFeed(true);
    else setLoadingMorePosts(true);
    const { data } = await supabase
      .from('posts')
      .select(`*, users (id, username, full_name, avatar_url, tier, logs_last_28_days), comments (id, content, created_at, users (id, username, full_name, avatar_url))`)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (data) {
      let likedPostIds: Set<string> = new Set();
      if (user && data.length > 0) {
        const postIds = data.map((p: any) => p.id);
        const { data: likeData } = await supabase
          .from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds);
        if (likeData) likedPostIds = new Set(likeData.map((l: any) => l.post_id));
      }
      const mapped = data.map((p: any) => ({ ...p, _liked: likedPostIds.has(p.id) }));
      if (append) setDbPosts(prev => [...prev, ...mapped]);
      else setDbPosts(mapped);
      setDbPostsHasMore(data.length === PAGE_SIZE);
      setDbPostsPage(page);
    }
    if (page === 0) setLoadingFeed(false);
    else setLoadingMorePosts(false);
  }

  useEffect(() => { fetchPosts(0); }, []);

  async function loadMorePosts() {
    if (loadingMorePosts || !dbPostsHasMore) return;
    await fetchPosts(dbPostsPage + 1, true);
  }

  useEffect(() => {
    if (feedTab !== "following" || !user) return;
    setLoadingFollowing(true);
    async function loadFollowingFeed() {
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user!.id);

      if (!followData || followData.length === 0) {
        setFollowingPosts([]);
        setLoadingFollowing(false);
        return;
      }

      const followingIds = followData.map(f => f.following_id);
      const { data: fp } = await supabase
        .from('posts')
        .select('*, users(id, username, full_name, avatar_url)')
        .in('user_id', followingIds)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);

      setFollowingPosts(fp || []);
      setLoadingFollowing(false);
    }
    loadFollowingFeed();
  }, [feedTab, user]);

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
      if (append) setActivityLogs(prev => [...prev, ...data]);
      else setActivityLogs(data);
      setActivityLogsHasMore(data.length === PAGE_SIZE);
      setActivityLogsPage(page);
      // badge loading
      if (data.length > 0) {
        const userIds = [...new Set(data.map((l: any) => l.user_id).filter(Boolean))];
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
  const displayPosts = dbPosts.length > 0
    ? dbPosts.map((p: any) => ({
        id: p.id,
        user: p.users?.full_name || p.users?.username || "User",
        username: p.users?.username || "user",
        tier: (p.users?.tier as Tier) || computeTier(p.users?.logs_last_28_days || 0, 0),
        avatar: p.users?.avatar_url && p.users.avatar_url.startsWith('http') ? p.users.avatar_url : (p.users?.full_name || p.users?.username || "U").split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase(),
        time: (() => { const d = new Date(p.created_at); const diff = Date.now()-d.getTime(); if(diff<3600000) return `${Math.floor(diff/60000)}m ago`; if(diff<86400000) return `${Math.floor(diff/3600000)}h ago`; return d.toLocaleDateString(); })(),
        dateShort: `${new Date(p.created_at).getMonth()+1}.${new Date(p.created_at).getDate()}`,
        dayLabel: new Date(p.created_at).toLocaleDateString("en-US", { weekday: "long" }),
        photos: (() => { if (p.media_urls && Array.isArray(p.media_urls) && p.media_urls.length > 0) return p.media_urls; if (p.media_url) return [p.media_url]; return []; })(),
        caption: p.caption || "",
        likes: p.likes_count || 0,
        liked: p._liked || false,
        comments: (p.comments || []).map((c: any) => ({
          id: c.id,
          user: c.users?.full_name || c.users?.username || "User",
          avatar: c.users?.avatar_url || (c.users?.full_name || c.users?.username || "U").slice(0,2).toUpperCase(),
          text: c.content || "",
          time: (() => { const d = new Date(c.created_at); const diff = Date.now()-d.getTime(); if(diff<3600000) return `${Math.floor(diff/60000)}m ago`; if(diff<86400000) return `${Math.floor(diff/3600000)}h ago`; return d.toLocaleDateString(); })(),
        })),
        workout: null,
        nutrition: null,
        wellness: null,
        _ownerId: p.user_id,
      } as any))
    : posts;

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
        photoUrls: nls.map((l: any) => l.photo_url).filter(Boolean),
      } : null;

      const wellness = wels.length > 0 ? {
        entries: wels.map((l: any) => ({ activity: l.wellness_type || 'Wellness', emoji: '🌿', notes: l.notes || '' })),
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
      <div style={{ position:"sticky",top:0,zIndex:100,background:C.white,borderBottom:`2px solid ${C.greenLight}` }}>
        <div className="feed-header-inner" style={{ padding:"14px 28px 12px",display:"flex",alignItems:"center",gap:12,justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
            <span style={{ fontSize:20 }}>⚡</span>
            <span style={{ fontWeight:900,fontSize:22,color:C.blue,letterSpacing:3 }}>FIT</span>
          </div>
          {/* Search bar */}
          <div style={{ flex:1,maxWidth:360,position:"relative" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,background:C.greenLight,borderRadius:24,padding:"7px 14px",border:`1.5px solid ${searchQuery?C.blue:C.greenMid}` }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{width:15,height:15,flexShrink:0}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search people..." style={{background:"none",border:"none",outline:"none",fontSize:13,color:C.text,flex:1,minWidth:0}}/>
              {searchQuery && <button onClick={()=>{setSearchQuery("");setSearchResults([]);}} style={{background:"none",border:"none",cursor:"pointer",color:C.sub,fontSize:16,padding:0,lineHeight:1}}>×</button>}
            </div>
            {searchQuery.trim() && (
              <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:C.white,borderRadius:16,border:`1.5px solid ${C.greenMid}`,boxShadow:"0 8px 24px rgba(0,0,0,0.10)",zIndex:200,overflow:"hidden",maxHeight:280,overflowY:"auto"}}>
                {searchLoading ? <div style={{padding:"14px",textAlign:"center",color:C.sub,fontSize:13}}>Searching...</div>
                : searchResults.length===0 ? <div style={{padding:"14px",textAlign:"center",color:C.sub,fontSize:13}}>No results</div>
                : searchResults.map(u=>(
                  <div key={u.id} onClick={()=>{setSearchQuery("");setSearchResults([]);window.location.href=`/profile/${u.username}`;}}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${C.greenLight}`}}
                    onMouseEnter={e=>(e.currentTarget.style.background=C.greenLight)} onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#fff",flexShrink:0,overflow:"hidden"}}>
                      {u.avatar_url?<img src={u.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:(u.full_name||u.username||"?")[0].toUpperCase()}
                    </div>
                    <div><div style={{fontWeight:700,fontSize:13,color:C.text}}>{u.full_name}</div><div style={{fontSize:11,color:C.sub}}>@{u.username}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Feed tabs */}
        <div style={{ display:"flex",gap:4,padding:"0 28px 10px" }}>
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
          <button key="notifications" onClick={async () => {
            setFeedTab("notifications");
            if (user) {
              await fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'mark_notifications_read', payload:{ userId: user.id }}) });
              setNotifications(p => p.map(n => ({...n, read: true})));
            }
          }} style={{
            padding:"8px 20px", borderRadius:99, border:"none", cursor:"pointer",
            fontWeight:800, fontSize:13,
            background: feedTab==="notifications" ? "#7C3AED" : "transparent",
            color: feedTab==="notifications" ? "#fff" : "#6B7280",
            transition:"all 0.15s",
            position:"relative",
          }}>
            🔔{unreadCount > 0 && feedTab !== "notifications" && (
              <span style={{position:"absolute",top:2,right:2,minWidth:14,height:14,borderRadius:7,background:"#FF6B6B",fontSize:8,fontWeight:900,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 2px"}}>{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Story Viewer overlay ── */}
      {viewingStory && <StoryViewer story={viewingStory} onClose={() => setViewingStory(null)} />}

      {/* ── Stories Row (visible on all views) ── */}
      <div style={{ padding:"12px 0 0", borderBottom:`1px solid ${C.greenMid}`, overflowX:"auto" }}>
        <div style={{ display:"flex", gap:16, padding:"4px 24px 14px", minWidth:"max-content" }}>
          {INITIAL_STORIES.map(story => {
            const tier: Tier = "default"; // stories use default tier frame (users could earn tiers shown here in future)
            return (
              <button
                key={story.id}
                onClick={() => !story.isYou && setViewingStory(story)}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", flexShrink:0, padding:0 }}
              >
                <TierFrame tier={tier} size={60}>
                  <div style={{ width:"100%", height:"100%", background:`linear-gradient(135deg, ${story.hasNew ? C.blue : "#2D2D2D"}, ${story.hasNew ? "#4ADE80" : "#1A1A1A"})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:"#fff" }}>
                    {story.isYou ? "＋" : story.username[0].toUpperCase()}
                  </div>
                </TierFrame>
                <span style={{ fontSize:11, fontWeight:600, color: story.hasNew ? C.text : C.sub, maxWidth:60, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {story.isYou ? "You" : story.username}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Desktop: two-column layout ── */}
      <div className="feed-layout">

        {/* LEFT: Social feed (desktop only) */}
        <div className="feed-main feed-desktop-only">
          <div style={{ height:1,background:C.greenMid,marginBottom:20 }}/>
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
                    {n.from_user?.avatar_url ? <img src={n.from_user.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/> : (n.from_user?.full_name||"?")[0]?.toUpperCase()}
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
                <div style={{ width:32,height:32,borderRadius:"50%",border:"4px solid #DDD6FE",borderTopColor:"#7C3AED",animation:"spin 0.8s linear infinite",margin:"0 auto 12px" }}/>
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
                  photos: (() => { if (p.media_urls && Array.isArray(p.media_urls) && p.media_urls.length > 0) return p.media_urls; if (p.media_url) return [p.media_url]; return []; })(),
                  caption: p.caption || "",
                  likes: p.likes_count || 0,
                  liked: false,
                  comments: [],
                  workout: null,
                  nutrition: null,
                  wellness: null,
                  _ownerId: p.user_id,
                };
                return <PostCard key={p.id} post={mockPost} onUpdate={() => {}} currentUser={user} />;
              })
            )
          ) : (
            <>
              {loadingFeed ? (
                <div style={{ textAlign:"center",padding:"48px 20px",color:"#9CA3AF" }}>
                  <div style={{ width:32,height:32,borderRadius:"50%",border:"4px solid #DDD6FE",borderTopColor:"#7C3AED",animation:"spin 0.8s linear infinite",margin:"0 auto 12px" }}/>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <p style={{ fontWeight:600 }}>Loading feed…</p>
                </div>
              ) : (
                <>
                  {/* ── New Members panel — top of For You feed ── */}
                  {newMembers.length > 0 && (
                    <NewMembersPanel members={newMembers} currentUser={user} />
                  )}

                  {displayPosts.length === 0 && (
                    <div style={{ background:"#F3F0FF",border:"1.5px solid #DDD6FE",borderRadius:14,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#7C3AED",fontWeight:600 }}>
                      👋 No posts yet. Share something to the feed to see it here!
                    </div>
                  )}
                  {displayPosts.map(post => (
                    <PostCard key={post.id} post={post} onUpdate={updatePost} currentUser={user} onDelete={() => deletePost(post.id)} />
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

      {/* ── Mobile: interleaved single-column feed ── */}
      <div className="feed-mobile-only" style={{ padding:"0 12px" }}>
        <div style={{ height:1,background:C.greenMid,margin:"12px 0 16px" }}/>
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
                  {n.from_user?.avatar_url ? <img src={n.from_user.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/> : (n.from_user?.full_name||"?")[0]?.toUpperCase()}
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
              <div style={{ width:32,height:32,borderRadius:"50%",border:"4px solid #DDD6FE",borderTopColor:"#7C3AED",animation:"spin 0.8s linear infinite",margin:"0 auto 12px" }}/>
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
                photos: (() => { if (p.media_urls && Array.isArray(p.media_urls) && p.media_urls.length > 0) return p.media_urls; if (p.media_url) return [p.media_url]; return []; })(),
                caption: p.caption || "",
                likes: p.likes_count || 0,
                liked: false,
                comments: [],
                workout: null,
                nutrition: null,
                wellness: null,
                _ownerId: p.user_id,
              };
              return <PostCard key={p.id} post={mockPost} onUpdate={() => {}} currentUser={user} />;
            })
          )
        ) : (
        <>
        {dbPosts.length === 0 && !loadingFeed && (
          <div style={{ background:"#F3F0FF",border:"1.5px solid #DDD6FE",borderRadius:14,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#7C3AED",fontWeight:600 }}>
            👋 These are sample posts. Log a workout or share to feed to see real content!
          </div>
        )}
        {mobileItems.map((item, idx) => {
          if (item.type === "post") {
            return <PostCard key={`post-${item.data.id}`} post={item.data} onUpdate={updatePost} currentUser={user} onDelete={() => deletePost(item.data.id)} />;
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
      </div>
    </div>
  );
}



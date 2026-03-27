"use client";
import { useState, useRef } from "react";

const C = {
  blue:"#16A34A", greenLight:"#F0FDF4", greenMid:"#BBF7D0",
  gold:"#F5A623", goldLight:"#FFFBEE",
  text:"#1A2B3C", sub:"#5A7A8A", white:"#FFFFFF", bg:"#F0FDF4",
  green:"#52C97A", greenLight:"#F0FBF5",
  // Dark sidebar palette
  dark:"#0F1117", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
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
  return (
    <div style={{ borderRadius:14,overflow:"hidden",border:`1px solid ${C.darkBorder}`,marginBottom:10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width:"100%",background:"linear-gradient(135deg,#16A34A,#15803D)",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:18 }}>💪</span>
          <div>
            <div style={{ fontWeight:800,fontSize:14,color:"#fff" }}>{workout.type}</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.8)" }}>{workout.duration} · {workout.calories} cal</div>
          </div>
        </div>
        <div style={{ width:26,height:26,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s",flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ width:13,height:13 }}><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </button>
      {open && (
        <div style={{ background:"#1E2235",padding:"10px 14px" }}>
          {workout.exercises.length > 0 && (<>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 42px 42px 72px",gap:5,paddingBottom:6,marginBottom:4,borderBottom:"1px solid #2A2D3E" }}>
              {["Exercise","Sets","Reps","Weight"].map(h => <span key={h} style={{ fontSize:9,fontWeight:800,color:C.darkSub,textTransform:"uppercase",letterSpacing:0.5 }}>{h}</span>)}
            </div>
            {workout.exercises.map((ex,i) => (
              <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 42px 42px 72px",gap:5,padding:"7px 4px",borderRadius:7,background:i%2===0?"rgba(124,58,237,0.08)":"transparent" }}>
                <span style={{ fontSize:12,fontWeight:600,color:"#E2E8F0" }}>{ex.name}</span>
                <span style={{ fontSize:13,fontWeight:900,color:C.blue,textAlign:"center" }}>{ex.sets}</span>
                <span style={{ fontSize:13,fontWeight:900,color:C.blue,textAlign:"center" }}>{ex.reps}</span>
                <span style={{ fontSize:12,fontWeight:800,color:C.gold,textAlign:"center" }}>{ex.weight}</span>
              </div>
            ))}
          </>)}
          {workout.cardio.length > 0 && (
            <div style={{ marginTop:workout.exercises.length?10:0 }}>
              <div style={{ fontSize:10,fontWeight:800,color:C.darkSub,textTransform:"uppercase",letterSpacing:0.6,marginBottom:6 }}>🏃 Cardio</div>
              {workout.cardio.map((c,i) => (
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
      <button onClick={() => setOpen(o => !o)} style={{ width:"100%",background:"linear-gradient(135deg,#16A34A,#15803D)",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left" }}>
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
      <button onClick={() => setOpen(o => !o)} style={{ width:"100%",background:"linear-gradient(135deg,#52C97A,#3DB862)",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left" }}>
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

// ── DARK SIDEBAR: One user's full activity block ──────────────────────────────
function SideUserBlock({ post }: { post: Post }) {
  const hasActivity = post.workout || post.nutrition || post.wellness;
  if (!hasActivity) return null;
  return (
    <div style={{ background:C.darkCard, borderRadius:18, border:`1px solid ${C.darkBorder}`, overflow:"hidden", marginBottom:16 }}>
      {/* User header */}
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px 12px",borderBottom:`1px solid ${C.darkBorder}` }}>
        <div style={{ width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#16A34A,#15803D)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0 }}>
          {post.avatar}
        </div>
        <div>
          <div style={{ fontWeight:800,fontSize:14,color:"#E2E8F0" }}>{post.user}</div>
          <div style={{ fontSize:11,color:C.darkSub }}>@{post.username}</div>
        </div>
        <div style={{ marginLeft:"auto",fontSize:11,color:C.darkSub }}>{post.time}</div>
      </div>
      {/* Cards */}
      <div style={{ padding:"12px 14px 4px" }}>
        {post.workout && <SideWorkout workout={post.workout} />}
        {post.nutrition && <SideNutrition nutrition={post.nutrition} />}
        {post.wellness && <SideWellness wellness={post.wellness} />}
      </div>
    </div>
  );
}

const CURRENT_USER = "joey_fit";

// ── Post Card (left column — media + social only) ─────────────────────────────
function PostCard({ post, onUpdate }: { post: Post; onUpdate: (p: Post) => void }) {
  const isOwner = post.username === CURRENT_USER;
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [lightbox, setLightbox] = useState<string|null>(null);
  const [m, d] = post.dateShort.split(".").map(Number);

  function toggleLike() {
    onUpdate({ ...post, liked: !post.liked, likes: post.liked ? post.likes - 1 : post.likes + 1 });
  }
  function submitComment() {
    if (!commentText.trim()) return;
    const nc: Comment = { id: Date.now(), user: "Joey", avatar: "JB", text: commentText.trim(), time: "Just now" };
    onUpdate({ ...post, comments: [...post.comments, nc] });
    setCommentText("");
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

      <div style={{ background:C.white, borderRadius:20, border:`2px solid ${C.greenMid}`, boxShadow:"0 4px 24px rgba(124,58,237,0.10)", marginBottom:24, overflow:"hidden" }}>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 18px 10px" }}>
          <div style={{ width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0 }}>
            {post.avatar}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:900,fontSize:15,color:C.text }}>{post.user}</div>
            <div style={{ fontSize:12,color:C.sub }}>@{post.username} · {post.time}</div>
          </div>
          <div style={{ width:50,height:50,borderRadius:13,background:`linear-gradient(135deg,${C.gold},#FFD700)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(245,166,35,0.3)" }}>
            <span style={{ color:"#fff",fontWeight:900,fontSize:18,lineHeight:1 }}>{d}</span>
            <span style={{ color:"rgba(255,255,255,0.85)",fontSize:10,fontWeight:700 }}>{MONTHS[m-1]}</span>
          </div>
        </div>

        {/* Caption */}
        {post.caption && (
          <div style={{ padding:"0 18px 12px",fontSize:14,color:C.text,lineHeight:1.6 }}>{post.caption}</div>
        )}

        {/* ── MEDIA — square, full width ── */}
        {post.photos.length > 0 ? (
          <div style={{ position:"relative",width:"100%",aspectRatio:"1/1",background:"#111",overflow:"hidden" }}>
            <img src={post.photos[currentPhoto]} style={{ width:"100%",height:"100%",objectFit:"cover",cursor:"pointer" }} alt="" onClick={() => setLightbox(post.photos[currentPhoto])} />
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
          </div>
        )}

        {/* Actions */}
        <div style={{ padding:"12px 18px",display:"flex",alignItems:"center",gap:20,borderTop:`1px solid ${C.greenLight}`,marginTop:12 }}>
          <button onClick={toggleLike} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0 }}>
            <svg viewBox="0 0 24 24" fill={post.liked?"#FF6B6B":"none"} stroke={post.liked?"#FF6B6B":C.sub} strokeWidth="2" style={{ width:24,height:24,transition:"all 0.15s" }}>
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
                <div style={{ width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0 }}>{c.avatar}</div>
                <div style={{ flex:1,background:C.greenLight,borderRadius:14,padding:"9px 13px",border:`1px solid ${C.greenMid}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3 }}>
                    <span style={{ fontWeight:800,fontSize:12,color:C.text }}>{c.user}</span>
                    <span style={{ fontSize:10,color:C.sub }}>{c.time}</span>
                  </div>
                  <p style={{ fontSize:13,color:C.text,margin:0,lineHeight:1.5 }}>{c.text}</p>
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
        <div style={{ padding:"0 18px 16px",display:"flex",gap:10,alignItems:"center" }}>
          <div style={{ width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0 }}>JB</div>
          <div style={{ flex:1,display:"flex",gap:8,alignItems:"center",background:C.greenLight,borderRadius:24,padding:"8px 16px",border:`1.5px solid ${C.greenMid}` }}>
            <input id={`ci-${post.id}`} value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitComment()} placeholder="Add a comment..." style={{ flex:1,background:"none",border:"none",outline:"none",fontSize:13,color:C.text }} />
            {commentText.trim() && <button onClick={submitComment} style={{ background:"none",border:"none",cursor:"pointer",color:C.blue,fontWeight:800,fontSize:13,padding:0 }}>Post</button>}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Feed Page ────────────────────────────────────────────────────────────
export default function FeedPage() {
  const [stories, setStories] = useState(INITIAL_STORIES);
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [activeStory, setActiveStory] = useState<typeof INITIAL_STORIES[0] | null>(null);

  function updatePost(updated: Post) {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  }
  function handleStoryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => setStories(prev => prev.map(s => s.isYou ? { ...s, photo: ev.target!.result as string, hasNew: true } : s));
    r.readAsDataURL(file);
    e.target.value = "";
  }

  // Posts with activity data for the sidebar
  const activityPosts = posts.filter(p => p.workout || p.nutrition || p.wellness);

  return (
    <div style={{ background:C.bg, minHeight:"100vh", paddingBottom:80 }}>
      {activeStory && <StoryViewer story={activeStory as any} onClose={() => setActiveStory(null)} />}

      {/* ── Sticky Header ── */}
      <div style={{ position:"sticky",top:0,zIndex:100,background:C.white,borderBottom:`2px solid ${C.greenLight}`,padding:"14px 28px 12px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:20 }}>⚡</span>
          <span style={{ fontWeight:900,fontSize:22,color:C.blue,letterSpacing:3 }}>FIT</span>
        </div>
        <button style={{ background:"none",border:"none",cursor:"pointer",position:"relative" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:24,height:24 }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <div style={{ position:"absolute",top:-2,right:-2,width:10,height:10,borderRadius:"50%",background:"#FF6B6B",border:`2px solid ${C.white}` }}/>
        </button>
      </div>

      {/* ── Main two-panel layout ── */}
      <div style={{ display:"flex", maxWidth:1200, margin:"0 auto", padding:"0 24px", gap:48, alignItems:"flex-start" }}>

        {/* ══ LEFT: Social feed ══ */}
        <div style={{ flex:1, minWidth:0, paddingTop:20 }}>

          {/* Stories */}
          <div style={{ overflowX:"auto",paddingBottom:16,display:"flex",gap:14,scrollbarWidth:"none" }}>
            {stories.map(story => (
              <div key={story.id} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6,flexShrink:0 }}>
                {story.isYou ? (
                  <label style={{ cursor:"pointer",display:"block" }}>
                    <div style={{ width:68,height:68,borderRadius:"50%",padding:3,background:story.hasNew?`linear-gradient(135deg,${C.blue},${C.gold})`:"#E0E0E0" }}>
                      <div style={{ width:"100%",height:"100%",borderRadius:"50%",background:story.photo?"transparent":C.greenLight,border:`3px solid ${C.white}`,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        {story.photo ? <img src={story.photo} style={{ width:"100%",height:"100%",objectFit:"cover" }} alt="" /> : <span style={{ fontSize:26,color:C.blue }}>+</span>}
                      </div>
                    </div>
                    <input type="file" accept="image/*,video/*" style={{ display:"none" }} onChange={handleStoryUpload} />
                  </label>
                ) : (
                  <button onClick={() => setActiveStory(story)} style={{ background:"none",border:"none",cursor:"pointer",padding:0 }}>
                    <div style={{ width:68,height:68,borderRadius:"50%",padding:3,background:story.hasNew?`linear-gradient(135deg,${C.blue},${C.gold})`:"#E0E0E0" }}>
                      <div style={{ width:"100%",height:"100%",borderRadius:"50%",background:C.greenLight,border:`3px solid ${C.white}`,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        {story.photo ? <img src={story.photo} style={{ width:"100%",height:"100%",objectFit:"cover" }} alt="" /> : <span style={{ fontWeight:900,fontSize:22,color:C.blue }}>{story.username[0].toUpperCase()}</span>}
                      </div>
                    </div>
                  </button>
                )}
                <span style={{ fontSize:10,fontWeight:600,color:C.sub,maxWidth:68,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  {story.isYou ? "Your Story" : story.username}
                </span>
              </div>
            ))}
          </div>

          <div style={{ height:1,background:C.greenMid,marginBottom:20 }}/>

          {/* Posts */}
          {posts.map(post => (
            <PostCard key={post.id} post={post} onUpdate={updatePost} />
          ))}
        </div>

        {/* ══ RIGHT: Activity sidebar — dark, flows with page ══ */}
        <div style={{
          width: 340,
          flexShrink: 0,
          paddingTop: 20,
          paddingBottom: 20,
        }}>
          {/* Sidebar header */}
          <div style={{ marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${C.darkBorder}` }}>
            <div style={{ fontWeight:900,fontSize:16,color:"#E2E8F0",marginBottom:2 }}>Activity Feed</div>
            <div style={{ fontSize:12,color:C.darkSub }}>Workouts, nutrition & wellness</div>
          </div>

          {activityPosts.map(post => (
            <SideUserBlock key={post.id} post={post} />
          ))}

          {/* ── Suggested section — always shown after following feed ── */}
          <div style={{ marginTop: activityPosts.length > 0 ? 8 : 0, marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${C.darkBorder}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:900,fontSize:15,color:"#E2E8F0",marginBottom:2 }}>Suggested For You</div>
              <div style={{ fontSize:11,color:C.darkSub }}>People you might like</div>
            </div>
            <button style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:C.blue,padding:0 }}>See all</button>
          </div>

          {SUGGESTED_USERS.map(u => (
            <div key={u.id} style={{ background:C.darkCard,borderRadius:18,border:`1px solid ${C.darkBorder}`,overflow:"hidden",marginBottom:16 }}>
              {/* Suggested user header */}
              <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px 12px",borderBottom:`1px solid ${C.darkBorder}` }}>
                <div style={{ width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#16A34A,#4ADE80)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0 }}>
                  {u.avatar}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:800,fontSize:14,color:"#E2E8F0" }}>{u.user}</div>
                  <div style={{ fontSize:11,color:C.darkSub }}>@{u.username}</div>
                  <div style={{ fontSize:10,color:"#16A34A",marginTop:1,fontWeight:600 }}>{u.specialty}</div>
                </div>
                <div style={{ textAlign:"right",flexShrink:0 }}>
                  <div style={{ fontSize:13,fontWeight:900,color:"#E2E8F0" }}>{u.followers}</div>
                  <div style={{ fontSize:10,color:C.darkSub }}>followers</div>
                </div>
              </div>
              {/* Follow button */}
              <div style={{ padding:"10px 16px",borderBottom:`1px solid ${C.darkBorder}` }}>
                <button style={{ width:"100%",padding:"8px",borderRadius:10,background:"linear-gradient(135deg,#16A34A,#15803D)",border:"none",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer" }}>
                  + Follow
                </button>
              </div>
              {/* Their activity cards */}
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
  );
}

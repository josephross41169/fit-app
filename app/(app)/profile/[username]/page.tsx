"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { compressImage } from "@/lib/compressImage";
import { BADGES, isManualBadge, findManualBadgeFamily, getTierForCount } from "@/lib/badges";
import { BadgeTile } from "@/components/BadgeTile";
import FollowButton from "@/components/FollowButton";
import { groupBadgesIntoFamilies, TIER_STYLES, type DisplayBadge, type EarnedBadge, type BadgeCounters } from "@/lib/badgeFamilies";
import { getAllUserRivalryBadges, type RivalryBadgeWithContext } from "@/lib/rivalries";
import WeightTracker from "@/components/WeightTracker";
import WorkoutProgressGraphs from "@/components/WorkoutProgressGraphs";
import { TierFrame, TierBadgeChip, TierTitle } from "@/components/TierFrame";
import { computeTier, getTierInfo } from "@/lib/tiers";
import { ImagePresets } from "@/lib/imageUrls";
import { shareWithToast, appUrl } from "@/lib/share";
import type { Tier, Level, CounterData, LevelProgressInfo } from "@/lib/tiers";
import { getLevelProgress, LEVEL_CHALLENGES, XP_FOR_NEXT, LEVEL_COLORS, XP_CATEGORIES } from "@/lib/tiers";
import { tryLevelUp } from "@/lib/xp";
import { isBusinessAccount } from "@/lib/businessTypes";
import BusinessProfileView from "@/components/BusinessProfileView";
import TaggedPostsModal from "@/components/TaggedPostsModal";
import StreakSection from "@/components/StreakSection";

const C = {
  purple:"#7C3AED", purpleLight:"#2D1F52", purpleMid:"#3D2A6E",
  gold:"#F5A623", goldLight:"#2A2010",
  text:"#F0F0F0", sub:"#9CA3AF", white:"#1A1A1A", bg:"#0D0D0D",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const DAYS = [
  { id:"3.24", label:"Tuesday", emoji:"💪",
    workout:{ type:"Arms Day", duration:"58 min", calories:420,
      exercises:[
        {name:"Barbell Curl",sets:4,reps:10,weight:"65 lbs"},
        {name:"Hammer Curl",sets:3,reps:12,weight:"30 lbs"},
        {name:"Skull Crushers",sets:4,reps:10,weight:"75 lbs"},
        {name:"Tricep Pushdown",sets:3,reps:15,weight:"50 lbs"},
        {name:"Overhead Extension",sets:3,reps:12,weight:"45 lbs"},
      ]},
    nutrition:{ calories:2150, protein:178, carbs:210, fat:62, sugar:28,
      meals:[
        {key:"Breakfast",emoji:"🍳",name:"Eggs & Oats",cal:520},
        {key:"Lunch",emoji:"🍗",name:"Chicken & Rice Bowl",cal:780},
        {key:"Dinner",emoji:"🥩",name:"Steak & Veggies",cal:850},
      ]}},
  { id:"3.23", label:"Monday", emoji:"🏋️",
    workout:{ type:"Chest Day", duration:"65 min", calories:490,
      exercises:[
        {name:"Bench Press",sets:5,reps:8,weight:"185 lbs"},
        {name:"Incline DB Press",sets:4,reps:10,weight:"70 lbs"},
        {name:"Cable Flyes",sets:3,reps:15,weight:"35 lbs"},
        {name:"Push-Ups",sets:3,reps:20,weight:"BW"},
        {name:"Dips",sets:3,reps:12,weight:"BW"},
      ]},
    nutrition:{ calories:2380, protein:195, carbs:245, fat:58, sugar:32,
      meals:[
        {key:"Breakfast",emoji:"🥣",name:"Protein Oats",cal:580},
        {key:"Lunch",emoji:"🌯",name:"Turkey Wrap",cal:720},
        {key:"Dinner",emoji:"🍝",name:"Pasta & Chicken",cal:1080},
      ]}},
  { id:"3.22", label:"Sunday", emoji:"🌅", workout:null,
    nutrition:{ calories:1850, protein:142, carbs:198, fat:55, sugar:42,
      meals:[
        {key:"Breakfast",emoji:"🥞",name:"Pancakes & Berries",cal:620},
        {key:"Lunch",emoji:"🥙",name:"Grilled Chicken Wrap",cal:680},
        {key:"Dinner",emoji:"🍜",name:"Salmon & Quinoa",cal:550},
      ]}},
];

// ── Badge definitions ─────────────────────────────────────────────────────────
// BADGES imported from @/lib/badges

// ── Rivalry badge catalog (keep in sync with rivals/page.tsx) ─────────────────
const RIVALRY_BADGE_DISPLAY: Record<string, { emoji: string; label: string }> = {
  first_blood:  { emoji: "⚔️", label: "First Blood"  },
  early_bird:   { emoji: "🌅", label: "Early Bird"   },
  dominant:     { emoji: "😤", label: "Dominant"     },
  comeback:     { emoji: "🔄", label: "Comeback"     },
  untouchable:  { emoji: "💀", label: "Untouchable"  },
};
function rivalryBadgeEmoji(key: string) { return RIVALRY_BADGE_DISPLAY[key]?.emoji ?? "🏅"; }
function rivalryBadgeLabel(key: string) { return RIVALRY_BADGE_DISPLAY[key]?.label ?? key; }


// ── Lightbox ──────────────────────────────────────────────────────────────────
function AllPhotosModal({ photos, onClose, onSelectPhoto }: { photos: string[]; onClose: () => void; onSelectPhoto: (src: string) => void; }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#0E0820', borderBottom: '1px solid #2D1F52', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: '#F0F0F0' }}>
          All Photos {photos.length > 0 && (<span style={{ color: '#9CA3AF', fontSize: 13, fontWeight: 600, marginLeft: 6 }}>({photos.length})</span>)}
        </div>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.10)', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>x</button>
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, overflowY: 'auto', padding: '16px clamp(12px, 4vw, 32px) 32px', maxWidth: 1200, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u{1F4F7}'}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No feed photos yet.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {photos.map((src, idx) => (
              <button key={idx} onClick={() => onSelectPhoto(src)} style={{ padding: 0, border: 'none', borderRadius: 4, overflow: 'hidden', cursor: 'pointer', background: '#1A1228', aspectRatio: '1', display: 'block' }}>
                <img src={ImagePresets.thumb(src)} loading='lazy' style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt='' />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Lightbox({ src, photos, onClose, onChange }: { src: string; photos?: string[]; onClose: () => void; onChange?: (newSrc: string) => void; }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (!photos || !onChange) return;
      const idx = photos.indexOf(src);
      if (idx === -1) return;
      if (e.key === 'ArrowLeft' && idx > 0) onChange(photos[idx - 1]);
      if (e.key === 'ArrowRight' && idx < photos.length - 1) onChange(photos[idx + 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, photos, onChange, onClose]);
  const idx = photos ? photos.indexOf(src) : -1;
  const hasPrev = photos && idx > 0;
  const hasNext = photos && idx >= 0 && idx < photos.length - 1;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 20, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', lineHeight: 1, zIndex: 2 }}>x</button>
      {hasPrev && (
        <button onClick={(e) => { e.stopPropagation(); onChange?.(photos![idx - 1]); }} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1, zIndex: 2 }}>{'<'}</button>
      )}
      {hasNext && (
        <button onClick={(e) => { e.stopPropagation(); onChange?.(photos![idx + 1]); }} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1, zIndex: 2 }}>{'>'}</button>
      )}
      <img src={ImagePresets.thumb(src)} loading="lazy" decoding="async" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 16, objectFit: 'contain' }} alt='' />
      {photos && idx !== -1 && photos.length > 1 && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 13, fontWeight: 700, background: 'rgba(0,0,0,0.5)', padding: '6px 14px', borderRadius: 99 }}>{idx + 1} / {photos.length}</div>
      )}
    </div>
  );
}

type Exercise   = {name:string;sets:number;reps:number;weight:string;weights?:string[]};
type CardioEntry = {type:string;duration:string;distance:string};
type Meal        = {key:string;emoji:string;name:string;cal:number};
// ── Wellness display: per-activity emoji + accent color ──────────────────
// Maps wellness_type strings (Title Case) to a visual treatment for the
// profile activity log cards. Lookup is case-insensitive — falls back to
// the leaf emoji + neutral purple when an activity isn't in the table.
// Adding a new activity later? Just add a row here.
type WellnessStyle = { emoji: string; accent: string };
const WELLNESS_STYLES: Record<string, WellnessStyle> = {
  // Cold therapy — icy blues
  "cold plunge":          { emoji: "❄️", accent: "#38BDF8" },
  "ice bath":             { emoji: "❄️", accent: "#38BDF8" },
  "cryotherapy":          { emoji: "🥶", accent: "#22D3EE" },
  // Heat therapy — warm reds/oranges
  "sauna":                { emoji: "🔥", accent: "#F97316" },
  "infrared sauna":       { emoji: "🌅", accent: "#FB923C" },
  "steam room":           { emoji: "♨️", accent: "#FBBF24" },
  "red light therapy":    { emoji: "🔴", accent: "#EF4444" },
  // Mind / breath — purples & soft tones
  "meditation":           { emoji: "🧘", accent: "#A78BFA" },
  "breathwork":           { emoji: "💨", accent: "#818CF8" },
  "yoga nidra":           { emoji: "🌙", accent: "#A78BFA" },
  "journaling":           { emoji: "📓", accent: "#C4B5FD" },
  "therapy":              { emoji: "💬", accent: "#A78BFA" },
  "sound bath":           { emoji: "🎵", accent: "#C084FC" },
  // Body / mobility — earthy greens
  "stretching":           { emoji: "🤸", accent: "#34D399" },
  "foam rolling":         { emoji: "🌀", accent: "#10B981" },
  "mobility work":        { emoji: "🦵", accent: "#34D399" },
  "massage":              { emoji: "💆", accent: "#6EE7B7" },
  "chiropractic":         { emoji: "🦴", accent: "#A7F3D0" },
  "acupuncture":          { emoji: "📍", accent: "#34D399" },
  "cupping":              { emoji: "🟣", accent: "#A78BFA" },
  // Outdoor / light
  "sunlight exposure":    { emoji: "☀️", accent: "#FBBF24" },
  "grounding":            { emoji: "🌱", accent: "#84CC16" },
  "nature walk":           { emoji: "🌲", accent: "#34D399" },
  // Recovery / oxygen
  "hyperbaric oxygen":    { emoji: "💎", accent: "#06B6D4" },
  "compression therapy":  { emoji: "🦿", accent: "#0EA5E9" },
  "float tank":           { emoji: "🌊", accent: "#0EA5E9" },
  // Sleep & fasting
  "sleep":                { emoji: "😴", accent: "#6366F1" },
  "fasting":              { emoji: "⏳", accent: "#A78BFA" },
};
function getWellnessStyle(activity: string): WellnessStyle {
  return WELLNESS_STYLES[activity.toLowerCase().trim()] || { emoji: "🌿", accent: "#A78BFA" };
}

// Format an ISO datetime as a friendly local time, e.g. "8:42 AM".
// Falls back to empty string when the input is unparseable.
function formatTimeOfDay(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return ""; }
}

type WellnessEntry = {
  emoji: string;
  activity: string;
  notes: string;
  duration?: number | null;     // minutes (from wellness_duration_min)
  loggedAt?: string | null;     // ISO string (from logged_at) for time-of-day display
};
type Workout    = {type:string;duration:string;calories:number;exercises:Exercise[];cardio:CardioEntry[]};
type Nutrition  = {calories:number;protein:number;carbs:number;fat:number;sugar:number;meals:Meal[]};
type Wellness   = {entries:WellnessEntry[]};

const iStyle = {background:"#0D0D0D",border:`1.5px solid #3D2A6E`,borderRadius:10,padding:"7px 10px",fontSize:13,color:"#F0F0F0",outline:"none",width:"100%",boxSizing:"border-box" as const};
const emptyCardio:CardioEntry  = {type:"",duration:"",distance:""};
const emptyWellness:WellnessEntry = {emoji:"🧘",activity:"",notes:""};

// ── Month Card (collapsible) ───────────────────────────────────────────────────
const MONTHS_FULL_MC = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT_MC = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function MonthCard({ mDays, makeCard }: { mDays: any[]; makeCard: (d:any)=>React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const dt = new Date((mDays[0] as any)._date || 0);
  const isCurrentYear = dt.getFullYear() === now.getFullYear();
  const label = isCurrentYear
    ? MONTHS_FULL_MC[dt.getMonth()]
    : `${MONTHS_FULL_MC[dt.getMonth()]} ${dt.getFullYear()}`;
  const totalWorkouts = mDays.filter((d:any) => d.workout).length;
  const totalNutrition = mDays.filter((d:any) => d.nutrition).length;
  const totalWellness  = mDays.filter((d:any) => d.wellness).length;
  const firstDay = mDays[mDays.length - 1];
  const lastDay  = mDays[0];
  const dateRange = `${MONTHS_SHORT_MC[new Date((firstDay as any)._date||0).getMonth()]} ${new Date((firstDay as any)._date||0).getDate()} – ${MONTHS_SHORT_MC[new Date((lastDay as any)._date||0).getMonth()]} ${new Date((lastDay as any)._date||0).getDate()}`;

  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%",
        background: open ? "#2D1F52" : "#1A1228",
        border: `2px solid ${open ? "#7C3AED" : "#3D2A6E"}`,
        borderRadius: open ? "16px 16px 0 0" : 16,
        padding: "14px 18px", cursor: "pointer", textAlign: "left",
        transition: "all 0.2s",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:900, fontSize:17, color:"#F0F0F0" }}>{label}</div>
            <div style={{ fontSize:12, color:"#6B7280", marginTop:3 }}>
              {dateRange} · {mDays.length} day{mDays.length!==1?"s":""} logged
            </div>
            <div style={{ display:"flex", gap:12, marginTop:6, flexWrap:"wrap" }}>
              {totalWorkouts>0 && <span style={{fontSize:11,color:"#9CA3AF"}}>💪 {totalWorkouts} workout{totalWorkouts!==1?"s":""}</span>}
              {totalNutrition>0 && <span style={{fontSize:11,color:"#9CA3AF"}}>🥗 {totalNutrition} nutrition</span>}
              {totalWellness>0  && <span style={{fontSize:11,color:"#9CA3AF"}}>🌿 {totalWellness} wellness</span>}
            </div>
          </div>
          <div style={{
            width:32, height:32, borderRadius:"50%",
            background: open ? "#7C3AED" : "#2D1F52",
            display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0, marginLeft:12,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s",
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{width:14,height:14}}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </div>
      </button>
      {open && (
        <div style={{
          border: "2px solid #7C3AED", borderTop:"none",
          borderRadius:"0 0 16px 16px",
          padding:"8px 10px 10px",
          background:"#0D0820",
        }}>
          {(()=>{
            // Group days by week (Sun–Sat)
            const byWeek: Record<string, any[]> = {};
            mDays.forEach(d => {
              const dt = new Date((d as any)._date || 0);
              const weekStart = new Date(dt);
              weekStart.setDate(dt.getDate() - dt.getDay());
              const wk = weekStart.toISOString().slice(0,10);
              if (!byWeek[wk]) byWeek[wk] = [];
              byWeek[wk].push(d);
            });
            return Object.entries(byWeek)
              .sort((a,b) => b[0].localeCompare(a[0]))
              .map(([wk, wDays]) => {
                const wStart = new Date(wk);
                const wEnd = new Date(wk); wEnd.setDate(wEnd.getDate() + 6);
                const fmt = (d: Date) => `${MONTHS_SHORT_MC[d.getMonth()]} ${d.getDate()}`;
                return (
                  <div key={wk}>
                    <div style={{
                      fontSize:10, fontWeight:700, color:"#6B7280",
                      textTransform:"uppercase", letterSpacing:1,
                      padding:"10px 4px 5px",
                    }}>
                      Week of {fmt(wStart)} – {fmt(wEnd)}
                    </div>
                    {wDays.map(makeCard)}
                  </div>
                );
              });
          })()}
        </div>
      )}
    </div>
  );
}

// ── Day Card ──────────────────────────────────────────────────────────────────
type DayCardProps = { day: typeof DAYS[0]; workoutLogId?: string | null; nutritionLogIds?: string[]; wellnessLogIds?: string[]; onDelete?: ()=>void; earnedBadges?: string[]; userLevel?: number };
function DayCard({day, workoutLogId, nutritionLogIds, wellnessLogIds, onDelete, earnedBadges = [], userLevel = 1}:DayCardProps) {
  const { user } = useAuth();
  const [open,setOpen]       = useState(false);
  const [confirmDel,setConfirmDel] = useState(false);
  const [nut,setNut]         = useState(false);
  const [woOpen,setWoOpen]   = useState(false);
  const [wellOpen,setWellOpen] = useState(false);
  const [editWo,setEditWo]   = useState(false);
  const [editNut,setEditNut] = useState(false);
  const [editWell,setEditWell] = useState(false);
  const [photos,setPhotos]   = useState<string[]>([]);
  const [lb,setLb]           = useState<string|null>(null);
  const [workout,setWorkout]     = useState<Workout|null>(day.workout ? {...day.workout as Workout, cardio:(day.workout as any).cardio || []} : null);
  const [nutrition,setNutrition] = useState<Nutrition|null>(day.nutrition as Nutrition|null);
  const [wellness,setWellness]   = useState<Wellness|null>((day as any).wellness as Wellness | null ?? null);
  // edit buffers
  const [woBuf,setWoBuf]   = useState<Workout>(() => workout ? {...workout, cardio: (workout as any).cardio || [], exercises: workout.exercises || []} : {type:"",duration:"",calories:0,exercises:[],cardio:[]});
  const [nutBuf,setNutBuf] = useState<Nutrition>(nutrition ?? {calories:0,protein:0,carbs:0,fat:0,sugar:0,meals:[]});
  const [wellBuf,setWellBuf] = useState<Wellness>({entries:[]});
  const [showAllBadges, setShowAllBadges] = useState(false);
  const parts = day.id.split("/");
  const m = parseInt(parts[0]) || 1;
  const d = parseInt(parts[1]) || 1;

  // Load existing photo from DB on mount
  useEffect(() => {
    const allPhotos: string[] = [];
    if ((day as any).photo_url) allPhotos.push((day as any).photo_url);
    // Also load all nutrition photos
    const nutPhotos: string[] = ((day as any).nutrition?.photoUrls || []).filter(Boolean);
    nutPhotos.forEach((url: string) => {
      if (!allPhotos.includes(url)) allPhotos.push(url);
    });
    if (allPhotos.length > 0) setPhotos(allPhotos);
  }, []);

  function onFiles(e:React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files??[]).forEach(f=>{
      const r=new FileReader();
      r.onload=async ev=>{
        const dataUrl = ev.target!.result as string;
        setPhotos(p=>[...p, dataUrl]); // show preview immediately
        // Upload to Supabase via server API
        const { uploadPhoto: up } = await import('@/lib/uploadPhoto');
        const { compressImage: ci } = await import('@/lib/compressImage');
        const logId = workoutLogId || (nutritionLogIds?.[0]);
        const bucket = 'activity';
        const path = `${logId || Date.now()}/photo-${Date.now()}.jpg`;
        const compressed = await ci(dataUrl);
        const publicUrl = await up(compressed, bucket, path);
        if (publicUrl) {
          setPhotos(p => p.map(u => u === dataUrl ? publicUrl : u));
          // Save URL back to the activity log
          if (logId) {
            await supabase.from('activity_logs').update({ photo_url: publicUrl }).eq('id', logId);
          }
        }
      };
      r.readAsDataURL(f);
    }); e.target.value="";
  }

  async function saveWorkout() {
    setWorkout({...woBuf});
    setEditWo(false);
    // Normalize exercises: ensure weights array stored properly
    const normalizedExercises = (woBuf.exercises || []).map((ex: any) => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: (ex.weights || [])[0] || ex.weight || '',
      weights: ex.weights && ex.weights.length > 0 ? ex.weights : [ex.weight || ''],
    }));
    const cardioData = (woBuf.cardio || []).length > 0 ? woBuf.cardio : null;
    if (workoutLogId) {
      // Update existing log — save ALL fields including cardio
      await supabase.from('activity_logs').update({
        workout_type: woBuf.type || null,
        workout_duration_min: woBuf.duration ? parseInt(String(woBuf.duration)) : null,
        workout_calories: woBuf.calories || null,
        exercises: normalizedExercises.length > 0 ? normalizedExercises : null,
        cardio: cardioData,
      }).eq('id', workoutLogId);
    } else if (user) {
      // No existing log for this day — insert a new one so it persists after refresh
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        log_type: 'workout',
        is_public: true,
        logged_at: day._date ? new Date(day._date).toISOString() : new Date().toISOString(),
        workout_type: woBuf.type || null,
        workout_duration_min: woBuf.duration ? parseInt(String(woBuf.duration)) : null,
        workout_calories: woBuf.calories || null,
        exercises: normalizedExercises.length > 0 ? normalizedExercises : null,
        cardio: cardioData,
      }).catch(() => {});
    }
  }

  async function saveNutrition() {
    setNutrition({...nutBuf});
    setEditNut(false);
    if (nutritionLogIds && nutritionLogIds.length > 0) {
      // Update existing log — save ALL macro fields
      await supabase.from('activity_logs').update({
        calories_total: nutBuf.calories || null,
        protein_g: nutBuf.protein || null,
        carbs_g: nutBuf.carbs || null,
        fat_g: nutBuf.fat || null,
        // Persist meals as food_items so they survive refresh
        food_items: nutBuf.meals && nutBuf.meals.length > 0
          ? nutBuf.meals.map((m: any) => ({ name: m.key || m.name || 'Meal', calories: m.cal || 0 }))
          : null,
      }).eq('id', nutritionLogIds[0]);
    } else if (user) {
      // No existing log — insert so it persists
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        log_type: 'nutrition',
        is_public: true,
        logged_at: day._date ? new Date(day._date).toISOString() : new Date().toISOString(),
        calories_total: nutBuf.calories || null,
        protein_g: nutBuf.protein || null,
        carbs_g: nutBuf.carbs || null,
        fat_g: nutBuf.fat || null,
      }).catch(() => {});
    }
  }

  async function saveWellness() {
    const newWellness = wellBuf.entries.length ? {...wellBuf} : null;
    setWellness(newWellness);
    setEditWell(false);
    if (!user) return;

    // Delete-and-replace strategy: we delete every existing wellness log
    // for this day card, then insert one row per current wellBuf entry.
    // This is the only sane way to handle add/remove/reorder of multiple
    // wellness entries on a card — partial updates would have to diff
    // against the original loaded state and that gets complicated fast.
    //
    // We preserve the original logged_at on each new row when possible by
    // reading it off the wellBuf entry (added in fetchProfile mapping).
    // Falls back to day._date midnight for entries with no timestamp,
    // which is what the old INSERT branch did.
    try {
      const existingIds = wellnessLogIds || [];
      if (existingIds.length > 0) {
        await supabase.from('activity_logs').delete().in('id', existingIds);
      }

      if (wellBuf.entries.length === 0) return; // user cleared all entries

      const fallbackIso = day._date ? new Date(day._date).toISOString() : new Date().toISOString();
      const rows = wellBuf.entries.map((e: any) => ({
        user_id: user.id,
        log_type: 'wellness',
        is_public: true,
        // Preserve original logged_at so the time pill on each card stays
        // accurate. New rows the user just added won't have a loggedAt and
        // fall back to day._date.
        logged_at: e.loggedAt || fallbackIso,
        wellness_type: e.activity || null,
        wellness_emoji: e.emoji || null,
        wellness_duration_min: typeof e.duration === 'number' ? e.duration : null,
        notes: e.notes || null,
        photo_url: e.photo_url || null,
      }));
      await supabase.from('activity_logs').insert(rows);
    } catch (err) {
      console.warn('[saveWellness] failed:', err);
    }
  }

  // ── Apply tier-specific cosmetic effects to the card ────────────────────
  // Each level layers visual treatment via CSS classes. Higher levels stack.
  // L2 Bronze   → bronze gradient bg + bronze border
  // L3 Silver   → silver gradient bg + silver border (avatar gets the ring)
  // L4 Gold     → gold gradient bg + gold border + gold shimmer name
  // L5 Emerald  → emerald gradient bg + pulsing emerald border
  // L6 Diamond  → diamond cyan/dark-teal bg + cyan shimmer sweep
  // All gradients keep a dark base (#0E1118 / #0F172A range) with metal-tinted
  // overlays so white text stays readable. We don't use light metallic
  // backgrounds because they wash out copy.
  const lvl = userLevel;
  const tierCardClass =
    lvl >= 6 ? "diamond-shimmer-card tier-diamond-card" :
    lvl >= 5 ? "tier-emerald-card" :
    lvl >= 4 ? "tier-gold-card"    :
    lvl >= 3 ? "tier-silver-card"  :
    lvl >= 2 ? "tier-bronze-card"  : "";

  // Level-specific card BACKGROUND + BORDER, applied as inline style.
  // Each gradient is dark-base → metal-tinted-mid → dark-base, giving the
  // card a subtle metal sheen across its body without sacrificing contrast.
  const tierCardStyle: React.CSSProperties =
    lvl >= 6 ? { background: "linear-gradient(135deg, #0F172A 0%, #164E63 35%, #1E3A5F 50%, #164E63 65%, #0F172A 100%)", border: "1.5px solid #67E8F9", boxShadow: "0 0 16px rgba(34,211,238,0.35), 0 4px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(186,230,253,0.2)" } :
    lvl >= 5 ? { background: "linear-gradient(135deg, #0A1F18 0%, #0F3D2E 40%, #134E3A 50%, #0F3D2E 60%, #0A1F18 100%)", border: "1.5px solid #10B981" } :
    lvl >= 4 ? { background: "linear-gradient(135deg, #1F1A0A 0%, #3D2F00 40%, #4A3A00 50%, #3D2F00 60%, #1F1A0A 100%)", border: "1.5px solid #FFD700", boxShadow: "0 0 16px rgba(255,215,0,0.30), 0 4px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(252,211,77,0.2)" } :
    lvl >= 3 ? { background: "linear-gradient(135deg, #14161C 0%, #2A2D38 40%, #383B47 50%, #2A2D38 60%, #14161C 100%)", border: "1.5px solid #C0C0C0", boxShadow: "0 0 14px rgba(220,220,235,0.25), 0 4px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)" } :
    lvl >= 2 ? { background: "linear-gradient(135deg, #1A0E05 0%, #3A2410 40%, #4A2D14 50%, #3A2410 60%, #1A0E05 100%)", border: "1.5px solid #CD7F32", boxShadow: "0 0 14px rgba(205,127,50,0.30), 0 4px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(232,168,124,0.2)" } :
    /* L1: default light card */
    { background: C.white, border: `2px solid ${C.purpleMid}`, boxShadow: "0 4px 18px rgba(124,58,237,0.10)" };

  // Header background — when card body is dark-themed (L2+), the open header
  // needs a slightly brighter shade to differentiate it from the collapsed
  // body color. White card (L1) keeps the original purple/white toggle.
  const headerOpenBg   = lvl >= 2 ? "rgba(255,255,255,0.06)" : "#2D1F52";
  const headerClosedBg = lvl >= 2 ? "transparent"            : C.white;

  return (<>
    {lb && <Lightbox src={lb} onClose={()=>setLb(null)}/>}
    <div className={tierCardClass} style={{...tierCardStyle, borderRadius:22, marginBottom:16, overflow:"hidden"}}>

      {/* HEADER */}
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:16,padding:"20px 24px",cursor:"pointer",background:open?headerOpenBg:headerClosedBg,border:"none",textAlign:"left",borderRadius:open?"22px 22px 0 0":"22px",transition:"background 0.2s"}}>
        <div style={{width:64,height:64,borderRadius:18,flexShrink:0,background:`linear-gradient(135deg,#4ADE80,#22C55E)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(74,222,128,0.3)"}}>
          <span style={{color:"#fff",fontWeight:900,fontSize:24,lineHeight:1}}>{d}</span>
          <span style={{color:"rgba(255,255,255,0.85)",fontSize:11,fontWeight:700}}>{MONTHS[m-1]}</span>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:900,fontSize:19,color:C.text}}>{day.label}</div>
          <div style={{fontSize:13,color:C.sub,marginTop:3}}>{workout?(()=>{
            const cardioList = ((workout as any).cardio || []) as any[];
            const exList = workout.exercises || [];
            const parts: string[] = [];
            const cardioByType: Record<string,{dist:number;dur:number}> = {};
            cardioList.forEach((c:any)=>{
              const t = (c.type||'Cardio') as string;
              if(!cardioByType[t]) cardioByType[t]={dist:0,dur:0};
              cardioByType[t].dist += parseFloat(String(c.distance))||0;
              cardioByType[t].dur  += parseFloat(String(c.duration))||0;
            });
            Object.entries(cardioByType).forEach(([type,{dist,dur}])=>{
              if(dist>0) parts.push(`${dist.toFixed(2)} mi ${type.toLowerCase()}`);
              else if(dur>0) parts.push(`${dur} min ${type.toLowerCase()}`);
              else parts.push(type);
            });
            if(exList.length>0) parts.push(workout.type||'Workout');
            const summary = parts.length>0 ? parts.join(' & ') : (workout.type||'Workout');
            const extras = [
              workout.duration&&workout.duration!=='—'?`⏱ ${workout.duration}`:null,
              workout.calories>0?`🔥 ${workout.calories} cal`:null,
            ].filter(Boolean).join('  ·  ');
            return '💪 ' + summary + (extras ? '  ·  ' + extras : '');
          })():"😴 Rest day"}</div>
          {nutrition&&<div style={{fontSize:12,color:C.sub,marginTop:2}}>🥗 {nutrition.calories} kcal  ·  🥩 {nutrition.protein}g protein</div>}
        </div>
        <div style={{width:34,height:34,borderRadius:"50%",background:"#2D1F52",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s"}}>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2.5" style={{width:16,height:16}}><path d="M6 9l6 6 6-6"/></svg>
        </div>
        {photos.length > 0 && (
          <div style={{width:40,height:40,borderRadius:10,overflow:"hidden",flexShrink:0,border:`1px solid ${C.purpleMid}`}}>
            <img src={ImagePresets.thumb(photos[0])} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
          </div>
        )}
        {onDelete && (
          <div style={{position:"relative",flexShrink:0}} onClick={e=>e.stopPropagation()}>
            {!confirmDel
              ? <button onClick={()=>setConfirmDel(true)} style={{width:34,height:34,borderRadius:"50%",background:"#FEE2E2",border:"none",color:"#EF4444",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
              : <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={()=>onDelete()} style={{padding:"5px 10px",borderRadius:10,border:"none",background:"#EF4444",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"}}>Delete</button>
                  <button onClick={()=>setConfirmDel(false)} style={{padding:"5px 10px",borderRadius:10,border:`1px solid ${C.purpleMid}`,background:"#0D0D0D",color:C.sub,fontWeight:800,fontSize:12,cursor:"pointer"}}>Cancel</button>
                </div>
            }
          </div>
        )}
      </button>

      {/* BODY */}
      {open && <div style={{padding:"24px 24px 28px",borderTop:`2px solid ${C.purpleMid}`,background:"#1E1530"}}>

        {/* Photos */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>Photos</span>
            <label style={{fontSize:13,fontWeight:700,padding:"6px 16px",borderRadius:20,background:"#2D1F52",color:"#A78BFA",cursor:"pointer"}}>
              📷 Add Photos<input type="file" accept="image/*" multiple style={{display:"none"}} onChange={onFiles}/>
            </label>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {photos.map((src,i)=>(
              <div key={i} style={{position:"relative",borderRadius:16,overflow:"hidden",border:`2px solid ${C.purpleMid}`}}>
                <img onClick={()=>setLb(src)} src={ImagePresets.thumb(src)} loading="lazy" decoding="async" style={{width:108,height:108,objectFit:"cover",display:"block",cursor:"pointer"}} alt="" onError={e=>{(e.target as HTMLImageElement).parentElement!.style.display='none'}}/>
                <button onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:4,right:4,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.65)",border:"none",color:"#fff",fontSize:13,lineHeight:"22px",textAlign:"center",cursor:"pointer",padding:0}}>×</button>
              </div>
            ))}
            <label style={{width:108,height:108,borderRadius:16,border:`2px dashed ${C.purpleMid}`,background:"#1A1230",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:4}}>
              <span style={{fontSize:28,color:C.purple}}>+</span>
              <span style={{fontSize:12,fontWeight:600,color:C.purple}}>Add</span>
              <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={onFiles}/>
            </label>
          </div>
        </div>

        {/* ── WORKOUT ── */}
        {editWo ? (
          <div style={{borderRadius:18,border:`2px solid ${C.purple}`,marginBottom:20,overflow:"hidden"}}>
            <div style={{background:`linear-gradient(135deg,${C.purple},#A78BFA)`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:900,fontSize:16,color:"#fff"}}>✏️ Edit Workout</span>
            </div>
            <div style={{background:"#1A1230",padding:16,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                <div><label style={{fontSize:11,fontWeight:700,color:C.sub,display:"block",marginBottom:4}}>WORKOUT TYPE</label><input style={iStyle} value={woBuf.type} onChange={e=>setWoBuf(w=>({...w,type:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:700,color:C.sub,display:"block",marginBottom:4}}>DURATION</label><input style={iStyle} value={woBuf.duration} onChange={e=>setWoBuf(w=>({...w,duration:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:700,color:C.sub,display:"block",marginBottom:4}}>CALORIES BURNED</label><input style={iStyle} type="number" value={woBuf.calories} onChange={e=>setWoBuf(w=>({...w,calories:+e.target.value}))}/></div>
              </div>
              <div style={{borderTop:`1px solid ${C.purpleMid}`,paddingTop:12,marginTop:4}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>Exercises</span>
                  <button onClick={()=>setWoBuf(w=>({...w,exercises:[...w.exercises,{name:"",sets:3,reps:10,weight:""}]}))} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:"#0D0D0D",color:C.purple,border:"1.5px solid #7C3AED",cursor:"pointer"}}>+ Add Exercise</button>
                </div>
                {woBuf.exercises.map((ex,i)=>{
                  const numSets = ex.sets || 1;
                  const weights: string[] = ex.weights && ex.weights.length === numSets
                    ? ex.weights
                    : Array.from({length: numSets}, (_,k) => (ex.weights?.[k] ?? ex.weight ?? ''));
                  return (
                  <div key={i} style={{background:"#0D0D0D",borderRadius:14,padding:12,marginBottom:10,border:`1px solid ${C.purpleMid}`}}>
                    {/* Name + remove */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <input style={{...iStyle,flex:1}} placeholder="Exercise name" value={ex.name} onChange={e=>setWoBuf(w=>({...w,exercises:w.exercises.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))}/>
                      <button onClick={()=>setWoBuf(w=>({...w,exercises:w.exercises.filter((_,j)=>j!==i)}))} style={{width:32,height:32,borderRadius:"50%",border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:16,cursor:"pointer",flexShrink:0}}>×</button>
                    </div>
                    {/* Sets / Reps */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                      <div>
                        <label style={{fontSize:10,fontWeight:800,color:C.sub,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:0.8}}>Sets</label>
                        <input style={iStyle} type="number" value={ex.sets} onChange={e=>{
                          const n = Math.max(1, +e.target.value);
                          setWoBuf(w=>({...w,exercises:w.exercises.map((x,j)=>{
                            if(j!==i) return x;
                            const ws = x.weights || Array(x.sets).fill(x.weight||'');
                            const lastW = [...ws].reverse().find(v=>v!=='')||x.weight||'';
                            const newWs = Array.from({length:n},(_,k)=>ws[k]??lastW);
                            return {...x,sets:n,weights:newWs};
                          })}));
                        }}/>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:800,color:C.sub,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:0.8}}>Reps</label>
                        <input style={iStyle} type="number" value={ex.reps} onChange={e=>setWoBuf(w=>({...w,exercises:w.exercises.map((x,j)=>j===i?{...x,reps:+e.target.value}:x)}))}/>
                      </div>
                    </div>
                    {/* Per-set weight with increment buttons */}
                    <label style={{fontSize:10,fontWeight:800,color:C.sub,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:0.8}}>Weight (lbs) per set</label>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {weights.map((_,s)=>(
                        <div key={s} style={{display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:11,color:C.sub,fontWeight:700,width:26,flexShrink:0}}>S{s+1}</span>
                          <input
                            style={{...iStyle,flex:1,padding:"6px 8px",fontSize:13}}
                            type="text" inputMode="decimal" placeholder="0"
                            value={weights[s]}
                            onChange={e=>setWoBuf(w=>({...w,exercises:w.exercises.map((x,j)=>{
                              if(j!==i) return x;
                              const ws=[...(x.weights||Array(numSets).fill(''))];
                              ws[s]=e.target.value;
                              return {...x,weights:ws,weight:ws[0]};
                            })}))}
                          />
                          {[2.5,5,10].map(d=>(
                            <button key={d} onClick={()=>{
                              setWoBuf(w=>({...w,exercises:w.exercises.map((x,j)=>{
                                if(j!==i) return x;
                                const ws=[...(x.weights||Array(numSets).fill(''))];
                                const cur=ws[s];
                                const prev=s>0?ws[s-1]:'0';
                                const base=parseFloat(cur!==''?cur:prev)||0;
                                ws[s]=String(Math.max(0,base+d));
                                return {...x,weights:ws,weight:ws[0]};
                              })})
                              );
                            }}
                              style={{fontSize:10,fontWeight:800,padding:"4px 6px",borderRadius:7,border:`1.5px solid ${C.purpleMid}`,background:"#2D1F52",color:"#A78BFA",cursor:"pointer",flexShrink:0}}>
                              +{d}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })}
              </div>
              {/* Cardio section inside workout editor */}
              <div style={{borderTop:`1px solid ${C.purpleMid}`,paddingTop:12,marginTop:4}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>🏃 Cardio</span>
                  <button onClick={()=>setWoBuf(w=>({...w,cardio:[...w.cardio,{...emptyCardio}]}))} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:"#0D0D0D",color:C.purple,border:"1.5px solid #7C3AED",cursor:"pointer"}}>+ Add Cardio</button>
                </div>
                {(woBuf.cardio || []).map((c,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 90px 90px 36px",gap:8,marginBottom:8,alignItems:"center"}}>
                    <input style={iStyle} placeholder="Type (e.g. Running, Cycling)" value={c.type} onChange={e=>setWoBuf(w=>({...w,cardio:w.cardio.map((x,j)=>j===i?{...x,type:e.target.value}:x)}))}/>
                    <input style={iStyle} placeholder="Duration" value={c.duration} onChange={e=>setWoBuf(w=>({...w,cardio:w.cardio.map((x,j)=>j===i?{...x,duration:e.target.value}:x)}))}/>
                    <input style={iStyle} placeholder="Distance" value={c.distance} onChange={e=>setWoBuf(w=>({...w,cardio:w.cardio.map((x,j)=>j===i?{...x,distance:e.target.value}:x)}))}/>
                    <button onClick={()=>setWoBuf(w=>({...w,cardio:w.cardio.filter((_,j)=>j!==i)}))} style={{width:34,height:34,borderRadius:"50%",border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:18,cursor:"pointer",flexShrink:0}}>×</button>
                  </div>
                ))}
                {(woBuf.cardio || []).length===0 && <div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"8px 0"}}>No cardio logged — click + Add Cardio above</div>}
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={()=>setEditWo(false)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${C.purpleMid}`,background:"#0D0D0D",color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveWorkout} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save Workout</button>
              </div>
            </div>
          </div>
        ) : workout ? (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.purpleMid}`,marginBottom:20}}>
            <button onClick={()=>setWoOpen(o=>!o)} style={{width:"100%",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:26}}>💪</span>
                <div>
                  <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>{(()=>{
                    const cardioList = ((workout as any).cardio || []) as any[];
                    const exList = workout.exercises || [];
                    const parts: string[] = [];
                    const cardioByType: Record<string,{dist:number;dur:number}> = {};
                    cardioList.forEach((c:any)=>{
                      const t = (c.type||'Cardio') as string;
                      if(!cardioByType[t]) cardioByType[t]={dist:0,dur:0};
                      cardioByType[t].dist += parseFloat(String(c.distance))||0;
                      cardioByType[t].dur  += parseFloat(String(c.duration))||0;
                    });
                    Object.entries(cardioByType).forEach(([type,{dist,dur}])=>{
                      if(dist>0) parts.push(`${dist.toFixed(2)} mi ${type.toLowerCase()}`);
                      else if(dur>0) parts.push(`${dur} min ${type.toLowerCase()}`);
                      else parts.push(type);
                    });
                    if(exList.length>0) parts.push(workout.type||'Workout');
                    return parts.length>0 ? parts.join(' & ') : (workout.type||'Workout');
                  })()}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                    {workout.duration&&workout.duration!=='—'&&<span>⏱ {workout.duration}</span>}
                    {workout.calories>0&&<span>🔥 {workout.calories} cal</span>}
                    {workout.exercises&&workout.exercises.length>0&&<span>💪 {workout.exercises.length} exercise{workout.exercises.length!==1?'s':''}</span>}
                    {((workout as any).cardio||[]).length>0&&<span>🏃 {((workout as any).cardio||[]).length} cardio</span>}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span onClick={e=>{e.stopPropagation();setWoBuf({...workout,cardio:(workout as any).cardio||[]});setEditWo(true);}} style={{fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:20,background:"rgba(255,255,255,0.2)",color:"#fff",border:"1.5px solid rgba(255,255,255,0.4)",cursor:"pointer"}}>✏️ Edit</span>
                <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",transform:woOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s",flexShrink:0}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{width:14,height:14}}><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
            </button>
            {woOpen && <div style={{background:"#1A1230",padding:"12px 16px"}}>
              {(() => {
                // When the bucketing layer attached _workoutParts (>= 2 entries),
                // render a labeled section per workout instead of one combined
                // exercise + cardio table. This keeps the totals header but
                // makes each individual workout visible/distinguishable.
                const parts: any[] = (day as any)._workoutParts || [];
                const hasMultiple = parts.length >= 2;

                // Helper that renders a single workout's exercise + cardio
                // tables. Used for both "single combined" and "section per
                // workout" modes.
                const renderWorkoutBody = (w: any, key: string) => {
                  const exList = w.exercises || [];
                  const carList = w.cardio || [];
                  const totalSets = exList.reduce((s: number, ex: any) => s + (ex.sets || 0), 0);
                  const totalVol = exList.reduce((s: number, ex: any) => {
                    const wt = parseFloat(String(ex.weight)) || 0;
                    return s + (wt * (ex.sets || 0) * (ex.reps || 0));
                  }, 0);
                  return (
                    <div key={key}>
                      {exList.length > 0 && (<>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 48px 48px 80px",gap:8,paddingBottom:8,marginBottom:4,borderBottom:`1.5px solid ${C.purpleMid}`}}>
                          {["Exercise","Sets","Reps","Weight"].map(h=><span key={h} style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8}}>{h}</span>)}
                        </div>
                        {exList.map((ex: any, i: number) => {
                          const wsArr: string[] = ex.weights && Array.isArray(ex.weights) ? ex.weights : [];
                          const weightDisplay = wsArr.length > 1
                            ? wsArr.join(' / ') + ' lbs'
                            : (wsArr[0] || ex.weight || '—');
                          return (
                            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 48px 48px 80px",gap:8,padding:"10px 8px",borderRadius:10,background:i%2===0?`${C.purpleMid}55`:"transparent"}}>
                              <span style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ex.name}</span>
                              <span style={{fontSize:15,fontWeight:900,color:C.purple,textAlign:"center"}}>{ex.sets}</span>
                              <span style={{fontSize:15,fontWeight:900,color:C.purple,textAlign:"center"}}>{ex.reps}</span>
                              <span style={{fontSize:12,fontWeight:800,color:C.gold,textAlign:"center"}}>{weightDisplay}</span>
                            </div>
                          );
                        })}
                        {totalVol > 0 && (
                          <div style={{display:"flex",gap:16,padding:"10px 8px 4px",borderTop:`1px solid ${C.purpleMid}`,marginTop:4,flexWrap:"wrap"}}>
                            <span style={{fontSize:12,color:C.sub}}><strong style={{color:C.text,fontWeight:800}}>{totalSets}</strong> total sets</span>
                            <span style={{fontSize:12,color:C.sub}}><strong style={{color:C.gold,fontWeight:800}}>📊 {totalVol>=1000?`${(totalVol/1000).toFixed(1)}k`:totalVol.toFixed(0)} lbs</strong> total volume</span>
                          </div>
                        )}
                      </>)}
                      {carList.length > 0 && (
                        <div style={{marginTop: exList.length > 0 ? 12 : 0, paddingTop: exList.length > 0 ? 12 : 0, borderTop: exList.length > 0 ? `1px solid ${C.purpleMid}` : "none"}}>
                          <div style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>🏃 Cardio</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:8,paddingBottom:6,marginBottom:4,borderBottom:`1px solid ${C.purpleMid}`}}>
                            {["Type","Duration","Distance"].map(h=><span key={h} style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8}}>{h}</span>)}
                          </div>
                          {carList.map((c: any, i: number)=>(
                            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:8,padding:"8px 4px",borderRadius:10,background:i%2===0?`${C.purpleMid}55`:"transparent"}}>
                              <span style={{fontSize:14,fontWeight:600,color:C.text}}>{c.type}</span>
                              <span style={{fontSize:14,fontWeight:700,color:C.purple,textAlign:"center"}}>{c.duration}</span>
                              <span style={{fontSize:14,fontWeight:700,color:C.gold,textAlign:"center"}}>{c.distance}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {exList.length === 0 && carList.length === 0 && (
                        <div style={{textAlign:"center",padding:"12px 0",color:C.sub,fontSize:13}}>No exercises logged</div>
                      )}
                    </div>
                  );
                };

                if (hasMultiple) {
                  return parts.map((p: any, idx: number) => {
                    // Format the workout time as "7:14 AM" using the user's locale.
                    let timeStr = '';
                    try {
                      timeStr = new Date(p.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    } catch { timeStr = ''; }
                    return (
                      <div key={p.id} style={{ marginBottom: idx < parts.length - 1 ? 16 : 0, paddingBottom: idx < parts.length - 1 ? 16 : 0, borderBottom: idx < parts.length - 1 ? `2px dashed ${C.purpleMid}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg, ${C.purple}, #A78BFA)`, padding: '4px 10px', borderRadius: 999, letterSpacing: 0.5 }}>WORKOUT {idx + 1}</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{p.type}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 10, fontSize: 12, color: C.sub, flexWrap: 'wrap' }}>
                            {timeStr && <span>🕐 {timeStr}</span>}
                            {p.duration && p.duration !== '—' && <span>⏱ {p.duration}</span>}
                            {p.calories > 0 && <span>🔥 {p.calories} cal</span>}
                          </div>
                        </div>
                        {renderWorkoutBody(p, p.id)}
                      </div>
                    );
                  });
                }

                // Single workout (or legacy) — render the merged shape directly.
                return renderWorkoutBody(workout, 'single');
              })()}
            </div>}
          </div>
        ) : (
          <div style={{borderRadius:18,padding:24,textAlign:"center",background:"#1A1230",border:"2px solid #3D2A6E",marginBottom:20}}>
            <div style={{fontSize:34,marginBottom:8}}>😴</div>
            <div style={{fontSize:15,fontWeight:600,color:C.sub,marginBottom:12}}>No workout logged</div>
            <button onClick={()=>{setWoBuf({type:"",duration:"",calories:0,exercises:[]});setEditWo(true);}} style={{padding:"10px 24px",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:C.white,fontWeight:700,cursor:"pointer"}}>+ Log Workout</button>
          </div>
        )}

        {/* ── NUTRITION ── */}
        {editNut ? (
          <div style={{borderRadius:18,border:`2px solid ${C.purple}`,overflow:"hidden"}}>
            <div style={{background:`linear-gradient(135deg,${C.purple},#A78BFA)`,padding:"14px 20px"}}>
              <span style={{fontWeight:900,fontSize:16,color:"#fff"}}>✏️ Edit Nutrition</span>
            </div>
            <div style={{background:"#1A1230",padding:16,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[{l:"Calories",k:"calories"},{l:"Protein (g)",k:"protein"},{l:"Carbs (g)",k:"carbs"},{l:"Fat (g)",k:"fat"},{l:"Sugar (g)",k:"sugar"}].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:11,fontWeight:700,color:C.sub,display:"block",marginBottom:4}}>{f.l}</label>
                    <input style={iStyle} type="number" value={(nutBuf as any)[f.k]} onChange={e=>setNutBuf(n=>({...n,[f.k]:+e.target.value}))}/>
                  </div>
                ))}
              </div>

              <div style={{borderTop:`1px solid ${C.purpleMid}`,paddingTop:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>Meals</span>
                  <button onClick={()=>setNutBuf(n=>({...n,meals:[...n.meals,{key:"Snack",emoji:"🍎",name:"",cal:0}]}))} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:"#0D0D0D",color:C.purple,border:"1.5px solid #7C3AED",cursor:"pointer"}}>+ Add Meal</button>
                </div>
                {nutBuf.meals.map((meal,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"50px 90px 1fr 80px 36px",gap:8,marginBottom:8,alignItems:"center"}}>
                    <input style={iStyle} placeholder="😊" value={meal.emoji} onChange={e=>setNutBuf(n=>({...n,meals:n.meals.map((x,j)=>j===i?{...x,emoji:e.target.value}:x)}))}/>
                    <input style={iStyle} placeholder="Meal type" value={meal.key} onChange={e=>setNutBuf(n=>({...n,meals:n.meals.map((x,j)=>j===i?{...x,key:e.target.value}:x)}))}/>
                    <input style={iStyle} placeholder="What did you eat?" value={meal.name} onChange={e=>setNutBuf(n=>({...n,meals:n.meals.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))}/>
                    <input style={iStyle} type="number" placeholder="kcal" value={meal.cal} onChange={e=>setNutBuf(n=>({...n,meals:n.meals.map((x,j)=>j===i?{...x,cal:+e.target.value}:x)}))}/>
                    <button onClick={()=>setNutBuf(n=>({...n,meals:n.meals.filter((_,j)=>j!==i)}))} style={{width:34,height:34,borderRadius:"50%",border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:18,cursor:"pointer"}}>×</button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={()=>setEditNut(false)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${C.purpleMid}`,background:"#0D0D0D",color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveNutrition} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save Nutrition</button>
              </div>
            </div>
          </div>
        ) : nutrition ? (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.purpleMid}`}}>
            <button onClick={()=>setNut(n=>!n)} style={{width:"100%",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:26}}>🥗</span>
                <div>
                  <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>Nutrition</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>{nutrition.calories} kcal  ·  {nutrition.protein}g protein  ·  {nutrition.sugar}g sugar</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span onClick={e=>{e.stopPropagation();setNutBuf({...nutrition});setEditNut(true);}} style={{fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:20,background:"rgba(255,255,255,0.2)",color:"#fff",border:"1.5px solid rgba(255,255,255,0.4)",cursor:"pointer"}}>✏️ Edit</span>
                <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",transform:nut?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s",flexShrink:0}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{width:14,height:14}}><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
            </button>
            <div style={{background:"#1A1230",padding:16}}>
              {/* Macro progress vs goals (if goals set) */}
              {(()=>{
                let goals: any = null;
                try { goals = (user as any)?.profile?.nutrition_goals || null; } catch {}
                if (!goals) return null;
                const rows = [
                  {label:"Calories",val:nutrition.calories,goal:goals.calories||0,unit:"kcal",color:C.gold},
                  {label:"Protein",val:nutrition.protein,goal:goals.protein||0,unit:"g",color:"#3B82F6"},
                  {label:"Carbs",val:nutrition.carbs,goal:goals.carbs||0,unit:"g",color:"#7C3AED"},
                  {label:"Fat",val:nutrition.fat,goal:goals.fat||0,unit:"g",color:"#C084FC"},
                ];
                return (
                  <div style={{marginBottom:16,display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>📊 vs Daily Goal</div>
                    {rows.filter(r=>r.goal>0).map(r=>{
                      const pct = Math.min((r.val/r.goal)*100,100);
                      const over = r.val > r.goal;
                      const barColor = over ? "#EF4444" : pct >= 90 ? "#7C3AED" : r.color;
                      return (
                        <div key={r.label}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,color:C.sub,marginBottom:3}}>
                            <span>{r.label}</span>
                            <span style={{color:over?"#EF4444":C.text}}>{r.val}{r.unit} / {r.goal}{r.unit} {over?"🔴 over":"✅"}</span>
                          </div>
                          <div style={{height:6,borderRadius:3,background:"#2D1F52",overflow:"hidden"}}>
                            <div style={{height:"100%",borderRadius:3,background:barColor,width:`${pct}%`,transition:"width 0.4s"}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:nut?20:0}}>
                {[{label:"Calories",val:nutrition.calories,unit:"kcal",color:C.gold,max:3000},{label:"Protein",val:nutrition.protein,unit:"g",color:"#3B82F6",max:250},{label:"Carbs",val:nutrition.carbs,unit:"g",color:C.purple,max:300},{label:"Fat",val:nutrition.fat,unit:"g",color:"#4ADE80",max:100}].map(mc=>(
                  <div key={mc.label} style={{background:"#0D0D0D",borderRadius:14,padding:"12px 6px",textAlign:"center",border:"1.5px solid #3D2A6E"}}>
                    <div style={{fontSize:20,fontWeight:900,color:mc.color}}>{mc.val}</div>
                    <div style={{fontSize:11,color:C.sub}}>{mc.unit}</div>
                    <div style={{height:5,borderRadius:3,background:"#2D1F52",margin:"6px 0 4px",overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:3,background:mc.color,width:`${Math.min((mc.val/mc.max)*100,100)}%`}}/>
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:C.sub}}>{mc.label}</div>
                  </div>
                ))}
              </div>
              {nut && <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Nutrition photos — supports JSON per-meal photos or legacy array */}
                {(()=>{
                  const photoUrls: string[] = (nutrition as any).photoUrls || [];
                  // Try to parse any URL that looks like JSON (per-meal photos)
                  const parsedMealPhotos: Record<string,string> = {};
                  const plainPhotos: string[] = [];
                  photoUrls.forEach((url: string) => {
                    if (url && url.trim().startsWith('{')) {
                      try { Object.assign(parsedMealPhotos, JSON.parse(url)); } catch {}
                    } else if (url) {
                      plainPhotos.push(url);
                    }
                  });
                  const MEAL_LABELS: Record<string,string> = {
                    Breakfast:'🌅 Breakfast', Lunch:'☀️ Lunch', Dinner:'🌙 Dinner', Snack:'🍎 Snack',
                    'Pre-workout':'⚡ Pre-WO', 'Post-workout':'💪 Post-WO',
                  };
                  const hasMealPhotos = Object.keys(parsedMealPhotos).length > 0;
                  const hasPlainPhotos = plainPhotos.length > 0;
                  if (!hasMealPhotos && !hasPlainPhotos) return null;
                  return (
                    <div style={{marginBottom:8}}>
                      {hasMealPhotos && (
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
                          {Object.entries(parsedMealPhotos).map(([meal, src])=>(
                            <div key={meal} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                              <button onClick={()=>setLb(src)} style={{padding:0,border:`2px solid ${C.purpleMid}`,borderRadius:12,overflow:"hidden",cursor:"pointer",background:"none"}}>
                                <img src={ImagePresets.thumb(src)} loading="lazy" decoding="async" style={{width:90,height:90,objectFit:"cover",display:"block"}} alt={meal}/>
                              </button>
                              <span style={{fontSize:10,fontWeight:700,color:C.sub}}>{MEAL_LABELS[meal]||meal}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasPlainPhotos && (
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          {plainPhotos.map((src, i)=>(
                            <button key={i} onClick={()=>setLb(src)} style={{padding:0,border:`2px solid ${C.purpleMid}`,borderRadius:12,overflow:"hidden",cursor:"pointer",background:"none"}}>
                              <img src={ImagePresets.thumb(src)} loading="lazy" decoding="async" style={{width:90,height:90,objectFit:"cover",display:"block"}} alt="Meal photo"/>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {nutrition.meals.map(meal=>(
                  <div key={meal.key} style={{background:"#0D0D0D",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,border:"1.5px solid #3D2A6E"}}>
                    <div style={{width:46,height:46,borderRadius:13,background:"#2D1F52",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{meal.emoji}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontWeight:800,fontSize:15,color:C.text}}>{meal.key}</span>
                        <span style={{fontWeight:900,fontSize:15,color:C.gold}}>{meal.cal} kcal</span>
                      </div>
                      <div style={{fontSize:13,color:C.sub,marginTop:2}}>{meal.name}</div>
                    </div>
                  </div>
                ))}
              </div>}
            </div>
          </div>
        ) : (
          <div style={{borderRadius:18,padding:24,textAlign:"center",background:"#1A1230",border:"2px solid #3D2A6E"}}>
            <div style={{fontSize:34,marginBottom:8}}>🥗</div>
            <div style={{fontSize:15,fontWeight:600,color:C.sub,marginBottom:12}}>No nutrition logged</div>
            <button onClick={()=>{setNutBuf({calories:0,protein:0,carbs:0,fat:0,sugar:0,meals:[]});setEditNut(true);}} style={{padding:"10px 24px",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:C.white,fontWeight:700,cursor:"pointer"}}>+ Log Nutrition</button>
          </div>
        )}

        {/* ── WELLNESS ── */}
        {editWell ? (
          <div style={{borderRadius:18,border:`2px solid ${C.purple}`,overflow:"hidden",marginTop:16}}>
            <div style={{background:`linear-gradient(135deg,${C.purple},#A78BFA)`,padding:"14px 20px"}}>
              <span style={{fontWeight:900,fontSize:16,color:"#fff"}}>✏️ Edit Wellness</span>
            </div>
            <div style={{background:"#1A1230",padding:16,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>Activities</span>
                <button onClick={()=>setWellBuf(w=>({entries:[...w.entries,{...emptyWellness}]}))} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:"#0D0D0D",color:C.purple,border:"1.5px solid #7C3AED",cursor:"pointer"}}>+ Add Activity</button>
              </div>
              {wellBuf.entries.map((e,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"40px 1fr 80px 32px",gap:8,alignItems:"center"}}>
                  <input style={iStyle} placeholder="🧘" value={e.emoji} onChange={ev=>setWellBuf(w=>({entries:w.entries.map((x,j)=>j===i?{...x,emoji:ev.target.value}:x)}))}/>
                  <input style={iStyle} placeholder="Activity (e.g. Cold Plunge)" value={e.activity} onChange={ev=>setWellBuf(w=>({entries:w.entries.map((x,j)=>j===i?{...x,activity:ev.target.value}:x)}))}/>
                  <input style={iStyle} placeholder="Notes (optional)" value={e.notes} onChange={ev=>setWellBuf(w=>({entries:w.entries.map((x,j)=>j===i?{...x,notes:ev.target.value}:x)}))}/>
                  <button onClick={()=>setWellBuf(w=>({entries:w.entries.filter((_,j)=>j!==i)}))} style={{width:34,height:34,borderRadius:"50%",border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:18,cursor:"pointer"}}>×</button>
                </div>
              ))}
              {wellBuf.entries.length===0 && <div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"8px 0"}}>Add wellness activities like meditation, cold plunge, sauna, stretching...</div>}
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={()=>setEditWell(false)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${C.purpleMid}`,background:"#0D0D0D",color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveWellness} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save</button>
              </div>
            </div>
          </div>
        ) : wellness ? (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.purpleMid}`,marginTop:16}}>
            <button onClick={()=>setWellOpen(o=>!o)} style={{width:"100%",background:`linear-gradient(135deg,#7C3AED,#A78BFA)`,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:24}}>🌿</span>
                <div>
                  <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>Wellness</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.85)"}}>{wellness.entries.map(e=>e.activity).join("  ·  ")}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span onClick={e=>{e.stopPropagation();setWellBuf({...wellness});setEditWell(true);}} style={{fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:20,background:"rgba(255,255,255,0.2)",color:"#fff",border:"1.5px solid rgba(255,255,255,0.4)",cursor:"pointer"}}>✏️ Edit</span>
                <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",transform:wellOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s",flexShrink:0}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{width:14,height:14}}><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
            </button>
            {wellOpen && <div style={{background:"#1A1230",padding:14,display:"flex",flexDirection:"column",gap:8}}>
              {wellness.entries.map((e,i)=>{
                // Per-activity styling — pulls emoji + accent color from
                // WELLNESS_STYLES lookup. Falls back gracefully if the activity
                // isn't in the table (returns generic leaf + soft purple).
                const style = getWellnessStyle(e.activity);
                const time = formatTimeOfDay((e as any).loggedAt);
                const dur = (e as any).duration as number | null | undefined;
                return (
                  <div key={i} style={{
                    background:"#0D0D0D",borderRadius:14,padding:"12px 16px",
                    display:"flex",alignItems:"center",gap:14,
                    // Activity-color left border = subtle visual signature per type
                    borderLeft:`4px solid ${style.accent}`,
                    border:`1.5px solid #3D2A6E`,borderLeftWidth:4,borderLeftColor:style.accent,
                  }}>
                    <div style={{
                      width:44,height:44,borderRadius:13,
                      // Tinted background using the activity's accent at 20% opacity
                      background:`${style.accent}33`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:22,flexShrink:0,
                    }}>{style.emoji}</div>
                    <div style={{flex:1,minWidth:0}}>
                      {/* Top row: activity name + duration + time pills.
                          Pills use the activity's accent color so each card
                          has a coordinated palette. */}
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontWeight:800,fontSize:15,color:C.text}}>{e.activity}</span>
                        {dur != null && dur > 0 && (
                          <span style={{
                            fontSize:11,fontWeight:800,padding:"3px 9px",borderRadius:999,
                            background:`${style.accent}22`,color:style.accent,
                            letterSpacing:0.3,
                          }}>{dur} min</span>
                        )}
                        {time && (
                          <span style={{
                            fontSize:11,fontWeight:600,color:C.sub,
                          }}>{time}</span>
                        )}
                      </div>
                      {e.notes && <div style={{fontSize:13,color:C.sub,marginTop:4,lineHeight:1.4}}>{e.notes}</div>}
                      {(e as any).photo_url && (
                        <button onClick={()=>setLb((e as any).photo_url)} style={{ padding:0, border:`2px solid #2A3A2A`, borderRadius:10, overflow:"hidden", cursor:"pointer", background:"none", flexShrink:0, marginTop:8 }}>
                          <img src={ImagePresets.thumb((e as any).photo_url)} loading="lazy" decoding="async" style={{ width:60, height:60, objectFit:"cover", display:"block" }} alt=""/>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        ) : (
          <div style={{borderRadius:18,padding:24,textAlign:"center",background:"#1A1230",border:"2px solid #3D2A6E",marginTop:16}}>
            <div style={{fontSize:34,marginBottom:8}}>🌿</div>
            <div style={{fontSize:15,fontWeight:600,color:C.sub,marginBottom:12}}>No wellness logged</div>
            <button onClick={()=>{setWellBuf({entries:[]});setEditWell(true);}} style={{padding:"10px 24px",borderRadius:14,border:"none",background:`linear-gradient(135deg,#7C3AED,#A78BFA)`,color:"#fff",fontWeight:700,cursor:"pointer"}}>+ Log Wellness</button>
          </div>
        )}
        {/* ── BADGES ── */}
        {earnedBadges.length > 0 && (
          <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${C.purpleMid}` }}>
            <div style={{ fontSize:11, fontWeight:800, color:C.sub, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>🏆 Badges</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {(showAllBadges ? earnedBadges : earnedBadges.slice(0, 3)).map(badgeId => {
                const badge = BADGES.find(b => b.id === badgeId);
                if (!badge) return null;
                return (
                  <div key={badgeId} style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(245,166,35,0.12)", border:"1.5px solid rgba(245,166,35,0.35)", borderRadius:99, padding:"5px 12px" }}>
                    <span style={{ fontSize:14 }}>{badge.emoji}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"#F5A623" }}>{badge.label}</span>
                  </div>
                );
              })}
              {earnedBadges.length > 3 && (
                <button onClick={() => setShowAllBadges(s => !s)} style={{ display:"flex", alignItems:"center", background:"rgba(245,166,35,0.08)", border:"1.5px dashed rgba(245,166,35,0.3)", borderRadius:99, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#F5A623" }}>{showAllBadges ? "Show less" : `+${earnedBadges.length - 3} more`}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>}
    </div>
  </>);
}

// ── Editable sidebar section ──────────────────────────────────────────────────
function EditableList({title,items,onSave,renderItem,emptyItem}:{
  title:string;
  items:any[];
  onSave:(i:any[])=>void;
  renderItem:(item:any,i:number,setItems:React.Dispatch<React.SetStateAction<any[]>>)=>React.ReactNode;
  emptyItem:any;
}) {
  const [editing,setEditing] = useState(false);
  const [list,setList]       = useState(items);
  if (editing) return (
    <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.purple}`,marginBottom:20}}>
      <div style={{fontWeight:900,fontSize:17,color:C.text,marginBottom:16}}>{title}</div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
        {list.map((item,i)=>renderItem(item,i,setList))}
      </div>
      <button onClick={()=>setList(l=>[...l,{...emptyItem}])} style={{width:"100%",padding:"9px 0",borderRadius:12,border:`2px dashed ${C.purpleMid}`,background:"#2D1F52",color:"#A78BFA",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12}}>+ Add</button>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setEditing(false)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${C.purpleMid}`,background:"#0D0D0D",color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
        <button onClick={()=>{onSave(list);setEditing(false);}} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.purple},#4ADE80)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save</button>
      </div>
    </div>
  );
  return (
    <div style={{background:"#111811",borderRadius:22,padding:24,border:`1.5px solid #2A3A2A`,marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:900,fontSize:17,color:C.text}}>{title}</div>
        <button onClick={()=>setEditing(true)} style={{fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:20,background:"#1A2A1A",color:C.purple,border:`1px solid #2A3A2A`,cursor:"pointer"}}>✏️ Edit</button>
      </div>
      {items.map((item,i)=>(
        <div key={i} style={{background:i%2===0?"#1A2A1A":"#141F14",borderRadius:14,padding:"13px 15px",marginBottom:10,display:"flex",alignItems:"center",gap:12,border:"1px solid #2A3A2A"}}>
          {item.emoji && <span style={{fontSize:24,flexShrink:0}}>{item.emoji}</span>}
          <span style={{fontSize:14,fontWeight:700,color:C.text}}>{item.name || item.label || Object.values(item).filter((_,idx)=>idx>0).join(' ')}</span>
        </div>
      ))}
    </div>
  );
}

// ── Crop Modal ────────────────────────────────────────────────────────────────
// (crop modal removed — photos use adjust-to-fit / object-fit:cover)

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const avatarSize = isMobile ? 220 : 280;

  const [profile,setProfile] = useState({
    name: "",
    username: "",
    bio: "",
    city: "",
  });

  // Sync profile state from user data
  useEffect(() => {
    if (user?.profile) {
      setProfile({
        name: user.profile.full_name || "",
        username: user.profile.username || "",
        bio: user.profile.bio || "",
        city: (user.profile as any).city || "",
      });
    }
  }, [user]);
  const [bannerImg,setBanner] = useState<string|null>(null);
  const [profileImg,setAvatar]= useState<string|null>(null);
  const [editProfile,setEditProfile] = useState(false);
  const [showLevelModal,setShowLevelModal] = useState(false);
  // Profile share button state. Shows "✓ Copied" for 2.5s after copy.
  const [profileShareCopied, setProfileShareCopied] = useState(false);

  /** Share or copy a link to the current user's profile. Native share
   *  sheet on mobile, clipboard fallback on desktop. The URL uses the
   *  username path which is the public-facing profile route. Delegates
   *  to the universal share helper. */
  async function shareProfile() {
    const username = profile?.username || (user as any)?.profile?.username;
    if (!username) {
      alert("Set a username first to share your profile.");
      return;
    }
    await shareWithToast(
      {
        url: appUrl(`/profile/${username}`),
        // The own-profile state uses `name` (not full_name) — old code
        // used profile?.full_name which always fell through to @username.
        title: `${profile?.name || "@" + username} on Livelee`,
        text: `Check out my Livelee profile`,
      },
      setProfileShareCopied
    );
  }

  const [showCustomizations, setShowCustomizations] = useState(false);
  const [customizationDetail, setCustomizationDetail] = useState<number | null>(null);
  const [repositionMode, setRepositionMode] = useState(false);
  const [bannerPosition, setBannerPosition] = useState(50); // 0-100, default center
  // Banner zoom — 100 = fit to frame, 200 = 2x zoomed in. Lets the user
  // scale their banner up to focus on a detail. Clamped 100-300.
  const [bannerScale, setBannerScale] = useState(100);
  const [bannerHovered, setBannerHovered] = useState(false);
  const [dragState, setDragState] = useState<{ startY: number; startPos: number } | null>(null);
  const [avatarRepositionMode, setAvatarRepositionMode] = useState(false);
  const [avatarPosition, setAvatarPosition] = useState(50);
  // Avatar zoom — same scheme as banner. 100 = fit, 200 = 2x.
  const [avatarScale, setAvatarScale] = useState(100);
  const [avatarDragState, setAvatarDragState] = useState<{startY:number;startPos:number}|null>(null);
  const [brands,setBrands] = useState([{emoji:"👟",name:"New Balance"},{emoji:"👕",name:"Gym Shark"},{emoji:"🎧",name:"AirPods"}]);

  // ── Crop state ──
  const [cropSrc,setCropSrc] = useState<string|null>(null);
  const [cropAspect,setCropAspect] = useState(1);
  const [cropCallback,setCropCallback] = useState<((url:string)=>void)|null>(null);

  // ── Feed photos (for All Photos modal + Highlight picker) ──
  const [feedPhotos,setFeedPhotos] = useState<string[]>([]);
  const [showHighlightPicker,setShowHighlightPicker] = useState(false);
  useEffect(()=>{
    if(!user) return;
    // Highlights are photos only — Instagram-style. We exclude videos from this
    // list so the picker grid doesn't show broken thumbnails. Posts with mixed
    // carousels still surface (we just take the first image URL).
    supabase.from('posts')
      .select('media_url, media_type, media_types')
      .eq('user_id', user.id)
      .eq('is_public', true)
      .not('media_url','is',null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v|qt)(\?|#|$)/i;
        const photoOnly = data
          .map((p: any) => p.media_url as string)
          .filter((url): url is string => Boolean(url))
          .filter((url, i) => {
            const row = data[i];
            // Skip if explicitly marked as a video, or sniffed as one from the URL.
            if (row.media_type === 'video') return false;
            if (Array.isArray(row.media_types) && row.media_types[0] === 'video') return false;
            if (VIDEO_EXT_RE.test(url)) return false;
            return true;
          });
        setFeedPhotos(photoOnly);
      });
  },[user?.id]);

  // ── Highlights state ──
  const [highlights,setHighlights] = useState<string[]>([]);
  const [highlightLb,setHighlightLb] = useState<string|null>(null);
  const [editingHighlights,setEditingHighlights] = useState(false);

  // Load persisted highlights — Supabase is source of truth.
  // localStorage is just a fallback for users who haven't saved to DB yet.
  useEffect(() => {
    if (!user) return;
    async function loadHighlights() {
      try {
        // Supabase is the source of truth. If the row exists, use whatever
        // it says — including empty array. Previously this fell through to
        // localStorage when DB had an empty array, which caused deleted
        // highlights to come back from stale localStorage cache.
        const { data, error } = await supabase.from('users').select('highlights').eq('id', user!.id).single();
        if (!error && data) {
          const dbHighlights = Array.isArray(data.highlights) ? data.highlights : [];
          // Filter to only valid URLs (not base64 blobs which may be truncated)
          const validUrls = dbHighlights.filter((u: string) => u && (u.startsWith('http') || u.startsWith('/')));
          setHighlights(validUrls);
          // Sync localStorage to match DB so future loads are consistent
          try { localStorage.setItem(`fit_highlights_${user!.id}`, JSON.stringify(validUrls)); } catch {}
          return;
        }
      } catch {}
      // Only reach here if DB query failed entirely — fall back to localStorage
      try {
        const saved = localStorage.getItem(`fit_highlights_${user!.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          const validUrls = parsed.filter((u: string) => u && (u.startsWith('http') || u.startsWith('/')));
          setHighlights(validUrls);
          // Migrate valid URLs to Supabase
          if (validUrls.length > 0) {
            supabase.from('users').update({ highlights: validUrls } as any).eq('id', user!.id).catch(() => {});
          }
        }
      } catch {}
    }
    loadHighlights();
  }, [user?.id]);

  // Track whether we've already initialized avatar/banner from auth.profile.
  // After upload we update the DB directly; the auth.profile value lags behind
  // (it's cached in the auth context), so without this guard a stale re-render
  // would overwrite the freshly uploaded URL with the old one.
  const initedAvatarRef = useRef(false);
  const initedBannerRef = useRef(false);
  const latestUploadedAvatarUrlRef = useRef<string | null>(null);
  const latestUploadedBannerUrlRef = useRef<string | null>(null);

  // Load avatar/banner from profile
  useEffect(() => {
    if (latestUploadedAvatarUrlRef.current) {
      setAvatar(latestUploadedAvatarUrlRef.current);
      initedAvatarRef.current = true;
    }
    if (latestUploadedBannerUrlRef.current) {
      setBanner(latestUploadedBannerUrlRef.current);
      initedBannerRef.current = true;
    }
    if (user?.profile?.avatar_url && !initedAvatarRef.current) {
      setAvatar(user.profile.avatar_url);
      initedAvatarRef.current = true;
    }
    if (user?.profile?.banner_url && !initedBannerRef.current) {
      setBanner(user.profile.banner_url);
      initedBannerRef.current = true;
    }
    if (user?.id) {
      // Load saved banner position
      try {
        const savedPos = localStorage.getItem(`banner_position_${user.id}`);
        if (savedPos !== null) setBannerPosition(parseFloat(savedPos));
      } catch {}
      // Also check Supabase profile for saved banner_position
      if ((user as any)?.profile?.banner_position !== undefined && (user as any)?.profile?.banner_position !== null) {
        setBannerPosition((user as any).profile.banner_position);
      }
      // Banner zoom — local first, then Supabase
      try {
        const savedScale = localStorage.getItem(`banner_scale_${user.id}`);
        if (savedScale !== null) setBannerScale(Math.max(100, Math.min(300, parseFloat(savedScale))));
      } catch {}
      if ((user as any)?.profile?.banner_scale !== undefined && (user as any)?.profile?.banner_scale !== null) {
        setBannerScale((user as any).profile.banner_scale);
      }
      // Load saved avatar position
      try {
        const savedAvatarPos = localStorage.getItem(`avatar_position_${user.id}`);
        if (savedAvatarPos !== null) setAvatarPosition(parseFloat(savedAvatarPos));
      } catch {}
      if ((user as any)?.profile?.avatar_position !== undefined && (user as any)?.profile?.avatar_position !== null) {
        setAvatarPosition((user as any).profile.avatar_position);
      }
      // Avatar zoom
      try {
        const savedAvatarScale = localStorage.getItem(`avatar_scale_${user.id}`);
        if (savedAvatarScale !== null) setAvatarScale(Math.max(100, Math.min(300, parseFloat(savedAvatarScale))));
      } catch {}
      if ((user as any)?.profile?.avatar_scale !== undefined && (user as any)?.profile?.avatar_scale !== null) {
        setAvatarScale((user as any).profile.avatar_scale);
      }
    }
  }, [user?.profile?.avatar_url, user?.profile?.banner_url, user?.id]);
  const [showAllPhotos,setShowAllPhotos] = useState(false);
  // Tagged-in modal state — opens when user taps the 🏷️ Tagged In button.
  // Modal lazily fetches its own data from /api/db get_tagged_posts so the
  // profile page render isn't blocked by an extra query.
  const [showTaggedPosts, setShowTaggedPosts] = useState(false);
  const [photoFilter,setPhotoFilter] = useState<"all"|"workout"|"nutrition"|"wellness">("all");

  // Helper: derive photo type based on index (mock data assignment)
  function getPhotoType(idx:number):"workout"|"nutrition"|"wellness" {
    if(idx<3) return "workout";
    if(idx<6) return "nutrition";
    return "wellness";
  }

  // ── Real activity log state ──
  const [realDays, setRealDays] = useState<typeof DAYS>([]);
  // Raw individual workout logs — one entry per actual logged workout
  // (not aggregated by day). Used by WorkoutProgressGraphs so multi-workout
  // days count correctly. Each entry is the full activity_logs row.
  const [rawWorkoutLogs, setRawWorkoutLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function loadLogs() {
      setLoadingLogs(true);
      try {
        // Pull a generous slice so the Workout Progress graphs can show
        // older calendar months. 60 was too tight — even casual users hit
        // that in 2 months. 500 covers ~1.5 years of daily activity for
        // most users without paginating.
        const { data } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', user!.id)
          .order('logged_at', { ascending: false })
          .limit(500);

        if (!data || data.length === 0) {
          setRealDays([]);
          setRawWorkoutLogs([]);
          setLoadingLogs(false);
          return;
        }

        // Cache the raw workout rows for the graphs component — this lets
        // it count individual workouts (including multi-per-day) instead of
        // days. The day-merged `realDays` view is still used elsewhere for
        // the activity-log card list.
        setRawWorkoutLogs(data.filter((l: any) => l.log_type === 'workout'));

        const byDate = new Map<string, any[]>();
        data.forEach((log: any) => {
          // Use local date string to correctly bucket by calendar day in user's timezone
          const d = new Date(log.logged_at);
          const key = d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }); // e.g. "04/02/2026"
          if (!byDate.has(key)) byDate.set(key, []);
          byDate.get(key)!.push(log);
        });

        const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

        // Build one card per calendar date. When multiple workouts are logged
        // on the same day, the card aggregates totals (calories/duration) but
        // RENDERS each workout as its own labeled section ("Workout 1", etc.)
        // so the user can tell them apart.
        const days: typeof DAYS = Array.from(byDate.entries()).map(([dateKey, logs]) => {
          // dateKey is "MM/DD/YYYY"
          const [month, day, year] = dateKey.split('/').map(Number);
          const date = new Date(year, month - 1, day);
          const dayName = DAY_NAMES[date.getDay()];
          const today = new Date();
          const todayStr = today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
          const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
          const yesterdayStr = yesterday.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
          const friendlyLabel = dateKey === todayStr ? 'Today' : dateKey === yesterdayStr ? 'Yesterday' : `${dayName} ${month}/${day}`;

          const workoutLogs   = logs.filter((l: any) => l.log_type === 'workout');
          const nutritionLogs = logs.filter((l: any) => l.log_type === 'nutrition');
          const wellnessLogs  = logs.filter((l: any) => l.log_type === 'wellness');

          // Sort workouts by their logged_at time, earliest first. The first
          // becomes "Workout 1", second "Workout 2", etc.
          const sortedWorkouts = [...workoutLogs].sort((a, b) =>
            new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
          );

          // Build per-workout parts (rendered as labeled sections in the card)
          const parts = sortedWorkouts.map((w: any) => ({
            id: w.id,
            type: w.workout_type || 'Workout',
            time: w.logged_at, // ISO; consumer formats with toLocaleTimeString
            duration: w.workout_duration_min ? `${w.workout_duration_min} min` : '—',
            calories: w.workout_calories || 0,
            exercises: Array.isArray(w.exercises)
              ? w.exercises.map((e: any) => ({
                  name: e.name || '',
                  sets: parseInt(e.sets) || 0,
                  reps: parseInt(e.reps) || 0,
                  weight: e.weight || '—',
                  weights: Array.isArray(e.weights) ? e.weights : [],
                }))
              : [],
            cardio: Array.isArray(w.cardio)
              ? w.cardio.map((c: any) => ({
                  type: c.type || 'Cardio',
                  duration: c.duration || '—',
                  distance: c.distance || '',
                }))
              : [],
          }));

          // Aggregate totals for the header summary (uses MERGED arrays so
          // header summary chips like "🔥 X cal" and "⏱ X min" reflect the
          // whole day's lifting + cardio across all workouts).
          let totalDurationMin = 0;
          let totalCalories = 0;
          const allExercises: any[] = [];
          const allCardio: any[] = [];
          for (const p of parts) {
            totalDurationMin += parseInt(String(p.duration)) || 0;
            totalCalories    += parseInt(String(p.calories)) || 0;
            for (const e of p.exercises) allExercises.push(e);
            for (const c of p.cardio) allCardio.push(c);
          }

          // Headline: first workout's type, plus "(+N more)" hint when there
          // are multiple workouts. Sections below the header label them.
          let workout: any = null;
          if (parts.length > 0) {
            const extraCount = parts.length - 1;
            const headline = extraCount > 0
              ? `${parts[0].type} (+${extraCount} more)`
              : parts[0].type;
            workout = {
              type: headline,
              duration: totalDurationMin > 0 ? `${totalDurationMin} min` : '—',
              calories: totalCalories,
              exercises: allExercises,
              cardio: allCardio,
            };
          }

          const totalNutCal = nutritionLogs.reduce((s: number, l: any) => s + (l.calories_total || 0), 0);
          const totalProtein  = nutritionLogs.reduce((s: number, l: any) => s + (l.protein_g || 0), 0);
          const totalCarbs    = nutritionLogs.reduce((s: number, l: any) => s + (l.carbs_g || 0), 0);
          const totalFat      = nutritionLogs.reduce((s: number, l: any) => s + (l.fat_g || 0), 0);

          const nutrition = nutritionLogs.length > 0 ? {
            calories: Math.round(totalNutCal),
            protein:  Math.round(totalProtein),
            carbs:    Math.round(totalCarbs),
            fat:      Math.round(totalFat),
            sugar:    0,
            photoUrls: nutritionLogs.map((l: any) => l.photo_url).filter(Boolean),
            meals: nutritionLogs.map((l: any) => ({
              key:   l.meal_type || 'Meal',
              emoji: '🍽️',
              name:  Array.isArray(l.food_items) && l.food_items.length > 0
                       ? l.food_items.map((f: any) => f.name).join(', ')
                       : (l.notes || 'Logged meal'),
              cal:   l.calories_total || 0,
            })),
          } : null;

          const wellness = wellnessLogs.length > 0 ? {
            entries: wellnessLogs.map((l: any) => ({
              // Emoji is now derived from activity name via the WELLNESS_STYLES
              // lookup — so users get the right icon (❄️ for cold plunge etc.)
              // without us storing it on every row. The `wellness_emoji` column
              // is a legacy fallback.
              emoji: l.wellness_emoji || getWellnessStyle(l.wellness_type || '').emoji,
              activity: l.wellness_type || l.notes || 'Wellness',
              notes: l.notes || '',
              photo_url: l.photo_url || null,
              duration: l.wellness_duration_min ?? null,
              loggedAt: l.logged_at || l.created_at || null,
            })),
          } : null;

          // Workout log IDs — array form so delete wipes ALL workouts on a day.
          const workoutLogIds = parts.map((p: any) => p.id);

          return {
            id: dateKey,
            label: friendlyLabel,
            emoji: workout ? '💪' : (nutrition ? '🥗' : (wellness ? '🌿' : '🌅')),
            workout,
            // _workoutParts is read by DayCard. When >1 part, DayCard renders
            // labeled sections instead of one combined exercise/cardio table.
            _workoutParts: parts,
            nutrition,
            wellness,
            _workoutLogId: workoutLogIds[0] || null,
            _workoutLogIds: workoutLogIds,
            _nutritionLogIds: nutritionLogs.map((l: any) => l.id),
            _wellnessLogIds: wellnessLogs.map((l: any) => l.id),
            photo_url: sortedWorkouts[0]?.photo_url || nutritionLogs[0]?.photo_url || wellnessLogs[0]?.photo_url || null,
            _date: date.getTime(),
          };
        });

        // Sort newest first so today's card is always at the top
        days.sort((a: any, b: any) => b._date - a._date);

        setRealDays(days);
      } catch (e) {
        console.error('Failed to load activity logs:', e);
        setRealDays([]);
      }
      setLoadingLogs(false);
    }
    loadLogs();
  }, [user]);

  // ── Followers / Following modal ──
  const [socialModal,setSocialModal] = useState<"followers"|"following"|null>(null);
  const [socialList,setSocialList]   = useState<{id:string;username:string;full_name:string;avatar_url:string|null}[]>([]);
  const [socialLoading,setSocialLoading] = useState(false);

  async function openSocialModal(type:"followers"|"following") {
    if (!user) return;
    setSocialModal(type);
    setSocialLoading(true);
    setSocialList([]);
    try {
      if (type === "followers") {
        const { data } = await supabase
          .from('follows')
          .select('follower_id, users!follows_follower_id_fkey(id,username,full_name,avatar_url)')
          .eq('following_id', user.id)
          .limit(100);
        setSocialList((data || []).map((r:any) => r.users).filter(Boolean));
      } else {
        const { data } = await supabase
          .from('follows')
          .select('following_id, users!follows_following_id_fkey(id,username,full_name,avatar_url)')
          .eq('follower_id', user.id)
          .limit(100);
        setSocialList((data || []).map((r:any) => r.users).filter(Boolean));
      }
    } catch {}
    setSocialLoading(false);
  }

  // ── Completed challenges (auto-badges) ──
  const [completedChallenges, setCompletedChallenges] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('challenge_participants')
      .select('*, challenges(name, emoji, group_id, deadline, is_active, groups(name))')
      .eq('user_id', user.id)
      .gt('score', 0)
      .then(({ data }) => {
        if (data) {
          const now = new Date();
          const completed = data.filter((cp: any) => {
            const ch = cp.challenges;
            if (!ch) return false;
            // Only show if deadline has passed OR is_active is false
            if (ch.deadline && new Date(ch.deadline) <= now) return true;
            if (ch.is_active === false) return true;
            return false;
          });
          setCompletedChallenges(completed);
        }
      });
  }, [user?.id]);

  // ── Badge state ──
  // Badges are fetched with the year column so yearly badges (like
  // "2026 Birthday Workout") can display the correct year.
  const [earnedBadges,setEarnedBadges] = useState<EarnedBadge[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('badges').select('badge_id, year').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setEarnedBadges(data.map((b: any) => ({ badge_id: b.badge_id, year: b.year ?? null })));
      });
  }, [user]);
  const [showBadgeModal,setShowBadgeModal] = useState(false);
  const [selectedBadge,setSelectedBadge] = useState<string>("");
  const [badgeNote,setBadgeNote] = useState("");
  const [badgeToast,setBadgeToast] = useState<string|null>(null);
  // Filter the long manual badge list — without these the modal renders ~150
  // badges in one scroll and users can't find what they want.
  const [badgeCategoryFilter,setBadgeCategoryFilter] = useState<string>("all");
  const [badgeSearch,setBadgeSearch] = useState("");
  const [showAllBadgesModal,setShowAllBadgesModal] = useState(false);
  const [badgesTab,setBadgesTab] = useState<"fitness"|"rivals">("fitness");
  const [rivalryBadges,setRivalryBadges] = useState<RivalryBadgeWithContext[]>([]);
  const [badgeCounters,setBadgeCounters] = useState<BadgeCounters>({});

  useEffect(() => {
    if (!user || !showAllBadgesModal) return;
    getAllUserRivalryBadges(user.id).then(setRivalryBadges).catch(() => setRivalryBadges([]));
  }, [user, showAllBadgesModal]);

  // Fetch current counts for each badge family so we can show progress like
  // "14 / 20 runs" on badges. One parallel batch when the modal opens.
  //
  // NOTE: wellness_type values use Title Case ("Cold Plunge", "Sauna") matching
  // what the logging UI actually writes. workout_type is currently free-text
  // (e.g. "Chest", "Deadlift day") so running/lifting counts return 0 until we
  // add proper category dropdowns to the workout logger (Fix 2).
  useEffect(() => {
    if (!user || !showAllBadgesModal) return;
    (async () => {
      const uid = user.id;
      try {
        const [
          // Existing
          runs, liftSessions, totalWorkouts, yoga, meditation, coldPlunges,
          sauna, breathwork, walks, stretching, totalWellness, nutritionLogs,
          postCount, followerCount,
          // Newly added — workout category counters
          biking, swimming, rowing, hiit, boxing, sports, pilates,
          // Newly added — wellness modality counters
          infraredSauna, redLight, massage, floatTank, mobility, journaling, sunlight,
          // Newly added — social counters
          likesReceived, commentsMade,
          // Newly added — strength PR counters (read all logs and pick max client-side)
          strengthLogs,
          // Newly added — 5K detection from running cardio entries
          fiveKLogs,
          // Workout Partner — counts workout rows where tagged_user_ids has at
          // least one entry. We use NOT IS NULL plus a Postgres array length
          // check expressed as filter (`tagged_user_ids.cs.{}` doesn't work for
          // "non-empty" — we use a server-side filter instead.)
          partnerWorkoutsResult,
        ] = await Promise.all([
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'running'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'lifting'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'yoga'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').ilike('wellness_type', 'meditation'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').or('wellness_type.ilike.cold plunge,wellness_type.ilike.ice bath'),
          // Sauna — must NOT match Infrared Sauna. We do exact match instead of ilike '%sauna%'.
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').ilike('wellness_type', 'sauna'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').ilike('wellness_type', 'breathwork'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'walking'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').ilike('wellness_type', 'stretching'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'nutrition'),
          supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', uid),
          supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', uid),
          // Workout categories that were missing
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'biking'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'swimming'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'rowing'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'hiit'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'boxing'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'sports'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'pilates'),
          // Wellness modalities — wellness_type matches the strings the post UI writes
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').ilike('wellness_type', 'infrared sauna'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').ilike('wellness_type', 'red light therapy'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').ilike('wellness_type', 'massage'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').ilike('wellness_type', 'float tank'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').or('wellness_type.ilike.mobility%,wellness_type.ilike.foam rolling'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').ilike('wellness_type', 'journaling'),
          supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('log_type', 'wellness').or('wellness_type.ilike.sunlight%,wellness_type.ilike.grounding,wellness_type.ilike.nature walk'),
          // Likes received — sum likes_count across all the user's posts.
          // We can't COUNT from `likes` because there's no post_user_id column;
          // would require a join Supabase REST won't permit through RLS. The
          // posts.likes_count denormalized counter is updated by a trigger.
          supabase.from('posts').select('likes_count').eq('user_id', uid),
          supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', uid),
          // Strength — fetch lifting logs with exercises array; compute max bench/squat/deadlift client-side
          supabase.from('activity_logs').select('exercises').eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'lifting'),
          // 5K — fetch running cardio entries; count rows where distance ≥ 3.1mi.
          // Easier than parsing JSON in Postgres. Distance lives inside the
          // cardio jsonb array as `[{ type, duration, distance }]`.
          supabase.from('activity_logs').select('cardio').eq('user_id', uid).eq('log_type', 'workout').eq('workout_category', 'running'),
          // Partner Workouts — count workout rows where tagged_user_ids is not
          // null and has at least one element. The PostgREST filter `not.is.null`
          // alone doesn't reject empty arrays, so we fetch the column and count
          // client-side. Cheap because tagged_user_ids is small.
          supabase.from('activity_logs').select('tagged_user_ids').eq('user_id', uid).eq('log_type', 'workout').not('tagged_user_ids', 'is', null),
        ]);

        // Compute strength PRs from exercises array. Each `weights` array entry
        // is parsed as a number; the max across all sessions becomes the PR.
        // Total = best bench + best squat + best deadlift across all logs.
        let benchMax = 0, squatMax = 0, deadliftMax = 0;
        const liftRows = (strengthLogs as any).data || [];
        for (const row of liftRows) {
          const exs = Array.isArray(row.exercises) ? row.exercises : [];
          for (const e of exs) {
            const name = (e.name || '').toLowerCase();
            const weightsArr: any[] = Array.isArray(e.weights) ? e.weights : [e.weight];
            for (const w of weightsArr) {
              const num = parseFloat(String(w)) || 0;
              if (num <= 0) continue;
              if (name.includes('bench')) benchMax = Math.max(benchMax, num);
              else if (name.includes('squat')) squatMax = Math.max(squatMax, num);
              else if (name.includes('deadlift')) deadliftMax = Math.max(deadliftMax, num);
            }
          }
        }
        const totalLiftMax = benchMax + squatMax + deadliftMax;

        // 5K count — number of running workouts with at least one cardio entry
        // ≥ 3.1 miles. Distance is stored as a string inside cardio jsonb;
        // parseFloat strips any unit suffix like "5.2 mi".
        let fiveKCount = 0;
        const runningRows = ((fiveKLogs as any).data || []) as any[];
        for (const row of runningRows) {
          const cardioEntries = Array.isArray(row.cardio) ? row.cardio : [];
          const has5K = cardioEntries.some((c: any) => {
            const dist = parseFloat(String(c.distance ?? '')) || 0;
            return dist >= 3.1;
          });
          if (has5K) fiveKCount++;
        }

        // Sum likes_count across the user's posts (since `likesReceived` is
        // a sum of counts, not a row count).
        const likesReceivedTotal = ((likesReceived as any).data || []).reduce(
          (s: number, p: any) => s + (p.likes_count || 0), 0
        );

        // Partner workouts — count rows where tagged_user_ids is a non-empty
        // array. PostgREST returns the column raw; we filter empty arrays
        // here so old rows without tags don't accidentally count.
        const partnerRows = ((partnerWorkoutsResult as any).data || []) as any[];
        const partnerWorkouts = partnerRows.filter(
          (r: any) => Array.isArray(r.tagged_user_ids) && r.tagged_user_ids.length > 0
        ).length;

        setBadgeCounters({
          runs: runs.count ?? 0,
          liftSessions: liftSessions.count ?? 0,
          totalWorkouts: totalWorkouts.count ?? 0,
          yogaSessions: yoga.count ?? 0,
          meditationSessions: meditation.count ?? 0,
          coldPlunges: coldPlunges.count ?? 0,
          saunaSessions: sauna.count ?? 0,
          breathworkSessions: breathwork.count ?? 0,
          walks: walks.count ?? 0,
          stretchingSessions: stretching.count ?? 0,
          totalWellness: totalWellness.count ?? 0,
          nutritionLogs: nutritionLogs.count ?? 0,
          postCount: postCount.count ?? 0,
          followerCount: followerCount.count ?? 0,
          // Newly wired
          bikingSessions: biking.count ?? 0,
          swimmingSessions: swimming.count ?? 0,
          rowingSessions: rowing.count ?? 0,
          hiitSessions: hiit.count ?? 0,
          boxingSessions: boxing.count ?? 0,
          sportsSessions: sports.count ?? 0,
          pilatesSessions: pilates.count ?? 0,
          infraredSaunaSessions: infraredSauna.count ?? 0,
          redLightSessions: redLight.count ?? 0,
          massageSessions: massage.count ?? 0,
          floatTankSessions: floatTank.count ?? 0,
          mobilitySessions: mobility.count ?? 0,
          journalingSessions: journaling.count ?? 0,
          sunlightSessions: sunlight.count ?? 0,
          likesReceived: likesReceivedTotal,
          commentsMade: commentsMade.count ?? 0,
          benchMax,
          squatMax,
          deadliftMax,
          totalLiftMax,
          fiveKCount,
          partnerWorkouts,
        });
      } catch (e) {
        console.error('Failed to fetch badge counters:', e);
        setBadgeCounters({});
      }
    })();
  }, [user, showAllBadgesModal]);

  // 🏆 Tier state — computed from activity logs
  const [userTier, setUserTier] = useState<Tier>("default");
  const [tierInfo, setTierInfo] = useState(getTierInfo(0, 0));

  // ── NEW Level System v2 ────────────────────────────────────────────────────
  // Source of truth: users.current_level + users.xp_in_level + counter columns
  // populated by the level-system-v2 migration. Loads in one query.
  const [counterData, setCounterData] = useState<CounterData | null>(null);
  // Set of XP categories the user has already earned XP for today (resets daily).
  // Used to highlight already-completed categories purple in the level modal.
  const [todayXpCategories, setTodayXpCategories] = useState<Set<string>>(new Set());
  const [progressInfo, setProgressInfo] = useState<LevelProgressInfo | null>(null);
  // Modal-local state — which level is currently expanded in the breakdown
  const [modalSelectedLevel, setModalSelectedLevel] = useState<Level | null>(null);

  useEffect(() => {
    if (!user) return;
    async function loadCounters() {
      // Pull all the counter columns + xp/level + following count
      const { data: u } = await supabase
        .from('users')
        .select('*')
        .eq('id', user!.id)
        .single();

      // Compute streaks client-side from realDays — DB doesn't track these
      // (Date-gap math; longest consecutive day workout / nutrition logs)
      const computeStreak = (filterFn: (d: any) => boolean): number => {
        const dates = [...new Set(
          realDays.filter(filterFn).map((d: any) => {
            const dt = new Date(d._date || 0);
            return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
          })
        )].sort();
        if (dates.length === 0) return 0;
        // longest run of consecutive days
        let longest = 1, current = 1;
        for (let i = 1; i < dates.length; i++) {
          const [y1, m1, d1] = dates[i - 1].split('-').map(Number);
          const [y2, m2, d2] = dates[i].split('-').map(Number);
          const a = new Date(y1, m1, d1).getTime();
          const b = new Date(y2, m2, d2).getTime();
          if ((b - a) === 86400000) { current++; longest = Math.max(longest, current); }
          else current = 1;
        }
        return longest;
      };

      const workoutStreak = computeStreak((d: any) => !!d.workout);
      const nutritionStreak = computeStreak((d: any) => !!d.nutrition);

      const cd: CounterData = {
        xpInLevel:        (u as any)?.xp_in_level ?? 0,
        currentLevel:     ((u as any)?.current_level ?? 1) as Level,
        workoutsCount:    (u as any)?.workouts_count ?? 0,
        wellnessCount:    (u as any)?.wellness_count ?? 0,
        nutritionCount:   (u as any)?.nutrition_count ?? 0,
        yogaCount:        (u as any)?.yoga_count ?? 0,
        swimCount:        (u as any)?.swim_count ?? 0,
        sportsCount:      (u as any)?.sports_count ?? 0,
        feedPostsCount:   (u as any)?.feed_posts_count ?? 0,
        rivalWinsCount:   (u as any)?.rival_wins_count ?? 0,
        groupsJoinedCount:(u as any)?.groups_joined_count ?? 0,
        eventsRsvpCount:  (u as any)?.events_rsvp_count ?? 0,
        badgesEarnedCount:(u as any)?.badges_earned_count ?? 0,
        groupWarsParticipated:        (u as any)?.group_wars_participated ?? 0,
        groupChallengesParticipated:  (u as any)?.group_challenges_participated ?? 0,
        followingCount:   (u as any)?.following_count ?? 0,
        workoutStreak, nutritionStreak,
      };
      setCounterData(cd);
      const info = getLevelProgress(cd);
      setProgressInfo(info);
      setModalSelectedLevel(((cd.currentLevel + 1) <= 6 ? cd.currentLevel + 1 : 6) as Level);

      // Compute which XP categories the user already earned today, by querying
      // activity_logs for the LOCAL calendar day window. Used to highlight
      // already-done categories purple in the level modal.
      // Bug fix: previously used setUTCHours(0,0,0,0) which is 4-5pm Pacific.
      // That meant logs from yesterday afternoon Pacific stayed highlighted
      // into the next morning. Now uses local midnight so the bars reset on
      // calendar day rollover in the user's timezone.
      try {
        const localMidnight = new Date();
        localMidnight.setHours(0, 0, 0, 0);
        const { data: todayLogs } = await supabase
          .from('activity_logs')
          .select('log_type, workout_category')
          .eq('user_id', user!.id)
          .gte('logged_at', localMidnight.toISOString());
        const cats = new Set<string>();
        const cardioSet = new Set(['running', 'walking', 'biking', 'swimming', 'rowing']);
        for (const log of (todayLogs || []) as any[]) {
          if (log.log_type === 'workout') {
            // Cardio types map to "cardio" XP, everything else to "workout"
            if (log.workout_category && cardioSet.has(log.workout_category)) cats.add('cardio');
            else cats.add('workout');
          } else if (log.log_type === 'nutrition') cats.add('nutrition');
          else if (log.log_type === 'wellness') cats.add('wellness');
        }
        // Also check if user posted to feed today (separate table)
        const { count: feedCount } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .gte('created_at', localMidnight.toISOString());
        if ((feedCount ?? 0) > 0) cats.add('feed_post');
        setTodayXpCategories(cats);
      } catch { /* non-fatal — leaves the set empty */ }

      // If user is ready to level up (XP + challenges all met), trigger server-side level_up
      if (info.readyToLevelUp) {
        const result = await tryLevelUp(user!.id);
        if (result && result.level !== cd.currentLevel) {
          // Reload counters with new level
          setTimeout(() => loadCounters(), 200);
        }
      }
    }
    loadCounters();
  }, [user?.id, realDays.length]);

  useEffect(() => {
    if (!user) return;
    async function loadTier() {
      // Count logs in last 28 days
      const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .gte('logged_at', since);
      const logsCount = count || 0;
      const info = getTierInfo(logsCount, 0);
      setTierInfo(info);
      setUserTier(info.tier);
      // Persist tier back to DB for feed to pick up
      if (user) {
        supabase.from('users').update({ tier: info.tier, logs_last_28_days: logsCount } as any).eq('id', user.id).catch(() => {});
      }
    }
    loadTier();
  }, [user?.id, realDays.length]);

  // uploadPhoto imported from @/lib/uploadPhoto — server-side, bypasses RLS

  // Adjust to fit — uploads directly, photo is displayed with object-fit:cover
  function loadImg(e:React.ChangeEvent<HTMLInputElement>, set:(s:string)=>void, supabasePath?: { bucket: string; path: string; dbField: string }) {
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader();
    r.onload=async ev=>{
      const dataUrl = ev.target!.result as string;
      set(dataUrl); // show immediately
      if (supabasePath && user) {
        const compressed = await compressImage(dataUrl);
        const publicUrl = await uploadPhoto(compressed, supabasePath.bucket, supabasePath.path);
        if (publicUrl) {
          if (supabasePath.dbField === "avatar_url") {
            latestUploadedAvatarUrlRef.current = publicUrl;
            initedAvatarRef.current = true;
          }
          if (supabasePath.dbField === "banner_url") {
            latestUploadedBannerUrlRef.current = publicUrl;
            initedBannerRef.current = true;
          }
          set(publicUrl);
          const { error } = await supabase.from('users').update({ [supabasePath.dbField]: publicUrl }).eq('id', user.id);
          if (error) console.error(`[profile] failed to save ${supabasePath.dbField}:`, error.message);
        }
      }
    };
    r.readAsDataURL(f); e.target.value="";
  }

  async function saveBannerPosition() {
    if (!user) return;
    try { localStorage.setItem(`banner_position_${user.id}`, String(bannerPosition)); } catch {}
    try { localStorage.setItem(`banner_scale_${user.id}`, String(bannerScale)); } catch {}
    // Try to save to Supabase (banner_position / banner_scale columns may
    // or may not exist on older deployments — failures here are silent).
    supabase.from('users').update({ banner_position: bannerPosition, banner_scale: bannerScale } as any).eq('id', user.id).then(() => {});
    setRepositionMode(false);
  }

  function handleBannerMouseDown(e: React.MouseEvent) {
    if (!repositionMode) return;
    e.preventDefault();
    setDragState({ startY: e.clientY, startPos: bannerPosition });
  }

  function handleBannerMouseMove(e: React.MouseEvent) {
    if (!dragState || !repositionMode) return;
    const dy = e.clientY - dragState.startY;
    // Moving up (negative dy) should move position up (smaller percentage)
    const newPos = Math.max(0, Math.min(100, dragState.startPos - dy / 3));
    setBannerPosition(newPos);
  }

  function handleBannerMouseUp() {
    setDragState(null);
  }

  function handleBannerTouchMove(e: React.TouchEvent) {
    if (!dragState || !repositionMode) return;
    const dy = e.touches[0].clientY - dragState.startY;
    const newPos = Math.max(0, Math.min(100, dragState.startPos - dy / 3));
    setBannerPosition(newPos);
  }

  function handleAvatarMouseDown(e: React.MouseEvent) {
    if (!avatarRepositionMode) return;
    e.preventDefault();
    setAvatarDragState({ startY: e.clientY, startPos: avatarPosition });
  }
  function handleAvatarMouseMove(e: React.MouseEvent) {
    if (!avatarDragState || !avatarRepositionMode) return;
    const dy = e.clientY - avatarDragState.startY;
    const newPos = Math.max(0, Math.min(100, avatarDragState.startPos - dy / 2));
    setAvatarPosition(newPos);
  }
  function handleAvatarMouseUp() { setAvatarDragState(null); }
  async function saveAvatarPosition() {
    if (!user) return;
    try { localStorage.setItem(`avatar_position_${user.id}`, String(avatarPosition)); } catch {}
    try { localStorage.setItem(`avatar_scale_${user.id}`, String(avatarScale)); } catch {}
    supabase.from('users').update({ avatar_position: avatarPosition, avatar_scale: avatarScale } as any).eq('id', user!.id).then(() => {});
    setAvatarRepositionMode(false);
  }

  // Centralized helper: persist a new highlights array to DB + localStorage.
  // Returns true on success, false on failure. ALL highlight mutations should
  // go through this — previously each callsite did its own save (or didn't),
  // which is why some highlights weren't persisting and refreshes lost them.
  async function persistHighlights(next: string[]): Promise<boolean> {
    if (!user) return false;
    // Strip any non-http URLs (base64 data: URLs aren't real persisted images)
    const httpOnly = next.filter(u => typeof u === 'string' && u.startsWith('http'));
    const { error } = await supabase
      .from('users')
      .update({ highlights: httpOnly } as any)
      .eq('id', user.id);
    if (error) {
      console.error("Failed to persist highlights:", error);
      return false;
    }
    try { localStorage.setItem(`fit_highlights_${user.id}`, JSON.stringify(httpOnly)); } catch {}
    return true;
  }

  function addHighlight(e:React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if(!f) return;
    const r = new FileReader();
    r.onload = async ev => {
      const dataUrl = ev.target!.result as string;
      // Show base64 preview immediately so user sees the photo land in the slot
      setHighlights(h => [...h, dataUrl]);
      if (!user) return;
      // Upload to storage to get a real URL
      const compressed = await compressImage(dataUrl);
      const publicUrl = await uploadPhoto(compressed, 'avatars', `${user.id}/highlights/${Date.now()}.jpg`);
      if (!publicUrl || !publicUrl.startsWith('http')) {
        // Upload failed — remove the preview so user knows something went wrong
        setHighlights(h => h.filter(u => u !== dataUrl));
        alert("Couldn't upload that image. Try again.");
        return;
      }
      // Swap base64 preview for the real URL and save to DB
      setHighlights(h => {
        const next = h.map(u => u === dataUrl ? publicUrl : u);
        // Persist outside render cycle so we don't block paint
        persistHighlights(next);
        return next;
      });
    };
    r.readAsDataURL(f);
    e.target.value = "";
  }

  async function removeHighlight(idx:number) {
    // Capture URL up-front and key off URL (not index) so a re-render between
    // click and execution can't make us delete the wrong photo or all photos.
    const urlToRemove = highlights[idx];
    if (!urlToRemove || !user) return;

    const next = highlights.filter(u => u !== urlToRemove);

    // Optimistic UI
    setHighlights(next);
    if (next.length === 0) setEditingHighlights(false);

    // Persist to DB. If save fails, roll back to BEFORE state.
    const ok = await persistHighlights(next);
    if (!ok) {
      setHighlights(prev => {
        // Only roll back if our delete is still the latest change
        if (!prev.includes(urlToRemove)) return [...prev, urlToRemove];
        return prev;
      });
      alert("Couldn't delete that highlight. Try again.");
      return;
    }

    // Best-effort: remove the file from storage. If this fails the highlight
    // is already gone from the user's view (DB updated), so it's fine.
    try {
      const match = urlToRemove.match(/avatars\/(.+?)(\?|$)/);
      if (match) {
        const path = decodeURIComponent(match[1]);
        await supabase.storage.from('avatars').remove([path]);
      }
    } catch(e) { console.error("Storage delete error:", e); }
  }

  async function claimBadge() {
    if (!user || !selectedBadge) return;

    // ── Ladder progression check ────────────────────────────────────────
    // If the selected badge is the entry of a manual ladder (marathon-1,
    // spartan-1, etc.), figure out which tier to actually award based on
    // how many badges in this family the user has already claimed.
    //
    // First time → award tier 1 (marathon-1)
    // 3rd time   → award tier 2 (marathon-3)
    // 5th time   → award tier 3 (marathon-5)
    // ...etc, capping at tier 5 (marathon-20) for 20+ claims.
    let badgeIdToAward = selectedBadge;
    let actualCount = 1;
    const family = findManualBadgeFamily(selectedBadge);
    if (family) {
      // Count how many badges in this family the user already has
      const existingInFamily = earnedBadges.filter(eb => family.tiers.includes(eb.badge_id)).length;
      actualCount = existingInFamily + 1; // +1 for the one we're about to claim
      badgeIdToAward = getTierForCount(family, actualCount);

      // If they're already at the highest tier (marathon-20), don't insert
      // anything — just show them they're maxed.
      if (actualCount > 20) {
        setBadgeToast("You're already at the highest tier for this badge! 👑");
        setTimeout(() => setBadgeToast(null), 3000);
        setShowBadgeModal(false);
        setSelectedBadge("");
        setBadgeNote("");
        setBadgeSearch("");
        setBadgeCategoryFilter("all");
        return;
      }
    }

    // Insert into DB and select the row back so we have the real ID + timestamp
    const { data, error } = await supabase
      .from('badges')
      .insert({
        user_id: user.id,
        badge_id: badgeIdToAward,
        note: badgeNote || null,
      })
      .select()
      .single();

    if (error) {
      console.error("claimBadge failed:", error);
      alert("Couldn't claim that badge. Try again.");
      return;
    }

    // earnedBadges expects objects with shape { badge_id, ... } — pushing
    // just the string broke the .some(eb => eb.badge_id === b.id) check
    // and made claimed badges look unclaimed.
    setEarnedBadges(prev => [...prev, data]);
    setShowBadgeModal(false);
    setSelectedBadge("");
    setBadgeNote("");
    setBadgeSearch("");
    setBadgeCategoryFilter("all");

    // Toast — for ladder badges, name the actual tier they hit
    if (family) {
      const awarded = BADGES.find(b => b.id === badgeIdToAward);
      setBadgeToast(`${awarded?.emoji ?? "🏆"} ${awarded?.label ?? "Badge"} unlocked! (${actualCount} total)`);
    } else {
      setBadgeToast("Badge unlocked! 🎉");
    }
    setTimeout(() => setBadgeToast(null), 3500);
  }

  const inputStyle = {width:"100%",background:"#0D0D0D",border:"1.5px solid #3D2A6E",borderRadius:14,padding:"11px 15px",fontSize:14,color:C.text,outline:"none",boxSizing:"border-box" as const,marginBottom:10};

  const manualBadges = BADGES.filter(b => isManualBadge(b.id));
  const HIGHLIGHT_SLOTS = 9;

  // ── BRANCH: business accounts render a completely different layout ──
  // The entire athlete profile (followers/following, badges, activity log,
  // level progress, rivals, etc.) is inappropriate for a business. Instead
  // we render the dedicated BusinessProfileView with hero + tabs + contact
  // info. This branch applies to the LOGGED-IN user viewing their own
  // profile at /profile — the public profile at /profile/[username] already
  // has its own branch.
  if (user?.profile && isBusinessAccount(user.profile)) {
    return (
      <BusinessProfileView
        profile={user.profile}
        currentUser={{ id: user.id }}
        // No message/block on own profile — they're the owner
      />
    );
  }

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:80}}>

      <style jsx global>{`
        /* ─── Cosmetic Level Reward Effects ─────────────────────────────────
           Activated by adding the tier class to elements based on user level.
           Each tier's effects layer on top of the previous (Diamond gets
           everything). Effects are deliberately subtle — they should feel
           prestigious, not gaudy.
        */

        /* L2 BRONZE — warm copper border glow on activity cards.
           Subtle stationary halo, not animated. Lowest-prestige tier. */
        .tier-bronze-card {
          border-color: rgba(205,127,50,0.45) !important;
          box-shadow: 0 0 0 1px rgba(205,127,50,0.20), 0 2px 18px rgba(205,127,50,0.18);
        }

        /* L3 SILVER — rotating silver halo around profile avatar.
           This is the "moving picture" effect. Two concentric conic-gradient
           rings rotate at different speeds for depth. The avatar itself stays
           still — only the ring around it moves. Animation is slow + smooth
           (8s) so it never feels distracting. */
        .tier-silver-avatar-wrap {
          position: relative;
          padding: 4px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            #6B7280 0%,
            #E8E8F0 25%,
            #F5F5FA 50%,
            #C0C0C0 75%,
            #6B7280 100%
          );
          animation: tierSilverRingSpin 8s linear infinite;
          box-shadow: 0 0 22px rgba(220,220,235,0.35);
        }
        .tier-silver-avatar-wrap::after {
          /* Inner soft glow ring spinning the OTHER direction.
             Creates a "shimmery" depth effect without being chaotic. */
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            rgba(255,255,255,0.4) 30%,
            transparent 60%,
            rgba(255,255,255,0.3) 90%,
            transparent 100%
          );
          animation: tierSilverRingSpinReverse 12s linear infinite;
          pointer-events: none;
          z-index: -1;
        }
        @keyframes tierSilverRingSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes tierSilverRingSpinReverse {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }

        /* L4 GOLD — gold shimmer that sweeps across the profile NAME.
           Gold gradient text + a moving highlight band. */
        .tier-gold-name {
          background: linear-gradient(
            90deg,
            #B8860B 0%,
            #FFD700 25%,
            #FFF8DC 50%,
            #FFD700 75%,
            #B8860B 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: tierGoldShimmer 4s ease-in-out infinite;
          filter: drop-shadow(0 0 8px rgba(255,215,0,0.4));
        }
        @keyframes tierGoldShimmer {
          0%,100% { background-position: 0% 50%; }
          50%     { background-position: 100% 50%; }
        }
        /* L4 GOLD — gentle gold glow on activity cards (in addition to bronze) */
        .tier-gold-card {
          border-color: rgba(255,215,0,0.45) !important;
          box-shadow: 0 0 0 1px rgba(255,215,0,0.22), 0 2px 22px rgba(255,215,0,0.22);
        }

        /* L5 EMERALD — pulsing green glow on activity cards.
           Slow breathing pulse — gentle, not flashy. */
        .tier-emerald-card {
          border-color: rgba(16,185,129,0.55) !important;
          animation: tierEmeraldPulse 4.5s ease-in-out infinite;
        }
        @keyframes tierEmeraldPulse {
          0%,100% { box-shadow: 0 0 0 1px rgba(16,185,129,0.30), 0 2px 18px rgba(16,185,129,0.20); }
          50%     { box-shadow: 0 0 0 1px rgba(16,185,129,0.55), 0 2px 32px rgba(16,185,129,0.45); }
        }

        /* L6 DIAMOND — holographic shifting name (like rainbow chrome).
           Reserved for max level — most prestigious effect. */
        .tier-diamond-name {
          background: linear-gradient(
            90deg,
            #67E8F9 0%,
            #E879F9 20%,
            #FCD34D 40%,
            #6EE7B7 60%,
            #A78BFA 80%,
            #67E8F9 100%
          );
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: tierDiamondHolo 6s linear infinite;
          filter: drop-shadow(0 0 10px rgba(103,232,249,0.5));
        }
        @keyframes tierDiamondHolo {
          0%   { background-position: 0% 50%; }
          100% { background-position: 250% 50%; }
        }

        /* Diamond shimmer effect for activity cards. Subtle cyan light streak
           that sweeps across without obscuring text.
           Activated by adding the diamond-shimmer-card class (gated to L6). */
        .diamond-shimmer-card { position: relative; }
        .diamond-shimmer-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(115deg, transparent 40%, rgba(103,232,249,0.20) 48%, rgba(186,230,253,0.45) 50%, rgba(103,232,249,0.20) 52%, transparent 60%);
          transform: translateX(-120%);
          animation: diamondShimmerSweep 4s ease-in-out infinite;
          pointer-events: none;
          z-index: 3;
        }
        @keyframes diamondShimmerSweep {
          0% { transform: translateX(-120%); }
          55% { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }
        @media (max-width: 767px) {
          .profile-layout {
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: unset !important;
            padding: 0 !important;
            gap: 12px !important;
          }
          .profile-layout > * { width: 100% !important; min-width: unset !important; max-width: 100% !important; }
          .profile-header-wrap { flex-direction: column !important; align-items: center !important; text-align: center !important; gap: 0 !important; }
          /* Lift avatar enough that it cleanly overlaps the bottom edge of the banner.
             Avatar is 184px so we lift -92px to half-overlap. margin-bottom: 100px
             reserves space for the bottom half of the avatar circle so the
             "Edit Profile" button below it has clearance and doesn't get covered. */
          .profile-avatar-col { order: 2 !important; margin-top: 16px !important; margin-bottom: 16px !important; z-index: 5 !important; position: relative !important; padding: 0 !important; width: 100% !important; align-items: center !important; display: flex !important; flex-direction: column !important; }
          .profile-banner-block { order: 1 !important; min-width: unset !important; width: 100% !important; border-radius: 0 !important; }
          /* Shorter banner on mobile — 320px was eating half the viewport */
          .profile-banner-label { border-radius: 0 !important; height: 180px !important; }
          .profile-outer { padding: 0 0 100px !important; max-width: 100% !important; margin: 0 !important; }
          .profile-stats-bio { padding: 16px !important; width: 100% !important; box-sizing: border-box !important; }
          /* Stats row — keep the two big numbers on one horizontal line, tighter */
          .profile-stats-row { gap: 8px !important; margin-top: 12px !important; }
          /* Hide desktop-only hover affordances on touch screens.
             Reposition buttons require hover on desktop; on mobile they just
             sit there cluttering the layout. Users can long-press the image
             later — for now, hide them on the touch-primary breakpoint. */
          .hide-on-mobile { display: none !important; }
        }
        @media (min-width: 768px) and (max-width: 1100px) {
          .profile-layout {
            grid-template-columns: 200px 1fr 200px !important;
            gap: 16px !important;
          }
        }
        .highlight-slot:hover .highlight-remove { opacity: 1 !important; }
      `}</style>

      {/* ── Highlight Picker Modal ── */}
      {showHighlightPicker && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.75)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={()=>setShowHighlightPicker(false)}>
          <div style={{background:C.white,borderRadius:"0 0 24px 24px",padding:"20px 24px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <div>
              <div style={{fontWeight:900,fontSize:18,color:C.text}}>Choose a Highlight</div>
              <div style={{fontSize:12,color:C.sub,marginTop:2}}>Tap any photo to add it to highlights</div>
            </div>
            <button onClick={()=>setShowHighlightPicker(false)} style={{width:36,height:36,borderRadius:"50%",border:"none",background:"#2D1F52",color:C.text,fontSize:20,cursor:"pointer"}}>×</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"16px 20px 32px"}} onClick={e=>e.stopPropagation()}>
            {feedPhotos.length === 0 ? (
              <div style={{textAlign:"center",padding:"60px 0",color:C.sub}}>
                <div style={{fontSize:40,marginBottom:12}}>📭</div>
                <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:6}}>No feed photos yet</div>
                <div style={{fontSize:13}}>Post photos to your feed first, then add them as highlights</div>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {feedPhotos.map((src,idx)=>{
                  const alreadyAdded = highlights.includes(src);
                  return (
                    <button key={idx} onClick={async ()=>{
                      if(alreadyAdded) return;
                      // Add directly from feed URL — no re-upload needed.
                      // CRITICAL: we have to save to DB here. Previously this
                      // only updated local state + localStorage, so on refresh
                      // the highlight disappeared.
                      const next = [...highlights, src];
                      setHighlights(next);
                      setShowHighlightPicker(false);
                      const ok = await persistHighlights(next);
                      if (!ok) {
                        // Roll back if save failed
                        setHighlights(prev => prev.filter(u => u !== src));
                        alert("Couldn't add that highlight. Try again.");
                      }
                    }} style={{padding:0,border:`3px solid ${alreadyAdded?C.purple:C.purpleMid}`,borderRadius:14,overflow:"hidden",cursor:alreadyAdded?"default":"pointer",background:"none",aspectRatio:"1",position:"relative"}}>
                      <img src={ImagePresets.thumb(src)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} alt=""/>
                      {alreadyAdded && (
                        <div style={{position:"absolute",inset:0,background:"rgba(22,163,74,0.4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <span style={{fontSize:28}}>✓</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Also allow uploading from camera roll */}
            <label style={{display:"flex",alignItems:"center",gap:10,marginTop:20,padding:"14px 16px",borderRadius:16,border:`1.5px dashed ${C.purpleMid}`,background:"#1A1230",cursor:"pointer",justifyContent:"center"}}>
              <span style={{fontSize:20}}>📷</span>
              <span style={{fontWeight:700,fontSize:14,color:C.purple}}>Upload from camera roll</span>
              <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                const f=e.target.files?.[0]; if(!f) return;
                const r=new FileReader();
                r.onload=async ev=>{
                  const dataUrl=ev.target!.result as string;
                  setShowHighlightPicker(false);
                  if(!user) return;
                  // Show base64 preview while upload happens
                  setHighlights(h => [...h, dataUrl]);
                  const {uploadPhoto:up}=await import('@/lib/uploadPhoto');
                  const {compressImage:ci}=await import('@/lib/compressImage');
                  const compressed = await ci(dataUrl);
                  const publicUrl=await up(compressed,'avatars',`${user.id}/highlights/${Date.now()}.jpg`);
                  if(!publicUrl || !publicUrl.startsWith('http')){
                    setHighlights(h => h.filter(u => u !== dataUrl));
                    alert("Couldn't upload that image. Try again.");
                    return;
                  }
                  // Swap base64 preview for real URL and save to DB
                  setHighlights(h => {
                    const next = h.map(u => u === dataUrl ? publicUrl : u);
                    persistHighlights(next);
                    return next;
                  });
                };
                r.readAsDataURL(f); e.target.value="";
              }}/>
            </label>
          </div>
        </div>
      )}

      {/* ── Followers / Following Modal ── */}
      {socialModal && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setSocialModal(null)}>
          <div style={{background:C.white,borderRadius:28,width:"100%",maxWidth:440,maxHeight:"75vh",overflow:"hidden",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",borderBottom:`2px solid ${C.purpleMid}`}}>
              <div style={{fontWeight:900,fontSize:18,color:C.text}}>{socialModal==="followers"?"👥 Followers":"➡️ Following"}</div>
              <button onClick={()=>setSocialModal(null)} style={{width:34,height:34,borderRadius:"50%",border:"none",background:"#2D1F52",color:C.sub,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
            <div style={{overflowY:"auto",flex:1,padding:"12px 16px"}}>
              {socialLoading ? (
                <div style={{textAlign:"center",padding:"32px 0",color:C.sub}}>
                  <div style={{width:32,height:32,borderRadius:"50%",border:`4px solid ${C.purpleMid}`,borderTopColor:C.purple,animation:"spin 0.8s linear infinite",margin:"0 auto 10px"}}/>
                  <div style={{fontSize:13}}>Loading...</div>
                </div>
              ) : socialList.length === 0 ? (
                <div style={{textAlign:"center",padding:"40px 0",color:C.sub}}>
                  <div style={{fontSize:40,marginBottom:10}}>👤</div>
                  <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:6}}>No one here yet</div>
                  <div style={{fontSize:13}}>{socialModal==="followers"?"No followers yet":"Not following anyone yet"}</div>
                </div>
              ) : (
                socialList.map(u=>(
                  <div key={u.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 8px",borderRadius:16,cursor:"pointer",transition:"background 0.15s"}}
                    onMouseEnter={e=>(e.currentTarget.style.background="#2D1F52")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                    onClick={()=>{setSocialModal(null);router.push(`/profile/${u.username}`);}}>
                    <div style={{width:48,height:48,borderRadius:"50%",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:"#fff"}}>
                      {u.avatar_url ? <img src={ImagePresets.avatarSm(u.avatar_url)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/> : (u.full_name||u.username||"?")[0].toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:14,color:C.text}}>{u.full_name}</div>
                      <div style={{fontSize:12,color:C.sub}}>@{u.username}</div>
                    </div>
                    {/* Inline follow/unfollow — stop propagation so clicks here
                        don't ALSO navigate to the profile. */}
                    <div onClick={e => e.stopPropagation()}>
                      <FollowButton targetUserId={u.id} size="sm" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {badgeToast && (
        <div style={{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",zIndex:99999,background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:"#fff",fontWeight:800,fontSize:15,padding:"14px 28px",borderRadius:24,boxShadow:"0 8px 32px rgba(124,58,237,0.35)",pointerEvents:"none"}}>
          {badgeToast}
        </div>
      )}

      {/* ── Badge Modal ── */}
      {showBadgeModal && (() => {
        // Filter manual badges by category + search query so the user can find
        // theirs in the long list. Search matches label or description.
        const cats = Array.from(new Set(manualBadges.map(b => b.category)));
        const q = badgeSearch.trim().toLowerCase();
        const filtered = manualBadges.filter(b => {
          if (badgeCategoryFilter !== "all" && b.category !== badgeCategoryFilter) return false;
          if (q && !(b.label.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q))) return false;
          return true;
        });

        // Visual style per category — gives each badge group a distinct color
        // so the modal doesn't look like 150 identical purple cards.
        const catStyle: Record<string, { bg: string; border: string; chip: string }> = {
          strength:    { bg: "linear-gradient(135deg,#7C2D12,#9A3412)", border: "#EA580C", chip: "#FED7AA" },
          cardio:      { bg: "linear-gradient(135deg,#831843,#9F1239)", border: "#E11D48", chip: "#FECACA" },
          consistency: { bg: "linear-gradient(135deg,#713F12,#854D0E)", border: "#CA8A04", chip: "#FDE68A" },
          wellness:    { bg: "linear-gradient(135deg,#14532D,#166534)", border: "#16A34A", chip: "#BBF7D0" },
          nutrition:   { bg: "linear-gradient(135deg,#365314,#3F6212)", border: "#65A30D", chip: "#D9F99D" },
          challenges:  { bg: "linear-gradient(135deg,#1E3A8A,#1D4ED8)", border: "#3B82F6", chip: "#BFDBFE" },
          social:      { bg: "linear-gradient(135deg,#581C87,#6B21A8)", border: "#A855F7", chip: "#E9D5FF" },
          special:     { bg: "linear-gradient(135deg,#831843,#86198F)", border: "#D946EF", chip: "#F5D0FE" },
        };
        const fallbackStyle = { bg: "#1A1A1A", border: C.purpleMid, chip: C.purple };

        return (
        <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.white,borderRadius:28,padding:0,width:"100%",maxWidth:520,boxShadow:"0 20px 60px rgba(0,0,0,0.18)",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"28px 28px 16px"}}>
              <div style={{fontWeight:900,fontSize:22,color:C.text,marginBottom:6}}>Report an Achievement</div>
              <div style={{fontSize:13,color:C.sub,marginBottom:16}}>Honor system — we trust you. Earn it for real 💪</div>

              {/* Search */}
              <input value={badgeSearch} onChange={e=>setBadgeSearch(e.target.value)} placeholder="Search achievements..." style={{width:"100%",background:"#0D0D0D",border:"1.5px solid #3D2A6E",borderRadius:14,padding:"11px 15px",fontSize:14,color:C.text,outline:"none",boxSizing:"border-box",marginBottom:10}}/>

              {/* Category chips */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button onClick={()=>setBadgeCategoryFilter("all")} style={{padding:"5px 12px",borderRadius:99,border:`1.5px solid ${badgeCategoryFilter==="all"?C.purple:C.purpleMid}`,background:badgeCategoryFilter==="all"?"#2D1F52":"transparent",color:badgeCategoryFilter==="all"?"#E9D5FF":C.sub,fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>All</button>
                {cats.map(cat => (
                  <button key={cat} onClick={()=>setBadgeCategoryFilter(cat)} style={{padding:"5px 12px",borderRadius:99,border:`1.5px solid ${badgeCategoryFilter===cat?C.purple:C.purpleMid}`,background:badgeCategoryFilter===cat?"#2D1F52":"transparent",color:badgeCategoryFilter===cat?"#E9D5FF":C.sub,fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>{cat}</button>
                ))}
              </div>
            </div>

            {/* Scrollable badge list — separate scroll so cancel/claim stay visible */}
            <div style={{flex:1,overflowY:"auto",padding:"0 28px",display:"flex",flexDirection:"column",gap:10}}>
              {filtered.length === 0 ? (
                <div style={{padding:"32px 0",textAlign:"center",color:C.sub,fontSize:14}}>No badges match.</div>
              ) : filtered.map(b => {
                // For ladder entry badges, count how many in the family the user has —
                // shows progress in the modal so they know what tier they're at.
                const ladderFamily = findManualBadgeFamily(b.id);
                const ladderCount = ladderFamily
                  ? earnedBadges.filter(eb => ladderFamily.tiers.includes(eb.badge_id)).length
                  : 0;
                const ladderMaxed = ladderFamily && ladderCount >= 20;
                // Standalone badges: earned = locked. Ladder badges: never lock unless maxed.
                const earned = ladderFamily
                  ? ladderMaxed
                  : earnedBadges.some(eb => eb.badge_id === b.id);
                const sel = selectedBadge === b.id;
                const cs = catStyle[b.category] || fallbackStyle;
                return (
                  <button key={b.id} onClick={()=>setSelectedBadge(b.id)} disabled={earned}
                    style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:16,border:`2px solid ${sel?C.purple:cs.border}`,background:sel?cs.bg:`${cs.bg}99`,cursor:earned?"not-allowed":"pointer",textAlign:"left",opacity:earned?0.45:1,boxShadow:sel?`0 0 0 3px ${C.purple}33`:"none",transition:"all 0.12s"}}>
                    <span style={{fontSize:30,flexShrink:0}}>{b.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:14,color:"#fff",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        {b.label}
                        {ladderFamily && ladderCount > 0 && (
                          <span style={{fontSize:10,fontWeight:800,background:cs.chip,color:"#000",borderRadius:8,padding:"2px 8px"}}>
                            {ladderMaxed ? "👑 MAXED" : `${ladderCount} done`}
                          </span>
                        )}
                        {!ladderFamily && earned && <span style={{fontSize:10,fontWeight:700,background:"#D1FAE5",color:"#065F46",borderRadius:8,padding:"2px 8px"}}>✓ Earned</span>}
                      </div>
                      <div style={{fontSize:11,color:cs.chip,marginTop:2,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>{b.category}</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",marginTop:3}}>
                        {ladderFamily ? `Tap to report another · earns ${ladderFamily.tiers.length} tiers (1/3/5/10/20)` : b.desc}
                      </div>
                    </div>
                    <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${sel?C.purple:"rgba(255,255,255,0.5)"}`,background:sel?C.purple:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sel && <div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{padding:"16px 28px 28px",borderTop:`1px solid ${C.purpleMid}`}}>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:700,color:C.sub,display:"block",marginBottom:6}}>Tell us about it (optional)</label>
                <textarea value={badgeNote} onChange={e=>setBadgeNote(e.target.value)} rows={2} placeholder="Share your story..." style={{width:"100%",background:"#0D0D0D",border:"1.5px solid #3D2A6E",borderRadius:14,padding:"11px 15px",fontSize:14,color:C.text,outline:"none",resize:"none",boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"flex",gap:12}}>
                <button onClick={()=>{setShowBadgeModal(false);setSelectedBadge("");setBadgeNote("");setBadgeSearch("");setBadgeCategoryFilter("all");}} style={{flex:1,padding:"13px 0",borderRadius:14,border:`2px solid ${C.purpleMid}`,background:"#0D0D0D",color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                <button onClick={claimBadge} disabled={!selectedBadge} style={{flex:1,padding:"13px 0",borderRadius:14,border:"none",background:selectedBadge?`linear-gradient(135deg,${C.purple},#A78BFA)`:"#E5E7EB",color:selectedBadge?C.white:"#9CA3AF",fontWeight:900,cursor:selectedBadge?"pointer":"not-allowed"}}>Claim Badge</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── All Badges Modal ── */}
      {showAllBadgesModal && (() => {
        // Group fitness badges — three render types: progression, credential, yearly.
        const grouped: DisplayBadge[] = groupBadgesIntoFamilies(earnedBadges, badgeCounters);
        const fitnessCount = grouped.length;
        const rivalryCount = rivalryBadges.length;

        return (
        <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:C.white,borderRadius:28,width:"100%",maxWidth:560,maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
            {/* Holographic shimmer + birthday sparkle + metallic shine keyframes */}
            <style>{`
              @keyframes holoShimmer {
                0%   { background-position: 0% 50%; }
                50%  { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
              @keyframes birthdayPulse {
                0%,100% { box-shadow: 0 0 20px rgba(255,182,193,0.5), 0 0 40px rgba(135,206,235,0.3); }
                50%     { box-shadow: 0 0 30px rgba(255,182,193,0.8), 0 0 60px rgba(135,206,235,0.5); }
              }
              /* badgeShimmer — moves a diagonal white band across the tile. Paired
                 with backgroundSize:"200% 100%" the band slides from left to right
                 and loops. Speed varies per tier in BadgeTile component. */
              @keyframes badgeShimmer {
                0%   { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
              /* Spin animations for tier ornament bursts (Diamond+) */
              @keyframes badgeBurstSpin {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
              }
              @keyframes badgeBurstSpinReverse {
                from { transform: rotate(0deg); }
                to   { transform: rotate(-360deg); }
              }
              /* Sparkle dot orbit for tier 5+ — circles the badge */
              @keyframes badgeSparkleOrbit {
                0%   { transform: rotate(0deg) translateX(38px) rotate(0deg); }
                100% { transform: rotate(360deg) translateX(38px) rotate(-360deg); }
              }
            `}</style>

            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"22px 28px 16px",borderBottom:`2px solid ${C.purpleMid}`}}>
              <div>
                <div style={{fontWeight:900,fontSize:20,color:C.text}}>🏆 All Badges</div>
                <div style={{fontSize:12,color:C.sub,marginTop:2}}>
                  {badgesTab === "fitness"
                    ? `${fitnessCount} achievement${fitnessCount === 1 ? "" : "s"} unlocked`
                    : `${rivalryCount} rival badge${rivalryCount === 1 ? "" : "s"} earned`}
                </div>
              </div>
              <button onClick={()=>setShowAllBadgesModal(false)} style={{width:36,height:36,borderRadius:"50%",border:"none",background:"#2D1F52",color:C.text,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>

            {/* Tabs */}
            <div style={{display:"flex",gap:0,padding:"0 28px",borderBottom:`1px solid ${C.purpleMid}`}}>
              {([
                { id: "fitness", label: "💪 Fitness", count: fitnessCount },
                { id: "rivals",  label: "⚔️ Rivals",  count: rivalryCount },
              ] as const).map(tab => {
                const isActive = badgesTab === tab.id;
                return (
                  <button key={tab.id} onClick={()=>setBadgesTab(tab.id)}
                    style={{flex:1,padding:"12px 16px",background:"none",border:"none",
                      borderBottom:`2px solid ${isActive ? C.purple : "transparent"}`,
                      color: isActive ? C.text : C.sub, fontWeight: isActive ? 900 : 700,
                      fontSize: 14, cursor:"pointer",fontFamily:"inherit",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                    {tab.label}
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,
                      background: isActive ? C.purple : "#2D1F52",
                      color: isActive ? "#fff" : C.sub, fontWeight: 800}}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>
              {badgesTab === "fitness" && (
                fitnessCount === 0 && completedChallenges.length === 0 ? (
                  <div style={{textAlign:"center",padding:"60px 20px",color:C.sub}}>
                    <div style={{fontSize:40,marginBottom:12}}>🏆</div>
                    <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:6}}>No badges earned yet</div>
                    <div style={{fontSize:13}}>Complete fitness milestones to earn badges and unlock achievements</div>
                  </div>
                ) : (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
                    {grouped.map(g => {
                      // ── CREDENTIAL: holographic prestige look ──
                      if (g.renderType === "credential") {
                        return (
                          <div key={g.key} style={{
                            borderRadius:16,
                            padding:"16px 10px",
                            textAlign:"center",
                            position:"relative",
                            overflow:"hidden",
                            border:"2px solid transparent",
                            background: `
                              linear-gradient(#0A0A14, #0A0A14) padding-box,
                              linear-gradient(135deg, #ff6ec4, #7873f5, #4ade80, #facc15, #ff6ec4) border-box
                            `,
                            boxShadow:"0 0 24px rgba(120, 115, 245, 0.4)",
                          }}>
                            {/* Holographic overlay */}
                            <div style={{
                              position:"absolute",inset:0,pointerEvents:"none",
                              background:"linear-gradient(125deg, rgba(255,110,196,0.08), rgba(120,115,245,0.12), rgba(74,222,128,0.08), rgba(250,204,21,0.1))",
                              backgroundSize:"200% 200%",
                              animation:"holoShimmer 5s ease infinite",
                            }} />
                            <div style={{position:"relative"}}>
                              <div style={{fontSize:34,marginBottom:6}}>{g.emoji}</div>
                              <div style={{fontWeight:900,fontSize:13,color:"#F0F0F0",lineHeight:1.3,marginBottom:4}}>{g.label}</div>
                              <div style={{fontSize:10,color:"#A78BFA",lineHeight:1.3,marginBottom:8}}>{g.desc}</div>
                              <div style={{display:"inline-block",
                                background:"linear-gradient(90deg, #ff6ec4, #7873f5, #4ade80, #facc15)",
                                backgroundSize:"200% 200%",
                                animation:"holoShimmer 5s ease infinite",
                                borderRadius:99,padding:"2px 10px",
                                fontSize:9,fontWeight:900,color:"#0A0A14",letterSpacing:0.8}}>
                                CREDENTIAL
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // ── YEARLY: year-stamped birthday/etc badges ──
                      if (g.renderType === "yearly") {
                        return (
                          <div key={g.key} style={{
                            borderRadius:16,
                            padding:"16px 10px",
                            textAlign:"center",
                            position:"relative",
                            overflow:"hidden",
                            border:"2px solid #F472B6",
                            background:"linear-gradient(135deg, #4C1D4D, #2B1550, #183B4E)",
                            animation:"birthdayPulse 3s ease-in-out infinite",
                          }}>
                            {/* Big year stamp */}
                            {g.year && (
                              <div style={{position:"absolute",top:6,right:8,
                                fontSize:11,fontWeight:900,
                                color:"#FFD1E6",letterSpacing:1,
                                textShadow:"0 0 8px rgba(244,114,182,0.6)"}}>
                                {g.year}
                              </div>
                            )}
                            <div style={{fontSize:34,marginBottom:6}}>{g.emoji}</div>
                            <div style={{fontWeight:900,fontSize:12,color:"#FFE5F1",lineHeight:1.3,marginBottom:4}}>{g.label}</div>
                            <div style={{fontSize:10,color:"#F9A8D4",lineHeight:1.3,marginBottom:8}}>{g.desc}</div>
                            <div style={{display:"inline-block",
                              background:"rgba(244,114,182,0.25)",
                              borderRadius:99,padding:"2px 10px",
                              fontSize:9,fontWeight:900,color:"#FFD1E6",letterSpacing:0.8}}>
                              🎂 YEARLY
                            </div>
                          </div>
                        );
                      }

                      // ── PROGRESSION: tiered bronze/silver/gold/platinum/etc ──
                      // Rendered via the BadgeTile component (see components/BadgeTile.tsx)
                      // which adds per-category sigil patterns, tier ornamentation rings,
                      // continuous shimmer, and orbiting sparkles on high tiers.
                      return (
                        <BadgeTile
                          key={g.key}
                          tier={g.tier ?? 1}
                          emoji={g.emoji}
                          label={g.label}
                          desc={g.desc}
                          category={g.category}
                          earnedCount={g.earnedCount}
                          maxTier={g.maxTier}
                          progress={
                            g.currentValue !== undefined && g.progressLabel
                              ? {
                                  current: g.currentValue,
                                  next: g.nextThreshold ?? null,
                                  label: g.progressLabel,
                                  isMaxed: g.isMaxed ?? false,
                                }
                              : undefined
                          }
                        />
                      );
                    })}
                    {/* Challenge completion badges still get their own gold tiles */}
                    {completedChallenges.map((cp: any, i: number) => {
                      const ch = cp.challenges;
                      if (!ch) return null;
                      const style = TIER_STYLES[3];
                      return (
                        <div key={`challenge-${i}`} style={{
                          borderRadius:16,
                          padding:"16px 10px",
                          textAlign:"center",
                          border:`1.5px solid ${style.border}`,
                          background: style.gradient,
                          boxShadow:`0 0 16px ${style.glow}`,
                          display:"flex",flexDirection:"column",
                          alignItems:"center",justifyContent:"center",
                        }}>
                          <div style={{fontSize:32,marginBottom:6}}>{ch.emoji || '🏆'}</div>
                          <div style={{fontWeight:800,fontSize:11,color:style.textColor,lineHeight:1.3,marginBottom:4}}>{ch.name}</div>
                          <div style={{fontSize:9,color:style.accentColor,lineHeight:1.3}}>Score: {cp.score}</div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {badgesTab === "rivals" && (
                rivalryCount === 0 ? (
                  <div style={{textAlign:"center",padding:"60px 20px",color:C.sub}}>
                    <div style={{fontSize:40,marginBottom:12}}>⚔️</div>
                    <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:6}}>No rival badges yet</div>
                    <div style={{fontSize:13}}>Badges earned in 1v1 rivalries will show here. One person per badge per rivalry.</div>
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {rivalryBadges.map(rb => {
                      // Rivalry badges use a fixed crimson/purple style (from the rivals page catalog)
                      return (
                        <div key={rb.id} style={{
                          borderRadius:16,
                          padding:"14px 16px",
                          border:"1.5px solid #B91C1C",
                          background:"linear-gradient(135deg,#1A0000,#3B0A0A)",
                          boxShadow:"0 0 16px rgba(239,68,68,0.3)",
                          display:"flex",alignItems:"center",gap:14,
                        }}>
                          <div style={{
                            width:48,height:48,borderRadius:12,flexShrink:0,
                            background:"rgba(239,68,68,0.15)",
                            border:"1px solid rgba(239,68,68,0.4)",
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:22,
                          }}>
                            {rivalryBadgeEmoji(rb.badge_key)}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:900,fontSize:13,color:"#FCA5A5",marginBottom:2}}>
                              {rivalryBadgeLabel(rb.badge_key)}
                            </div>
                            <div style={{fontSize:11,color:"#9CA3AF",marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                              vs {rb.opponent_name} · {rb.category}
                            </div>
                            <div style={{fontSize:10,color:"#6B7280"}}>
                              {new Date(rb.earned_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Customizations Modal — shows unlocked rewards across all 6 levels */}
      {showCustomizations && (() => {
        const userLvl = progressInfo?.level ?? 1;
        // ── Cosmetic Level Rewards ──────────────────────────────────────────
        // Themed metal/gem progression — each tier unlocks a visual effect on
        // the profile UI (avatar ring, name treatment, or activity cards).
        // Effects are gated on `userLvl >= reward.level` and applied via
        // conditional CSS classes throughout this component.
        // The level 3 "animated avatar ring" is the closest the app gets to
        // your "Harry Potter moving picture" idea — a slow rotating gradient.
        const REWARDS: Array<{ level: number; title: string; desc: string; emoji: string; preview: string; color: string }> = [
          { level: 2, title: "Bronze Tier",    desc: "Bronze-tinted glow on activity log cards. Your first metal.",                                emoji: "🥉", preview: "bronze",  color: "#CD7F32" },
          { level: 3, title: "Silver Halo",    desc: "Animated silver ring orbits your profile picture — a gentle motion that catches the eye.",  emoji: "🥈", preview: "silver",  color: "#C0C0C0" },
          { level: 4, title: "Golden Glow",    desc: "Warm gold shimmer sweeps across your name and activity cards.",                              emoji: "🥇", preview: "gold",    color: "#FFD700" },
          { level: 5, title: "Emerald Shine",  desc: "Emerald-green light pulses through your activity cards. Rare territory.",                    emoji: "💚", preview: "emerald", color: "#10B981" },
          { level: 6, title: "Diamond Crown",  desc: "MAX. Diamond shimmer on cards + holographic name — the Livelee elite mark.",                emoji: "💎", preview: "diamond", color: "#67E8F9" },
        ];
        return (
          <div onClick={() => { setShowCustomizations(false); setCustomizationDetail(null); }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          >
            <div onClick={(e) => e.stopPropagation()}
              style={{ background: "#0E0820", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "20px 20px 32px", width: "100%", maxWidth: 540, maxHeight: "85vh", overflowY: "auto", border: "1px solid #2D1F52" }}
            >
              {/* Drag handle */}
              <div style={{ width: 40, height: 4, background: "#2D1F52", borderRadius: 99, margin: "0 auto 16px" }} />

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: C.text }}>✨ Customizations</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Auto-applied as you level up.</div>
                </div>
                <button onClick={() => setShowCustomizations(false)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.10)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>x</button>
              </div>

              {/* Detail view */}
              {customizationDetail !== null ? (() => {
                const reward = REWARDS.find(r => r.level === customizationDetail);
                if (!reward) return null;
                const unlocked = userLvl >= reward.level;
                return (
                  <div>
                    <button onClick={() => setCustomizationDetail(null)} style={{ background: "none", border: "none", color: "#A78BFA", fontSize: 13, fontWeight: 700, padding: 0, marginBottom: 16, cursor: "pointer" }}>
                      ← Back to all rewards
                    </button>
                    <div style={{ background: unlocked ? `linear-gradient(135deg, ${reward.color}33, ${reward.color}11)` : "rgba(255,255,255,0.04)", borderRadius: 18, padding: 24, border: `1.5px solid ${unlocked ? reward.color : "#2D1F52"}`, marginBottom: 16 }}>
                      <div style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>{reward.emoji}</div>
                      <div style={{ fontWeight: 900, fontSize: 20, color: C.text, textAlign: "center", marginBottom: 6 }}>{reward.title}</div>
                      <div style={{ fontSize: 13, color: C.sub, textAlign: "center", marginBottom: 16 }}>Unlocks at Level {reward.level}</div>
                      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, textAlign: "center" }}>{reward.desc}</div>
                    </div>
                    {unlocked ? (
                      <div style={{ background: "rgba(16,185,129,0.12)", border: "1.5px solid #10B981", borderRadius: 14, padding: "14px 18px", textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#34D399" }}>✓ Unlocked & active</div>
                      </div>
                    ) : (
                      <div style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid #2D1F52", borderRadius: 14, padding: "14px 18px", textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#9CA3AF" }}>🔒 Reach Level {reward.level} to unlock</div>
                      </div>
                    )}
                  </div>
                );
              })() : (
                /* List view */
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {REWARDS.map(reward => {
                    const unlocked = userLvl >= reward.level;
                    return (
                      <button key={reward.level} onClick={() => setCustomizationDetail(reward.level)}
                        style={{
                          display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                          background: unlocked ? `linear-gradient(135deg, ${reward.color}1F, ${reward.color}0A)` : "rgba(255,255,255,0.03)",
                          border: `1.5px solid ${unlocked ? reward.color : "#2D1F52"}`,
                          borderRadius: 14, cursor: "pointer", textAlign: "left" as const,
                          opacity: unlocked ? 1 : 0.65,
                        }}
                      >
                        <div style={{ fontSize: 28, flexShrink: 0, filter: unlocked ? "none" : "grayscale(100%)" }}>{reward.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{reward.title}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: unlocked ? reward.color : "#6B7280", padding: "2px 7px", borderRadius: 99, background: unlocked ? `${reward.color}22` : "rgba(255,255,255,0.06)" }}>
                              LVL {reward.level}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.4 }}>{reward.desc}</div>
                        </div>
                        <div style={{ fontSize: 16, color: unlocked ? "#10B981" : "#6B7280", flexShrink: 0 }}>
                          {unlocked ? "✓" : "🔒"}
                        </div>
                      </button>
                    );
                  })}
                  <div style={{ fontSize: 11, color: C.sub, textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
                    More cosmetic rewards coming soon.<br/>
                    Got an idea? Send feedback from Settings.
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Level Progress Modal — v2 (6-level XP + challenges system) */}
      {showLevelModal && progressInfo && counterData && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:300,
          display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={e=>{if(e.target===e.currentTarget)setShowLevelModal(false);}}>
          <div style={{background:"#111118",borderRadius:"24px 24px 0 0",width:"100%",
            maxWidth:560,maxHeight:"85vh",overflowY:"auto",padding:"24px 20px 48px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:900,fontSize:22,color:"#F0F0F0"}}>⚡ Your Level</div>
              <button onClick={()=>setShowLevelModal(false)} style={{background:"none",border:"none",
                color:"#6B7280",fontSize:26,cursor:"pointer",lineHeight:1}}>×</button>
            </div>

            {/* ── Current level + XP bar ─────────────────────────────────── */}
            {(() => {
              const lvlColors = LEVEL_COLORS[progressInfo.level];
              const xpNeeded = progressInfo.xpNeeded;
              return (
                <div style={{
                  background: `linear-gradient(135deg, ${lvlColors.badge}, #0E0820)`,
                  borderRadius: 16, padding: "20px",
                  border: `1px solid ${lvlColors.border}`,
                  marginBottom: 18, textAlign: "center" as const,
                  boxShadow: `0 0 32px ${lvlColors.glow}`,
                }}>
                  <div style={{fontSize:13,color:"#9CA3AF",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Current Level</div>
                  <div style={{fontSize:54,fontWeight:900,color:lvlColors.accent,lineHeight:1,marginTop:4}}>
                    {progressInfo.level}
                  </div>
                  {progressInfo.isMaxLevel ? (
                    <div style={{marginTop:12,fontSize:14,fontWeight:800,color:lvlColors.badgeText}}>
                      💀 MAX LEVEL — Legendary Status
                    </div>
                  ) : (
                    <>
                      <div style={{margin:"14px 0 6px",height:10,borderRadius:99,background:"rgba(255,255,255,0.08)",overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:99,background:lvlColors.accent,
                          width:`${progressInfo.xpPercent}%`,transition:"width 0.5s ease"}}/>
                      </div>
                      <div style={{fontSize:13,color:"#F0F0F0",fontWeight:700}}>
                        {progressInfo.xpInLevel} <span style={{color:"#9CA3AF",fontWeight:600}}>/ {xpNeeded} XP</span>
                      </div>
                      <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>toward Level {progressInfo.level + 1}</div>
                      {progressInfo.readyToLevelUp && (
                        <div style={{marginTop:10,padding:"8px 12px",background:"rgba(16,185,129,0.15)",
                          border:"1px solid #10B981",borderRadius:10,fontSize:12,color:"#10B981",fontWeight:800}}>
                          ✨ Ready to level up!
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {/* ── How to earn XP ─────────────────────────────────────────── */}
            <div style={{background:"#1A1228",borderRadius:14,padding:"14px 16px",
              border:"1px solid #2D1F52",marginBottom:18}}>
              <div style={{fontWeight:800,fontSize:13,color:"#F0F0F0",marginBottom:10}}>
                🎯 How to earn XP
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {XP_CATEGORIES.map(cat => {
                  const done = todayXpCategories.has(cat.key);
                  return (
                    <div key={cat.key} style={{
                      display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"7px 10px",
                      background: done ? "linear-gradient(135deg, rgba(124,58,237,0.45), rgba(167,139,250,0.30))" : "#0E0820",
                      borderRadius:8,
                      border: done ? "1px solid #A78BFA" : "1px solid #2D1F52",
                      boxShadow: done ? "0 0 8px rgba(167,139,250,0.35)" : "none",
                      transition: "all 0.2s",
                    }}>
                      <span style={{fontSize:12,color:"#F0F0F0",fontWeight:done?700:400}}>
                        {cat.icon} {cat.label} {done && <span style={{fontSize:11,marginLeft:4}}>✓</span>}
                      </span>
                      <span style={{fontSize:11,fontWeight:800,color:done?"#FFFFFF":"#A78BFA"}}>+{cat.xp}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:10,color:"#6B7280",marginTop:8,textAlign:"center" as const}}>
                Max 3 XP per category per day · 15 XP/day max · XP resets on level up
              </div>
            </div>

            {/* ── Level navigator (1-6) ──────────────────────────────────── */}
            <div style={{fontWeight:800,fontSize:13,color:"#9CA3AF",marginBottom:8,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>
              Level Breakdown
            </div>
            <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap" as const}}>
              {([1,2,3,4,5,6] as Level[]).map(lvl => {
                const isCurrent = lvl === progressInfo.level;
                const isComplete = lvl < progressInfo.level;
                const isSelected = lvl === modalSelectedLevel;
                const lvlColors = LEVEL_COLORS[lvl];
                return (
                  <button key={lvl} onClick={()=>setModalSelectedLevel(lvl)} style={{
                    flex:"1 0 auto",minWidth:50,padding:"10px 4px",borderRadius:10,cursor:"pointer",
                    background: isSelected ? lvlColors.badge : "#0E0820",
                    border: `2px solid ${isSelected ? lvlColors.accent : isCurrent ? lvlColors.accent : "#2D1F52"}`,
                    color: isSelected ? lvlColors.accent : isCurrent ? lvlColors.accent : "#9CA3AF",
                    fontSize:14, fontWeight:900, position:"relative" as const,
                    transition: "all 0.15s",
                  }}>
                    {lvl}
                    {isComplete && (
                      <div style={{position:"absolute" as const,top:2,right:4,fontSize:9,color:"#10B981"}}>✓</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Selected level details ─────────────────────────────────── */}
            {modalSelectedLevel && (() => {
              const sel = modalSelectedLevel;
              const isPureXp = sel <= 2;
              const xpForReachingThis = sel === 1 ? 0 : (XP_FOR_NEXT[(sel - 1) as Level] ?? 0);
              const challenges = sel >= 3 && sel <= 6 ? LEVEL_CHALLENGES[sel as 3|4|5|6] : [];
              const showLiveProgress = sel === progressInfo.level + 1; // only "next level" gets live data
              const lvlColors = LEVEL_COLORS[sel];
              const reached = sel <= progressInfo.level;
              return (
                <div style={{background:"#0E0820",borderRadius:14,padding:"16px",
                  border:`1.5px solid ${lvlColors.border}`,marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{fontWeight:900,fontSize:16,color:lvlColors.accent}}>
                      Level {sel} {sel === 6 && "— MAX"}
                    </div>
                    {reached ? (
                      <div style={{padding:"3px 10px",borderRadius:99,background:"rgba(16,185,129,0.15)",
                        color:"#10B981",fontSize:10,fontWeight:800,letterSpacing:"0.05em"}}>REACHED</div>
                    ) : showLiveProgress ? (
                      <div style={{padding:"3px 10px",borderRadius:99,background:lvlColors.badge,
                        color:lvlColors.accent,fontSize:10,fontWeight:800,letterSpacing:"0.05em"}}>NEXT UP</div>
                    ) : (
                      <div style={{padding:"3px 10px",borderRadius:99,background:"#1A1228",
                        color:"#6B7280",fontSize:10,fontWeight:800,letterSpacing:"0.05em"}}>LOCKED</div>
                    )}
                  </div>

                  {sel === 1 && (
                    <div style={{fontSize:12,color:"#9CA3AF",lineHeight:1.5}}>
                      Starting level. Earn 36 XP to reach Level 2.
                    </div>
                  )}
                  {sel === 2 && (
                    <div style={{fontSize:12,color:"#9CA3AF",lineHeight:1.5}}>
                      Need <strong style={{color:"#F0F0F0"}}>60 XP</strong> from Level 2 to advance to Level 3.
                      No challenges yet — pure XP.
                    </div>
                  )}
                  {sel >= 3 && (
                    <>
                      <div style={{fontSize:12,color:"#9CA3AF",marginBottom:12,lineHeight:1.5}}>
                        Need <strong style={{color:"#F0F0F0"}}>{xpForReachingThis} XP</strong> from Level {sel - 1}{" "}
                        AND complete all challenges below:
                      </div>
                      <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
                        {challenges.map(ch => {
                          // Show live progress only for the level user is currently working toward
                          const live = showLiveProgress && counterData ? ch.progress(counterData) : null;
                          const have = live?.have ?? 0;
                          const need = live?.need ?? 1;
                          const complete = live ? have >= need : false;
                          return (
                            <div key={ch.key} style={{
                              display:"flex",alignItems:"center",gap:10,
                              padding:"9px 12px",
                              background: complete ? "rgba(16,185,129,0.1)" : "#1A1228",
                              border: `1px solid ${complete ? "#10B981" : "#2D1F52"}`,
                              borderRadius:10,
                            }}>
                              <div style={{
                                width:22,height:22,borderRadius:"50%",flexShrink:0,
                                display:"flex",alignItems:"center",justifyContent:"center",
                                background: complete ? "#10B981" : "#2D1F52",
                                color: complete ? "#0E0820" : "#9CA3AF",
                                fontSize:11, fontWeight:900,
                              }}>{complete ? "✓" : ch.icon}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:700,color:"#F0F0F0"}}>{ch.label}</div>
                                {live && (
                                  <div style={{marginTop:3,height:4,borderRadius:99,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}>
                                    <div style={{
                                      height:"100%",borderRadius:99,
                                      background: complete ? "#10B981" : lvlColors.accent,
                                      width: `${Math.min(100, Math.round((have/need)*100))}%`,
                                      transition:"width 0.5s ease",
                                    }}/>
                                  </div>
                                )}
                              </div>
                              {live && (
                                <div style={{flexShrink:0,fontSize:11,fontWeight:800,
                                  color: complete ? "#10B981" : "#A78BFA",fontVariantNumeric:"tabular-nums" as any}}>
                                  {have}/{need}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editProfile && (
        <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.white,borderRadius:28,padding:32,width:"100%",maxWidth:440,boxShadow:"0 20px 60px rgba(0,0,0,0.15)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontWeight:900,fontSize:22,color:C.text,marginBottom:20}}>Edit Profile</div>
            <input style={inputStyle} value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))} placeholder="Full Name"/>
            <input style={inputStyle} value={profile.username} onChange={e=>setProfile(p=>({...p,username:e.target.value}))} placeholder="Username"/>
            <textarea style={{...inputStyle,resize:"none"}} rows={3} value={profile.bio} onChange={e=>setProfile(p=>({...p,bio:e.target.value}))} placeholder="Bio"/>
            <input style={inputStyle} value={profile.city} onChange={e=>setProfile(p=>({...p,city:e.target.value}))} placeholder="City (e.g. Las Vegas, NV)"/>
            {(user?.profile as any)?.account_type === 'business' && (
              <>
                <input style={inputStyle} value={(user?.profile as any)?.business_name || ''} readOnly placeholder="Business Name" />
                <input style={inputStyle} value={(user?.profile as any)?.business_website || ''} readOnly placeholder="Website URL" />
              </>
            )}
            <div style={{display:"flex",gap:12,marginTop:8}}>
              <button onClick={()=>setEditProfile(false)} style={{flex:1,padding:"13px 0",borderRadius:14,border:`2px solid ${C.purpleMid}`,background:"#0D0D0D",color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
              <button onClick={async()=>{
                if(!user)return;
                await supabase.from('users').update({full_name:profile.name,username:profile.username,bio:profile.bio,city:profile.city} as any).eq('id',user.id);
                await refreshProfile();
                setEditProfile(false);
              }} style={{flex:1,padding:"13px 0",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save</button>
            </div>
          </div>
        </div>
      )}

      {highlightLb && (
        <Lightbox
          src={highlightLb}
          photos={feedPhotos}
          onChange={(s) => setHighlightLb(s)}
          onClose={() => setHighlightLb(null)}
        />
      )}

      {showAllPhotos && (
        <AllPhotosModal
          photos={feedPhotos}
          onClose={() => setShowAllPhotos(false)}
          onSelectPhoto={(p) => setHighlightLb(p)}
        />
      )}

      {showTaggedPosts && user && (
        <TaggedPostsModal
          userId={user.id}
          displayName={profile.name || user.email || "You"}
          isOwnProfile={true}
          onClose={() => setShowTaggedPosts(false)}
        />
      )}

      <div className="profile-outer" style={{maxWidth:1200,padding:"20px 24px 32px",margin:"0 auto"}}>

        {/* Profile header */}
        <div className="profile-header-wrap" style={{display:"flex",gap:isMobile?16:24,alignItems:"flex-start",flexWrap:"wrap",marginBottom:28}}>
          {/* Avatar */}
          {/* Desktop-only nudge: shifted left/down to improve visual balance
              with the banner. Mobile centering is unchanged.
              Children stack with alignItems: "center" so name/handle/city
              text sits centered under the round profile photo. */}
          <div className="profile-avatar-col" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,flexShrink:0,width:avatarSize,marginLeft:isMobile?0:-60,marginTop:isMobile?0:96}}>
            {/* Silver halo wrap — slow rotating conic-gradient ring around the
                avatar at Level 3+. Adds the "moving picture" magic without
                requiring video uploads. Wrap is conditional so lower-level
                users see a clean avatar with no extra padding. */}
            <div className={(progressInfo?.level ?? 1) >= 3 ? "tier-silver-avatar-wrap" : ""} style={{
              position:"relative",
              cursor:avatarRepositionMode?"ns-resize":"default",
              userSelect:"none",
            }}
              onMouseDown={handleAvatarMouseDown}
              onMouseMove={handleAvatarMouseMove}
              onMouseUp={handleAvatarMouseUp}
              onMouseLeave={handleAvatarMouseUp}
            >
              <TierFrame tier={userTier} size={avatarSize}>
              {profileImg
                ? <img src={ImagePresets.full(profileImg)} loading="lazy" decoding="async" style={{width:avatarSize,height:avatarSize,borderRadius:"50%",objectFit:"cover",objectPosition:`center ${avatarPosition}%`,transform:`scale(${avatarScale/100})`,transformOrigin:"center center",display:"block",pointerEvents:"none",transition:avatarDragState?"none":"transform 0.1s, object-position 0.1s"}} alt="Profile"/>
                : <div style={{width:avatarSize-32,height:avatarSize-32,borderRadius:"50%",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:avatarSize<140?38:58,fontWeight:900,color:"#fff"}}>{profile.name[0]}</div>}
              </TierFrame>
              {/* When no image, make whole circle a label */}
              {!profileImg && !avatarRepositionMode && (
                <label style={{position:"absolute",inset:0,borderRadius:"50%",cursor:"pointer",zIndex:5,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>loadImg(e,setAvatar,user?{bucket:'avatars',path:`${user.id}/avatar.jpg`,dbField:'avatar_url'}:undefined)}/>
                  <span style={{fontSize:13}}>📷</span>
                </label>
              )}
              {/* Camera button always visible at bottom right when not repositioning */}
              {!avatarRepositionMode && (
                <label style={{position:"absolute",bottom:8,right:8,width:32,height:32,borderRadius:"50%",background:"#7C3AED",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,cursor:"pointer",zIndex:10,boxShadow:"0 2px 8px rgba(0,0,0,0.4)"}}>
                  📷
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>loadImg(e,setAvatar,user?{bucket:'avatars',path:`${user.id}/avatar.jpg`,dbField:'avatar_url'}:undefined)}/>
                </label>
              )}
              {/* Reposition button — show when image exists and not in reposition mode.
                  Hidden on mobile via .hide-on-mobile — touch UX will handle this differently later. */}
              {profileImg && !avatarRepositionMode && user && (
                <button className="hide-on-mobile" onClick={e=>{e.preventDefault();setAvatarRepositionMode(true);}}
                  style={{position:"absolute",top:4,left:4,background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"4px 10px",cursor:"pointer",border:"none",display:"flex",alignItems:"center",gap:4,zIndex:5}}>
                  <span style={{fontSize:11}}>↕</span>
                  <span style={{color:"#fff",fontSize:10,fontWeight:700}}>Reposition</span>
                </button>
              )}
              {/* Reposition mode controls — bottom of avatar circle. Slider
                  lives BELOW the avatar (in the column wrapper) so it
                  doesn't overlay the image. */}
              {avatarRepositionMode && (
                <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,borderRadius:"50%",background:"rgba(0,0,0,0.15)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px",zIndex:10,pointerEvents:"none"}}>
                  <div style={{background:"rgba(0,0,0,0.7)",borderRadius:20,padding:"4px 12px",color:"#fff",fontSize:10,fontWeight:700}}>↕ Drag to move</div>
                </div>
              )}
            </div>
            {/* Avatar zoom + save controls — outside the circle so the
                slider has room. Only shown in reposition mode. */}
            {avatarRepositionMode && (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,width:"100%",maxWidth:300}}>
                <div style={{background:"rgba(0,0,0,0.85)",borderRadius:20,padding:"6px 12px",display:"flex",alignItems:"center",gap:8,width:"100%"}}>
                  <button onClick={e=>{e.preventDefault();e.stopPropagation();setAvatarScale(s=>Math.max(100,s-10));}} style={{background:"transparent",border:"none",color:"#fff",fontSize:18,fontWeight:700,cursor:"pointer",padding:"0 4px",lineHeight:1}}>−</button>
                  <input type="range" min={100} max={300} step={1} value={avatarScale} onChange={e=>setAvatarScale(parseFloat(e.target.value))} onClick={e=>e.stopPropagation()} style={{flex:1,accentColor:"#7C3AED"}}/>
                  <button onClick={e=>{e.preventDefault();e.stopPropagation();setAvatarScale(s=>Math.min(300,s+10));}} style={{background:"transparent",border:"none",color:"#fff",fontSize:18,fontWeight:700,cursor:"pointer",padding:"0 4px",lineHeight:1}}>+</button>
                  <span style={{color:"#fff",fontSize:10,fontWeight:700,minWidth:32,textAlign:"right"}}>{Math.round(avatarScale)}%</span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={e=>{e.preventDefault();e.stopPropagation();setAvatarPosition(50);setAvatarScale(100);}} style={{background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"5px 10px",border:"none",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>Reset</button>
                  <button onClick={e=>{e.preventDefault();e.stopPropagation();saveAvatarPosition();}} style={{background:"#7C3AED",borderRadius:20,padding:"5px 12px",border:"none",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>✓ Save</button>
                  <button onClick={e=>{e.preventDefault();e.stopPropagation();setAvatarRepositionMode(false);setAvatarDragState(null);}} style={{background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"5px 12px",border:"none",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>Cancel</button>
                </div>
              </div>
            )}
            </div>
            <div style={{textAlign:"center",width:"100%"}}>
              {/* Profile name with tier treatments. L4 Gold gets a shimmering
                  gold gradient. L6 Diamond gets a holographic chrome effect.
                  L1-L3 + L5 use the plain white text. The CSS classes apply
                  background-clip text fill — the actual text content stays
                  the user's name. */}
              {(() => {
                const lvl = progressInfo?.level ?? 1;
                const nameClass =
                  lvl >= 6 ? "tier-diamond-name" :
                  lvl >= 4 ? "tier-gold-name"   : "";
                return (
                  <div className={nameClass} style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:2}}>
                    {profile.name}
                  </div>
                );
              })()}
              {profile.username && (
                <div style={{fontWeight:600,fontSize:13,color:C.sub,marginBottom:6}}>@{profile.username}</div>
              )}
              {/* LEVEL pill removed — already shown in floating XP badge */}
              {profile.city && (
                <div style={{fontSize:12,color:C.sub,marginTop:6}}>📍 {profile.city}</div>
              )}

              {(user?.profile as any)?.account_type === 'business' && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, justifyContent: "center" }}>
                  <span style={{ background: "#1A2A1A", color: "#7C3AED", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99, border: "1px solid #2A3A2A" }}>
                    🏢 {(user?.profile as any)?.business_type || 'Business'}
                  </span>
                  {(user?.profile as any)?.business_website && (
                    <a href={(user?.profile as any)?.business_website} target="_blank" rel="noopener noreferrer"
                      style={{ background: "#1A2A1A", color: "#7C3AED", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, border: "1px solid #2A3A2A", textDecoration: "none" }}>
                      🔗 Website
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Banner + stats */}
          <div className="profile-banner-block" style={{flex:1,minWidth:220}}>
            <div
              className="profile-banner-label"
              style={{width:"100%",height:320,borderRadius:26,overflow:"hidden",position:"relative",marginBottom:14,background:bannerImg?"transparent":`linear-gradient(135deg,${C.purple},#DDD6FE)`,border:`2px solid ${repositionMode?"#F5A623":C.purpleMid}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:repositionMode?"ns-resize":"default",userSelect:"none"}}
              onMouseEnter={()=>setBannerHovered(true)}
              onMouseLeave={()=>{ setBannerHovered(false); setDragState(null); }}
              onMouseDown={handleBannerMouseDown}
              onMouseMove={handleBannerMouseMove}
              onMouseUp={handleBannerMouseUp}
              onTouchStart={e=>{ if(!repositionMode)return; setDragState({startY:e.touches[0].clientY,startPos:bannerPosition}); }}
              onTouchMove={handleBannerTouchMove}
              onTouchEnd={()=>setDragState(null)}
            >
              {bannerImg
                ? <img src={ImagePresets.full(bannerImg)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:`center ${bannerPosition}%`,transform:`scale(${bannerScale/100})`,transformOrigin:"center center",transition:dragState?"none":"transform 0.1s, object-position 0.1s",pointerEvents:"none"}} alt="Banner"/>
                : <span style={{fontWeight:900,fontSize:17,color:"rgba(255,255,255,0.7)"}}>📷 Tap to add Banner</span>}
              {/* Reposition button — show on hover or when in reposition mode.
                  Hidden on mobile via .hide-on-mobile (touch UX later). */}
              {bannerImg && !repositionMode && (bannerHovered || true) && user && (
                <button
                  className="hide-on-mobile"
                  onClick={e=>{e.preventDefault();setRepositionMode(true);}}
                  style={{position:"absolute",top:10,left:10,background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"5px 12px",cursor:"pointer",border:"none",display:"flex",alignItems:"center",gap:6,zIndex:5}}
                >
                  <span style={{fontSize:12}}>↕</span>
                  <span style={{color:"#fff",fontSize:11,fontWeight:700}}>Reposition</span>
                </button>
              )}
              {/* Reposition mode controls */}
              {repositionMode && (
                <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.15)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",zIndex:10,pointerEvents:"none"}}>
                  <div style={{background:"rgba(0,0,0,0.65)",borderRadius:20,padding:"4px 14px",color:"#fff",fontSize:11,fontWeight:700}}>↕ Drag to reposition</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"center",pointerEvents:"all",width:"100%",maxWidth:360}}>
                    {/* Zoom slider — 100% to 300%. Click increments via the
                        − / + buttons for precise control. */}
                    <div style={{background:"rgba(0,0,0,0.65)",borderRadius:20,padding:"6px 12px",display:"flex",alignItems:"center",gap:10,width:"100%"}}>
                      <button onClick={e=>{e.preventDefault();e.stopPropagation();setBannerScale(s=>Math.max(100,s-10));}} style={{background:"transparent",border:"none",color:"#fff",fontSize:18,fontWeight:700,cursor:"pointer",padding:"0 6px",lineHeight:1}}>−</button>
                      <input type="range" min={100} max={300} step={1} value={bannerScale} onChange={e=>setBannerScale(parseFloat(e.target.value))} onClick={e=>e.stopPropagation()} style={{flex:1,accentColor:"#7C3AED"}}/>
                      <button onClick={e=>{e.preventDefault();e.stopPropagation();setBannerScale(s=>Math.min(300,s+10));}} style={{background:"transparent",border:"none",color:"#fff",fontSize:18,fontWeight:700,cursor:"pointer",padding:"0 6px",lineHeight:1}}>+</button>
                      <span style={{color:"#fff",fontSize:11,fontWeight:700,minWidth:36,textAlign:"right"}}>{Math.round(bannerScale)}%</span>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={e=>{e.preventDefault();e.stopPropagation();setBannerPosition(50);setBannerScale(100);}} style={{background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"6px 12px",border:"none",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>Reset</button>
                      <button onClick={e=>{e.preventDefault();e.stopPropagation();saveBannerPosition();}} style={{background:"#7C3AED",borderRadius:20,padding:"6px 16px",border:"none",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>✓ Save</button>
                      <button onClick={e=>{e.preventDefault();e.stopPropagation();setRepositionMode(false);setDragState(null);}} style={{background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"6px 16px",border:"none",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>Done</button>
                    </div>
                  </div>
                </div>
              )}
              {/* Always-visible camera button overlay for banner */}
              {!repositionMode && (
                <label style={{position:"absolute",bottom:10,right:10,background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"6px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,zIndex:5}}>
                  <span style={{fontSize:16}}>📷</span>
                  <span style={{color:"#fff",fontSize:12,fontWeight:700}}>Change</span>
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>loadImg(e,setBanner,user?{bucket:'avatars',path:`${user.id}/banner.jpg`,dbField:'banner_url'}:undefined)}/>
                </label>
              )}
            </div>

            <div className="profile-stats-bio">
            {profile.bio && (
              <div style={{
                position:"relative",
                fontSize:16,
                fontWeight:500,
                color:C.text,
                lineHeight:1.55,
                marginBottom:18,
                padding:"14px 16px 14px 20px",
                background:"#1A1228",
                borderRadius:14,
                borderLeft:`3px solid ${C.purple}`,
              }}>
                {profile.bio}
              </div>
            )}

            <div style={{display:"flex",alignItems:"stretch",gap:0,marginBottom:14,borderRadius:16,overflow:"hidden",border:"1px solid #2A3A2A"}}>
              {[
                {l:"Followers",v:user?.profile?.followers_count??0,onClick:()=>openSocialModal("followers")},
                {l:"Following",v:user?.profile?.following_count??0,onClick:()=>openSocialModal("following")},
              ].map((s,i)=>(
                <div key={s.l} onClick={s.onClick}
                  style={{flex:1,textAlign:"center",cursor:"pointer",padding:"14px 10px",background:"#111811",transition:"background 0.15s",position:"relative",borderLeft:i>0?"1px solid #2A3A2A":"none"}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background="#1A2A1A"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background="#111811"}}>
                  <div style={{fontSize:26,fontWeight:900,color:C.purple,lineHeight:1,letterSpacing:-1}}>{s.v.toLocaleString()}</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={{display:"flex", gap:8, width:"100%"}}>
              <button onClick={()=>setEditProfile(true)} style={{padding:"11px 22px",borderRadius:14,border:`1.5px solid ${C.purple}`,background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",flex:1,transition:"all 0.15s"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="#DDD6FE"}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="transparent"}}>
                ✏️ Edit Profile
              </button>
              <button onClick={shareProfile} aria-label="Share profile" style={{
                padding:"11px 14px", borderRadius:14, border:`1.5px solid ${C.purple}`,
                background: "transparent", color: C.purple,
                fontWeight: 800, fontSize: 14, cursor: "pointer",
                flexShrink: 0, transition: "all 0.15s",
              }}>
                {profileShareCopied ? "✓ Copied" : "🔗 Share"}
              </button>
            </div>
            </div>{/* end profile-stats-bio */}
          </div>
        </div>

        {/* 3-column */}
        <div className="profile-layout" style={{display:"grid",gridTemplateColumns:"minmax(200px,240px) 1fr minmax(200px,240px)",gap:16,alignItems:"start"}}>

          {/* LEFT — Highlights + Level Progress */}
          <div style={{paddingTop:44}}>
            {/* Level progress card — v2 (6-level system) */}
            <button onClick={()=>setShowLevelModal(true)} style={{
              width:"100%",marginBottom:12,
              background: progressInfo
                ? `linear-gradient(135deg, ${LEVEL_COLORS[progressInfo.level].badge}, rgba(14,8,32,0.8))`
                : "rgba(124,58,237,0.10)",
              border: progressInfo
                ? `1.5px solid ${LEVEL_COLORS[progressInfo.level].border}`
                : "1.5px solid rgba(124,58,237,0.35)",
              borderRadius:16,padding:"14px 16px",cursor:"pointer",textAlign:"left" as const,
              boxShadow: progressInfo ? `0 0 16px ${LEVEL_COLORS[progressInfo.level].glow}` : "none",
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontWeight:800,fontSize:13,color:C.text}}>
                  ⚡ Level {progressInfo?.level ?? 1} Progress
                </div>
                <span style={{fontSize:11,fontWeight:700,
                  color: progressInfo ? LEVEL_COLORS[progressInfo.level].accent : "#7C3AED"}}>
                  {progressInfo?.isMaxLevel ? "MAX" : `${progressInfo?.xpInLevel ?? 0}/${progressInfo?.xpNeeded ?? 36} XP`}
                </span>
              </div>
              <div style={{height:6,borderRadius:99,background:"rgba(255,255,255,0.08)",overflow:"hidden",marginBottom:6}}>
                <div style={{height:"100%",borderRadius:99,
                  background: progressInfo
                    ? `linear-gradient(90deg, ${LEVEL_COLORS[progressInfo.level].accent}, #A78BFA)`
                    : "linear-gradient(90deg,#7C3AED,#A78BFA)",
                  width:`${progressInfo?.xpPercent ?? 0}%`,transition:"width 0.5s ease"}}/>
              </div>
              {progressInfo?.readyToLevelUp ? (
                <div style={{fontSize:10,color:"#10B981",fontWeight:800,textAlign:"center" as const}}>
                  ✨ Ready to level up — tap to confirm
                </div>
              ) : progressInfo?.isMaxLevel ? (
                <div style={{fontSize:10,color:LEVEL_COLORS[6].accent,fontWeight:700,textAlign:"center" as const}}>
                  MAX LEVEL ✦ Tap for details
                </div>
              ) : (
                <div style={{fontSize:10,color:C.sub,textAlign:"center" as const}}>
                  Tap to see what's needed for next level →
                </div>
              )}
            </button>

            {/* Customizations panel — shows what's unlocked at each level */}
            <button
              onClick={() => setShowCustomizations(true)}
              style={{
                width: "100%",
                marginBottom: 12,
                background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(167,139,250,0.10))",
                border: "1.5px solid rgba(167,139,250,0.45)",
                borderRadius: 16,
                padding: "14px 16px",
                cursor: "pointer",
                textAlign: "left" as const,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: C.text }}>
                  ✨ Customizations
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA" }}>
                  {(() => {
                    const lvl = progressInfo?.level ?? 1;
                    const unlockedCount = [2, 3, 4, 5, 6].filter(l => lvl >= l).length;
                    return `${unlockedCount}/5 unlocked`;
                  })()}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.sub }}>
                Tap to see your unlocked profile rewards →
              </div>
            </button>

            <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.purpleMid}`,boxShadow:"0 4px 14px rgba(124,58,237,0.08)",marginBottom:20}}>
              {/* Title row — just the heading + Edit toggle. The three
                  navigation buttons (All Photos / Tagged In / Recaps) used
                  to live here too, but with three of them the row wrapped
                  awkwardly in the narrow profile column. They moved to a
                  dedicated row below (see next div). */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontWeight:900,fontSize:17,color:C.text}}>📸 Highlights</div>
                {highlights.length > 0 && (
                  <button onClick={()=>setEditingHighlights(e=>!e)} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:editingHighlights?C.purple:"#2D1F52",color:editingHighlights?"#fff":C.purple,border:`1.5px solid ${C.purpleMid}`,cursor:"pointer"}}>
                    {editingHighlights ? "✓ Done" : "✏️ Edit"}
                  </button>
                )}
              </div>
              {/* Nav buttons row — three equal-width buttons. flex with
                  flex:1 so each takes equal share. Wraps to 2-row layout
                  on very narrow viewports via flex-wrap. */}
              <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
                <button onClick={()=>setShowAllPhotos(true)} style={{flex:"1 1 30%",minWidth:90,fontSize:11,fontWeight:700,padding:"7px 8px",borderRadius:14,background:"#2D1F52",color:"#A78BFA",border:"1.5px solid #3D2A6E",cursor:"pointer",textAlign:"center"}}>📷 All Photos</button>
                <button onClick={()=>setShowTaggedPosts(true)} style={{flex:"1 1 30%",minWidth:90,fontSize:11,fontWeight:700,padding:"7px 8px",borderRadius:14,background:"#2D1F52",color:"#A78BFA",border:"1.5px solid #3D2A6E",cursor:"pointer",textAlign:"center"}}>🏷️ Tagged In</button>
                <a href="/recap" style={{flex:"1 1 30%",minWidth:90,fontSize:11,fontWeight:700,padding:"7px 8px",borderRadius:14,background:"#2D1F52",color:"#A78BFA",border:"1.5px solid #3D2A6E",cursor:"pointer",textDecoration:"none",textAlign:"center",display:"inline-block"}}>📊 Recaps</a>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {Array.from({length:HIGHLIGHT_SLOTS}).map((_,i) => {
                  const src = highlights[i];
                  if (src) {
                    return (
                      <div key={i} className="highlight-slot" style={{position:"relative",aspectRatio:"1",borderRadius:12,overflow:"hidden",cursor:"pointer"}}>
                        <img onClick={()=>{ if(!editingHighlights) setHighlightLb(src); }} src={src} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                        <button
                          className="highlight-remove"
                          onClick={(e)=>{e.stopPropagation();removeHighlight(i);}}
                          style={{position:"absolute",top:4,right:4,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.65)",border:"none",color:"#fff",fontSize:14,lineHeight:"22px",textAlign:"center",cursor:"pointer",opacity:editingHighlights?1:0,transition:"opacity 0.15s",padding:0}}>×</button>
                      </div>
                    );
                  }
                  if (i === highlights.length) {
                    return (
                      <button key={i} onClick={()=>setShowHighlightPicker(true)} style={{aspectRatio:"1",borderRadius:12,border:`2px dashed ${C.purpleMid}`,background:"#1A1230",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:2,padding:0}}>
                        <span style={{fontSize:22,color:C.purple,lineHeight:1}}>+</span>
                        <span style={{fontSize:9,color:C.sub,fontWeight:600}}>Add</span>
                      </button>
                    );
                  }
                  return (
                    <div key={i} style={{aspectRatio:"1",borderRadius:12,background:`${C.purpleMid}55`,border:`1px solid ${C.purpleMid}`}}/>
                  );
                })}
              </div>
              {highlights.length > 0 && (
                <div style={{marginTop:10,fontSize:11,color:C.sub,textAlign:"center"}}>{highlights.length}/{HIGHLIGHT_SLOTS} photos</div>
              )}
            </div>
          </div>

          {/* CENTER */}
          <div>
            <div style={{fontWeight:900,fontSize:20,color:C.text,marginBottom:16}}>Activity Log</div>
            {loadingLogs ? (
              <div style={{textAlign:"center",padding:"40px 0",color:C.sub}}>
                <div style={{width:36,height:36,borderRadius:"50%",border:`4px solid ${C.purpleMid}`,borderTopColor:C.purple,animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <div style={{fontSize:14}}>Loading activity log...</div>
              </div>
            ) : (
              <>
                {/* Workout Progress Graphs — uses rawWorkoutLogs so each
                    individual workout counts (multi-per-day no longer
                    collapses to 1). The component handles month filtering
                    internally. */}
                {rawWorkoutLogs.length > 0 && (
                  <div style={{background:C.white,borderRadius:16,padding:16,border:`1px solid ${C.purpleMid}`,marginBottom:20}}>
                    <WorkoutProgressGraphs workouts={rawWorkoutLogs} />
                  </div>
                )}
                {(()=>{
                  const days = realDays.length > 0 ? realDays : DAYS;
                  const isReal = realDays.length > 0;
                  const now = new Date();
                  const cutoff7 = new Date(now); cutoff7.setDate(now.getDate() - 7);
                  const recent = days.filter((d:any) => new Date((d as any)._date || 0) >= cutoff7);
                  const older  = days.filter((d:any) => new Date((d as any)._date || 0) < cutoff7);

                  const makeCard = (day: any) => (
                    <DayCard
                      key={day.id}
                      day={day as any}
                      workoutLogId={(day as any)._workoutLogId}
                      nutritionLogIds={(day as any)._nutritionLogIds}
                      // wellnessLogIds was previously missing here, which forced
                      // saveWellness in DayCard to always fall into the INSERT
                      // branch — creating phantom duplicate rows on every edit.
                      // Wiring it through means edits actually update existing
                      // rows.
                      wellnessLogIds={(day as any)._wellnessLogIds}
                      earnedBadges={earnedBadges.map(b => b.badge_id)}
                      userLevel={progressInfo?.level ?? 1}
                      onDelete={isReal ? async () => {
                        // Delete every log row tied to this card. With multi-
                        // workout merging, _workoutLogIds may contain >1 entry.
                        const wids: string[] = (day as any)._workoutLogIds || ((day as any)._workoutLogId ? [(day as any)._workoutLogId] : []);
                        const nids: string[] = (day as any)._nutritionLogIds || [];
                        const wellIds: string[] = (day as any)._wellnessLogIds || [];
                        const allIds = [...wids, ...nids, ...wellIds];
                        if (allIds.length > 0) {
                          await supabase.from('activity_logs').delete().in('id', allIds);
                        }
                        setRealDays(prev => prev.filter(d => d.id !== day.id));
                      } : undefined}
                    />
                  );

                  // Group older days by year → month
                  const byMonth: Record<string, any[]> = {};
                  older.forEach(d => {
                    const dt = new Date((d as any)._date || 0);
                    const mk = `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2,"0")}`;
                    if (!byMonth[mk]) byMonth[mk] = [];
                    byMonth[mk].push(d);
                  });
                  const byYear: Record<string, string[]> = {};
                  Object.keys(byMonth).forEach(mk => {
                    const yr = mk.split("-")[0];
                    if (!byYear[yr]) byYear[yr] = [];
                    byYear[yr].push(mk);
                  });
                  const currentYear = now.getFullYear().toString();

                  return (
                    <>
                      {recent.map(makeCard)}
                      {older.length > 0 && (
                        <div style={{marginTop:16}}>
                          {Object.entries(byYear).sort((a,b)=>Number(b[0])-Number(a[0])).map(([yr, mks]) => (
                            <div key={yr}>
                              {yr !== currentYear && (
                                <div style={{display:"flex",alignItems:"center",gap:10,margin:"20px 0 12px"}}>
                                  <div style={{flex:1,height:1,background:C.purpleMid}}/>
                                  <span style={{fontSize:12,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:1.5}}>{yr}</span>
                                  <div style={{flex:1,height:1,background:C.purpleMid}}/>
                                </div>
                              )}
                              {mks.sort((a,b)=>b.localeCompare(a)).map(mk => (
                                <MonthCard key={mk} mDays={byMonth[mk]} makeCard={makeCard}/>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>

          {/* RIGHT */}
          <div style={{paddingTop:44}}>
            {/* Streak section — three strict-math streaks. Sits above
                Badges since streaks reflect current behavior and badges
                reflect lifetime achievements; current state should be more
                prominent. */}
            {user && <StreakSection userId={user.id} theme="purple" />}

            {/* Badges & Awards */}
            <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.purpleMid}`,boxShadow:"0 4px 14px rgba(124,58,237,0.08)",marginBottom:20}}>
              <div style={{fontWeight:900,fontSize:17,color:C.text,marginBottom:16}}>🏆 Badges & Awards</div>
              {(() => {
                // Use the same family grouping the modal uses, so the preview
                // grid matches the new badge design (BadgeTile with sigils,
                // tier ornaments, shimmer) instead of the old hand-rolled
                // gold-bordered tiles which referenced renamed badge IDs.
                const previewFamilies: DisplayBadge[] = groupBadgesIntoFamilies(earnedBadges, badgeCounters);
                const totalBadges = previewFamilies.length + completedChallenges.length;

                if (totalBadges === 0) {
                  return (
                    <div style={{textAlign:"center",padding:"28px 16px",background:"#1A1230",borderRadius:16,marginBottom:16}}>
                      <div style={{fontSize:36,marginBottom:8}}>🏆</div>
                      <div style={{fontSize:14,fontWeight:700,color:C.sub,lineHeight:1.5}}>Complete fitness milestones to earn badges</div>
                    </div>
                  );
                }

                // Show first 6 families. Modal shows them all.
                const previewSlice = previewFamilies.slice(0, 6);

                return (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                      {previewSlice.map(g => {
                        // ── CREDENTIAL: holographic prestige look (compact) ──
                        if (g.renderType === "credential") {
                          return (
                            <div key={g.key} style={{
                              borderRadius:14,
                              padding:"12px 6px",
                              textAlign:"center",
                              position:"relative",
                              overflow:"hidden",
                              border:"2px solid transparent",
                              background: `
                                linear-gradient(#0A0A14, #0A0A14) padding-box,
                                linear-gradient(135deg, #ff6ec4, #7873f5, #4ade80, #facc15, #ff6ec4) border-box
                              `,
                              boxShadow:"0 0 12px rgba(120, 115, 245, 0.3)",
                            }}>
                              <div style={{
                                position:"absolute",inset:0,pointerEvents:"none",
                                background:"linear-gradient(125deg, rgba(255,110,196,0.08), rgba(120,115,245,0.12), rgba(74,222,128,0.08), rgba(250,204,21,0.1))",
                                backgroundSize:"200% 200%",
                                animation:"holoShimmer 5s ease infinite",
                              }} />
                              <div style={{position:"relative"}}>
                                <div style={{fontSize:22,marginBottom:3}}>{g.emoji}</div>
                                <div style={{fontWeight:800,fontSize:10,color:"#F0F0F0",lineHeight:1.2}}>{g.label}</div>
                              </div>
                            </div>
                          );
                        }

                        // ── YEARLY: year-stamped (compact) ──
                        if (g.renderType === "yearly") {
                          return (
                            <div key={g.key} style={{
                              borderRadius:14,
                              padding:"12px 6px",
                              textAlign:"center",
                              position:"relative",
                              overflow:"hidden",
                              border:"2px solid #F472B6",
                              background:"linear-gradient(135deg, #4C1D4D, #2B1550, #183B4E)",
                              animation:"birthdayPulse 3s ease-in-out infinite",
                            }}>
                              {g.year && (
                                <div style={{position:"absolute",top:3,right:5,
                                  fontSize:8,fontWeight:900,
                                  color:"#FFD1E6",letterSpacing:0.5,
                                  textShadow:"0 0 6px rgba(244,114,182,0.6)"}}>
                                  {g.year}
                                </div>
                              )}
                              <div style={{fontSize:22,marginBottom:3}}>{g.emoji}</div>
                              <div style={{fontWeight:900,fontSize:10,color:"#FFE5F1",lineHeight:1.2}}>{g.label}</div>
                            </div>
                          );
                        }

                        // ── PROGRESSION: BadgeTile component (proper sigils, tier rings, shimmer) ──
                        return (
                          <BadgeTile
                            key={g.key}
                            tier={g.tier ?? 1}
                            emoji={g.emoji}
                            label={g.label}
                            desc={g.desc}
                            category={g.category}
                            earnedCount={g.earnedCount}
                            maxTier={g.maxTier}
                            compact
                          />
                        );
                      })}
                    </div>
                    {totalBadges > 6 && (
                      <button onClick={()=>setShowAllBadgesModal(true)} style={{width:"100%",padding:"10px 0",marginBottom:12,borderRadius:14,border:`1.5px dashed ${C.purpleMid}`,background:"#2D1F52",color:"#A78BFA",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                        👀 View all {totalBadges} badges
                      </button>
                    )}
                  </>
                );
              })()}
              <button onClick={()=>setShowBadgeModal(true)} style={{width:"100%",padding:"13px 0",borderRadius:16,border:"none",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:C.white,fontWeight:900,fontSize:14,cursor:"pointer"}}>
                🏆 Report an Achievement
              </button>
            </div>

            {/* Body Weight Tracker */}
            {user && <WeightTracker userId={user.id} />}

            <EditableList title="Favorite Brands" items={brands} onSave={setBrands} emptyItem={{emoji:"👟",name:"New Brand"}}
              renderItem={(item,i,setList)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input style={{width:48,borderRadius:10,border:`1.5px solid ${C.purpleMid}`,padding:"8px 4px",textAlign:"center",fontSize:18,outline:"none",background:"#0D0D0D"}} value={item.emoji} onChange={e=>setList(l=>l.map((x:any,j:number)=>j===i?{...x,emoji:e.target.value}:x))}/>
                  <input style={{flex:1,borderRadius:10,border:`1.5px solid ${C.purpleMid}`,padding:"8px 12px",fontSize:14,color:C.text,outline:"none",background:"#0D0D0D"}} value={item.name} onChange={e=>setList(l=>l.map((x:any,j:number)=>j===i?{...x,name:e.target.value}:x))}/>
                  <button onClick={()=>setList(l=>l.filter((_:any,j:number)=>j!==i))} style={{width:28,height:28,borderRadius:"50%",border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:16,cursor:"pointer"}}>×</button>
                </div>
              )}/>
          </div>
        </div>
      </div>
    </div>
  );
}




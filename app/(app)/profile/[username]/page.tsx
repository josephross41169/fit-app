"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import FollowButton from "@/components/FollowButton";
import ReportModal, { ReportTarget } from "@/components/ReportModal";
import { clearBlockCache } from "@/lib/blocks";
import { BADGES } from "@/lib/badges";
import { isBusinessAccount } from "@/lib/businessTypes";
import { ImagePresets } from "@/lib/imageUrls";
import { cachedQuery, getCached, setCached } from "@/lib/queryCache";
import BusinessProfileView from "@/components/BusinessProfileView";
import { getLevelProgress, LEVEL_COLORS } from "@/lib/tiers";
import WorkoutProgressGraphs from "@/components/WorkoutProgressGraphs";
import TaggedPostsModal from "@/components/TaggedPostsModal";
import StreakSection from "@/components/StreakSection";

const C = {
  bg:"#0D0D0D", white:"#1A1A1A", greenLight:"#1A2A1A", greenMid:"#2A3A2A",
  blue:"#16A34A", text:"#F0F0F0", sub:"#9CA3AF", gold:"#F5A623", goldLight:"#2A1F00",
  darkCard:"#1A1A1A", darkBorder:"#2A2A2A", darkSub:"#6B7280",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Wellness style lookup ─────────────────────────────────────────────────────
// 26 activities → emoji + accent color. Mirrors the constant in /profile/page.tsx
// so own-profile and other-profile renders use the same visual vocabulary.
type WellnessStyle = { emoji: string; accent: string };
const WELLNESS_STYLES: Record<string, WellnessStyle> = {
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
function getWellnessStyle(activity: string): WellnessStyle {
  return WELLNESS_STYLES[activity.toLowerCase().trim()] || { emoji: "🌿", accent: "#A78BFA" };
}
function formatTimeOfDay(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

// ── Badge definitions ─────────────────────────────────────────────────────────
// AllPhotosModal + Lightbox (matches /profile own page)
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

// ── Read-only Day Card ────────────────────────────────────────────────────────
function ReadOnlyDayCard({day, userLevel = 1}:{day:any; userLevel?: number}) {
  const [open,setOpen]   = useState(false);
  const [nutOpen,setNutOpen] = useState(false);
  const [lb,setLb]       = useState<string|null>(null);
  const [photos,setPhotos] = useState<string[]>([]);

  const workout   = day.workout   || null;
  const nutrition = day.nutrition || null;
  const wellness  = day.wellness  || null;

  // Parse date from id (MM/DD/YYYY or M.D)
  useEffect(() => {
    const allPhotos: string[] = [];
    if (day.photo_url) allPhotos.push(day.photo_url);
    const nutPhotos: string[] = (day.nutrition?.photoUrls || []).filter(Boolean);
    nutPhotos.forEach((url: string) => {
      if (!allPhotos.includes(url)) allPhotos.push(url);
    });
    if (allPhotos.length > 0) setPhotos(allPhotos);
  }, []);

  // Parse the date for the badge
  let m = 1, d = 1;
  if (day.id && day.id.includes('/')) {
    const parts = day.id.split('/');
    m = parseInt(parts[0]) || 1;
    d = parseInt(parts[1]) || 1;
  } else if (day.id && day.id.includes('.')) {
    const parts = day.id.split('.');
    m = parseInt(parts[0]) || 1;
    d = parseInt(parts[1]) || 1;
  }

  // Tier-based card styling — Bronze L2 → Diamond L6. Mirrors the metal/gem
  // theme from /profile/page.tsx so other-user cards match own-cards visually.
  const tierCardClass =
    userLevel >= 6 ? "tier-diamond-card" :
    userLevel >= 5 ? "tier-emerald-card" :
    userLevel >= 4 ? "tier-gold-card" :
    userLevel >= 3 ? "tier-silver-card" :
    userLevel >= 2 ? "tier-bronze-card" : "";
  const lvlColors = LEVEL_COLORS[userLevel] || null;
  const tierCardStyle: React.CSSProperties = userLevel >= 2 && lvlColors ? {
    background: `linear-gradient(135deg, ${C.white} 0%, ${lvlColors.badge}88 50%, ${C.white} 100%)`,
    border: `2px solid ${lvlColors.border}`,
    boxShadow: `0 4px 18px ${lvlColors.glow}`,
  } : {
    background: C.white,
    border: `2px solid ${C.greenMid}`,
  };

  return (<>
    {lb && <Lightbox src={lb} onClose={()=>setLb(null)}/>}
    <div className={tierCardClass} style={{...tierCardStyle, borderRadius:22, marginBottom:16, overflow:"hidden"}}>
      {/* HEADER */}
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:16,padding:"20px 24px",cursor:"pointer",background:open?C.greenLight:C.white,border:"none",textAlign:"left",borderRadius:open?"22px 22px 0 0":"22px",transition:"background 0.2s"}}>
        <div style={{width:64,height:64,borderRadius:18,flexShrink:0,background:`linear-gradient(135deg,${C.gold},#FFD700)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(245,166,35,0.3)"}}>
          <span style={{color:"#fff",fontWeight:900,fontSize:24,lineHeight:1}}>{d}</span>
          <span style={{color:"rgba(255,255,255,0.85)",fontSize:11,fontWeight:700}}>{MONTHS[m-1]}</span>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:900,fontSize:19,color:C.text}}>{day.label}</div>
          <div style={{fontSize:13,color:C.sub,marginTop:3}}>{workout?`💪 ${workout.type}  ·  ⏱ ${workout.duration}  ·  🔥 ${workout.calories} cal`:"😴 Rest day"}</div>
          {nutrition&&<div style={{fontSize:12,color:C.sub,marginTop:2}}>🥗 {nutrition.calories} kcal  ·  🥩 {nutrition.protein}g protein</div>}
        </div>
        <div style={{width:34,height:34,borderRadius:"50%",background:C.greenLight,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s"}}>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.5" style={{width:16,height:16}}><path d="M6 9l6 6 6-6"/></svg>
        </div>
        {photos.length > 0 && (
          <div style={{width:40,height:40,borderRadius:10,overflow:"hidden",flexShrink:0,border:`1px solid ${C.greenMid}`}}>
            <img src={ImagePresets.thumb(photos[0])} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
          </div>
        )}
      </button>

      {/* BODY */}
      {open && <div style={{padding:"24px 24px 28px",borderTop:`2px solid ${C.greenMid}`}}>

        {/* Photos */}
        {photos.length > 0 && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Photos</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
              {photos.map((src,i)=>(
                <div key={i} style={{borderRadius:16,overflow:"hidden",border:`2px solid ${C.greenMid}`}}>
                  <img onClick={()=>setLb(src)} src={src} style={{width:108,height:108,objectFit:"cover",display:"block",cursor:"pointer"}} alt="" onError={e=>{(e.target as HTMLImageElement).parentElement!.style.display='none'}}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WORKOUT */}
        {workout ? (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.greenMid}`,marginBottom:20}}>
            <div style={{background:`linear-gradient(135deg,${C.blue},#4ADE80)`,padding:"16px 20px",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:26}}>💪</span>
              <div>
                <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>{workout.type}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>{workout.duration}  ·  {workout.calories} cal burned</div>
              </div>
            </div>
            <div style={{background:C.greenLight,padding:"12px 16px"}}>
              {workout.exercises && workout.exercises.length > 0 && (<>
                <div style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 90px",gap:8,paddingBottom:8,marginBottom:4,borderBottom:`1.5px solid ${C.greenMid}`}}>
                  {["Exercise","Sets","Reps","Weight"].map(h=><span key={h} style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8}}>{h}</span>)}
                </div>
                {workout.exercises.map((ex:any,i:number)=>{
                  const wsArr: string[] = ex.weights && Array.isArray(ex.weights) ? ex.weights : [];
                  const weightDisplay = wsArr.length > 1 ? wsArr.join(' / ') + ' lbs' : (wsArr[0] || ex.weight || '—');
                  return (
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 90px",gap:8,padding:"10px 8px",borderRadius:10,background:i%2===0?`${C.greenMid}55`:"transparent"}}>
                      <span style={{fontSize:14,fontWeight:600,color:C.text}}>{ex.name}</span>
                      <span style={{fontSize:16,fontWeight:900,color:C.blue,textAlign:"center"}}>{ex.sets}</span>
                      <span style={{fontSize:16,fontWeight:900,color:C.blue,textAlign:"center"}}>{ex.reps}</span>
                      <span style={{fontSize:13,fontWeight:800,color:C.gold,textAlign:"center"}}>{weightDisplay}</span>
                    </div>
                  );
                })}
              </>)}
              {/* Cardio */}
              {workout.cardio && workout.cardio.length > 0 && (
                <div style={{marginTop: workout.exercises && workout.exercises.length > 0 ? 12 : 0, paddingTop: workout.exercises && workout.exercises.length > 0 ? 12 : 0, borderTop: workout.exercises && workout.exercises.length > 0 ? `1px solid ${C.greenMid}` : "none"}}>
                  <div style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>🏃 Cardio</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 90px 90px",gap:8,paddingBottom:6,marginBottom:4,borderBottom:`1px solid ${C.greenMid}`}}>
                    {["Type","Duration","Distance"].map(h=><span key={h} style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8}}>{h}</span>)}
                  </div>
                  {workout.cardio.map((c:any,i:number)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 90px 90px",gap:8,padding:"8px 4px",borderRadius:10,background:i%2===0?`${C.greenMid}55`:"transparent"}}>
                      <span style={{fontSize:14,fontWeight:600,color:C.text}}>{c.type}</span>
                      <span style={{fontSize:14,fontWeight:700,color:C.blue,textAlign:"center"}}>{c.duration}</span>
                      <span style={{fontSize:14,fontWeight:700,color:C.gold,textAlign:"center"}}>{c.distance}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{borderRadius:18,padding:20,textAlign:"center",background:C.greenLight,border:`2px solid ${C.greenMid}`,marginBottom:20}}>
            <div style={{fontSize:30,marginBottom:6}}>😴</div>
            <div style={{fontSize:14,fontWeight:600,color:C.sub}}>No workout logged this day</div>
          </div>
        )}

        {/* NUTRITION */}
        {nutrition ? (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.greenMid}`}}>
            <button onClick={()=>setNutOpen(n=>!n)} style={{width:"100%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:26}}>🥗</span>
                <div>
                  <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>Nutrition</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>{nutrition.calories} kcal  ·  {nutrition.protein}g protein</div>
                </div>
              </div>
              <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",transform:nutOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s"}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{width:14,height:14}}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </button>
            <div style={{background:C.greenLight,padding:16}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:nutOpen?16:0}}>
                {[{label:"Calories",val:nutrition.calories,unit:"kcal",color:C.gold,max:3000},{label:"Protein",val:nutrition.protein,unit:"g",color:"#3B82F6",max:250},{label:"Carbs",val:nutrition.carbs,unit:"g",color:C.blue,max:300},{label:"Fat",val:nutrition.fat,unit:"g",color:"#4ADE80",max:100}].map(mc=>(
                  <div key={mc.label} style={{background:C.white,borderRadius:14,padding:"12px 6px",textAlign:"center",border:`1.5px solid ${C.greenMid}`}}>
                    <div style={{fontSize:20,fontWeight:900,color:mc.color}}>{mc.val}</div>
                    <div style={{fontSize:11,color:C.sub}}>{mc.unit}</div>
                    <div style={{height:5,borderRadius:3,background:C.greenMid,margin:"6px 0 4px",overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:3,background:mc.color,width:`${Math.min((mc.val/mc.max)*100,100)}%`}}/>
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:C.sub}}>{mc.label}</div>
                  </div>
                ))}
              </div>
              {nutOpen && nutrition.meals && (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {nutrition.meals.map((meal:any,i:number)=>(
                    <div key={i} style={{background:C.white,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,border:`1.5px solid ${C.greenMid}`}}>
                      <div style={{width:46,height:46,borderRadius:13,background:C.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{meal.emoji}</div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontWeight:800,fontSize:15,color:C.text}}>{meal.key}</span>
                          <span style={{fontWeight:900,fontSize:15,color:C.gold}}>{meal.cal} kcal</span>
                        </div>
                        <div style={{fontSize:13,color:C.sub,marginTop:2}}>{meal.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{borderRadius:18,padding:20,textAlign:"center",background:C.greenLight,border:`2px solid ${C.greenMid}`}}>
            <div style={{fontSize:30,marginBottom:6}}>🥗</div>
            <div style={{fontSize:14,fontWeight:600,color:C.sub}}>No nutrition logged this day</div>
          </div>
        )}

        {/* WELLNESS */}
        {wellness && wellness.entries && wellness.entries.length > 0 && (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.greenMid}`,marginTop:16}}>
            <div style={{background:`linear-gradient(135deg,#52C97A,#7AE0A0)`,padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>🌿</span>
              <div>
                <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>Wellness</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.85)"}}>{wellness.entries.map((e:any)=>e.activity).join("  ·  ")}</div>
              </div>
            </div>
            {/* Per-activity styled cards. Each entry gets its mapped emoji +
                accent color from WELLNESS_STYLES, with a duration/time pill on
                the right when those fields exist. Falls back to leaf 🌿 + soft
                purple for unmapped activities. */}
            <div style={{background:"#0D1A0D",padding:14,display:"flex",flexDirection:"column",gap:8}}>
              {wellness.entries.map((e:any,i:number)=> {
                const style = getWellnessStyle(e.activity || "");
                const emoji = e.emoji || style.emoji;
                const accent = style.accent;
                const timeStr = formatTimeOfDay(e.loggedAt);
                const dur = e.duration ? `${e.duration} min` : null;
                return (
                  <div key={i} style={{background:C.white,borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:14,borderLeft:`4px solid ${accent}`,border:`1.5px solid #2A3A2A`,borderLeftWidth:4,borderLeftColor:accent}}>
                    <div style={{width:44,height:44,borderRadius:13,background:`${accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,border:`1.5px solid ${accent}55`}}>{emoji}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:15,color:C.text}}>{e.activity}</div>
                      {e.notes && <div style={{fontSize:13,color:C.sub,marginTop:2}}>{e.notes}</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end",flexShrink:0}}>
                      {dur && <span style={{fontSize:11,fontWeight:700,color:accent,background:`${accent}22`,padding:"3px 9px",borderRadius:99}}>{dur}</span>}
                      {timeStr && <span style={{fontSize:11,fontWeight:600,color:C.sub,background:"#0D1A0D",padding:"3px 9px",borderRadius:99}}>{timeStr}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>}
    </div>
  </>);
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [profile, setProfile]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [days, setDays]             = useState<any[]>([]);
  // Raw workout logs (NOT merged-by-day) for WorkoutProgressGraphs. The graphs
  // count multi-workout days correctly when given the raw rows.
  const [rawWorkoutLogs, setRawWorkoutLogs] = useState<any[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

  // Responsive layout. Matches the own-profile breakpoint (768px) so both pages
  // collapse to vertical stack at the same width.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const avatarSize = isMobile ? 220 : 280;

  // Derive the viewed user's level from their cumulative_xp. Used to apply
  // tier-based card backgrounds, avatar rings, and name shimmer effects.
  const viewedUserLevel = useMemo(() => {
    if (!profile) return 1;
    const xp = profile.cumulative_xp ?? profile.total_xp ?? profile.xp ?? 0;
    try { return getLevelProgress(xp).level; } catch { return 1; }
  }, [profile]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [brands, setBrands]         = useState<any[]>([]);
  const [highlightLb, setHighlightLb] = useState<string|null>(null);
  // All Photos: every public feed-post photo by this user, fetched from posts table
  const [feedPhotos, setFeedPhotos] = useState<string[]>([]);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  // Tagged-in modal state. Lazy-loaded on first open.
  const [showTaggedPosts, setShowTaggedPosts] = useState(false);

  // ── Followers / Following modal ──────────────────────────────────────────
  const [socialModal, setSocialModal] = useState<"followers"|"following"|null>(null);
  // Moderation UI state: ⋯ menu to report/block, plus the ReportModal target
  const [moderationMenuOpen, setModerationMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [socialList, setSocialList]   = useState<any[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  // Profile share button state — shows "✓ Copied" toast for 2.5s after copy.
  const [profileShareCopied, setProfileShareCopied] = useState(false);

  /** Copy or share a link to this profile. Native share sheet on mobile,
   *  clipboard fallback on desktop. URL uses the username path which is
   *  the same route this page lives on. */
  async function shareProfile() {
    if (typeof window === "undefined" || !profile?.username) return;
    const url = `${window.location.origin}/profile/${profile.username}`;
    const shareData = {
      title: `${profile.full_name || "@" + profile.username} on Livelee`,
      text: `Check out @${profile.username} on Livelee`,
      url,
    };
    try {
      if ((navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setProfileShareCopied(true);
      setTimeout(() => setProfileShareCopied(false), 2500);
    } catch {
      window.prompt("Copy this profile link:", url);
    }
  }

  const openSocialModal = useCallback(async (type: "followers"|"following", profileId: string) => {
    setSocialModal(type);
    setSocialLoading(true);
    setSocialList([]);
    try {
      if (type === "followers") {
        const { data } = await supabase
          .from('follows')
          .select('follower_id, users!follows_follower_id_fkey(id,username,full_name,avatar_url)')
          .eq('following_id', profileId);
        setSocialList((data || []).map((r: any) => r.users).filter(Boolean));
      } else {
        const { data } = await supabase
          .from('follows')
          .select('following_id, users!follows_following_id_fkey(id,username,full_name,avatar_url)')
          .eq('follower_id', profileId);
        setSocialList((data || []).map((r: any) => r.users).filter(Boolean));
      }
    } catch {}
    setSocialLoading(false);
  }, []);

  const HIGHLIGHT_SLOTS = 9;
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  useEffect(() => {
    async function load() {
      // PERF: hydrate from in-memory cache instantly if we have a recent
      // entry for this username. The user navigated to this profile in
      // the last ~60s — show what we had immediately, then refresh in
      // the background. Removes the spinner-then-content flash on
      // back/forward navigation.
      if (username) {
        const cached = getCached<any>(`profile:${username}`, 60_000);
        if (cached) {
          setProfile(cached);
          setLoading(false);
          // We still continue the function below to fetch fresh data —
          // SWR pattern: stale-while-revalidate.
        }
      }

      // Load profile (fresh — even if cached, we revalidate in background)
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (!profileData) { setLoading(false); return; }
      setProfile(profileData);
      // Cache for next navigation — the user often clicks back and forth
      // between profile and feed. Stale-while-revalidate gives them
      // instant content on return.
      if (username) setCached(`profile:${username}`, profileData);

      // Load highlights
      if (profileData.highlights && Array.isArray(profileData.highlights)) {
        const validUrls = profileData.highlights.filter((u: string) => u && (u.startsWith('http') || u.startsWith('/')));
        setHighlights(validUrls);
      }

      // Load brands from profile
      if (profileData.favorite_brands && Array.isArray(profileData.favorite_brands)) {
        setBrands(profileData.favorite_brands);
      }

      // PERF: posts (for photo grid) and activity_logs both depend on
      // profileData.id but NOT on each other. Run them in parallel.
      // Previously these ran sequentially, costing ~300-500ms of needless
      // wait time on every profile open.
      const [postsResult, activityResult] = await Promise.all([
        supabase
          .from('posts')
          .select('media_url, media_urls, media_type, media_types, media_positions')
          .eq('user_id', profileData.id)
          .eq('is_public', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', profileData.id)
          .order('logged_at', { ascending: false })
          .limit(500),
      ]);

      // Process posts → feedPhotos
      const postRows = postsResult.data;
      try {
        if (postRows) {
          const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v|qt)(\?|#|$)/i;
          const urls: string[] = [];
          for (const p of postRows as any[]) {
            const mediaTypes = Array.isArray(p.media_types) ? p.media_types : null;
            const singleType = p.media_type;
            if (Array.isArray(p.media_urls)) {
              for (let i = 0; i < p.media_urls.length; i++) {
                const u = p.media_urls[i];
                if (typeof u !== 'string' || !u) continue;
                const t = mediaTypes?.[i] || null;
                if (t === 'video') continue;
                if (!t && VIDEO_EXT_RE.test(u)) continue;
                urls.push(u);
              }
            } else if (p.media_url) {
              if (singleType === 'video') continue;
              if (!singleType && VIDEO_EXT_RE.test(p.media_url)) continue;
              urls.push(p.media_url);
            }
          }
          setFeedPhotos(urls);
        }
      } catch { /* ignore — feedPhotos stays [] */ }

      // activity logs — already fetched above, just unpack
      const activityLogs = activityResult.data;

      // Capture raw workout rows separately for the graph component. Don't
      // merge by day — the graph counts each workout independently.
      if (activityLogs) {
        setRawWorkoutLogs(activityLogs.filter((l: any) => l.log_type === 'workout'));
      }

      if (activityLogs && activityLogs.length > 0) {
        const byDate = new Map<string, any[]>();
        activityLogs.forEach((log: any) => {
          const d = new Date(log.logged_at);
          const key = d.toLocaleDateString('en-US', { year:'numeric', month:'2-digit', day:'2-digit' });
          if (!byDate.has(key)) byDate.set(key, []);
          byDate.get(key)!.push(log);
        });

        const today = new Date();
        const todayStr = today.toLocaleDateString('en-US', { year:'numeric', month:'2-digit', day:'2-digit' });
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-US', { year:'numeric', month:'2-digit', day:'2-digit' });

        const builtDays = Array.from(byDate.entries()).map(([dateKey, logs]) => {
          const [month, day, year] = dateKey.split('/').map(Number);
          const date = new Date(year, month - 1, day);
          const dayName = DAY_NAMES[date.getDay()];
          const friendlyLabel = dateKey === todayStr ? 'Today' : dateKey === yesterdayStr ? 'Yesterday' : `${dayName} ${month}/${day}`;

          const workoutLog    = logs.find((l: any) => l.log_type === 'workout');
          const nutritionLogs = logs.filter((l: any) => l.log_type === 'nutrition');
          const wellnessLogs  = logs.filter((l: any) => l.log_type === 'wellness');

          const workout = workoutLog ? {
            type: workoutLog.workout_type || 'Workout',
            duration: workoutLog.workout_duration_min ? `${workoutLog.workout_duration_min} min` : '—',
            calories: workoutLog.workout_calories || 0,
            exercises: Array.isArray(workoutLog.exercises)
              ? workoutLog.exercises.map((e: any) => ({
                  name: e.name || '', sets: parseInt(e.sets) || 0,
                  reps: parseInt(e.reps) || 0, weight: e.weight || '—',
                }))
              : [],
            cardio: Array.isArray(workoutLog.cardio) ? workoutLog.cardio : [],
            // PR badge — set by /api/db detect_prs_from_log when this
            // workout beat the user's prior all-time max for any exercise.
            isPR: !!workoutLog.is_pr,
          } : null;

          const totalCalories = nutritionLogs.reduce((s: number, l: any) => s + (l.calories_total || 0), 0);
          const totalProtein  = nutritionLogs.reduce((s: number, l: any) => s + (l.protein_g || 0), 0);
          const totalCarbs    = nutritionLogs.reduce((s: number, l: any) => s + (l.carbs_g || 0), 0);
          const totalFat      = nutritionLogs.reduce((s: number, l: any) => s + (l.fat_g || 0), 0);

          const nutrition = nutritionLogs.length > 0 ? {
            calories: Math.round(totalCalories),
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
              emoji:    l.wellness_emoji || '🌿',
              activity: l.wellness_type || l.notes || 'Wellness',
              notes:    l.notes || '',
            })),
          } : null;

          return {
            id:       dateKey,
            label:    friendlyLabel,
            emoji:    workout ? '💪' : (nutrition ? '🥗' : (wellness ? '🌿' : '🌅')),
            workout, nutrition, wellness,
            photo_url: workoutLog?.photo_url || nutritionLogs[0]?.photo_url || wellnessLogs[0]?.photo_url || null,
            _date: date.getTime(),
          };
        });

        builtDays.sort((a: any, b: any) => b._date - a._date);
        setDays(builtDays);
      }

      // Load badges
      const { data: badgeData } = await supabase
        .from('badges')
        .select('badge_id')
        .eq('user_id', profileData.id);
      if (badgeData) setEarnedBadges(badgeData.map((b: any) => b.badge_id));

      setLoading(false);
    }
    load();
  }, [username]);

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:36,height:36,borderRadius:"50%",border:`4px solid ${C.greenMid}`,borderTopColor:C.blue,animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!profile) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
      <div style={{fontSize:48}}>👻</div>
      <h2 style={{fontWeight:900,color:C.text}}>User not found</h2>
      <button onClick={()=>router.back()} style={{padding:"10px 24px",borderRadius:14,border:`1.5px solid ${C.greenMid}`,background:C.white,color:C.blue,fontWeight:700,cursor:"pointer"}}>← Go Back</button>
    </div>
  );

  const initials = profile.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() || '??';

  // ── BRANCH: business accounts render a completely different layout ──
  // Business profiles are "advertising pages" — no badges, no tier, no
  // workout stats. They surface contact info, hours, social links, posts.
  // Uses the same URL (/profile/@handle) so sharing a link works regardless.
  if (isBusinessAccount(profile)) {
    return (
      <BusinessProfileView
        profile={profile}
        currentUser={currentUser ? { id: currentUser.id } : null}
        onMessageClick={async () => {
          if (!currentUser) return;
          const res = await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_conversation', payload: { userId: currentUser.id, otherUserId: profile.id } }),
          });
          const json = await res.json();
          if (json.conversationId) router.push(`/messages?conv=${json.conversationId}`);
        }}
        onBlock={() => router.push('/feed')}
      />
    );
  }

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:80}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        /* Mobile collapse — both the header (avatar + banner) and the 3-column
           grid stack vertically below 768px. Mirrors /profile/page.tsx. */
        @media(max-width:767px){
          .profile-header-wrap { flex-direction: column !important; align-items: center !important; text-align: center !important; gap: 0 !important; }
          .profile-avatar-col { margin-left: 0 !important; margin-top: 0 !important; }
          .profile-layout { display: flex !important; flex-direction: column !important; }
          .profile-layout > * { width: 100% !important; min-width: unset !important; max-width: 100% !important; }
          .profile-outer { padding: 12px 16px 100px !important; max-width: 100% !important; margin: 0 !important; }
          .up-layout { display: flex !important; flex-direction: column !important; }
          .up-layout > * { width: 100% !important; min-width: unset !important; max-width: 100% !important; }
        }

        /* ─── Tier rewards CSS — mirrors /profile/page.tsx so other-user
           profiles show the same metal/gem progression visuals. Each tier
           progressively layers more visible "shine" on the card / avatar /
           name without making lower tiers look bland. */

        /* L2 BRONZE — warm copper border glow on activity cards. */
        .tier-bronze-card {
          border-color: rgba(205,127,50,0.45) !important;
          box-shadow: 0 0 0 1px rgba(205,127,50,0.20), 0 2px 18px rgba(205,127,50,0.18);
        }

        /* L3 SILVER — rotating silver halo around the profile avatar.
           Two counter-rotating conic-gradient rings = "moving picture" effect. */
        .tier-silver-avatar-wrap {
          position: relative;
          padding: 4px;
          border-radius: 50%;
          background: conic-gradient(from 0deg,#6B7280 0%,#E8E8F0 25%,#F5F5FA 50%,#C0C0C0 75%,#6B7280 100%);
          animation: tierSilverRingSpin 8s linear infinite;
          box-shadow: 0 0 22px rgba(220,220,235,0.35);
        }
        .tier-silver-avatar-wrap::after {
          content: '';
          position: absolute; inset: -3px;
          border-radius: 50%;
          background: conic-gradient(from 0deg,transparent 0%,rgba(255,255,255,0.4) 30%,transparent 60%,rgba(255,255,255,0.3) 90%,transparent 100%);
          animation: tierSilverRingSpinReverse 12s linear infinite;
          pointer-events: none; z-index: -1;
        }
        @keyframes tierSilverRingSpin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes tierSilverRingSpinReverse { from{transform:rotate(0)} to{transform:rotate(-360deg)} }

        /* L4 GOLD — shimmering gradient text on the profile name + gold card glow. */
        .tier-gold-name {
          background: linear-gradient(90deg,#B8860B 0%,#FFD700 25%,#FFF8DC 50%,#FFD700 75%,#B8860B 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: tierGoldShimmer 4s ease-in-out infinite;
          filter: drop-shadow(0 0 8px rgba(255,215,0,0.4));
        }
        @keyframes tierGoldShimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        .tier-gold-card {
          border-color: rgba(255,215,0,0.45) !important;
          box-shadow: 0 0 0 1px rgba(255,215,0,0.22), 0 2px 22px rgba(255,215,0,0.22);
        }
        /* L4 also wraps the avatar with a softer gold halo so the effect
           cascades visually with lower tiers below it. */
        .tier-gold-avatar-wrap {
          position: relative; padding: 3px; border-radius: 50%;
          background: linear-gradient(135deg,#B8860B,#FFD700,#FFF8DC,#FFD700,#B8860B);
          box-shadow: 0 0 20px rgba(255,215,0,0.45);
        }

        /* L5 EMERALD — pulsing green glow on activity cards. */
        .tier-emerald-card {
          border-color: rgba(16,185,129,0.55) !important;
          animation: tierEmeraldPulse 4.5s ease-in-out infinite;
        }
        @keyframes tierEmeraldPulse {
          0%,100% { box-shadow: 0 0 0 1px rgba(16,185,129,0.30), 0 2px 18px rgba(16,185,129,0.20); }
          50%     { box-shadow: 0 0 0 1px rgba(16,185,129,0.55), 0 2px 32px rgba(16,185,129,0.45); }
        }
        .tier-emerald-avatar-wrap {
          position: relative; padding: 3px; border-radius: 50%;
          background: linear-gradient(135deg,#065F46,#10B981,#6EE7B7,#10B981,#065F46);
          box-shadow: 0 0 22px rgba(16,185,129,0.5);
        }

        /* L6 DIAMOND — holographic chrome name + cyan card sheen. */
        .tier-diamond-name {
          background: linear-gradient(90deg,#67E8F9 0%,#E879F9 20%,#FCD34D 40%,#6EE7B7 60%,#A78BFA 80%,#67E8F9 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: tierDiamondHolo 6s linear infinite;
          filter: drop-shadow(0 0 10px rgba(103,232,249,0.5));
        }
        @keyframes tierDiamondHolo { 0%{background-position:0% 50%} 100%{background-position:250% 50%} }
        .tier-diamond-card { position: relative; }
        .tier-diamond-card::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(115deg,transparent 40%,rgba(103,232,249,0.20) 48%,rgba(186,230,253,0.45) 50%,rgba(103,232,249,0.20) 52%,transparent 60%);
          transform: translateX(-120%);
          animation: diamondShimmerSweep 4s ease-in-out infinite;
          pointer-events: none; z-index: 1;
        }
        @keyframes diamondShimmerSweep {
          0% { transform: translateX(-120%); }
          55% { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }
        .tier-diamond-avatar-wrap {
          position: relative; padding: 3px; border-radius: 50%;
          background: linear-gradient(135deg,#67E8F9,#E879F9,#FCD34D,#6EE7B7,#A78BFA,#67E8F9);
          background-size: 250% 100%;
          animation: tierDiamondHolo 6s linear infinite;
          box-shadow: 0 0 24px rgba(103,232,249,0.55);
        }
      `}</style>

      {highlightLb && (
        <Lightbox
          src={highlightLb}
          photos={feedPhotos.length > 0 ? feedPhotos : highlights}
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

      {showTaggedPosts && profile && (
        <TaggedPostsModal
          userId={profile.id}
          displayName={profile.full_name || profile.username || "User"}
          isOwnProfile={!!(currentUser && currentUser.id === profile.id)}
          onClose={() => setShowTaggedPosts(false)}
        />
      )}

      {/* ── Followers / Following Modal ── */}
      {socialModal && (
        <div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setSocialModal(null)}>
          <div style={{background:C.white,borderRadius:24,width:"100%",maxWidth:420,maxHeight:"70vh",display:"flex",flexDirection:"column",overflow:"hidden",border:`2px solid ${C.greenMid}`}} onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px 16px",borderBottom:`1.5px solid ${C.greenMid}`}}>
              <div style={{fontWeight:900,fontSize:18,color:C.text}}>{socialModal==="followers"?"Followers":"Following"}</div>
              <button onClick={()=>setSocialModal(null)} style={{background:"none",border:"none",color:C.sub,fontSize:26,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
            </div>
            {/* List */}
            <div style={{overflowY:"auto",flex:1,padding:"12px 16px"}}>
              {socialLoading ? (
                <div style={{display:"flex",justifyContent:"center",padding:40}}>
                  <div style={{width:28,height:28,borderRadius:"50%",border:`3px solid ${C.greenMid}`,borderTopColor:C.blue,animation:"spin 0.8s linear infinite"}}/>
                </div>
              ) : socialList.length === 0 ? (
                <div style={{textAlign:"center",padding:40,color:C.sub,fontSize:14}}>No {socialModal} yet</div>
              ) : (
                socialList.map((u:any) => {
                  const ini = u.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase() || '??';
                  return (
                    <div key={u.id}
                      onClick={()=>{setSocialModal(null);router.push(`/profile/${u.username}`);}}
                      style={{display:"flex",alignItems:"center",gap:14,padding:"12px 10px",borderRadius:16,cursor:"pointer",transition:"background 0.15s",marginBottom:4}}
                      onMouseEnter={e=>(e.currentTarget.style.background=C.greenLight)}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                    >
                      <div style={{width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:"#fff",overflow:"hidden",flexShrink:0}}>
                        {u.avatar_url
                          ? <img src={ImagePresets.avatarSm(u.avatar_url)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                          : ini}
                      </div>
                      <div>
                        <div style={{fontWeight:800,fontSize:15,color:C.text}}>{u.full_name}</div>
                        <div style={{fontSize:13,color:C.sub}}>@{u.username}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile header: avatar column on left + banner block on right ──
          Mirrors /profile/page.tsx so the "view someone else's profile" surface
          looks identical to your own. The avatar is large, sits on the left,
          and is wrapped in a tier ring at L3+. The banner is on the right and
          carries the bio + followers/following + Follow/Message action buttons. */}
      <div className="profile-outer" style={{maxWidth:1200,padding:"20px 24px 32px",margin:"0 auto"}}>
        <div className="profile-header-wrap" style={{display:"flex",gap:isMobile?16:24,alignItems:"flex-start",flexWrap:"wrap",marginBottom:28}}>

          {/* Avatar column on LEFT. Tier ring wrap at L3+. Name centered below. */}
          <div className="profile-avatar-col" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,flexShrink:0,width:avatarSize,marginLeft:isMobile?0:-60,marginTop:isMobile?0:96}}>
            <div className={
              viewedUserLevel >= 6 ? "tier-diamond-avatar-wrap" :
              viewedUserLevel >= 5 ? "tier-emerald-avatar-wrap" :
              viewedUserLevel >= 4 ? "tier-gold-avatar-wrap" :
              viewedUserLevel >= 3 ? "tier-silver-avatar-wrap" : ""
            } style={{position:"relative",userSelect:"none"}}>
              {/* The avatar circle. Borderless because the tier wrap provides
                  the border halo. At L1 (no wrap class) we add a subtle
                  border so the avatar still has shape. */}
              <div style={{
                width: avatarSize, height: avatarSize, borderRadius:"50%",
                background:`linear-gradient(135deg,${C.blue},#4ADE80)`,
                border: viewedUserLevel < 3 ? `4px solid ${C.greenMid}` : "none",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:avatarSize<140?38:58,fontWeight:900,color:"#fff",
                overflow:"hidden",position:"relative",zIndex:2,
              }}>
                {profile.avatar_url
                  ? <img src={ImagePresets.avatarSm(profile.avatar_url)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:`center ${profile.avatar_position ?? 50}%`,display:"block"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                  : initials}
              </div>
            </div>
            <div style={{textAlign:"center",width:"100%"}}>
              {/* Name + tier shimmer. Same class logic as own-profile. */}
              <div className={
                viewedUserLevel >= 6 ? "tier-diamond-name" :
                viewedUserLevel >= 4 ? "tier-gold-name" : ""
              } style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:2}}>
                {profile.full_name}
              </div>
              <div style={{fontWeight:600,fontSize:13,color:C.sub,marginBottom:6}}>@{profile.username}</div>
              {/* Level pill — only when past L1, identical styling to own-profile. */}
              {viewedUserLevel >= 2 && LEVEL_COLORS[viewedUserLevel] && (
                <div style={{display:"inline-block",fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:99,
                  background: `linear-gradient(135deg, ${LEVEL_COLORS[viewedUserLevel].badge}, rgba(14,8,32,0.8))`,
                  color: LEVEL_COLORS[viewedUserLevel].accent,
                  border: `1px solid ${LEVEL_COLORS[viewedUserLevel].border}`,
                  boxShadow: `0 0 10px ${LEVEL_COLORS[viewedUserLevel].glow}`,
                  marginBottom:6,
                }}>Lv {viewedUserLevel}</div>
              )}
              {profile.city && (
                <div style={{fontSize:12,color:C.sub,marginTop:6}}>📍 {profile.city}</div>
              )}
            </div>
          </div>

          {/* Banner block on RIGHT — banner image + bio + followers/following + Follow/Message buttons */}
          <div className="profile-banner-block" style={{flex:1,minWidth:220}}>
            <div style={{
              width:"100%",height:320,borderRadius:26,overflow:"hidden",position:"relative",marginBottom:14,
              background:profile.banner_url?"transparent":`linear-gradient(135deg,${C.blue},#4ADE80)`,
              border:`2px solid ${C.greenMid}`,display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              {profile.banner_url
                ? <img src={profile.banner_url} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:`center ${profile.banner_position ?? 50}%`}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                : <span style={{fontWeight:900,fontSize:17,color:"rgba(255,255,255,0.7)"}}>{profile.full_name}</span>}
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
                  background:"#0F1A0F",
                  borderRadius:14,
                  borderLeft:`3px solid ${C.blue}`,
                }}>
                  {profile.bio}
                </div>
              )}

              {/* Wide followers/following pill bar — mirrors own-profile dimensions */}
              <div style={{display:"flex",alignItems:"stretch",gap:0,marginBottom:14,borderRadius:16,overflow:"hidden",border:`1px solid ${C.greenMid}`}}>
                {[
                  {l:"Followers",v:profile.followers_count??0,type:"followers" as const},
                  {l:"Following",v:profile.following_count??0,type:"following" as const},
                ].map((s,i)=>(
                  <button key={s.l} onClick={()=>openSocialModal(s.type, profile.id)}
                    style={{flex:1,textAlign:"center",cursor:"pointer",padding:"14px 10px",background:"#111811",position:"relative",borderLeft:i>0?`1px solid ${C.greenMid}`:"none",border:"none"}}
                    onMouseEnter={e=>(e.currentTarget.style.background="#1A2A1A")}
                    onMouseLeave={e=>(e.currentTarget.style.background="#111811")}>
                    <div style={{fontSize:26,fontWeight:900,color:C.blue,lineHeight:1,letterSpacing:-1}}>{(s.v||0).toLocaleString()}</div>
                    <div style={{fontSize:11,color:C.sub,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>{s.l}</div>
                  </button>
                ))}
              </div>

              {/* Action row replaces "Edit Profile" — Follow / Message / ⋯ */}
              <div style={{display:"flex",gap:8,alignItems:"stretch"}}>
                <div style={{flex:1}}>
                  <FollowButton targetUserId={profile.id} />
                </div>
                {currentUser && currentUser.id !== profile.id && (
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ action:'create_conversation', payload:{ userId: currentUser.id, otherUserId: profile.id }}) });
                      const json = await res.json();
                      if (json.conversationId) router.push(`/messages?conv=${json.conversationId}`);
                    }}
                    style={{padding:"11px 22px",borderRadius:14,border:`1.5px solid ${C.blue}`,background:"transparent",color:C.blue,fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
                  >
                    ✉️ Message
                  </button>
                )}
                {/* Share button — public profile permalink. Always shown
                    (not gated on whether you're viewing someone else's
                    profile) since sharing your own profile from the public
                    page also makes sense if you ended up there via a link. */}
                <button
                  onClick={shareProfile}
                  aria-label={profileShareCopied ? "Link copied" : "Share profile"}
                  style={{
                    padding:"11px 14px", borderRadius:14,
                    border:`1.5px solid ${C.gold}`,
                    background: profileShareCopied ? `${C.gold}22` : "transparent",
                    color:C.gold, fontWeight:800, fontSize:14, cursor:"pointer",
                    display:"flex", alignItems:"center", gap:6, transition:"all 0.15s",
                  }}
                >
                  {profileShareCopied ? "✓ Copied" : "🔗 Share"}
                </button>
                {/* ⋯ moderation menu (Report/Block) — Apple Guideline 1.2 requirement */}
                {currentUser && currentUser.id !== profile.id && (
                  <div style={{position:"relative"}}>
                    <button
                      onClick={() => setModerationMenuOpen(o => !o)}
                      aria-label="More options"
                      style={{padding:"11px 14px",borderRadius:14,border:`1.5px solid ${C.greenMid}`,background:"transparent",color:C.text,fontWeight:900,fontSize:18,cursor:"pointer",lineHeight:1,height:"100%"}}
                    >⋯</button>
                    {moderationMenuOpen && (
                      <>
                        <div onClick={() => setModerationMenuOpen(false)} style={{position:"fixed",inset:0,zIndex:40}}/>
                        <div style={{position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:41, background:"#1A1D2E", border:"1px solid #2A2D3E", borderRadius:12, padding:6, minWidth:180, boxShadow:"0 10px 30px rgba(0,0,0,0.6)"}}>
                          <button
                            onClick={() => { setModerationMenuOpen(false); setReportTarget({ type: "user", id: profile.id }); }}
                            style={menuItemStyle}
                          >🚩 Report user</button>
                          <button
                            disabled={blocking}
                            onClick={async () => {
                              if (!currentUser || blocking) return;
                              const ok = window.confirm(`Block @${profile.username}? They won't be able to see your posts or message you, and you won't see theirs.`);
                              if (!ok) return;
                              setBlocking(true);
                              setModerationMenuOpen(false);
                              try {
                                await fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'block_user', payload:{ blockerId: currentUser.id, blockedId: profile.id }}) });
                                clearBlockCache();
                                router.push('/feed');
                              } catch { alert("Couldn't block. Try again."); }
                              finally { setBlocking(false); }
                            }}
                            style={{...menuItemStyle, color:"#FCA5A5"}}
                          >🚫 Block user</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3-column grid below header ──
            Same column widths as own-profile (minmax(200px,240px) 1fr minmax(200px,240px))
            so the visual rhythm matches. Mobile collapses via .profile-layout
            media query in the CSS block above. */}
        <div className="profile-layout" style={{display:"grid",gridTemplateColumns:"minmax(200px,240px) 1fr minmax(200px,240px)",gap:16,alignItems:"start"}}>

          {/* LEFT — Highlights */}
          <div>
            <div style={{background:C.white,borderRadius:22,padding:20,border:`2px solid ${C.greenMid}`,marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,gap:6,flexWrap:"wrap"}}>
                <div style={{fontWeight:900,fontSize:16,color:C.text}}>📸 Highlights</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {feedPhotos.length > 0 && (
                    <button
                      onClick={() => setShowAllPhotos(true)}
                      style={{
                        background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
                        border: "none", color: "#fff",
                        fontSize: 11, fontWeight: 800,
                        padding: "5px 11px", borderRadius: 99,
                        cursor: "pointer",
                      }}>
                      All Photos ({feedPhotos.length})
                    </button>
                  )}
                  <button
                    onClick={() => setShowTaggedPosts(true)}
                    style={{
                      background: "transparent",
                      border: `1.5px solid ${C.greenMid}`,
                      color: C.text,
                      fontSize: 11, fontWeight: 800,
                      padding: "5px 11px", borderRadius: 99,
                      cursor: "pointer",
                    }}>
                    🏷️ Tagged In
                  </button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>
                {Array.from({length:HIGHLIGHT_SLOTS}).map((_,i) => {
                  const src = highlights[i];
                  if (src) {
                    return (
                      <div key={i} style={{aspectRatio:"1",borderRadius:10,overflow:"hidden",cursor:"pointer"}}>
                        <img
                          onClick={()=>setHighlightLb(src)}
                          src={src}
                          style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
                          alt=""
                          onError={e=>{(e.target as HTMLImageElement).style.display='none'}}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{aspectRatio:"1",borderRadius:10,background:`${C.greenMid}55`,border:`1px solid ${C.greenMid}`}}/>
                  );
                })}
              </div>
              {highlights.length > 0 && (
                <div style={{marginTop:10,fontSize:11,color:C.sub,textAlign:"center"}}>{highlights.length}/{HIGHLIGHT_SLOTS} photos</div>
              )}
            </div>
          </div>

          {/* CENTER — Activity Log */}
          <div>
            <div style={{fontWeight:900,fontSize:20,color:C.text,marginBottom:16}}>Activity Log</div>

            {/* Workout progress graphs — current-month chart, restyled month-by-month.
                Uses raw workout logs so multi-workout days count correctly. */}
            {rawWorkoutLogs.length > 0 && (
              <div style={{marginBottom:20}}>
                <WorkoutProgressGraphs workouts={rawWorkoutLogs} />
              </div>
            )}

            {days.length === 0 ? (
              <div style={{textAlign:"center",padding:"48px 20px",background:C.white,borderRadius:22,border:`2px solid ${C.greenMid}`,color:C.sub}}>
                <div style={{fontSize:48,marginBottom:8}}>💪</div>
                <p style={{fontWeight:700,fontSize:15}}>No public activity yet</p>
              </div>
            ) : (
              days.map(day => <ReadOnlyDayCard key={day.id} day={day} userLevel={viewedUserLevel}/>)
            )}
          </div>

          {/* RIGHT — Streaks + Badges + Brands */}
          <div>
            {/* Streak section — three strict-math streaks for the viewed
                user. Lets visitors size up someone's current habits before
                seeing their lifetime badges. */}
            {profile && <StreakSection userId={profile.id} theme="green" />}

            {/* Badges */}
            <div style={{background:C.white,borderRadius:22,padding:20,border:`2px solid ${C.greenMid}`,marginBottom:20}}>
              <div style={{fontWeight:900,fontSize:16,color:C.text,marginBottom:14}}>🏆 Badges & Awards</div>
              {earnedBadges.length === 0 ? (
                <div style={{textAlign:"center",padding:"24px 12px",background:C.greenLight,borderRadius:16}}>
                  <div style={{fontSize:32,marginBottom:8}}>🏆</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.sub,lineHeight:1.5}}>No badges earned yet</div>
                </div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {BADGES.filter(b=>earnedBadges.includes(b.id)).map(b=>(
                    <div key={b.id} style={{borderRadius:16,padding:"14px 8px",textAlign:"center",border:"1.5px solid #F5A623",background:"linear-gradient(135deg,#2A1F00,#3D2D00)",boxShadow:"0 0 16px rgba(245,166,35,0.4)"}}>
                      <div style={{fontSize:26,marginBottom:4}}>{b.emoji}</div>
                      <div style={{fontWeight:800,fontSize:11,color:"#FFD700",lineHeight:1.3}}>{b.label}</div>
                      <div style={{fontSize:10,color:"#B8860B",marginTop:3,lineHeight:1.3}}>{b.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Favorite Brands */}
            {brands.length > 0 && (
              <div style={{background:C.white,borderRadius:22,padding:20,border:`2px solid ${C.greenMid}`}}>
                <div style={{fontWeight:900,fontSize:16,color:C.text,marginBottom:14}}>Favorite Brands</div>
                {brands.map((item:any,i:number)=>(
                  <div key={i} style={{background:i%2===0?C.greenLight:"#141F14",borderRadius:14,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,border:`1px solid ${C.greenMid}`}}>
                    {item.emoji && <span style={{fontSize:22,flexShrink:0}}>{item.emoji}</span>}
                    <span style={{fontSize:14,fontWeight:700,color:C.text}}>{item.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Moderation modal — mounted at root, toggled via setReportTarget */}
      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}

// Shared menu-item styling for the ⋯ dropdown
const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 12px",
  background: "transparent",
  border: "none",
  borderRadius: 8,
  color: "#E2E8F0",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left",
  cursor: "pointer",
};

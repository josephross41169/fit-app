"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { BADGES } from "@/lib/badges";
import WeightTracker from "@/components/WeightTracker";
import WorkoutProgressGraphs from "@/components/WorkoutProgressGraphs";
import { TierFrame, TierBadgeChip, TierTitle } from "@/components/TierFrame";
import { computeTier, getTierInfo } from "@/lib/tiers";
import type { Tier } from "@/lib/tiers";

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

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({src,onClose}:{src:string;onClose:()=>void}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <button onClick={onClose} style={{position:"absolute",top:20,right:28,background:"none",border:"none",color:"#fff",fontSize:36,cursor:"pointer",lineHeight:1}}>×</button>
      <img src={src} style={{maxWidth:"90vw",maxHeight:"85vh",borderRadius:20,objectFit:"contain"}} alt="" />
    </div>
  );
}

type Exercise   = {name:string;sets:number;reps:number;weight:string;weights?:string[]};
type CardioEntry = {type:string;duration:string;distance:string};
type Meal        = {key:string;emoji:string;name:string;cal:number};
type WellnessEntry = {emoji:string;activity:string;notes:string};
type Workout    = {type:string;duration:string;calories:number;exercises:Exercise[];cardio:CardioEntry[]};
type Nutrition  = {calories:number;protein:number;carbs:number;fat:number;sugar:number;meals:Meal[]};
type Wellness   = {entries:WellnessEntry[]};

const iStyle = {background:"#0D0D0D",border:`1.5px solid #3D2A6E`,borderRadius:10,padding:"7px 10px",fontSize:13,color:"#F0F0F0",outline:"none",width:"100%",boxSizing:"border-box" as const};
const emptyCardio:CardioEntry  = {type:"",duration:"",distance:""};
const emptyWellness:WellnessEntry = {emoji:"🧘",activity:"",notes:""};

// ── Day Card ──────────────────────────────────────────────────────────────────
type DayCardProps = { day: typeof DAYS[0]; workoutLogId?: string | null; nutritionLogIds?: string[]; wellnessLogIds?: string[]; onDelete?: ()=>void; earnedBadges?: string[] };
function DayCard({day, workoutLogId, nutritionLogIds, wellnessLogIds, onDelete, earnedBadges = []}:DayCardProps) {
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
        const logId = workoutLogId || (nutritionLogIds?.[0]);
        const bucket = 'activity';
        const path = `${logId || Date.now()}/photo-${Date.now()}.jpg`;
        const publicUrl = await up(dataUrl, bucket, path);
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
    if (wellnessLogIds && wellnessLogIds.length > 0 && wellBuf.entries.length > 0) {
      // Update existing — save type, emoji, and notes
      await supabase.from('activity_logs').update({
        wellness_type: wellBuf.entries[0]?.activity || null,
        wellness_emoji: wellBuf.entries[0]?.emoji || null,
        notes: wellBuf.entries[0]?.notes || null,
      }).eq('id', wellnessLogIds[0]).catch(() => {});
    } else if (user && wellBuf.entries.length > 0) {
      // No existing log — insert so it persists
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        log_type: 'wellness',
        is_public: true,
        logged_at: day._date ? new Date(day._date).toISOString() : new Date().toISOString(),
        wellness_type: wellBuf.entries[0]?.activity || null,
        wellness_emoji: wellBuf.entries[0]?.emoji || null,
        notes: wellBuf.entries[0]?.notes || null,
      }).catch(() => {});
    }
  }

  return (<>
    {lb && <Lightbox src={lb} onClose={()=>setLb(null)}/>}
    <div style={{background:C.white,borderRadius:22,border:`2px solid ${C.purpleMid}`,boxShadow:"0 4px 18px rgba(124,58,237,0.10)",marginBottom:16,overflow:"hidden"}}>

      {/* HEADER */}
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:16,padding:"20px 24px",cursor:"pointer",background:open?"#2D1F52":C.white,border:"none",textAlign:"left",borderRadius:open?"22px 22px 0 0":"22px",transition:"background 0.2s"}}>
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
            <img src={photos[0]} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
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
                <img onClick={()=>setLb(src)} src={src} style={{width:108,height:108,objectFit:"cover",display:"block",cursor:"pointer"}} alt="" onError={e=>{(e.target as HTMLImageElement).parentElement!.style.display='none'}}/>
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
              {/* Exercises — only show table if there are exercises */}
              {workout.exercises && workout.exercises.length > 0 && (()=>{
                const totalSets = workout.exercises.reduce((s,ex)=>s+(ex.sets||0),0);
                const totalVol = workout.exercises.reduce((s,ex)=>{
                  const w = parseFloat(String(ex.weight))||0;
                  return s+(w*(ex.sets||0)*(ex.reps||0));
                },0);
                return (<>
                <div style={{display:"grid",gridTemplateColumns:"1fr 48px 48px 80px",gap:8,paddingBottom:8,marginBottom:4,borderBottom:`1.5px solid ${C.purpleMid}`}}>
                  {["Exercise","Sets","Reps","Weight"].map(h=><span key={h} style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8}}>{h}</span>)}
                </div>
                {workout.exercises.map((ex,i)=>{
                  const wsArr: string[] = (ex as any).weights && Array.isArray((ex as any).weights) ? (ex as any).weights : [];
                  const weightDisplay = wsArr.length > 1
                    ? wsArr.join(' / ') + ' lbs'
                    : (wsArr[0] || ex.weight || '—');
                  const exVol = (parseFloat(String(ex.weight))||0)*(ex.sets||0)*(ex.reps||0);
                  return (
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 48px 48px 80px",gap:8,padding:"10px 8px",borderRadius:10,background:i%2===0?`${C.purpleMid}55`:"transparent"}}>
                    <span style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ex.name}</span>
                    <span style={{fontSize:15,fontWeight:900,color:C.purple,textAlign:"center"}}>{ex.sets}</span>
                    <span style={{fontSize:15,fontWeight:900,color:C.purple,textAlign:"center"}}>{ex.reps}</span>
                    <span style={{fontSize:12,fontWeight:800,color:C.gold,textAlign:"center"}}>{weightDisplay}</span>
                  </div>
                  );
                })}
                {/* Totals footer row */}
                {totalVol > 0 && (
                  <div style={{display:"flex",gap:16,padding:"10px 8px 4px",borderTop:`1px solid ${C.purpleMid}`,marginTop:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,color:C.sub}}><strong style={{color:C.text,fontWeight:800}}>{totalSets}</strong> total sets</span>
                    <span style={{fontSize:12,color:C.sub}}><strong style={{color:C.gold,fontWeight:800}}>📊 {totalVol>=1000?`${(totalVol/1000).toFixed(1)}k`:totalVol.toFixed(0)} lbs</strong> total volume</span>
                  </div>
                )}
                </>);
              })()}
              {/* Cardio — always shown when present, no separator if no exercises above */}
              {workout.cardio && workout.cardio.length > 0 && (
                <div style={{marginTop: workout.exercises && workout.exercises.length > 0 ? 12 : 0, paddingTop: workout.exercises && workout.exercises.length > 0 ? 12 : 0, borderTop: workout.exercises && workout.exercises.length > 0 ? `1px solid ${C.purpleMid}` : "none"}}>
                  <div style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>🏃 Cardio</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:8,paddingBottom:6,marginBottom:4,borderBottom:`1px solid ${C.purpleMid}`}}>
                    {["Type","Duration","Distance"].map(h=><span key={h} style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8}}>{h}</span>)}
                  </div>
                  {workout.cardio.map((c,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:8,padding:"8px 4px",borderRadius:10,background:i%2===0?`${C.purpleMid}55`:"transparent"}}>
                      <span style={{fontSize:14,fontWeight:600,color:C.text}}>{c.type}</span>
                      <span style={{fontSize:14,fontWeight:700,color:C.purple,textAlign:"center"}}>{c.duration}</span>
                      <span style={{fontSize:14,fontWeight:700,color:C.gold,textAlign:"center"}}>{c.distance}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Fallback if somehow both are empty */}
              {(!workout.exercises || workout.exercises.length === 0) && (!workout.cardio || workout.cardio.length === 0) && (
                <div style={{textAlign:"center",padding:"12px 0",color:C.sub,fontSize:13}}>No exercises logged</div>
              )}
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
                                <img src={src} style={{width:90,height:90,objectFit:"cover",display:"block"}} alt={meal}/>
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
                              <img src={src} style={{width:90,height:90,objectFit:"cover",display:"block"}} alt="Meal photo"/>
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
              {wellness.entries.map((e,i)=>(
                <div key={i} style={{background:"#0D0D0D",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:14,border:"1.5px solid #3D2A6E"}}>
                  <div style={{width:44,height:44,borderRadius:13,background:"#2D1F52",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{e.emoji}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:15,color:C.text}}>{e.activity}</div>
                    {e.notes && <div style={{fontSize:13,color:C.sub,marginTop:2}}>{e.notes}</div>}
                    {(e as any).photo_url && (
                      <button onClick={()=>setLb((e as any).photo_url)} style={{ padding:0, border:`2px solid #2A3A2A`, borderRadius:10, overflow:"hidden", cursor:"pointer", background:"none", flexShrink:0, marginTop:6 }}>
                        <img src={(e as any).photo_url} style={{ width:60, height:60, objectFit:"cover", display:"block" }} alt=""/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
  const [repositionMode, setRepositionMode] = useState(false);
  const [bannerPosition, setBannerPosition] = useState(50); // 0-100, default center
  const [bannerHovered, setBannerHovered] = useState(false);
  const [dragState, setDragState] = useState<{ startY: number; startPos: number } | null>(null);
  const [avatarRepositionMode, setAvatarRepositionMode] = useState(false);
  const [avatarPosition, setAvatarPosition] = useState(50);
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
    supabase.from('posts').select('media_url').eq('user_id',user.id).eq('is_public',true).not('media_url','is',null).order('created_at',{ascending:false})
      .then(({data})=>{ if(data) setFeedPhotos(data.map((p:any)=>p.media_url).filter(Boolean)); });
  },[user?.id]);

  // ── Highlights state ──
  const [highlights,setHighlights] = useState<string[]>([]);
  const [highlightLb,setHighlightLb] = useState<string|null>(null);
  const [editingHighlights,setEditingHighlights] = useState(false);

  // Load persisted highlights — Supabase first, localStorage fallback
  useEffect(() => {
    if (!user) return;
    async function loadHighlights() {
      try {
        // Try Supabase first (persists across devices)
        const { data } = await supabase.from('users').select('highlights').eq('id', user!.id).single();
        if (data?.highlights && Array.isArray(data.highlights) && data.highlights.length > 0) {
          // Filter to only valid URLs (not base64 blobs which may be truncated)
          const validUrls = data.highlights.filter((u: string) => u && (u.startsWith('http') || u.startsWith('/')));
          if (validUrls.length > 0) {
            setHighlights(validUrls);
            return;
          }
        }
      } catch {}
      // Fall back to localStorage
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

  // Load avatar/banner from profile
  useEffect(() => {
    if (user?.profile?.avatar_url) setAvatar(user.profile.avatar_url);
    if (user?.profile?.banner_url) setBanner(user.profile.banner_url);
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
      // Load saved avatar position
      try {
        const savedAvatarPos = localStorage.getItem(`avatar_position_${user.id}`);
        if (savedAvatarPos !== null) setAvatarPosition(parseFloat(savedAvatarPos));
      } catch {}
      if ((user as any)?.profile?.avatar_position !== undefined && (user as any)?.profile?.avatar_position !== null) {
        setAvatarPosition((user as any).profile.avatar_position);
      }
    }
  }, [user?.profile?.avatar_url, user?.profile?.banner_url, user?.id]);
  const [showAllPhotos,setShowAllPhotos] = useState(false);
  const [photoFilter,setPhotoFilter] = useState<"all"|"workout"|"nutrition"|"wellness">("all");

  // Helper: derive photo type based on index (mock data assignment)
  function getPhotoType(idx:number):"workout"|"nutrition"|"wellness" {
    if(idx<3) return "workout";
    if(idx<6) return "nutrition";
    return "wellness";
  }

  // ── Real activity log state ──
  const [realDays, setRealDays] = useState<typeof DAYS>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function loadLogs() {
      setLoadingLogs(true);
      try {
        const { data } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', user!.id)
          .order('logged_at', { ascending: false })
          .limit(60);

        if (!data || data.length === 0) {
          setRealDays([]);
          setLoadingLogs(false);
          return;
        }

        const byDate = new Map<string, any[]>();
        data.forEach((log: any) => {
          // Use local date string to correctly bucket by calendar day in user's timezone
          const d = new Date(log.logged_at);
          const key = d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }); // e.g. "04/02/2026"
          if (!byDate.has(key)) byDate.set(key, []);
          byDate.get(key)!.push(log);
        });

        const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

        const days: typeof DAYS = Array.from(byDate.entries()).map(([dateKey, logs]) => {
          // dateKey is now "MM/DD/YYYY"
          const [month, day, year] = dateKey.split('/').map(Number);
          const date = new Date(year, month - 1, day);
          const dayName = DAY_NAMES[date.getDay()];
          // Build a human-friendly label: "Today", "Yesterday", or "Mon 3/31"
          const today = new Date();
          const todayStr = today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
          const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
          const yesterdayStr = yesterday.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
          const friendlyLabel = dateKey === todayStr ? 'Today' : dateKey === yesterdayStr ? 'Yesterday' : `${dayName} ${month}/${day}`;

          const workoutLog = logs.find((l: any) => l.log_type === 'workout');
          const nutritionLogs = logs.filter((l: any) => l.log_type === 'nutrition');
          const wellnessLogs = logs.filter((l: any) => l.log_type === 'wellness');

          const workout = workoutLog ? {
            type: workoutLog.workout_type || 'Workout',
            duration: workoutLog.workout_duration_min ? `${workoutLog.workout_duration_min} min` : '—',
            calories: workoutLog.workout_calories || 0,
            exercises: Array.isArray(workoutLog.exercises)
              ? workoutLog.exercises.map((e: any) => ({
                  name: e.name || '',
                  sets: parseInt(e.sets) || 0,
                  reps: parseInt(e.reps) || 0,
                  weight: e.weight || '—',
                  weights: Array.isArray(e.weights) ? e.weights : [],
                }))
              : [],
            cardio: Array.isArray(workoutLog.cardio)
              ? workoutLog.cardio.map((c: any) => ({
                  type: c.type || 'Cardio',
                  duration: c.duration || '—',
                  distance: c.distance || '',
                }))
              : [],
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
              emoji: l.wellness_emoji || '🌿',
              activity: l.wellness_type || l.notes || 'Wellness',
              notes: l.notes || '',
              photo_url: l.photo_url || null,
            })),
          } : null;

          return {
            id: dateKey,
            label: friendlyLabel,
            emoji: workout ? '💪' : (nutrition ? '🥗' : (wellness ? '🌿' : '🌅')),
            workout,
            nutrition,
            wellness,
            _workoutLogId: workoutLog?.id || null,
            _nutritionLogIds: nutritionLogs.map((l: any) => l.id),
            _wellnessLogIds: wellnessLogs.map((l: any) => l.id),
            photo_url: workoutLog?.photo_url || nutritionLogs[0]?.photo_url || wellnessLogs[0]?.photo_url || null,
            _date: date.getTime(), // for sorting
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
  const [earnedBadges,setEarnedBadges] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('badges').select('badge_id').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setEarnedBadges(data.map((b: any) => b.badge_id));
      });
  }, [user]);
  const [showBadgeModal,setShowBadgeModal] = useState(false);
  const [selectedBadge,setSelectedBadge] = useState<string>("");
  const [badgeNote,setBadgeNote] = useState("");
  const [badgeToast,setBadgeToast] = useState<string|null>(null);
  const [showAllBadgesModal,setShowAllBadgesModal] = useState(false);

  // 🏆 Tier state — computed from activity logs
  const [userTier, setUserTier] = useState<Tier>("default");
  const [tierInfo, setTierInfo] = useState(getTierInfo(0, 0));

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
        const publicUrl = await uploadPhoto(dataUrl, supabasePath.bucket, supabasePath.path);
        if (publicUrl) {
          set(publicUrl);
          await supabase.from('users').update({ [supabasePath.dbField]: publicUrl }).eq('id', user.id);
        }
      }
    };
    r.readAsDataURL(f); e.target.value="";
  }

  async function saveBannerPosition() {
    if (!user) return;
    try { localStorage.setItem(`banner_position_${user.id}`, String(bannerPosition)); } catch {}
    // Try to save to Supabase (banner_position column may or may not exist)
    supabase.from('users').update({ banner_position: bannerPosition } as any).eq('id', user.id).then(() => {});
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
    supabase.from('users').update({ avatar_position: avatarPosition } as any).eq('id', user!.id).then(() => {});
    setAvatarRepositionMode(false);
  }

  function addHighlight(e:React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if(!f) return;
    const r = new FileReader();
    r.onload = async ev => {
      const dataUrl = ev.target!.result as string;
      // Show base64 preview immediately
      setHighlights(h => [...h, dataUrl]);
      if (user) {
        const publicUrl = await uploadPhoto(dataUrl, 'avatars', `${user.id}/highlights/${Date.now()}.jpg`);
        if (publicUrl && publicUrl.startsWith('http')) {
          setHighlights(h => {
            const next = h.map(u => u === dataUrl ? publicUrl : u).filter(u => u.startsWith('http') || u.startsWith('data:'));
            const httpOnly = next.filter(u => u.startsWith('http'));
            // persist outside render cycle
            setTimeout(() => {
              supabase.from('users').update({ highlights: httpOnly } as any).eq('id', user!.id).catch(() => {});
              try { localStorage.setItem(`fit_highlights_${user!.id}`, JSON.stringify(httpOnly)); } catch {}
            }, 0);
            return next;
          });
        }
      }
    };
    r.readAsDataURL(f);
    e.target.value = "";
  }

  function removeHighlight(idx:number) {
    setHighlights(h => {
      const next = h.filter((_,i) => i !== idx);
      // persist outside render cycle
      setTimeout(() => {
        if (user) {
          supabase.from('users').update({ highlights: next } as any).eq('id', user!.id).catch(() => {});
          try { localStorage.setItem(`fit_highlights_${user!.id}`, JSON.stringify(next)); } catch {}
        }
        if (next.length === 0) setEditingHighlights(false);
      }, 0);
      return next;
    });
  }

  async function claimBadge() {
    if (!user || !selectedBadge) return;
    await supabase.from('badges').insert({
      user_id: user.id,
      badge_id: selectedBadge,
      note: badgeNote || null,
    });
    setEarnedBadges(prev => [...prev, selectedBadge]);
    setShowBadgeModal(false);
    setSelectedBadge("");
    setBadgeNote("");
    setBadgeToast("Badge unlocked! 🎉");
    setTimeout(() => setBadgeToast(null), 3000);
  }

  const inputStyle = {width:"100%",background:"#0D0D0D",border:"1.5px solid #3D2A6E",borderRadius:14,padding:"11px 15px",fontSize:14,color:C.text,outline:"none",boxSizing:"border-box" as const,marginBottom:10};

  const manualBadges = BADGES.filter(b => b.manual);
  const HIGHLIGHT_SLOTS = 9;

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:80}}>

      <style jsx global>{`
        @media (max-width: 767px) {
          .profile-layout {
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: unset !important;
            padding: 0 !important;
            gap: 16px !important;
          }
          .profile-layout > * { width: 100% !important; min-width: unset !important; max-width: 100% !important; }
          .profile-header-wrap { flex-direction: column !important; align-items: center !important; text-align: center !important; gap: 0 !important; }
          .profile-avatar-col { order: 2 !important; margin-top: -48px !important; z-index: 2 !important; position: relative !important; }
          .profile-banner-block { order: 1 !important; min-width: unset !important; width: 100% !important; border-radius: 0 !important; }
          .profile-banner-label { border-radius: 0 !important; height: 180px !important; }
          .profile-outer { padding: 0 0 80px !important; max-width: 100% !important; margin: 0 !important; }
          .profile-stats-bio { padding: 0 16px !important; }
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
                      // Add directly from feed URL — no re-upload needed
                      setHighlights(h=>{
                        const next=[...h,src];
                        if(user){ try{ localStorage.setItem(`fit_highlights_${user.id}`,JSON.stringify(next)); }catch{} }
                        return next;
                      });
                      setShowHighlightPicker(false);
                    }} style={{padding:0,border:`3px solid ${alreadyAdded?C.purple:C.purpleMid}`,borderRadius:14,overflow:"hidden",cursor:alreadyAdded?"default":"pointer",background:"none",aspectRatio:"1",position:"relative"}}>
                      <img src={src} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} alt=""/>
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
                  let url=dataUrl;
                  if(user){
                    const {uploadPhoto:up}=await import('@/lib/uploadPhoto');
                    const publicUrl=await up(dataUrl,'avatars',`${user.id}/highlights/${Date.now()}.jpg`);
                    if(publicUrl) url=publicUrl;
                  }
                  setHighlights(h=>{ const next=[...h,url]; if(user){ try{ localStorage.setItem(`fit_highlights_${user.id}`,JSON.stringify(next)); }catch{} } return next; });
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
                      {u.avatar_url ? <img src={u.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/> : (u.full_name||u.username||"?")[0].toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:14,color:C.text}}>{u.full_name}</div>
                      <div style={{fontSize:12,color:C.sub}}>@{u.username}</div>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{width:18,height:18,flexShrink:0}}><path d="M9 18l6-6-6-6"/></svg>
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
      {showBadgeModal && (
        <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.white,borderRadius:28,padding:32,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,0.18)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontWeight:900,fontSize:22,color:C.text,marginBottom:6}}>Report an Achievement</div>
            <div style={{fontSize:13,color:C.sub,marginBottom:20}}>Honor system — we trust you. Earn it for real 💪</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              {manualBadges.map(b => {
                const earned = earnedBadges.includes(b.id);
                const sel = selectedBadge === b.id;
                return (
                  <button key={b.id} onClick={()=>setSelectedBadge(b.id)}
                    style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:16,border:`2px solid ${sel?C.purple:C.purpleMid}`,background:sel?"#2D1F52":"#1A1A1A",cursor:"pointer",textAlign:"left",opacity:earned?0.55:1}}>
                    <span style={{fontSize:28,flexShrink:0}}>{b.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:14,color:C.text,display:"flex",alignItems:"center",gap:8}}>
                        {b.label}
                        {earned && <span style={{fontSize:11,fontWeight:700,background:"#D1FAE5",color:"#065F46",borderRadius:8,padding:"2px 8px"}}>✓ Earned</span>}
                      </div>
                      <div style={{fontSize:12,color:C.sub,marginTop:2}}>{b.desc}</div>
                    </div>
                    <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${sel?C.purple:C.purpleMid}`,background:sel?C.purple:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sel && <div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:700,color:C.sub,display:"block",marginBottom:6}}>Tell us about it (optional)</label>
              <textarea value={badgeNote} onChange={e=>setBadgeNote(e.target.value)} rows={3} placeholder="Share your story..." style={{width:"100%",background:"#0D0D0D",border:"1.5px solid #3D2A6E",borderRadius:14,padding:"11px 15px",fontSize:14,color:C.text,outline:"none",resize:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:12}}>
              <button onClick={()=>{setShowBadgeModal(false);setSelectedBadge("");setBadgeNote("");}} style={{flex:1,padding:"13px 0",borderRadius:14,border:`2px solid ${C.purpleMid}`,background:"#0D0D0D",color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
              <button onClick={claimBadge} disabled={!selectedBadge} style={{flex:1,padding:"13px 0",borderRadius:14,border:"none",background:selectedBadge?`linear-gradient(135deg,${C.purple},#A78BFA)`:"#E5E7EB",color:selectedBadge?C.white:"#9CA3AF",fontWeight:900,cursor:selectedBadge?"pointer":"not-allowed"}}>Claim Badge</button>
            </div>
          </div>
        </div>
      )}

      {/* ── All Badges Modal ── */}
      {showAllBadgesModal && (
        <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:C.white,borderRadius:28,width:"100%",maxWidth:560,maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"22px 28px",borderBottom:`2px solid ${C.purpleMid}`}}>
              <div>
                <div style={{fontWeight:900,fontSize:20,color:C.text}}>🏆 All Badges</div>
                <div style={{fontSize:12,color:C.sub,marginTop:2}}>You have earned {earnedBadges.length + completedChallenges.length} badge{earnedBadges.length + completedChallenges.length === 1 ? "" : "s"}</div>
              </div>
              <button onClick={()=>setShowAllBadgesModal(false)} style={{width:36,height:36,borderRadius:"50%",border:"none",background:"#2D1F52",color:C.text,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>
              {earnedBadges.length === 0 && completedChallenges.length === 0 ? (
                <div style={{textAlign:"center",padding:"60px 20px",color:C.sub}}>
                  <div style={{fontSize:40,marginBottom:12}}>🏆</div>
                  <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:6}}>No badges earned yet</div>
                  <div style={{fontSize:13}}>Complete fitness milestones to earn badges and unlock achievements</div>
                </div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
                  {/* Earned badges grid */}
                  {BADGES.filter(b=>earnedBadges.includes(b.id)).map(b => (
                    <div key={b.id} style={{
                      borderRadius:16,
                      padding:"16px 10px",
                      textAlign:"center",
                      border:"1.5px solid #F5A623",
                      background:"linear-gradient(135deg,#2A1F00,#3D2D00)",
                      boxShadow:"0 0 16px rgba(245,166,35,0.4)",
                      transition:"all 0.2s",
                    }}>
                      <div style={{fontSize:32,marginBottom:6}}>{b.emoji}</div>
                      <div style={{fontWeight:800,fontSize:12,color:"#FFD700",lineHeight:1.3,marginBottom:4}}>{b.label}</div>
                      <div style={{fontSize:10,color:"#B8860B",lineHeight:1.3}}>{b.desc}</div>
                    </div>
                  ))}
                  {/* Challenge completion badges in grid */}
                  {completedChallenges.map((cp: any, i: number) => {
                    const ch = cp.challenges;
                    if (!ch) return null;
                    return (
                      <div key={`challenge-${i}`} style={{
                        borderRadius:16,
                        padding:"16px 10px",
                        textAlign:"center",
                        border:"1.5px solid #F5A623",
                        background:"linear-gradient(135deg,#2A1F00,#3D2D00)",
                        boxShadow:"0 0 16px rgba(245,166,35,0.4)",
                        transition:"all 0.2s",
                        display:"flex",
                        flexDirection:"column",
                        alignItems:"center",
                        justifyContent:"center",
                      }}>
                        <div style={{fontSize:32,marginBottom:6}}>{ch.emoji || '🏆'}</div>
                        <div style={{fontWeight:800,fontSize:11,color:"#FFD700",lineHeight:1.3,marginBottom:4}}>{ch.name}</div>
                        <div style={{fontSize:9,color:"#F5A623",lineHeight:1.3}}>Score: {cp.score}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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

      {/* Highlight Lightbox */}
      {highlightLb && <Lightbox src={highlightLb} onClose={()=>setHighlightLb(null)}/>}

      {/* ── All Photos Modal ── */}
      {showAllPhotos && (
        <div style={{position:"fixed",inset:0,zIndex:9997,background:"rgba(0,0,0,0.75)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{background:C.white,borderRadius:"0 0 24px 24px",padding:"20px 24px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{fontWeight:900,fontSize:20,color:C.text}}>📸 All Photos</div>
            <button onClick={()=>setShowAllPhotos(false)} style={{width:38,height:38,borderRadius:"50%",border:"none",background:"#2D1F52",color:C.text,fontSize:22,cursor:"pointer",lineHeight:"38px",textAlign:"center"}}>×</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"16px 24px 32px"}}>
            {feedPhotos.length===0 ? (
              <div style={{textAlign:"center",padding:"60px 0",color:C.sub}}>
                <div style={{fontSize:40,marginBottom:12}}>📭</div>
                <div style={{fontSize:15,fontWeight:600}}>No feed photos yet. Post something!</div>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {feedPhotos.map((src,idx)=>(
                  <button key={idx} onClick={()=>setHighlightLb(src)} style={{padding:0,border:`2px solid ${C.purpleMid}`,borderRadius:14,overflow:"hidden",cursor:"pointer",background:"none",aspectRatio:"1"}}>
                    <img src={src} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} alt=""/>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="profile-outer" style={{maxWidth:1200,padding:"32px 24px",margin:"0 auto"}}>

        {/* Profile header */}
        <div className="profile-header-wrap" style={{display:"flex",gap:28,alignItems:"flex-start",flexWrap:"wrap",marginBottom:36}}>
          {/* Avatar */}
          <div className="profile-avatar-col" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{position:"relative",display:"block",cursor:avatarRepositionMode?"ns-resize":"default",userSelect:"none"}}
              onMouseDown={handleAvatarMouseDown}
              onMouseMove={handleAvatarMouseMove}
              onMouseUp={handleAvatarMouseUp}
              onMouseLeave={handleAvatarMouseUp}
            >
              <TierFrame tier={userTier} size={150}>
              {profileImg
                ? <img src={profileImg} style={{width:150,height:150,borderRadius:"50%",objectFit:"cover",objectPosition:`center ${avatarPosition}%`,display:"block",pointerEvents:"none"}} alt="Profile"/>
                : <div style={{width:150,height:150,borderRadius:"50%",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:56,fontWeight:900,color:"#fff"}}>{profile.name[0]}</div>}
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
              {/* Reposition button — show when image exists and not in reposition mode */}
              {profileImg && !avatarRepositionMode && user && (
                <button onClick={e=>{e.preventDefault();setAvatarRepositionMode(true);}}
                  style={{position:"absolute",top:4,left:4,background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"4px 10px",cursor:"pointer",border:"none",display:"flex",alignItems:"center",gap:4,zIndex:5}}>
                  <span style={{fontSize:11}}>↕</span>
                  <span style={{color:"#fff",fontSize:10,fontWeight:700}}>Reposition</span>
                </button>
              )}
              {/* Reposition mode controls */}
              {avatarRepositionMode && (
                <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,borderRadius:"50%",background:"rgba(0,0,0,0.15)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",padding:"8px",zIndex:10,pointerEvents:"none"}}>
                  <div style={{display:"flex",gap:6,pointerEvents:"all"}}>
                    <button onClick={e=>{e.preventDefault();e.stopPropagation();saveAvatarPosition();}} style={{background:"#7C3AED",borderRadius:20,padding:"5px 12px",border:"none",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>✓ Save</button>
                    <button onClick={e=>{e.preventDefault();e.stopPropagation();setAvatarRepositionMode(false);setAvatarDragState(null);}} style={{background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"5px 12px",border:"none",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:19,color:C.text}}>{profile.name}</div>
              <TierTitle tier={userTier} />
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:4,flexWrap:"wrap"}}>
                <div style={{fontSize:13,color:C.sub}}>@{profile.username}</div>
                <TierBadgeChip tier={userTier} />
              </div>
              {profile.city && (
                <div style={{fontSize:12,color:C.sub,marginTop:3}}>📍 {profile.city}</div>
              )}
              {/* Tier progress bar */}
              {userTier !== "untouchable" && tierInfo.nextTier && (
                <div style={{marginTop:10,padding:"8px 14px",background:"rgba(0,0,0,0.3)",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:10,fontWeight:800,color:C.sub,textTransform:"uppercase" as const,letterSpacing:0.5}}>Tier Progress</span>
                    <span style={{fontSize:10,fontWeight:700,color:C.sub}}>{tierInfo.nextDescription}</span>
                  </div>
                  <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.08)",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:2,background:"#7C3AED",width:`${tierInfo.progress}%`,transition:"width 0.5s ease"}}/>
                  </div>
                </div>
              )}
              {userTier === "untouchable" && (
                <div style={{marginTop:8,fontSize:11,color:"#E879F9",fontWeight:700,letterSpacing:0.5}}>Untouchable — MAX TIER</div>
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
          <div className="profile-banner-block" style={{flex:1,minWidth:260}}>
            <div
              className="profile-banner-label"
              style={{width:"100%",height:155,borderRadius:26,overflow:"hidden",position:"relative",marginBottom:14,background:bannerImg?"transparent":`linear-gradient(135deg,${C.purple},#DDD6FE)`,border:`2px solid ${repositionMode?"#F5A623":C.purpleMid}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:repositionMode?"ns-resize":"default",userSelect:"none"}}
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
                ? <img src={bannerImg} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:`center ${bannerPosition}%`,transition:dragState?"none":"object-position 0.1s",pointerEvents:"none"}} alt="Banner"/>
                : <span style={{fontWeight:900,fontSize:17,color:"rgba(255,255,255,0.7)"}}>📷 Tap to add Banner</span>}
              {/* Reposition button — show on hover or when in reposition mode */}
              {bannerImg && !repositionMode && (bannerHovered || true) && user && (
                <button
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
                  <div style={{display:"flex",gap:8,pointerEvents:"all"}}>
                    <button onClick={e=>{e.preventDefault();e.stopPropagation();saveBannerPosition();}} style={{background:"#7C3AED",borderRadius:20,padding:"6px 16px",border:"none",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>✓ Save</button>
                    <button onClick={e=>{e.preventDefault();e.stopPropagation();setRepositionMode(false);setDragState(null);}} style={{background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"6px 16px",border:"none",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>Done</button>
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
            <p style={{fontSize:14,color:C.sub,marginBottom:14,lineHeight:1.55}}>{profile.bio}</p>

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

            <button onClick={()=>setEditProfile(true)} style={{padding:"11px 22px",borderRadius:14,border:`1.5px solid ${C.purple}`,background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",width:"100%",transition:"all 0.15s"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="#DDD6FE"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="transparent"}}>
              ✏️ Edit Profile
            </button>
            </div>{/* end profile-stats-bio */}
          </div>
        </div>

        {/* 3-column */}
        <div className="profile-layout" style={{display:"grid",gridTemplateColumns:"minmax(220px,260px) 1fr minmax(220px,260px)",gap:20,alignItems:"start"}}>

          {/* LEFT — Highlights */}
          <div>
            <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.purpleMid}`,boxShadow:"0 4px 14px rgba(124,58,237,0.08)",marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontWeight:900,fontSize:17,color:C.text}}>📸 Highlights</div>
                <div style={{display:"flex",gap:8}}>
                  {highlights.length > 0 && (
                    <button onClick={()=>setEditingHighlights(e=>!e)} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:editingHighlights?C.purple:"#2D1F52",color:editingHighlights?"#fff":C.purple,border:`1.5px solid ${C.purpleMid}`,cursor:"pointer"}}>
                      {editingHighlights ? "✓ Done" : "✏️ Edit"}
                    </button>
                  )}
                  <button onClick={()=>setShowAllPhotos(true)} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:"#2D1F52",color:"#A78BFA",border:"1.5px solid #3D2A6E",cursor:"pointer"}}>📷 All Photos</button>
                </div>
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
                {/* Workout Progress Graphs */}
                {realDays.length > 0 && (
                  <div style={{background:C.white,borderRadius:16,padding:16,border:`1px solid ${C.purpleMid}`,marginBottom:20}}>
                    <WorkoutProgressGraphs workouts={realDays.filter((d: any) => d.workout).map((d: any) => ({ ...d, created_at: d.id }))} />
                  </div>
                )}
                {(realDays.length > 0 ? realDays : DAYS).map(day => {
                const isReal = realDays.length > 0;
                return (
                  <DayCard
                    key={day.id}
                    day={day as any}
                    workoutLogId={(day as any)._workoutLogId}
                    nutritionLogIds={(day as any)._nutritionLogIds}
                    earnedBadges={earnedBadges}
                    onDelete={isReal ? async () => {
                      const wid = (day as any)._workoutLogId;
                      const nids: string[] = (day as any)._nutritionLogIds || [];
                      const wids: string[] = (day as any)._wellnessLogIds || [];
                      const allIds = [...(wid ? [wid] : []), ...nids, ...wids];
                      if (allIds.length > 0) {
                        await supabase.from('activity_logs').delete().in('id', allIds);
                      }
                      setRealDays(prev => prev.filter(d => d.id !== day.id));
                    } : undefined}
                  />
                );
              })}
              </>
            )}
          </div>

          {/* RIGHT */}
          <div>
            {/* Badges & Awards */}
            <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.purpleMid}`,boxShadow:"0 4px 14px rgba(124,58,237,0.08)",marginBottom:20}}>
              <div style={{fontWeight:900,fontSize:17,color:C.text,marginBottom:16}}>🏆 Badges & Awards</div>
              {earnedBadges.length === 0 && completedChallenges.length === 0 ? (
                <div style={{textAlign:"center",padding:"28px 16px",background:"#1A1230",borderRadius:16,marginBottom:16}}>
                  <div style={{fontSize:36,marginBottom:8}}>🏆</div>
                  <div style={{fontSize:14,fontWeight:700,color:C.sub,lineHeight:1.5}}>Complete fitness milestones to earn badges</div>
                </div>
              ) : (
                <>
                  {/* Preview grid - show only first 4-6 badges */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                    {BADGES.filter(b=>earnedBadges.includes(b.id)).slice(0,6).map(b => (
                      <div key={b.id} style={{
                        borderRadius:14,
                        padding:"12px 6px",
                        textAlign:"center",
                        border:"1.5px solid #F5A623",
                        background:"linear-gradient(135deg,#2A1F00,#3D2D00)",
                        boxShadow:"0 0 12px rgba(245,166,35,0.3)",
                      }}>
                        <div style={{fontSize:22,marginBottom:3}}>{b.emoji}</div>
                        <div style={{fontWeight:800,fontSize:10,color:"#FFD700",lineHeight:1.2}}>{b.label}</div>
                      </div>
                    ))}
                    {completedChallenges.slice(0, Math.max(0, 6 - earnedBadges.length)).map((cp: any, i: number) => {
                      const ch = cp.challenges;
                      if (!ch) return null;
                      return (
                        <div key={`challenge-${i}`} style={{
                          borderRadius:14,
                          padding:"12px 6px",
                          textAlign:"center",
                          border:"1.5px solid #F5A623",
                          background:"linear-gradient(135deg,#2A1F00,#3D2D00)",
                          boxShadow:"0 0 12px rgba(245,166,35,0.3)",
                        }}>
                          <div style={{fontSize:22,marginBottom:3}}>{ch.emoji || '🏆'}</div>
                          <div style={{fontWeight:800,fontSize:10,color:"#FFD700",lineHeight:1.2}}>Challenge</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* View all button if there are more than 6 badges */}
                  {(earnedBadges.length + completedChallenges.length) > 6 && (
                    <button onClick={()=>setShowAllBadgesModal(true)} style={{width:"100%",padding:"10px 0",marginBottom:12,borderRadius:14,border:`1.5px dashed ${C.purpleMid}`,background:"#2D1F52",color:"#A78BFA",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                      👀 View all {earnedBadges.length + completedChallenges.length} badges
                    </button>
                  )}
                </>
              )}
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

            <button style={{width:"100%",padding:"14px 0",borderRadius:16,border:`2px solid ${C.purpleMid}`,background:C.white,color:C.sub,fontWeight:700,fontSize:14,cursor:"pointer"}}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}




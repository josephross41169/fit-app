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
 const [wellness,setWellness] = useState<Wellness|null>((day as any).wellness as Wellness | null ?? null);
 // edit buffers
 const [woBuf,setWoBuf] = useState<Workout>(() => workout ? {...workout, cardio: (workout as any).cardio || [], exercises: workout.exercises || []} : {type:"",duration:"",calories:0,exercises:[],cardio:[]});
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
 cardioByType[t].dur += parseFloat(String(c.duration))||0;
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
 ].filter(Boolean).join(' · ');
 return '💪 ' + summary + (extras ? ' · ' + extras : '');
 })():"😴 Rest day"}</div>
 {nutrition&&<div style={{fontSize:12,color:C.sub,marginTop:2}}>🥗 {nutrition.calories} kcal · 🥩 {nutrition.protein}g protein</div>}
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
 cardioByType[t].dur += parseFloat(String(c.duration))||0;
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
 <div style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>{nutrition.calories} kcal · {nutrition.protein}g protein · {nutrition.sugar}g sugar</div>
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
 <div style={{fontSize:13,color:"rgba(255,255,255,0.85)"}}>{wellness.entries.map(e=>e.activity).join(" · ")}</div>
 </div>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span onClick={e=>{e.stopPropagation();setWellBuf({...wellness});setEditWell(true);}} style={{fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:20,background:"rgba(255,255,255,0.2)",color:"#fff",border:"1.5px solid rgba(255,255,255,0.4)",cursor:"pointer"}}>✏️ Edit</span>
 <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",transform:wellOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.25s",flexShrink:0}}>
 <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{width:14,height:14}}><path d="M6 9l6 6 6-6"/></svg>
 </div>
 </div>
 </button>
 {wellOpen && <div style={{background:"#F5F3FF",padding:14,display:"flex",flexDirection:"column",gap:8}}>
 {wellness.entries.map((e,i)=>(
 <div key={i} style={{background:"#0D0D0D",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:14,border:"1.5px solid #3D2A6E"}}>
 <div style={{width:44,height:44,borderRadius:13,background:"#F5F3FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{e.emoji}</div>
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

// (rest of file continues with EditableList, main page, etc.) 
// ... [file is too long, copying the rest from your submission]

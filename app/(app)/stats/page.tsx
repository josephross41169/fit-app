"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PieChart, Pie,
} from "recharts";

const C = {
  purple:"#7C3AED", purpleDim:"#2D1F52", purpleBorder:"#3D2A6E",
  gold:"#F5A623",   goldDim:"#2A1F08",
  cyan:"#06B6D4",   cyanDim:"#062030",
  green:"#4ADE80",  greenDim:"#062010",
  red:"#F87171",    redDim:"#200A0A",
  orange:"#FB923C",
  text:"#F0F0F0", sub:"#6B7280", subLight:"#9CA3AF",
  bg:"#0A0A0F", card:"#111118", cardHi:"#16161F",
  border:"#1E1E2E", borderHi:"#2D2040",
};

type Tab = "today"|"workout"|"nutrition"|"prs"|"body";
type Range = "1W"|"1M"|"1Y";
type NutritionGoals = { calories:number; protein:number; carbs:number; fat:number; water_oz:number };

// ── Muscle detection ──────────────────────────────────────────────────────────
const MUSCLE_MAP: Record<string,string[]> = {
  Chest:    ["chest","bench","pec","fly","flye","incline","decline","push"],
  Back:     ["back","row","pull","lat","deadlift","rdl","rhomboid","trap","rack pull","pulldown"],
  Legs:     ["leg","squat","lunge","quad","hamstring","glute","calf","hip thrust","leg press","leg curl","leg extension"],
  Shoulders:["shoulder","ohp","overhead","lateral","delt","arnold","shrug","face pull"],
  Arms:     ["curl","tricep","bicep","hammer","skull","pushdown","extension","preacher","close grip"],
  Core:     ["abs","core","crunch","plank","sit-up","oblique","cable crunch","hanging leg"],
};
const MUSCLE_COLORS: Record<string,string> = {
  Chest:"#F87171",Back:"#60A5FA",Legs:"#4ADE80",
  Shoulders:"#FBBF24",Arms:"#A78BFA",Core:"#F472B6",Other:"#6B7280",
};
function getMuscle(name:string):string {
  const n = name.toLowerCase();
  for (const [g,kws] of Object.entries(MUSCLE_MAP)) if (kws.some(k=>n.includes(k))) return g;
  return "Other";
}

// Normalize cardio names: "Monday morning run", "neighborhood morning run" → "Morning Run"
// Canonical cardio category names. Maps any free-text or raw type string
// (legacy logs may have "morning run", new logs have "running") to one of
// our top-level discipline buckets. The stats page groups by these so the
// breakdown shows clean per-discipline cards instead of "Morning Run /
// Evening Run / Treadmill" all as separate rows.
//
// Order matters in CARDIO_TYPES — first match wins. "stair" must come
// before "Machine" so stair climber gets its own bucket.
function normalizeCardio(raw:string):string {
  const s=(raw||"").toLowerCase().trim();
  const CARDIO_TYPES=[
    {keys:["run","jog","sprint","treadmill","trail"],label:"Running"},
    {keys:["cycle","bike","cycling","spin"],label:"Cycling"},
    {keys:["swim"],label:"Swimming"},
    {keys:["row","rowing"],label:"Rowing"},
    {keys:["elliptical"],label:"Elliptical"},
    {keys:["stair"],label:"Stair Climber"},
    {keys:["hiit"],label:"HIIT"},
    {keys:["walk"],label:"Walking"},
    {keys:["hike","hiking"],label:"Hiking"},
  ];
  for(const {keys,label} of CARDIO_TYPES){
    if(keys.some(k=>s.includes(k))) return label;
  }
  return "Other";
}

// Maps a discipline name to a representative emoji. Used for tile headers.
function cardioEmoji(label:string):string {
  switch(label){
    case "Running": return "🏃";
    case "Cycling": return "🚴";
    case "Swimming": return "🏊";
    case "Rowing": return "🚣";
    case "Elliptical": return "⚡";
    case "Stair Climber": return "🪜";
    case "HIIT": return "🔥";
    case "Walking": return "🚶";
    case "Hiking": return "🥾";
    default: return "💨";
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function daysAgo(n:number){ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString(); }

// Returns the start (00:00:00 local time) of the current Mon-Sun week. We
// compute the Monday of the week containing today, then zero out the time.
// JavaScript's getDay() is Sun=0..Sat=6, so we shift it to Mon=0..Sun=6
// before subtracting.
function startOfWeekMonday(): Date {
  const d = new Date();
  const dayMonZero = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - dayMonZero);
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function startOfYear(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

// rangeToIso returns the ISO-string lower bound for a query. 1W = start
// of this Mon-Sun week. 1M = start of this calendar month. 1Y = start of
// this calendar year. Switched away from rolling N-days-back so the
// filter aligns with how users actually think about "this week" /
// "this month" / "this year."
function rangeToIso(r:Range){
  if (r === "1W") return startOfWeekMonday().toISOString();
  if (r === "1M") return startOfMonth().toISOString();
  return startOfYear().toISOString(); // 1Y
}
function rangeLabel(r:Range){ return r==="1W"?"this week":r==="1M"?"this month":"this year"; }
function fmt(iso:string){ return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
function fmtDay(iso:string){ return new Date(iso).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}); }
function calcVol(exs:any[]):number {
  return (exs||[]).reduce((s,ex)=>s+(parseFloat(String(ex.weight))||0)*(parseInt(String(ex.reps))||0)*(parseInt(String(ex.sets))||0),0);
}
function calcStreak(dates:string[]){
  const unique=[...new Set(dates.map(d=>d.slice(0,10)))].sort().reverse();
  if(!unique.length) return {current:0,longest:0};
  const today=new Date().toISOString().slice(0,10);
  let cur=0,best=0,streak=0,prev="";
  for(const day of unique){
    const diff=prev?(new Date(prev).getTime()-new Date(day).getTime())/86400000:(new Date(today).getTime()-new Date(day).getTime())/86400000;
    streak=(!prev?diff<=1:diff===1)?streak+1:1;
    if(!cur){const d0=(new Date(today).getTime()-new Date(unique[0]).getTime())/86400000;if(d0<=1)cur=streak;}
    best=Math.max(best,streak);
    prev=day;
  }
  const d0=(new Date(today).getTime()-new Date(unique[0]).getTime())/86400000;
  return{current:d0<=1?(cur||streak):0,longest:best};
}

// ── UI atoms ───────────────────────────────────────────────────────────────────
function BigNum({label,value,sub,color=C.purple,icon}:{label:string;value:string|number;sub?:string;color?:string;icon?:string}){
  return(
    <div style={{background:C.card,borderRadius:18,padding:"18px 16px",border:`1px solid ${C.border}`,flex:1}}>
      {icon&&<div style={{fontSize:20,marginBottom:6}}>{icon}</div>}
      <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>{label}</div>
      <div style={{fontSize:26,fontWeight:900,color,lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:C.sub,marginTop:4}}>{sub}</div>}
    </div>
  );
}
function MiniNum({label,value,color=C.text}:{label:string;value:string|number;color?:string}){
  return(
    <div style={{background:C.card,borderRadius:12,padding:"11px 13px",border:`1px solid ${C.border}`}}>
      <div style={{fontSize:9,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>{label}</div>
      <div style={{fontSize:17,fontWeight:800,color}}>{value}</div>
    </div>
  );
}
function SecHead({title,right}:{title:string;right?:React.ReactNode}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,marginTop:26}}>
      <div style={{fontWeight:800,fontSize:12,color:C.sub,textTransform:"uppercase",letterSpacing:1.2}}>{title}</div>
      {right}
    </div>
  );
}
function Empty({icon,text}:{icon:string;text:string}){
  return(
    <div style={{background:C.card,borderRadius:14,padding:"30px 20px",border:`1px solid ${C.border}`,textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:8}}>{icon}</div>
      <div style={{color:C.sub,fontSize:13}}>{text}</div>
    </div>
  );
}
function ChartWrap({children}:{children:React.ReactNode}){
  return <div style={{background:C.card,borderRadius:14,padding:"14px 4px 8px 0",border:`1px solid ${C.border}`}}>{children}</div>;
}
function Tip({active,payload,label}:any){
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:"#1A1228",border:`1px solid ${C.borderHi}`,borderRadius:10,padding:"8px 12px",fontSize:12}}>
      <div style={{color:C.subLight,fontWeight:700,marginBottom:3}}>{label}</div>
      {payload.map((p:any,i:number)=><div key={i} style={{color:p.color||C.purple}}>{p.name}: <b>{typeof p.value==="number"?p.value.toLocaleString():p.value}</b>{p.unit||""}</div>)}
    </div>
  );
}
function ProgBar({value,max,color=C.purple}:{value:number;max:number;color?:string}){
  const pct=max>0?Math.min(100,(value/max)*100):0;
  return(
    <div style={{background:C.border,borderRadius:99,height:7,overflow:"hidden"}}>
      <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.5s ease"}}/>
    </div>
  );
}
function MacroRow({label,current,goal,color,unit}:{label:string;current:number;goal:number;color:string;unit:string}){
  const pct=goal>0?Math.min(100,Math.round((current/goal)*100)):0;
  const over=current>goal*1.1;
  const hit=pct>=90&&!over;
  const barColor=over?C.red:hit?C.green:color;
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:13,fontWeight:700,color:C.text}}>{label}</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:14,fontWeight:900,color:barColor}}>{current>0?current.toLocaleString():"0"}{unit}</span>
          <span style={{fontSize:11,color:C.sub}}>/ {goal.toLocaleString()}{unit}</span>
          <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99,
            background:over?C.redDim:hit?C.greenDim:C.purpleDim,
            color:over?C.red:hit?C.green:C.purple}}>{pct}%</span>
        </div>
      </div>
      <div style={{background:C.border,borderRadius:99,height:8,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:barColor,borderRadius:99,transition:"width 0.5s"}}/>
      </div>
    </div>
  );
}
function Heatmap({dates}:{dates:string[]}){
  const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS=["S","M","T","W","T","F","S"];
  const today=new Date();
  const cells=Array.from({length:84},(_,i)=>{
    const d=new Date(today); d.setDate(today.getDate()-(83-i));
    const key=d.toISOString().slice(0,10);
    return{date:key,count:dates.filter(dt=>dt.startsWith(key)).length,dayOfWeek:d.getDay(),month:d.getMonth(),day:d.getDate()};
  });
  const weeks:typeof cells[]=[];
  for(let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i,i+7));
  const col=(n:number)=>n===0?C.border:n===1?"#4C1D95":n===2?"#6D28D9":C.purple;
  const todayStr=today.toISOString().slice(0,10);
  // Month labels: show month name above the first week that starts a new month
  const monthLabels:Record<number,string>={};
  weeks.forEach((week,wi)=>{
    const first=week[0];
    if(wi===0||first.day<=7) monthLabels[wi]=MONTHS[first.month];
  });
  return(
    <div style={{overflowX:"auto"}}>
      {/* Month labels */}
      <div style={{display:"flex",gap:3,marginBottom:4,paddingLeft:20}}>
        {weeks.map((week,wi)=>(
          <div key={wi} style={{width:13,fontSize:9,color:C.sub,textAlign:"center",flexShrink:0}}>
            {monthLabels[wi]||""}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:3}}>
        {/* Day of week labels */}
        <div style={{display:"flex",flexDirection:"column",gap:3,marginRight:4}}>
          {DAYS.map((d,i)=>(
            <div key={i} style={{width:13,height:13,fontSize:8,color:C.sub,display:"flex",alignItems:"center",justifyContent:"flex-end",flexShrink:0}}>
              {i%2===1?d:""}
            </div>
          ))}
        </div>
        {weeks.map((week,wi)=>(
          <div key={wi} style={{display:"flex",flexDirection:"column",gap:3}}>
            {week.map((cell,di)=>(
              <div key={di} title={`${cell.date}: ${cell.count} workout${cell.count!==1?"s":""}`} style={{
                width:13,height:13,borderRadius:3,background:col(cell.count),
                border:cell.date===todayStr?`1.5px solid ${C.gold}`:"none",
                cursor:"default",
              }}/>
            ))}
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:5,marginTop:8,paddingLeft:20}}>
        <span style={{fontSize:10,color:C.sub}}>None</span>
        {[0,1,2,3].map(v=><div key={v} style={{width:11,height:11,borderRadius:2,background:col(v)}}/>)}
        <span style={{fontSize:10,color:C.sub}}>3+</span>
      </div>
    </div>
  );
}

// ── AI Nutrition Analysis (calls Claude via Anthropic API) ─────────────────────
function NutritionAI({goals,avgCal,avgProt,avgCarbs,avgFat,daysLogged,proteinPct,caloriePct}:
  {goals:NutritionGoals|null;avgCal:number;avgProt:number;avgCarbs:number;avgFat:number;daysLogged:number;proteinPct:number;caloriePct:number}){
  const [analysis,setAnalysis]=useState("");
  const [loading,setLoading]=useState(false);
  const [ran,setRan]=useState(false);

  async function analyze(){
    if(!goals||daysLogged===0){setAnalysis("Log some meals and set your goals first to get an AI analysis.");return;}
    setLoading(true);
    try{
      const prompt=`You are a concise nutrition coach. Analyze this athlete's eating data and give 3-4 specific, actionable insights in plain language (no markdown headers, no bullet points that start with -, use short punchy sentences). Keep total response under 120 words.

Goals: ${goals.calories} kcal, ${goals.protein}g protein, ${goals.carbs}g carbs, ${goals.fat}g fat
Actual avg/day: ${avgCal} kcal, ${avgProt}g protein, ${avgCarbs}g carbs, ${avgFat}g fat
Days logged: ${daysLogged}
Hitting protein goal: ${proteinPct}% of days
Hitting calorie goal: ${caloriePct}% of days`;

      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:200,
          messages:[{role:"user",content:prompt}]
        })
      });
      const data=await res.json();
      setAnalysis(data.content?.[0]?.text||"Could not generate analysis.");
    }catch{setAnalysis("Analysis unavailable right now.");}
    setLoading(false);
    setRan(true);
  }

  return(
    <div style={{background:C.purpleDim,borderRadius:14,padding:16,border:`1px solid ${C.purpleBorder}`,marginTop:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:analysis?12:0}}>
        <div>
          <div style={{fontWeight:800,fontSize:14,color:C.text}}>🤖 AI Nutrition Analysis</div>
          {!analysis&&<div style={{fontSize:12,color:C.sub,marginTop:3}}>Get personalized insights based on your data</div>}
        </div>
        <button onClick={analyze} disabled={loading} style={{
          padding:"7px 14px",borderRadius:10,border:"none",cursor:"pointer",
          background:`linear-gradient(135deg,${C.purple},#A78BFA)`,
          color:"#fff",fontWeight:700,fontSize:12,flexShrink:0,
        }}>{loading?"Analyzing…":ran?"Refresh":"Analyze"}</button>
      </div>
      {analysis&&<div style={{fontSize:13,color:C.subLight,lineHeight:1.65}}>{analysis}</div>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function StatsPage(){
  const {user}=useAuth();
  const router=useRouter();
  const [tab,setTab]=useState<Tab>("today");
  const [range,setRange]=useState<Range>("1M");
  // Tracks which muscle group cards on the Workout tab are expanded to
  // show per-exercise breakdowns. Multiple can be open at once.
  const [expandedMuscle,setExpandedMuscle]=useState<Record<string,boolean>>({});
  const [loading,setLoading]=useState(true);
  const [expandedPR,setExpandedPR]=useState<string|null>(null);
  const [showGoalEditor,setShowGoalEditor]=useState(false);
  const [showWeightModal,setShowWeightModal]=useState(false);
  const [weightInput,setWeightInput]=useState("");
  const [weightNotes,setWeightNotes]=useState("");
  const [weightPublic,setWeightPublic]=useState(false);
  const [weightSaving,setWeightSaving]=useState(false);
  const [savingGoals,setSavingGoals]=useState(false);

  // Goals
  const [goals,setGoals]=useState<NutritionGoals|null>(null);
  const [editGoals,setEditGoals]=useState<NutritionGoals>({calories:2500,protein:180,carbs:250,fat:70,water_oz:100});

  // Today
  const [todayWorkouts,setTodayWorkouts]=useState<any[]>([]);  // ALL workout logs today
  const [todayCardio,setTodayCardio]=useState<any[]>([]);      // cardio entries from today's workouts
  const [todayWellness,setTodayWellness]=useState<any[]>([]);  // wellness logs today
  const [todayNut,setTodayNut]=useState<{calories:number;protein:number;carbs:number;fat:number;water_oz:number}|null>(null);
  const [latestWeight,setLatestWeight]=useState<number|null>(null);

  // Range
  // Raw year-long data fetched once. Filtered versions (workoutLogs etc.)
  // are derived below via useMemo so range switching is instant — no
  // network round-trip per click.
  const [workoutLogsAll,setWorkoutLogsAll]=useState<any[]>([]);
  const [nutritionLogsAll,setNutritionLogsAll]=useState<any[]>([]);
  const [wellnessLogsAll,setWellnessLogsAll]=useState<any[]>([]);
  const [weightLogsAll,setWeightLogsAll]=useState<any[]>([]);
  const [prList,setPrList]=useState<any[]>([]);
  const [allWorkoutDates,setAllWorkoutDates]=useState<string[]>([]);

  const load=useCallback(async()=>{
    if(!user) return;
    setLoading(true);
    // ALWAYS fetch a full year of data regardless of the selected range.
    // Range switching (1W/1M/1Y) then filters in-memory which is instant
    // instead of refetching from Supabase. The user only re-fetches when
    // they navigate to the page; switching ranges is free.
    const yearStart = startOfYear().toISOString();
    const todayStart=new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd=new Date(); todayEnd.setHours(23,59,59,999);

    try{
      const [
        userGoalsRes,
        todayWorkoutsRes,
        todayWellnessRes,
        todayNutritionRes,
        latestWeightRes,
        rangeLogsRes,
        prsRes,
        weightLogsRes,
        allWorkoutDatesRes,
      ] = await Promise.all([
        supabase.from("users").select("nutrition_goals").eq("id",user.id).single(),
        supabase.from("activity_logs")
          .select("workout_category,workout_type,workout_duration_min,workout_calories,exercises,cardio,logged_at")
          .eq("user_id",user.id).eq("log_type","workout")
          .gte("logged_at",todayStart.toISOString()).lte("logged_at",todayEnd.toISOString()),
        supabase.from("activity_logs")
          .select("wellness_type,wellness_duration_min,notes,logged_at")
          .eq("user_id",user.id).eq("log_type","wellness")
          .gte("logged_at",todayStart.toISOString()).lte("logged_at",todayEnd.toISOString()),
        supabase.from("activity_logs")
          .select("calories_total,protein_g,carbs_g,fat_g,water_oz")
          .eq("user_id",user.id).eq("log_type","nutrition")
          .gte("logged_at",todayStart.toISOString()).lte("logged_at",todayEnd.toISOString()),
        supabase.from("weight_logs")
          .select("weight_lbs,logged_at").eq("user_id",user.id)
          .order("logged_at",{ascending:false}).limit(1)
          .then(r => r, () => ({ data: null, error: "no table" })),
        // Pull a full year of activity logs. Range filter is applied in
        // memory below (see the range-derived state declared after this
        // hook). Way faster than re-fetching whenever the user toggles
        // 1W/1M/1Y.
        supabase.from("activity_logs")
          .select("id,log_type,logged_at,workout_category,workout_type,workout_duration_min,workout_calories,exercises,cardio,calories_total,protein_g,carbs_g,fat_g,water_oz,wellness_type,wellness_duration_min,notes,meal_type")
          .eq("user_id",user.id).gte("logged_at",yearStart)
          .order("logged_at",{ascending:true}),
        supabase.from("personal_records")
          .select("exercise_name,weight,reps,volume,logged_at")
          .eq("user_id",user.id).order("weight",{ascending:false}),
        supabase.from("weight_logs")
          .select("weight_lbs,logged_at").eq("user_id",user.id)
          .gte("logged_at",yearStart).order("logged_at",{ascending:true})
          .then(r => r, () => ({ data: null, error: "no table" })),
        supabase.from("activity_logs")
          .select("logged_at").eq("user_id",user.id).eq("log_type","workout")
          .order("logged_at",{ascending:false}),
      ]);

      // Goals
      const ud = (userGoalsRes as any).data;
      if(ud?.nutrition_goals){setGoals(ud.nutrition_goals as NutritionGoals);setEditGoals(ud.nutrition_goals as NutritionGoals);}

      // Today workouts
      const tw = (todayWorkoutsRes as any).data || [];
      setTodayWorkouts(tw);
      const allCardioToday = tw.flatMap((l:any)=>Array.isArray(l.cardio)?l.cardio.map((c:any)=>({...c,logged_at:l.logged_at})):[]);
      setTodayCardio(allCardioToday);

      // Today wellness
      setTodayWellness((todayWellnessRes as any).data || []);

      // Today nutrition (sum across any logs in today's window)
      const tnutData = (todayNutritionRes as any).data;
      if(tnutData&&tnutData.length>0){
        setTodayNut(tnutData.reduce((a:any,l:any)=>({
          calories:a.calories+(l.calories_total||0),
          protein:a.protein+(l.protein_g||0),
          carbs:a.carbs+(l.carbs_g||0),
          fat:a.fat+(l.fat_g||0),
          water_oz:a.water_oz+(l.water_oz||0),
        }),{calories:0,protein:0,carbs:0,fat:0,water_oz:0}));
      } else setTodayNut(null);

      // Latest weight (all time)
      const lwData = (latestWeightRes as any).data;
      if(lwData && lwData.length>0) setLatestWeight(Number(lwData[0].weight_lbs));

      // Range logs (split by type)
      const logs = (rangeLogsRes as any).data;
      if(logs){
        setWorkoutLogsAll(logs.filter((l:any)=>l.log_type==="workout"));
        setNutritionLogsAll(logs.filter((l:any)=>l.log_type==="nutrition"));
        setWellnessLogsAll(logs.filter((l:any)=>l.log_type==="wellness"));
      }

      // PRs
      const prs = (prsRes as any).data;
      if(prs) setPrList(prs);

      // Weight logs — full year, filtered client-side
      const wl = (weightLogsRes as any).data;
      if(wl) setWeightLogsAll(wl);

      // All workout dates for streak/heatmap
      const allW = (allWorkoutDatesRes as any).data;
      if(allW) setAllWorkoutDates(allW.map((l:any)=>l.logged_at));

    }catch(e){console.error(e);}
    setLoading(false);
  },[user]);

  useEffect(()=>{load();},[load]);

  // ── Range-filtered views ───────────────────────────────────────────────
  // The `*All` state holds a full year of data fetched once. These memos
  // filter to whichever range the user has selected. Filtering in JS is
  // basically free (millisecond), so the 1W/1M/1Y pills feel instant.
  // Ref-stable across renders that don't change the inputs, so child
  // components don't re-compute unnecessarily either.
  const sinceTs = (() => {
    if (range === "1W") return startOfWeekMonday().getTime();
    if (range === "1M") return startOfMonth().getTime();
    return startOfYear().getTime();
  })();
  const workoutLogs = workoutLogsAll.filter((l:any)=>new Date(l.logged_at).getTime() >= sinceTs);
  const nutritionLogs = nutritionLogsAll.filter((l:any)=>new Date(l.logged_at).getTime() >= sinceTs);
  const wellnessLogs = wellnessLogsAll.filter((l:any)=>new Date(l.logged_at).getTime() >= sinceTs);
  const weightLogs = weightLogsAll.filter((l:any)=>new Date(l.logged_at).getTime() >= sinceTs);

  async function saveWeight() {
    const lbs = parseFloat(weightInput);
    if (!lbs || !user) return;
    setWeightSaving(true);
    try {
      const { error } = await supabase.from('weight_logs').insert({
        user_id: user.id,
        weight_lbs: lbs,
        notes: weightNotes || null,
        is_public: weightPublic,
        logged_at: new Date().toISOString(),
      });
      if (error) { alert("Error saving weight: " + error.message); setWeightSaving(false); return; }
      setLatestWeight(lbs);
      setWeightLogsAll((prev:any) => [{ weight_lbs: lbs, logged_at: new Date().toISOString() }, ...prev]);
      setWeightInput("");
      setWeightNotes("");
      setWeightPublic(false);
      setShowWeightModal(false);
    } catch(e:any) { alert("Error: " + e.message); }
    setWeightSaving(false);
  }

  async function saveGoals(){
    if(!user) return;
    setSavingGoals(true);
    try{
      // Capture error response — previously this swallowed failures so a
      // user with bad data or an RLS issue would think their save worked
      // when nothing was actually written. Now we surface the error.
      const { error } = await supabase
        .from("users")
        .update({ nutrition_goals: editGoals })
        .eq("id", user.id);
      if (error) {
        alert("Couldn't save goals: " + error.message);
        setSavingGoals(false);
        return;
      }
      setGoals(editGoals);
      setShowGoalEditor(false);
    }catch(e:any){
      console.error(e);
      alert("Couldn't save goals: " + (e?.message || "unknown error"));
    }
    setSavingGoals(false);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const streaks=calcStreak(allWorkoutDates);
  const totalWorkouts=workoutLogs.length;
  // Approximate "weeks in this range" used as a denominator for averages.
  // 1W=1 week. 1M=~4 weeks. 1Y=52 weeks. Doesn't need to be exact since
  // it's just an average normalizer.
  const rangeWeeks=range==="1W"?1:range==="1M"?4:52;
  // Count only actual weeks that had at least 1 workout (not all weeks in range)
  const activeWeeks=(()=>{
    const ws=new Set<string>();
    workoutLogs.forEach(l=>{
      const d=new Date(l.logged_at); d.setDate(d.getDate()-d.getDay());
      ws.add(d.toISOString().slice(0,10));
    });
    return Math.max(1,ws.size);
  })();
  const avgPerWeek=totalWorkouts>0?(totalWorkouts/activeWeeks).toFixed(1):"0";
  const totalVolume=workoutLogs.reduce((s,l)=>s+calcVol(Array.isArray(l.exercises)?l.exercises:[]),0);
  const totalCalBurned=workoutLogs.reduce((s,l)=>s+(l.workout_calories||0),0);
  const logsWithDuration=workoutLogs.filter(l=>(l.workout_duration_min||0)>0);
  const avgDuration=logsWithDuration.length>0?Math.round(logsWithDuration.reduce((s,l)=>s+l.workout_duration_min,0)/logsWithDuration.length):0;
  const favDay=(()=>{
    if(!workoutLogs.length) return "—";
    const map=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const c:Record<string,number>={};
    workoutLogs.forEach(l=>{const d=map[new Date(l.logged_at).getDay()];c[d]=(c[d]||0)+1;});
    return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";
  })();

  // Workout type breakdown (this week)
  const thisWeekStart=new Date(); thisWeekStart.setDate(thisWeekStart.getDate()-thisWeekStart.getDay());
  const thisWeekLogs=workoutLogs.filter(l=>new Date(l.logged_at)>=thisWeekStart);
  // Group lifting sessions by primary muscle group, with avg volume
  const workoutByMuscle=(()=>{
    const g:Record<string,{count:number;totalVol:number;sessions:string[]}>={};
    workoutLogs.forEach(l=>{
      const exs=Array.isArray(l.exercises)?l.exercises:[];
      if(exs.length===0) return; // pure cardio, skip
      // Find primary muscle group (most sets)
      const mc:Record<string,number>={};
      exs.forEach((ex:any)=>{const m=getMuscle(ex.name||"");mc[m]=(mc[m]||0)+(parseInt(String(ex.sets))||1);});
      const primary=Object.entries(mc).sort((a,b)=>b[1]-a[1])[0]?.[0]||"Other";
      if(!g[primary]) g[primary]={count:0,totalVol:0,sessions:[]};
      const vol=calcVol(exs);
      g[primary].count++;
      g[primary].totalVol+=vol;
      if(l.workout_type) g[primary].sessions.push(l.workout_type);
    });
    return Object.entries(g).sort((a,b)=>b[1].count-a[1].count).map(([muscle,{count,totalVol,sessions}])=>({
      muscle,count,
      avgVol:count>0?Math.round(totalVol/count):0,
      color:MUSCLE_COLORS[muscle]||"#6B7280",
    }));
  })();
  const workoutTypes=(()=>{
    // Group by the standardized workout_category when present, falling back
    // to the free-text workout_type name for legacy rows that haven't been
    // backfilled. The category gives reliable bucketing ("Push Day A" and
    // "Push Day B" both count as lifting), while the name stays as the
    // user's personal label.
    const t:Record<string,number>={};
    const CATEGORY_LABELS: Record<string,string> = {
      running:"Running", walking:"Walking", biking:"Biking", swimming:"Swimming",
      rowing:"Rowing", lifting:"Lifting", hiit:"HIIT", yoga:"Yoga",
      pilates:"Pilates", boxing:"Boxing", sports:"Sports", other:"Other",
    };
    workoutLogs.forEach(l=>{
      const tp = l.workout_category
        ? (CATEGORY_LABELS[l.workout_category] || l.workout_category)
        : (l.workout_type || "Workout");
      t[tp]=(t[tp]||0)+1;
    });
    return Object.entries(t).sort((a,b)=>b[1]-a[1]).map(([type,count])=>({type,count}));
  })();

  // Cardio stats from workout logs
  const allCardio=workoutLogs.flatMap(l=>Array.isArray(l.cardio)?l.cardio.map((c:any)=>({...c,logged_at:l.logged_at})):[]);
  const cardioSessions=workoutLogs.filter(l=>Array.isArray(l.cardio)&&l.cardio.length>0).length;
  const liftingSessions=workoutLogs.filter(l=>Array.isArray(l.exercises)&&l.exercises.length>0).length;
  const totalCardioMin=allCardio.reduce((s:number,c:any)=>s+(parseFloat(String(c.duration))||0),0);
  const totalCardioMiles=allCardio.reduce((s:number,c:any)=>s+(parseFloat(String(c.distance))||0),0);
  const cardioTypes=(()=>{
    type Bucket = {count:number;totalDist:number;totalDur:number;longest:number;};
    const t:Record<string,Bucket>={};
    allCardio.forEach((c:any)=>{
      const tp=normalizeCardio(c.type||"Cardio");
      if(!t[tp]) t[tp]={count:0,totalDist:0,totalDur:0,longest:0};
      const dist = parseFloat(String(c.distance))||0;
      const dur = parseFloat(String(c.duration))||0;
      t[tp].count++;
      t[tp].totalDist += dist;
      t[tp].totalDur  += dur;
      if (dist > t[tp].longest) t[tp].longest = dist;
    });
    return Object.entries(t).sort((a,b)=>b[1].count-a[1].count).map(([type,b])=>{
      const avgDist = b.count>0?Math.round((b.totalDist/b.count)*100)/100:0;
      const avgDur  = b.count>0?Math.round(b.totalDur/b.count):0;
      // Avg pace only meaningful for distance disciplines.
      let paceStr = "—";
      if (b.totalDist > 0 && b.totalDur > 0) {
        if (type === "Cycling") {
          const mph = (b.totalDist / b.totalDur) * 60;
          paceStr = `${mph.toFixed(1)} mph`;
        } else if (type === "Swimming") {
          // Swim pace is per 100yd. Distance is stored in yards.
          const p = (b.totalDur / b.totalDist) * 100;
          const m = Math.floor(p);
          const sec = Math.round((p - m) * 60);
          paceStr = `${m}:${sec.toString().padStart(2,"0")} /100yd`;
        } else if (type === "Running" || type === "Walking" || type === "Hiking") {
          const p = b.totalDur / b.totalDist;
          const m = Math.floor(p);
          const sec = Math.round((p - m) * 60);
          paceStr = `${m}:${sec.toString().padStart(2,"0")} /mi`;
        }
      }
      return {
        type,
        count: b.count,
        totalDist: Math.round(b.totalDist*100)/100,
        totalDur: Math.round(b.totalDur),
        longest: Math.round(b.longest*100)/100,
        avgDist, avgDur, paceStr,
      };
    });
  })();

  // ── Per-activity range stats (running + lifting) ─────────────────────────────
  // Running stats bucketed by week and month. Uses the canonical "Running"
  // label so all run subtypes (outdoor / treadmill / trail / hiit) bucket
  // together. Walking is its own category so it's kept separate now.
  const runEntries = allCardio.filter((c:any)=>{
    return normalizeCardio(c.type||"") === "Running";
  });
  const runStats = {
    totalMiles: Math.round(runEntries.reduce((s:number,c:any)=>s+(parseFloat(String(c.distance))||0),0)*100)/100,
    totalMin: runEntries.reduce((s:number,c:any)=>s+(parseFloat(String(c.duration))||0),0),
    sessions: runEntries.length,
    avgMiles: runEntries.length>0?Math.round((runEntries.reduce((s:number,c:any)=>s+(parseFloat(String(c.distance))||0),0)/runEntries.length)*100)/100:0,
    avgMin: runEntries.length>0?Math.round(runEntries.reduce((s:number,c:any)=>s+(parseFloat(String(c.duration))||0),0)/runEntries.length):0,
    longestRun: runEntries.reduce((best:number,c:any)=>Math.max(best,parseFloat(String(c.distance))||0),0),
    longestRun_date: runEntries.reduce((best:{dist:number,date:string},{distance,logged_at}:any)=>{const d=parseFloat(String(distance))||0;return d>best.dist?{dist:d,date:logged_at}:best;},{dist:0,date:""}).date,
  };
  // Avg pace (min/mile)
  const runPaceMin = runStats.totalMiles>0?Math.floor(runStats.totalMin/runStats.totalMiles):0;
  const runPaceSec = runStats.totalMiles>0?Math.round(((runStats.totalMin/runStats.totalMiles)-runPaceMin)*60):0;
  const runPaceStr = runPaceMin>0?`${runPaceMin}:${runPaceSec.toString().padStart(2,"0")} /mi`:"—";

  // Weekly run distance for chart
  const weeklyRunDist=(()=>{
    const weeks:Record<string,number>={};
    runEntries.forEach((c:any)=>{
      if(!c.logged_at) return;
      const d=new Date(c.logged_at); d.setDate(d.getDate()-d.getDay());
      const key=d.toISOString().slice(0,10);
      weeks[key]=(weeks[key]||0)+(parseFloat(String(c.distance))||0);
    });
    return Object.entries(weeks).sort().map(([date,mi])=>({week:fmt(date),miles:Math.round(mi*100)/100}));
  })();

  // Lifting stats
  const liftingLogs=workoutLogs.filter(l=>Array.isArray(l.exercises)&&l.exercises.length>0);
  const liftStats={
    sessions:liftingLogs.length,
    totalVolume:liftingLogs.reduce((s,l)=>s+calcVol(Array.isArray(l.exercises)?l.exercises:[]),0),
    avgVolume:liftingLogs.length>0?Math.round(liftingLogs.reduce((s,l)=>s+calcVol(Array.isArray(l.exercises)?l.exercises:[]),0)/liftingLogs.length):0,
    avgDuration:liftingLogs.filter(l=>l.workout_duration_min>0).length>0?Math.round(liftingLogs.filter(l=>l.workout_duration_min>0).reduce((s,l)=>s+l.workout_duration_min,0)/liftingLogs.filter(l=>l.workout_duration_min>0).length):0,
    totalCalBurned:liftingLogs.reduce((s,l)=>s+(l.workout_calories||0),0),
    bestVolume:liftingLogs.reduce((best:{vol:number,date:string,type:string},l)=>{const v=calcVol(Array.isArray(l.exercises)?l.exercises:[]);return v>best.vol?{vol:v,date:l.logged_at,type:l.workout_type||"Workout"}:best;},{vol:0,date:"",type:""}),
  };

  // Muscle groups

  const muscleGroups=(()=>{
    const g:Record<string,number>={};
    workoutLogs.forEach(l=>(Array.isArray(l.exercises)?l.exercises:[]).forEach((ex:any)=>{
      const m=getMuscle(ex.name||""); g[m]=(g[m]||0)+1;
    }));
    return Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  })();

  // Per-muscle-group exercise breakdown. For each muscle group, lists every
  // exercise that hit it with: total sets, max weight, total volume, last
  // logged date. Used in the expandable muscle-group cards on the workout
  // tab — clicking a group reveals these.
  const muscleGroupDetails = (() => {
    type ExStat = { name: string; sets: number; reps: number; maxWeight: number; totalVolume: number; lastDate: string };
    const byMuscle: Record<string, Record<string, ExStat>> = {};
    workoutLogs.forEach(l => {
      const exs = Array.isArray(l.exercises) ? l.exercises : [];
      exs.forEach((ex: any) => {
        const m = getMuscle(ex.name || "");
        if (!byMuscle[m]) byMuscle[m] = {};
        const exName = String(ex.name || "Unknown").trim();
        if (!byMuscle[m][exName]) {
          byMuscle[m][exName] = { name: exName, sets: 0, reps: 0, maxWeight: 0, totalVolume: 0, lastDate: l.logged_at };
        }
        const sets = parseInt(String(ex.sets)) || 0;
        const reps = parseInt(String(ex.reps)) || 0;
        const wt = parseFloat(String(ex.weight)) || 0;
        byMuscle[m][exName].sets += sets;
        byMuscle[m][exName].reps += reps * sets;
        if (wt > byMuscle[m][exName].maxWeight) byMuscle[m][exName].maxWeight = wt;
        byMuscle[m][exName].totalVolume += sets * reps * wt;
        if (l.logged_at > byMuscle[m][exName].lastDate) byMuscle[m][exName].lastDate = l.logged_at;
      });
    });
    const result: Record<string, ExStat[]> = {};
    Object.keys(byMuscle).forEach(m => {
      result[m] = Object.values(byMuscle[m]).sort((a, b) => b.totalVolume - a.totalVolume);
    });
    return result;
  })();
  const muscleRadar=["Chest","Back","Legs","Shoulders","Arms","Core"].map(m=>({
    group:m,
    sessions:workoutLogs.filter(l=>(Array.isArray(l.exercises)?l.exercises:[]).some((ex:any)=>getMuscle(ex.name||"")===m)).length,
  }));

  // Weekly volume chart
  const weeklyVolume=(()=>{
    const weeks:Record<string,number>={};
    workoutLogs.forEach(l=>{
      const d=new Date(l.logged_at); d.setDate(d.getDate()-d.getDay());
      const key=d.toISOString().slice(0,10);
      weeks[key]=(weeks[key]||0)+calcVol(Array.isArray(l.exercises)?l.exercises:[]);
    });
    return Object.entries(weeks).sort().map(([date,vol])=>({week:fmt(date),volume:Math.round(vol)}));
  })();

  // Training frequency by day of week. Computed three ways:
  //   - freqByDay: any workout (lifting OR cardio) — used for the "Fav Day"
  //     stat at the top of the page.
  //   - freqByDayLift: workouts that include lifting exercises only.
  //   - freqByDayCardio: workouts that include cardio entries only.
  // The split versions power separate per-discipline charts so lifting
  // and cardio patterns don't mash together.
  const dayKeys = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const jsDayFor = (idx:number) => idx<6?idx+1:0;
  const freqByDay = dayKeys.map((day,idx)=>{
    const jsDay = jsDayFor(idx);
    return { day, count: workoutLogs.filter(l=>new Date(l.logged_at).getDay()===jsDay).length };
  });
  const freqByDayLift = dayKeys.map((day,idx)=>{
    const jsDay = jsDayFor(idx);
    return { day, count: workoutLogs.filter(l=>{
      const hasLifting = Array.isArray(l.exercises) && l.exercises.length > 0;
      return hasLifting && new Date(l.logged_at).getDay()===jsDay;
    }).length };
  });
  const freqByDayCardio = dayKeys.map((day,idx)=>{
    const jsDay = jsDayFor(idx);
    return { day, count: workoutLogs.filter(l=>{
      const hasCardio = Array.isArray(l.cardio) && l.cardio.length > 0;
      return hasCardio && new Date(l.logged_at).getDay()===jsDay;
    }).length };
  });

  // Nutrition
  const daysLogged=nutritionLogs.length;
  const avgCal=daysLogged>0?Math.round(nutritionLogs.reduce((s,l)=>s+(l.calories_total||0),0)/daysLogged):0;
  const avgProt=daysLogged>0?Math.round(nutritionLogs.reduce((s,l)=>s+(l.protein_g||0),0)/daysLogged):0;
  const avgCarbs=daysLogged>0?Math.round(nutritionLogs.reduce((s,l)=>s+(l.carbs_g||0),0)/daysLogged):0;
  const avgFat=daysLogged>0?Math.round(nutritionLogs.reduce((s,l)=>s+(l.fat_g||0),0)/daysLogged):0;
  const proteinHit=goals?nutritionLogs.filter(l=>(l.protein_g||0)>=goals.protein).length:0;
  const calorieHit=goals?nutritionLogs.filter(l=>Math.abs((l.calories_total||0)-goals.calories)<=goals.calories*0.1).length:0;
  const proteinPct=daysLogged>0?Math.round((proteinHit/daysLogged)*100):0;
  const caloriePct=daysLogged>0?Math.round((calorieHit/daysLogged)*100):0;
  const dailyNutrition=nutritionLogs.map(l=>({
    date:fmt(l.logged_at),
    calories:Math.round(l.calories_total||0),
    protein:Math.round(l.protein_g||0),
    carbs:Math.round(l.carbs_g||0),
    fat:Math.round(l.fat_g||0),
    calGoal:goals?.calories||0,
    protGoal:goals?.protein||0,
  }));
  const macroPie=avgCal>0?[
    {name:"Protein",value:Math.round(avgProt*4),color:C.green},
    {name:"Carbs",value:Math.round(avgCarbs*4),color:C.purple},
    {name:"Fat",value:Math.round(avgFat*9),color:C.gold},
  ]:[];

  // Per-meal-type breakdown — separate cards for breakfast/lunch/dinner/
  // snack so users can see which meal carries which macros. Useful for
  // spotting things like "I'm under-eating protein at breakfast" or "my
  // dinner is half my daily calories." Falls back to time-of-day buckets
  // for legacy logs that don't have meal_type set.
  const mealTypeStats = (() => {
    type MealBucket = {
      count: number;
      totalCal: number;
      totalProt: number;
      totalCarbs: number;
      totalFat: number;
    };
    const buckets: Record<string, MealBucket> = {
      breakfast: { count:0, totalCal:0, totalProt:0, totalCarbs:0, totalFat:0 },
      lunch:     { count:0, totalCal:0, totalProt:0, totalCarbs:0, totalFat:0 },
      dinner:    { count:0, totalCal:0, totalProt:0, totalCarbs:0, totalFat:0 },
      snack:     { count:0, totalCal:0, totalProt:0, totalCarbs:0, totalFat:0 },
    };
    nutritionLogs.forEach((l: any) => {
      // Pick the bucket. Prefer meal_type from the log if set, else fall
      // back to inferring by hour-of-day (breakfast 5-11, lunch 11-15,
      // dinner 17-22, otherwise snack).
      let key = (l.meal_type || "").toLowerCase().trim();
      if (!buckets[key]) {
        const hr = new Date(l.logged_at).getHours();
        if (hr >= 5 && hr < 11) key = "breakfast";
        else if (hr >= 11 && hr < 15) key = "lunch";
        else if (hr >= 17 && hr < 22) key = "dinner";
        else key = "snack";
      }
      buckets[key].count++;
      buckets[key].totalCal += l.calories_total || 0;
      buckets[key].totalProt += l.protein_g || 0;
      buckets[key].totalCarbs += l.carbs_g || 0;
      buckets[key].totalFat += l.fat_g || 0;
    });
    return (["breakfast","lunch","dinner","snack"] as const).map(k => {
      const b = buckets[k];
      return {
        key: k,
        label: k.charAt(0).toUpperCase() + k.slice(1),
        emoji: k === "breakfast" ? "🍳" : k === "lunch" ? "🥗" : k === "dinner" ? "🍽️" : "🍎",
        count: b.count,
        avgCal: b.count > 0 ? Math.round(b.totalCal / b.count) : 0,
        avgProt: b.count > 0 ? Math.round(b.totalProt / b.count) : 0,
        avgCarbs: b.count > 0 ? Math.round(b.totalCarbs / b.count) : 0,
        avgFat: b.count > 0 ? Math.round(b.totalFat / b.count) : 0,
        totalCal: Math.round(b.totalCal),
      };
    });
    // ^ no .filter — show all 4 meal types so empty ones surface as
    // visible "0× logged" cards. Helps users spot which meals they're
    // not tracking yet.
  })();

  // PRs grouped by muscle group
  const prsByEx=prList.reduce((acc:Record<string,any[]>,pr)=>{
    if(!acc[pr.exercise_name]) acc[pr.exercise_name]=[];
    acc[pr.exercise_name].push(pr);
    return acc;
  },{});
  const topPRs=Object.entries(prsByEx).map(([name,records])=>({
    name,
    muscle:getMuscle(name),
    best:records.reduce((b,r)=>r.weight>b.weight?r:b),
    history:records.sort((a,b)=>new Date(a.logged_at).getTime()-new Date(b.logged_at).getTime()),
  })).sort((a,b)=>b.best.weight-a.best.weight);
  // Group PRs by muscle
  const prsByMuscle:Record<string,typeof topPRs>=topPRs.reduce((acc,pr)=>{
    if(!acc[pr.muscle]) acc[pr.muscle]=[];
    acc[pr.muscle].push(pr);
    return acc;
  },{} as Record<string,typeof topPRs>);

  // Body/wellness
  const firstW=weightLogs[0]?.weight_lbs;
  const lastW=weightLogs[weightLogs.length-1]?.weight_lbs;
  const wDelta=firstW&&lastW?Number((lastW-firstW).toFixed(1)):null;

  // Per-wellness-discipline stats — same treatment as cardio breakdown.
  // For each activity type tracks: count, total mins, avg mins, longest
  // single session, last logged date.
  const wellnessByType = (() => {
    type Bucket = { count:number; totalMin:number; longest:number; lastDate:string };
    const t: Record<string, Bucket> = {};
    wellnessLogs.forEach(l => {
      const type = l.wellness_type || "Other";
      if (!t[type]) t[type] = { count: 0, totalMin: 0, longest: 0, lastDate: "" };
      const mins = parseFloat(String(l.wellness_duration_min)) || 0;
      t[type].count++;
      t[type].totalMin += mins;
      if (mins > t[type].longest) t[type].longest = mins;
      if (l.logged_at > t[type].lastDate) t[type].lastDate = l.logged_at;
    });
    return Object.entries(t)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([type, b]) => ({
        type,
        count: b.count,
        totalMin: Math.round(b.totalMin),
        avgMin: b.count > 0 ? Math.round(b.totalMin / b.count) : 0,
        longest: Math.round(b.longest),
        lastDate: b.lastDate,
      }));
  })();

  const totalWellnessMins = wellnessLogs.reduce((s, l) => s + (parseFloat(String(l.wellness_duration_min)) || 0), 0);

  // Day-of-week pattern for wellness — when do you actually take recovery
  // time? Helps users spot "I never do wellness on weekdays" patterns.
  const wellnessDayKeys = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const freqByDayWellness = wellnessDayKeys.map((day, idx) => {
    const jsDay = idx < 6 ? idx + 1 : 0;
    return {
      day,
      count: wellnessLogs.filter(l => new Date(l.logged_at).getDay() === jsDay).length,
    };
  });

  // Time-of-day breakdown — Morning (5-12), Afternoon (12-17), Evening (17-22),
  // Night (22-5). Gives users a sense of when they prioritize recovery.
  const timeOfDayBuckets = (() => {
    const b = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    wellnessLogs.forEach(l => {
      const h = new Date(l.logged_at).getHours();
      if (h >= 5 && h < 12) b.morning++;
      else if (h >= 12 && h < 17) b.afternoon++;
      else if (h >= 17 && h < 22) b.evening++;
      else b.night++;
    });
    return b;
  })();

  // Wellness streak — consecutive days with at least one wellness log.
  // Both current (running back from today) and longest in the data.
  const wellnessStreak = (() => {
    if (wellnessLogs.length === 0) return { current: 0, longest: 0 };
    // Set of YYYY-MM-DD strings for unique wellness days.
    const days = new Set<string>();
    wellnessLogs.forEach(l => {
      days.add(new Date(l.logged_at).toISOString().slice(0, 10));
    });
    // Sort ascending so we can scan for consecutive runs.
    const sorted = Array.from(days).sort();
    let longest = 0;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + "T00:00:00").getTime();
      const cur = new Date(sorted[i] + "T00:00:00").getTime();
      if (cur - prev === 86400000) run++;
      else {
        if (run > longest) longest = run;
        run = 1;
      }
    }
    if (run > longest) longest = run;
    // Current streak: starting from today going backwards.
    let current = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) current++;
      else if (i === 0) {
        // Today not logged yet — check if yesterday was, that still counts as
        // an active streak of 0 today but "1 day ago" if yesterday was.
        // Don't break, just continue to count yesterday-onward.
        continue;
      } else break;
    }
    return { current, longest };
  })();

  // Wellness consistency — % of days in the selected range that had at
  // least one wellness session. Caps at the actual elapsed days for the
  // current period (so 1M doesn't say "5%" on May 3rd).
  const wellnessConsistency = (() => {
    const start = new Date(sinceTs);
    const today = new Date();
    const elapsedDays = Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1);
    const days = new Set<string>();
    wellnessLogs.forEach(l => {
      days.add(new Date(l.logged_at).toISOString().slice(0, 10));
    });
    return Math.round((days.size / elapsedDays) * 100);
  })();

  const activeDaysWellness = (() => {
    const days = new Set<string>();
    wellnessLogs.forEach(l => {
      days.add(new Date(l.logged_at).toISOString().slice(0, 10));
    });
    return days.size;
  })();

  // Activity mix radar — top 6 wellness types by session count, used as
  // input for a recharts RadarChart so the user can see which disciplines
  // they're heavy on vs neglecting.
  const wellnessRadar = wellnessByType.slice(0, 6).map(w => ({
    activity: w.type,
    sessions: w.count,
  }));

  const avgSleepHours = 0; // would need wellness_data column

  // Emoji helper for wellness types — falls back to leaf for unknowns.
  const wellnessEmoji = (raw: string): string => {
    const s = (raw || "").toLowerCase();
    if (s.includes("cold") || s.includes("plunge") || s.includes("ice")) return "🧊";
    if (s.includes("sauna") || s.includes("hot")) return "🔥";
    if (s.includes("yoga")) return "🧘";
    if (s.includes("med")) return "🕯️";
    if (s.includes("stretch") || s.includes("mobility")) return "🤸";
    if (s.includes("massage")) return "💆";
    if (s.includes("breath")) return "🌬️";
    if (s.includes("walk")) return "🚶";
    if (s.includes("nap") || s.includes("sleep")) return "😴";
    if (s.includes("foam")) return "🛞";
    return "🌿";
  };

  if(!user) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:C.sub}}>Sign in to view your stats</div>
    </div>
  );

  const TABS:{key:Tab;icon:string;label:string}[]=[
    {key:"today",icon:"☀️",label:"Today"},
    {key:"workout",icon:"💪",label:"Workout"},
    {key:"nutrition",icon:"🥗",label:"Nutrition"},
    {key:"body",icon:"⚖️",label:"Body"},
    {key:"prs",icon:"🏆",label:"PRs"},
  ];

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,paddingBottom:100}}>

      {/* Sticky header */}
      <div style={{position:"sticky",top:0,zIndex:50,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(14px)",borderBottom:`1px solid ${C.border}`,padding:"14px 18px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontWeight:900,fontSize:21,color:C.text}}>📊 Stats</div>
          {tab!=="today"&&tab!=="prs"&&(
            <div style={{display:"flex",gap:4}}>
              {(["1W","1M","1Y"] as Range[]).map(r=>(
                <button key={r} onClick={()=>setRange(r)} style={{
                  padding:"4px 9px",borderRadius:20,border:`1px solid ${range===r?C.purple:C.border}`,
                  background:range===r?C.purple:"transparent",
                  color:range===r?"#fff":C.sub,fontWeight:700,fontSize:10,cursor:"pointer",
                }}>{r}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:0,overflowX:"auto",scrollbarWidth:"none"}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{
              flexShrink:0,padding:"9px 14px",border:"none",background:"transparent",
              fontWeight:700,fontSize:12,cursor:"pointer",
              color:tab===t.key?C.purple:C.sub,
              borderBottom:tab===t.key?`2px solid ${C.purple}`:"2px solid transparent",
              whiteSpace:"nowrap",
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"18px 16px",maxWidth:720,margin:"0 auto"}}>
        {loading?(
          <div>
            <style jsx global>{`
              @keyframes statsSkeletonShimmer {
                0%   { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            `}</style>
            {/* Goals card placeholder */}
            <div style={{
              height: 180,
              borderRadius: 18,
              marginBottom: 16,
              background: "linear-gradient(90deg, #1A1230 0%, #2D1F52 50%, #1A1230 100%)",
              backgroundSize: "200% 100%",
              animation: "statsSkeletonShimmer 1.4s ease-in-out infinite",
            }} />
            {/* Activity rows */}
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                height: 110,
                borderRadius: 16,
                marginBottom: 14,
                background: "linear-gradient(90deg, #1A1230 0%, #2D1F52 50%, #1A1230 100%)",
                backgroundSize: "200% 100%",
                animation: "statsSkeletonShimmer 1.4s ease-in-out infinite",
              }} />
            ))}
          </div>
        ):(<>

          {/* ═══════════════════════════════════════════════ TODAY ══ */}
          {tab==="today"&&(<>
            {/* Monthly Nutrition Goals */}
            <div style={{background:`linear-gradient(135deg,${C.purpleDim},#1A0F30)`,borderRadius:18,
              padding:"18px 20px",border:`1px solid ${C.purpleBorder}`,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div style={{fontSize:11,color:C.subLight,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:1}}>
                    🥗 Nutrition — {new Date().toLocaleString("default",{month:"long"})}
                  </div>
                  <div style={{fontSize:12,color:C.sub,marginTop:2}}>
                    Day {new Date().getDate()} of {new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()}
                    {nutritionLogs.filter((l:any)=>{const d=new Date(l.logged_at);return d.getMonth()===new Date().getMonth()&&d.getFullYear()===new Date().getFullYear();}).length > 0
                      ? ` · ${nutritionLogs.filter((l:any)=>{const d=new Date(l.logged_at);return d.getMonth()===new Date().getMonth()&&d.getFullYear()===new Date().getFullYear();}).length} days logged`
                      : ""}
                  </div>
                </div>
                <div style={{fontSize:36}}>🥗</div>
              </div>

              {/* TODAY */}
              <div style={{marginBottom:14,padding:"12px 14px",background:"rgba(255,255,255,0.04)",borderRadius:12}}>
                <div style={{fontSize:10,fontWeight:800,color:C.subLight,textTransform:"uppercase" as const,letterSpacing:1,marginBottom:10}}>Today</div>
                {[
                  {label:"🔥 Calories",current:Math.round(todayNut?.calories||0),goal:goals?.calories||2000,unit:"kcal",color:C.gold},
                  {label:"🥩 Protein",current:Math.round(todayNut?.protein||0),goal:goals?.protein||150,unit:"g",color:"#34D399"},
                ].map(({label,current,goal,unit,color})=>{
                  const pct=Math.min(100,Math.round((current/goal)*100));
                  return (
                    <div key={label} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                        <span style={{color:C.sub}}>{label}</span>
                        <span style={{fontWeight:800,color:pct>=100?"#4ADE80":C.text}}>
                          {current.toLocaleString()} / {goal.toLocaleString()} {unit}
                          {pct>=100&&<span style={{marginLeft:6,fontSize:10}}>✓</span>}
                        </span>
                      </div>
                      <div style={{height:7,background:"rgba(255,255,255,0.08)",borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,borderRadius:99,transition:"width 0.6s",
                          background:pct>=100?"#4ADE80":color}}/>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* THIS MONTH */}
              {(()=>{
                const now=new Date();
                const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
                const monthLogs=nutritionLogs.filter((l:any)=>{const d=new Date(l.logged_at);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
                const monthCals=Math.round(monthLogs.reduce((s:number,l:any)=>s+(l.calories_total||0),0));
                const monthProt=Math.round(monthLogs.reduce((s:number,l:any)=>s+(l.protein_g||0),0));
                const calGoal=(goals?.calories||2000)*daysInMonth;
                const protGoal=(goals?.protein||150)*daysInMonth;
                const calPct=Math.min(100,Math.round((monthCals/calGoal)*100));
                const protPct=Math.min(100,Math.round((monthProt/protGoal)*100));
                return (
                  <div>
                    <div style={{fontSize:10,fontWeight:800,color:C.subLight,textTransform:"uppercase" as const,letterSpacing:1,marginBottom:10}}>This Month</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                      {[
                        {label:"🔥 Calories",current:monthCals,goal:calGoal,pct:calPct,unit:"kcal",color:C.gold},
                        {label:"🥩 Protein",current:monthProt,goal:protGoal,pct:protPct,unit:"g",color:"#34D399"},
                      ].map(({label,current,goal,pct,unit,color})=>(
                        <div key={label} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 12px"}}>
                          <div style={{fontSize:11,color:C.sub,marginBottom:6}}>{label}</div>
                          <div style={{fontSize:18,fontWeight:900,color:pct>=100?"#4ADE80":C.text,marginBottom:2}}>
                            {pct}%
                          </div>
                          <div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                            <div style={{height:"100%",width:`${pct}%`,background:pct>=100?"#4ADE80":color,borderRadius:99}}/>
                          </div>
                          <div style={{fontSize:10,color:C.sub}}>
                            {current.toLocaleString()} / {goal.toLocaleString()} {unit}
                          </div>
                          <div style={{fontSize:10,color:C.sub,marginTop:2}}>
                            Daily goal: {(goals?.calories||2000).toLocaleString()} {unit === "kcal" ? "kcal" : `${goals?.protein||150}g`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Today's workouts (all of them) */}
            <SecHead title="Today's Workouts"/>
            {todayWorkouts.length>0?(
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                {todayWorkouts.map((wo:any,i:number)=>(
                  <div key={i} style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:Array.isArray(wo.exercises)&&wo.exercises.length>0?12:0}}>
                      <div>
                        <div style={{fontWeight:800,fontSize:16,color:C.text}}>{wo.workout_type||"Workout"}</div>
                        <div style={{fontSize:12,color:C.sub,marginTop:3,display:"flex",gap:12}}>
                          {wo.workout_duration_min&&<span>⏱ {wo.workout_duration_min} min</span>}
                          {wo.workout_calories>0&&<span>🔥 {wo.workout_calories} cal</span>}
                          {Array.isArray(wo.exercises)&&wo.exercises.length>0&&<span>💪 {wo.exercises.length} exercises</span>}
                        </div>
                      </div>
                      <div style={{fontSize:28}}>💪</div>
                    </div>
                    {Array.isArray(wo.exercises)&&wo.exercises.length>0&&(
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {wo.exercises.map((ex:any,j:number)=>(
                          <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:C.bg,borderRadius:8}}>
                            <span style={{fontSize:13,color:C.text,fontWeight:600}}>{ex.name}</span>
                            <span style={{fontSize:12,color:C.sub}}>{ex.sets}×{ex.reps} @ {ex.weight} lbs</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ):(
              <div style={{background:C.card,borderRadius:14,padding:"18px 16px",border:`1px solid ${C.border}`,marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
                <div style={{fontSize:28}}>😴</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:C.text}}>No workout logged today</div>
                  <button onClick={()=>router.push("/post")} style={{fontSize:12,color:C.purple,fontWeight:700,background:"none",border:"none",cursor:"pointer",padding:0,marginTop:4}}>+ Log a workout →</button>
                </div>
              </div>
            )}

            {/* Today's cardio */}
            {todayCardio.length>0&&(<>
              <SecHead title="Today's Cardio"/>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {todayCardio.map((c:any,i:number)=>(
                  <div key={i} style={{background:C.card,borderRadius:12,padding:"12px 16px",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:C.text}}>{c.type||"Cardio"}</div>
                      <div style={{fontSize:12,color:C.sub,marginTop:2,display:"flex",gap:10}}>
                        {c.duration&&<span>⏱ {c.duration} min</span>}
                        {c.distance&&<span>📏 {c.distance} mi</span>}
                      </div>
                    </div>
                    <div style={{fontSize:24}}>🏃</div>
                  </div>
                ))}
              </div>
            </>)}

            {/* Today's wellness */}
            {todayWellness.length>0&&(<>
              <SecHead title="Today's Wellness"/>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {todayWellness.map((w:any,i:number)=>(
                  <div key={i} style={{background:C.card,borderRadius:12,padding:"12px 16px",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:C.text}}>{w.wellness_type||"Wellness"}</div>
                      <div style={{fontSize:12,color:C.sub,marginTop:2,display:"flex",gap:10}}>
                        {w.wellness_duration_min&&<span>⏱ {w.wellness_duration_min} min</span>}
                        {w.notes&&<span style={{color:C.subLight,fontStyle:"italic"}}>"{w.notes}"</span>}
                      </div>
                    </div>
                    <div style={{fontSize:24}}>🌿</div>
                  </div>
                ))}
              </div>
            </>)}

            {/* Body weight */}
            <SecHead title="Body Weight"/>
            <div style={{background:C.card,borderRadius:14,padding:"14px 16px",border:`1px solid ${C.border}`,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:11,color:C.sub,fontWeight:600,marginBottom:4}}>LAST RECORDED</div>
                <div style={{fontSize:28,fontWeight:900,color:C.cyan}}>{latestWeight?`${latestWeight} lbs`:"—"}</div>
              </div>
              <button onClick={()=>setShowWeightModal(true)} style={{fontSize:12,color:C.purple,fontWeight:700,background:C.purpleDim,border:`1px solid ${C.purpleBorder}`,borderRadius:10,padding:"7px 14px",cursor:"pointer"}}>+ Log Weight</button>
            </div>

            {/* Today's nutrition */}
            <SecHead title="Today's Nutrition"/>
            {!goals?(
              <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:4}}>
                <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>No goals set yet</div>
                <div style={{fontSize:12,color:C.sub,marginBottom:12}}>Set your calorie and macro targets to track daily progress.</div>
                <button onClick={()=>{setTab("nutrition");setTimeout(()=>setShowGoalEditor(true),100);}} style={{padding:"8px 16px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>⚙️ Set Goals</button>
              </div>
            ):(
              <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:4}}>
                {todayNut?(<>
                  <MacroRow label="🔥 Calories" current={Math.round(todayNut.calories)} goal={goals.calories} color={C.gold} unit=" kcal"/>
                  <MacroRow label="🥩 Protein"  current={Math.round(todayNut.protein)}  goal={goals.protein}  color={C.green} unit="g"/>
                  <MacroRow label="🍞 Carbs"    current={Math.round(todayNut.carbs)}    goal={goals.carbs}    color={C.purple} unit="g"/>
                  <MacroRow label="🥑 Fat"      current={Math.round(todayNut.fat)}      goal={goals.fat}      color={C.gold} unit="g"/>
                  {goals.water_oz>0&&<MacroRow label="💧 Water" current={Math.round(todayNut.water_oz)} goal={goals.water_oz} color={C.cyan} unit=" oz"/>}
                </>):(
                  <div style={{textAlign:"center",padding:"12px 0"}}>
                    <div style={{fontSize:24,marginBottom:8}}>🥗</div>
                    <div style={{fontSize:14,color:C.subLight,fontWeight:700,marginBottom:4}}>Nothing logged yet today</div>
                    <div style={{fontSize:12,color:C.sub,marginBottom:12}}>Goal: {goals.calories.toLocaleString()} kcal · {goals.protein}g protein · {goals.carbs}g carbs · {goals.fat}g fat</div>
                    <button onClick={()=>router.push("/post")} style={{padding:"7px 16px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>+ Log Nutrition</button>
                  </div>
                )}
              </div>
            )}
          </>)}

          {/* ═══════════════════════════════════════════ WORKOUT ══ */}
          {tab==="workout"&&(<>
            {/* Hero stats — no streak (inaccurate), focus on real numbers */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <BigNum icon="💪" label="Total Sessions" value={totalWorkouts} sub={rangeLabel(range)} color={C.purple}/>
              <BigNum icon="📅" label="Avg / Active Week" value={avgPerWeek} sub="workouts per week trained" color={C.gold}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
              <MiniNum label="Avg Duration" value={avgDuration>0?`${avgDuration}m`:"—"} color={C.cyan}/>
              <MiniNum label="Fav Day" value={favDay} color={C.gold}/>
              <MiniNum label="Cal Burned" value={totalCalBurned>0?`${(totalCalBurned/1000).toFixed(1)}k`:"—"} color={C.red}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:24}}>
              <MiniNum label="🏋️ Lifting Sessions" value={liftingSessions} color={C.purple}/>
              <MiniNum label="🏃 Cardio Sessions" value={cardioSessions} color={C.cyan}/>
            </div>

            {/* Weekly Frequency Chart */}
            <SecHead title="Workouts Per Week (12 Weeks)"/>
            <div style={{background:C.card,borderRadius:14,padding:"16px 16px 12px",border:`1px solid ${C.border}`,marginBottom:20}}>
              {allWorkoutDates.length>0?(()=>{
                const now = new Date();
                const weeks: {label:string; monthLabel:string; count:number; isNewMonth:boolean}[] = [];
                let lastMonth = -1;
                for(let i=11; i>=0; i--) {
                  const wStart = new Date(now);
                  wStart.setDate(now.getDate() - now.getDay() - i*7);
                  wStart.setHours(0,0,0,0);
                  const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate()+7);
                  const count = allWorkoutDates.filter(d=>{const dt=new Date(d);return dt>=wStart&&dt<wEnd;}).length;
                  const mo = wStart.getMonth();
                  const isNewMonth = mo !== lastMonth;
                  if(isNewMonth) lastMonth = mo;
                  weeks.push({
                    label: `${wStart.toLocaleString("default",{month:"short"})} ${wStart.getDate()}`,
                    monthLabel: wStart.toLocaleString("default",{month:"short"}),
                    count, isNewMonth
                  });
                }
                const maxCount = Math.max(...weeks.map(w=>w.count), 1);
                // Y-axis ticks
                const yTicks = [0,1,2,3,4,5].filter(v=>v<=maxCount+1).slice(0,5);

                return (
                  <div>
                    {/* Chart area */}
                    <div style={{display:"flex",gap:8}}>
                      {/* Y axis */}
                      <div style={{display:"flex",flexDirection:"column" as const,justifyContent:"space-between",
                        height:100,paddingBottom:2,flexShrink:0}}>
                        {[...yTicks].reverse().map(v=>(
                          <div key={v} style={{fontSize:9,color:C.sub,textAlign:"right" as const,lineHeight:1}}>{v}</div>
                        ))}
                      </div>
                      {/* Bars */}
                      <div style={{flex:1,position:"relative" as const}}>
                        {/* Grid lines */}
                        <div style={{position:"absolute" as const,inset:0,display:"flex",
                          flexDirection:"column" as const,justifyContent:"space-between",pointerEvents:"none" as const}}>
                          {yTicks.map(v=>(
                            <div key={v} style={{width:"100%",height:1,background:"rgba(255,255,255,0.05)"}}/>
                          ))}
                        </div>
                        {/* Bars row */}
                        <div style={{display:"flex",alignItems:"flex-end",gap:4,height:100}}>
                          {weeks.map((w,i)=>{
                            const isCurrent = i===11;
                            const barH = w.count===0 ? 4 : Math.max(8, Math.round((w.count/maxCount)*92));
                            return (
                              <div key={i} title={`${w.label}: ${w.count} workout${w.count!==1?"s":""}`}
                                style={{flex:1,display:"flex",flexDirection:"column" as const,
                                  alignItems:"center",height:"100%",justifyContent:"flex-end",gap:2,
                                  cursor:"default"}}>
                                {/* Count label above bar */}
                                {w.count>0&&(
                                  <div style={{fontSize:9,fontWeight:800,
                                    color:isCurrent?C.purple:"rgba(255,255,255,0.5)",
                                    lineHeight:1}}>
                                    {w.count}
                                  </div>
                                )}
                                <div style={{
                                  width:"100%",height:`${barH}px`,borderRadius:"3px 3px 0 0",
                                  background: w.count===0
                                    ? "rgba(255,255,255,0.05)"
                                    : isCurrent
                                    ? C.purple
                                    : `${C.purple}88`,
                                  border: isCurrent&&w.count>0 ? `1px solid ${C.purple}` : "none",
                                  boxShadow: isCurrent&&w.count>0 ? `0 0 8px ${C.purple}55` : "none",
                                }}/>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* X axis — month labels */}
                    <div style={{display:"flex",gap:4,marginLeft:24,marginTop:4}}>
                      {weeks.map((w,i)=>(
                        <div key={i} style={{flex:1,textAlign:"center" as const}}>
                          {w.isNewMonth&&(
                            <div style={{fontSize:9,color:C.sub,fontWeight:600,overflow:"hidden",whiteSpace:"nowrap" as const}}>
                              {w.monthLabel}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Current week callout */}
                    <div style={{marginTop:10,padding:"8px 12px",background:"rgba(124,58,237,0.08)",
                      borderRadius:8,border:`1px solid ${C.purpleBorder}`,
                      display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,color:C.sub}}>
                        📅 This week: <strong style={{color:C.purple}}>{weeks[11].count} workout{weeks[11].count!==1?"s":""}</strong>
                      </span>
                      <span style={{fontSize:12,color:C.sub}}>
                        12-wk avg: <strong style={{color:C.text}}>{(weeks.reduce((s,w)=>s+w.count,0)/12).toFixed(1)}/wk</strong>
                      </span>
                      <span style={{fontSize:12,color:C.sub}}>
                        Best: <strong style={{color:C.gold}}>{Math.max(...weeks.map(w=>w.count))}</strong>
                      </span>
                    </div>
                  </div>
                );
              })():<div style={{color:C.sub,fontSize:13,textAlign:"center" as const,padding:"20px 0"}}>No workouts logged yet</div>}
            </div>



            {/* This week detail — rich cards */}
            {thisWeekLogs.length>0&&(<>
              <SecHead title="This Week's Sessions"/>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {thisWeekLogs.map((l:any,i:number)=>{
                  const exs=Array.isArray(l.exercises)?l.exercises:[];
                  const cardios=Array.isArray(l.cardio)?l.cardio:[];
                  const vol=calcVol(exs);
                  // Primary muscle group from sets distribution
                  const mc:Record<string,number>={};
                  exs.forEach((ex:any)=>{const m=getMuscle(ex.name||"");mc[m]=(mc[m]||0)+(parseInt(String(ex.sets))||1);});
                  const muscle=Object.entries(mc).sort((a,b)=>b[1]-a[1])[0]?.[0]||"";
                  const color=MUSCLE_COLORS[muscle]||C.sub;
                  // Top exercises by volume
                  const topExs=[...exs].sort((a:any,b:any)=>(parseFloat(String(b.weight))||0)-(parseFloat(String(a.weight))||0)).slice(0,3);
                  return(
                    <div key={i} style={{background:C.card,borderRadius:14,padding:"14px 16px",border:`1px solid ${muscle?color:C.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:exs.length>0||cardios.length>0?10:0}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{fontWeight:800,fontSize:14,color:C.text}}>{l.workout_type||"Workout"}</div>
                            {muscle&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:`${color}22`,color}}>{muscle}</span>}
                          </div>
                          <div style={{fontSize:11,color:C.sub,marginTop:3,display:"flex",gap:10,flexWrap:"wrap"}}>
                            <span>{fmtDay(l.logged_at)}</span>
                            {l.workout_duration_min&&<span>⏱ {l.workout_duration_min} min</span>}
                            {l.workout_calories>0&&<span>🔥 {l.workout_calories} cal</span>}
                            {exs.length>0&&<span>💪 {exs.length} exercise{exs.length!==1?"s":""}</span>}
                            {cardios.length>0&&<span>🏃 {cardios.length} cardio</span>}
                          </div>
                        </div>
                        {vol>0&&<div style={{fontSize:13,fontWeight:900,color:C.gold,flexShrink:0}}>{vol>=1000?`${(vol/1000).toFixed(1)}k`:vol.toFixed(0)}<span style={{fontSize:10,fontWeight:400,color:C.sub}}> lbs</span></div>}
                      </div>
                      {/* Top exercises */}
                      {topExs.length>0&&(
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          {topExs.map((ex:any,j:number)=>(
                            <div key={j} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:C.bg,borderRadius:7}}>
                              <span style={{fontSize:12,color:C.subLight}}>{ex.name}</span>
                              <span style={{fontSize:12,fontWeight:700,color:C.gold}}>{ex.sets}×{ex.reps} @ {ex.weight} lbs</span>
                            </div>
                          ))}
                          {exs.length>3&&<div style={{fontSize:11,color:C.sub,textAlign:"center",paddingTop:2}}>+{exs.length-3} more exercises</div>}
                        </div>
                      )}
                      {/* Cardio details */}
                      {cardios.length>0&&(
                        <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:topExs.length>0?6:0}}>
                          {cardios.map((c:any,j:number)=>(
                            <div key={j} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:C.bg,borderRadius:7}}>
                              <span style={{fontSize:12,color:C.subLight}}>{normalizeCardio(c.type||"Cardio")}</span>
                              <span style={{fontSize:12,fontWeight:700,color:C.cyan}}>
                                {c.distance?`${c.distance} mi`:""}{c.distance&&c.duration?" · ":""}{c.duration?`${c.duration} min`:""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>)}



            {/* Training days — split by discipline. Lifting and cardio
                often have totally different weekly patterns (lift Mon/Wed/Fri,
                run Tue/Thu/Sat) so combining them muddies the picture.
                Charts are stacked vertically on mobile, side-by-side on
                wider screens via grid auto-fit. */}
            <SecHead title="Training by Day of Week"/>
            {workoutLogs.length>0?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:10,marginBottom:20}}>
                <ChartWrap>
                  <div style={{fontSize:11,fontWeight:800,color:C.purple,padding:"4px 8px 8px",textTransform:"uppercase",letterSpacing:0.8}}>🏋️ Lifting</div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={freqByDayLift} margin={{top:4,right:8,left:-16,bottom:0}}>
                      <XAxis dataKey="day" tick={{fontSize:11,fill:C.sub}}/>
                      <YAxis tick={{fontSize:10,fill:C.sub}} allowDecimals={false}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="count" name="Sessions" fill={C.purple} radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrap>
                <ChartWrap>
                  <div style={{fontSize:11,fontWeight:800,color:C.cyan,padding:"4px 8px 8px",textTransform:"uppercase",letterSpacing:0.8}}>🏃 Cardio</div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={freqByDayCardio} margin={{top:4,right:8,left:-16,bottom:0}}>
                      <XAxis dataKey="day" tick={{fontSize:11,fill:C.sub}}/>
                      <YAxis tick={{fontSize:10,fill:C.sub}} allowDecimals={false}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="count" name="Sessions" fill={C.cyan} radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrap>
              </div>
            ):<Empty icon="📅" text="Log workouts to see training patterns"/>}

            {/* Cardio breakdown — one card per discipline. Each card shows
                sessions, total distance, total time, longest, avg pace. The
                cards expand horizontally on wider screens. */}
            {cardioSessions>0&&(<>
              <SecHead title="Cardio Breakdown"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                <MiniNum label="Sessions" value={cardioSessions} color={C.cyan}/>
                <MiniNum label="Total Time" value={totalCardioMin>60?`${(totalCardioMin/60).toFixed(1)}h`:`${Math.round(totalCardioMin)}m`} color={C.green}/>
                <MiniNum label="Total Distance" value={totalCardioMiles>0?`${totalCardioMiles.toFixed(1)} mi`:"—"} color={C.gold}/>
              </div>
              {cardioTypes.length>0 && (
                <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,marginBottom:20}}>
                  {cardioTypes.map(c=>(
                    <div key={c.type} style={{background:C.card,borderRadius:14,padding:14,border:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:20}}>{cardioEmoji(c.type)}</span>
                          <span style={{fontWeight:800,fontSize:14,color:C.text}}>{c.type}</span>
                        </div>
                        <span style={{fontSize:12,fontWeight:700,color:C.cyan,background:"rgba(34,211,238,0.12)",padding:"3px 9px",borderRadius:99}}>
                          {c.count}× sessions
                        </span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11}}>
                        <div>
                          <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,marginBottom:2}}>Total</div>
                          <div style={{color:C.text,fontWeight:800,fontSize:13}}>
                            {c.totalDist > 0 ? `${c.totalDist} mi` : `${c.totalDur}m`}
                          </div>
                        </div>
                        <div>
                          <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,marginBottom:2}}>Avg Pace</div>
                          <div style={{color:C.green,fontWeight:800,fontSize:13}}>{c.paceStr}</div>
                        </div>
                        <div>
                          <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,marginBottom:2}}>Longest</div>
                          <div style={{color:C.gold,fontWeight:800,fontSize:13}}>
                            {c.longest > 0 ? `${c.longest} mi` : "—"}
                          </div>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                        <div>
                          <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,marginBottom:2}}>Avg Distance</div>
                          <div style={{color:C.text,fontWeight:700,fontSize:12}}>{c.avgDist > 0 ? `${c.avgDist} mi` : "—"}</div>
                        </div>
                        <div>
                          <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,marginBottom:2}}>Avg Duration</div>
                          <div style={{color:C.text,fontWeight:700,fontSize:12}}>{c.avgDur > 0 ? `${c.avgDur} min` : "—"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {/* Muscle group breakdown — each group is an expandable card.
                Tap to reveal a per-exercise breakdown showing total sets,
                max weight (your PR for that lift in the range), and total
                volume. Sorted by volume so heaviest lifts surface first. */}
            <SecHead title="Muscle Group Focus"/>
            {muscleGroups.length>0?(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                {muscleGroups.map(({name,value})=>{
                  const isOpen = !!expandedMuscle[name];
                  const details = muscleGroupDetails[name] || [];
                  return (
                    <div key={name} style={{background:C.card,borderRadius:14,padding:14,border:`1px solid ${isOpen?(MUSCLE_COLORS[name]||C.purple):C.border}`,transition:"border-color 0.15s"}}>
                      <button
                        onClick={()=>setExpandedMuscle(p=>({...p,[name]:!p[name]}))}
                        style={{
                          background:"transparent",border:"none",padding:0,width:"100%",
                          display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",
                        }}
                      >
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:12,color:C.sub,transform:isOpen?"rotate(90deg)":"rotate(0)",transition:"transform 0.15s"}}>▶</span>
                          <span style={{fontSize:14,fontWeight:800,color:C.text}}>{name}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:11,color:C.sub}}>{details.length} {details.length===1?"exercise":"exercises"}</span>
                          <span style={{fontSize:12,fontWeight:800,color:MUSCLE_COLORS[name]||C.sub,background:`${MUSCLE_COLORS[name]||C.purple}22`,padding:"3px 9px",borderRadius:99}}>
                            {value} sets
                          </span>
                        </div>
                      </button>
                      {/* Progress bar visible when collapsed for at-a-glance volume comparison */}
                      {!isOpen && (
                        <div style={{marginTop:10}}>
                          <ProgBar value={value} max={muscleGroups[0].value} color={MUSCLE_COLORS[name]||C.sub}/>
                        </div>
                      )}
                      {/* Expanded: per-exercise list */}
                      {isOpen && details.length > 0 && (
                        <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
                          <div style={{display:"grid",gridTemplateColumns:"1.5fr 60px 80px 80px",gap:6,padding:"0 4px",fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:0.6}}>
                            <div>Exercise</div>
                            <div style={{textAlign:"center"}}>Sets</div>
                            <div style={{textAlign:"right"}}>Max</div>
                            <div style={{textAlign:"right"}}>Volume</div>
                          </div>
                          {details.slice(0,15).map(d=>(
                            <div key={d.name} style={{display:"grid",gridTemplateColumns:"1.5fr 60px 80px 80px",gap:6,padding:"8px 4px",borderTop:`1px solid ${C.border}`,fontSize:12,alignItems:"center"}}>
                              <div style={{color:C.text,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</div>
                              <div style={{textAlign:"center",color:C.purple,fontWeight:700}}>{d.sets}</div>
                              <div style={{textAlign:"right",color:C.gold,fontWeight:800}}>{d.maxWeight>0?`${d.maxWeight} lbs`:"—"}</div>
                              <div style={{textAlign:"right",color:C.text,fontWeight:700,fontSize:11}}>
                                {d.totalVolume > 0 ? (d.totalVolume>=1000?`${(d.totalVolume/1000).toFixed(1)}k`:d.totalVolume) : "—"}
                              </div>
                            </div>
                          ))}
                          {details.length > 15 && (
                            <div style={{padding:"6px 4px",fontSize:11,color:C.sub,textAlign:"center",fontStyle:"italic"}}>+{details.length - 15} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ):<Empty icon="💪" text="Log exercises to see muscle group breakdown"/>}

            {/* Muscle radar */}
            {muscleRadar.some(m=>m.sessions>0)&&(<>
              <SecHead title="Training Balance Radar"/>
              <ChartWrap>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={muscleRadar} margin={{top:10,right:20,left:20,bottom:10}}>
                    <PolarGrid stroke={C.border}/>
                    <PolarAngleAxis dataKey="group" tick={{fontSize:11,fill:C.subLight}}/>
                    <Radar dataKey="sessions" stroke={C.purple} fill={C.purple} fillOpacity={0.25} strokeWidth={2.5} dot={{fill:C.purple,r:3}}/>
                  </RadarChart>
                </ResponsiveContainer>
              </ChartWrap>
              <div style={{fontSize:11,color:C.sub,textAlign:"center",marginTop:6}}>Bigger = more sessions training that muscle group</div>
            </>)}

            {/* ── 🏃 RUNNING DEEP DIVE ─────────────────────────────────────────── */}
            {runStats.sessions>0&&(<>
              <div style={{marginTop:32,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:120}}>
                  <div style={{height:1,flex:1,background:C.border}}/>
                  <div style={{fontWeight:900,fontSize:16,color:C.cyan}}>🏃 Running</div>
                  <div style={{height:1,flex:1,background:C.border}}/>
                </div>
                {/* Inline range pills — same global filter as the top-right
                    pills but placed here for easy access while reading the
                    Running section. Updates the same `range` state, so any
                    pill on the page stays in sync. */}
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  {(["1W","1M","1Y"] as Range[]).map(r=>(
                    <button key={r} onClick={()=>setRange(r)} style={{
                      padding:"4px 9px",borderRadius:20,border:`1px solid ${range===r?C.cyan:C.border}`,
                      background:range===r?C.cyan:"transparent",
                      color:range===r?"#fff":C.sub,fontWeight:700,fontSize:10,cursor:"pointer",
                    }}>{r}</button>
                  ))}
                </div>
              </div>

              {/* Key run stats */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <BigNum icon="📏" label="Total Distance" value={`${runStats.totalMiles} mi`} sub={`${rangeLabel(range)}`} color={C.cyan}/>
                <BigNum icon="⚡" label="Avg Pace" value={runPaceStr} sub="per mile" color={C.green}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                <MiniNum label="Sessions" value={runStats.sessions} color={C.cyan}/>
                <MiniNum label="Avg Distance" value={runStats.avgMiles>0?`${runStats.avgMiles} mi`:"—"} color={C.text}/>
                <MiniNum label="Avg Duration" value={runStats.avgMin>0?`${runStats.avgMin} min`:"—"} color={C.text}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
                <MiniNum label="🏆 Longest Run" value={runStats.longestRun>0?`${runStats.longestRun} mi`:"—"} color={C.gold}/>
                <MiniNum label="Total Time" value={runStats.totalMin>60?`${(runStats.totalMin/60).toFixed(1)}h`:`${Math.round(runStats.totalMin)} min`} color={C.subLight}/>
              </div>

              {/* Weekly distance chart */}
              {weeklyRunDist.length>1&&(<>
                <SecHead title="Weekly Run Distance (mi)"/>
                <ChartWrap>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={weeklyRunDist} margin={{top:4,right:8,left:-16,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                      <XAxis dataKey="week" tick={{fontSize:9,fill:C.sub}}/>
                      <YAxis tick={{fontSize:9,fill:C.sub}}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="miles" name="Miles" fill={C.cyan} radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrap>
              </>)}
            </>)}

            {/* ── 🏋️ LIFTING DEEP DIVE ─────────────────────────────────────────── */}
            {liftStats.sessions>0&&(<>
              <div style={{marginTop:32,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:120}}>
                  <div style={{height:1,flex:1,background:C.border}}/>
                  <div style={{fontWeight:900,fontSize:16,color:C.purple}}>🏋️ Lifting</div>
                  <div style={{height:1,flex:1,background:C.border}}/>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  {(["1W","1M","1Y"] as Range[]).map(r=>(
                    <button key={r} onClick={()=>setRange(r)} style={{
                      padding:"4px 9px",borderRadius:20,border:`1px solid ${range===r?C.purple:C.border}`,
                      background:range===r?C.purple:"transparent",
                      color:range===r?"#fff":C.sub,fontWeight:700,fontSize:10,cursor:"pointer",
                    }}>{r}</button>
                  ))}
                </div>
              </div>

              {/* Key lift stats */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <BigNum icon="📦" label="Total Volume" value={liftStats.totalVolume>0?`${(liftStats.totalVolume/1000).toFixed(1)}k lbs`:"—"} sub={rangeLabel(range)} color={C.purple}/>
                <BigNum icon="📊" label="Avg Volume/Session" value={liftStats.avgVolume>0?`${(liftStats.avgVolume/1000).toFixed(1)}k lbs`:"—"} sub="per workout" color={C.gold}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                <MiniNum label="Sessions" value={liftStats.sessions} color={C.purple}/>
                <MiniNum label="Avg Duration" value={liftStats.avgDuration>0?`${liftStats.avgDuration} min`:"—"} color={C.text}/>
                <MiniNum label="Cal Burned" value={liftStats.totalCalBurned>0?`${(liftStats.totalCalBurned/1000).toFixed(1)}k`:"—"} color={C.red}/>
              </div>

              {/* Best session */}
              {liftStats.bestVolume.vol>0&&(
                <div style={{background:C.purpleDim,borderRadius:12,padding:"12px 16px",border:`1px solid ${C.purpleBorder}`,marginBottom:20}}>
                  <div style={{fontSize:11,color:C.sub,marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:700}}>🏆 Best Session in Period</div>
                  <div style={{fontWeight:800,fontSize:15,color:C.text}}>{liftStats.bestVolume.type}</div>
                  <div style={{fontSize:12,color:C.sub,marginTop:3}}>
                    {liftStats.bestVolume.date&&fmt(liftStats.bestVolume.date)} · <span style={{color:C.gold,fontWeight:700}}>{(liftStats.bestVolume.vol/1000).toFixed(1)}k lbs total volume</span>
                  </div>
                </div>
              )}

              {/* Muscle group breakdown */}
              {workoutByMuscle.length>0&&(<>
                <SecHead title="Volume by Muscle Group"/>
                <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:20}}>
                  {workoutByMuscle.map(({muscle,count,avgVol,color})=>(
                    <div key={muscle} style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:10,height:10,borderRadius:2,background:color,flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:700}}>{muscle}</span>
                        </div>
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          {avgVol>0&&<span style={{fontSize:11,color:C.sub}}>{avgVol>=1000?`${(avgVol/1000).toFixed(1)}k`:avgVol} lbs avg</span>}
                          <span style={{fontSize:12,fontWeight:700,color}}>{count}×</span>
                        </div>
                      </div>
                      <ProgBar value={count} max={workoutByMuscle[0].count} color={color}/>
                    </div>
                  ))}
                </div>
              </>)}

              {/* Weekly volume */}
              {weeklyVolume.length>1&&(<>
                <SecHead title="Weekly Volume Trend (lbs)"/>
                <ChartWrap>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={weeklyVolume} margin={{top:4,right:8,left:-16,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                      <XAxis dataKey="week" tick={{fontSize:9,fill:C.sub}}/>
                      <YAxis tick={{fontSize:9,fill:C.sub}}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="volume" name="Volume (lbs)" fill={C.purple} radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartWrap>
              </>)}
            </>)}
          </>)}

          {/* ═══════════════════════════════════════ NUTRITION ══ */}
          {tab==="nutrition"&&(<>
            {/* Goals editor */}
            <div style={{background:C.card,borderRadius:16,padding:16,border:`1px solid ${showGoalEditor?C.purple:C.border}`,marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showGoalEditor?16:0}}>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:C.text}}>⚙️ Monthly Nutrition Goals</div>
                  {!showGoalEditor&&goals&&<div style={{fontSize:12,color:C.sub,marginTop:3}}>{goals.calories.toLocaleString()} kcal · {goals.protein}g protein · {goals.carbs}g carbs · {goals.fat}g fat</div>}
                  {!showGoalEditor&&!goals&&<div style={{fontSize:12,color:C.red,marginTop:3}}>No goals set — tap Edit to add targets</div>}
                </div>
                <button onClick={()=>setShowGoalEditor(g=>!g)} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${C.borderHi}`,background:showGoalEditor?C.purple:"transparent",color:showGoalEditor?"#fff":C.sub,fontWeight:700,fontSize:12,cursor:"pointer"}}>{showGoalEditor?"Cancel":"✏️ Edit"}</button>
              </div>
              {showGoalEditor&&(<>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  {([
                    {label:"🔥 Calories (kcal)",key:"calories" as keyof NutritionGoals},
                    {label:"🥩 Protein (g)",key:"protein" as keyof NutritionGoals},
                    {label:"🍞 Carbs (g)",key:"carbs" as keyof NutritionGoals},
                    {label:"🥑 Fat (g)",key:"fat" as keyof NutritionGoals},
                    {label:"💧 Water (oz)",key:"water_oz" as keyof NutritionGoals},
                  ] as {label:string;key:keyof NutritionGoals}[]).map(({label,key})=>(
                    <div key={key}>
                      <div style={{fontSize:11,color:C.sub,marginBottom:5,fontWeight:600}}>{label}</div>
                      <input type="number" value={editGoals[key]} onChange={e=>setEditGoals(g=>({...g,[key]:Number(e.target.value)}))} style={{width:"100%",background:C.bg,border:`1px solid ${C.borderHi}`,borderRadius:10,padding:"8px 10px",fontSize:15,fontWeight:700,color:C.text,outline:"none",boxSizing:"border-box"}}/>
                    </div>
                  ))}
                </div>
                <button onClick={saveGoals} disabled={savingGoals} style={{width:"100%",padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.purple},#A78BFA)`,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}}>{savingGoals?"Saving…":"💾 Save Goals"}</button>
              </>)}
            </div>

            {/* Inline range pills divider — same global filter as the top
                pills, placed here for convenient access while reading the
                nutrition section. */}
            <div style={{marginTop:12,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:120}}>
                <div style={{height:1,flex:1,background:C.border}}/>
                <div style={{fontWeight:900,fontSize:16,color:C.gold}}>🥗 Nutrition</div>
                <div style={{height:1,flex:1,background:C.border}}/>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                {(["1W","1M","1Y"] as Range[]).map(r=>(
                  <button key={r} onClick={()=>setRange(r)} style={{
                    padding:"4px 9px",borderRadius:20,border:`1px solid ${range===r?C.gold:C.border}`,
                    background:range===r?C.gold:"transparent",
                    color:range===r?"#fff":C.sub,fontWeight:700,fontSize:10,cursor:"pointer",
                  }}>{r}</button>
                ))}
              </div>
            </div>

            {/* Averages */}
            <SecHead title={`Averages — ${rangeLabel(range)}`}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <BigNum icon="🔥" label="Avg Daily Calories" value={avgCal>0?avgCal.toLocaleString():"—"} sub={goals?`goal: ${goals.calories.toLocaleString()} kcal`:"set a goal"} color={C.gold}/>
              <BigNum icon="🥩" label="Avg Protein" value={avgProt>0?`${avgProt}g`:"—"} sub={goals?`goal: ${goals.protein}g`:"set a goal"} color={C.green}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
              <MiniNum label="Avg Carbs" value={avgCarbs>0?`${avgCarbs}g`:"—"} color={C.purple}/>
              <MiniNum label="Avg Fat" value={avgFat>0?`${avgFat}g`:"—"} color={C.gold}/>
              <MiniNum label="Days Logged" value={daysLogged} color={C.text}/>
            </div>

            {/* Consistency */}
            {goals&&daysLogged>0&&(<>
              <SecHead title="Goal Consistency"/>
              <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:20}}>
                {[
                  {label:`🥩 Protein ≥ ${goals.protein}g`,pct:proteinPct,hit:proteinHit,color:C.green},
                  {label:`🔥 Calories ~${goals.calories.toLocaleString()} (±10%)`,pct:caloriePct,hit:calorieHit,color:C.gold},
                ].map(({label,pct,hit,color})=>(
                  <div key={label} style={{marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:12,color:C.subLight}}>{label}</span>
                      <span style={{fontSize:14,fontWeight:900,color}}>{pct}%</span>
                    </div>
                    <div style={{background:C.border,borderRadius:99,height:8,overflow:"hidden"}}>
                      <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:99}}/>
                    </div>
                    <div style={{fontSize:10,color:C.sub,marginTop:4}}>{hit} of {daysLogged} days</div>
                  </div>
                ))}
              </div>
            </>)}

            {/* Per-meal-time breakdown — surfaces patterns like "I under-eat
                protein at breakfast" or "my dinner is half my calories." */}
            {mealTypeStats.length > 0 && (<>
              <SecHead title="Meals Breakdown"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,marginBottom:20}}>
                {mealTypeStats.map(m=>{
                  const empty = m.count === 0;
                  return (
                    <div key={m.key} style={{
                      background:C.card,
                      borderRadius:14,
                      padding:14,
                      border:`1px solid ${C.border}`,
                      opacity: empty ? 0.55 : 1,
                    }}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:empty?0:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:20,filter:empty?"grayscale(100%)":"none"}}>{m.emoji}</span>
                          <span style={{fontWeight:800,fontSize:14,color:C.text}}>{m.label}</span>
                        </div>
                        <span style={{
                          fontSize:12,fontWeight:700,
                          color: empty ? C.sub : C.gold,
                          background: empty ? "transparent" : "rgba(251,191,36,0.12)",
                          padding:"3px 9px",borderRadius:99,
                          border: empty ? `1px dashed ${C.border}` : "none",
                        }}>
                          {empty ? "Not tracked yet" : `${m.count}× logged`}
                        </span>
                      </div>
                      {!empty && (
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,fontSize:11}}>
                          <div>
                            <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:0.6,marginBottom:2}}>Avg Cal</div>
                            <div style={{color:C.gold,fontWeight:800,fontSize:13}}>{m.avgCal>0?m.avgCal.toLocaleString():"—"}</div>
                          </div>
                          <div>
                            <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:0.6,marginBottom:2}}>Avg P</div>
                            <div style={{color:C.green,fontWeight:800,fontSize:13}}>{m.avgProt>0?`${m.avgProt}g`:"—"}</div>
                          </div>
                          <div>
                            <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:0.6,marginBottom:2}}>Avg C</div>
                            <div style={{color:C.purple,fontWeight:800,fontSize:13}}>{m.avgCarbs>0?`${m.avgCarbs}g`:"—"}</div>
                          </div>
                          <div>
                            <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:0.6,marginBottom:2}}>Avg F</div>
                            <div style={{color:C.text,fontWeight:800,fontSize:13}}>{m.avgFat>0?`${m.avgFat}g`:"—"}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>)}

            {/* Daily chart */}
            <SecHead title="Daily Calories & Protein"/>
            {dailyNutrition.length>1?(
              <ChartWrap>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={dailyNutrition} margin={{top:4,right:8,left:-16,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:C.sub}}/>
                    <YAxis tick={{fontSize:9,fill:C.sub}}/>
                    <Tooltip content={<Tip/>}/>
                    <Line dataKey="calories" name="Calories" stroke={C.gold} strokeWidth={2} dot={false}/>
                    <Line dataKey="protein" name="Protein (g)" stroke={C.green} strokeWidth={2} dot={false} strokeDasharray="4 2"/>
                    {goals&&<Line dataKey="calGoal" name="Cal Goal" stroke={C.gold} strokeWidth={1} dot={false} strokeDasharray="2 4" opacity={0.35}/>}
                    {goals&&<Line dataKey="protGoal" name="Protein Goal" stroke={C.green} strokeWidth={1} dot={false} strokeDasharray="2 4" opacity={0.35}/>}
                  </LineChart>
                </ResponsiveContainer>
                <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:6,fontSize:10,color:C.sub}}>
                  <span>━ Solid = actual &nbsp; ╌ Dashed = goal</span>
                </div>
              </ChartWrap>
            ):<Empty icon="🥗" text="Log nutrition to see daily trends"/>}

            {/* Macro pie */}
            {macroPie.length>0&&(<>
              <SecHead title="Average Macro Split"/>
              <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:16}}>
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie data={macroPie} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={48} strokeWidth={0}>
                      {macroPie.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{flex:1}}>
                  {macroPie.map(m=>{
                    const total=macroPie.reduce((s,x)=>s+x.value,0);
                    const pct=total>0?Math.round((m.value/total)*100):0;
                    const goalPct=goals?Math.round((m.name==="Protein"?goals.protein*4:m.name==="Carbs"?goals.carbs*4:goals.fat*9)/(goals.calories||1)*100):null;
                    return(
                      <div key={m.name} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                            <span style={{width:10,height:10,borderRadius:2,background:m.color,display:"inline-block"}}/>
                            {m.name}
                          </span>
                          <span style={{fontSize:13,fontWeight:700,color:m.color}}>
                            {pct}%{goalPct!==null&&<span style={{fontSize:10,color:C.sub,fontWeight:400}}> / {goalPct}% goal</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>)}

            {/* AI Analysis */}
            <NutritionAI goals={goals} avgCal={avgCal} avgProt={avgProt} avgCarbs={avgCarbs} avgFat={avgFat} daysLogged={daysLogged} proteinPct={proteinPct} caloriePct={caloriePct}/>
          </>)}

          {/* ═══════════════════════════════════════════════ PRs ══ */}
          {tab==="prs"&&(<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              <BigNum icon="🏆" label="Total PRs" value={topPRs.length} sub="exercises tracked" color={C.gold}/>
              <BigNum icon="💀" label="Heaviest Lift" value={topPRs[0]?.best.weight?`${topPRs[0].best.weight} lbs`:"—"} sub={topPRs[0]?.name||"no data"} color={C.red}/>
            </div>

            {topPRs.length>0?(
              // Group by muscle
              Object.entries(prsByMuscle).map(([muscle,prs])=>(
                <div key={muscle} style={{marginBottom:28}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{width:10,height:10,borderRadius:2,background:MUSCLE_COLORS[muscle]||C.gold}}/>
                    <span style={{fontWeight:800,fontSize:13,color:MUSCLE_COLORS[muscle]||C.gold,textTransform:"uppercase",letterSpacing:1}}>{muscle}</span>
                    <span style={{fontSize:11,color:C.sub}}>({prs.length} lift{prs.length!==1?"s":""})</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {prs.map(({name,best,history})=>{
                      const expanded=expandedPR===name;
                      const color=MUSCLE_COLORS[muscle]||C.gold;
                      const improvement=history.length>1?((history[history.length-1].weight-history[0].weight)/history[0].weight*100).toFixed(1):null;
                      return(
                        <div key={name} style={{background:C.card,borderRadius:14,overflow:"hidden",border:`1px solid ${expanded?color:C.border}`,transition:"border-color 0.2s"}}>
                          <button onClick={()=>setExpandedPR(expanded?null:name)} style={{width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",textAlign:"left"}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:800,fontSize:14,color:C.text,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                              <div style={{fontSize:11,color:C.sub}}>
                                {best.logged_at&&fmt(best.logged_at)}
                                {best.reps&&` · ${best.reps} reps`}
                                {improvement&&Number(improvement)>0&&<span style={{color:C.green,marginLeft:6,fontWeight:700}}>▲ +{improvement}%</span>}
                                {` · ${history.length} session${history.length!==1?"s":""}`}
                              </div>
                            </div>
                            <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                              <div style={{fontWeight:900,fontSize:20,color}}>{best.weight} lbs</div>
                            </div>
                            <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.5" style={{width:15,height:15,marginLeft:10,transform:expanded?"rotate(180deg)":"none",transition:"transform 0.2s"}}>
                              <path d="M6 9l6 6 6-6"/>
                            </svg>
                          </button>
                          {expanded&&(
                            <div style={{padding:"0 16px 16px",borderTop:`1px solid ${C.border}`}}>
                              {history.length>1?(<>
                                <div style={{fontSize:11,color:C.sub,margin:"12px 0 8px"}}>Weight progression</div>
                                <ChartWrap>
                                  <ResponsiveContainer width="100%" height={130}>
                                    <LineChart data={history.map(r=>({date:fmt(r.logged_at),weight:r.weight,reps:r.reps}))} margin={{top:4,right:8,left:-16,bottom:0}}>
                                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                                      <XAxis dataKey="date" tick={{fontSize:9,fill:C.sub}}/>
                                      <YAxis tick={{fontSize:9,fill:C.sub}} domain={["auto","auto"]}/>
                                      <Tooltip content={<Tip/>}/>
                                      <Line dataKey="weight" name="Weight (lbs)" stroke={color} strokeWidth={2.5} dot={{fill:color,r:4,strokeWidth:0}} activeDot={{r:6}}/>
                                    </LineChart>
                                  </ResponsiveContainer>
                                </ChartWrap>
                              </>):(
                                <div style={{fontSize:12,color:C.sub,padding:"12px 0"}}>Log this exercise again to see a progress chart 📈</div>
                              )}
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginTop:12}}>
                                {[
                                  {label:"Sessions",value:history.length,color:C.text},
                                  {label:"PR",value:`${best.weight} lbs`,color},
                                  {label:"Best Reps",value:Math.max(...history.map(r=>r.reps)),color:C.text},
                                  {label:"Progress",value:improvement&&Number(improvement)>0?`+${improvement}%`:"—",color:Number(improvement)>0?C.green:C.sub},
                                ].map(({label,value,color:c})=>(
                                  <div key={label} style={{background:C.bg,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                                    <div style={{fontSize:9,color:C.sub,marginBottom:3,textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
                                    <div style={{fontSize:13,fontWeight:800,color:c}}>{value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ):(
              <Empty icon="🏋️" text="No PRs yet — log workouts with specific exercises to track records"/>
            )}
          </>)}

          {/* ═══════════════════════════════════════════════ BODY ══ */}
          {tab==="body"&&(<>
            {/* ── BODY WEIGHT SECTION ──────────────────────────────────── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <BigNum icon="⚖️" label="Current Weight" value={latestWeight?`${latestWeight} lbs`:"—"} sub={wDelta!==null?`${wDelta>=0?"+":""}${wDelta} lbs in ${rangeLabel(range)}`:"no data"} color={wDelta!==null?(wDelta<0?C.green:wDelta>0?C.red:C.text):C.text}/>
              <BigNum icon="🌿" label="Wellness Sessions" value={wellnessLogs.length} sub={rangeLabel(range)} color={C.green}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
              <MiniNum label="Wellness Time" value={totalWellnessMins>60?`${(totalWellnessMins/60).toFixed(1)}h`:`${totalWellnessMins}m`} color={C.green}/>
              <MiniNum label="Unique Activities" value={wellnessByType.length} color={C.text}/>
            </div>

            {/* Weight chart */}
            <SecHead title="Body Weight Trend" right={
              <button onClick={()=>setShowWeightModal(true)} style={{fontSize:11,color:C.purple,fontWeight:700,background:C.purpleDim,border:`1px solid ${C.purpleBorder}`,borderRadius:8,padding:"4px 10px",cursor:"pointer"}}>+ Log Weight</button>
            }/>
            {weightLogs.length>1?(
              <ChartWrap>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={weightLogs.map(w=>({date:fmt(w.logged_at),weight:Number(w.weight_lbs)}))} margin={{top:4,right:8,left:-16,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:C.sub}}/>
                    <YAxis tick={{fontSize:9,fill:C.sub}} domain={["auto","auto"]}/>
                    <Tooltip content={<Tip/>}/>
                    <Line dataKey="weight" name="Weight (lbs)" stroke={C.cyan} strokeWidth={2.5} dot={{fill:C.cyan,r:3,strokeWidth:0}}/>
                  </LineChart>
                </ResponsiveContainer>
              </ChartWrap>
            ):(
              <Empty icon="⚖️" text="Log your weight on the Profile page to track trends here"/>
            )}
            {wDelta!==null&&(
              <div style={{textAlign:"center",marginTop:10,fontSize:13,fontWeight:700,color:wDelta<0?C.green:wDelta>0?C.red:C.sub}}>
                {wDelta<0?"📉":wDelta>0?"📈":"→"} {wDelta>=0?"+":""}{wDelta} lbs over {rangeLabel(range)}
              </div>
            )}

            {/* ── 🌿 WELLNESS DEEP DIVE ──────────────────────────────────── */}
            {/* Section divider with inline 1W/1M/1Y pills, matching the
                Running and Lifting dividers on the Workout tab. Same global
                range state, just placed here for accessibility. */}
            <div style={{marginTop:32,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:120}}>
                <div style={{height:1,flex:1,background:C.border}}/>
                <div style={{fontWeight:900,fontSize:16,color:C.green}}>🌿 Wellness</div>
                <div style={{height:1,flex:1,background:C.border}}/>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                {(["1W","1M","1Y"] as Range[]).map(r=>(
                  <button key={r} onClick={()=>setRange(r)} style={{
                    padding:"4px 9px",borderRadius:20,border:`1px solid ${range===r?C.green:C.border}`,
                    background:range===r?C.green:"transparent",
                    color:range===r?"#fff":C.sub,fontWeight:700,fontSize:10,cursor:"pointer",
                  }}>{r}</button>
                ))}
              </div>
            </div>

            {wellnessLogs.length === 0 ? (
              <Empty icon="🌿" text="Log wellness activities (cold plunge, sauna, yoga, meditation) to see trends here"/>
            ) : (
              <>
                {/* Hero stats — Mindful Minutes is the aspirational big number,
                    plus sessions, active days, and consistency %. */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <BigNum icon="🧘" label="Mindful Minutes" value={totalWellnessMins>=60?`${Math.floor(totalWellnessMins/60)}h ${Math.round(totalWellnessMins%60)}m`:`${Math.round(totalWellnessMins)}m`} sub={rangeLabel(range)} color={C.green}/>
                  <BigNum icon="✨" label="Consistency" value={`${wellnessConsistency}%`} sub={`${activeDaysWellness} active days`} color={wellnessConsistency>=50?C.gold:C.text}/>
                </div>

                {/* Streak card — flame visual that shows current + best. */}
                <div style={{background:`linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.04))`,borderRadius:14,padding:"14px 16px",border:`1px solid ${C.green}55`,marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <div style={{fontSize:36,filter:wellnessStreak.current>0?"none":"grayscale(100%)"}}>
                      🔥
                    </div>
                    <div>
                      <div style={{fontWeight:900,fontSize:22,color:C.text,lineHeight:1}}>
                        {wellnessStreak.current} {wellnessStreak.current===1?"day":"days"}
                      </div>
                      <div style={{fontSize:11,color:C.sub,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:0.6,marginTop:3}}>
                        Current streak
                      </div>
                    </div>
                  </div>
                  <div style={{textAlign:"right" as const}}>
                    <div style={{fontWeight:800,fontSize:16,color:C.gold,lineHeight:1}}>
                      🏆 {wellnessStreak.longest}
                    </div>
                    <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:0.6,marginTop:3}}>
                      Best
                    </div>
                  </div>
                </div>

                {/* Per-discipline cards */}
                {wellnessByType.length>0&&(<>
                  <SecHead title="Activity Breakdown"/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,marginBottom:20}}>
                    {wellnessByType.map(w=>{
                      const lastDays = w.lastDate ? Math.floor((Date.now() - new Date(w.lastDate).getTime()) / 86400000) : null;
                      const lastLabel = lastDays === null ? "—" : lastDays === 0 ? "Today" : lastDays === 1 ? "Yesterday" : `${lastDays}d ago`;
                      return (
                        <div key={w.type} style={{background:C.card,borderRadius:14,padding:14,border:`1px solid ${C.border}`}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:20}}>{wellnessEmoji(w.type)}</span>
                              <span style={{fontWeight:800,fontSize:14,color:C.text}}>{w.type}</span>
                            </div>
                            <span style={{fontSize:12,fontWeight:700,color:C.green,background:"rgba(34,197,94,0.12)",padding:"3px 9px",borderRadius:99}}>
                              {w.count}× sessions
                            </span>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11}}>
                            <div>
                              <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:0.6,marginBottom:2}}>Total Time</div>
                              <div style={{color:C.text,fontWeight:800,fontSize:13}}>
                                {w.totalMin >= 60 ? `${(w.totalMin/60).toFixed(1)}h` : `${w.totalMin}m`}
                              </div>
                            </div>
                            <div>
                              <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:0.6,marginBottom:2}}>Avg Session</div>
                              <div style={{color:C.green,fontWeight:800,fontSize:13}}>
                                {w.avgMin > 0 ? `${w.avgMin}m` : "—"}
                              </div>
                            </div>
                            <div>
                              <div style={{color:C.sub,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:0.6,marginBottom:2}}>Longest</div>
                              <div style={{color:C.gold,fontWeight:800,fontSize:13}}>
                                {w.longest > 0 ? `${w.longest}m` : "—"}
                              </div>
                            </div>
                          </div>
                          <div style={{paddingTop:10,marginTop:10,borderTop:`1px solid ${C.border}`,fontSize:11,color:C.sub,display:"flex",justifyContent:"space-between"}}>
                            <span>Last: <strong style={{color:C.text}}>{lastLabel}</strong></span>
                            <ProgBar value={w.count} max={wellnessByType[0].count} color={C.green}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>)}

                {/* Day of week + Time of day side by side */}
                <SecHead title="When You Recover"/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:10,marginBottom:20}}>
                  <ChartWrap>
                    <div style={{fontSize:11,fontWeight:800,color:C.green,padding:"4px 8px 8px",textTransform:"uppercase" as const,letterSpacing:0.8}}>📅 By Day of Week</div>
                    <ResponsiveContainer width="100%" height={130}>
                      <BarChart data={freqByDayWellness} margin={{top:4,right:8,left:-16,bottom:0}}>
                        <XAxis dataKey="day" tick={{fontSize:11,fill:C.sub}}/>
                        <YAxis tick={{fontSize:10,fill:C.sub}} allowDecimals={false}/>
                        <Tooltip content={<Tip/>}/>
                        <Bar dataKey="count" name="Sessions" fill={C.green} radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartWrap>
                  <ChartWrap>
                    <div style={{fontSize:11,fontWeight:800,color:C.green,padding:"4px 8px 8px",textTransform:"uppercase" as const,letterSpacing:0.8}}>🕐 By Time of Day</div>
                    <div style={{padding:"4px 12px 14px"}}>
                      {[
                        {label:"🌅 Morning",sub:"5am–12pm",val:timeOfDayBuckets.morning},
                        {label:"☀️ Afternoon",sub:"12pm–5pm",val:timeOfDayBuckets.afternoon},
                        {label:"🌆 Evening",sub:"5pm–10pm",val:timeOfDayBuckets.evening},
                        {label:"🌙 Night",sub:"10pm–5am",val:timeOfDayBuckets.night},
                      ].map(b=>{
                        const max = Math.max(timeOfDayBuckets.morning,timeOfDayBuckets.afternoon,timeOfDayBuckets.evening,timeOfDayBuckets.night,1);
                        return (
                          <div key={b.label} style={{marginBottom:10}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                              <span style={{color:C.text,fontWeight:700}}>{b.label}</span>
                              <span style={{color:C.sub}}>{b.val}× <span style={{opacity:0.7}}>· {b.sub}</span></span>
                            </div>
                            <ProgBar value={b.val} max={max} color={C.green}/>
                          </div>
                        );
                      })}
                    </div>
                  </ChartWrap>
                </div>

                {/* Activity mix radar */}
                {wellnessRadar.length >= 3 && (
                  <>
                    <SecHead title="Activity Mix"/>
                    <ChartWrap>
                      <ResponsiveContainer width="100%" height={220}>
                        <RadarChart data={wellnessRadar} margin={{top:10,right:30,left:30,bottom:10}}>
                          <PolarGrid stroke={C.border}/>
                          <PolarAngleAxis dataKey="activity" tick={{fontSize:11,fill:C.subLight}}/>
                          <Radar dataKey="sessions" stroke={C.green} fill={C.green} fillOpacity={0.25} strokeWidth={2.5} dot={{fill:C.green,r:3}}/>
                        </RadarChart>
                      </ResponsiveContainer>
                      <div style={{fontSize:11,color:C.sub,textAlign:"center" as const,marginTop:6}}>Bigger = more sessions of that activity</div>
                    </ChartWrap>
                  </>
                )}

                {/* Wellness weekly frequency — kept the existing rolling-12-week
                    bar chart since it shows long-term consistency well. */}
                <SecHead title="Wellness Sessions Per Week (12 Weeks)"/>
                <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:20}}>
                  {(()=>{
                    const now = new Date();
                    const weeks: {label:string; count:number}[] = [];
                    for(let i=11; i>=0; i--) {
                      const wStart = new Date(now);
                      wStart.setDate(now.getDate() - now.getDay() - i*7);
                      wStart.setHours(0,0,0,0);
                      const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate()+7);
                      const count = wellnessLogsAll.filter((l:any) => {
                        const dt = new Date(l.logged_at);
                        return dt >= wStart && dt < wEnd;
                      }).length;
                      weeks.push({ label: `${wStart.toLocaleString("default",{month:"short"})} ${wStart.getDate()}`, count });
                    }
                    const maxCount = Math.max(...weeks.map(w=>w.count), 1);
                    return (
                      <div>
                        <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80,marginBottom:8}}>
                          {weeks.map((w,i)=>(
                            <div key={i} style={{flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3}}>
                              {w.count>0&&(
                                <div style={{fontSize:9,fontWeight:700,color:i===11?C.green:C.sub}}>{w.count}</div>
                              )}
                              <div style={{
                                width:"100%",
                                height:`${Math.max(4, Math.round((w.count/maxCount)*64))}px`,
                                borderRadius:4,
                                background: w.count===0
                                  ? "rgba(255,255,255,0.06)"
                                  : i===11 ? C.green : `${C.green}99`,
                              }}/>
                            </div>
                          ))}
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.sub}}>
                          <span>{weeks[0].label}</span>
                          <span style={{color:C.green,fontWeight:700}}>This week</span>
                        </div>
                        <div style={{marginTop:10,display:"flex",gap:16,justifyContent:"center"}}>
                          <span style={{fontSize:12,color:C.sub}}>
                            Best week: <strong style={{color:C.text}}>{Math.max(...weeks.map(w=>w.count))} sessions</strong>
                          </span>
                          <span style={{fontSize:12,color:C.sub}}>
                            Avg: <strong style={{color:C.text}}>{(weeks.reduce((s,w)=>s+w.count,0)/12).toFixed(1)}/week</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Recent wellness logs */}
                <SecHead title="Recent Wellness Logs"/>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                  {[...wellnessLogs].reverse().slice(0,8).map((l:any,i:number)=>(
                    <div key={i} style={{background:C.card,borderRadius:12,padding:"11px 14px",border:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:C.text}}>{l.wellness_type||"Wellness"}</div>
                        <div style={{fontSize:11,color:C.sub,marginTop:2}}>
                          {fmtDay(l.logged_at)}
                          {l.wellness_duration_min&&` · ${l.wellness_duration_min} min`}
                        </div>
                      </div>
                      <div style={{fontSize:20}}>{wellnessEmoji(l.wellness_type||"")}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Body Score — kept at the bottom since it spans wellness +
                workout + nutrition signals. */}
            <SecHead title="Body Score"/>
            <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:20}}>
              {[
                {label:"💪 Workout Consistency",value:totalWorkouts,max:rangeWeeks*5,desc:`${totalWorkouts} sessions in ${rangeLabel(range)}`,color:C.purple},
                {label:"🌿 Recovery Sessions",value:wellnessLogs.length,max:rangeWeeks*7,desc:`${wellnessLogs.length} wellness logs`,color:C.green},
                {label:"🥗 Nutrition Tracking",value:daysLogged,max:rangeWeeks*7,desc:`${daysLogged} days logged`,color:C.gold},
              ].map(({label,value,max,desc,color})=>(
                <div key={label} style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:13,fontWeight:700}}>{label}</span>
                    <span style={{fontSize:11,color:C.sub}}>{desc}</span>
                  </div>
                  <ProgBar value={value} max={max} color={color}/>
                </div>
              ))}
              <div style={{fontSize:12,color:C.sub,marginTop:4,textAlign:"center"}}>Based on your logged data in {rangeLabel(range)}</div>
            </div>
          </>)}

        </>)}
      </div>
    {/* ── Weight Log Modal ── */}
    {showWeightModal && (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:300,
        display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}
        onClick={e=>{if(e.target===e.currentTarget)setShowWeightModal(false);}}>
        <div style={{background:"#111118",borderRadius:24,width:"100%",maxWidth:400,padding:"28px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <div style={{fontWeight:900,fontSize:20,color:"#F0F0F0"}}>⚖️ Log Weight</div>
            <button onClick={()=>setShowWeightModal(false)}
              style={{background:"none",border:"none",color:"#6B7280",fontSize:26,cursor:"pointer",lineHeight:1}}>×</button>
          </div>

          {/* Weight input */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
              Weight (lbs)
            </div>
            <input
              type="number" step="0.1" placeholder="e.g. 185.5"
              value={weightInput} onChange={e=>setWeightInput(e.target.value)}
              style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid #2D1F52",
                background:"#1A1228",color:"#F0F0F0",fontSize:18,fontWeight:800,boxSizing:"border-box"}}
              autoFocus
            />
          </div>

          {/* Notes */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
              Notes (optional)
            </div>
            <input
              type="text" placeholder="e.g. Morning, before breakfast"
              value={weightNotes} onChange={e=>setWeightNotes(e.target.value)}
              style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1px solid #2D1F52",
                background:"#1A1228",color:"#F0F0F0",fontSize:13,boxSizing:"border-box"}}
            />
          </div>

          {/* Privacy toggle */}
          <div style={{marginBottom:24,padding:"12px 14px",background:"#1A1228",
            borderRadius:12,border:"1px solid #2D1F52",
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#F0F0F0"}}>
                {weightPublic ? "🌍 Public" : "🔒 Private"}
              </div>
              <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>
                {weightPublic ? "Visible on your profile" : "Only you can see this"}
              </div>
            </div>
            <button onClick={()=>setWeightPublic(p=>!p)} style={{
              width:44,height:24,borderRadius:99,border:"none",cursor:"pointer",
              background:weightPublic?"#7C3AED":"#2D1F52",
              position:"relative",transition:"background 0.2s",flexShrink:0,
            }}>
              <div style={{
                width:18,height:18,borderRadius:"50%",background:"#fff",
                position:"absolute",top:3,
                left:weightPublic?23:3,
                transition:"left 0.2s",
              }}/>
            </button>
          </div>

          <button onClick={saveWeight} disabled={!weightInput||weightSaving} style={{
            width:"100%",padding:"14px",borderRadius:14,border:"none",
            background:!weightInput||weightSaving?"#2D1F52":"linear-gradient(135deg,#7C3AED,#A78BFA)",
            color:"#fff",fontWeight:900,fontSize:15,cursor:!weightInput||weightSaving?"not-allowed":"pointer",
          }}>
            {weightSaving ? "Saving..." : "Save Weight"}
          </button>
        </div>
      </div>
    )}

    </div>
  );
}

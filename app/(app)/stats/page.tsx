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
type Range = "1W"|"1M"|"3M"|"6M"|"1Y";
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
function normalizeCardio(raw:string):string {
  const s=raw.toLowerCase().trim();
  // Time of day
  const time=s.includes("morning")?"Morning":s.includes("afternoon")?"Afternoon":s.includes("evening")||s.includes("night")?"Evening":"";
  // Activity type
  const CARDIO_TYPES=[
    {keys:["treadmill"],label:"Treadmill"},
    {keys:["run","jog","sprint"],label:"Run"},
    {keys:["walk"],label:"Walk"},
    {keys:["cycle","bike","cycling","spin"],label:"Cycling"},
    {keys:["swim"],label:"Swim"},
    {keys:["hiit"],label:"HIIT"},
    {keys:["row","rowing"],label:"Row"},
    {keys:["elliptical","stair"],label:"Machine"},
  ];
  for(const {keys,label} of CARDIO_TYPES){
    if(keys.some(k=>s.includes(k))) return time?`${time} ${label}`:label;
  }
  return time?`${time} Cardio`:"Cardio";
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function daysAgo(n:number){ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString(); }
function rangeToIso(r:Range){ return daysAgo(r==="1W"?7:r==="1M"?30:r==="3M"?90:r==="6M"?180:365); }
function rangeLabel(r:Range){ return r==="1W"?"this week":r==="1M"?"last 30 days":r==="3M"?"last 3 months":r==="6M"?"last 6 months":"last year"; }
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
  const [loading,setLoading]=useState(true);
  const [expandedPR,setExpandedPR]=useState<string|null>(null);
  const [showGoalEditor,setShowGoalEditor]=useState(false);
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
  const [workoutLogs,setWorkoutLogs]=useState<any[]>([]);
  const [nutritionLogs,setNutritionLogs]=useState<any[]>([]);
  const [wellnessLogs,setWellnessLogs]=useState<any[]>([]);
  const [weightLogs,setWeightLogs]=useState<any[]>([]);
  const [prList,setPrList]=useState<any[]>([]);
  const [allWorkoutDates,setAllWorkoutDates]=useState<string[]>([]);

  const load=useCallback(async()=>{
    if(!user) return;
    setLoading(true);
    const since=rangeToIso(range);
    const todayStart=new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd=new Date(); todayEnd.setHours(23,59,59,999);

    try{
      // Goals
      const {data:ud}=await supabase.from("users").select("nutrition_goals").eq("id",user.id).single();
      if(ud?.nutrition_goals){setGoals(ud.nutrition_goals as NutritionGoals);setEditGoals(ud.nutrition_goals as NutritionGoals);}

      // Today workouts (no throwOnError!)
      const {data:twData}=await supabase.from("activity_logs")
        .select("workout_type,workout_duration_min,workout_calories,exercises,cardio,logged_at")
        .eq("user_id",user.id).eq("log_type","workout")
        .gte("logged_at",todayStart.toISOString()).lte("logged_at",todayEnd.toISOString());
      const tw=twData||[];
      setTodayWorkouts(tw);
      // Extract all cardio entries from today's workouts
      const allCardioToday=tw.flatMap((l:any)=>Array.isArray(l.cardio)?l.cardio.map((c:any)=>({...c,logged_at:l.logged_at})):[]);
      setTodayCardio(allCardioToday);

      // Today wellness
      const {data:twellData}=await supabase.from("activity_logs")
        .select("wellness_type,wellness_duration_min,notes,logged_at")
        .eq("user_id",user.id).eq("log_type","wellness")
        .gte("logged_at",todayStart.toISOString()).lte("logged_at",todayEnd.toISOString());
      setTodayWellness(twellData||[]);

      // Today nutrition
      const {data:tnutData}=await supabase.from("activity_logs")
        .select("calories_total,protein_g,carbs_g,fat_g,water_oz")
        .eq("user_id",user.id).eq("log_type","nutrition")
        .gte("logged_at",todayStart.toISOString()).lte("logged_at",todayEnd.toISOString());
      if(tnutData&&tnutData.length>0){
        setTodayNut(tnutData.reduce((a:any,l:any)=>({
          calories:a.calories+(l.calories_total||0),
          protein:a.protein+(l.protein_g||0),
          carbs:a.carbs+(l.carbs_g||0),
          fat:a.fat+(l.fat_g||0),
          water_oz:a.water_oz+(l.water_oz||0),
        }),{calories:0,protein:0,carbs:0,fat:0,water_oz:0}));
      } else setTodayNut(null);

      // Latest weight (all time, not range-limited)
      const {data:lwData}=await supabase.from("weight_logs")
        .select("weight_lbs,logged_at").eq("user_id",user.id)
        .order("logged_at",{ascending:false}).limit(1);
      if(lwData&&lwData.length>0) setLatestWeight(Number(lwData[0].weight_lbs));

      // Range logs
      const {data:logs}=await supabase.from("activity_logs")
        .select("id,log_type,logged_at,workout_type,workout_duration_min,workout_calories,exercises,cardio,calories_total,protein_g,carbs_g,fat_g,water_oz,wellness_type,wellness_duration_min,notes")
        .eq("user_id",user.id).gte("logged_at",since)
        .order("logged_at",{ascending:true});
      if(logs){
        setWorkoutLogs(logs.filter((l:any)=>l.log_type==="workout"));
        setNutritionLogs(logs.filter((l:any)=>l.log_type==="nutrition"));
        setWellnessLogs(logs.filter((l:any)=>l.log_type==="wellness"));
      }

      // PRs
      const {data:prs}=await supabase.from("personal_records")
        .select("exercise_name,weight,reps,volume,logged_at")
        .eq("user_id",user.id).order("weight",{ascending:false});
      if(prs) setPrList(prs);

      // Weight logs (range)
      const {data:wl}=await supabase.from("weight_logs")
        .select("weight_lbs,logged_at").eq("user_id",user.id)
        .gte("logged_at",since).order("logged_at",{ascending:true});
      if(wl) setWeightLogs(wl);

      // All workout dates for streak/heatmap
      const {data:allW}=await supabase.from("activity_logs")
        .select("logged_at").eq("user_id",user.id).eq("log_type","workout")
        .order("logged_at",{ascending:false});
      if(allW) setAllWorkoutDates(allW.map((l:any)=>l.logged_at));

    }catch(e){console.error(e);}
    setLoading(false);
  },[user,range]);

  useEffect(()=>{load();},[load]);

  async function saveGoals(){
    if(!user) return;
    setSavingGoals(true);
    try{
      await supabase.from("users").update({nutrition_goals:editGoals}).eq("id",user.id);
      setGoals(editGoals); setShowGoalEditor(false);
    }catch(e){console.error(e);}
    setSavingGoals(false);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const streaks=calcStreak(allWorkoutDates);
  const totalWorkouts=workoutLogs.length;
  const rangeWeeks=range==="1W"?1:range==="1M"?4:range==="3M"?13:range==="6M"?26:52;
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
    const t:Record<string,number>={};
    workoutLogs.forEach(l=>{const tp=l.workout_type||"Workout";t[tp]=(t[tp]||0)+1;});
    return Object.entries(t).sort((a,b)=>b[1]-a[1]).map(([type,count])=>({type,count}));
  })();

  // Cardio stats from workout logs
  const allCardio=workoutLogs.flatMap(l=>Array.isArray(l.cardio)?l.cardio.map((c:any)=>({...c,logged_at:l.logged_at})):[]);
  const cardioSessions=workoutLogs.filter(l=>Array.isArray(l.cardio)&&l.cardio.length>0).length;
  const liftingSessions=workoutLogs.filter(l=>Array.isArray(l.exercises)&&l.exercises.length>0).length;
  const totalCardioMin=allCardio.reduce((s:number,c:any)=>s+(parseFloat(String(c.duration))||0),0);
  const totalCardioMiles=allCardio.reduce((s:number,c:any)=>s+(parseFloat(String(c.distance))||0),0);
  const cardioTypes=(()=>{
    const t:Record<string,{count:number;totalDist:number;totalDur:number}>={};
    allCardio.forEach((c:any)=>{
      const tp=normalizeCardio(c.type||"Cardio");
      if(!t[tp]) t[tp]={count:0,totalDist:0,totalDur:0};
      t[tp].count++;
      t[tp].totalDist+=parseFloat(String(c.distance))||0;
      t[tp].totalDur+=parseFloat(String(c.duration))||0;
    });
    return Object.entries(t).sort((a,b)=>b[1].count-a[1].count).map(([type,{count,totalDist,totalDur}])=>({
      type,count,
      avgDist:count>0?Math.round((totalDist/count)*100)/100:0,
      avgDur:count>0?Math.round(totalDur/count):0,
    }));
  })();

  // ── Per-activity range stats (running + lifting) ─────────────────────────────
  // Running stats bucketed by week and month
  const runEntries = allCardio.filter((c:any)=>{
    const t=normalizeCardio(c.type||"");
    return t.includes("Run")||t.includes("Walk")||t.includes("Treadmill");
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

  // Training frequency by day of week
  const freqByDay=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=>{
    const idx=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(day);
    const jsDay=idx<6?idx+1:0;
    return{day,count:workoutLogs.filter(l=>new Date(l.logged_at).getDay()===jsDay).length};
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
  const wellnessByType=(()=>{
    const f:Record<string,number>={};
    wellnessLogs.forEach(l=>{const t=l.wellness_type||"Other";f[t]=(f[t]||0)+1;});
    return Object.entries(f).sort((a,b)=>b[1]-a[1]).map(([type,count])=>({type,count}));
  })();
  const avgSleepHours=0; // would need wellness_data column
  const totalWellnessMins=wellnessLogs.reduce((s,l)=>s+(l.wellness_duration_min||0),0);

  if(!user) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:C.sub}}>Sign in to view your stats</div>
    </div>
  );

  const TABS:{key:Tab;icon:string;label:string}[]=[
    {key:"today",icon:"☀️",label:"Today"},
    {key:"workout",icon:"💪",label:"Workout"},
    {key:"nutrition",icon:"🥗",label:"Nutrition"},
    {key:"prs",icon:"🏆",label:"PRs"},
    {key:"body",icon:"⚖️",label:"Body"},
  ];

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,paddingBottom:100}}>

      {/* Sticky header */}
      <div style={{position:"sticky",top:0,zIndex:50,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(14px)",borderBottom:`1px solid ${C.border}`,padding:"14px 18px 0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontWeight:900,fontSize:21,color:C.text}}>📊 Stats</div>
          {tab!=="today"&&tab!=="prs"&&(
            <div style={{display:"flex",gap:4}}>
              {(["1W","1M","3M","6M","1Y"] as Range[]).map(r=>(
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
          <div style={{textAlign:"center",padding:80,color:C.sub}}>
            <div style={{fontSize:28,marginBottom:10}}>⏳</div>
            Loading your stats...
          </div>
        ):(<>

          {/* ═══════════════════════════════════════════════ TODAY ══ */}
          {tab==="today"&&(<>
            {/* Streak */}
            <div style={{background:`linear-gradient(135deg,${C.purpleDim},#1A0F30)`,borderRadius:18,padding:"18px 20px",border:`1px solid ${C.purpleBorder}`,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:11,color:C.subLight,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Current Streak</div>
                <div style={{fontSize:42,fontWeight:900,color:C.gold,lineHeight:1}}>{streaks.current}<span style={{fontSize:18,color:C.sub,marginLeft:4}}>days</span></div>
                <div style={{fontSize:12,color:C.sub,marginTop:4}}>Best ever: {streaks.longest} days</div>
              </div>
              <div style={{fontSize:52}}>🔥</div>
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
              <button onClick={()=>router.push("/profile")} style={{fontSize:12,color:C.purple,fontWeight:700,background:C.purpleDim,border:`1px solid ${C.purpleBorder}`,borderRadius:10,padding:"7px 14px",cursor:"pointer"}}>+ Log Weight</button>
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

            {/* Heatmap */}
            <SecHead title="Activity Heatmap (12 Weeks)"/>
            <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:20}}>
              {allWorkoutDates.length>0?<Heatmap dates={allWorkoutDates}/>:<div style={{color:C.sub,fontSize:13,textAlign:"center"}}>No workouts logged yet</div>}
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



            {/* Training days */}
            <SecHead title="Training by Day of Week"/>
            {workoutLogs.length>0?(
              <ChartWrap>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={freqByDay} margin={{top:4,right:8,left:-16,bottom:0}}>
                    <XAxis dataKey="day" tick={{fontSize:11,fill:C.sub}}/>
                    <YAxis tick={{fontSize:10,fill:C.sub}} allowDecimals={false}/>
                    <Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Sessions" radius={[4,4,0,0]}>
                      {freqByDay.map((e,i)=><Cell key={i} fill={e.day===favDay?C.gold:C.purple}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{fontSize:11,color:C.sub,textAlign:"center",marginTop:4}}>🏅 Gold = most frequent training day</div>
              </ChartWrap>
            ):<Empty icon="📅" text="Log workouts to see training patterns"/>}

            {/* Cardio breakdown */}
            {cardioSessions>0&&(<>
              <SecHead title="Cardio Breakdown"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                <MiniNum label="Sessions" value={cardioSessions} color={C.cyan}/>
                <MiniNum label="Total Time" value={totalCardioMin>60?`${(totalCardioMin/60).toFixed(1)}h`:`${Math.round(totalCardioMin)}m`} color={C.green}/>
                <MiniNum label="Total Miles" value={totalCardioMiles>0?`${totalCardioMiles.toFixed(1)} mi`:"—"} color={C.gold}/>
              </div>
              {cardioTypes.length>0&&(
                <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:20}}>
                  {cardioTypes.map(({type,count,avgDist,avgDur})=>(
                    <div key={type} style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                        <span style={{fontSize:13,fontWeight:700}}>{type}</span>
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          {avgDist>0&&<span style={{fontSize:11,color:C.sub}}>{avgDist.toFixed(2)} mi avg</span>}
                          {avgDur>0&&<span style={{fontSize:11,color:C.sub}}>{avgDur} min avg</span>}
                          <span style={{fontSize:12,fontWeight:700,color:C.cyan}}>{count}×</span>
                        </div>
                      </div>
                      <ProgBar value={count} max={cardioTypes[0].count} color={C.cyan}/>
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {/* Muscle group breakdown */}
            <SecHead title="Muscle Group Focus"/>
            {muscleGroups.length>0?(
              <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:20}}>
                {muscleGroups.map(({name,value})=>(
                  <div key={name} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:13,fontWeight:700}}>{name}</span>
                      <span style={{fontSize:12,fontWeight:700,color:MUSCLE_COLORS[name]||C.sub}}>{value} sets</span>
                    </div>
                    <ProgBar value={value} max={muscleGroups[0].value} color={MUSCLE_COLORS[name]||C.sub}/>
                  </div>
                ))}
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
              <div style={{marginTop:32,marginBottom:4,display:"flex",alignItems:"center",gap:10}}>
                <div style={{height:1,flex:1,background:C.border}}/>
                <div style={{fontWeight:900,fontSize:16,color:C.cyan}}>🏃 Running</div>
                <div style={{height:1,flex:1,background:C.border}}/>
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
              <div style={{marginTop:32,marginBottom:4,display:"flex",alignItems:"center",gap:10}}>
                <div style={{height:1,flex:1,background:C.border}}/>
                <div style={{fontWeight:900,fontSize:16,color:C.purple}}>🏋️ Lifting</div>
                <div style={{height:1,flex:1,background:C.border}}/>
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
                  <div style={{fontWeight:800,fontSize:15,color:C.text}}>⚙️ Daily Nutrition Goals</div>
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
            {/* Body weight */}
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
              <button onClick={()=>router.push("/profile")} style={{fontSize:11,color:C.purple,fontWeight:700,background:C.purpleDim,border:`1px solid ${C.purpleBorder}`,borderRadius:8,padding:"4px 10px",cursor:"pointer"}}>+ Log Weight</button>
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

            {/* Wellness heatmap */}
            <SecHead title="Wellness Consistency (12 Weeks)"/>
            <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:20}}>
              {wellnessLogs.length>0?<Heatmap dates={wellnessLogs.map(l=>l.logged_at)}/>:<div style={{color:C.sub,fontSize:13,textAlign:"center"}}>Log wellness activities to track consistency</div>}
            </div>

            {/* Activity breakdown */}
            {wellnessByType.length>0&&(<>
              <SecHead title="Activity Breakdown"/>
              <div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`,marginBottom:20}}>
                {wellnessByType.map(({type,count})=>(
                  <div key={type} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:13,fontWeight:700}}>{type}</span>
                      <span style={{fontSize:12,fontWeight:700,color:C.green}}>{count}×</span>
                    </div>
                    <ProgBar value={count} max={wellnessByType[0].count} color={C.green}/>
                  </div>
                ))}
              </div>
            </>)}

            {/* Recovery quality */}
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

            {/* Recent wellness logs */}
            {wellnessLogs.length>0&&(<>
              <SecHead title="Recent Wellness Logs"/>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[...wellnessLogs].reverse().slice(0,8).map((l:any,i:number)=>(
                  <div key={i} style={{background:C.card,borderRadius:12,padding:"11px 14px",border:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:C.text}}>{l.wellness_type||"Wellness"}</div>
                      <div style={{fontSize:11,color:C.sub,marginTop:2}}>
                        {fmtDay(l.logged_at)}
                        {l.wellness_duration_min&&` · ${l.wellness_duration_min} min`}
                      </div>
                    </div>
                    <div style={{fontSize:20}}>🌿</div>
                  </div>
                ))}
              </div>
            </>)}
          </>)}

        </>)}
      </div>
    </div>
  );
}

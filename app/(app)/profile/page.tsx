"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";

const C = {
  blue:"#16A34A", greenLight:"#F0FDF4", greenMid:"#BBF7D0",
  gold:"#F5A623", goldLight:"#FFFBEE",
  text:"#1A2B3C", sub:"#5A7A8A", white:"#FFFFFF", bg:"#F0FDF4",
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
const BADGES = [
  // === STRENGTH ===
  {id:"1k-club",emoji:"🏋️",label:"1,000 lb Club",desc:"Squat + Bench + Deadlift ≥ 1,000 lbs",category:"strength",manual:true},
  {id:"heavy-lifter",emoji:"💪",label:"Heavy Lifter",desc:"Logged a single lift over 300 lbs",category:"strength",manual:true},
  {id:"pb-crusher",emoji:"🚀",label:"PB Crusher",desc:"Set 5 personal bests in one month",category:"strength",manual:true},
  {id:"iron-maiden",emoji:"⚒️",label:"Iron Maiden",desc:"Deadlifted 2x your bodyweight",category:"strength",manual:true},
  {id:"bench-200",emoji:"🪨",label:"200 Club",desc:"Bench pressed 200 lbs",category:"strength",manual:true},
  {id:"squat-300",emoji:"🦵",label:"Squat King",desc:"Back squatted 300 lbs",category:"strength",manual:true},
  {id:"deadlift-400",emoji:"⚓",label:"Deadlift Beast",desc:"Deadlifted 400 lbs",category:"strength",manual:true},
  {id:"overhead-bw",emoji:"🙌",label:"Overhead Master",desc:"Overhead pressed your bodyweight",category:"strength",manual:true},
  {id:"weighted-pullup",emoji:"🧲",label:"Weighted Pull-Up",desc:"Completed a pull-up with added weight",category:"strength",manual:true},
  {id:"sandbag",emoji:"🏜️",label:"Sandbag Warrior",desc:"Completed a sandbag carry workout",category:"strength",manual:true},
  {id:"farmer-carry",emoji:"🌾",label:"Farmer Strong",desc:"Farmer carried 100 lbs per hand",category:"strength",manual:true},
  {id:"atlas-stone",emoji:"🪨",label:"Atlas Stone",desc:"Lifted an atlas stone",category:"strength",manual:true},
  {id:"1rm-pr",emoji:"🎯",label:"One Rep Max",desc:"Hit a 1RM personal record",category:"strength",manual:true},
  {id:"powerlifter",emoji:"🏆",label:"Powerlifter",desc:"Competed in a powerlifting meet",category:"strength",manual:true},
  {id:"kettlebell-king",emoji:"🔔",label:"Kettlebell King",desc:"Completed 100 kettlebell swings in a row",category:"strength",manual:true},
  // === CARDIO ===
  {id:"marathon",emoji:"🏅",label:"Marathon Runner",desc:"Completed a 26.2 mile run",category:"cardio",manual:true},
  {id:"6min-mile",emoji:"⚡",label:"6 Minute Mile",desc:"Ran a mile in under 6 minutes",category:"cardio",manual:true},
  {id:"half-marathon",emoji:"🏃",label:"Half Marathoner",desc:"Completed a 13.1 mile run",category:"cardio",manual:true},
  {id:"5k",emoji:"🎽",label:"5K Runner",desc:"Completed your first 5K",category:"cardio",manual:true},
  {id:"10k",emoji:"🏁",label:"10K Runner",desc:"Completed your first 10K",category:"cardio",manual:true},
  {id:"ultra",emoji:"🌄",label:"Ultra Runner",desc:"Completed an ultra marathon (50K+)",category:"cardio",manual:true},
  {id:"century-ride",emoji:"🚴",label:"Century Rider",desc:"Cycled 100 miles in one ride",category:"cardio",manual:true},
  {id:"triathlon",emoji:"🏊",label:"Triathlete",desc:"Completed a triathlon",category:"cardio",manual:true},
  {id:"ironman",emoji:"🦾",label:"Ironman",desc:"Completed a full Ironman",category:"cardio",manual:true},
  {id:"swim-mile",emoji:"🌊",label:"Open Water Swimmer",desc:"Swam 1 mile in open water",category:"cardio",manual:true},
  {id:"speed-demon",emoji:"💨",label:"Speed Demon",desc:"Averaged 8 mph or faster on a run",category:"cardio",manual:true},
  {id:"hill-climber",emoji:"⛰️",label:"Hill Climber",desc:"Ran a race with 1,000+ feet of elevation gain",category:"cardio",manual:true},
  {id:"stair-master",emoji:"🪜",label:"Stair Master",desc:"Climbed 100 flights of stairs in a day",category:"cardio",manual:true},
  {id:"jump-rope",emoji:"🪢",label:"Jump Rope Pro",desc:"Jump roped for 10 minutes straight",category:"cardio",manual:true},
  {id:"rowing-10k",emoji:"🚣",label:"Rower",desc:"Rowed 10,000 meters in one session",category:"cardio",manual:true},
  // === CONSISTENCY ===
  {id:"7day-streak",emoji:"🔥",label:"7 Day Streak",desc:"Logged activity 7 days in a row",category:"consistency",manual:false},
  {id:"early-bird",emoji:"🌅",label:"Early Bird",desc:"Logged 5 workouts before 7am",category:"consistency",manual:false},
  {id:"centurion",emoji:"💯",label:"Centurion",desc:"Logged 100 workouts total",category:"consistency",manual:false},
  {id:"nutrition-pro",emoji:"🥗",label:"Nutrition Pro",desc:"Hit macro goals 14 days in a row",category:"consistency",manual:false},
  {id:"30day-streak",emoji:"🗓️",label:"30 Day Streak",desc:"Logged activity 30 days in a row",category:"consistency",manual:false},
  {id:"90day-streak",emoji:"💎",label:"90 Day Grind",desc:"Logged activity 90 days in a row",category:"consistency",manual:false},
  {id:"365day",emoji:"🌟",label:"Year Warrior",desc:"Logged activity 365 days in a year",category:"consistency",manual:false},
  {id:"50-workouts",emoji:"🥈",label:"50 Strong",desc:"Logged 50 total workouts",category:"consistency",manual:false},
  {id:"500-workouts",emoji:"👑",label:"500 Legend",desc:"Logged 500 total workouts",category:"consistency",manual:false},
  {id:"morning-ritual",emoji:"☀️",label:"Morning Ritual",desc:"Logged 30 morning workouts",category:"consistency",manual:false},
  {id:"weekend-warrior",emoji:"⚔️",label:"Weekend Warrior",desc:"Worked out every weekend for a month",category:"consistency",manual:false},
  {id:"no-days-off",emoji:"🚫",label:"No Days Off",desc:"Logged at least one activity every day for 14 days",category:"consistency",manual:false},
  {id:"comeback",emoji:"🔄",label:"Comeback Kid",desc:"Returned to logging after a 30-day break",category:"consistency",manual:false},
  // === WELLNESS ===
  {id:"yoga-lover",emoji:"🧘",label:"Yoga Lover",desc:"Logged 10+ yoga sessions",category:"wellness",manual:false},
  {id:"meditation-master",emoji:"🕊️",label:"Meditation Master",desc:"Logged 30 meditation sessions",category:"wellness",manual:false},
  {id:"sleep-champ",emoji:"😴",label:"Sleep Champion",desc:"Logged 8+ hours of sleep 7 nights in a row",category:"wellness",manual:false},
  {id:"hydration-hero",emoji:"💧",label:"Hydration Hero",desc:"Hit daily water goal 14 days in a row",category:"wellness",manual:false},
  {id:"stretch-it-out",emoji:"🤸",label:"Stretch It Out",desc:"Logged 20 stretching or mobility sessions",category:"wellness",manual:false},
  {id:"ice-bath",emoji:"🧊",label:"Ice Bath Club",desc:"Took 5 ice baths or cold plunges",category:"wellness",manual:true},
  {id:"sauna",emoji:"🔆",label:"Sauna Regular",desc:"Logged 10 sauna sessions",category:"wellness",manual:true},
  {id:"breathwork",emoji:"🫁",label:"Breathwork Practitioner",desc:"Completed 10 breathwork sessions",category:"wellness",manual:true},
  {id:"zero-alcohol",emoji:"🫗",label:"Sober Streak",desc:"Logged 30 alcohol-free days",category:"wellness",manual:true},
  {id:"step-10k",emoji:"👟",label:"10K Steps",desc:"Hit 10,000 steps daily for 7 days",category:"wellness",manual:false},
  {id:"step-15k",emoji:"🦿",label:"Step Master",desc:"Hit 15,000 steps in a single day",category:"wellness",manual:false},
  {id:"posture",emoji:"🪑",label:"Posture Pro",desc:"Completed 20 posture/mobility workouts",category:"wellness",manual:false},
  {id:"nature-walk",emoji:"🌿",label:"Nature Walker",desc:"Logged 10 outdoor walks",category:"wellness",manual:false},
  // === NUTRITION ===
  {id:"calorie-goals",emoji:"🎯",label:"On Target",desc:"Hit calorie goal 7 days in a row",category:"nutrition",manual:false},
  {id:"protein-streak",emoji:"🥩",label:"Protein Streak",desc:"Hit protein goal 14 days in a row",category:"nutrition",manual:false},
  {id:"meal-prep",emoji:"🍱",label:"Meal Prepper",desc:"Logged 10 weeks of meal prep",category:"nutrition",manual:true},
  {id:"plant-week",emoji:"🌱",label:"Plant Week",desc:"Ate plant-based for 7 days",category:"nutrition",manual:true},
  {id:"sugar-free",emoji:"🚫",label:"Sugar Free",desc:"Avoided added sugar for 14 days",category:"nutrition",manual:true},
  {id:"macro-master",emoji:"⚖️",label:"Macro Master",desc:"Hit all 3 macro goals in a single day",category:"nutrition",manual:false},
  {id:"barcode-10",emoji:"📱",label:"Scanner",desc:"Logged 10 foods via barcode scan",category:"nutrition",manual:false},
  {id:"barcode-100",emoji:"📊",label:"Data Logger",desc:"Logged 100 foods via barcode scan",category:"nutrition",manual:false},
  {id:"fasting",emoji:"⏳",label:"Fasting Pro",desc:"Completed a 24-hour fast",category:"nutrition",manual:true},
  {id:"clean-30",emoji:"🥦",label:"Clean 30",desc:"Ate clean for 30 days straight",category:"nutrition",manual:true},
  // === CHALLENGES ===
  {id:"iron-will",emoji:"🪖",label:"Iron Will",desc:"Completed a 30-day challenge",category:"challenges",manual:true},
  {id:"75-hard",emoji:"🔩",label:"75 Hard",desc:"Completed the 75 Hard program",category:"challenges",manual:true},
  {id:"murph",emoji:"🇺🇸",label:"Murph",desc:"Completed the Murph workout",category:"challenges",manual:true},
  {id:"spartan",emoji:"🏔️",label:"Spartan",desc:"Completed a Spartan Race",category:"challenges",manual:true},
  {id:"tough-mudder",emoji:"🪤",label:"Tough Mudder",desc:"Completed a Tough Mudder",category:"challenges",manual:true},
  {id:"crossfit-open",emoji:"🏅",label:"CrossFit Open",desc:"Competed in the CrossFit Open",category:"challenges",manual:true},
  {id:"pushup-100",emoji:"⬇️",label:"100 Push-Ups",desc:"Did 100 push-ups in one session",category:"challenges",manual:true},
  {id:"plank-5min",emoji:"⏱️",label:"Plank Legend",desc:"Held a plank for 5 minutes",category:"challenges",manual:true},
  {id:"burpee-100",emoji:"🌀",label:"Burpee Beast",desc:"Completed 100 burpees in one session",category:"challenges",manual:true},
  {id:"pullup-20",emoji:"⬆️",label:"Pull-Up Pro",desc:"Did 20 consecutive pull-ups",category:"challenges",manual:true},
  // === SOCIAL ===
  {id:"first-post",emoji:"📸",label:"First Post",desc:"Made your first post on the feed",category:"social",manual:false},
  {id:"10-posts",emoji:"📷",label:"Content Creator",desc:"Made 10 posts on the feed",category:"social",manual:false},
  {id:"first-follower",emoji:"👥",label:"First Follower",desc:"Got your first follower",category:"social",manual:false},
  {id:"100-followers",emoji:"🌐",label:"Rising Star",desc:"Reached 100 followers",category:"social",manual:false},
  {id:"group-member",emoji:"🤝",label:"Group Member",desc:"Joined your first group",category:"social",manual:false},
  {id:"group-leader",emoji:"🎙️",label:"Group Leader",desc:"Created a group",category:"social",manual:false},
  {id:"first-like",emoji:"❤️",label:"Liked",desc:"Received your first like",category:"social",manual:false},
  {id:"motivator",emoji:"🙌",label:"Motivator",desc:"Had a post liked 50+ times",category:"social",manual:false},
  // === SPECIAL ===
  {id:"veteran",emoji:"🎖️",label:"Veteran",desc:"US Military Service",category:"special",manual:true},
  {id:"first-gym",emoji:"🏟️",label:"Gym Rat",desc:"Checked into a gym for the first time",category:"special",manual:false},
  {id:"coach",emoji:"🎓",label:"Coach",desc:"Became a certified fitness coach",category:"special",manual:true},
  {id:"personal-trainer",emoji:"📋",label:"Personal Trainer",desc:"Earned a personal training certification",category:"special",manual:true},
  {id:"transformation",emoji:"🦋",label:"Transformation",desc:"Completed a 90-day body transformation",category:"special",manual:true},
  {id:"comeback-story",emoji:"💫",label:"Comeback Story",desc:"Returned from injury and hit a new PR",category:"special",manual:true},
  {id:"birthday-workout",emoji:"🎂",label:"Birthday Grind",desc:"Worked out on your birthday",category:"special",manual:true},
  {id:"new-years",emoji:"🎆",label:"New Year, New Me",desc:"Logged a workout on January 1st",category:"special",manual:false},
  {id:"holiday-hustle",emoji:"🎄",label:"Holiday Hustle",desc:"Worked out on a major holiday",category:"special",manual:true},
  {id:"collab",emoji:"🤜",label:"Workout Partner",desc:"Logged a workout with a friend",category:"special",manual:true},
  {id:"outdoor-adventurer",emoji:"🧗",label:"Outdoor Adventurer",desc:"Completed a hike, climb, or outdoor adventure",category:"special",manual:true},
  {id:"sport-competitor",emoji:"🏆",label:"Competitor",desc:"Competed in any athletic event",category:"special",manual:true},
];

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({src,onClose}:{src:string;onClose:()=>void}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <button onClick={onClose} style={{position:"absolute",top:20,right:28,background:"none",border:"none",color:"#fff",fontSize:36,cursor:"pointer",lineHeight:1}}>×</button>
      <img src={src} style={{maxWidth:"90vw",maxHeight:"85vh",borderRadius:20,objectFit:"contain"}} alt="" />
    </div>
  );
}

type Exercise   = {name:string;sets:number;reps:number;weight:string};
type CardioEntry = {type:string;duration:string;distance:string};
type Meal        = {key:string;emoji:string;name:string;cal:number};
type WellnessEntry = {emoji:string;activity:string;notes:string};
type Workout    = {type:string;duration:string;calories:number;exercises:Exercise[];cardio:CardioEntry[]};
type Nutrition  = {calories:number;protein:number;carbs:number;fat:number;sugar:number;meals:Meal[]};
type Wellness   = {entries:WellnessEntry[]};

const iStyle = {background:C.greenLight,border:`1.5px solid ${C.greenMid}`,borderRadius:10,padding:"7px 10px",fontSize:13,color:C.text,outline:"none",width:"100%",boxSizing:"border-box" as const};
const emptyCardio:CardioEntry  = {type:"",duration:"",distance:""};
const emptyWellness:WellnessEntry = {emoji:"🧘",activity:"",notes:""};

// ── Day Card ──────────────────────────────────────────────────────────────────
type DayCardProps = { day: typeof DAYS[0]; workoutLogId?: string | null; nutritionLogIds?: string[]; onDelete?: ()=>void };
function DayCard({day, workoutLogId, nutritionLogIds, onDelete}:DayCardProps) {
  const [open,setOpen]       = useState(false);
  const [confirmDel,setConfirmDel] = useState(false);
  const [nut,setNut]         = useState(false);
  const [editWo,setEditWo]   = useState(false);
  const [editNut,setEditNut] = useState(false);
  const [editWell,setEditWell] = useState(false);
  const [photos,setPhotos]   = useState<string[]>([]);
  const [lb,setLb]           = useState<string|null>(null);
  const [workout,setWorkout]     = useState<Workout|null>(day.workout ? {...day.workout as Workout, cardio:[]} : null);
  const [nutrition,setNutrition] = useState<Nutrition|null>(day.nutrition as Nutrition|null);
  const [wellness,setWellness]   = useState<Wellness|null>(null);
  // edit buffers
  const [woBuf,setWoBuf]   = useState<Workout>(workout ?? {type:"",duration:"",calories:0,exercises:[],cardio:[]});
  const [nutBuf,setNutBuf] = useState<Nutrition>(nutrition ?? {calories:0,protein:0,carbs:0,fat:0,sugar:0,meals:[]});
  const [wellBuf,setWellBuf] = useState<Wellness>({entries:[]});
  const [m,d] = day.id.split(".").map(Number);

  // Load existing photo from DB on mount
  useEffect(() => {
    if ((day as any).photo_url) setPhotos([(day as any).photo_url]);
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
    if (workoutLogId) {
      await supabase.from('activity_logs').update({
        workout_type: woBuf.type,
        workout_duration_min: parseInt(woBuf.duration) || null,
        workout_calories: woBuf.calories,
        exercises: woBuf.exercises,
      }).eq('id', workoutLogId);
    }
  }
  async function saveNutrition() {
    setNutrition({...nutBuf});
    setEditNut(false);
    if (nutritionLogIds && nutritionLogIds.length > 0) {
      await supabase.from('activity_logs').update({
        calories_total: nutBuf.calories,
        protein_g: nutBuf.protein,
        carbs_g: nutBuf.carbs,
        fat_g: nutBuf.fat,
      }).eq('id', nutritionLogIds[0]);
    }
  }
  function saveWellness()  { setWellness(wellBuf.entries.length ? {...wellBuf} : null); setEditWell(false); }

  return (<>
    {lb && <Lightbox src={lb} onClose={()=>setLb(null)}/>}
    <div style={{background:C.white,borderRadius:22,border:`2px solid ${C.greenMid}`,boxShadow:"0 4px 18px rgba(124,58,237,0.10)",marginBottom:16,overflow:"hidden"}}>

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
        {onDelete && (
          <div style={{position:"relative",flexShrink:0}} onClick={e=>e.stopPropagation()}>
            {!confirmDel
              ? <button onClick={()=>setConfirmDel(true)} style={{width:34,height:34,borderRadius:"50%",background:"#FEE2E2",border:"none",color:"#EF4444",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
              : <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={()=>onDelete()} style={{padding:"5px 10px",borderRadius:10,border:"none",background:"#EF4444",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"}}>Delete</button>
                  <button onClick={()=>setConfirmDel(false)} style={{padding:"5px 10px",borderRadius:10,border:`1px solid ${C.greenMid}`,background:C.greenLight,color:C.sub,fontWeight:800,fontSize:12,cursor:"pointer"}}>Cancel</button>
                </div>
            }
          </div>
        )}
      </button>

      {/* BODY */}
      {open && <div style={{padding:"24px 24px 28px",borderTop:`2px solid ${C.greenMid}`}}>

        {/* Photos */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>Photos</span>
            <label style={{fontSize:13,fontWeight:700,padding:"6px 16px",borderRadius:20,background:C.greenLight,color:C.blue,cursor:"pointer"}}>
              📷 Add Photos<input type="file" accept="image/*" multiple style={{display:"none"}} onChange={onFiles}/>
            </label>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {photos.map((src,i)=>(
              <div key={i} style={{position:"relative",borderRadius:16,overflow:"hidden",border:`2px solid ${C.greenMid}`}}>
                <img onClick={()=>setLb(src)} src={src} style={{width:108,height:108,objectFit:"cover",display:"block",cursor:"pointer"}} alt=""/>
                <button onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:4,right:4,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.65)",border:"none",color:"#fff",fontSize:13,lineHeight:"22px",textAlign:"center",cursor:"pointer",padding:0}}>×</button>
              </div>
            ))}
            <label style={{width:108,height:108,borderRadius:16,border:`2px dashed ${C.greenMid}`,background:C.greenLight,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:4}}>
              <span style={{fontSize:28,color:C.blue}}>+</span>
              <span style={{fontSize:12,fontWeight:600,color:C.blue}}>Add</span>
              <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={onFiles}/>
            </label>
          </div>
        </div>

        {/* ── WORKOUT ── */}
        {editWo ? (
          <div style={{borderRadius:18,border:`2px solid ${C.blue}`,marginBottom:20,overflow:"hidden"}}>
            <div style={{background:`linear-gradient(135deg,${C.blue},#4ADE80)`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:900,fontSize:16,color:"#fff"}}>✏️ Edit Workout</span>
            </div>
            <div style={{background:C.greenLight,padding:16,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                <div><label style={{fontSize:11,fontWeight:700,color:C.sub,display:"block",marginBottom:4}}>WORKOUT TYPE</label><input style={iStyle} value={woBuf.type} onChange={e=>setWoBuf(w=>({...w,type:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:700,color:C.sub,display:"block",marginBottom:4}}>DURATION</label><input style={iStyle} value={woBuf.duration} onChange={e=>setWoBuf(w=>({...w,duration:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:700,color:C.sub,display:"block",marginBottom:4}}>CALORIES BURNED</label><input style={iStyle} type="number" value={woBuf.calories} onChange={e=>setWoBuf(w=>({...w,calories:+e.target.value}))}/></div>
              </div>
              <div style={{borderTop:`1px solid ${C.greenMid}`,paddingTop:12,marginTop:4}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>Exercises</span>
                  <button onClick={()=>setWoBuf(w=>({...w,exercises:[...w.exercises,{name:"",sets:3,reps:10,weight:""}]}))} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:C.white,color:C.blue,border:`1.5px solid ${C.blue}`,cursor:"pointer"}}>+ Add Exercise</button>
                </div>
                {woBuf.exercises.map((ex,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 80px 36px",gap:8,marginBottom:8,alignItems:"center"}}>
                    <input style={iStyle} placeholder="Exercise name" value={ex.name} onChange={e=>setWoBuf(w=>({...w,exercises:w.exercises.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))}/>
                    <input style={iStyle} type="number" placeholder="Sets" value={ex.sets} onChange={e=>setWoBuf(w=>({...w,exercises:w.exercises.map((x,j)=>j===i?{...x,sets:+e.target.value}:x)}))}/>
                    <input style={iStyle} type="number" placeholder="Reps" value={ex.reps} onChange={e=>setWoBuf(w=>({...w,exercises:w.exercises.map((x,j)=>j===i?{...x,reps:+e.target.value}:x)}))}/>
                    <input style={iStyle} placeholder="Weight" value={ex.weight} onChange={e=>setWoBuf(w=>({...w,exercises:w.exercises.map((x,j)=>j===i?{...x,weight:e.target.value}:x)}))}/>
                    <button onClick={()=>setWoBuf(w=>({...w,exercises:w.exercises.filter((_,j)=>j!==i)}))} style={{width:34,height:34,borderRadius:"50%",border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:18,cursor:"pointer",flexShrink:0}}>×</button>
                  </div>
                ))}
              </div>
              {/* Cardio section inside workout editor */}
              <div style={{borderTop:`1px solid ${C.greenMid}`,paddingTop:12,marginTop:4}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>🏃 Cardio</span>
                  <button onClick={()=>setWoBuf(w=>({...w,cardio:[...w.cardio,{...emptyCardio}]}))} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:C.white,color:C.blue,border:`1.5px solid ${C.blue}`,cursor:"pointer"}}>+ Add Cardio</button>
                </div>
                {woBuf.cardio.map((c,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 90px 90px 36px",gap:8,marginBottom:8,alignItems:"center"}}>
                    <input style={iStyle} placeholder="Type (e.g. Running, Cycling)" value={c.type} onChange={e=>setWoBuf(w=>({...w,cardio:w.cardio.map((x,j)=>j===i?{...x,type:e.target.value}:x)}))}/>
                    <input style={iStyle} placeholder="Duration" value={c.duration} onChange={e=>setWoBuf(w=>({...w,cardio:w.cardio.map((x,j)=>j===i?{...x,duration:e.target.value}:x)}))}/>
                    <input style={iStyle} placeholder="Distance" value={c.distance} onChange={e=>setWoBuf(w=>({...w,cardio:w.cardio.map((x,j)=>j===i?{...x,distance:e.target.value}:x)}))}/>
                    <button onClick={()=>setWoBuf(w=>({...w,cardio:w.cardio.filter((_,j)=>j!==i)}))} style={{width:34,height:34,borderRadius:"50%",border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:18,cursor:"pointer",flexShrink:0}}>×</button>
                  </div>
                ))}
                {woBuf.cardio.length===0 && <div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"8px 0"}}>No cardio logged — click + Add Cardio above</div>}
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={()=>setEditWo(false)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${C.greenMid}`,background:C.white,color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveWorkout} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save Workout</button>
              </div>
            </div>
          </div>
        ) : workout ? (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.greenMid}`,marginBottom:20}}>
            <div style={{background:`linear-gradient(135deg,${C.blue},#4ADE80)`,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:26}}>💪</span>
                <div>
                  <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>{workout.type}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>{workout.duration}  ·  {workout.calories} cal burned</div>
                </div>
              </div>
              <button onClick={()=>{setWoBuf({...workout});setEditWo(true);}} style={{fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:20,background:"rgba(255,255,255,0.2)",color:"#fff",border:"1.5px solid rgba(255,255,255,0.4)",cursor:"pointer"}}>✏️ Edit</button>
            </div>
            <div style={{background:C.greenLight,padding:"12px 16px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 90px",gap:8,paddingBottom:8,marginBottom:4,borderBottom:`1.5px solid ${C.greenMid}`}}>
                {["Exercise","Sets","Reps","Weight"].map(h=><span key={h} style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8}}>{h}</span>)}
              </div>
              {workout.exercises.map((ex,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 90px",gap:8,padding:"10px 8px",borderRadius:10,background:i%2===0?`${C.greenMid}55`:"transparent"}}>
                  <span style={{fontSize:14,fontWeight:600,color:C.text}}>{ex.name}</span>
                  <span style={{fontSize:16,fontWeight:900,color:C.blue,textAlign:"center"}}>{ex.sets}</span>
                  <span style={{fontSize:16,fontWeight:900,color:C.blue,textAlign:"center"}}>{ex.reps}</span>
                  <span style={{fontSize:15,fontWeight:800,color:C.gold,textAlign:"center"}}>{ex.weight}</span>
                </div>
              ))}
              {/* Cardio display */}
              {workout.cardio && workout.cardio.length > 0 && (<>
                <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.greenMid}`}}>
                  <div style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>🏃 Cardio</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 90px 90px",gap:8,paddingBottom:6,marginBottom:4,borderBottom:`1px solid ${C.greenMid}`}}>
                    {["Type","Duration","Distance"].map(h=><span key={h} style={{fontSize:11,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:0.8}}>{h}</span>)}
                  </div>
                  {workout.cardio.map((c,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 90px 90px",gap:8,padding:"8px 4px",borderRadius:10,background:i%2===0?`${C.greenMid}55`:"transparent"}}>
                      <span style={{fontSize:14,fontWeight:600,color:C.text}}>{c.type}</span>
                      <span style={{fontSize:14,fontWeight:700,color:C.blue,textAlign:"center"}}>{c.duration}</span>
                      <span style={{fontSize:14,fontWeight:700,color:C.gold,textAlign:"center"}}>{c.distance}</span>
                    </div>
                  ))}
                </div>
              </>)}
            </div>
          </div>
        ) : (
          <div style={{borderRadius:18,padding:24,textAlign:"center",background:C.greenLight,border:`2px solid ${C.greenMid}`,marginBottom:20}}>
            <div style={{fontSize:34,marginBottom:8}}>😴</div>
            <div style={{fontSize:15,fontWeight:600,color:C.sub,marginBottom:12}}>No workout logged</div>
            <button onClick={()=>{setWoBuf({type:"",duration:"",calories:0,exercises:[]});setEditWo(true);}} style={{padding:"10px 24px",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,color:C.white,fontWeight:700,cursor:"pointer"}}>+ Log Workout</button>
          </div>
        )}

        {/* ── NUTRITION ── */}
        {editNut ? (
          <div style={{borderRadius:18,border:`2px solid ${C.blue}`,overflow:"hidden"}}>
            <div style={{background:`linear-gradient(135deg,${C.blue},#4ADE80)`,padding:"14px 20px"}}>
              <span style={{fontWeight:900,fontSize:16,color:"#fff"}}>✏️ Edit Nutrition</span>
            </div>
            <div style={{background:C.greenLight,padding:16,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
                {[{l:"Calories",k:"calories"},{l:"Protein (g)",k:"protein"},{l:"Carbs (g)",k:"carbs"},{l:"Fat (g)",k:"fat"},{l:"Sugar (g)",k:"sugar"}].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:11,fontWeight:700,color:C.sub,display:"block",marginBottom:4}}>{f.l}</label>
                    <input style={iStyle} type="number" value={(nutBuf as any)[f.k]} onChange={e=>setNutBuf(n=>({...n,[f.k]:+e.target.value}))}/>
                  </div>
                ))}
              </div>
              <div style={{borderTop:`1px solid ${C.greenMid}`,paddingTop:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>Meals</span>
                  <button onClick={()=>setNutBuf(n=>({...n,meals:[...n.meals,{key:"Snack",emoji:"🍎",name:"",cal:0}]}))} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:C.white,color:C.blue,border:`1.5px solid ${C.blue}`,cursor:"pointer"}}>+ Add Meal</button>
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
                <button onClick={()=>setEditNut(false)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${C.greenMid}`,background:C.white,color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveNutrition} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save Nutrition</button>
              </div>
            </div>
          </div>
        ) : nutrition ? (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.greenMid}`}}>
            <button onClick={()=>setNut(n=>!n)} style={{width:"100%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left"}}>
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
            <div style={{background:C.greenLight,padding:16}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:nut?20:0}}>
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
              {nut && <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Nutrition photos */}
                {(nutrition as any).photoUrls && (nutrition as any).photoUrls.length > 0 && (
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    {(nutrition as any).photoUrls.map((src: string, i: number) => (
                      <button key={i} onClick={()=>setLb(src)} style={{padding:0,border:`2px solid ${C.greenMid}`,borderRadius:12,overflow:"hidden",cursor:"pointer",background:"none"}}>
                        <img src={src} style={{width:90,height:90,objectFit:"cover",display:"block"}} alt="Meal photo"/>
                      </button>
                    ))}
                  </div>
                )}
                {nutrition.meals.map(meal=>(
                  <div key={meal.key} style={{background:C.white,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,border:`1.5px solid ${C.greenMid}`}}>
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
              </div>}
            </div>
          </div>
        ) : (
          <div style={{borderRadius:18,padding:24,textAlign:"center",background:C.greenLight,border:`2px solid ${C.greenMid}`}}>
            <div style={{fontSize:34,marginBottom:8}}>🥗</div>
            <div style={{fontSize:15,fontWeight:600,color:C.sub,marginBottom:12}}>No nutrition logged</div>
            <button onClick={()=>{setNutBuf({calories:0,protein:0,carbs:0,fat:0,sugar:0,meals:[]});setEditNut(true);}} style={{padding:"10px 24px",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,color:C.white,fontWeight:700,cursor:"pointer"}}>+ Log Nutrition</button>
          </div>
        )}

        {/* ── WELLNESS ── */}
        {editWell ? (
          <div style={{borderRadius:18,border:`2px solid ${C.blue}`,overflow:"hidden",marginTop:16}}>
            <div style={{background:`linear-gradient(135deg,${C.blue},#4ADE80)`,padding:"14px 20px"}}>
              <span style={{fontWeight:900,fontSize:16,color:"#fff"}}>✏️ Edit Wellness</span>
            </div>
            <div style={{background:C.greenLight,padding:16,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>Activities</span>
                <button onClick={()=>setWellBuf(w=>({entries:[...w.entries,{...emptyWellness}]}))} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:C.white,color:C.blue,border:`1.5px solid ${C.blue}`,cursor:"pointer"}}>+ Add Activity</button>
              </div>
              {wellBuf.entries.map((e,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"50px 1fr 1fr 36px",gap:8,alignItems:"center"}}>
                  <input style={iStyle} placeholder="🧘" value={e.emoji} onChange={ev=>setWellBuf(w=>({entries:w.entries.map((x,j)=>j===i?{...x,emoji:ev.target.value}:x)}))}/>
                  <input style={iStyle} placeholder="Activity (e.g. Cold Plunge)" value={e.activity} onChange={ev=>setWellBuf(w=>({entries:w.entries.map((x,j)=>j===i?{...x,activity:ev.target.value}:x)}))}/>
                  <input style={iStyle} placeholder="Notes (optional)" value={e.notes} onChange={ev=>setWellBuf(w=>({entries:w.entries.map((x,j)=>j===i?{...x,notes:ev.target.value}:x)}))}/>
                  <button onClick={()=>setWellBuf(w=>({entries:w.entries.filter((_,j)=>j!==i)}))} style={{width:34,height:34,borderRadius:"50%",border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:18,cursor:"pointer"}}>×</button>
                </div>
              ))}
              {wellBuf.entries.length===0 && <div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"8px 0"}}>Add wellness activities like meditation, cold plunge, sauna, stretching...</div>}
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={()=>setEditWell(false)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${C.greenMid}`,background:C.white,color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveWellness} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save</button>
              </div>
            </div>
          </div>
        ) : wellness ? (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.greenMid}`,marginTop:16}}>
            <div style={{background:`linear-gradient(135deg,#52C97A,#7AE0A0)`,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:24}}>🌿</span>
                <div>
                  <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>Wellness</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,0.85)"}}>{wellness.entries.map(e=>e.activity).join("  ·  ")}</div>
                </div>
              </div>
              <button onClick={()=>{setWellBuf({...wellness});setEditWell(true);}} style={{fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:20,background:"rgba(255,255,255,0.2)",color:"#fff",border:"1.5px solid rgba(255,255,255,0.4)",cursor:"pointer"}}>✏️ Edit</button>
            </div>
            <div style={{background:"#F0FBF5",padding:14,display:"flex",flexDirection:"column",gap:8}}>
              {wellness.entries.map((e,i)=>(
                <div key={i} style={{background:C.white,borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:14,border:"1.5px solid #C3EFD0"}}>
                  <div style={{width:44,height:44,borderRadius:13,background:"#E8F8EE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{e.emoji}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:15,color:C.text}}>{e.activity}</div>
                    {e.notes && <div style={{fontSize:13,color:C.sub,marginTop:2}}>{e.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{marginTop:12,textAlign:"center"}}>
            <button onClick={()=>{setWellBuf({entries:[]});setEditWell(true);}} style={{fontSize:13,fontWeight:700,padding:"8px 20px",borderRadius:20,border:`1.5px dashed #52C97A`,background:"#F0FBF5",color:"#2E8B57",cursor:"pointer"}}>
              🌿 + Log Wellness (optional)
            </button>
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
    <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.blue}`,marginBottom:20}}>
      <div style={{fontWeight:900,fontSize:17,color:C.text,marginBottom:16}}>{title}</div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
        {list.map((item,i)=>renderItem(item,i,setList))}
      </div>
      <button onClick={()=>setList(l=>[...l,{...emptyItem}])} style={{width:"100%",padding:"9px 0",borderRadius:12,border:`2px dashed ${C.greenMid}`,background:C.greenLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:12}}>+ Add</button>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setEditing(false)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${C.greenMid}`,background:C.white,color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
        <button onClick={()=>{onSave(list);setEditing(false);}} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save</button>
      </div>
    </div>
  );
  return (
    <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.greenMid}`,boxShadow:"0 4px 14px rgba(124,58,237,0.08)",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:900,fontSize:17,color:C.text}}>{title}</div>
        <button onClick={()=>setEditing(true)} style={{fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:20,background:C.greenLight,color:C.blue,border:"none",cursor:"pointer"}}>✏️ Edit</button>
      </div>
      {items.map((item,i)=>(
        <div key={i} style={{background:i%2===0?C.greenLight:C.goldLight,borderRadius:14,padding:"13px 15px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
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
  });

  // Sync profile state from user data
  useEffect(() => {
    if (user?.profile) {
      setProfile({
        name: user.profile.full_name || "",
        username: user.profile.username || "",
        bio: user.profile.bio || "",
      });
    }
  }, [user]);
  const [bannerImg,setBanner] = useState<string|null>(null);
  const [profileImg,setAvatar]= useState<string|null>(null);
  const [editProfile,setEditProfile] = useState(false);
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

  // Load persisted highlights from localStorage on mount
  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(`fit_highlights_${user.id}`);
      if (saved) setHighlights(JSON.parse(saved));
    } catch {}
  }, [user?.id]);

  // Load avatar/banner from profile
  useEffect(() => {
    if (user?.profile?.avatar_url) setAvatar(user.profile.avatar_url);
    if (user?.profile?.banner_url) setBanner(user.profile.banner_url);
  }, [user?.profile?.avatar_url, user?.profile?.banner_url]);
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
          const d = new Date(log.logged_at);
          const key = `${d.getMonth() + 1}.${d.getDate()}`;
          if (!byDate.has(key)) byDate.set(key, []);
          byDate.get(key)!.push(log);
        });

        const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

        const days: typeof DAYS = Array.from(byDate.entries()).map(([dateKey, logs]) => {
          const [month, day] = dateKey.split('.').map(Number);
          const date = new Date(new Date().getFullYear(), month - 1, day);
          const dayName = DAY_NAMES[date.getDay()];

          const workoutLog = logs.find((l: any) => l.log_type === 'workout');
          const nutritionLogs = logs.filter((l: any) => l.log_type === 'nutrition');

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

          return {
            id: dateKey,
            label: dayName,
            emoji: workout ? '💪' : '🌅',
            workout,
            nutrition,
            _workoutLogId: workoutLog?.id || null,
            _nutritionLogIds: nutritionLogs.map((l: any) => l.id),
            photo_url: workoutLog?.photo_url || nutritionLogs[0]?.photo_url || null,
          };
        });

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

  function addHighlight(e:React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if(!f) return;
    const r = new FileReader();
    r.onload = async ev => {
      const dataUrl = ev.target!.result as string;
      let url = dataUrl; // show preview immediately
      setHighlights(h => {
        const next = [...h, url];
        if (user) { try { localStorage.setItem(`fit_highlights_${user.id}`, JSON.stringify(next)); } catch {} }
        return next;
      });
      if (user) {
        const publicUrl = await uploadPhoto(dataUrl, 'avatars', `${user.id}/highlights/${Date.now()}.jpg`);
        if (publicUrl) {
          // Replace the base64 preview with the real URL
          setHighlights(h => {
            const next = h.map(u => u === dataUrl ? publicUrl : u);
            try { localStorage.setItem(`fit_highlights_${user.id}`, JSON.stringify(next)); } catch {}
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
      if (user) {
        try { localStorage.setItem(`fit_highlights_${user.id}`, JSON.stringify(next)); } catch {}
      }
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

  const inputStyle = {width:"100%",background:C.greenLight,border:`1.5px solid ${C.greenMid}`,borderRadius:14,padding:"11px 15px",fontSize:14,color:C.text,outline:"none",boxSizing:"border-box" as const,marginBottom:10};

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
          .profile-outer { padding: 0 0 80px !important; max-width: 100% !important; }
          .profile-stats-bio { padding: 0 16px !important; }
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
            <button onClick={()=>setShowHighlightPicker(false)} style={{width:36,height:36,borderRadius:"50%",border:"none",background:C.greenLight,color:C.text,fontSize:20,cursor:"pointer"}}>×</button>
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
                    }} style={{padding:0,border:`3px solid ${alreadyAdded?C.blue:C.greenMid}`,borderRadius:14,overflow:"hidden",cursor:alreadyAdded?"default":"pointer",background:"none",aspectRatio:"1",position:"relative"}}>
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
            <label style={{display:"flex",alignItems:"center",gap:10,marginTop:20,padding:"14px 16px",borderRadius:16,border:`1.5px dashed ${C.greenMid}`,background:C.greenLight,cursor:"pointer",justifyContent:"center"}}>
              <span style={{fontSize:20}}>📷</span>
              <span style={{fontWeight:700,fontSize:14,color:C.blue}}>Upload from camera roll</span>
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
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",borderBottom:`2px solid ${C.greenMid}`}}>
              <div style={{fontWeight:900,fontSize:18,color:C.text}}>{socialModal==="followers"?"👥 Followers":"➡️ Following"}</div>
              <button onClick={()=>setSocialModal(null)} style={{width:34,height:34,borderRadius:"50%",border:"none",background:C.greenLight,color:C.sub,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
            <div style={{overflowY:"auto",flex:1,padding:"12px 16px"}}>
              {socialLoading ? (
                <div style={{textAlign:"center",padding:"32px 0",color:C.sub}}>
                  <div style={{width:32,height:32,borderRadius:"50%",border:`4px solid ${C.greenMid}`,borderTopColor:C.blue,animation:"spin 0.8s linear infinite",margin:"0 auto 10px"}}/>
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
                    onMouseEnter={e=>(e.currentTarget.style.background=C.greenLight)}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                    onClick={()=>{setSocialModal(null);router.push(`/profile/${u.username}`);}}>
                    <div style={{width:48,height:48,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:"#fff"}}>
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
        <div style={{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",zIndex:99999,background:`linear-gradient(135deg,${C.blue},#4ADE80)`,color:"#fff",fontWeight:800,fontSize:15,padding:"14px 28px",borderRadius:24,boxShadow:"0 8px 32px rgba(124,58,237,0.35)",pointerEvents:"none"}}>
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
                    style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:16,border:`2px solid ${sel?C.blue:C.greenMid}`,background:sel?C.greenLight:C.white,cursor:"pointer",textAlign:"left",opacity:earned?0.55:1}}>
                    <span style={{fontSize:28,flexShrink:0}}>{b.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:14,color:C.text,display:"flex",alignItems:"center",gap:8}}>
                        {b.label}
                        {earned && <span style={{fontSize:11,fontWeight:700,background:"#D1FAE5",color:"#065F46",borderRadius:8,padding:"2px 8px"}}>✓ Earned</span>}
                      </div>
                      <div style={{fontSize:12,color:C.sub,marginTop:2}}>{b.desc}</div>
                    </div>
                    <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${sel?C.blue:C.greenMid}`,background:sel?C.blue:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sel && <div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:700,color:C.sub,display:"block",marginBottom:6}}>Tell us about it (optional)</label>
              <textarea value={badgeNote} onChange={e=>setBadgeNote(e.target.value)} rows={3} placeholder="Share your story..." style={{width:"100%",background:C.greenLight,border:`1.5px solid ${C.greenMid}`,borderRadius:14,padding:"11px 15px",fontSize:14,color:C.text,outline:"none",resize:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:12}}>
              <button onClick={()=>{setShowBadgeModal(false);setSelectedBadge("");setBadgeNote("");}} style={{flex:1,padding:"13px 0",borderRadius:14,border:`2px solid ${C.greenMid}`,background:C.white,color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
              <button onClick={claimBadge} disabled={!selectedBadge} style={{flex:1,padding:"13px 0",borderRadius:14,border:"none",background:selectedBadge?`linear-gradient(135deg,${C.blue},#4ADE80)`:"#E5E7EB",color:selectedBadge?C.white:"#9CA3AF",fontWeight:900,cursor:selectedBadge?"pointer":"not-allowed"}}>Claim Badge</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editProfile && (
        <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.white,borderRadius:28,padding:32,width:"100%",maxWidth:440,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <div style={{fontWeight:900,fontSize:22,color:C.text,marginBottom:20}}>Edit Profile</div>
            <input style={inputStyle} value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))} placeholder="Full Name"/>
            <input style={inputStyle} value={profile.username} onChange={e=>setProfile(p=>({...p,username:e.target.value}))} placeholder="Username"/>
            <textarea style={{...inputStyle,resize:"none"}} rows={3} value={profile.bio} onChange={e=>setProfile(p=>({...p,bio:e.target.value}))} placeholder="Bio"/>
            <div style={{display:"flex",gap:12,marginTop:8}}>
              <button onClick={()=>setEditProfile(false)} style={{flex:1,padding:"13px 0",borderRadius:14,border:`2px solid ${C.greenMid}`,background:C.white,color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
              <button onClick={async()=>{
                if(!user)return;
                await supabase.from('users').update({full_name:profile.name,username:profile.username,bio:profile.bio}).eq('id',user.id);
                await refreshProfile();
                setEditProfile(false);
              }} style={{flex:1,padding:"13px 0",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save</button>
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
            <button onClick={()=>setShowAllPhotos(false)} style={{width:38,height:38,borderRadius:"50%",border:"none",background:C.greenLight,color:C.text,fontSize:22,cursor:"pointer",lineHeight:"38px",textAlign:"center"}}>×</button>
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
                  <button key={idx} onClick={()=>setHighlightLb(src)} style={{padding:0,border:`2px solid ${C.greenMid}`,borderRadius:14,overflow:"hidden",cursor:"pointer",background:"none",aspectRatio:"1"}}>
                    <img src={src} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} alt=""/>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="profile-outer" style={{maxWidth:1400,padding:"32px 24px"}}>

        {/* Profile header */}
        <div className="profile-header-wrap" style={{display:"flex",gap:28,alignItems:"flex-start",flexWrap:"wrap",marginBottom:36}}>
          {/* Avatar */}
          <div className="profile-avatar-col" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,flexShrink:0}}>
            <label style={{position:"relative",cursor:"pointer",display:"block"}}>
              {profileImg
                ? <img src={profileImg} style={{width:150,height:150,borderRadius:"50%",objectFit:"cover",border:`5px solid ${C.blue}`,boxShadow:"0 8px 24px rgba(124,58,237,0.25)",display:"block"}} alt="Profile"/>
                : <div style={{width:150,height:150,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,border:`5px solid ${C.white}`,boxShadow:"0 8px 24px rgba(124,58,237,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:56,fontWeight:900,color:C.white}}>{profile.name[0]}</div>}
              <div style={{position:"absolute",bottom:8,right:8,width:30,height:30,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>📷</div>
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>loadImg(e,setAvatar,user?{bucket:'avatars',path:`${user.id}/avatar.jpg`,dbField:'avatar_url'}:undefined)}/>
            </label>
            <div style={{textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:19,color:C.text}}>{profile.name}</div>
              <div style={{fontSize:13,color:C.sub}}>@{profile.username}</div>
            </div>
          </div>

          {/* Banner + stats */}
          <div className="profile-banner-block" style={{flex:1,minWidth:260}}>
            <div className="profile-banner-label" style={{width:"100%",height:155,borderRadius:26,overflow:"hidden",position:"relative",marginBottom:14,background:bannerImg?"transparent":`linear-gradient(135deg,${C.blue},#BBF7D0)`,border:`2px solid ${C.greenMid}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {bannerImg
                ? <img src={bannerImg} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="Banner"/>
                : <span style={{fontWeight:900,fontSize:17,color:"rgba(255,255,255,0.7)"}}>📷 Tap to add Banner</span>}
              {/* Always-visible camera button overlay for banner */}
              <label style={{position:"absolute",bottom:10,right:10,background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"6px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,zIndex:5}}>
                <span style={{fontSize:16}}>📷</span>
                <span style={{color:"#fff",fontSize:12,fontWeight:700}}>Change</span>
                <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>loadImg(e,setBanner,user?{bucket:'avatars',path:`${user.id}/banner.jpg`,dbField:'banner_url'}:undefined)}/>
              </label>
            </div>

            <div className="profile-stats-bio">
            <p style={{fontSize:14,color:C.sub,marginBottom:14,lineHeight:1.55}}>{profile.bio}</p>

            <div style={{background:C.white,borderRadius:18,padding:"14px 18px",display:"flex",justifyContent:"center",gap:40,border:`1.5px solid ${C.greenMid}`,marginBottom:14}}>
              {[
                {l:"Followers",v:user?.profile?.followers_count??0,onClick:()=>openSocialModal("followers")},
                {l:"Following",v:user?.profile?.following_count??0,onClick:()=>openSocialModal("following")},
              ].map(s=>(
                <div key={s.l} onClick={s.onClick} style={{textAlign:"center",cursor:s.onClick?"pointer":"default",borderRadius:12,padding:"4px 0",transition:"background 0.15s"}}
                  onMouseEnter={e=>{if(s.onClick)(e.currentTarget as HTMLDivElement).style.background=C.greenLight}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background="transparent"}}>
                  <div style={{fontSize:22,fontWeight:900,color:C.blue}}>{s.v}</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>

            <button onClick={()=>setEditProfile(true)} style={{padding:"11px 22px",borderRadius:14,border:`2px solid ${C.blue}`,background:C.white,color:C.blue,fontWeight:700,fontSize:14,cursor:"pointer"}}>
              ✏️ Edit Profile
            </button>
            </div>{/* end profile-stats-bio */}
          </div>
        </div>

        {/* 3-column */}
        <div className="profile-layout" style={{display:"grid",gridTemplateColumns:"260px 1fr 260px",gap:24,alignItems:"start"}}>

          {/* LEFT — Highlights */}
          <div>
            <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.greenMid}`,boxShadow:"0 4px 14px rgba(124,58,237,0.08)",marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontWeight:900,fontSize:17,color:C.text}}>📸 Highlights</div>
                <button onClick={()=>setShowAllPhotos(true)} style={{fontSize:12,fontWeight:700,padding:"5px 12px",borderRadius:20,background:C.greenLight,color:C.blue,border:`1.5px solid ${C.greenMid}`,cursor:"pointer"}}>📷 All Photos</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {Array.from({length:HIGHLIGHT_SLOTS}).map((_,i) => {
                  const src = highlights[i];
                  if (src) {
                    return (
                      <div key={i} className="highlight-slot" style={{position:"relative",aspectRatio:"1",borderRadius:12,overflow:"hidden",cursor:"pointer"}}>
                        <img onClick={()=>setHighlightLb(src)} src={src} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} alt=""/>
                        <button
                          className="highlight-remove"
                          onClick={()=>removeHighlight(i)}
                          style={{position:"absolute",top:4,right:4,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.65)",border:"none",color:"#fff",fontSize:14,lineHeight:"22px",textAlign:"center",cursor:"pointer",opacity:0,transition:"opacity 0.15s",padding:0}}>×</button>
                      </div>
                    );
                  }
                  if (i === highlights.length) {
                    return (
                      <button key={i} onClick={()=>setShowHighlightPicker(true)} style={{aspectRatio:"1",borderRadius:12,border:`2px dashed ${C.greenMid}`,background:C.greenLight,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:2,padding:0}}>
                        <span style={{fontSize:22,color:C.blue,lineHeight:1}}>+</span>
                        <span style={{fontSize:9,color:C.sub,fontWeight:600}}>Add</span>
                      </button>
                    );
                  }
                  return (
                    <div key={i} style={{aspectRatio:"1",borderRadius:12,background:`${C.greenMid}55`,border:`1px solid ${C.greenMid}`}}/>
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
            {/* Badge milestone cards in timeline */}
            {earnedBadges.length > 0 && (
              <div style={{marginBottom:16}}>
                {BADGES.filter(b=>earnedBadges.includes(b.id)).map(b=>(
                  <div key={b.id} style={{background:`linear-gradient(135deg,${C.gold}22,${C.goldLight})`,border:`2px solid ${C.gold}`,borderRadius:20,padding:"16px 20px",marginBottom:12,display:"flex",alignItems:"center",gap:14}}>
                    <div style={{width:52,height:52,borderRadius:16,background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>{b.emoji}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:900,fontSize:15,color:C.text}}>🏆 {b.label}</div>
                      <div style={{fontSize:12,color:C.sub,marginTop:2}}>{b.desc}</div>
                    </div>
                    <div style={{fontSize:11,color:C.gold,fontWeight:700}}>Milestone!</div>
                  </div>
                ))}
              </div>
            )}
            {loadingLogs ? (
              <div style={{textAlign:"center",padding:"40px 0",color:C.sub}}>
                <div style={{width:36,height:36,borderRadius:"50%",border:`4px solid ${C.greenMid}`,borderTopColor:C.blue,animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <div style={{fontSize:14}}>Loading activity log...</div>
              </div>
            ) : (
              (realDays.length > 0 ? realDays : DAYS).map(day => {
                const isReal = realDays.length > 0;
                return (
                  <DayCard
                    key={day.id}
                    day={day as any}
                    workoutLogId={(day as any)._workoutLogId}
                    nutritionLogIds={(day as any)._nutritionLogIds}
                    onDelete={isReal ? async () => {
                      const wid = (day as any)._workoutLogId;
                      const nids: string[] = (day as any)._nutritionLogIds || [];
                      const allIds = [...(wid ? [wid] : []), ...nids];
                      if (allIds.length > 0) {
                        await supabase.from('activity_logs').delete().in('id', allIds);
                      }
                      setRealDays(prev => prev.filter(d => d.id !== day.id));
                    } : undefined}
                  />
                );
              })
            )}
          </div>

          {/* RIGHT */}
          <div>
            {/* Badges & Awards */}
            <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.greenMid}`,boxShadow:"0 4px 14px rgba(124,58,237,0.08)",marginBottom:20}}>
              <div style={{fontWeight:900,fontSize:17,color:C.text,marginBottom:16}}>🏆 Badges & Awards</div>
              {earnedBadges.length === 0 ? (
                <div style={{textAlign:"center",padding:"28px 16px",background:C.greenLight,borderRadius:16,marginBottom:16}}>
                  <div style={{fontSize:36,marginBottom:8}}>🏆</div>
                  <div style={{fontSize:14,fontWeight:700,color:C.sub,lineHeight:1.5}}>Complete fitness milestones to earn badges</div>
                </div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                  {BADGES.filter(b=>earnedBadges.includes(b.id)).map(b => (
                    <div key={b.id} style={{
                      borderRadius:16,
                      padding:"14px 8px",
                      textAlign:"center",
                      border:"1.5px solid #F5A623",
                      background:C.goldLight,
                      boxShadow:"0 0 12px rgba(245,166,35,0.35)",
                      transition:"all 0.2s",
                    }}>
                      <div style={{fontSize:26,marginBottom:4}}>{b.emoji}</div>
                      <div style={{fontWeight:800,fontSize:11,color:C.text,lineHeight:1.3}}>{b.label}</div>
                      <div style={{fontSize:10,color:C.sub,marginTop:3,lineHeight:1.3}}>{b.desc}</div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={()=>setShowBadgeModal(true)} style={{width:"100%",padding:"13px 0",borderRadius:16,border:"none",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,color:C.white,fontWeight:900,fontSize:14,cursor:"pointer"}}>
                🏆 Report an Achievement
              </button>
            </div>

            <EditableList title="Favorite Brands" items={brands} onSave={setBrands} emptyItem={{emoji:"👟",name:"New Brand"}}
              renderItem={(item,i,setList)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input style={{width:48,borderRadius:10,border:`1.5px solid ${C.greenMid}`,padding:"8px 4px",textAlign:"center",fontSize:18,outline:"none",background:C.greenLight}} value={item.emoji} onChange={e=>setList(l=>l.map((x:any,j:number)=>j===i?{...x,emoji:e.target.value}:x))}/>
                  <input style={{flex:1,borderRadius:10,border:`1.5px solid ${C.greenMid}`,padding:"8px 12px",fontSize:14,color:C.text,outline:"none",background:C.greenLight}} value={item.name} onChange={e=>setList(l=>l.map((x:any,j:number)=>j===i?{...x,name:e.target.value}:x))}/>
                  <button onClick={()=>setList(l=>l.filter((_:any,j:number)=>j!==i))} style={{width:28,height:28,borderRadius:"50%",border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:16,cursor:"pointer"}}>×</button>
                </div>
              )}/>

            <button style={{width:"100%",padding:"14px 0",borderRadius:16,border:`2px solid ${C.greenMid}`,background:C.white,color:C.sub,fontWeight:700,fontSize:14,cursor:"pointer"}}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

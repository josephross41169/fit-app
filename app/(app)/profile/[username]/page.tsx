"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import FollowButton from "@/components/FollowButton";

const C = {
  bg:"#0D0D0D", white:"#1A1A1A", greenLight:"#1A2A1A", greenMid:"#2A3A2A",
  blue:"#16A34A", text:"#F0F0F0", sub:"#9CA3AF", gold:"#F5A623", goldLight:"#2A1F00",
  darkCard:"#1A1A1A", darkBorder:"#2A2A2A", darkSub:"#6B7280",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Badge definitions ─────────────────────────────────────────────────────────
const BADGES = [
  {id:"1k-club",emoji:"🏋️",label:"1,000 lb Club",desc:"Squat + Bench + Deadlift ≥ 1,000 lbs",category:"strength"},
  {id:"heavy-lifter",emoji:"💪",label:"Heavy Lifter",desc:"Logged a single lift over 300 lbs",category:"strength"},
  {id:"pb-crusher",emoji:"🚀",label:"PB Crusher",desc:"Set 5 personal bests in one month",category:"strength"},
  {id:"iron-maiden",emoji:"⚒️",label:"Iron Maiden",desc:"Deadlifted 2x your bodyweight",category:"strength"},
  {id:"bench-200",emoji:"🪨",label:"200 Club",desc:"Bench pressed 200 lbs",category:"strength"},
  {id:"squat-300",emoji:"🦵",label:"Squat King",desc:"Back squatted 300 lbs",category:"strength"},
  {id:"deadlift-400",emoji:"⚓",label:"Deadlift Beast",desc:"Deadlifted 400 lbs",category:"strength"},
  {id:"overhead-bw",emoji:"🙌",label:"Overhead Master",desc:"Overhead pressed your bodyweight",category:"strength"},
  {id:"weighted-pullup",emoji:"🧲",label:"Weighted Pull-Up",desc:"Completed a pull-up with added weight",category:"strength"},
  {id:"sandbag",emoji:"🏜️",label:"Sandbag Warrior",desc:"Completed a sandbag carry workout",category:"strength"},
  {id:"farmer-carry",emoji:"🌾",label:"Farmer Strong",desc:"Farmer carried 100 lbs per hand",category:"strength"},
  {id:"atlas-stone",emoji:"🪨",label:"Atlas Stone",desc:"Lifted an atlas stone",category:"strength"},
  {id:"1rm-pr",emoji:"🎯",label:"One Rep Max",desc:"Hit a 1RM personal record",category:"strength"},
  {id:"powerlifter",emoji:"🏆",label:"Powerlifter",desc:"Competed in a powerlifting meet",category:"strength"},
  {id:"kettlebell-king",emoji:"🔔",label:"Kettlebell King",desc:"Completed 100 kettlebell swings in a row",category:"strength"},
  {id:"marathon",emoji:"🏅",label:"Marathon Runner",desc:"Completed a 26.2 mile run",category:"cardio"},
  {id:"6min-mile",emoji:"⚡",label:"6 Minute Mile",desc:"Ran a mile in under 6 minutes",category:"cardio"},
  {id:"half-marathon",emoji:"🏃",label:"Half Marathoner",desc:"Completed a 13.1 mile run",category:"cardio"},
  {id:"5k",emoji:"🎽",label:"5K Runner",desc:"Completed your first 5K",category:"cardio"},
  {id:"10k",emoji:"🏁",label:"10K Runner",desc:"Completed your first 10K",category:"cardio"},
  {id:"ultra",emoji:"🌄",label:"Ultra Runner",desc:"Completed an ultra marathon (50K+)",category:"cardio"},
  {id:"century-ride",emoji:"🚴",label:"Century Rider",desc:"Cycled 100 miles in one ride",category:"cardio"},
  {id:"triathlon",emoji:"🏊",label:"Triathlete",desc:"Completed a triathlon",category:"cardio"},
  {id:"ironman",emoji:"🦾",label:"Ironman",desc:"Completed a full Ironman",category:"cardio"},
  {id:"swim-mile",emoji:"🌊",label:"Open Water Swimmer",desc:"Swam 1 mile in open water",category:"cardio"},
  {id:"speed-demon",emoji:"💨",label:"Speed Demon",desc:"Averaged 8 mph or faster on a run",category:"cardio"},
  {id:"hill-climber",emoji:"⛰️",label:"Hill Climber",desc:"Ran a race with 1,000+ feet of elevation gain",category:"cardio"},
  {id:"stair-master",emoji:"🪜",label:"Stair Master",desc:"Climbed 100 flights of stairs in a day",category:"cardio"},
  {id:"jump-rope",emoji:"🪢",label:"Jump Rope Pro",desc:"Jump roped for 10 minutes straight",category:"cardio"},
  {id:"rowing-10k",emoji:"🚣",label:"Rower",desc:"Rowed 10,000 meters in one session",category:"cardio"},
  {id:"7day-streak",emoji:"🔥",label:"7 Day Streak",desc:"Logged activity 7 days in a row",category:"consistency"},
  {id:"early-bird",emoji:"🌅",label:"Early Bird",desc:"Logged 5 workouts before 7am",category:"consistency"},
  {id:"centurion",emoji:"💯",label:"Centurion",desc:"Logged 100 workouts total",category:"consistency"},
  {id:"nutrition-pro",emoji:"🥗",label:"Nutrition Pro",desc:"Hit macro goals 14 days in a row",category:"consistency"},
  {id:"30day-streak",emoji:"🗓️",label:"30 Day Streak",desc:"Logged activity 30 days in a row",category:"consistency"},
  {id:"90day-streak",emoji:"💎",label:"90 Day Grind",desc:"Logged activity 90 days in a row",category:"consistency"},
  {id:"365day",emoji:"🌟",label:"Year Warrior",desc:"Logged activity 365 days in a year",category:"consistency"},
  {id:"50-workouts",emoji:"🥈",label:"50 Strong",desc:"Logged 50 total workouts",category:"consistency"},
  {id:"500-workouts",emoji:"👑",label:"500 Legend",desc:"Logged 500 total workouts",category:"consistency"},
  {id:"morning-ritual",emoji:"☀️",label:"Morning Ritual",desc:"Logged 30 morning workouts",category:"consistency"},
  {id:"weekend-warrior",emoji:"⚔️",label:"Weekend Warrior",desc:"Worked out every weekend for a month",category:"consistency"},
  {id:"no-days-off",emoji:"🚫",label:"No Days Off",desc:"Logged at least one activity every day for 14 days",category:"consistency"},
  {id:"comeback",emoji:"🔄",label:"Comeback Kid",desc:"Returned to logging after a 30-day break",category:"consistency"},
  {id:"yoga-lover",emoji:"🧘",label:"Yoga Lover",desc:"Logged 10+ yoga sessions",category:"wellness"},
  {id:"meditation-master",emoji:"🕊️",label:"Meditation Master",desc:"Logged 30 meditation sessions",category:"wellness"},
  {id:"sleep-champ",emoji:"😴",label:"Sleep Champion",desc:"Logged 8+ hours of sleep 7 nights in a row",category:"wellness"},
  {id:"hydration-hero",emoji:"💧",label:"Hydration Hero",desc:"Hit daily water goal 14 days in a row",category:"wellness"},
  {id:"stretch-it-out",emoji:"🤸",label:"Stretch It Out",desc:"Logged 20 stretching or mobility sessions",category:"wellness"},
  {id:"ice-bath",emoji:"🧊",label:"Ice Bath Club",desc:"Took 5 ice baths or cold plunges",category:"wellness"},
  {id:"sauna",emoji:"🔆",label:"Sauna Regular",desc:"Logged 10 sauna sessions",category:"wellness"},
  {id:"breathwork",emoji:"🫁",label:"Breathwork Practitioner",desc:"Completed 10 breathwork sessions",category:"wellness"},
  {id:"zero-alcohol",emoji:"🫗",label:"Sober Streak",desc:"Logged 30 alcohol-free days",category:"wellness"},
  {id:"step-10k",emoji:"👟",label:"10K Steps",desc:"Hit 10,000 steps daily for 7 days",category:"wellness"},
  {id:"step-15k",emoji:"🦿",label:"Step Master",desc:"Hit 15,000 steps in a single day",category:"wellness"},
  {id:"posture",emoji:"🪑",label:"Posture Pro",desc:"Completed 20 posture/mobility workouts",category:"wellness"},
  {id:"nature-walk",emoji:"🌿",label:"Nature Walker",desc:"Logged 10 outdoor walks",category:"wellness"},
  {id:"calorie-goals",emoji:"🎯",label:"On Target",desc:"Hit calorie goal 7 days in a row",category:"nutrition"},
  {id:"protein-streak",emoji:"🥩",label:"Protein Streak",desc:"Hit protein goal 14 days in a row",category:"nutrition"},
  {id:"meal-prep",emoji:"🍱",label:"Meal Prepper",desc:"Logged 10 weeks of meal prep",category:"nutrition"},
  {id:"plant-week",emoji:"🌱",label:"Plant Week",desc:"Ate plant-based for 7 days",category:"nutrition"},
  {id:"sugar-free",emoji:"🚫",label:"Sugar Free",desc:"Avoided added sugar for 14 days",category:"nutrition"},
  {id:"macro-master",emoji:"⚖️",label:"Macro Master",desc:"Hit all 3 macro goals in a single day",category:"nutrition"},
  {id:"barcode-10",emoji:"📱",label:"Scanner",desc:"Logged 10 foods via barcode scan",category:"nutrition"},
  {id:"barcode-100",emoji:"📊",label:"Data Logger",desc:"Logged 100 foods via barcode scan",category:"nutrition"},
  {id:"fasting",emoji:"⏳",label:"Fasting Pro",desc:"Completed a 24-hour fast",category:"nutrition"},
  {id:"clean-30",emoji:"🥦",label:"Clean 30",desc:"Ate clean for 30 days straight",category:"nutrition"},
  {id:"iron-will",emoji:"🪖",label:"Iron Will",desc:"Completed a 30-day challenge",category:"challenges"},
  {id:"75-hard",emoji:"🔩",label:"75 Hard",desc:"Completed the 75 Hard program",category:"challenges"},
  {id:"murph",emoji:"🇺🇸",label:"Murph",desc:"Completed the Murph workout",category:"challenges"},
  {id:"spartan",emoji:"🏔️",label:"Spartan",desc:"Completed a Spartan Race",category:"challenges"},
  {id:"tough-mudder",emoji:"🪤",label:"Tough Mudder",desc:"Completed a Tough Mudder",category:"challenges"},
  {id:"crossfit-open",emoji:"🏅",label:"CrossFit Open",desc:"Competed in the CrossFit Open",category:"challenges"},
  {id:"pushup-100",emoji:"⬇️",label:"100 Push-Ups",desc:"Did 100 push-ups in one session",category:"challenges"},
  {id:"plank-5min",emoji:"⏱️",label:"Plank Legend",desc:"Held a plank for 5 minutes",category:"challenges"},
  {id:"burpee-100",emoji:"🌀",label:"Burpee Beast",desc:"Completed 100 burpees in one session",category:"challenges"},
  {id:"pullup-20",emoji:"⬆️",label:"Pull-Up Pro",desc:"Did 20 consecutive pull-ups",category:"challenges"},
  {id:"first-post",emoji:"📸",label:"First Post",desc:"Made your first post on the feed",category:"social"},
  {id:"10-posts",emoji:"📷",label:"Content Creator",desc:"Made 10 posts on the feed",category:"social"},
  {id:"first-follower",emoji:"👥",label:"First Follower",desc:"Got your first follower",category:"social"},
  {id:"100-followers",emoji:"🌐",label:"Rising Star",desc:"Reached 100 followers",category:"social"},
  {id:"group-member",emoji:"🤝",label:"Group Member",desc:"Joined your first group",category:"social"},
  {id:"group-leader",emoji:"🎙️",label:"Group Leader",desc:"Created a group",category:"social"},
  {id:"first-like",emoji:"❤️",label:"Liked",desc:"Received your first like",category:"social"},
  {id:"motivator",emoji:"🙌",label:"Motivator",desc:"Had a post liked 50+ times",category:"social"},
  {id:"veteran",emoji:"🎖️",label:"Veteran",desc:"US Military Service",category:"special"},
  {id:"first-gym",emoji:"🏟️",label:"Gym Rat",desc:"Checked into a gym for the first time",category:"special"},
  {id:"coach",emoji:"🎓",label:"Coach",desc:"Became a certified fitness coach",category:"special"},
  {id:"personal-trainer",emoji:"📋",label:"Personal Trainer",desc:"Earned a personal training certification",category:"special"},
  {id:"transformation",emoji:"🦋",label:"Transformation",desc:"Completed a 90-day body transformation",category:"special"},
  {id:"comeback-story",emoji:"💫",label:"Comeback Story",desc:"Returned from injury and hit a new PR",category:"special"},
  {id:"birthday-workout",emoji:"🎂",label:"Birthday Grind",desc:"Worked out on your birthday",category:"special"},
  {id:"new-years",emoji:"🎆",label:"New Year, New Me",desc:"Logged a workout on January 1st",category:"special"},
  {id:"holiday-hustle",emoji:"🎄",label:"Holiday Hustle",desc:"Worked out on a major holiday",category:"special"},
  {id:"collab",emoji:"🤜",label:"Workout Partner",desc:"Logged a workout with a friend",category:"special"},
  {id:"outdoor-adventurer",emoji:"🧗",label:"Outdoor Adventurer",desc:"Completed a hike, climb, or outdoor adventure",category:"special"},
  {id:"sport-competitor",emoji:"🏆",label:"Competitor",desc:"Competed in any athletic event",category:"special"},
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

// ── Read-only Day Card ────────────────────────────────────────────────────────
function ReadOnlyDayCard({day}:{day:any}) {
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

  return (<>
    {lb && <Lightbox src={lb} onClose={()=>setLb(null)}/>}
    <div style={{background:C.white,borderRadius:22,border:`2px solid ${C.greenMid}`,marginBottom:16,overflow:"hidden"}}>
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
            <img src={photos[0]} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
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
                <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.greenMid}`}}>
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
            <div style={{background:"#0D1A0D",padding:14,display:"flex",flexDirection:"column",gap:8}}>
              {wellness.entries.map((e:any,i:number)=>(
                <div key={i} style={{background:C.white,borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:14,border:"1.5px solid #2A3A2A"}}>
                  <div style={{width:44,height:44,borderRadius:13,background:"#1A2A1A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{e.emoji}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:15,color:C.text}}>{e.activity}</div>
                    {e.notes && <div style={{fontSize:13,color:C.sub,marginTop:2}}>{e.notes}</div>}
                  </div>
                </div>
              ))}
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
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [brands, setBrands]         = useState<any[]>([]);
  const [highlightLb, setHighlightLb] = useState<string|null>(null);

  const HIGHLIGHT_SLOTS = 9;
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  useEffect(() => {
    async function load() {
      // Load profile
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (!profileData) { setLoading(false); return; }
      setProfile(profileData);

      // Load highlights
      if (profileData.highlights && Array.isArray(profileData.highlights)) {
        const validUrls = profileData.highlights.filter((u: string) => u && (u.startsWith('http') || u.startsWith('/')));
        setHighlights(validUrls);
      }

      // Load brands from profile
      if (profileData.favorite_brands && Array.isArray(profileData.favorite_brands)) {
        setBrands(profileData.favorite_brands);
      }

      // Load activity logs
      const { data: activityLogs } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', profileData.id)
        .order('logged_at', { ascending: false })
        .limit(30);

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

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:80}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @media(max-width:767px){.up-layout{display:flex!important;flex-direction:column!important;} .up-layout>*{width:100%!important;min-width:unset!important;max-width:100%!important;}}`}</style>

      {highlightLb && <Lightbox src={highlightLb} onClose={()=>setHighlightLb(null)}/>}

      {/* ── Banner ── */}
      <div style={{height:220,background:profile.banner_url?"transparent":`linear-gradient(135deg,${C.blue},#4ADE80)`,position:"relative",flexShrink:0}}>
        {profile.banner_url && (
          <img src={profile.banner_url} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:`center ${profile.banner_position ?? 50}%`}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
        )}
      </div>

      {/* ── Avatar + Action Buttons ── */}
      <div style={{background:C.white,borderBottom:`1px solid ${C.greenMid}`,paddingBottom:16}}>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",paddingLeft:24,paddingRight:24,marginTop:-44}}>
          <div style={{width:88,height:88,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,border:`4px solid ${C.white}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:900,color:"#fff",overflow:"hidden",flexShrink:0,zIndex:2}}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:`center ${profile.avatar_position ?? 50}%`}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
              : initials}
          </div>
          <div style={{display:"flex",gap:8,paddingBottom:4}}>
            <FollowButton targetUserId={profile.id} />
            {currentUser && currentUser.id !== profile.id && (
              <button
                onClick={async () => {
                  const res = await fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ action:'create_conversation', payload:{ userId: currentUser.id, otherUserId: profile.id }}) });
                  const json = await res.json();
                  if (json.conversationId) router.push('/messages');
                }}
                style={{padding:"8px 16px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.white,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
              >
                ✉️ Message
              </button>
            )}
          </div>
        </div>

        <div style={{padding:"12px 24px 0"}}>
          <div style={{fontWeight:900,fontSize:20,color:C.text}}>{profile.full_name}</div>
          <div style={{fontSize:13,color:C.sub,marginTop:2}}>@{profile.username}</div>
          {profile.city && <div style={{fontSize:12,color:C.sub,marginTop:3}}>📍 {profile.city}</div>}
          {profile.bio && <p style={{fontSize:14,color:C.sub,marginTop:6,lineHeight:1.55}}>{profile.bio}</p>}

          {/* Followers / Following pill bar */}
          <div style={{display:"flex",alignItems:"stretch",gap:0,marginTop:12,borderRadius:16,overflow:"hidden",border:`1px solid ${C.greenMid}`,maxWidth:320}}>
            {[
              {l:"Followers",v:profile.followers_count??0},
              {l:"Following",v:profile.following_count??0},
            ].map((s,i)=>(
              <div key={s.l} style={{flex:1,textAlign:"center",padding:"12px 10px",background:"#111811",borderLeft:i>0?`1px solid ${C.greenMid}`:"none"}}>
                <div style={{fontSize:22,fontWeight:900,color:C.blue,lineHeight:1}}>{(s.v||0).toLocaleString()}</div>
                <div style={{fontSize:11,color:C.sub,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3-Column Layout ── */}
      <div style={{maxWidth:1400,margin:"0 auto",padding:"24px 24px 0"}}>
        <div className="up-layout" style={{display:"grid",gridTemplateColumns:"220px 1fr 260px",gap:24,alignItems:"start"}}>

          {/* LEFT — Highlights */}
          <div>
            <div style={{background:C.white,borderRadius:22,padding:20,border:`2px solid ${C.greenMid}`,marginBottom:20}}>
              <div style={{fontWeight:900,fontSize:16,color:C.text,marginBottom:14}}>📸 Highlights</div>
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
            {days.length === 0 ? (
              <div style={{textAlign:"center",padding:"48px 20px",background:C.white,borderRadius:22,border:`2px solid ${C.greenMid}`,color:C.sub}}>
                <div style={{fontSize:48,marginBottom:8}}>💪</div>
                <p style={{fontWeight:700,fontSize:15}}>No public activity yet</p>
              </div>
            ) : (
              days.map(day => <ReadOnlyDayCard key={day.id} day={day}/>)
            )}
          </div>

          {/* RIGHT — Badges + Brands */}
          <div>
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
    </div>
  );
}

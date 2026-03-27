"use client";
import { useState } from "react";

const C = {
  blue:"#4BBFD6", greenLight:"#E8F7FB", greenMid:"#B8E8F5",
  gold:"#F5A623", goldLight:"#FFFBEE",
  text:"#1A2B3C", sub:"#5A7A8A", white:"#FFFFFF", bg:"#F0F9FC",
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

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({src,onClose}:{src:string;onClose:()=>void}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <button onClick={onClose} style={{position:"absolute",top:20,right:28,background:"none",border:"none",color:"#fff",fontSize:36,cursor:"pointer",lineHeight:1}}>×</button>
      <img src={src} style={{maxWidth:"90vw",maxHeight:"85vh",borderRadius:20,objectFit:"contain"}} alt="" />
    </div>
  );
}

type Exercise = {name:string;sets:number;reps:number;weight:string};
type Meal = {key:string;emoji:string;name:string;cal:number};
type Workout = {type:string;duration:string;calories:number;exercises:Exercise[]};
type Nutrition = {calories:number;protein:number;carbs:number;fat:number;sugar:number;meals:Meal[]};

const iStyle = {background:C.greenLight,border:`1.5px solid ${C.greenMid}`,borderRadius:10,padding:"7px 10px",fontSize:13,color:C.text,outline:"none",width:"100%",boxSizing:"border-box" as const};

// ── Day Card ──────────────────────────────────────────────────────────────────
function DayCard({day}:{day:typeof DAYS[0]}) {
  const [open,setOpen]     = useState(false);
  const [nut,setNut]       = useState(false);
  const [editWo,setEditWo] = useState(false);
  const [editNut,setEditNut] = useState(false);
  const [photos,setPhotos] = useState<string[]>([]);
  const [lb,setLb]         = useState<string|null>(null);
  const [workout,setWorkout]   = useState<Workout|null>(day.workout as Workout|null);
  const [nutrition,setNutrition] = useState<Nutrition|null>(day.nutrition as Nutrition|null);
  // edit buffers
  const [woBuf,setWoBuf]   = useState<Workout>(workout ?? {type:"",duration:"",calories:0,exercises:[]});
  const [nutBuf,setNutBuf] = useState<Nutrition>(nutrition ?? {calories:0,protein:0,carbs:0,fat:0,sugar:0,meals:[]});
  const [m,d] = day.id.split(".").map(Number);

  function onFiles(e:React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files??[]).forEach(f=>{
      const r=new FileReader(); r.onload=ev=>setPhotos(p=>[...p,ev.target!.result as string]); r.readAsDataURL(f);
    }); e.target.value="";
  }

  function saveWorkout() { setWorkout({...woBuf}); setEditWo(false); }
  function saveNutrition() { setNutrition({...nutBuf}); setEditNut(false); }

  return (<>
    {lb && <Lightbox src={lb} onClose={()=>setLb(null)}/>}
    <div style={{background:C.white,borderRadius:22,border:`2px solid ${C.greenMid}`,boxShadow:"0 4px 18px rgba(75,191,214,0.10)",marginBottom:16,overflow:"hidden"}}>

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
              <button key={i} onClick={()=>setLb(src)} style={{padding:0,border:`2px solid ${C.greenMid}`,borderRadius:16,overflow:"hidden",cursor:"pointer",background:"none"}}>
                <img src={src} style={{width:108,height:108,objectFit:"cover",display:"block"}} alt=""/>
              </button>
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
            <div style={{background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
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
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={()=>setEditWo(false)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${C.greenMid}`,background:C.white,color:C.sub,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveWorkout} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save Workout</button>
              </div>
            </div>
          </div>
        ) : workout ? (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.greenMid}`,marginBottom:20}}>
            <div style={{background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
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
            </div>
          </div>
        ) : (
          <div style={{borderRadius:18,padding:24,textAlign:"center",background:C.greenLight,border:`2px solid ${C.greenMid}`,marginBottom:20}}>
            <div style={{fontSize:34,marginBottom:8}}>😴</div>
            <div style={{fontSize:15,fontWeight:600,color:C.sub,marginBottom:12}}>No workout logged</div>
            <button onClick={()=>{setWoBuf({type:"",duration:"",calories:0,exercises:[]});setEditWo(true);}} style={{padding:"10px 24px",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,color:C.white,fontWeight:700,cursor:"pointer"}}>+ Log Workout</button>
          </div>
        )}

        {/* ── NUTRITION ── */}
        {editNut ? (
          <div style={{borderRadius:18,border:`2px solid ${C.blue}`,overflow:"hidden"}}>
            <div style={{background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,padding:"14px 20px"}}>
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
                <button onClick={saveNutrition} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save Nutrition</button>
              </div>
            </div>
          </div>
        ) : nutrition ? (
          <div style={{borderRadius:18,overflow:"hidden",border:`2px solid ${C.greenMid}`}}>
            <button onClick={()=>setNut(n=>!n)} style={{width:"100%",background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left"}}>
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
            <button onClick={()=>{setNutBuf({calories:0,protein:0,carbs:0,fat:0,sugar:0,meals:[]});setEditNut(true);}} style={{padding:"10px 24px",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,color:C.white,fontWeight:700,cursor:"pointer"}}>+ Log Nutrition</button>
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
        <button onClick={()=>{onSave(list);setEditing(false);}} style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save</button>
      </div>
    </div>
  );
  return (
    <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.greenMid}`,boxShadow:"0 4px 14px rgba(75,191,214,0.08)",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:900,fontSize:17,color:C.text}}>{title}</div>
        <button onClick={()=>setEditing(true)} style={{fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:20,background:C.greenLight,color:C.blue,border:"none",cursor:"pointer"}}>✏️ Edit</button>
      </div>
      {items.map((item,i)=>(
        <div key={i} style={{background:i%2===0?C.greenLight:C.goldLight,borderRadius:14,padding:"13px 15px",marginBottom:10}}>
          {Object.entries(item).map(([k,v])=>(
            <div key={k} style={{fontSize:13,color:C.text,marginBottom:2}}>
              <span style={{fontWeight:700,textTransform:"capitalize"}}>{k}: </span>
              <span style={{color:C.sub}}>{v as string}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const [profile,setProfile] = useState({name:"Joey",username:"joey_fit",bio:"Army vet | Fitness journey | Competing & thriving ⚡"});
  const [bannerImg,setBanner] = useState<string|null>(null);
  const [profileImg,setAvatar]= useState<string|null>(null);
  const [editProfile,setEditProfile] = useState(false);
  const [brands,setBrands] = useState([{emoji:"👟",name:"New Balance"},{emoji:"👕",name:"Gym Shark"},{emoji:"🎧",name:"AirPods"}]);
  const [education,setEducation] = useState([{school:"US Army",years:"2018–2022",detail:"Corporal · AAM · MOVSM"},{school:"Real Estate School",years:"2024",detail:"Leasing Manager License"}]);
  const [certs,setCerts] = useState([{name:"AAM Award",org:"US Army",year:"2020"},{name:"MOVSM",org:"US Army",year:"2021"},{name:"Real Estate License",org:"Nevada",year:"2024"}]);

  function loadImg(e:React.ChangeEvent<HTMLInputElement>,set:(s:string)=>void){
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader(); r.onload=ev=>set(ev.target!.result as string); r.readAsDataURL(f); e.target.value="";
  }

  const inputStyle = {width:"100%",background:C.greenLight,border:`1.5px solid ${C.greenMid}`,borderRadius:14,padding:"11px 15px",fontSize:14,color:C.text,outline:"none",boxSizing:"border-box" as const,marginBottom:10};

  return (
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:80}}>
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
              <button onClick={()=>setEditProfile(false)} style={{flex:1,padding:"13px 0",borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,color:C.white,fontWeight:900,cursor:"pointer"}}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div style={{maxWidth:1400,padding:"32px 24px"}}>

        {/* Profile header */}
        <div style={{display:"flex",gap:28,alignItems:"flex-start",flexWrap:"wrap",marginBottom:36}}>
          {/* Avatar */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,flexShrink:0}}>
            <label style={{position:"relative",cursor:"pointer",display:"block"}}>
              {profileImg
                ? <img src={profileImg} style={{width:150,height:150,borderRadius:"50%",objectFit:"cover",border:`5px solid ${C.blue}`,boxShadow:"0 8px 24px rgba(75,191,214,0.25)",display:"block"}} alt="Profile"/>
                : <div style={{width:150,height:150,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,border:`5px solid ${C.white}`,boxShadow:"0 8px 24px rgba(75,191,214,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:56,fontWeight:900,color:C.white}}>{profile.name[0]}</div>}
              <div style={{position:"absolute",bottom:8,right:8,width:30,height:30,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>📷</div>
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>loadImg(e,setAvatar)}/>
            </label>
            <div style={{textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:19,color:C.text}}>{profile.name}</div>
              <div style={{fontSize:13,color:C.sub}}>@{profile.username}</div>
            </div>
          </div>

          {/* Banner + stats */}
          <div style={{flex:1,minWidth:260}}>
            <label style={{width:"100%",height:155,borderRadius:26,overflow:"hidden",cursor:"pointer",position:"relative",marginBottom:14,background:bannerImg?"transparent":`linear-gradient(135deg,${C.blue},#B8E8F5)`,border:`2px solid ${C.greenMid}`,display:"flex",alignItems:"center",justifyContent:"center"} as any}>
              {bannerImg
                ? <img src={bannerImg} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="Banner"/>
                : <span style={{fontWeight:900,fontSize:17,color:"rgba(255,255,255,0.7)"}}>📷 Click to add Banner Photo</span>}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>loadImg(e,setBanner)}/>
            </label>

            <p style={{fontSize:14,color:C.sub,marginBottom:14,lineHeight:1.55}}>{profile.bio}</p>

            <div style={{background:C.white,borderRadius:18,padding:"14px 18px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,border:`1.5px solid ${C.greenMid}`,marginBottom:14}}>
              {[{l:"Posts",v:24},{l:"Followers",v:312},{l:"Following",v:89}].map(s=>(
                <div key={s.l} style={{textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:900,color:C.blue}}>{s.v}</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>

            <button onClick={()=>setEditProfile(true)} style={{padding:"11px 22px",borderRadius:14,border:`2px solid ${C.blue}`,background:C.white,color:C.blue,fontWeight:700,fontSize:14,cursor:"pointer"}}>
              ✏️ Edit Profile
            </button>
          </div>
        </div>

        {/* 3-column */}
        <div style={{display:"grid",gridTemplateColumns:"260px 1fr 260px",gap:24,alignItems:"start"}}>

          {/* LEFT */}
          <div>
            <EditableList title="📚 Education" items={education} onSave={setEducation} emptyItem={{school:"",years:"",detail:""}}
              renderItem={(item,i,setList)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:6,background:C.greenLight,borderRadius:12,padding:12}}>
                  <input style={{...inputStyle,marginBottom:0}} value={item.school} placeholder="School/Institution" onChange={e=>setList(l=>l.map((x:any,j:number)=>j===i?{...x,school:e.target.value}:x))}/>
                  <input style={{...inputStyle,marginBottom:0}} value={item.years} placeholder="Years (e.g. 2020–2022)" onChange={e=>setList(l=>l.map((x:any,j:number)=>j===i?{...x,years:e.target.value}:x))}/>
                  <input style={{...inputStyle,marginBottom:0}} value={item.detail} placeholder="Details" onChange={e=>setList(l=>l.map((x:any,j:number)=>j===i?{...x,detail:e.target.value}:x))}/>
                  <button onClick={()=>setList(l=>l.filter((_:any,j:number)=>j!==i))} style={{alignSelf:"flex-end",padding:"4px 12px",borderRadius:8,border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:12,fontWeight:700,cursor:"pointer"}}>Remove</button>
                </div>
              )}/>

            <EditableList title="🎖️ Certificates" items={certs} onSave={setCerts} emptyItem={{name:"",org:"",year:""}}
              renderItem={(item,i,setList)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:6,background:C.goldLight,borderRadius:12,padding:12}}>
                  <input style={{...inputStyle,marginBottom:0}} value={item.name} placeholder="Certificate Name" onChange={e=>setList(l=>l.map((x:any,j:number)=>j===i?{...x,name:e.target.value}:x))}/>
                  <input style={{...inputStyle,marginBottom:0}} value={item.org} placeholder="Organization" onChange={e=>setList(l=>l.map((x:any,j:number)=>j===i?{...x,org:e.target.value}:x))}/>
                  <input style={{...inputStyle,marginBottom:0}} value={item.year} placeholder="Year" onChange={e=>setList(l=>l.map((x:any,j:number)=>j===i?{...x,year:e.target.value}:x))}/>
                  <button onClick={()=>setList(l=>l.filter((_:any,j:number)=>j!==i))} style={{alignSelf:"flex-end",padding:"4px 12px",borderRadius:8,border:"none",background:"#FFE8E8",color:"#FF4444",fontSize:12,fontWeight:700,cursor:"pointer"}}>Remove</button>
                </div>
              )}/>
          </div>

          {/* CENTER */}
          <div>
            <div style={{fontWeight:900,fontSize:20,color:C.text,marginBottom:16}}>Activity Log</div>
            {DAYS.map(day=><DayCard key={day.id} day={day}/>)}
          </div>

          {/* RIGHT */}
          <div>
            <div style={{background:C.white,borderRadius:22,padding:24,border:`2px solid ${C.greenMid}`,boxShadow:"0 4px 14px rgba(75,191,214,0.08)",marginBottom:20}}>
              <div style={{fontWeight:900,fontSize:17,color:C.text,marginBottom:16}}>🏆 Badges & Awards</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[{emoji:"🥇",label:"1st Place",desc:"March Challenge"},{emoji:"🏆",label:"Champion",desc:"Step Challenge"},{emoji:"🎖️",label:"Veteran",desc:"US Army"},{emoji:"⭐",label:"All-Star",desc:"Top 1%"}].map(b=>(
                  <div key={b.label} style={{background:C.goldLight,borderRadius:16,padding:"16px 10px",textAlign:"center",border:"1px solid #FFE8AA"}}>
                    <div style={{fontSize:30,marginBottom:6}}>{b.emoji}</div>
                    <div style={{fontWeight:800,fontSize:13,color:C.text}}>{b.label}</div>
                    <div style={{fontSize:11,color:C.sub,marginTop:2}}>{b.desc}</div>
                  </div>
                ))}
              </div>
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

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const C = {
  blue:"#4BBFD6", greenLight:"#E8F7FB", greenMid:"#B8E8F5",
  gold:"#F5A623", goldLight:"#FFFBEE",
  text:"#1A2B3C", sub:"#5A7A8A", white:"#FFFFFF", bg:"#F0F9FC",
  green:"#52C97A", greenLight:"#F0FBF5",
  dark:"#0F1117", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_GROUPS = [
  {
    id: "lv-morning-runners",
    name: "LV Morning Runners",
    category: "Running",
    emoji: "🏃",
    city: "Las Vegas, NV",
    members: 284,
    active: true,
    meetFrequency: "Every Saturday 6AM",
    location: "Red Rock Canyon Trailhead",
    tags: ["#Running","#LasVegas","#5K","#TrailRun"],
    description: "Las Vegas's most active morning run crew. All paces welcome. We meet weekly at Red Rock and host monthly races.",
    nextEvent: { name: "Saturday 5K", date: "Mar 29", time: "6:00 AM" },
    recentPhoto: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80",
  },
  {
    id: "summerlin-iron-club",
    name: "Summerlin Iron Club",
    category: "Strength",
    emoji: "🏋️",
    city: "Las Vegas, NV",
    members: 156,
    active: true,
    meetFrequency: "Mon / Wed / Fri 5:30AM",
    location: "24 Hour Fitness · Summerlin",
    tags: ["#Powerlifting","#Summerlin","#Strength"],
    description: "Serious lifters who show up early and push each other. Powerlifting-focused with a supportive community vibe.",
    nextEvent: { name: "Max Out Monday", date: "Mar 31", time: "5:30 AM" },
    recentPhoto: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80",
  },
  {
    id: "vegas-yoga-collective",
    name: "Vegas Yoga Collective",
    category: "Yoga",
    emoji: "🧘",
    city: "Las Vegas, NV",
    members: 412,
    active: true,
    meetFrequency: "Every Sunday 8AM",
    location: "Sunset Park · Las Vegas",
    tags: ["#Yoga","#Wellness","#LasVegas","#Mindfulness"],
    description: "Free community yoga every Sunday in the park. All levels, all ages, all bodies. Mats provided for beginners.",
    nextEvent: { name: "Sunday Flow", date: "Mar 30", time: "8:00 AM" },
    recentPhoto: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&q=80",
  },
  {
    id: "lv-hiit-squad",
    name: "LV HIIT Squad",
    category: "HIIT",
    emoji: "🔥",
    city: "Las Vegas, NV",
    members: 198,
    active: true,
    meetFrequency: "Tue / Thu 6PM",
    location: "Springs Preserve · Las Vegas",
    tags: ["#HIIT","#LasVegas","#Bootcamp","#Cardio"],
    description: "High intensity, zero judgment. Outdoor bootcamp sessions that leave you completely gassed. Bring water.",
    nextEvent: { name: "Thursday Burnout", date: "Mar 27", time: "6:00 PM" },
    recentPhoto: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&q=80",
  },
];

const ONLINE_GROUPS = [
  {
    id: "global-gains-community",
    name: "Global Gains Community",
    category: "Bodybuilding",
    emoji: "💪",
    members: 48200,
    isPrivate: false,
    tags: ["#Bodybuilding","#Gains","#Worldwide"],
    description: "The internet's most supportive bodybuilding community. Post your lifts, get form checks, share progress. No judgment zone.",
    nextEvent: { name: "Weekly Check-In Thread", date: "Every Monday", time: "All Day" },
    recentPhoto: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80",
    trending: true,
  },
  {
    id: "women-who-lift",
    name: "Women Who Lift",
    category: "Strength",
    emoji: "👊",
    members: 31500,
    isPrivate: false,
    tags: ["#WomenWhoLift","#StrongWomen","#Fitness"],
    description: "A safe, empowering space for women in strength sports. PR celebrations, advice, competitions, and genuine support.",
    nextEvent: { name: "Monthly PR Board", date: "Apr 1", time: "All Day" },
    recentPhoto: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80",
    trending: true,
  },
  {
    id: "macro-masters",
    name: "Macro Masters",
    category: "Nutrition",
    emoji: "🥗",
    members: 22800,
    isPrivate: false,
    tags: ["#MacroTracking","#Nutrition","#WeightLoss"],
    description: "Nutrition-focused community for macro tracking, meal prep, and sustainable eating habits. Recipe sharing every Friday.",
    nextEvent: { name: "Meal Prep Sunday", date: "Mar 30", time: "All Day" },
    recentPhoto: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&q=80",
    trending: false,
  },
  {
    id: "mindful-movement-collective",
    name: "Mindful Movement",
    category: "Wellness",
    emoji: "🌿",
    members: 18400,
    isPrivate: false,
    tags: ["#Wellness","#Mindfulness","#Recovery","#Yoga"],
    description: "Where fitness meets mental health. Yoga, meditation, recovery, breathwork — taking care of your whole self.",
    nextEvent: { name: "Rest Day Vibes Thread", date: "Every Sunday", time: "All Day" },
    recentPhoto: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&q=80",
    trending: false,
  },
  {
    id: "5k-to-marathon",
    name: "5K to Marathon Club",
    category: "Running",
    emoji: "🏅",
    members: 34600,
    isPrivate: false,
    tags: ["#Running","#Marathon","#5K","#Training"],
    description: "From couch to 5K to your first marathon. Structured training plans, running buddies, and race day support worldwide.",
    nextEvent: { name: "Training Plan Drop", date: "Mar 31", time: "9:00 AM" },
    recentPhoto: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80",
    trending: true,
  },
  {
    id: "calisthenics-worldwide",
    name: "Calisthenics Worldwide",
    category: "Calisthenics",
    emoji: "🤸",
    members: 56900,
    isPrivate: false,
    tags: ["#Calisthenics","#StreetWorkout","#Bodyweight"],
    description: "No gym needed. The global hub for calisthenics athletes, street workout crews, and bodyweight training enthusiasts.",
    nextEvent: { name: "Skill Challenge: Handstand", date: "Apr 5", time: "All Day" },
    recentPhoto: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80",
    trending: true,
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Running":      "#4BBFD6",
  "Strength":     "#16A34A",
  "Yoga":         "#52C97A",
  "HIIT":         "#EF4444",
  "Bodybuilding": "#F5A623",
  "Nutrition":    "#10B981",
  "Wellness":     "#4ADE80",
  "Calisthenics": "#06B6D4",
};

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL GROUP CARD — matches mockup style
// ─────────────────────────────────────────────────────────────────────────────
function LocalGroupCard({ group }: { group: typeof LOCAL_GROUPS[0] }) {
  const [joined, setJoined] = useState(false);
  const router = useRouter();
  const catColor = CATEGORY_COLORS[group.category] ?? C.blue;

  return (
    <div
      style={{ background:C.white, borderRadius:20, border:`2px solid ${C.greenMid}`, marginBottom:24, overflow:"hidden", boxShadow:"0 4px 20px rgba(75,191,214,0.09)", cursor:"pointer", transition:"transform 0.15s, box-shadow 0.15s" }}
      onClick={() => router.push(`/groups/${group.id}`)}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(75,191,214,0.18)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(75,191,214,0.09)"; }}
    >
      {/* Photo banner */}
      <div style={{ width:"100%", aspectRatio:"16/7", overflow:"hidden", position:"relative", background:"#111" }}>
        <img src={group.recentPhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        {/* Overlay gradient */}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65))" }} />
        {/* Category badge */}
        <div style={{ position:"absolute", top:12, left:14, background:catColor, borderRadius:99, padding:"4px 12px", fontSize:11, fontWeight:800, color:"#fff" }}>
          {group.emoji} {group.category}
        </div>
        {/* Active badge */}
        {group.active && (
          <div style={{ position:"absolute", top:12, right:14, display:"flex", alignItems:"center", gap:5, background:"rgba(0,0,0,0.5)", borderRadius:99, padding:"4px 10px", backdropFilter:"blur(4px)" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#52C97A" }} />
            <span style={{ fontSize:10, fontWeight:700, color:"#fff" }}>Active</span>
          </div>
        )}
        {/* Group name over photo */}
        <div style={{ position:"absolute", bottom:14, left:16, right:16 }}>
          <div style={{ fontWeight:900, fontSize:18, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,0.4)" }}>{group.name}</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginTop:2 }}>📍 {group.city}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:"14px 18px 16px" }}>
        {/* Stats row */}
        <div style={{ display:"flex", gap:20, marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:14 }}>👥</span>
            <span style={{ fontWeight:800, fontSize:13, color:C.text }}>{group.members.toLocaleString()}</span>
            <span style={{ fontSize:12, color:C.sub }}>members</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:14 }}>🗓️</span>
            <span style={{ fontSize:12, color:C.sub }}>{group.meetFrequency}</span>
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize:13, color:C.sub, lineHeight:1.6, marginBottom:12 }}>{group.description}</p>

        {/* Next event */}
        <div style={{ display:"flex", alignItems:"center", gap:10, background:C.greenLight, borderRadius:12, padding:"10px 14px", marginBottom:14, border:`1px solid ${C.greenMid}` }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${catColor},${catColor}CC)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
            {group.emoji}
          </div>
          <div>
            <div style={{ fontSize:11, color:C.sub, fontWeight:600 }}>Next Event</div>
            <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{group.nextEvent.name}</div>
            <div style={{ fontSize:11, color:C.sub }}>{group.nextEvent.date} · {group.nextEvent.time}</div>
          </div>
        </div>

        {/* Tags */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
          {group.tags.map(t => (
            <span key={t} style={{ background:C.greenLight, color:C.blue, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, border:`1px solid ${C.greenMid}` }}>{t}</span>
          ))}
        </div>

        {/* Join button */}
        <button
          onClick={e => { e.stopPropagation(); setJoined(j=>!j); }}
          style={{ width:"100%", padding:"11px", borderRadius:13, border:"none", background:joined?"rgba(124,58,237,0.12)":"linear-gradient(135deg,#16A34A,#22C55E)", color:joined?"#16A34A":"#fff", fontWeight:800, fontSize:14, cursor:"pointer", transition:"all 0.15s", boxShadow:joined?"none":"0 4px 14px rgba(124,58,237,0.35)" }}
        >
          {joined ? "✓ Joined — View Group" : "Join Group"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONLINE GROUP CARD
// ─────────────────────────────────────────────────────────────────────────────
function OnlineGroupCard({ group }: { group: typeof ONLINE_GROUPS[0] }) {
  const [joined, setJoined] = useState(false);
  const router = useRouter();
  const catColor = CATEGORY_COLORS[group.category] ?? C.blue;

  return (
    <div
      style={{ background:C.white, borderRadius:20, border:`2px solid ${C.greenMid}`, marginBottom:24, overflow:"hidden", boxShadow:"0 4px 20px rgba(75,191,214,0.09)", cursor:"pointer", transition:"transform 0.15s, box-shadow 0.15s" }}
      onClick={() => router.push(`/groups/${group.id}`)}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(75,191,214,0.18)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(75,191,214,0.09)"; }}
    >
      {/* Photo banner */}
      <div style={{ width:"100%", aspectRatio:"16/7", overflow:"hidden", position:"relative", background:"#111" }}>
        <img src={group.recentPhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65))" }} />
        {/* Category */}
        <div style={{ position:"absolute", top:12, left:14, background:catColor, borderRadius:99, padding:"4px 12px", fontSize:11, fontWeight:800, color:"#fff" }}>
          {group.emoji} {group.category}
        </div>
        {/* Trending badge */}
        {group.trending && (
          <div style={{ position:"absolute", top:12, right:14, display:"flex", alignItems:"center", gap:5, background:"rgba(245,158,11,0.9)", borderRadius:99, padding:"4px 10px" }}>
            <span style={{ fontSize:10, fontWeight:800, color:"#fff" }}>🔥 Trending</span>
          </div>
        )}
        {/* Name */}
        <div style={{ position:"absolute", bottom:14, left:16, right:16 }}>
          <div style={{ fontWeight:900, fontSize:18, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,0.4)" }}>{group.name}</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginTop:2 }}>🌍 Online · Worldwide</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:"14px 18px 16px" }}>
        {/* Stats */}
        <div style={{ display:"flex", gap:20, marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:14 }}>👥</span>
            <span style={{ fontWeight:800, fontSize:13, color:C.text }}>{group.members.toLocaleString()}</span>
            <span style={{ fontSize:12, color:C.sub }}>members</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:14 }}>{group.isPrivate ? "🔒" : "🌐"}</span>
            <span style={{ fontSize:12, color:C.sub }}>{group.isPrivate ? "Private Group" : "Public Group"}</span>
          </div>
        </div>

        <p style={{ fontSize:13, color:C.sub, lineHeight:1.6, marginBottom:12 }}>{group.description}</p>

        {/* Next event */}
        <div style={{ display:"flex", alignItems:"center", gap:10, background:C.greenLight, borderRadius:12, padding:"10px 14px", marginBottom:14, border:`1px solid ${C.greenMid}` }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${catColor},${catColor}CC)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
            {group.emoji}
          </div>
          <div>
            <div style={{ fontSize:11, color:C.sub, fontWeight:600 }}>Next Event</div>
            <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{group.nextEvent.name}</div>
            <div style={{ fontSize:11, color:C.sub }}>{group.nextEvent.date} · {group.nextEvent.time}</div>
          </div>
        </div>

        {/* Tags */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
          {group.tags.map(t => (
            <span key={t} style={{ background:C.greenLight, color:C.blue, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, border:`1px solid ${C.greenMid}` }}>{t}</span>
          ))}
        </div>

        <button
          onClick={e => { e.stopPropagation(); setJoined(j=>!j); }}
          style={{ width:"100%", padding:"11px", borderRadius:13, border:"none", background:joined?"rgba(124,58,237,0.12)":"linear-gradient(135deg,#16A34A,#22C55E)", color:joined?"#16A34A":"#fff", fontWeight:800, fontSize:14, cursor:"pointer", transition:"all 0.15s", boxShadow:joined?"none":"0 4px 14px rgba(124,58,237,0.35)" }}
        >
          {joined ? "✓ Joined — View Group" : "Join Group"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEARBY PLACES WIDGET
// ─────────────────────────────────────────────────────────────────────────────
const PLACE_CATEGORIES = ["Gym","Yoga","Recovery","Nutrition","Running","Cycling","Martial Arts","CrossFit"];

const MOCK_PLACES: Record<string, { name:string; category:string; distance:string; rating:number; address:string; emoji:string; }[]> = {
  "89101": [
    { name:"24 Hour Fitness Summerlin", category:"Gym", distance:"1.2 mi", rating:4.3, address:"2101 S Fort Apache Rd", emoji:"🏋️" },
    { name:"CorePower Yoga Las Vegas", category:"Yoga", distance:"0.8 mi", rating:4.7, address:"8925 W Sahara Ave", emoji:"🧘" },
    { name:"Orangetheory Fitness", category:"Gym", distance:"2.1 mi", rating:4.5, address:"9484 W Flamingo Rd", emoji:"🔥" },
    { name:"Floyd's Nutrition", category:"Nutrition", distance:"0.4 mi", rating:4.6, address:"4440 E Sunset Rd", emoji:"🥗" },
    { name:"The Cryotherapy Clinic", category:"Recovery", distance:"3.2 mi", rating:4.8, address:"7465 W Lake Mead Blvd", emoji:"❄️" },
    { name:"Las Vegas Running Club", category:"Running", distance:"1.5 mi", rating:4.9, address:"Craig Ranch Regional Park", emoji:"🏃" },
  ],
  "default": [
    { name:"Local Gym", category:"Gym", distance:"0.5 mi", rating:4.2, address:"Near your location", emoji:"🏋️" },
    { name:"Yoga Studio", category:"Yoga", distance:"0.8 mi", rating:4.5, address:"Near your location", emoji:"🧘" },
    { name:"Nutrition Store", category:"Nutrition", distance:"1.1 mi", rating:4.3, address:"Near your location", emoji:"🥗" },
    { name:"Recovery Center", category:"Recovery", distance:"1.4 mi", rating:4.6, address:"Near your location", emoji:"❄️" },
  ],
};

function NearbyPlaces() {
  const [zip, setZip] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  const places = submitted ? (MOCK_PLACES[zip] || MOCK_PLACES["default"]) : [];
  const filtered = activeCategory === "All" ? places : places.filter(p => p.category === activeCategory);

  return (
    <div style={{ background:C.darkCard, borderRadius:16, border:`1px solid ${C.darkBorder}`, padding:"16px" }}>
      <div style={{ fontWeight:900, fontSize:14, color:"#E2E8F0", marginBottom:4 }}>📍 Discover Places Near You</div>
      <p style={{ fontSize:11, color:C.darkSub, lineHeight:1.5, marginBottom:12 }}>Enter your zip code to find gyms, studios, recovery centers, and nutrition spots near you.</p>

      {/* Zip input */}
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        <input
          value={zip}
          onChange={e => setZip(e.target.value.replace(/\D/g,"").slice(0,5))}
          onKeyDown={e => e.key==="Enter" && zip.length===5 && setSubmitted(true)}
          placeholder="Enter zip code..."
          maxLength={5}
          style={{ flex:1, background:"#252A3D", border:`1px solid ${C.darkBorder}`, borderRadius:10, padding:"8px 12px", fontSize:12, color:"#E2E8F0", outline:"none", fontFamily:"inherit" }}
        />
        <button
          onClick={() => zip.length===5 && setSubmitted(true)}
          style={{ padding:"8px 14px", borderRadius:10, background:"linear-gradient(135deg,#16A34A,#22C55E)", border:"none", color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer", opacity:zip.length===5?1:0.5 }}
        >
          Search
        </button>
      </div>

      {/* Category filters */}
      {submitted && (
        <>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
            {["All",...PLACE_CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding:"4px 10px", borderRadius:99, border:`1px solid ${activeCategory===cat?"#16A34A":C.darkBorder}`, background:activeCategory===cat?"rgba(124,58,237,0.2)":"transparent", color:activeCategory===cat?"#4ADE80":C.darkSub, fontSize:10, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
                {cat}
              </button>
            ))}
          </div>

          {/* Results */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"16px 0", color:C.darkSub, fontSize:12 }}>No {activeCategory} spots found near {zip}</div>
            ) : filtered.map((place, i) => (
              <div key={i} style={{ background:"#252A3D", borderRadius:12, padding:"10px 12px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", border:`1px solid transparent`, transition:"border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#16A34A"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "transparent"}
              >
                <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#16A34A,#22C55E)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                  {place.emoji}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:12, color:"#E2E8F0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{place.name}</div>
                  <div style={{ fontSize:10, color:C.darkSub, marginTop:1 }}>{place.address}</div>
                  <div style={{ display:"flex", gap:8, marginTop:3, alignItems:"center" }}>
                    <span style={{ background:"rgba(124,58,237,0.2)", color:"#4ADE80", fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:99 }}>{place.category}</span>
                    <span style={{ fontSize:10, color:C.gold }}>★ {place.rating}</span>
                    <span style={{ fontSize:10, color:C.darkSub }}>{place.distance}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => { setSubmitted(false); setZip(""); setActiveCategory("All"); }} style={{ width:"100%", marginTop:10, padding:"7px", borderRadius:10, background:"transparent", border:`1px solid ${C.darkBorder}`, color:C.darkSub, fontSize:11, fontWeight:700, cursor:"pointer" }}>
            Clear Search
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT SIDEBAR — consistent with rest of app
// ─────────────────────────────────────────────────────────────────────────────
function ConnectSidebar({ tab }: { tab: "local" | "online" }) {
  const featured = tab === "local" ? LOCAL_GROUPS[0] : ONLINE_GROUPS[0];
  const catColor = CATEGORY_COLORS[featured.category] ?? C.blue;

  return (
    <div style={{ width:320, flexShrink:0, paddingTop:20, paddingBottom:20 }}>

      {/* Create a group CTA */}
      <div style={{ background:`linear-gradient(135deg,${tab==="local"?"#16A34A,#22C55E":"#4BBFD6,#3AA8C1"})`, borderRadius:18, padding:"20px", marginBottom:20, boxShadow:`0 4px 20px ${tab==="local"?"rgba(124,58,237,0.3)":"rgba(75,191,214,0.3)"}` }}>
        <div style={{ fontSize:32, marginBottom:8 }}>{tab==="local"?"📍":"🌍"}</div>
        <div style={{ fontWeight:900, fontSize:16, color:"#fff", marginBottom:6 }}>
          {tab==="local" ? "Start a Local Group" : "Create an Online Group"}
        </div>
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.85)", lineHeight:1.6, marginBottom:14 }}>
          {tab==="local"
            ? "Organize your city's fitness community. Free to create, forever."
            : "Build your worldwide tribe. Any goal, any timezone, any level."}
        </p>
        <button style={{ width:"100%", padding:"10px", borderRadius:12, background:"rgba(255,255,255,0.2)", border:"1.5px solid rgba(255,255,255,0.4)", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}>
          + Create Group
        </button>
      </div>

      {/* Stats panel */}
      <div style={{ background:C.darkCard, borderRadius:16, border:`1px solid ${C.darkBorder}`, padding:"16px", marginBottom:16 }}>
        <div style={{ fontWeight:900, fontSize:14, color:"#E2E8F0", marginBottom:12 }}>
          {tab==="local" ? "📍 Las Vegas Groups" : "🌍 Global Stats"}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { val: String(tab==="local" ? LOCAL_GROUPS.length : ONLINE_GROUPS.length), label: tab==="local" ? "Active Groups" : "Featured Groups" },
            { val: tab==="local" ? LOCAL_GROUPS.reduce((s,g)=>s+g.members,0).toLocaleString() : ONLINE_GROUPS.reduce((s,g)=>s+g.members,0).toLocaleString(), label:"Total Members" },
            { val: tab==="local" ? "4" : "3", label: tab==="local" ? "Events This Week" : "Trending Now" },
            { val:"Free", label:"To Join" },
          ].map((s,i) => (
            <div key={i} style={{ background:"#252A3D", borderRadius:10, padding:"12px 10px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.blue }}>{s.val}</div>
              <div style={{ fontSize:10, color:C.darkSub, marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Popular categories */}
      <div style={{ background:C.darkCard, borderRadius:16, border:`1px solid ${C.darkBorder}`, padding:"16px", marginBottom:16 }}>
        <div style={{ fontWeight:900, fontSize:14, color:"#E2E8F0", marginBottom:12 }}>Browse by Category</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <button key={cat} style={{ padding:"6px 14px", borderRadius:99, border:`1.5px solid ${color}44`, background:`${color}18`, color:color, fontSize:11, fontWeight:800, cursor:"pointer" }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Discover Places Near You */}
      <NearbyPlaces />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ConnectPage() {
  const [tab, setTab] = useState<"local"|"online">("local");
  const [search, setSearch] = useState("");

  const filteredLocal = LOCAL_GROUPS.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.category.toLowerCase().includes(search.toLowerCase())
  );
  const filteredOnline = ONLINE_GROUPS.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ background:C.bg, minHeight:"100vh" }}>

      {/* ── Sticky Header ── */}
      <div style={{ position:"sticky", top:0, zIndex:100, background:C.white, borderBottom:`2px solid ${C.greenLight}` }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"14px 24px 0", display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:8 }}>
            <span style={{ fontSize:20 }}>🤝</span>
            <span style={{ fontWeight:900, fontSize:20, color:C.text }}>Connect</span>
          </div>
          {/* Search */}
          <div style={{ flex:1, maxWidth:380, display:"flex", alignItems:"center", gap:10, background:C.greenLight, borderRadius:24, padding:"8px 16px", border:`1.5px solid ${C.greenMid}` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:16, height:16, flexShrink:0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search groups by name or category..."
              style={{ background:"none", border:"none", outline:"none", fontSize:13, color:C.text, flex:1 }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 24px", display:"flex", gap:0, marginTop:12 }}>
          {(["local","online"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:"10px 28px",
              fontWeight:800,
              fontSize:14,
              background:"none",
              border:"none",
              cursor:"pointer",
              color: tab===t ? (t==="local"?"#16A34A":C.blue) : C.sub,
              borderBottom: tab===t ? `3px solid ${t==="local"?"#16A34A":C.blue}` : "3px solid transparent",
              transition:"all 0.15s",
            }}>
              {t === "local" ? "📍 Local Groups" : "🌍 Online Groups"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ display:"flex", gap:48, maxWidth:1200, margin:"0 auto", padding:"24px 24px 60px", alignItems:"flex-start" }}>

        {/* LEFT: Groups feed */}
        <div style={{ flex:1, minWidth:0 }}>

          {/* Banner */}
          <div style={{
            background: tab==="local" ? "linear-gradient(135deg,#16A34A,#22C55E)" : `linear-gradient(135deg,${C.blue},#3AA8C1)`,
            borderRadius:18, padding:"18px 22px", marginBottom:24,
            display:"flex", alignItems:"center", gap:16,
            boxShadow: tab==="local" ? "0 4px 20px rgba(124,58,237,0.3)" : "0 4px 20px rgba(75,191,214,0.3)",
          }}>
            <div style={{ fontSize:40 }}>{tab==="local"?"📍":"🌍"}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:900, fontSize:18, color:"#fff" }}>
                {tab==="local" ? "Las Vegas, NV — Local Groups" : "Online Groups — Worldwide"}
              </div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginTop:3 }}>
                {tab==="local"
                  ? `${filteredLocal.length} active groups near you · Real people, real meetups`
                  : `${filteredOnline.length} featured groups · Connect with anyone, anywhere`}
              </div>
            </div>
            {tab==="local" && (
              <button style={{ background:"rgba(255,255,255,0.2)", border:"1.5px solid rgba(255,255,255,0.4)", borderRadius:10, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer", flexShrink:0 }}>
                Change City
              </button>
            )}
          </div>

          {tab==="local"
            ? filteredLocal.map(g => <LocalGroupCard key={g.id} group={g} />)
            : filteredOnline.map(g => <OnlineGroupCard key={g.id} group={g} />)
          }
        </div>

        {/* RIGHT: Sidebar */}
        <ConnectSidebar tab={tab} />
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";

const C = {
  blue:"#4BBFD6", greenLight:"#E8F7FB", greenMid:"#B8E8F5",
  gold:"#F5A623", goldLight:"#FFFBEE",
  text:"#1A2B3C", sub:"#5A7A8A", white:"#FFFFFF", bg:"#F0F9FC",
  dark:"#0F1117", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_POSTS = [
  { id: 1, user: "Kayla Nguyen", username: "kayla_fit_lv", avatar: "KN", time: "1h ago",
    caption: "Morning hike at Red Rock Canyon 🏔️ Nothing like Vegas in the early hours before the heat hits. 6 miles done!",
    tags: ["#LasVegas","#RedRock","#HikingFit"], likes: 124,
    photo: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80" },
  { id: 2, user: "Marcus Bell", username: "marcus_lvfit", avatar: "MB", time: "3h ago",
    caption: "Orangetheory trial class this morning — absolute FIRE 🔥 First class free this week at the Summerlin location. Go get it!",
    tags: ["#LasVegas","#Orangetheory","#Fitness"], likes: 89,
    photo: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=80" },
  { id: 3, user: "Priya Sharma", username: "priya_wellness_lv", avatar: "PS", time: "5h ago",
    caption: "Farmers market haul 🌿 Downtown Summerlin had the most incredible produce today. Meal prepping all week with this!",
    tags: ["#LasVegas","#FarmersMarket","#MealPrep"], likes: 203,
    photo: "https://images.unsplash.com/photo-1506484381205-f7945653044d?w=800&q=80" },
  { id: 4, user: "Diego Reyes", username: "diego_runs_lv", avatar: "DR", time: "7h ago",
    caption: "5K run + brunch at Eggslut after 🍳 The Vegas Strip at 6am before the tourists wake up is genuinely beautiful.",
    tags: ["#LasVegas","#5K","#RunClub"], likes: 156,
    photo: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80" },
];

const LOCAL_EVENTS = [
  { id: 1, name: "Farmers Market", venue: "Downtown Summerlin", day: "SAT", date: "29", emoji: "🌿", category: "Wellness", price: "Free", time: "8AM–1PM" },
  { id: 2, name: "Degree Wellness Day Pass", venue: "Degree Wellness · Summerlin", day: "FRI", date: "28", emoji: "🧖", category: "Spa", price: "$35", time: "10AM–6PM" },
  { id: 3, name: "5K Run & Brunch", venue: "The Strip · Wynn Start", day: "SUN", date: "30", emoji: "🏃", category: "Running", price: "$25", time: "7AM–10AM" },
  { id: 4, name: "Orangetheory Trial Day", venue: "Orangetheory · Summerlin", day: "THU", date: "27", emoji: "🔥", category: "HIIT", price: "Free", time: "6AM–7PM" },
  { id: 5, name: "Yoga in the Park", venue: "Sunset Park · Las Vegas", day: "SAT", date: "29", emoji: "🧘", category: "Yoga", price: "Free", time: "8AM–9:30AM" },
  { id: 6, name: "Bodybuilding Expo", venue: "Las Vegas Convention Ctr", day: "SAT", date: "29", emoji: "🏋️", category: "Expo", price: "$20", time: "9AM–5PM" },
];

const WORLD_POSTS = [
  { id: 1, user: "Chris Bumstead", username: "cbum", avatar: "CB", time: "2h ago",
    caption: "Prep is going insane this year. I genuinely think this is the best shape I've ever been in. Classic Olympia here we come 🏆",
    tags: ["#Olympia","#ClassicPhysique","#Cbum"], likes: 48200,
    photo: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80" },
  { id: 2, user: "Courtney Black", username: "courtney_black", avatar: "CB", time: "4h ago",
    caption: "New Gymshark collab just dropped and I am OBSESSED 🖤 Link in bio — these might be the best leggings I've ever worn.",
    tags: ["#Gymshark","#Fitness","#GymFashion"], likes: 31500,
    photo: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80" },
  { id: 3, user: "Jeff Nippard", username: "jeffnippard", avatar: "JN", time: "6h ago",
    caption: "Science-based arm training guide is LIVE on YouTube. This is the most comprehensive arm video I've ever made. Go watch it!",
    tags: ["#Science","#ArmDay","#NaturalBodybuilding"], likes: 22800,
    photo: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=80" },
  { id: 4, user: "Natacha Océane", username: "natacha_oceane", avatar: "NO", time: "8h ago",
    caption: "Your body is not a before and after. Stop treating it like a project to fix and start treating it like a home to live in 🌊",
    tags: ["#BodyPositivity","#MindfulFitness","#Wellness"], likes: 67400,
    photo: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800&q=80" },
];

const TRENDING_BRANDS = [
  { id: 1, name: "Gymshark", handle: "@gymshark", emoji: "🦈", category: "Apparel", posts: "2.4M", color: "#1A1A1A", followers: "7.2M" },
  { id: 2, name: "Nike Training", handle: "@niketraining", emoji: "✔️", category: "Footwear & Apparel", posts: "8.1M", color: "#E5000F", followers: "31.5M" },
  { id: 3, name: "Dior Fitness", handle: "@dior", emoji: "👑", category: "Luxury Activewear", posts: "890K", color: "#C9A96E", followers: "4.1M" },
  { id: 4, name: "Lululemon", handle: "@lululemon", emoji: "🧘", category: "Activewear", posts: "3.2M", color: "#BE3A34", followers: "5.8M" },
  { id: 5, name: "Whoop", handle: "@whoop", emoji: "📊", category: "Wearables", posts: "420K", color: "#00D4AA", followers: "1.3M" },
];

const TRENDING_PEOPLE = [
  { id: 1, name: "Chris Bumstead", handle: "@cbum", avatar: "CB", specialty: "Classic Physique · 4x Olympia", followers: "22.4M", trend: "+18K today" },
  { id: 2, name: "Courtney Black", handle: "@courtney_black", avatar: "CB2", specialty: "HIIT · Gymshark Athlete", followers: "4.1M", trend: "+6.2K today" },
  { id: 3, name: "Jeff Nippard", handle: "@jeffnippard", avatar: "JN", specialty: "Science-Based Training", followers: "8.8M", trend: "+9.1K today" },
  { id: 4, name: "Natacha Océane", handle: "@natacha_oceane", avatar: "NO", specialty: "Mindful Fitness · Wellness", followers: "3.2M", trend: "+4.8K today" },
  { id: 5, name: "Andrew Huberman", handle: "@hubermanlab", avatar: "AH", specialty: "Neuroscience · Performance", followers: "6.7M", trend: "+12.3K today" },
];

const SUGGESTED_ACCOUNTS = [
  { id: 1, avatar: "RS", name: "Rachel Stone", handle: "@rachel_lifts", specialty: "Olympic Weightlifting", followers: "84K", mutual: 3 },
  { id: 2, avatar: "TM", name: "Tyler Moore", handle: "@tyler_macro", specialty: "Nutrition Coach · IFBB", followers: "142K", mutual: 5 },
  { id: 3, avatar: "AM", name: "Aisha Mohammed", handle: "@aisha_runs", specialty: "Marathon · Trail Running", followers: "56K", mutual: 2 },
  { id: 4, avatar: "BK", name: "Brandon Kim", handle: "@bk_calisthenics", specialty: "Calisthenics · Street Workout", followers: "218K", mutual: 7 },
  { id: 5, avatar: "LF", name: "Luna Ferreira", handle: "@luna_wellness", specialty: "Pilates · Breathwork", followers: "93K", mutual: 4 },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function DiscoverPost({ post, liked: initLiked }: { post: typeof LOCAL_POSTS[0]; liked: boolean }) {
  const [liked, setLiked] = useState(initLiked);
  const [likes, setLikes] = useState(post.likes);
  return (
    <div style={{ background:C.white,borderRadius:20,border:`2px solid ${C.greenMid}`,boxShadow:"0 4px 24px rgba(75,191,214,0.09)",marginBottom:28,overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 18px 10px" }}>
        <div style={{ width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0 }}>
          {post.avatar}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:900,fontSize:15,color:C.text }}>{post.user}</div>
          <div style={{ fontSize:12,color:C.sub }}>@{post.username} · {post.time}</div>
        </div>
        <button style={{ padding:"6px 16px",borderRadius:20,background:C.greenLight,border:`1.5px solid ${C.blue}`,color:C.blue,fontWeight:800,fontSize:12,cursor:"pointer" }}>
          + Follow
        </button>
      </div>

      {/* Big photo area */}
      <div style={{ width:"100%",aspectRatio:"4/3",background:"#111",overflow:"hidden",position:"relative" }}>
        {post.photo
          ? <img src={post.photo} alt="" style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }} />
          : <div style={{ width:"100%",height:"100%",background:`linear-gradient(135deg,${C.greenLight},${C.greenMid})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:80 }}>📷</div>
        }
        <div style={{ position:"absolute",bottom:14,left:18,display:"flex",gap:8,flexWrap:"wrap" }}>
          {post.tags.map(t => (
            <span key={t} style={{ background:"rgba(0,0,0,0.52)",color:"#fff",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,backdropFilter:"blur(6px)" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Caption */}
      <div style={{ padding:"12px 18px 8px",fontSize:14,color:C.text,lineHeight:1.65 }}>{post.caption}</div>

      {/* Actions */}
      <div style={{ padding:"8px 18px 14px",display:"flex",alignItems:"center",gap:20,borderTop:`1px solid ${C.greenLight}`,marginTop:4 }}>
        <button onClick={() => { setLiked(l => !l); setLikes(n => liked ? n-1 : n+1); }} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0 }}>
          <svg viewBox="0 0 24 24" fill={liked?"#FF6B6B":"none"} stroke={liked?"#FF6B6B":C.sub} strokeWidth="2" style={{ width:22,height:22,transition:"all 0.15s" }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span style={{ fontSize:14,fontWeight:700,color:liked?"#FF6B6B":C.sub }}>{likes.toLocaleString()}</span>
        </button>
        <button style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:20,height:20 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:20,height:20 }}>
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Local Event Card — dark detail style matching worldwide cards ─────────────
function EventCard({ event }: { event: typeof LOCAL_EVENTS[0] }) {
  const [saved, setSaved] = useState(false);
  return (
    <div
      style={{ background:C.darkCard,borderRadius:16,border:`1px solid ${C.darkBorder}`,marginBottom:10,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",transition:"border-color 0.15s" }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#16A34A"}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.darkBorder}
    >
      {/* Date badge */}
      <div style={{ width:48,height:48,borderRadius:13,background:"linear-gradient(135deg,#16A34A,#22C55E)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
        <div style={{ fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.85)",textTransform:"uppercase",letterSpacing:0.5 }}>{event.day}</div>
        <div style={{ fontSize:20,fontWeight:900,color:"#fff",lineHeight:1 }}>{event.date}</div>
      </div>
      {/* Info */}
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
          <span style={{ fontSize:14 }}>{event.emoji}</span>
          <span style={{ fontWeight:800,fontSize:13,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{event.name}</span>
        </div>
        <div style={{ fontSize:11,color:C.darkSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:4 }}>📍 {event.venue}</div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <span style={{ background:"rgba(124,58,237,0.2)",color:"#4ADE80",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,border:"1px solid rgba(124,58,237,0.3)" }}>{event.category}</span>
          <span style={{ color:C.gold,fontSize:11,fontWeight:800 }}>{event.price}</span>
          <span style={{ color:C.darkSub,fontSize:10 }}>· {event.time}</span>
        </div>
      </div>
      {/* Save button */}
      <button
        onClick={e => { e.stopPropagation(); setSaved(s=>!s); }}
        style={{ background:saved?"rgba(124,58,237,0.2)":"#252A3D",border:`1px solid ${saved?"#16A34A":C.darkBorder}`,borderRadius:9,padding:"6px 10px",cursor:"pointer",color:saved?"#4ADE80":C.darkSub,fontSize:12,fontWeight:800,flexShrink:0,transition:"all 0.15s" }}
      >
        {saved ? "✓" : "+"}
      </button>
    </div>
  );
}

// ── Trending Brand Card ───────────────────────────────────────────────────────
function BrandCard({ brand, rank }: { brand: typeof TRENDING_BRANDS[0]; rank: number }) {
  return (
    <div style={{ background:C.darkCard,borderRadius:16,border:`1px solid ${C.darkBorder}`,marginBottom:10,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",transition:"border-color 0.15s" }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.blue}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.darkBorder}
    >
      <div style={{ width:14,fontSize:11,fontWeight:900,color:C.darkSub,flexShrink:0,textAlign:"center" }}>#{rank}</div>
      <div style={{ width:44,height:44,borderRadius:12,background:brand.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>
        {brand.emoji}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:800,fontSize:14,color:"#E2E8F0" }}>{brand.name}</div>
        <div style={{ fontSize:11,color:C.darkSub,marginTop:1 }}>{brand.category}</div>
        <div style={{ fontSize:10,color:C.blue,marginTop:2 }}>{brand.followers} followers</div>
      </div>
      <div style={{ textAlign:"right",flexShrink:0 }}>
        <div style={{ fontSize:10,color:C.darkSub }}>{brand.posts}</div>
        <div style={{ fontSize:9,color:C.darkSub }}>posts</div>
        <div style={{ marginTop:6,padding:"4px 10px",borderRadius:8,background:"rgba(75,191,214,0.15)",color:C.blue,fontSize:10,fontWeight:700,border:`1px solid rgba(75,191,214,0.3)` }}>View →</div>
      </div>
    </div>
  );
}

// ── Trending Person Card ──────────────────────────────────────────────────────
function TrendingPersonCard({ person, rank }: { person: typeof TRENDING_PEOPLE[0]; rank: number }) {
  const [following, setFollowing] = useState(false);
  return (
    <div style={{ background:C.darkCard,borderRadius:16,border:`1px solid ${C.darkBorder}`,marginBottom:10,padding:"13px 16px",display:"flex",alignItems:"center",gap:12 }}>
      <div style={{ width:14,fontSize:11,fontWeight:900,color:C.darkSub,flexShrink:0,textAlign:"center" }}>#{rank}</div>
      <div style={{ width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#16A34A,#4ADE80)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff",flexShrink:0 }}>
        {person.avatar.slice(0,2)}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:800,fontSize:13,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{person.name}</div>
        <div style={{ fontSize:11,color:C.darkSub,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{person.specialty}</div>
        <div style={{ fontSize:10,color:"#10B981",marginTop:2,fontWeight:700 }}>🔥 {person.trend}</div>
      </div>
      <button onClick={() => setFollowing(f=>!f)} style={{ padding:"6px 12px",borderRadius:9,border:"none",background:following?"#2A2D3E":`linear-gradient(135deg,${C.blue},#3AA8C1)`,color:following?C.darkSub:"#fff",fontWeight:800,fontSize:11,cursor:"pointer",flexShrink:0,transition:"all 0.15s" }}>
        {following ? "Following" : "+ Follow"}
      </button>
    </div>
  );
}

// ── Suggested Account Card ────────────────────────────────────────────────────
function SuggestedCard({ account }: { account: typeof SUGGESTED_ACCOUNTS[0] }) {
  const [following, setFollowing] = useState(false);
  return (
    <div style={{ background:C.darkCard,borderRadius:16,border:`1px solid ${C.darkBorder}`,marginBottom:10,padding:"13px 16px",display:"flex",alignItems:"center",gap:12 }}>
      <div style={{ width:42,height:42,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#7DD8EA)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",flexShrink:0 }}>
        {account.avatar}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:800,fontSize:13,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{account.name}</div>
        <div style={{ fontSize:10,color:C.darkSub,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{account.specialty}</div>
        <div style={{ fontSize:10,color:C.darkSub,marginTop:2 }}>
          <span style={{ color:C.blue,fontWeight:700 }}>{account.followers}</span> followers ·
          <span style={{ color:"#10B981",fontWeight:700 }}> {account.mutual} mutual</span>
        </div>
      </div>
      <button onClick={() => setFollowing(f=>!f)} style={{ padding:"6px 12px",borderRadius:9,border:"none",background:following?"#2A2D3E":`linear-gradient(135deg,${C.blue},#3AA8C1)`,color:following?C.darkSub:"#fff",fontWeight:800,fontSize:11,cursor:"pointer",flexShrink:0,transition:"all 0.15s" }}>
        {following ? "Following" : "+ Follow"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL TAB
// ─────────────────────────────────────────────────────────────────────────────
function LocalTab() {
  return (
    <div style={{ display:"flex", gap:48, alignItems:"flex-start", maxWidth:1200, margin:"0 auto", padding:"24px 24px 60px" }}>

      {/* LEFT: Local posts feed */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* City banner */}
        <div style={{ background:"linear-gradient(135deg,#16A34A,#22C55E)",borderRadius:18,padding:"16px 20px",marginBottom:24,display:"flex",alignItems:"center",gap:14,boxShadow:"0 4px 20px rgba(124,58,237,0.3)" }}>
          <div style={{ fontSize:36 }}>📍</div>
          <div>
            <div style={{ fontWeight:900,fontSize:18,color:"#fff" }}>Las Vegas, NV</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.85)",marginTop:2 }}>Showing fitness content near you · {LOCAL_POSTS.length} posts this week</div>
          </div>
          <button style={{ marginLeft:"auto",background:"rgba(255,255,255,0.2)",border:"1.5px solid rgba(255,255,255,0.4)",borderRadius:10,color:"#fff",fontSize:12,fontWeight:700,padding:"7px 14px",cursor:"pointer",flexShrink:0 }}>
            Change City
          </button>
        </div>

        {LOCAL_POSTS.map(post => <DiscoverPost key={post.id} post={post} liked={false} />)}
      </div>

      {/* RIGHT: Local events sidebar */}
      <div style={{ width:320, flexShrink:0 }}>
        {/* Header */}
        <div style={{ marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${C.darkBorder}` }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:900,fontSize:15,color:"#E2E8F0",marginBottom:2 }}>📅 Local Events This Week</div>
              <div style={{ fontSize:11,color:C.darkSub }}>Las Vegas · Mar 27–30</div>
            </div>
            <button style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:"#4ADE80",padding:0 }}>See all</button>
          </div>
        </div>

        {LOCAL_EVENTS.map(event => <EventCard key={event.id} event={event} />)}

        {/* Submit event CTA */}
        <div style={{ marginTop:4,padding:"14px 16px",background:C.darkCard,borderRadius:16,border:`1px dashed rgba(124,58,237,0.4)`,textAlign:"center",cursor:"pointer",transition:"border-color 0.15s" }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#16A34A"}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(124,58,237,0.4)"}
        >
          <div style={{ fontSize:22,marginBottom:5 }}>➕</div>
          <div style={{ fontWeight:800,fontSize:13,color:"#E2E8F0",marginBottom:3 }}>Host an Event</div>
          <div style={{ fontSize:11,color:C.darkSub }}>Submit your local fitness event for free</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD TAB
// ─────────────────────────────────────────────────────────────────────────────
function WorldTab() {
  return (
    <div style={{ display:"flex", gap:48, alignItems:"flex-start", maxWidth:1200, margin:"0 auto", padding:"24px 24px 60px" }}>

      {/* LEFT: World posts feed */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Trending banner */}
        <div style={{ background:`linear-gradient(135deg,#16A34A,#22C55E)`,borderRadius:18,padding:"16px 20px",marginBottom:24,display:"flex",alignItems:"center",gap:14 }}>
          <div style={{ fontSize:36 }}>🌍</div>
          <div>
            <div style={{ fontWeight:900,fontSize:18,color:"#fff" }}>Trending Worldwide</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.85)",marginTop:2 }}>Top fitness content from around the globe right now</div>
          </div>
        </div>

        {WORLD_POSTS.map(post => <DiscoverPost key={post.id} post={post} liked={false} />)}
      </div>

      {/* RIGHT: Brands + People + Suggested sidebar */}
      <div style={{ width:320, flexShrink:0 }}>

        {/* ── Top 5 Trending Brands ── */}
        <div style={{ marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${C.darkBorder}` }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:900,fontSize:15,color:"#E2E8F0",marginBottom:2 }}>🔥 Trending Brands</div>
              <div style={{ fontSize:11,color:C.darkSub }}>Top 5 this week</div>
            </div>
            <button style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:C.blue,padding:0 }}>See all</button>
          </div>
        </div>
        {TRENDING_BRANDS.map((b,i) => <BrandCard key={b.id} brand={b} rank={i+1} />)}

        {/* ── Top 5 Trending People ── */}
        <div style={{ margin:"20px 0 16px",paddingBottom:12,borderBottom:`1px solid ${C.darkBorder}` }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:900,fontSize:15,color:"#E2E8F0",marginBottom:2 }}>⭐ Trending People</div>
              <div style={{ fontSize:11,color:C.darkSub }}>Top 5 this week</div>
            </div>
            <button style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:C.blue,padding:0 }}>See all</button>
          </div>
        </div>
        {TRENDING_PEOPLE.map((p,i) => <TrendingPersonCard key={p.id} person={p} rank={i+1} />)}

        {/* ── Suggested Accounts ── */}
        <div style={{ margin:"20px 0 16px",paddingBottom:12,borderBottom:`1px solid ${C.darkBorder}` }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:900,fontSize:15,color:"#E2E8F0",marginBottom:2 }}>💡 Suggested For You</div>
              <div style={{ fontSize:11,color:C.darkSub }}>Based on your interests</div>
            </div>
            <button style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:C.blue,padding:0 }}>See all</button>
          </div>
        </div>
        {SUGGESTED_ACCOUNTS.map(a => <SuggestedCard key={a.id} account={a} />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function DiscoverPage() {
  const [tab, setTab] = useState<"local" | "world">("local");

  return (
    <div style={{ background:C.bg, minHeight:"100vh" }}>

      {/* ── Sticky Header ── */}
      <div style={{ position:"sticky",top:0,zIndex:100,background:C.white,borderBottom:`2px solid ${C.greenLight}` }}>
        <div style={{ maxWidth:1200,margin:"0 auto",padding:"14px 24px 0",display:"flex",alignItems:"center",gap:16 }}>
          {/* Title */}
          <div style={{ display:"flex",alignItems:"center",gap:8,marginRight:8 }}>
            <span style={{ fontSize:20 }}>🔍</span>
            <span style={{ fontWeight:900,fontSize:20,color:C.text }}>Discovery</span>
          </div>

          {/* Search bar */}
          <div style={{ flex:1,maxWidth:380,display:"flex",alignItems:"center",gap:10,background:C.greenLight,borderRadius:24,padding:"8px 16px",border:`1.5px solid ${C.greenMid}` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:16,height:16,flexShrink:0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder="Search people, brands, events..." style={{ background:"none",border:"none",outline:"none",fontSize:13,color:C.text,flex:1 }} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth:1200,margin:"0 auto",padding:"0 24px",display:"flex",gap:0,marginTop:12 }}>
          {(["local","world"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:"10px 28px",
              fontWeight:800,
              fontSize:14,
              background:"none",
              border:"none",
              cursor:"pointer",
              color: tab===t ? C.blue : C.sub,
              borderBottom: tab===t ? `3px solid ${C.blue}` : "3px solid transparent",
              transition:"all 0.15s",
              display:"flex",
              alignItems:"center",
              gap:8,
            }}>
              {t === "local" ? "📍 Local" : "🌍 Worldwide"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      {tab === "local" ? <LocalTab /> : <WorldTab />}
    </div>
  );
}

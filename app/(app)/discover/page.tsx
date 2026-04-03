"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const C = {
  blue:"#16A34A", greenLight:"#1A2A1A", greenMid:"#2A3A2A",
  gold:"#F5A623", goldLight:"#FFFBEE",
  text:"#F0F0F0", sub:"#9CA3AF", white:"#1A1A1A", bg:"#0D0D0D",
  dark:"#0D0D0D", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
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
  const router = useRouter();
  return (
    <div style={{ background:C.white,borderRadius:20,border:`2px solid ${C.greenMid}`,boxShadow:"0 4px 24px rgba(124,58,237,0.09)",marginBottom:28,overflow:"hidden" }}>
      {/* Header — clicking avatar/name → profile */}
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 18px 10px" }}>
        <div onClick={() => router.push(`/profile/${post.username}`)} style={{ width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0,cursor:"pointer" }}>
          {post.avatar}
        </div>
        <div style={{ flex:1,cursor:"pointer" }} onClick={() => router.push(`/profile/${post.username}`)}>
          <div style={{ fontWeight:900,fontSize:15,color:C.text }}>{post.user}</div>
          <div style={{ fontSize:12,color:C.sub }}>@{post.username} · {post.time}</div>
        </div>
        <button style={{ padding:"6px 16px",borderRadius:20,background:C.greenLight,border:`1.5px solid ${C.blue}`,color:C.blue,fontWeight:800,fontSize:12,cursor:"pointer" }}>
          + Follow
        </button>
      </div>

      {/* Big photo area — clicking → post detail */}
      <div onClick={() => router.push(`/post/${post.id}`)} style={{ width:"100%",aspectRatio:"4/3",background:"#111",overflow:"hidden",position:"relative",cursor:"pointer" }}>
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
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(`/events/${event.id}`)}
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
  const router = useRouter();
  return (
    <div onClick={() => router.push(`/brands/${brand.handle.replace("@","").replace(/\s/g,"-").toLowerCase()}`)} style={{ background:C.darkCard,borderRadius:16,border:`1px solid ${C.darkBorder}`,marginBottom:10,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",transition:"border-color 0.15s" }}
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
        <div style={{ marginTop:6,padding:"4px 10px",borderRadius:8,background:"rgba(124,58,237,0.15)",color:C.blue,fontSize:10,fontWeight:700,border:`1px solid rgba(124,58,237,0.3)` }}>View →</div>
      </div>
    </div>
  );
}

// ── Trending Person Card ──────────────────────────────────────────────────────
function TrendingPersonCard({ person, rank }: { person: typeof TRENDING_PEOPLE[0]; rank: number }) {
  const [following, setFollowing] = useState(false);
  const router = useRouter();
  return (
    <div onClick={() => router.push(`/profile/${person.handle.replace("@","")}`)} style={{ background:C.darkCard,borderRadius:16,border:`1px solid ${C.darkBorder}`,marginBottom:10,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer" }}>
      <div style={{ width:14,fontSize:11,fontWeight:900,color:C.darkSub,flexShrink:0,textAlign:"center" }}>#{rank}</div>
      <div style={{ width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#16A34A,#4ADE80)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff",flexShrink:0 }}>
        {person.avatar.slice(0,2)}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:800,fontSize:13,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{person.name}</div>
        <div style={{ fontSize:11,color:C.darkSub,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{person.specialty}</div>
        <div style={{ fontSize:10,color:"#10B981",marginTop:2,fontWeight:700 }}>🔥 {person.trend}</div>
      </div>
      <button onClick={() => setFollowing(f=>!f)} style={{ padding:"6px 12px",borderRadius:9,border:"none",background:following?"#2A2D3E":`linear-gradient(135deg,${C.blue},#15803D)`,color:following?C.darkSub:"#fff",fontWeight:800,fontSize:11,cursor:"pointer",flexShrink:0,transition:"all 0.15s" }}>
        {following ? "Following" : "+ Follow"}
      </button>
    </div>
  );
}

// ── Suggested Account Card ────────────────────────────────────────────────────
function SuggestedCard({ account }: { account: typeof SUGGESTED_ACCOUNTS[0] }) {
  const [following, setFollowing] = useState(false);
  const router = useRouter();
  return (
    <div onClick={() => router.push(`/profile/${account.handle.replace("@","")}`)} style={{ background:C.darkCard,borderRadius:16,border:`1px solid ${C.darkBorder}`,marginBottom:10,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer" }}>
      <div style={{ width:42,height:42,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",flexShrink:0 }}>
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
      <button onClick={() => setFollowing(f=>!f)} style={{ padding:"6px 12px",borderRadius:9,border:"none",background:following?"#2A2D3E":`linear-gradient(135deg,${C.blue},#15803D)`,color:following?C.darkSub:"#fff",fontWeight:800,fontSize:11,cursor:"pointer",flexShrink:0,transition:"all 0.15s" }}>
        {following ? "Following" : "+ Follow"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL TAB
// ─────────────────────────────────────────────────────────────────────────────
function LocalTab({ userCity, localPosts, onChangeCity, dbEvents, showAllEvents, setShowAllEvents }: { userCity: string; localPosts: any[]; onChangeCity: () => void; dbEvents: any[]; showAllEvents: boolean; setShowAllEvents: (v: boolean) => void }) {
  const postsToShow = localPosts.length > 0 ? localPosts : LOCAL_POSTS;

  // Merge real DB events with mock events — real ones first
  const allEvents = [
    ...dbEvents.map((e: any) => {
      const d = e.event_date ? new Date(e.event_date) : null;
      return {
        id: e.id,
        name: e.name,
        venue: e.location || (e.groups?.name ? `${e.groups.name}` : 'Online'),
        day: d ? d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase() : '—',
        date: d ? String(d.getDate()) : '—',
        emoji: e.emoji || e.groups?.emoji || '📅',
        category: e.groups?.category || 'Event',
        price: e.price || 'Free',
        time: d ? d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : '',
        isReal: true,
      };
    }),
    ...LOCAL_EVENTS.map(e => ({ ...e, id: String(e.id), isReal: false })),
  ];
  const eventsToShow = showAllEvents ? allEvents : allEvents.slice(0, 6);
  const [showHostModal, setShowHostModal] = useState(false);
  const [hostForm, setHostForm] = useState({ name: '', date: '', time: '', location: '', description: '', price: 'Free', contact: '' });
  const [hostSubmitted, setHostSubmitted] = useState(false);

  function handleHostSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In production this would POST to an API — for now show success
    setHostSubmitted(true);
    setTimeout(() => { setShowHostModal(false); setHostSubmitted(false); setHostForm({ name:'', date:'', time:'', location:'', description:'', price:'Free', contact:'' }); }, 2500);
  }

  return (
    <div className="discover-layout" style={{ display:"flex", gap:48, alignItems:"flex-start", maxWidth:1200, margin:"0 auto", padding:"24px 24px 60px" }}>

      {/* LEFT: Local posts feed */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* City banner */}
        <div style={{ background:"linear-gradient(135deg,#16A34A,#22C55E)",borderRadius:18,padding:"16px 20px",marginBottom:24,display:"flex",alignItems:"center",gap:14,boxShadow:"0 4px 20px rgba(124,58,237,0.3)" }}>
          <div style={{ fontSize:36 }}>📍</div>
          <div>
            <div style={{ fontWeight:900,fontSize:18,color:"#fff" }}>{userCity}</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.85)",marginTop:2 }}>Showing fitness content near you · {postsToShow.length} posts this week</div>
          </div>
          <button onClick={onChangeCity} style={{ marginLeft:"auto",background:"rgba(255,255,255,0.2)",border:"1.5px solid rgba(255,255,255,0.4)",borderRadius:10,color:"#fff",fontSize:12,fontWeight:700,padding:"7px 14px",cursor:"pointer",flexShrink:0 }}>
            Change City
          </button>
        </div>

        {postsToShow.map((post: any) => <DiscoverPost key={post.id} post={post} liked={false} />)}
      </div>

      {/* RIGHT: Local events sidebar */}
      <div className="discover-sidebar" style={{ width:320, flexShrink:0 }}>
        {/* Header */}
        <div style={{ marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${C.darkBorder}` }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:900,fontSize:15,color:"#E2E8F0",marginBottom:2 }}>📅 Local Events This Week</div>
              <div style={{ fontSize:11,color:C.darkSub }}>Las Vegas · Mar 27–30</div>
            </div>
            <button onClick={() => setShowAllEvents(!showAllEvents)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:"#4ADE80",padding:0 }}>{showAllEvents ? "Show less" : "See all"}</button>
          </div>
        </div>

        {eventsToShow.map((event: any) => <EventCard key={event.id} event={event} />)}
        {allEvents.length > 6 && (
          <button onClick={() => setShowAllEvents(!showAllEvents)}
            style={{ width:"100%",padding:"8px",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#4ADE80",marginBottom:8,textAlign:"center" }}>
            {showAllEvents ? "Show less ▲" : `See all ${allEvents.length} events ▼`}
          </button>
        )}

        {/* Submit event CTA */}
        <div style={{ marginTop:4,padding:"14px 16px",background:C.darkCard,borderRadius:16,border:`1px dashed #16A34A`,textAlign:"center",cursor:"pointer",transition:"all 0.15s" }}
          onClick={() => setShowHostModal(true)}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background="#1A2A1A"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background=C.darkCard; }}
        >
          <div style={{ fontSize:22,marginBottom:5 }}>➕</div>
          <div style={{ fontWeight:800,fontSize:13,color:"#E2E8F0",marginBottom:3 }}>Host an Event</div>
          <div style={{ fontSize:11,color:C.darkSub }}>Submit your local fitness event for free</div>
        </div>
      </div>

      {/* Host an Event Modal */}
      {showHostModal && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={() => setShowHostModal(false)}>
          <div style={{ background:"#1A1D2E",borderRadius:24,border:"1px solid #2A2D3E",width:"100%",maxWidth:480,padding:28,maxHeight:"90vh",overflowY:"auto" }} onClick={e => e.stopPropagation()}>
            {hostSubmitted ? (
              <div style={{ textAlign:"center",padding:"32px 0" }}>
                <div style={{ fontSize:56,marginBottom:12 }}>🎉</div>
                <div style={{ fontWeight:900,fontSize:20,color:"#16A34A",marginBottom:8 }}>Event Submitted!</div>
                <div style={{ fontSize:14,color:"#8892A4" }}>We'll review and post your event to the local feed.</div>
              </div>
            ) : (
              <>
                <div style={{ fontWeight:900,fontSize:18,color:"#E2E8F0",marginBottom:20 }}>📅 Host a Local Event</div>
                <form onSubmit={handleHostSubmit}>
                  {[
                    { label:"Event Name *", key:"name", placeholder:"e.g. Saturday Morning 5K" },
                    { label:"Location *", key:"location", placeholder:"e.g. Red Rock Canyon, Las Vegas" },
                    { label:"Price", key:"price", placeholder:"Free" },
                    { label:"Contact / Sign-up Link", key:"contact", placeholder:"Email or URL" },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom:12 }}>
                      <label style={{ fontSize:11,color:"#8892A4",fontWeight:700,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.8 }}>{f.label}</label>
                      <input value={(hostForm as any)[f.key]} onChange={e => setHostForm(p => ({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}
                        style={{ width:"100%",background:"#252A3D",border:"1px solid #2A2D3E",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#E2E8F0",outline:"none",fontFamily:"inherit",boxSizing:"border-box" as any }} />
                    </div>
                  ))}
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12 }}>
                    <div>
                      <label style={{ fontSize:11,color:"#8892A4",fontWeight:700,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.8 }}>Date *</label>
                      <input type="date" value={hostForm.date} onChange={e => setHostForm(p=>({...p,date:e.target.value}))} required
                        style={{ width:"100%",background:"#252A3D",border:"1px solid #2A2D3E",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#E2E8F0",outline:"none",fontFamily:"inherit",boxSizing:"border-box" as any }} />
                    </div>
                    <div>
                      <label style={{ fontSize:11,color:"#8892A4",fontWeight:700,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.8 }}>Time</label>
                      <input type="time" value={hostForm.time} onChange={e => setHostForm(p=>({...p,time:e.target.value}))}
                        style={{ width:"100%",background:"#252A3D",border:"1px solid #2A2D3E",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#E2E8F0",outline:"none",fontFamily:"inherit",boxSizing:"border-box" as any }} />
                    </div>
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <label style={{ fontSize:11,color:"#8892A4",fontWeight:700,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.8 }}>Description</label>
                    <textarea value={hostForm.description} onChange={e => setHostForm(p=>({...p,description:e.target.value}))} placeholder="What should attendees expect?" rows={3}
                      style={{ width:"100%",background:"#252A3D",border:"1px solid #2A2D3E",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#E2E8F0",outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box" as any }} />
                  </div>
                  <div style={{ display:"flex",gap:10 }}>
                    <button type="button" onClick={() => setShowHostModal(false)} style={{ flex:1,padding:"11px",borderRadius:10,border:"1px solid #2A2D3E",background:"transparent",color:"#8892A4",fontWeight:700,cursor:"pointer" }}>Cancel</button>
                    <button type="submit" disabled={!hostForm.name||!hostForm.location||!hostForm.date} style={{ flex:2,padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#16A34A,#22C55E)",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",opacity:(!hostForm.name||!hostForm.location||!hostForm.date)?0.5:1 }}>
                      Submit Event 🎉
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD TAB
// ─────────────────────────────────────────────────────────────────────────────
function WorldTab() {
  return (
    <div className="discover-layout" style={{ display:"flex", gap:48, alignItems:"flex-start", maxWidth:1200, margin:"0 auto", padding:"24px 24px 60px" }}>

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
      <div className="discover-sidebar" style={{ width:320, flexShrink:0 }}>

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
  const router = useRouter();
  const [tab, setTab] = useState<"local" | "world">("local");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{id:string;username:string;full_name:string;avatar_url:string|null}[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<any>(null);

  // City-based local feed
  const [userCity, setUserCity] = useState("Las Vegas, NV");
  const [localPosts, setLocalPosts] = useState<any[]>([]);
  const [showChangeCityOverlay, setShowChangeCityOverlay] = useState(false);
  const [newCityInput, setNewCityInput] = useState("");

  // Real events from DB
  const [dbEvents, setDbEvents] = useState<any[]>([]);
  const [showAllEvents, setShowAllEvents] = useState(false);

  useEffect(() => {
    async function loadEvents() {
      const { data } = await supabase
        .from('group_events')
        .select('*, groups(name, category, emoji)')
        .order('event_date', { ascending: true })
        .limit(50);
      if (data && data.length > 0) setDbEvents(data);
    }
    loadEvents();
  }, []);

  useEffect(() => {
    async function loadLocalPosts() {
      const { data: { user } } = await supabase.auth.getUser();
      let city = userCity;
      if (user) {
        const { data: profile } = await supabase.from('users').select('city').eq('id', user.id).single();
        if ((profile as any)?.city) { city = (profile as any).city; setUserCity((profile as any).city); }
      }
      const { data } = await supabase
        .from('posts')
        .select('*, user:users!posts_user_id_fkey(id,username,full_name,avatar_url,city)')
        .ilike('location', `%${city.split(',')[0]}%`)
        .order('created_at', { ascending: false })
        .limit(30);
      if (data && data.length > 0) setLocalPosts(data);
    }
    loadLocalPosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      const q = searchQuery.trim().toLowerCase();
      const { data } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url')
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(20);
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  return (
    <div style={{ background:C.bg, minHeight:"100vh" }}>
      <style jsx global>{`
        @media (max-width: 767px) {
          .discover-layout { flex-direction: column !important; padding: 0 12px !important; gap: 0 !important; }
          .discover-sidebar { width: 100% !important; }
        }
      `}</style>

      {/* ── Sticky Header ── */}
      <div style={{ position:"sticky",top:0,zIndex:100,background:C.white,borderBottom:`2px solid ${C.greenLight}` }}>
        <div style={{ maxWidth:1200,margin:"0 auto",padding:"14px 24px 0",display:"flex",alignItems:"center",gap:16 }}>
          {/* Title */}
          <div style={{ display:"flex",alignItems:"center",gap:8,marginRight:8 }}>
            <span style={{ fontSize:20 }}>🔍</span>
            <span style={{ fontWeight:900,fontSize:20,color:C.text }}>Discovery</span>
          </div>

          {/* Search bar */}
          <div style={{ flex:1,maxWidth:380,position:"relative" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,background:C.greenLight,borderRadius:24,padding:"8px 16px",border:`1.5px solid ${searchQuery ? C.blue : C.greenMid}` }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:16,height:16,flexShrink:0 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                placeholder="Search people..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ background:"none",border:"none",outline:"none",fontSize:13,color:C.text,flex:1 }}
              />
              {searchQuery && (
                <button onClick={()=>setSearchQuery("")} style={{background:"none",border:"none",cursor:"pointer",color:C.sub,fontSize:16,padding:0,lineHeight:1}}>×</button>
              )}
            </div>
            {/* Search results dropdown */}
            {searchQuery.trim() && (
              <div style={{ position:"absolute",top:"calc(100% + 8px)",left:0,right:0,background:C.white,borderRadius:18,border:`1.5px solid ${C.greenMid}`,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",zIndex:200,overflow:"hidden",maxHeight:320,overflowY:"auto" }}>
                {searchLoading ? (
                  <div style={{ padding:"16px",textAlign:"center",color:C.sub,fontSize:13 }}>Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding:"16px",textAlign:"center",color:C.sub,fontSize:13 }}>No results for "{searchQuery}"</div>
                ) : (
                  searchResults.map(u => (
                    <div key={u.id} onClick={()=>{setSearchQuery("");router.push(`/profile/${u.username}`);}}
                      style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",borderBottom:`1px solid ${C.greenLight}`,transition:"background 0.1s" }}
                      onMouseEnter={e=>(e.currentTarget.style.background=C.greenLight)}
                      onMouseLeave={e=>(e.currentTarget.style.background=C.white)}>
                      <div style={{ width:40,height:40,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff" }}>
                        {u.avatar_url ? <img src={u.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/> : (u.full_name||u.username||"?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontWeight:800,fontSize:14,color:C.text }}>{u.full_name}</div>
                        <div style={{ fontSize:12,color:C.sub }}>@{u.username}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
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
      {tab === "local" ? <LocalTab userCity={userCity} localPosts={localPosts} onChangeCity={() => { setNewCityInput(userCity); setShowChangeCityOverlay(true); }} dbEvents={dbEvents} showAllEvents={showAllEvents} setShowAllEvents={setShowAllEvents} /> : <WorldTab />}

      {/* ── Change City Overlay ── */}
      {showChangeCityOverlay && (
        <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}
          onClick={() => setShowChangeCityOverlay(false)}>
          <div style={{ background:"#1A2E1E",borderRadius:20,padding:28,width:"100%",maxWidth:380,border:"2px solid #2A4A30" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:900,fontSize:18,color:"#E2E8F0",marginBottom:16 }}>📍 Change City</div>
            <input
              value={newCityInput}
              onChange={e => setNewCityInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newCityInput.trim()) { setUserCity(newCityInput.trim()); setLocalPosts([]); setShowChangeCityOverlay(false); } }}
              placeholder="e.g. Los Angeles, CA"
              style={{ width:"100%",padding:"12px 16px",borderRadius:12,border:"1.5px solid #2A4A30",background:"#1E3522",fontSize:15,color:"#E2E8F0",outline:"none",boxSizing:"border-box",marginBottom:16 }}
              autoFocus
            />
            <div style={{ display:"flex",gap:12 }}>
              <button onClick={() => setShowChangeCityOverlay(false)} style={{ flex:1,padding:"12px 0",borderRadius:12,border:"1.5px solid #2A4A30",background:"transparent",color:"#9CA3AF",fontWeight:700,fontSize:14,cursor:"pointer" }}>Cancel</button>
              <button onClick={() => { if (newCityInput.trim()) { setUserCity(newCityInput.trim()); setLocalPosts([]); setShowChangeCityOverlay(false); } }} style={{ flex:1,padding:"12px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#16A34A,#22C55E)",color:"#fff",fontWeight:900,fontSize:14,cursor:"pointer" }}>Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

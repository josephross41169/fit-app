"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getEventCategory } from "@/lib/eventCategories";

const C = {
  blue:"#7C3AED", greenLight:"#1A2A1A", greenMid:"#2A3A2A",
  gold:"#F5A623", goldLight:"#FFFBEE",
  text:"#F0F0F0", sub:"#9CA3AF", white:"#1A1A1A", bg:"#0D0D0D",
  dark:"#0D0D0D", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
};

// -----------------------------------------------------------------------------
// MOCK DATA
// -----------------------------------------------------------------------------

const LOCAL_POSTS = [
  { id: 1, user: "Kayla Nguyen", username: "kayla_fit_lv", avatar: "KN", time: "1h ago",
    caption: "Morning hike at Red Rock Canyon 🏔️ Nothing like Vegas in the early hours before the heat hits. 6 miles done!",
    tags: ["#LasVegas","#RedRock","#HikingFit"], likes: 124,
    photo: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80" },
  { id: 2, user: "Marcus Bell", username: "marcus_lvfit", avatar: "MB", time: "3h ago",
    caption: "Orangetheory trial class this morning - absolute FIRE 🔥 First class free this week at the Summerlin location. Go get it!",
    tags: ["#LasVegas","#Orangetheory","#Fitness"], likes: 89,
    photo: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=80" },
  { id: 3, user: "Priya Sharma", username: "priya_wellness_lv", avatar: "PS", time: "5h ago",
    caption: "Farmers market haul 🥬 Downtown Summerlin had the most incredible produce today. Meal prepping all week with this!",
    tags: ["#LasVegas","#FarmersMarket","#MealPrep"], likes: 203,
    photo: "https://images.unsplash.com/photo-1506484381205-f7945653044d?w=800&q=80" },
  { id: 4, user: "Diego Reyes", username: "diego_runs_lv", avatar: "DR", time: "7h ago",
    caption: "5K run + brunch at Eggslut after 🏃 The Vegas Strip at 6am before the tourists wake up is genuinely beautiful.",
    tags: ["#LasVegas","#5K","#RunClub"], likes: 156,
    photo: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80" },
];

// LOCAL_EVENTS now comes from the database via the events_with_counts view.
// Loaded inside the component, filtered by user's city.

const WORLD_POSTS = [
  { id: 1, user: "Chris Bumstead", username: "cbum", avatar: "CB", time: "2h ago",
    caption: "Prep is going insane this year. I genuinely think this is the best shape I've ever been in. Classic Olympia here we come 💪",
    tags: ["#Olympia","#ClassicPhysique","#Cbum"], likes: 48200,
    photo: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80" },
  { id: 2, user: "Courtney Black", username: "courtney_black", avatar: "CB", time: "4h ago",
    caption: "New Gymshark collab just dropped and I am OBSESSED 🔥 Link in bio - these might be the best leggings I've ever worn.",
    tags: ["#Gymshark","#Fitness","#GymFashion"], likes: 31500,
    photo: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80" },
  { id: 3, user: "Jeff Nippard", username: "jeffnippard", avatar: "JN", time: "6h ago",
    caption: "Science-based arm training guide is LIVE on YouTube. This is the most comprehensive arm video I've ever made. Go watch it!",
    tags: ["#Science","#ArmDay","#NaturalBodybuilding"], likes: 22800,
    photo: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=80" },
  { id: 4, user: "Natacha Oceane", username: "natacha_oceane", avatar: "NO", time: "8h ago",
    caption: "Your body is not a before and after. Stop treating it like a project to fix and start treating it like a home to live in 💚",
    tags: ["#BodyPositivity","#MindfulFitness","#Wellness"], likes: 67400,
    photo: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800&q=80" },
];

const TRENDING_BRANDS = [
  { id: 1, name: "Gymshark", handle: "@gymshark", emoji: "💪", category: "Apparel", posts: "2.4M", color: "#1A1A1A", followers: "7.2M" },
  { id: 2, name: "Nike Training", handle: "@niketraining", emoji: "👟", category: "Footwear & Apparel", posts: "8.1M", color: "#E5000F", followers: "31.5M" },
  { id: 3, name: "Dior Fitness", handle: "@dior", emoji: "👗", category: "Luxury Activewear", posts: "890K", color: "#C9A96E", followers: "4.1M" },
  { id: 4, name: "Lululemon", handle: "@lululemon", emoji: "🧘", category: "Activewear", posts: "3.2M", color: "#BE3A34", followers: "5.8M" },
  { id: 5, name: "Whoop", handle: "@whoop", emoji: "⌚", category: "Wearables", posts: "420K", color: "#00D4AA", followers: "1.3M" },
];

const TRENDING_PEOPLE = [
  { id: 1, name: "Chris Bumstead", handle: "@cbum", avatar: "CB", specialty: "Classic Physique - 4x Olympia", followers: "22.4M", trend: "+18K today" },
  { id: 2, name: "Courtney Black", handle: "@courtney_black", avatar: "CB2", specialty: "HIIT - Gymshark Athlete", followers: "4.1M", trend: "+6.2K today" },
  { id: 3, name: "Jeff Nippard", handle: "@jeffnippard", avatar: "JN", specialty: "Science-Based Training", followers: "8.8M", trend: "+9.1K today" },
  { id: 4, name: "Natacha Oceane", handle: "@natacha_oceane", avatar: "NO", specialty: "Mindful Fitness - Wellness", followers: "3.2M", trend: "+4.8K today" },
  { id: 5, name: "Andrew Huberman", handle: "@hubermanlab", avatar: "AH", specialty: "Neuroscience - Performance", followers: "6.7M", trend: "+12.3K today" },
];

const SUGGESTED_ACCOUNTS = [
  { id: 1, avatar: "RS", name: "Rachel Stone", handle: "@rachel_lifts", specialty: "Olympic Weightlifting", followers: "84K", mutual: 3 },
  { id: 2, avatar: "TM", name: "Tyler Moore", handle: "@tyler_macro", specialty: "Nutrition Coach - IFBB", followers: "142K", mutual: 5 },
  { id: 3, avatar: "AM", name: "Aisha Mohammed", handle: "@aisha_runs", specialty: "Marathon - Trail Running", followers: "56K", mutual: 2 },
  { id: 4, avatar: "BK", name: "Brandon Kim", handle: "@bk_calisthenics", specialty: "Calisthenics - Street Workout", followers: "218K", mutual: 7 },
  { id: 5, avatar: "LF", name: "Luna Ferreira", handle: "@luna_wellness", specialty: "Pilates - Breathwork", followers: "93K", mutual: 4 },
];

// -----------------------------------------------------------------------------
// TYPE DEFINITIONS
// -----------------------------------------------------------------------------

interface Post {
  id: string | number;
  caption?: string;
  media_url?: string;
  photo?: string;
  time?: string;
  user?: string | { full_name?: string; username?: string; avatar_url?: string };
  users?: { full_name?: string; username?: string; avatar_url?: string };
  username?: string;
  avatar?: string;
  tags?: string[];
  likes?: number;
  likes_count?: number;
  comments_count?: number;
}

interface DbEvent {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  event_date: string;
  date_tbd: boolean;
  location_name: string | null;
  city: string | null;
  price: string;
  going_count: number;
}

interface LocalPost extends Post {
  user: string;
  username: string;
  avatar: string;
  likes: number;
}

// COMPONENTS
// -----------------------------------------------------------------------------

function DiscoverPost({ post, liked: initLiked }: { post: Post; liked: boolean }) {
  const [liked, setLiked] = useState(initLiked);
  // Support both mock (post.likes) and real DB (post.likes_count)
  const [likes, setLikes] = useState(post.likes ?? post.likes_count ?? 0);
  const router = useRouter();

  // Normalize fields · handle both mock data shapes and real DB posts
  // DB posts: post.user = joined users row (object), post.users = same via alternate join key
  const userObj = (post.user && typeof post.user === 'object') ? post.user : (post.users || null);
  const displayName   = (typeof post.user === 'string' ? post.user : null) || userObj?.full_name || userObj?.username || "User";
  const displayHandle = post.username || userObj?.username || "user";
  const displayAvatar = (typeof post.avatar === 'string' && !post.avatar.startsWith('http')) ? post.avatar : null;
  const avatarUrl     = userObj?.avatar_url || (typeof post.avatar === 'string' && post.avatar.startsWith('http') ? post.avatar : null);
  const avatarIni     = displayName.split(" ").map((n: string) => n[0]).join("").slice(0,2).toUpperCase();
  const photoSrc      = post.photo || post.media_url || null;
  const tags: string[]= Array.isArray(post.tags) ? post.tags : [];
  const caption       = post.caption || "";

  return (
    <div style={{ background:C.white,borderRadius:20,border:`2px solid ${C.greenMid}`,boxShadow:"0 4px 24px rgba(124,58,237,0.09)",marginBottom:28,overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 18px 10px" }}>
        <div onClick={() => router.push(`/profile/${displayHandle}`)} style={{ width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},#4ADE80)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0,cursor:"pointer",overflow:"hidden" }}>
          {avatarUrl
            ? <img src={avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" onError={e=>{(e.target as HTMLImageElement).style.display="none"}}/>
            : (displayAvatar || avatarIni)}
        </div>
        <div style={{ flex:1,cursor:"pointer" }} onClick={() => router.push(`/profile/${displayHandle}`)}>
          <div style={{ fontWeight:900,fontSize:15,color:C.text }}>{displayName}</div>
          <div style={{ fontSize:12,color:C.sub }}>@{displayHandle} · {post.time || ""}</div>
        </div>
        <button style={{ padding:"6px 16px",borderRadius:20,background:C.greenLight,border:`1.5px solid ${C.blue}`,color:C.blue,fontWeight:800,fontSize:12,cursor:"pointer" }}>
          + Follow
        </button>
      </div>

      {/* Photo */}
      <div onClick={() => router.push(`/post/${post.id}`)} style={{ width:"100%",aspectRatio:"4/3",background:"#111",overflow:"hidden",position:"relative",cursor:"pointer" }}>
        {photoSrc
          ? <img src={photoSrc} alt="" style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }} />
          : <div style={{ width:"100%",height:"100%",background:`linear-gradient(135deg,${C.greenLight},${C.greenMid})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:80 }}>📸</div>
        }
        {tags.length > 0 && (
        <div style={{ position:"absolute",bottom:14,left:18,display:"flex",gap:8,flexWrap:"wrap" }}>
          {tags.map(t => (
            <span key={t} style={{ background:"rgba(0,0,0,0.52)",color:"#fff",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,backdropFilter:"blur(6px)" }}>{t}</span>
          ))}
        </div>
        )}
      </div>

      {/* Caption */}
      {caption && <div style={{ padding:"12px 18px 8px",fontSize:14,color:C.text,lineHeight:1.65 }}>{caption}</div>}

      {/* Actions */}
      <div style={{ padding:"8px 18px 14px",display:"flex",alignItems:"center",gap:20,borderTop:`1px solid ${C.greenLight}`,marginTop:4 }}>
        <button onClick={() => { setLiked(l => !l); setLikes(n => liked ? n-1 : n+1); }} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0 }}>
          <svg viewBox="0 0 24 24" fill={liked?"#FF6B6B":"none"} stroke={liked?"#FF6B6B":C.sub} strokeWidth="2" style={{ width:22,height:22,transition:"all 0.15s" }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span style={{ fontSize:14,fontWeight:700,color:liked?"#FF6B6B":C.sub }}>{likes.toLocaleString()}</span>
        </button>
        <button onClick={() => router.push(`/post/${post.id}`)} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0 }} aria-label="Comment">
          <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:20,height:20 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {(post.comments_count ?? 0) > 0 && (
            <span style={{ fontSize:14,fontWeight:700,color:C.sub }}>{post.comments_count}</span>
          )}
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

// -- Local Event Card · renders a real event row from public.events_with_counts --
interface DiscoverEvent {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  event_date: string;
  date_tbd: boolean;
  location_name: string | null;
  city: string | null;
  price: string;
  going_count: number;
}

function EventCard({ event }: { event: DiscoverEvent }) {
  const cat = getEventCategory(event.category);
  const date = new Date(event.event_date);
  const day = event.date_tbd ? "TBD" : date.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
  const dateNum = event.date_tbd ? "—" : String(date.getDate());
  const timeStr = event.date_tbd ? "Date TBD" : date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <Link href={`/events/${event.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{ background:C.darkCard,borderRadius:16,border:`1px solid ${C.darkBorder}`,marginBottom:10,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",transition:"border-color 0.15s" }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#7C3AED"}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.darkBorder}
      >
        {/* Date badge */}
        <div style={{ width:48,height:48,borderRadius:13,background:"linear-gradient(135deg,#7C3AED,#A78BFA)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
          <div style={{ fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.85)",textTransform:"uppercase",letterSpacing:0.5 }}>{day}</div>
          <div style={{ fontSize:20,fontWeight:900,color:"#fff",lineHeight:1 }}>{dateNum}</div>
        </div>
        {/* Info */}
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
            <span style={{ fontSize:14 }}>{cat.emoji}</span>
            <span style={{ fontWeight:800,fontSize:13,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{event.title}</span>
          </div>
          {event.location_name && (
            <div style={{ fontSize:11,color:C.darkSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:4 }}>📍 {event.location_name}</div>
          )}
          <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            <span style={{ background:"rgba(124,58,237,0.2)",color:"#4ADE80",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,border:"1px solid rgba(124,58,237,0.3)" }}>{cat.label}</span>
            <span style={{ color:event.price === "Free" ? "#22C55E" : C.gold,fontSize:11,fontWeight:800 }}>{event.price}</span>
            <span style={{ color:C.darkSub,fontSize:10 }}>· {timeStr}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// -- Trending Brand Card -------------------------------------------------------
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
        <div style={{ marginTop:6,padding:"4px 10px",borderRadius:8,background:"rgba(124,58,237,0.15)",color:C.blue,fontSize:10,fontWeight:700,border:`1px solid rgba(124,58,237,0.3)` }}>View ?</div>
      </div>
    </div>
  );
}

// -- Trending Person Card ------------------------------------------------------
function TrendingPersonCard({ person, rank }: { person: typeof TRENDING_PEOPLE[0]; rank: number }) {
  const [following, setFollowing] = useState(false);
  const router = useRouter();
  return (
    <div onClick={() => router.push(`/profile/${person.handle.replace("@","")}`)} style={{ background:C.darkCard,borderRadius:16,border:`1px solid ${C.darkBorder}`,marginBottom:10,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer" }}>
      <div style={{ width:14,fontSize:11,fontWeight:900,color:C.darkSub,flexShrink:0,textAlign:"center" }}>#{rank}</div>
      <div style={{ width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#4ADE80)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff",flexShrink:0 }}>
        {person.avatar.slice(0,2)}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:800,fontSize:13,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{person.name}</div>
        <div style={{ fontSize:11,color:C.darkSub,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{person.specialty}</div>
        <div style={{ fontSize:10,color:"#7C3AED",marginTop:2,fontWeight:700 }}>🔥 {person.trend}</div>
      </div>
      <button onClick={() => setFollowing(f=>!f)} style={{ padding:"6px 12px",borderRadius:9,border:"none",background:following?"#2A2D3E":`linear-gradient(135deg,${C.blue},#15803D)`,color:following?C.darkSub:"#fff",fontWeight:800,fontSize:11,cursor:"pointer",flexShrink:0,transition:"all 0.15s" }}>
        {following ? "Following" : "+ Follow"}
      </button>
    </div>
  );
}

// -- Suggested Account Card ----------------------------------------------------
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
          <span style={{ color:"#7C3AED",fontWeight:700 }}> {account.mutual} mutual</span>
        </div>
      </div>
      <button onClick={() => setFollowing(f=>!f)} style={{ padding:"6px 12px",borderRadius:9,border:"none",background:following?"#2A2D3E":`linear-gradient(135deg,${C.blue},#15803D)`,color:following?C.darkSub:"#fff",fontWeight:800,fontSize:11,cursor:"pointer",flexShrink:0,transition:"all 0.15s" }}>
        {following ? "Following" : "+ Follow"}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// LOCAL TAB
// -----------------------------------------------------------------------------
function LocalTab({ userCity, localPosts, onChangeCity, dbEvents, showAllEvents, setShowAllEvents }: { userCity: string; localPosts: Post[]; onChangeCity: () => void; dbEvents: DbEvent[]; showAllEvents: boolean; setShowAllEvents: (v: boolean) => void }) {
  const postsToShow = localPosts.length > 0 ? localPosts : LOCAL_POSTS;

  // Real events from the database, already filtered by city in the parent
  const allEvents = dbEvents;
  const eventsToShow = showAllEvents ? allEvents : allEvents.slice(0, 6);
  // Host modal removed — "Host an Event" now links to /events/new directly.

  return (
    <div className="discover-layout" style={{ display:"flex", gap:48, alignItems:"flex-start", maxWidth:1200, margin:"0 auto", padding:"24px 24px 60px" }}>

      {/* LEFT: Local posts feed */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* City banner */}
        <div style={{ background:"linear-gradient(135deg,#7C3AED,#A78BFA)",borderRadius:18,padding:"16px 20px",marginBottom:24,display:"flex",alignItems:"center",gap:14,boxShadow:"0 4px 20px rgba(124,58,237,0.3)" }}>
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
              <div style={{ fontSize:11,color:C.darkSub }}>Las Vegas · Mar 27·30</div>
            </div>
            <button onClick={() => setShowAllEvents(!showAllEvents)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:"#4ADE80",padding:0 }}>{showAllEvents ? "Show less" : "See all"}</button>
          </div>
        </div>

        {eventsToShow.map((event: any) => <EventCard key={event.id} event={event} />)}
        {allEvents.length > 6 && (
          <button onClick={() => setShowAllEvents(!showAllEvents)}
            style={{ width:"100%",padding:"8px",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#4ADE80",marginBottom:8,textAlign:"center" }}>
            {showAllEvents ? "Show less ↑" : `See all ${allEvents.length} events →`}
          </button>
        )}

        {/* Submit event CTA — links to the new dedicated /events/new page.
            Old inline modal removed in favor of the full create-event flow. */}
        <Link href="/events/new" style={{ textDecoration: "none", display: "block" }}>
          <div style={{ marginTop:4,padding:"14px 16px",background:C.darkCard,borderRadius:16,border:`1px dashed #7C3AED`,textAlign:"center",cursor:"pointer",transition:"all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background="#1A2A1A"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background=C.darkCard; }}
          >
            <div style={{ fontSize:22,marginBottom:5 }}>+</div>
            <div style={{ fontWeight:800,fontSize:13,color:"#E2E8F0",marginBottom:3 }}>Host an Event</div>
            <div style={{ fontSize:11,color:C.darkSub }}>Create a local event for free</div>
          </div>
        </Link>

        {/* Browse all events link */}
        <Link href="/events" style={{ display: "block", textDecoration: "none", textAlign: "center", marginTop: 12, padding: "10px", color: "#A78BFA", fontSize: 12, fontWeight: 700 }}>
          Browse all events →
        </Link>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// WORLD TAB
// -----------------------------------------------------------------------------
function WorldTab() {
  return (
    <div className="discover-layout" style={{ display:"flex", gap:48, alignItems:"flex-start", maxWidth:1200, margin:"0 auto", padding:"24px 24px 60px" }}>

      {/* LEFT: World posts feed */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Trending banner */}
        <div style={{ background:`linear-gradient(135deg,#7C3AED,#A78BFA)`,borderRadius:18,padding:"16px 20px",marginBottom:24,display:"flex",alignItems:"center",gap:14 }}>
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

        {/* -- Top 5 Trending Brands -- */}
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

        {/* -- Top 5 Trending People -- */}
        <div style={{ margin:"20px 0 16px",paddingBottom:12,borderBottom:`1px solid ${C.darkBorder}` }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:900,fontSize:15,color:"#E2E8F0",marginBottom:2 }}>? Trending People</div>
              <div style={{ fontSize:11,color:C.darkSub }}>Top 5 this week</div>
            </div>
            <button style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:C.blue,padding:0 }}>See all</button>
          </div>
        </div>
        {TRENDING_PEOPLE.map((p,i) => <TrendingPersonCard key={p.id} person={p} rank={i+1} />)}

        {/* -- Suggested Accounts -- */}
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

// -----------------------------------------------------------------------------
// MAIN PAGE
// -----------------------------------------------------------------------------
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
  const [dbEvents, setDbEvents] = useState<DbEvent[]>([]);
  const [showAllEvents, setShowAllEvents] = useState(false);

  // Re-fetch events whenever the user's city changes so the sidebar stays
  // in sync with whatever city they've picked above.
  useEffect(() => {
    async function loadEvents() {
      const now = new Date().toISOString();
      let query = supabase
        .from('events_with_counts')
        .select('id, title, category, subcategory, event_date, date_tbd, location_name, city, price, going_count')
        .eq('is_public', true)
        .gte('event_date', now)
        .order('event_date', { ascending: true })
        .limit(50);
      // City match: pull events whose city contains the user's city string.
      // ilike is case-insensitive substring, so "Las Vegas" matches "Las Vegas, NV"
      if (userCity) query = query.ilike('city', `%${userCity.split(',')[0].trim()}%`);
      const { data } = await query;
      setDbEvents(data || []);
    }
    loadEvents();
  }, [userCity]);

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

      {/* -- Sticky Header -- */}
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
                <button onClick={()=>setSearchQuery("")} style={{background:"none",border:"none",cursor:"pointer",color:C.sub,fontSize:16,padding:0,lineHeight:1}}>·</button>
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

      {/* -- Tab content -- */}
      {tab === "local" ? <LocalTab userCity={userCity} localPosts={localPosts} onChangeCity={() => { setNewCityInput(userCity); setShowChangeCityOverlay(true); }} dbEvents={dbEvents} showAllEvents={showAllEvents} setShowAllEvents={setShowAllEvents} /> : <WorldTab />}

      {/* -- Change City Overlay -- */}
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
              <button onClick={() => { if (newCityInput.trim()) { setUserCity(newCityInput.trim()); setLocalPosts([]); setShowChangeCityOverlay(false); } }} style={{ flex:1,padding:"12px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#7C3AED,#A78BFA)",color:"#fff",fontWeight:900,fontSize:14,cursor:"pointer" }}>Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



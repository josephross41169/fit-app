"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const C = {
  blue:"#16A34A", blueLight:"#1A2A1A", blueMid:"#2A3A2A",
  gold:"#F5A623", text:"#F0F0F0", sub:"#9CA3AF", white:"#1A1A1A", bg:"#0D0D0D",
  dark:"#0D0D0D", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
};

const CATEGORY_COLORS: Record<string,string> = {
  "Running":"#16A34A","Strength":"#16A34A","Yoga":"#52C97A","HIIT":"#EF4444",
  "Bodybuilding":"#F5A623","Nutrition":"#7C3AED","Wellness":"#22C55E","Calisthenics":"#7C3AED",
  "General":"#16A34A",
};

// ── Full group data (mock fallback) ────────────────────────────────────────────
const ALL_GROUPS: Record<string, any> = {
  "lv-morning-runners": {
    name:"LV Morning Runners", category:"Running", emoji:"🏃", members:284, isLocal:true,
    city:"Las Vegas, NV", meetFrequency:"Every Saturday 6AM", location:"Red Rock Canyon Trailhead",
    tags:["#Running","#LasVegas","#5K","#TrailRun"],
    description:"Las Vegas's most active morning run crew. All paces welcome — whether you're doing a casual jog or training for a marathon. We meet weekly at Red Rock and host monthly races. No one gets left behind, and everyone gets celebrated.",
    recentPhoto:"https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200&q=80",
    events:[
      { id:"1", name:"Saturday 5K", date:"Mar 29", time:"6:00 AM", emoji:"🏃", price:"Free", description:"Weekly group run at Red Rock Canyon. All paces welcome. Meet at the lower trailhead.", comments:[] },
      { id:"3", name:"Monthly Trail Race", date:"Apr 12", time:"7:00 AM", emoji:"🏅", price:"$15", description:"Official timed trail race through Red Rock. 5K and 10K distances available.", comments:[] },
    ],
    posts:[
      { id:"1", user:"Kayla Nguyen", avatar:"KN", time:"2h ago", content:"6 miles done this morning! Red Rock at sunrise is something else entirely 🏔️", likes:34, photo:"https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80" },
      { id:"2", user:"Diego Reyes", avatar:"DR", time:"1d ago", content:"New PR on the Saturday loop — 24:12 🔥 Training is paying off.", likes:58, photo:null },
    ],
    members_list:[
      { avatar:"KN", name:"Kayla Nguyen", role:"Organizer", rank:1, points:2840 },
      { avatar:"DR", name:"Diego Reyes", role:"Top Member", rank:2, points:2100 },
      { avatar:"MB", name:"Marcus Bell", role:"Top Member", rank:3, points:1890 },
    ],
    leaderboard:[
      { avatar:"DR", name:"Diego Reyes", score:"42 runs", metric:"Miles This Month", value:"186 mi", rank:1 },
      { avatar:"KN", name:"Kayla Nguyen", score:"38 runs", metric:"Miles This Month", value:"172 mi", rank:2 },
      { avatar:"MB", name:"Marcus Bell", score:"31 runs", metric:"Miles This Month", value:"148 mi", rank:3 },
    ],
    challenges:[
      { id:"1", name:"5 Minute Mile Club", emoji:"⚡", desc:"Run a sub-5 minute mile and post your proof.", participants:12, deadline:"Apr 30", difficulty:"Elite", badge:"⚡" },
      { id:"2", name:"100 Mile March", emoji:"🏅", desc:"Log 100 miles in March. Every run counts.", participants:47, deadline:"Mar 31", difficulty:"Hard", badge:"💯" },
    ],
    notes:[
      { id:"1", user:"Kayla Nguyen", avatar:"KN", time:"3h ago", category:"Workout", content:"My go-to pre-run warmup: 5 min walk → 20 leg swings → 10 hip circles → easy jog for 5 min.", likes:24 },
      { id:"2", user:"Diego Reyes", avatar:"DR", time:"1d ago", category:"Recipe", content:"Post-run recovery smoothie 🥤 Banana + almond milk + 2 scoops protein + frozen mango.", likes:41 },
    ],
  },
  "summerlin-iron-club": {
    name:"Summerlin Iron Club", category:"Strength", emoji:"🏋️", members:156, isLocal:true,
    city:"Las Vegas, NV", meetFrequency:"Mon / Wed / Fri 5:30AM", location:"24 Hour Fitness · Summerlin",
    tags:["#Powerlifting","#Summerlin","#Strength"],
    description:"Serious lifters who show up early and push each other. Powerlifting-focused with a supportive community vibe.",
    recentPhoto:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80",
    events:[
      { id:"2", name:"Max Out Monday", date:"Mar 31", time:"5:30 AM", emoji:"💪", price:"Free", description:"Weekly 1RM attempts. Squat, bench, deadlift. Spotters provided.", comments:[] },
    ],
    posts:[
      { id:"1", user:"Jake Morrison", avatar:"JM", time:"3h ago", content:"New bench PR today — 225 for 5 clean reps. The Iron Club energy in the early morning is unmatched 💪", likes:47, photo:"https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80" },
    ],
    members_list:[
      { avatar:"JM", name:"Jake Morrison", role:"Organizer", rank:1, points:3200 },
      { avatar:"MD", name:"Mike Davis", role:"Top Member", rank:2, points:2800 },
    ],
    leaderboard:[
      { avatar:"MD", name:"Mike Davis", score:"315 squat", metric:"Best Lift This Month", value:"405 deadlift", rank:1 },
      { avatar:"JM", name:"Jake Morrison", score:"225 bench", metric:"Best Lift This Month", value:"385 deadlift", rank:2 },
    ],
    challenges:[
      { id:"1", name:"1000 Pound Club", emoji:"🏆", desc:"Total your squat + bench + deadlift to 1000 lbs or more in a single session.", participants:8, deadline:"Jun 1", difficulty:"Elite", badge:"🏆" },
    ],
    notes:[
      { id:"1", user:"Jake Morrison", avatar:"JM", time:"5h ago", category:"Workout", content:"Current push day: Bench 5x5 → Incline DB 4x10 → Cable flies 3x15.", likes:38 },
    ],
  },
  "vegas-yoga-collective": {
    name:"Vegas Yoga Collective", category:"Yoga", emoji:"🧘", members:412, isLocal:true,
    city:"Las Vegas, NV", meetFrequency:"Every Sunday 8AM", location:"Sunset Park · Las Vegas",
    tags:["#Yoga","#Wellness","#LasVegas","#Mindfulness"],
    description:"Free community yoga every Sunday in the park. All levels, all ages, all bodies. Mats provided for beginners.",
    recentPhoto:"https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=1200&q=80",
    events:[
      { id:"5", name:"Sunday Flow", date:"Mar 30", time:"8:00 AM", emoji:"🧘", price:"Free", description:"60 minute vinyasa flow for all levels. Mats and blocks provided.", comments:[] },
    ],
    posts:[
      { id:"1", user:"Maya Torres", avatar:"MT", time:"4h ago", content:"Last Sunday was our biggest turnout yet — 60+ people in the park 🌿", likes:112, photo:"https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&q=80" },
    ],
    members_list:[
      { avatar:"MT", name:"Maya Torres", role:"Organizer", rank:1, points:4200 },
      { avatar:"PS", name:"Priya Sharma", role:"Top Member", rank:2, points:2800 },
    ],
    leaderboard:[
      { avatar:"MT", name:"Maya Torres", score:"52 sessions", metric:"Sessions This Month", value:"60 hrs total", rank:1 },
      { avatar:"PS", name:"Priya Sharma", score:"38 sessions", metric:"Sessions This Month", value:"42 hrs total", rank:2 },
    ],
    challenges:[
      { id:"1", name:"30-Day Morning Practice", emoji:"🌅", desc:"Practice yoga every morning for 30 days, even if just 10 minutes.", participants:84, deadline:"Apr 30", difficulty:"Medium", badge:"🌅" },
    ],
    notes:[
      { id:"1", user:"Maya Torres", avatar:"MT", time:"2h ago", category:"Mindset", content:"When I'm anxious I do box breathing: inhale 4 counts, hold 4, exhale 4, hold 4.", likes:89 },
    ],
  },
  "lv-hiit-squad": {
    name:"LV HIIT Squad", category:"HIIT", emoji:"🔥", members:198, isLocal:true,
    city:"Las Vegas, NV", meetFrequency:"Tue / Thu 6PM", location:"Springs Preserve · Las Vegas",
    tags:["#HIIT","#LasVegas","#Bootcamp","#Cardio"],
    description:"High intensity, zero judgment. Outdoor bootcamp sessions that leave you completely gassed.",
    recentPhoto:"https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=1200&q=80",
    events:[
      { id:"4", name:"Thursday Burnout", date:"Mar 27", time:"6:00 PM", emoji:"🔥", price:"Free", description:"45 minute HIIT circuit. Burpees, box jumps, sprint intervals. Bring water.", comments:[] },
    ],
    posts:[
      { id:"1", user:"Marcus Bell", avatar:"MB", time:"5h ago", content:"Tuesday's session was absolutely brutal and I loved every second. Thursday we go again 🔥", likes:34, photo:null },
    ],
    members_list:[
      { avatar:"MB", name:"Marcus Bell", role:"Organizer", rank:1, points:3100 },
      { avatar:"DR", name:"Diego Reyes", role:"Top Member", rank:2, points:2400 },
    ],
    leaderboard:[
      { avatar:"MB", name:"Marcus Bell", score:"28 sessions", metric:"Calories Burned", value:"18,400 cal", rank:1 },
      { avatar:"DR", name:"Diego Reyes", score:"24 sessions", metric:"Calories Burned", value:"15,800 cal", rank:2 },
    ],
    challenges:[
      { id:"1", name:"Spring Shred 30", emoji:"🌱", desc:"30 days of consecutive HIIT workouts. Miss a day and start over.", participants:34, deadline:"Apr 30", difficulty:"Hard", badge:"🌱" },
    ],
    notes:[
      { id:"1", user:"Marcus Bell", avatar:"MB", time:"1h ago", category:"Workout", content:"My HIIT protocol: 40 sec on / 20 sec off. Round 1: burpees, mountain climbers, jump squats.", likes:45 },
    ],
  },
  "global-gains-community": {
    name:"Global Gains Community", category:"Bodybuilding", emoji:"💪", members:48200, isLocal:false, trending:true,
    tags:["#Bodybuilding","#Gains","#Worldwide"],
    description:"The internet's most supportive bodybuilding community. Post your lifts, get form checks, share progress, and get hyped by 48,000 people who actually get it.",
    recentPhoto:"https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1200&q=80",
    events:[
      { id:"8", name:"Weekly Check-In Thread", date:"Every Monday", time:"All Day", emoji:"📊", price:"Free", description:"Post your weekly progress photo, current lifts, and goals for the week.", comments:[] },
    ],
    posts:[
      { id:"1", user:"Chris B.", avatar:"CB", time:"1h ago", content:"Prep week 8. Coming in tighter than I've ever been. 💪", likes:2840, photo:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80" },
    ],
    members_list:[
      { avatar:"CB", name:"Chris B.", role:"Top Contributor", rank:1, points:48200 },
      { avatar:"MT", name:"Maya T.", role:"Moderator", rank:2, points:31500 },
    ],
    leaderboard:[
      { avatar:"CB", name:"Chris B.", score:"284 posts", metric:"Community Points", value:"48,200 pts", rank:1 },
      { avatar:"JK", name:"Jordan Kim", score:"198 posts", metric:"Community Points", value:"31,500 pts", rank:2 },
    ],
    challenges:[
      { id:"1", name:"1000 Pound Club", emoji:"🏆", desc:"Total your squat + bench + deadlift to 1000 lbs or more. Post the video.", participants:312, deadline:"Jun 1", difficulty:"Elite", badge:"🏆" },
    ],
    notes:[
      { id:"1", user:"Chris B.", avatar:"CB", time:"2h ago", category:"Workout", content:"Current chest split: Flat bench 5x5 → Incline DB press 4x10 → Pec deck 4x15.", likes:1240 },
    ],
  },
};

["women-who-lift","macro-masters","mindful-movement-collective","5k-to-marathon","calisthenics-worldwide"].forEach(id => {
  if (!ALL_GROUPS[id]) {
    ALL_GROUPS[id] = {
      name: id.replace(/-/g," ").replace(/\b\w/g,(l:string)=>l.toUpperCase()),
      category:"Wellness", emoji:"💪", members:0, isLocal:false,
      tags:[], description:"Group details coming soon.",
      recentPhoto:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80",
      events:[], posts:[], members_list:[], leaderboard:[], challenges:[], notes:[],
    };
  }
});

// ── EventCard ─────────────────────────────────────────────────────────────────
function EventCard({ event, catColor, commentInputs, setCommentInputs, eventComments, addEventComment, onRSVP, rsvped }: {
  event: any; catColor: string;
  commentInputs: Record<string,string>;
  setCommentInputs: React.Dispatch<React.SetStateAction<Record<string,string>>>;
  eventComments: Record<string,{user:string;avatar?:string;text:string;time:string}[]>;
  addEventComment: (id:string) => void;
  onRSVP?: (id:string) => void;
  rsvped?: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const comments = eventComments[event.id] || [];
  const darkCard = "#1A1D2E", darkBorder = "#2A2D3E", darkSub = "#8892A4", gold = "#F5A623";

  // Format event date
  const dateDisplay = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', { month:'short', day:'numeric' })
    : event.date || 'TBD';
  const timeDisplay = event.event_date
    ? new Date(event.event_date).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })
    : event.time || '';

  return (
    <div style={{ background:darkCard, borderRadius:16, border:`1px solid ${darkBorder}`, marginBottom:12, overflow:"hidden" }}>
      <div style={{ padding:"13px 14px", cursor:"pointer" }} onClick={() => setShowComments(s=>!s)}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg,${catColor},${catColor}CC)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{event.emoji || '📅'}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:13, color:"#E2E8F0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{event.name}</div>
            <div style={{ fontSize:11, color:darkSub, marginTop:2 }}>📅 {dateDisplay} · ⏰ {timeDisplay}</div>
            <div style={{ fontSize:11, fontWeight:700, color:gold, marginTop:1 }}>{event.price || 'Free'}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
            {onRSVP && (
              <button onClick={e => { e.stopPropagation(); onRSVP(event.id); }} style={{ padding:"4px 10px", borderRadius:8, border:"none", background:rsvped?catColor+"33":"rgba(255,255,255,0.1)", color:rsvped?catColor:"#E2E8F0", fontWeight:700, fontSize:10, cursor:"pointer" }}>
                {rsvped ? "✓ RSVP'd" : "RSVP"}
              </button>
            )}
            {event.rsvp_count > 0 && <div style={{ fontSize:10, color:darkSub }}>{event.rsvp_count} going</div>}
            <div style={{ color:darkSub, fontSize:12 }}>{showComments?"▲":"▼"}</div>
          </div>
        </div>
        {event.description && <p style={{ fontSize:11, color:darkSub, lineHeight:1.5, marginTop:8, marginBottom:0 }}>{event.description}</p>}
      </div>
      {showComments && (
        <div style={{ borderTop:`1px solid ${darkBorder}`, padding:"10px 14px" }}>
          {comments.length > 0 && (
            <div style={{ marginBottom:8 }}>
              {comments.map((c,i) => (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                  <div style={{ width:26, height:26, borderRadius:"50%", background:catColor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, color:"#fff", flexShrink:0 }}>{c.avatar || 'U'}</div>
                  <div style={{ flex:1, background:"#252A3D", borderRadius:10, padding:"7px 10px" }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#E2E8F0" }}>{c.user} </span>
                    <span style={{ fontSize:11, color:darkSub }}>{c.text}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:"flex", gap:6 }}>
            <input value={commentInputs[event.id]||""} onChange={e=>setCommentInputs(p=>({...p,[event.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addEventComment(event.id)} placeholder="Add a comment..." style={{ flex:1, background:"#252A3D", border:`1px solid ${darkBorder}`, borderRadius:20, padding:"7px 12px", fontSize:11, color:"#E2E8F0", outline:"none", fontFamily:"inherit" }} />
            <button onClick={()=>addEventComment(event.id)} style={{ padding:"7px 12px", borderRadius:20, background:catColor, border:"none", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>Post</button>
          </div>
        </div>
      )}
    </div>
  );
}

const DIFFICULTY_COLORS: Record<string,string> = {
  "Beginner":"#7C3AED", "Medium":"#16A34A", "Hard":"#F5A623", "Elite":"#EF4444", "Legendary":"#16A34A",
};
const NOTE_CATEGORY_COLORS: Record<string,string> = {
  "Workout":"#16A34A", "Recipe":"#7C3AED", "Mindset":"#16A34A", "General":"#F5A623", "Tip":"#7C3AED",
};
const EMOJI_OPTIONS = ["💪","🏃","🧘","🔥","🏋️","🥗","🌿","🤸","🏅","⚡","🌱","🦾","🏆","🚀","📅","🎯"];

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY GROUP CHALLENGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const WEEKLY_CHALLENGE_GOAL = 50;

const MOCK_WEEKLY_MEMBERS = [
  { name: "Jake Morrison",   avatar: "JM", workouts: 5, today: true  },
  { name: "Mike Davis",      avatar: "MD", workouts: 4, today: false },
  { name: "Sarah Chen",      avatar: "SC", workouts: 4, today: true  },
  { name: "Diego Reyes",     avatar: "DR", workouts: 3, today: false },
  { name: "Kayla Nguyen",    avatar: "KN", workouts: 3, today: true  },
];

function WeeklyChallengeSection({ groupName, catColor }: { groupName: string; catColor: string }) {
  const [showChallenge, setShowChallenge] = useState(true);
  const [challengeSent, setChallengeSent] = useState(false);

  // Derive totals from mock
  const teamTotal = MOCK_WEEKLY_MEMBERS.reduce((s, m) => s + m.workouts, 0);
  const progressPct = Math.min(100, Math.round((teamTotal / WEEKLY_CHALLENGE_GOAL) * 100));

  // Days remaining (mock: it's Wednesday so 4 days left)
  const daysRemaining = 4;

  const pulse = `
    @keyframes weeklyGlow {
      0%   { box-shadow: 0 0 14px 2px #7C3AED44; }
      50%  { box-shadow: 0 0 28px 8px #7C3AED77; }
      100% { box-shadow: 0 0 14px 2px #7C3AED44; }
    }
    @keyframes progressFill {
      0%   { opacity: 0.7; }
      50%  { opacity: 1; }
      100% { opacity: 0.7; }
    }
    @keyframes countUp {
      from { transform: scale(0.85); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
  `;

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{pulse}</style>

      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#F0F0F0", display: "flex", alignItems: "center", gap: 8 }}>
          ⚔️ Weekly Challenge
          <span style={{
            background: "#7C3AED22", color: "#7C3AED",
            fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 99,
            border: "1px solid #7C3AED44",
          }}>
            {daysRemaining}d left
          </span>
        </div>
        <button
          onClick={() => setShowChallenge(s => !s)}
          style={{
            background: "transparent", border: "none",
            color: "#9CA3AF", fontSize: 12, cursor: "pointer", fontWeight: 700,
          }}
        >
          {showChallenge ? "Collapse ▲" : "Expand ▼"}
        </button>
      </div>

      {showChallenge && (
        <div style={{
          background: "linear-gradient(135deg, #1A1230, #120A28)",
          borderRadius: 20, border: "2px solid #7C3AED44",
          overflow: "hidden",
          animation: "weeklyGlow 3s ease-in-out infinite",
        }}>

          {/* Top card: team score + days remaining */}
          <div style={{
            background: "linear-gradient(135deg, #2D1B69, #1A0D3E)",
            padding: "18px 20px",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{ textAlign: "center", minWidth: 80 }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: "#fff", animation: "countUp 0.6s ease-out" }}>
                {teamTotal}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                Team Workouts
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>
                  Weekly Goal: {WEEKLY_CHALLENGE_GOAL} workouts
                </span>
                <span style={{ fontSize: 12, color: "#7C3AED", fontWeight: 800 }}>
                  {progressPct}%
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ height: 12, background: "rgba(255,255,255,0.1)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: progressPct >= 100
                    ? "linear-gradient(90deg, #7C3AED, #34D399)"
                    : progressPct >= 60
                    ? "linear-gradient(90deg, #7C3AED, #9D5CF0)"
                    : "linear-gradient(90deg, #EF4444, #F87171)",
                  borderRadius: 99,
                  transition: "width 0.8s ease",
                  animation: "progressFill 2s ease-in-out infinite",
                }} />
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 5 }}>
                {WEEKLY_CHALLENGE_GOAL - teamTotal > 0
                  ? `${WEEKLY_CHALLENGE_GOAL - teamTotal} more to hit the goal 🎯`
                  : "🏆 Goal smashed! Keep going!"}
              </div>
            </div>

            {/* Days remaining badge */}
            <div style={{
              background: "rgba(255,255,255,0.1)", borderRadius: 14,
              padding: "10px 14px", textAlign: "center", flexShrink: 0,
              border: "1px solid rgba(255,255,255,0.15)",
            }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: daysRemaining <= 2 ? "#EF4444" : "#fff" }}>
                {daysRemaining}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>
                days left
              </div>
            </div>
          </div>

          {/* Member leaderboard */}
          <div style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 800, fontSize: 11, color: "#9CA3AF", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Member Contributions This Week
            </div>

            {MOCK_WEEKLY_MEMBERS.map((member, idx) => {
              const memberPct = Math.round((member.workouts / WEEKLY_CHALLENGE_GOAL) * 100);
              const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
              const rankEmojis = ["🥇", "🥈", "🥉"];
              return (
                <div key={member.avatar} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0",
                  borderBottom: idx < MOCK_WEEKLY_MEMBERS.length - 1 ? "1px solid #2D1B6933" : "none",
                }}>
                  {/* Rank */}
                  <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
                    {idx < 3
                      ? <span style={{ fontSize: 16 }}>{rankEmojis[idx]}</span>
                      : <span style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF" }}>#{idx + 1}</span>
                    }
                  </div>

                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: `linear-gradient(135deg, #7C3AED, #9D5CF0)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 900, color: "#fff", flexShrink: 0,
                    border: member.today ? "2px solid #7C3AED" : "2px solid transparent",
                    position: "relative",
                  }}>
                    {member.avatar}
                    {member.today && (
                      <div style={{
                        position: "absolute", bottom: -2, right: -2,
                        width: 12, height: 12, borderRadius: "50%",
                        background: "#7C3AED", border: "2px solid #1A1230",
                        boxShadow: "0 0 6px #7C3AED",
                      }} />
                    )}
                  </div>

                  {/* Name + bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#F0F0F0" }}>{member.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: idx === 0 ? "#FFD700" : "#9CA3AF" }}>
                        {member.workouts} workouts
                      </span>
                    </div>
                    <div style={{ height: 5, background: "#2D1B6955", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${memberPct}%`,
                        background: idx === 0
                          ? "linear-gradient(90deg, #FFD700, #FBB040)"
                          : idx < 3
                          ? "linear-gradient(90deg, #7C3AED, #9D5CF0)"
                          : "#7C3AED88",
                        borderRadius: 99,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Challenge Another Group button */}
          <div style={{ padding: "0 20px 20px", display: "flex", gap: 10 }}>
            <button
              onClick={() => setChallengeSent(s => !s)}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 13, border: "none",
                background: challengeSent
                  ? "rgba(124,58,237,0.15)"
                  : "linear-gradient(135deg, #7C3AED, #9D5CF0)",
                color: challengeSent ? "#7C3AED" : "#fff",
                fontWeight: 800, fontSize: 14, cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: challengeSent ? "none" : "0 4px 18px #7C3AED55",
              }}
            >
              {challengeSent ? "⚔️ Challenge Sent — Waiting for Response..." : "⚔️ Challenge Another Group"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function GroupPage() {
  const { id } = useParams<{ id:string }>();
  const router = useRouter();

  // ── DB State ──
  const [dbGroup, setDbGroup] = useState<any>(null);
  const [dbPosts, setDbPosts] = useState<any[]>([]);
  const [dbEvents, setDbEvents] = useState<any[]>([]);
  const [dbChallenges, setDbChallenges] = useState<any[]>([]);
  const [dbNotes, setDbNotes] = useState<any[]>([]);
  const [dbMembers, setDbMembers] = useState<any[]>([]);
  const [dbLeaderboard, setDbLeaderboard] = useState<any[]>([]);
  const [isMemberDB, setIsMemberDB] = useState(false);
  const [isOwnerDB, setIsOwnerDB] = useState(false);
  const [joinedChallengeIdsDB, setJoinedChallengeIdsDB] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [rsvpedEvents, setRsvpedEvents] = useState<Set<string>>(new Set());

  // ── UI State ──
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [tab, setTab] = useState<"posts"|"leaderboard"|"challenges"|"notes"|"events"|"members"|"war">("posts");
  const [postLikes, setPostLikes] = useState<Record<string,number>>({});
  const [likedPosts, setLikedPosts] = useState<Record<string,boolean>>({});
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] = useState("General");
  const [localNotes, setLocalNotes] = useState<any[]>([]);
  const [eventComments, setEventComments] = useState<Record<string,{user:string;text:string;time:string}[]>>({});

  // ── War / Challenge state ──
  const [warChallenges, setWarChallenges] = useState<any[]>([]);
  const [warLoading, setWarLoading] = useState(false);
  const [expandedChallenge, setExpandedChallenge] = useState<string|null>(null);
  const [showCreateWar, setShowCreateWar] = useState(false);
  const [warForm, setWarForm] = useState({ title:"", metric:"miles_run", lift_type:"", duration_days:7 });
  const [warSelectedMembers, setWarSelectedMembers] = useState<string[]>([]);
  const [warSaving, setWarSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [warPosted, setWarPosted] = useState(false);
  const [openBoardChallenges, setOpenBoardChallenges] = useState<any[]>([]);
  const [openBoardTab, setOpenBoardTab] = useState<"ours"|"discover">("ours");
  const [commentInputs, setCommentInputs] = useState<Record<string,string>>({});
  const [joinedChallenges, setJoinedChallenges] = useState<Record<string,boolean>>({});
  const [shareCopied, setShareCopied] = useState(false);
  const [postComments, setPostComments] = useState<Record<string, {user:string; avatar:string; text:string; time:string}[]>>({});
  const [postCommentInputs, setPostCommentInputs] = useState<Record<string,string>>({});
  const [expandedPostComments, setExpandedPostComments] = useState<Record<string,boolean>>({});
  const [noteLikes, setNoteLikes] = useState<Record<string,number>>({});

  // ── Post form state ──
  const [postContent, setPostContent] = useState("");
  const [postSubmitting, setPostSubmitting] = useState(false);

  // ── Create Event modal ──
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({ name:'', description:'', date:'', time:'', location:'', price:'Free', emoji:'📅' });
  const [eventSubmitting, setEventSubmitting] = useState(false);

  // ── Create Challenge modal ──
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeForm, setChallengeForm] = useState({ name:'', description:'', emoji:'🏆', metric_label:'', metric_unit:'', difficulty:'Medium', deadline:'' });
  const [challengeSubmitting, setChallengeSubmitting] = useState(false);

  // ── Log Progress modal ──
  const [logProgressChallenge, setLogProgressChallenge] = useState<any>(null);
  const [logValue, setLogValue] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [challengeScores, setChallengeScores] = useState<Record<string,number>>({});

  // ── More menu / Delete group ──
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Banner upload ──
  const [bannerUploading, setBannerUploading] = useState(false);

  // ── Note replies ──
  const [noteReplies, setNoteReplies] = useState<Record<string, {user:string; avatar:string; text:string; time:string}[]>>({});
  const [noteReplyInputs, setNoteReplyInputs] = useState<Record<string,string>>({});
  const [expandedNoteReplies, setExpandedNoteReplies] = useState<Record<string,boolean>>({});

  // ── Load data on mount ──
  useEffect(() => {
    loadGroupData();
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, [id]);

  async function loadGroupData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const params = new URLSearchParams({ action: 'get_group', groupId: id as string });
      if (user) params.append('userId', user.id);
      const res = await fetch(`/api/db?${params}`);
      const data = await res.json();

      if (data.group) {
        setDbGroup(data.group);
        setDbPosts(data.posts || []);
        setDbEvents(data.events || []);
        setDbChallenges(data.challenges || []);
        setDbNotes(data.notes || []);
        setDbMembers(data.members || []);
        setIsMemberDB(data.is_member || false);
        setJoined(data.is_member || false);
        setJoinedChallengeIdsDB(data.joined_challenge_ids || []);
        if (data.group && user) setIsOwnerDB(data.group.created_by === user.id);

        // Init challenge scores from joined challenges
        const scores: Record<string, number> = {};
        (data.joined_challenge_ids || []).forEach((cid: string) => { scores[cid] = 0; });
        setChallengeScores(scores);

        // Load leaderboard
        const lbParams = new URLSearchParams({ action: 'get_leaderboard', groupId: data.group.id });
        const lbRes = await fetch(`/api/db?${lbParams}`);
        const lbData = await lbRes.json();
        setDbLeaderboard(lbData.leaderboard || []);

        // Load event comments
        if (data.events?.length > 0) {
          const commentMap: Record<string, any[]> = {};
          await Promise.all((data.events as any[]).map(async (ev: any) => {
            try {
              const cRes = await fetch(`/api/db?action=get_event_comments&eventId=${ev.id}`);
              const cData = await cRes.json();
              if (cData.comments?.length > 0) commentMap[ev.id] = cData.comments;
            } catch {}
          }));
          if (Object.keys(commentMap).length > 0) setEventComments(commentMap);
        }
      }
    } catch {
      // Fall through to mock data
    } finally {
      setLoading(false);
    }
  }

  // Use DB group if available, otherwise fall back to mock
  const mockGroup = ALL_GROUPS[id as string];
  const group = dbGroup ? {
    name: dbGroup.name,
    category: dbGroup.category || 'General',
    emoji: dbGroup.emoji || '💪',
    members: dbGroup.member_count || 0,
    isLocal: !dbGroup.is_online,
    city: dbGroup.location || 'Online',
    meetFrequency: dbGroup.meet_frequency || '',
    location: dbGroup.location || '',
    tags: dbGroup.tags || [],
    description: dbGroup.description || '',
    recentPhoto: dbGroup.banner_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80',
    events: dbEvents,
    posts: dbPosts,
    members_list: dbMembers,
    leaderboard: dbLeaderboard,
    challenges: dbChallenges,
    notes: dbNotes,
    _dbId: dbGroup.id,
    _isOwner: currentUser && dbGroup.created_by === currentUser?.id,
  } : mockGroup;


  // ── Load war challenges (must be hook, before any conditional returns) ────────
  const loadWarChallenges = useCallback(async () => {
    const dbId = (dbGroup as any)?.id;
    if (!dbId) return;
    setWarLoading(true);
    try {
      // Our group's challenges
      const { data } = await supabase
        .from("group_challenges")
        .select(`*, creator_group:creator_group_id(id,name), opponent_group:opponent_group_id(id,name),
          winner_group:winner_group_id(id,name),
          group_challenge_members(user_id,group_id,contribution,weight_entry,weight_submitted,
            users(id,username,full_name,avatar_url)),
          group_challenge_media(id,media_url,media_type,caption,created_at,user_id,
            users(username,full_name))`)
        .or(`creator_group_id.eq.${dbId},opponent_group_id.eq.${dbId}`)
        .order("created_at", { ascending: false });
      setWarChallenges(data || []);

      // All open challenges from OTHER groups (the discovery board)
      const { data: openData } = await supabase
        .from("group_challenges")
        .select(`*, creator_group:creator_group_id(id,name,emoji,member_count)`)
        .eq("status", "open")
        .neq("creator_group_id", dbId)
        .order("created_at", { ascending: false });
      setOpenBoardChallenges(openData || []);
    } catch(e) { console.error(e); }
    setWarLoading(false);
  }, [dbGroup, tab]);

  useEffect(() => {
    if (tab === "war" && (dbGroup as any)?.id) loadWarChallenges();
  }, [tab, dbGroup, loadWarChallenges]);

  if (!loading && !group) {
    return (
      <div style={{ background:C.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
        <div style={{ background:C.white, borderRadius:24, border:`2px solid ${C.blueMid}`, padding:"48px 40px", maxWidth:440, width:"100%", textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🤝</div>
          <div style={{ fontWeight:900, fontSize:20, color:C.text, marginBottom:8 }}>Group not found</div>
          <button onClick={() => router.push("/connect")} style={{ color:C.blue, fontWeight:700, fontSize:14, background:"none", border:"none", cursor:"pointer" }}>← Back to Connect</button>
        </div>
      </div>
    );
  }

  if (loading || !group) {
    return (
      <div style={{ background:C.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontWeight:700, fontSize:16, color:C.sub }}>Loading group...</div>
      </div>
    );
  }

  const catColor = CATEGORY_COLORS[group.category] ?? C.blue;
  const isOwnerOrMod = group._isOwner || isMemberDB;

  // ── Create challenge ─────────────────────────────────────────────────────────
  const createWarChallenge = async () => {
    const dbId = group._dbId;
    if (!dbId || !currentUser) return;
    if (!warForm.title.trim()) return alert("Add a title");
    if (warSelectedMembers.length === 0) return alert("Select at least 1 team member");
    if (warForm.metric === "weight_lifted" && !warForm.lift_type) return alert("Select a lift type");
    setWarSaving(true);
    try {
      const { data: chal, error } = await supabase.from("group_challenges").insert({
        creator_group_id: dbId,
        title: warForm.title,
        metric: warForm.metric,
        lift_type: warForm.metric === "weight_lifted" ? warForm.lift_type : null,
        duration_days: warForm.duration_days,
        member_count: warSelectedMembers.length,
        status: "open",
      }).select().single();
      if (error) throw error;
      await supabase.from("group_challenge_members").insert(
        warSelectedMembers.map(uid => ({ challenge_id: chal.id, user_id: uid, group_id: dbId }))
      );
      setShowCreateWar(false);
      setWarForm({ title:"", metric:"miles_run", lift_type:"", duration_days:7 });
      setWarSelectedMembers([]);
      setWarPosted(true);
      setTimeout(() => setWarPosted(false), 5000);
      await loadWarChallenges();
    } catch(e) { console.error(e); alert("Error creating challenge"); }
    setWarSaving(false);
  };

  // ── Upload media to challenge ─────────────────────────────────────────────────
  const uploadWarMedia = async (chalId: string, file: File) => {
    if (!currentUser) return;
    const dbId = group._dbId;
    setUploadingMedia(true);
    try {
      const path = `challenges/${chalId}/${currentUser.id}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("activity").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("activity").getPublicUrl(path);
      await supabase.from("group_challenge_media").insert({
        challenge_id: chalId, user_id: currentUser.id, group_id: dbId,
        media_url: publicUrl, media_type: "photo",
      });
      loadWarChallenges();
    } catch(e) { console.error(e); alert("Upload failed"); }
    setUploadingMedia(false);
  };

  // ── Accept open challenge ────────────────────────────────────────────────────
  const acceptWarChallenge = async (chal: any) => {
    const dbId = group._dbId || (dbGroup as any)?.id;
    if (!dbId || !currentUser) {
      alert("Unable to accept — please make sure you are logged in and this is your group.");
      return;
    }
    try {
      const start = new Date();
      const end = new Date(start); end.setDate(end.getDate() + (chal.duration_days || 7));
      const { error } = await supabase.from("group_challenges").update({
        opponent_group_id: dbId,
        status: "active",
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      }).eq("id", chal.id);
      if (error) { console.error(error); alert("Error accepting challenge: " + error.message); return; }

      // Add accepting group members as challenge participants
      const acceptingMembers = dbMembers.slice(0, chal.member_count || 1);
      if (acceptingMembers.length > 0) {
        await supabase.from("group_challenge_members").insert(
          acceptingMembers.map((m: any) => ({
            challenge_id: chal.id,
            user_id: m.user_id || m.id,
            group_id: dbId,
          }))
        );
      }

      // Switch to Our Wars tab to see the active challenge
      setOpenBoardTab("ours");
      await loadWarChallenges();
    } catch(e: any) {
      console.error(e);
      alert("Something went wrong: " + e.message);
    }
  };

  // ── Submit weight entry ───────────────────────────────────────────────────────
  const submitWeightEntry = async (chalId: string, value: number) => {
    if (!currentUser) return;
    await supabase.from("group_challenge_members")
      .update({ weight_entry: value, weight_submitted: true })
      .eq("challenge_id", chalId).eq("user_id", currentUser.id);
    loadWarChallenges();
  };

  // ── Merged notes (DB + local) ──
  const allNotes = [
    ...dbNotes.map((n: any) => ({
      id: n.id, user: n.user?.full_name || n.user?.username || 'Unknown',
      avatar: (n.user?.full_name || n.user?.username || 'U').slice(0,2).toUpperCase(),
      avatarUrl: n.user?.avatar_url || null,
      time: new Date(n.created_at).toLocaleDateString(), category: n.category, content: n.content, likes: n.likes_count || 0,
    })),
    ...localNotes,
  ];

  // ── Merged posts (DB + local) ──
  const allPosts = dbPosts.map((p: any) => ({
    id: p.id, user: p.user?.full_name || p.user?.username || 'Unknown',
    avatar: (p.user?.full_name || p.user?.username || 'U').slice(0,2).toUpperCase(),
    avatarUrl: p.user?.avatar_url || null,
    time: new Date(p.created_at).toLocaleDateString(), content: p.content, likes: p.likes_count || 0, photo: p.media_url || null,
  }));

  // Use mock posts as fallback if no DB posts
  const displayPosts = allPosts.length > 0 ? allPosts : (mockGroup?.posts || []);
  const displayEvents = dbEvents.length > 0 ? dbEvents : (mockGroup?.events || []);
  const displayChallenges = dbChallenges.length > 0 ? dbChallenges : (mockGroup?.challenges || []);
  const displayLeaderboard = dbLeaderboard.length > 0
    ? dbLeaderboard.map((e: any, i: number) => ({
        rank: i + 1,
        avatar: (e.user?.full_name || e.user?.username || 'U').slice(0,2).toUpperCase(),
        avatarUrl: e.user?.avatar_url || null,
        name: e.user?.full_name || e.user?.username || 'Unknown',
        username: e.user?.username || null,
        score: `${e.score} ${e.metric_label || ''}`,
        metric: e.metric_label || '',
        value: `${e.score} pts`,
        challengeId: e.challenge_id || null,
        challengeName: e.challenge?.name || e.metric_label || 'Challenge',
        challengeEmoji: e.challenge?.emoji || '🏆',
      }))
    : (mockGroup?.leaderboard || []);

  // Group leaderboard entries by challengeId
  const leaderboardByChallengeMap = displayLeaderboard.reduce((acc: Record<string, {name:string;emoji:string;entries:any[]}>, entry: any) => {
    const key = entry.challengeId || 'general';
    if (!acc[key]) {
      acc[key] = { name: entry.challengeName || 'Challenge', emoji: entry.challengeEmoji || '🏆', entries: [] };
    }
    acc[key].entries.push(entry);
    return acc;
  }, {} as Record<string, {name:string;emoji:string;entries:any[]}>);

  // Re-rank within each challenge group
  Object.values(leaderboardByChallengeMap).forEach((group: any) => {
    group.entries.sort((a: any, b: any) => b.score - a.score);
    group.entries.forEach((e: any, i: number) => { e.rank = i + 1; });
  });

  const leaderboardGroups = Object.entries(leaderboardByChallengeMap);
  const displayMembers = dbMembers.length > 0
    ? dbMembers.map((m: any, i: number) => ({
        rank: i + 1,
        avatar: (m.user?.full_name || m.user?.username || 'U').slice(0,2).toUpperCase(),
        avatarUrl: m.user?.avatar_url || null,
        name: m.user?.full_name || m.user?.username || 'Unknown',
        username: m.user?.username || null,
        userId: m.user_id || null,
        role: m.role === 'owner' ? 'Organizer' : m.role === 'moderator' ? 'Moderator' : 'Member',
        points: 0,
      }))
    : (mockGroup?.members_list || []);

  // ── Event helpers ──
  async function addEventComment(eventId: string) {
    const text = commentInputs[eventId]?.trim();
    if (!text) return;
    // Optimistic update
    setEventComments(prev => ({ ...prev, [eventId]: [...(prev[eventId] || []), { user:"You", avatar: (currentUser?.email || 'Y').slice(0,2).toUpperCase(), text, time:"Just now" }] }));
    setCommentInputs(prev => ({ ...prev, [eventId]: "" }));
    // Persist
    if (currentUser) {
      fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_event_comment', payload: { eventId, userId: currentUser.id, text } }),
      }).catch(console.error);
    }
  }

  async function handleRSVP(eventId: string) {
    if (rsvpedEvents.has(eventId)) return;
    setRsvpedEvents(prev => new Set([...prev, eventId]));
    if (currentUser && group._dbId) {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rsvp_event', payload: { userId: currentUser.id, eventId } }),
      });
    }
  }

  // ── Join group ──
  async function handleJoinGroup() {
    if (joined || joining) return;
    setJoining(true);
    try {
      if (currentUser && group._dbId) {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'join_group', payload: { userId: currentUser.id, groupId: group._dbId } }),
        });
        setIsMemberDB(true);
      }
      setJoined(true);
    } finally {
      setJoining(false);
    }
  }

  // ── Submit post ──
  async function submitPost() {
    if (!postContent.trim() || postSubmitting) return;
    setPostSubmitting(true);
    try {
      if (currentUser && group._dbId) {
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_group_post', payload: { userId: currentUser.id, groupId: group._dbId, content: postContent } }),
        });
        const data = await res.json();
        if (data.post) {
          const p = data.post;
          setDbPosts(prev => [{
            id: p.id, user: p.user?.full_name || p.user?.username || 'You',
            avatar: (currentUser?.email || 'Y').slice(0,2).toUpperCase(),
            time: 'Just now', content: p.content, likes: 0, photo: null,
          }, ...prev]);
        }
      } else {
        // Mock add
        setDbPosts(prev => [{ id: String(Date.now()), user:'You', avatar:'JB', time:'Just now', content:postContent, likes_count:0, media_url:null, created_at:new Date().toISOString() }, ...prev]);
      }
      setPostContent("");
    } finally {
      setPostSubmitting(false);
    }
  }

  // ── Submit event ──
  async function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventForm.name.trim() || eventSubmitting) return;
    setEventSubmitting(true);
    try {
      if (currentUser && group._dbId) {
        const eventDate = eventForm.date && eventForm.time ? new Date(`${eventForm.date}T${eventForm.time}`).toISOString() : null;
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_group_event', payload: { userId: currentUser.id, groupId: group._dbId, name: eventForm.name, description: eventForm.description, event_date: eventDate, location: eventForm.location, price: eventForm.price, emoji: eventForm.emoji } }),
        });
        const data = await res.json();
        if (data.event) setDbEvents(prev => [...prev, data.event]);
      }
      setShowEventModal(false);
      setEventForm({ name:'', description:'', date:'', time:'', location:'', price:'Free', emoji:'📅' });
    } finally {
      setEventSubmitting(false);
    }
  }

  // ── Submit challenge ──
  async function submitChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeForm.name.trim() || !challengeForm.metric_label.trim() || challengeSubmitting) return;
    setChallengeSubmitting(true);
    try {
      if (currentUser && group._dbId) {
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_challenge', payload: { userId: currentUser.id, groupId: group._dbId, ...challengeForm, deadline: challengeForm.deadline || null } }),
        });
        const data = await res.json();
        if (data.challenge) setDbChallenges(prev => [...prev, data.challenge]);
      }
      setShowChallengeModal(false);
      setChallengeForm({ name:'', description:'', emoji:'🏆', metric_label:'', metric_unit:'', difficulty:'Medium', deadline:'' });
    } finally {
      setChallengeSubmitting(false);
    }
  }

  // ── Join challenge ──
  async function handleJoinChallenge(ch: any) {
    const chId = ch.id;
    if (joinedChallenges[chId] || joinedChallengeIdsDB.includes(chId)) return;
    setJoinedChallenges(p => ({...p,[chId]:true}));
    if (currentUser && group._dbId) {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_challenge', payload: { userId: currentUser.id, challengeId: chId, groupId: group._dbId } }),
      });
      setJoinedChallengeIdsDB(prev => [...prev, chId]);
    }
  }

  // ── Log progress ──
  async function submitLogProgress() {
    if (!logValue || logSubmitting || !logProgressChallenge) return;
    setLogSubmitting(true);
    try {
      if (currentUser && group._dbId) {
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'log_challenge_progress', payload: { userId: currentUser.id, challengeId: logProgressChallenge.id, groupId: group._dbId, value: Number(logValue), note: logNote } }),
        });
        const data = await res.json();
        if (data.newScore !== undefined) {
          setChallengeScores(p => ({...p,[logProgressChallenge.id]:data.newScore}));
        }
      }
      setLogProgressChallenge(null);
      setLogValue('');
      setLogNote('');
      // Refresh leaderboard
      if (group._dbId) {
        const lbRes = await fetch(`/api/db?action=get_leaderboard&groupId=${group._dbId}`);
        const lbData = await lbRes.json();
        setDbLeaderboard(lbData.leaderboard || []);
      }
    } finally {
      setLogSubmitting(false);
    }
  }

  // ── Submit note ──
  async function submitNote() {
    const text = noteText.trim();
    if (!text) return;
    // ALWAYS add locally first for instant feedback
    const localId = String(Date.now());
    const newLocal = {
      id: localId,
      user: "You",
      avatar: (currentUser?.email || currentUser?.user_metadata?.full_name || 'Y').slice(0,2).toUpperCase(),
      time: "Just now",
      category: noteCategory,
      content: text,
      likes: 0
    };
    setLocalNotes(prev => [...prev, newLocal]);
    setNoteText(""); // Clear immediately

    // Try to persist to DB in background
    if (currentUser && group._dbId) {
      try {
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_community_note', payload: { userId: currentUser.id, groupId: group._dbId, content: text, category: noteCategory } }),
        });
        const data = await res.json();
        if (data.note) {
          // Replace local note with DB note
          const n = data.note;
          setLocalNotes(prev => prev.filter(ln => ln.id !== localId));
          setDbNotes(prev => [{
            id: n.id,
            user: { full_name: n.user?.full_name, username: n.user?.username },
            created_at: n.created_at, category: n.category, content: n.content, likes_count: 0,
          }, ...prev]);
        }
      } catch {
        // Keep the local note
      }
    }
  }

  function togglePostLike(postId: string, baseLikes: number) {
    setLikedPosts(p => ({ ...p, [postId]: !p[postId] }));
    setPostLikes(p => ({ ...p, [postId]: likedPosts[postId] ? baseLikes : baseLikes + 1 }));
  }

  function shareGroup() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      });
    }
  }

  function submitPostComment(postId: string) {
    const text = postCommentInputs[postId]?.trim();
    if (!text) return;
    const initials = (currentUser?.email || 'Y').slice(0, 2).toUpperCase();
    setPostComments(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), { user: 'You', avatar: initials, text, time: 'Just now' }],
    }));
    setPostCommentInputs(prev => ({ ...prev, [postId]: '' }));
  }

  async function handleDeleteGroup() {
    if (!group._dbId || !currentUser) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_group', payload: { userId: currentUser.id, groupId: group._dbId } }),
      });
      const data = await res.json();
      if (!data.error) {
        router.push('/connect');
      }
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !group._dbId) return;
    setBannerUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `groups/${group._dbId}/banner.${ext}`;
      const { error: uploadError } = await supabase.storage.from('activity').upload(path, file, { upsert: true });
      if (uploadError) {
        console.error('Banner upload error:', uploadError);
        setBannerUploading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from('activity').getPublicUrl(path);
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_group_banner', payload: { groupId: group._dbId, bannerUrl: publicUrl, userId: currentUser?.id || null } }),
      });
      await loadGroupData();
    } catch (err) {
      console.error('Banner upload failed:', err);
    } finally {
      setBannerUploading(false);
    }
  }

  function submitNoteReply(noteId: string) {
    const text = noteReplyInputs[noteId]?.trim();
    if (!text) return;
    const initials = (currentUser?.email || 'Y').slice(0, 2).toUpperCase();
    setNoteReplies(prev => ({
      ...prev,
      [noteId]: [...(prev[noteId] || []), { user: 'You', avatar: initials, text, time: 'Just now' }],
    }));
    setNoteReplyInputs(prev => ({ ...prev, [noteId]: '' }));
  }

  return (
    <div style={{ background:C.bg, minHeight:"100vh", paddingBottom:80, overflowX:"hidden", maxWidth:"100vw" }}>
      <style jsx global>{`
        .groups-desktop-sidebar { display: block; }
        .groups-mobile-tab-content { display: none; }
        @media (max-width: 767px) {
          .groups-layout {
            flex-direction: column !important;
            padding: 0 !important;
            gap: 0 !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }
          .groups-layout > * { max-width: 100% !important; }
          .groups-left { padding: 12px !important; width: 100% !important; box-sizing: border-box !important; }
          .groups-desktop-sidebar { display: none !important; }
          .groups-mobile-tab-content { display: block; }
          .groups-action-bar { flex-wrap: wrap !important; gap: 8px !important; }
          .groups-action-bar button { font-size: 13px !important; padding: 10px 14px !important; }
          .groups-tabs button { font-size: 10px !important; padding: 7px 1px !important; }
        }
        @media (min-width: 768px) {
          .groups-mobile-tabs-extra { display: none !important; }
        }
      `}</style>

      {/* ── Create Event Modal ── */}
      {showEventModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setShowEventModal(false)}>
          <div style={{ background:"#1A1D2E", borderRadius:24, border:"1px solid #2A2D3E", width:"100%", maxWidth:460, padding:"24px", maxHeight:"90vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:900, fontSize:16, color:"#E2E8F0", marginBottom:16 }}>🗓️ Create Event</div>
            <form onSubmit={submitEvent}>
              {[
                { label:"Event Name *", key:"name", placeholder:"e.g. Saturday Morning Run" },
                { label:"Description", key:"description", placeholder:"What to expect..." },
                { label:"Location", key:"location", placeholder:"Red Rock Canyon / Online" },
                { label:"Price", key:"price", placeholder:"Free" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:"#8892A4", fontWeight:700, display:"block", marginBottom:5 }}>{f.label}</label>
                  <input value={(eventForm as any)[f.key]} onChange={e => setEventForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}
                    style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"9px 12px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                </div>
              ))}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:11, color:"#8892A4", fontWeight:700, display:"block", marginBottom:5 }}>Date</label>
                  <input type="date" value={eventForm.date} onChange={e => setEventForm(p=>({...p,date:e.target.value}))}
                    style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"9px 12px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#8892A4", fontWeight:700, display:"block", marginBottom:5 }}>Time</label>
                  <input type="time" value={eventForm.time} onChange={e => setEventForm(p=>({...p,time:e.target.value}))}
                    style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"9px 12px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, color:"#8892A4", fontWeight:700, display:"block", marginBottom:5 }}>Emoji</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {["📅","🏃","🏋️","🧘","🔥","🏆","🎯","🌅","🤸","💪"].map(em => (
                    <button key={em} type="button" onClick={() => setEventForm(p=>({...p,emoji:em}))}
                      style={{ width:36, height:36, borderRadius:8, border:`2px solid ${eventForm.emoji===em?"#16A34A":"#2A2D3E"}`, background:eventForm.emoji===em?"rgba(22,163,74,0.2)":"transparent", fontSize:18, cursor:"pointer" }}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" onClick={() => setShowEventModal(false)} style={{ flex:1, padding:"10px", borderRadius:10, border:"1px solid #2A2D3E", background:"transparent", color:"#8892A4", fontWeight:700, cursor:"pointer" }}>Cancel</button>
                <button type="submit" disabled={eventSubmitting} style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#16A34A,#22C55E)", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", opacity:eventSubmitting?0.7:1 }}>
                  {eventSubmitting ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Challenge Modal ── */}
      {showChallengeModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setShowChallengeModal(false)}>
          <div style={{ background:"#1A1D2E", borderRadius:24, border:"1px solid #2A2D3E", width:"100%", maxWidth:460, padding:"24px", maxHeight:"90vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:900, fontSize:16, color:"#E2E8F0", marginBottom:16 }}>⚡ Create Challenge</div>
            <form onSubmit={submitChallenge}>
              {/* Emoji */}
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:"#8892A4", fontWeight:700, display:"block", marginBottom:5 }}>Emoji</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {["🏆","🔥","⚡","🌱","💪","🏅","🤸","🎯","🌅","💀","🥇","🚀"].map(em => (
                    <button key={em} type="button" onClick={() => setChallengeForm(p=>({...p,emoji:em}))}
                      style={{ width:36, height:36, borderRadius:8, border:`2px solid ${challengeForm.emoji===em?"#16A34A":"#2A2D3E"}`, background:challengeForm.emoji===em?"rgba(22,163,74,0.2)":"transparent", fontSize:18, cursor:"pointer" }}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              {[
                { label:"Challenge Name *", key:"name", placeholder:"e.g. 30 Day Workout Streak" },
                { label:"Description", key:"description", placeholder:"What's this challenge about?" },
                { label:"What to Track (Metric) *", key:"metric_label", placeholder:"e.g. Workouts Completed, Miles Run" },
                { label:"Unit (optional)", key:"metric_unit", placeholder:"e.g. sessions, mi, lbs" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:"#8892A4", fontWeight:700, display:"block", marginBottom:5 }}>{f.label}</label>
                  <input value={(challengeForm as any)[f.key]} onChange={e => setChallengeForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}
                    style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"9px 12px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                </div>
              ))}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:11, color:"#8892A4", fontWeight:700, display:"block", marginBottom:5 }}>Difficulty</label>
                  <select value={challengeForm.difficulty} onChange={e => setChallengeForm(p=>({...p,difficulty:e.target.value}))}
                    style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"9px 12px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit" }}>
                    {["Beginner","Medium","Hard","Elite"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#8892A4", fontWeight:700, display:"block", marginBottom:5 }}>Deadline</label>
                  <input type="date" value={challengeForm.deadline} onChange={e => setChallengeForm(p=>({...p,deadline:e.target.value}))}
                    style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"9px 12px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                </div>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" onClick={() => setShowChallengeModal(false)} style={{ flex:1, padding:"10px", borderRadius:10, border:"1px solid #2A2D3E", background:"transparent", color:"#8892A4", fontWeight:700, cursor:"pointer" }}>Cancel</button>
                <button type="submit" disabled={challengeSubmitting} style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#16A34A,#22C55E)", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", opacity:challengeSubmitting?0.7:1 }}>
                  {challengeSubmitting ? "Creating..." : "Create Challenge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Log Progress Modal ── */}
      {logProgressChallenge && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setLogProgressChallenge(null)}>
          <div style={{ background:"#1A1D2E", borderRadius:24, border:"1px solid #2A2D3E", width:"100%", maxWidth:360, padding:"24px" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:900, fontSize:16, color:"#E2E8F0", marginBottom:4 }}>📊 Log Progress</div>
            <div style={{ fontSize:12, color:"#8892A4", marginBottom:16 }}>Challenge: {logProgressChallenge.name}</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:"#8892A4", fontWeight:700, display:"block", marginBottom:5 }}>Add {logProgressChallenge.metric_label || logProgressChallenge.metric_label || 'Progress'} {logProgressChallenge.metric_unit ? `(${logProgressChallenge.metric_unit})` : ''}</label>
              <input type="number" min="0" step="any" value={logValue} onChange={e => setLogValue(e.target.value)} placeholder="0"
                style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"10px 12px", fontSize:18, color:"#E2E8F0", outline:"none", fontFamily:"inherit", fontWeight:800, textAlign:"center", boxSizing:"border-box" }} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:"#8892A4", fontWeight:700, display:"block", marginBottom:5 }}>Note (optional)</label>
              <input value={logNote} onChange={e => setLogNote(e.target.value)} placeholder="e.g. Morning workout, felt great!"
                style={{ width:"100%", background:"#252A3D", border:"1px solid #2A2D3E", borderRadius:10, padding:"9px 12px", fontSize:13, color:"#E2E8F0", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
            </div>
            {challengeScores[logProgressChallenge.id] !== undefined && (
              <div style={{ textAlign:"center", fontSize:12, color:"#8892A4", marginBottom:12 }}>
                Current score: <strong style={{ color:catColor }}>{challengeScores[logProgressChallenge.id]}</strong> {logProgressChallenge.metric_unit || ''}
              </div>
            )}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setLogProgressChallenge(null)} style={{ flex:1, padding:"10px", borderRadius:10, border:"1px solid #2A2D3E", background:"transparent", color:"#8892A4", fontWeight:700, cursor:"pointer" }}>Cancel</button>
              <button onClick={submitLogProgress} disabled={!logValue || logSubmitting} style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#16A34A,#22C55E)", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", opacity:(!logValue||logSubmitting)?0.5:1 }}>
                {logSubmitting ? "Saving..." : "Log Progress 💪"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1001, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#1A1A1A", borderRadius:20, padding:"28px 24px", maxWidth:380, width:"100%", textAlign:"center", border:"1px solid #2A2A2A" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🗑️</div>
            <div style={{ fontWeight:900, fontSize:18, color:"#F0F0F0", marginBottom:8 }}>Delete this group?</div>
            <div style={{ fontSize:13, color:"#9CA3AF", marginBottom:20 }}>This will permanently delete the group and all its posts, events, and challenges. This cannot be undone.</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setDeleteConfirm(false)} style={{ flex:1, padding:"12px", borderRadius:12, border:`1.5px solid #2A3A2A`, background:"transparent", color:"#9CA3AF", fontWeight:700, cursor:"pointer" }}>Cancel</button>
              <button onClick={handleDeleteGroup} disabled={deleting} style={{ flex:1, padding:"12px", borderRadius:12, border:"none", background:"#EF4444", color:"#fff", fontWeight:800, cursor:"pointer", opacity:deleting?0.7:1 }}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero Banner ── */}
      <div style={{ width:"100%", height:260, position:"relative", overflow:"hidden" }}>
        <img src={group.recentPhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.78) 100%)" }} />
        {bannerUploading && (
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:10 }}>
            <div style={{ color:"#fff", fontWeight:700 }}>Uploading...</div>
          </div>
        )}
        <button onClick={() => router.back()} style={{ position:"absolute", top:20, left:20, background:"rgba(0,0,0,0.4)", border:"1.5px solid rgba(255,255,255,0.3)", borderRadius:12, color:"#fff", fontSize:13, fontWeight:700, padding:"8px 14px", cursor:"pointer", backdropFilter:"blur(6px)" }}>
          ← Back
        </button>
        <div style={{ position:"absolute", top:20, right:20, background:catColor, borderRadius:99, padding:"5px 14px", fontSize:12, fontWeight:800, color:"#fff" }}>
          {group.emoji} {group.category}
        </div>
        {(isOwnerDB || (dbGroup && currentUser)) && (
          <button onClick={() => document.getElementById('banner-upload')?.click()} style={{ position:"absolute", bottom:24, right:20, background:"rgba(0,0,0,0.5)", border:"1.5px solid rgba(255,255,255,0.4)", borderRadius:10, color:"#fff", fontSize:12, fontWeight:700, padding:"7px 14px", cursor:"pointer", backdropFilter:"blur(4px)" }}>
            📷 Change Photo
          </button>
        )}
        <input id="banner-upload" type="file" accept="image/*" style={{ display:"none" }} onChange={handleBannerUpload} />
        <div style={{ position:"absolute", bottom:24, left:28, right:(isOwnerDB || (dbGroup && currentUser))?160:28 }}>
          <div style={{ fontWeight:900, fontSize:26, color:"#fff", textShadow:"0 2px 8px rgba(0,0,0,0.5)", marginBottom:8 }}>{group.name}</div>
          <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ background:"rgba(255,255,255,0.15)", backdropFilter:"blur(4px)", borderRadius:99, padding:"4px 12px", color:"rgba(255,255,255,0.95)", fontSize:12, fontWeight:700 }}>
              👥 {(group.members || 0).toLocaleString()} members
            </span>
            {group.isLocal ? (
              <span style={{ background:"rgba(255,255,255,0.15)", backdropFilter:"blur(4px)", borderRadius:99, padding:"4px 12px", color:"rgba(255,255,255,0.95)", fontSize:12, fontWeight:700 }}>
                📍 {group.city}
              </span>
            ) : (
              <span style={{ background:"rgba(255,255,255,0.15)", backdropFilter:"blur(4px)", borderRadius:99, padding:"4px 12px", color:"rgba(255,255,255,0.95)", fontSize:12, fontWeight:700 }}>
                🌍 Online · Worldwide
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main two-column layout ── */}
      <div className="groups-layout" style={{ maxWidth:1200, margin:"0 auto", padding:"24px 24px", display:"flex", gap:40, alignItems:"flex-start" }}>

        {/* ══ LEFT: Main content ══ */}
        <div className="groups-left" style={{ flex:1, minWidth:0 }}>

          {/* Action buttons */}
          <div className="groups-action-bar" style={{ display:"flex", gap:12, marginBottom:20 }}>
            <button onClick={handleJoinGroup} style={{ padding:"12px 32px", borderRadius:13, border:"none", background:joined?"rgba(22,163,74,0.12)":"linear-gradient(135deg,#16A34A,#22C55E)", color:joined?"#16A34A":"#fff", fontWeight:800, fontSize:15, cursor:"pointer", boxShadow:joined?"none":"0 4px 16px rgba(22,163,74,0.35)", transition:"all 0.15s", opacity:joining?0.7:1 }}>
              {joining ? "Joining..." : joined ? "✓ Joined" : "Join Group"}
            </button>
            <button onClick={shareGroup} style={{ padding:"12px 22px", borderRadius:13, background:shareCopied ? `rgba(22,163,74,0.1)` : C.white, border:`2px solid ${shareCopied ? "#16A34A" : C.blueMid}`, color:shareCopied ? "#16A34A" : C.sub, fontWeight:700, fontSize:14, cursor:"pointer", transition:"all 0.2s" }}>
              {shareCopied ? "✓ Copied!" : "Share"}
            </button>
            <div style={{ position:"relative" }}>
              <button onClick={() => setShowMoreMenu(p => !p)} style={{ padding:"12px 18px", borderRadius:13, background:C.white, border:`2px solid ${C.blueMid}`, color:C.sub, fontWeight:700, fontSize:14, cursor:"pointer" }}>···</button>
              {showMoreMenu && (
                <div style={{ position:"absolute", top:"110%", right:0, background:"#fff", borderRadius:12, border:`1.5px solid ${C.blueMid}`, boxShadow:"0 8px 32px rgba(0,0,0,0.12)", zIndex:200, minWidth:160, overflow:"hidden" }}>
                  {isOwnerDB && (
                    <button onClick={() => { setDeleteConfirm(true); setShowMoreMenu(false); }}
                      style={{ width:"100%", padding:"13px 18px", background:"none", border:"none", color:"#EF4444", fontWeight:700, fontSize:14, cursor:"pointer", textAlign:"left" }}>
                      🗑️ Delete Group
                    </button>
                  )}
                  <button onClick={() => setShowMoreMenu(false)}
                    style={{ width:"100%", padding:"13px 18px", background:"none", border:"none", color:C.sub, fontWeight:700, fontSize:14, cursor:"pointer", textAlign:"left" }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* About card */}
          <div style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, padding:"18px 22px", marginBottom:20 }}>
            <div style={{ fontWeight:800, fontSize:15, color:C.text, marginBottom:8 }}>About this group</div>
            <p style={{ fontSize:14, color:C.sub, lineHeight:1.7, marginBottom:10 }}>{group.description}</p>
            {group.meetFrequency && <div style={{ display:"flex", gap:8, fontSize:13, color:C.sub, marginBottom:5 }}><span>🗓️</span><span><strong style={{ color:C.text }}>Meets:</strong> {group.meetFrequency}</span></div>}
            {group.location && <div style={{ display:"flex", gap:8, fontSize:13, color:C.sub, marginBottom:10 }}><span>📍</span><span><strong style={{ color:C.text }}>Location:</strong> {group.location}</span></div>}
            {group.tags && group.tags.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {group.tags.map((t:string) => (
                  <span key={t} style={{ background:C.blueLight, color:C.blue, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, border:`1px solid ${C.blueMid}` }}>{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="groups-tabs" style={{ display:"flex", gap:3, marginBottom:20, background:C.white, borderRadius:14, padding:4, border:`2px solid ${C.blueMid}`, overflowX:"auto" }}>
            {([
              { key:"posts", label:"📸 Posts" },
              { key:"leaderboard", label:"🏆 Board" },
              { key:"challenges", label:"⚡ Challenges" },
              { key:"notes", label:"💬 Notes" },
              { key:"war", label:"⚔️ Wars" },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex:1, padding:"9px 4px", borderRadius:10, border:"none",
                background: tab===t.key ? `linear-gradient(135deg,${catColor},${catColor}CC)` : "transparent",
                color: tab===t.key ? "#fff" : C.sub,
                fontWeight:800, fontSize:12, cursor:"pointer", transition:"all 0.15s", whiteSpace:"nowrap", flexShrink:0,
              }}>{t.label}</button>
            ))}
            {([
              { key:"events", label:"🗓️ Events" },
              { key:"members", label:"👥 Members" },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="groups-mobile-tabs-extra"
                style={{
                  flex:1, padding:"9px 4px", borderRadius:10, border:"none",
                  background: tab===t.key ? `linear-gradient(135deg,${catColor},${catColor}CC)` : "transparent",
                  color: tab===t.key ? "#fff" : C.sub,
                  fontWeight:800, fontSize:12, cursor:"pointer", transition:"all 0.15s", whiteSpace:"nowrap", flexShrink:0,
                }}>{t.label}</button>
            ))}
          </div>

          {/* ── POSTS ── */}
          {tab==="posts" && (
            <div>
              {/* Post form */}
              {joined && (
                <div style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, padding:"14px 18px", marginBottom:18 }}>
                  <textarea value={postContent} onChange={e => setPostContent(e.target.value)}
                    placeholder="Share something with the group..."
                    style={{ width:"100%", background:C.blueLight, border:`1.5px solid ${C.blueMid}`, borderRadius:12, padding:"12px 14px", fontSize:13, color:C.text, resize:"vertical", minHeight:80, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  <button onClick={submitPost} disabled={!postContent.trim() || postSubmitting}
                    style={{ marginTop:10, padding:"9px 22px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${catColor},${catColor}CC)`, color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", opacity:(!postContent.trim()||postSubmitting)?0.6:1 }}>
                    {postSubmitting ? "Posting..." : "Post 📸"}
                  </button>
                </div>
              )}
              {displayPosts.map((post:any) => (
                <div key={post.id} style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, marginBottom:18, overflow:"hidden" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px 10px" }}>
                    <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden" }}>
                      {post.avatarUrl ? <img src={post.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : post.avatar}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{post.user}</div>
                      <div style={{ fontSize:11, color:C.sub }}>{post.time}</div>
                    </div>
                  </div>
                  {post.photo && (
                    <div style={{ width:"100%", aspectRatio:"4/3", overflow:"hidden" }}>
                      <img src={post.photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    </div>
                  )}
                  <div style={{ padding:"10px 18px 14px" }}>
                    <p style={{ fontSize:14, color:C.text, lineHeight:1.65, margin:"0 0 10px" }}>{post.content}</p>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <button onClick={() => togglePostLike(post.id, post.likes || post.likes_count || 0)} style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                        <svg viewBox="0 0 24 24" fill={likedPosts[post.id]?"#FF6B6B":"none"} stroke={likedPosts[post.id]?"#FF6B6B":C.sub} strokeWidth="2" style={{ width:20,height:20 }}>
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span style={{ fontSize:13, fontWeight:700, color:likedPosts[post.id]?"#FF6B6B":C.sub }}>{(postLikes[post.id] ?? (post.likes || post.likes_count || 0)).toLocaleString()}</span>
                      </button>
                      <button onClick={() => setExpandedPostComments(p => ({...p, [post.id]: !p[post.id]}))} style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:20,height:20 }}>
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span style={{ fontSize:13, fontWeight:700, color:C.sub }}>{(postComments[post.id]||[]).length}</span>
                      </button>
                    </div>
                    {expandedPostComments[post.id] && (
                      <div style={{ marginTop:12, borderTop:`1px solid ${C.blueMid}`, paddingTop:12 }}>
                        {(postComments[post.id]||[]).map((c,i) => (
                          <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
                            <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, color:"#fff", flexShrink:0 }}>{c.avatar}</div>
                            <div style={{ flex:1, background:C.blueLight, borderRadius:12, padding:"7px 10px" }}>
                              <span style={{ fontSize:11, fontWeight:800, color:C.text }}>{c.user} </span>
                              <span style={{ fontSize:12, color:C.sub }}>{c.text}</span>
                            </div>
                          </div>
                        ))}
                        <div style={{ display:"flex", gap:8, marginTop:4 }}>
                          <input
                            value={postCommentInputs[post.id]||''}
                            onChange={e => setPostCommentInputs(p => ({...p,[post.id]:e.target.value}))}
                            onKeyDown={e => e.key==='Enter' && submitPostComment(post.id)}
                            placeholder="Write a comment..."
                            style={{ flex:1, background:C.blueLight, border:`1.5px solid ${C.blueMid}`, borderRadius:20, padding:"7px 14px", fontSize:12, color:C.text, outline:"none", fontFamily:"inherit" }}
                          />
                          <button onClick={() => submitPostComment(post.id)} style={{ padding:"7px 14px", borderRadius:20, border:"none", background:`linear-gradient(135deg,${catColor},${catColor}CC)`, color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>Post</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {displayPosts.length === 0 && (
                <div style={{ textAlign:"center", padding:"24px", background:C.white, borderRadius:18, border:`2px dashed ${C.blueMid}` }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>📸</div>
                  <div style={{ fontWeight:700, fontSize:13, color:C.blue, marginBottom:3 }}>No posts yet</div>
                  <div style={{ fontSize:12, color:C.sub }}>Be the first to post in this group!</div>
                </div>
              )}
            </div>
          )}

          {/* ── LEADERBOARD ── */}
          {tab==="leaderboard" && (
            <div>
              {displayLeaderboard.length === 0 ? (
                <div style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, padding:"24px", textAlign:"center" }}>
                  <div style={{ fontSize:24, marginBottom:8 }}>🏆</div>
                  <div style={{ fontWeight:700, fontSize:13, color:C.blue, marginBottom:3 }}>No leaderboard entries yet</div>
                  <div style={{ fontSize:12, color:C.sub }}>Join a challenge to get ranked!</div>
                </div>
              ) : leaderboardGroups.length === 1 ? (
                // Single challenge — show flat list
                <div style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, overflow:"hidden", marginBottom:16 }}>
                  <div style={{ background:`linear-gradient(135deg,${catColor},${catColor}CC)`, padding:"16px 20px" }}>
                    <div style={{ fontWeight:900, fontSize:16, color:"#fff" }}>🏆 {group.name} Leaderboard</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginTop:3 }}>Updated in real-time · Based on challenge scores</div>
                  </div>
                  <div style={{ padding:"8px 0" }}>
                    {leaderboardGroups[0][1].entries.map((entry:any) => (
                      <div key={`${entry.challengeId}-${entry.rank}`} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom:`1px solid ${C.blueLight}`, cursor:"pointer" }}
                        onClick={() => router.push(entry.username ? `/profile/${entry.username}` : '/profile')}>
                        <div style={{ width:32, height:32, borderRadius:"50%", background:entry.rank<=3?`linear-gradient(135deg,${["#F5A623","#9E9E9E","#CD7F32"][entry.rank-1]},${["#FFD700","#BDBDBD","#E8A87C"][entry.rank-1]})`:"#1A2A1A", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, color:entry.rank<=3?"#fff":C.sub, flexShrink:0 }}>
                          {entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank-1] : `#${entry.rank}`}
                        </div>
                        <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden" }}>
                          {(entry as any).avatarUrl ? <img src={(entry as any).avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/> : entry.avatar}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{entry.name}</div>
                          <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>{entry.score}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontWeight:900, fontSize:14, color:catColor }}>{entry.value}</div>
                          <div style={{ fontSize:10, color:C.sub, marginTop:1 }}>{entry.metric}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Multiple challenges — show per-challenge sections
                leaderboardGroups.map(([challengeKey, challengeGroup]: [string, any]) => (
                  <div key={challengeKey} style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, overflow:"hidden", marginBottom:16 }}>
                    <div style={{ background:`linear-gradient(135deg,${catColor},${catColor}CC)`, padding:"14px 20px" }}>
                      <div style={{ fontWeight:900, fontSize:15, color:"#fff" }}>{challengeGroup.emoji} {challengeGroup.name}</div>
                    </div>
                    <div style={{ padding:"8px 0" }}>
                      {challengeGroup.entries.map((entry:any) => (
                        <div key={`${challengeKey}-${entry.rank}`} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom:`1px solid ${C.blueLight}`, cursor:"pointer" }}
                          onClick={() => router.push(entry.username ? `/profile/${entry.username}` : '/profile')}>
                          <div style={{ width:32, height:32, borderRadius:"50%", background:entry.rank<=3?`linear-gradient(135deg,${["#F5A623","#9E9E9E","#CD7F32"][entry.rank-1]},${["#FFD700","#BDBDBD","#E8A87C"][entry.rank-1]})`:"#1A2A1A", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, color:entry.rank<=3?"#fff":C.sub, flexShrink:0 }}>
                            {entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank-1] : `#${entry.rank}`}
                          </div>
                          <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden" }}>
                            {(entry as any).avatarUrl ? <img src={(entry as any).avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/> : entry.avatar}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{entry.name}</div>
                            <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>{entry.score}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontWeight:900, fontSize:14, color:catColor }}>{entry.value}</div>
                            <div style={{ fontSize:10, color:C.sub, marginTop:1 }}>{entry.metric}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── CHALLENGES ── */}
          {tab==="challenges" && (
            <div>
              {/* ⚔️ Weekly Group Challenge Section */}
              <WeeklyChallengeSection groupName={group.name} catColor={catColor} />

              {group._dbId && (
                <div style={{ marginBottom:16, display:"flex", justifyContent:"flex-end" }}>
                  <button onClick={() => setShowChallengeModal(true)}
                    style={{ padding:"9px 18px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${catColor},${catColor}CC)`, color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}>
                    + Create Challenge
                  </button>
                </div>
              )}
              {(() => {
                const now = new Date();
                const activeChallenges = displayChallenges.filter((ch: any) =>
                  ch.is_active !== false && (!ch.deadline || new Date(ch.deadline) > now)
                );
                const completedChallenges = displayChallenges.filter((ch: any) =>
                  ch.is_active === false || (ch.deadline && new Date(ch.deadline) <= now)
                );

                const renderChallengeCard = (ch: any, isCompleted = false) => {
                  const isJoined = joinedChallenges[ch.id] || joinedChallengeIdsDB.includes(ch.id);
                  const diff = ch.difficulty;
                  const deadline = ch.deadline ? new Date(ch.deadline).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : null;
                  const topParticipants = Array.isArray(ch.challenge_participants)
                    ? [...ch.challenge_participants].sort((a: any, b: any) => (b.score||0) - (a.score||0)).slice(0, 3)
                    : [];

                  return (
                    <div key={ch.id} style={{ background:isCompleted?"linear-gradient(135deg,#FFFBEE,#FEF3C7)":C.white, borderRadius:18, border:`2px solid ${isCompleted?"#F5A623":C.blueMid}`, marginBottom:16, overflow:"hidden" }}>
                      <div style={{ background:isCompleted?`linear-gradient(135deg,#F5A623,#FFD700)`:`linear-gradient(135deg,${catColor}22,${catColor}11)`, padding:"16px 20px", borderBottom:`1px solid ${isCompleted?"#F5A623":C.blueMid}` }}>
                        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                          <div style={{ width:52, height:52, borderRadius:14, background:isCompleted?`linear-gradient(135deg,#F5A623,#FFD700)`:`linear-gradient(135deg,${catColor},${catColor}CC)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                            {ch.emoji || '🏆'}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                              <span style={{ fontWeight:900, fontSize:16, color:isCompleted?"#92400E":C.text }}>{ch.name}</span>
                              {diff && <span style={{ background:(DIFFICULTY_COLORS[diff]||catColor)+"22", color:DIFFICULTY_COLORS[diff]||catColor, fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:99, border:`1px solid ${(DIFFICULTY_COLORS[diff]||catColor)}44` }}>{diff}</span>}
                              {isCompleted && <span style={{ background:"#F5A623", color:"#fff", fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:99 }}>✓ Ended</span>}
                            </div>
                            <div style={{ fontSize:12, color:isCompleted?"#92400E":C.sub }}>
                              👥 {ch.participant_count || ch.participants || 0} participating
                              {deadline && <span> · 📅 {isCompleted?"Ended":"Ends"} {deadline}</span>}
                            </div>
                            {ch.metric_label && <div style={{ fontSize:11, color:isCompleted?"#B45309":catColor, fontWeight:700, marginTop:2 }}>📊 Tracking: {ch.metric_label}{ch.metric_unit ? ` (${ch.metric_unit})` : ''}</div>}
                          </div>
                        </div>
                      </div>
                      <div style={{ padding:"14px 20px" }}>
                        <p style={{ fontSize:13, color:C.sub, lineHeight:1.6, marginBottom:14 }}>{ch.description || ch.desc}</p>
                        {/* Hall of Fame for completed */}
                        {isCompleted && topParticipants.length > 0 && (
                          <div style={{ marginBottom:14 }}>
                            <div style={{ fontSize:11, fontWeight:800, color:"#92400E", textTransform:"uppercase", letterSpacing:0.8, marginBottom:8 }}>🏅 Top Finishers</div>
                            {topParticipants.map((p: any, idx: number) => (
                              <div key={p.user_id || idx} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                                <span style={{ fontSize:14 }}>{["🥇","🥈","🥉"][idx]||"🎖️"}</span>
                                <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,#F5A623,#FFD700)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, color:"#fff", overflow:"hidden", flexShrink:0 }}>
                                  {p.users?.avatar_url ? <img src={p.users.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (p.users?.full_name||p.users?.username||'?')[0]}
                                </div>
                                <span style={{ fontSize:13, fontWeight:700, color:C.text, flex:1 }}>{p.users?.full_name || p.users?.username || 'Member'}</span>
                                <span style={{ fontSize:12, fontWeight:800, color:"#F5A623" }}>{p.score} {ch.metric_unit||'pts'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!isCompleted && (
                          <div style={{ display:"flex", gap:8 }}>
                            <button onClick={() => handleJoinChallenge(ch)}
                              style={{ flex:1, padding:"10px", borderRadius:12, border:"none", background:isJoined?"#F0FDF4":`linear-gradient(135deg,${catColor},${catColor}CC)`, color:isJoined?catColor:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                              {isJoined ? `✓ Joined — ${ch.emoji || '🏆'} Challenge Accepted!` : "Accept Challenge"}
                            </button>
                            {isJoined && (
                              <button onClick={() => setLogProgressChallenge(ch)}
                                style={{ padding:"10px 16px", borderRadius:12, border:`2px solid ${catColor}`, background:"transparent", color:catColor, fontWeight:800, fontSize:13, cursor:"pointer" }}>
                                Log Progress
                              </button>
                            )}
                          </div>
                        )}
                        {!isCompleted && isJoined && challengeScores[ch.id] !== undefined && (
                          <div style={{ marginTop:8, fontSize:12, color:C.sub }}>
                            Your score: <strong style={{ color:catColor }}>{challengeScores[ch.id]}</strong> {ch.metric_unit || ''}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {activeChallenges.length === 0 && completedChallenges.length === 0 && (
                      <div style={{ textAlign:"center", padding:"24px", background:C.white, borderRadius:18, border:`2px dashed ${C.blueMid}` }}>
                        <div style={{ fontSize:24, marginBottom:6 }}>⚡</div>
                        <div style={{ fontWeight:700, fontSize:13, color:C.blue, marginBottom:3 }}>No challenges yet</div>
                        <div style={{ fontSize:12, color:C.sub }}>Create the first challenge for this group!</div>
                      </div>
                    )}
                    {activeChallenges.length > 0 && (
                      <div>
                        <div style={{ fontWeight:800, fontSize:14, color:C.text, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
                          ⚡ Active Challenges <span style={{ background:`${catColor}22`, color:catColor, fontSize:11, padding:"2px 8px", borderRadius:99 }}>{activeChallenges.length}</span>
                        </div>
                        {activeChallenges.map((ch: any) => renderChallengeCard(ch, false))}
                      </div>
                    )}
                    {completedChallenges.length > 0 && (
                      <div style={{ marginTop: activeChallenges.length > 0 ? 20 : 0 }}>
                        <div style={{ fontWeight:800, fontSize:14, color:"#92400E", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
                          🏅 Completed Challenges <span style={{ background:"#FEF3C7", color:"#F5A623", fontSize:11, padding:"2px 8px", borderRadius:99, border:"1px solid #F5A623" }}>{completedChallenges.length}</span>
                        </div>
                        {completedChallenges.map((ch: any) => renderChallengeCard(ch, true))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* ── COMMUNITY NOTES ── */}
          {tab==="notes" && (
            <div>
              <div style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, padding:"16px 20px", marginBottom:18 }}>
                <div style={{ fontWeight:800, fontSize:14, color:C.text, marginBottom:12 }}>Share something with the group</div>
                <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
                  {["Workout","Recipe","Mindset","General","Tip"].map(cat => (
                    <button key={cat} onClick={() => setNoteCategory(cat)} style={{ padding:"6px 14px", borderRadius:99, border:`1.5px solid ${noteCategory===cat?NOTE_CATEGORY_COLORS[cat]:C.blueMid}`, background:noteCategory===cat?`${NOTE_CATEGORY_COLORS[cat]}18`:"transparent", color:noteCategory===cat?NOTE_CATEGORY_COLORS[cat]:C.sub, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                      {cat==="Workout"?"💪":cat==="Recipe"?"🥗":cat==="Mindset"?"🧠":cat==="Tip"?"💡":"💬"} {cat}
                    </button>
                  ))}
                </div>
                <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Share a workout routine, recipe, mindset tip, or anything that might help the group..."
                  style={{ width:"100%", background:C.blueLight, border:`1.5px solid ${C.blueMid}`, borderRadius:12, padding:"12px 14px", fontSize:13, color:C.text, resize:"vertical", minHeight:90, fontFamily:"inherit", outline:"none" }} />
                <button onClick={submitNote} style={{ marginTop:10, padding:"10px 24px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${catColor},${catColor}CC)`, color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}>Post Note</button>
              </div>

              {allNotes.length === 0 && (
                <div style={{ textAlign:"center", padding:"24px", background:C.white, borderRadius:18, border:`2px dashed ${C.blueMid}` }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>💬</div>
                  <div style={{ fontWeight:700, fontSize:13, color:C.blue, marginBottom:3 }}>No community notes yet</div>
                  <div style={{ fontSize:12, color:C.sub }}>Share a tip, recipe, or mindset note!</div>
                </div>
              )}
              {allNotes.map((note:any) => (
                <div key={note.id} style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, padding:"16px 20px", marginBottom:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden" }}>
                      {note.avatarUrl ? <img src={note.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : note.avatar}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, fontSize:13, color:C.text }}>{note.user}</div>
                      <div style={{ fontSize:10, color:C.sub }}>{note.time}</div>
                    </div>
                    <span style={{ background:`${NOTE_CATEGORY_COLORS[note.category]||C.blue}18`, color:NOTE_CATEGORY_COLORS[note.category]||C.blue, fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:99, border:`1px solid ${NOTE_CATEGORY_COLORS[note.category]||C.blue}33` }}>
                      {note.category==="Workout"?"💪":note.category==="Recipe"?"🥗":note.category==="Mindset"?"🧠":note.category==="Tip"?"💡":"💬"} {note.category}
                    </span>
                  </div>
                  <p style={{ fontSize:14, color:C.text, lineHeight:1.7, margin:"0 0 10px" }}>{note.content}</p>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <button onClick={() => setNoteLikes(p=>({...p,[note.id]:(p[note.id]??note.likes)+1}))} style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:18,height:18 }}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span style={{ fontSize:12, color:C.sub }}>{(noteLikes[note.id]??note.likes).toLocaleString()}</span>
                    </button>
                    <button onClick={() => setExpandedNoteReplies(p => ({...p,[note.id]:!p[note.id]}))} style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:18,height:18 }}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span style={{ fontSize:12, color:C.sub }}>{(noteReplies[note.id]||[]).length}</span>
                    </button>
                  </div>
                  {expandedNoteReplies[note.id] && (
                    <div style={{ marginTop:10, borderTop:`1px solid ${C.blueMid}`, paddingTop:10 }}>
                      {(noteReplies[note.id]||[]).map((r,i) => (
                        <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
                          <div style={{ width:26, height:26, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, color:"#fff", flexShrink:0 }}>{r.avatar}</div>
                          <div style={{ flex:1, background:C.blueLight, borderRadius:12, padding:"6px 10px" }}>
                            <span style={{ fontSize:11, fontWeight:800, color:C.text }}>{r.user} </span>
                            <span style={{ fontSize:12, color:C.sub }}>{r.text}</span>
                          </div>
                        </div>
                      ))}
                      <div style={{ display:"flex", gap:8, marginTop:4 }}>
                        <input
                          value={noteReplyInputs[note.id]||''}
                          onChange={e => setNoteReplyInputs(p => ({...p,[note.id]:e.target.value}))}
                          onKeyDown={e => e.key==='Enter' && submitNoteReply(note.id)}
                          placeholder="Write a reply..."
                          style={{ flex:1, background:C.blueLight, border:`1.5px solid ${C.blueMid}`, borderRadius:20, padding:"7px 14px", fontSize:12, color:C.text, outline:"none", fontFamily:"inherit" }}
                        />
                        <button onClick={() => submitNoteReply(note.id)} style={{ padding:"7px 14px", borderRadius:20, border:"none", background:`linear-gradient(135deg,${catColor},${catColor}CC)`, color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>Reply</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── MOBILE: Events tab ── */}
          {tab === "events" && (
            <div className="groups-mobile-tab-content">
              <div style={{ marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:900, fontSize:15, color:C.text, marginBottom:4 }}>🗓️ Upcoming Events</div>
                  <div style={{ fontSize:12, color:C.sub }}>{displayEvents.length} scheduled</div>
                </div>
                {group._dbId && (
                  <button onClick={() => setShowEventModal(true)} style={{ padding:"7px 14px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${catColor},${catColor}CC)`, color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>+ Event</button>
                )}
              </div>
              {displayEvents.map((event:any) => (
                <EventCard key={event.id} event={event} catColor={catColor}
                  commentInputs={commentInputs} setCommentInputs={setCommentInputs}
                  eventComments={eventComments} addEventComment={addEventComment}
                  onRSVP={handleRSVP} rsvped={rsvpedEvents.has(event.id)} />
              ))}
            </div>
          )}

          {/* ── MOBILE: Members tab ── */}
          {tab === "members" && (
            <div className="groups-mobile-tab-content">
              <div style={{ marginBottom:12 }}>
                <div style={{ fontWeight:900, fontSize:15, color:C.text, marginBottom:4 }}>👥 Members</div>
                <div style={{ fontSize:12, color:C.sub }}>{displayMembers.length} members</div>
              </div>
              {displayMembers.map((m:any, i:number) => (
                <div key={i} onClick={() => router.push(m.username ? `/profile/${m.username}` : '/profile')}
                  style={{ background:C.white, borderRadius:14, border:`2px solid ${C.blueMid}`, marginBottom:10, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
                  <div style={{ width:14, fontSize:11, fontWeight:900, color:C.sub, flexShrink:0, textAlign:"center" }}>#{m.rank}</div>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden" }}>{m.avatarUrl ? <img src={m.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : m.avatar}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{m.name}</div>
                    <div style={{ fontSize:11, color:m.role==="Organizer"||m.role==="Moderator"?catColor:C.sub, fontWeight:m.role==="Organizer"?700:400 }}>{m.role}</div>
                  </div>
                  {m.points > 0 && <div style={{ fontSize:13, fontWeight:800, color:catColor, flexShrink:0 }}>{m.points?.toLocaleString()} pts</div>}
                </div>
              ))}
            </div>
          )}

          {tab === "war" && (() => {
            const dbId = group._dbId;
            const METRICS: Record<string,{label:string;icon:string;unit:string}> = {
              miles_run:{label:"Miles Run",icon:"🏃",unit:"mi"},
              miles_walked:{label:"Miles Walked",icon:"🚶",unit:"mi"},
              miles_cycled:{label:"Miles Cycled",icon:"🚴",unit:"mi"},
              total_workouts:{label:"Total Workouts",icon:"💪",unit:""},
              weight_lifted:{label:"Weight Lifted",icon:"🏋️",unit:"lbs"},
              weight_lost:{label:"Weight Lost",icon:"⚖️",unit:"lbs"},
            };
            const LIFT_TYPES = [{key:"bench_press",label:"Bench Press"},{key:"squat",label:"Squat"},{key:"deadlift",label:"Deadlift"},{key:"dumbbell_curl",label:"Dumbbell Curl"}];
            const active = warChallenges.filter(c => c.status === "active");
            const open   = warChallenges.filter(c => c.status === "open");
            const done   = warChallenges.filter(c => ["completed","cancelled"].includes(c.status));

            return (
              <div>
                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontWeight:900,fontSize:18,color:"#F0F0F0"}}>⚔️ Group Wars</div>
                  {isOwnerOrMod && (
                    <button onClick={()=>setShowCreateWar(true)} style={{
                      padding:"8px 14px",borderRadius:12,border:"none",
                      background:"linear-gradient(135deg,#7C3AED,#A78BFA)",
                      color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",
                    }}>+ Create War</button>
                  )}
                </div>

                {/* Sub-tabs: Our Wars vs Find Opponents */}
                <div style={{display:"flex",gap:6,marginBottom:16,background:"#1A1228",borderRadius:12,padding:4}}>
                  {([
                    {key:"ours",label:`⚔️ Our Wars (${warChallenges.length})`},
                    {key:"discover",label:`🔍 Find Opponents (${openBoardChallenges.length})`},
                  ] as const).map(t=>(
                    <button key={t.key} onClick={()=>setOpenBoardTab(t.key)} style={{
                      flex:1,padding:"8px 6px",borderRadius:9,border:"none",cursor:"pointer",
                      fontWeight:700,fontSize:12,transition:"all 0.15s",
                      background:openBoardTab===t.key?"linear-gradient(135deg,#7C3AED,#A78BFA)":"transparent",
                      color:openBoardTab===t.key?"#fff":"#6B7280",
                    }}>{t.label}</button>
                  ))}
                </div>

                {/* Success banner */}
                {warPosted && (
                  <div style={{
                    background:"rgba(74,222,128,0.12)",border:"1px solid #4ADE80",
                    borderRadius:12,padding:"12px 16px",marginBottom:16,
                    display:"flex",alignItems:"center",gap:10,
                  }}>
                    <span style={{fontSize:20}}>🔍</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"#4ADE80"}}>War posted! Searching for an opponent...</div>
                      <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>Your challenge is now visible under "Find Opponents" for other groups to accept.</div>
                    </div>
                  </div>
                )}

                {warLoading ? (
                  <div style={{textAlign:"center",padding:40,color:"#6B7280"}}>Loading wars...</div>
                ) : openBoardTab === "discover" ? (
                  /* ── DISCOVER: Open challenges from other groups ── */
                  <div>
                    {openBoardChallenges.length === 0 ? (
                      <div style={{textAlign:"center",padding:"40px 20px",color:"#6B7280"}}>
                        <div style={{fontSize:40,marginBottom:12}}>🏳️</div>
                        <div style={{fontWeight:700,fontSize:16,color:"#F0F0F0",marginBottom:8}}>No open challenges</div>
                        <div style={{fontSize:13}}>No other groups are looking for opponents right now. Check back later!</div>
                      </div>
                    ) : openBoardChallenges.map(chal => {
                      const meta = METRICS[chal.metric] || METRICS.miles_run;
                      const LIFT_LABELS: Record<string,string> = {bench_press:"Bench Press",squat:"Squat",deadlift:"Deadlift",dumbbell_curl:"Dumbbell Curl"};
                      return (
                        <div key={chal.id} style={{background:"#111118",borderRadius:14,
                          padding:"14px 16px",border:"1px solid #2D1F52",marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                            <div>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                                <span style={{fontSize:20}}>{meta.icon}</span>
                                <div>
                                  <div style={{fontWeight:800,fontSize:15,color:"#F0F0F0"}}>{chal.title}</div>
                                  <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>
                                    {chal.creator_group?.emoji} <span style={{color:"#9CA3AF",fontWeight:600}}>{chal.creator_group?.name}</span>
                                  </div>
                                </div>
                              </div>
                              <div style={{display:"flex",gap:8,flexWrap:"wrap" as const,marginTop:6}}>
                                <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99,
                                  background:"rgba(6,182,212,0.15)",color:"#06B6D4"}}>
                                  {meta.label}{chal.lift_type?` · ${LIFT_LABELS[chal.lift_type]||chal.lift_type}`:""}
                                </span>
                                <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99,
                                  background:"rgba(124,58,237,0.15)",color:"#A78BFA"}}>
                                  ⚔️ {chal.member_count}v{chal.member_count}
                                </span>
                                <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99,
                                  background:"rgba(245,166,35,0.15)",color:"#F5A623"}}>
                                  ⏱ {chal.duration_days} days
                                </span>
                              </div>
                            </div>
                          </div>
                          {isOwnerOrMod && (
                            <button onClick={()=>acceptWarChallenge(chal)} style={{
                              width:"100%",padding:"10px 0",borderRadius:10,border:"none",
                              background:"linear-gradient(135deg,#4ADE80,#16A34A)",
                              color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",
                            }}>⚔️ Accept Challenge</button>
                          )}
                          {!isOwnerOrMod && (
                            <div style={{fontSize:12,color:"#6B7280",textAlign:"center" as const,padding:"6px 0"}}>
                              Only group admins can accept challenges
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    {/* Active challenges */}
                    {active.map(chal => {
                      const meta = METRICS[chal.metric] || METRICS.miles_run;
                      const isCreator = chal.creator_group_id === dbId;
                      const myScore = isCreator ? chal.creator_score : chal.opponent_score;
                      const theirScore = isCreator ? chal.opponent_score : chal.creator_score;
                      const myGroupName = isCreator ? chal.creator_group?.name : chal.opponent_group?.name;
                      const theirGroupName = isCreator ? chal.opponent_group?.name : chal.creator_group?.name;
                      const myMembers = (chal.group_challenge_members||[]).filter((m:any)=>m.group_id===dbId);
                      const top5 = [...myMembers].sort((a:any,b:any)=>(b.contribution||b.weight_entry||0)-(a.contribution||a.weight_entry||0)).slice(0,5);
                      const media = chal.group_challenge_media || [];
                      const isExpanded = expandedChallenge === chal.id;
                      const daysLeft = chal.end_date ? Math.max(0,Math.ceil((new Date(chal.end_date).getTime()-Date.now())/86400000)) : null;
                      const total = (myScore||0)+(theirScore||0)||1;
                      const myPct = Math.round(((myScore||0)/total)*100);

                      return (
                        <div key={chal.id} style={{marginBottom:14,borderRadius:18,overflow:"hidden",
                          border:"2px solid #7C3AED",background:"#0D0820"}}>
                          {/* Challenge header */}
                          <button onClick={()=>setExpandedChallenge(isExpanded?null:chal.id)}
                            style={{width:"100%",background:"linear-gradient(135deg,#2D1F52,#1A0F30)",
                              padding:"14px 16px",border:"none",cursor:"pointer",textAlign:"left"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                              <div>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                                  <span style={{fontSize:18}}>{meta.icon}</span>
                                  <span style={{fontWeight:900,fontSize:15,color:"#F0F0F0"}}>{chal.title}</span>
                                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,
                                    background:"rgba(74,222,128,0.15)",color:"#4ADE80"}}>LIVE</span>
                                </div>
                                <div style={{fontSize:11,color:"#6B7280"}}>
                                  {meta.label}{chal.lift_type?` · ${LIFT_TYPES.find(l=>l.key===chal.lift_type)?.label}`:""}
                                  {daysLeft!==null?` · ${daysLeft}d left`:""}
                                </div>
                              </div>
                              <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5"
                                style={{width:16,height:16,flexShrink:0,transform:isExpanded?"rotate(180deg)":"none",transition:"transform 0.2s"}}>
                                <path d="M6 9l6 6 6-6"/>
                              </svg>
                            </div>

                            {/* Score bar */}
                            <div style={{marginTop:12}}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:12,fontWeight:700}}>
                                <span style={{color:"#7C3AED"}}>{myGroupName||"Us"} — {myScore||0}{meta.unit}</span>
                                <span style={{color:"#06B6D4"}}>{theirGroupName||"Them"} — {theirScore||0}{meta.unit}</span>
                              </div>
                              <div style={{height:10,borderRadius:99,background:"#1E1E2E",overflow:"hidden",display:"flex"}}>
                                <div style={{width:`${myPct}%`,background:"#7C3AED",borderRadius:"99px 0 0 99px",transition:"width 0.5s"}}/>
                                <div style={{flex:1,background:"#06B6D4",borderRadius:"0 99px 99px 0"}}/>
                              </div>
                              <div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:10,color:"#6B7280"}}>
                                <span>{myPct}%</span><span>{100-myPct}%</span>
                              </div>
                            </div>
                          </button>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div style={{padding:"14px 16px",borderTop:"1px solid #2D1F52"}}>

                              {/* Top 5 contributors */}
                              <div style={{marginBottom:14}}>
                                <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",
                                  letterSpacing:1,marginBottom:8}}>Top Contributors — {myGroupName||"Your Group"}</div>
                                {top5.length===0 && <div style={{fontSize:12,color:"#6B7280"}}>No contributions yet</div>}
                                {top5.map((m:any,i:number)=>{
                                  const u=m.users;
                                  const val=chal.metric.includes("weight")?(m.weight_entry||0):(m.contribution||0);
                                  const max=top5[0]?(chal.metric.includes("weight")?(top5[0].weight_entry||1):(top5[0].contribution||1)):1;
                                  return (
                                    <div key={m.user_id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                                      <span style={{fontSize:12,fontWeight:800,color:i===0?"#F5A623":"#6B7280",width:18}}>
                                        {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                                      </span>
                                      <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#A78BFA)",
                                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0}}>
                                        {(u?.full_name||u?.username||"?")[0]?.toUpperCase()}
                                      </div>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontSize:12,fontWeight:700,color:"#F0F0F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                          {u?.full_name||u?.username||"Member"}
                                        </div>
                                        <div style={{height:4,background:"#1E1E2E",borderRadius:99,overflow:"hidden",marginTop:2}}>
                                          <div style={{width:`${max>0?Math.round((val/max)*100):0}%`,
                                            height:"100%",background:i===0?"#F5A623":"#7C3AED",borderRadius:99}}/>
                                        </div>
                                      </div>
                                      <span style={{fontSize:12,fontWeight:800,color:i===0?"#F5A623":"#F0F0F0",flexShrink:0}}>
                                        {val}{meta.unit}
                                      </span>
                                      {/* Weight submit button */}
                                      {chal.metric.includes("weight") && m.user_id===currentUser?.id && !m.weight_submitted && (
                                        <button onClick={()=>{
                                          const v=parseFloat(prompt(`Enter your ${chal.lift_type||"weight"} in lbs:`)||"0");
                                          if(v>0) submitWeightEntry(chal.id,v);
                                        }} style={{padding:"4px 10px",borderRadius:8,border:"none",
                                          background:"#7C3AED",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                          Submit
                                        </button>
                                      )}
                                      {chal.metric.includes("weight") && m.weight_submitted && (
                                        <span style={{fontSize:11,color:"#4ADE80"}}>✓</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Photo / media wall */}
                              <div style={{marginBottom:14}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                                  <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1}}>
                                    📸 Challenge Media ({media.length})
                                  </div>
                                  {/* Upload button */}
                                  {myMembers.some((m:any)=>m.user_id===currentUser?.id) && (
                                    <label style={{fontSize:11,fontWeight:700,color:"#7C3AED",cursor:"pointer",
                                      padding:"4px 10px",borderRadius:8,background:"rgba(124,58,237,0.15)",
                                      border:"1px solid rgba(124,58,237,0.3)"}}>
                                      {uploadingMedia?"Uploading...":"+ Add Photo"}
                                      <input type="file" accept="image/*" style={{display:"none"}}
                                        disabled={uploadingMedia}
                                        onChange={e=>{
                                          const f=e.target.files?.[0];
                                          if(f) uploadWarMedia(chal.id,f);
                                        }}/>
                                    </label>
                                  )}
                                </div>
                                {media.length===0 ? (
                                  <div style={{textAlign:"center",padding:"20px",background:"#111118",
                                    borderRadius:10,border:"1px dashed #2D1F52",color:"#6B7280",fontSize:12}}>
                                    No photos yet — be the first to post!
                                  </div>
                                ) : (
                                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                                    {media.map((m:any)=>(
                                      <div key={m.id} style={{position:"relative",aspectRatio:"1",borderRadius:10,overflow:"hidden"}}>
                                        <img src={m.media_url} alt={m.caption||""} style={{
                                          width:"100%",height:"100%",objectFit:"cover"}}/>
                                        <div style={{position:"absolute",bottom:0,left:0,right:0,
                                          background:"linear-gradient(transparent,rgba(0,0,0,0.7))",
                                          padding:"4px 6px",fontSize:9,color:"#fff",fontWeight:600}}>
                                          {m.users?.username||""}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Open challenges looking for opponents */}
                    {open.length>0 && (
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",
                          letterSpacing:1,marginBottom:10}}>📋 Looking for Opponent</div>
                        {open.map(chal=>{
                          const meta=METRICS[chal.metric]||METRICS.miles_run;
                          const isCreator=chal.creator_group_id===dbId;
                          return (
                            <div key={chal.id} style={{background:"#111118",borderRadius:14,
                              padding:"14px 16px",border:"1px solid #2D1F52",marginBottom:8}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <div>
                                  <div style={{fontWeight:800,fontSize:14,color:"#F0F0F0",marginBottom:3}}>
                                    {meta.icon} {chal.title}
                                  </div>
                                  <div style={{fontSize:11,color:"#6B7280"}}>
                                    {meta.label} · {chal.member_count}v{chal.member_count} · {chal.duration_days}d
                                  </div>
                                </div>
                                {!isCreator && isOwnerOrMod && (
                                  <button onClick={()=>acceptWarChallenge(chal)} style={{
                                    padding:"8px 14px",borderRadius:10,border:"none",
                                    background:"linear-gradient(135deg,#4ADE80,#16A34A)",
                                    color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",flexShrink:0,
                                  }}>⚔️ Accept</button>
                                )}
                                {isCreator && (
                                  <span style={{fontSize:11,color:"#6B7280",fontStyle:"italic"}}>Awaiting opponent...</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Completed wars */}
                    {done.length>0 && (
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",
                          letterSpacing:1,marginBottom:10}}>🏁 Past Wars</div>
                        {done.map(chal=>{
                          const meta=METRICS[chal.metric]||METRICS.miles_run;
                          const weWon=chal.winner_group_id===dbId;
                          return (
                            <div key={chal.id} style={{background:"#111118",borderRadius:14,
                              padding:"12px 16px",border:`1px solid ${weWon?"#F5A623":"#2D1F52"}`,
                              marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div>
                                <div style={{fontWeight:800,fontSize:13,color:"#F0F0F0"}}>{chal.title}</div>
                                <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>{meta.label}</div>
                              </div>
                              <div style={{fontSize:20}}>{weWon?"🏆":chal.winner_group_id?"🥈":"🤝"}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {warChallenges.length===0 && !warLoading && (
                      <div style={{textAlign:"center",padding:"40px 20px",color:"#6B7280"}}>
                        <div style={{fontSize:40,marginBottom:12}}>⚔️</div>
                        <div style={{fontWeight:700,fontSize:16,color:"#F0F0F0",marginBottom:8}}>No wars yet</div>
                        {isOwnerOrMod
                          ? <div style={{fontSize:13}}>Create a challenge or check "Find Opponents" to accept one.</div>
                          : <div style={{fontSize:13}}>Only group admins can create challenges.</div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Create War Modal */}
                {showCreateWar && (
                  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,
                    display:"flex",alignItems:"flex-end",justifyContent:"center"}}
                    onClick={e=>{if(e.target===e.currentTarget)setShowCreateWar(false);}}>
                    <div style={{background:"#111118",borderRadius:"24px 24px 0 0",width:"100%",
                      maxWidth:560,maxHeight:"90vh",overflowY:"auto",padding:"24px 20px 48px"}}>
                      <div style={{fontWeight:900,fontSize:20,color:"#F0F0F0",marginBottom:20}}>⚔️ Create War</div>

                      <label style={{fontSize:11,fontWeight:700,color:"#6B7280",display:"block",marginBottom:5,textTransform:"uppercase"}}>Title</label>
                      <input value={warForm.title} onChange={e=>setWarForm(f=>({...f,title:e.target.value}))}
                        placeholder="e.g. Spring Running Battle" style={{width:"100%",background:"#0A0A0F",
                          border:"1px solid #2D1F52",borderRadius:10,padding:"10px 12px",fontSize:14,
                          color:"#F0F0F0",outline:"none",boxSizing:"border-box" as const,marginBottom:14}}/>

                      <label style={{fontSize:11,fontWeight:700,color:"#6B7280",display:"block",marginBottom:8,textTransform:"uppercase"}}>Challenge Type</label>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                        {Object.entries(METRICS).map(([key,m])=>(
                          <button key={key} onClick={()=>setWarForm(f=>({...f,metric:key}))} style={{
                            padding:"10px 6px",borderRadius:10,border:`1.5px solid ${warForm.metric===key?"#7C3AED":"#2D1F52"}`,
                            background:warForm.metric===key?"#2D1F52":"transparent",
                            color:warForm.metric===key?"#fff":"#6B7280",cursor:"pointer",fontSize:11,fontWeight:700,
                          }}><div style={{fontSize:18,marginBottom:2}}>{m.icon}</div>{m.label}</button>
                        ))}
                      </div>

                      {warForm.metric==="weight_lifted" && (
                        <>
                          <label style={{fontSize:11,fontWeight:700,color:"#6B7280",display:"block",marginBottom:8,textTransform:"uppercase"}}>Lift Type</label>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                            {LIFT_TYPES.map(l=>(
                              <button key={l.key} onClick={()=>setWarForm(f=>({...f,lift_type:l.key}))} style={{
                                padding:"10px",borderRadius:10,border:`1.5px solid ${warForm.lift_type===l.key?"#F5A623":"#2D1F52"}`,
                                background:warForm.lift_type===l.key?"rgba(245,166,35,0.12)":"transparent",
                                color:warForm.lift_type===l.key?"#F5A623":"#6B7280",cursor:"pointer",fontSize:13,fontWeight:700,
                              }}>{l.label}</button>
                            ))}
                          </div>
                        </>
                      )}

                      <label style={{fontSize:11,fontWeight:700,color:"#6B7280",display:"block",marginBottom:8,textTransform:"uppercase"}}>Duration</label>
                      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap" as const}}>
                        {[3,7,14,30].map(d=>(
                          <button key={d} onClick={()=>setWarForm(f=>({...f,duration_days:d}))} style={{
                            padding:"8px 16px",borderRadius:20,border:`1px solid ${warForm.duration_days===d?"#7C3AED":"#2D1F52"}`,
                            background:warForm.duration_days===d?"#2D1F52":"transparent",
                            color:warForm.duration_days===d?"#fff":"#6B7280",cursor:"pointer",fontSize:13,fontWeight:700,
                          }}>{d} days</button>
                        ))}
                      </div>

                      <label style={{fontSize:11,fontWeight:700,color:"#6B7280",display:"block",marginBottom:8,textTransform:"uppercase"}}>
                        Select Your Team ({warSelectedMembers.length} selected)
                      </label>
                      <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:20,maxHeight:200,overflowY:"auto"}}>
                        {displayMembers.map((m:any)=>{
                          const sel=warSelectedMembers.includes(m.userId);
                          const name=m.name||"Member";
                          const uid=m.userId;
                          if (!uid) return null;
                          return (
                            <button key={uid} onClick={()=>setWarSelectedMembers(s=>sel?s.filter(id=>id!==uid):[...s,uid])}
                              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                                borderRadius:10,border:`1px solid ${sel?"#7C3AED":"#2D1F52"}`,
                                background:sel?"#2D1F52":"transparent",cursor:"pointer",textAlign:"left" as const}}>
                              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#A78BFA)",
                                display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",
                                flexShrink:0,overflow:"hidden",border:`2px solid ${sel?"#7C3AED":"transparent"}`}}>
                                {m.avatarUrl
                                  ? <img src={m.avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={name}/>
                                  : name[0]?.toUpperCase()}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:700,color:"#F0F0F0"}}>{name}</div>
                                {m.username && <div style={{fontSize:11,color:"#6B7280"}}>@{m.username} · {m.role}</div>}
                              </div>
                              {sel && <div style={{color:"#7C3AED",fontWeight:800}}>✓</div>}
                            </button>
                          );
                        })}
                      </div>

                      <button onClick={createWarChallenge} disabled={warSaving} style={{
                        width:"100%",padding:"13px 0",borderRadius:14,border:"none",
                        background:"linear-gradient(135deg,#7C3AED,#A78BFA)",
                        color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",
                      }}>{warSaving?"Creating...":"⚔️ Post Challenge"}</button>
                      <button onClick={()=>setShowCreateWar(false)} style={{
                        width:"100%",marginTop:10,padding:"11px 0",borderRadius:14,
                        border:"1px solid #2D1F52",background:"transparent",
                        color:"#6B7280",fontWeight:700,fontSize:14,cursor:"pointer",
                      }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ══ RIGHT: Sidebar — Desktop only ══ */}
        <div className="groups-desktop-sidebar groups-sidebar" style={{ width:300, flexShrink:0 }}>

          {/* Events sidebar */}
          <div style={{ marginBottom:20 }}>
            <div style={{ marginBottom:12, paddingBottom:10, borderBottom:`1px solid ${C.darkBorder}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:900, fontSize:15, color:"#E2E8F0" }}>🗓️ Upcoming Events</div>
                <div style={{ fontSize:11, color:C.darkSub, marginTop:2 }}>{displayEvents.length} scheduled</div>
              </div>
              {group._dbId && (
                <button onClick={() => setShowEventModal(true)} style={{ padding:"5px 12px", borderRadius:8, border:"none", background:`linear-gradient(135deg,${catColor},${catColor}CC)`, color:"#fff", fontWeight:700, fontSize:11, cursor:"pointer" }}>+ Event</button>
              )}
            </div>
            {displayEvents.length === 0 && <div style={{ fontSize:12, color:C.darkSub, textAlign:"center", padding:"12px 0" }}>No events yet</div>}
            {displayEvents.map((event:any) => (
              <EventCard key={event.id} event={event} catColor={catColor}
                commentInputs={commentInputs} setCommentInputs={setCommentInputs}
                eventComments={eventComments} addEventComment={addEventComment}
                onRSVP={handleRSVP} rsvped={rsvpedEvents.has(event.id)} />
            ))}
          </div>

          {/* Members sidebar */}
          <div>
            <div style={{ marginBottom:12, paddingBottom:10, borderBottom:`1px solid ${C.darkBorder}` }}>
              <div style={{ fontWeight:900, fontSize:15, color:"#E2E8F0" }}>👥 Top Members</div>
              <div style={{ fontSize:11, color:C.darkSub, marginTop:2 }}>Moderators & most active</div>
            </div>
            {displayMembers.map((m:any, i:number) => (
              <div key={i} onClick={() => router.push(m.username ? `/profile/${m.username}` : '/profile')}
                style={{ background:C.darkCard, borderRadius:14, border:`1px solid ${C.darkBorder}`, marginBottom:9, padding:"12px 14px", display:"flex", alignItems:"center", gap:11, cursor:"pointer", transition:"border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = catColor}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.darkBorder}
              >
                <div style={{ width:12, fontSize:10, fontWeight:900, color:C.darkSub, flexShrink:0, textAlign:"center" }}>#{m.rank}</div>
                <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden" }}>
                  {m.avatarUrl ? <img src={m.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : m.avatar}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:13, color:"#E2E8F0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.name}</div>
                  <div style={{ fontSize:10, color:m.role==="Organizer"||m.role==="Moderator"?catColor:C.darkSub, marginTop:1, fontWeight:m.role==="Organizer"||m.role==="Moderator"?700:400 }}>{m.role}</div>
                </div>
                {m.points > 0 && <div style={{ fontSize:11, fontWeight:800, color:catColor, flexShrink:0 }}>{m.points?.toLocaleString()} pts</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

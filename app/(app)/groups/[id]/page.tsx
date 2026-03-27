"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const C = {
  blue:"#7C3AED", blueLight:"#F3F0FF", blueMid:"#DDD6FE",
  gold:"#F5A623", text:"#1A2B3C", sub:"#5A7A8A", white:"#FFFFFF", bg:"#F8F5FF",
  dark:"#0F1117", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
};

const CATEGORY_COLORS: Record<string,string> = {
  "Running":"#7C3AED","Strength":"#7C3AED","Yoga":"#52C97A","HIIT":"#EF4444",
  "Bodybuilding":"#F5A623","Nutrition":"#10B981","Wellness":"#A78BFA","Calisthenics":"#06B6D4",
};

// ── Full group data ────────────────────────────────────────────────────────────
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
      { id:"5", name:"Group Stretch & Recovery", date:"Apr 5", time:"8:00 AM", emoji:"🧘", price:"Free", description:"Post-race recovery session with guided stretching and foam rolling.", comments:[] },
    ],
    posts:[
      { id:"1", user:"Kayla Nguyen", avatar:"KN", time:"2h ago", content:"6 miles done this morning! Red Rock at sunrise is something else entirely 🏔️ See everyone Saturday!", likes:34, photo:"https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80" },
      { id:"2", user:"Diego Reyes", avatar:"DR", time:"1d ago", content:"New PR on the Saturday loop — 24:12 🔥 Training is paying off. Who's doing the April race?", likes:58, photo:null },
      { id:"3", user:"Marcus Bell", avatar:"MB", time:"2d ago", content:"Reminder: this Saturday we're meeting at the LOWER trailhead, not the main lot. Parking fills fast!", likes:21, photo:null },
    ],
    members_list:[
      { avatar:"KN", name:"Kayla Nguyen", role:"Organizer", rank:1, points:2840 },
      { avatar:"DR", name:"Diego Reyes", role:"Top Member", rank:2, points:2100 },
      { avatar:"MB", name:"Marcus Bell", role:"Top Member", rank:3, points:1890 },
      { avatar:"PS", name:"Priya Sharma", role:"Member", rank:4, points:1240 },
      { avatar:"LT", name:"Lena Torres", role:"Member", rank:5, points:980 },
    ],
    leaderboard:[
      { avatar:"DR", name:"Diego Reyes", score:"42 runs", metric:"Miles This Month", value:"186 mi", rank:1 },
      { avatar:"KN", name:"Kayla Nguyen", score:"38 runs", metric:"Miles This Month", value:"172 mi", rank:2 },
      { avatar:"MB", name:"Marcus Bell", score:"31 runs", metric:"Miles This Month", value:"148 mi", rank:3 },
      { avatar:"PS", name:"Priya Sharma", score:"24 runs", metric:"Miles This Month", value:"112 mi", rank:4 },
      { avatar:"LT", name:"Lena Torres", score:"18 runs", metric:"Miles This Month", value:"84 mi", rank:5 },
    ],
    challenges:[
      { id:"1", name:"5 Minute Mile Club", emoji:"⚡", desc:"Run a sub-5 minute mile and post your proof. Verified by group moderators.", participants:12, deadline:"Apr 30", difficulty:"Elite", badge:"⚡" },
      { id:"2", name:"100 Mile March", emoji:"🏅", desc:"Log 100 miles in March. Every run counts. Track in the app and post your progress.", participants:47, deadline:"Mar 31", difficulty:"Hard", badge:"💯" },
      { id:"3", name:"Trail Newbie", emoji:"🌿", desc:"Complete your first Red Rock trail run and post a selfie at the summit.", participants:28, deadline:"May 1", difficulty:"Beginner", badge:"🌿" },
    ],
    notes:[
      { id:"1", user:"Kayla Nguyen", avatar:"KN", time:"3h ago", category:"Workout", content:"My go-to pre-run warmup: 5 min walk → 20 leg swings → 10 hip circles → easy jog for 5 min. Changed everything for me!", likes:24 },
      { id:"2", user:"Diego Reyes", avatar:"DR", time:"1d ago", category:"Recipe", content:"Post-run recovery smoothie 🥤 Banana + almond milk + 2 scoops protein + frozen mango + a handful of spinach. You won't taste the spinach, I promise.", likes:41 },
      { id:"3", user:"Marcus Bell", avatar:"MB", time:"2d ago", category:"Mindset", content:"When you don't feel like running: put your shoes on and just walk out the door. That's the only commitment. Once you're outside, you'll run. Works every time.", likes:67 },
    ],
  },
  "summerlin-iron-club": {
    name:"Summerlin Iron Club", category:"Strength", emoji:"🏋️", members:156, isLocal:true,
    city:"Las Vegas, NV", meetFrequency:"Mon / Wed / Fri 5:30AM", location:"24 Hour Fitness · Summerlin",
    tags:["#Powerlifting","#Summerlin","#Strength"],
    description:"Serious lifters who show up early and push each other. Powerlifting-focused with a supportive community vibe. We track each other's PRs and celebrate every milestone together.",
    recentPhoto:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80",
    events:[
      { id:"2", name:"Max Out Monday", date:"Mar 31", time:"5:30 AM", emoji:"💪", price:"Free", description:"Weekly 1RM attempts. Squat, bench, deadlift. Spotters provided.", comments:[] },
      { id:"4", name:"Form Check Workshop", date:"Apr 6", time:"10:00 AM", emoji:"🏋️", price:"Free", description:"Bring your lifts, get feedback from experienced coaches in the group.", comments:[] },
    ],
    posts:[
      { id:"1", user:"Jake Morrison", avatar:"JM", time:"3h ago", content:"New bench PR today — 225 for 5 clean reps. The Iron Club energy in the early morning is unmatched 💪", likes:47, photo:"https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80" },
      { id:"2", user:"Mike Davis", avatar:"MD", time:"1d ago", content:"Squatted 315 this morning. If you're not training before the sun comes up, are you even training?", likes:89, photo:null },
    ],
    members_list:[
      { avatar:"JM", name:"Jake Morrison", role:"Organizer", rank:1, points:3200 },
      { avatar:"MD", name:"Mike Davis", role:"Top Member", rank:2, points:2800 },
      { avatar:"SC", name:"Sara Chen", role:"Top Member", rank:3, points:1900 },
      { avatar:"CR", name:"Chris R.", role:"Member", rank:4, points:1400 },
      { avatar:"LF", name:"Luna F.", role:"Member", rank:5, points:980 },
    ],
    leaderboard:[
      { avatar:"MD", name:"Mike Davis", score:"315 squat", metric:"Best Lift This Month", value:"405 deadlift", rank:1 },
      { avatar:"JM", name:"Jake Morrison", score:"225 bench", metric:"Best Lift This Month", value:"385 deadlift", rank:2 },
      { avatar:"SC", name:"Sara Chen", score:"185 squat", metric:"Best Lift This Month", value:"275 deadlift", rank:3 },
      { avatar:"CR", name:"Chris R.", score:"205 squat", metric:"Best Lift This Month", value:"315 deadlift", rank:4 },
      { avatar:"LF", name:"Luna F.", score:"135 squat", metric:"Best Lift This Month", value:"185 deadlift", rank:5 },
    ],
    challenges:[
      { id:"1", name:"1000 Pound Club", emoji:"🏆", desc:"Total your squat + bench + deadlift to 1000 lbs or more in a single session.", participants:8, deadline:"Jun 1", difficulty:"Elite", badge:"🏆" },
      { id:"2", name:"Every Day in April", emoji:"🔥", desc:"Hit the gym every single day in April. Rest days count if you do mobility work.", participants:23, deadline:"Apr 30", difficulty:"Hard", badge:"🔥" },
    ],
    notes:[
      { id:"1", user:"Jake Morrison", avatar:"JM", time:"5h ago", category:"Workout", content:"Current push day: Bench 5x5 → Incline DB 4x10 → Cable flies 3x15 → Shoulder press 4x12 → Lateral raises 3x20. Takes about 70 min. Gains have been insane.", likes:38 },
      { id:"2", user:"Mike Davis", avatar:"MD", time:"1d ago", category:"Recipe", content:"Bulking meal: 1lb ground beef + white rice + butter + salt. 1200 calories, 80g protein. Not glamorous but it works.", likes:52 },
    ],
  },
  "vegas-yoga-collective": {
    name:"Vegas Yoga Collective", category:"Yoga", emoji:"🧘", members:412, isLocal:true,
    city:"Las Vegas, NV", meetFrequency:"Every Sunday 8AM", location:"Sunset Park · Las Vegas",
    tags:["#Yoga","#Wellness","#LasVegas","#Mindfulness"],
    description:"Free community yoga every Sunday in the park. All levels, all ages, all bodies. Mats provided for beginners. Come as you are, leave better than you arrived.",
    recentPhoto:"https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=1200&q=80",
    events:[
      { id:"5", name:"Sunday Flow", date:"Mar 30", time:"8:00 AM", emoji:"🧘", price:"Free", description:"60 minute vinyasa flow for all levels. Mats and blocks provided.", comments:[] },
      { id:"6", name:"Full Moon Meditation", date:"Apr 13", time:"7:30 PM", emoji:"🌕", price:"Free", description:"Evening meditation under the full moon. Guided breathing and sound bowl session.", comments:[] },
    ],
    posts:[
      { id:"1", user:"Maya Torres", avatar:"MT", time:"4h ago", content:"Last Sunday was our biggest turnout yet — 60+ people in the park 🌿 Community is everything. See you all this Sunday!", likes:112, photo:"https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&q=80" },
    ],
    members_list:[
      { avatar:"MT", name:"Maya Torres", role:"Organizer", rank:1, points:4200 },
      { avatar:"PS", name:"Priya Sharma", role:"Top Member", rank:2, points:2800 },
      { avatar:"LT", name:"Lena Torres", role:"Top Member", rank:3, points:2100 },
      { avatar:"NO", name:"Natacha O.", role:"Member", rank:4, points:1600 },
      { avatar:"KN", name:"Kayla N.", role:"Member", rank:5, points:980 },
    ],
    leaderboard:[
      { avatar:"MT", name:"Maya Torres", score:"52 sessions", metric:"Sessions This Month", value:"60 hrs total", rank:1 },
      { avatar:"PS", name:"Priya Sharma", score:"38 sessions", metric:"Sessions This Month", value:"42 hrs total", rank:2 },
      { avatar:"LT", name:"Lena Torres", score:"31 sessions", metric:"Sessions This Month", value:"36 hrs total", rank:3 },
      { avatar:"NO", name:"Natacha O.", score:"24 sessions", metric:"Sessions This Month", value:"28 hrs total", rank:4 },
      { avatar:"KN", name:"Kayla N.", score:"18 sessions", metric:"Sessions This Month", value:"21 hrs total", rank:5 },
    ],
    challenges:[
      { id:"1", name:"30-Day Morning Practice", emoji:"🌅", desc:"Practice yoga every morning for 30 days, even if just 10 minutes. Log your streak.", participants:84, deadline:"Apr 30", difficulty:"Medium", badge:"🌅" },
      { id:"2", name:"Headstand Journey", emoji:"🤸", desc:"Document your path to your first headstand. Share progress posts weekly.", participants:31, deadline:"May 15", difficulty:"Hard", badge:"🤸" },
    ],
    notes:[
      { id:"1", user:"Maya Torres", avatar:"MT", time:"2h ago", category:"Mindset", content:"When I'm anxious I do box breathing: inhale 4 counts, hold 4, exhale 4, hold 4. Repeat 4 times. Works faster than anything else I've tried.", likes:89 },
      { id:"2", user:"Priya Sharma", avatar:"PS", time:"1d ago", category:"Recipe", content:"Post-yoga golden milk: warm oat milk + turmeric + ginger + cinnamon + black pepper + a little honey. Anti-inflammatory and so comforting.", likes:64 },
    ],
  },
  "lv-hiit-squad": {
    name:"LV HIIT Squad", category:"HIIT", emoji:"🔥", members:198, isLocal:true,
    city:"Las Vegas, NV", meetFrequency:"Tue / Thu 6PM", location:"Springs Preserve · Las Vegas",
    tags:["#HIIT","#LasVegas","#Bootcamp","#Cardio"],
    description:"High intensity, zero judgment. Outdoor bootcamp sessions that leave you completely gassed. Bring water, bring your ego to lose, and bring a friend.",
    recentPhoto:"https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=1200&q=80",
    events:[
      { id:"4", name:"Thursday Burnout", date:"Mar 27", time:"6:00 PM", emoji:"🔥", price:"Free", description:"45 minute HIIT circuit. Burpees, box jumps, sprint intervals. Bring water.", comments:[] },
      { id:"7", name:"Spring Challenge Kickoff", date:"Apr 1", time:"6:00 PM", emoji:"🏆", price:"Free", description:"Kickoff for the 30-day Spring Shred challenge. Partner workouts.", comments:[] },
    ],
    posts:[
      { id:"1", user:"Marcus Bell", avatar:"MB", time:"5h ago", content:"Tuesday's session was absolutely brutal and I loved every second. Thursday we go again 🔥", likes:34, photo:null },
      { id:"2", user:"Diego Reyes", avatar:"DR", time:"2d ago", content:"Personal best on the sprint interval today — 40 second 200m. Progress is real when you show up consistently.", likes:56, photo:"https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80" },
    ],
    members_list:[
      { avatar:"MB", name:"Marcus Bell", role:"Organizer", rank:1, points:3100 },
      { avatar:"DR", name:"Diego Reyes", role:"Top Member", rank:2, points:2400 },
      { avatar:"KN", name:"Kayla Nguyen", role:"Top Member", rank:3, points:1800 },
      { avatar:"JM", name:"Jake M.", role:"Member", rank:4, points:1200 },
      { avatar:"SC", name:"Sara C.", role:"Member", rank:5, points:890 },
    ],
    leaderboard:[
      { avatar:"MB", name:"Marcus Bell", score:"28 sessions", metric:"Calories Burned", value:"18,400 cal", rank:1 },
      { avatar:"DR", name:"Diego Reyes", score:"24 sessions", metric:"Calories Burned", value:"15,800 cal", rank:2 },
      { avatar:"KN", name:"Kayla Nguyen", score:"21 sessions", metric:"Calories Burned", value:"13,200 cal", rank:3 },
      { avatar:"JM", name:"Jake M.", score:"18 sessions", metric:"Calories Burned", value:"11,900 cal", rank:4 },
      { avatar:"SC", name:"Sara C.", score:"14 sessions", metric:"Calories Burned", value:"9,100 cal", rank:5 },
    ],
    challenges:[
      { id:"1", name:"Spring Shred 30", emoji:"🌱", desc:"30 days of consecutive HIIT workouts. Miss a day and start over. Accountability posts required.", participants:34, deadline:"Apr 30", difficulty:"Hard", badge:"🌱" },
      { id:"2", name:"100 Burpee Club", emoji:"💀", desc:"Complete 100 consecutive burpees and post your time. Under 10 minutes gets a badge.", participants:11, deadline:"May 1", difficulty:"Elite", badge:"💀" },
    ],
    notes:[
      { id:"1", user:"Marcus Bell", avatar:"MB", time:"1h ago", category:"Workout", content:"My HIIT protocol that never gets boring: 40 sec on / 20 sec off. Round 1: burpees, mountain climbers, jump squats. Round 2: sprints, lateral shuffles, high knees. 4 rounds = 24 min of pure fire.", likes:45 },
      { id:"2", user:"Diego Reyes", avatar:"DR", time:"1d ago", category:"Mindset", content:"Stopped telling myself 'I have to work out' and started saying 'I get to work out.' Sounds small but it completely changed how I show up.", likes:78 },
    ],
  },
  "global-gains-community": {
    name:"Global Gains Community", category:"Bodybuilding", emoji:"💪", members:48200, isLocal:false, trending:true,
    tags:["#Bodybuilding","#Gains","#Worldwide"],
    description:"The internet's most supportive bodybuilding community. Post your lifts, get form checks, share progress, and get hyped by 48,000 people who actually get it.",
    recentPhoto:"https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1200&q=80",
    events:[
      { id:"8", name:"Weekly Check-In Thread", date:"Every Monday", time:"All Day", emoji:"📊", price:"Free", description:"Post your weekly progress photo, current lifts, and goals for the week. Community feedback only.", comments:[] },
      { id:"9", name:"April Body Transformation Challenge", date:"Apr 1", time:"All Day", emoji:"🏆", price:"Free", description:"8 week transformation challenge. Submit before/after at week 4 and week 8. Top 3 win merch.", comments:[] },
    ],
    posts:[
      { id:"1", user:"Chris B.", avatar:"CB", time:"1h ago", content:"Prep week 8. Coming in tighter than I've ever been. The community accountability keeps me locked in 💪", likes:2840, photo:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80" },
      { id:"2", user:"Jordan Kim", avatar:"JK", time:"4h ago", content:"Hit 405 deadlift today. Wouldn't have pushed for this without you all constantly pushing me. Grateful 🙏", likes:1240, photo:null },
      { id:"3", user:"Alex R.", avatar:"AR", time:"8h ago", content:"Form check request — is my squat depth good? Video in comments. Be honest!", likes:67, photo:null },
    ],
    members_list:[
      { avatar:"CB", name:"Chris B.", role:"Top Contributor", rank:1, points:48200 },
      { avatar:"MT", name:"Maya T.", role:"Moderator", rank:2, points:31500 },
      { avatar:"JK", name:"Jordan Kim", role:"Top Contributor", rank:3, points:22800 },
      { avatar:"AR", name:"Alex R.", role:"Top Contributor", rank:4, points:18400 },
      { avatar:"BK", name:"Brandon K.", role:"Member", rank:5, points:12300 },
    ],
    leaderboard:[
      { avatar:"CB", name:"Chris B.", score:"284 posts", metric:"Community Points", value:"48,200 pts", rank:1 },
      { avatar:"JK", name:"Jordan Kim", score:"198 posts", metric:"Community Points", value:"31,500 pts", rank:2 },
      { avatar:"AR", name:"Alex R.", score:"156 posts", metric:"Community Points", value:"22,800 pts", rank:3 },
      { avatar:"BK", name:"Brandon K.", score:"112 posts", metric:"Community Points", value:"18,400 pts", rank:4 },
      { avatar:"MT", name:"Maya T.", score:"89 posts", metric:"Community Points", value:"12,300 pts", rank:5 },
    ],
    challenges:[
      { id:"1", name:"1000 Pound Club", emoji:"🏆", desc:"Total your squat + bench + deadlift to 1000 lbs or more. Post the video.", participants:312, deadline:"Jun 1", difficulty:"Elite", badge:"🏆" },
      { id:"2", name:"8-Week Transformation", emoji:"📸", desc:"Document your physique transformation over 8 weeks with weekly check-in photos.", participants:1840, deadline:"May 30", difficulty:"Hard", badge:"📸" },
      { id:"3", name:"365 Streak", emoji:"🔥", desc:"Work out every single day for a full year. Log it daily. No rest days.", participants:48, deadline:"Dec 31", difficulty:"Legendary", badge:"🔥" },
    ],
    notes:[
      { id:"1", user:"Chris B.", avatar:"CB", time:"2h ago", category:"Workout", content:"Current chest split: Flat bench 5x5 → Incline DB press 4x10 → Pec deck 4x15 → Cable crossover 3x20 → Push-ups to failure. Volume is everything in the off-season.", likes:1240 },
      { id:"2", user:"Jordan Kim", avatar:"JK", time:"6h ago", category:"Recipe", content:"Bulk meal prep: 5 lbs ground turkey + jasmine rice + mixed veggies. Season with everything. Divide into 10 containers. 450 cal / 48g protein per container. $35 total.", likes:890 },
      { id:"3", user:"Alex R.", avatar:"AR", time:"1d ago", category:"Mindset", content:"Stopped comparing my year 1 to someone else's year 10. Biggest mindset shift of my life. Run your own race.", likes:2100 },
    ],
  },
};

// Fill remaining online groups with minimal data
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

// ── Reusable EventCard (avoids useState-in-map violation) ─────────────────────
function EventCard({ event, catColor, commentInputs, setCommentInputs, eventComments, addEventComment }: {
  event: any; catColor: string;
  commentInputs: Record<string,string>;
  setCommentInputs: React.Dispatch<React.SetStateAction<Record<string,string>>>;
  eventComments: Record<string,{user:string;text:string;time:string}[]>;
  addEventComment: (id:string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const comments = eventComments[event.id] || [];
  const darkCard = "#1A1D2E", darkBorder = "#2A2D3E", darkSub = "#8892A4", gold = "#F5A623";
  return (
    <div style={{ background:darkCard, borderRadius:16, border:`1px solid ${darkBorder}`, marginBottom:12, overflow:"hidden" }}>
      <div style={{ padding:"13px 14px", cursor:"pointer" }} onClick={() => setShowComments(s=>!s)}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg,${catColor},${catColor}CC)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{event.emoji}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:13, color:"#E2E8F0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{event.name}</div>
            <div style={{ fontSize:11, color:darkSub, marginTop:2 }}>📅 {event.date} · ⏰ {event.time}</div>
            <div style={{ fontSize:11, fontWeight:700, color:gold, marginTop:1 }}>{event.price}</div>
          </div>
          <div style={{ color:darkSub, fontSize:12 }}>{showComments?"▲":"▼"}</div>
        </div>
        {event.description && <p style={{ fontSize:11, color:darkSub, lineHeight:1.5, marginTop:8, marginBottom:0 }}>{event.description}</p>}
      </div>
      {showComments && (
        <div style={{ borderTop:`1px solid ${darkBorder}`, padding:"10px 14px" }}>
          {comments.length > 0 && (
            <div style={{ marginBottom:8 }}>
              {comments.map((c,i) => (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                  <div style={{ width:26, height:26, borderRadius:"50%", background:catColor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, color:"#fff", flexShrink:0 }}>JB</div>
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

// ── Helpers ────────────────────────────────────────────────────────────────────
const DIFFICULTY_COLORS: Record<string,string> = {
  "Beginner":"#10B981", "Medium":"#7C3AED", "Hard":"#F5A623", "Elite":"#EF4444", "Legendary":"#7C3AED",
};
const NOTE_CATEGORY_COLORS: Record<string,string> = {
  "Workout":"#7C3AED", "Recipe":"#10B981", "Mindset":"#7C3AED", "General":"#F5A623",
};

// ─────────────────────────────────────────────────────────────────────────────
export default function GroupPage() {
  const { id } = useParams<{ id:string }>();
  const router = useRouter();
  const group = ALL_GROUPS[id as string];
  const [joined, setJoined] = useState(false);
  const [tab, setTab] = useState<"posts"|"leaderboard"|"challenges"|"notes"|"events"|"members">("posts");
  const [postLikes, setPostLikes] = useState<Record<string,number>>({});
  const [likedPosts, setLikedPosts] = useState<Record<string,boolean>>({});
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] = useState("General");
  const [localNotes, setLocalNotes] = useState<any[]>([]);
  const [eventComments, setEventComments] = useState<Record<string,{user:string;text:string;time:string}[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string,string>>({});
  const [joinedChallenges, setJoinedChallenges] = useState<Record<string,boolean>>({});
  const [noteLikes, setNoteLikes] = useState<Record<string,number>>({});

  if (!group) {
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

  const catColor = CATEGORY_COLORS[group.category] ?? C.blue;
  const allNotes = [...(group.notes || []), ...localNotes];

  function togglePostLike(postId: string, baseLikes: number) {
    setLikedPosts(p => ({ ...p, [postId]: !p[postId] }));
    setPostLikes(p => ({ ...p, [postId]: likedPosts[postId] ? baseLikes : baseLikes + 1 }));
  }

  function addEventComment(eventId: string) {
    const text = commentInputs[eventId]?.trim();
    if (!text) return;
    setEventComments(prev => ({
      ...prev,
      [eventId]: [...(prev[eventId] || []), { user:"You", text, time:"Just now" }],
    }));
    setCommentInputs(prev => ({ ...prev, [eventId]: "" }));
  }

  function submitNote() {
    if (!noteText.trim()) return;
    setLocalNotes(prev => [...prev, { id: String(Date.now()), user:"You", avatar:"JB", time:"Just now", category:noteCategory, content:noteText, likes:0 }]);
    setNoteText("");
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

      {/* ── Hero Banner ── */}
      <div style={{ width:"100%", height:260, position:"relative", overflow:"hidden" }}>
        <img src={group.recentPhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.78) 100%)" }} />
        <button onClick={() => router.back()} style={{ position:"absolute", top:20, left:20, background:"rgba(0,0,0,0.4)", border:"1.5px solid rgba(255,255,255,0.3)", borderRadius:12, color:"#fff", fontSize:13, fontWeight:700, padding:"8px 14px", cursor:"pointer", backdropFilter:"blur(6px)" }}>
          ← Back
        </button>
        <div style={{ position:"absolute", top:20, right:20, background:catColor, borderRadius:99, padding:"5px 14px", fontSize:12, fontWeight:800, color:"#fff" }}>
          {group.emoji} {group.category}
        </div>
        <div style={{ position:"absolute", bottom:24, left:28, right:28 }}>
          <div style={{ fontWeight:900, fontSize:26, color:"#fff", textShadow:"0 2px 8px rgba(0,0,0,0.5)", marginBottom:8 }}>{group.name}</div>
          <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ background:"rgba(255,255,255,0.15)", backdropFilter:"blur(4px)", borderRadius:99, padding:"4px 12px", color:"rgba(255,255,255,0.95)", fontSize:12, fontWeight:700 }}>
              👥 {group.members.toLocaleString()} members
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

          {/* Action buttons — lives inside left column, naturally aligned */}
          <div className="groups-action-bar" style={{ display:"flex", gap:12, marginBottom:20 }}>
            <button onClick={() => setJoined(j=>!j)} style={{ padding:"12px 32px", borderRadius:13, border:"none", background:joined?"rgba(124,58,237,0.12)":"linear-gradient(135deg,#7C3AED,#9333EA)", color:joined?"#7C3AED":"#fff", fontWeight:800, fontSize:15, cursor:"pointer", boxShadow:joined?"none":"0 4px 16px rgba(124,58,237,0.35)", transition:"all 0.15s" }}>
              {joined ? "✓ Joined" : "Join Group"}
            </button>
            <button style={{ padding:"12px 22px", borderRadius:13, background:C.white, border:`2px solid ${C.blueMid}`, color:C.sub, fontWeight:700, fontSize:14, cursor:"pointer" }}>Share</button>
            <button style={{ padding:"12px 18px", borderRadius:13, background:C.white, border:`2px solid ${C.blueMid}`, color:C.sub, fontWeight:700, fontSize:14, cursor:"pointer" }}>···</button>
          </div>

          {/* About card */}
          <div style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, padding:"18px 22px", marginBottom:20 }}>
            <div style={{ fontWeight:800, fontSize:15, color:C.text, marginBottom:8 }}>About this group</div>
            <p style={{ fontSize:14, color:C.sub, lineHeight:1.7, marginBottom:10 }}>{group.description}</p>
            {group.meetFrequency && <div style={{ display:"flex", gap:8, fontSize:13, color:C.sub, marginBottom:5 }}><span>🗓️</span><span><strong style={{ color:C.text }}>Meets:</strong> {group.meetFrequency}</span></div>}
            {group.location && <div style={{ display:"flex", gap:8, fontSize:13, color:C.sub, marginBottom:10 }}><span>📍</span><span><strong style={{ color:C.text }}>Location:</strong> {group.location}</span></div>}
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {group.tags.map((t:string) => (
                <span key={t} style={{ background:C.blueLight, color:C.blue, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, border:`1px solid ${C.blueMid}` }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Tabs — desktop: 4 tabs | mobile: 6 tabs (adds Events + Members) */}
          <div className="groups-tabs" style={{ display:"flex", gap:3, marginBottom:20, background:C.white, borderRadius:14, padding:4, border:`2px solid ${C.blueMid}`, overflowX:"auto" }}>
            {([
              { key:"posts", label:"📸 Posts" },
              { key:"leaderboard", label:"🏆 Board" },
              { key:"challenges", label:"⚡ Challenges" },
              { key:"notes", label:"💬 Notes" },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex:1, padding:"9px 4px", borderRadius:10, border:"none",
                background: tab===t.key ? `linear-gradient(135deg,${catColor},${catColor}CC)` : "transparent",
                color: tab===t.key ? "#fff" : C.sub,
                fontWeight:800, fontSize:12, cursor:"pointer", transition:"all 0.15s", whiteSpace:"nowrap", flexShrink:0,
              }}>
                {t.label}
              </button>
            ))}
            {/* Mobile-only extra tabs */}
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
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── POSTS & MEDIA ── */}
          {tab==="posts" && (
            <div>
              {group.posts.map((post:any) => (
                <div key={post.id} style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, marginBottom:18, overflow:"hidden" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px 10px" }}>
                    <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:"#fff", flexShrink:0, cursor:"pointer" }}
                      onClick={() => router.push(`/profile/${post.user.toLowerCase().replace(/\s/g,"_")}`)}>
                      {post.avatar}
                    </div>
                    <div style={{ flex:1, cursor:"pointer" }} onClick={() => router.push(`/profile/${post.user.toLowerCase().replace(/\s/g,"_")}`)}>
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
                    <button onClick={() => togglePostLike(post.id, post.likes)} style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                      <svg viewBox="0 0 24 24" fill={likedPosts[post.id]?"#FF6B6B":"none"} stroke={likedPosts[post.id]?"#FF6B6B":C.sub} strokeWidth="2" style={{ width:20,height:20 }}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span style={{ fontSize:13, fontWeight:700, color:likedPosts[post.id]?"#FF6B6B":C.sub }}>{(postLikes[post.id] ?? post.likes).toLocaleString()}</span>
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ textAlign:"center", padding:"24px", background:C.white, borderRadius:18, border:`2px dashed ${C.blueMid}` }}>
                <div style={{ fontSize:24, marginBottom:6 }}>🚧</div>
                <div style={{ fontWeight:700, fontSize:13, color:C.blue, marginBottom:3 }}>Live posts in beta</div>
                <div style={{ fontSize:12, color:C.sub }}>Real-time group posts and media appear here once connected to the database.</div>
              </div>
            </div>
          )}

          {/* ── LEADERBOARD ── */}
          {tab==="leaderboard" && (
            <div>
              <div style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, overflow:"hidden", marginBottom:16 }}>
                <div style={{ background:`linear-gradient(135deg,${catColor},${catColor}CC)`, padding:"16px 20px" }}>
                  <div style={{ fontWeight:900, fontSize:16, color:"#fff" }}>🏆 {group.name} Leaderboard</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginTop:3 }}>Updated weekly · Based on activity and engagement</div>
                </div>
                <div style={{ padding:"8px 0" }}>
                  {group.leaderboard?.map((entry:any) => (
                    <div key={entry.rank} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom:`1px solid ${C.blueLight}`, cursor:"pointer" }}
                      onClick={() => router.push(`/profile/${entry.name.toLowerCase().replace(/\s/g,"_")}`)}>
                      {/* Rank */}
                      <div style={{ width:32, height:32, borderRadius:"50%", background:entry.rank<=3?`linear-gradient(135deg,${["#F5A623","#9E9E9E","#CD7F32"][entry.rank-1]},${["#FFD700","#BDBDBD","#E8A87C"][entry.rank-1]})`:"#F3F0FF", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, color:entry.rank<=3?"#fff":C.sub, flexShrink:0 }}>
                        {entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank-1] : `#${entry.rank}`}
                      </div>
                      {/* Avatar */}
                      <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:"#fff", flexShrink:0 }}>
                        {entry.avatar}
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
            </div>
          )}

          {/* ── CHALLENGES ── */}
          {tab==="challenges" && (
            <div>
              {group.challenges?.map((ch:any) => (
                <div key={ch.id} style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, marginBottom:16, overflow:"hidden" }}>
                  <div style={{ background:`linear-gradient(135deg,${catColor}22,${catColor}11)`, padding:"16px 20px", borderBottom:`1px solid ${C.blueMid}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:52, height:52, borderRadius:14, background:`linear-gradient(135deg,${catColor},${catColor}CC)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                        {ch.emoji}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <span style={{ fontWeight:900, fontSize:16, color:C.text }}>{ch.name}</span>
                          <span style={{ background:DIFFICULTY_COLORS[ch.difficulty]+"22", color:DIFFICULTY_COLORS[ch.difficulty], fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:99, border:`1px solid ${DIFFICULTY_COLORS[ch.difficulty]}44` }}>{ch.difficulty}</span>
                        </div>
                        <div style={{ fontSize:12, color:C.sub }}>👥 {ch.participants} participating · 📅 Ends {ch.deadline}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding:"14px 20px" }}>
                    <p style={{ fontSize:13, color:C.sub, lineHeight:1.6, marginBottom:14 }}>{ch.desc}</p>
                    <button onClick={() => setJoinedChallenges(p=>({...p,[ch.id]:!p[ch.id]}))} style={{ width:"100%", padding:"10px", borderRadius:12, border:"none", background:joinedChallenges[ch.id]?"#F3F0FF":`linear-gradient(135deg,${catColor},${catColor}CC)`, color:joinedChallenges[ch.id]?catColor:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                      {joinedChallenges[ch.id] ? `✓ Joined — ${ch.badge} Challenge Accepted!` : "Accept Challenge"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── COMMUNITY NOTES ── */}
          {tab==="notes" && (
            <div>
              {/* Post a note */}
              <div style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, padding:"16px 20px", marginBottom:18 }}>
                <div style={{ fontWeight:800, fontSize:14, color:C.text, marginBottom:12 }}>Share something with the group</div>
                {/* Category picker */}
                <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
                  {["Workout","Recipe","Mindset","General"].map(cat => (
                    <button key={cat} onClick={() => setNoteCategory(cat)} style={{ padding:"6px 14px", borderRadius:99, border:`1.5px solid ${noteCategory===cat?NOTE_CATEGORY_COLORS[cat]:C.blueMid}`, background:noteCategory===cat?`${NOTE_CATEGORY_COLORS[cat]}18`:"transparent", color:noteCategory===cat?NOTE_CATEGORY_COLORS[cat]:C.sub, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                      {cat==="Workout"?"💪":cat==="Recipe"?"🥗":cat==="Mindset"?"🧠":"💬"} {cat}
                    </button>
                  ))}
                </div>
                <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Share a workout routine, recipe, mindset tip, or anything that might help the group..." style={{ width:"100%", background:C.blueLight, border:`1.5px solid ${C.blueMid}`, borderRadius:12, padding:"12px 14px", fontSize:13, color:C.text, resize:"vertical", minHeight:90, fontFamily:"inherit", outline:"none" }} />
                <button onClick={submitNote} style={{ marginTop:10, padding:"10px 24px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${catColor},${catColor}CC)`, color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}>Post Note</button>
              </div>

              {/* Notes feed */}
              {allNotes.map((note:any) => (
                <div key={note.id} style={{ background:C.white, borderRadius:18, border:`2px solid ${C.blueMid}`, padding:"16px 20px", marginBottom:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:"#fff", flexShrink:0 }}>
                      {note.avatar}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, fontSize:13, color:C.text }}>{note.user}</div>
                      <div style={{ fontSize:10, color:C.sub }}>{note.time}</div>
                    </div>
                    <span style={{ background:`${NOTE_CATEGORY_COLORS[note.category]||C.blue}18`, color:NOTE_CATEGORY_COLORS[note.category]||C.blue, fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:99, border:`1px solid ${NOTE_CATEGORY_COLORS[note.category]||C.blue}33` }}>
                      {note.category==="Workout"?"💪":note.category==="Recipe"?"🥗":note.category==="Mindset"?"🧠":"💬"} {note.category}
                    </span>
                  </div>
                  <p style={{ fontSize:14, color:C.text, lineHeight:1.7, margin:"0 0 10px" }}>{note.content}</p>
                  <button onClick={() => setNoteLikes(p=>({...p,[note.id]:(p[note.id]??note.likes)+1}))} style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ width:18,height:18 }}>
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span style={{ fontSize:12, color:C.sub }}>{(noteLikes[note.id]??note.likes).toLocaleString()}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* ── MOBILE ONLY: Events tab ── */}
          {tab === "events" && (
            <div className="groups-mobile-tab-content">
              <div style={{ marginBottom:12 }}>
                <div style={{ fontWeight:900, fontSize:15, color:C.text, marginBottom:4 }}>🗓️ Upcoming Events</div>
                <div style={{ fontSize:12, color:C.sub }}>{group.events?.length} scheduled</div>
              </div>
              {group.events?.map((event:any) => (
                <EventCard key={event.id} event={event} catColor={catColor}
                  commentInputs={commentInputs} setCommentInputs={setCommentInputs}
                  eventComments={eventComments} addEventComment={addEventComment} />
              ))}
            </div>
          )}

          {/* ── MOBILE ONLY: Members tab ── */}
          {tab === "members" && (
            <div className="groups-mobile-tab-content">
              <div style={{ marginBottom:12 }}>
                <div style={{ fontWeight:900, fontSize:15, color:C.text, marginBottom:4 }}>👥 Top Members</div>
                <div style={{ fontSize:12, color:C.sub }}>Moderators & most active</div>
              </div>
              {group.members_list?.map((m:any, i:number) => (
                <div key={i} onClick={() => router.push(`/profile/${m.name.toLowerCase().replace(/\s/g,"_")}`)}
                  style={{ background:C.white, borderRadius:14, border:`2px solid ${C.blueMid}`, marginBottom:10, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
                  <div style={{ width:14, fontSize:11, fontWeight:900, color:C.sub, flexShrink:0, textAlign:"center" }}>#{m.rank}</div>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#fff", flexShrink:0 }}>{m.avatar}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{m.name}</div>
                    <div style={{ fontSize:11, color:m.role==="Organizer"||m.role==="Moderator"?catColor:C.sub, fontWeight:m.role==="Organizer"?700:400 }}>{m.role}</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:800, color:catColor, flexShrink:0 }}>{m.points?.toLocaleString()} pts</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══ RIGHT: Sidebar — Desktop only ══ */}
        <div className="groups-desktop-sidebar groups-sidebar" style={{ width:300, flexShrink:0 }}>

          {/* Events sidebar */}
          <div style={{ marginBottom:20 }}>
            <div style={{ marginBottom:12, paddingBottom:10, borderBottom:`1px solid ${C.darkBorder}` }}>
              <div style={{ fontWeight:900, fontSize:15, color:"#E2E8F0" }}>🗓️ Upcoming Events</div>
              <div style={{ fontSize:11, color:C.darkSub, marginTop:2 }}>{group.events?.length} scheduled</div>
            </div>
            {group.events?.map((event:any) => (
              <EventCard key={event.id} event={event} catColor={catColor}
                commentInputs={commentInputs} setCommentInputs={setCommentInputs}
                eventComments={eventComments} addEventComment={addEventComment} />
            ))}
          </div>

          {/* Members sidebar — trending people aesthetic */}
          <div>
            <div style={{ marginBottom:12, paddingBottom:10, borderBottom:`1px solid ${C.darkBorder}` }}>
              <div style={{ fontWeight:900, fontSize:15, color:"#E2E8F0" }}>👥 Top Members</div>
              <div style={{ fontSize:11, color:C.darkSub, marginTop:2 }}>Moderators & most active</div>
            </div>
            {group.members_list?.map((m:any, i:number) => (
              <div key={i} onClick={() => router.push(`/profile/${m.name.toLowerCase().replace(/\s/g,"_")}`)}
                style={{ background:C.darkCard, borderRadius:14, border:`1px solid ${C.darkBorder}`, marginBottom:9, padding:"12px 14px", display:"flex", alignItems:"center", gap:11, cursor:"pointer", transition:"border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = catColor}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = C.darkBorder}
              >
                <div style={{ width:12, fontSize:10, fontWeight:900, color:C.darkSub, flexShrink:0, textAlign:"center" }}>#{m.rank}</div>
                <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${catColor},${catColor}AA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:"#fff", flexShrink:0 }}>
                  {m.avatar}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:13, color:"#E2E8F0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.name}</div>
                  <div style={{ fontSize:10, color:m.role==="Organizer"||m.role==="Moderator"?catColor:C.darkSub, marginTop:1, fontWeight:m.role==="Organizer"||m.role==="Moderator"?700:400 }}>{m.role}</div>
                </div>
                <div style={{ fontSize:11, fontWeight:800, color:catColor, flexShrink:0 }}>{m.points?.toLocaleString()} pts</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

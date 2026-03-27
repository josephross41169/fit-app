"use client";
import { useParams } from "next/navigation";
import Link from "next/link";

const C = {
  blue:"#7C3AED", blueLight:"#F3F0FF", blueMid:"#DDD6FE",
  gold:"#F5A623", text:"#1A2B3C", sub:"#5A7A8A", white:"#FFFFFF", bg:"#F8F5FF",
  dark:"#0F1117", darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
};

// Mirror of mock data so stub page shows real event info
const EVENTS: Record<string, { name: string; venue: string; day: string; date: string; emoji: string; category: string; price: string; time: string; }> = {
  "1": { name:"Farmers Market", venue:"Downtown Summerlin", day:"SAT", date:"29", emoji:"🌿", category:"Wellness", price:"Free", time:"8AM–1PM" },
  "2": { name:"Degree Wellness Day Pass", venue:"Degree Wellness · Summerlin", day:"FRI", date:"28", emoji:"🧖", category:"Spa", price:"$35", time:"10AM–6PM" },
  "3": { name:"5K Run & Brunch", venue:"The Strip · Wynn Start", day:"SUN", date:"30", emoji:"🏃", category:"Running", price:"$25", time:"7AM–10AM" },
  "4": { name:"Orangetheory Trial Day", venue:"Orangetheory · Summerlin", day:"THU", date:"27", emoji:"🔥", category:"HIIT", price:"Free", time:"6AM–7PM" },
  "5": { name:"Yoga in the Park", venue:"Sunset Park · Las Vegas", day:"SAT", date:"29", emoji:"🧘", category:"Yoga", price:"Free", time:"8AM–9:30AM" },
  "6": { name:"Bodybuilding Expo", venue:"Las Vegas Convention Ctr", day:"SAT", date:"29", emoji:"🏋️", category:"Expo", price:"$20", time:"9AM–5PM" },
};

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const event = EVENTS[id];

  return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40 }}>
      <div style={{ background:C.white, borderRadius:24, border:`2px solid ${C.blueMid}`, padding:"48px 40px", maxWidth:480, width:"100%", textAlign:"center", boxShadow:"0 8px 32px rgba(124,58,237,0.12)" }}>
        {event ? (<>
          {/* Date badge */}
          <div style={{ width:72, height:72, borderRadius:18, background:"linear-gradient(135deg,#7C3AED,#9333EA)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
            <div style={{ fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.8)", textTransform:"uppercase" }}>{event.day}</div>
            <div style={{ fontSize:30, fontWeight:900, color:"#fff", lineHeight:1 }}>{event.date}</div>
          </div>
          <div style={{ fontSize:32, marginBottom:8 }}>{event.emoji}</div>
          <div style={{ fontWeight:900, fontSize:22, color:C.text, marginBottom:6 }}>{event.name}</div>
          <div style={{ fontSize:14, color:C.sub, marginBottom:6 }}>📍 {event.venue}</div>
          <div style={{ display:"flex", gap:10, justifyContent:"center", marginBottom:24 }}>
            <span style={{ background:"rgba(124,58,237,0.1)", color:"#7C3AED", fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:99, border:"1px solid rgba(124,58,237,0.2)" }}>{event.category}</span>
            <span style={{ background:C.blueLight, color:C.blue, fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:99, border:`1px solid ${C.blueMid}` }}>⏰ {event.time}</span>
            <span style={{ background:"#FFFBEE", color:C.gold, fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:99, border:"1px solid #FFE9A0" }}>{event.price}</span>
          </div>
        </>) : (
          <div style={{ fontSize:14, color:C.sub, marginBottom:24 }}>Event not found.</div>
        )}

        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.blueLight, border:`1.5px solid ${C.blueMid}`, borderRadius:99, padding:"8px 20px", marginBottom:24 }}>
          <span style={{ fontSize:16 }}>🚧</span>
          <span style={{ fontWeight:700, fontSize:13, color:C.blue }}>Full event details coming in beta</span>
        </div>
        <p style={{ fontSize:14, color:C.sub, lineHeight:1.7, marginBottom:28 }}>
          This page will include <strong style={{ color:C.text }}>RSVP, attendee list, map, organizer profile, and comments</strong> once connected to the live database.
        </p>
        <button style={{ width:"100%", padding:"12px", borderRadius:14, background:"linear-gradient(135deg,#7C3AED,#9333EA)", border:"none", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", marginBottom:12 }}>
          RSVP — {event?.price ?? "Free"}
        </button>
        <Link href="/discover" style={{ display:"block", fontSize:13, color:C.sub, textDecoration:"none" }}>← Back to Discovery</Link>
      </div>
    </div>
  );
}

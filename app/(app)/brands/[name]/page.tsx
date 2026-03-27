"use client";
import { useParams } from "next/navigation";
import Link from "next/link";

const C = {
  blue:"#7C3AED", blueLight:"#F3F0FF", blueMid:"#DDD6FE",
  gold:"#F5A623", text:"#1A2B3C", sub:"#5A7A8A", white:"#FFFFFF", bg:"#F8F5FF",
  darkCard:"#1A1D2E", darkBorder:"#2A2D3E", darkSub:"#8892A4",
};

const BRANDS: Record<string, { name:string; emoji:string; category:string; followers:string; color:string; desc:string }> = {
  "gymshark":    { name:"Gymshark",      emoji:"🦈", category:"Activewear", followers:"7.2M", color:"#1A1A1A", desc:"The world's fastest growing fitness apparel brand. Built by athletes, for athletes." },
  "niketraining":{ name:"Nike Training", emoji:"✔️", category:"Footwear & Apparel", followers:"31.5M", color:"#E5000F", desc:"Just Do It. Nike Training content, gear drops, and athlete stories." },
  "dior":        { name:"Dior Fitness",  emoji:"👑", category:"Luxury Activewear", followers:"4.1M", color:"#C9A96E", desc:"Where luxury meets performance. Dior's activewear collections." },
  "lululemon":   { name:"Lululemon",     emoji:"🧘", category:"Activewear", followers:"5.8M", color:"#BE3A34", desc:"Yoga-inspired technical apparel for yoga, running, training, and most other sweaty pursuits." },
  "whoop":       { name:"Whoop",         emoji:"📊", category:"Wearables", followers:"1.3M", color:"#00D4AA", desc:"The fitness wearable that helps you optimize performance, recovery, and sleep." },
};

export default function BrandPage() {
  const { name } = useParams<{ name: string }>();
  const brand = BRANDS[name.toLowerCase()];
  const display = brand?.name ?? name.replace(/-/g," ").replace(/\b\w/g,l=>l.toUpperCase());

  return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40 }}>
      <div style={{ background:C.white, borderRadius:24, border:`2px solid ${C.blueMid}`, padding:"48px 40px", maxWidth:480, width:"100%", textAlign:"center", boxShadow:"0 8px 32px rgba(124,58,237,0.12)" }}>
        {/* Brand icon */}
        <div style={{ width:80, height:80, borderRadius:20, background:brand?.color ?? C.blue, display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, margin:"0 auto 16px" }}>
          {brand?.emoji ?? "🏷️"}
        </div>
        <div style={{ fontWeight:900, fontSize:22, color:C.text, marginBottom:4 }}>{display}</div>
        {brand && <div style={{ fontSize:13, color:C.sub, marginBottom:6 }}>{brand.category} · {brand.followers} followers</div>}
        {brand && <p style={{ fontSize:14, color:C.sub, lineHeight:1.7, marginBottom:20 }}>{brand.desc}</p>}

        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.blueLight, border:`1.5px solid ${C.blueMid}`, borderRadius:99, padding:"8px 20px", marginBottom:24 }}>
          <span style={{ fontSize:16 }}>🚧</span>
          <span style={{ fontWeight:700, fontSize:13, color:C.blue }}>Brand page coming in beta</span>
        </div>
        <p style={{ fontSize:14, color:C.sub, lineHeight:1.7, marginBottom:28 }}>
          This page will show <strong style={{ color:C.text }}>tagged posts, sponsored content, brand challenges, and product links</strong> once connected to the live database.
        </p>
        <button style={{ width:"100%", padding:"12px", borderRadius:14, background:`linear-gradient(135deg,${C.blue},#6D28D9)`, border:"none", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", marginBottom:12 }}>
          + Follow Brand
        </button>
        <Link href="/discover" style={{ display:"block", fontSize:13, color:C.sub, textDecoration:"none" }}>← Back to Discovery</Link>
      </div>
    </div>
  );
}

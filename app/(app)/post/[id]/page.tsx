"use client";
import { useParams } from "next/navigation";
import Link from "next/link";

const C = {
  blue:"#7C3AED", blueLight:"#F3F0FF", blueMid:"#DDD6FE",
  gold:"#F5A623", text:"#1A2B3C", sub:"#5A7A8A", white:"#FFFFFF", bg:"#F8F5FF",
};

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40 }}>
      <div style={{ background:C.white, borderRadius:24, border:`2px solid ${C.blueMid}`, padding:"48px 40px", maxWidth:480, width:"100%", textAlign:"center", boxShadow:"0 8px 32px rgba(124,58,237,0.12)" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📸</div>
        <div style={{ fontWeight:900, fontSize:20, color:C.text, marginBottom:8 }}>Post #{id}</div>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.blueLight, border:`1.5px solid ${C.blueMid}`, borderRadius:99, padding:"8px 20px", marginBottom:24 }}>
          <span style={{ fontSize:16 }}>🚧</span>
          <span style={{ fontWeight:700, fontSize:13, color:C.blue }}>Full post view coming in beta</span>
        </div>
        <p style={{ fontSize:14, color:C.sub, lineHeight:1.7, marginBottom:28 }}>
          This page will show the <strong style={{ color:C.text }}>full post, all comments, likes, tagged users, and activity data</strong> once connected to the live database.
        </p>
        <Link href="/feed" style={{ display:"block", fontSize:13, color:C.sub, textDecoration:"none" }}>← Back to Feed</Link>
      </div>
    </div>
  );
}

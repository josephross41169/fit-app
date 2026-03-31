"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const C = {
  blue: "#16A34A",
  greenLight: "#F0FDF4",
  greenMid: "#BBF7D0",
  gold: "#F5A623",
  text: "#1A2B3C",
  sub: "#5A7A8A",
  white: "#FFFFFF",
  bg: "#F0FDF4",
};

const iStyle = {
  background: C.greenLight,
  border: `1.5px solid ${C.greenMid}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 14,
  color: C.text,
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

export default function PostPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [feedPhoto, setFeedPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [posted, setPosted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function loadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setFeedPhoto(ev.target!.result as string);
    r.readAsDataURL(f);
    e.target.value = "";
  }

  async function uploadPhoto(dataUrl: string): Promise<string | null> {
    try {
      const base64 = dataUrl.split(',')[1];
      const mime = dataUrl.split(';')[0].split(':')[1];
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      const filePath = `${user!.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('posts')
        .upload(filePath, blob, { contentType: mime, upsert: true });
      if (error) return null;
      const { data } = supabase.storage.from('posts').getPublicUrl(filePath);
      return data.publicUrl;
    } catch { return null; }
  }

  async function ensureProfile() {
    if (!user) return false;
    const { data } = await supabase.from('users').select('id').eq('id', user.id).single();
    if (!data) {
      const fallback = (user.email || '').split('@')[0] || 'user';
      const { error } = await supabase.from('users').insert({
        id: user.id,
        username: (user.user_metadata?.username || fallback).toLowerCase().replace(/[^a-z0-9_]/g, ''),
        full_name: user.user_metadata?.full_name || fallback,
      });
      if (error) return false;
    }
    return true;
  }

  async function handlePost() {
    if (!caption.trim() && !feedPhoto) {
      setSaveError("Add a photo or caption before posting.");
      return;
    }
    if (!user) {
      setSaveError("You must be logged in.");
      return;
    }
    setLoading(true);
    setSaveError(null);

    await ensureProfile().catch(() => {});

    let mediaUrl: string | null = null;
    if (feedPhoto) {
      mediaUrl = await uploadPhoto(feedPhoto);
    }

    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        caption: caption || null,
        media_url: mediaUrl,
        media_type: mediaUrl ? 'image' : null,
        post_type: 'general',
        location: location || null,
        is_public: true,
      });
      setLoading(false);
      if (error) {
        setSaveError(error.message || "Something went wrong. Please try again.");
      } else {
        setPosted(true);
      }
    } catch (e: any) {
      setLoading(false);
      setSaveError(e?.message || "Network error.");
    }
  }

  if (posted) {
    setTimeout(() => router.push("/feed"), 1200);
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: 64 }}>🚀</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.blue }}>Posted!</div>
        <div style={{ fontSize: 13, color: C.sub }}>Taking you to the feed...</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: C.white, borderBottom: `2px solid ${C.greenMid}`, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.sub, padding: 0 }}>‹</button>
        <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>New Post</div>
        <button
          onClick={handlePost}
          disabled={loading}
          style={{ background: loading ? C.greenMid : C.blue, border: "none", borderRadius: 20, padding: "8px 20px", color: "#fff", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Posting..." : "Share"}
        </button>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Photo upload */}
        <label style={{ display: "block", cursor: "pointer" }}>
          {feedPhoto ? (
            <div style={{ position: "relative" }}>
              <img src={feedPhoto} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 22, display: "block" }} alt="" />
              <button
                onClick={e => { e.preventDefault(); setFeedPhoto(null); }}
                style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >×</button>
            </div>
          ) : (
            <div style={{ border: `2px dashed ${C.greenMid}`, borderRadius: 22, aspectRatio: "1/1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.greenLight, gap: 12 }}>
              <div style={{ fontSize: 56 }}>📸</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.blue }}>Add Photo</div>
              <div style={{ fontSize: 13, color: C.sub }}>Tap to upload</div>
            </div>
          )}
          <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={loadPhoto} />
        </label>

        {/* Caption */}
        <div style={{ background: C.white, borderRadius: 22, padding: 20, border: `2px solid ${C.greenMid}` }}>
          <textarea
            rows={4}
            style={{ ...iStyle, resize: "none", fontSize: 15 }}
            placeholder="Write a caption... 💪"
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />
          <div style={{ marginTop: 12 }}>
            <input
              style={{ ...iStyle, fontSize: 13 }}
              placeholder="📍 Add location (optional)"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
        </div>

        {saveError && (
          <div style={{ background: "#FEE2E2", border: "1.5px solid #FECACA", borderRadius: 14, padding: "12px 16px", fontSize: 13, color: "#DC2626", fontWeight: 600 }}>
            ⚠️ {saveError}
          </div>
        )}

        <button
          onClick={handlePost}
          disabled={loading}
          style={{ width: "100%", padding: "16px 0", borderRadius: 18, border: "none", background: loading ? C.greenMid : `linear-gradient(135deg,${C.blue},#22C55E)`, color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Posting..." : "Post to Feed 🚀"}
        </button>
      </div>
    </div>
  );
}

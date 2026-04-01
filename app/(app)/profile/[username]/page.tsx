"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import FollowButton from "@/components/FollowButton";

const G = "#16A34A", GL = "#F0FDF4", GM = "#BBF7D0";

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (!user) { setLoading(false); return; }
      setProfile(user);

      const { data: userPosts } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(12);
      setPosts(userPosts || []);

      const { data: userLogs } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_public', true)
        .order('logged_at', { ascending: false })
        .limit(10);
      setLogs(userLogs || []);

      setLoading(false);
    }
    load();
  }, [username]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: GL, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `4px solid ${GM}`, borderTopColor: G, animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!profile) return (
    <div style={{ minHeight: "100vh", background: GL, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div style={{ fontSize: 48 }}>👻</div>
      <h2 style={{ fontWeight: 900, color: "#1A1A1A" }}>User not found</h2>
    </div>
  );

  const initials = profile.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <div style={{ minHeight: "100vh", background: GL, paddingBottom: 80 }}>
      {/* Banner */}
      <div style={{ height: 160, background: `linear-gradient(135deg, ${G}, #22C55E)`, position: "relative", flexShrink: 0 }}>
        {profile.banner_url && <img src={profile.banner_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />}
      </div>

      {/* Header — avatar floats up from below banner */}
      <div style={{ background: "#fff", borderBottom: `2px solid ${GM}`, paddingBottom: 16 }}>
        {/* Avatar row — sits right below banner, overlapping up */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingLeft: 16, paddingRight: 16, marginTop: -44 }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: `linear-gradient(135deg, ${G}, #22C55E)`, border: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900, color: "#fff", overflow: "hidden", flexShrink: 0, zIndex: 2 }}>
            {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : initials}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <FollowButton targetUserId={profile.id} />
            {currentUser && currentUser.id !== profile.id && (
              <button
                onClick={async () => {
                  const res = await fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ action:'create_conversation', payload:{ userId: currentUser.id, otherUserId: profile.id }}) });
                  const json = await res.json();
                  if (json.conversationId) router.push('/messages');
                }}
                style={{ padding:"8px 16px",borderRadius:12,border:`1.5px solid ${G}`,background:"#fff",color:G,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}
              >
                ✉️ Message
              </button>
            )}
          </div>
        </div>
        <h1 style={{ fontWeight: 900, fontSize: 20, color: "#1A1A1A", margin: "12px 0 2px", paddingLeft: 16 }}>{profile.full_name}</h1>
        <p style={{ color: "#6B7280", fontSize: 13, margin: "0 0 8px", paddingLeft: 16 }}>@{profile.username}</p>
        {profile.bio && <p style={{ fontSize: 14, color: "#374151", margin: "0 0 12px", lineHeight: 1.5, paddingLeft: 16 }}>{profile.bio}</p>}
        <div style={{ display: "flex", gap: 24, paddingLeft: 16 }}>
          {[
            { l: "Followers", v: profile.followers_count ?? 0 },
            { l: "Following", v: profile.following_count ?? 0 },
          ].map(s => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: G }}>{s.v}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Posts grid */}
      <div style={{ padding: 16 }}>
        {posts.length > 0 && (
          <div>
            <h3 style={{ fontWeight: 800, fontSize: 14, color: "#374151", marginBottom: 10 }}>Posts</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
              {posts.map(p => (
                <div key={p.id} style={{ aspectRatio: "1", background: GM, borderRadius: 8, overflow: "hidden" }}>
                  {p.media_url
                    ? <img src={p.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${G}22, ${G}11)` }}>
                        <span style={{ fontSize: 24 }}>{p.post_type === "workout" ? "💪" : p.post_type === "nutrition" ? "🥗" : "🌿"}</span>
                      </div>
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {logs.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontWeight: 800, fontSize: 14, color: "#374151", marginBottom: 10 }}>Recent Activity</h3>
            {logs.map(log => (
              <div key={log.id} style={{ background: "#fff", borderRadius: 16, border: `2px solid ${GM}`, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: log.log_type === "wellness" ? "#F3F0FF" : GL }}>
                    {log.log_type === "workout" ? "💪" : log.log_type === "nutrition" ? "🥗" : "🌿"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>
                      {log.workout_type || log.meal_type || log.wellness_type || log.log_type}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>
                      {log.workout_duration_min ? `${log.workout_duration_min} min` : ""}
                      {log.workout_calories ? ` · ${log.workout_calories} cal` : ""}
                      {log.calories_total ? `${log.calories_total} kcal` : ""}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF" }}>
                    {new Date(log.logged_at).toLocaleDateString()}
                  </div>
                </div>
                {log.notes && <p style={{ fontSize: 13, color: "#6B7280", margin: "8px 0 0", lineHeight: 1.5 }}>{log.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {posts.length === 0 && logs.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#9CA3AF" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>💪</div>
            <p style={{ fontWeight: 700 }}>No public activity yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const C = {
  purple: "#7C3AED",
  purpleDark: "#6D28D9",
  purpleLight: "#F3F0FF",
  purpleMid: "#DDD6FE",
  gold: "#F5A623",
  bg: "#0F1117",
  card: "#1A1D2E",
  border: "#2A2D3E",
  text: "#E2E8F0",
  sub: "#8892A4",
  red: "#EF4444",
};

type NotifType = "like_post" | "like_activity" | "follow" | "comment_post" | "comment_activity" | "badge";

interface Notif {
  id: string;
  type: NotifType;
  actor_id: string | null;
  actor_name: string;
  actor_username: string;
  actor_avatar: string | null;
  target_id: string | null;
  target_preview: string | null;
  created_at: string;
  read_at: string | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      <img src={url} alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    );
  }
  const initials = name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: C.purple,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: size * 0.35, flexShrink: 0,
    }}>{initials}</div>
  );
}

function NotifIcon({ type }: { type: NotifType }) {
  const map: Record<NotifType, string> = {
    like_post: "❤️",
    like_activity: "💪",
    follow: "➕",
    comment_post: "💬",
    comment_activity: "💬",
    badge: "🏅",
  };
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: type === "follow" ? C.purple : type === "badge" ? C.gold : "#2A2D3E",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, flexShrink: 0, marginLeft: -10, marginTop: 22,
      border: `2px solid ${C.bg}`,
    }}>
      {map[type]}
    </div>
  );
}

function notifText(n: Notif): string {
  switch (n.type) {
    case "like_post": return "liked your post";
    case "like_activity": return "liked your activity";
    case "follow": return "started following you";
    case "comment_post": return "commented on your post";
    case "comment_activity": return "commented on your activity";
    case "badge": return `earned a badge: ${n.target_preview || "🏅"}`;
    case "mention": return "mentioned you";
    case "tag": return "tagged you in a post";
    case "buddy_matched": return "matched with you as a workout buddy";
    default: return "interacted with you";
  }
}

// ── Static fallback notifications (shown when no DB notifs yet) ──────────────
const STATIC_NOTIFS: Notif[] = [
  { id: "s1", type: "follow", actor_id: null, actor_name: "Alexis Rivera", actor_username: "alexis_fit",
    actor_avatar: null, target_id: null, target_preview: null,
    created_at: new Date(Date.now() - 3_600_000).toISOString(), read_at: null },
  { id: "s2", type: "like_post", actor_id: null, actor_name: "Jordan Kim", actor_username: "jordan_gains",
    actor_avatar: null, target_id: null, target_preview: null,
    created_at: new Date(Date.now() - 7_200_000).toISOString(), read_at: null },
  { id: "s3", type: "comment_post", actor_id: null, actor_name: "Maya Torres", actor_username: "maya_moves",
    actor_avatar: null, target_id: null, target_preview: "This is inspiring! 🔥",
    created_at: new Date(Date.now() - 14_400_000).toISOString(), read_at: "1" },
  { id: "s4", type: "like_activity", actor_id: null, actor_name: "Chris Wallace", actor_username: "chris_power",
    actor_avatar: null, target_id: null, target_preview: null,
    created_at: new Date(Date.now() - 86_400_000).toISOString(), read_at: "1" },
  { id: "s5", type: "badge", actor_id: null, actor_name: "FIT", actor_username: "fit",
    actor_avatar: null, target_id: null, target_preview: "First Workout 🏋️",
    created_at: new Date(Date.now() - 172_800_000).toISOString(), read_at: "1" },
];

type FilterTab = "all" | "follows" | "likes" | "comments";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [useStatic, setUseStatic] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Try to query the notifications table — if it doesn't exist yet, use static
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60);

      if (error) {
        // Table might not exist yet — fall back to static demo data
        setUseStatic(true);
        setNotifs(STATIC_NOTIFS);
      } else if (!data || data.length === 0) {
        // Empty — show static demo so the page isn't barren
        setUseStatic(true);
        setNotifs(STATIC_NOTIFS);
      } else {
        setUseStatic(false);
        setNotifs(data as Notif[]);
      }
    } catch {
      setUseStatic(true);
      setNotifs(STATIC_NOTIFS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Mark all as read when page opens
  useEffect(() => {
    if (!user || useStatic) return;
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", user.id)
      .is("read_at", null)
      .then(() => {});
  }, [user, useStatic]);

  const filtered = notifs.filter(n => {
    if (filter === "all") return true;
    if (filter === "follows") return n.type === "follow";
    if (filter === "likes") return n.type === "like_post" || n.type === "like_activity";
    if (filter === "comments") return n.type === "comment_post" || n.type === "comment_activity";
    return true;
  });

  const unreadCount = notifs.filter(n => !n.read_at).length;

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "follows", label: "Follows" },
    { key: "likes", label: "Likes" },
    { key: "comments", label: "Comments" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        background: C.bg, borderBottom: `1px solid ${C.border}`,
        padding: "20px 20px 0", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text }}>🔔 Notifications</h1>
            {unreadCount > 0 && (
              <div style={{
                background: C.purple, color: "#fff", borderRadius: 12,
                padding: "2px 8px", fontSize: 12, fontWeight: 800,
              }}>{unreadCount}</div>
            )}
          </div>
          {useStatic && (
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.sub, background: C.card,
              borderRadius: 8, padding: "3px 8px", border: `1px solid ${C.border}`,
            }}>DEMO</div>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 12 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)} style={{
              padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
              background: filter === t.key ? C.purple : C.card,
              color: filter === t.key ? "#fff" : C.sub,
              transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 0 20px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: `3px solid ${C.border}`, borderTopColor: C.purple,
              animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 20px", color: C.sub }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🔔</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
              No notifications yet
            </div>
            <div style={{ fontSize: 14 }}>When people like, comment, or follow you — it shows up here.</div>
          </div>
        ) : (
          <>
            {/* Group: Today */}
            {filtered.some(n => Date.now() - new Date(n.created_at).getTime() < 86_400_000) && (
              <div>
                <div style={{ padding: "16px 20px 8px", fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 1 }}>Today</div>
                {filtered
                  .filter(n => Date.now() - new Date(n.created_at).getTime() < 86_400_000)
                  .map(n => <NotifRow key={n.id} notif={n} />)}
              </div>
            )}
            {/* Group: Earlier */}
            {filtered.some(n => Date.now() - new Date(n.created_at).getTime() >= 86_400_000) && (
              <div>
                <div style={{ padding: "16px 20px 8px", fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 1 }}>Earlier</div>
                {filtered
                  .filter(n => Date.now() - new Date(n.created_at).getTime() >= 86_400_000)
                  .map(n => <NotifRow key={n.id} notif={n} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NotifRow({ notif: n }: { notif: Notif }) {
  const isUnread = !n.read_at;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 20px",
      background: isUnread ? "rgba(124,58,237,0.06)" : "transparent",
      borderBottom: `1px solid ${C.border}`,
      transition: "background 0.15s",
      cursor: "pointer",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,58,237,0.1)")}
      onMouseLeave={e => (e.currentTarget.style.background = isUnread ? "rgba(124,58,237,0.06)" : "transparent")}
    >
      {/* Avatar + type icon */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar name={n.actor_name} url={n.actor_avatar} size={46} />
        <div style={{ position: "absolute", bottom: -4, right: -4 }}>
          <NotifIcon type={n.type} />
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.4 }}>
          <span style={{ fontWeight: 800 }}>{n.actor_name}</span>
          {" "}
          <span style={{ color: C.sub }}>{notifText(n)}</span>
          {n.target_preview && n.type !== "badge" && (
            <span style={{ color: C.sub }}>{" "}· "{n.target_preview}"</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{timeAgo(n.created_at)}</div>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.purple, flexShrink: 0 }} />
      )}

      {/* Follow back button */}
      {n.type === "follow" && (
        <button style={{
          padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${C.purple}`,
          background: "transparent", color: C.purple, fontWeight: 700, fontSize: 12,
          cursor: "pointer", flexShrink: 0,
        }}>
          Follow
        </button>
      )}
    </div>
  );
}


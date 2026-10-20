"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FollowButton from "@/components/FollowButton";
import { notifHref } from "@/lib/notifLinks";
import { clearUnreadNotifs } from "@/lib/useUnreadCounts";

const C = {
  purple: "#1F5F3F",
  purpleDark: "#3E9E74",
  purpleLight: "#EFF7F2",
  purpleMid: "#C9E8D8",
  gold: "#F5A623",
  bg: "#0F1117",
  card: "#161D19",
  border: "#232C27",
  text: "#E2E8F0",
  sub: "#8892A4",
  red: "#EF4444",
};

type NotifType = "like_post" | "like_activity" | "follow" | "comment_post" | "comment_activity" | "badge" | string;

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
  /** Text stored with the notification ("Sam tagged you in a post"). */
  body?: string | null;
  /** The raw row from the API, used to work out where a tap should go. */
  raw?: any;
}

// Rows from /api/db get_notifications use the table's real columns
// (user_id, from_user_id, type, reference_id, body, read). Convert them into
// the shape this page renders.
function fromApiRow(r: any): Notif {
  const ref = r.reference_id ? String(r.reference_id) : "";
  const onCard = ref.includes("__"); // activity-card ids look like "<userId>__MM/DD/YYYY"
  let type: string = r.type;
  if (type === "like") type = onCard ? "like_activity" : "like_post";
  else if (type === "comment" || type === "reply") type = onCard ? "comment_activity" : "comment_post";
  else if (type === "activity_comment") type = "comment_activity";
  const fu = r.from_user || {};
  return {
    id: r.id,
    type,
    actor_id: r.from_user_id || null,
    actor_name: fu.full_name || fu.username || "Livelee",
    actor_username: fu.username || "",
    actor_avatar: fu.avatar_url || null,
    target_id: ref || null,
    target_preview: null,
    created_at: r.created_at,
    read_at: r.read ? r.created_at : null,
    body: r.body || null,
    raw: r,
  };
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
  const map: Record<string, string> = {
    tag: "🏷️",
    mention: "@",
    message: "✉️",
    reply: "💬",
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
      background: type === "follow" ? C.purple : type === "badge" ? C.gold : "#232C27",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, flexShrink: 0, marginLeft: -10, marginTop: 22,
      border: `2px solid ${C.bg}`,
    }}>
      {map[type] || "🔔"}
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
    case "reply": return "replied to your comment";
    case "message": return "sent you a message";
    default: {
      // Unknown types: show the stored text, minus the sender's name if it
      // starts with it (the name is already printed in bold before this).
      const b = (n.body || "").trim();
      if (b && n.actor_name && b.startsWith(n.actor_name)) return b.slice(n.actor_name.length).trim();
      return b || "interacted with you";
    }
  }
}


type FilterTab = "all" | "follows" | "likes" | "comments";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Same API the bell badge uses. (This page used to query columns
      // named recipient_id / read_at, which don't exist on the table, so it
      // always came back empty.)
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_notifications", payload: { userId: user.id } }),
      });
      const json = await res.json().catch(() => ({}));
      const rows: any[] = Array.isArray(json?.notifications) ? json.notifications : [];
      setNotifs(rows.map(fromApiRow));
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Mark all as read when the page opens (unread dots still show for this
  // visit because they were loaded before the update).
  useEffect(() => {
    if (!user) return;
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_notifications_read", payload: { userId: user.id } }),
    }).then(() => clearUnreadNotifs()).catch(() => {});
  }, [user]);

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
        padding: "20px 20px 0", position: "sticky", top: "var(--safe-top)", zIndex: 10,
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
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", rowGap: 6, paddingBottom: 12 }}>
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
  const router = useRouter();
  const { user } = useAuth();
  const open = async () => {
    const href = await notifHref(n.raw, user?.id);
    if (href) router.push(href);
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 20px",
      background: isUnread ? "rgba(46,125,84,0.10)" : "transparent",
      borderBottom: `1px solid ${C.border}`,
      transition: "background 0.15s",
      cursor: "pointer",
    }}
      onClick={open}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(46,125,84,0.14)")}
      onMouseLeave={e => (e.currentTarget.style.background = isUnread ? "rgba(46,125,84,0.10)" : "transparent")}
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

      {/* Follow back — real button (shows "Following ✓" if you already do) */}
      {n.type === "follow" && n.actor_id && (
        <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <FollowButton targetUserId={n.actor_id} size="sm" />
        </div>
      )}
    </div>
  );
}


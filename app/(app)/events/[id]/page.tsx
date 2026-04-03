"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const MOCK_EVENTS: Record<string, any> = {
  "1": {
    name: "Farmers Market",
    location: "Downtown Summerlin",
    emoji: "🌿",
    category: "Wellness",
    price: "Free",
    event_date: null,
    description:
      "Weekly farmers market with fresh produce, local vendors, and wellness products. Family friendly!",
    rsvp_count: 142,
  },
  "2": {
    name: "Degree Wellness Day Pass",
    location: "Degree Wellness · Summerlin",
    emoji: "🧖",
    category: "Spa",
    price: "$35",
    event_date: null,
    description:
      "Full day access to Degree Wellness facilities. Includes sauna, cold plunge, and relaxation areas.",
    rsvp_count: 28,
  },
  "3": {
    name: "5K Run & Brunch",
    location: "The Strip · Wynn Start",
    emoji: "🏃",
    category: "Running",
    price: "$25",
    event_date: null,
    description:
      "Scenic 5K run along the Las Vegas Strip followed by a group brunch. All paces welcome!",
    rsvp_count: 87,
  },
  "4": {
    name: "Orangetheory Trial Day",
    location: "Orangetheory · Summerlin",
    emoji: "🔥",
    category: "HIIT",
    price: "Free",
    event_date: null,
    description:
      "Free trial class at Orangetheory Fitness. High-intensity interval training for all fitness levels.",
    rsvp_count: 34,
  },
  "5": {
    name: "Yoga in the Park",
    location: "Sunset Park · Las Vegas",
    emoji: "🧘",
    category: "Yoga",
    price: "Free",
    event_date: null,
    description:
      "Community yoga session in the park. Bring your own mat. All levels welcome, mats available for beginners.",
    rsvp_count: 63,
  },
  "6": {
    name: "Bodybuilding Expo",
    location: "Las Vegas Convention Ctr",
    emoji: "🏋️",
    category: "Expo",
    price: "$20",
    event_date: null,
    description:
      "Annual bodybuilding and fitness expo. Meet top athletes, discover new supplements, and watch live competitions.",
    rsvp_count: 412,
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date TBD";
  const d = new Date(dateStr);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const dayName = days[d.getDay()];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes > 0 ? `:${String(minutes).padStart(2, "0")}` : "";
  return `${dayName}, ${month} ${day} · ${displayHours}${displayMinutes} ${ampm}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function Avatar({
  user,
  size = 40,
}: {
  user: { full_name?: string; username?: string; avatar_url?: string | null };
  size?: number;
}) {
  const name = user?.full_name || user?.username || "U";
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #16A34A, #0D9043)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rsvped, setRsvped] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidRegex.test(id)) {
        const { data: ev } = await supabase
          .from("group_events")
          .select(
            "*, groups(id, name, category, emoji, banner_url, slug, created_by, creator_id)"
          )
          .eq("id", id)
          .single();

        if (ev) {
          setEvent(ev);
          setRsvpCount(ev.rsvp_count || 0);

          const { data: rsvps } = await supabase
            .from("group_event_rsvps")
            .select("*, users(id, full_name, username, avatar_url)")
            .eq("event_id", id)
            .limit(20);
          setAttendees(rsvps || []);

          if (user) {
            const already = (rsvps || []).find(
              (r: any) => r.user_id === user.id
            );
            setRsvped(!!already);
          }

          const { data: coms } = await supabase
            .from("group_event_comments")
            .select("*, users(id, full_name, username, avatar_url)")
            .eq("event_id", id)
            .order("created_at", { ascending: true });
          setComments(coms || []);

          setLoading(false);
          return;
        }
      }

      // Fallback: mock data
      if (MOCK_EVENTS[id]) {
        setEvent(MOCK_EVENTS[id]);
        setRsvpCount(MOCK_EVENTS[id].rsvp_count || 0);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  async function handleRSVP() {
    if (rsvped || !currentUser) return;
    setRsvped(true);
    setRsvpCount((c) => c + 1);
    await supabase
      .from("group_event_rsvps")
      .insert({ event_id: id, user_id: currentUser.id })
      .catch(() => {});
    await supabase
      .from("group_events")
      .update({ rsvp_count: rsvpCount + 1 })
      .eq("id", id)
      .catch(() => {});
  }

  async function postComment() {
    if (!commentText.trim() || !currentUser || posting) return;
    setPosting(true);
    const text = commentText.trim();
    setCommentText("");
    setComments((prev) => [
      ...prev,
      {
        id: Date.now(),
        content: text,
        created_at: new Date().toISOString(),
        users: {
          full_name:
            currentUser.user_metadata?.full_name || "You",
          username: currentUser.email,
          avatar_url: null,
        },
      },
    ]);
    await supabase
      .from("group_event_comments")
      .insert({ event_id: id, user_id: currentUser.id, content: text })
      .catch(() => {});
    setPosting(false);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0D0D0D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "3px solid #2A2A2A",
              borderTopColor: "#16A34A",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "#555", fontSize: 14 }}>Loading event…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Not Found ────────────────────────────────────────────────────────────
  if (!event) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0D0D0D",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 64 }}>🔍</div>
        <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 22, margin: 0 }}>
          Event not found
        </h2>
        <p style={{ color: "#666", margin: 0 }}>
          This event may have been removed or doesn&apos;t exist.
        </p>
        <button
          onClick={() => router.back()}
          style={{
            marginTop: 8,
            padding: "10px 24px",
            background: "#16A34A",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Go Back
        </button>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const group = event.groups || null;
  const bannerUrl = group?.banner_url || null;
  const emoji = event.emoji || group?.emoji || "🎯";
  const category = event.category || group?.category || "";
  const price = event.price || "Free";
  const isFree = price === "Free" || price === "free" || price === "$0";
  const displayedAttendees = attendees.slice(0, 8);
  const extraAttendees = attendees.length > 8 ? attendees.length - 8 : 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", color: "#fff" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        textarea:focus, input:focus { outline: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0D0D0D; }
        ::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 3px; }
        .rsvp-btn:hover:not(:disabled) { background: #15803D !important; transform: translateY(-1px); }
        .rsvp-btn:disabled { opacity: 0.7; cursor: default; }
        .back-btn:hover { background: rgba(255,255,255,0.2) !important; }
        .comment-post-btn:hover:not(:disabled) { background: #15803D !important; }
        .comment-post-btn:disabled { opacity: 0.5; cursor: default; }
        .view-group-btn:hover { background: #1A1A1A !important; }
        @media (max-width: 768px) {
          .layout-cols { flex-direction: column !important; }
          .right-col { width: 100% !important; }
        }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          height: 280,
          overflow: "hidden",
          background: bannerUrl
            ? undefined
            : "linear-gradient(135deg, #0D1F0D, #1A3A1A)",
        }}
      >
        {bannerUrl && (
          <>
            <img
              src={bannerUrl}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.65)",
              }}
            />
          </>
        )}

        {/* Back button */}
        <button
          className="back-btn"
          onClick={() => router.back()}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            background: "rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            color: "#fff",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            transition: "background 0.2s",
          }}
        >
          ← Back
        </button>

        {/* Category badge */}
        {category && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 10,
              background: "rgba(22,163,74,0.25)",
              border: "1px solid rgba(22,163,74,0.5)",
              borderRadius: 20,
              color: "#4ADE80",
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.05em",
              backdropFilter: "blur(8px)",
            }}
          >
            {category}
          </div>
        )}

        {/* Emoji centered */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 80,
            filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.5))",
          }}
        >
          {emoji}
        </div>
      </div>

      {/* ── EVENT HEADER CARD ─────────────────────────────────────────────── */}
      <div
        style={{
          margin: "0 auto",
          maxWidth: 960,
          padding: "0 16px",
        }}
      >
        <div
          style={{
            background: "#1A1A1A",
            border: "1px solid #2A2A2A",
            borderRadius: 16,
            padding: "24px",
            marginTop: -24,
            position: "relative",
            zIndex: 5,
          }}
        >
          {/* Title row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 900,
                  color: "#fff",
                  lineHeight: 1.2,
                  wordBreak: "break-word",
                }}
              >
                {event.name}
              </h1>
              {/* Date */}
              <p style={{ margin: "6px 0 0", color: "#A3A3A3", fontSize: 14 }}>
                📅 {formatDate(event.event_date || event.starts_at || null)}
              </p>
              {/* Location */}
              {event.location && (
                <p style={{ margin: "4px 0 0", color: "#A3A3A3", fontSize: 14 }}>
                  📍 {event.location}
                </p>
              )}
            </div>
            {/* Price badge */}
            <div
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                background: isFree
                  ? "rgba(22,163,74,0.2)"
                  : "rgba(245,166,35,0.15)",
                border: `1px solid ${isFree ? "rgba(22,163,74,0.5)" : "rgba(245,166,35,0.4)"}`,
                color: isFree ? "#4ADE80" : "#F5A623",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {price}
            </div>
          </div>

          {/* Stat pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                padding: "6px 14px",
                background: "#242424",
                border: "1px solid #2A2A2A",
                borderRadius: 20,
                fontSize: 13,
                color: "#ccc",
              }}
            >
              👥 {rsvpCount} going
            </div>
            {(event.duration_minutes || event.duration) && (
              <div
                style={{
                  padding: "6px 14px",
                  background: "#242424",
                  border: "1px solid #2A2A2A",
                  borderRadius: 20,
                  fontSize: 13,
                  color: "#ccc",
                }}
              >
                ⏰{" "}
                {event.duration_minutes
                  ? `${event.duration_minutes} min`
                  : event.duration}
              </div>
            )}
            <div
              style={{
                padding: "6px 14px",
                background: "#242424",
                border: "1px solid #2A2A2A",
                borderRadius: 20,
                fontSize: 13,
                color: "#ccc",
              }}
            >
              💰 {price}
            </div>
          </div>
        </div>

        {/* ── TWO-COLUMN LAYOUT ────────────────────────────────────────────── */}
        <div
          className="layout-cols"
          style={{
            display: "flex",
            gap: 20,
            marginTop: 20,
            paddingBottom: 40,
            alignItems: "flex-start",
          }}
        >
          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* About card */}
            <div
              style={{
                background: "#1A1A1A",
                border: "1px solid #2A2A2A",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                📖 About
              </h2>
              {event.description ? (
                <p
                  style={{
                    margin: 0,
                    color: "#C4C4C4",
                    fontSize: 15,
                    lineHeight: 1.7,
                  }}
                >
                  {event.description}
                </p>
              ) : (
                <p style={{ margin: 0, color: "#555", fontSize: 14, fontStyle: "italic" }}>
                  No description provided.
                </p>
              )}

              {/* Group info */}
              {group && (
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 20,
                    borderTop: "1px solid #2A2A2A",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: 12,
                      color: "#666",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                    }}
                  >
                    Hosted by
                  </p>
                  <Link
                    href={`/groups/${group.slug || group.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      textDecoration: "none",
                      padding: "10px 16px",
                      background: "#222",
                      border: "1px solid #2A2A2A",
                      borderRadius: 12,
                      transition: "border-color 0.2s",
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{group.emoji || "🏋️"}</span>
                    <div>
                      <p
                        style={{
                          margin: 0,
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 15,
                        }}
                      >
                        {group.name}
                      </p>
                      {group.category && (
                        <p style={{ margin: 0, color: "#16A34A", fontSize: 12 }}>
                          {group.category}
                        </p>
                      )}
                    </div>
                    <span style={{ color: "#555", marginLeft: "auto", fontSize: 16 }}>→</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Comments section */}
            <div
              style={{
                background: "#1A1A1A",
                border: "1px solid #2A2A2A",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <h2
                style={{
                  margin: "0 0 20px",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                💬 Comments{" "}
                <span style={{ color: "#555", fontWeight: 400, fontSize: 15 }}>
                  ({comments.length})
                </span>
              </h2>

              {comments.length === 0 && (
                <p
                  style={{
                    color: "#555",
                    fontSize: 14,
                    fontStyle: "italic",
                    margin: "0 0 20px",
                  }}
                >
                  No comments yet. Be the first to say something!
                </p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
                {comments.map((c: any) => (
                  <div
                    key={c.id}
                    style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
                  >
                    <Avatar user={c.users || {}} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#e0e0e0",
                          }}
                        >
                          {c.users?.full_name || c.users?.username || "User"}
                        </span>
                        <span style={{ fontSize: 11, color: "#555" }}>
                          {timeAgo(c.created_at)}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          color: "#C0C0C0",
                          fontSize: 14,
                          lineHeight: 1.6,
                          wordBreak: "break-word",
                        }}
                      >
                        {c.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment input */}
              {currentUser ? (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <Avatar
                    user={{
                      full_name: currentUser.user_metadata?.full_name,
                      username: currentUser.email,
                      avatar_url: currentUser.user_metadata?.avatar_url,
                    }}
                    size={36}
                  />
                  <div style={{ flex: 1, position: "relative" }}>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          postComment();
                        }
                      }}
                      placeholder="Write a comment…"
                      rows={2}
                      style={{
                        width: "100%",
                        background: "#222",
                        border: "1px solid #333",
                        borderRadius: 12,
                        color: "#fff",
                        fontSize: 14,
                        padding: "10px 80px 10px 14px",
                        resize: "none",
                        fontFamily: "inherit",
                        lineHeight: 1.5,
                      }}
                    />
                    <button
                      className="comment-post-btn"
                      onClick={postComment}
                      disabled={posting || !commentText.trim()}
                      style={{
                        position: "absolute",
                        right: 8,
                        bottom: 8,
                        padding: "6px 14px",
                        background: "#16A34A",
                        border: "none",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                    >
                      {posting ? "…" : "Post"}
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ color: "#555", fontSize: 13, margin: 0 }}>
                  <Link href="/auth/login" style={{ color: "#16A34A" }}>
                    Log in
                  </Link>{" "}
                  to leave a comment.
                </p>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
          <div
            className="right-col"
            style={{
              width: 300,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* RSVP card */}
            <div
              style={{
                background: "#1A1A1A",
                border: "1px solid #2A2A2A",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <button
                className="rsvp-btn"
                onClick={handleRSVP}
                disabled={rsvped || !currentUser}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: rsvped ? "#14532D" : "#16A34A",
                  border: rsvped ? "2px solid #16A34A" : "2px solid #16A34A",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: rsvped ? "default" : "pointer",
                  transition: "all 0.2s",
                  letterSpacing: "0.01em",
                }}
              >
                {rsvped ? "✓ RSVP'd" : `RSVP — ${price}`}
              </button>

              <p
                style={{
                  margin: "12px 0 0",
                  textAlign: "center",
                  color: "#888",
                  fontSize: 13,
                }}
              >
                {rsvpCount} {rsvpCount === 1 ? "person" : "people"} going
              </p>

              {!currentUser && (
                <p
                  style={{
                    margin: "8px 0 0",
                    textAlign: "center",
                    color: "#555",
                    fontSize: 12,
                  }}
                >
                  <Link href="/auth/login" style={{ color: "#16A34A" }}>
                    Sign in
                  </Link>{" "}
                  to RSVP
                </p>
              )}
            </div>

            {/* Attendees card */}
            {attendees.length > 0 && (
              <div
                style={{
                  background: "#1A1A1A",
                  border: "1px solid #2A2A2A",
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 14px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  👥 Going ({attendees.length})
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 8,
                  }}
                >
                  {displayedAttendees.map((r: any, i: number) => (
                    <div
                      key={r.id || i}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                      title={r.users?.full_name || r.users?.username || "User"}
                    >
                      <Avatar user={r.users || {}} size={48} />
                      <span
                        style={{
                          fontSize: 10,
                          color: "#777",
                          textAlign: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          width: "100%",
                        }}
                      >
                        {(r.users?.full_name || r.users?.username || "").split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
                {extraAttendees > 0 && (
                  <p
                    style={{
                      margin: "12px 0 0",
                      color: "#16A34A",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    + {extraAttendees} more
                  </p>
                )}
              </div>
            )}

            {/* Organizer card */}
            {group && (
              <div
                style={{
                  background: "#1A1A1A",
                  border: "1px solid #2A2A2A",
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 14px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  🎯 Organizer
                </h3>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #16A34A, #0D9043)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      flexShrink: 0,
                    }}
                  >
                    {group.emoji || "🏋️"}
                  </div>
                  <div>
                    <p style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 15 }}>
                      {group.name}
                    </p>
                    <p style={{ margin: 0, color: "#16A34A", fontSize: 12 }}>
                      Event Organizer
                    </p>
                  </div>
                </div>
                <Link
                  href={`/groups/${group.slug || group.id}`}
                  className="view-group-btn"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px",
                    background: "#222",
                    border: "1px solid #333",
                    borderRadius: 10,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "center",
                    textDecoration: "none",
                    transition: "background 0.2s",
                  }}
                >
                  View Group →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

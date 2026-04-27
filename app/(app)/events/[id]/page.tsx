"use client";
// ── app/(app)/events/[id]/page.tsx ─────────────────────────────────────────
// Event detail page. Loads from public.events_with_counts view. Lets users:
//   - RSVP (going / interested / clear)
//   - Comment (with threaded replies)
//   - View attendee list
//   - Open address in Maps
//
// Owner sees a "Delete" option. Comments support threaded replies.

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getEventCategory, getEventSubcategory, formatEventCategory } from "@/lib/eventCategories";

interface EventDetail {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  event_date: string;
  end_date: string | null;
  date_tbd: boolean;
  location_name: string | null;
  address: string | null;
  city: string | null;
  price: string;
  image_url: string | null;
  max_attendees: number | null;
  going_count: number;
  interested_count: number;
  comments_count: number;
  source: string;
  external_url: string | null;
}

interface Comment {
  id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  users: { username: string; full_name: string; avatar_url: string | null };
}

type RsvpStatus = "going" | "interested" | null;

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [myRsvp, setMyRsvp] = useState<RsvpStatus>(null);
  const [updating, setUpdating] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);

  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [attendees, setAttendees] = useState<any[]>([]);

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("events_with_counts")
      .select("*")
      .eq("id", eventId)
      .single();
    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // If this event is pending approval (approved=false), only the creator
    // and the group owner can view it. Hide from everyone else by 404'ing.
    if (data.approved === false) {
      const isCreator = user?.id && data.creator_id === user.id;
      let isGroupOwner = false;
      if (data.group_id && user?.id) {
        const { data: g } = await supabase
          .from("groups")
          .select("created_by")
          .eq("id", data.group_id)
          .single();
        isGroupOwner = !!g && g.created_by === user.id;
      }
      if (!isCreator && !isGroupOwner) {
        setNotFound(true);
        setLoading(false);
        return;
      }
    }

    setEvent(data);

    // Load creator profile
    const { data: cp } = await supabase
      .from("users")
      .select("username, full_name, avatar_url, account_type")
      .eq("id", data.creator_id)
      .single();
    setCreatorProfile(cp);

    setLoading(false);
  }, [eventId, user?.id]);

  const loadRsvp = useCallback(async () => {
    if (!user || !eventId) return;
    const { data } = await supabase
      .from("event_rsvps")
      .select("status")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();
    setMyRsvp((data?.status as RsvpStatus) || null);
  }, [user, eventId]);

  const loadComments = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("event_comments")
      .select("*, users:user_id(username, full_name, avatar_url)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    setComments(data || []);
  }, [eventId]);

  useEffect(() => { loadEvent(); }, [loadEvent]);
  useEffect(() => { loadRsvp(); }, [loadRsvp]);
  useEffect(() => { loadComments(); }, [loadComments]);

  // ── RSVP toggle ────────────────────────────────────────────────────────
  async function setRsvp(status: RsvpStatus) {
    if (!user || updating) return;
    setUpdating(true);
    try {
      if (status === null) {
        // Clear RSVP
        await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id);
      } else if (myRsvp === null) {
        // New RSVP
        await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: user.id, status });
      } else {
        // Update existing
        await supabase.from("event_rsvps").update({ status }).eq("event_id", eventId).eq("user_id", user.id);
      }
      setMyRsvp(status);
      // Reload counts
      loadEvent();
    } finally {
      setUpdating(false);
    }
  }

  // ── Comment posting ────────────────────────────────────────────────────
  async function postComment(parentId: string | null, content: string) {
    if (!user || posting || !content.trim()) return;
    setPosting(true);
    try {
      await supabase.from("event_comments").insert({
        event_id: eventId,
        user_id: user.id,
        parent_id: parentId,
        content: content.trim(),
      });
      if (parentId) {
        setReplyText("");
        setReplyTo(null);
      } else {
        setNewComment("");
      }
      await loadComments();
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!user) return;
    const ok = window.confirm("Delete this comment?");
    if (!ok) return;
    await supabase.from("event_comments").delete().eq("id", commentId).eq("user_id", user.id);
    await loadComments();
  }

  // ── Delete event (creator only) ────────────────────────────────────────
  async function deleteEvent() {
    if (!user || !event || event.creator_id !== user.id) return;
    const ok = window.confirm(`Delete "${event.title}"? This cannot be undone.`);
    if (!ok) return;
    await supabase.from("events").delete().eq("id", event.id);
    router.push("/events");
  }

  // ── Attendees modal ────────────────────────────────────────────────────
  async function openAttendees() {
    setAttendeesOpen(true);
    if (attendees.length > 0) return;
    const { data } = await supabase
      .from("event_rsvps")
      .select("status, users:user_id(id, username, full_name, avatar_url)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    setAttendees(data || []);
  }

  if (loading) return <FullPageMessage>Loading event...</FullPageMessage>;
  if (notFound || !event) return <FullPageMessage>Event not found.</FullPageMessage>;

  const cat = getEventCategory(event.category);
  const sub = getEventSubcategory(event.category, event.subcategory);
  const date = new Date(event.event_date);
  const endDate = event.end_date ? new Date(event.end_date) : null;
  const isOwner = user?.id === event.creator_id;
  const dateLabel = event.date_tbd
    ? "Date TBD"
    : date.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeLabel = event.date_tbd
    ? ""
    : date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" }) +
      (endDate ? ` – ${endDate.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}` : "");

  // Build comment tree (top-level + replies)
  const topLevel = comments.filter(c => !c.parent_id);
  const replyMap: Record<string, Comment[]> = {};
  comments.filter(c => c.parent_id).forEach(c => {
    if (!replyMap[c.parent_id!]) replyMap[c.parent_id!] = [];
    replyMap[c.parent_id!].push(c);
  });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: 80 }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px 16px" }}>
        <Link href="/events" style={{ color: "#A78BFA", textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-block", marginBottom: 14 }}>
          ← Back
        </Link>

        {/* Hero */}
        <div style={{
          width: "100%", aspectRatio: "16/9",
          background: event.image_url
            ? `url(${event.image_url}) center/cover`
            : "linear-gradient(135deg, #7C3AED, #A78BFA)",
          borderRadius: 18, marginBottom: 20, position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%)" }} />
          <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 8 }}>
            <span style={{ background: "rgba(0,0,0,0.7)", padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, color: "#fff" }}>
              {cat.emoji} {cat.label}{sub && ` · ${sub.label}`}
            </span>
            <span style={{ background: event.price === "Free" ? "#16A34A" : "rgba(0,0,0,0.7)", padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 800, color: "#fff" }}>
              {event.price}
            </span>
          </div>
          {isOwner && (
            <button onClick={deleteEvent} style={{ position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.75)", color: "#FCA5A5", border: "none", padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              🗑 Delete
            </button>
          )}
        </div>

        {/* Title block */}
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, marginBottom: 10 }}>{event.title}</h1>

        {/* Meta strip */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20, fontSize: 14, color: "#CBD5E1" }}>
          <div>📅 <strong>{dateLabel}</strong>{timeLabel && ` · ${timeLabel}`}</div>
          {event.location_name && <div>📍 {event.location_name}</div>}
          {event.address && (
            <div>
              <a href={`https://maps.google.com/?q=${encodeURIComponent(event.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#A78BFA", textDecoration: "none", fontSize: 13 }}>
                🗺 {event.address}
              </a>
            </div>
          )}
          {event.city && <div style={{ color: C.sub, fontSize: 13 }}>{event.city}</div>}
        </div>

        {/* RSVP buttons */}
        {user && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <button
              disabled={updating}
              onClick={() => setRsvp(myRsvp === "going" ? null : "going")}
              style={{
                ...rsvpBtn,
                background: myRsvp === "going" ? "linear-gradient(135deg, #16A34A, #22C55E)" : C.card,
                color: myRsvp === "going" ? "#fff" : C.text,
                border: myRsvp === "going" ? "none" : `1.5px solid ${C.border}`,
              }}
            >
              ✓ Going {myRsvp === "going" && "·"} {event.going_count}
            </button>
            <button
              disabled={updating}
              onClick={() => setRsvp(myRsvp === "interested" ? null : "interested")}
              style={{
                ...rsvpBtn,
                background: myRsvp === "interested" ? "linear-gradient(135deg, #7C3AED, #A78BFA)" : C.card,
                color: myRsvp === "interested" ? "#fff" : C.text,
                border: myRsvp === "interested" ? "none" : `1.5px solid ${C.border}`,
              }}
            >
              ⭐ Interested · {event.interested_count}
            </button>
            <button onClick={openAttendees} style={{ ...rsvpBtn, background: C.card, color: C.sub, border: `1.5px solid ${C.border}` }}>
              👥 View attendees
            </button>
          </div>
        )}

        {/* Capacity warning */}
        {event.max_attendees && event.going_count >= event.max_attendees && (
          <div style={{ background: "#3A2210", border: "1px solid #F59E0B", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#FCD34D", marginBottom: 16 }}>
            ⚠️ This event is at capacity ({event.max_attendees} attendees).
          </div>
        )}

        {/* Description */}
        {event.description && (
          <Card title="About this event">
            <p style={{ fontSize: 14, lineHeight: 1.65, color: "#E2E8F0", whiteSpace: "pre-wrap", margin: 0 }}>
              {event.description}
            </p>
          </Card>
        )}

        {/* Hosted by */}
        {creatorProfile && (
          <Card title="Hosted by">
            <Link href={`/profile/${creatorProfile.username}`} style={{ display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: C.input, overflow: "hidden", flexShrink: 0 }}>
                {creatorProfile.avatar_url
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={creatorProfile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, fontSize: 18 }}>👤</div>
                }
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  {creatorProfile.full_name}
                  {creatorProfile.account_type === "business" && <span style={{ marginLeft: 6, fontSize: 11, padding: "2px 8px", background: "#2A1F4A", color: "#E9D5FF", borderRadius: 99 }}>🏢 Business</span>}
                </div>
                <div style={{ fontSize: 12, color: C.sub }}>@{creatorProfile.username}</div>
              </div>
            </Link>
          </Card>
        )}

        {/* Source attribution for imported events */}
        {event.source !== "user" && event.external_url && (
          <Card title="Source">
            <a href={event.external_url} target="_blank" rel="noopener noreferrer" style={{ color: "#A78BFA", fontSize: 13 }}>
              View original on {event.source} →
            </a>
          </Card>
        )}

        {/* Comments */}
        <Card title={`💬 Comments & Questions (${event.comments_count})`}>
          {/* New comment box */}
          {user && (
            <div style={{ marginBottom: 16 }}>
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Ask a question or add a comment..."
                rows={2}
                style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={() => postComment(null, newComment)}
                  disabled={posting || !newComment.trim()}
                  style={{
                    padding: "8px 16px", borderRadius: 10, border: "none",
                    background: newComment.trim() ? "linear-gradient(135deg, #7C3AED, #A78BFA)" : C.input,
                    color: newComment.trim() ? "#fff" : C.muted,
                    fontWeight: 700, fontSize: 13, cursor: newComment.trim() ? "pointer" : "not-allowed",
                  }}
                >Post</button>
              </div>
            </div>
          )}

          {topLevel.length === 0 ? (
            <Empty>No comments yet. Be the first.</Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {topLevel.map(c => (
                <CommentBlock
                  key={c.id}
                  comment={c}
                  replies={replyMap[c.id] || []}
                  currentUserId={user?.id}
                  onDelete={deleteComment}
                  replyTo={replyTo}
                  setReplyTo={setReplyTo}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  onPostReply={postComment}
                  posting={posting}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Attendees modal */}
      {attendeesOpen && (
        <div onClick={() => setAttendeesOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 22, maxWidth: 480, width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Attendees</h3>
              <button onClick={() => setAttendeesOpen(false)} style={{ background: "none", border: "none", color: C.sub, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            {attendees.length === 0 ? (
              <Empty>No one has RSVP'd yet.</Empty>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {attendees.map((a, i) => (
                  <Link key={i} href={`/profile/${a.users.username}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 10, textDecoration: "none", color: "inherit" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: C.input, overflow: "hidden", flexShrink: 0 }}>
                      {a.users.avatar_url
                        /* eslint-disable-next-line @next/next/no-img-element */
                        ? <img src={a.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.sub }}>👤</div>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{a.users.full_name}</div>
                      <div style={{ fontSize: 12, color: C.sub }}>@{a.users.username}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: a.status === "going" ? "#16A34A" : "#7C3AED", color: "#fff", fontWeight: 700 }}>
                      {a.status === "going" ? "Going" : "Interested"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CommentBlock({
  comment, replies, currentUserId, onDelete, replyTo, setReplyTo, replyText, setReplyText, onPostReply, posting,
}: {
  comment: Comment;
  replies: Comment[];
  currentUserId: string | undefined;
  onDelete: (id: string) => void;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  replyText: string;
  setReplyText: (v: string) => void;
  onPostReply: (parentId: string, content: string) => void;
  posting: boolean;
}) {
  const isOwn = currentUserId === comment.user_id;
  return (
    <div>
      <CommentRow comment={comment} isOwn={isOwn} onDelete={onDelete} onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)} />
      {/* Replies */}
      {replies.length > 0 && (
        <div style={{ marginLeft: 36, marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {replies.map(r => (
            <CommentRow key={r.id} comment={r} isOwn={currentUserId === r.user_id} onDelete={onDelete} compact />
          ))}
        </div>
      )}
      {/* Reply input */}
      {replyTo === comment.id && (
        <div style={{ marginLeft: 36, marginTop: 10 }}>
          <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={`Reply to @${comment.users.username}...`} rows={2}
            style={{ ...inputStyle, resize: "vertical", minHeight: 50, fontSize: 13 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <button onClick={() => setReplyTo(null)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.sub, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => onPostReply(comment.id, replyText)} disabled={posting || !replyText.trim()}
              style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: replyText.trim() ? "#7C3AED" : C.input, color: replyText.trim() ? "#fff" : C.muted, fontSize: 12, fontWeight: 700, cursor: replyText.trim() ? "pointer" : "not-allowed" }}>
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentRow({ comment, isOwn, onDelete, onReply, compact }: { comment: Comment; isOwn: boolean; onDelete: (id: string) => void; onReply?: () => void; compact?: boolean }) {
  const ago = timeAgo(comment.created_at);
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <Link href={`/profile/${comment.users.username}`} style={{ flexShrink: 0 }}>
        <div style={{ width: compact ? 28 : 34, height: compact ? 28 : 34, borderRadius: 99, background: C.input, overflow: "hidden" }}>
          {comment.users.avatar_url
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={comment.users.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: C.sub }}>👤</div>
          }
        </div>
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12 }}>
          <Link href={`/profile/${comment.users.username}`} style={{ color: C.text, fontWeight: 700, textDecoration: "none" }}>{comment.users.full_name}</Link>
          <span style={{ color: C.muted, marginLeft: 6 }}>@{comment.users.username} · {ago}</span>
        </div>
        <div style={{ fontSize: compact ? 13 : 14, color: "#E2E8F0", marginTop: 3, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{comment.content}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
          {onReply && <button onClick={onReply} style={miniLink}>Reply</button>}
          {isOwn && <button onClick={() => onDelete(comment.id)} style={{ ...miniLink, color: "#FCA5A5" }}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: C.muted, fontSize: 13, padding: "8px 0" }}>{children}</div>;
}

function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.sub, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
      {children}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const C = {
  bg: "#0D0D0D", card: "#161A26", input: "#1F2333", border: "#2A2F42",
  text: "#F0F0F0", sub: "#9CA3AF", muted: "#6B7280",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", background: C.input,
  border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
  fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};

const rsvpBtn: React.CSSProperties = {
  padding: "11px 20px", borderRadius: 12, fontWeight: 800, fontSize: 14,
  cursor: "pointer", flex: "1 1 auto", minWidth: 130,
};

const miniLink: React.CSSProperties = {
  background: "none", border: "none", color: C.sub, fontSize: 12,
  fontWeight: 600, cursor: "pointer", padding: 0,
};

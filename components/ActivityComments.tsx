"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";

const C = {
  dark: "#0D0D0D",
  darkCard: "#1A1D2E",
  darkBorder: "#2A2D3E",
  darkSub: "#8892A4",
  blue: "#16A34A",
  text: "#E2E8F0",
  sub: "#9CA3AF",
};

interface Comment {
  id: string;
  content: string;
  created_at: string;
  commenter: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface Props {
  // cardId = "{userId}__{MM/DD/YYYY}" — the unique key for this activity card
  cardId: string;
  // cardOwnerId = the user_id of whoever logged this activity
  cardOwnerId: string;
}

export default function ActivityComments({ cardId, cardOwnerId }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load comments when expanded
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/db?action=get_activity_comments&cardId=${encodeURIComponent(cardId)}`)
      .then(r => r.json())
      .then(j => {
        setComments(j.comments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, cardId]);

  async function submitComment() {
    if (!text.trim() || !user || posting) return;
    setPosting(true);
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'post_activity_comment',
        payload: {
          cardId,
          commenterId: user.id,
          content: text.trim(),
          cardOwnerId,
        },
      }),
    });
    const json = await res.json();
    if (json.comment) {
      setComments(prev => [...prev, json.comment]);
      setText("");
    }
    setPosting(false);
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString();
  }

  return (
    <div style={{ borderTop: `1px solid ${C.darkBorder}`, marginTop: 4 }}>
      {/* Toggle button */}
      <button
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 100); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
          color: C.darkSub, fontSize: 12, fontWeight: 700, textAlign: "left",
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, flexShrink: 0 }}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {comments.length > 0 && !open
          ? `${comments.length} comment${comments.length !== 1 ? "s" : ""}`
          : open ? "Hide comments" : "Add a comment"}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ width: 12, height: 12, marginLeft: "auto", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          {/* Comment list */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "12px 0", color: C.darkSub, fontSize: 12 }}>Loading...</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "10px 0", color: C.darkSub, fontSize: 12 }}>Be the first to comment 💬</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {comments.map(c => {
                const name = c.commenter?.full_name || c.commenter?.username || "User";
                const ini = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%",
                      background: "linear-gradient(135deg,#16A34A,#4ADE80)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 900, color: "#fff", flexShrink: 0, overflow: "hidden",
                    }}>
                      {c.commenter?.avatar_url
                        ? <img src={c.commenter.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt=""
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : ini}
                    </div>
                    <div style={{
                      flex: 1, background: "#252A3D", borderRadius: 12,
                      padding: "8px 12px", border: `1px solid ${C.darkBorder}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontWeight: 800, fontSize: 12, color: C.text }}>{name}</span>
                        <span style={{ fontSize: 10, color: C.darkSub }}>{timeAgo(c.created_at)}</span>
                      </div>
                      <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>{c.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Input */}
          {user ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "linear-gradient(135deg,#16A34A,#4ADE80)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 900, color: "#fff", flexShrink: 0, overflow: "hidden",
              }}>
                {(user as any)?.profile?.avatar_url
                  ? <img src={(user as any).profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  : ((user as any)?.profile?.full_name || (user as any)?.user_metadata?.full_name || "?")
                      .split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8,
                background: "#1A1D2E", borderRadius: 20,
                padding: "7px 14px", border: `1.5px solid ${C.darkBorder}`,
              }}>
                <input
                  ref={inputRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && submitComment()}
                  placeholder="Say something encouraging..."
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    fontSize: 13, color: C.text,
                  }}
                />
                {text.trim() && (
                  <button
                    onClick={submitComment}
                    disabled={posting}
                    style={{
                      background: "none", border: "none", cursor: posting ? "not-allowed" : "pointer",
                      color: C.blue, fontWeight: 800, fontSize: 13, padding: 0,
                      opacity: posting ? 0.5 : 1,
                    }}
                  >
                    {posting ? "..." : "Post"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", fontSize: 12, color: C.darkSub, padding: "8px 0" }}>
              Sign in to comment
            </div>
          )}
        </div>
      )}
    </div>
  );
}

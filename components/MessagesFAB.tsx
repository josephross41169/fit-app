"use client";
// components/MessagesFAB.tsx
//
// A right-edge floating arrow (mobile only) that opens a full-page overlay
// with the user's conversation list. Tapping a conversation navigates to
// the full /messages page focused on that thread. Closing the overlay slides
// it back to the edge handle so it stays out of the user's way.
//
// Hidden on:
//   - the messages page itself (you're already there)
//   - the post creation page (focus mode, no distractions)
// Hidden when no user is signed in.

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const PURPLE = "#7C3AED";

interface ConversationRow {
  id: string;
  created_at: string;
  otherUser: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  lastMessage: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread: boolean;
}

// Routes where the floating handle should NOT appear
const HIDDEN_ROUTES = ["/messages", "/post", "/login", "/signup"];

function timeAgoTiny(iso: string | null): string {
  if (!iso) return "";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

// Strip out the [photo]: / [story_reply]: / [story_reaction]: URL prefix
// so the conversation preview shows actual text instead of "[photo]: https://..."
function previewText(content: string | null): string {
  if (!content) return "";
  let s = content;
  s = s.replace(/^\[photo\]: https?:\/\/\S+\n?/, "📷 Photo · ");
  s = s.replace(/^\[story_reply\]: https?:\/\/\S+\n?/, "↩️ Story reply · ");
  s = s.replace(/^\[story_reaction\]: https?:\/\/\S+\n?/, "↩️ ");
  return s.trim() || "📷 Photo";
}

export default function MessagesFAB() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const hidden = !user || HIDDEN_ROUTES.some(r => pathname?.startsWith(r));

  // Total unread badge — shown on the closed handle
  useEffect(() => {
    if (!user) { setUnreadTotal(0); return; }
    let cancelled = false;
    async function fetchUnread() {
      try {
        const { data: parts } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user!.id);
        if (cancelled) return;
        if (!parts || parts.length === 0) { setUnreadTotal(0); return; }
        const convIds = parts.map((p: any) => p.conversation_id);
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', convIds)
          .neq('sender_id', user!.id)
          .is('read_at', null);
        if (!cancelled) setUnreadTotal(count || 0);
      } catch {
        if (!cancelled) setUnreadTotal(0);
      }
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 20000);

    let channel: any = null;
    try {
      channel = supabase
        .channel(`fab-msg-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
          () => { fetchUnread(); })
        .subscribe();
    } catch { /* realtime not available yet */ }

    return () => {
      cancelled = true;
      clearInterval(interval);
      try { channel?.unsubscribe(); } catch {}
    };
  }, [user]);

  // Load conversations when overlay opens
  async function loadConversations() {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_conversations',
          payload: { userId: user.id },
        }),
      });
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations as ConversationRow[]);
      } else if (Array.isArray(data)) {
        setConversations(data as ConversationRow[]);
      }
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    loadConversations();
  }

  function handleConvClick(convId: string) {
    setOpen(false);
    router.push(`/messages?conv=${convId}`);
  }

  if (hidden) return null;

  return (
    <>
      {/* ── Floating right-edge handle — toggles open/close ──────────────────
          Always visible (when not on a hidden route). Tapping toggles the
          overlay. When OPEN, the handle stays on top with a chevron pointing
          inward and acts as the close button so the user has a consistent
          way to dismiss. */}
      <button
        className="md:hidden"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            handleOpen();
          }
        }}
        aria-label={open ? "Close messages" : "Open messages"}
        style={{
          position: "fixed",
          right: 0,
          bottom: 200,
          // Sit ABOVE the overlay so it's still clickable when overlay is open
          zIndex: 10000,
          width: 48,
          height: 56,
          background: PURPLE,
          border: "none",
          borderRadius: "16px 0 0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(124,58,237,0.5)",
          padding: 0,
        }}
      >
        {open ? (
          // Close: chevron pointing right (push the panel back to the edge)
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        ) : (
          // Open: chat bubble icon
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
        {!open && unreadTotal > 0 && (
          <div style={{
            position: "absolute",
            top: 4, left: 4,
            minWidth: 18, height: 18,
            borderRadius: 9,
            background: "#EF4444",
            color: "#fff",
            fontSize: 10,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 5px",
            border: "2px solid #0D0D0D",
            lineHeight: 1,
          }}>
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </div>
        )}
      </button>

      {/* ── Open overlay: full-screen conversation list ──────────────────── */}
      {open && (
        <div className="md:hidden" style={{
          position: "fixed",
          // Cover the ENTIRE screen, including under the iPhone notch and home
          // indicator. Using top:0 + bottom:0 instead of `inset:0` to be
          // explicit. zIndex is set very high so nothing bleeds through —
          // including page sticky headers (which use zIndex 100).
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999,
          // SOLID background — was getting bleed-through from the page below.
          background: "#0D0D0D",
          display: "flex", flexDirection: "column",
        }}>
          {/* Header — pushed below the iOS notch / Dynamic Island via safe-area
              padding so the close button and title are tappable. */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 20px",
            paddingTop: "calc(var(--safe-top, 0px) + 14px)",
            borderBottom: "1px solid #1A1228",
            background: "#0D0D0D",
            flexShrink: 0,
          }}>
            <div style={{ flex: 1, fontWeight: 900, fontSize: 22, color: "#F0F0F0" }}>
              💬 Messages
            </div>
            {/* Open the full /messages page if you want to see threads */}
            <button
              onClick={() => { setOpen(false); router.push('/messages'); }}
              aria-label="Open full messages page"
              style={{
                background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(124,58,237,0.4)",
                borderRadius: 10,
                padding: "7px 12px",
                color: PURPLE,
                fontSize: 12, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open page →
            </button>
            {/* Big obvious × button — primary close action */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close messages"
              style={{
                width: 40, height: 40,
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#F0F0F0",
                fontSize: 24, fontWeight: 600,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1, padding: 0,
                flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* Conversation list — bottom padding clears the iPhone home
              indicator so the last conversation is fully reachable. */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch" as any,
            paddingBottom: "calc(var(--safe-bottom, 0px) + 24px)",
          }}>
            {loading ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#6B7280", fontSize: 14 }}>
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: "60px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>💬</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#F0F0F0", marginBottom: 6 }}>
                  No messages yet
                </div>
                <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.5 }}>
                  Find people to follow on Connect, then tap their profile to start a conversation.
                </div>
                <button
                  onClick={() => { setOpen(false); router.push('/connect'); }}
                  style={{
                    marginTop: 20,
                    background: PURPLE,
                    border: "none",
                    borderRadius: 99,
                    padding: "10px 20px",
                    color: "#fff",
                    fontSize: 13, fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Browse Connect →
                </button>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => handleConvClick(conv.id)}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 20px",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid #1A1228",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: PURPLE, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 900, color: "#fff",
                    overflow: "hidden",
                  }}>
                    {conv.otherUser.avatar_url
                      ? <img src={conv.otherUser.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                      : (conv.otherUser.full_name || conv.otherUser.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#F0F0F0",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conv.otherUser.full_name || conv.otherUser.username || "Unknown"}
                      </span>
                      <span style={{ fontSize: 11, color: "#6B7280", flexShrink: 0 }}>
                        {timeAgoTiny(conv.lastMessage?.created_at || null)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: conv.unread ? "#F0F0F0" : "#9CA3AF",
                      fontWeight: conv.unread ? 600 : 400,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginTop: 2,
                    }}>
                      {previewText(conv.lastMessage?.content || null)}
                    </div>
                  </div>
                  {conv.unread && (
                    <div style={{
                      minWidth: 10, height: 10, borderRadius: 5,
                      background: "#EF4444", flexShrink: 0,
                    }}/>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

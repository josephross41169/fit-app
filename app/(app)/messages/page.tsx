"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { loadBlockedUsers } from "@/lib/blocks";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  user_id: string;
  users: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface ConversationRow {
  id: string;
  created_at: string;
  conversation_participants: Participant[];
  messages: { content: string; created_at: string; sender_id: string }[];
}

interface Conversation {
  id: string;
  created_at: string;
  otherUser: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
  lastMessage: { content: string; created_at: string; sender_id: string } | null;
  unread: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface UserResult {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AvatarCircle({ name, avatarUrl, size = 40 }: { name: string; avatarUrl?: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
      style={{ width: size, height: size, background: "#7C3AED" }}
    >
      {initials(name)}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const [msgPhoto, setMsgPhoto] = useState<File | null>(null);
  const [msgPhotoPreview, setMsgPhotoPreview] = useState<string | null>(null);
  const [msgUploading, setMsgUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load conversations via server API (bypasses RLS) ───────────────────────
  // loadConversations
  // Accepts a `silent` flag so background polls don't flip the global loading
  // state (which re-layouts the list and causes visible flicker). Only the
  // initial load sets loading=true.
  const loadConversations = useCallback(async (silent: boolean = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/db', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_conversations', payload: { userId: user.id } }),
      });
      const json = await res.json();
      let next: Conversation[] = json.conversations || [];

      // Filter out conversations with blocked users in either direction.
      // Apple Guideline 1.2: blocked users must not be able to reach the
      // blocker. Server-side would also be wise long-term but client filter
      // is enough for app-store compliance since blocking happens client-side.
      const blocks = await loadBlockedUsers(user.id);
      if (blocks.size > 0) {
        next = next.filter(c => c.otherUser?.id && !blocks.has(c.otherUser.id));
      }

      setConversations(prev => {
        // Avoid unnecessary state updates — only swap if the list actually changed.
        // Prevents flicker when polling returns the same data.
        if (prev.length !== next.length) return next;
        const changed = next.some((c: Conversation, i: number) =>
          c.id !== prev[i]?.id ||
          c.last_message !== prev[i]?.last_message ||
          c.last_message_at !== prev[i]?.last_message_at ||
          c.unread_count !== prev[i]?.unread_count
        );
        return changed ? next : prev;
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  // loadMessages
  // Fetches via server API to bypass RLS. Diffs the result and only swaps
  // state when something actually changed — critical because realtime
  // subscriptions can fire faster than HTTP polls and we don't want to
  // thrash re-renders.
  const loadMessages = useCallback(async (convId: string) => {
    const res = await fetch('/api/db', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_messages', payload: { conversationId: convId } }),
    });
    const json = await res.json();
    if (!json.messages) return;
    const next: Message[] = json.messages;
    setMessages(prev => {
      if (prev.length !== next.length) return next;
      // Only compare last message — if it's the same ID, the list is identical.
      // Avoids full-array compare on every poll while catching any append.
      const lastPrev = prev[prev.length - 1];
      const lastNext = next[next.length - 1];
      if (lastPrev?.id === lastNext?.id) return prev; // no change
      return next;
    });
  }, []);

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConvId) return;

    // Tear down old channel before subscribing to new one
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    const channel = supabase
      .channel(`messages:${activeConvId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConvId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // NOTE: previously this also called loadConversations() to refresh
          // the preview snippet in the sidebar. Removed because the 8s silent
          // poll handles that, and calling it here on every message was
          // re-rendering the whole page and causing the "shifting" bug.
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [activeConvId]); // removed loadConversations from deps — it's no longer called from here

  // ── Realtime handles new messages — no more polling needed here ────────────
  // Removed the 3s setInterval poll: it was causing the "shifting" bug because
  // every poll triggered a messages refetch → state swap → scroll animation,
  // even when nothing changed. The realtime subscription below now does the
  // same job on-demand.

  // ── Scroll to bottom on new messages ───────────────────────────────────────
  // Only scrolls when message COUNT increases (a new message arrived).
  // Previous version used [messages] which fires on every state reference
  // change, causing visible scroll jank during polls.
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  // ── Initial load + silent background refresh ───────────────────────────────
  // Silent polling keeps the conversation list fresh (incoming messages from
  // other convs, new conversations started by others) without flickering.
  useEffect(() => {
    if (user) {
      loadConversations(false); // initial load shows spinner
      const poll = setInterval(() => loadConversations(true), 8000); // silent every 8s
      return () => clearInterval(poll);
    }
  }, [user, loadConversations]);

  // ── Select conversation ─────────────────────────────────────────────────────
  const selectConversation = (conv: Conversation) => {
    setActiveConvId(conv.id);
    loadMessages(conv.id);
    setMobileShowThread(true);
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if ((!inputText.trim() && !msgPhoto) || !activeConvId || !user) return;
    let content = inputText.trim();
    const photoToSend = msgPhoto;
    const previewToSend = msgPhotoPreview;

    setInputText("");
    setMsgPhoto(null);
    setMsgPhotoPreview(null);

    if (photoToSend) {
      setMsgUploading(true);
      try {
        const ext = photoToSend.name.split('.').pop() || 'jpg';
        const path = `dms/${activeConvId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('activity')
          .upload(path, photoToSend, { upsert: true });
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('activity').getPublicUrl(path);
          const photoLine = `[photo]: ${publicUrl}`;
          content = content ? `${content}\n${photoLine}` : photoLine;
        }
      } finally {
        setMsgUploading(false);
      }
    }

    if (!content) return;

    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_message', payload: { conversationId: activeConvId, senderId: user.id, content } }),
    });
    loadConversations(true); // silent refresh — no spinner flicker
  };

  // ── Handle photo selection ───────────────────────────────────────────────────
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsgPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setMsgPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // ── Search users ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("users")
        .select("id, username, full_name, avatar_url")
        .ilike("username", `%${searchQuery}%`)
        .neq("id", user?.id ?? "")
        .limit(10);
      setSearchResults((data as UserResult[]) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  // ── Start / open conversation ───────────────────────────────────────────────
  const openOrCreateConversation = async (otherUserId: string, otherUser?: UserResult) => {
    if (!user) return;
    setShowNewModal(false);
    setSearchQuery("");
    setSearchResults([]);

    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_conversation', payload: { userId: user.id, otherUserId } }),
    });
    const json = await res.json();
    if (json.error) { console.error('create_conversation error:', json.error); return; }

    const convId = json.conversationId;

    // If we already have the other user's info, optimistically add the conversation
    // so we don't depend on loadConversations finishing before setActiveConvId
    if (otherUser) {
      setConversations(prev => {
        if (prev.find(c => c.id === convId)) return prev;
        return [{
          id: convId,
          created_at: new Date().toISOString(),
          otherUser,
          lastMessage: null,
          unread: false,
        }, ...prev];
      });
    }

    setActiveConvId(convId);
    setMessages([]);
    setMobileShowThread(true);
    loadMessages(convId);
    loadConversations(true); // silent background refresh
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#0F1117", color: "#E2E8F0" }}
    >
      {/* ── LEFT PANEL: Conversation list ── */}
      <div
        className={`flex flex-col border-r ${mobileShowThread ? "hidden md:flex" : "flex"} md:flex`}
        style={{
          width: "100%",
          maxWidth: 280,
          minWidth: 280,
          borderColor: "#1E2130",
          background: "#0F1117",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-4 border-b"
          style={{ borderColor: "#1E2130" }}
        >
          <span className="text-lg font-bold" style={{ color: "#E2E8F0" }}>
            💬 Messages
          </span>
          <button
            onClick={() => setShowNewModal(true)}
            className="text-sm font-semibold px-3 py-1.5 rounded-xl transition-all"
            style={{ background: "#7C3AED", color: "#fff" }}
          >
            + New
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12" style={{ color: "#8892A4" }}>
              Loading…
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center" style={{ color: "#8892A4" }}>
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start one by clicking + New</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                style={{
                  background: activeConvId === conv.id ? "#1A1228" : "transparent",
                  borderLeft: activeConvId === conv.id ? "3px solid #7C3AED" : "3px solid transparent",
                }}
              >
                <AvatarCircle
                  name={conv.otherUser.full_name || conv.otherUser.username}
                  avatarUrl={conv.otherUser.avatar_url}
                  size={44}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate" style={{ color: "#E2E8F0" }}>
                      {conv.otherUser.full_name || conv.otherUser.username}
                    </span>
                    {conv.lastMessage && (
                      <span className="text-xs ml-1 flex-shrink-0" style={{ color: "#8892A4" }}>
                        {formatTime(conv.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs truncate" style={{ color: "#8892A4" }}>
                      @{conv.otherUser.username}
                    </span>
                    {conv.unread && (
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 ml-1"
                        style={{ background: "#7C3AED" }}
                      />
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: "#8892A4" }}>
                      {conv.lastMessage.sender_id === user?.id ? "You: " : ""}
                      {conv.lastMessage.content}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Active thread ── */}
      <div
        className={`flex flex-col flex-1 ${mobileShowThread ? "flex" : "hidden md:flex"}`}
        style={{ background: "#0F1117" }}
      >
        {activeConv ? (
          <>
            {/* Thread header */}
            <div
              className="flex items-center gap-3 px-4 py-3 border-b"
              style={{ borderColor: "#1E2130", background: "#0F1117" }}
            >
              <button
                className="md:hidden mr-1"
                onClick={() => setMobileShowThread(false)}
                style={{ color: "#7C3AED" }}
              >
                ←
              </button>
              <AvatarCircle
                name={activeConv.otherUser.full_name || activeConv.otherUser.username}
                avatarUrl={activeConv.otherUser.avatar_url}
                size={36}
              />
              <div>
                <div className="font-semibold text-sm" style={{ color: "#E2E8F0" }}>
                  {activeConv.otherUser.full_name || activeConv.otherUser.username}
                </div>
                <div className="text-xs" style={{ color: "#8892A4" }}>
                  @{activeConv.otherUser.username}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
              {messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                // Parse photo from content
                const photoMatch = msg.content.match(/^\[photo\]: (https?:\/\/\S+)(\n|$)/);
                const photoUrl = photoMatch ? photoMatch[1] : null;
                const textContent = photoUrl
                  ? msg.content.replace(/^\[photo\]: https?:\/\/\S+\n?/, '').trim()
                  : msg.content;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div
                      className="max-w-xs lg:max-w-md rounded-2xl text-sm overflow-hidden"
                      style={{
                        background: isMine ? "#7C3AED" : "#1A1228",
                        color: isMine ? "#fff" : "#E2E8F0",
                        borderBottomRightRadius: isMine ? 4 : undefined,
                        borderBottomLeftRadius: !isMine ? 4 : undefined,
                      }}
                    >
                      {photoUrl && (
                        <img
                          src={photoUrl}
                          alt=""
                          style={{ maxWidth: 220, display: "block", borderRadius: textContent ? "12px 12px 0 0" : 12 }}
                        />
                      )}
                      {textContent && (
                        <div className="px-4 py-2.5">{textContent}</div>
                      )}
                      {!textContent && !photoUrl && (
                        <div className="px-4 py-2.5">{msg.content}</div>
                      )}
                    </div>
                    <span className="text-xs mt-0.5 px-1" style={{ color: "#8892A4" }}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div
              className="border-t px-4 py-3"
              style={{ borderColor: "#1E2130", background: "#0F1117" }}
            >
              {/* Photo preview */}
              {msgPhotoPreview && (
                <div className="flex items-start gap-2 mb-2">
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                      src={msgPhotoPreview}
                      alt="preview"
                      style={{ maxHeight: 80, maxWidth: 120, borderRadius: 10, display: "block" }}
                    />
                    <button
                      onClick={() => { setMsgPhoto(null); setMsgPhotoPreview(null); }}
                      className="absolute top-0 right-0 flex items-center justify-center text-xs font-bold rounded-full"
                      style={{ width: 18, height: 18, background: "#EF4444", color: "#fff", transform: "translate(40%,-40%)", border: "none", cursor: "pointer", lineHeight: 1 }}
                    >✕</button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoSelect}
                />
                {/* Attach button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: msgPhoto ? "#7C3AED22" : "#1A1D2E",
                    color: msgPhoto ? "#7C3AED" : "#8892A4",
                    border: "1px solid #2A2D3E",
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                  title="Attach photo"
                >
                  🖼️
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={msgPhoto ? "Add a caption… (optional)" : "Type a message…"}
                  className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none"
                  style={{
                    background: "#1A1D2E",
                    color: "#E2E8F0",
                    border: "1px solid #2A2D3E",
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={(!inputText.trim() && !msgPhoto) || msgUploading}
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: (inputText.trim() || msgPhoto) && !msgUploading ? "#7C3AED" : "#1A1D2E",
                    color: (inputText.trim() || msgPhoto) && !msgUploading ? "#fff" : "#8892A4",
                  }}
                >
                  {msgUploading ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 animate-spin">
                      <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ color: "#8892A4" }}>
            <div className="text-6xl mb-4">💬</div>
            <p className="text-lg font-semibold" style={{ color: "#E2E8F0" }}>
              Select a conversation
            </p>
            <p className="text-sm mt-1">to start messaging</p>
          </div>
        )}
      </div>

      {/* ── NEW CONVERSATION MODAL ── */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewModal(false);
              setSearchQuery("");
              setSearchResults([]);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            style={{ background: "#1A1D2E", border: "1px solid #2A2D3E" }}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#2A2D3E" }}>
              <span className="font-bold text-base" style={{ color: "#E2E8F0" }}>
                New Message
              </span>
              <button
                onClick={() => {
                  setShowNewModal(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                style={{ color: "#8892A4" }}
                className="text-lg font-bold hover:opacity-70"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username…"
                autoFocus
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{
                  background: "#0F1117",
                  color: "#E2E8F0",
                  border: "1px solid #2A2D3E",
                }}
              />
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
              {searching && (
                <div className="px-5 py-3 text-sm text-center" style={{ color: "#8892A4" }}>
                  Searching…
                </div>
              )}
              {!searching && searchQuery && searchResults.length === 0 && (
                <div className="px-5 py-3 text-sm text-center" style={{ color: "#8892A4" }}>
                  No users found
                </div>
              )}
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => openOrCreateConversation(u.id, u)}
                  className="w-full flex items-center gap-3 px-5 py-3 transition-all"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#7C3AED22")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <AvatarCircle name={u.full_name || u.username} avatarUrl={u.avatar_url} size={40} />
                  <div className="text-left">
                    <div className="font-semibold text-sm" style={{ color: "#E2E8F0" }}>
                      {u.full_name || u.username}
                    </div>
                    <div className="text-xs" style={{ color: "#8892A4" }}>
                      @{u.username}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="h-4" />
          </div>
        </div>
      )}
    </div>
  );
}



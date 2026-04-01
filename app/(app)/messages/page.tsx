"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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
      style={{ width: size, height: size, background: "#16A34A" }}
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id,
          created_at,
          conversation_participants!inner(
            user_id,
            users!inner(id, username, full_name, avatar_url)
          ),
          messages(content, created_at, sender_id)
        `)
        .order("created_at", { referencedTable: "messages", ascending: false })
        .limit(1, { referencedTable: "messages" });

      if (error) {
        console.error("loadConversations error:", error);
        setLoading(false);
        return;
      }

      const rows = (data as unknown as ConversationRow[]) ?? [];

      const convs: Conversation[] = rows.map((row) => {
        const otherParticipant = row.conversation_participants?.find(
          (p) => p.user_id !== user.id
        );
        const otherUser = otherParticipant?.users ?? {
          id: "",
          username: "Unknown",
          full_name: "Unknown",
          avatar_url: null,
        };
        const msgs = row.messages ?? [];
        const lastMessage = msgs.length > 0 ? msgs[0] : null;
        return {
          id: row.id,
          created_at: row.created_at,
          otherUser,
          lastMessage,
          unread: lastMessage ? lastMessage.sender_id !== user.id && !lastMessage : false,
        };
      });

      // Sort by last message time
      convs.sort((a, b) => {
        const aTime = a.lastMessage?.created_at ?? a.created_at;
        const bTime = b.lastMessage?.created_at ?? b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setConversations(convs);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Load messages for active conversation ───────────────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
    }
  }, []);

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConvId) return;

    // Unsubscribe old channel
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
          setMessages((prev) => {
            const newMsg = payload.new as Message;
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Refresh conversation list to update last message
          loadConversations();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [activeConvId, loadConversations]);

  // ── Scroll to bottom on new messages ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      loadConversations();
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
    if (!inputText.trim() || !activeConvId || !user) return;
    const content = inputText.trim();
    setInputText("");

    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_message', payload: { conversationId: activeConvId, senderId: user.id, content } }),
    });
    loadConversations();
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
  const openOrCreateConversation = async (otherUserId: string) => {
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
    await loadConversations();
    setActiveConvId(convId);
    loadMessages(convId);
    setMobileShowThread(true);
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
            style={{ background: "#16A34A", color: "#fff" }}
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
                  background: activeConvId === conv.id ? "#1A2E1E" : "transparent",
                  borderLeft: activeConvId === conv.id ? "3px solid #16A34A" : "3px solid transparent",
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
                        style={{ background: "#16A34A" }}
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
                style={{ color: "#16A34A" }}
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
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div
                      className="max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm"
                      style={{
                        background: isMine ? "#16A34A" : "#1A2E1E",
                        color: isMine ? "#fff" : "#E2E8F0",
                        borderBottomRightRadius: isMine ? 4 : undefined,
                        borderBottomLeftRadius: !isMine ? 4 : undefined,
                      }}
                    >
                      {msg.content}
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
              className="flex items-center gap-2 px-4 py-3 border-t"
              style={{ borderColor: "#1E2130", background: "#0F1117" }}
            >
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
                placeholder="Type a message…"
                className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none"
                style={{
                  background: "#1A1D2E",
                  color: "#E2E8F0",
                  border: "1px solid #2A2D3E",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!inputText.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: inputText.trim() ? "#16A34A" : "#1A1D2E",
                  color: inputText.trim() ? "#fff" : "#8892A4",
                }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
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
                  onClick={() => openOrCreateConversation(u.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 transition-all"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#16A34A22")}
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

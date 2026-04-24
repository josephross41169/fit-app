"use client";
// ── app/(app)/settings/blocked/page.tsx ─────────────────────────────────────
// Lists the users the current user has blocked with an "Unblock" action.
// Apple Guideline 1.2 requires this be discoverable so users can review
// their block list.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { clearBlockCache } from "@/lib/blocks";

interface BlockedEntry {
  created_at: string;
  blocked: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export default function BlockedUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const [blocked, setBlocked] = useState<BlockedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  // Fetch the current block list via GET endpoint. Refetched after every
  // successful unblock so the UI updates immediately.
  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/db?action=get_blocked_users&userId=${user.id}`);
      const json = await res.json();
      setBlocked(json.blocked || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function handleUnblock(blockedId: string) {
    if (!user || unblocking) return;
    setUnblocking(blockedId);
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unblock_user",
          payload: { blockerId: user.id, blockedId },
        }),
      });
      // Invalidate cached block list so feed filters refresh
      clearBlockCache();
      await load();
    } finally {
      setUnblocking(null);
    }
  }

  if (authLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Loading...</div>;
  }
  if (!user) {
    return <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Please sign in.</div>;
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 100px" }}>
      <Link href="/settings" style={{ color: "#A78BFA", textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-block", marginBottom: 16 }}>
        ← Back to Settings
      </Link>

      <div style={{ fontSize: 28, fontWeight: 900, color: "#F0F0F0", marginBottom: 4 }}>
        Blocked Users
      </div>
      <div style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 28 }}>
        Blocked users can't see your content or message you, and you won't see theirs.
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>Loading...</div>
      ) : blocked.length === 0 ? (
        <div style={{
          background: "#1A1D2E",
          border: "1px solid #2A2D3E",
          borderRadius: 12,
          padding: 32,
          textAlign: "center",
          color: "#9CA3AF",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🛡️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#E2E8F0", marginBottom: 4 }}>
            Nobody blocked
          </div>
          <div style={{ fontSize: 13 }}>You haven't blocked anyone yet.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {blocked.map(entry => (
            <div key={entry.blocked.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#1A1D2E",
                border: "1px solid #2A2D3E",
                borderRadius: 12,
                padding: 12,
              }}
            >
              {/* Avatar */}
              <div style={{ width: 44, height: 44, borderRadius: 22, background: "#2A2D3E", flexShrink: 0, overflow: "hidden" }}>
                {entry.blocked.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.blocked.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#6B7280" }}>
                    {entry.blocked.full_name?.[0] || entry.blocked.username?.[0] || "?"}
                  </div>
                )}
              </div>

              {/* Name + handle */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.blocked.full_name}
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                  @{entry.blocked.username}
                </div>
              </div>

              {/* Unblock button */}
              <button
                onClick={() => handleUnblock(entry.blocked.id)}
                disabled={unblocking === entry.blocked.id}
                style={{
                  padding: "7px 14px",
                  background: "transparent",
                  border: "1px solid #DC2626",
                  borderRadius: 8,
                  color: "#FCA5A5",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: unblocking === entry.blocked.id ? "not-allowed" : "pointer",
                  opacity: unblocking === entry.blocked.id ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {unblocking === entry.blocked.id ? "..." : "Unblock"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

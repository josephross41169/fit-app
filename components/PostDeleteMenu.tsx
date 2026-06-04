"use client";

// ─── components/PostDeleteMenu.tsx ─────────────────────────────────────────
// Owner-only "···" overflow menu that lets a user delete one of their own
// posts from anywhere a post is rendered (group feed, profile gallery, etc.).
// Mirrors the inline menu already baked into the main feed's PostCard so the
// delete experience is identical everywhere: tap ··· → Delete Post → confirm.
//
// Safety: renders NOTHING unless the signed-in viewer owns the post
// (currentUserId === ownerId). The DB delete is also scoped to
// .eq("user_id", currentUserId) so RLS + the query both enforce ownership.
//
// On a successful delete it calls onDeleted() so the parent can drop the post
// from its local list without a full refetch.

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function PostDeleteMenu({
  postId,
  ownerId,
  currentUserId,
  onDeleted,
  table = "posts",
  tint = "#9CA3AF",
  surface = "#1A1228",
  border = "#2D1F52",
}: {
  postId: string;
  ownerId?: string | null;
  currentUserId?: string | null;
  onDeleted?: () => void;
  /** which table the post lives in. Group-feed posts are in "group_posts";
   *  feed / profile posts are in "posts" (the default). Deleting from the
   *  wrong table silently removes 0 rows, so the post reappears on refetch. */
  table?: string;
  /** icon color */
  tint?: string;
  /** popover background */
  surface?: string;
  /** popover border color */
  border?: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside the menu.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Owner-only. Bail before rendering anything for everyone else.
  if (!currentUserId || !ownerId || currentUserId !== ownerId) return null;

  async function doDelete() {
    if (busy || !currentUserId) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", postId)
        .eq("user_id", currentUserId);
      if (error) throw error;
      setOpen(false);
      setConfirming(false);
      onDeleted?.();
    } catch (e: any) {
      alert(`Could not delete post: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        aria-label="Post options"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); setConfirming(false); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8, color: tint, fontSize: 20, lineHeight: 1 }}
      >
        ···
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, minWidth: 184, background: surface, border: `1.5px solid ${border}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 60, overflow: "hidden" }}
        >
          {!confirming ? (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
              disabled={busy}
              style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 700, color: "#EF4444", display: "flex", alignItems: "center", gap: 8 }}
            >
              🗑️ Delete Post
            </button>
          ) : (
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tint, marginBottom: 10 }}>Delete this post?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); doDelete(); }}
                  disabled={busy}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: "#EF4444", color: "#fff", fontWeight: 800, fontSize: 13, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}
                >
                  {busy ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirming(false); setOpen(false); }}
                  disabled={busy}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: `1.5px solid ${border}`, background: "transparent", color: tint, fontWeight: 800, fontSize: 13, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

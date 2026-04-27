"use client";
// ── app/(app)/post/[id]/page.tsx ─────────────────────────────────────────────
// Single-post detail page. Used as the destination when:
//   • Tapping the comment icon on a Discover card
//   • Tapping a feed post's "View" or shared deep-link
//
// Loads the post + its author + its comments via the /api/db admin route
// (since RLS blocks nested SELECTs from the client).

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const C = {
  bg: "#0D0D0D",
  card: "#1A1228",
  border: "#2D1F52",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  purple: "#7C3AED",
  purpleMid: "#A78BFA",
  red: "#EF4444",
};

interface Author {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  users?: Author;  // server returns users (joined) not user
}

interface Post {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  media_urls: string[] | null;
  created_at: string;
  likes_count?: number;
  liked?: boolean;
  user?: Author;
  comments?: Comment[];
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  // ── Load post + comments ────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      try {
        // 1. Fetch the post itself
        const { data: postRow, error: postErr } = await supabase
          .from("posts")
          .select("id, user_id, caption, media_url, media_urls, created_at, likes_count")
          .eq("id", id)
          .single();
        if (postErr || !postRow) throw new Error(postErr?.message || "Post not found.");

        // 2. Fetch the author
        const { data: authorRow } = await supabase
          .from("users")
          .select("id, username, full_name, avatar_url")
          .eq("id", postRow.user_id)
          .single();

        // 3. Fetch comments via admin API (RLS blocks direct select)
        const commentsRes = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_post_comments", payload: { postId: id } }),
        });
        const commentsJson = await commentsRes.json();
        const comments: Comment[] = commentsJson.comments || [];

        // 4. Has the viewer liked this?
        const { data: likeRow } = await supabase
          .from("likes")
          .select("post_id")
          .eq("post_id", id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;
        setPost({
          ...postRow,
          user: authorRow || undefined,
          comments,
          liked: !!likeRow,
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not load post.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  async function refreshComments() {
    if (!id) return;
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_post_comments", payload: { postId: id } }),
    });
    const json = await res.json();
    setPost(p => p ? { ...p, comments: json.comments || [] } : p);
  }

  async function handleSubmitComment() {
    if (!commentText.trim() || !user || !id || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "post_feed_comment",
          payload: { postId: id, commenterId: user.id, content: commentText.trim(), postOwnerId: post?.user_id },
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCommentText("");
      // The API returns the full updated comments list — use it directly
      if (Array.isArray(json.comments)) {
        setPost(p => p ? { ...p, comments: json.comments } : p);
      } else {
        await refreshComments();
      }
    } catch (e: any) {
      alert(`Could not post comment: ${e?.message || "unknown error"}`);
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!user || !confirm("Delete this comment?")) return;
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_post_comment",
          payload: { commentId, userId: user.id },
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await refreshComments();
    } catch (e: any) {
      alert(`Could not delete: ${e?.message || "unknown error"}`);
    }
  }

  async function handleToggleLike() {
    if (!user || !post || likeBusy) return;
    setLikeBusy(true);
    const wasLiked = !!post.liked;
    // Optimistic update
    setPost(p => p ? { ...p, liked: !wasLiked, likes_count: (p.likes_count || 0) + (wasLiked ? -1 : 1) } : p);
    try {
      if (wasLiked) {
        await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      }
    } catch {
      // Revert on failure
      setPost(p => p ? { ...p, liked: wasLiked, likes_count: (p.likes_count || 0) + (wasLiked ? 1 : -1) } : p);
    } finally {
      setLikeBusy(false);
    }
  }

  async function handleDeletePost() {
    if (!post || !user || post.user_id !== user.id) return;
    if (!confirm("Delete this post permanently? This cannot be undone.")) return;
    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id).eq("user_id", user.id);
      if (error) throw error;
      router.push("/feed");
    } catch (e: any) {
      alert(`Could not delete post: ${e?.message || "unknown error"}`);
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>Loading post...</div>;
  }
  if (error || !post) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: C.text, marginBottom: 8 }}>Post not found</div>
          <div style={{ fontSize: 14, color: C.sub, marginBottom: 24 }}>{error || "This post may have been deleted."}</div>
          <Link href="/feed" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 14, background: C.purple, color: "#fff", fontWeight: 700, textDecoration: "none" }}>Back to Feed</Link>
        </div>
      </div>
    );
  }

  const photos: string[] = Array.isArray(post.media_urls) && post.media_urls.length > 0
    ? post.media_urls
    : post.media_url ? [post.media_url] : [];

  const isMine = user?.id === post.user_id;
  const createdLabel = new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(13,13,13,0.95)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: C.text, fontSize: 18, cursor: "pointer", padding: 0 }}>&larr;</button>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>Post</div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 18px" }}>
        {/* Author */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          {post.user?.avatar_url ? (
            <img src={post.user.avatar_url} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} alt="" />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${C.purple}, ${C.purpleMid})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#fff" }}>
              {(post.user?.full_name || "?")[0]}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link href={`/profile/${post.user?.username || ""}`} style={{ fontWeight: 800, fontSize: 15, color: C.text, textDecoration: "none" }}>
              {post.user?.full_name || "Unknown"}
            </Link>
            <div style={{ fontSize: 12, color: C.sub }}>@{post.user?.username || "user"} &middot; {createdLabel}</div>
          </div>
          {isMine && (
            <button onClick={handleDeletePost} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.red, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 99, cursor: "pointer" }}>
              Delete
            </button>
          )}
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div style={{ borderRadius: 18, overflow: "hidden", marginBottom: 14, background: C.card }}>
            {photos.map((src, i) => (
              <img key={i} src={src} style={{ width: "100%", display: "block", marginBottom: i < photos.length - 1 ? 2 : 0 }} alt="" />
            ))}
          </div>
        )}

        {/* Caption */}
        {post.caption && (
          <div style={{ fontSize: 15, color: C.text, lineHeight: 1.5, marginBottom: 16, whiteSpace: "pre-wrap" }}>
            {post.caption}
          </div>
        )}

        {/* Like / count row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
          <button onClick={handleToggleLike} disabled={likeBusy} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: likeBusy ? "default" : "pointer", padding: 0, color: post.liked ? C.red : C.sub, fontSize: 14, fontWeight: 700 }}>
            <span style={{ fontSize: 20 }}>{post.liked ? "\u2764\uFE0F" : "\u{1F90D}"}</span>
            {(post.likes_count ?? 0)}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.sub, fontSize: 14, fontWeight: 700 }}>
            <span style={{ fontSize: 18 }}>&#128172;</span>
            {(post.comments?.length ?? 0)}
          </div>
        </div>

        {/* Comments */}
        <div style={{ marginBottom: 100 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 12 }}>
            Comments {(post.comments?.length ?? 0) > 0 && <span style={{ color: C.sub, fontWeight: 600 }}>({post.comments?.length})</span>}
          </div>
          {(post.comments || []).length === 0 ? (
            <div style={{ fontSize: 13, color: C.sub, textAlign: "center", padding: "20px 0" }}>
              No comments yet. Be the first.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(post.comments || []).map(c => {
                const isMineComment = c.user_id === user?.id;
                return (
                  <div key={c.id} style={{ display: "flex", gap: 10 }}>
                    {c.users?.avatar_url ? (
                      <img src={c.users?.avatar_url} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.purple, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                        {(c.users?.full_name || "?")[0]}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ background: C.card, borderRadius: 14, padding: "9px 13px", border: `1px solid ${C.border}` }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 3 }}>
                          {c.users?.full_name || "Unknown"}
                          <span style={{ color: C.sub, fontWeight: 500, marginLeft: 6 }}>@{c.users?.username || "user"}</span>
                        </div>
                        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{c.content}</div>
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 4, paddingLeft: 4, fontSize: 11, color: C.sub }}>
                        <span>{new Date(c.created_at).toLocaleDateString()}</span>
                        {isMineComment && (
                          <button onClick={() => handleDeleteComment(c.id)} style={{ background: "none", border: "none", color: C.red, fontSize: 11, cursor: "pointer", fontWeight: 600, padding: 0 }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Compose bar - sticky bottom */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(13,13,13,0.96)", backdropFilter: "blur(10px)", borderTop: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", zIndex: 20 }}>
        <input
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
          placeholder="Add a comment..."
          style={{
            flex: 1, padding: "11px 16px", borderRadius: 99, border: `1.5px solid ${C.border}`,
            background: C.card, color: C.text, fontSize: 14, outline: "none",
          }}
        />
        <button
          onClick={handleSubmitComment}
          disabled={!commentText.trim() || posting}
          style={{
            background: !commentText.trim() || posting ? C.border : `linear-gradient(135deg, ${C.purple}, ${C.purpleMid})`,
            color: "#fff", border: "none", padding: "11px 18px", borderRadius: 99, fontWeight: 800, fontSize: 13,
            cursor: !commentText.trim() || posting ? "not-allowed" : "pointer",
          }}
        >
          {posting ? "..." : "Post"}
        </button>
      </div>
    </div>
  );
}

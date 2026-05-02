"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TaggedPost = {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  media_urls: string[] | null;
  media_types: ('image' | 'video')[] | null;
  media_positions: number[] | null;
  created_at: string;
  likes_count: number;
  users: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Props = {
  /** UUID of the user whose tagged-in posts to fetch. */
  userId: string;
  /** Display name (used in modal header). */
  displayName: string;
  /** Whether this is the viewer's own profile (changes header copy). */
  isOwnProfile: boolean;
  /** Close handler. */
  onClose: () => void;
};

/**
 * Modal showing every public post that has tagged the user.
 *
 * Renders a vertical scrollable feed inside a centered modal. Each post is
 * a thumbnail card linking to the full post page — clicking navigates away
 * (which closes the modal as a side-effect). This intentionally doesn't
 * embed the full PostCard render here because PostCard is heavy (likes,
 * comments, share, etc.) and we want this modal to load fast and feel
 * lightweight.
 *
 * Loading state: shows a spinner while the API call resolves.
 * Empty state: shows different copy depending on whether it's the user's
 * own profile or someone else's.
 */
export default function TaggedPostsModal({ userId, displayName, isOwnProfile, onClose }: Props) {
  const [posts, setPosts] = useState<TaggedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_tagged_posts',
            payload: { userId, limit: 60 },
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else {
          setPosts(Array.isArray(data.posts) ? data.posts : []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Couldn't load tagged posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  function getThumbnail(p: TaggedPost): { url: string | null; isVideo: boolean } {
    const urls = (p.media_urls && p.media_urls.length > 0) ? p.media_urls : (p.media_url ? [p.media_url] : []);
    if (urls.length === 0) return { url: null, isVideo: false };
    const types = p.media_types || [];
    const firstType = types[0] || (urls[0].match(/\.(mp4|mov|webm|m4v)(\?|$)/i) ? 'video' : 'image');
    return { url: urls[0], isVideo: firstType === 'video' };
  }

  return (
    <div onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: "#0D0D0D",
          borderRadius: 18,
          border: "1.5px solid #2D1F52",
          width: "100%", maxWidth: 540, maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
        {/* Header */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #2D1F52", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#E2E8F0" }}>
              {isOwnProfile ? "Posts you're tagged in" : `${displayName} is tagged in`}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
              {loading ? "Loading…" : `${posts.length} ${posts.length === 1 ? "post" : "posts"}`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#9CA3AF", fontSize: 26, lineHeight: 1, cursor: "pointer" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: 14, flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #2D1F52", borderTopColor: "#7C3AED", animation: "ptm-spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <style>{`@keyframes ptm-spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Loading tagged posts…</div>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#FCA5A5", fontSize: 13 }}>
              ⚠️ {error}
            </div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏷️</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", marginBottom: 6 }}>
                {isOwnProfile ? "You haven't been tagged in any posts yet" : `${displayName} hasn't been tagged in any posts yet`}
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
                {isOwnProfile
                  ? "When friends tag you in their posts, they'll appear here."
                  : "When friends tag them in posts, they'll appear here."}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {posts.map(p => {
                const { url, isVideo } = getThumbnail(p);
                const taggerName = p.users?.full_name || p.users?.username || "Someone";
                return (
                  <Link key={p.id} href={`/post/${p.id}`} onClick={onClose}
                    style={{
                      position: "relative",
                      aspectRatio: "1/1",
                      background: "#1A1A1A",
                      borderRadius: 8,
                      overflow: "hidden",
                      textDecoration: "none",
                      display: "block",
                    }}>
                    {url ? (
                      isVideo ? (
                        <video src={url} muted playsInline preload="metadata"
                          style={{
                            width: "100%", height: "100%", objectFit: "cover",
                            objectPosition: `center ${p.media_positions?.[0] ?? 50}%`,
                          }}/>
                      ) : (
                        <img src={url} alt=""
                          style={{
                            width: "100%", height: "100%", objectFit: "cover",
                            objectPosition: `center ${p.media_positions?.[0] ?? 50}%`,
                          }}
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}/>
                      )
                    ) : (
                      // Text-only post — show the caption preview instead
                      <div style={{
                        width: "100%", height: "100%",
                        background: "linear-gradient(135deg,#1A1228,#2D1F52)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: 8, fontSize: 11, fontWeight: 600, color: "#A78BFA",
                        textAlign: "center", lineHeight: 1.3,
                        overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {p.caption ? p.caption.slice(0, 60) + (p.caption.length > 60 ? "…" : "") : "Post"}
                      </div>
                    )}
                    {isVideo && (
                      <div style={{ position: "absolute", top: 6, right: 6, color: "#fff", fontSize: 14, textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>▶</div>
                    )}
                    {/* Hover overlay showing who tagged them */}
                    <div style={{
                      position: "absolute",
                      bottom: 0, left: 0, right: 0,
                      padding: "16px 8px 6px",
                      background: "linear-gradient(0deg,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0) 100%)",
                      fontSize: 10, fontWeight: 600, color: "#fff",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      by @{p.users?.username || "?"}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

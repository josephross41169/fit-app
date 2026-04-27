// app/api/debug-feed/route.ts
// Diagnostic endpoint. Visit https://fit-app-ecru.vercel.app/api/debug-feed
// in a browser. Returns JSON with:
//   - Total public posts count
//   - First 5 public posts (id, user_id, caption, has_media)
//   - Whether the get_feed_posts action returns the same posts
// This bypasses every layer of UI/render to show ground truth.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "missing env vars" }, { status: 500 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Raw count of public posts
  const { count: publicCount, error: countErr } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("is_public", true);

  // 2. First 5 public posts
  const { data: samplePosts, error: sampleErr } = await admin
    .from("posts")
    .select("id, user_id, caption, media_url, is_public, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(5);

  // 3. Same query the For You feed uses — including the users/comments joins
  const { data: feedShape, error: feedShapeErr } = await admin
    .from("posts")
    .select("*, users(id, username, full_name, avatar_url, tier, logs_last_28_days, city), comments(id, content, created_at, user_id, users(id, username, full_name, avatar_url))")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    diagnostic: "feed",
    timestamp: new Date().toISOString(),
    rawPublicPostCount: publicCount ?? null,
    rawCountError: countErr?.message || null,
    samplePostsCount: samplePosts?.length ?? 0,
    samplePostsError: sampleErr?.message || null,
    samplePosts: (samplePosts || []).map(p => ({
      id: p.id,
      user_id: p.user_id,
      has_caption: !!p.caption,
      has_media: !!p.media_url,
      caption_preview: p.caption ? p.caption.slice(0, 40) : null,
    })),
    feedShapeQueryCount: feedShape?.length ?? 0,
    feedShapeError: feedShapeErr?.message || null,
    feedShapeFirstPostHasUserJoined: feedShape?.[0]?.users ? true : false,
    feedShapeFirstPostUserId: feedShape?.[0]?.user_id || null,
    feedShapeFirstPostCommentsCount: Array.isArray(feedShape?.[0]?.comments) ? feedShape[0].comments.length : null,
  });
}

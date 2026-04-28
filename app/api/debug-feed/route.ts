// app/api/debug-feed/route.ts
// Tests the exact query the rewritten For You feed runs.
// Visit https://fit-app-ecru.vercel.app/api/debug-feed in browser.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const JOEY_ID = "70e170ca-4428-4357-8e8e-410135fc3948";

export async function GET() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!SUPABASE_URL || !SERVICE || !ANON) {
    return NextResponse.json({ error: "missing env vars" }, { status: 500 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE);
  const anon = createClient(SUPABASE_URL, ANON);

  // 1. ADMIN raw count of public posts
  const { count: adminCount } = await admin
    .from("posts").select("id", { count: "exact", head: true }).eq("is_public", true);

  // 2. ADMIN exact query the new For You uses
  const { data: adminFeed, error: adminFeedErr } = await admin
    .from("posts")
    .select("id, user_id, caption, media_url, media_urls, photo_url, media_type, post_type, location, is_public, created_at, likes_count, users(id, username, full_name, avatar_url, city)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  // 3. ANON (public client = same as browser) exact same query
  const { data: anonFeed, error: anonFeedErr } = await anon
    .from("posts")
    .select("id, user_id, caption, media_url, media_urls, photo_url, media_type, post_type, location, is_public, created_at, likes_count, users(id, username, full_name, avatar_url, city)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  // 4. Joey's posts specifically (admin so RLS doesn't hide them)
  const { data: joeyPosts, error: joeyErr } = await admin
    .from("posts")
    .select("id, caption, media_url, is_public, created_at")
    .eq("user_id", JOEY_ID)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    adminPublicCount: adminCount ?? null,
    adminFeedQuery: {
      count: adminFeed?.length ?? 0,
      error: adminFeedErr?.message || null,
      firstThree: (adminFeed || []).slice(0, 3).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        caption_preview: p.caption?.slice(0, 30) || null,
        has_media: !!p.media_url,
        users_joined: !!p.users,
        users_username: p.users?.username || null,
      })),
    },
    anonFeedQuery: {
      count: anonFeed?.length ?? 0,
      error: anonFeedErr?.message || null,
      firstThree: (anonFeed || []).slice(0, 3).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        caption_preview: p.caption?.slice(0, 30) || null,
        has_media: !!p.media_url,
        users_joined: !!p.users,
      })),
    },
    joeyPosts: {
      count: joeyPosts?.length ?? 0,
      error: joeyErr?.message || null,
      posts: (joeyPosts || []).map((p: any) => ({
        id: p.id,
        caption: p.caption,
        is_public: p.is_public,
        has_media: !!p.media_url,
        created_at: p.created_at,
      })),
    },
  });
}

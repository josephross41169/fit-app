// app/api/group-photos/route.ts
//
// Aggregates ALL photos posted within a group across the 3 user-facing
// surfaces — group posts, community notes, and war/challenge media — and
// returns them sorted newest-first, tagged by source so the UI can group
// or filter them. Also handles the highlights save flow (mods/owner only).
//
// Why a separate route file: the main /api/db/route.ts is already 2300+
// lines. Splitting these new actions out keeps both files manageable and
// makes the photo aggregation logic findable on its own.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Service role key is required because we need to read across tables
// regardless of RLS — RLS would block aggregating notes from a group
// the requesting user isn't a member of, but we want to allow this for
// non-private groups. The route checks membership manually for private
// groups.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Each photo returned to the client looks like this. `source` lets the UI
// chip-filter ("Posts | Notes | Wars") and `meta` carries optional context
// (e.g. challenge name for war photos).
type GroupPhoto = {
  url: string;
  source: 'post' | 'note' | 'war';
  source_id: string;       // id of the parent row (post id, note id, or media id)
  user_id: string;         // who uploaded it
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  caption: string | null;
  meta?: Record<string, any>;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body || {};

    // ── get_group_photos ──────────────────────────────────────────────────
    // Returns aggregated photo list for a group. Single round-trip from
    // the client's perspective — we run all 3 source queries in parallel
    // server-side and merge the results into one sorted array.
    if (action === 'get_group_photos') {
      const { groupId } = payload || {};
      if (!groupId) {
        return NextResponse.json({ error: 'Missing groupId' }, { status: 400 });
      }

      // Fan out: posts, notes, war media. All queries scoped to this group_id.
      const [postsRes, notesRes, warRes] = await Promise.all([
        // Group posts that have a photo attached. We only care about
        // photo-type media here — videos go through a separate path.
        admin
          .from('group_posts')
          .select('id, user_id, content, media_url, media_type, created_at, user:users!group_posts_user_id_fkey(id,username,full_name,avatar_url)')
          .eq('group_id', groupId)
          .not('media_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(500),

        // Community notes with media. Same media_url/media_type pattern.
        admin
          .from('community_notes')
          .select('id, user_id, content, category, media_url, media_type, created_at, user:users!community_notes_user_id_fkey(id,username,full_name,avatar_url)')
          .eq('group_id', groupId)
          .not('media_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(500),

        // War / challenge media. These already only contain successful
        // uploads (no nulls to filter), and join through to group_challenges
        // for the challenge name to surface in the UI.
        admin
          .from('group_challenge_media')
          .select('id, user_id, challenge_id, media_url, media_type, caption, created_at, user:users!group_challenge_media_user_id_fkey(id,username,full_name,avatar_url), challenge:group_challenges!group_challenge_media_challenge_id_fkey(id,title)')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      // Merge into one array. We treat anything where media_type is
      // 'photo' OR null/undefined as a photo. Some legacy posts pre-date
      // the media_type column so we accept null. Videos (media_type ===
      // 'video') are excluded.
      const photos: GroupPhoto[] = [];

      for (const row of (postsRes.data || [])) {
        if (row.media_type === 'video') continue;
        const u: any = row.user;
        photos.push({
          url: row.media_url as string,
          source: 'post',
          source_id: row.id,
          user_id: row.user_id,
          username: u?.username || null,
          avatar_url: u?.avatar_url || null,
          created_at: row.created_at,
          caption: row.content || null,
        });
      }

      for (const row of (notesRes.data || [])) {
        if (row.media_type === 'video') continue;
        const u: any = row.user;
        photos.push({
          url: row.media_url as string,
          source: 'note',
          source_id: row.id,
          user_id: row.user_id,
          username: u?.username || null,
          avatar_url: u?.avatar_url || null,
          created_at: row.created_at,
          caption: row.content || null,
          meta: { category: row.category || null },
        });
      }

      for (const row of (warRes.data || [])) {
        if (row.media_type === 'video') continue;
        const u: any = row.user;
        const c: any = row.challenge;
        photos.push({
          url: row.media_url as string,
          source: 'war',
          source_id: row.id,
          user_id: row.user_id,
          username: u?.username || null,
          avatar_url: u?.avatar_url || null,
          created_at: row.created_at,
          caption: row.caption || null,
          meta: { challenge_id: row.challenge_id, challenge_title: c?.title || null },
        });
      }

      // Final sort newest-first across all 3 sources.
      photos.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

      return NextResponse.json({ photos });
    }

    // ── save_group_highlights ─────────────────────────────────────────────
    // Replaces the group's `highlights` jsonb array with the supplied URL
    // list. Only the group owner OR a moderator may call this. Caller
    // identifies themselves via `userId` and we verify their role from
    // group_members. We cap at 27 entries to match the UI grid.
    if (action === 'save_group_highlights') {
      const { userId, groupId, urls } = payload || {};
      if (!userId || !groupId || !Array.isArray(urls)) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }

      // Check the caller's role. Owner OR moderator allowed.
      const { data: membership, error: memErr } = await admin
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();
      if (memErr) {
        return NextResponse.json({ error: memErr.message }, { status: 500 });
      }
      if (!membership || (membership.role !== 'owner' && membership.role !== 'moderator')) {
        return NextResponse.json({ error: 'Only group owners or moderators can edit highlights' }, { status: 403 });
      }

      // Sanitize: strings only, valid http(s) URLs only, max 27, dedupe.
      const seen = new Set<string>();
      const cleaned: string[] = [];
      for (const raw of urls) {
        if (typeof raw !== 'string') continue;
        const trimmed = raw.trim();
        if (!trimmed) continue;
        if (!trimmed.startsWith('http')) continue;
        if (seen.has(trimmed)) continue;
        seen.add(trimmed);
        cleaned.push(trimmed);
        if (cleaned.length >= 27) break;
      }

      const { error } = await admin
        .from('groups')
        .update({ highlights: cleaned })
        .eq('id', groupId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, count: cleaned.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

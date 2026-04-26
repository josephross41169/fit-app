import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Mark as dynamic to avoid static collection at build time
export const dynamic = 'force-dynamic';

// Service role — bypasses RLS for trusted server-side operations
// Guard against missing env at build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-build';
const admin = createClient(supabaseUrl, serviceKey);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');

    // ── Get all groups ─────────────────────────────────────────────────────
    if (action === 'get_groups') {
      const { data: groups, error } = await admin
        .from('groups')
        .select('*')
        .order('member_count', { ascending: false });

      if (error) return NextResponse.json({ groups: [] });

      // Check membership for current user
      let memberGroupIds: string[] = [];
      if (userId) {
        const { data: memberships } = await admin
          .from('group_members')
          .select('group_id')
          .eq('user_id', userId);
        memberGroupIds = (memberships || []).map((m: any) => m.group_id);
      }

      const enriched = (groups || []).map((g: any) => ({
        ...g,
        is_member: memberGroupIds.includes(g.id),
      }));

      return NextResponse.json({ groups: enriched });
    }

    // ── Get single group with full details ─────────────────────────────────
    if (action === 'get_group') {
      const groupId = searchParams.get('groupId');
      if (!groupId) return NextResponse.json({ error: 'Missing groupId' }, { status: 400 });

      // Try UUID lookup first, then slug
      let groupData: any = null;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(groupId)) {
        const { data } = await admin.from('groups').select('*').eq('id', groupId).single();
        groupData = data;
      }
      if (!groupData) {
        const { data } = await admin.from('groups').select('*').eq('slug', groupId).single();
        groupData = data;
      }
      if (!groupData) return NextResponse.json({ group: null });

      const gid = groupData.id;

      // Load posts, events, challenges, notes, members in parallel
      const [postsRes, eventsRes, challengesRes, notesRes, membersRes] = await Promise.all([
        admin.from('group_posts')
          .select('*, user:users!group_posts_user_id_fkey(id,username,full_name,avatar_url)')
          .eq('group_id', gid)
          .order('created_at', { ascending: false })
          .limit(20),
        admin.from('group_events')
          .select('*')
          .eq('group_id', gid)
          .order('event_date', { ascending: true }),
        admin.from('challenges')
          .select('*, challenge_participants(user_id, score, users(full_name, username, avatar_url))')
          .eq('group_id', gid)
          .order('created_at', { ascending: false }),
        admin.from('community_notes')
          .select('*, user:users!community_notes_user_id_fkey(id,username,full_name,avatar_url)')
          .eq('group_id', gid)
          .order('created_at', { ascending: false })
          .limit(30),
        admin.from('group_members')
          .select('*, user:users!group_members_user_id_fkey(id,username,full_name,avatar_url)')
          .eq('group_id', gid)
          .order('joined_at', { ascending: true }),
      ]);

      // Check user membership and joined challenges
      let isMember = false;
      let joinedChallengeIds: string[] = [];
      if (userId) {
        const { data: memRow } = await admin
          .from('group_members')
          .select('role')
          .eq('group_id', gid)
          .eq('user_id', userId)
          .single();
        isMember = !!memRow;

        const { data: cpRows } = await admin
          .from('challenge_participants')
          .select('challenge_id')
          .eq('user_id', userId);
        joinedChallengeIds = (cpRows || []).map((r: any) => r.challenge_id);
      }

      // Auto-lock expired challenges
      const nowIso = new Date().toISOString();
      const expiredChallenges = (challengesRes.data || []).filter((ch: any) =>
        ch.is_active && ch.deadline && ch.deadline < nowIso
      );
      if (expiredChallenges.length > 0) {
        await Promise.all(expiredChallenges.map((ch: any) =>
          admin.from('challenges').update({ is_active: false }).eq('id', ch.id)
        ));
        // Update local data
        expiredChallenges.forEach((ch: any) => { ch.is_active = false; });
      }

      return NextResponse.json({
        group: groupData,
        posts: postsRes.data || [],
        events: eventsRes.data || [],
        challenges: challengesRes.data || [],
        notes: notesRes.data || [],
        members: membersRes.data || [],
        is_member: isMember,
        joined_challenge_ids: joinedChallengeIds,
      });
    }

    // ── Get leaderboard for a group ────────────────────────────────────────
    if (action === 'get_leaderboard') {
      const groupId = searchParams.get('groupId');
      const challengeId = searchParams.get('challengeId');
      if (!groupId) return NextResponse.json({ leaderboard: [] });

      let query = admin
        .from('leaderboard_entries')
        // Join challenges so we can filter out entries from completed/inactive challenges.
        // `challenges!inner` enforces that the joined row exists — no orphan entries
        // (where the challenge was deleted but leaderboard_entries rows lingered).
        .select('*, user:users!leaderboard_entries_user_id_fkey(id,username,full_name,avatar_url), challenge:challenges!inner(id,name,emoji,metric_label,is_active,deadline)')
        .eq('group_id', groupId)
        .eq('challenge.is_active', true)  // hide entries from ended/deleted challenges
        .order('score', { ascending: false })
        .limit(50);

      if (challengeId) {
        query = query.eq('challenge_id', challengeId);
      }

      const { data } = await query;

      // Second-pass filter: drop anything whose challenge deadline has passed.
      // The is_active flag above catches explicit deactivation; this catches
      // time-based expiry where is_active wasn't updated.
      const nowIso = new Date().toISOString();
      const filtered = (data || []).filter((entry: any) =>
        !entry.challenge?.deadline || entry.challenge.deadline > nowIso
      );
      return NextResponse.json({ leaderboard: filtered });
    }

    // ── Get user's joined groups ───────────────────────────────────────────
    if (action === 'get_user_groups') {
      const userId = searchParams.get('userId');
      if (!userId) return NextResponse.json({ groups: [] });
      const { data: memberships } = await admin
        .from('group_members')
        .select('group_id, groups(*)')
        .eq('user_id', userId);
      const groups = (memberships || []).map((m: any) => m.groups).filter(Boolean);
      return NextResponse.json({ groups });
    }

    // ── Get event comments ─────────────────────────────────────────────────
    if (action === 'get_event_comments') {
      const eventId = searchParams.get('eventId');
      const { data: comments } = await admin
        .from('group_event_comments')
        .select('*, users(full_name, username)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      return NextResponse.json({
        comments: (comments || []).map((c: any) => ({
          user: c.users?.full_name || c.users?.username || 'Anonymous',
          text: c.content,
          time: new Date(c.created_at).toLocaleTimeString(),
        })),
      });
    }

    // ── Get activity comments ──────────────────────────────────────────────
    if (action === 'get_activity_comments') {
      const cardId = searchParams.get('cardId');
      if (!cardId) return NextResponse.json({ comments: [] });
      const { data } = await admin
        .from('activity_comments')
        .select('*, commenter:users!activity_comments_commenter_id_fkey(id,username,full_name,avatar_url)')
        .eq('activity_card_id', cardId)
        .order('created_at', { ascending: true });
      return NextResponse.json({ comments: data || [] });
    }

    // ── Get local posts by city ────────────────────────────────────────────
    if (action === 'get_local_posts') {
      const city = searchParams.get('city') || 'Las Vegas';
      const cityKey = city.split(',')[0].trim();
      const { data } = await admin
        .from('posts')
        .select('*, user:users!posts_user_id_fkey(id,username,full_name,avatar_url,city)')
        .ilike('location', `%${cityKey}%`)
        .order('created_at', { ascending: false })
        .limit(50);
      return NextResponse.json({ posts: data || [] });
    }

    // ── MODERATION: Get list of users the current user has blocked ─────────
    // Returns user profile info for each blocked user so the settings page
    // can render the list with avatars. Private endpoint — only returns
    // blocks where the caller is the blocker.
    if (action === 'get_blocked_users') {
      if (!userId) return NextResponse.json({ blocked: [] });
      const { data } = await admin
        .from('user_blocks')
        .select('created_at, blocked:users!user_blocks_blocked_id_fkey(id, username, full_name, avatar_url)')
        .eq('blocker_id', userId)
        .order('created_at', { ascending: false });
      return NextResponse.json({ blocked: data || [] });
    }

    return NextResponse.json({ error: 'Unknown GET action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, payload } = await req.json();

    // ── Create or find conversation between two users ──────────────────────
    if (action === 'create_conversation') {
      const { userId, otherUserId } = payload;
      if (!userId || !otherUserId) return NextResponse.json({ error: 'Missing user IDs' }, { status: 400 });

      // Block check: neither party can start a conversation if a block exists
      // in either direction. Returns a clean 403 so the UI can show an error.
      const { data: blockExists } = await admin.from('user_blocks').select('blocker_id')
        .or(`and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`)
        .limit(1);
      if (blockExists && blockExists.length > 0) {
        return NextResponse.json({ error: 'Cannot start conversation with this user' }, { status: 403 });
      }

      // Check existing shared conversation
      const { data: myConvs } = await admin
        .from('conversation_participants').select('conversation_id').eq('user_id', userId);
      const myIds = (myConvs || []).map((c: any) => c.conversation_id);

      if (myIds.length > 0) {
        const { data: shared } = await admin
          .from('conversation_participants').select('conversation_id')
          .eq('user_id', otherUserId).in('conversation_id', myIds);
        if (shared && shared.length > 0) {
          return NextResponse.json({ conversationId: shared[0].conversation_id, existing: true });
        }
      }

      // Create new
      const { data: conv, error } = await admin.from('conversations').insert({}).select().single();
      if (error || !conv) return NextResponse.json({ error: error?.message }, { status: 500 });

      await admin.from('conversation_participants').insert([
        { conversation_id: conv.id, user_id: userId },
        { conversation_id: conv.id, user_id: otherUserId },
      ]);

      return NextResponse.json({ conversationId: conv.id, existing: false });
    }

    // ── Send message ───────────────────────────────────────────────────────
    if (action === 'send_message') {
      const { conversationId, senderId, content } = payload;

      // Block check: find other participants and verify no block in either
      // direction. Using the server ensures a malicious client can't bypass
      // the client-side block filter on the messages page.
      const { data: otherParts } = await admin
        .from('conversation_participants').select('user_id').eq('conversation_id', conversationId).neq('user_id', senderId);
      if (otherParts && otherParts.length > 0) {
        const otherIds = otherParts.map((p: any) => p.user_id);
        const { data: blockExists } = await admin.from('user_blocks').select('blocker_id')
          .or(`and(blocker_id.eq.${senderId},blocked_id.in.(${otherIds.join(',')})),and(blocker_id.in.(${otherIds.join(',')}),blocked_id.eq.${senderId})`)
          .limit(1);
        if (blockExists && blockExists.length > 0) {
          return NextResponse.json({ error: 'Cannot send message' }, { status: 403 });
        }
      }

      const { data, error } = await admin.from('messages').insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Create notification for the other participant
      const { data: participants } = await admin
        .from('conversation_participants').select('user_id').eq('conversation_id', conversationId);
      const others = (participants || []).filter((p: any) => p.user_id !== senderId);
      if (others.length > 0) {
        const { data: sender } = await admin.from('users').select('full_name,username').eq('id', senderId).single();
        await admin.from('notifications').insert(others.map((p: any) => ({
          user_id: p.user_id,
          type: 'message',
          from_user_id: senderId,
          reference_id: conversationId,
          body: `${sender?.full_name || sender?.username || 'Someone'} sent you a message`,
          read: false,
        }))).select(); // ignore errors if table doesn't exist yet
      }

      return NextResponse.json({ message: data });
    }

    // ── Post activity comment ──────────────────────────────────────────────
    // ── Get feed posts (with comments) ──────────────────────────────────────
    // Uses the admin client so the nested comments select isn't filtered by
    // RLS. Without this, the comments come back as empty arrays even when
    // they exist in the DB.
    if (action === 'get_feed_posts') {
      const { viewerId, page, pageSize } = payload || {};
      const PAGE_SIZE = pageSize || 10;
      const PAGE = page || 0;
      const { data, error } = await admin
        .from('posts')
        .select(`*, users (id, username, full_name, avatar_url, tier, logs_last_28_days), comments (id, content, created_at, user_id, users (id, username, full_name, avatar_url))`)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .range(PAGE * PAGE_SIZE, PAGE * PAGE_SIZE + PAGE_SIZE - 1);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Sort each post's comments oldest→newest so the UI displays in
      // chronological order (Supabase nested selects don't guarantee order).
      const sorted = (data || []).map((p: any) => ({
        ...p,
        comments: (p.comments || []).sort((a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      }));

      // Hydrate "_liked" — which posts has the viewer liked?
      let likedPostIds = new Set<string>();
      if (viewerId && sorted.length > 0) {
        const postIds = sorted.map((p: any) => p.id);
        const { data: likeData } = await admin.from('likes')
          .select('post_id').eq('user_id', viewerId).in('post_id', postIds);
        if (likeData) likedPostIds = new Set(likeData.map((l: any) => l.post_id));
      }
      const mapped = sorted.map((p: any) => ({ ...p, _liked: likedPostIds.has(p.id) }));

      return NextResponse.json({ posts: mapped });
    }

    // ── Post a comment on a feed post ──────────────────────────────────────
    // Uses the admin client so it bypasses RLS — same pattern as
    // post_activity_comment / banner uploads, since the policy on the
    // comments table is what was blocking direct client inserts.
    // Returns the newly-inserted row AND the full updated comments list for
    // the post so the client can refresh its UI authoritatively (avoids
    // optimistic-state drift bugs).
    if (action === 'post_feed_comment') {
      const { postId, commenterId, content, postOwnerId } = payload || {};
      if (!postId || !commenterId || !content || !content.trim()) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
      const { data: inserted, error } = await admin.from('comments').insert({
        post_id: postId,
        user_id: commenterId,
        content: content.trim(),
      }).select('id, content, created_at, user_id').single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Fetch full updated comments list for this post (with users joined),
      // using the admin client so RLS doesn't filter rows.
      const { data: comments } = await admin.from('comments')
        .select('id, content, created_at, user_id, users:user_id (id, username, full_name, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      // Notify the post owner (best-effort)
      if (postOwnerId && postOwnerId !== commenterId) {
        try {
          const { data: commenter } = await admin.from('users').select('full_name,username').eq('id', commenterId).single();
          const name = commenter?.full_name || commenter?.username || 'Someone';
          await admin.from('notifications').insert({
            user_id: postOwnerId,
            from_user_id: commenterId,
            type: 'comment',
            reference_id: postId,
            body: `${name} commented: "${content.trim().slice(0, 60)}${content.trim().length > 60 ? '...' : ''}"`,
            read: false,
          });
        } catch { /* notifications schema may differ — non-fatal */ }
      }

      return NextResponse.json({ comment: inserted, comments: comments || [] });
    }

    if (action === 'post_activity_comment') {
      const { cardId, commenterId, content, cardOwnerId } = payload;
      if (!cardId || !commenterId || !content) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
      const { data, error } = await admin.from('activity_comments').insert({
        activity_card_id: cardId,
        commenter_id: commenterId,
        content,
      }).select('*, commenter:users!activity_comments_commenter_id_fkey(id,username,full_name,avatar_url)').single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Notify the card owner if it's someone else's activity
      if (cardOwnerId && cardOwnerId !== commenterId) {
        const { data: commenter } = await admin.from('users').select('full_name,username').eq('id', commenterId).single();
        const name = commenter?.full_name || commenter?.username || 'Someone';
        await admin.from('notifications').insert({
          user_id: cardOwnerId,
          from_user_id: commenterId,
          type: 'activity_comment',
          reference_id: cardId,
          body: `${name} commented on your activity: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
          read: false,
        }).catch(() => {}); // don't fail if notifications table isn't ready yet
      }

      return NextResponse.json({ comment: data });
    }

    // ── Create notification ────────────────────────────────────────────────
    if (action === 'create_notification') {
      const { userId, fromUserId, type, referenceId, body } = payload;
      const { error } = await admin.from('notifications').insert({
        user_id: userId, from_user_id: fromUserId, type, reference_id: referenceId, body, read: false,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ── Get notifications ──────────────────────────────────────────────────
    if (action === 'get_notifications') {
      const { userId } = payload;
      const { data, error } = await admin
        .from('notifications')
        .select('*, from_user:users!notifications_from_user_id_fkey(id,username,full_name,avatar_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) return NextResponse.json({ notifications: [] });
      return NextResponse.json({ notifications: data || [] });
    }

    // ── Mark notifications read ────────────────────────────────────────────
    if (action === 'mark_notifications_read') {
      const { userId } = payload;
      await admin.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
      return NextResponse.json({ ok: true });
    }

    // ── Load conversations for a user ─────────────────────────────────────────
    if (action === 'get_conversations') {
      const { userId } = payload;
      const { data: partRows } = await admin
        .from('conversation_participants').select('conversation_id').eq('user_id', userId);
      if (!partRows || partRows.length === 0) return NextResponse.json({ conversations: [] });
      const convIds = partRows.map((p: any) => p.conversation_id);
      const { data: convRows } = await admin
        .from('conversations')
        .select(`id, created_at, conversation_participants(user_id, users(id,username,full_name,avatar_url)), messages(id,content,created_at,sender_id)`)
        .in('id', convIds);
      const conversations = (convRows || []).map((row: any) => {
        const other = (row.conversation_participants || []).find((p: any) => p.user_id !== userId);
        const msgs = (row.messages || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return {
          id: row.id, created_at: row.created_at,
          otherUser: other?.users || { id:'', username:'Unknown', full_name:'Unknown', avatar_url: null },
          lastMessage: msgs[0] || null,
          unread: msgs[0] ? msgs[0].sender_id !== userId : false,
        };
      }).sort((a: any, b: any) => {
        const at = a.lastMessage?.created_at || a.created_at;
        const bt = b.lastMessage?.created_at || b.created_at;
        return new Date(bt).getTime() - new Date(at).getTime();
      });
      return NextResponse.json({ conversations });
    }

    // ── Load messages for a conversation ──────────────────────────────────────
    if (action === 'get_messages') {
      const { conversationId } = payload;
      const { data, error } = await admin
        .from('messages').select('*').eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) return NextResponse.json({ messages: [] });
      return NextResponse.json({ messages: data || [] });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GROUPS ACTIONS
    // ═══════════════════════════════════════════════════════════════════════

    // ── Create group ───────────────────────────────────────────────────────
    if (action === 'create_group') {
      const { userId, name, description, category, emoji, location, meet_frequency, is_online, tags } = payload;
      if (!userId || !name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const { data: group, error } = await admin.from('groups').insert({
        name,
        description: description || '',
        category: category || 'General',
        emoji: emoji || '💪',
        location: location || null,
        meet_frequency: meet_frequency || null,
        is_online: is_online || false,
        tags: tags || [],
        member_count: 1,
        created_by: userId,
        creator_id: userId,
        slug,
      }).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Add creator as owner
      await admin.from('group_members').insert({
        group_id: group.id,
        user_id: userId,
        role: 'owner',
      });

      return NextResponse.json({ group });
    }

    // ── Join group ─────────────────────────────────────────────────────────
    if (action === 'join_group') {
      const { userId, groupId } = payload;
      if (!userId || !groupId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      // Check if already a member
      const { data: existing } = await admin
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (existing) return NextResponse.json({ ok: true, already: true });

      const { error } = await admin.from('group_members').insert({
        group_id: groupId,
        user_id: userId,
        role: 'member',
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Increment member_count
      await admin.rpc('increment_group_member_count', { gid: groupId }).catch(() => {
        // Fallback: manual increment
        admin.from('groups')
          .select('member_count')
          .eq('id', groupId)
          .single()
          .then(({ data }) => {
            if (data) {
              admin.from('groups').update({ member_count: (data.member_count || 0) + 1 }).eq('id', groupId);
            }
          });
      });

      return NextResponse.json({ ok: true });
    }

    // ── Leave group ────────────────────────────────────────────────────────
    if (action === 'leave_group') {
      const { userId, groupId } = payload;
      if (!userId || !groupId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      await admin.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);

      // Decrement member_count
      const { data: g } = await admin.from('groups').select('member_count').eq('id', groupId).single();
      if (g && g.member_count > 0) {
        await admin.from('groups').update({ member_count: g.member_count - 1 }).eq('id', groupId);
      }

      return NextResponse.json({ ok: true });
    }

    // ── Create group post ──────────────────────────────────────────────────
    if (action === 'create_group_post') {
      const { userId, groupId, content, media_url } = payload;
      if (!userId || !groupId || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      const { data, error } = await admin.from('group_posts').insert({
        group_id: groupId,
        user_id: userId,
        content,
        media_url: media_url || null,
      }).select('*, user:users!group_posts_user_id_fkey(id,username,full_name,avatar_url)').single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ post: data });
    }

    // ── Create group event ─────────────────────────────────────────────────
    if (action === 'create_group_event') {
      const { userId, groupId, name, description, event_date, location, price, emoji } = payload;
      if (!userId || !groupId || !name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      const { data, error } = await admin.from('group_events').insert({
        group_id: groupId,
        creator_id: userId,
        name,
        description: description || null,
        event_date: event_date || null,
        location: location || null,
        price: price || 'Free',
        emoji: emoji || '📅',
      }).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ event: data });
    }

    // ── RSVP event ─────────────────────────────────────────────────────────
    if (action === 'rsvp_event') {
      const { userId, eventId } = payload;
      if (!userId || !eventId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      const { error } = await admin.from('group_event_rsvps').insert({
        event_id: eventId,
        user_id: userId,
      });
      if (error && !error.message.includes('duplicate')) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Increment rsvp_count
      const { data: ev } = await admin.from('group_events').select('rsvp_count').eq('id', eventId).single();
      if (ev) {
        await admin.from('group_events').update({ rsvp_count: (ev.rsvp_count || 0) + 1 }).eq('id', eventId);
      }

      return NextResponse.json({ ok: true });
    }

    // ── Create challenge ───────────────────────────────────────────────────
    if (action === 'create_challenge') {
      const { userId, groupId, name, description, emoji, metric_key, metric_label, metric_unit, difficulty, deadline } = payload;
      if (!userId || !groupId || !name || !metric_label) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      const { data, error } = await admin.from('challenges').insert({
        group_id: groupId,
        creator_id: userId,
        name,
        description: description || null,
        emoji: emoji || '🏆',
        metric_key: metric_key || null,   // null = custom manual; set = auto-tracked
        metric_label,
        metric_unit: metric_unit || null,
        difficulty: difficulty || 'Medium',
        deadline: deadline || null,
        is_active: true,
        participant_count: 0,
      }).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ challenge: data });
    }

    // ── Join challenge ─────────────────────────────────────────────────────
    if (action === 'join_challenge') {
      const { userId, challengeId, groupId } = payload;
      if (!userId || !challengeId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      const { error } = await admin.from('challenge_participants').insert({
        challenge_id: challengeId,
        user_id: userId,
        score: 0,
        log_entries: [],
      });
      if (error && !error.message.includes('duplicate')) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Increment participant_count
      const { data: ch } = await admin.from('challenges').select('participant_count,metric_label').eq('id', challengeId).single();
      if (ch) {
        await admin.from('challenges').update({ participant_count: (ch.participant_count || 0) + 1 }).eq('id', challengeId);
      }

      // Create or update leaderboard entry
      if (groupId) {
        await admin.from('leaderboard_entries').upsert({
          group_id: groupId,
          user_id: userId,
          challenge_id: challengeId,
          score: 0,
          metric_label: ch?.metric_label || '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'group_id,user_id,challenge_id' });
      }

      return NextResponse.json({ ok: true });
    }

    // ── Log challenge progress ─────────────────────────────────────────────
    if (action === 'log_challenge_progress') {
      const { userId, challengeId, groupId, value, note } = payload;
      if (!userId || !challengeId || value === undefined) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      // Get existing participant record
      const { data: cp } = await admin.from('challenge_participants')
        .select('score,log_entries')
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)
        .single();

      if (!cp) return NextResponse.json({ error: 'Not a participant' }, { status: 400 });

      const newEntry = { value: Number(value), note: note || '', logged_at: new Date().toISOString() };
      const newEntries = [...(cp.log_entries || []), newEntry];
      const newScore = (cp.score || 0) + Number(value);

      await admin.from('challenge_participants').update({
        score: newScore,
        log_entries: newEntries,
      }).eq('challenge_id', challengeId).eq('user_id', userId);

      // Update leaderboard
      if (groupId) {
        const { data: ch } = await admin.from('challenges').select('metric_label').eq('id', challengeId).single();
        await admin.from('leaderboard_entries').upsert({
          group_id: groupId,
          user_id: userId,
          challenge_id: challengeId,
          score: newScore,
          metric_label: ch?.metric_label || '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'group_id,user_id,challenge_id' });
      }

      return NextResponse.json({ ok: true, newScore });
    }

    // ── Create community note ──────────────────────────────────────────────
    if (action === 'create_community_note') {
      const { userId, groupId, content, category } = payload;
      if (!userId || !groupId || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      const { data, error } = await admin.from('community_notes').insert({
        group_id: groupId,
        user_id: userId,
        content,
        category: category || 'General',
        likes_count: 0,
      }).select('*, user:users!community_notes_user_id_fkey(id,username,full_name,avatar_url)').single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ note: data });
    }

    // ── Seed groups data (for setup) ───────────────────────────────────────
    if (action === 'seed_groups') {
      const { creatorId, memberIds } = payload;

      // Create "FIT Beta Testers" group
      const slug = 'fit-beta-testers';

      // Check if it already exists
      const { data: existing } = await admin.from('groups').select('id').eq('slug', slug).single();
      if (existing) {
        return NextResponse.json({ ok: true, message: 'Already seeded', groupId: existing.id });
      }

      const { data: group, error: gErr } = await admin.from('groups').insert({
        name: 'FIT Beta Testers',
        description: 'The official group for FIT app beta testers. Share feedback, report bugs, and be part of building something great.',
        category: 'Wellness',
        emoji: '🚀',
        is_online: true,
        tags: ['#BetaTesting', '#FITapp', '#Community'],
        member_count: 1,
        created_by: creatorId,
        slug,
      }).select().single();

      if (gErr || !group) return NextResponse.json({ error: gErr?.message }, { status: 500 });

      const gid = group.id;

      // Add creator as owner
      await admin.from('group_members').insert({ group_id: gid, user_id: creatorId, role: 'owner' });

      // Add additional members
      if (memberIds && memberIds.length > 0) {
        await admin.from('group_members').insert(
          memberIds.map((uid: string) => ({ group_id: gid, user_id: uid, role: 'member' }))
        );
        await admin.from('groups').update({ member_count: 1 + memberIds.length }).eq('id', gid);
      }

      // Add challenge
      const { data: challenge } = await admin.from('challenges').insert({
        group_id: gid,
        creator_id: creatorId,
        name: '30 Day Workout Streak',
        description: 'Work out every day for 30 days. Log each session to track your progress on the leaderboard.',
        emoji: '🔥',
        metric_label: 'Workouts Completed',
        metric_unit: 'sessions',
        difficulty: 'Hard',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
        participant_count: 1,
      }).select().single();

      if (challenge) {
        // Add creator as participant
        await admin.from('challenge_participants').insert({
          challenge_id: challenge.id,
          user_id: creatorId,
          score: 0,
          log_entries: [],
        });

        // Add leaderboard entry
        await admin.from('leaderboard_entries').insert({
          group_id: gid,
          user_id: creatorId,
          challenge_id: challenge.id,
          score: 0,
          metric_label: 'Workouts Completed',
        });
      }

      // Add event
      await admin.from('group_events').insert({
        group_id: gid,
        creator_id: creatorId,
        name: 'First Beta Testing Session',
        description: 'Our first official beta testing session! We\'ll go through the app together, test all features, and collect feedback.',
        event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Online via Discord',
        price: 'Free',
        emoji: '🚀',
      });

      return NextResponse.json({ ok: true, groupId: gid });
    }

    // ── Delete group ───────────────────────────────────────────────────────
    if (action === 'delete_group') {
      const { userId, groupId } = payload;
      if (!userId || !groupId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      const { data: grp } = await admin.from('groups').select('created_by, creator_id').eq('id', groupId).single();
      if (!grp || (grp.created_by !== userId && grp.creator_id !== userId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      await admin.from('groups').delete().eq('id', groupId);
      return NextResponse.json({ success: true });
    }

    // ── Add event comment ──────────────────────────────────────────────────
    if (action === 'add_event_comment') {
      const { eventId, userId, text } = payload;
      if (!eventId || !text) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      const { data: user } = await admin.from('users').select('full_name, username').eq('id', userId).single();
      const userName = user?.full_name || user?.username || 'You';
      const { error } = await admin.from('group_event_comments').insert({
        event_id: eventId,
        user_id: userId || null,
        content: text,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, comment: { user: userName, text, time: 'Just now' } });
    }

    // ── Update group banner ────────────────────────────────────────────────
    if (action === 'update_group_banner') {
      const { groupId, bannerUrl, userId } = payload;
      if (!groupId || !bannerUrl) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      await admin.from('groups').update({ banner_url: bannerUrl }).eq('id', groupId);
      return NextResponse.json({ success: true });
    }

    // ── Delete group challenge (bypasses RLS as service role) ────────────
    if (action === 'delete_group_challenge') {
      const { challengeId } = payload;
      if (!challengeId) return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 });

      // Try group_challenges table first (wars + group goals)
      const { data: gcRow } = await admin.from('group_challenges').select('id').eq('id', challengeId).single();
      if (gcRow) {
        // Delete members (ignore errors if table doesn't exist)
        try { await admin.from('group_challenge_members').delete().eq('challenge_id', challengeId); } catch(e) {}
        // Delete media (ignore errors if table doesn't exist)
        try { await admin.from('group_challenge_media').delete().eq('challenge_id', challengeId); } catch(e) {}
        // Delete the challenge itself
        const { error: delErr } = await admin.from('group_challenges').delete().eq('id', challengeId);
        if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      // Try challenges table (member challenges)
      const { data: cRow } = await admin.from('challenges').select('id').eq('id', challengeId).single();
      if (cRow) {
        await admin.from('challenge_participants').delete().eq('challenge_id', challengeId);
        const { error } = await admin.from('challenges').delete().eq('id', challengeId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // ── MODERATION: Report content or user ─────────────────────────────────
    // Creates a row in the reports table. Duplicate reports (same reporter →
    // same target) are treated as success (idempotent) so clicking report
    // twice doesn't error. The actual content stays visible until a human
    // reviews — reports just flag for moderation queue.
    if (action === 'report_content') {
      const { reporterId, targetType, targetId, reason, details } = payload;
      if (!reporterId || !targetType || !targetId || !reason) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }

      const { error } = await admin.from('reports').upsert({
        reporter_id: reporterId,
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details || null,
      }, { onConflict: 'reporter_id,target_type,target_id' });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── MODERATION: Block a user ─────────────────────────────────────────
    // Upserts a block row. Idempotent so blocking twice is harmless.
    // Also auto-unfollows in both directions — blocked users shouldn't
    // stay in follow relationships since they're effectively invisible.
    if (action === 'block_user') {
      const { blockerId, blockedId, reason } = payload;
      if (!blockerId || !blockedId) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
      if (blockerId === blockedId) {
        return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
      }

      const { error } = await admin.from('user_blocks').upsert({
        blocker_id: blockerId,
        blocked_id: blockedId,
        reason: reason || null,
      }, { onConflict: 'blocker_id,blocked_id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Unfollow in both directions. Safe to fail — the block is what matters.
      await admin.from('follows')
        .delete()
        .or(`and(follower_id.eq.${blockerId},following_id.eq.${blockedId}),and(follower_id.eq.${blockedId},following_id.eq.${blockerId})`);

      return NextResponse.json({ success: true });
    }

    // ── MODERATION: Unblock a user ───────────────────────────────────────
    if (action === 'unblock_user') {
      const { blockerId, blockedId } = payload;
      if (!blockerId || !blockedId) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
      const { error } = await admin.from('user_blocks')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── Delete account (soft delete) ──────────────────────────────────────────
    // Apple requires in-app account deletion. We anonymize PII but keep the
    // user row so foreign keys (posts, badges, messages they sent) don't
    // cascade-delete. After 30 days a scheduled purge can hard-delete if
    // desired. Username is also added to reserved_usernames so nobody can
    // re-register the handle and impersonate.
    //
    // Important: public.users.id FKs auth.users ON DELETE CASCADE. If we
    // delete the auth user here, the cascade wipes our just-anonymized row.
    // Instead we ban the auth user (sets banned_until = far future) which
    // prevents login while preserving the auth row. The frontend's signOut
    // clears the session cookie.
    if (action === 'delete_account') {
      const { userId, reason } = payload;
      if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

      // 1. Grab the user's current handle so we can reserve it
      const { data: u, error: uErr } = await admin
        .from('users')
        .select('username')
        .eq('id', userId)
        .single();
      if (uErr || !u) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      // 2. Reserve the username permanently so nobody can impersonate
      await admin.from('reserved_usernames').upsert({
        username: u.username,
        original_user_id: userId,
        reason: 'account_deleted',
      }, { onConflict: 'username' });

      // 3. Anonymize PII on the user row. The user stays in the table
      //    (so FKs hold) but identifying info is wiped. Display name becomes
      //    "Deleted User" everywhere their posts/comments appear.
      const anonHandle = `deleted_${userId.slice(0, 8)}`;
      const { error: updErr } = await admin
        .from('users')
        .update({
          username: anonHandle,
          full_name: 'Deleted User',
          bio: null,
          avatar_url: null,
          banner_url: null,
          is_private: true,
          deleted_at: new Date().toISOString(),
          deleted_reason: reason || null,
        })
        .eq('id', userId);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      // 4. Ban the auth user so they can't log back in. We use a ~100-year
      //    ban duration as a practical "permanent." Supabase exposes this
      //    via the admin.updateUserById call. If it fails the account is
      //    still effectively dead (anonymized + client-signed-out) but we
      //    log the failure for manual cleanup.
      try {
        await admin.auth.admin.updateUserById(userId, {
          ban_duration: '876000h', // 100 years
        });
      } catch (authErr: any) {
        console.error('[delete_account] auth ban failed (non-fatal):', authErr);
      }

      return NextResponse.json({ success: true });
    }

    // ── Stories ────────────────────────────────────────────────────────────
    // Get all active stories (last 24h) — returns 1 row per user with their
    // most recent story. The feed rail shows one ring per user; tap to see
    // their newest story.
    if (action === 'get_active_stories') {
      const { viewerId } = payload || {};
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: rows, error } = await admin
        .from('stories')
        .select('id, user_id, media_url, media_type, caption, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Dedupe to most recent per user
      const seen = new Set<string>();
      const latestPerUser: any[] = [];
      for (const r of rows || []) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        latestPerUser.push(r);
      }

      // Hydrate with user info (username, avatar, full_name)
      const userIds = latestPerUser.map(s => s.user_id);
      const { data: users } = userIds.length
        ? await admin.from('users').select('id, username, full_name, avatar_url').in('id', userIds)
        : { data: [] };
      const userMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]));

      // Move the viewer's own story to the front so it shows up first in the rail
      const enriched = latestPerUser.map(s => ({
        ...s,
        username: userMap[s.user_id]?.username ?? 'unknown',
        full_name: userMap[s.user_id]?.full_name ?? null,
        avatar_url: userMap[s.user_id]?.avatar_url ?? null,
        is_you: s.user_id === viewerId,
      }));
      enriched.sort((a, b) => {
        if (a.is_you && !b.is_you) return -1;
        if (!a.is_you && b.is_you) return 1;
        return 0;
      });

      return NextResponse.json({ stories: enriched });
    }

    // Get all stories from a single user (last 24h) — used for the viewer
    // when a user has multiple stories queued up.
    if (action === 'get_user_stories') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin
        .from('stories')
        .select('id, user_id, media_url, media_type, caption, created_at')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ stories: data || [] });
    }

    // Post a new story. The client uploads the photo first via uploadPhoto
    // helper and passes the public URL in here.
    if (action === 'post_story') {
      const { userId, mediaUrl, mediaType, caption } = payload || {};
      if (!userId || !mediaUrl) return NextResponse.json({ error: 'Missing userId or mediaUrl' }, { status: 400 });
      const { data, error } = await admin.from('stories').insert({
        user_id: userId,
        media_url: mediaUrl,
        media_type: mediaType || 'image',
        caption: caption || null,
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ story: data });
    }

    // Delete one of your own stories
    if (action === 'delete_my_story') {
      const { userId, storyId } = payload || {};
      if (!userId || !storyId) return NextResponse.json({ error: 'Missing userId or storyId' }, { status: 400 });
      const { error } = await admin.from('stories').delete()
        .eq('id', storyId).eq('user_id', userId); // user_id check enforces ownership
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

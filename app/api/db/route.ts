import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role — bypasses RLS for trusted server-side operations
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { action, payload } = await req.json();

    // ── Create or find conversation between two users ──────────────────────
    if (action === 'create_conversation') {
      const { userId, otherUserId } = payload;
      if (!userId || !otherUserId) return NextResponse.json({ error: 'Missing user IDs' }, { status: 400 });

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

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

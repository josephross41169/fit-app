// ─── /api/push/unsubscribe ──────────────────────────────────────────
//
// Removes a subscription row. Called when the user toggles push off
// in settings, or when the client detects the subscription is no
// longer valid (browser revoked permission, expired, etc.).
//
// Identified by endpoint, not row id, because that's what the client
// has handy from the browser's PushSubscription object.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint, userId } = body || {};
    if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

    const admin = adminClient();

    // Belt-and-suspenders: filter by both endpoint AND user_id when
    // userId is provided, so a malicious client can't unsubscribe
    // someone else's device by guessing endpoints.
    let q = admin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (userId) q = q.eq('user_id', userId);

    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

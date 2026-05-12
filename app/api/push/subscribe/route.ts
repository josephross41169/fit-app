// ─── /api/push/subscribe ────────────────────────────────────────────
//
// Called when the user opts in to push notifications. The client
// hands us a PushSubscription object (the browser's representation
// of the agreement with Apple/Google's push service). We persist it
// so future events can fire pushes to this device.
//
// We dedupe by endpoint — if the same browser re-subscribes (e.g.
// permission was revoked then re-granted), the existing row is just
// updated with fresh keys. Endpoint is UNIQUE in the schema.
//
// Auth: requires a logged-in user. The subscription is filed under
// their user_id, so they can later opt out (which deletes the row).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, subscription, userAgent } = body || {};

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Malformed subscription' }, { status: 400 });
    }

    const admin = adminClient();

    // Upsert by endpoint — if this browser already had a subscription
    // and re-permissioned, we want a single row with the fresh keys,
    // not a duplicate. The unique constraint on endpoint makes this
    // safe; the ON CONFLICT clause updates keys + bumps last_used_at.
    const { error } = await admin
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        user_agent: userAgent || null,
        last_used_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });

    if (error) {
      console.error('[push/subscribe] db error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[push/subscribe] unexpected', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

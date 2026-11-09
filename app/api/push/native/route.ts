// ─── /api/push/native ───────────────────────────────────────────────
// Saves / removes the App Store or Play Store device token for the
// signed-in user (see lib/nativePushClient.ts). The caller must send
// their Supabase access token; the userId in the body must match it.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const adminClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { action, userId, token, platform } = (await req.json()) || {};
    if (!userId || !token || typeof token !== 'string') return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const admin = adminClient();
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!bearer) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const { data } = await admin.auth.getUser(bearer);
    if (!data?.user || data.user.id !== userId) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    if (action === 'unregister') {
      await admin.from('native_push_tokens').delete().eq('token', token).eq('user_id', userId);
      return NextResponse.json({ ok: true });
    }
    if (platform !== 'ios' && platform !== 'android') return NextResponse.json({ error: 'Bad platform' }, { status: 400 });
    // One row per device token; if the phone changes accounts the row moves.
    const { error } = await admin.from('native_push_tokens').upsert(
      { user_id: userId, token, platform, last_used_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

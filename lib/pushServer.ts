// ─── lib/pushServer.ts ──────────────────────────────────────────────
//
// Server-side helper that sends a push notification to a user's
// devices. Called from the event-creation paths (new comment, new
// follower, rivalry match, etc.) — same places that already insert
// notifications rows in the DB.
//
// We send to EVERY active subscription for the user (their iPhone +
// Mac + Android, if all are subscribed). If a subscription errors
// with a 410 Gone or 404 Not Found, that endpoint is dead and we
// delete the row so we stop trying.
//
// Required env vars (set in Vercel project settings):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — public half, also exposed to client
//   VAPID_PRIVATE_KEY             — private half, server only
//   VAPID_SUBJECT                 — "mailto:your-email@example.com"
//
// All calls are fire-and-forget. We never block the main request on
// push delivery; failures get logged but don't fail the event.

import { createClient } from '@supabase/supabase-js';
// web-push handles VAPID JWT signing + the actual HTTPS POST to
// each push service. Without it we'd be reimplementing RFC 8030.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpush = require('web-push');

// Configure VAPID once per cold-start. Subsequent sends reuse it.
let configured = false;
function configureOnce() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) {
    console.warn('[push] VAPID env vars missing — push send disabled');
    return;
  }
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Path to navigate to when the user taps the notification.
   *  Default: "/feed". */
  url?: string;
  /** Collapses repeated notifications. Multiple pushes with the same
   *  tag replace each other instead of stacking. Example: a chatty
   *  rival sending many messages should only show 1 banner; use
   *  tag = `rival:${rivalryId}`. */
  tag?: string;
  /** Custom icon. Defaults to the app icon in the service worker. */
  icon?: string;
}

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Send a push to every active subscription for a given user.
 * Fire-and-forget: never throws, just logs failures.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  configureOnce();
  if (!configured) return; // env vars missing — silently skip

  try {
    const admin = adminClient();
    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh_key, auth_key')
      .eq('user_id', userId);

    if (error || !subs || subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/feed',
      tag: payload.tag,
      icon: payload.icon,
    });

    // Send in parallel — one network round-trip per subscription.
    // We catch per-row errors so one dead device doesn't take out
    // the user's other devices.
    await Promise.all(subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
        }, body);
        // Update last_used_at so we know this device is alive. Skipped
        // on error so dead rows surface clearly.
        await admin.from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: any) {
        // 410 Gone / 404 Not Found = subscription expired. Browser
        // rotated its endpoint or user revoked. Delete the row.
        if (err.statusCode === 410 || err.statusCode === 404) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.warn('[push] send failed', sub.endpoint.slice(-20), err.statusCode || err.message);
        }
      }
    }));
  } catch (err) {
    console.error('[push] sendPushToUser unexpected', err);
  }
}

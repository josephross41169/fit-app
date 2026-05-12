// ─── lib/pushClient.ts ───────────────────────────────────────────────
//
// Client-side helpers for the push notification flow. Three things:
//   1. enablePush(userId)     — request permission, register SW,
//                                subscribe with the push service,
//                                POST to /api/push/subscribe.
//   2. disablePush(userId)    — unsubscribe + tell server to delete
//                                the row.
//   3. getPushStatus()        — what's the current state? Used by the
//                                settings toggle to render correctly.
//
// iOS PWA caveat: web push only works AFTER the app is installed to
// the Home Screen. Mobile Safari (not installed) returns "default"
// permission state and the request gets denied silently. We detect
// this via window.navigator.standalone — if false on iOS, we tell
// the user to install first instead of failing mysteriously.

"use client";

// VAPID public key — exposed to the client so the browser can prove
// pushes for this app come from this server. Configured in Vercel
// env vars; bundled at build time.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

// ── Capability checks ───────────────────────────────────────────────

/** Browser supports the Web Push API at all? */
export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

/** iOS detection — Safari needs to be in standalone (Home Screen) mode
 *  for push to actually work. Returns true on every other platform. */
export function pushAvailableOnThisDevice(): boolean {
  if (!pushSupported()) return false;
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream;
  if (!isIOS) return true;
  // iOS: must be added to Home Screen (standalone mode).
  // Older API: navigator.standalone. Newer: display-mode media query.
  const standaloneLegacy = (navigator as any).standalone === true;
  const standaloneModern = window.matchMedia('(display-mode: standalone)').matches;
  return standaloneLegacy || standaloneModern;
}

// ── State ───────────────────────────────────────────────────────────

export type PushStatus =
  | 'unsupported'   // browser can't do push
  | 'needs-install' // iOS, but not added to Home Screen yet
  | 'denied'        // user blocked notifications
  | 'subscribed'    // ready to receive pushes
  | 'unsubscribed'; // can subscribe; permission granted but no sub yet

/** Synchronous check used by the settings toggle to render the right
 *  button state before kicking off any registration. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  if (!pushAvailableOnThisDevice()) return 'needs-install';
  if (Notification.permission === 'denied') return 'denied';

  // Check whether an active subscription already exists with the
  // service worker on this device.
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'unsubscribed';
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

// ── Subscribe + unsubscribe ─────────────────────────────────────────

/** Convert base64-url VAPID key string → Uint8Array for the
 *  pushManager.subscribe() applicationServerKey param. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Opt this device in. Walks the full flow: register SW → request
 *  permission → subscribe → POST to server. Throws on failure with
 *  a human-readable message so the caller can show an alert. */
export async function enablePush(userId: string): Promise<void> {
  if (!pushSupported()) throw new Error('This browser does not support push notifications.');
  if (!pushAvailableOnThisDevice()) {
    throw new Error(
      'On iPhone, push notifications only work after you add Livelee to your Home Screen. ' +
      'Tap the Share button in Safari → "Add to Home Screen", then open from there and try again.'
    );
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Push not configured (missing public key). Tell Joey.');
  }

  // 1. Register the service worker. If already registered, this returns
  // the existing registration immediately.
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // 2. Request permission. Must be triggered from a user gesture, so
  // the caller (settings toggle click handler) needs to call this
  // directly from onClick.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked in your browser settings. Enable them in Settings → Safari (or Chrome) → Notifications to use this.'
        : 'Notification permission was not granted.'
    );
  }

  // 3. Subscribe with the browser's push service. Returns an object
  // with endpoint + p256dh + auth keys.
  let subscription;
  try {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true, // required by browsers — every push must show UI
      // Cast through any: the DOM type union expects BufferSource | null but
      // Uint8Array satisfies that at runtime; the type lib in this Next.js
      // version is stricter than the spec.
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
    });
  } catch (err: any) {
    throw new Error('Browser refused to create push subscription: ' + (err.message || 'unknown'));
  }

  // 4. POST to our server to persist the subscription. Future events
  // for this user will fan out to this endpoint.
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save subscription on server');
  }
}

/** Opt out. Unsubscribes locally + tells server to drop the row. */
export async function disablePush(userId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, endpoint }),
      });
    }
  } catch (err) {
    console.warn('[push] disable failed:', err);
  }
}

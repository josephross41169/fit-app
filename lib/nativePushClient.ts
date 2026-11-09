// ─── lib/nativePushClient.ts ────────────────────────────────────────
// Phone notifications for the App Store / Play Store builds.
//
// Web push (lib/pushClient.ts) doesn't exist inside the native app's
// WebView, so the native builds use @capacitor/push-notifications:
//   1. ask permission, 2. register with Apple (APNs) / Google (FCM),
//   3. send the device token to /api/push/native so the server can
//      push to it (lib/nativePushServer.ts),
//   4. when a notification is tapped, open the page it points at.
//
// ANDROID: registering without Firebase configured (android/app/
// google-services.json) crashes the app, so Android stays off until
// ANDROID_PUSH_READY is flipped after that file is added.
// ─────────────────────────────────────────────────────────────────────

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const ANDROID_PUSH_READY = false;

export function nativePushAvailable(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const p = Capacitor.getPlatform();
  return p === 'ios' || (p === 'android' && ANDROID_PUSH_READY);
}

let listenersAdded = false;
let currentUserId: string | null = null;

function addListenersOnce(onOpen: (url: string) => void) {
  if (listenersAdded) return;
  listenersAdded = true;

  PushNotifications.addListener('registration', async ({ value }) => {
    if (!currentUserId || !value) return;
    try {
      await fetch('/api/push/native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', userId: currentUserId, token: value, platform: Capacitor.getPlatform() }),
      });
      try { localStorage.setItem('livelee_native_push_token', value); } catch {}
    } catch (e) {
      console.warn('[native-push] could not save token', e);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('[native-push] registration failed', err);
  });

  // Tapped a notification → go to the page it's about.
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = (action.notification?.data as any)?.url;
    if (typeof url === 'string' && url.startsWith('/')) onOpen(url);
  });
}

/**
 * Register this phone for notifications. `prompt` = may show the iOS
 * permission dialog (false = only re-register if already allowed).
 * Returns the resulting permission state.
 */
export async function registerNativePush(userId: string, onOpen: (url: string) => void, prompt = true): Promise<'granted' | 'denied' | 'prompt'> {
  if (!nativePushAvailable()) return 'denied';
  currentUserId = userId;
  addListenersOnce(onOpen);
  let perm = await PushNotifications.checkPermissions();
  if ((perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') && prompt) {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive === 'granted') {
    await PushNotifications.register();
    return 'granted';
  }
  return perm.receive === 'denied' ? 'denied' : 'prompt';
}

export async function nativePushPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!nativePushAvailable()) return 'denied';
  const perm = await PushNotifications.checkPermissions();
  return perm.receive === 'granted' ? 'granted' : perm.receive === 'denied' ? 'denied' : 'prompt';
}

/** Stop notifications to this phone (settings toggle off / sign out). */
export async function unregisterNativePush(userId: string): Promise<void> {
  if (!nativePushAvailable()) return;
  let token: string | null = null;
  try { token = localStorage.getItem('livelee_native_push_token'); } catch {}
  try { await PushNotifications.unregister(); } catch {}
  if (token) {
    await fetch('/api/push/native', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unregister', userId, token }),
    }).catch(() => {});
    try { localStorage.removeItem('livelee_native_push_token'); } catch {}
  }
}

// ─── Livelee push notification service worker ──────────────────────
//
// Lives at /sw.js (public/sw.js → served from root). Browser registers
// this file once per device when the user opts in. After that, the
// browser keeps it running in the background — even when your tabs are
// closed — and wakes it up when a push arrives from Apple/Google's push
// service.
//
// Two events to handle:
//   1. 'push' — a push payload arrived. Show a notification banner.
//   2. 'notificationclick' — user tapped the banner. Open the app
//      to the right page.
//
// Notification payload shape (set by server-side push send):
//   { title, body, icon?, badge?, tag?, url? }
//
// `tag` collapses multiple notifications of the same kind so a chatty
// rival doesn't spam 20 lock-screen banners — only the latest shows.
// `url` is the path to open when tapped (e.g. /post/abc123).

const APP_ICON = '/icon-192.png';   // 192x192 icon for the banner
const APP_BADGE = '/badge-96.png';  // 96x96 small monochrome (iOS uses this)

self.addEventListener('push', (event) => {
  // Some browsers send empty pushes ("keep-alive"). Ignore those.
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    // Fallback: treat raw text as the body.
    payload = { title: 'Livelee', body: event.data.text() };
  }

  const title = payload.title || 'Livelee';
  const options = {
    body: payload.body || '',
    icon: payload.icon || APP_ICON,
    badge: payload.badge || APP_BADGE,
    tag: payload.tag || undefined,
    // Pass the URL through so notificationclick knows where to navigate.
    data: { url: payload.url || '/feed' },
    // Vibration pattern (Android only — iOS ignores). Two short pulses.
    vibrate: [80, 40, 80],
    // Re-fire even if a previous notification with the same tag is
    // still up. Otherwise iOS silently swallows the second one.
    renotify: !!payload.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/feed';

  // If the app's already open in some window, focus that and navigate.
  // Otherwise open a fresh window/PWA.
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      // Same origin already open? Focus + navigate.
      if (client.url.includes(self.location.origin) && 'focus' in client) {
        client.navigate(targetUrl).catch(() => {});
        return client.focus();
      }
    }
    // No window open; open a new one.
    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});

// Skip-waiting + claim — so a new SW version takes over immediately
// instead of waiting for all old tabs to close. Otherwise users might
// run old SW code for days.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

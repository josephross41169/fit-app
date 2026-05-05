import { CapacitorConfig } from '@capacitor/cli';

// ─────────────────────────────────────────────────────────────────────────────
// Livelee — Capacitor configuration for iOS + Android wrappers.
//
// IMPORTANT: appId MUST match the bundle ID registered with Apple in App
// Store Connect (com.liveleeapp.app). Changing it would create a brand new
// app entry on Apple's side and lose all current testers.
//
// ─────────────────────────────────────────────────────────────────────────────
// SAFARI ESCAPE FIX
// ─────────────────────────────────────────────────────────────────────────────
// The previous config had a `server: { url: 'https://liveleeapp.com' }` block.
// That made Capacitor a thin Safari wrapper around the live web site, which
// caused OAuth and share flows to escape the WebView (and TestFlight builds
// to behave like a Safari shortcut instead of a real app).
//
// We now bundle the static export (`out/`) into the binary via `webDir: 'out'`.
// The mobile build uses `npm run build:mobile` which sets
// `NEXT_BUILD_TARGET=mobile`, producing a static export. API calls are
// redirected to the live site at runtime by `lib/mobileFetchShim.ts`.
// ─────────────────────────────────────────────────────────────────────────────
const config: CapacitorConfig = {
  appId: 'com.liveleeapp.app',
  appName: 'Livelee',
  webDir: 'out',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0E0820',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0E0820',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'automatic',
    // The WebView talks to https://liveleeapp.com for /api/*. Don't let the
    // shell try to open that domain in Safari — keep navigation in-app.
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;

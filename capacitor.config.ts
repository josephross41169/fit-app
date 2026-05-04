import { CapacitorConfig } from '@capacitor/cli';

// ─────────────────────────────────────────────────────────────────────────────
// Livelee — Capacitor configuration for iOS + Android wrappers.
//
// IMPORTANT: appId is the permanent bundle identifier registered with Apple
// once the app is submitted to TestFlight or the App Store. Changing it later
// means re-submitting as a brand new app and losing reviews/users. Do not
// modify after first submission.
//
// Format: reverse-domain notation. Domain `liveleeapp.com` reversed is
// `com.liveleeapp`, plus the app name `app`.
// ─────────────────────────────────────────────────────────────────────────────
const config: CapacitorConfig = {
  appId: 'com.liveleeapp.app',
  appName: 'Livelee',
  webDir: 'out',
  // ─── No `server` block ───────────────────────────────────────────────
  // Removing server.url makes Capacitor load bundled assets instead of
  // pointing the WebView at a remote URL. This was the cause of the
  // TestFlight Safari issue: with server.url set, navigation could
  // escape the WebView in some flows. Bundled mode keeps everything
  // sandboxed inside the app.
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
    // Apple REQUIRES plain-English explanations of why the app uses each
    // sensitive permission. Missing or vague strings are the #1 reason iOS
    // builds get rejected at App Review. Each string lands in Info.plist
    // under the corresponding NS*UsageDescription key when Capacitor syncs.
    contentInset: 'automatic',
  },
};

export default config;

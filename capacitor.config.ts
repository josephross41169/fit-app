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
  server: {
    // Production URL — points at the live site. Capacitor wraps the deployed
    // web app rather than embedding a static build, so any code push that
    // ships to Vercel reaches the iOS/Android shell instantly without a
    // store re-submission. (Native code changes still require re-submission.)
    url: 'https://liveleeapp.com',
    cleartext: false,
  },
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
    // Edit if any feature wording changes — these texts are user-facing
    // (shown in the iOS permission prompt).
    contentInset: 'automatic',
  },
};

export default config;

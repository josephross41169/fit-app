// Side-effect import: installs the mobile /api/* fetch redirect (no-op on web).
// MUST stay at the very top so it runs before any API call fires.
import './mobileFetchShim'

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key-for-build'

// ── Native-aware auth storage ────────────────────────────────────────────────
// Why: on iOS Capacitor WebView, localStorage is NOT durable across app
// suspends/restarts — iOS purges WebView storage to reclaim memory, which kicks
// the user back to the login screen every time they reopen the app. We bridge
// supabase-js's session persistence to @capacitor/preferences, which is backed
// by the iOS Keychain (and SharedPreferences on Android) and survives restarts.
//
// supabase-js v2 fully supports an ASYNC storage adapter (it `await`s every
// getItem/setItem/removeItem). That matters a lot here:
//   • READ: getSession() awaits getItem, so it blocks until the persisted
//     session has actually been read back from the Keychain. The previous
//     implementation read from an in-memory cache that filled asynchronously,
//     so the very first getSession() on launch saw an empty cache and reported
//     "no session" → instant logout. Awaiting the real read fixes that race.
//   • WRITE: setItem awaits the Keychain write, so when supabase rotates the
//     refresh token it's flushed to disk before the app can be backgrounded.
//     Fire-and-forget writes could be dropped mid-flight, leaving a stale
//     (already-rotated) refresh token that fails on next launch → logout.
//
// On web (claude.ai, vercel preview, liveleeapp.com) we keep plain localStorage
// so nothing changes there.

type AnyStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

// Read at module load to know if we're in a Capacitor shell. The Capacitor
// global is injected by the native runtime before any JS executes.
const isNative = (() => {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  // Capacitor 4+ exposes isNativePlatform; older versions only have platform.
  if (cap?.isNativePlatform) return cap.isNativePlatform();
  return cap?.platform === 'ios' || cap?.platform === 'android';
})();

// Native: async adapter backed by @capacitor/preferences (Keychain on iOS).
function buildNativeStorage(): AnyStorage {
  let prefs: any = null;
  // Lazy-load the plugin so the bundle still works on web (where this file is
  // also imported but isNative is false and these methods never run).
  const loadPlugin = async () => {
    if (prefs) return prefs;
    const mod = await import('@capacitor/preferences');
    prefs = mod.Preferences;
    return prefs;
  };
  return {
    async getItem(key: string): Promise<string | null> {
      try {
        const p = await loadPlugin();
        const { value } = await p.get({ key });
        return value ?? null;
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        const p = await loadPlugin();
        await p.set({ key, value });
      } catch {}
    },
    async removeItem(key: string): Promise<void> {
      try {
        const p = await loadPlugin();
        await p.remove({ key });
      } catch {}
    },
  };
}

// Web fallback — plain localStorage. Behavior unchanged for non-Capacitor
// environments (browser tabs + the Safari "Add to Home Screen" PWA).
function buildWebStorage(): AnyStorage {
  return {
    getItem(key: string): string | null {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    setItem(key: string, value: string): void {
      try { window.localStorage.setItem(key, value); } catch {}
    },
    removeItem(key: string): void {
      try { window.localStorage.removeItem(key); } catch {}
    },
  };
}

// Pick the right storage. On SSR (typeof window === 'undefined'), pass
// undefined so supabase-js falls back to its own no-op storage — there's no
// session to persist server-side anyway.
const authStorage: AnyStorage | undefined = (() => {
  if (typeof window === 'undefined') return undefined;
  return isNative ? buildNativeStorage() : buildWebStorage();
})();

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage as any,
  },
})

// Back-compat: previously this gated callers until a prewarm finished. The
// async storage adapter makes that unnecessary (getSession awaits the real
// read), but keep the export resolved so any older caller keeps working.
export const nativeStorageReady: Promise<void> = Promise.resolve();

export type { Database }

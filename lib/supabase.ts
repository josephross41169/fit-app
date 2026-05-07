// Side-effect import: installs the mobile /api/* fetch redirect (no-op on web).
// MUST stay at the very top so it runs before any API call fires.
import './mobileFetchShim'

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key-for-build'

// ── Native-aware auth storage ────────────────────────────────────────────────
// Why: on iOS Capacitor WebView, localStorage is NOT durable across app
// suspends/restarts. iOS will purge WebView storage to reclaim memory, which
// kicks the user back to the login screen every time they reopen the app.
// The fix is to bridge supabase-js's session persistence to a native key-value
// store that's backed by iOS Keychain on iOS and SharedPreferences on Android.
//
// We use @capacitor/preferences only when running on a native platform
// (Capacitor.isNativePlatform() === true). On web (claude.ai, vercel preview,
// liveleeapp.com) we keep using localStorage so nothing changes there.
//
// IMPORTANT: supabase-js calls these methods synchronously on hydrate, but
// Capacitor Preferences is async. We cache values in-memory the first time
// they're read so subsequent gets are sync and fast. The first hydrate after
// app launch will look at the in-memory cache (empty) and miss — but
// supabase-js follows up immediately with autoRefreshToken which calls
// getItem again, by which point the async load has populated the cache.
//
// In practice we also pre-warm the cache at module load (see below) so the
// initial getSession() resolves with the persisted session.

type SyncStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
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

// Build a synchronous storage adapter. Reads from in-memory cache; writes
// flush to native preferences asynchronously (fire-and-forget). On every
// write we also update the cache so the next read sees the new value.
function buildNativeStorage(): SyncStorage {
  const cache = new Map<string, string>();
  let prefs: any = null;

  // Lazy-load the plugin so the bundle still works on web (where this file
  // is also imported but isNative is false).
  const loadPlugin = async () => {
    if (prefs) return prefs;
    try {
      const mod = await import('@capacitor/preferences');
      prefs = mod.Preferences;
      return prefs;
    } catch {
      return null;
    }
  };

  // Pre-warm the cache with all previously-stored auth keys. supabase-js
  // uses keys prefixed with `sb-`. We can't enumerate native preferences
  // easily, so we pre-warm by querying the specific keys supabase asks for
  // when getSession() runs. To be safe, we also pull a known fallback list.
  const prewarm = async () => {
    const p = await loadPlugin();
    if (!p) return;
    try {
      // The main session key has a project-ref-derived suffix — we don't
      // know it ahead of time, so we ask the plugin for all keys.
      const { keys } = await p.keys();
      for (const k of (keys || [])) {
        if (k.startsWith('sb-')) {
          const { value } = await p.get({ key: k });
          if (value !== null && value !== undefined) cache.set(k, value);
        }
      }
    } catch (e) {
      console.warn('[supabase] prewarm preferences failed:', e);
    }
  };

  // Kick off the prewarm immediately. The promise is awaited via
  // `nativeStorageReady` exported below so callers can wait on it before
  // relying on getSession().
  const ready = prewarm();
  (window as any).__nativeStorageReady = ready;

  return {
    getItem(key: string): string | null {
      return cache.has(key) ? (cache.get(key) as string) : null;
    },
    setItem(key: string, value: string): void {
      cache.set(key, value);
      // Fire-and-forget — supabase-js doesn't await this.
      loadPlugin().then(p => {
        if (p) p.set({ key, value }).catch(() => {});
      });
    },
    removeItem(key: string): void {
      cache.delete(key);
      loadPlugin().then(p => {
        if (p) p.remove({ key }).catch(() => {});
      });
    },
  };
}

// Web fallback — just use localStorage directly. Behavior unchanged for
// non-Capacitor environments.
function buildWebStorage(): SyncStorage {
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
// undefined so supabase-js falls back to its own no-op storage — there's
// no session to persist server-side anyway.
const authStorage: SyncStorage | undefined = (() => {
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

// Wait for native storage to finish loading the persisted session before
// running any auth-dependent code. On web this resolves immediately.
// Usage: `await nativeStorageReady; const { data } = await supabase.auth.getSession();`
export const nativeStorageReady: Promise<void> = (() => {
  if (typeof window === 'undefined' || !isNative) return Promise.resolve();
  return ((window as any).__nativeStorageReady as Promise<void>) || Promise.resolve();
})();

export type { Database }

// Side-effect import: installs the mobile /api/* fetch redirect (no-op on web).
// MUST stay at the very top so it runs before any API call fires.
import './mobileFetchShim'

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key-for-build'

// ── Are we inside the native Capacitor shell? ────────────────────────────────
// Detected from the document's URL scheme, NOT from window.Capacitor. The native
// runtime serves the bundle from `capacitor://localhost` (iOS), and that origin
// is fixed before any JS runs — whereas window.Capacitor is injected by a plugin
// script that can land AFTER this module is imported (so reading it here was
// unreliable and could mis-report native as web on a cold launch). The scheme
// check is always correct.
const isNativeShell = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    const proto = window.location.protocol;
    return proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:';
  } catch {
    return false;
  }
})();

// ── THE LOGIN-HANG FIX ───────────────────────────────────────────────────────
// supabase-js v2 serializes every auth/token operation behind a lock. In a real
// browser it uses the Web Locks API (navigator.locks). Inside the iOS WKWebView
// (capacitor:// origin) navigator.locks.request() can never be granted, the
// callback never runs, and signInWithPassword() hangs forever — the login screen
// then shows "Sign in is taking too long." We replace it (native only) with a
// tiny in-memory lock that serializes calls within the page and ALWAYS resolves,
// so sign-in can't hang. The web app keeps the default navigator lock (it works
// there and coordinates across browser tabs).
//
// Signature matches supabase-js's LockFunc: (name, acquireTimeout, fn) => Promise.
let lockChain: Promise<unknown> = Promise.resolve();
const inMemoryLock = <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const result: Promise<R> = lockChain.then(() => fn(), () => fn());
  // Keep the queue moving; never let one rejection break future acquisitions.
  lockChain = result.then(() => undefined, () => undefined);
  return result;
};

// Bound any async storage call so a slow/hung Keychain op can never block the
// auth flow — resolves to a fallback after `ms` (well under the login screen's
// 8s timeout). Normal Keychain reads/writes are <100ms so this never fires in
// practice; it only defuses a true hang.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const finish = (v: T) => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => finish(fallback), ms);
    p.then(
      (v) => { clearTimeout(timer); finish(v); },
      () => { clearTimeout(timer); finish(fallback); },
    );
  });
}

// ── Native-aware auth storage ────────────────────────────────────────────────
// Persist the session in the iOS Keychain via @capacitor/preferences so it
// survives app restarts; plain localStorage on web.
type AnyStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

// Native: async adapter backed by @capacitor/preferences (Keychain on iOS),
// with a synchronous in-memory mirror in front of it.
//
// WHY THE MIRROR (the post-login slow-load fix): supabase-js re-reads storage on
// EVERY getSession(), and every DB query calls getSession() to attach the access
// token. A screen that fires dozens of queries on open (the profile page does)
// therefore triggers dozens of reads. On web that's instant localStorage; on iOS
// each read is a Capacitor bridge round-trip to the native store, and — because
// the auth lock serializes them — they stack up into a long blank load (~30s).
// The mirror serves reads from memory: the FIRST read of a key still hits the
// bridge (so the persisted session is correctly restored on a cold launch), and
// every read after is instant. supabase-js is the only writer of these keys, so
// the mirror can't go stale; writes are still flushed to the native store so the
// session survives app restarts.
function buildNativeStorage(): AnyStorage {
  let prefs: any = null;
  const mirror = new Map<string, string | null>();
  // Lazy-load the plugin so the bundle still works on web (where this file is
  // also imported but isNativeShell is false and these methods never run).
  const loadPlugin = async () => {
    if (prefs) return prefs;
    const mod = await import('@capacitor/preferences');
    prefs = mod.Preferences;
    return prefs;
  };
  return {
    getItem(key: string): string | null | Promise<string | null> {
      // Cache hit → return synchronously, no bridge round-trip. This is what
      // collapses the dozens-of-reads-per-screen cost to a single first read.
      if (mirror.has(key)) return mirror.get(key) ?? null;
      return withTimeout((async () => {
        try {
          const p = await loadPlugin();
          const { value } = await p.get({ key });
          return value ?? null;
        } catch {
          return null;
        }
      })(), 4000, null).then((v) => {
        mirror.set(key, v);
        return v;
      });
    },
    setItem(key: string, value: string): Promise<void> {
      mirror.set(key, value); // keep the mirror current immediately
      return withTimeout((async () => {
        try {
          const p = await loadPlugin();
          await p.set({ key, value });
        } catch {}
      })(), 4000, undefined);
    },
    removeItem(key: string): Promise<void> {
      mirror.set(key, null);
      return withTimeout((async () => {
        try {
          const p = await loadPlugin();
          await p.remove({ key });
        } catch {}
      })(), 4000, undefined);
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

// Pick the right storage. On SSR (typeof window === 'undefined'), pass undefined
// so supabase-js falls back to its own no-op storage — there's no session to
// persist server-side anyway.
const authStorage: AnyStorage | undefined = (() => {
  if (typeof window === 'undefined') return undefined;
  return isNativeShell ? buildNativeStorage() : buildWebStorage();
})();

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage as any,
    // Native only: avoid navigator.locks, which hangs inside the iOS WebView.
    // (Conditional spread so nothing changes for the web build.)
    ...(isNativeShell ? { lock: inMemoryLock } : {}),
  },
})

// Back-compat: previously this gated callers until a prewarm finished. The async
// storage adapter makes that unnecessary (getSession awaits the real read), but
// keep the export resolved so any older caller keeps working.
export const nativeStorageReady: Promise<void> = Promise.resolve();

export type { Database }

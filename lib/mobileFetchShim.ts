// ─────────────────────────────────────────────────────────────────────────────
// lib/mobileFetchShim.ts
// ─────────────────────────────────────────────────────────────────────────────
// On the native iOS/Android shell, the WebView serves files from
// `capacitor://localhost`. A relative `/api/...` fetch resolves to
// `capacitor://localhost/api/...` — which is the local bundle, not our API,
// so every API call would 404 and features that rely on /api (e.g. Groups)
// silently come back empty.
//
// This installs a one-time `window.fetch` override that rewrites any relative
// `/api/...` request to the absolute live API (https://liveleeapp.com/api/...)
// when running inside the native shell.
//
// IMPORTANT (the bug this fixes): the native check is now evaluated at FETCH
// TIME, not at import time. The previous version decided "am I native?" the
// instant this module was imported — but Capacitor injects `window.Capacitor`
// asynchronously, so if app code imported this before the bridge was ready,
// the shim turned itself off for the entire session and every /api call broke.
// We also detect the native context by the `capacitor:`/`ionic:`/`file:`
// origin, which is reliable regardless of when the Capacitor object appears.
//
// On the web (Vercel) build the page origin is https://… so `shouldRewrite()`
// is always false and fetches pass through unchanged — identical behaviour.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'https://liveleeapp.com';

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
    __liveleeFetchShimInstalled?: boolean;
  }
}

if (typeof window !== 'undefined' && !window.__liveleeFetchShimInstalled) {
  const originalFetch = window.fetch.bind(window);

  // Evaluated per-call so the Capacitor bridge / origin are guaranteed ready
  // by the time any real API request fires.
  const shouldRewrite = (): boolean => {
    try {
      if (window.Capacitor?.isNativePlatform?.()) return true;
      const proto = window.location.protocol;
      if (proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:') return true;
    } catch {
      /* ignore */
    }
    return false;
  };

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (shouldRewrite()) {
      // String URL starting with `/api/` → rewrite to absolute live API.
      if (typeof input === 'string' && input.startsWith('/api/')) {
        return originalFetch(API_BASE + input, init);
      }

      // URL object on the local origin pointing at /api/* → rewrite.
      if (input instanceof URL && input.pathname.startsWith('/api/')) {
        return originalFetch(API_BASE + input.pathname + input.search, init);
      }

      // Request object on the local origin pointing at /api/* → rebuild.
      if (input instanceof Request && input.url) {
        try {
          const u = new URL(input.url, window.location.href);
          if (u.pathname.startsWith('/api/') &&
              (u.origin === window.location.origin ||
               u.protocol === 'capacitor:' || u.protocol === 'ionic:' || u.protocol === 'file:')) {
            const rewritten = new Request(API_BASE + u.pathname + u.search, input);
            return originalFetch(rewritten, init);
          }
        } catch {
          /* fall through to passthrough */
        }
      }
    }

    return originalFetch(input as RequestInfo, init);
  }) as typeof fetch;

  window.__liveleeFetchShimInstalled = true;
}

export {};

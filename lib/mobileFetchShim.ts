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
    __liveleeAccessToken?: string | null;
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

  // Attach the signed-in user's access token to our own /api/ calls so the
  // server can verify WHO is calling (lib/auth.tsx keeps the token current).
  // Only for /api/ paths, and never overrides an Authorization the caller set.
  const withAuth = (input: RequestInfo | URL, init?: RequestInit): RequestInit | undefined => {
    try {
      const token = window.__liveleeAccessToken;
      if (!token) return init;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = new URL(url, window.location.href).pathname;
      if (!path.startsWith('/api/')) return init;
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      return { ...init, headers };
    } catch {
      return init;
    }
  };

  // On a fast app start the screen can fire /api calls before the session
  // check has finished (no token yet). For those, wait for the token instead
  // of sending an unauthenticated request.
  const needsTokenWait = (input: RequestInfo | URL): boolean => {
    try {
      if (window.__liveleeAccessToken || !(window as any).__liveleeGetToken) return false;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return new URL(url, window.location.href).pathname.startsWith('/api/');
    } catch { return false; }
  };

  const shimmedFetch = (input: RequestInfo | URL, init0?: RequestInit): Promise<Response> => {
    const init = withAuth(input, init0);
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
  };

  window.fetch = ((input: RequestInfo | URL, init0?: RequestInit) => {
    if (needsTokenWait(input)) {
      return (async () => {
        try {
          const t = await (window as any).__liveleeGetToken();
          if (t && !window.__liveleeAccessToken) window.__liveleeAccessToken = t;
        } catch { /* send without a token, as before */ }
        return shimmedFetch(input, init0);
      })();
    }
    return shimmedFetch(input, init0);
  }) as typeof fetch;

  window.__liveleeFetchShimInstalled = true;
}

export {};

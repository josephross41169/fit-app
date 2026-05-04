// ─────────────────────────────────────────────────────────────────────────────
// lib/mobileFetchShim.ts
// ─────────────────────────────────────────────────────────────────────────────
// On the native iOS/Android shell, the WebView serves files from
// `capacitor://localhost`. A relative `/api/...` fetch resolves to
// `capacitor://localhost/api/...` — which is the local bundle, not our API,
// so every API call would 404.
//
// This module installs a one-time `window.fetch` override that rewrites any
// relative `/api/...` request to the absolute live API
// (https://liveleeapp.com/api/...) ONLY when running inside Capacitor.
//
// On the web (Vercel) build, Capacitor isn't present, the override is a no-op,
// and fetches stay relative — same behaviour as today.
//
// We import this from `lib/supabase.ts` so it runs before any API call fires
// (every part of the app touches supabase early).
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
  const isNative = !!window.Capacitor?.isNativePlatform?.();

  if (isNative) {
    const originalFetch = window.fetch.bind(window);

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
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
              (u.origin === window.location.origin || u.protocol === 'capacitor:')) {
            const rewritten = new Request(API_BASE + u.pathname + u.search, input);
            return originalFetch(rewritten, init);
          }
        } catch {
          /* fall through to passthrough */
        }
      }

      return originalFetch(input as RequestInfo, init);
    }) as typeof fetch;

    window.__liveleeFetchShimInstalled = true;
  }
}

export {};

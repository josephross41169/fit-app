/** @type {import('next').NextConfig} */
// ─── Next.js config — dual-mode (web + mobile) ──────────────────────────
// When NEXT_BUILD_TARGET=mobile is set, we produce a static export for
// Capacitor to bundle. Otherwise (Vercel builds), we run as a normal
// server-rendered Next app with /api/* routes intact.
//
// To build for mobile locally: `npm run build:mobile`
// Vercel: leave the env var unset — site builds normally as before.
const isMobile = process.env.NEXT_BUILD_TARGET === 'mobile';

const nextConfig = {
  ...(isMobile && {
    output: 'export',
    images: { unoptimized: true },
    trailingSlash: true,
  }),
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // ─── Cache-Control headers (web/Vercel build only) ─────────────────
  // Why: the desktop-vs-mobile "gold" mismatch was a STALE BUNDLE being
  // served, not a code bug. The PR card renders one gold gradient from a
  // single shared component — when two surfaces disagree, one is running
  // cached old code. The durable fix is to never let the HTML *document*
  // be cached: the document references content-hashed JS/CSS, so as long
  // as clients always re-fetch a fresh document, they pick up the newest
  // hashed bundles automatically.
  //
  //   - HTML documents / data → no-cache (always revalidate)
  //   - Next's hashed static assets (/_next/static/*) → cache forever
  //     (the hash in the filename changes every build, so this is safe)
  //
  // Skipped entirely for the mobile static export (output:'export' does
  // not support a headers() function — Capacitor serves files locally).
  ...(!isMobile && {
    async headers() {
      return [
        {
          // Immutable, content-hashed build assets — safe to cache hard.
          source: '/_next/static/:path*',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          ],
        },
        {
          // Service worker must never be cached, or new SW logic stalls.
          source: '/sw.js',
          headers: [
            { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          ],
        },
        {
          // Everything else (HTML documents, routes) — always revalidate
          // so a fresh deploy reaches every client on next navigation.
          source: '/:path*',
          headers: [
            { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;

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
};

export default nextConfig;

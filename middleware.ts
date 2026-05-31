// ─────────────────────────────────────────────────────────────────────────────
// middleware.ts (root)
// ─────────────────────────────────────────────────────────────────────────────
// CORS for /api/* is now handled directly inside the route handlers
// (see app/api/db/route.ts, which sets Access-Control-Allow-Origin and
// answers the OPTIONS preflight itself). This middleware previously ALSO set
// CORS headers, which meant a single response could carry the
// Access-Control-Allow-Origin header twice — an invalid CORS response that
// the Capacitor WebView rejects as "Load failed". To guarantee exactly one
// CORS authority, this middleware now passes every request straight through
// and sets no headers. The route is the single source of truth.
//
// The file is kept (rather than deleted) because the mobile build script
// (scripts/build-mobile.mjs) stashes and restores it during the static
// export, and expects it to exist.
//
// This middleware ONLY runs on the Vercel web build. The mobile build uses
// `output: 'export'`, which doesn't run middleware at all.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(_req: NextRequest) {
  // Pass-through. CORS is owned by the individual API route handlers.
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}

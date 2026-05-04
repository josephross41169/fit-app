// ─────────────────────────────────────────────────────────────────────────────
// middleware.ts (root)
// ─────────────────────────────────────────────────────────────────────────────
// CORS for /api/*. The Capacitor WebView serves files from
// `capacitor://localhost`, so when the native app calls
// `https://liveleeapp.com/api/db` it needs the live API to allow that origin.
//
// Browsers send a CORS preflight (OPTIONS) before any POST with a JSON body,
// which is every meaningful call to /api/db. We respond to OPTIONS here so we
// don't have to add a handler to every route file.
//
// This middleware ONLY runs on the Vercel web build. The mobile build uses
// `output: 'export'`, which doesn't run middleware (the build script
// temporarily moves this file aside — see `scripts/build-mobile.mjs`).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
  'https://liveleeapp.com',
  'https://www.liveleeapp.com',
])

function pickOrigin(req: NextRequest): string | null {
  const origin = req.headers.get('origin')
  if (!origin) return null
  return ALLOWED_ORIGINS.has(origin) ? origin : null
}

export function middleware(req: NextRequest) {
  const origin = pickOrigin(req)

  // Preflight — respond directly with CORS headers.
  if (req.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 })
    if (origin) {
      res.headers.set('Access-Control-Allow-Origin', origin)
      res.headers.set('Vary', 'Origin')
      res.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      )
      res.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      )
      res.headers.set('Access-Control-Max-Age', '86400')
    }
    return res
  }

  // Actual request — pass through, attach CORS headers if origin is allowed.
  const res = NextResponse.next()
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Vary', 'Origin')
  }
  return res
}

export const config = {
  matcher: '/api/:path*',
}

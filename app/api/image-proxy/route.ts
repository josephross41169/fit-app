// app/api/image-proxy/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Image proxy for the share-card PNG generator.
//
// Why this exists:
//   The ActivityShareButton renders a card to PNG using html2canvas. When
//   it tries to draw a Supabase storage image directly, the browser may
//   not send CORS headers on those URLs — which taints the canvas and
//   crashes html2canvas. By fetching through this same-origin proxy
//   (liveleeapp.com/api/image-proxy?url=...), we avoid CORS entirely:
//   the server fetches the bytes and returns them with our own headers.
//
// Security:
//   We only allow URLs from our Supabase storage host. Anything else is
//   rejected with 400 to prevent this proxy from being used as an open
//   relay to any URL on the internet.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

// Hard-coded allowlist: only proxy images from our Supabase project. This
// stops the route from being abused as an open proxy. If we add another
// image source later (e.g., a CDN), add its hostname here.
const ALLOWED_HOSTS = new Set<string>([
  "biqsvrrnnoyulrrhgitc.supabase.co",
]);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("Missing url", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse("Host not allowed", { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      // Don't forward cookies/credentials.
      credentials: "omit",
      // Cache for an hour at the edge so repeated share-card generations
      // don't hammer Supabase storage.
      next: { revalidate: 3600 },
    });
    if (!upstream.ok) {
      return new NextResponse(`Upstream ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Allow the browser to use this cross-context (the share render
        // is in a portal, so technically same-origin, but no harm).
        "Access-Control-Allow-Origin": "*",
        // Browser/CDN cache: 1 hour.
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (err) {
    console.error("[image-proxy] fetch failed:", err);
    return new NextResponse("Fetch failed", { status: 500 });
  }
}

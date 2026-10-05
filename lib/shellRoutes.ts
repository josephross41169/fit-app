"use client";
// ─── lib/shellRoutes.ts ──────────────────────────────────────────────────────
// Dynamic routes in the iOS/Android app.
//
// The app bundles a STATIC export of the site. Dynamic pages like
// /profile/<username> only exist as ONE placeholder shell (/profile/_/), so
// navigating to /profile/pedroz93 found no file → blank screen → the app fell
// back to its start page and bounced you to your own profile.
//
// Fix: in the static build every navigation to a dynamic route is rewritten
// to its shell with the real value in the query string
//   /profile/pedroz93  →  /profile/_/?username=pedroz93
// and the pages read params through useShellParams(), which swaps the "_"
// placeholder for the query value. The website (normal server build) is
// untouched — STATIC_SHELL is only set by the mobile build.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

export const STATIC_SHELL = process.env.NEXT_PUBLIC_STATIC_SHELL === "1";

// [pattern, shell path, query key]. Order matters (more specific first).
const RULES: [RegExp, string, string][] = [
  [/^\/groups\/([^/]+)\/challenges\/?$/, "/groups/_/challenges/", "id"],
  [/^\/groups\/([^/]+)\/?$/, "/groups/_/", "id"],
  [/^\/profile\/([^/]+)\/?$/, "/profile/_/", "username"],
  [/^\/post\/([^/]+)\/?$/, "/post/_/", "id"],
  [/^\/events\/([^/]+)\/?$/, "/events/_/", "id"],
  [/^\/recap\/([^/]+)\/?$/, "/recap/_/", "week"],
  [/^\/brands\/([^/]+)\/?$/, "/brands/_/", "name"],
  [/^\/challenge\/([^/]+)\/?$/, "/challenge/_/", "token"],
];
// Real static pages that live next to a dynamic segment.
const STATIC_LEAVES = new Set(["_", "new"]);

/** Rewrite a dynamic-route href to its static shell (no-op on the website). */
export function toShellHref(href: string, force = false): string {
  if ((!STATIC_SHELL && !force) || typeof href !== "string" || !href.startsWith("/")) return href;
  const m = href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!m) return href;
  const [, path, query = "", hash = ""] = m;
  for (const [re, shell, key] of RULES) {
    const hit = path.match(re);
    if (!hit) continue;
    if (STATIC_LEAVES.has(hit[1])) return href;
    const sp = new URLSearchParams(query.replace(/^\?/, ""));
    sp.set(key, decodeURIComponent(hit[1]));
    return `${shell}?${sp.toString()}${hash}`;
  }
  return href;
}

/** Like useParams(), but resolves the "_" shell placeholder from the query. */
export function useShellParams<T extends Record<string, string> = Record<string, string>>(): T {
  const params = useParams() as Record<string, string | string[]> | null;
  // During an in-app navigation the first render can still see the OLD url
  // (Next updates history when the new page commits). Re-read the query
  // after every commit so pages get the real id right away instead of a
  // stale/empty one (which flashed "Group not found").
  const [search, setSearch] = useState(() => (typeof window !== "undefined" ? window.location.search : ""));
  useEffect(() => {
    const s = window.location.search;
    if (s !== search) setSearch(s);
  });
  return useMemo(() => {
    const sp = new URLSearchParams(search);
    const out: Record<string, string> = {};
    for (const [k, raw] of Object.entries(params || {})) {
      const v = Array.isArray(raw) ? raw[0] : raw;
      out[k] = v === "_" ? sp.get(k) || "" : v;
    }
    return out as T;
  }, [params, search]);
}

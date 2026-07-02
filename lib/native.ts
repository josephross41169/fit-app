"use client";
// ── lib/native.ts ────────────────────────────────────────────────────────────
// Detects whether we're running inside the Capacitor native shell (iOS or
// Android app) as opposed to the regular website. Mirrors the logic already
// proven in lib/supabase.ts and lib/mobileFetchShim.ts: check the Capacitor
// bridge if it's ready, and fall back to the page origin scheme, which is
// reliable regardless of when the bridge object appears.
//
// Two exports:
//   isNativeShell()    — plain function, safe to call in handlers/effects.
//   useIsNativeShell() — hydration-safe hook for gating JSX. Starts false
//                        (matching the statically exported HTML) and flips
//                        to true after mount when running in the app, so
//                        React never sees a server/client markup mismatch.

import { useEffect, useState } from "react";

export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    const proto = window.location.protocol;
    if (proto === "capacitor:" || proto === "ionic:" || proto === "file:") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function useIsNativeShell(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    if (isNativeShell()) setNative(true);
  }, []);
  return native;
}

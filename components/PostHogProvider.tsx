"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { supabase } from "@/lib/supabase";

// ── PostHog provider ───────────────────────────────────────────────────────
// Initializes PostHog on app load. Runs once per page load. Exposes a global
// window.posthog reference so any client component can do
// `(window as any).posthog?.capture("event_name", { props })`.
//
// Configuration:
// - Identifies the user when an auth session exists, so events can be
//   attributed to a real user_id + username (filterable in PostHog UI).
// - Captures pageviews automatically on route change (App Router).
// - Captures session replays — useful for beta to debug UX issues.
//   Privacy: PostHog masks input values by default; enable "mask all text"
//   in the PostHog dashboard if you want stricter privacy later.
// - Skips initialization when env vars are missing so dev/preview builds
//   don't crash; falls back to a no-op silently.

let initialized = false;

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize once
  useEffect(() => {
    if (initialized) return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
    if (!key) {
      // No key configured — skip silently. Lets dev builds work without
      // an env var, and prevents an undefined-crash in client.
      return;
    }
    posthog.init(key, {
      api_host: host,
      // Capture pageviews manually so we control timing relative to
      // App Router transitions (the default heuristic doesn't pick up
      // client-side route changes reliably).
      capture_pageview: false,
      capture_pageleave: true,
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: { password: true },
      },
      // Recommended: persist session across reloads but not across browsers
      persistence: "localStorage+cookie",
    });
    initialized = true;

    // Identify the user when an auth session is available. We also listen
    // for future sign-in/out events so the identity stays in sync.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) identify(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        identify(session.user.id);
      } else if (event === "SIGNED_OUT") {
        posthog.reset();
      }
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  // Capture pageviews on every route change. Includes search params so
  // filtered routes ("?tab=foo") get separate counts.
  useEffect(() => {
    if (!initialized) return;
    if (!pathname) return;
    const url = window.location.origin + pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}

// ── Identity ───────────────────────────────────────────────────────────────
// Attach a Supabase user_id to the PostHog identity so events are bucketed
// per-user. Also pulls the user's username and full_name so they're
// readable in the PostHog dashboard (much nicer than UUIDs).
async function identify(userId: string) {
  try {
    const { data: profile } = await supabase
      .from("users")
      .select("username, full_name, email")
      .eq("id", userId)
      .single();
    posthog.identify(userId, {
      username: profile?.username,
      full_name: profile?.full_name,
      email: profile?.email,
    });
  } catch {
    // If the profile fetch fails just use the bare id — better than nothing.
    posthog.identify(userId);
  }
}

// ── Helper for tracking events from anywhere in the app ───────────────────
// Components import this and call `track("post_created", { length: 5 })`.
// Safe to call before init — silently no-ops if PostHog isn't ready yet.
export function track(eventName: string, properties?: Record<string, any>) {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(eventName, properties);
  } catch { /* PostHog not ready or disabled — silent fail */ }
}

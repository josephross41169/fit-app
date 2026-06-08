// lib/useUnreadCounts.ts
//
// Shared hook for unread message + notification counts. Used by BottomNav
// and MessagesFAB so they don't both fire the same queries every 15-20s.
//
// Before this existed, BottomNav was polling unread messages every 15s with
// its own realtime subscription, AND MessagesFAB was polling the SAME query
// every 20s with its OWN realtime subscription. Both also re-set up on every
// pathname change. That's ~6 redundant queries/min per active user just for
// the badge dots — none of which the user can actually see updating that
// fast anyway.
//
// This hook runs the queries ONCE per session (per user) regardless of how
// many components mount. Realtime is the primary signal; the slow poll
// (60s) is just a safety net in case the realtime channel drops.

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

// Module-level state shared across all hook consumers. We only ever have
// one subscriber loop running per (browser tab, user) — the first component
// to mount sets it up, all subsequent components just subscribe to the
// updates.
type Listener = (msg: number, notifs: number) => void;
let unreadMessages = 0;
let unreadNotifs = 0;
let listeners = new Set<Listener>();
let activeUserId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let msgChannel: any = null;
let notifChannel: any = null;
let inflightFetch = false;

function notify() {
  // Use forEach over for-of: the codebase tsconfig doesn't have
  // downlevelIteration enabled and Set iteration triggers TS2802.
  listeners.forEach(l => l(unreadMessages, unreadNotifs));
}

async function fetchCounts(userId: string) {
  if (inflightFetch) return; // dedupe — realtime can fire bursts
  inflightFetch = true;
  try {
    // ── Messages ──
    // Two-step query: first get conversations the user is in, then count
    // unread messages across them. We can't push this into one query
    // without an RPC because Supabase RLS on `messages` blocks anything
    // not joined through `conversation_participants` first.
    //
    // Each section captures its own Supabase `error` and is independent: if
    // the messages count fails (e.g. RLS on `messages` rejects the direct
    // client query — a 500), we keep the previous message count and STILL
    // run the notifications count below, instead of throwing out of the whole
    // function. Previously a throw here meant a single failing section took
    // out the other and the realtime loop kept retrying it.
    let msgCount = unreadMessages; // default: keep prior value on failure
    try {
      const { data: parts, error: partsErr } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      if (!partsErr) {
        if (parts && parts.length > 0) {
          const convIds = parts.map((p: any) => p.conversation_id);
          const { count, error: msgErr } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .in("conversation_id", convIds)
            .neq("sender_id", userId)
            .is("read_at", null);
          if (!msgErr) msgCount = count || 0;
        } else {
          msgCount = 0; // no conversations → genuinely zero unread
        }
      }
    } catch { /* keep prior msgCount */ }

    // ── Notifications ──
    // Column names must match the actual `notifications` table: the server
    // API (/api/db get_notifications + mark_notifications_read) uses
    // `user_id` and a boolean `read` column. An earlier version of this hook
    // queried `recipient_id` / `read_at`, which don't exist on the table —
    // that produced the repeating 400s in the console (Supabase rejecting the
    // query) and meant the notification badge never populated on web.
    let notifCount = unreadNotifs; // default: keep prior value on failure
    try {
      const { count: nCount, error: nErr } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (!nErr) notifCount = nCount || 0;
    } catch { /* keep prior notifCount */ }

    unreadMessages = msgCount;
    unreadNotifs = notifCount;
    notify();
  } catch {
    // Don't reset to 0 on transient errors — keep stale value so the badge
    // doesn't flicker when the network blips. Next successful fetch fixes it.
  } finally {
    inflightFetch = false;
  }
}

function teardown() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  try { msgChannel?.unsubscribe(); } catch {}
  try { notifChannel?.unsubscribe(); } catch {}
  msgChannel = null;
  notifChannel = null;
  activeUserId = null;
  unreadMessages = 0;
  unreadNotifs = 0;
}

function setup(userId: string) {
  if (activeUserId === userId) return; // already running for this user
  if (activeUserId && activeUserId !== userId) teardown(); // user switched

  activeUserId = userId;

  // Initial fetch
  fetchCounts(userId);

  // Realtime is primary. New messages and new notifs both trigger an
  // immediate refetch — cheap because of the inflight dedupe above.
  try {
    msgChannel = supabase
      .channel(`unread-msg-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        () => fetchCounts(userId))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" },
        () => fetchCounts(userId))
      .subscribe();
  } catch {}

  try {
    notifChannel = supabase
      .channel(`unread-notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        () => fetchCounts(userId))
      .subscribe();
  } catch {}

  // Slow safety poll. 60s is plenty — realtime handles the common case.
  // Previously BottomNav was at 15s and FAB at 20s, both with their own
  // realtime subs on top. Total redundant work cut by ~85%.
  pollTimer = setInterval(() => fetchCounts(userId), 60000);
}

/**
 * Returns unread message count and unread notification count.
 *
 * Both counts are suppressed (returned as 0) when the user is currently
 * viewing the corresponding page, since the badge would just be noise.
 *
 * Multiple components can call this — the underlying queries only run once
 * per session and the realtime subscriptions are deduped at the module
 * level.
 */
export function useUnreadCounts() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [msg, setMsg] = useState(unreadMessages);
  const [notif, setNotif] = useState(unreadNotifs);
  const listenerRef = useRef<Listener | null>(null);

  useEffect(() => {
    if (!user) {
      teardown();
      setMsg(0);
      setNotif(0);
      return;
    }

    // Subscribe to module-level updates
    const listener: Listener = (m, n) => { setMsg(m); setNotif(n); };
    listeners.add(listener);
    listenerRef.current = listener;

    // Make sure the underlying poll/realtime is running. setup() is a no-op
    // if we're already subscribed for this user.
    setup(user.id);

    // Seed local state with whatever the module already knows
    setMsg(unreadMessages);
    setNotif(unreadNotifs);

    return () => {
      if (listenerRef.current) listeners.delete(listenerRef.current);
      // Tear down only when the LAST listener leaves. Otherwise leave the
      // poll/channels alive for whoever else is still mounted.
      if (listeners.size === 0) teardown();
    };
  }, [user?.id]);

  // Hide the badge for the page you're already on. Cleaner than checking
  // pathname inside every consuming component.
  const onMessages = pathname === "/messages";
  const onNotifs = pathname === "/notifications";

  return {
    unreadMessages: onMessages ? 0 : msg,
    unreadNotifs: onNotifs ? 0 : notif,
  };
}

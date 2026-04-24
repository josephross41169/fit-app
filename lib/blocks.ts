// ── lib/blocks.ts ───────────────────────────────────────────────────────────
// Lightweight helper for client-side block filtering.
//
// Instead of modifying every feed/messages query to exclude blocked users
// (complex because some queries already have other filters / limits), we
// fetch the user's block list once per session and filter the results
// client-side. This means a user who blocks 50 people sees 50 fewer items
// in their feed — acceptable tradeoff vs. server-side join complexity.
//
// The block list is cached per-session in a module-level variable and
// invalidated by clearBlockCache() when a block/unblock happens.

import { supabase } from "./supabase";

// Mutual block set: contains EVERY user_id that's in a block relationship
// with the current user (either direction). Posts and messages from these
// users are filtered out of the UI. Using a Set for O(1) lookup.
let blockedSet: Set<string> | null = null;
let loadedForUserId: string | null = null;

/**
 * Load and cache the list of user IDs that are mutually blocked with the
 * current user. Returns a Set for O(1) filtering.
 *
 * "Mutual" means: if A blocked B, both the A→B and B→A directions hide
 * content. This prevents B from seeing A's posts and vice versa — the
 * standard social-app pattern.
 */
export async function loadBlockedUsers(userId: string): Promise<Set<string>> {
  if (blockedSet && loadedForUserId === userId) return blockedSet;

  // Fetch both directions of the block relationship. One query each for
  // simplicity — they're small tables with per-user indexes.
  const [out, inc] = await Promise.all([
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("user_blocks").select("blocker_id").eq("blocked_id", userId),
  ]);

  const ids = new Set<string>();
  for (const row of out.data ?? []) ids.add((row as any).blocked_id);
  for (const row of inc.data ?? []) ids.add((row as any).blocker_id);

  blockedSet = ids;
  loadedForUserId = userId;
  return ids;
}

/**
 * Invalidate the cached block list. Call this after block() or unblock()
 * so the next feed query re-fetches the updated list. Cheap — just a
 * variable reset.
 */
export function clearBlockCache(): void {
  blockedSet = null;
  loadedForUserId = null;
}

/**
 * Given an array of items that each have a `user_id` (or a function to
 * extract one), return only items not involving a blocked user. Generic
 * so it works for posts, messages, comments — anything with a user FK.
 */
export function filterBlocked<T>(
  items: T[],
  blockSet: Set<string>,
  getUserId: (item: T) => string | undefined | null
): T[] {
  if (blockSet.size === 0) return items;
  return items.filter(item => {
    const uid = getUserId(item);
    if (!uid) return true; // items with no user (system messages) stay
    return !blockSet.has(uid);
  });
}

// ─── lib/queryCache.ts ───────────────────────────────────────────────────
// Lightweight in-memory cache for Supabase query results. Use this on
// queries where:
//   • The result rarely changes during a session (user profiles, group
//     metadata, post detail pages)
//   • You're loading the same key repeatedly during navigation (open
//     profile → back → open same profile → instant)
//
// We keep it dead simple: a Map keyed by string, with TTL eviction.
// No SWR magic, no React-specific bindings — just data caching.
//
// IMPORTANT: this is in-memory only. Cleared on page refresh. That's
// intentional — fresh page loads should always get fresh data.

type CacheEntry<T> = {
  data: T;
  /** When this entry was cached. Used to compute age vs TTL. */
  cachedAt: number;
};

const cache = new Map<string, CacheEntry<any>>();

/**
 * Get cached value if still valid. Returns null if missing or expired.
 *
 * @param key - Unique cache key (e.g. "profile:joeyross")
 * @param ttlMs - Max age to consider fresh. Defaults to 60s.
 */
export function getCached<T>(key: string, ttlMs = 60_000): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/** Store a value under a key. Replaces any existing entry. */
export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, cachedAt: Date.now() });
}

/** Invalidate one key. Use after a mutation to ensure next read is fresh. */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/** Invalidate all keys matching a prefix. Useful when a related set of
 *  data changes (e.g. invalidatePrefix("profile:") clears all profiles). */
export function invalidatePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/**
 * Wrapper around a fetch function that caches the result.
 *
 * Usage:
 *   const profile = await cachedQuery(`profile:${username}`, () =>
 *     supabase.from('users').select('*').eq('username', username).single()
 *       .then(r => r.data)
 *   );
 *
 * Returns cached value instantly if fresh; otherwise runs the fetcher,
 * caches the result, and returns it.
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000
): Promise<T> {
  const cached = getCached<T>(key, ttlMs);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  setCached(key, fresh);
  return fresh;
}

/**
 * Stale-while-revalidate: return cached value immediately, then fetch in
 * the background and call a callback with the fresh value when it arrives.
 *
 * Best for UI where you want to show stale data instantly but also update
 * to fresh data without a flash. The component owns the rendering logic
 * (we don't force a particular state-update pattern).
 *
 * Returns the initial (cached or null) value synchronously is impossible
 * here, so it returns the cached value synchronously via a parallel
 * helper. Use the callback for fresh data.
 */
export function swrQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  onFresh: (data: T) => void,
  ttlMs = 60_000
): T | null {
  const cached = getCached<T>(key, ttlMs);
  // Always fetch in background, even if cached. The cache TTL prevents
  // us from spamming — but on each call we still verify freshness.
  fetcher().then(fresh => {
    setCached(key, fresh);
    onFresh(fresh);
  }).catch(() => { /* leave cached value in place on failure */ });
  return cached;
}

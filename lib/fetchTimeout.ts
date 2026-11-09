// ─── lib/fetchTimeout.ts ─────────────────────────────────────────────────────
// Gives every network request a time limit so the app can't sit on
// "Saving…" / "Loading…" forever when Supabase or our API hangs (e.g. the
// Nov 2 Supabase incident). After the limit the request fails with
// NET_TIMEOUT_MSG, which save screens show inline, and a
// `livelee:net-timeout` window event fires so NetworkTimeoutBanner can
// offer "Try again" on loading screens.
// ─────────────────────────────────────────────────────────────────────────────

export const NET_TIMEOUT_MS = 15_000;
// Uploads, AI scans and image generation legitimately take longer.
export const NET_SLOW_TIMEOUT_MS = 45_000;
export const NET_TIMEOUT_MSG = "Couldn't reach the server. Check your connection and try again.";
export const NET_TIMEOUT_EVENT = "livelee:net-timeout";

/** True when an error message came from a request that hit its time limit. */
export function isNetTimeout(msg: string | null | undefined): boolean {
  return !!msg && msg.includes(NET_TIMEOUT_MSG);
}

/** Turn a timed-out request's error into the friendly sentence, else pass through. */
export function friendlyNetError(msg: string | null | undefined): string | null | undefined {
  return isNetTimeout(msg) ? `${NET_TIMEOUT_MSG} Your entries are still here.` : msg;
}

/**
 * Run `doFetch` with a time limit. Respects a caller-supplied AbortSignal
 * (a caller abort rejects as usual, without the timeout message or event).
 */
export function fetchWithTimeout(
  doFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ms: number,
): Promise<Response> {
  const ctl = new AbortController();
  const outer = init?.signal || (input instanceof Request ? input.signal : undefined);
  if (outer?.aborted) return doFetch(input, init);
  const onOuterAbort = () => ctl.abort((outer as any)?.reason);
  outer?.addEventListener("abort", onOuterAbort, { once: true });

  let timedOut = false;
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      ctl.abort();
      // Named AbortError so supabase-js doesn't retry it (a retry would
      // double the wait) and reports it as a normal error result.
      const err = new Error(NET_TIMEOUT_MSG);
      err.name = "AbortError";
      try { window.dispatchEvent(new CustomEvent(NET_TIMEOUT_EVENT)); } catch {}
      reject(err);
    }, ms);
    doFetch(input, { ...init, signal: ctl.signal }).then(
      (res) => { clearTimeout(timer); outer?.removeEventListener("abort", onOuterAbort); if (!timedOut) resolve(res); },
      (e) => { clearTimeout(timer); outer?.removeEventListener("abort", onOuterAbort); if (!timedOut) reject(e); },
    );
  });
}

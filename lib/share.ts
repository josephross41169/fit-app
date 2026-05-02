// ─── lib/share.ts ────────────────────────────────────────────────────────
// Universal share helper. Every shareable thing in the app (post, profile,
// group, challenge, recap card) calls into this single function so the
// UX is consistent across the app:
//
//   • Mobile (with native share API): opens iOS/Android share sheet
//   • Mobile without (rare): falls back to clipboard + toast
//   • Desktop: clipboard + toast
//   • User cancels native sheet: no-op (no error toast)
//
// Returns a Promise<ShareOutcome> so callers can update UI state (e.g.
// show "✓ Copied" for 2.5s).

export type ShareOutcome =
  | "shared"      // native share sheet completed (we don't get more detail than this)
  | "copied"      // clipboard fallback succeeded — caller should show "Copied" toast
  | "cancelled"   // user dismissed the native sheet — caller shows nothing
  | "failed";     // both native and clipboard failed — caller shows error or prompt

export type ShareInput = {
  /** The URL to share. Required. */
  url: string;
  /** Title used in the native share sheet preview. */
  title?: string;
  /** Body text used in the native share sheet preview. Some apps use it,
   *  others ignore it — keep important info in the URL too. */
  text?: string;
};

/**
 * Share a URL using the best mechanism available.
 *
 * Always prefer this over rolling your own. If you need behavior this
 * doesn't support (e.g. file uploads, preview cards), open an issue
 * before forking.
 */
export async function share(input: ShareInput): Promise<ShareOutcome> {
  if (typeof window === "undefined") return "failed";
  if (!input.url) return "failed";

  // Try native share sheet first. iOS Safari, Chrome, Edge, Android all
  // support this — covers ~95% of mobile traffic. Desktop browsers don't,
  // which is why we always have a clipboard fallback.
  const nav = navigator as any;
  if (typeof nav.share === "function") {
    try {
      await nav.share({
        title: input.title,
        text: input.text,
        url: input.url,
      });
      return "shared";
    } catch (e: any) {
      // AbortError = user cancelled the share sheet. Don't fall through
      // to clipboard — they actively chose to dismiss.
      if (e?.name === "AbortError") return "cancelled";
      // Other errors (e.g. share API present but blocked by permissions)
      // fall through to clipboard.
    }
  }

  // Clipboard fallback — desktop or share-API-blocked mobile
  try {
    await navigator.clipboard.writeText(input.url);
    return "copied";
  } catch {
    // Clipboard blocked too — last resort, prompt the user with the URL
    // so they can copy it manually. Better than silently failing.
    try {
      window.prompt("Copy this link:", input.url);
      return "copied";
    } catch {
      return "failed";
    }
  }
}

/**
 * Convenience wrapper for the common "share + show ✓ Copied for 2.5s"
 * pattern. Pass a setter from useState that controls a "copied" boolean,
 * and this handles the rest.
 *
 * Usage:
 *   const [copied, setCopied] = useState(false);
 *   <button onClick={() => shareWithToast({ url, title }, setCopied)}>
 *     {copied ? "✓ Copied" : "Share"}
 *   </button>
 */
export async function shareWithToast(
  input: ShareInput,
  setCopied: (v: boolean) => void,
  toastDurationMs = 2500
): Promise<ShareOutcome> {
  const outcome = await share(input);
  if (outcome === "copied") {
    setCopied(true);
    setTimeout(() => setCopied(false), toastDurationMs);
  }
  return outcome;
}

/**
 * Convenience for building canonical app URLs. Always uses the current
 * origin (works on prod, preview, localhost) without baking the domain
 * in. Returns empty string in SSR (caller should guard).
 */
export function appUrl(path: string): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin;
  // Make sure the path starts with /
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

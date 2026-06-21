"use client";

// components/ActivityShareButton.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Camera/share button shown on activity cards. Captures the day's activity
// as a polished PNG and hands it to the OS share sheet (mobile) or downloads
// it (desktop).
//
// As of the server-render rewrite: this no longer uses html2canvas. Instead
// it POSTs the day's data to /api/share-card, which renders the image with
// next/og (real font metrics → pixel-perfect text + emoji, and photos fetched
// server-side so there's no CORS dance). The button just fetches the PNG and
// shares/downloads it.
//
// The old client-side html2canvas approach approximated the browser's layout
// engine in JS and consistently mis-positioned text baselines and emoji; the
// server route fixes that at the source.
// ─────────────────────────────────────────────────────────────────────────────

import { Component, ReactNode, useState } from "react";

// ─── Public type: shape of one day's data for the share render ──────────────
// NOTE: kept in sync with the same interface in app/api/share-card/route.tsx.
// Imported by profile/page.tsx, prs/page.tsx, ShareCard.tsx.
export interface ShareCardData {
  dateLabel: string;
  monthShort: string;
  dayNum: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;

  workout?: {
    type?: string;
    duration?: string;
    calories?: number;
    exercises?: { name: string; sets: number; reps: number; weight: string }[];
    cardio?: { type: string; duration?: string; distance?: string }[];
    photoUrls?: string[];
  } | null;

  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    meals?: { key: string; name: string; cal: number; emoji?: string }[];
    photoUrls?: string[];
  } | null;

  wellness?: {
    entries?: { activity: string; emoji?: string; notes?: string; duration?: number }[];
    photoUrls?: string[];
  } | null;
}

interface Props {
  data: ShareCardData;
  filename?: string;
  style?: React.CSSProperties;
  // When provided, the button renders as a full-width row (icon + this text)
  // and the ENTIRE row is the click target. This fixes the menu bug where the
  // tiny icon was the only clickable part and a separate text label beside it
  // did nothing.
  label?: string;
}

// ─── Error boundary: contains any crash inside the share button ─────────────
// If the inner component throws, render null (no button) rather than crashing
// the whole page.
class ShareErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError(_err: Error) {
    return { hasError: true };
  }
  componentDidCatch(err: Error, info: unknown) {
    console.error("[ActivityShareButton] caught error, hiding button:", err, info);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function ActivityShareButton(props: Props) {
  return (
    <ShareErrorBoundary>
      <ActivityShareButtonInner {...props} />
    </ShareErrorBoundary>
  );
}

// ─── Mobile detection ────────────────────────────────────────────────────────
// Used to decide share-sheet (mobile) vs download (desktop). We check the
// DEVICE, not just whether navigator.share exists — Windows 11 supports
// navigator.share but there the user expects a plain download.
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports as "Macintosh" but has touch
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1) ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches === true &&
      "ontouchstart" in window)
  );
}

function ActivityShareButtonInner({ data, filename = "livelee-activity", style, label }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);

    // On iOS Safari/WebKit, navigator.share() must run inside the user gesture.
    // Because we have to `await fetch` the rendered PNG first, the gesture is
    // lost by the time share() would fire, so iOS silently ignores it — which
    // is why the button "did nothing." To stay reliable we (1) try the native
    // share sheet, and (2) if it's unavailable OR throws (gesture lost, not
    // supported, etc.), fall back to opening/downloading the PNG so something
    // always happens.
    const mobile = isMobileDevice();

    try {
      // Ask the server to render the card. Photos + layout + fonts are all
      // handled server-side; we just get a finished PNG back.
      const res = await fetch("/api/share-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`share-card route returned ${res.status}`);

      const blob = await res.blob();
      const fname = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
      const file = new File([blob], fname, { type: "image/png" });
      const url = URL.createObjectURL(blob);

      // Mobile → try the native share sheet (Save to Photos, Messages, etc).
      if (
        mobile &&
        typeof (navigator as any).canShare === "function" &&
        (navigator as any).canShare({ files: [file] })
      ) {
        try {
          await (navigator as any).share({ files: [file], title: "My Livelee activity" });
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === "AbortError") {
            // User cancelled the share sheet — that's fine, clean up and stop.
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
            return;
          }
          // Any other error (gesture lost, NotAllowedError, etc.) → fall through
          // to the open/download fallback below so the button still does something.
        }
      }

      // Fallback for: desktop, share unsupported, or share() that failed.
      // On iOS a programmatic <a download> click is unreliable, so open the
      // image in a new tab — the user can then long-press → "Save to Photos".
      // On desktop the download attribute works and saves the file directly.
      if (mobile) {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("[share] generation failed", err);
      alert("Couldn't generate the share image. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Full-row mode: icon + label, entire row clickable. Used in menus so the
  // user can tap the text (not just a tiny icon) to share.
  if (label) {
    return (
      <button
        onClick={handleClick}
        disabled={busy}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "none",
          background: "transparent",
          color: "#F0F0F0",
          fontSize: 14,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          textAlign: "left",
          ...style,
        }}
        aria-label="Share activity card as image"
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{busy ? "⏳" : "📸"}</span>
        <span>{busy ? "Generating…" : label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: busy ? "#2D1F52" : "rgba(124,58,237,0.15)",
        border: "1.5px solid rgba(124,58,237,0.4)",
        color: "#A78BFA",
        fontSize: 15,
        cursor: busy ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
      aria-label="Share activity card as image"
      title="Share as image"
    >
      {busy ? "⏳" : "📸"}
    </button>
  );
}

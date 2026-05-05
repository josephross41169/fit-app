"use client";
// ─────────────────────────────────────────────────────────────────────────────
// components/ActivityShareButton.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders a "📸 Save Card" button on activity cards. When tapped:
//   1. Captures the activity card DOM (including all expanded sections and
//      photos) as a PNG using html2canvas, loaded dynamically so it doesn't
//      bloat the initial bundle.
//   2. On iOS native (Capacitor) — saves to the Photos library via the
//      built-in Web Share API or download fallback.
//   3. On desktop / web — triggers a normal download.
//   4. On Android (PWA or browser) — same as desktop, downloads file.
//
// Why this exists: users want to share a clean image of their workout/
// nutrition/wellness for the day to friends. Native screenshots cut off
// content that scrolls off-screen, especially when the day has multiple
// sections. This generates a single tall PNG of the whole card so they
// can share without manually cropping/stitching.
//
// Limitations: html2canvas can't render iframes, video, or some CSS
// gradients exactly. We've tested all the styles used in DayCard and
// they render cleanly. If a new style breaks rendering later, we can
// add a CSS workaround inside the cloned node before snapshotting.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type RefObject } from "react";

interface Props {
  /** Ref to the DOM node that should be captured. Pass the wrapper around
   *  the entire card body. The button itself doesn't need to live inside
   *  this ref — it's positioned externally. */
  targetRef: RefObject<HTMLElement | null>;
  /** Filename for the downloaded PNG. ".png" is appended automatically. */
  filename?: string;
  /** Called BEFORE capture so the parent can expand all collapsed sections.
   *  Capture happens after a short delay to let the DOM settle. */
  onBeforeCapture?: () => void;
  /** Called AFTER capture so the parent can collapse sections back. */
  onAfterCapture?: () => void;
  /** Optional inline style overrides for the button. */
  style?: React.CSSProperties;
}

export default function ActivityShareButton({
  targetRef,
  filename = "livelee-activity",
  onBeforeCapture,
  onAfterCapture,
  style,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!targetRef.current || busy) return;
    setBusy(true);

    try {
      // Expand sections first so everything is in the DOM before snapshot.
      onBeforeCapture?.();
      // Wait a tick so React commits the expanded state and images load.
      await new Promise(r => setTimeout(r, 350));

      // Dynamic import keeps html2canvas out of the main bundle. It's about
      // 50KB gzipped so we only load it when someone actually shares.
      const html2canvasMod = await import("html2canvas");
      const html2canvas = html2canvasMod.default;

      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#0D0D0D",
        scale: 2, // retina output for sharper text on save
        useCORS: true,
        logging: false,
        // Allow remote images from Supabase storage. CORS must be permissive
        // on the bucket — which it already is for public photo buckets.
        allowTaint: false,
      });

      const blob: Blob | null = await new Promise(resolve => {
        canvas.toBlob(b => resolve(b), "image/png", 0.95);
      });
      if (!blob) throw new Error("Failed to create image");

      const fname = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;

      // Detect Capacitor native runtime — there we want to use the system
      // share sheet so iOS users can save to Photos / send to Messages /
      // post to Instagram. Web Share API with files is the cleanest path
      // and works on iOS Safari + native Capacitor WebView.
      const file = new File([blob], fname, { type: "image/png" });
      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof (navigator as any).canShare === "function" &&
        (navigator as any).canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await (navigator as any).share({
            files: [file],
            title: "My Livelee activity",
          });
          onAfterCapture?.();
          setBusy(false);
          return;
        } catch (err: any) {
          // User canceled the share sheet — that's fine, fall through to
          // download as a backup. Ignore AbortError specifically.
          if (err?.name !== "AbortError") {
            console.error("[share] system share failed, falling back", err);
          } else {
            // User explicitly canceled — don't also download.
            onAfterCapture?.();
            setBusy(false);
            return;
          }
        }
      }

      // Fallback: trigger a normal download. Works on desktop browsers and
      // in Android Chrome. On older iOS Safari (no Web Share files API),
      // this opens the image in a new tab so the user can long-press save.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      // Some Safari versions ignore the download attribute. open() in a
      // new tab gives users a long-press-to-save fallback.
      const isSafari =
        typeof navigator !== "undefined" &&
        /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari) {
        window.open(url, "_blank");
      } else {
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("[share] capture failed", err);
      alert("Couldn't generate the share image. Try again, or take a regular screenshot.");
    } finally {
      onAfterCapture?.();
      setBusy(false);
    }
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
      aria-label="Save activity card as image"
      title="Save card as image"
    >
      {busy ? "⏳" : "📸"}
    </button>
  );
}

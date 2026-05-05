"use client";
// ─────────────────────────────────────────────────────────────────────────────
// components/ActivityShareButton.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Captures an activity card's DOM as a PNG and triggers a download.
//
// We deliberately do NOT use the Web Share API. The system share sheet on
// Windows/macOS/iOS shows random apps the user doesn't want (Phone Link,
// Outlook, Microsoft Teams, etc.) and there's no API to filter the list.
// Downloading the file gives the user the cleanest path: they get a PNG
// they can drag into any social platform (Instagram, X, Snapchat, TikTok,
// Facebook) without OS clutter.
//
// On iOS Safari the download attribute can be flaky — we open the image
// in a new tab as a fallback, then the user long-presses to save.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type RefObject } from "react";

interface Props {
  /** Ref to the DOM node to capture. */
  targetRef: RefObject<HTMLElement | null>;
  /** Filename for the downloaded PNG (date suffix and `.png` are added). */
  filename?: string;
  /** Called BEFORE capture so the parent can expand all collapsed sections. */
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
      // Force every collapsible section open before snapshotting. The 800ms
      // wait gives React time to commit the expanded state AND lets remote
      // images (photos pulled from Supabase storage) finish loading. Too
      // short and the snapshot has empty image holes.
      onBeforeCapture?.();
      await new Promise(r => setTimeout(r, 800));

      // Wait for any in-flight images inside the target to finish loading.
      // Belt-and-suspenders on top of the timeout above.
      const imgs = Array.from(targetRef.current.querySelectorAll("img"));
      await Promise.all(
        imgs.map(img =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>(resolve => {
                const done = () => resolve();
                img.addEventListener("load", done, { once: true });
                img.addEventListener("error", done, { once: true });
                // Hard cap so a broken image doesn't hang the capture forever.
                setTimeout(done, 3000);
              })
        )
      );

      // Dynamic import — keeps html2canvas (~50KB gz) out of the main bundle.
      const html2canvasMod = await import("html2canvas");
      const html2canvas = html2canvasMod.default;

      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#0D0D0D",
        scale: 2, // retina output for crisp text
        useCORS: true,
        logging: false,
        allowTaint: false,
      });

      const blob: Blob | null = await new Promise(resolve => {
        canvas.toBlob(b => resolve(b), "image/png", 0.95);
      });
      if (!blob) throw new Error("Failed to create image");

      const fname = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
      const url = URL.createObjectURL(blob);

      // iOS Safari: download attribute is unreliable. Open in a new tab so
      // the user can long-press → Save to Photos. On every other browser,
      // the standard download path works.
      const isIOSSafari =
        typeof navigator !== "undefined" &&
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

      if (isIOSSafari) {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      // Free the blob URL after a delay so any in-progress download/tab can
      // still resolve it. 60s is generous; most downloads complete in <1s.
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
      aria-label="Download activity card as image"
      title="Download card as image"
    >
      {busy ? "⏳" : "📸"}
    </button>
  );
}

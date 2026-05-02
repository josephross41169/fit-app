"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Image source URL. Required. */
  src: string;
  /** Alt text for accessibility. */
  alt?: string;
  /** Container width — passed through as CSS. */
  width?: number | string;
  /** Container height — passed through as CSS. */
  height?: number | string;
  /** CSS border-radius applied to the wrapper. */
  borderRadius?: number | string;
  /** Initial vertical position (0–100, % from top). Defaults to 50 (centered). */
  position?: number;
  /** Called when the user finishes dragging. Save to backend here. */
  onSave?: (newPosition: number) => void | Promise<void>;
  /** Show the "Reposition" / "Save" / "Cancel" UI. Defaults to false (just renders the image). */
  editable?: boolean;
  /** Object-fit. Defaults to "cover". */
  objectFit?: "cover" | "contain";
  /** Optional class name passthrough. */
  className?: string;
  /** Inline style passthrough for the WRAPPER. */
  style?: React.CSSProperties;
  /** Disable the editable controls (e.g. when parent wants to take over). */
  disabled?: boolean;
};

/**
 * RepositionableImage
 *
 * Drop-in image component that supports drag-to-reposition. Used everywhere
 * users upload photos that get cropped to fit a container — banners, avatars,
 * post photos, group banners. Replaces the bespoke per-page reposition code
 * scattered through the profile pages.
 *
 * Behavior:
 *   • When `editable=false` (default): renders the image with the given
 *     position. No interactivity. Cheap.
 *   • When `editable=true`: shows a small "↕ Reposition" button overlay.
 *     Tapping it enters reposition mode → user drags → "Save" persists
 *     the new position via the onSave callback, "Cancel" reverts.
 *
 * Position is a number 0–100 representing the percent FROM TOP that the
 * image's vertical center should align to. 0 = top of image visible,
 * 100 = bottom of image visible. 50 = centered. Same convention as CSS
 * background-position-y. We use this rather than pixel offsets because it
 * works across viewport sizes (mobile vs desktop see the same crop).
 *
 * Performance: in non-editable mode this is just a styled <img>. The drag
 * handlers only attach when entering reposition mode, so feed scroll on
 * mobile isn't slowed down by 50 invisible event listeners.
 */
export default function RepositionableImage({
  src,
  alt = "",
  width = "100%",
  height = 220,
  borderRadius = 0,
  position = 50,
  onSave,
  editable = false,
  objectFit = "cover",
  className,
  style,
  disabled = false,
}: Props) {
  const [reposMode, setReposMode] = useState(false);
  const [currentPos, setCurrentPos] = useState(position);
  const [savedPos, setSavedPos] = useState(position);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ startY: number; startPos: number } | null>(null);

  // Keep currentPos in sync if the parent passes a new position (e.g. after
  // a fresh load). Without this, externally-changed positions never update
  // the rendered image.
  useEffect(() => {
    setCurrentPos(position);
    setSavedPos(position);
  }, [position]);

  function startDrag(clientY: number) {
    if (!reposMode) return;
    dragRef.current = { startY: clientY, startPos: currentPos };
  }
  function moveDrag(clientY: number) {
    if (!reposMode || !dragRef.current) return;
    // dy in px → divide by 2 for sensitivity (same ratio used in the legacy
    // banner/avatar reposition code so it feels consistent).
    const dy = clientY - dragRef.current.startY;
    const next = Math.max(0, Math.min(100, dragRef.current.startPos - dy / 2));
    setCurrentPos(next);
  }
  function endDrag() {
    dragRef.current = null;
  }

  async function commitSave() {
    if (saving) return;
    setSaving(true);
    try {
      if (onSave) await onSave(currentPos);
      setSavedPos(currentPos);
      setReposMode(false);
    } catch {
      // Silent fail — parent should toast. We just stay in reposition mode
      // so the user can try again.
    } finally {
      setSaving(false);
    }
  }
  function commitCancel() {
    setCurrentPos(savedPos);
    setReposMode(false);
  }

  const showControls = editable && !disabled;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width,
        height,
        borderRadius,
        overflow: "hidden",
        userSelect: "none",
        cursor: reposMode ? "ns-resize" : "default",
        ...style,
      }}
      // Mouse events only trigger when in reposition mode — handlers are
      // cheap no-ops in normal display mode.
      onMouseDown={e => { if (reposMode) { e.preventDefault(); startDrag(e.clientY); } }}
      onMouseMove={e => { if (reposMode && dragRef.current) { e.preventDefault(); moveDrag(e.clientY); } }}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={e => { if (reposMode) startDrag(e.touches[0].clientY); }}
      onTouchMove={e => { if (reposMode && dragRef.current) { e.preventDefault(); moveDrag(e.touches[0].clientY); } }}
      onTouchEnd={endDrag}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit,
            // CSS object-position handles the offset. Format: "center {N}%".
            objectPosition: `center ${currentPos}%`,
            display: "block",
            pointerEvents: "none", // so drag events bubble to wrapper
          }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : null}

      {/* Reposition button — only shown when editable and not in repos mode */}
      {showControls && !reposMode && src && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setReposMode(true); }}
          aria-label="Reposition image"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 99,
            padding: "5px 11px",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            zIndex: 2,
          }}
        >
          ↕ Reposition
        </button>
      )}

      {/* Reposition mode — Save / Cancel controls + drag affordance */}
      {showControls && reposMode && (
        <>
          {/* Drag affordance — semi-transparent gradient to make the drag
              area feel obvious without obscuring the image. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg,rgba(0,0,0,0.15) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 70%,rgba(0,0,0,0.15) 100%)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              pointerEvents: "none",
              zIndex: 2,
              backdropFilter: "blur(6px)",
            }}
          >
            ⬍ Drag to reposition
          </div>
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              display: "flex",
              gap: 6,
              zIndex: 3,
            }}
          >
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); commitCancel(); }}
              style={{
                background: "rgba(0,0,0,0.7)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 99,
                padding: "5px 11px",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                backdropFilter: "blur(6px)",
              }}
            >
              Cancel
            </button>
            <button
              disabled={saving}
              onClick={e => { e.preventDefault(); e.stopPropagation(); commitSave(); }}
              style={{
                background: saving ? "rgba(124,58,237,0.5)" : "#7C3AED",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 99,
                padding: "5px 13px",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

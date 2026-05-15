// ─── components/CropModal.tsx ────────────────────────────────────────
// Instagram-style image crop modal.
//
// Hands the user a square (or arbitrary aspect) crop frame with:
//   • Pinch to zoom (mobile) / mouse wheel (desktop)
//   • Drag to pan the photo under the frame
//   • Aspect ratio locked to whatever the caller passes (default 1:1)
//
// Returns a cropped File via onCrop. The original file is not modified —
// we re-encode the visible region to JPEG, ~85% quality, which usually
// shrinks output substantially even before our existing compressImage()
// step in the upload pipeline.
//
// Used by the post composer (workout/meal/wellness photos), profile
// picture upload, and any other photo input where a square preview is
// shown later. Optional `aspect` prop lets banner-style crops use 3:1
// or whatever.
//
// Built on react-easy-crop — a well-maintained ~10kb library that
// handles the touch/zoom/pan UI we'd otherwise reinvent. Output coords
// arrive as pixels, we use canvas to extract.

"use client";

import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";

interface CropModalProps {
  /** Image source — data URL or blob URL from the file picker. */
  imageSrc: string;
  /** Aspect ratio (w/h). 1 = square (default). 3 = banner. 0.75 = portrait. */
  aspect?: number;
  /** Called with the cropped JPEG as a File. */
  onCrop: (croppedFile: File) => void;
  /** Called when the user cancels. */
  onCancel: () => void;
  /** Optional title shown at the top of the modal. */
  title?: string;
}

export default function CropModal({
  imageSrc,
  aspect = 1,
  onCrop,
  onCancel,
  title = "Crop photo",
}: CropModalProps) {
  // Position of the crop frame relative to the image (-0.5 to 0.5 conceptually,
  // but react-easy-crop uses pixel offsets internally; we just pass through).
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  // Zoom level — 1 fits the image inside the frame; >1 zooms in.
  const [zoom, setZoom] = useState(1);
  // Pixel coordinates of the crop region in the source image. Updated as the
  // user drags/zooms; the most recent value is what we'll re-encode on Apply.
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  const onCropComplete = useCallback((_areaPercent: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleApply() {
    if (!croppedAreaPixels || working) return;
    setWorking(true);
    try {
      const file = await renderCroppedFile(imageSrc, croppedAreaPixels);
      onCrop(file);
    } catch (err) {
      console.error("Crop failed:", err);
      alert("Couldn't crop the image. Try again or pick a different photo.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0, 0, 0, 0.95)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Title bar with Cancel / Apply */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          paddingTop: "max(16px, env(safe-area-inset-top))",
          background: "rgba(0, 0, 0, 0.6)",
        }}
      >
        <button
          onClick={onCancel}
          disabled={working}
          style={{
            background: "transparent", border: "none",
            color: "#9CA3AF", fontSize: 15, fontWeight: 600,
            cursor: working ? "default" : "pointer",
          }}
        >
          Cancel
        </button>
        <div style={{ color: "#F0F0F0", fontSize: 15, fontWeight: 700 }}>{title}</div>
        <button
          onClick={handleApply}
          disabled={working || !croppedAreaPixels}
          style={{
            background: "transparent", border: "none",
            color: working || !croppedAreaPixels ? "#5B5B5B" : "#7C3AED",
            fontSize: 15, fontWeight: 800,
            cursor: working || !croppedAreaPixels ? "default" : "pointer",
          }}
        >
          {working ? "..." : "Apply"}
        </button>
      </div>

      {/* Crop surface — fills remaining space. */}
      <div style={{ position: "relative", flex: 1, background: "#000" }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          // Round handles + grid lines feel native on mobile.
          showGrid={true}
          objectFit="contain"
        />
      </div>

      {/* Zoom slider for desktop users (mobile users pinch — both work). */}
      <div
        style={{
          padding: "16px 24px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          background: "rgba(0, 0, 0, 0.6)",
          display: "flex", alignItems: "center", gap: 14,
        }}
      >
        <div style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 700, minWidth: 38 }}>Zoom</div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{
            flex: 1,
            accentColor: "#7C3AED",
          }}
        />
        <div style={{ color: "#9CA3AF", fontSize: 11, minWidth: 38, textAlign: "right" }}>
          {zoom.toFixed(1)}×
        </div>
      </div>
    </div>
  );
}

// ─── Cropped image rendering ─────────────────────────────────────────
// react-easy-crop just tells us "user wants this rectangle of the
// source image." We have to actually do the cropping ourselves by
// painting that rectangle into a canvas and reading back JPEG bytes.

async function renderCroppedFile(imageSrc: string, area: Area): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  // Output dimensions match the crop region. Browser will downscale
  // for upload anyway via our compressImage() step, but starting at
  // 1:1 keeps quality during the canvas re-encode.
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(
    image,
    area.x, area.y, area.width, area.height,  // source rect
    0, 0, area.width, area.height,             // dest rect (whole canvas)
  );

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error("canvas.toBlob failed")),
      "image/jpeg",
      0.92, // quality — compressImage() does further compression on upload
    );
  });

  return new File([blob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous"; // allow cropping data URLs / blob URLs without taint
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 60)}`));
    img.src = src;
  });
}

/**
 * Client-side image compression. Accepts either a File or a base64 data URL,
 * returns a JPEG File downscaled so the longest edge is at most `maxDimension`.
 *
 * Why this exists:
 * - iPhone photos can be 4-8MB; Vercel Hobby tier rejects bodies > 4.5MB
 * - iPhone HEIC photos aren't accepted by Supabase Storage MIME validation
 * - Re-encoding through a canvas gives a clean JPEG every time
 *
 * Usage with File:
 *   const compressed = await compressImage(file);
 *   await uploadPhoto(compressed, 'activity', 'path/file.jpg');
 *
 * Usage with base64 data URL:
 *   const compressed = await compressImage(dataUrl);
 *   await uploadPhoto(compressed, 'activity', 'path/file.jpg');
 *
 * @param source File or base64 data URL string
 * @param maxDimension Longest edge in pixels after resize (default 1600)
 * @param quality JPEG quality 0..1 (default 0.85 — visually lossless-ish)
 * @returns Promise resolving to a re-encoded JPEG File
 */
export async function compressImage(
  source: File | string,
  maxDimension = 1600,
  quality = 0.85
): Promise<File> {
  // Build a URL we can hand to <img>. Both File and data-URL inputs supported.
  let imgSrc: string;
  let blobUrlToRevoke: string | null = null;
  if (typeof source === "string") {
    imgSrc = source;
  } else {
    blobUrlToRevoke = URL.createObjectURL(source);
    imgSrc = blobUrlToRevoke;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read image. Format may be unsupported."));
      i.src = imgSrc;
    });

    // Compute target dimensions, preserving aspect ratio.
    let { width, height } = img;
    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.round((height / width) * maxDimension);
        width = maxDimension;
      } else {
        width = Math.round((width / height) * maxDimension);
        height = maxDimension;
      }
    }

    // Draw to offscreen canvas and re-encode as JPEG.
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) throw new Error("Image encoding failed");

    return new File([blob], "upload.jpg", { type: "image/jpeg" });
  } finally {
    if (blobUrlToRevoke) URL.revokeObjectURL(blobUrlToRevoke);
  }
}

// ─── lib/imageUrls.ts ────────────────────────────────────────────────────
// Helpers for serving smaller image variants via Supabase Storage's
// built-in image transformation endpoint.
//
// Why this matters: every <img> in the feed currently loads the
// full-resolution photo, even though the user is looking at a 400px-wide
// card on their phone. A typical iPhone-uploaded photo is 2-3 MB. A
// 600px-wide thumbnail is ~80 KB. That's a 25-30x bandwidth reduction
// per image. On a feed showing 10 posts, that's the difference between
// downloading 25 MB and 800 KB before the page is fully rendered.
//
// How Supabase image transforms work:
//   Original public URL:
//     https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
//   Transform URL (same path, swap segment):
//     https://{project}.supabase.co/storage/v1/render/image/public/{bucket}/{path}?width=600&quality=75
//
// We don't change uploaded images. We just ask Supabase to resize
// on-the-fly when serving for a specific UI use-case.

/**
 * Convert a Supabase storage URL to a transformed (resized) variant.
 *
 * @param url - The original `/object/public/...` URL from Supabase
 * @param opts - Width + quality + optional resize mode
 * @returns Transformed URL, or original URL unchanged if not a Supabase URL
 *
 * Important: returns the original URL if the input isn't a Supabase
 * storage URL (e.g. if it's a third-party image, a data URL, or null).
 * That keeps callsites safe — they don't have to check.
 */
export function thumbUrl(
  url: string | null | undefined,
  opts: { width: number; quality?: number; resize?: 'cover' | 'contain' } = { width: 600 }
): string {
  if (!url || typeof url !== 'string') return url || '';

  // Only transform Supabase storage URLs. Anything else passes through
  // unchanged — third-party URLs, data URLs, blob URLs, etc.
  if (!url.includes('/storage/v1/object/public/')) return url;

  // Skip transformation for non-image files (videos, etc). Cheap suffix
  // check — if it's not one of the common image extensions, don't try
  // to render-resize it.
  if (/\.(mp4|mov|webm|m4v|qt)(\?|#|$)/i.test(url)) return url;

  // Swap the URL segment to hit the transformation endpoint
  const transformedUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  // Build query params. Quality 75 is a sweet spot — visually similar
  // to 90 but ~30% smaller. Resize mode 'cover' is the default for our
  // square/aspect-cropped UI; pass 'contain' if you want letterboxing.
  const params = new URLSearchParams();
  params.set('width', String(opts.width));
  if (opts.quality !== undefined) params.set('quality', String(opts.quality));
  else params.set('quality', '75');
  if (opts.resize) params.set('resize', opts.resize);

  return `${transformedUrl}?${params.toString()}`;
}

/** Common preset sizes — call these instead of memorizing widths. */
export const ImagePresets = {
  /** 80px square — for tiny avatars in lists, comments, etc. */
  avatarSm: (url: string | null | undefined) => thumbUrl(url, { width: 80, quality: 75 }),
  /** 200px square — for medium avatars in cards, profile rails. */
  avatarMd: (url: string | null | undefined) => thumbUrl(url, { width: 200, quality: 80 }),
  /** 400px wide — for thumbnails in mosaic grids (3-up photos). */
  thumb: (url: string | null | undefined) => thumbUrl(url, { width: 400, quality: 75 }),
  /** 800px wide — for feed cards (single large photo, most-used variant). */
  feed: (url: string | null | undefined) => thumbUrl(url, { width: 800, quality: 78 }),
  /** 1200px wide — for lightbox / full-screen viewing. */
  full: (url: string | null | undefined) => thumbUrl(url, { width: 1200, quality: 85 }),
};

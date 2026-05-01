import { supabase } from "./supabase";

/**
 * Upload a File directly to Supabase Storage from the browser, bypassing the
 * Next.js /api/upload route entirely. Required for videos because Vercel's
 * request body limit (4.5MB Hobby / ~50MB Pro) makes server-proxied video
 * uploads impractical.
 *
 * Why this exists alongside lib/uploadPhoto.ts:
 * - uploadPhoto:        File → /api/upload (uses service_role key, bypasses RLS).
 *                       Capped by Vercel body limit. Fine for compressed JPEGs (<1MB).
 * - uploadPhotoDirect:  File → Supabase Storage REST endpoint directly (uses the
 *                       user's auth JWT, RLS-gated). No Vercel hop, ~50MB cap on
 *                       Supabase free tier. Use for videos.
 *
 * RLS contract:
 * - The first folder in `path` MUST be the authenticated user's UUID. The RLS
 *   policy on storage.objects (see lib/migration-posts-bucket-rls.sql) checks
 *   `(storage.foldername(name))[1] = auth.uid()::text`.
 * - Example valid paths:
 *     "70e170ca-4428-.../posts/1730501234-0.mp4"
 *     "70e170ca-4428-.../group-posts/abc/1730501234.mov"
 *
 * Returns the public URL on success, null on failure (logs the error).
 */
export async function uploadPhotoDirect(
  file: File,
  bucket: string,
  path: string
): Promise<string | null> {
  try {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || undefined,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      // Common failure modes:
      //   "new row violates row-level security policy" → RLS migration not run
      //                                                  OR path doesn't start with user.id
      //   "Payload too large"                          → exceeded bucket file-size limit
      //   "duplicate key value"                        → path collision (re-roll Date.now())
      console.error("[uploadPhotoDirect] upload failed:", error);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.error("[uploadPhotoDirect] exception:", e);
    return null;
  }
}

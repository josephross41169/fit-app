// ─── lib/avatarRepair.ts ─────────────────────────────────────────────
// One-shot data repair for users whose avatar got into a broken state.
//
// "Broken state" means: they uploaded a video avatar, the still-frame
// poster extraction failed (most commonly because iPhone Live Photos are
// re-encoded as HEIC and the browser can't decode them in canvas), and
// `users.avatar_url` ended up either null or pointing at the .mp4 file
// itself. <img> tags then fail to render, leaving blank/black circles
// across the feed, comments, group pages, etc.
//
// This module:
//   1. Detects the broken state from the profile object
//   2. Loads the video into an off-screen <video> element
//   3. Seeks to the first frame and draws it to a canvas
//   4. Uploads the canvas as a JPEG to Supabase storage
//   5. Updates the user record's avatar_url to point at the new JPEG
//
// Runs silently — no UI for the repair. The user just notices their
// avatar suddenly appearing in places it wasn't before.
//
// Used by: app/(app)/profile/page.tsx mount effect (own profile only —
// can't repair other users' data because they need to be authenticated
// to update their own row).

import { supabase } from "./supabase";
import { uploadPhoto } from "./uploadPhoto";

// ─── Type ────────────────────────────────────────────────────────────
// Subset of the users row that we need to check + repair.
interface AvatarProfile {
  id: string;
  avatar_url?: string | null;
  avatar_video_url?: string | null;
}

// ─── Detection ───────────────────────────────────────────────────────
/**
 * Returns true when the user's avatar data is in a state that the rest of
 * the app can't render as a still image.
 *
 * Cases we consider broken:
 *   - avatar_video_url is set AND avatar_url is null/empty
 *   - avatar_video_url is set AND avatar_url points at the same URL (mp4
 *     in both slots — the "no poster" fallback path in loadAvatarVideo)
 *   - avatar_video_url is set AND avatar_url ends with a video extension
 *     (.mp4, .mov, .webm) instead of an image extension
 *
 * Returns false when:
 *   - No video avatar (regular still-image users — nothing to repair)
 *   - avatar_url is a real image URL (already works everywhere)
 */
export function needsAvatarRepair(profile: AvatarProfile | null | undefined): boolean {
  if (!profile?.avatar_video_url) return false;
  const stillUrl = profile.avatar_url || "";

  // No still at all
  if (!stillUrl) return true;

  // Same URL as the video — the "fall back to video URL in both slots"
  // path from the original upload code put us here.
  if (stillUrl === profile.avatar_video_url) return true;

  // Still URL ends with a video extension. Sometimes server-side image
  // optimization fails and the storage path keeps the .mp4 extension.
  if (/\.(mp4|mov|webm|avi)(\?|$)/i.test(stillUrl)) return true;

  // Looks valid.
  return false;
}

// ─── Frame extraction ────────────────────────────────────────────────
/**
 * Loads a video URL into an off-screen <video> element, seeks to a
 * frame near the start, and returns the painted canvas as a JPEG blob.
 *
 * Why currentTime=0.1 instead of 0: many encoders pad the first ~50ms
 * with a blank frame. Skipping to 0.1s lands inside the first real
 * content frame.
 *
 * Why crossOrigin="anonymous": canvas.toDataURL/toBlob throws a "tainted
 * canvas" security error if we drew anything from a different origin
 * without explicit CORS opt-in. Our Supabase storage URLs serve
 * Access-Control-Allow-Origin: *, so this works.
 */
async function extractFirstFrame(videoUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    (video as any).playsInline = true; // not typed on HTMLVideoElement in some lib versions
    video.preload = "auto";

    let timeout: ReturnType<typeof setTimeout> | null = null;
    function cleanup() {
      if (timeout) clearTimeout(timeout);
      video.src = "";
      video.load();
    }

    // Hard 15-second timeout — if the video doesn't load by then it
    // probably never will. We don't want this repair to hang.
    timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Video frame extraction timed out"));
    }, 15_000);

    video.onloadedmetadata = () => {
      // Seek to just past 0 — see comment above.
      video.currentTime = 0.1;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        // Use the video's intrinsic dimensions, falling back to a sane
        // default if videoWidth/Height returned 0 (some codecs do that
        // briefly).
        canvas.width = video.videoWidth || 600;
        canvas.height = video.videoHeight || 600;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          return reject(new Error("Canvas 2D context unavailable"));
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) resolve(blob);
            else reject(new Error("canvas.toBlob returned null"));
          },
          "image/jpeg",
          0.92,
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load video: ${videoUrl.slice(0, 80)}`));
    };

    video.src = videoUrl;
  });
}

// ─── Public entry point ──────────────────────────────────────────────
/**
 * Run the repair for the given user. Returns the new avatar_url on
 * success, null on any failure (we don't throw — silent repair).
 *
 * Safe to call repeatedly: the needsAvatarRepair() guard means the
 * second call short-circuits.
 *
 * Idempotent path on the storage bucket: we use a deterministic name
 * (`<userId>/avatar-repaired.jpg`) so re-running this repair overwrites
 * the prior repaired file rather than accumulating debris.
 */
export async function repairBrokenAvatar(profile: AvatarProfile): Promise<string | null> {
  if (!needsAvatarRepair(profile)) return null;
  if (!profile.avatar_video_url) return null; // appeases the type narrowing

  try {
    const frameBlob = await extractFirstFrame(profile.avatar_video_url);

    // uploadPhoto accepts a File. Convert the blob.
    const file = new File([frameBlob], `${profile.id}-avatar.jpg`, {
      type: "image/jpeg",
    });

    const newUrl = await uploadPhoto(
      file,
      "avatars",
      `${profile.id}/avatar-repaired.jpg`,
    );
    if (!newUrl) return null;

    // Persist to the users row. The TypeScript cast is required because
    // the codegen'd types don't yet know about avatar_video_url despite
    // it existing in the database — same stale-types situation that
    // shows up elsewhere in the app.
    const { error } = await supabase
      .from("users")
      .update({ avatar_url: newUrl } as any)
      .eq("id", profile.id);
    if (error) {
      console.error("[avatarRepair] DB update failed:", error.message);
      return null;
    }

    return newUrl;
  } catch (err) {
    console.error("[avatarRepair] repair failed:", err);
    return null;
  }
}

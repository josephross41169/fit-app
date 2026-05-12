// ─── lib/avatarMedia.tsx ─────────────────────────────────────────────
// Tiny helper for rendering an avatar that may be either a still image
// (avatar_url) or a short looping video (avatar_video_url).
//
// Joey's ask: "Can we make it so the moving profile picture works
// everywhere your profile picture is seen?" Originally only the profile
// pages knew about avatar_video_url — feed posts, comments, group
// members, chat panels, etc. all rendered <img src={avatar_url}>. This
// helper centralizes the conditional render so every avatar site can
// adopt video with a 1-line change.
//
// Video pieces use `loop` (continuous play) for tiny avatars — the
// pause-then-replay cycle from the profile-page video is appropriate
// for a big 120px picture but looks like glitching on a 32px avatar
// in chat. The big profile-page avatar still uses its setInterval-
// based 10s cycle directly.
//
// All renders are: autoPlay muted playsInline preload="metadata".
//   - muted is required for iOS autoplay
//   - playsInline keeps it inside the circle (not fullscreen)
//   - preload="metadata" fetches only headers initially; the video
//     content downloads when the element comes near the viewport

"use client";

import React from "react";

interface AvatarMediaProps {
  avatarUrl: string | null | undefined;
  avatarVideoUrl: string | null | undefined;
  style?: React.CSSProperties;
  alt?: string;
  /** Forwarded to img only — video silently hides on error via its
   *  poster, so the onError prop is just an img-specific affordance. */
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

/**
 * Renders a <video> if avatarVideoUrl is set, otherwise <img>.
 * Returns null if neither is set — caller is responsible for the
 * "initials fallback" surrounding markup.
 */
export function AvatarMedia({
  avatarUrl,
  avatarVideoUrl,
  style,
  alt = "",
  onError,
}: AvatarMediaProps) {
  if (avatarVideoUrl) {
    return (
      <video
        src={avatarVideoUrl}
        poster={avatarUrl || undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        style={style}
      />
    );
  }
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        loading="lazy"
        decoding="async"
        alt={alt}
        style={style}
        onError={onError}
      />
    );
  }
  return null;
}

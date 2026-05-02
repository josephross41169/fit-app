// ─── components/Skeleton.tsx ────────────────────────────────────────────
// Skeleton loader primitives. Replaces the spinning-circle "loading…" UX
// across the app with content-shaped placeholders so the page feels
// roughly 2x faster even when the underlying data load is unchanged.
//
// Why this works (perception):
//   • Spinners create uncertainty — user has no idea what's loading or
//     when it'll appear
//   • Content-shaped skeletons let the user pre-process the layout — by
//     the time real data arrives, their eyes already know where to look
//   • Subtle pulse animation reinforces "in progress" without stealing
//     attention
//
// We use only one base building block (`SkeletonBlock`) and compose
// page-specific skeletons (Feed, Profile, etc.) from it. Adding a new
// page-specific skeleton should take 10 lines.

"use client";

import React from "react";

// Color tokens — match the dark theme already used everywhere
const SK_BG = "#1A1228";       // base block color
const SK_HIGHLIGHT = "#2D1F52"; // shimmer highlight color

/**
 * The single building block. Renders a pulsing rounded rectangle.
 *
 * Props:
 *   width / height — any CSS size (number → px). Width defaults to 100%.
 *   radius         — corner radius. Default 8px. Use 999 for circle/pill.
 *   style          — optional inline style override (margins, etc.)
 */
export function SkeletonBlock({
  width = "100%",
  height = 16,
  radius = 8,
  style = {},
}: {
  width?: string | number;
  height?: string | number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        // Linear-gradient with shifting position drives the shimmer.
        // Animation lives in the global keyframes block at the bottom of
        // this file (injected via <style> from the consumer page).
        background: `linear-gradient(90deg, ${SK_BG} 0%, ${SK_HIGHLIGHT} 50%, ${SK_BG} 100%)`,
        backgroundSize: "200% 100%",
        animation: "skeletonShimmer 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

/**
 * Inject the shimmer keyframes once. Call this from any page that uses
 * <SkeletonBlock /> — e.g. inside the page's existing global <style jsx>
 * block, or as a standalone <SkeletonStyles /> at the top of the page.
 *
 * Why not put it inside SkeletonBlock? React would inject one <style>
 * per block which is wasteful. One per page is enough.
 */
export function SkeletonStyles() {
  return (
    <style jsx global>{`
      @keyframes skeletonShimmer {
        0%   { background-position: 200% 50%; }
        100% { background-position: -200% 50%; }
      }
    `}</style>
  );
}

// ─── Page-specific compositions ────────────────────────────────────────
// These are the actual placeholders dropped into pages. Keep them visually
// close to the real content's layout so the swap-in feels seamless.

/**
 * Feed post card skeleton. Mirrors the shape of a real post:
 * avatar + name strip on top, big media area, caption + actions below.
 *
 * Pass `count` to render multiple stacked skeletons.
 */
export function FeedPostSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "#0D0820",
            borderRadius: 18,
            border: "1px solid #1E1530",
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          {/* Author row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
            <SkeletonBlock width={40} height={40} radius={999} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <SkeletonBlock width="40%" height={12} />
              <SkeletonBlock width="25%" height={10} />
            </div>
          </div>
          {/* Media (big square placeholder — most posts have one) */}
          <SkeletonBlock width="100%" height={360} radius={0} />
          {/* Action bar */}
          <div style={{ display: "flex", gap: 10, padding: "12px 16px" }}>
            <SkeletonBlock width={28} height={28} radius={999} />
            <SkeletonBlock width={28} height={28} radius={999} />
            <SkeletonBlock width={28} height={28} radius={999} />
          </div>
          {/* Caption lines */}
          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            <SkeletonBlock width="80%" height={11} />
            <SkeletonBlock width="60%" height={11} />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Profile header skeleton — banner, avatar, name, stats row.
 * Used at the top of /profile and /profile/[username] while the user
 * row + activity logs load.
 */
export function ProfileHeaderSkeleton() {
  return (
    <div style={{ marginBottom: 24 }}>
      {/* Banner */}
      <SkeletonBlock width="100%" height={200} radius={16} style={{ marginBottom: 16 }} />
      {/* Avatar + name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <SkeletonBlock width={88} height={88} radius={999} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonBlock width="50%" height={20} />
          <SkeletonBlock width="30%" height={14} />
          <SkeletonBlock width="20%" height={11} />
        </div>
      </div>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 8 }}>
        <SkeletonBlock width="50%" height={56} radius={12} />
        <SkeletonBlock width="50%" height={56} radius={12} />
      </div>
    </div>
  );
}

/**
 * Day card skeleton — for the activity log on the post page.
 * Each day card shows up as a single rounded block roughly matching
 * the closed-state height.
 */
export function DayCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <SkeletonBlock width="100%" height={104} radius={22} />
        </div>
      ))}
    </>
  );
}

/**
 * Discover grid skeleton — the photo grid that fills /discover.
 * Renders as a 3-column grid of square thumbs.
 */
export function DiscoverGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} width="100%" height={0} radius={4} style={{ aspectRatio: "1" }} />
      ))}
    </div>
  );
}

/**
 * List item skeleton — for messages, followers/following lists, etc.
 * Single row with circular avatar + two text lines.
 */
export function ListItemSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid #1E1530",
          }}
        >
          <SkeletonBlock width={44} height={44} radius={999} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <SkeletonBlock width="50%" height={13} />
            <SkeletonBlock width="30%" height={10} />
          </div>
        </div>
      ))}
    </>
  );
}

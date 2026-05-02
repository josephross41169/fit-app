"use client";

// ─── app/(app)/recap/page.tsx ──────────────────────────────────────────────
// Default recap route. Always shows the recap of the previous (just-ended)
// week. For deep-linking to a specific week, use /recap/[week].
//
// As of v2 (Spotify-Wrapped redesign), this route renders a fullscreen
// horizontal-swipe carousel rather than a scrollable dashboard. The
// carousel handles its own data loading + theming.

import RecapCarousel from "@/components/recap/RecapCarousel";

export default function RecapPage() {
  return <RecapCarousel />;
}

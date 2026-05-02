"use client";

// ─── app/(app)/recap/[week]/page.tsx ───────────────────────────────────────
// Deep-link route — /recap/2026-04-26 renders the recap of the week starting
// Sunday Apr 26, 2026. The [week] segment is the YYYY-MM-DD of the SUNDAY.
//
// Validation: if the given date isn't a Sunday, we coerce it to the Sunday
// of that week so the URL is forgiving (a user could plausibly link
// /recap/2026-04-29 expecting the week containing Apr 29). We don't block
// future weeks — the recap will just show "no activity" if you query
// ahead in time.
//
// As of v2 (Spotify-Wrapped redesign), renders the fullscreen swipeable
// carousel rather than a scrolling dashboard.

import { useParams } from "next/navigation";
import RecapCarousel from "@/components/recap/RecapCarousel";
import { parseIsoDateLocal, getSundayOfWeek } from "@/lib/recap";

export default function RecapWeekPage() {
  const params = useParams<{ week: string }>();
  const weekParam = params?.week;

  let weekStart: Date | undefined = undefined;
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    const parsed = parseIsoDateLocal(weekParam);
    if (!isNaN(parsed.getTime())) {
      weekStart = getSundayOfWeek(parsed);
    }
  }

  if (!weekStart) {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0D0D", padding: 40, textAlign: "center", color: "#FCA5A5" }}>
        Invalid week format. Use /recap/YYYY-MM-DD (Sunday of the week).
      </div>
    );
  }

  return <RecapCarousel weekStart={weekStart} />;
}

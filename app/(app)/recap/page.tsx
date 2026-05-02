"use client";

// ─── app/(app)/recap/page.tsx ──────────────────────────────────────────────
// Default recap route. Always shows the recap of the previous (just-ended)
// week. For deep-linking to a specific week, use /recap/[week].
// All data fetching and rendering happens inside <RecapView />.

import RecapView from "@/components/RecapView";

export default function RecapPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D" }}>
      <RecapView />
    </div>
  );
}

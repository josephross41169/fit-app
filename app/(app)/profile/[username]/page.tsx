"use client";

// ─── app/(app)/profile/[username]/page.tsx ─────────────────────────────────
// PUBLIC profile route. This used to be a separate, older copy of the profile
// UI that drifted out of sync with the owner's own /profile page. It now
// renders the EXACT same ProfilePage component the owner sees, in read-only
// mode: ProfilePage takes `overrideUserId` + `overrideProfile`, fetches that
// person's data, and hides every owner-only control (Edit, Add highlights,
// Goals +New, Customizations, Report Achievement, photo editing) — showing a
// Follow button in place of Edit. One page, no more drift.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProfilePage from "../page";
import { ProfileHeaderSkeleton, SkeletonStyles } from "@/components/Skeleton";

export default function PublicProfilePage() {
  const params = useParams();
  const username = (params?.username as string) || "";
  const [profileRow, setProfileRow] = useState<any | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!username) { setStatus("notfound"); return; }
      setStatus("loading");
      try {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("username", username)
          .single();
        if (!alive) return;
        if (!data) { setStatus("notfound"); return; }
        setProfileRow(data);
        setStatus("ready");
      } catch {
        if (alive) setStatus("notfound");
      }
    })();
    return () => { alive = false; };
  }, [username]);

  if (status === "loading") {
    return (
      <>
        <SkeletonStyles />
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px" }}>
          <ProfileHeaderSkeleton />
        </div>
      </>
    );
  }

  if (status === "notfound" || !profileRow) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9CA3AF", textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#F9FAFB", marginBottom: 6 }}>Profile not found</div>
        <div style={{ fontSize: 14 }}>We couldn&apos;t find a user with that username.</div>
      </div>
    );
  }

  // Render the one true profile page for this user, read-only.
  return <ProfilePage overrideUserId={profileRow.id} overrideProfile={profileRow} />;
}

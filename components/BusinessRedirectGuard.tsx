"use client";
// ── components/BusinessRedirectGuard.tsx ───────────────────────────────────
// Drop this component at the top of pages that business accounts shouldn't
// access (workout logger, stats, rivals, AI plan, workout plan, PRs).
//
// Business accounts are advertising pages, not personal athletes. Letting
// them visit /post to log a workout would be confusing and pollute data.
// Instead we show a friendly "this page is for personal accounts" notice
// and redirect to their business dashboard (profile page).
//
// Usage in a page:
//   return (
//     <>
//       <BusinessRedirectGuard />
//       ... rest of the personal-only page
//     </>
//   );

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { isBusinessAccount } from "@/lib/businessTypes";

export default function BusinessRedirectGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (isBusinessAccount(user.profile)) {
      setShowNotice(true);
      // Auto-redirect after 3s so they can read the notice.
      const t = setTimeout(() => {
        router.push(`/profile/${user.profile?.username}`);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [user, loading, router]);

  if (!showNotice) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.9)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#1A1D2E",
        border: "1px solid #2A2D3E",
        borderRadius: 16,
        padding: 28,
        maxWidth: 420,
        textAlign: "center",
        color: "#E2E8F0",
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>
          This page is for personal accounts
        </div>
        <div style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.5, marginBottom: 20 }}>
          Workout logging, stats, and rivals are designed for individual athletes.
          Your business account is all about promoting your brand and engaging your
          community.
        </div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>
          Redirecting you back to your business page...
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import { isBusinessAccount } from "@/lib/businessTypes";

// Routes business accounts should never visit. Centralized here so the
// same list powers both the redirect guard and BottomNav's tab filter.
// Keep in sync with BottomNav.tsx businessHiddenHrefs.
const BUSINESS_BLOCKED_ROUTES = [
  "/post",
  "/stats",
  "/rivals",
  "/workout-plan",
  "/prs",
  "/track",
  "/tier-preview",
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Redirect business users away from athlete-only pages. Runs whenever
  // the route or auth state changes. Sends them to their profile, which is
  // their business's "home base" in this app.
  useEffect(() => {
    if (loading || !user) return;
    if (!isBusinessAccount(user.profile)) return;
    const blocked = BUSINESS_BLOCKED_ROUTES.some(r => pathname?.startsWith(r));
    if (blocked) {
      const handle = user.profile?.username;
      router.replace(handle ? `/profile/${handle}` : "/feed");
    }
  }, [pathname, user, loading, router]);

  useEffect(() => {
    function handleToggle(e: Event) {
      const ce = e as CustomEvent<{ collapsed: boolean }>;
      setSidebarCollapsed(ce.detail.collapsed);
    }
    window.addEventListener("sidebar_toggle", handleToggle);
    return () => window.removeEventListener("sidebar_toggle", handleToggle);
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "4px solid #2D1B69", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D" }}>
      <BottomNav />
      <main
        style={{
          // Bottom padding clears the fixed mobile nav (~60px tall) plus
          // the iPhone home indicator (~34px env(safe-area-inset-bottom))
          // plus a little breathing room. md:pb-0 zeros this on desktop
          // where the nav is a left sidebar instead.
          paddingBottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 20px)",
          // On desktop: offset by sidebar width with smooth transition
          transition: "padding-left 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
        // Mobile: no left padding (bottom nav); md+: offset by sidebar
        className="md:pb-0"
      >
        {/* Inline style for responsive sidebar offset — avoids Tailwind purge issues */}
        <style>{`
          @media (min-width: 768px) {
            main {
              padding-left: ${sidebarCollapsed ? "64px" : "224px"} !important;
            }
          }
        `}</style>
        {children}
      </main>
    </div>
  );
}

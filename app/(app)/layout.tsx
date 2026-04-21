"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

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
          paddingBottom: 80,
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

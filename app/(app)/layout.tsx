"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "4px solid #BBF7D0", borderTopColor: "#16A34A", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F0FDF4" }}>
      <BottomNav />
      <main className="pb-20 md:pb-0 md:pl-16 lg:pl-56">{children}</main>
    </div>
  );
}

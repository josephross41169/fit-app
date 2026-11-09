"use client";
// Shows "Couldn't reach the server — Try again" when any request hits its time
// limit (see lib/fetchTimeout.ts), so loading screens don't spin forever.
// Hidden on the Post page, which shows its own inline save error and keeps
// what the user typed (a reload there would lose it).
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NET_TIMEOUT_EVENT } from "@/lib/fetchTimeout";

export default function NetworkTimeoutBanner() {
  const [show, setShow] = useState(false);
  const pathname = usePathname() || "";

  useEffect(() => {
    const on = () => setShow(true);
    window.addEventListener(NET_TIMEOUT_EVENT, on);
    return () => window.removeEventListener(NET_TIMEOUT_EVENT, on);
  }, []);

  // A new screen gets a fresh chance.
  useEffect(() => { setShow(false); }, [pathname]);

  if (!show || pathname.startsWith("/post")) return null;
  return (
    <div role="alert" style={{
      position: "fixed", left: 12, right: 12, top: "calc(env(safe-area-inset-top, 0px) + 12px)", zIndex: 9999,
      maxWidth: 520, margin: "0 auto", background: "#1A1A1A", border: "1.5px solid #DC2626", borderRadius: 14,
      padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <span style={{ flex: 1, color: "#F0F0F0", fontWeight: 700, fontSize: 13 }}>Couldn&apos;t reach the server. Check your connection.</span>
      <button onClick={() => window.location.reload()} style={{
        border: "none", borderRadius: 10, padding: "8px 12px", fontWeight: 900, fontSize: 13, color: "#fff", cursor: "pointer",
        background: "linear-gradient(135deg,#1F5F3F,#4A9D6E)",
      }}>Try again</button>
      <button onClick={() => setShow(false)} aria-label="Dismiss" style={{ border: "none", background: "none", color: "#9CA3AF", fontSize: 18, cursor: "pointer", padding: 0 }}>×</button>
    </div>
  );
}

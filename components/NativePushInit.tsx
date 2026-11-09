"use client";
// Registers the App Store / Play Store app for phone notifications once
// someone is signed in (asks permission the first time), and opens the
// right page when a notification is tapped. Does nothing on the website.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function NativePushInit() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const m = await import("@/lib/nativePushClient");
        if (cancelled || !m.nativePushAvailable()) return;
        // Respect a user who turned notifications off in Settings.
        let optedOut = false;
        try { optedOut = localStorage.getItem("livelee_native_push_off") === "1"; } catch {}
        await m.registerNativePush(user.id, (url) => router.push(url), !optedOut);
      } catch (e) {
        console.warn("[native-push] init failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, router]);
  return null;
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LandingPage() {
  const router = useRouter();
  // If already signed in, the marketing page isn't the right landing — send
  // the user straight to their Home (profile). Show a dark splash (not the
  // marketing copy) while we check, so logged-in users never see a flash.
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let cancelled = false;

    // ── FALLBACK-LOAD ROUTE RESTORATION (native shell) ────────────────────
    // In the Capacitor bundle, dynamic routes like /profile/<username> have
    // no static file — they only exist as client-side routes. If the WebView
    // ever RELOADS while on one (iOS kills/reloads backgrounded WebViews on
    // iPad constantly, which App Review devices do), Capacitor serves
    // index.html as the fallback… which is THIS page. Without the check
    // below, the user gets bounced to Home or stranded on the marketing
    // page ("routed back to login" — App Review, twice). If we boot here
    // but the URL says we're supposed to be somewhere else, re-enter that
    // route client-side and stop.
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path && path !== "/" && path !== "/index.html") {
        router.replace(path + window.location.search);
        return;
      }
    }

    // SAFETY NET: never let the splash hang forever. On iOS Capacitor the
    // session read (Keychain + Supabase) can in rare cases stall — if it does,
    // we must still show the marketing page rather than a permanent blank
    // dark screen (this caused App Store rejection 2.1: "blank screen on
    // launch"). BUT: if a Supabase session token exists in localStorage, this
    // is a logged-in user having a slow moment — showing them the marketing
    // page (with its Log In buttons) reads as being logged out. Give those
    // users a longer grace period before giving up.
    let hasLocalSession = false;
    try {
      hasLocalSession = Object.keys(localStorage).some(
        k => k.startsWith("sb-") && k.includes("auth-token")
      );
    } catch { /* storage unavailable — treat as logged out */ }
    const failSafe = setTimeout(() => {
      if (!cancelled) setChecking(false);
    }, hasLocalSession ? 8000 : 2500);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled && data.session) {
          clearTimeout(failSafe);
          router.replace("/profile");
          return;
        }
      } catch { /* no session check — fall through to marketing */ }
      if (!cancelled) {
        clearTimeout(failSafe);
        setChecking(false);
      }
    })();

    return () => { cancelled = true; clearTimeout(failSafe); };
  }, [router]);

  if (checking) return <div style={{ minHeight: "100vh", background: "#0E1311" }} />;

  const features = [
    { icon: "💪", title: "Log Workouts", desc: "Track every rep, set, and PR" },
    { icon: "🥗", title: "Track Nutrition", desc: "Log meals and hit your macros" },
    { icon: "🏆", title: "Compete", desc: "Join challenges, earn badges" },
    { icon: "🤝", title: "Connect", desc: "Follow athletes, share progress" },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #5BBE93 0%, #86CFAE 50%, #FF8C42 100%)" }}>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20"
          style={{ background: "rgba(255,255,255,0.3)" }} />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: "rgba(255,255,255,0.4)" }} />
        <div className="absolute top-1/3 left-10 w-20 h-20 rounded-full opacity-15"
          style={{ background: "rgba(255,255,255,0.5)" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center px-6 py-12 max-w-sm w-full mx-auto">

        {/* Logo */}
        <div className="mb-3 text-center">
          <div className="text-9xl font-black text-white tracking-tighter leading-none drop-shadow-lg">
            Livelee
          </div>
          <div className="text-5xl -mt-2">💪</div>
        </div>

        {/* Tagline */}
        <p className="text-white text-xl font-semibold mb-2 tracking-wide text-center">
          Track. Connect. Compete.
        </p>
        <p className="text-orange-100 text-sm text-center mb-10">
          The fitness social app built for people who show up.
        </p>

        {/* Features */}
        <div className="w-full grid grid-cols-2 gap-3 mb-10">
          {features.map((f) => (
            <div key={f.title}
              className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4 border border-white border-opacity-30">
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-white font-bold text-sm">{f.title}</div>
              <div className="text-orange-100 text-xs mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link href="/signup"
          className="w-full py-4 rounded-2xl font-bold text-lg text-center transition-all duration-200 active:scale-95 shadow-lg"
          style={{ background: "#FFFFFF", color: "#5BBE93" }}>
          Get Started · It&apos;s Free
        </Link>

        <p className="mt-4 text-orange-100 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-white font-semibold underline underline-offset-2">
            Sign In
          </Link>
        </p>

        {/* Social proof */}
        <div className="mt-10 flex items-center gap-2">
          <div className="flex -space-x-2">
            {["JM", "SC", "MD", "LF"].map((init, i) => (
              <div key={i}
                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                style={{ background: i % 2 === 0 ? "#5BBE93" : "#86CFAE", opacity: 0.9 - i * 0.1 }}>
                {init}
              </div>
            ))}
          </div>
          <p className="text-orange-100 text-xs">
            <span className="text-white font-semibold">2,400+ athletes</span> already crushing it
          </p>
        </div>
      </div>
    </div>
  );
}



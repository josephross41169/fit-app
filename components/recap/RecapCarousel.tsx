"use client";

// ─── components/recap/RecapCarousel.tsx ────────────────────────────────────
// Replaces the dashboard-style /recap page with a Spotify-Wrapped-style
// horizontal-swipe carousel. Each card is a themed full-screen view of
// one slice of the user's week.
//
// Interaction model:
//   • Mobile: swipe left/right between cards
//   • Desktop: click left/right edges or use arrow keys
//   • Both: tap dot indicators at top to jump to a specific card
//   • Each card has a "Share" button that captures THAT card as an image
//
// Architecture:
//   • This component owns navigation state (currentIndex)
//   • Card array is built dynamically from data — empty cards get skipped
//     (e.g. no lifts logged → no LiftsCard in the stack)
//   • Per-card share = render the current card off-screen at 1080x1920,
//     html2canvas it, then Web Share API (mobile) / download (desktop)

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  buildRecap,
  getPreviousWeekStart,
  type Recap,
} from "@/lib/recap";
import { computeAllStreaks, type StreakResult } from "@/lib/streaks";
import { pickTheme, type Theme } from "./themes";
import {
  TitleCard,
  LiftsCard,
  CardioCard,
  WellnessCard,
  PhotosCard,
  StreaksCard,
  AchievementsCard,
  OutroCard,
} from "./cards/AllCards";

type Props = {
  /** Sunday-midnight Date for the week to render. Defaults to last week. */
  weekStart?: Date;
};

type Streaks = { workout: StreakResult; wellness: StreakResult; nutrition: StreakResult };

// ─── Card descriptor ──────────────────────────────────────────────────────
// Each entry pairs a render function with a "should-include" predicate.
// At runtime we filter to only the cards with data, building an array
// of 3-8 cards that match what actually happened that week.
type CardDescriptor = {
  key: string;
  /** Returns true if this card should appear in the stack. */
  show: (r: Recap, s: Streaks | null) => boolean;
  /** Renders the card content. */
  render: (r: Recap, s: Streaks | null, t: Theme, username?: string) => React.ReactNode;
};

const CARD_DEFS: CardDescriptor[] = [
  {
    key: "title",
    show: () => true,
    render: (r, _s, t) => <TitleCard theme={t} recap={r} />,
  },
  {
    key: "lifts",
    show: r => r.lifts.sessions > 0,
    render: (r, _s, t) => <LiftsCard theme={t} recap={r} />,
  },
  {
    key: "cardio",
    show: r => r.cardio.sessions > 0,
    render: (r, _s, t) => <CardioCard theme={t} recap={r} />,
  },
  {
    key: "wellness",
    show: r => r.wellness.sessions > 0,
    render: (r, _s, t) => <WellnessCard theme={t} recap={r} />,
  },
  {
    key: "photos",
    show: r => r.photos.length > 0,
    render: (r, _s, t) => <PhotosCard theme={t} recap={r} />,
  },
  {
    key: "streaks",
    show: (_r, s) => !!s, // always show if streaks loaded
    render: (_r, s, t) => <StreaksCard theme={t} streaks={s} />,
  },
  {
    key: "achievements",
    show: r => r.badgesEarned.length > 0 || r.placesTagged.length > 0 || r.lifts.prs.length > 0,
    render: (r, _s, t) => <AchievementsCard theme={t} recap={r} />,
  },
  {
    key: "outro",
    show: () => true,
    render: (r, _s, t, username) => <OutroCard theme={t} recap={r} username={username} />,
  },
];

export default function RecapCarousel({ weekStart: weekStartProp }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [streaks, setStreaks] = useState<Streaks | null>(null);
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carousel navigation state
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Touch tracking for swipe gesture
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const weekStart = useMemo(() => {
    if (weekStartProp) return weekStartProp;
    return getPreviousWeekStart();
  }, [weekStartProp]);

  // Theme for this week
  const theme = useMemo(() => recap ? pickTheme(recap, streaks ? {
    workout: streaks.workout.current,
    wellness: streaks.wellness.current,
    nutrition: streaks.nutrition.current,
  } : undefined) : null, [recap, streaks]);

  // Filtered card list — only cards with data
  const cards = useMemo(() => {
    if (!recap || !theme) return [];
    return CARD_DEFS.filter(d => d.show(recap, streaks));
  }, [recap, streaks, theme]);

  // ─── Data load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const startIso = weekStart.toISOString();
        const endIso = weekEnd.toISOString();

        const [weekLogsRes, historyLogsRes, badgesRes, postsRes, profileRes] = await Promise.all([
          supabase
            .from("activity_logs")
            .select("id, log_type, workout_category, workout_type, workout_duration_min, exercises, cardio, wellness_type, wellness_duration_min, logged_at, created_at")
            .eq("user_id", user.id)
            .gte("logged_at", startIso)
            .lte("logged_at", endIso),
          supabase
            .from("activity_logs")
            .select("log_type, exercises")
            .eq("user_id", user.id)
            .eq("log_type", "workout")
            .lt("logged_at", startIso),
          supabase
            .from("badges")
            .select("id, badge_id, created_at")
            .eq("user_id", user.id)
            .gte("created_at", startIso)
            .lte("created_at", endIso),
          supabase
            .from("posts")
            .select("id, user_id, caption, media_url, media_urls, media_types, media_positions, likes_count, created_at, locationData:locations(name, city)")
            .eq("user_id", user.id)
            .gte("created_at", startIso)
            .lte("created_at", endIso)
            .order("created_at", { ascending: false }),
          supabase
            .from("users")
            .select("username")
            .eq("id", user.id)
            .single(),
        ]);
        if (cancelled) return;

        // If the locations join failed (e.g. RLS blocks it or FK isn't set
        // up), retry without the join — we still get photos, just no
        // location names for the Achievements card.
        let postsData = postsRes.data;
        if (postsRes.error && /location/i.test(postsRes.error.message || "")) {
          const fallback = await supabase
            .from("posts")
            .select("id, user_id, caption, media_url, media_urls, media_types, media_positions, likes_count, created_at")
            .eq("user_id", user.id)
            .gte("created_at", startIso)
            .lte("created_at", endIso)
            .order("created_at", { ascending: false });
          postsData = fallback.data;
        }

        const built = buildRecap(
          weekStart,
          (weekLogsRes.data || []) as any[],
          (historyLogsRes.data || []) as any[],
          (badgesRes.data || []) as any[],
          (postsData || []) as any[]
        );
        setRecap(built);
        setUsername((profileRes.data as any)?.username || undefined);

        // Streaks are CURRENT (live), not week-bounded
        const streakSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data: streakLogs } = await supabase
          .from("activity_logs")
          .select("log_type, logged_at, created_at")
          .eq("user_id", user.id)
          .in("log_type", ["workout", "wellness", "nutrition"])
          .gte("logged_at", streakSince);
        if (cancelled) return;
        setStreaks(computeAllStreaks((streakLogs || []) as any[]));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Couldn't load recap");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, weekStart]);

  // ─── Keyboard navigation ────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") router.push("/feed");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, currentIndex]);

  function goNext() {
    setCurrentIndex(i => Math.min(cards.length - 1, i + 1));
  }
  function goPrev() {
    setCurrentIndex(i => Math.max(0, i - 1));
  }

  // ─── Touch handling ─────────────────────────────────────────────────
  // We track both X and Y so we can ignore vertical swipes (which the
  // user might use to scroll, not navigate).
  function onTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    const dy = e.changedTouches[0].clientY - (touchStartYRef.current || 0);
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    // Require horizontal motion >50px and dx > dy (so vertical scrolls
    // don't accidentally trigger nav)
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) goPrev();
    else goNext();
  }

  // ─── Render guards ──────────────────────────────────────────────────
  if (!user) {
    return <FullScreenMessage message="Sign in to view your recap." />;
  }
  if (loading || !recap || !theme) {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#9CA3AF" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: "4px solid #2D1F52", borderTopColor: "#7C3AED", animation: "rspin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <style>{`@keyframes rspin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Loading your recap…</div>
        </div>
      </div>
    );
  }
  if (error) {
    return <FullScreenMessage message={`⚠️ ${error}`} />;
  }
  if (cards.length === 0) {
    return <FullScreenMessage message="No data for this week." />;
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Top: dot indicators */}
      <div style={{
        display: "flex", gap: 6, padding: "12px 16px",
        background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)",
        position: "relative", zIndex: 10,
      }}>
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            style={{
              flex: 1,
              height: 3,
              border: "none",
              borderRadius: 2,
              background: i <= currentIndex ? "#fff" : "rgba(255,255,255,0.3)",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.2s",
            }}
            aria-label={`Card ${i + 1} of ${cards.length}`}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={() => router.push("/feed")}
        aria-label="Close"
        style={{
          position: "absolute", top: 22, right: 16, zIndex: 20,
          background: "rgba(0,0,0,0.5)", color: "#fff",
          border: "none", borderRadius: "50%", width: 32, height: 32,
          fontSize: 18, lineHeight: 1, cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        ×
      </button>

      {/* Card area — only the active card is mounted to keep DOM light.
          Each card slot constrains its child to a portrait aspect ratio
          (max ~430px wide, scales to 9:16 height) so on wide desktops
          the card doesn't stretch into a banner. CSS vars set here drive
          the font sizes inside cards so everything scales relative to
          the CARD width, not the viewport width. */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex",
            transform: `translateX(-${currentIndex * 100}%)`,
            transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
            willChange: "transform",
          }}
        >
          {cards.map((card, i) => (
            <div
              key={card.key}
              data-card-index={i}
              data-card-key={card.key}
              style={{
                flexShrink: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 8px",
              }}
            >
              <div
                className="recap-card-slot"
                style={{
                  width: "100%",
                  height: "100%",
                  maxWidth: 460,
                  // Portrait card: try to maintain a 9:16 ratio. We cap by
                  // both dimension. On a tall desktop window the card hits
                  // its width cap; on a short window it hits the height cap.
                  aspectRatio: "9 / 16",
                  maxHeight: "100%",
                  borderRadius: 18,
                  overflow: "hidden",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
                  // CSS vars for child font sizing — driven by container width
                  // so a 380px-wide card on mobile and a 460px-wide on desktop
                  // both look proportionally correct.
                  // Using cqw (container query units) where supported with
                  // a fallback to a fixed scale.
                  ["--card-num-size" as any]: "clamp(64px, 22cqw, 110px)",
                  ["--card-hero-size" as any]: "clamp(48px, 14cqw, 76px)",
                  ["--card-title-size" as any]: "clamp(22px, 7cqw, 36px)",
                  ["--card-emoji-size" as any]: "clamp(64px, 22cqw, 110px)",
                  containerType: "inline-size",
                } as React.CSSProperties}
              >
                {card.render(recap, streaks, theme, username)}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop nav arrows — hidden on touch devices via media query */}
        {currentIndex > 0 && (
          <button
            onClick={goPrev}
            aria-label="Previous"
            className="recap-nav-arrow recap-nav-arrow-left"
            style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(0,0,0,0.5)", color: "#fff", border: "none",
              fontSize: 24, cursor: "pointer", zIndex: 5,
              backdropFilter: "blur(8px)",
            }}
          >
            ‹
          </button>
        )}
        {currentIndex < cards.length - 1 && (
          <button
            onClick={goNext}
            aria-label="Next"
            className="recap-nav-arrow recap-nav-arrow-right"
            style={{
              position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(0,0,0,0.5)", color: "#fff", border: "none",
              fontSize: 24, cursor: "pointer", zIndex: 5,
              backdropFilter: "blur(8px)",
            }}
          >
            ›
          </button>
        )}

        {/* Hide arrows on touch devices */}
        <style>{`
          @media (hover: none) {
            .recap-nav-arrow { display: none; }
          }
        `}</style>
      </div>

      {/* Bottom: share + back footer */}
      <div style={{
        display: "flex", gap: 10, padding: "12px 16px 18px",
        background: "linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)",
        position: "relative", zIndex: 10,
      }}>
        <button
          onClick={() => router.push("/feed")}
          style={{
            flexShrink: 0,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff",
            borderRadius: 99,
            padding: "10px 16px",
            fontSize: 13, fontWeight: 700,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          ← Feed
        </button>
        <ShareButton
          theme={theme}
          username={username}
          weekKey={recap.weekStart}
          getCurrentCardElement={() => {
            const wrapper = containerRef.current;
            if (!wrapper) return null;
            // Find the slot for the current card. The slot is the
            // inner constrained portrait box inside the carousel item;
            // that's what we want to rasterize, not the outer item with
            // its letterbox padding.
            const item = wrapper.querySelector(`[data-card-index="${currentIndex}"]`);
            const slot = item?.querySelector(".recap-card-slot");
            return (slot || item) as HTMLElement | null;
          }}
        />
      </div>
    </div>
  );
}

// ─── Share button + image generation ──────────────────────────────────────
// Renders the currently-visible card to a 1080x1920 PNG and either invokes
// the Web Share API (mobile) or downloads (desktop).
function ShareButton({
  theme,
  username,
  weekKey,
  getCurrentCardElement,
}: {
  theme: Theme;
  username?: string;
  weekKey: string;
  getCurrentCardElement: () => HTMLElement | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setError(null);
    setBusy(true);
    try {
      const el = getCurrentCardElement();
      if (!el) throw new Error("Couldn't find card to share");
      const blob = await renderElementToPng(el, 1080, 1920);
      if (!blob) throw new Error("Couldn't render image");

      const filename = `livelee-recap-${weekKey}-${Date.now()}.png`;

      // Try Web Share API first (mobile)
      const file = new File([blob], filename, { type: "image/png" });
      if (typeof navigator !== "undefined" && (navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({
          files: [file],
          title: "My Livelee Weekly Recap",
          text: username ? `@${username}'s week on Livelee` : "Livelee Weekly Recap",
        });
        return;
      }

      // Desktop fallback — download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      // AbortError = user cancelled the native share sheet, ignore
      if (e?.name !== "AbortError") {
        setError(e?.message || "Couldn't share");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={handleShare}
        disabled={busy}
        style={{
          flex: 1,
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
          color: theme.bgBottom,
          border: "none",
          borderRadius: 99,
          padding: "12px 20px",
          fontSize: 14, fontWeight: 900,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          boxShadow: `0 4px 16px ${theme.accent}33`,
        }}
      >
        {busy ? "Generating…" : "📤 Share This Card"}
      </button>
      {error && (
        <div style={{
          position: "absolute", bottom: 70, left: 16, right: 16,
          background: "rgba(220, 38, 38, 0.95)", color: "#fff",
          padding: "10px 14px", borderRadius: 10, fontSize: 12,
          fontWeight: 600, textAlign: "center",
        }}>
          {error}
        </div>
      )}
    </>
  );
}

// ─── Image rendering ──────────────────────────────────────────────────────
// Renders a DOM element to a PNG blob at the target dimensions. Uses
// the SVG <foreignObject> trick — wrap the element's HTML in an SVG,
// rasterize via Image + canvas. No external libraries.
//
// Caveats: requires same-origin or CORS-enabled images. Photos served
// from Supabase Storage need crossOrigin="anonymous" on the <img> tags
// (handled in PhotosCard) AND CORS configured server-side. If photos
// fail to render, the rest of the card still works.
async function renderElementToPng(element: HTMLElement, width: number, height: number): Promise<Blob | null> {
  // Step 1: clone the element so we can adjust styles for export without
  // affecting the live UI
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  // Step 2: serialize the HTML, embedding it inside an SVG foreignObject
  const xml = new XMLSerializer().serializeToString(clone);
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px">
          ${xml}
        </div>
      </foreignObject>
    </svg>
  `;

  // Step 3: rasterize via Image → canvas
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  const img = new Image();
  img.crossOrigin = "anonymous";

  return new Promise((resolve) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      // Fill with black first so any transparent areas don't show as white
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => resolve(b), "image/png", 0.95);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function FullScreenMessage({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ textAlign: "center", color: "#E2E8F0", maxWidth: 320 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{message}</div>
        <button onClick={() => router.push("/feed")} style={{
          background: "#7C3AED", color: "#fff", border: "none",
          borderRadius: 99, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>
          ← Back to feed
        </button>
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const PURPLE = "#7C3AED";
const PURPLE_BG = "rgba(124,58,237,0.15)";

// ── Nav tab definitions ───────────────────────────────────────────────────────
const tabs = [
  {
    href: "/feed", label: "Feed",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? PURPLE : "none"} stroke={active ? PURPLE : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    )
  },
  {
    href: "/discover", label: "Discover",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={active ? PURPLE : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    )
  },
  {
    href: "/post", label: "Post",
    icon: (_active: boolean) => (
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg -mt-3"
        style={{ background: `linear-gradient(135deg, ${PURPLE}, #A78BFA)` }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-6 h-6">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
    )
  },
  {
    href: "/notifications", label: "Alerts",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? PURPLE : "none"} stroke={active ? PURPLE : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    )
  },
  {
    href: "/messages", label: "Messages",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? PURPLE : "none"} stroke={active ? PURPLE : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  },
  {
    href: "/connect", label: "Connect",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? PURPLE : "none"} stroke={active ? PURPLE : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )
  },
  {
    href: "/rivals", label: "Rivals",
    icon: (active: boolean) => (
      <div style={{
        width: 24, height: 24,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: active ? 18 : 16,
        filter: active ? "none" : "grayscale(0.4)",
      }}>
        ⚔️
      </div>
    )
  },
  {
    href: "/workout-plan", label: "AI Plan",
    icon: (active: boolean) => (
      <div style={{
        width: 24, height: 24,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: active ? 18 : 16,
        filter: active ? "none" : "grayscale(0.4)",
      }}>
        🤖
      </div>
    )
  },
  {
    href: "/stats", label: "Stats",
    icon: (active: boolean) => (
      <div style={{
        width: 24, height: 24,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: active ? 18 : 16,
        filter: active ? "none" : "grayscale(0.4)",
      }}>
        📊
      </div>
    )
  },
  {
    href: "/profile", label: "Profile",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? PURPLE : "none"} stroke={active ? PURPLE : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  },
];

// ── Badge component ───────────────────────────────────────────────────────────
function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div style={{
      position: "absolute",
      top: -3, right: -3,
      minWidth: 16, height: 16,
      borderRadius: 8,
      background: "#EF4444",
      color: "#fff",
      fontSize: 9,
      fontWeight: 900,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 3px",
      border: "2px solid #0D0D0D",
      lineHeight: 1,
      zIndex: 10,
    }}>
      {count > 99 ? "99+" : count}
    </div>
  );
}

// ── Desktop sidebar nav item ──────────────────────────────────────────────────
function SideNavItem({ tab, active, badge }: { tab: typeof tabs[0]; active: boolean; badge?: number }) {
  return (
    <Link href={tab.href}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-150 group"
      style={{ background: active ? PURPLE_BG : "transparent", position: "relative" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        {tab.icon(active)}
        {badge ? <Badge count={badge} /> : null}
      </div>
      <span className="text-sm font-semibold hidden lg:block"
        style={{ color: active ? PURPLE : "#9CA3AF" }}>
        {tab.label}
      </span>
      {badge ? (
        <span className="hidden lg:flex ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: "#EF4444", color: "#fff", fontSize: 10 }}>
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

// ── Main BottomNav ────────────────────────────────────────────────────────────
export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // ── Unread messages badge ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setUnreadMessages(0); return; }
    if (pathname === '/messages') { setUnreadMessages(0); return; }

    let cancelled = false;

    async function fetchUnread() {
      try {
        const { data: parts } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user!.id);

        if (cancelled) return;
        if (!parts || parts.length === 0) { setUnreadMessages(0); return; }

        const convIds = parts.map((p: any) => p.conversation_id);
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', convIds)
          .neq('sender_id', user!.id)
          .is('read_at', null);

        if (!cancelled) setUnreadMessages(count || 0);
      } catch {
        if (!cancelled) setUnreadMessages(0);
      }
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);

    let channel: any = null;
    try {
      channel = supabase
        .channel(`nav-msg-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
          () => { fetchUnread(); })
        .subscribe();
    } catch { /* realtime not available yet */ }

    return () => {
      cancelled = true;
      clearInterval(interval);
      try { channel?.unsubscribe(); } catch {}
    };
  }, [user, pathname]);

  // ── Unread notifications badge ───────────────────────────────────────────
  useEffect(() => {
    if (!user) { setUnreadNotifs(0); return; }
    if (pathname === '/notifications') { setUnreadNotifs(0); return; }

    let cancelled = false;

    async function fetchUnreadNotifs() {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', user!.id)
          .is('read_at', null);
        if (!cancelled) setUnreadNotifs(count || 0);
      } catch {
        if (!cancelled) setUnreadNotifs(0);
      }
    }

    fetchUnreadNotifs();
    const interval = setInterval(fetchUnreadNotifs, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, pathname]);

  const getBadge = (href: string) => {
    if (href === '/messages') return unreadMessages;
    if (href === '/notifications') return unreadNotifs;
    return 0;
  };

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{ background: "#0D0D0D", borderColor: "#1A1228" }}>
        <div className="flex items-center justify-around px-2 pb-safe">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            const badge = getBadge(tab.href);
            return (
              <Link key={tab.href} href={tab.href}
                className="flex flex-col items-center gap-0.5 py-2 px-3 min-w-[44px]"
                style={{ position: "relative" }}>
                <div style={{ position: "relative" }}>
                  {tab.icon(active)}
                  {badge > 0 && <Badge count={badge} />}
                </div>
                {tab.href !== "/post" && (
                  <span className="text-xs font-medium"
                    style={{ color: active ? PURPLE : "#6B7280" }}>
                    {tab.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full z-50 border-r py-6 px-3 w-16 lg:w-56"
        style={{ background: "#0D0D0D", borderColor: "#1A1228" }}>
        {/* Logo */}
        <div className="mb-8 px-4">
          <span className="text-2xl font-black hidden lg:block" style={{ color: PURPLE }}>FIT ⚡</span>
          <span className="text-2xl font-black lg:hidden" style={{ color: PURPLE }}>F⚡</span>
        </div>

        <div className="flex flex-col gap-1">
          {tabs.map((tab) => (
            <SideNavItem key={tab.href} tab={tab} active={pathname === tab.href} badge={getBadge(tab.href)} />
          ))}
        </div>
      </nav>
    </>
  );
}


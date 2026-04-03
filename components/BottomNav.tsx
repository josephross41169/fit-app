"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/feed", label: "Feed",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? "#16A34A" : "none"} stroke={active ? "#16A34A" : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    )
  },
  {
    href: "/discover", label: "Discovery",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={active ? "#16A34A" : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    )
  },
  {
    href: "/post", label: "Post",
    icon: (_active: boolean) => (
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg -mt-3"
        style={{ background: "linear-gradient(135deg, #16A34A, #22C55E)" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-6 h-6">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
    )
  },

  {
    href: "/messages", label: "Messages",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? "#16A34A" : "none"} stroke={active ? "#16A34A" : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  },
  {
    href: "/connect", label: "Connect",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? "#16A34A" : "none"} stroke={active ? "#16A34A" : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )
  },
  {
    href: "/profile", label: "Profile",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? "#16A34A" : "none"} stroke={active ? "#16A34A" : "#6B7280"} strokeWidth="2" className="w-6 h-6">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  },
];

// Sidebar nav item for desktop
function SideNavItem({ tab, active }: { tab: typeof tabs[0]; active: boolean }) {
  return (
    <Link href={tab.href}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-150 group"
      style={{ background: active ? "#1A2A1A" : "transparent" }}>
      {tab.icon(active)}
      <span className="text-sm font-semibold hidden lg:block"
        style={{ color: active ? "#16A34A" : "#9CA3AF" }}>
        {tab.label}
      </span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{ background: "#0D0D0D", borderColor: "#2A3A2A" }}>
        <div className="flex items-center justify-around px-2 pb-safe">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href}
                className="flex flex-col items-center gap-0.5 py-2 px-3 min-w-[44px]">
                {tab.icon(active)}
                {tab.href !== "/post" && (
                  <span className="text-xs font-medium"
                    style={{ color: active ? "#16A34A" : "#6B7280" }}>
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
        style={{ background: "#0D0D0D", borderColor: "#2A3A2A" }}>
        {/* Logo */}
        <div className="mb-8 px-4">
          <span className="text-2xl font-black hidden lg:block" style={{ color: "#16A34A" }}>FIT ⚡</span>
          <span className="text-2xl font-black lg:hidden" style={{ color: "#16A34A" }}>F⚡</span>
        </div>

        <div className="flex flex-col gap-1">
          {tabs.map((tab) => (
            <SideNavItem key={tab.href} tab={tab} active={pathname === tab.href} />
          ))}
        </div>
      </nav>
    </>
  );
}

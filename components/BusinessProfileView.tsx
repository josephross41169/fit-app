"use client";
// ── components/BusinessProfileView.tsx ─────────────────────────────────────
// Renders a business profile — the "advertising page" layout.
// Completely separate from the athlete profile: no badges, no tier frame,
// no workout stats. Instead, emphasizes contact info, location, hours,
// social links, and the business's posts/events.
//
// Rendered by app/(app)/profile/[username]/page.tsx when the viewed user's
// account_type === "business". Same page handles both layouts so that one
// URL (/profile/@handle) always works regardless of account type.

import { useState } from "react";
import Link from "next/link";
import FollowButton from "@/components/FollowButton";
import ReportModal, { ReportTarget } from "@/components/ReportModal";
import { clearBlockCache } from "@/lib/blocks";
import { getBusinessType } from "@/lib/businessTypes";

interface BusinessProfileViewProps {
  profile: any;
  currentUser: { id: string } | null;
  onMessageClick?: () => void;
  onBlock?: () => void;
}

export default function BusinessProfileView({
  profile,
  currentUser,
  onMessageClick,
  onBlock,
}: BusinessProfileViewProps) {
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [moderationMenuOpen, setModerationMenuOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "about" | "events" | "groups">("posts");

  const businessType = getBusinessType(profile.business_type);
  const isVerified = profile.verification_status === "verified";
  const viewingOwn = currentUser?.id === profile.id;

  // ── Helpers ──────────────────────────────────────────────────────────
  function formatHours(hours: any): string {
    // hours shape: { mon: {open:"06:00",close:"22:00"}, tue: "closed", ... }
    // For the hero card we pick TODAY's hours and show "Open now · 6a-10p"
    // or "Closed today" or blank if no hours set.
    if (!hours) return "";
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const today = days[new Date().getDay()];
    const t = hours[today];
    if (!t || t === "closed") return "Closed today";
    if (typeof t === "object" && t.open && t.close) {
      return `Open today · ${t.open}–${t.close}`;
    }
    return "";
  }

  const todayHours = formatHours(profile.business_hours);

  async function handleBlock() {
    if (!currentUser || blocking) return;
    const ok = window.confirm(`Block ${profile.business_name || profile.full_name}? You won't see their posts and they can't message you.`);
    if (!ok) return;
    setBlocking(true);
    setModerationMenuOpen(false);
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "block_user", payload: { blockerId: currentUser.id, blockedId: profile.id } }),
      });
      clearBlockCache();
      onBlock?.();
    } catch {
      alert("Couldn't block. Try again.");
    } finally {
      setBlocking(false);
    }
  }

  return (
    <div style={{ background: "#0D0D0D", minHeight: "100vh", color: "#F0F0F0", paddingBottom: 80 }}>
      {/* ── HERO BANNER ────────────────────────────────────────────────── */}
      {/* Full-width banner photo (or gradient fallback) with overlaid avatar + name */}
      <div style={{ position: "relative", width: "100%", height: 220, background: profile.banner_url ? `url(${profile.banner_url}) center/cover` : "linear-gradient(135deg, #7C3AED, #A78BFA)" }}>
        {/* Darkening overlay for text legibility */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75) 100%)" }} />
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 20px" }}>
        {/* ── BUSINESS IDENTITY ROW ──────────────────────────────────── */}
        {/* Avatar overlaps banner by ~60px. Name, type badge, verification. */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginTop: -60, marginBottom: 16 }}>
          <div style={{ width: 120, height: 120, borderRadius: 18, background: "#1A1A1A", border: "4px solid #0D0D0D", overflow: "hidden", flexShrink: 0, boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 }}>
                {businessType.emoji}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 70 }}>
            {/* Business name + verified badge inline */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#F0F0F0" }}>
                {profile.business_name || profile.full_name}
              </h1>
              {isVerified && (
                <span title="Verified business" style={{ fontSize: 18, lineHeight: 1 }}>✓</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>@{profile.username}</div>

            {/* Type badge + location + hours quick strip */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
              <span style={{ background: "#2A1F4A", border: "1px solid #7C3AED", color: "#E9D5FF", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>
                {businessType.emoji} {businessType.label}
              </span>
              {profile.city && (
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>📍 {profile.city}</span>
              )}
              {todayHours && (
                <span style={{ fontSize: 12, color: todayHours.startsWith("Open") ? "#22C55E" : "#9CA3AF", fontWeight: 600 }}>
                  🕒 {todayHours}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── ACTION ROW ─────────────────────────────────────────────── */}
        {/* Follow, Message, Website, ⋯ — all the things a user can do with the business */}
        {!viewingOwn && currentUser && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <FollowButton targetUserId={profile.id} />
            {onMessageClick && (
              <button onClick={onMessageClick} style={secondaryBtn}>✉️ Message</button>
            )}
            {profile.business_website && (
              <a href={profile.business_website} target="_blank" rel="noopener noreferrer" style={{ ...secondaryBtn, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                🌐 Website
              </a>
            )}
            {/* ⋯ Report / Block */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setModerationMenuOpen(o => !o)} style={{ ...secondaryBtn, padding: "10px 14px", fontSize: 16 }}>⋯</button>
              {moderationMenuOpen && (
                <>
                  <div onClick={() => setModerationMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41, background: "#1A1D2E", border: "1px solid #2A2D3E", borderRadius: 12, padding: 6, minWidth: 180, boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
                    <button onClick={() => { setModerationMenuOpen(false); setReportTarget({ type: "user", id: profile.id }); }} style={menuItem}>🚩 Report business</button>
                    <button disabled={blocking} onClick={handleBlock} style={{ ...menuItem, color: "#FCA5A5" }}>🚫 Block</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── SHORT BIO ──────────────────────────────────────────────── */}
        {profile.bio && (
          <p style={{ fontSize: 15, color: "#E2E8F0", lineHeight: 1.55, marginBottom: 24 }}>
            {profile.bio}
          </p>
        )}

        {/* ── CONTENT TABS ───────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #2A2D3E", marginBottom: 20 }}>
          {([
            { key: "posts",  label: "📸 Posts"  },
            { key: "events", label: "📅 Events" },
            { key: "groups", label: "👥 Groups" },
            { key: "about",  label: "ℹ️ About"  },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === t.key ? "2px solid #A78BFA" : "2px solid transparent",
              color: activeTab === t.key ? "#F0F0F0" : "#9CA3AF",
              fontWeight: activeTab === t.key ? 700 : 500,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: -1,
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ABOUT TAB — All contact/business info, only shown here ── */}
        {activeTab === "about" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Long description */}
            {profile.business_description_long && (
              <InfoCard title="About">
                <p style={{ fontSize: 14, lineHeight: 1.65, color: "#CBD5E1", whiteSpace: "pre-wrap" }}>
                  {profile.business_description_long}
                </p>
              </InfoCard>
            )}

            {/* Contact info */}
            <InfoCard title="Contact & Location">
              {profile.business_address && (
                <ContactRow icon="📍" label="Address">
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(profile.business_address)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: "#A78BFA", textDecoration: "none" }}
                  >
                    {profile.business_address}
                  </a>
                </ContactRow>
              )}
              {profile.business_phone && (
                <ContactRow icon="📞" label="Phone">
                  <a href={`tel:${profile.business_phone}`} style={{ color: "#A78BFA", textDecoration: "none" }}>
                    {profile.business_phone}
                  </a>
                </ContactRow>
              )}
              {profile.business_email && (
                <ContactRow icon="✉️" label="Email">
                  <a href={`mailto:${profile.business_email}`} style={{ color: "#A78BFA", textDecoration: "none" }}>
                    {profile.business_email}
                  </a>
                </ContactRow>
              )}
              {profile.business_website && (
                <ContactRow icon="🌐" label="Website">
                  <a href={profile.business_website} target="_blank" rel="noopener noreferrer" style={{ color: "#A78BFA", textDecoration: "none" }}>
                    {profile.business_website.replace(/^https?:\/\//, "")}
                  </a>
                </ContactRow>
              )}
              {!profile.business_address && !profile.business_phone && !profile.business_email && !profile.business_website && (
                <div style={{ color: "#6B7280", fontSize: 14, padding: "4px 0" }}>No contact info provided.</div>
              )}
            </InfoCard>

            {/* Hours */}
            {profile.business_hours && (
              <InfoCard title="Hours">
                <HoursTable hours={profile.business_hours} />
              </InfoCard>
            )}

            {/* Social links */}
            {(profile.business_instagram || profile.business_tiktok || profile.business_twitter || profile.business_youtube) && (
              <InfoCard title="Social">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {profile.business_instagram && <SocialChip icon="📷" label="Instagram" url={profile.business_instagram} />}
                  {profile.business_tiktok && <SocialChip icon="🎵" label="TikTok" url={profile.business_tiktok} />}
                  {profile.business_twitter && <SocialChip icon="𝕏" label="Twitter" url={profile.business_twitter} />}
                  {profile.business_youtube && <SocialChip icon="▶️" label="YouTube" url={profile.business_youtube} />}
                </div>
              </InfoCard>
            )}
          </div>
        )}

        {/* ── POSTS TAB ── posts feed comes from parent, shown here ── */}
        {activeTab === "posts" && (
          <div style={{ color: "#6B7280", padding: 40, textAlign: "center", fontSize: 14 }}>
            Posts coming up — this tab will show {profile.business_name || "this business"}'s announcements and content.
          </div>
        )}

        {/* ── EVENTS TAB ── stub for now ── */}
        {activeTab === "events" && (
          <div style={{ color: "#6B7280", padding: 40, textAlign: "center", fontSize: 14 }}>
            📅 Events calendar coming soon.
          </div>
        )}

        {/* ── GROUPS TAB ── stub for now ── */}
        {activeTab === "groups" && (
          <div style={{ color: "#6B7280", padding: 40, textAlign: "center", fontSize: 14 }}>
            👥 Groups this business runs will appear here.
          </div>
        )}
      </div>

      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1A1D2E", border: "1px solid #2A2D3E", borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function ContactRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "6px 0", fontSize: 14 }}>
      <span style={{ fontSize: 15, width: 20 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{label}</div>
        <div style={{ color: "#E2E8F0", fontSize: 14, wordBreak: "break-word" }}>{children}</div>
      </div>
    </div>
  );
}

function HoursTable({ hours }: { hours: any }) {
  const days = [
    { key: "mon", label: "Monday" },
    { key: "tue", label: "Tuesday" },
    { key: "wed", label: "Wednesday" },
    { key: "thu", label: "Thursday" },
    { key: "fri", label: "Friday" },
    { key: "sat", label: "Saturday" },
    { key: "sun", label: "Sunday" },
  ];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <tbody>
        {days.map(d => {
          const t = hours?.[d.key];
          const display = t === "closed" || !t ? "Closed" : (typeof t === "object" ? `${t.open} – ${t.close}` : "");
          return (
            <tr key={d.key}>
              <td style={{ padding: "6px 0", color: "#9CA3AF", width: "45%" }}>{d.label}</td>
              <td style={{ padding: "6px 0", color: display === "Closed" ? "#6B7280" : "#E2E8F0" }}>{display}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SocialChip({ icon, label, url }: { icon: string; label: string; url: string }) {
  // Normalize the URL — if user entered just "@handle" or "handle", treat as raw
  const href = url.startsWith("http") ? url : url;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "7px 12px",
      background: "#252A3D",
      border: "1px solid #2A2D3E",
      borderRadius: 99,
      color: "#E2E8F0",
      textDecoration: "none",
      fontSize: 13,
      fontWeight: 600,
    }}>
      <span>{icon}</span>{label}
    </a>
  );
}

const secondaryBtn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 12,
  border: "1.5px solid #2D1F52",
  background: "#1A1228",
  color: "#E2E8F0",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const menuItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 12px",
  background: "transparent",
  border: "none",
  borderRadius: 8,
  color: "#E2E8F0",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left",
  cursor: "pointer",
};

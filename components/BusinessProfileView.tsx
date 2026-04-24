"use client";
// ── components/BusinessProfileView.tsx ─────────────────────────────────────
// Business profile page with inline editing.
// Click "Edit Profile" → everything becomes editable → "Save all changes".

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/uploadPhoto";
import FollowButton from "@/components/FollowButton";
import ReportModal, { ReportTarget } from "@/components/ReportModal";
import { clearBlockCache } from "@/lib/blocks";
import { BUSINESS_TYPES, getBusinessType } from "@/lib/businessTypes";

interface BusinessProfileViewProps {
  profile: any;
  currentUser: { id: string } | null;
  onMessageClick?: () => void;
  onBlock?: () => void;
  onProfileUpdate?: () => void;
}

type TabKey = "posts" | "events" | "groups" | "about";
const HIGHLIGHT_SLOTS = 9;

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export default function BusinessProfileView({
  profile,
  currentUser,
  onMessageClick,
  onBlock,
  onProfileUpdate,
}: BusinessProfileViewProps) {
  const viewingOwn = currentUser?.id === profile.id;

  // Tab state — persists in URL hash so refreshing/coming back keeps your tab
  const [activeTab, setActiveTab] = useState<TabKey>("posts");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "") as TabKey;
    if (["posts", "events", "groups", "about"].includes(hash)) setActiveTab(hash);
  }, []);
  function switchTab(t: TabKey) {
    setActiveTab(t);
    if (typeof window !== "undefined") history.replaceState(null, "", `#${t}`);
  }

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Editable copies of every field — only used in edit mode
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("gym");
  const [bio, setBio] = useState("");
  const [descLong, setDescLong] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [twitter, setTwitter] = useState("");
  const [youtube, setYoutube] = useState("");
  const [hours, setHours] = useState<Record<string, any>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<string[]>([]);

  // Pull current values into editable state — runs on mount + whenever the
  // profile prop changes (e.g. after a save-and-refetch).
  function initFromProfile() {
    setBusinessName(profile.business_name || profile.full_name || "");
    setBusinessType(profile.business_type || "gym");
    setBio(profile.bio || "");
    setDescLong(profile.business_description_long || "");
    setCity(profile.city || "");
    setAddress(profile.business_address || "");
    setPhone(profile.business_phone || "");
    setContactEmail(profile.business_email || "");
    setWebsite(profile.business_website || "");
    setInstagram(profile.business_instagram || "");
    setTiktok(profile.business_tiktok || "");
    setTwitter(profile.business_twitter || "");
    setYoutube(profile.business_youtube || "");
    setHours(profile.business_hours || {});
    setAvatarUrl(profile.avatar_url || null);
    setBannerUrl(profile.banner_url || null);
    setHighlights(Array.isArray(profile.highlights) ? profile.highlights : []);
  }
  useEffect(() => { initFromProfile(); /* eslint-disable-next-line */ }, [profile]);

  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [moderationMenuOpen, setModerationMenuOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const businessTypeMeta = getBusinessType(editing ? businessType : profile.business_type);
  const isVerified = profile.verification_status === "verified";
  const displayName = editing ? businessName : (profile.business_name || profile.full_name);
  const todayHours = formatTodayHours(editing ? hours : profile.business_hours);

  function toggleDay(day: string) {
    setHours(h => {
      const next = { ...h };
      if (!next[day] || next[day] === "closed") next[day] = { open: "06:00", close: "22:00" };
      else next[day] = "closed";
      return next;
    });
  }
  function updateDayHour(day: string, field: "open" | "close", value: string) {
    setHours(h => {
      const next = { ...h };
      if (!next[day] || next[day] === "closed") next[day] = { open: "06:00", close: "22:00" };
      next[day] = { ...(next[day] as any), [field]: value };
      return next;
    });
  }

  async function pickAndUpload(kind: "avatar" | "banner" | "highlight", slotIdx?: number) {
    if (!currentUser) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const folder = kind === "avatar" ? "avatars" : kind === "banner" ? "banners" : "highlights";
        const url = await uploadPhoto(f, currentUser.id, folder);
        if (!url) return;
        if (kind === "avatar") setAvatarUrl(url);
        else if (kind === "banner") setBannerUrl(url);
        else {
          setHighlights(hs => {
            const next = [...hs];
            if (slotIdx !== undefined) next[slotIdx] = url;
            else next.push(url);
            return next;
          });
        }
      } catch {
        alert("Upload failed. Try again.");
      }
    };
    input.click();
  }
  function removeHighlight(idx: number) {
    setHighlights(hs => hs.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!currentUser || saving) return;
    setSaving(true);
    setSaveError("");

    const cleanedHours: Record<string, any> = {};
    for (const d of DAYS) {
      const v = hours[d.key];
      if (v === "closed") cleanedHours[d.key] = "closed";
      else if (v && typeof v === "object" && v.open && v.close) cleanedHours[d.key] = v;
    }

    const { error } = await supabase.from("users").update({
      business_name: businessName || null,
      full_name: businessName || profile.full_name,
      business_type: businessType,
      bio: bio || null,
      business_description_long: descLong || null,
      city: city || null,
      business_address: address || null,
      business_phone: phone || null,
      business_email: contactEmail || null,
      business_website: website || null,
      business_instagram: instagram || null,
      business_tiktok: tiktok || null,
      business_twitter: twitter || null,
      business_youtube: youtube || null,
      business_hours: Object.keys(cleanedHours).length > 0 ? cleanedHours : null,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      highlights: highlights.filter(Boolean),
    } as any).eq("id", currentUser.id);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditing(false);
    onProfileUpdate?.();
    // Force a soft refresh so the page re-renders with fresh profile data
    if (typeof window !== "undefined") window.location.reload();
  }

  function handleCancel() {
    initFromProfile();
    setEditing(false);
    setSaveError("");
  }

  async function handleBlock() {
    if (!currentUser || blocking) return;
    const ok = window.confirm(`Block ${displayName}?`);
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
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: editing ? 120 : 80 }}>
      {/* Hero banner */}
      <div
        onClick={() => editing && pickAndUpload("banner")}
        style={{
          position: "relative",
          width: "100%",
          height: 240,
          background: (editing ? bannerUrl : profile.banner_url)
            ? `url(${editing ? bannerUrl : profile.banner_url}) center/cover`
            : "linear-gradient(135deg, #7C3AED, #A78BFA)",
          cursor: editing ? "pointer" : "default",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
        {editing && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 }}>
            📷 Click to change banner
          </div>
        )}
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px" }}>
        {/* Identity row — avatar + name */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginTop: -68, marginBottom: 20 }}>
          <div
            onClick={() => editing && pickAndUpload("avatar")}
            style={{
              width: 136, height: 136, borderRadius: 24,
              background: C.card, border: `5px solid ${C.bg}`, overflow: "hidden",
              flexShrink: 0, boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              cursor: editing ? "pointer" : "default", position: "relative",
            }}
          >
            {(editing ? avatarUrl : profile.avatar_url) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={editing ? avatarUrl! : profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 58 }}>
                {businessTypeMeta.emoji}
              </div>
            )}
            {editing && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📷</div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 76 }}>
            {editing ? (
              <input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Business name" style={{ ...inlineInput, fontSize: 26, fontWeight: 900 }} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, color: C.text }}>{displayName}</h1>
                {isVerified && <span title="Verified" style={{ fontSize: 20, color: "#60A5FA" }}>✓</span>}
              </div>
            )}
            <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>@{profile.username}</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "center" }}>
              {editing ? (
                <select value={businessType} onChange={e => setBusinessType(e.target.value)} style={{ ...inlineInput, padding: "4px 10px", fontSize: 12, width: "auto" }}>
                  {BUSINESS_TYPES.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
                </select>
              ) : (
                <span style={pillStyle}>{businessTypeMeta.emoji} {businessTypeMeta.label}</span>
              )}
              {editing ? (
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={{ ...inlineInput, width: 160, fontSize: 12, padding: "4px 8px" }} />
              ) : (
                city && <span style={{ fontSize: 13, color: C.sub }}>📍 {city}</span>
              )}
              {!editing && todayHours && (
                <span style={{ fontSize: 13, color: todayHours.isOpen ? "#22C55E" : C.sub, fontWeight: 600 }}>
                  🕒 {todayHours.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          <StatCard label="Followers" value={profile.followers_count ?? 0} />
          <StatCard label="Following" value={profile.following_count ?? 0} />
          <StatCard label="Verified" value={isVerified ? "Yes" : "—"} accent={isVerified ? "#60A5FA" : undefined} />
        </div>

        {/* Action row */}
        {viewingOwn ? (
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            {!editing ? (
              <button onClick={() => setEditing(true)} style={primaryBtn}>✏️ Edit Profile</button>
            ) : (
              <>
                <button onClick={handleCancel} style={secondaryBtn} disabled={saving}>Cancel</button>
                <button onClick={handleSave} style={primaryBtn} disabled={saving}>
                  {saving ? "Saving..." : "💾 Save changes"}
                </button>
              </>
            )}
          </div>
        ) : currentUser && (
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <FollowButton targetUserId={profile.id} />
            {onMessageClick && <button onClick={onMessageClick} style={secondaryBtn}>✉️ Message</button>}
            {profile.business_website && (
              <a href={profile.business_website} target="_blank" rel="noopener noreferrer" style={{ ...secondaryBtn, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>🌐 Website</a>
            )}
            <div style={{ position: "relative" }}>
              <button onClick={() => setModerationMenuOpen(o => !o)} style={{ ...secondaryBtn, padding: "10px 14px" }}>⋯</button>
              {moderationMenuOpen && (
                <>
                  <div onClick={() => setModerationMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 6, minWidth: 180, boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
                    <button onClick={() => { setModerationMenuOpen(false); setReportTarget({ type: "user", id: profile.id }); }} style={menuItem}>🚩 Report business</button>
                    <button disabled={blocking} onClick={handleBlock} style={{ ...menuItem, color: "#FCA5A5" }}>🚫 Block</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tagline */}
        {editing ? (
          <Card title="Tagline" hint="One line shown beneath your name (max 120 chars).">
            <input value={bio} onChange={e => setBio(e.target.value.slice(0, 120))} placeholder="Las Vegas' home for hardcore training" style={inlineInput} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: "right" }}>{bio.length}/120</div>
          </Card>
        ) : (
          profile.bio && <p style={{ fontSize: 15, color: "#E2E8F0", lineHeight: 1.6, marginBottom: 24 }}>{profile.bio}</p>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          {([
            { key: "posts", label: "📸 Posts" },
            { key: "events", label: "📅 Events" },
            { key: "groups", label: "👥 Groups" },
            { key: "about", label: "ℹ️ About" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => switchTab(t.key)} style={{
              padding: "11px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === t.key ? "2px solid #A78BFA" : "2px solid transparent",
              color: activeTab === t.key ? C.text : C.sub,
              fontWeight: activeTab === t.key ? 700 : 500,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>

        {/* POSTS TAB with highlights */}
        {activeTab === "posts" && (
          <>
            <Card title="📸 Highlights" hint={editing ? "Up to 9 featured photos. Tap a slot to add." : undefined}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {Array.from({ length: HIGHLIGHT_SLOTS }).map((_, i) => {
                  const url = highlights[i];
                  return (
                    <div key={i} style={{ position: "relative", aspectRatio: "1", background: C.input, border: `1px dashed ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                      {url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          {editing && (
                            <button onClick={() => removeHighlight(i)} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, background: "rgba(0,0,0,0.75)", color: "#fff", border: "none", fontSize: 14, cursor: "pointer" }}>×</button>
                          )}
                        </>
                      ) : editing ? (
                        <button onClick={() => pickAndUpload("highlight", i)} style={{ width: "100%", height: "100%", background: "transparent", border: "none", color: C.sub, fontSize: 28, cursor: "pointer" }}>+</button>
                      ) : (
                        <div style={{ width: "100%", height: "100%" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
            <div style={{ color: C.muted, padding: 32, textAlign: "center", fontSize: 14 }}>
              Posts feed coming soon — announcements and content you publish.
            </div>
          </>
        )}

        {activeTab === "events" && (
          <div style={{ color: C.muted, padding: 40, textAlign: "center", fontSize: 14 }}>📅 Events system coming soon.</div>
        )}
        {activeTab === "groups" && (
          <div style={{ color: C.muted, padding: 40, textAlign: "center", fontSize: 14 }}>👥 Groups this business runs will appear here.</div>
        )}

        {activeTab === "about" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card title="About">
              {editing ? (
                <>
                  <textarea rows={5} maxLength={500} value={descLong} onChange={e => setDescLong(e.target.value)} placeholder="Tell people what makes your business special..." style={{ ...inlineInput, resize: "vertical", minHeight: 100 }} />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: "right" }}>{descLong.length}/500</div>
                </>
              ) : (
                profile.business_description_long
                  ? <p style={{ fontSize: 14, lineHeight: 1.65, color: "#CBD5E1", whiteSpace: "pre-wrap", margin: 0 }}>{profile.business_description_long}</p>
                  : <Empty>No description yet.</Empty>
              )}
            </Card>

            <Card title="Contact & Location">
              <ContactField icon="📍" label="Address" editing={editing} value={address} onChange={setAddress} view={profile.business_address} link={profile.business_address ? `https://maps.google.com/?q=${encodeURIComponent(profile.business_address)}` : undefined} placeholder="123 Main St, Las Vegas, NV" />
              <ContactField icon="📞" label="Phone" editing={editing} value={phone} onChange={setPhone} view={profile.business_phone} link={profile.business_phone ? `tel:${profile.business_phone}` : undefined} placeholder="(702) 555-1234" />
              <ContactField icon="✉️" label="Email" editing={editing} value={contactEmail} onChange={setContactEmail} view={profile.business_email} link={profile.business_email ? `mailto:${profile.business_email}` : undefined} placeholder="hello@business.com" />
              <ContactField icon="🌐" label="Website" editing={editing} value={website} onChange={setWebsite} view={profile.business_website} link={profile.business_website} placeholder="https://business.com" displayTransform={(v) => v.replace(/^https?:\/\//, "")} />
            </Card>

            <Card title="Hours" hint={editing ? "Toggle each day on/off." : undefined}>
              <HoursTable hours={editing ? hours : profile.business_hours} editing={editing} onToggle={toggleDay} onChange={updateDayHour} />
            </Card>

            <Card title="Social">
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <SocialInput icon="📷" label="Instagram" value={instagram} onChange={setInstagram} />
                  <SocialInput icon="🎵" label="TikTok" value={tiktok} onChange={setTiktok} />
                  <SocialInput icon="𝕏" label="Twitter" value={twitter} onChange={setTwitter} />
                  <SocialInput icon="▶️" label="YouTube" value={youtube} onChange={setYoutube} />
                </div>
              ) : (
                (profile.business_instagram || profile.business_tiktok || profile.business_twitter || profile.business_youtube) ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {profile.business_instagram && <SocialChip icon="📷" label="Instagram" url={profile.business_instagram} />}
                    {profile.business_tiktok && <SocialChip icon="🎵" label="TikTok" url={profile.business_tiktok} />}
                    {profile.business_twitter && <SocialChip icon="𝕏" label="Twitter" url={profile.business_twitter} />}
                    {profile.business_youtube && <SocialChip icon="▶️" label="YouTube" url={profile.business_youtube} />}
                  </div>
                ) : <Empty>No social links yet.</Empty>
              )}
            </Card>
          </div>
        )}
      </div>

      {editing && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(13,13,13,0.95)", backdropFilter: "blur(8px)",
          borderTop: `1px solid ${C.border}`, padding: "14px 20px",
          display: "flex", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{ maxWidth: 960, width: "100%", display: "flex", gap: 10 }}>
            <button onClick={handleCancel} disabled={saving} style={{ ...secondaryBtn, flex: 1 }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, flex: 2 }}>
              {saving ? "Saving..." : "💾 Save all changes"}
            </button>
          </div>
        </div>
      )}
      {saveError && (
        <div style={{ position: "fixed", bottom: 90, left: 20, right: 20, background: "#2A0F0F", border: "1px solid #DC2626", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#FCA5A5", zIndex: 101, textAlign: "center" }}>{saveError}</div>
      )}

      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: hint ? 4 : 12 }}>{title}</div>
      {hint && <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{hint}</div>}
      {children}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent || C.text }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ContactField({ icon, label, editing, value, onChange, view, link, placeholder, displayTransform }: {
  icon: string; label: string; editing: boolean; value: string; onChange: (v: string) => void;
  view: string | null | undefined; link?: string; placeholder?: string; displayTransform?: (v: string) => string;
}) {
  if (editing) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0" }}>
        <span style={{ fontSize: 16, width: 24 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 3 }}>{label}</div>
          <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inlineInput} />
        </div>
      </div>
    );
  }
  if (!view) return null;
  const display = displayTransform ? displayTransform(view) : view;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", fontSize: 14 }}>
      <span style={{ fontSize: 15, width: 24 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</div>
        <div style={{ color: C.text, fontSize: 14, wordBreak: "break-word" }}>
          {link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "#A78BFA", textDecoration: "none" }}>{display}</a> : display}
        </div>
      </div>
    </div>
  );
}

function HoursTable({ hours, editing, onToggle, onChange }: {
  hours: any; editing: boolean;
  onToggle: (d: string) => void;
  onChange: (d: string, f: "open" | "close", v: string) => void;
}) {
  if (!editing && (!hours || Object.keys(hours).length === 0)) return <Empty>No hours set.</Empty>;
  return (
    <div>
      {DAYS.map(d => {
        const t = hours?.[d.key];
        const isOpen = t && t !== "closed" && typeof t === "object";
        if (editing) {
          return (
            <div key={d.key} style={{ display: "grid", gridTemplateColumns: "90px 80px 1fr 1fr", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{d.label}</div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.sub, cursor: "pointer" }}>
                <input type="checkbox" checked={!!isOpen} onChange={() => onToggle(d.key)} style={{ accentColor: "#7C3AED" }} />Open
              </label>
              {isOpen ? (
                <>
                  <input type="time" value={t.open} onChange={e => onChange(d.key, "open", e.target.value)} style={inlineInput} />
                  <input type="time" value={t.close} onChange={e => onChange(d.key, "close", e.target.value)} style={inlineInput} />
                </>
              ) : (
                <div style={{ gridColumn: "3 / span 2", fontSize: 12, color: C.muted }}>Closed</div>
              )}
            </div>
          );
        }
        if (!t) return null;
        const display = t === "closed" ? "Closed" : (typeof t === "object" ? `${t.open} – ${t.close}` : "");
        return (
          <div key={d.key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.sub }}>{d.label}</span>
            <span style={{ color: display === "Closed" ? C.muted : C.text }}>{display}</span>
          </div>
        );
      })}
    </div>
  );
}

function SocialInput({ icon, label, value, onChange }: { icon: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 16, width: 24 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 3 }}>{label}</div>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={`https://${label.toLowerCase()}.com/yourhandle`} style={inlineInput} />
      </div>
    </div>
  );
}

function SocialChip({ icon, label, url }: { icon: string; label: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "8px 14px", background: C.input, border: `1px solid ${C.border}`,
      borderRadius: 99, color: C.text, textDecoration: "none", fontSize: 13, fontWeight: 600,
    }}>
      <span>{icon}</span>{label}
    </a>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: C.muted, fontSize: 13, padding: "4px 0" }}>{children}</div>;
}

function formatTodayHours(hours: any): { label: string; isOpen: boolean } | null {
  if (!hours) return null;
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const today = days[new Date().getDay()];
  const t = hours[today];
  if (!t || t === "closed") return { label: "Closed today", isOpen: false };
  if (typeof t === "object" && t.open && t.close) return { label: `Open today · ${t.open}–${t.close}`, isOpen: true };
  return null;
}

const C = {
  bg: "#0D0D0D",
  card: "#161A26",
  input: "#1F2333",
  border: "#2A2F42",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  muted: "#6B7280",
};

const pillStyle: React.CSSProperties = {
  background: "#2A1F4A", border: "1px solid #7C3AED", color: "#E9D5FF",
  fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
};

const inlineInput: React.CSSProperties = {
  width: "100%", padding: "9px 12px", background: C.input, border: `1px solid ${C.border}`,
  borderRadius: 10, color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  padding: "11px 20px", borderRadius: 12, border: "none",
  background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
  color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", flex: 1,
};

const secondaryBtn: React.CSSProperties = {
  padding: "11px 18px", borderRadius: 12, border: `1.5px solid ${C.border}`,
  background: C.card, color: C.text, fontWeight: 700, fontSize: 14, cursor: "pointer",
};

const menuItem: React.CSSProperties = {
  display: "block", width: "100%", padding: "9px 12px",
  background: "transparent", border: "none", borderRadius: 8,
  color: C.text, fontSize: 13, fontWeight: 600, textAlign: "left", cursor: "pointer",
};

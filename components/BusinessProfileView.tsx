"use client";
// ── components/BusinessProfileView.tsx ─────────────────────────────────────
// Business profile page with inline editing.
// Click "Edit Profile" → everything becomes editable → "Save all changes".

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { compressImage } from "@/lib/compressImage";
import FollowButton from "@/components/FollowButton";
import ReportModal, { ReportTarget } from "@/components/ReportModal";
import { clearBlockCache } from "@/lib/blocks";
import { BUSINESS_TYPES, getBusinessType } from "@/lib/businessTypes";
import GymLeaderboard from "@/components/GymLeaderboard";

interface BusinessProfileViewProps {
  profile: any;
  currentUser: { id: string } | null;
  onMessageClick?: () => void;
  onBlock?: () => void;
  onProfileUpdate?: () => void;
}

type TabKey = "posts" | "events" | "groups" | "about" | "leaderboard" | "schedule" | "services" | "shop" | "community" | "menu" | "gallery" | "reviews" | "insights";
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

// Call-to-action presets. `label` is stored on the profile; `text`/`emoji`
// drive the button. `kind` decides how the URL is built:
//   - "url"        : use the business_cta_url verbatim
//   - "directions" : build a Google Maps link from the business address
//   - "call"       : tel: link from the business phone
const CTA_PRESETS: { key: string; emoji: string; text: string; kind: "url" | "directions" | "call"; hint: string }[] = [
  { key: "book",       emoji: "📅", text: "Book Now",       kind: "url",        hint: "Link to your booking page" },
  { key: "shop",       emoji: "🛍️", text: "Shop",           kind: "url",        hint: "Link to your store" },
  { key: "join",       emoji: "💪", text: "Join Now",       kind: "url",        hint: "Link to membership sign-up" },
  { key: "signup",     emoji: "✍️", text: "Sign Up",        kind: "url",        hint: "Link to your sign-up form" },
  { key: "menu",       emoji: "📋", text: "View Menu",      kind: "url",        hint: "Link to your menu / catalog" },
  { key: "directions", emoji: "📍", text: "Get Directions", kind: "directions", hint: "Uses your address automatically" },
  { key: "call",       emoji: "📞", text: "Call",           kind: "call",       hint: "Uses your phone number automatically" },
  { key: "contact",    emoji: "✉️", text: "Contact",        kind: "url",        hint: "Link or mailto: for inquiries" },
  { key: "learn",      emoji: "🔗", text: "Learn More",     kind: "url",        hint: "Any link you want to feature" },
];
function getCta(key: string | null | undefined) {
  return CTA_PRESETS.find(c => c.key === key) || null;
}
// Resolve the actual href for a CTA given the business's stored fields.
function resolveCtaHref(preset: { kind: string }, ctaUrl: string | null, address: string | null, phone: string | null): string | null {
  if (preset.kind === "directions") {
    return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  }
  if (preset.kind === "call") {
    return phone ? `tel:${phone.replace(/[^0-9+]/g, "")}` : null;
  }
  if (!ctaUrl) return null;
  return /^https?:\/\/|^mailto:|^tel:/.test(ctaUrl) ? ctaUrl : `https://${ctaUrl}`;
}
// Is an offer object currently active (present + not expired)?
function offerActive(offer: any): boolean {
  if (!offer || !offer.title) return false;
  if (offer.expires_at) return new Date(offer.expires_at).getTime() > Date.now();
  return true;
}

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
    // reviews/events/insights/groups are no longer tabs — a stale hash for
    // those falls through and leaves the default "posts" tab selected.
    if (["posts", "about", "leaderboard", "schedule", "services", "shop", "community", "menu", "gallery"].includes(hash)) setActiveTab(hash);
  }, []);
  function switchTab(t: TabKey) {
    setActiveTab(t);
    if (typeof window !== "undefined") history.replaceState(null, "", `#${t}`);
  }

  // Layer 3 — community posts (people who tagged/@mentioned this business)
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityLoaded, setCommunityLoaded] = useState(false);

  // Lazy-load community posts the first time the Community tab is opened.
  useEffect(() => {
    if (activeTab !== "community" || communityLoaded || communityLoading) return;
    setCommunityLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "get_business_community_posts",
            payload: { businessId: profile.id, username: profile.username, limit: 30 },
          }),
        });
        const json = await res.json();
        setCommunityPosts(Array.isArray(json.posts) ? json.posts : []);
      } catch {
        setCommunityPosts([]);
      } finally {
        setCommunityLoading(false);
        setCommunityLoaded(true);
      }
    })();
  }, [activeTab, communityLoaded, communityLoading, profile.id, profile.username]);

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
  // Layer 1 business features
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDesc, setOfferDesc] = useState("");
  const [offerCode, setOfferCode] = useState("");
  const [offerExpires, setOfferExpires] = useState(""); // yyyy-mm-dd
  const [copiedCode, setCopiedCode] = useState(false);
  // Layer 2 type-specific modules
  const [schedule, setSchedule] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  // Food businesses: menu items (with nutrition facts) + delivery links
  const [menu, setMenu] = useState<any[]>([]);
  const [delivery, setDelivery] = useState<Record<string, string>>({});
  // FAQ + gallery
  const [faq, setFaq] = useState<any[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  // Reviews
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myReviewBody, setMyReviewBody] = useState("");
  const [savingReview, setSavingReview] = useState(false);

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
    // Layer 1 fields
    setCtaLabel(profile.business_cta_label || "");
    setCtaUrl(profile.business_cta_url || "");
    setAnnouncement(profile.business_announcement || "");
    const off = profile.business_offer || null;
    setOfferTitle(off?.title || "");
    setOfferDesc(off?.description || "");
    setOfferCode(off?.code || "");
    setOfferExpires(off?.expires_at ? String(off.expires_at).slice(0, 10) : "");
    // Layer 2 modules
    setSchedule(Array.isArray(profile.business_schedule) ? profile.business_schedule : []);
    setServices(Array.isArray(profile.business_services) ? profile.business_services : []);
    setProducts(Array.isArray(profile.business_products) ? profile.business_products : []);
    setMenu(Array.isArray(profile.business_menu) ? profile.business_menu : []);
    setDelivery(profile.business_delivery && typeof profile.business_delivery === "object" ? profile.business_delivery : {});
    setFaq(Array.isArray(profile.business_faq) ? profile.business_faq : []);
    setGallery(Array.isArray(profile.business_gallery) ? profile.business_gallery : []);
  }
  useEffect(() => { initFromProfile(); /* eslint-disable-next-line */ }, [profile]);

  // Count a profile view once per mount when a non-owner opens the page.
  useEffect(() => {
    if (!profile?.id || viewingOwn || profile.account_type !== "business") return;
    (async () => { try { await supabase.rpc("increment_business_view", { p_business_id: profile.id }); } catch { /* best-effort */ } })();
    // eslint-disable-next-line
  }, [profile?.id]);

  // Load reviews on mount — Reviews now lives in the always-visible right
  // sidebar (no longer gated behind a tab), so we fetch once when the profile
  // mounts rather than on tab-open.
  useEffect(() => {
    if (reviewsLoaded) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("business_reviews")
          .select("id, reviewer_id, rating, body, created_at, users:reviewer_id(id, username, full_name, avatar_url)")
          .eq("business_id", profile.id)
          .order("created_at", { ascending: false });
        const list = (data || []) as any[];
        setReviews(list);
        // Pre-fill the form if the current user already reviewed.
        const mine = currentUser ? list.find(r => r.reviewer_id === currentUser.id) : null;
        if (mine) { setMyRating(mine.rating); setMyReviewBody(mine.body || ""); }
      } catch { setReviews([]); }
      finally { setReviewsLoaded(true); }
    })();
    // eslint-disable-next-line
  }, [reviewsLoaded, profile.id]);

  async function handleSaveReview() {
    if (!currentUser || myRating < 1 || savingReview) return;
    setSavingReview(true);
    try {
      await (supabase as any).from("business_reviews").upsert({
        business_id: profile.id,
        reviewer_id: currentUser.id,
        rating: myRating,
        body: myReviewBody.trim() || null,
      }, { onConflict: "business_id,reviewer_id" });
      // Refresh
      const { data } = await supabase
        .from("business_reviews")
        .select("id, reviewer_id, rating, body, created_at, users:reviewer_id(id, username, full_name, avatar_url)")
        .eq("business_id", profile.id)
        .order("created_at", { ascending: false });
      setReviews((data || []) as any[]);
    } finally { setSavingReview(false); }
  }

  // Aggregate rating
  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount : 0;

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
        const bucket = kind === "avatar" ? "avatars" : kind === "banner" ? "banners" : "avatars";
        const subPath = kind === "highlight" ? `${currentUser.id}/highlights/${Date.now()}.jpg` : `${currentUser.id}/${Date.now()}.jpg`;
        const compressed = await compressImage(f, kind === "banner" ? 1600 : 800, 0.85);
        const url = await uploadPhoto(compressed, bucket, subPath);
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

    // Build the offer object (null if no title)
    const offerObj = offerTitle.trim()
      ? {
          title: offerTitle.trim(),
          description: offerDesc.trim() || null,
          code: offerCode.trim() || null,
          expires_at: offerExpires ? new Date(offerExpires + "T23:59:59").toISOString() : null,
        }
      : null;
    // Only bump the announcement timestamp when the text actually changed,
    // so editing other fields doesn't reset "posted X ago".
    const announcementChanged = (announcement.trim() || null) !== (profile.business_announcement || null);

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
      // Layer 1
      business_cta_label: ctaLabel || null,
      business_cta_url: ctaUrl.trim() || null,
      business_announcement: announcement.trim() || null,
      business_announcement_at: announcement.trim()
        ? (announcementChanged ? new Date().toISOString() : (profile.business_announcement_at || new Date().toISOString()))
        : null,
      business_offer: offerObj,
      // Layer 2 — drop empty rows; store null if the list is empty
      business_schedule: (() => { const v = schedule.filter(s => s && (s.name || "").trim()); return v.length ? v : null; })(),
      business_services: (() => { const v = services.filter(s => s && (s.name || "").trim()); return v.length ? v : null; })(),
      business_products: (() => { const v = products.filter(p => p && (p.name || "").trim()); return v.length ? v : null; })(),
      business_menu: (() => { const v = menu.filter(m => m && (m.name || "").trim()); return v.length ? v : null; })(),
      business_delivery: (() => { const e = Object.fromEntries(Object.entries(delivery).filter(([, u]) => u && String(u).trim())); return Object.keys(e).length ? e : null; })(),
      business_faq: (() => { const v = faq.filter(f => f && (f.q || "").trim()); return v.length ? v : null; })(),
      business_gallery: gallery.filter(Boolean).length ? gallery.filter(Boolean) : null,
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
          height: 300,
          background: (editing ? bannerUrl : profile.banner_url)
            ? `url(${editing ? bannerUrl : profile.banner_url}) center/cover`
            : "linear-gradient(135deg, #5BBE93, #86CFAE)",
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

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 20px" }}>
        {/* Identity row — avatar + name. The large circular avatar sits fully
            BELOW the banner (no overlap) with a clean gap, name centered
            alongside it. */}
        <div style={{ display: "flex", gap: 24, alignItems: "center", marginTop: 24, marginBottom: 20 }}>
          <div
            onClick={() => editing && pickAndUpload("avatar")}
            style={{
              width: 190, height: 190, borderRadius: "50%",
              background: C.card, border: `5px solid ${C.bg}`, overflow: "hidden",
              flexShrink: 0, boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              cursor: editing ? "pointer" : "default", position: "relative",
            }}
          >
            {(editing ? avatarUrl : profile.avatar_url) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={editing ? avatarUrl! : profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 84 }}>
                {businessTypeMeta.emoji}
              </div>
            )}
            {editing && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📷</div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
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
            {(() => {
              const preset = getCta(profile.business_cta_label);
              if (!preset) return null;
              const href = resolveCtaHref(preset, profile.business_cta_url, profile.business_address, profile.business_phone);
              if (!href) return null;
              return (
                <a href={href} target={preset.kind === "call" ? undefined : "_blank"} rel="noopener noreferrer"
                  style={{ ...primaryBtn, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7, flexGrow: 1, justifyContent: "center", minWidth: 150 }}>
                  {preset.emoji} {preset.text}
                </a>
              );
            })()}
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

        {/* ── Layer 1: edit-mode controls (CTA / announcement / offer) ── */}
        {viewingOwn && editing && (
          <>
            <Card title="Call-to-action button" hint="The big button visitors tap. Pick what you want them to do.">
              <select value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} style={{ ...inlineInput, marginBottom: 10 }}>
                <option value="">— No button —</option>
                {CTA_PRESETS.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.text}</option>)}
              </select>
              {(() => {
                const preset = getCta(ctaLabel);
                if (!preset) return null;
                if (preset.kind === "directions") return <div style={{ fontSize: 12, color: C.muted }}>📍 Uses your business address automatically — make sure it's set in About.</div>;
                if (preset.kind === "call") return <div style={{ fontSize: 12, color: C.muted }}>📞 Uses your business phone automatically — make sure it's set in About.</div>;
                return (
                  <>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{preset.hint}</div>
                    <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://..." style={inlineInput} />
                  </>
                );
              })()}
            </Card>

            <Card title="Announcement" hint="A pinned banner at the top of your profile. Great for 'what's new'. Leave empty to hide.">
              <textarea rows={2} maxLength={280} value={announcement} onChange={e => setAnnouncement(e.target.value)}
                placeholder="New summer hours start Monday! Open until 10pm on weekdays." style={{ ...inlineInput, resize: "vertical", minHeight: 56 }} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: "right" }}>{announcement.length}/280</div>
            </Card>

            <Card title="Offer / promotion" hint="A featured deal shown on your profile. Leave the title empty to hide.">
              <input value={offerTitle} onChange={e => setOfferTitle(e.target.value.slice(0, 60))} placeholder="Offer title — e.g. First class free" style={{ ...inlineInput, marginBottom: 8 }} />
              <input value={offerDesc} onChange={e => setOfferDesc(e.target.value.slice(0, 140))} placeholder="Short details (optional)" style={{ ...inlineInput, marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <input value={offerCode} onChange={e => setOfferCode(e.target.value.toUpperCase().slice(0, 24))} placeholder="Code (optional)" style={{ ...inlineInput, flex: 1 }} />
                <input type="date" value={offerExpires} onChange={e => setOfferExpires(e.target.value)} style={{ ...inlineInput, flex: 1 }} />
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Date = when the offer expires (optional). Past that, it hides automatically.</div>
            </Card>
          </>
        )}

        {/* ── Layer 1: view-mode announcement banner ── */}
        {!editing && profile.business_announcement && (
          <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.16), rgba(167,139,250,0.10))", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>📣</span>
            <div>
              <div style={{ fontSize: 14, color: "#E3F2EB", lineHeight: 1.5, fontWeight: 600 }}>{profile.business_announcement}</div>
              {profile.business_announcement_at && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{timeAgoShort(profile.business_announcement_at)}</div>
              )}
            </div>
          </div>
        )}

        {/* ── Layer 1: view-mode offer card ── */}
        {!editing && offerActive(profile.business_offer) && (() => {
          const off = profile.business_offer;
          return (
            <div style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.14), rgba(245,166,35,0.05))", border: "1px solid rgba(245,166,35,0.45)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: off.description ? 6 : (off.code ? 10 : 0) }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#F5A623", textTransform: "uppercase", letterSpacing: 0.6, background: "rgba(245,166,35,0.15)", padding: "3px 9px", borderRadius: 20 }}>🎁 Offer</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{off.title}</span>
              </div>
              {off.description && <div style={{ fontSize: 13, color: C.sub, marginBottom: off.code ? 10 : 0, lineHeight: 1.5 }}>{off.description}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {off.code && (
                  <button
                    onClick={() => { try { navigator.clipboard.writeText(off.code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); } catch {} }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.input, border: "1px dashed #F5A623", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#F5A623", fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>
                    {off.code} <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{copiedCode ? "✓ copied" : "tap to copy"}</span>
                  </button>
                )}
                {off.expires_at && <span style={{ fontSize: 12, color: C.muted }}>Ends {new Date(off.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
              </div>
            </div>
          );
        })()}

        {/* Tagline */}
        {editing ? (
          <Card title="Tagline" hint="One line shown beneath your name (max 120 chars).">
            <input value={bio} onChange={e => setBio(e.target.value.slice(0, 120))} placeholder="Las Vegas' home for hardcore training" style={inlineInput} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: "right" }}>{bio.length}/120</div>
          </Card>
        ) : (
          profile.bio && <p style={{ fontSize: 15, color: "#E2E8F0", lineHeight: 1.6, marginBottom: 24 }}>{profile.bio}</p>
        )}

        {/* ── Two-column body: main tabs on the left, Reviews + Events sidebar
            on the right. Collapses to a single column on mobile (sidebar
            stacks below the main content). ── */}
        <style jsx>{`
          .biz-body { display: flex; gap: 40px; align-items: flex-start; }
          .biz-main { flex: 1; min-width: 0; }
          .biz-side {
            width: 340px; flex-shrink: 0; display: flex; flex-direction: column;
            gap: 20px; padding-left: 28px; border-left: 1px solid ${C.border};
          }
          @media (max-width: 980px) {
            .biz-body { flex-direction: column; gap: 28px; }
            .biz-side { width: 100%; padding-left: 0; border-left: none; }
          }
        `}</style>
        <div className="biz-body">
          <div className="biz-main">
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", rowGap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          {([
            { key: "posts", label: "📸 Posts", show: true },
            { key: "community", label: "🤝 Community", show: true },
            { key: "gallery", label: "📷 Gallery", show: true },
            // Reviews + Events now live in the right sidebar (not tabs).
            // Insights moved to Settings (owner-only). Groups removed.
            // Leaderboard only renders for gym-type businesses since the
            // category set (bench/squat/deadlift/etc.) doesn't make sense
            // for, say, a yoga studio. Could be opened up later.
            { key: "leaderboard", label: "🏆 Leaderboard", show: profile.business_type === "gym" },
            { key: "schedule", label: "🗓️ Schedule", show: ["fitness", "wellness"].includes(getBusinessType(profile.business_type).category) },
            { key: "services", label: "💲 Services", show: ["services", "wellness"].includes(getBusinessType(profile.business_type).category) },
            { key: "menu", label: "🍽️ Menu", show: getBusinessType(profile.business_type).category === "food" || profile.business_type === "nutrition_brand" },
            { key: "shop", label: "🛍️ Shop", show: ["retail", "nutrition"].includes(getBusinessType(profile.business_type).category) },
            { key: "about", label: "ℹ️ About", show: true },
          ] as const).filter(t => t.show).map(t => (
            <button key={t.key} onClick={() => switchTab(t.key)} style={{
              padding: "11px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === t.key ? "2px solid #86CFAE" : "2px solid transparent",
              color: activeTab === t.key ? C.text : C.sub,
              fontWeight: activeTab === t.key ? 700 : 500,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: -1,
              whiteSpace: "nowrap",
              flexShrink: 0,
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

        {/* ── COMMUNITY TAB (Layer 3) — posts from people who tagged/@mentioned this business ── */}
        {activeTab === "community" && (
          <div>
            {communityLoading ? (
              <div style={{ color: C.muted, padding: 40, textAlign: "center", fontSize: 14 }}>Loading community posts…</div>
            ) : communityPosts.length === 0 ? (
              <div style={{ color: C.muted, padding: 40, textAlign: "center", fontSize: 14, lineHeight: 1.6 }}>
                🤝 No community posts yet.<br />
                When people tag or @mention {profile.business_name || profile.full_name || "this business"} in their posts, they'll show up here.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {communityPosts.map(post => {
                  const author = Array.isArray(post.users) ? post.users[0] : post.users;
                  const firstMedia = post.media_url || (Array.isArray(post.media_urls) ? post.media_urls[0] : null);
                  const firstType = post.media_type || (Array.isArray(post.media_types) ? post.media_types[0] : "image");
                  return (
                    <a key={post.id} href={`/post/${post.id}`} style={{ textDecoration: "none", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", display: "block" }}>
                      {/* Author row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", background: C.input, flexShrink: 0 }}>
                          {author?.avatar_url ? <img src={author.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{author?.full_name || author?.username || "Someone"}</div>
                          {author?.username && <div style={{ fontSize: 12, color: C.sub }}>@{author.username}</div>}
                        </div>
                        <div style={{ marginLeft: "auto", fontSize: 11, color: C.muted, flexShrink: 0 }}>{timeAgoShort(post.created_at)}</div>
                      </div>
                      {/* Caption */}
                      {post.caption && <div style={{ padding: "0 14px 12px", fontSize: 14, color: "#E2E8F0", lineHeight: 1.5 }}>{post.caption}</div>}
                      {/* First media */}
                      {firstMedia && (
                        firstType === "video"
                          ? <video src={firstMedia} style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} muted playsInline />
                          : <img src={firstMedia} alt="" style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} />
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "leaderboard" && (
          <GymLeaderboard
            gymId={profile.id}
            isOwner={viewingOwn}
          />
        )}

        {/* ── SCHEDULE TAB (fitness + wellness) ── */}
        {activeTab === "schedule" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {editing ? (
              <>
                {schedule.map((row, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select value={row.day || "mon"} onChange={e => setSchedule(s => s.map((x, j) => j === i ? { ...x, day: e.target.value } : x))} style={{ ...inlineInput, flex: 1 }}>
                        {DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                      </select>
                      <input value={row.time || ""} onChange={e => setSchedule(s => s.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} placeholder="6:00 AM" style={{ ...inlineInput, flex: 1 }} />
                    </div>
                    <input value={row.name || ""} onChange={e => setSchedule(s => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Class name — e.g. Sunrise HIIT" style={inlineInput} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={row.instructor || ""} onChange={e => setSchedule(s => s.map((x, j) => j === i ? { ...x, instructor: e.target.value } : x))} placeholder="Instructor (optional)" style={{ ...inlineInput, flex: 1 }} />
                      <button onClick={() => setSchedule(s => s.filter((_, j) => j !== i))} style={{ ...secondaryBtn, color: "#FCA5A5", padding: "8px 14px" }}>Remove</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => setSchedule(s => [...s, { day: "mon", time: "", name: "", instructor: "" }])} style={secondaryBtn}>+ Add class / session</button>
              </>
            ) : schedule.length === 0 ? (
              <div style={{ color: C.muted, padding: 40, textAlign: "center", fontSize: 14 }}>🗓️ No schedule posted yet.</div>
            ) : (
              DAYS.map(d => {
                const rows = schedule.filter(r => r.day === d.key);
                if (rows.length === 0) return null;
                return (
                  <div key={d.key} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{d.label}</div>
                    {rows.map((r, i) => (
                      <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#86CFAE", minWidth: 72 }}>{r.time || "—"}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.name}</div>
                          {r.instructor && <div style={{ fontSize: 12, color: C.sub }}>with {r.instructor}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── SERVICES TAB (services + wellness) ── */}
        {activeTab === "services" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {editing ? (
              <>
                {services.map((row, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={row.name || ""} onChange={e => setServices(s => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Service — e.g. 1:1 Coaching" style={{ ...inlineInput, flex: 2 }} />
                      <input value={row.price || ""} onChange={e => setServices(s => s.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} placeholder="$120/mo" style={{ ...inlineInput, flex: 1 }} />
                    </div>
                    <input value={row.description || ""} onChange={e => setServices(s => s.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Short description (optional)" style={inlineInput} />
                    <button onClick={() => setServices(s => s.filter((_, j) => j !== i))} style={{ ...secondaryBtn, color: "#FCA5A5", padding: "8px 14px", alignSelf: "flex-start" }}>Remove</button>
                  </div>
                ))}
                <button onClick={() => setServices(s => [...s, { name: "", price: "", description: "" }])} style={secondaryBtn}>+ Add service</button>
              </>
            ) : services.length === 0 ? (
              <div style={{ color: C.muted, padding: 40, textAlign: "center", fontSize: 14 }}>💲 No services listed yet.</div>
            ) : (
              services.map((s, i) => (
                <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 13, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{s.description}</div>}
                  </div>
                  {s.price && <div style={{ fontSize: 15, fontWeight: 800, color: "#86CFAE", whiteSpace: "nowrap" }}>{s.price}</div>}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── SHOP TAB (retail + nutrition) ── */}
        {activeTab === "shop" && (
          <div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {products.map((row, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button onClick={async () => {
                        const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
                        input.onchange = () => { const f = input.files?.[0]; if (!f) return; const r = new FileReader();
                          r.onload = async ev => { const du = ev.target?.result as string; if (!du) return;
                            try { const c = await compressImage(du); const url = await uploadPhoto(c, "posts", `${currentUser?.id}/product-${Date.now()}.jpg`); if (url) setProducts(p => p.map((x, j) => j === i ? { ...x, image_url: url } : x)); } catch {} };
                          r.readAsDataURL(f); };
                        input.click();
                      }} style={{ width: 56, height: 56, borderRadius: 10, border: `1px dashed ${C.border}`, background: C.input, cursor: "pointer", overflow: "hidden", flexShrink: 0, padding: 0 }}>
                        {row.image_url ? <img src={row.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 18 }}>📷</span>}
                      </button>
                      <input value={row.name || ""} onChange={e => setProducts(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Product name" style={{ ...inlineInput, flex: 2 }} />
                      <input value={row.price || ""} onChange={e => setProducts(p => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} placeholder="$39" style={{ ...inlineInput, flex: 1 }} />
                    </div>
                    <input value={row.url || ""} onChange={e => setProducts(p => p.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="Buy link (https://...)" style={inlineInput} />
                    <button onClick={() => setProducts(p => p.filter((_, j) => j !== i))} style={{ ...secondaryBtn, color: "#FCA5A5", padding: "8px 14px", alignSelf: "flex-start" }}>Remove</button>
                  </div>
                ))}
                <button onClick={() => setProducts(p => [...p, { name: "", price: "", url: "", image_url: "" }])} style={secondaryBtn}>+ Add product</button>
              </div>
            ) : products.length === 0 ? (
              <div style={{ color: C.muted, padding: 40, textAlign: "center", fontSize: 14 }}>🛍️ No products listed yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {products.map((p, i) => {
                  const href = p.url ? (/^https?:\/\//.test(p.url) ? p.url : `https://${p.url}`) : null;
                  const Inner = (
                    <>
                      <div style={{ width: "100%", aspectRatio: "1", background: C.input, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {p.image_url ? <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <span style={{ fontSize: 30 }}>🛍️</span>}
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                          {p.price && <span style={{ fontSize: 14, fontWeight: 800, color: "#86CFAE" }}>{p.price}</span>}
                          {href && <span style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>Shop →</span>}
                        </div>
                      </div>
                    </>
                  );
                  return href ? (
                    <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", textDecoration: "none", display: "block" }}>{Inner}</a>
                  ) : (
                    <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>{Inner}</div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MENU TAB (food businesses) — items with nutrition facts + delivery ── */}
        {activeTab === "menu" && (() => {
          const DELIVERY_PLATFORMS = [
            { key: "doordash", label: "DoorDash", emoji: "🚪" },
            { key: "ubereats", label: "Uber Eats", emoji: "🛵" },
            { key: "grubhub", label: "Grubhub", emoji: "🍴" },
            { key: "postmates", label: "Postmates", emoji: "📦" },
            { key: "order", label: "Order Online", emoji: "🔗" },
          ];
          const normUrl = (u: string) => /^https?:\/\//.test(u) ? u : `https://${u}`;
          if (editing) {
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Card title="Delivery & ordering links" hint="Add any that apply — they show as order buttons on your menu.">
                  {DELIVERY_PLATFORMS.map(p => (
                    <div key={p.key} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 4 }}>{p.emoji} {p.label}</div>
                      <input value={delivery[p.key] || ""} onChange={e => setDelivery(d => ({ ...d, [p.key]: e.target.value }))} placeholder="https://..." style={inlineInput} />
                    </div>
                  ))}
                </Card>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {menu.map((row, i) => (
                    <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={row.name || ""} onChange={e => setMenu(m => m.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Item name" style={{ ...inlineInput, flex: 2 }} />
                        <input value={row.price || ""} onChange={e => setMenu(m => m.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} placeholder="$12" style={{ ...inlineInput, flex: 1 }} />
                      </div>
                      <input value={row.section || ""} onChange={e => setMenu(m => m.map((x, j) => j === i ? { ...x, section: e.target.value } : x))} placeholder="Section (e.g. Bowls, Drinks) — optional" style={inlineInput} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <input value={row.calories ?? ""} onChange={e => setMenu(m => m.map((x, j) => j === i ? { ...x, calories: e.target.value } : x))} inputMode="numeric" placeholder="Cal" style={{ ...inlineInput, flex: 1 }} />
                        <input value={row.protein ?? ""} onChange={e => setMenu(m => m.map((x, j) => j === i ? { ...x, protein: e.target.value } : x))} inputMode="numeric" placeholder="P (g)" style={{ ...inlineInput, flex: 1 }} />
                        <input value={row.carbs ?? ""} onChange={e => setMenu(m => m.map((x, j) => j === i ? { ...x, carbs: e.target.value } : x))} inputMode="numeric" placeholder="C (g)" style={{ ...inlineInput, flex: 1 }} />
                        <input value={row.fat ?? ""} onChange={e => setMenu(m => m.map((x, j) => j === i ? { ...x, fat: e.target.value } : x))} inputMode="numeric" placeholder="F (g)" style={{ ...inlineInput, flex: 1 }} />
                      </div>
                      <input value={row.description || ""} onChange={e => setMenu(m => m.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Description (optional)" style={inlineInput} />
                      <button onClick={() => setMenu(m => m.filter((_, j) => j !== i))} style={{ ...secondaryBtn, color: "#FCA5A5", padding: "8px 14px", alignSelf: "flex-start" }}>Remove</button>
                    </div>
                  ))}
                  <button onClick={() => setMenu(m => [...m, { name: "", section: "", calories: "", protein: "", carbs: "", fat: "", price: "", description: "" }])} style={secondaryBtn}>+ Add menu item</button>
                </div>
              </div>
            );
          }
          // View mode
          const activeDelivery = DELIVERY_PLATFORMS.filter(p => (profile.business_delivery || {})[p.key]);
          const items = Array.isArray(profile.business_menu) ? profile.business_menu : [];
          // Group by section (blank section → "Menu")
          const sections: Record<string, any[]> = {};
          for (const it of items) { const s = (it.section || "Menu").trim() || "Menu"; (sections[s] = sections[s] || []).push(it); }
          return (
            <div>
              {activeDelivery.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>🛵 Order delivery</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {activeDelivery.map(p => (
                      <a key={p.key} href={normUrl((profile.business_delivery || {})[p.key])} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", color: C.text, fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
                        {p.emoji} {p.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {items.length === 0 ? (
                <div style={{ color: C.muted, padding: 40, textAlign: "center", fontSize: 14 }}>🍽️ No menu posted yet.</div>
              ) : (
                Object.entries(sections).map(([section, rows]) => (
                  <div key={section} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10 }}>{section}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {rows.map((it, i) => (
                        <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{it.name}</div>
                            {it.price && <div style={{ fontSize: 15, fontWeight: 800, color: "#4ADE80", whiteSpace: "nowrap" }}>{it.price}</div>}
                          </div>
                          {it.description && <div style={{ fontSize: 13, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{it.description}</div>}
                          {(it.calories || it.protein || it.carbs || it.fat) && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                              {it.calories ? <span style={{ fontSize: 11, fontWeight: 700, color: "#F5A623", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 99, padding: "3px 10px" }}>{it.calories} cal</span> : null}
                              {it.protein ? <span style={{ fontSize: 11, fontWeight: 700, color: "#86CFAE", background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 99, padding: "3px 10px" }}>{it.protein}g protein</span> : null}
                              {it.carbs ? <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, background: C.input, border: `1px solid ${C.border}`, borderRadius: 99, padding: "3px 10px" }}>{it.carbs}g carbs</span> : null}
                              {it.fat ? <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, background: C.input, border: `1px solid ${C.border}`, borderRadius: 99, padding: "3px 10px" }}>{it.fat}g fat</span> : null}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })()}

        {/* ── GALLERY TAB — photos of the space ── */}
        {activeTab === "gallery" && (
          <div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {gallery.map((url, i) => (
                    <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 12, overflow: "hidden", background: C.input }}>
                      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button onClick={() => setGallery(g => g.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.7)", color: "#FCA5A5", fontSize: 13, cursor: "pointer", padding: 0 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={async () => {
                    const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
                    input.onchange = () => { const f = input.files?.[0]; if (!f) return; const r = new FileReader();
                      r.onload = async ev => { const du = ev.target?.result as string; if (!du) return;
                        try { const c = await compressImage(du); const url = await uploadPhoto(c, "posts", `${currentUser?.id}/gallery-${Date.now()}.jpg`); if (url) setGallery(g => [...g, url]); } catch {} };
                      r.readAsDataURL(f); };
                    input.click();
                  }} style={{ aspectRatio: "1", borderRadius: 12, border: `1.5px dashed ${C.border}`, background: C.input, color: C.sub, fontSize: 26, cursor: "pointer" }}>＋</button>
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>Show off your space, your food, the vibe. Tap ＋ to add photos.</div>
              </div>
            ) : (Array.isArray(profile.business_gallery) && profile.business_gallery.length > 0) ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {profile.business_gallery.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ aspectRatio: "1", borderRadius: 12, overflow: "hidden", background: C.input, display: "block" }}>
                    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ color: C.muted, padding: 40, textAlign: "center", fontSize: 14 }}>📷 No photos yet.</div>
            )}
          </div>
        )}

        {/* ── REVIEWS TAB ── */}
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

            <Card title="FAQ" hint={editing ? "Answer common questions (parking, first visit, policies…)." : undefined}>
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {faq.map((row, i) => (
                    <div key={i} style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                      <input value={row.q || ""} onChange={e => setFaq(f => f.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} placeholder="Question" style={inlineInput} />
                      <textarea rows={2} value={row.a || ""} onChange={e => setFaq(f => f.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} placeholder="Answer" style={{ ...inlineInput, resize: "vertical" }} />
                      <button onClick={() => setFaq(f => f.filter((_, j) => j !== i))} style={{ ...secondaryBtn, color: "#FCA5A5", padding: "7px 12px", alignSelf: "flex-start" }}>Remove</button>
                    </div>
                  ))}
                  <button onClick={() => setFaq(f => [...f, { q: "", a: "" }])} style={secondaryBtn}>+ Add question</button>
                </div>
              ) : (
                (Array.isArray(profile.business_faq) && profile.business_faq.length > 0)
                  ? <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {profile.business_faq.map((row: any, i: number) => (
                        <div key={i}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 3 }}>{row.q}</div>
                          <div style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{row.a}</div>
                        </div>
                      ))}
                    </div>
                  : <Empty>No FAQs yet.</Empty>
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
          </div>{/* /.biz-main */}

          {/* ── RIGHT SIDEBAR: Reviews + Events (always visible) ── */}
          <aside className="biz-side">
            {/* Reviews */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.6 }}>⭐ Reviews</div>
              {/* Aggregate */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, textAlign: "center" }}>
                {reviewCount > 0 ? (
                  <>
                    <div style={{ fontSize: 34, fontWeight: 900, color: "#F5A623" }}>{avgRating.toFixed(1)}</div>
                    <div style={{ fontSize: 16, marginTop: 2 }}>{"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}</div>
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{reviewCount} review{reviewCount !== 1 ? "s" : ""}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 14, color: C.muted }}>No reviews yet — be the first.</div>
                )}
              </div>

              {/* Write a review (non-owners, logged in) */}
              {currentUser && !viewingOwn && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>Leave a review</div>
                  <div style={{ fontSize: 28, marginBottom: 10, letterSpacing: 4 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <span key={n} onClick={() => setMyRating(n)} style={{ cursor: "pointer", color: n <= myRating ? "#F5A623" : "#3A3F52" }}>★</span>
                    ))}
                  </div>
                  <textarea rows={3} value={myReviewBody} onChange={e => setMyReviewBody(e.target.value.slice(0, 400))} placeholder="Share your experience (optional)" style={{ ...inlineInput, resize: "vertical" }} />
                  <button onClick={handleSaveReview} disabled={myRating < 1 || savingReview}
                    style={{ ...primaryBtn, marginTop: 10, opacity: myRating < 1 ? 0.5 : 1 }}>
                    {savingReview ? "Saving…" : "Post review"}
                  </button>
                </div>
              )}

              {/* List */}
              {!reviewsLoaded ? (
                <div style={{ color: C.muted, textAlign: "center", padding: 20, fontSize: 14 }}>Loading…</div>
              ) : reviews.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {reviews.map(r => {
                    const u = Array.isArray(r.users) ? r.users[0] : r.users;
                    return (
                      <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: r.body ? 6 : 0 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", background: C.input, flexShrink: 0 }}>
                            {u?.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{u?.full_name || u?.username || "Member"}</div>
                          <div style={{ marginLeft: "auto", fontSize: 13, color: "#F5A623" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                        </div>
                        {r.body && <div style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.5 }}>{r.body}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Events */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.6 }}>📅 Events</div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, color: C.muted, textAlign: "center", fontSize: 14 }}>
                📅 Events system coming soon.
              </div>
            </div>
          </aside>
        </div>{/* /.biz-body */}
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

function InsightCard({ label, value, emoji }: { label: string; value: string | number; emoji: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 14px" }}>
      <div style={{ fontSize: 20 }}>{emoji}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: C.text, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
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
          {link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "#86CFAE", textDecoration: "none" }}>{display}</a> : display}
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
                <input type="checkbox" checked={!!isOpen} onChange={() => onToggle(d.key)} style={{ accentColor: "#5BBE93" }} />Open
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

function timeAgoShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  bg: "#0E1311",
  card: "#161A26",
  input: "#1F2333",
  border: "#2A2F42",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  muted: "#6B7280",
};

const pillStyle: React.CSSProperties = {
  background: "#2A1F4A", border: "1px solid #5BBE93", color: "#D6EFE2",
  fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
};

const inlineInput: React.CSSProperties = {
  width: "100%", padding: "9px 12px", background: C.input, border: `1px solid ${C.border}`,
  borderRadius: 10, color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  padding: "11px 20px", borderRadius: 12, border: "none",
  background: "linear-gradient(135deg, #5BBE93, #86CFAE)",
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

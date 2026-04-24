"use client";
// ── app/(app)/onboarding/business/page.tsx ──────────────────────────────────
// Dedicated onboarding for business accounts. The athlete onboarding asks
// about fitness goals / macros / training frequency — all irrelevant for a
// gym, studio, or brand. This wizard collects what businesses actually need:
//   Step 1 — Confirm basics (name, type, short bio)
//   Step 2 — Contact & location (address, phone, email)
//   Step 3 — Online presence (website, social links)
//   Step 4 — Operating hours
//   Step 5 — Branding (logo/avatar + cover banner) + finish
//
// On finish, business lands on their public profile (not the athlete feed)
// since that's their "home base" in this app.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { BUSINESS_TYPES, isBusinessAccount } from "@/lib/businessTypes";

const C = {
  purple: "#7C3AED",
  purpleDark: "#6D28D9",
  gold: "#F5A623",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  bg: "#0D0D0D",
  card: "#1A1D2E",
  border: "#2A2D3E",
  input: "#252A3D",
};

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

type Step = 1 | 2 | 3 | 4 | 5;
const TOTAL_STEPS = 5;

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i < step ? C.purple : "#2A2A2A",
          transition: "background 0.3s ease",
        }} />
      ))}
    </div>
  );
}

export default function BusinessOnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();

  // Bounce personal accounts back to the athlete flow
  useEffect(() => {
    if (!user) return;
    if (!isBusinessAccount(user.profile)) {
      router.replace("/onboarding");
    }
  }, [user, router]);

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── STEP 1 — Basics ────────────────────────────────────────────────────
  // Pre-fill from signup data so user doesn't re-type business name
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("gym");
  const [shortBio, setShortBio] = useState("");
  const [longDescription, setLongDescription] = useState("");

  // ── STEP 2 — Contact & Location ────────────────────────────────────────
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // ── STEP 3 — Online presence ───────────────────────────────────────────
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [twitter, setTwitter] = useState("");
  const [youtube, setYoutube] = useState("");

  // ── STEP 4 — Hours ─────────────────────────────────────────────────────
  const [hours, setHours] = useState<Record<string, any>>({
    mon: { open: "06:00", close: "22:00" },
    tue: { open: "06:00", close: "22:00" },
    wed: { open: "06:00", close: "22:00" },
    thu: { open: "06:00", close: "22:00" },
    fri: { open: "06:00", close: "22:00" },
    sat: { open: "08:00", close: "20:00" },
    sun: "closed",
  });

  // ── STEP 5 — Branding ──────────────────────────────────────────────────
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // ── Pre-fill from existing profile ─────────────────────────────────────
  useEffect(() => {
    if (!user?.profile) return;
    const p = user.profile as any;
    setBusinessName(p.business_name || p.full_name || "");
    setBusinessType(p.business_type || "gym");
    setShortBio(p.bio || "");
    setLongDescription(p.business_description_long || "");
    setAddress(p.business_address || "");
    setPhone(p.business_phone || "");
    setContactEmail(p.business_email || "");
    setWebsite(p.business_website || "");
    setInstagram(p.business_instagram || "");
    setTiktok(p.business_tiktok || "");
    setTwitter(p.business_twitter || "");
    setYoutube(p.business_youtube || "");
    if (p.business_hours) setHours(p.business_hours);
    if (p.avatar_url) setAvatarPreview(p.avatar_url);
    if (p.banner_url) setBannerPreview(p.banner_url);
  }, [user]);

  // ── Per-step validation ────────────────────────────────────────────────
  // Step 2+ are all optional so users can skip through and fill in later
  // via settings/business. Only Step 1 requires a business name.
  const canProceed: Record<Step, boolean> = {
    1: businessName.trim().length >= 2,
    2: true,
    3: true,
    4: true,
    5: true,
  };

  // ── Hours helpers ──────────────────────────────────────────────────────
  function toggleDay(day: string) {
    setHours(h => {
      const next = { ...h };
      if (!next[day] || next[day] === "closed") {
        next[day] = { open: "06:00", close: "22:00" };
      } else {
        next[day] = "closed";
      }
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

  // ── Image handlers ─────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, which: "avatar" | "banner") {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const data = reader.result as string;
      if (which === "avatar") { setAvatarFile(f); setAvatarPreview(data); }
      else { setBannerFile(f); setBannerPreview(data); }
    };
    reader.readAsDataURL(f);
  }

  // ── Finish ─────────────────────────────────────────────────────────────
  async function finishOnboarding() {
    if (!user || saving) return;
    setSaving(true);
    setError("");

    try {
      // Upload images first if provided
      let avatarUrl: string | null = null;
      let bannerUrl: string | null = null;
      if (avatarFile) {
        try { avatarUrl = await uploadPhoto(avatarFile, user.id, "avatars"); } catch {}
      }
      if (bannerFile) {
        try { bannerUrl = await uploadPhoto(bannerFile, user.id, "banners"); } catch {}
      }

      // Clean hours — drop empty days so the DB only has meaningful entries
      const cleanedHours: Record<string, any> = {};
      for (const d of DAYS) {
        const v = hours[d.key];
        if (v === "closed") cleanedHours[d.key] = "closed";
        else if (v && typeof v === "object" && v.open && v.close) cleanedHours[d.key] = v;
      }

      const updates: any = {
        full_name: businessName,       // keep full_name in sync for places that fall back to it
        business_name: businessName,
        business_type: businessType,
        bio: shortBio || null,
        business_description_long: longDescription || null,
        business_address: address || null,
        business_phone: phone || null,
        business_email: contactEmail || null,
        business_website: website || null,
        business_instagram: instagram || null,
        business_tiktok: tiktok || null,
        business_twitter: twitter || null,
        business_youtube: youtube || null,
        business_hours: Object.keys(cleanedHours).length > 0 ? cleanedHours : null,
      };
      if (avatarUrl) updates.avatar_url = avatarUrl;
      if (bannerUrl) updates.banner_url = bannerUrl;

      const { error: dbErr } = await supabase.from("users").update(updates).eq("id", user.id);
      if (dbErr) throw dbErr;

      await refreshProfile?.();
      // Send them to their public profile — their new "home"
      router.push(`/profile/${(user.profile as any)?.username || ""}`);
    } catch (e: any) {
      setError(e.message || "Couldn't save. Try again.");
      setSaving(false);
    }
  }

  if (!user) return <div style={{ minHeight: "100vh", background: C.bg }} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "24px 20px 80px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏢</div>
          <div style={{ color: C.sub, fontSize: 13, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>
            Step {step} of {TOTAL_STEPS}
          </div>
        </div>

        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* ── STEP 1 — Basics ────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Tell us about your business</h1>
            <p style={{ color: C.sub, fontSize: 15, marginBottom: 28 }}>This is what people will see first on your profile.</p>

            <Field label="Business name *">
              <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Iron Gym Las Vegas" style={input} />
            </Field>
            <Field label="Business type">
              <select value={businessType} onChange={e => setBusinessType(e.target.value)} style={input}>
                {BUSINESS_TYPES.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
              </select>
            </Field>
            <Field label="Short tagline" hint="One line that shows below your name (max 120 chars)">
              <input type="text" maxLength={120} value={shortBio} onChange={e => setShortBio(e.target.value)} placeholder="Las Vegas' home for hardcore training" style={input} />
            </Field>
            <Field label="About your business" hint="Longer description shown on the About tab (max 500 chars)">
              <textarea rows={4} maxLength={500} value={longDescription} onChange={e => setLongDescription(e.target.value)} placeholder="We're a locally-owned gym focused on..." style={{ ...input, resize: "vertical" }} />
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4, textAlign: "right" }}>{longDescription.length}/500</div>
            </Field>
          </div>
        )}

        {/* ── STEP 2 — Contact & Location ───────────────────────── */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>How can people reach you?</h1>
            <p style={{ color: C.sub, fontSize: 15, marginBottom: 28 }}>Optional — but helps customers find and contact your business.</p>

            <Field label="Address" hint="Shown publicly + linked to Google Maps">
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, Las Vegas, NV 89101" style={input} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(702) 555-1234" style={input} />
            </Field>
            <Field label="Contact email" hint="Use a business email, not your personal account email">
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="hello@yourbusiness.com" style={input} />
            </Field>
          </div>
        )}

        {/* ── STEP 3 — Online Presence ──────────────────────────── */}
        {step === 3 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Your online presence</h1>
            <p style={{ color: C.sub, fontSize: 15, marginBottom: 28 }}>Link your website and social accounts so followers can find you everywhere.</p>

            <Field label="🌐 Website">
              <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourbusiness.com" style={input} />
            </Field>
            <Field label="📷 Instagram">
              <input type="url" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="https://instagram.com/yourhandle" style={input} />
            </Field>
            <Field label="🎵 TikTok">
              <input type="url" value={tiktok} onChange={e => setTiktok(e.target.value)} placeholder="https://tiktok.com/@yourhandle" style={input} />
            </Field>
            <Field label="𝕏 Twitter / X">
              <input type="url" value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="https://x.com/yourhandle" style={input} />
            </Field>
            <Field label="▶️ YouTube">
              <input type="url" value={youtube} onChange={e => setYoutube(e.target.value)} placeholder="https://youtube.com/@yourhandle" style={input} />
            </Field>
          </div>
        )}

        {/* ── STEP 4 — Hours ────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>When are you open?</h1>
            <p style={{ color: C.sub, fontSize: 15, marginBottom: 28 }}>Toggle off any day you're closed. Don't have set hours? Just skip this step.</p>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
              {DAYS.map(d => {
                const v = hours[d.key];
                const isOpen = v && v !== "closed" && typeof v === "object";
                return (
                  <div key={d.key} style={{ display: "grid", gridTemplateColumns: "70px 80px 1fr 1fr", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{d.label}</div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.sub, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!isOpen} onChange={() => toggleDay(d.key)} style={{ accentColor: C.purple }} />
                      Open
                    </label>
                    {isOpen ? (
                      <>
                        <input type="time" value={v.open} onChange={e => updateDayHour(d.key, "open", e.target.value)} style={input} />
                        <input type="time" value={v.close} onChange={e => updateDayHour(d.key, "close", e.target.value)} style={input} />
                      </>
                    ) : (
                      <div style={{ gridColumn: "3 / span 2", fontSize: 12, color: "#6B7280" }}>Closed</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 5 — Branding (logo + banner) ─────────────────── */}
        {step === 5 && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Add your branding</h1>
            <p style={{ color: C.sub, fontSize: 15, marginBottom: 28 }}>Upload your logo and a cover banner. You can change these anytime.</p>

            {/* Cover banner preview */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>Cover banner</div>
              <label style={{ cursor: "pointer", display: "block" }}>
                <div style={{
                  width: "100%", aspectRatio: "3/1",
                  background: bannerPreview ? `url(${bannerPreview}) center/cover` : "linear-gradient(135deg, #7C3AED, #A78BFA)",
                  border: `2px dashed ${C.border}`, borderRadius: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 600,
                }}>
                  {!bannerPreview && "📷 Click to upload cover banner"}
                </div>
                <input type="file" accept="image/*" onChange={e => handleFileSelect(e, "banner")} style={{ display: "none" }} />
              </label>
            </div>

            {/* Logo / avatar preview */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>Logo / Profile photo</div>
              <label style={{ cursor: "pointer", display: "inline-block" }}>
                <div style={{
                  width: 120, height: 120, borderRadius: 18,
                  background: avatarPreview ? `url(${avatarPreview}) center/cover` : "#1A1A1A",
                  border: `2px dashed ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: C.sub, fontSize: 28,
                }}>
                  {!avatarPreview && "🖼️"}
                </div>
                <input type="file" accept="image/*" onChange={e => handleFileSelect(e, "avatar")} style={{ display: "none" }} />
              </label>
            </div>

            <div style={{ marginTop: 28, padding: 14, background: "rgba(124,58,237,0.1)", border: "1px solid #4B2A8E", borderRadius: 12, fontSize: 13, color: "#DDD" }}>
              💡 After this, you can start posting announcements, create events, and build groups from your profile page.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#2A0F0F", border: "1px solid #DC2626", borderRadius: 10, fontSize: 13, color: "#FCA5A5" }}>
            {error}
          </div>
        )}

        {/* ── Nav buttons ───────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
          {step > 1 && (
            <button
              onClick={() => setStep(s => (s - 1) as Step)}
              style={{ flex: 1, padding: "14px", borderRadius: 14, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontWeight: 700, fontSize: 15, cursor: "pointer" }}
            >
              ← Back
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep(s => (s + 1) as Step)}
              disabled={!canProceed[step]}
              style={{
                flex: 2, padding: "14px", borderRadius: 14, border: "none",
                background: canProceed[step] ? `linear-gradient(135deg, ${C.purple}, #A78BFA)` : "#2A2A2A",
                color: canProceed[step] ? "#fff" : "#6B7280",
                fontWeight: 900, fontSize: 16,
                cursor: canProceed[step] ? "pointer" : "not-allowed",
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={finishOnboarding}
              disabled={saving}
              style={{
                flex: 2, padding: "14px", borderRadius: 14, border: "none",
                background: saving ? "#4B1D8A" : `linear-gradient(135deg, ${C.purple}, #A78BFA)`,
                color: "#fff", fontWeight: 900, fontSize: 16,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Setting up..." : "🚀 Launch my page"}
            </button>
          )}
        </div>

        {/* Skip link — step 2+ only, since step 1 has required fields */}
        {step > 1 && step < TOTAL_STEPS && (
          <button
            onClick={() => setStep((step + 1) as Step)}
            style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

// ── Styled helpers ──────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  background: "#252A3D",
  border: "1px solid #2A2D3E",
  borderRadius: 12,
  color: "#E2E8F0",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { compressImage } from "@/lib/compressImage";
import { BUSINESS_TYPES, getBusinessType, isBusinessAccount } from "@/lib/businessTypes";

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────
// A dedicated setup wizard for BUSINESS accounts. This is intentionally NOTHING
// like the personal onboarding (no fitness goals, activity level, macros, focus
// areas, etc.). It collects the business's own details and writes them to the
// business_* columns on the users row, then lands them on their profile.
//
// Every step after the first is SKIPPABLE — a business can fill in just their
// name + type to get started and complete the rest later from their profile
// tabs (Gallery, Leaderboard, Schedule, Events, etc.). The "Skip for now"
// control advances without requiring input.
//
// Steps:
//   1. Basics      — business name + type (the only semi-required step)
//   2. Identity    — profile photo + banner
//   3. About       — short bio + long description + location/address
//   4. Contact     — website, email, phone
//   5. Socials     — Instagram / TikTok / Twitter / YouTube
//   6. Done        — summary + pointers to the profile tabs for the rest
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  purple: "#5BBE93",
  purpleDark: "#3E9E74",
  purpleLight: "#EFF7F2",
  purpleMid: "#C9E8D8",
  gold: "#F5A623",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  bg: "#0E1311",
  card: "#111111",
  border: "#161D19",
};

type Step = 1 | 2 | 3 | 4 | 5 | 6;
const TOTAL_STEPS = 6;

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i < step ? C.purple : "#232C27",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

export default function BusinessOnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();

  // Guard: if a personal account somehow lands here, send them to the normal
  // onboarding. We wait for profile to load before deciding so we don't
  // bounce a business account that just hasn't hydrated yet.
  useEffect(() => {
    if (!user || !user.profile) return;
    if (!isBusinessAccount(user.profile)) {
      router.replace("/onboarding");
    }
  }, [user, router]);

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // ── Step 1: Basics ──
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");

  // ── Step 2: Identity ──
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // ── Step 3: About + Location ──
  const [bio, setBio] = useState("");               // short tagline
  const [descLong, setDescLong] = useState("");      // full "about" paragraph
  const [address, setAddress] = useState("");

  // ── Step 4: Contact ──
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ── Step 5: Socials ──
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [twitter, setTwitter] = useState("");
  const [youtube, setYoutube] = useState("");

  // Prefill from any existing profile data (e.g. set at signup) so re-running
  // onboarding doesn't wipe what's there.
  useEffect(() => {
    const p: any = user?.profile;
    if (!p) return;
    setBusinessName(prev => prev || p.business_name || p.full_name || "");
    setBusinessType(prev => prev || p.business_type || "");
    setBio(prev => prev || p.bio || "");
    setDescLong(prev => prev || p.business_description_long || "");
    setAddress(prev => prev || p.business_address || "");
    setWebsite(prev => prev || p.business_website || "");
    setEmail(prev => prev || p.business_email || "");
    setPhone(prev => prev || p.business_phone || "");
    setInstagram(prev => prev || p.business_instagram || "");
    setTiktok(prev => prev || p.business_tiktok || "");
    setTwitter(prev => prev || p.business_twitter || "");
    setYoutube(prev => prev || p.business_youtube || "");
    if (p.avatar_url) setAvatarPreview(prev => prev || p.avatar_url);
    if (p.banner_url) setBannerPreview(prev => prev || p.banner_url);
  }, [user?.profile]);

  function loadImage(e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => setter(ev.target!.result as string);
    r.readAsDataURL(f);
    e.target.value = "";
  }

  // Strip a leading @ and any URL noise from a social handle so we store a
  // clean handle. Leaves full URLs alone if the user pasted one.
  function cleanHandle(v: string): string {
    return v.trim().replace(/^@+/, "");
  }

  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    try {
      // Upload images only if the preview is a freshly-picked data URL (not an
      // already-hosted https URL we prefilled).
      let avatarUrl: string | null = null;
      if (avatarPreview && avatarPreview.startsWith("data:")) {
        const c = await compressImage(avatarPreview, 800, 0.85);
        avatarUrl = await uploadPhoto(c, "avatars", `${user.id}/avatar.jpg`);
      }
      let bannerUrl: string | null = null;
      if (bannerPreview && bannerPreview.startsWith("data:")) {
        const c = await compressImage(bannerPreview, 1600, 0.85);
        bannerUrl = await uploadPhoto(c, "banners", `${user.id}/banner.jpg`);
      }

      const update: Record<string, any> = {
        onboarded: true,
        account_type: "business",
      };
      if (businessName.trim()) {
        update.business_name = businessName.trim();
        update.full_name = businessName.trim(); // keep display name in sync
      }
      if (businessType) update.business_type = businessType;
      if (bio.trim()) update.bio = bio.trim();
      if (descLong.trim()) update.business_description_long = descLong.trim();
      if (address.trim()) update.business_address = address.trim();
      if (website.trim()) update.business_website = website.trim();
      if (email.trim()) update.business_email = email.trim();
      if (phone.trim()) update.business_phone = phone.trim();
      if (instagram.trim()) update.business_instagram = cleanHandle(instagram);
      if (tiktok.trim()) update.business_tiktok = cleanHandle(tiktok);
      if (twitter.trim()) update.business_twitter = cleanHandle(twitter);
      if (youtube.trim()) update.business_youtube = cleanHandle(youtube);
      if (avatarUrl) update.avatar_url = avatarUrl;
      if (bannerUrl) update.banner_url = bannerUrl;

      await supabase.from("users").update(update as any).eq("id", user.id);
      // Refresh the cached profile so the business layout renders immediately
      // on the profile page (no stale personal data).
      try { await refreshProfile(); } catch {}
    } catch {}
    setSaving(false);
    router.push("/profile");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "13px 16px", borderRadius: 14,
    border: "1.5px solid #232C27", background: C.card, fontSize: 15,
    color: C.text, outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 800, color: C.sub, textTransform: "uppercase",
    letterSpacing: 0.6, display: "block", marginBottom: 6,
  };

  // Step 1 needs at least a name to proceed; everything else is skippable.
  const canProceed: Record<Step, boolean> = {
    1: !!businessName.trim() && !!businessType,
    2: true, 3: true, 4: true, 5: true, 6: true,
  };
  const isSkippable = step >= 2 && step <= 5;

  function next() {
    if (step < TOTAL_STEPS) setStep((step + 1) as Step);
    else handleFinish();
  }
  function back() {
    if (step > 1) setStep((step - 1) as Step);
  }

  const typeInfo = getBusinessType(businessType);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 520, padding: "32px 20px 48px" }}>
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: C.sub, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
          Step {step} of {TOTAL_STEPS}
        </div>
        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* ─── STEP 1: Basics ─── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>Set up your business</h2>
            <p style={{ color: C.sub, margin: "0 0 24px" }}>Start with the essentials — you can add everything else as you go.</p>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Business name</label>
              <input style={inputStyle} placeholder="e.g. Gym of Las Vegas" value={businessName} onChange={e => setBusinessName(e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Business type</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {BUSINESS_TYPES.filter(t => t.key !== "other").map(t => {
                  const sel = businessType === t.key;
                  return (
                    <button key={t.key} type="button" onClick={() => setBusinessType(t.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "12px 12px",
                        borderRadius: 12, cursor: "pointer", textAlign: "left",
                        border: `1.5px solid ${sel ? C.purple : "#232C27"}`,
                        background: sel ? "rgba(124,58,237,0.12)" : C.card,
                        color: C.text, fontSize: 13, fontWeight: 700,
                      }}>
                      <span style={{ fontSize: 18 }}>{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Identity (photos) ─── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>Add your look</h2>
            <p style={{ color: C.sub, margin: "0 0 24px" }}>A profile photo (logo) and a banner. You can change these anytime.</p>

            {/* Banner */}
            <label style={labelStyle}>Banner image</label>
            <label style={{ display: "block", cursor: "pointer", marginBottom: 20 }}>
              <input type="file" accept="image/*" onChange={e => loadImage(e, setBannerPreview)} style={{ display: "none" }} />
              <div style={{
                width: "100%", height: 120, borderRadius: 16, overflow: "hidden",
                border: `1.5px dashed ${bannerPreview ? C.purple : "#232C27"}`,
                background: bannerPreview ? "transparent" : C.card,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {bannerPreview
                  ? <img src={bannerPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  : <span style={{ color: C.sub, fontSize: 13, fontWeight: 700 }}>＋ Upload banner</span>}
              </div>
            </label>

            {/* Logo / avatar */}
            <label style={labelStyle}>Profile photo / logo</label>
            <label style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
              <input type="file" accept="image/*" onChange={e => loadImage(e, setAvatarPreview)} style={{ display: "none" }} />
              <div style={{
                width: 90, height: 90, borderRadius: 18, overflow: "hidden", flexShrink: 0,
                border: `1.5px dashed ${avatarPreview ? C.purple : "#232C27"}`,
                background: avatarPreview ? "transparent" : C.card,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {avatarPreview
                  ? <img src={avatarPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  : <span style={{ fontSize: 26 }}>{typeInfo.emoji}</span>}
              </div>
              <span style={{ color: C.sub, fontSize: 13, fontWeight: 700 }}>Tap to upload your logo</span>
            </label>
          </div>
        )}

        {/* ─── STEP 3: About + Location ─── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>Tell people about you</h2>
            <p style={{ color: C.sub, margin: "0 0 24px" }}>What you do and where you are.</p>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Tagline</label>
              <input style={inputStyle} placeholder="One line that sums you up" value={bio} onChange={e => setBio(e.target.value)} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>About</label>
              <textarea style={{ ...inputStyle, minHeight: 110, resize: "vertical", fontFamily: "inherit" }} placeholder="Describe your business, what makes it special, who it's for…" value={descLong} onChange={e => setDescLong(e.target.value)} />
            </div>
            {typeInfo.hasAddress && (
              <div>
                <label style={labelStyle}>Location / address</label>
                <input style={inputStyle} placeholder="123 Main St, Las Vegas, NV" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
            )}
            {!typeInfo.hasAddress && (
              <div>
                <label style={labelStyle}>Location (city / area)</label>
                <input style={inputStyle} placeholder="Las Vegas, NV" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 4: Contact ─── */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>How can people reach you?</h2>
            <p style={{ color: C.sub, margin: "0 0 24px" }}>Add what you want public. Skip the rest.</p>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Website</label>
              <input style={inputStyle} placeholder="https://yourbusiness.com" value={website} onChange={e => setWebsite(e.target.value)} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} placeholder="hello@yourbusiness.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} placeholder="(702) 555-0100" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
        )}

        {/* ─── STEP 5: Socials ─── */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: "0 0 6px" }}>Link your socials</h2>
            <p style={{ color: C.sub, margin: "0 0 24px" }}>Just your handles — we'll build the links.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>📸 Instagram</label>
              <input style={inputStyle} placeholder="yourbusiness" value={instagram} onChange={e => setInstagram(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>🎵 TikTok</label>
              <input style={inputStyle} placeholder="yourbusiness" value={tiktok} onChange={e => setTiktok(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>𝕏 Twitter / X</label>
              <input style={inputStyle} placeholder="yourbusiness" value={twitter} onChange={e => setTwitter(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>▶️ YouTube</label>
              <input style={inputStyle} placeholder="@yourchannel" value={youtube} onChange={e => setYoutube(e.target.value)} />
            </div>
          </div>
        )}

        {/* ─── STEP 6: Done ─── */}
        {step === 6 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>{typeInfo.emoji}</div>
            <h2 style={{ fontSize: 30, fontWeight: 900, color: C.text, margin: "0 0 10px" }}>You're ready to launch</h2>
            <p style={{ color: C.sub, margin: "0 0 24px" }}>
              {businessName.trim() ? businessName.trim() : "Your business"} is set up. Finish the rest right from your profile:
            </p>
            <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
              {[
                { emoji: "📸", text: "Gallery — show off your space and photos" },
                { emoji: "🏆", text: "Leaderboard — rank your members or challenges" },
                { emoji: "📅", text: "Schedule — post your classes and hours" },
                { emoji: "🎟️", text: "Events — create events people can join" },
                { emoji: "⭐", text: "Reviews & Community — engage your followers" },
              ].map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 20 }}>{it.emoji}</span>
                  <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{it.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Nav buttons ─── */}
        <div style={{ display: "flex", gap: 10, marginTop: 28, alignItems: "center" }}>
          {step > 1 && (
            <button type="button" onClick={back} disabled={saving}
              style={{ padding: "14px 20px", borderRadius: 14, border: "1.5px solid #232C27", background: "transparent", color: C.sub, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              Back
            </button>
          )}
          <button type="button" onClick={next} disabled={saving || !canProceed[step]}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 14, border: "none",
              background: canProceed[step] && !saving ? `linear-gradient(135deg,${C.purple},#86CFAE)` : "#374151",
              color: "#fff", fontWeight: 900, fontSize: 15,
              cursor: canProceed[step] && !saving ? "pointer" : "not-allowed",
            }}>
            {saving ? "Saving…" : step === TOTAL_STEPS ? "Go to my profile" : step === 1 ? "Continue" : "Next"}
          </button>
        </div>

        {/* Skip-for-now — only on optional middle steps */}
        {isSkippable && !saving && (
          <button type="button" onClick={next}
            style={{ width: "100%", marginTop: 12, padding: "8px", background: "transparent", border: "none", color: C.sub, fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

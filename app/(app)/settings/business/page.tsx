"use client";
// ── app/(app)/settings/business/page.tsx ────────────────────────────────────
// Business profile editor. Lives under settings so businesses can find it
// easily ("Settings → My Business"). Personal accounts see a redirect.
//
// Saves straight to the users table via Supabase client (RLS policy allows
// users to update their own row). No server round-trip needed since these
// fields are non-sensitive and already have update policies.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { BUSINESS_TYPES, isBusinessAccount } from "@/lib/businessTypes";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export default function BusinessEditorPage() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();

  // All business fields — initialized from current profile on mount
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("gym");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [descriptionLong, setDescriptionLong] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [twitter, setTwitter] = useState("");
  const [youtube, setYoutube] = useState("");
  // Hours stored as object: {mon:{open,close}|"closed", ...}
  const [hours, setHours] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // ── Populate from current profile on load ─────────────────────────────
  useEffect(() => {
    if (!user?.profile) return;
    const p = user.profile as any;
    setBusinessName(p.business_name || "");
    setBusinessType(p.business_type || "gym");
    setWebsite(p.business_website || "");
    setAddress(p.business_address || "");
    setPhone(p.business_phone || "");
    setContactEmail(p.business_email || "");
    setDescriptionLong(p.business_description_long || "");
    setInstagram(p.business_instagram || "");
    setTiktok(p.business_tiktok || "");
    setTwitter(p.business_twitter || "");
    setYoutube(p.business_youtube || "");
    setHours(p.business_hours || {});
  }, [user]);

  // Redirect personal accounts away
  useEffect(() => {
    if (authLoading || !user) return;
    if (!isBusinessAccount(user.profile)) {
      router.push("/settings");
    }
  }, [user, authLoading, router]);

  // ── Hours toggler ─────────────────────────────────────────────────────
  function toggleDay(day: string) {
    setHours(h => {
      const next = { ...h };
      if (!next[day] || next[day] === "closed") {
        // Default to 06:00-22:00 when turning a day on
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
      if (!next[day] || next[day] === "closed") {
        next[day] = { open: "06:00", close: "22:00" };
      }
      next[day] = { ...(next[day] as any), [field]: value };
      return next;
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);

    // Clean up hours: drop days that are closed-with-no-hours (null would
    // look same as "not set", so we explicitly set them to "closed" string)
    const cleanedHours: Record<string, any> = {};
    for (const d of DAYS) {
      const v = hours[d.key];
      if (v === "closed") cleanedHours[d.key] = "closed";
      else if (v && typeof v === "object" && v.open && v.close) cleanedHours[d.key] = v;
      // Omitting a day entirely = no info given
    }

    const { error: dbErr } = await supabase.from("users").update({
      business_name: businessName || null,
      business_type: businessType,
      business_website: website || null,
      business_address: address || null,
      business_phone: phone || null,
      business_email: contactEmail || null,
      business_description_long: descriptionLong || null,
      business_instagram: instagram || null,
      business_tiktok: tiktok || null,
      business_twitter: twitter || null,
      business_youtube: youtube || null,
      business_hours: Object.keys(cleanedHours).length > 0 ? cleanedHours : null,
    } as any).eq("id", user.id);

    if (dbErr) {
      setError(dbErr.message);
      setSaving(false);
      return;
    }
    setSaved(true);
    setSaving(false);
    // Refresh auth profile so the rest of the app sees updates immediately
    await refreshProfile?.();
    // Fade the "Saved" chip after 3s
    setTimeout(() => setSaved(false), 3000);
  }

  if (authLoading) return <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Loading...</div>;
  if (!user || !isBusinessAccount(user.profile)) return null;

  const p = user.profile as any;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 100px" }}>
      <Link href="/settings" style={{ color: "#A78BFA", textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-block", marginBottom: 16 }}>
        ← Back to Settings
      </Link>

      <div style={{ fontSize: 28, fontWeight: 900, color: "#F0F0F0", marginBottom: 4 }}>
        🏢 Business Info
      </div>
      <div style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 24 }}>
        Fill out your business page. This is what people see when they visit your profile.
      </div>

      {/* Preview link */}
      <div style={{ marginBottom: 24, padding: 14, background: "#1A1D2E", border: "1px solid #2A2D3E", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>Public profile</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>See how your page looks to visitors</div>
        </div>
        <Link href={`/profile/${p.username}`} style={{ padding: "8px 14px", background: "#7C3AED", color: "#fff", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
          View →
        </Link>
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ── BASICS ─────────────────────────────────────────── */}
        <Section title="Basics">
          <Field label="Business name">
            <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} style={input} placeholder="Iron Gym Las Vegas" />
          </Field>
          <Field label="Business type">
            <select value={businessType} onChange={e => setBusinessType(e.target.value)} style={input}>
              {BUSINESS_TYPES.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
            </select>
          </Field>
          <Field label="About (long description)" hint="Shown on your About tab. Up to 500 characters.">
            <textarea value={descriptionLong} onChange={e => setDescriptionLong(e.target.value.slice(0, 500))} rows={4} style={{ ...input, resize: "vertical" }} placeholder="Tell people what makes your business special..." />
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4, textAlign: "right" }}>{descriptionLong.length}/500</div>
          </Field>
        </Section>

        {/* ── CONTACT ───────────────────────────────────────── */}
        <Section title="Contact & Location">
          <Field label="Address">
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} style={input} placeholder="123 Main St, Las Vegas, NV 89101" />
          </Field>
          <Field label="Phone">
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={input} placeholder="(702) 555-1234" />
          </Field>
          <Field label="Contact email" hint="Shown publicly — use a business email, not your personal.">
            <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={input} placeholder="hello@irongym.com" />
          </Field>
          <Field label="Website">
            <input type="url" value={website} onChange={e => setWebsite(e.target.value)} style={input} placeholder="https://irongym.com" />
          </Field>
        </Section>

        {/* ── HOURS ─────────────────────────────────────────── */}
        <Section title="Operating Hours" hint="Leave days off if you don't have set hours.">
          {DAYS.map(d => {
            const v = hours[d.key];
            const isOpen = v && v !== "closed" && typeof v === "object";
            return (
              <div key={d.key} style={{ display: "grid", gridTemplateColumns: "100px 80px 1fr 1fr", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #2A2D3E" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0" }}>{d.label}</div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9CA3AF", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!isOpen} onChange={() => toggleDay(d.key)} style={{ accentColor: "#7C3AED" }} />
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
        </Section>

        {/* ── SOCIAL ────────────────────────────────────────── */}
        <Section title="Social Links" hint="Full URLs (e.g. https://instagram.com/yourhandle).">
          <Field label="📷 Instagram"><input type="url" value={instagram} onChange={e => setInstagram(e.target.value)} style={input} placeholder="https://instagram.com/..." /></Field>
          <Field label="🎵 TikTok"><input type="url" value={tiktok} onChange={e => setTiktok(e.target.value)} style={input} placeholder="https://tiktok.com/@..." /></Field>
          <Field label="𝕏 Twitter / X"><input type="url" value={twitter} onChange={e => setTwitter(e.target.value)} style={input} placeholder="https://x.com/..." /></Field>
          <Field label="▶️ YouTube"><input type="url" value={youtube} onChange={e => setYoutube(e.target.value)} style={input} placeholder="https://youtube.com/@..." /></Field>
        </Section>

        {error && (
          <div style={{ background: "#2A0F0F", border: "1px solid #DC2626", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#FCA5A5" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center", position: "sticky", bottom: 20, zIndex: 5 }}>
          <button type="submit" disabled={saving} style={{ flex: 1, padding: "14px 20px", background: saving ? "#4B1D8A" : "#7C3AED", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          {saved && (
            <span style={{ fontSize: 13, color: "#22C55E", fontWeight: 700 }}>✓ Saved</span>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Styled helpers ────────────────────────────────────────────────────────
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1A1D2E", border: "1px solid #2A2D3E", borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: hint ? 4 : 14 }}>
        {title}
      </div>
      {hint && <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14 }}>{hint}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#252A3D",
  border: "1px solid #2A2D3E",
  borderRadius: 10,
  color: "#E2E8F0",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

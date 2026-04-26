"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { track } from "@/components/PostHogProvider";

const G = "#7C3AED";
const GL = "#F3F0FF";
const GM = "#DDD6FE";
const DARK_BG = "#0D0D0D";
const DARK_CARD = "#1A1A1A";
const DARK_BORDER = "#2A2A2A";
const DARK_INPUT = "#1A1A1A";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  // Birth date for age gating. Apple + COPPA require a minimum age check
  // before account creation. We enforce 13+ — users under 13 are rejected
  // with a clear message.
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  // Account type + step
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [step, setStep] = useState<1 | 2>(1);

  // Business fields
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("gym");
  const [businessWebsite, setBusinessWebsite] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // ── Age gate: must be 13+ (COPPA minimum, Apple requires enforcement) ──
    // Parse the birth date and compute age. Reject if under 13.
    // The min/max on the <input> help but client enforcement via the form
    // element alone is bypassable — we also check here as a safety net.
    if (!birthDate) {
      setError("Please enter your birth date.");
      setLoading(false);
      return;
    }
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) {
      setError("Invalid birth date.");
      setLoading(false);
      return;
    }
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    if (age < 13) {
      setError("You must be at least 13 years old to sign up.");
      setLoading(false);
      return;
    }
    if (age > 120) {
      setError("Please enter a valid birth date.");
      setLoading(false);
      return;
    }

    try {
      // Sign up with Supabase auth — profile row created by DB trigger
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://fit-app-ecru.vercel.app/feed',
          data: {
            full_name: fullName,
            username: username.toLowerCase(),
            city: city || null,
            birth_date: birthDate,
            account_type: accountType,
            business_name: businessName || null,
            business_type: businessType || null,
            business_website: businessWebsite || null,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Also update the users table with additional fields
      if (data?.user) {
        // Fire signup analytics event — primary funnel-top event for
        // measuring acquisition. Properties let us segment by account
        // type (personal vs business) in PostHog dashboards.
        track("signup", {
          account_type: accountType,
          has_city: !!city,
          has_business: !!businessName,
        });
        try {
          await supabase.from('users').update({
            city: city || null,
            birth_date: birthDate,
            account_type: accountType,
            business_name: businessName || null,
            business_type: businessType || null,
            business_website: businessWebsite || null,
          } as any).eq('id', data.user.id);
        } catch {
          // Column may not exist yet, that's fine
        }
      }

      // Detect whether Supabase requires email confirmation. When confirmation
      // is enabled in the dashboard, signUp returns user but no session — the
      // user must click the link in their email before they can log in. When
      // disabled, session is present and we can drop them straight into onboarding.
      if (data?.session) {
        setSuccess(true);
        setTimeout(() => router.push("/onboarding"), 1800);
      } else {
        // Email confirmation required — show the verification UI. User finishes
        // by clicking the link in their email, which lands them in /feed; their
        // first time there will redirect to /onboarding (handled in app layout).
        setNeedsEmailVerification(true);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 14,
    border: `1.5px solid ${DARK_BORDER}`,
    background: DARK_INPUT,
    fontSize: 15,
    color: "#E2E8F0",
    outline: "none",
    boxSizing: "border-box",
  };

  if (needsEmailVerification) return (
    <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>✉️</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: G, margin: "0 0 12px", letterSpacing: -0.5 }}>
          Check Your Email
        </h1>
        <p style={{ color: "#9CA3AF", fontSize: 15, lineHeight: 1.6, marginBottom: 8 }}>
          We sent a verification link to
        </p>
        <p style={{ color: "#E2E8F0", fontSize: 16, fontWeight: 700, marginBottom: 28 }}>
          {email}
        </p>
        <div style={{ background: DARK_CARD, borderRadius: 16, padding: 22, border: `1.5px solid ${DARK_BORDER}`, marginBottom: 22, textAlign: "left" as const }}>
          <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.7 }}>
            <div style={{ marginBottom: 8 }}>1. Open your inbox and find the email from FIT</div>
            <div style={{ marginBottom: 8 }}>2. Click the &ldquo;Confirm your email&rdquo; link</div>
            <div>3. You&apos;ll be redirected back to set up your profile</div>
          </div>
        </div>
        <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 20 }}>
          Don&apos;t see it? Check your spam folder. Link expires in 24 hours.
        </p>
        <a href="/login" style={{ display: "inline-block", padding: "13px 28px", borderRadius: 16, background: "transparent", color: G, fontWeight: 700, fontSize: 15, border: `1.5px solid ${G}`, textDecoration: "none" }}>
          Back to Sign In
        </a>
      </div>
    </div>
  );

  if (success) return (
    <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div style={{ fontSize: 64 }}>🎉</div>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: G, margin: 0 }}>Welcome to Fit!</h2>
      <p style={{ color: "#6B7280", marginTop: 8 }}>Taking you to the app...</p>
    </div>
  );

  // Step 1: Account type selection
  if (step === 1) return (
    <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: G, margin: 0 }}>FIT</h1>
          <p style={{ color: "#9CA3AF", fontSize: 14, marginTop: 4 }}>Choose your account type</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { type: "personal" as const, emoji: "🏃", title: "Personal", desc: "Track your fitness, join groups, follow friends" },
            { type: "business" as const, emoji: "🏢", title: "Business / Brand", desc: "Gym, studio, brand, or coach — get a business profile" },
          ].map(opt => (
            <button key={opt.type} onClick={() => { setAccountType(opt.type); setStep(2); }}
              style={{ background: DARK_CARD, border: `2px solid ${accountType === opt.type ? G : DARK_BORDER}`, borderRadius: 18, padding: "20px 24px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{opt.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#E2E8F0", marginBottom: 4 }}>{opt.title}</div>
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>{opt.desc}</div>
            </button>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "#6B7280" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: G, fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
        </div>
      </div>
    </div>
  );

  // Step 2: The signup form
  return (
    <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: G, margin: 0, letterSpacing: -1 }}>FIT</h1>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>
            {accountType === "business" ? "🏢 Business Account" : "Your fitness journey starts here."}
          </p>
        </div>

        <form onSubmit={handleSignup} style={{ background: DARK_CARD, borderRadius: 24, padding: 28, border: `2px solid ${DARK_BORDER}`, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
          {/* Back button */}
          <button type="button" onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
            ← Back
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>
                {accountType === "business" ? "Your Name" : "Full Name"}
              </label>
              <input style={inputStyle} type="text" placeholder="Joey Smith" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Username</label>
              <input style={inputStyle} type="text" placeholder="joey_fit" value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} required />
            </div>
          </div>

          {/* Business fields */}
          {accountType === "business" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Business Name</label>
                <input style={inputStyle} type="text" placeholder="e.g. Iron Gym Las Vegas" value={businessName} onChange={e => setBusinessName(e.target.value)} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Business Type</label>
                <select style={{ ...inputStyle }} value={businessType} onChange={e => setBusinessType(e.target.value)}>
                  {/* Keep DB values machine-readable (underscore_snake) but label them friendly.
                      Keeps the business_type column searchable and icon-lookup easy. */}
                  <option value="gym">🏋️ Gym</option>
                  <option value="yoga_studio">🧘 Yoga / Pilates Studio</option>
                  <option value="boxing_gym">🥊 Boxing / MMA Gym</option>
                  <option value="crossfit_box">🤸 CrossFit Box</option>
                  <option value="running_club">🏃 Running Club</option>
                  <option value="swim_club">🏊 Pool / Swim Club</option>
                  <option value="nutrition_brand">🥗 Nutrition / Meal Prep</option>
                  <option value="supplement_brand">💊 Supplement Brand</option>
                  <option value="apparel_brand">🛍️ Apparel Brand</option>
                  <option value="spa">🧖 Spa / Wellness Center</option>
                  <option value="recovery_center">💆 Recovery Center</option>
                  <option value="coach">🧑‍🏫 Coach / Trainer</option>
                  <option value="dietitian">🍎 Dietitian / Nutritionist</option>
                  <option value="sports_team">🏆 Sports Team</option>
                  <option value="other">📍 Other</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Website URL</label>
                <input style={inputStyle} type="text" placeholder="https://yourbusiness.com" value={businessWebsite} onChange={e => setBusinessWebsite(e.target.value)} />
              </div>
            </>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Email</label>
            <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Password</label>
            <input style={inputStyle} type="password" placeholder="Min 8 characters" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>City (for local discovery)</label>
            <input style={inputStyle} type="text" placeholder="Las Vegas, NV" value={city} onChange={e => setCity(e.target.value)} />
          </div>

          {/* Birth date — required for age gating (13+ minimum, COPPA compliance). */}
          {/* max attr set to "13 years ago today" so the picker itself prevents */}
          {/* under-13 selections. Server-side and handleSignup re-check as backup. */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Birth date *</label>
            <input
              style={inputStyle}
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              max={(() => {
                const d = new Date();
                d.setFullYear(d.getFullYear() - 13);
                return d.toISOString().split("T")[0];
              })()}
              min="1900-01-01"
              required
            />
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
              You must be at least 13 years old to create an account.
            </div>
          </div>

          {error && (
            <div style={{ background: "#2D1515", border: "1.5px solid #7F1D1D", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FCA5A5" }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
            background: loading ? DARK_BORDER : `linear-gradient(135deg, ${G}, #A78BFA)`,
            color: "#fff", fontWeight: 900, fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}>
            {loading ? "Creating account..." : "Create Account 🚀"}
          </button>

          <div style={{ textAlign: "center", marginTop: 18, fontSize: 14, color: "#6B7280" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: G, fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}



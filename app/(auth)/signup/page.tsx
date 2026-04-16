"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Account type + step
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [step, setStep] = useState<1 | 2>(1);

  // Business fields
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("Gym");
  const [businessWebsite, setBusinessWebsite] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
        try {
          await supabase.from('users').update({
            city: city || null,
            account_type: accountType,
            business_name: businessName || null,
            business_type: businessType || null,
            business_website: businessWebsite || null,
          } as any).eq('id', data.user.id);
        } catch {
          // Column may not exist yet, that's fine
        }
      }

      // If session exists immediately, email confirm is disabled — go straight to feed
      // If not, Supabase will send a confirm email — still show success and redirect
      setSuccess(true);
      setTimeout(() => router.push("/feed"), 1800);

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
                  {["Gym", "Studio", "Brand", "Coach", "Other"].map(t => <option key={t} value={t}>{t}</option>)}
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



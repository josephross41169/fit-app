"use client";
// ── app/(auth)/forgot-password/page.tsx ─────────────────────────────────────
// Standard "forgot password" flow: user enters email → Supabase sends a
// magic link → link redirects to /reset-password where they set a new one.
//
// We always show a success message regardless of whether the email exists,
// to avoid leaking which emails are registered (security best practice).

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const G = "#7C3AED";
const DARK_BG = "#0D0D0D";
const DARK_CARD = "#1A1A1A";
const DARK_BORDER = "#2A2A2A";
const DARK_INPUT = "#1A1A1A";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Tell Supabase to email a recovery link. The link will redirect
      // back to our /reset-password page, where the user picks a new password.
      const redirectTo = typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      // We deliberately don't reveal "email not found" — show success either
      // way to prevent enumeration attacks.
      setSent(true);
      console.warn("[forgot-password] reset error:", e?.message);
    } finally {
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

  return (
    <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{sent ? "✉️" : "🔑"}</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: G, margin: 0, letterSpacing: -0.5 }}>
            {sent ? "Check Your Email" : "Reset Password"}
          </h1>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
            {sent
              ? "If that email exists in our system, you'll get a reset link in a few minutes."
              : "Enter your email and we'll send you a link to set a new password."}
          </p>
        </div>

        {sent ? (
          <div style={{ background: DARK_CARD, borderRadius: 24, padding: 28, border: `2px solid ${DARK_BORDER}`, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 20 }}>
              Don&apos;t see it? Check your spam folder. The link expires in 1 hour.
            </div>
            <Link href="/login" style={{ display: "block", padding: "13px 0", borderRadius: 16, background: `linear-gradient(135deg, ${G}, #A78BFA)`, color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: DARK_CARD, borderRadius: 24, padding: 28, border: `2px solid ${DARK_BORDER}`, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Email</label>
              <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>

            {error && (
              <div style={{ background: "#2D1515", border: "1.5px solid #7F1D1D", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FCA5A5" }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading || !email} style={{
              width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
              background: loading || !email ? DARK_BORDER : `linear-gradient(135deg, ${G}, #A78BFA)`,
              color: "#fff", fontWeight: 900, fontSize: 16,
              cursor: loading || !email ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <div style={{ textAlign: "center", marginTop: 18, fontSize: 14, color: "#6B7280" }}>
              Remembered it?{" "}
              <Link href="/login" style={{ color: G, fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";
// ── app/(auth)/reset-password/page.tsx ──────────────────────────────────────
// Landing page for the password recovery email link. By the time the user
// arrives here, Supabase has already authenticated them via the magic link,
// so we just need to call updateUser({ password }) to set the new one.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const G = "#7C3AED";
const DARK_BG = "#0D0D0D";
const DARK_CARD = "#1A1A1A";
const DARK_BORDER = "#2A2A2A";
const DARK_INPUT = "#1A1A1A";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Check if the user actually arrived via a recovery link (session exists).
  // If they navigated here directly without clicking the email, we redirect.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      // Auto-redirect to feed after a moment so the success message is seen
      setTimeout(() => router.push("/feed"), 1800);
    } catch (e: any) {
      setError(e?.message || "Couldn't update password. Try the link again.");
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

  // Still checking — render nothing to avoid flash
  if (hasSession === null) {
    return <div style={{ minHeight: "100vh", background: DARK_BG }} />;
  }

  // No session means they didn't come from the email — point back to forgot
  if (!hasSession) {
    return (
      <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#F0F0F0", margin: "0 0 12px" }}>
            Reset link expired or invalid
          </h1>
          <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            Password reset links expire after 1 hour. Request a new one.
          </p>
          <Link href="/forgot-password" style={{ display: "inline-block", padding: "13px 28px", borderRadius: 16, background: `linear-gradient(135deg, ${G}, #A78BFA)`, color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{success ? "✅" : "🔐"}</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: G, margin: 0, letterSpacing: -0.5 }}>
            {success ? "Password Updated" : "Set New Password"}
          </h1>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
            {success
              ? "Signing you in..."
              : "Pick a new password for your account."}
          </p>
        </div>

        {!success && (
          <form onSubmit={handleSubmit} style={{ background: DARK_CARD, borderRadius: 24, padding: 28, border: `2px solid ${DARK_BORDER}`, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>New Password</label>
              <input style={inputStyle} type="password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Confirm Password</label>
              <input style={inputStyle} type="password" placeholder="Type it again" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>

            {error && (
              <div style={{ background: "#2D1515", border: "1.5px solid #7F1D1D", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FCA5A5" }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading || !password || !confirmPassword} style={{
              width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
              background: loading || !password || !confirmPassword ? DARK_BORDER : `linear-gradient(135deg, ${G}, #A78BFA)`,
              color: "#fff", fontWeight: 900, fontSize: 16,
              cursor: loading || !password || !confirmPassword ? "not-allowed" : "pointer",
            }}>
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

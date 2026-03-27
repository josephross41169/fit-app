"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const G = "#16A34A";
const GL = "#F0FDF4";
const GM = "#BBF7D0";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Check username availability
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    if (existing) {
      setError("That username is taken. Try another one.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username: username.toLowerCase(),
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/feed"), 2000);
    }
  }

  const input = {
    width: "100%", padding: "13px 16px", borderRadius: 14,
    border: `1.5px solid ${GM}`, background: GL,
    fontSize: 15, color: "#1A1A1A", outline: "none",
    boxSizing: "border-box" as const,
  };

  if (success) return (
    <div style={{ minHeight: "100vh", background: GL, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div style={{ fontSize: 64 }}>🎉</div>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: G }}>Welcome to Fit!</h2>
      <p style={{ color: "#6B7280" }}>Check your email to confirm, then you're in.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: GL, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: G, margin: 0, letterSpacing: -1 }}>FIT</h1>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>Your fitness journey starts here.</p>
        </div>

        <form onSubmit={handleSignup} style={{ background: "#fff", borderRadius: 24, padding: 28, border: `2px solid ${GM}`, boxShadow: "0 4px 24px rgba(22,163,74,0.08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Full Name</label>
              <input style={input} type="text" placeholder="Joey Smith" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Username</label>
              <input style={input} type="text" placeholder="joey_fit" value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} required />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Email</label>
            <input style={input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Password</label>
            <input style={input} type="password" placeholder="Min 8 characters" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && (
            <div style={{ background: "#FEE2E2", border: "1.5px solid #FECACA", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
            background: loading ? GM : `linear-gradient(135deg, ${G}, #22C55E)`,
            color: "#fff", fontWeight: 900, fontSize: 16, cursor: loading ? "not-allowed" : "pointer",
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

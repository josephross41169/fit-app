"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const G = "#7C3AED";
const GM = "#DDD6FE";
const DARK_BG = "#0D0D0D";
const DARK_CARD = "#1A1A1A";
const DARK_BORDER = "#2A2A2A";
const DARK_INPUT = "#1A1A1A";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Hard 8s timeout — never hang forever
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError("Sign in is taking too long. Check your connection and try again.");
    }, 8000);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      clearTimeout(timeoutId);
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        router.push("/feed");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
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

  return (
    <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: G, margin: 0, letterSpacing: -1 }}>Livelee</h1>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>Welcome back. Let&apos;s get after it.</p>
        </div>

        <form onSubmit={handleLogin} style={{ background: DARK_CARD, borderRadius: 24, padding: 28, border: `2px solid ${DARK_BORDER}`, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Email</label>
            <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Password</label>
            <input style={inputStyle} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          <div style={{ textAlign: "right", marginBottom: 16 }}>
            <Link href="/forgot-password" style={{ color: G, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              Forgot password?
            </Link>
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
            {loading ? "Signing in..." : "Sign In 💪"}
          </button>

          <div style={{ textAlign: "center", marginTop: 18, fontSize: 14, color: "#6B7280" }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" style={{ color: G, fontWeight: 700, textDecoration: "none" }}>Sign up free</Link>
          </div>
        </form>
      </div>
    </div>
  );
}



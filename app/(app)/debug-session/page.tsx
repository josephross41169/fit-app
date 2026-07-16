"use client";
// ─────────────────────────────────────────────────────────────────────────────
// /debug-session — on-device auth + storage diagnostics.
//
// Purpose: the App Store build fails to persist sessions and rejects writes
// (RLS) while the IDENTICAL code works on web. Every layer passes code review,
// so the failure is only observable at runtime on the device. This page runs
// the checks inside the real shipped app and prints the truth.
//
// Not linked from any navigation. Reach it by URL on web, or on native via
// Settings → (temporary) or by deep navigation. Safe to ship: it exposes no
// secrets (token payloads are decoded locally, never logged/sent).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Line = { label: string; value: string; ok?: boolean };

function decodeJwtPayload(token: string): any {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export default function DebugSessionPage() {
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);

  function add(label: string, value: string, ok?: boolean) {
    setLines(prev => [...prev, { label, value, ok }]);
  }

  async function runAll() {
    setLines([]);
    setRunning(true);
    try {
      // 1) Environment
      const proto = typeof window !== "undefined" ? window.location.protocol : "ssr";
      const cap = (window as any).Capacitor;
      const isNative = !!(cap?.isNativePlatform?.() || proto === "capacitor:" || proto === "ionic:");
      add("Origin protocol", proto);
      add("Capacitor bridge present", cap ? "yes" : "no", !!cap || !isNative);
      add("Native shell", isNative ? "yes" : "no (web)");

      // 2) Preferences plugin round-trip (the Keychain bridge)
      try {
        const mod = await import("@capacitor/preferences");
        add("Preferences plugin import", "ok", true);
        const key = "livelee-debug-probe";
        const stamp = String(Date.now());
        await mod.Preferences.set({ key, value: stamp });
        const { value } = await mod.Preferences.get({ key });
        await mod.Preferences.remove({ key });
        add("Preferences write→read round-trip", value === stamp ? "ok — persisted storage WORKS" : `MISMATCH (wrote ${stamp}, read ${value})`, value === stamp);
      } catch (e: any) {
        add("Preferences plugin", `FAILED: ${e?.message || e}`, false);
      }

      // 3) Session state
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        add("getSession()", "NO SESSION — the client is anonymous right now", false);
      } else {
        add("getSession()", "session present", true);
        add("session.user.id", session.user?.id || "(missing)", !!session.user?.id);
        const payload = decodeJwtPayload(session.access_token || "");
        add("access_token sub (what auth.uid() sees)", payload?.sub || "(undecodable)", !!payload?.sub);
        add("access_token role", payload?.role || "(none)", payload?.role === "authenticated");
        const secsLeft = payload?.exp ? payload.exp - Math.floor(Date.now() / 1000) : null;
        add("token expires in", secsLeft === null ? "(unknown)" : `${secsLeft}s`, secsLeft === null ? undefined : secsLeft > 0);
        add("sub matches user.id", payload?.sub === session.user?.id ? "yes" : "NO — token/user mismatch", payload?.sub === session.user?.id);
      }

      // 4) Authenticated READ (proves the token actually reaches the DB)
      try {
        const { count, error } = await supabase
          .from("activity_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session?.user?.id || "00000000-0000-0000-0000-000000000000");
        add("own-rows read (uses token)", error ? `ERROR: ${error.message}` : `ok — ${count ?? 0} rows visible as you`, !error);
      } catch (e: any) {
        add("own-rows read", `THREW: ${e?.message || e}`, false);
      }

      // 5) LIVE WRITE TEST — minimal private wellness row, then delete it.
      try {
        const uid = session?.user?.id;
        if (!uid) {
          add("write test", "skipped — no session", false);
        } else {
          const { data, error } = await supabase
            .from("activity_logs")
            .insert({ user_id: uid, log_type: "wellness", wellness_type: "Other", notes: "debug probe — auto-deleted", is_public: false })
            .select("id")
            .single();
          if (error) {
            add("WRITE TEST", `FAILED: ${error.message} (code ${ (error as any).code || "?"})`, false);
          } else {
            add("WRITE TEST", `SUCCESS — row ${data.id} inserted`, true);
            const { error: delErr } = await supabase.from("activity_logs").delete().eq("id", data.id);
            add("cleanup delete", delErr ? `failed: ${delErr.message}` : "ok", !delErr);
          }
        }
      } catch (e: any) {
        add("WRITE TEST", `THREW: ${e?.message || e}`, false);
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", color: "#F0F0F0", padding: "24px 16px", fontFamily: "monospace" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>🔧 Session Diagnostics</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
          Runs entirely on this device. Screenshot the results.
        </div>
        <button
          onClick={runAll}
          disabled={running}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: running ? "#24382E" : "#5BBE93", color: "#04342C", fontWeight: 900, fontSize: 15, cursor: "pointer", marginBottom: 20 }}
        >
          {running ? "Running…" : "▶ Run all checks"}
        </button>
        {lines.map((l, i) => (
          <div key={i} style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 8, background: "#111811", border: `1px solid ${l.ok === false ? "#7F1D1D" : l.ok ? "#1E5B3F" : "#1B231E"}` }}>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>{l.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: l.ok === false ? "#FCA5A5" : l.ok ? "#86CFAE" : "#F0F0F0", wordBreak: "break-all" }}>{l.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

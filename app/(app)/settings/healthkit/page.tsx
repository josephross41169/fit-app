"use client";
// ─────────────────────────────────────────────────────────────────────────────
// app/(app)/settings/healthkit/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Apple Health connection settings.
//
// Shown only on iOS native — on web/Android the page renders a "this only
// works in the Livelee iOS app" message because HealthKit is iOS-only.
//
// Three states:
//   1. Available, not connected   → big "Connect Apple Health" button
//   2. Available, connected       → status panel + manual "Sync now" button
//   3. Not available              → friendly explainer
//
// All sync logic lives in lib/healthkit.ts. This page is just glue UI.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  isHealthKitAvailable,
  isHealthKitConnected,
  requestHealthKitPermissions,
  runHealthKitSync,
  getLastSyncDate,
  type SyncResult,
} from "@/lib/healthkit";

export default function HealthKitSettingsPage() {
  const { user, loading: authLoading } = useAuth();

  const [available, setAvailable] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Initial load — populate available + connected state. Effect re-runs on
  // user change so logging out/in via this page picks up the right user.
  useEffect(() => {
    setAvailable(isHealthKitAvailable());
    if (user) {
      setConnected(isHealthKitConnected(user.id));
      setLastSync(getLastSyncDate(user.id));
    }
  }, [user]);

  async function handleConnect() {
    if (!user) return;
    setConnecting(true);
    try {
      const ok = await requestHealthKitPermissions(user.id);
      if (ok) {
        setConnected(true);
        // Run a first sync immediately so the user sees data right away.
        await handleSync();
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    if (!user) return;
    setSyncing(true);
    try {
      const result = await runHealthKitSync(user.id);
      setLastResult(result);
      setLastSync(getLastSyncDate(user.id));
    } finally {
      setSyncing(false);
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>
        Please sign in.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 100px" }}>
      {/* Back link */}
      <Link href="/settings" style={{ color: "#7C3AED", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
        ← Settings
      </Link>

      {/* Page title */}
      <div style={{ fontSize: 28, fontWeight: 900, color: "#F0F0F0", marginTop: 16, marginBottom: 4 }}>
        🍎 Apple Health
      </div>
      <div style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 28 }}>
        Sync your steps, workouts, sleep, and more from Apple Health.
      </div>

      {/* ─── State 3: Unavailable ─────────────────────────────────────── */}
      {!available && (
        <div style={{
          padding: 24,
          background: "rgba(124,58,237,0.08)",
          border: "1px solid rgba(124,58,237,0.3)",
          borderRadius: 14,
          color: "#E2E8F0",
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
            Available in the Livelee iOS app
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.5 }}>
            Apple Health integration only works in the native Livelee app on
            iPhone or iPad. Download from the App Store, sign in, and come
            back to this page from your iOS device to connect.
          </div>
        </div>
      )}

      {/* ─── State 1: Available, not connected ────────────────────────── */}
      {available && !connected && (
        <div>
          <div style={{
            padding: 20,
            background: "#15151E",
            border: "1px solid #2A2D3E",
            borderRadius: 14,
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", marginBottom: 12 }}>
              What gets synced
            </div>
            <SyncItem emoji="👟" label="Steps" desc="Daily step count from your iPhone or Apple Watch" />
            <SyncItem emoji="🔥" label="Active calories" desc="Daily calories burned" />
            <SyncItem emoji="💪" label="Workouts" desc="Logged from Apple Watch, Strava, Nike Run Club, etc." />
            <SyncItem emoji="⚖️" label="Weight" desc="From smart scales or manual entries in Health" />
            <SyncItem emoji="😴" label="Sleep" desc="Total time asleep each night" />
            <SyncItem emoji="❤️" label="Heart rate" desc="Resting heart rate readings" />
          </div>

          <button
            onClick={handleConnect}
            disabled={connecting}
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "linear-gradient(135deg,#7C3AED,#A855F7)",
              border: "none",
              borderRadius: 12,
              color: "#fff",
              fontSize: 15,
              fontWeight: 800,
              cursor: connecting ? "default" : "pointer",
              opacity: connecting ? 0.6 : 1,
            }}
          >
            {connecting ? "Connecting..." : "Connect Apple Health"}
          </button>

          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 12, lineHeight: 1.5 }}>
            iOS will show you a permission sheet listing each data type. You
            can grant or deny each one individually — Livelee will only sync
            what you allow. You can change permissions anytime in iPhone
            Settings → Privacy &amp; Security → Health → Livelee.
          </div>
        </div>
      )}

      {/* ─── State 2: Connected ───────────────────────────────────────── */}
      {available && connected && (
        <div>
          {/* Status panel */}
          <div style={{
            padding: 20,
            background: "#15151E",
            border: "1px solid #2A2D3E",
            borderRadius: 14,
            marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#22C55E",
                boxShadow: "0 0 8px #22C55E",
              }} />
              <div style={{ fontSize: 14, fontWeight: 800, color: "#E2E8F0" }}>
                Connected to Apple Health
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>
              {lastSync
                ? `Last synced ${formatRelative(lastSync)}`
                : "Not synced yet — tap Sync now below to pull your data."}
            </div>
          </div>

          {/* Last result summary, if we just synced */}
          {lastResult && (
            <div style={{
              padding: 16,
              background: lastResult.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${lastResult.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              borderRadius: 12,
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: lastResult.ok ? "#86EFAC" : "#FCA5A5", marginBottom: 8 }}>
                {lastResult.ok ? "✓ Sync complete" : "Sync finished with issues"}
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.7 }}>
                {lastResult.workouts > 0 && <div>• {lastResult.workouts} new workout{lastResult.workouts === 1 ? "" : "s"}</div>}
                {lastResult.steps > 0 && <div>• {lastResult.steps} day{lastResult.steps === 1 ? "" : "s"} of steps</div>}
                {lastResult.calories > 0 && <div>• {lastResult.calories} day{lastResult.calories === 1 ? "" : "s"} of active calories</div>}
                {lastResult.sleep > 0 && <div>• {lastResult.sleep} night{lastResult.sleep === 1 ? "" : "s"} of sleep</div>}
                {lastResult.weights > 0 && <div>• {lastResult.weights} weight reading{lastResult.weights === 1 ? "" : "s"}</div>}
                {lastResult.heartRate > 0 && <div>• {lastResult.heartRate} heart rate reading{lastResult.heartRate === 1 ? "" : "s"}</div>}
                {lastResult.workouts + lastResult.steps + lastResult.calories + lastResult.sleep + lastResult.weights + lastResult.heartRate === 0
                  && lastResult.ok && <div>No new data since last sync.</div>}
                {lastResult.errors.length > 0 && (
                  <div style={{ marginTop: 10, color: "#FCA5A5" }}>
                    {lastResult.errors.map((e, i) => <div key={i}>! {e}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              width: "100%",
              padding: "14px 16px",
              background: syncing ? "#1F1F2E" : "linear-gradient(135deg,#7C3AED,#A855F7)",
              border: "none",
              borderRadius: 12,
              color: "#fff",
              fontSize: 15,
              fontWeight: 800,
              cursor: syncing ? "default" : "pointer",
            }}
          >
            {syncing ? "Syncing..." : "Sync now"}
          </button>

          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 12, lineHeight: 1.5 }}>
            Livelee also auto-syncs in the background when you open the app.
            To revoke access, go to iPhone Settings → Privacy &amp; Security →
            Health → Livelee.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper components ──────────────────────────────────────────────────────
function SyncItem({ emoji, label, desc }: { emoji: string; label: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #1F1F2E" }}>
      <div style={{ fontSize: 22 }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#E2E8F0" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#6B7280" }}>{desc}</div>
      </div>
    </div>
  );
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleString();
}

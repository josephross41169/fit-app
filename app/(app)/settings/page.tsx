"use client";
// ── app/(app)/settings/page.tsx ─────────────────────────────────────────────
// Account settings hub. Currently hosts:
//   - Account deletion (required by Apple Guideline 5.1.1(v))
//   - Blocked users list (populated when we ship blocking)
//   - Links to Terms and Privacy
//
// As features land they get added here. Keep this page lightweight and
// server-API-driven — no heavy client-side state, no heavy queries.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { isBusinessAccount } from "@/lib/businessTypes";
import { enablePush, disablePush, getPushStatus, type PushStatus } from "@/lib/pushClient";
import { useIsNativeShell } from "@/lib/native";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  // Web-push doesn't exist inside the native WebView (no Notification API),
  // and the section's copy is written for Safari users ("add to Home
  // Screen…"). Showing it in the iOS app reads as broken, so hide it there.
  const nativeShell = useIsNativeShell();

  // ── Account-deletion flow state ────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Push notifications state ───────────────────────────────────────────
  // Status starts as null while we ask the browser what's already been
  // permissioned + subscribed. Then it's one of the PushStatus values.
  // Settings UI renders different buttons depending on the value.
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // On mount, ask the browser what state we're in.
  useEffect(() => {
    getPushStatus().then(setPushStatus).catch(() => setPushStatus('unsupported'));
  }, []);

  async function handleEnablePush() {
    if (!user || pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    try {
      await enablePush(user.id);
      setPushStatus('subscribed');
    } catch (err: any) {
      setPushError(err?.message || 'Failed to enable push notifications.');
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    if (!user || pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    try {
      await disablePush(user.id);
      setPushStatus('unsubscribed');
    } catch (err: any) {
      setPushError(err?.message || 'Failed to disable push notifications.');
    } finally {
      setPushBusy(false);
    }
  }

  // ── Handle delete ──────────────────────────────────────────────────────
  // Pipeline: POST /api/db delete_account → client signOut → redirect home.
  // We require the user to type "DELETE" in confirmation — matches the
  // industry-standard friction level (GitHub, Twitter, Instagram all do this).
  async function handleDeleteAccount() {
    if (!user || deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_account",
          payload: { userId: user.id, reason: deleteReason || null },
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Delete failed");
      }

      // Sign out client-side. The server already banned the auth user;
      // signOut clears the cookie so the redirect lands on the public page.
      await supabase.auth.signOut();
      router.push("/");
    } catch (e: any) {
      setDeleteError(e.message || "Something went wrong. Please try again.");
      setDeleting(false);
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
        Please sign in to view settings.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 100px" }}>
      {/* Page title */}
      <div style={{ fontSize: 28, fontWeight: 900, color: "#F0F0F0", marginBottom: 4 }}>
        ⚙️ Settings
      </div>
      <div style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 28 }}>
        Manage your account and privacy
      </div>

      {/* ── SECTION: Business (only shown for business accounts) ─────── */}
      {/* Dedicated home for business info — the editor page is much larger
          than would fit inline here, so we link out to it. */}
      {isBusinessAccount(user.profile) && (
        <Section title="🏢 Business">
          <Row>
            <Link href="/settings/business" style={linkStyle}>
              Edit business info (hours, address, social links) →
            </Link>
          </Row>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8, paddingLeft: 4 }}>
            Business accounts are advertising pages — set up your contact info,
            hours, and social links so customers can find you.
          </div>
        </Section>
      )}

      {/* ── SECTION: Insights (owner-only analytics, moved off the public
          profile so only the business owner sees them) ─────────────── */}
      {isBusinessAccount(user.profile) && <BusinessInsights profile={user.profile} />}

      {/* ── SECTION: About ──────────────────────────────────────────── */}
      <Section title="📜 About & Legal">
        <Row>
          <Link href="/terms" style={linkStyle}>
            Terms of Service →
          </Link>
        </Row>
        <Row>
          <Link href="/privacy" style={linkStyle}>
            Privacy Policy →
          </Link>
        </Row>
      </Section>

      {/* ── SECTION: Notifications ──────────────────────────────────────
          Push notifications wake the device when you're not in the app
          and a buddy nudges you, a rival's score changes, etc. iOS-only
          gotcha: web push on iPhone REQUIRES the user to add Livelee to
          their Home Screen first — Safari refuses the permission prompt
          otherwise. We detect that and tell them how to fix it instead
          of failing silently. */}
      {!nativeShell && (<Section title="🔔 Notifications">
        {pushStatus === null && (
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>Checking…</div>
        )}
        {pushStatus === 'unsupported' && (
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>
            This browser doesn't support push notifications. Try a recent
            version of Safari (iOS 16.4+), Chrome, or Firefox.
          </div>
        )}
        {pushStatus === 'needs-install' && (
          <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.55 }}>
            On iPhone, push notifications only work after you install Livelee
            to your Home Screen:
            <ol style={{ margin: "10px 0 0 18px", padding: 0, color: "#D1D5DB" }}>
              <li>Tap the <strong>Share</strong> button at the bottom of Safari</li>
              <li>Scroll down and tap <strong>“Add to Home Screen”</strong></li>
              <li>Open Livelee from your Home Screen, then come back here</li>
            </ol>
          </div>
        )}
        {pushStatus === 'denied' && (
          <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.55 }}>
            Notifications are currently blocked. Go to your phone or
            browser settings, find Livelee in the notifications list,
            and allow notifications — then come back and reload this page.
          </div>
        )}
        {pushStatus === 'unsubscribed' && (
          <Row>
            <button onClick={handleEnablePush} disabled={pushBusy}
              style={{
                background: pushBusy ? "#232C27" : "linear-gradient(135deg,#5BBE93,#86CFAE)",
                color: "#fff", border: "none", padding: "10px 18px",
                borderRadius: 12, fontWeight: 800, fontSize: 13,
                cursor: pushBusy ? "default" : "pointer",
              }}>
              {pushBusy ? "Turning on…" : "Turn on push notifications"}
            </button>
          </Row>
        )}
        {pushStatus === 'subscribed' && (
          <Row>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#10B981", fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B98166" }} />
                On — you'll get notifications on this device
              </div>
              <button onClick={handleDisablePush} disabled={pushBusy}
                style={{
                  background: "transparent", border: "1px solid #4B5563",
                  color: "#9CA3AF", padding: "8px 14px", borderRadius: 10,
                  fontWeight: 700, fontSize: 12, cursor: pushBusy ? "default" : "pointer",
                }}>
                {pushBusy ? "Turning off…" : "Turn off"}
              </button>
            </div>
          </Row>
        )}
        {pushError && (
          <div style={{ fontSize: 12, color: "#EF4444", marginTop: 10, padding: 10, background: "#3F0F0F", borderRadius: 10, lineHeight: 1.5 }}>
            {pushError}
          </div>
        )}
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 10, paddingLeft: 4, lineHeight: 1.5 }}>
          You'll get a banner when someone follows you, comments on your
          post, sends you a message, or your rivalry / workout buddy
          activity needs attention. You can turn this off at any time.
        </div>
      </Section>)}

      {/* ── SECTION: Integrations ──────────────────────────────────── */}
      {/* Hosts third-party data sources that can sync into Livelee. The
          HealthKit sub-page handles the iOS-only UX and is safe to link
          from web too — that page renders a friendly "iOS app only"
          message when HealthKit isn't available, so web users don't get
          a broken experience. */}
      <Section title="🔌 Integrations">
        <Row>
          <Link href="/settings/healthkit" style={linkStyle}>
            🍎 Apple Health →
          </Link>
        </Row>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8, paddingLeft: 4 }}>
          Sync workouts, steps, sleep, weight, and more from Apple Health
          (iOS only). More integrations like Whoop and Oura coming soon.
        </div>
      </Section>

      {/* ── SECTION: Privacy & Safety ───────────────────────────────── */}
      <Section title="🛡️ Privacy & Safety">
        <Row>
          <Link href="/settings/blocked" style={linkStyle}>
            Blocked users →
          </Link>
        </Row>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8, paddingLeft: 4 }}>
          If someone on the platform is harassing you or posting inappropriate content, tap the
          ⋯ menu on their profile or post to report or block them.
        </div>
      </Section>

      {/* ── SECTION: Account ──────────────────────────────────────────── */}
      <Section title="👤 Account">
        <a href="/debug-session" style={{ display: "block", textAlign: "center", fontSize: 12, color: "#6B7280", textDecoration: "underline", marginBottom: 14 }}>🔧 Connection diagnostics</a>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "transparent",
            border: "1.5px solid #232C27",
            borderRadius: 10,
            color: "#E2E8F0",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Sign out
        </button>
      </Section>

      {/* ── SECTION: Danger zone ──────────────────────────────────────── */}
      <Section title="⚠️ Danger Zone" danger>
        <button
          onClick={() => setShowDeleteModal(true)}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "transparent",
            border: "1.5px solid #DC2626",
            borderRadius: 10,
            color: "#FCA5A5",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Delete my account
        </button>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8, paddingLeft: 4 }}>
          Permanently anonymizes your account. Your posts will remain but show as "Deleted
          User". Your username will be reserved so nobody can impersonate you.
        </div>
      </Section>

      {/* ── DELETE CONFIRMATION MODAL ─────────────────────────────────── */}
      {showDeleteModal && (
        <div
          onClick={() => !deleting && setShowDeleteModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#161D19",
              borderRadius: 16,
              padding: 24,
              maxWidth: 480,
              width: "100%",
              border: "1.5px solid #DC2626",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: "#FCA5A5", marginBottom: 8 }}>
              Delete Account
            </div>
            <div style={{ fontSize: 14, color: "#E2E8F0", lineHeight: 1.5, marginBottom: 20 }}>
              This is permanent. Your profile, username, and personal data will be anonymized.
              Your posts and badges will remain but appear as &ldquo;Deleted User&rdquo;. Your username will
              be reserved so nobody can impersonate you. You can sign up again later with the same email.
            </div>

            {/* Optional reason for our learning */}
            <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>
              Why are you leaving? (optional)
            </label>
            <textarea
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              rows={3}
              placeholder="Help us improve..."
              style={{
                width: "100%",
                background: "#1B231E",
                border: "1px solid #232C27",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                color: "#E2E8F0",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                resize: "vertical",
                marginBottom: 16,
              }}
            />

            {/* Type-to-confirm — friction gate */}
            <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>
              Type <code style={{ background: "#0E1311", padding: "2px 6px", borderRadius: 4, color: "#FCA5A5" }}>DELETE</code> to confirm
            </label>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{
                width: "100%",
                background: "#1B231E",
                border: "1px solid #232C27",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                color: "#E2E8F0",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                marginBottom: 20,
              }}
            />

            {deleteError && (
              <div style={{ background: "#2A0F0F", border: "1px solid #DC2626", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 13, color: "#FCA5A5" }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  background: "transparent",
                  border: "1px solid #232C27",
                  borderRadius: 10,
                  color: "#E2E8F0",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: deleting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                disabled={deleteConfirmText !== "DELETE" || deleting}
                onClick={handleDeleteAccount}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  background: deleteConfirmText === "DELETE" ? "#DC2626" : "#4B1717",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: deleteConfirmText === "DELETE" && !deleting ? "pointer" : "not-allowed",
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable section wrapper ───────────────────────────────────────────────
function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div
      style={{
        background: danger ? "#1A0F0F" : "#161D19",
        border: `1px solid ${danger ? "#4B1717" : "#232C27"}`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: danger ? "#FCA5A5" : "#9CA3AF", marginBottom: 14, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "8px 0" }}>{children}</div>;
}

// Owner-only business analytics. Moved here from the public profile so only
// the business owner (who can reach their own Settings) sees these numbers.
function BusinessInsights({ profile }: { profile: any }) {
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("business_reviews")
          .select("rating")
          .eq("business_id", profile.id);
        const list = (data || []) as any[];
        if (!alive) return;
        setReviewCount(list.length);
        setAvgRating(list.length ? list.reduce((s, r) => s + (r.rating || 0), 0) / list.length : 0);
      } catch {
        if (alive) { setReviewCount(0); setAvgRating(0); }
      }
    })();
    return () => { alive = false; };
  }, [profile.id]);

  const cards: { label: string; value: string | number; emoji: string }[] = [
    { label: "Profile views", value: profile.business_profile_views ?? 0, emoji: "👀" },
    { label: "Followers", value: profile.followers_count ?? 0, emoji: "👥" },
    { label: "Reviews", value: reviewCount == null ? "…" : reviewCount, emoji: "⭐" },
    { label: "Avg rating", value: avgRating == null ? "…" : (reviewCount ? avgRating.toFixed(1) : "—"), emoji: "📊" },
  ];

  return (
    <Section title="📊 Insights">
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12, paddingLeft: 4 }}>
        How your profile is doing. Only you can see this.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: "#11141F", border: "1px solid #232C27", borderRadius: 12, padding: "14px 14px" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{c.emoji}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#F0F0F0" }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 12, lineHeight: 1.5, paddingLeft: 4 }}>
        💡 Keep your offer, announcement, and gallery fresh — active profiles get more views and followers.
      </div>
    </Section>
  );
}

const linkStyle = {
  color: "#86CFAE",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
  display: "block",
};

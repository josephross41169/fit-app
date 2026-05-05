"use client";
// ── app/(app)/settings/page.tsx ─────────────────────────────────────────────
// Account settings hub. Currently hosts:
//   - Account deletion (required by Apple Guideline 5.1.1(v))
//   - Blocked users list (populated when we ship blocking)
//   - Links to Terms and Privacy
//
// As features land they get added here. Keep this page lightweight and
// server-API-driven — no heavy client-side state, no heavy queries.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { isBusinessAccount } from "@/lib/businessTypes";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // ── Account-deletion flow state ────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "transparent",
            border: "1.5px solid #2A2D3E",
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
              background: "#1A1D2E",
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
                background: "#252A3D",
                border: "1px solid #2A2D3E",
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
              Type <code style={{ background: "#0D0D0D", padding: "2px 6px", borderRadius: 4, color: "#FCA5A5" }}>DELETE</code> to confirm
            </label>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{
                width: "100%",
                background: "#252A3D",
                border: "1px solid #2A2D3E",
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
                  border: "1px solid #2A2D3E",
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
        background: danger ? "#1A0F0F" : "#1A1D2E",
        border: `1px solid ${danger ? "#4B1717" : "#2A2D3E"}`,
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

const linkStyle = {
  color: "#A78BFA",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
  display: "block",
};

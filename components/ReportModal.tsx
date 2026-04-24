"use client";
// ── components/ReportModal.tsx ─────────────────────────────────────────────
// Reusable modal for reporting a post, user, comment, message, or challenge.
// Usage:
//   const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
//   <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
//   ...
//   <button onClick={() => setReportTarget({ type: 'post', id: post.id })}>Report</button>

import { useState } from "react";
import { useAuth } from "@/lib/auth";

export type ReportTargetType = "post" | "user" | "comment" | "message" | "challenge";

export interface ReportTarget {
  type: ReportTargetType;
  id: string;
}

// Must match the `reason` check constraint in migration-moderation.sql.
// Keep labels human-friendly and brief — this is a picker, not a form.
const REASONS: { key: string; label: string; desc: string }[] = [
  { key: "spam",            label: "Spam",                   desc: "Repetitive, unsolicited, or promotional" },
  { key: "harassment",      label: "Harassment or bullying", desc: "Targeted attacks, insults, threats" },
  { key: "hate_speech",     label: "Hate speech",            desc: "Attacks based on race, gender, religion, etc." },
  { key: "sexual_content",  label: "Sexual content",         desc: "Nudity, explicit material, or solicitation" },
  { key: "violence",        label: "Violence",               desc: "Threats, gore, or depictions of violence" },
  { key: "self_harm",       label: "Self-harm",              desc: "Content promoting or glorifying self-harm" },
  { key: "misinformation",  label: "Misinformation",         desc: "False health or safety claims" },
  { key: "impersonation",   label: "Impersonation",          desc: "Pretending to be someone else" },
  { key: "other",           label: "Something else",         desc: "Other violation — please describe" },
];

export default function ReportModal({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (!target) return null;

  async function submit() {
    if (!user || !reason || !target) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_content",
          payload: {
            reporterId: user.id,
            targetType: target.type,
            targetId: target.id,
            reason,
            details: details.trim() || null,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Report failed");
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || "Couldn't submit report. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    // Reset form for next open
    setReason("");
    setDetails("");
    setSubmitted(false);
    setError("");
    onClose();
  }

  return (
    <div
      onClick={handleClose}
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
          maxHeight: "85vh",
          overflowY: "auto",
          border: "1px solid #2A2D3E",
        }}
      >
        {submitted ? (
          // ── Success state ──
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#E2E8F0", marginBottom: 8 }}>
              Report submitted
            </div>
            <div style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.5, marginBottom: 20 }}>
              Thanks for helping keep the community safe. Our team will review this
              within 24 hours.
            </div>
            <button
              onClick={handleClose}
              style={{
                padding: "11px 20px",
                background: "#7C3AED",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#E2E8F0", marginBottom: 6 }}>
              Report {target.type === "user" ? "User" : target.type === "post" ? "Post" : "Content"}
            </div>
            <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
              Why are you reporting this? We review every report.
            </div>

            {/* Reason picker */}
            <div style={{ marginBottom: 16 }}>
              {REASONS.map(r => (
                <label
                  key={r.key}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "10px 12px",
                    marginBottom: 6,
                    background: reason === r.key ? "#2A1F4A" : "#252A3D",
                    border: `1px solid ${reason === r.key ? "#7C3AED" : "#2A2D3E"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.key}
                    checked={reason === r.key}
                    onChange={() => setReason(r.key)}
                    style={{ marginTop: 3, accentColor: "#7C3AED" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0" }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Optional details */}
            <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>
              Additional details (optional)
            </label>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Anything else we should know?"
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

            {error && (
              <div style={{ background: "#2A0F0F", border: "1px solid #DC2626", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 13, color: "#FCA5A5" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                disabled={submitting}
                onClick={handleClose}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  background: "transparent",
                  border: "1px solid #2A2D3E",
                  borderRadius: 10,
                  color: "#E2E8F0",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                disabled={!reason || submitting}
                onClick={submit}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  background: reason ? "#DC2626" : "#4B1717",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: reason && !submitting ? "pointer" : "not-allowed",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

// components/CouplesPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The Couples tab on the Rivals page. Three states:
//   1. No couple   → link with a partner (create a code, or enter theirs)
//   2. Pending     → you sent an invite, waiting for them to accept
//   3. Active      → the couple profile card + fun relationship questions
//                    that BOTH partners can edit.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import {
  getMyCouple, createCoupleInvite, acceptCoupleInvite,
  updateCoupleDetails, unlinkCouple, cancelCoupleInvite,
  formatTogetherDuration,
  type Couple, type CoupleDetails, type CouplePartner,
} from "@/lib/couples";

const C = {
  text: "#F0F0F0", sub: "#9CA3AF", pink: "#EC4899", purple: "#7C3AED", purpleLt: "#A78BFA",
  card: "#160F28", border: "#2A1F45", input: "#0D0D0D",
};

const iStyle: React.CSSProperties = {
  background: C.input, border: `1px solid ${C.border}`, borderRadius: 10,
  color: C.text, padding: "10px 12px", fontSize: 14, outline: "none", width: "100%",
};

function firstName(p: CouplePartner | null | undefined): string {
  if (!p) return "Partner";
  return (p.full_name || p.username || "Partner").split(" ")[0];
}

export default function CouplesPanel() {
  const [couple, setCouple] = useState<Couple | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [acceptCode, setAcceptCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CoupleDetails>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setCouple(await getMyCouple()); } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll while pending so the inviter auto-advances when their partner accepts.
  useEffect(() => {
    if (couple?.status !== "pending") return;
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [couple?.status, load]);

  async function handleCreate() {
    setBusy(true); setError("");
    try { await createCoupleInvite(); await load(); }
    catch (e: any) { setError(e.message || "Could not create invite"); }
    finally { setBusy(false); }
  }

  async function handleAccept() {
    const code = acceptCode.trim();
    if (code.length < 4) return;
    setBusy(true); setError("");
    try { await acceptCoupleInvite(code); setAcceptCode(""); await load(); }
    catch (e: any) { setError(e.message || "Couldn't accept that code"); }
    finally { setBusy(false); }
  }

  async function handleSaveProfile() {
    if (!couple) return;
    setBusy(true);
    try {
      await updateCoupleDetails(couple.id, draft);
      setEditing(false);
      await load();
    } finally { setBusy(false); }
  }

  function startEdit() {
    setDraft(couple?.details || {});
    setEditing(true);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ color: C.sub, textAlign: "center", padding: 40, fontSize: 14 }}>Loading…</div>;
  }

  // ── State 1: no couple → link up ─────────────────────────────────────────────
  if (!couple) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>💜</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginTop: 6 }}>Link up as a couple</div>
          <div style={{ fontSize: 14, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>
            Pair with your partner to build a fun couple profile and train together.
          </div>
        </div>

        <button onClick={handleCreate} disabled={busy}
          style={{ background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, border: "none", borderRadius: 16, padding: "16px 20px", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
          {busy ? "Creating…" : "💌 Create an invite code"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.sub, fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: C.border }} /> or <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.purpleLt, marginBottom: 8 }}>Got your partner's code?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={acceptCode} onChange={e => setAcceptCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ENTER CODE" style={{ ...iStyle, fontWeight: 800, letterSpacing: 3, fontFamily: "monospace" }} />
            <button onClick={handleAccept} disabled={acceptCode.trim().length < 4 || busy}
              style={{ background: acceptCode.trim().length < 4 || busy ? "#3A2D5C" : `linear-gradient(135deg, ${C.pink}, ${C.purple})`, border: "none", borderRadius: 10, padding: "0 18px", color: "#fff", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
              {busy ? "…" : "Link"}
            </button>
          </div>
        </div>

        {error && <div style={{ color: "#FCA5A5", fontSize: 13, textAlign: "center" }}>{error}</div>}
      </div>
    );
  }

  // ── State 2: pending → waiting for partner ───────────────────────────────────
  if (couple.status === "pending") {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18, textAlign: "center" }}>
        <div style={{ fontSize: 15, color: C.sub }}>Send this code to your partner. When they enter it, your couple profile unlocks.</div>
        <div style={{ background: C.card, border: `2px solid ${C.pink}`, borderRadius: 18, padding: "24px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: C.sub, textTransform: "uppercase", marginBottom: 8 }}>Couple code</div>
          <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 8, color: "#fff", fontFamily: "monospace" }}>{couple.invite_code}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { try { navigator.clipboard.writeText(couple.invite_code || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}
            style={{ flex: 1, background: "#1F1636", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "12px 0", color: C.text, fontWeight: 800, cursor: "pointer" }}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
          <button onClick={async () => {
            const msg = `Be my Livelee couple! 💜 Enter code ${couple.invite_code} in the Couples tab. https://liveleeapp.com`;
            try { if (navigator.share) await navigator.share({ title: "Livelee Couple Invite", text: msg }); else { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 1500); } } catch {}
          }}
            style={{ flex: 1, background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, border: "none", borderRadius: 12, padding: "12px 0", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
            📤 Share
          </button>
        </div>
        <div style={{ fontSize: 13, color: C.sub }}>⏳ Waiting for them to accept… updates automatically.</div>
        <button onClick={async () => { await cancelCoupleInvite(); await load(); }}
          style={{ background: "transparent", border: "none", color: "#FCA5A5", fontSize: 13, cursor: "pointer" }}>Cancel invite</button>
      </div>
    );
  }

  // ── State 3: active couple → the profile ─────────────────────────────────────
  const d = couple.details || {};
  const aName = firstName(couple.partnerA);
  const bName = firstName(couple.partnerB);
  const whoLabel = (v: "a" | "b" | undefined) => v === "a" ? aName : v === "b" ? bName : "—";

  // Fun fact rows for the read view
  const facts: { icon: string; label: string; value: string }[] = [];
  if (d.together_since) facts.push({ icon: "💞", label: "Together for", value: formatTogetherDuration(d.together_since) });
  if (d.who_asked_first) facts.push({ icon: "😏", label: "Shot their shot first", value: whoLabel(d.who_asked_first) });
  if (d.how_they_met) facts.push({ icon: "✨", label: "How they met", value: d.how_they_met });
  if (d.last_date_night) facts.push({ icon: "🌙", label: "Last date night", value: new Date(d.last_date_night).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) });
  if (d.favorite_activity) facts.push({ icon: "🤍", label: "Favorite thing to do together", value: d.favorite_activity });
  if (d.who_more_competitive) facts.push({ icon: "🔥", label: "More competitive", value: whoLabel(d.who_more_competitive) });
  if (d.who_gym_motivator) facts.push({ icon: "💪", label: "The gym motivator", value: whoLabel(d.who_gym_motivator) });
  if (d.anthem) facts.push({ icon: "🎵", label: "Their anthem", value: d.anthem });
  if (d.nicknames) facts.push({ icon: "🥰", label: "Nicknames", value: d.nicknames });

  function Avatar({ p }: { p: CouplePartner | null | undefined }) {
    return (
      <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", background: C.input, border: `2px solid ${C.pink}` }}>
        {p?.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Couple header */}
      <div style={{ background: `linear-gradient(135deg, rgba(236,72,153,0.14), rgba(124,58,237,0.10))`, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <Avatar p={couple.partnerA} />
          <span style={{ fontSize: 24 }}>💜</span>
          <Avatar p={couple.partnerB} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginTop: 12 }}>{aName} &amp; {bName}</div>
        {d.together_since && <div style={{ fontSize: 13, color: C.purpleLt, fontWeight: 700, marginTop: 2 }}>Together {formatTogetherDuration(d.together_since)}</div>}
      </div>

      {!editing ? (
        <>
          {facts.length === 0 ? (
            <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 16, padding: 20, textAlign: "center", color: C.sub, fontSize: 14, lineHeight: 1.5 }}>
              Your couple profile is empty. Tap “Edit our story” to fill in the fun stuff! 💕
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {facts.map((f, i) => (
                <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{f.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>{f.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2 }}>{f.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={startEdit}
            style={{ background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, border: "none", borderRadius: 14, padding: "13px 0", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            ✏️ Edit our story
          </button>
          <button onClick={async () => { if (typeof window !== "undefined" && window.confirm("Unlink from your partner? This clears your couple profile.")) { await unlinkCouple(couple.id); await load(); } }}
            style={{ background: "transparent", border: "none", color: "#FCA5A5", fontSize: 12, cursor: "pointer" }}>Unlink couple</button>
        </>
      ) : (
        // ── Edit form ──────────────────────────────────────────────────────────
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="💞 Together since">
            <input type="date" value={draft.together_since || ""} onChange={e => setDraft(d => ({ ...d, together_since: e.target.value }))} style={iStyle} />
          </Field>
          <Field label="😏 Who shot their shot first?">
            <WhoPicker value={draft.who_asked_first} aName={aName} bName={bName} onChange={v => setDraft(d => ({ ...d, who_asked_first: v }))} />
          </Field>
          <Field label="✨ How did you meet?">
            <input value={draft.how_they_met || ""} onChange={e => setDraft(d => ({ ...d, how_they_met: e.target.value.slice(0, 120) }))} placeholder="At the gym, of course…" style={iStyle} />
          </Field>
          <Field label="🌙 Last date night">
            <input type="date" value={draft.last_date_night || ""} onChange={e => setDraft(d => ({ ...d, last_date_night: e.target.value }))} style={iStyle} />
          </Field>
          <Field label="🤍 Favorite thing to do together">
            <input value={draft.favorite_activity || ""} onChange={e => setDraft(d => ({ ...d, favorite_activity: e.target.value.slice(0, 120) }))} placeholder="Sunday hikes" style={iStyle} />
          </Field>
          <Field label="🔥 Who's more competitive?">
            <WhoPicker value={draft.who_more_competitive} aName={aName} bName={bName} onChange={v => setDraft(d => ({ ...d, who_more_competitive: v }))} />
          </Field>
          <Field label="💪 Who's the gym motivator?">
            <WhoPicker value={draft.who_gym_motivator} aName={aName} bName={bName} onChange={v => setDraft(d => ({ ...d, who_gym_motivator: v }))} />
          </Field>
          <Field label="🎵 Your anthem">
            <input value={draft.anthem || ""} onChange={e => setDraft(d => ({ ...d, anthem: e.target.value.slice(0, 80) }))} placeholder="Song that's *yours*" style={iStyle} />
          </Field>
          <Field label="🥰 Nicknames for each other">
            <input value={draft.nicknames || ""} onChange={e => setDraft(d => ({ ...d, nicknames: e.target.value.slice(0, 80) }))} placeholder="Babe & Bae" style={iStyle} />
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, background: "transparent", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "12px 0", color: C.sub, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveProfile} disabled={busy} style={{ flex: 2, background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, border: "none", borderRadius: 12, padding: "12px 0", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{busy ? "Saving…" : "Save our story"}</button>
          </div>
        </div>
      )}

      {error && <div style={{ color: "#FCA5A5", fontSize: 13, textAlign: "center" }}>{error}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.sub, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function WhoPicker({ value, aName, bName, onChange }: { value: "a" | "b" | undefined; aName: string; bName: string; onChange: (v: "a" | "b") => void }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {(["a", "b"] as const).map(k => (
        <button key={k} onClick={() => onChange(k)}
          style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: value === k ? "none" : `1.5px solid ${C.border}`,
            background: value === k ? `linear-gradient(135deg, ${C.pink}, ${C.purple})` : "transparent",
            color: value === k ? "#fff" : C.sub, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          {k === "a" ? aName : bName}
        </button>
      ))}
    </div>
  );
}

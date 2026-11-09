"use client";
// "Invite to <group>" sheet: people you follow (or search anyone on
// Livelee) with Invite / Invited ✓ / Member, plus a share-link fallback
// for friends who aren't on the app yet. Server: group_invite_candidates
// + invite_to_group actions in app/api/db/route.ts.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ImagePresets } from "@/lib/imageUrls";

type Cand = { id: string; username?: string; full_name?: string; avatar_url?: string | null; status: "none" | "invited" | "member" };

async function api(action: string, payload: any) {
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  } catch {}
  const res = await fetch("/api/db", { method: "POST", headers, body: JSON.stringify({ action, payload }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.error) json.error = "Something went wrong — try again.";
  return json;
}

export default function GroupInviteSheet({ groupId, groupName, onClose, onShareLink }: {
  groupId: string; groupName: string; onClose: () => void; onShareLink: () => void;
}) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Cand[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current;
    const t = setTimeout(async () => {
      const r = await api("group_invite_candidates", { groupId, q });
      if (my !== seq.current) return;
      if (r.error) { setError(r.error); setList([]); return; }
      setError(null); setList(r.users || []);
    }, q.trim().length >= 2 ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, groupId]);

  async function invite(u: Cand) {
    setBusy(u.id);
    const r = await api("invite_to_group", { groupId, inviteeId: u.id });
    setBusy(null);
    if (r.error) { setError(r.error); return; }
    setList(l => (l || []).map(x => x.id === u.id ? { ...x, status: r.status === "member" ? "member" : "invited" } : x));
  }

  const searching = q.trim().length >= 2;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", background: "#0D0D0D", border: "1px solid #1B231E", borderRadius: "22px 22px 0 0", display: "flex", flexDirection: "column", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #1B231E" }}>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer" }}>✕</button>
          <b style={{ fontSize: 16, color: "#F0F0F0", textAlign: "center", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 8px" }}>Invite to {groupName}</b>
          <span style={{ width: 20 }} />
        </div>
        <div style={{ padding: "14px 18px 0" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search people on Livelee"
            style={{ width: "100%", boxSizing: "border-box", background: "#111", border: "1.5px solid #1B231E", borderRadius: 10, padding: "11px 12px", fontWeight: 700, fontSize: 14, color: "#F0F0F0", outline: "none" }} />
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: "#9CA3AF", textTransform: "uppercase", margin: "14px 0 8px" }}>{searching ? "Results" : "People you follow"}</div>
          {error && <div style={{ color: "#FCA5A5", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{error}</div>}
        </div>
        <div style={{ overflowY: "auto", padding: "0 18px", flex: 1 }}>
          {list === null ? (
            <div style={{ color: "#9CA3AF", fontSize: 13, padding: "12px 0" }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 13, padding: "12px 0" }}>{searching ? "No one found." : "You're not following anyone yet. Search by name above."}</div>
          ) : list.map(u => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1B231E" }}>
              {u.avatar_url
                ? <img src={ImagePresets.avatarSm(u.avatar_url)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#2E5E45", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#fff", flexShrink: 0 }}>{(u.full_name || u.username || "?").charAt(0).toUpperCase()}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "#F0F0F0", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name || u.username}</div>
                {u.username && <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 700 }}>@{u.username}</div>}
              </div>
              {u.status === "member" ? (
                <span style={{ fontSize: 13, fontWeight: 800, color: "#9CA3AF", padding: "7px 12px" }}>Member</span>
              ) : u.status === "invited" ? (
                <span style={{ fontSize: 13, fontWeight: 800, color: "#4A9D6E", padding: "7px 12px" }}>Invited ✓</span>
              ) : (
                <button onClick={() => invite(u)} disabled={busy === u.id}
                  style={{ fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 999, border: "1.5px solid #4A9D6E", background: "#1F5F3F", color: "#fff", cursor: "pointer", opacity: busy === u.id ? 0.6 : 1 }}>
                  {busy === u.id ? "…" : "Invite"}
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ background: "#111811", border: "1.5px solid #1B231E", borderRadius: 16, padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>🔗</span>
            <div style={{ flex: 1 }}><b style={{ fontSize: 14, color: "#F0F0F0" }}>Not on Livelee yet?</b><div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 700 }}>Send them the group link</div></div>
            <button onClick={onShareLink} style={{ fontSize: 13, fontWeight: 800, padding: "8px 12px", borderRadius: 999, border: "1.5px solid #1B231E", background: "#111", color: "#F0F0F0", cursor: "pointer" }}>Share link</button>
          </div>
        </div>
      </div>
    </div>
  );
}

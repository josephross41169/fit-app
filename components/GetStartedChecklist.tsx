"use client";
// ─── components/GetStartedChecklist.tsx ─────────────────────────────────────
// Owner-only "Get started" card pinned to the top of the Home (profile) page.
// It is DATA-DRIVEN: instead of wiring a manual check-off into every page, it
// asks the database whether each setup step is actually done (has a goal? a
// connected device? following 3+ people? in a group? profile filled in?). The
// moment the user does the thing on its own page, the row checks itself on the
// next load of Home. When every row is complete the card disappears for good;
// the user can also dismiss it early (stored per-device in localStorage).
//
// Clicking a row hands the action back to the parent via onAction(key) so the
// parent can open the right modal in place (profile edit, goal creation) or
// route to the right page (post / discover / connect / settings).
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const PURPLE = "#7C3AED";
const DISMISS_KEY = "ll_getstarted_dismissed";

interface Item { key: string; label: string; sub: string; done: boolean; }

export default function GetStartedChecklist({
  userId,
  onAction,
}: {
  userId: string;
  onAction: (key: string) => void;
}) {
  const [data, setData] = useState<null | {
    goals: number; devices: number; workouts: number; following: number; groups: number;
    avatar: boolean; banner: boolean; bio: boolean;
  }>(null);
  const [dismissed, setDismissed] = useState(false);
  // Collapsed by default — the full 6-row list was eating the whole Home
  // screen. We show just the header + the first incomplete step, with a
  // "Show all" toggle to reveal the rest.
  const [expanded, setExpanded] = useState(false);

  // Per-device dismiss flag.
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "true") {
        setDismissed(true);
      }
    } catch { /* localStorage unavailable — just show the card */ }
  }, []);

  // One batched read for all the signals. Counts use head+exact so no rows are
  // transferred; the profile row is a single tiny select. Any failure falls
  // back to zeros (card still renders, nothing is incorrectly checked).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [g, d, w, f, gr, prof] = await Promise.all([
          supabase.from("goals").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("connected_devices").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("activity_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("log_type", "workout"),
          supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
          supabase.from("group_members").select("group_id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("users").select("avatar_url,banner_url,bio").eq("id", userId).maybeSingle(),
        ]);
        if (cancelled) return;
        const p: any = prof.data || {};
        setData({
          goals: g.count || 0,
          devices: d.count || 0,
          workouts: w.count || 0,
          following: f.count || 0,
          groups: gr.count || 0,
          avatar: !!p.avatar_url,
          banner: !!p.banner_url,
          bio: !!String(p.bio || "").trim(),
        });
      } catch {
        if (!cancelled) {
          setData({ goals: 0, devices: 0, workouts: 0, following: 0, groups: 0, avatar: false, banner: false, bio: false });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (dismissed || !data) return null;

  const items: Item[] = [
    { key: "profile", label: "Complete your profile", sub: "Add a photo, banner & bio", done: data.avatar && data.banner && data.bio },
    { key: "goal", label: "Set your first goal", sub: "Track it live on your Home", done: data.goals > 0 },
    { key: "device", label: "Connect Apple Health or Fitbit", sub: "Auto-import your activity", done: data.devices > 0 },
    { key: "workout", label: "Log your first workout", sub: "Share what you trained", done: data.workouts > 0 },
    { key: "follow", label: "Follow 3 athletes", sub: `${Math.min(data.following, 3)} of 3 followed`, done: data.following >= 3 },
    { key: "group", label: "Join or create a group", sub: "Find your community", done: data.groups > 0 },
  ];
  const doneCount = items.filter(i => i.done).length;

  // All set → the card is gone for good (completion lives in the data, so it
  // stays gone across devices without needing a stored flag).
  if (doneCount >= items.length) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "true"); } catch { /* no-op */ }
    setDismissed(true);
  };
  const pct = Math.round((doneCount / items.length) * 100);

  // When collapsed: show only the first incomplete step (the user's clear
  // "next action"). When expanded: show every row.
  const firstUndone = items.find(i => !i.done);
  const visibleItems = expanded ? items : (firstUndone ? [firstUndone] : []);
  const remaining = items.length - doneCount;

  return (
    <div style={{
      background: "linear-gradient(135deg,#1B1430,#140E26)",
      border: "1px solid #2D1F52", borderRadius: 18, padding: 18,
      marginBottom: 24, position: "relative",
    }}>
      <button onClick={dismiss} aria-label="Dismiss" title="Hide this" style={{
        position: "absolute", top: 10, right: 12, background: "none", border: "none",
        color: "#6B7280", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4,
      }}>×</button>

      {/* Header is now a toggle — tap anywhere on it to expand/collapse. */}
      <button onClick={() => setExpanded(v => !v)} style={{
        display: "block", width: "100%", textAlign: "left", background: "none",
        border: "none", padding: 0, cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, paddingRight: 24 }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <span style={{ fontSize: 17, fontWeight: 900, color: "#F0F0F0" }}>Get started with Livelee</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 12 }}>
          {doneCount} of {items.length} done{!expanded && remaining > 0 ? ` — ${remaining} step${remaining === 1 ? "" : "s"} left, tap to see all` : " — finish setting up to get the most out of the app."}
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "#2A2140", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${PURPLE},#A78BFA)`, transition: "width 0.4s" }} />
        </div>
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visibleItems.map(it => (
          <button
            key={it.key}
            onClick={() => { if (!it.done) onAction(it.key); }}
            disabled={it.done}
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
              padding: "11px 12px", borderRadius: 12,
              background: it.done ? "rgba(74,222,128,0.07)" : "rgba(124,58,237,0.10)",
              border: `1px solid ${it.done ? "rgba(74,222,128,0.25)" : "rgba(124,58,237,0.25)"}`,
              cursor: it.done ? "default" : "pointer", opacity: it.done ? 0.75 : 1,
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: it.done ? "#4ADE80" : "transparent",
              border: it.done ? "none" : "2px solid #4B3F66",
            }}>
              {it.done && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: it.done ? "#9CA3AF" : "#F0F0F0", textDecoration: it.done ? "line-through" : "none" }}>{it.label}</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{it.sub}</div>
            </div>
            {!it.done && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Show all / Show less — only when there's more than one step to show. */}
      {items.length > 1 && (
        <button onClick={() => setExpanded(v => !v)} style={{
          width: "100%", marginTop: 10, background: "none", border: "none",
          color: "#A78BFA", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 6,
        }}>
          {expanded ? "Show less" : `Show all ${items.length} steps`}
        </button>
      )}
    </div>
  );
}

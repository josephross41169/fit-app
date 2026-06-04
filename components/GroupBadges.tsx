"use client";

// ─── components/GroupBadges.tsx ────────────────────────────────────────────
// Group Badges section for a group page. Renders the group's collective,
// tiered cardio badges (Run / Walk / Bike / Swim / Row — miles/yards/meters +
// minutes), colored by tier using the same metal palette as individual
// badges. Tapping a badge lazy-loads a most→least ranked contributor list
// (so the page stays fast — contributor data is never fetched up front).
// The group owner gets a "Manage" toggle to hide/show specific badges.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  GROUP_BADGES,
  fetchGroupBadgeTotals,
  fetchBadgeContributors,
  tierStyle,
  progressInfo,
  formatBadgeValue,
  type GroupBadgeTotal,
  type BadgeContributor,
} from "@/lib/groupBadges";

const C = {
  card: "#111827",
  border: "#1F2937",
  text: "#F9FAFB",
  sub: "#9CA3AF",
  purple: "#7C3AED",
};

export default function GroupBadges({
  groupId,
  isOwner,
  hiddenBadges,
  onHiddenChange,
}: {
  groupId: string;
  isOwner: boolean;
  hiddenBadges: string[];
  onHiddenChange?: (next: string[]) => void;
}) {
  const [totals, setTotals] = useState<GroupBadgeTotal[] | null>(null);
  const [openMetric, setOpenMetric] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [hidden, setHidden] = useState<string[]>(hiddenBadges || []);

  useEffect(() => { setHidden(hiddenBadges || []); }, [hiddenBadges]);

  // Load totals (one lightweight query) on mount.
  useEffect(() => {
    let alive = true;
    fetchGroupBadgeTotals(groupId).then(t => { if (alive) setTotals(t); });
    return () => { alive = false; };
  }, [groupId]);

  // Persist a hide/show change (owner only).
  const toggleHidden = useCallback(async (metric: string) => {
    const next = hidden.includes(metric) ? hidden.filter(m => m !== metric) : [...hidden, metric];
    setHidden(next);
    onHiddenChange?.(next);
    try {
      await (supabase as any).from("groups").update({ hidden_group_badges: next }).eq("id", groupId);
    } catch { /* best-effort; UI already updated */ }
  }, [hidden, groupId, onHiddenChange]);

  // Visible badges = catalog minus hidden (owner in manage mode sees all).
  const visible = (totals || GROUP_BADGES.map(d => ({ metric: d.metric, def: d, total: 0, tier: 0 })))
    .filter(t => manage || !hidden.includes(t.metric));

  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 18, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>🏅 Group Badges</div>
        {isOwner && (
          <button
            onClick={() => setManage(m => !m)}
            style={{ background: manage ? C.purple : "transparent", color: manage ? "#fff" : C.sub, border: `1px solid ${manage ? C.purple : C.border}`, borderRadius: 999, padding: "5px 13px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
          >
            {manage ? "Done" : "Manage"}
          </button>
        )}
      </div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>
        {manage
          ? "Tap a badge to show or hide it for your group."
          : "Earned together by everyone in the group, from the day each member joined."}
      </div>

      {totals === null ? (
        <div style={{ color: C.sub, fontSize: 13, padding: "16px 0", textAlign: "center" }}>Loading badges…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {visible.map(t => {
            const isHidden = hidden.includes(t.metric);
            const style = tierStyle(t.tier);
            const { nextThreshold, pct } = progressInfo(t.def, t.total);
            return (
              <div
                key={t.metric}
                onClick={() => {
                  if (manage) { toggleHidden(t.metric); return; }
                  setOpenMetric(openMetric === t.metric ? null : t.metric);
                }}
                style={{
                  position: "relative",
                  background: t.tier > 0 && style ? style.gradient : "#0D1320",
                  border: `1.5px solid ${t.tier > 0 ? (style?.border || t.def.accent) : C.border}`,
                  borderRadius: 14,
                  padding: "12px 13px",
                  cursor: "pointer",
                  opacity: manage && isHidden ? 0.4 : 1,
                  overflow: "hidden",
                }}
              >
                {/* sport accent glow */}
                <div aria-hidden style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: t.def.accent, opacity: t.tier > 0 ? 0.22 : 0.1, filter: "blur(14px)" }} />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 26 }}>{t.def.emoji}</span>
                    {t.tier > 0 && style && (
                      <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", color: style.border || "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
                        {style.name}
                      </span>
                    )}
                    {t.tier === 0 && (
                      <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", color: C.sub }}>LOCKED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.text, marginTop: 8, lineHeight: 1.2 }}>
                    {t.def.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginTop: 2, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                    {formatBadgeValue(t.def, t.total)} <span style={{ fontSize: 11, fontWeight: 700, color: C.sub }}>{t.def.unit}</span>
                  </div>
                  {/* progress to next tier */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 5, borderRadius: 3, background: "rgba(0,0,0,0.4)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.round(pct * 100)}%`, background: t.def.accent, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 9, color: C.sub, marginTop: 4, fontWeight: 700 }}>
                      {nextThreshold === null
                        ? "MAX TIER"
                        : `${formatBadgeValue(t.def, nextThreshold)} ${t.def.unit} for next tier`}
                    </div>
                  </div>
                  {manage && (
                    <div style={{ fontSize: 10, fontWeight: 800, color: isHidden ? "#F87171" : "#4ADE80", marginTop: 6 }}>
                      {isHidden ? "Hidden — tap to show" : "Shown — tap to hide"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lazy contributor list — only mounts (and fetches) when a badge is open */}
      {openMetric && !manage && (
        <ContributorList groupId={groupId} metric={openMetric} onClose={() => setOpenMetric(null)} />
      )}
    </div>
  );
}

// ── Ranked contributor list (lazy) ──────────────────────────────────────────
function ContributorList({ groupId, metric, onClose }: { groupId: string; metric: string; onClose: () => void }) {
  const def = GROUP_BADGES.find(b => b.metric === metric)!;
  const [rows, setRows] = useState<BadgeContributor[] | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    fetchBadgeContributors(groupId, metric).then(r => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, [groupId, metric]);

  return (
    <div style={{ marginTop: 14, background: "#0D1320", border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: C.text }}>
          {def.emoji} {def.label} · who contributed
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.sub, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>
      {rows === null ? (
        <div style={{ color: C.sub, fontSize: 13, padding: "10px 0", textAlign: "center" }}>Loading contributors…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: C.sub, fontSize: 13, padding: "10px 0", textAlign: "center" }}>No contributions yet — log some {def.label.replace("Total ", "").toLowerCase()} to get on the board.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => (
            <div key={r.userId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 22, textAlign: "center", fontSize: 13, fontWeight: 900, color: i === 0 ? "#FBBF24" : i === 1 ? "#D1D5DB" : i === 2 ? "#D97706" : C.sub }}>
                {i + 1}
              </span>
              {r.avatarUrl
                ? <img src={r.avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#1F2937", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: C.sub, flexShrink: 0 }}>{r.name.slice(0, 2).toUpperCase()}</span>}
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.name}
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: def.accent, whiteSpace: "nowrap" }}>
                {formatBadgeValue(def, r.value)} <span style={{ fontSize: 10, color: C.sub, fontWeight: 700 }}>{def.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

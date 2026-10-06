"use client";
// The 4 badges shown on the profile's Badges box, plus the tap-to-open
// badge detail sheet (when you earned it, totals, tier history, pinning).
import type { CSSProperties, MouseEvent } from "react";
import { TIER_STYLES, type DisplayBadge } from "@/lib/badgeFamilies";

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

function ringColor(b: DisplayBadge): string {
  if (b.renderType === "progression") return TIER_STYLES[b.tier ?? 1]?.border ?? "#5BBE93";
  if (b.renderType === "yearly") return "#F472B6";
  return "#A78BFA";
}

/** Badge art (or emoji) at a given size. Art is already a finished round badge. */
export function BadgeArt({ b, size }: { b: DisplayBadge; size: number }) {
  if (b.image) {
    return <img src={b.image} alt="" draggable={false}
      style={{ width: size, height: size, objectFit: "contain", display: "block", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.55))" }} />;
  }
  const ring = ringColor(b);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.48), background: "radial-gradient(circle at 35% 30%, #22302A, #0E1311)",
      border: `${Math.max(2, Math.round(size / 28))}px solid ${ring}`, boxShadow: `0 0 ${Math.round(size / 6)}px ${ring}55`,
    }}>{b.emoji}</div>
  );
}

/** Up to 4 badges for the profile Badges box. Pinned badges come first
 *  (groupBadgesIntoFamilies already sorts them to the front). */
export function BadgeShowcase({ badges, compact, onSelect }: {
  badges: DisplayBadge[]; compact: boolean; onSelect: (b: DisplayBadge) => void;
}) {
  const four = badges.slice(0, 4);
  return (
    <div style={{
      flex: 1, minHeight: 0, width: "100%", display: "grid",
      gridTemplateColumns: compact ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
      gridAutoRows: "1fr", gap: compact ? 6 : 12, alignItems: "stretch",
    }}>
      {four.map(b => (
        // The cell is a size container so the art can be as big as possible
        // while leaving room for the title box underneath; art + title are
        // centered together as one group.
        <div key={b.key} role="button" tabIndex={0}
          onClick={(e: MouseEvent) => { e.stopPropagation(); onSelect(b); }}
          style={{ minWidth: 0, minHeight: 0, height: "100%", containerType: "size", cursor: "pointer" } as CSSProperties}>
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: compact ? 0 : 10 }}>
            <div style={{
              width: compact ? "min(100cqw, 100cqh)" : "min(100cqw, calc(100cqh - 46px))",
              height: compact ? "min(100cqw, 100cqh)" : "min(100cqw, calc(100cqh - 46px))",
              flexShrink: 0,
            } as CSSProperties}>
              <BadgeArtFill b={b} />
            </div>
            {!compact && (
              <div style={{
                width: "100%", boxSizing: "border-box", padding: "7px 8px", borderRadius: 10,
                background: "linear-gradient(180deg, #1E2B24, #16201B)", border: `1.5px solid ${ringColor(b)}66`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                fontSize: 14, fontWeight: 900, color: "#F0F7F3", textAlign: "center", lineHeight: 1.2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {b.label}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** BadgeArt that fills its (square) parent. */
function BadgeArtFill({ b }: { b: DisplayBadge }) {
  if (b.image) {
    return <img src={b.image} alt="" draggable={false}
      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.55))" }} />;
  }
  const ring = ringColor(b);
  return (
    <div style={{
      width: "100%", height: "100%", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "48cqmin", background: "radial-gradient(circle at 35% 30%, #22302A, #0E1311)",
      border: `3px solid ${ring}`, boxShadow: `0 0 14px ${ring}55`, containerType: "size",
    } as CSSProperties}>
      <span style={{ fontSize: "min(46cqw, 46cqh)", lineHeight: 1 } as CSSProperties}>{b.emoji}</span>
    </div>
  );
}

/** Detail sheet for one badge. */
export function BadgeDetailSheet({ badge: b, isOwn, ownerName, pinnedIds, onPin, onClose }: {
  badge: DisplayBadge;
  isOwn: boolean;
  ownerName?: string | null;
  /** badge row ids currently pinned, by slot (1-4). */
  pinnedIds: Record<number, string | undefined>;
  onPin: (slot: number | null) => void;
  onClose: () => void;
}) {
  const who = isOwn ? "You" : (ownerName || "They");
  const tierStyle = b.renderType === "progression" ? TIER_STYLES[b.tier ?? 1] : null;
  const isLbs = (b.progressLabel || "").includes("lbs");
  const first = fmtDate(b.earnedAt);
  const earnedTiers = (b.history || []).filter(h => h.earned).length;
  const nextTier = (b.history || []).find(h => !h.earned);
  // Live counters can lag behind earned badge rows — only trust the count
  // when it's at least the threshold of the highest tier already earned.
  const topEarned = [...(b.history || [])].reverse().find(h => h.earned);
  const counterOk = b.currentValue !== undefined && (topEarned?.threshold === undefined || b.currentValue >= topEarned.threshold);
  const unit = (n: number, label?: string) => {
    const l = label || "";
    return n === 1 && l.endsWith("s") && !l.includes("lbs") ? l.slice(0, -1) : l;
  };

  const stat = (label: string, value: string, accent = "#86CFAE") => (
    <div style={{ flex: 1, minWidth: 0, background: "#141C18", border: "1px solid #243329", borderRadius: 14, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#8FA39A", letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: accent, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0E1311", border: "1px solid #2A3A2A", borderRadius: 24, width: "100%", maxWidth: 420,
        maxHeight: "calc(100vh - 32px - var(--safe-top, 0px) - var(--safe-bottom, 0px))", overflowY: "auto", padding: "22px 20px 18px", position: "relative",
      }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 99, border: "none", background: "#1B231E", color: "#C9D6CF", fontSize: 16, cursor: "pointer" }}>✕</button>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><BadgeArt b={b} size={168} /></div>
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 21, color: "#F0F0F0" }}>{b.label}</div>
        {tierStyle && (b.maxTier ?? 1) > 1 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.8, color: "#0E1311", background: tierStyle.border, borderRadius: 99, padding: "3px 10px" }}>
              {tierStyle.name} · TIER {b.tier} OF {b.maxTier}
            </span>
          </div>
        )}
        {b.desc && <div style={{ textAlign: "center", fontSize: 13, color: "#9CB1A6", marginTop: 8, lineHeight: 1.45 }}>{b.desc}</div>}

        {/* Key facts */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {b.renderType === "progression" && (b.history?.length ?? 0) > 1 ? (<>
            {counterOk
              ? stat(isLbs ? "Best" : "Total", `${b.currentValue!.toLocaleString()} ${unit(b.currentValue!, b.progressLabel)}`)
              : stat("Tiers", `${earnedTiers} of ${b.history!.length}`)}
            {stat(first ? "First earned" : "Tiers", first || `${earnedTiers} of ${b.history!.length}`, "#E5F2EA")}
          </>) : b.renderType === "yearly" ? (<>
            {stat("Year", String(b.year ?? "—"))}
            {stat("Earned", first || "—", "#E5F2EA")}
          </>) : (
            stat("Earned", first || "Earned", "#E5F2EA")
          )}
        </div>

        {/* Progress to next tier */}
        {b.renderType === "progression" && (b.history?.length ?? 0) > 1 && (
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: b.isMaxed || !nextTier ? "#FACC15" : "#C9D6CF", textAlign: "center" }}>
            {b.isMaxed || !nextTier ? "🏆 Top tier reached"
              : nextTier.threshold !== undefined && (isLbs || !counterOk)
                ? `Next: ${nextTier.label} at ${nextTier.threshold.toLocaleString()} ${unit(nextTier.threshold, b.progressLabel)}`
                : counterOk && nextTier.threshold !== undefined
                  ? `${Math.max(0, nextTier.threshold - b.currentValue!).toLocaleString()} more ${unit(Math.max(0, nextTier.threshold - b.currentValue!), b.progressLabel)} to ${nextTier.label}`
                  : `Next: ${nextTier.label}`}
          </div>
        )}

        {/* Tier history */}
        {b.history && b.history.length > 1 && (
          <div style={{ marginTop: 14, background: "#141C18", border: "1px solid #243329", borderRadius: 16, overflow: "hidden" }}>
            {b.history.map((h, i) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: i ? "1px solid #1E2A23" : "none", opacity: h.earned ? 1 : 0.5 }}>
                <span style={{ width: 20, textAlign: "center", fontSize: 13, color: h.earned ? "#5BBE93" : "#5C6F65" }}>{h.earned ? "✓" : "○"}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, color: "#E5F2EA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.label}</span>
                {h.threshold !== undefined && <span style={{ fontSize: 11, color: "#8FA39A", fontWeight: 700 }}>{h.threshold.toLocaleString()} {unit(h.threshold, b.progressLabel)}</span>}
                <span style={{ fontSize: 11, color: "#8FA39A", width: 84, textAlign: "right" }}>{h.earned ? (fmtDate(h.earnedAt) || "Earned") : ""}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pin to profile */}
        {isOwn && b.badge_row_id && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#C9D6CF", marginBottom: 8 }}>📌 Show on your profile <span style={{ color: "#8FA39A", fontWeight: 600 }}>· 4 spots</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[1, 2, 3, 4].map(slot => {
                const current = b.pin_slot === slot;
                const taken = !current && !!pinnedIds[slot];
                return (
                  <button key={slot} onClick={() => onPin(current ? null : slot)}
                    style={{ padding: "10px 0", borderRadius: 12, border: `1.5px solid ${current ? "#5BBE93" : "#2A3A2A"}`, background: current ? "#5BBE93" : "#161D19", color: current ? "#0E1311" : "#E5F2EA", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>
                    {slot}
                    <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2, color: current ? "#0E1311" : "#8FA39A" }}>{current ? "Here" : taken ? "Swap" : "Empty"}</div>
                  </button>
                );
              })}
            </div>
            {b.pin_slot != null && (
              <button onClick={() => onPin(null)} style={{ width: "100%", marginTop: 8, padding: "9px 0", borderRadius: 12, border: "1.5px solid #2A3A2A", background: "transparent", color: "#F87171", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Remove from profile</button>
            )}
          </div>
        )}
        {!isOwn && <div style={{ marginTop: 14, textAlign: "center", fontSize: 11, color: "#5C6F65" }}>{who} earned this on Livelee</div>}
      </div>
    </div>
  );
}

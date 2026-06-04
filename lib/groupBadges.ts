// lib/groupBadges.ts
// ─────────────────────────────────────────────────────────────────────────────
// Group badges — collective, tiered badges a group earns from its members'
// combined cardio. Each member's contribution for a metric accumulates from
// the moment they JOINED the group forward (never pre-join activity), stored
// in group_badge_contributions. The group's total for a metric is the SUM of
// its members' rows; the tier is the highest milestone that total has crossed.
//
// Units match how the post page stores each cardio type:
//   running / walking / biking → MILES        (cardio entry .miles / .distance)
//   swimming                   → YARDS         (.distance, unit yards)
//   rowing                     → METERS        (.distance, unit meters)
// Every type also has a MINUTES badge (cardio entry .duration).
//
// Performance: badge TOTALS load with one lightweight query per group
// (sum of contributions). The ranked CONTRIBUTOR list for a single badge is
// loaded only when the user taps that badge — see fetchBadgeContributors.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import { TIER_STYLES, type BadgeTier } from "./badgeFamilies";

export type GroupBadgeMetric =
  | "miles_run"     | "minutes_run"
  | "miles_walked"  | "minutes_walked"
  | "miles_biked"   | "minutes_biked"
  | "yards_swum"    | "minutes_swum"
  | "meters_rowed"  | "minutes_rowed";

export interface GroupBadgeDef {
  metric: GroupBadgeMetric;
  /** Card title, e.g. "Total Miles Run". */
  label: string;
  /** Short noun for the contributor list, e.g. "miles", "min", "m". */
  unit: string;
  /** Emoji shown on the badge. */
  emoji: string;
  /** Which cardio category in activity_logs this reads. */
  category: "running" | "walking" | "biking" | "swimming" | "rowing";
  /** "miles" | "yards" | "meters" reads cardio .miles/.distance; "minutes"
   *  reads cardio .duration. */
  kind: "distance" | "minutes";
  /** Accent color (cardio = red family, matching individual badge categories,
   *  but tinted per sport so each badge is distinguishable). */
  accent: string;
  /** 8 ascending milestones, lowest → highest. Tier N = thresholds[N-1]. */
  thresholds: [number, number, number, number, number, number, number, number];
}

// ── The catalog ──────────────────────────────────────────────────────────────
// Milestones below are sensible defaults — tweak freely. miles_run uses the
// exact sequence requested; the rest are scaled to each activity's nature
// (cycling covers far more distance; swimming/rowing far less; minutes scale
// roughly with how the distances accumulate).
export const GROUP_BADGES: GroupBadgeDef[] = [
  { metric: "miles_run",     label: "Total Miles Run",     unit: "mi",  emoji: "🏃", category: "running",  kind: "distance", accent: "#EF4444",
    thresholds: [500, 1000, 2000, 3000, 5000, 8000, 14000, 20000] },
  { metric: "minutes_run",   label: "Total Minutes Run",   unit: "min", emoji: "⏱️", category: "running",  kind: "minutes",  accent: "#F87171",
    thresholds: [5000, 10000, 20000, 35000, 60000, 100000, 175000, 250000] },

  { metric: "miles_walked",  label: "Total Miles Walked",  unit: "mi",  emoji: "🚶", category: "walking",  kind: "distance", accent: "#22C55E",
    thresholds: [500, 1000, 2000, 4000, 7000, 12000, 18000, 25000] },
  { metric: "minutes_walked",label: "Total Minutes Walked",unit: "min", emoji: "⏱️", category: "walking",  kind: "minutes",  accent: "#4ADE80",
    thresholds: [5000, 12000, 25000, 45000, 80000, 130000, 200000, 300000] },

  { metric: "miles_biked",   label: "Total Miles Biked",   unit: "mi",  emoji: "🚴", category: "biking",   kind: "distance", accent: "#3B82F6",
    thresholds: [1000, 2500, 5000, 10000, 20000, 35000, 60000, 100000] },
  { metric: "minutes_biked", label: "Total Minutes Biked", unit: "min", emoji: "⏱️", category: "biking",   kind: "minutes",  accent: "#60A5FA",
    thresholds: [5000, 12000, 25000, 45000, 80000, 130000, 200000, 300000] },

  { metric: "yards_swum",    label: "Total Yards Swum",    unit: "yd",  emoji: "🏊", category: "swimming", kind: "distance", accent: "#06B6D4",
    thresholds: [10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000] },
  { metric: "minutes_swum",  label: "Total Minutes Swum",  unit: "min", emoji: "⏱️", category: "swimming", kind: "minutes",  accent: "#22D3EE",
    thresholds: [2000, 5000, 10000, 20000, 40000, 70000, 120000, 200000] },

  { metric: "meters_rowed",  label: "Total Meters Rowed",  unit: "m",   emoji: "🚣", category: "rowing",   kind: "distance", accent: "#A855F7",
    thresholds: [50000, 150000, 350000, 750000, 1500000, 3000000, 6000000, 10000000] },
  { metric: "minutes_rowed", label: "Total Minutes Rowed", unit: "min", emoji: "⏱️", category: "rowing",   kind: "minutes",  accent: "#C084FC",
    thresholds: [2000, 5000, 10000, 20000, 40000, 70000, 120000, 200000] },
];

export function getBadgeDef(metric: string): GroupBadgeDef | undefined {
  return GROUP_BADGES.find(b => b.metric === metric);
}

// ── Tier helpers ──────────────────────────────────────────────────────────
/** Highest tier (1..8) whose threshold `total` has reached, or 0 if none. */
export function tierForTotal(def: GroupBadgeDef, total: number): number {
  let t = 0;
  for (let i = 0; i < def.thresholds.length; i++) {
    if (total >= def.thresholds[i]) t = i + 1;
  }
  return t;
}

/** Tier style (name + colors) for a 1..8 tier, reusing the individual-badge
 *  metal palette so group badges look consistent. Returns null for tier 0. */
export function tierStyle(tier: number): (typeof TIER_STYLES)[BadgeTier] | null {
  if (tier < 1 || tier > 8) return null;
  return TIER_STYLES[tier as BadgeTier];
}

/** Progress info toward the next tier (for a progress bar / "x to GOLD"). */
export function progressInfo(def: GroupBadgeDef, total: number) {
  const tier = tierForTotal(def, total);
  const nextThreshold = tier < 8 ? def.thresholds[tier] : null;
  const prevThreshold = tier > 0 ? def.thresholds[tier - 1] : 0;
  const pct = nextThreshold === null
    ? 1
    : Math.min(1, Math.max(0, (total - prevThreshold) / (nextThreshold - prevThreshold)));
  return { tier, nextThreshold, prevThreshold, pct };
}

// ── Contribution computation ────────────────────────────────────────────────
/** Compute one member's value for a metric from `fromIso` (their join time)
 *  to now, by reading their cardio activity_logs. Distance badges sum the
 *  cardio entries' miles/distance; minute badges sum durations. */
export async function computeBadgeContribution(
  userId: string,
  def: GroupBadgeDef,
  fromIso: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("cardio")
      .eq("user_id", userId)
      .eq("log_type", "workout")
      .eq("workout_category", def.category)
      .gte("logged_at", fromIso);
    if (error || !data) return 0;
    let total = 0;
    for (const row of data as any[]) {
      const arr = Array.isArray(row.cardio) ? row.cardio : [];
      for (const c of arr) {
        if (def.kind === "minutes") {
          total += parseDur(c?.duration);
        } else {
          // distance: prefer numeric .miles (running/walking/biking store it),
          // else parse .distance (swimming yards / rowing meters store the raw
          // value there).
          const v = typeof c?.miles === "number" ? c.miles : parseFloat(c?.distance) || 0;
          total += v;
        }
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/** Parse a duration value ("30", 30, "M:SS") to minutes. */
function parseDur(d: any): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === "number") return Math.max(0, d);
  const s = String(d).trim();
  if (!s) return 0;
  if (s.includes(":")) {
    const p = s.split(":").map(Number);
    if (p.length === 2) return (p[0] || 0) + (p[1] || 0) / 60;
    if (p.length === 3) return (p[0] || 0) * 60 + (p[1] || 0) + (p[2] || 0) / 60;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.max(0, n);
}

// ── Sync (called after a log is saved on the post page) ───────────────────────
/** For every group the user belongs to, recompute their contribution to each
 *  badge metric (from their join date) and upsert it. Fire-and-forget; failures
 *  are swallowed so a sync hiccup never blocks logging. */
export async function syncGroupBadgesForUser(userId: string): Promise<void> {
  try {
    const { data: memberships, error } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId);
    if (error || !memberships || memberships.length === 0) return;

    const rows: { group_id: string; user_id: string; metric: string; value: number; updated_at: string }[] = [];
    const nowIso = new Date().toISOString();

    for (const m of memberships as any[]) {
      const from = m.joined_at || "1970-01-01T00:00:00Z";
      // Compute all metrics for this group. (10 metrics, but each is a small
      // indexed query; runs in the background after save.)
      for (const def of GROUP_BADGES) {
        const value = await computeBadgeContribution(userId, def, from);
        if (value > 0) {
          rows.push({ group_id: m.group_id, user_id: userId, metric: def.metric, value, updated_at: nowIso });
        }
      }
    }
    if (rows.length > 0) {
      await (supabase as any)
        .from("group_badge_contributions")
        .upsert(rows, { onConflict: "group_id,user_id,metric" });
    }
  } catch {
    /* best-effort */
  }
}

// ── Reads for the group page ──────────────────────────────────────────────
export interface GroupBadgeTotal {
  metric: GroupBadgeMetric;
  def: GroupBadgeDef;
  total: number;
  tier: number;
}

/** One lightweight query → per-metric totals + tiers for the whole group.
 *  Used to render the badges section. Does NOT load contributor lists. */
export async function fetchGroupBadgeTotals(groupId: string): Promise<GroupBadgeTotal[]> {
  try {
    const { data, error } = await supabase
      .from("group_badge_contributions")
      .select("metric, value")
      .eq("group_id", groupId);
    if (error || !data) return GROUP_BADGES.map(def => ({ metric: def.metric, def, total: 0, tier: 0 }));
    const sums: Record<string, number> = {};
    for (const r of data as any[]) {
      sums[r.metric] = (sums[r.metric] || 0) + (Number(r.value) || 0);
    }
    return GROUP_BADGES.map(def => {
      const total = sums[def.metric] || 0;
      return { metric: def.metric, def, total, tier: tierForTotal(def, total) };
    });
  } catch {
    return GROUP_BADGES.map(def => ({ metric: def.metric, def, total: 0, tier: 0 }));
  }
}

export interface BadgeContributor {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  value: number;
}

/** Ranked (most → least) list of contributors to ONE badge. Loaded lazily
 *  when a badge is tapped, so it never slows the initial page render. */
export async function fetchBadgeContributors(groupId: string, metric: string): Promise<BadgeContributor[]> {
  try {
    const { data, error } = await supabase
      .from("group_badge_contributions")
      .select("user_id, value")
      .eq("group_id", groupId)
      .eq("metric", metric)
      .gt("value", 0)
      .order("value", { ascending: false });
    if (error || !data || data.length === 0) return [];
    const ids = (data as any[]).map(r => r.user_id);
    // Resolve names/avatars in one query.
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, username, avatar_url")
      .in("id", ids);
    const byId: Record<string, any> = {};
    (users || []).forEach((u: any) => { byId[u.id] = u; });
    return (data as any[]).map(r => {
      const u = byId[r.user_id] || {};
      return {
        userId: r.user_id,
        name: u.full_name || u.username || "Member",
        username: u.username || null,
        avatarUrl: u.avatar_url || null,
        value: Number(r.value) || 0,
      };
    });
  } catch {
    return [];
  }
}

/** Format a metric value for display (rounds; thousands separators). */
export function formatBadgeValue(def: GroupBadgeDef, value: number): string {
  const rounded = def.kind === "distance" && def.unit === "mi"
    ? Math.round(value * 10) / 10   // miles to 1 decimal
    : Math.round(value);
  return rounded.toLocaleString();
}

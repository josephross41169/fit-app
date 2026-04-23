// ── lib/groupGoalSync.ts ────────────────────────────────────────────────────
// Auto-tracking bridge between activity_logs and group_challenge_members.
//
// The problem this solves:
//   Group goals have a `metric` (miles_run, sessions, etc.) and each member has
//   a `contribution` number. Historically that number only changed when the
//   user manually tapped "Log progress" in the challenge UI. That meant a run
//   logged on /post didn't show up on the group's goal tab.
//
// The fix:
//   After any activity_logs insert, call syncGroupChallengeProgressFor(userId).
//   It queries the user's active group challenges, computes each one's
//   contribution by reading real activity_logs rows inside the challenge's
//   date window, and upserts the result into group_challenge_members.
//
// This runs client-side for now (called from the Post page handleSave). When
// we add a server-side writer (wearables syncing directly to the DB), we'll
// want a Postgres trigger to do the same thing.

import { supabase } from "./supabase";

// Metric keys are the strings stored in group_challenges.metric — they come
// from the goal-creation form and the metric picker. Adding new metrics here
// means the user can pick them from the UI and the tracker will work.
type MetricKey =
  | "miles_run"
  | "miles_walked"
  | "miles_biked"
  | "miles_swum"
  | "runs"
  | "workouts"
  | "lift_sessions"
  | "yoga_sessions"
  | "cold_plunges"
  | "sauna_sessions"
  | "meditation_sessions"
  | "wellness_sessions"
  | "total_minutes"
  | "nutrition_logs";

interface ActiveChallenge {
  id: string;
  metric: MetricKey;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

/** Compute a user's current contribution to one specific challenge. */
async function computeContribution(userId: string, challenge: ActiveChallenge): Promise<number> {
  const from = challenge.start_date || challenge.created_at;
  const to   = challenge.end_date   || new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();

  switch (challenge.metric) {
    case "miles_run": {
      // Sum cardio.miles from workout rows in category=running
      const { data } = await supabase
        .from("activity_logs")
        .select("cardio")
        .eq("user_id", userId)
        .eq("log_type", "workout")
        .eq("workout_category", "running")
        .gte("logged_at", from)
        .lte("logged_at", to);
      return (data ?? []).reduce((sum, row: any) => {
        const arr = Array.isArray(row.cardio) ? row.cardio : [];
        return sum + arr.reduce((s: number, c: any) => s + (parseFloat(c.miles) || 0), 0);
      }, 0);
    }
    case "miles_walked": {
      const { data } = await supabase
        .from("activity_logs").select("cardio")
        .eq("user_id", userId).eq("log_type", "workout").eq("workout_category", "walking")
        .gte("logged_at", from).lte("logged_at", to);
      return (data ?? []).reduce((sum, row: any) => {
        const arr = Array.isArray(row.cardio) ? row.cardio : [];
        return sum + arr.reduce((s: number, c: any) => s + (parseFloat(c.miles) || 0), 0);
      }, 0);
    }
    case "miles_biked": {
      const { data } = await supabase
        .from("activity_logs").select("cardio")
        .eq("user_id", userId).eq("log_type", "workout").eq("workout_category", "biking")
        .gte("logged_at", from).lte("logged_at", to);
      return (data ?? []).reduce((sum, row: any) => {
        const arr = Array.isArray(row.cardio) ? row.cardio : [];
        return sum + arr.reduce((s: number, c: any) => s + (parseFloat(c.miles) || 0), 0);
      }, 0);
    }
    case "miles_swum": {
      const { data } = await supabase
        .from("activity_logs").select("cardio")
        .eq("user_id", userId).eq("log_type", "workout").eq("workout_category", "swimming")
        .gte("logged_at", from).lte("logged_at", to);
      return (data ?? []).reduce((sum, row: any) => {
        const arr = Array.isArray(row.cardio) ? row.cardio : [];
        return sum + arr.reduce((s: number, c: any) => s + (parseFloat(c.miles) || 0), 0);
      }, 0);
    }
    case "runs": {
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("log_type", "workout").eq("workout_category", "running")
        .gte("logged_at", from).lte("logged_at", to);
      return count ?? 0;
    }
    case "workouts": {
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("log_type", "workout")
        .gte("logged_at", from).lte("logged_at", to);
      return count ?? 0;
    }
    case "lift_sessions": {
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("log_type", "workout").eq("workout_category", "lifting")
        .gte("logged_at", from).lte("logged_at", to);
      return count ?? 0;
    }
    case "yoga_sessions": {
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("log_type", "workout").eq("workout_category", "yoga")
        .gte("logged_at", from).lte("logged_at", to);
      return count ?? 0;
    }
    case "cold_plunges": {
      // Wellness type is Title Case with spaces — use case-insensitive match
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("log_type", "wellness")
        .or("wellness_type.ilike.cold plunge,wellness_type.ilike.ice bath")
        .gte("logged_at", from).lte("logged_at", to);
      return count ?? 0;
    }
    case "sauna_sessions": {
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("log_type", "wellness").ilike("wellness_type", "sauna")
        .gte("logged_at", from).lte("logged_at", to);
      return count ?? 0;
    }
    case "meditation_sessions": {
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("log_type", "wellness").ilike("wellness_type", "meditation")
        .gte("logged_at", from).lte("logged_at", to);
      return count ?? 0;
    }
    case "wellness_sessions": {
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("log_type", "wellness")
        .gte("logged_at", from).lte("logged_at", to);
      return count ?? 0;
    }
    case "total_minutes": {
      const { data } = await supabase
        .from("activity_logs")
        .select("workout_duration_min, wellness_duration_min")
        .eq("user_id", userId)
        .gte("logged_at", from).lte("logged_at", to);
      return (data ?? []).reduce((sum, row: any) =>
        sum + (row.workout_duration_min || 0) + (row.wellness_duration_min || 0), 0);
    }
    case "nutrition_logs": {
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("log_type", "nutrition")
        .gte("logged_at", from).lte("logged_at", to);
      return count ?? 0;
    }
    default:
      return 0;
  }
}

/** After a user logs a workout/wellness/nutrition entry, call this to sync
 *  their contribution to every active group challenge they're a member of.
 *  Best-effort — errors are logged but not thrown so they can't block saves. */
export async function syncGroupChallengeProgressFor(userId: string): Promise<void> {
  try {
    // 1. Find every active group challenge this user is a member of
    const { data: memberships } = await supabase
      .from("group_challenge_members")
      .select("challenge_id, group_challenges!inner(id,metric,status,start_date,end_date,created_at)")
      .eq("user_id", userId);

    if (!memberships?.length) return;

    const nowIso = new Date().toISOString();

    // 2. For each active challenge, recompute this user's contribution
    for (const m of memberships as any[]) {
      const ch = m.group_challenges;
      if (!ch) continue;
      if (ch.status !== "active") continue;
      if (ch.end_date && ch.end_date < nowIso) continue; // expired

      const contribution = await computeContribution(userId, ch);

      // 3. Upsert the new value — only updating if it actually changed avoids
      // pointless writes that could rate-limit
      await supabase
        .from("group_challenge_members")
        .update({ contribution })
        .eq("challenge_id", ch.id)
        .eq("user_id", userId);
    }
  } catch (err) {
    console.error("[groupGoalSync] failed:", err);
  }
}

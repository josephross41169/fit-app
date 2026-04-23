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
 *
 *  IMPORTANT: This also auto-enrolls the user in goals their group created
 *  AFTER they joined. Without that, `group_challenge_members` might not have
 *  a row for (user, challenge), so a plain UPDATE would silently do nothing
 *  and the user's activity would never show up on the group goal.
 *
 *  Best-effort — errors are logged but not thrown so they can't block saves. */
export async function syncGroupChallengeProgressFor(userId: string): Promise<void> {
  // Verbose logging so issues are easy to diagnose from the browser console.
  console.log("[groupGoalSync] START for user:", userId);
  try {
    // 1. Find the groups this user belongs to
    const { data: memberships, error: mErr } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);

    if (mErr) {
      console.error("[groupGoalSync] group_members query error:", mErr);
      return;
    }

    const groupIds = (memberships ?? []).map((m: any) => m.group_id).filter(Boolean);
    console.log("[groupGoalSync] user is in", groupIds.length, "groups:", groupIds);
    if (groupIds.length === 0) return;

    // 2. Find every active group goal in those groups
    const nowIso = new Date().toISOString();
    const { data: goals, error: gErr } = await supabase
      .from("group_challenges")
      .select("id, creator_group_id, metric, status, start_date, end_date, created_at, is_group_goal, title")
      .in("creator_group_id", groupIds)
      .eq("status", "active");

    if (gErr) {
      console.error("[groupGoalSync] group_challenges query error:", gErr);
      return;
    }

    console.log("[groupGoalSync] found", goals?.length ?? 0, "active challenges");
    if (!goals?.length) return;

    // 3. For each goal, upsert the user's contribution
    for (const ch of goals as any[]) {
      console.log("[groupGoalSync] → challenge:", ch.title, "| metric:", ch.metric, "| is_group_goal:", ch.is_group_goal);

      // Skip non-goal challenges (wars, member challenges) — they use manual logging
      if (!ch.is_group_goal) {
        console.log("[groupGoalSync]   skipped (not a group goal)");
        continue;
      }
      if (ch.end_date && ch.end_date < nowIso) {
        console.log("[groupGoalSync]   skipped (expired)");
        continue;
      }

      const contribution = await computeContribution(userId, ch);
      console.log("[groupGoalSync]   computed contribution:", contribution);

      // Check if enrollment row already exists. Using a read-then-write pattern
      // instead of a raw upsert because group_challenge_members may not have
      // a unique constraint on (challenge_id, user_id) — avoid depending on it.
      const { data: existing, error: exErr } = await supabase
        .from("group_challenge_members")
        .select("challenge_id")
        .eq("challenge_id", ch.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (exErr) {
        console.error("[groupGoalSync]   existing-row check failed:", exErr);
        continue;
      }

      if (existing) {
        // Already enrolled → just update their contribution
        const { error: updErr } = await supabase
          .from("group_challenge_members")
          .update({ contribution })
          .eq("challenge_id", ch.id)
          .eq("user_id", userId);
        if (updErr) console.error("[groupGoalSync]   UPDATE failed:", updErr);
        else console.log("[groupGoalSync]   UPDATE ok, contribution =", contribution);
      } else {
        // Not enrolled yet → create the row.
        const { error: insErr } = await supabase
          .from("group_challenge_members")
          .insert({
            challenge_id: ch.id,
            user_id: userId,
            group_id: ch.creator_group_id,
            contribution,
          });
        if (insErr) console.error("[groupGoalSync]   INSERT failed:", insErr);
        else console.log("[groupGoalSync]   INSERT ok, contribution =", contribution);
      }
    }
    console.log("[groupGoalSync] DONE");
  } catch (err) {
    console.error("[groupGoalSync] unexpected error:", err);
  }
}

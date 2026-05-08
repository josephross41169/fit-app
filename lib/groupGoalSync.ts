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

/** Compute a user's contribution toward a metric in a date window. Reused by
 *  both group-goal sync (group_challenge_members.contribution) and member-
 *  challenge sync (challenge_participants.score). The same metric keys mean
 *  the same numbers — a "miles_run" challenge and a "miles_run" group goal
 *  always agree on the user's miles. */
export async function computeMetricContribution(
  userId: string,
  metric: MetricKey,
  from: string,
  to: string,
): Promise<number> {
  switch (metric) {
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

/** Original challenge-shaped wrapper. Exists so callers that already pass the
 *  full ActiveChallenge row don't need to extract metric / dates themselves. */
async function computeContribution(userId: string, challenge: ActiveChallenge): Promise<number> {
  const from = challenge.start_date || challenge.created_at;
  const to   = challenge.end_date   || new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
  return computeMetricContribution(userId, challenge.metric, from, to);
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

    // 2. Find every active challenge involving this user's groups —
    //    either as creator (group goals + creator-side wars) OR as
    //    opponent (opponent-side wars). Previously this only checked
    //    creator_group_id, so a member of a group that was challenged
    //    to a war would never see their workouts auto-tracked. Run the
    //    two queries in parallel and dedupe.
    const nowIso = new Date().toISOString();
    const [creatorRes, opponentRes] = await Promise.all([
      supabase
        .from("group_challenges")
        .select("id, creator_group_id, opponent_group_id, metric, status, start_date, end_date, created_at, is_group_goal, title")
        .in("creator_group_id", groupIds)
        .eq("status", "active"),
      supabase
        .from("group_challenges")
        .select("id, creator_group_id, opponent_group_id, metric, status, start_date, end_date, created_at, is_group_goal, title")
        .in("opponent_group_id", groupIds)
        .eq("status", "active"),
    ]);

    if (creatorRes.error) {
      console.error("[groupGoalSync] creator-side query error:", creatorRes.error);
    }
    if (opponentRes.error) {
      console.error("[groupGoalSync] opponent-side query error:", opponentRes.error);
    }

    // Dedupe by id — a challenge could only ever be in one bucket but
    // belt-and-suspenders this in case of self-vs-self test wars.
    const seen = new Set<string>();
    const goals = [...(creatorRes.data || []), ...(opponentRes.data || [])].filter((c: any) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    console.log("[groupGoalSync] found", goals.length, "active challenges (creator + opponent side)");
    if (!goals.length) return;

    // 3. For each goal, upsert the user's contribution
    for (const ch of goals as any[]) {
      console.log("[groupGoalSync] → challenge:", ch.title, "| metric:", ch.metric, "| is_group_goal:", ch.is_group_goal);

      if (ch.end_date && ch.end_date < nowIso) {
        console.log("[groupGoalSync]   skipped (expired)");
        continue;
      }

      // Wars (is_group_goal = false) used to be skipped entirely with the
      // comment "they use manual logging." That meant logged workouts
      // never showed up on a war's scoreboard — the only way to get a
      // score was to upload a photo and have someone tally it manually.
      // We now process wars too, with one key difference: wars are
      // invitation-only (creator picks members), so we ONLY update
      // contributions for members already enrolled. No auto-enroll on
      // first log, unlike group goals where any member who logs joins.
      const isWar = !ch.is_group_goal;

      const contribution = await computeContribution(userId, ch);
      console.log("[groupGoalSync]   computed contribution:", contribution, isWar ? "(war)" : "(goal)");

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

      // For wars: skip silently if the user wasn't picked. Auto-enrolling
      // every group member who happens to log a workout would let
      // randoms accidentally join the war and score for it.
      if (isWar && !existing) {
        console.log("[groupGoalSync]   skipped (war, user not enrolled)");
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

    // ── 4. Sync auto-tracked CHALLENGES (opt-in, one row per participant) ──
    // Challenges differ from goals: users opt in via challenge_participants.
    // We only update existing participant rows — never auto-enroll, because
    // that would break the opt-in nature. If a user joined, their score gets
    // auto-computed from activity_logs. If they didn't join, we don't touch them.
    console.log("[groupGoalSync] → checking enrolled challenges");
    const { data: enrollments, error: enrErr } = await supabase
      .from("challenge_participants")
      .select("challenge_id, challenges!inner(id,metric_key,is_active,deadline,created_at,name,group_id)")
      .eq("user_id", userId);

    if (enrErr) {
      console.error("[groupGoalSync] challenge_participants query error:", enrErr);
    } else if (enrollments?.length) {
      console.log("[groupGoalSync] user is enrolled in", enrollments.length, "challenges");
      for (const row of enrollments as any[]) {
        const ch = row.challenges;
        if (!ch) continue;
        console.log("[groupGoalSync] → challenge:", ch.name, "| metric_key:", ch.metric_key);

        // Only auto-sync challenges that picked a standard metric from the catalog.
        // Custom (manual) challenges have metric_key = null and keep using the
        // log_challenge_progress flow — we leave them alone.
        if (!ch.metric_key) {
          console.log("[groupGoalSync]   skipped (custom manual challenge)");
          continue;
        }
        if (!ch.is_active) {
          console.log("[groupGoalSync]   skipped (inactive)");
          continue;
        }
        if (ch.deadline && ch.deadline < nowIso) {
          console.log("[groupGoalSync]   skipped (past deadline)");
          continue;
        }

        // Re-use computeContribution by shaping the challenge like a goal
        const score = await computeContribution(userId, {
          id: ch.id,
          metric: ch.metric_key,
          start_date: null,          // challenges don't track a start date — use created_at
          end_date: ch.deadline,
          created_at: ch.created_at,
        });
        console.log("[groupGoalSync]   computed score:", score);

        const { error: updErr } = await supabase
          .from("challenge_participants")
          .update({ score })
          .eq("challenge_id", ch.id)
          .eq("user_id", userId);
        if (updErr) console.error("[groupGoalSync]   UPDATE failed:", updErr);
        else console.log("[groupGoalSync]   UPDATE ok, score =", score);

        // Also update leaderboard_entries so the challenge leaderboard reflects it
        const { error: lbErr } = await supabase
          .from("leaderboard_entries")
          .upsert({
            group_id: ch.group_id,
            user_id: userId,
            challenge_id: ch.id,
            score,
            updated_at: new Date().toISOString(),
          }, { onConflict: "group_id,user_id,challenge_id" });
        if (lbErr) console.warn("[groupGoalSync]   leaderboard upsert failed (non-fatal):", lbErr);
      }
    } else {
      console.log("[groupGoalSync] user isn't enrolled in any challenges");
    }

    console.log("[groupGoalSync] DONE");
  } catch (err) {
    console.error("[groupGoalSync] unexpected error:", err);
  }
}

/** ── Member challenge auto-sync ─────────────────────────────────────────────
 *  Mirrors syncGroupChallengeProgressFor but for `challenges` + `challenge_participants`.
 *
 *  Member challenges (per-user opt-in challenges inside groups) optionally
 *  have a `metric_key` (e.g. "miles_run", "workouts"). When set, the
 *  challenge is auto-tracked: the user's `score` is recomputed from full
 *  activity_logs history every time this runs.
 *
 *  When metric_key is null, the challenge is "manual" — a custom challenge
 *  like "acts of service" or "journal entries" that has no clean mapping to
 *  workout data. Those keep the existing log_challenge_progress flow where
 *  the user enters values by hand, and we don't touch them.
 *
 *  Self-correcting: like group goals, this overwrites score with the
 *  recomputed total — so editing or deleting workouts always lands on the
 *  right number, no double-counting. Best-effort: errors are logged but
 *  never thrown, can't block a save. */
export async function syncMemberChallengeProgressFor(userId: string): Promise<void> {
  console.log("[memberChallengeSync] START for user:", userId);
  try {
    // 1. Find every challenge this user has joined
    const { data: parts, error: pErr } = await supabase
      .from("challenge_participants")
      .select("challenge_id, score")
      .eq("user_id", userId);

    if (pErr) {
      console.error("[memberChallengeSync] participants query error:", pErr);
      return;
    }
    if (!parts || parts.length === 0) {
      console.log("[memberChallengeSync] user has no challenges");
      return;
    }

    const ids = parts.map((p: any) => p.challenge_id).filter(Boolean);
    if (ids.length === 0) return;

    // 2. Fetch the challenge rows — only ones with metric_key set are auto-trackable
    const nowIso = new Date().toISOString();
    const { data: challenges, error: cErr } = await supabase
      .from("challenges")
      .select("id, group_id, name, metric_key, metric_label, deadline, is_active, created_at")
      .in("id", ids);

    if (cErr) {
      console.error("[memberChallengeSync] challenges query error:", cErr);
      return;
    }

    const trackable = (challenges || []).filter((c: any) => {
      if (!c.metric_key) return false;          // manual-only challenge, skip
      if (c.is_active === false) return false;  // archived
      if (c.deadline && c.deadline < nowIso) return false; // expired
      return true;
    });

    console.log("[memberChallengeSync] trackable challenges:", trackable.length);
    if (trackable.length === 0) return;

    // 3. For each, recompute and write the new score
    for (const ch of trackable as any[]) {
      const from = ch.created_at;
      const to = ch.deadline || new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
      const score = await computeMetricContribution(userId, ch.metric_key as MetricKey, from, to);
      console.log("[memberChallengeSync] →", ch.name, "metric:", ch.metric_key, "score:", score);

      const { error: upErr } = await supabase
        .from("challenge_participants")
        .update({ score })
        .eq("challenge_id", ch.id)
        .eq("user_id", userId);

      if (upErr) {
        console.error("[memberChallengeSync]   participant update failed:", upErr);
        continue;
      }

      // Mirror to leaderboard_entries — same pattern as the manual log path
      // in /api/db log_challenge_progress, so leaderboards stay in sync.
      if (ch.group_id) {
        const { error: lbErr } = await supabase
          .from("leaderboard_entries")
          .upsert({
            group_id: ch.group_id,
            user_id: userId,
            challenge_id: ch.id,
            score,
            metric_label: ch.metric_label || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "group_id,user_id,challenge_id" });
        if (lbErr) console.warn("[memberChallengeSync]   leaderboard upsert failed (non-fatal):", lbErr);
      }
    }

    console.log("[memberChallengeSync] DONE");
  } catch (err) {
    console.error("[memberChallengeSync] unexpected error:", err);
  }
}

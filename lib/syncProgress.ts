// ── lib/syncProgress.ts ─────────────────────────────────────────────────────
// Self-healing progress sync for rivalries, wars, buddies, goals, and
// rivalry badges. Run on page load for any of those views to pick up
// state that drifted because a save's tracker chain failed (offline,
// rate-limited, JS error, browser closed mid-write, etc).
//
// THE PROBLEM IT SOLVES:
//
// Each save path (post page, profile day card edit) fires a chain of
// "tracker" calls right after the activity_logs insert/update — things
// like update_goals_from_log, syncGroupChallengeProgressFor,
// buddy_update_from_log, unlock_rivalry_badges. When ANY of these fails
// (or never fires because the user closed the tab during save), the
// derived data is left stale. The activity log is correct in the DB
// but goals/wars/buddies/badges don't reflect it.
//
// THE FIX:
//
// On load of any page that displays this derived state, fire all the
// recompute endpoints with full history. They're idempotent — recompute
// from scratch each time — so calling them on every page visit is safe.
// The user opening the page IS the cue that something might need fixing.
//
// ORDERING:
//
// 1. backfill_workout_category MUST run first. Lots of older logs are
//    missing this column. Until it's set, the rivalry RPC won't see
//    those logs (it filters on workout_category) and the badge scanner
//    won't find them either.
// 2. Everything else can run in parallel — they all read the now-correct
//    data and write to independent tables.

import { syncGroupChallengeProgressFor, syncMemberChallengeProgressFor } from "./groupGoalSync";

export async function forceSyncAllProgress(userId: string): Promise<void> {
  if (!userId) return;
  try {
    // Step 1: backfill missing workout_category on old logs. Has to
    // complete before steps 2-5 because they all depend on this column
    // being correct. Cheap on subsequent calls — only scans rows where
    // workout_category IS NULL, so once it's caught up there's nothing
    // to do.
    await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "backfill_workout_category",
        payload: { userId },
      }),
    }).catch(() => {});

    // Step 2-5: every recompute fires in parallel. None of them depend
    // on each other's output — each reads activity_logs and writes to
    // its own derived table.
    await Promise.all([
      // Wars + group goals — recomputes the user's contribution to every
      // active group_challenge row (goals AND wars now, after the
      // is_group_goal skip was removed).
      syncGroupChallengeProgressFor(userId).catch(() => {}),
      // Member-of-challenge progress — different table, same idea.
      syncMemberChallengeProgressFor(userId).catch(() => {}),
      // Workout buddy matches — recomputes user_a_progress / user_b_progress
      // for every active match by re-summing the user's logs in the
      // match window. logId is intentionally omitted; the action treats
      // missing logId as "recompute everything".
      fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "buddy_update_from_log",
          payload: { userId },
        }),
      }).catch(() => {}),
      // Rivalry badges — scan-all mode (no logId). Walks every active
      // rivalry the user is in, scans all their logs in the rivalry
      // window, and awards any missed badges (first_blood, dominant,
      // early_bird, comeback). Idempotent on the rivalry_badges unique
      // constraint.
      fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlock_rivalry_badges",
          payload: { userId },
        }),
      }).catch(() => {}),
    ]);
  } catch (e) {
    // Best-effort. The page will still render with whatever state the
    // server currently has — sync just won't be fresh.
    console.error("[syncProgress] force sync failed", e);
  }
}

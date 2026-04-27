// lib/xp.ts
// Awards XP to a user. Pure client-side — no RPC dependency.
//
// History: previously this called a Supabase RPC `award_xp` which was
// silently failing because the RPC's internal CHECK constraint wasn't
// always in sync with the table's CHECK constraint. When `wellness` or
// `feed_post` were added, the RPC kept rejecting them, so the awardXp
// helper returned `awarded: false` and nobody noticed for weeks. Now we
// insert directly into user_xp_log and rely on the table's UNIQUE
// constraint (user_id, category, award_date) to enforce "once per day
// per category." On dup-key violation we treat it as already-awarded
// (not an error). On real error we LOG VISIBLY so this can't silently
// break again.

import { supabase } from "./supabase";
import { XP_CATEGORIES, type XpCategory, type Level } from "./tiers";

export interface AwardXpResult {
  awarded: boolean;       // true if a new row was inserted (= user wasn't capped)
  newXp: number;          // user's xp_in_level AFTER this call
  currentLevel: number;
  leveledUp: boolean;     // true if this call caused a level-up
}

/**
 * Award XP for a category. Idempotent per-day per-category — if the user
 * already earned XP for this category today, this is a no-op (returns
 * awarded: false). Otherwise inserts the log row and bumps users.xp_in_level.
 *
 * Categories: 'workout' | 'cardio' | 'nutrition' | 'wellness' | 'feed_post'
 */
export async function awardXp(
  userId: string,
  category: XpCategory,
): Promise<AwardXpResult> {
  // 1. Look up the XP value for this category. Fixed at 3 today, but kept
  //    flexible in case categories ever earn different amounts.
  const catDef = XP_CATEGORIES.find(c => c.key === category);
  const xpAmount = catDef?.xp ?? 3;

  // 2. Insert into user_xp_log. The table has a unique constraint on
  //    (user_id, category, award_date) where award_date is a generated
  //    column from awarded_at. If the user already logged this category
  //    today, the insert errors with code 23505 (unique_violation), which
  //    we treat as "already awarded, not a real error."
  const { error: insertError } = await supabase
    .from("user_xp_log")
    .insert({
      user_id: userId,
      category,
      xp_amount: xpAmount,
    });

  if (insertError) {
    // 23505 = unique_violation = already awarded today. Expected, no-op.
    if (insertError.code === "23505") {
      // Still return the user's current XP/level so callers can render the bar
      const { data: profile } = await supabase
        .from("users")
        .select("xp_in_level, current_level")
        .eq("id", userId)
        .single();
      return {
        awarded: false,
        newXp: profile?.xp_in_level ?? 0,
        currentLevel: profile?.current_level ?? 1,
        leveledUp: false,
      };
    }
    // Any other error means the table itself rejected the insert (RLS,
    // missing column, broken CHECK constraint). Log loudly so it doesn't
    // silently break for weeks like before.
    console.error(
      `[xp] FAILED to insert user_xp_log for category="${category}":`,
      insertError.message,
      "— Check that the user_xp_log_category_check constraint includes this category."
    );
    return { awarded: false, newXp: 0, currentLevel: 1, leveledUp: false };
  }

  // 3. Read current xp_in_level + current_level so we can do an additive
  //    update. We use a read-then-write here rather than an atomic SQL
  //    increment because we don't have a stored procedure available — but
  //    even with two tabs racing, the worst case is a single missed XP
  //    award (3 XP) which is acceptable.
  const { data: profile, error: readErr } = await supabase
    .from("users")
    .select("xp_in_level, current_level")
    .eq("id", userId)
    .single();

  if (readErr || !profile) {
    console.error("[xp] couldn't read user profile after award:", readErr?.message);
    return { awarded: true, newXp: xpAmount, currentLevel: 1, leveledUp: false };
  }

  const newXp = (profile.xp_in_level ?? 0) + xpAmount;
  const { error: updateErr } = await supabase
    .from("users")
    .update({ xp_in_level: newXp })
    .eq("id", userId);

  if (updateErr) {
    console.error("[xp] couldn't update xp_in_level:", updateErr.message);
  }

  return {
    awarded: true,
    newXp,
    currentLevel: (profile.current_level as Level) ?? 1,
    leveledUp: false,
  };
}

/**
 * Try to level up the user. Should be called after challenges are met
 * AND xp threshold is hit. Server checks both conditions before applying.
 * Returns the new level (will equal old level if level-up didn't happen).
 *
 * NOTE: We keep this as an RPC because the level-up logic is complex
 * (resets xp_in_level, increments current_level, validates challenges).
 * If the level_up RPC also turns out to be broken, we'll inline this too.
 */
export async function tryLevelUp(userId: string): Promise<{ level: number; xp: number } | null> {
  const { data, error } = await supabase.rpc("level_up", { p_user_id: userId });
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    if (error) console.warn("[xp] level_up error:", error.message);
    return null;
  }
  const row = data[0] as { new_level: number; xp_in_level: number };
  return { level: row.new_level, xp: row.xp_in_level };
}

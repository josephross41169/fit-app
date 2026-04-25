// lib/xp.ts
// Awards XP to a user via the server-side RPC (which enforces the
// "max 3 XP per category per day" rule and updates users.xp_in_level).
//
// After awarding, checks if user is ready to level up (XP threshold +
// challenges) and triggers the level-up RPC if so.

import { supabase } from "./supabase";
import type { XpCategory } from "./tiers";

export interface AwardXpResult {
  awarded: boolean;       // true if a new row was inserted (= user wasn't capped)
  newXp: number;          // user's xp_in_level AFTER this call
  currentLevel: number;
  leveledUp: boolean;     // true if this call caused a level-up
}

/**
 * Award XP for a category. The server enforces "max 3 per day per category"
 * via a unique constraint, so calling this multiple times in a day for the
 * same category is safe — second call is a no-op.
 *
 * Categories: 'workout' | 'cardio' | 'nutrition' | 'wellness' | 'feed_post'
 */
export async function awardXp(
  userId: string,
  category: XpCategory,
): Promise<AwardXpResult> {
  const { data, error } = await supabase.rpc("award_xp", {
    p_user_id: userId,
    p_category: category,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    if (error) console.warn("[xp] award_xp error:", error.message);
    return { awarded: false, newXp: 0, currentLevel: 1, leveledUp: false };
  }
  const row = data[0] as { awarded: boolean; new_xp: number; current_level: number };
  return {
    awarded: !!row.awarded,
    newXp: row.new_xp,
    currentLevel: row.current_level,
    leveledUp: false,
  };
}

/**
 * Try to level up the user. Should be called after challenges are met
 * AND xp threshold is hit. Server checks both conditions before applying.
 * Returns the new level (will equal old level if level-up didn't happen).
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

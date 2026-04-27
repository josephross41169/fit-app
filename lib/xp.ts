// lib/xp.ts
// Awards XP through /api/db so the service-role client can bypass RLS while
// the database unique constraint still enforces one award per category per day.

import { supabase } from "./supabase";
import { XP_CATEGORIES, type XpCategory } from "./tiers";

export interface AwardXpResult {
  awarded: boolean;
  newXp: number;
  currentLevel: number;
  leveledUp: boolean;
}

/**
 * Award XP for a category. Idempotent per-day per-category.
 *
 * Categories: 'workout' | 'cardio' | 'nutrition' | 'wellness' | 'feed_post'
 */
export async function awardXp(
  userId: string,
  category: XpCategory,
): Promise<AwardXpResult> {
  const catDef = XP_CATEGORIES.find(c => c.key === category);
  const xpAmount = catDef?.xp ?? 3;

  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "award_xp", payload: { userId, category } }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(
      `[xp] FAILED service-role award for category="${category}":`,
      json?.error || res.statusText
    );
    return { awarded: false, newXp: 0, currentLevel: 1, leveledUp: false };
  }

  return {
    awarded: !!json?.awarded,
    newXp: json?.newXp ?? xpAmount,
    currentLevel: json?.currentLevel ?? 1,
    leveledUp: !!json?.leveledUp,
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

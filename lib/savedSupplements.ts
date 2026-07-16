// lib/savedSupplements.ts
// ─────────────────────────────────────────────────────────────────────────────
// Helpers for supplement favorites (saved_supplements table). The supplement
// equivalent of lib/savedFoods.ts — a saved supplement is just a name + an
// optional photo, so a user can one-tap re-add it on future nutrition logs.
// Used by the Supplements section of post/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

import type { IngredientRow } from "./nutrients";

export interface SavedSupplement {
  id: string;
  name: string;
  photo_url?: string | null;
  use_count: number;
  last_used_at?: string | null;
  // ── Supplement Facts (optional, one-time setup) ──
  brand?: string | null;
  serving_size?: string | null;      // e.g. "2 tablets", "1 scoop (30g)"
  ingredients?: IngredientRow[] | null; // per-serving amounts
  // ── Stacks: a favorite that logs several supplements at once ──
  is_stack?: boolean | null;
  items?: { name: string; photo_url?: string | null }[] | null;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────
// Returns the user's saved supplements, most-used first, then most-recent.
export async function fetchSavedSupplements(userId: string): Promise<SavedSupplement[]> {
  try {
    const { data, error } = await supabase
      .from("saved_supplements")
      .select("*")
      .eq("user_id", userId)
      .order("use_count", { ascending: false })
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) {
      console.warn("[savedSupplements] fetch failed:", error.message);
      return [];
    }
    return (data || []) as SavedSupplement[];
  } catch (e) {
    console.warn("[savedSupplements] fetch threw:", e);
    return [];
  }
}

// ─── Save a supplement ───────────────────────────────────────────────────────
// De-dupes on (case-insensitive) name so a user doesn't stack duplicates.
export async function saveSupplement(
  userId: string,
  supp: { name: string; photo_url?: string | null },
): Promise<SavedSupplement | null> {
  if (!supp.name?.trim()) return null;
  try {
    const { data: existing } = await supabase
      .from("saved_supplements")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", supp.name.trim())
      .limit(1);
    if (existing && existing.length > 0) {
      return null; // already saved — silent no-op
    }

    const row = {
      user_id: userId,
      name: supp.name.trim(),
      photo_url: supp.photo_url || null,
    };
    const { data, error } = await supabase
      .from("saved_supplements")
      .insert(row as any)
      .select()
      .single();
    if (error) {
      console.warn("[savedSupplements] save failed:", error.message);
      return null;
    }
    return data as SavedSupplement;
  } catch (e) {
    console.warn("[savedSupplements] save threw:", e);
    return null;
  }
}

// ─── Bump usage (call when a favorite is logged) ────────────────────────────
// Fire-and-forget; ordering favorites by most-used.
export async function bumpSupplementUse(id: string, currentCount: number): Promise<void> {
  try {
    await (supabase as any)
      .from("saved_supplements")
      .update({ use_count: currentCount + 1, last_used_at: new Date().toISOString() })
      .eq("id", id);
  } catch {
    /* best-effort */
  }
}

// ─── Delete a favorite ──────────────────────────────────────────────────────
export async function deleteSavedSupplement(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("saved_supplements").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

// ─── Update Supplement Facts (label data) ────────────────────────────────────
// One-time setup per supplement; logging never changes. Any log made after
// this carries the ingredients snapshot automatically.
export async function updateSupplementFacts(
  id: string,
  facts: { brand?: string | null; serving_size?: string | null; ingredients?: import("./nutrients").IngredientRow[] | null },
): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from("saved_supplements")
      .update({
        brand: facts.brand ?? null,
        serving_size: facts.serving_size ?? null,
        ingredients: facts.ingredients ?? null,
      })
      .eq("id", id);
    if (error) console.warn("[savedSupplements] facts update failed:", error.message);
    return !error;
  } catch (e) {
    console.warn("[savedSupplements] facts update threw:", e);
    return false;
  }
}

// ─── Save a stack (several supplements as one one-tap favorite) ─────────────
// Mirrors the saved-meal pattern in savedFoods: is_stack + items.
export async function saveStack(
  userId: string,
  name: string,
  items: { name: string; photo_url?: string | null }[],
): Promise<SavedSupplement | null> {
  if (!name.trim() || items.length < 2) return null;
  try {
    const { data, error } = await supabase
      .from("saved_supplements")
      .insert({ user_id: userId, name: name.trim(), is_stack: true, items } as any)
      .select()
      .single();
    if (error) {
      console.warn("[savedSupplements] stack save failed:", error.message);
      return null;
    }
    return data as SavedSupplement;
  } catch (e) {
    console.warn("[savedSupplements] stack save threw:", e);
    return null;
  }
}

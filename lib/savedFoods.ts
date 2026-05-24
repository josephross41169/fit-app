// lib/savedFoods.ts
// ─────────────────────────────────────────────────────────────────────────────
// Helpers for nutrition favorites (saved_foods table). Handles both single
// saved foods and combo meals. Used by components/FoodFavorites.tsx and the
// star-to-save buttons in the nutrition logging tab (post/page.tsx).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

// Shape of a single food item — mirrors FoodItem in post/page.tsx.
export interface SavedFoodItem {
  name: string;
  calories: string | number;
  protein?: string | number;
  carbs?: string | number;
  fat?: string | number;
  servingSize?: string;
  qty?: string;
}

export interface SavedFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size?: string | null;
  default_meal_type?: string | null;
  is_meal: boolean;
  items?: SavedFoodItem[] | null;
  use_count: number;
  last_used_at?: string | null;
}

function num(v: string | number | undefined): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────
// Returns the user's favorites, most-used first, then most-recently-used.
export async function fetchSavedFoods(userId: string): Promise<SavedFood[]> {
  try {
    const { data, error } = await supabase
      .from("saved_foods")
      .select("*")
      .eq("user_id", userId)
      .order("use_count", { ascending: false })
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) {
      console.warn("[savedFoods] fetch failed:", error.message);
      return [];
    }
    return (data || []) as SavedFood[];
  } catch (e) {
    console.warn("[savedFoods] fetch threw:", e);
    return [];
  }
}

// ─── Save a single food ────────────────────────────────────────────────────
export async function saveFood(
  userId: string,
  food: SavedFoodItem,
  mealType?: string,
): Promise<SavedFood | null> {
  if (!food.name?.trim()) return null;
  try {
    // De-dupe: if a single food with the same (case-insensitive) name already
    // exists, don't create a second one.
    const { data: existing } = await supabase
      .from("saved_foods")
      .select("id")
      .eq("user_id", userId)
      .eq("is_meal", false)
      .ilike("name", food.name.trim())
      .limit(1);
    if (existing && existing.length > 0) {
      return null; // already saved — silent no-op
    }

    const row = {
      user_id: userId,
      name: food.name.trim(),
      calories: num(food.calories),
      protein: num(food.protein),
      carbs: num(food.carbs),
      fat: num(food.fat),
      serving_size: food.servingSize || null,
      default_meal_type: mealType || null,
      is_meal: false,
      items: null,
    };
    const { data, error } = await supabase
      .from("saved_foods")
      .insert(row as any)
      .select()
      .single();
    if (error) {
      console.warn("[savedFoods] saveFood failed:", error.message);
      return null;
    }
    return data as SavedFood;
  } catch (e) {
    console.warn("[savedFoods] saveFood threw:", e);
    return null;
  }
}

// ─── Save a combo meal (bundle of foods) ────────────────────────────────────
export async function saveMeal(
  userId: string,
  name: string,
  items: SavedFoodItem[],
  mealType?: string,
): Promise<SavedFood | null> {
  if (!name?.trim() || !items || items.length === 0) return null;
  try {
    // Sum the component macros so the combo's totals are stored alongside.
    const totals = items.reduce(
      (acc, it) => {
        const q = num(it.qty) || 1;
        acc.calories += num(it.calories) * q;
        acc.protein += num(it.protein) * q;
        acc.carbs += num(it.carbs) * q;
        acc.fat += num(it.fat) * q;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    const row = {
      user_id: userId,
      name: name.trim(),
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
      serving_size: null,
      default_meal_type: mealType || null,
      is_meal: true,
      items: items.map((it) => ({
        name: it.name,
        calories: num(it.calories),
        protein: num(it.protein),
        carbs: num(it.carbs),
        fat: num(it.fat),
        servingSize: it.servingSize || null,
        qty: it.qty || "1",
      })),
    };
    const { data, error } = await supabase
      .from("saved_foods")
      .insert(row as any)
      .select()
      .single();
    if (error) {
      console.warn("[savedFoods] saveMeal failed:", error.message);
      return null;
    }
    return data as SavedFood;
  } catch (e) {
    console.warn("[savedFoods] saveMeal threw:", e);
    return null;
  }
}

// ─── Bump usage (call when a favorite is logged) ────────────────────────────
// Fire-and-forget; we don't block the UI on this.
export async function bumpUseCount(id: string, currentCount: number): Promise<void> {
  try {
    await supabase
      .from("saved_foods")
      .update({ use_count: currentCount + 1, last_used_at: new Date().toISOString() } as any)
      .eq("id", id);
  } catch {
    /* best-effort */
  }
}

// ─── Delete a favorite ──────────────────────────────────────────────────────
export async function deleteSavedFood(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("saved_foods").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

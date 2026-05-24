"use client";

// components/FoodFavorites.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Favorites bar shown above the food search in the nutrition logging tab.
// Displays the user's saved foods + combo meals as tappable chips. Tapping a
// chip adds that food (or all of a combo's items) into the current meal being
// logged. Long-press / × removes a favorite.
//
// Sorting: most-used first (handled by lib/savedFoods.fetchSavedFoods). When a
// currentMealType is provided, favorites filed under that meal type are shown
// first, then the rest — so breakfast favorites surface while logging breakfast.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import {
  fetchSavedFoods,
  bumpUseCount,
  deleteSavedFood,
  type SavedFood,
  type SavedFoodItem,
} from "@/lib/savedFoods";

interface Props {
  userId: string;
  currentMealType?: string;
  // Adds a single food into the meal being logged.
  onAddFood: (food: SavedFoodItem) => void;
  // Adds all of a combo meal's items into the meal being logged.
  onAddCombo: (items: SavedFoodItem[]) => void;
  // Bump this number to force a re-fetch (e.g. after star-to-save).
  refreshKey?: number;
}

const C = {
  text: "#F0F0F0",
  sub: "#9CA3AF",
  gold: "#F5A623",
  blue: "#7C3AED",
  chip: "#1A1228",
  chipBorder: "#2D1F52",
};

export default function FoodFavorites({ userId, currentMealType, onAddFood, onAddCombo, refreshKey = 0 }: Props) {
  const [favorites, setFavorites] = useState<SavedFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageMode, setManageMode] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const favs = await fetchSavedFoods(userId);
    setFavorites(favs);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) {
    return (
      <div style={{ padding: "8px 0", fontSize: 12, color: C.sub }}>Loading favorites…</div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div style={{ padding: "10px 12px", fontSize: 12, color: C.sub, background: C.chip, borderRadius: 12, border: `1px dashed ${C.chipBorder}`, marginBottom: 10 }}>
        ⭐ Star any food below to save it here for one-tap logging next time.
      </div>
    );
  }

  // Order: current-meal-type favorites first, then the rest (each already
  // sorted by use_count from the query).
  const ordered = currentMealType
    ? [
        ...favorites.filter(f => f.default_meal_type === currentMealType),
        ...favorites.filter(f => f.default_meal_type !== currentMealType),
      ]
    : favorites;

  function handleTap(fav: SavedFood) {
    if (manageMode) return; // taps are for deleting in manage mode
    if (fav.is_meal && fav.items && fav.items.length > 0) {
      onAddCombo(fav.items);
    } else {
      onAddFood({
        name: fav.name,
        calories: fav.calories,
        protein: fav.protein,
        carbs: fav.carbs,
        fat: fav.fat,
        servingSize: fav.serving_size || undefined,
        qty: "1",
      });
    }
    bumpUseCount(fav.id, fav.use_count); // fire-and-forget
  }

  async function handleDelete(id: string) {
    const ok = await deleteSavedFood(id);
    if (ok) setFavorites(prev => prev.filter(f => f.id !== id));
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, display: "flex", alignItems: "center", gap: 5 }}>
          ⭐ Favorites
        </div>
        <button
          onClick={() => setManageMode(m => !m)}
          style={{ fontSize: 11, fontWeight: 700, color: manageMode ? C.gold : C.sub, background: "none", border: "none", cursor: "pointer" }}
        >
          {manageMode ? "Done" : "Manage"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ordered.map(fav => (
          <button
            key={fav.id}
            onClick={() => (manageMode ? handleDelete(fav.id) : handleTap(fav))}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 2,
              padding: "8px 12px",
              borderRadius: 12,
              background: C.chip,
              border: `1.5px solid ${manageMode ? "#FF6B6B" : C.chipBorder}`,
              cursor: "pointer",
              maxWidth: 200,
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: C.text }}>
              {manageMode ? <span style={{ color: "#FF6B6B" }}>✕</span> : <span>{fav.is_meal ? "🍱" : "＋"}</span>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                {fav.name}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.sub }}>
              {Math.round(fav.calories)} cal
              {fav.protein ? ` · ${Math.round(fav.protein)}g P` : ""}
              {fav.is_meal ? ` · meal` : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

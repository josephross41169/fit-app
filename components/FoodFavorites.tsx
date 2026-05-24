"use client";

// components/FoodFavorites.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Favorites section in the nutrition logging tab, organized by meal type.
//
//   • Tabs: Breakfast · Lunch · Dinner · Snacks. Tapping a tab filters the
//     favorites to that meal type AND switches the post's Meal Type to match
//     (via onSetMealType), so logging flows naturally.
//   • Each favorite is a tappable chip. Tap → adds the food (or all of a
//     combo's items) to the meal being logged. Chips with a saved photo show
//     a thumbnail and, on tap, the photo auto-attaches to the nutrition post.
//   • Manage mode lets you delete favorites.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import {
  fetchSavedFoods,
  bumpUseCount,
  deleteSavedFood,
  type SavedFood,
  type SavedFoodItem,
} from "@/lib/savedFoods";

const MEAL_TABS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

interface Props {
  userId: string;
  currentMealType?: string;
  onAddFood: (food: SavedFoodItem) => void;
  onAddCombo: (items: SavedFoodItem[]) => void;
  // Switch the post's Meal Type when a tab is tapped.
  onSetMealType?: (mealType: string) => void;
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

export default function FoodFavorites({ userId, currentMealType, onAddFood, onAddCombo, onSetMealType, refreshKey = 0 }: Props) {
  const [favorites, setFavorites] = useState<SavedFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageMode, setManageMode] = useState(false);
  // Which meal tab is active. Defaults to the post's current meal type if it
  // matches one of our tabs, else Breakfast.
  const initialTab = MEAL_TABS.includes(currentMealType as any) ? (currentMealType as string) : "Breakfast";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const favs = await fetchSavedFoods(userId);
    setFavorites(favs);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Keep the active tab in sync if the post's meal type changes elsewhere.
  useEffect(() => {
    if (currentMealType && MEAL_TABS.includes(currentMealType as any)) {
      setActiveTab(currentMealType);
    }
  }, [currentMealType]);

  function handleTabClick(tab: string) {
    setActiveTab(tab);
    onSetMealType?.(tab); // also switch the post's meal type
  }

  function handleTap(fav: SavedFood) {
    if (manageMode) return;
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
        photoUrl: fav.photo_url || undefined,
      });
    }
    bumpUseCount(fav.id, fav.use_count);
  }

  async function handleDelete(id: string) {
    const ok = await deleteSavedFood(id);
    if (ok) setFavorites(prev => prev.filter(f => f.id !== id));
  }

  // Favorites filed under the active tab. Items with no meal type show under
  // every tab (so a generic favorite isn't hidden).
  const visible = favorites.filter(
    f => f.default_meal_type === activeTab || !f.default_meal_type,
  );

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, display: "flex", alignItems: "center", gap: 5 }}>
          ⭐ Favorites
        </div>
        {favorites.length > 0 ? (
          <button
            onClick={() => setManageMode(m => !m)}
            style={{ fontSize: 11, fontWeight: 700, color: manageMode ? C.gold : C.sub, background: "none", border: "none", cursor: "pointer" }}
          >
            {manageMode ? "Done" : "Manage"}
          </button>
        ) : null}
      </div>

      {/* Meal-type tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {MEAL_TABS.map(tab => {
          const active = tab === activeTab;
          const count = favorites.filter(f => f.default_meal_type === tab).length;
          return (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: "7px 14px",
                borderRadius: 20,
                border: active ? "none" : `1.5px solid ${C.chipBorder}`,
                background: active ? "linear-gradient(135deg, #7C3AED, #A78BFA)" : "transparent",
                color: active ? "#fff" : C.sub,
                cursor: "pointer",
              }}
            >
              {tab}{count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {/* Chips for the active tab */}
      {loading ? (
        <div style={{ padding: "8px 0", fontSize: 12, color: C.sub }}>Loading favorites…</div>
      ) : visible.length === 0 ? (
        <div style={{ padding: "10px 12px", fontSize: 12, color: C.sub, background: C.chip, borderRadius: 12, border: `1px dashed ${C.chipBorder}` }}>
          {favorites.length === 0
            ? "⭐ Star any food below to save it here for one-tap logging next time."
            : `No ${activeTab.toLowerCase()} favorites yet. Star a food while ${activeTab} is selected to file it here.`}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {visible.map(fav => (
            <button
              key={fav.id}
              onClick={() => (manageMode ? handleDelete(fav.id) : handleTap(fav))}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: fav.photo_url ? "6px 12px 6px 6px" : "8px 12px",
                borderRadius: 12,
                background: C.chip,
                border: `1.5px solid ${manageMode ? "#FF6B6B" : C.chipBorder}`,
                cursor: "pointer",
                maxWidth: 230,
              }}
            >
              {fav.photo_url && !manageMode ? (
                <img src={fav.photo_url} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
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
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

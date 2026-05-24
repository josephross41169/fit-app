"use client";

// components/FoodFavorites.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Favorites section in the nutrition logging tab, organized by meal type.
//
//   • Tabs: Breakfast · Lunch · Dinner · Snacks. Tapping a tab filters the
//     favorites to that meal type AND switches the post's Meal Type (via
//     onSetMealType).
//   • "+ Add Favorite" opens an inline form to CREATE a favorite from scratch
//     (name, calories, macros, optional photo) — files it under the active
//     tab's meal type. This is the dedicated create flow (separate from the
//     ☆ star on a logged food row).
//   • Each favorite is a tappable chip → adds the food (or all of a combo's
//     items) to the meal being logged; saved photos auto-attach to the post.
//   • Manage mode lets you delete favorites.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import {
  fetchSavedFoods,
  saveFood,
  bumpUseCount,
  deleteSavedFood,
  type SavedFood,
  type SavedFoodItem,
} from "@/lib/savedFoods";
import { compressImage } from "@/lib/compressImage";
import { uploadPhoto } from "@/lib/uploadPhoto";

const MEAL_TABS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

interface Props {
  userId: string;
  currentMealType?: string;
  onAddFood: (food: SavedFoodItem) => void;
  onAddCombo: (items: SavedFoodItem[]) => void;
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
  inputBg: "#0D0D0D",
};

const iStyle: React.CSSProperties = {
  background: C.inputBg,
  border: `1px solid ${C.chipBorder}`,
  borderRadius: 10,
  color: C.text,
  padding: "9px 11px",
  fontSize: 13,
  outline: "none",
};

export default function FoodFavorites({ userId, currentMealType, onAddFood, onAddCombo, onSetMealType, refreshKey = 0 }: Props) {
  const [favorites, setFavorites] = useState<SavedFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageMode, setManageMode] = useState(false);
  const initialTab = MEAL_TABS.includes(currentMealType as any) ? (currentMealType as string) : "Breakfast";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // ── Create-favorite form state ───────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [fName, setFName] = useState("");
  const [fCal, setFCal] = useState("");
  const [fProtein, setFProtein] = useState("");
  const [fCarbs, setFCarbs] = useState("");
  const [fFat, setFFat] = useState("");
  const [fPhoto, setFPhoto] = useState<string | null>(null); // uploaded URL
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const favs = await fetchSavedFoods(userId);
    setFavorites(favs);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    if (currentMealType && MEAL_TABS.includes(currentMealType as any)) {
      setActiveTab(currentMealType);
    }
  }, [currentMealType]);

  function handleTabClick(tab: string) {
    setActiveTab(tab);
    onSetMealType?.(tab);
  }

  function resetForm() {
    setFName(""); setFCal(""); setFProtein(""); setFCarbs(""); setFFat(""); setFPhoto(null);
  }

  async function handlePhotoPick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        if (!dataUrl) return;
        setUploadingPhoto(true);
        try {
          const compressed = await compressImage(dataUrl);
          const url = await uploadPhoto(compressed, "posts", `${userId}/fav-${Date.now()}.jpg`);
          if (url) setFPhoto(url);
        } catch (e) {
          console.warn("[favorite photo] upload failed", e);
        } finally {
          setUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function handleCreateFavorite() {
    if (!fName.trim() || saving) return;
    setSaving(true);
    try {
      const saved = await saveFood(
        userId,
        {
          name: fName.trim(),
          calories: fCal || "0",
          protein: fProtein || undefined,
          carbs: fCarbs || undefined,
          fat: fFat || undefined,
          photoUrl: fPhoto || undefined,
        },
        activeTab,
      );
      if (saved) {
        resetForm();
        setShowForm(false);
        await load();
      } else {
        // saveFood returns null on duplicate name — surface gently.
        alert("That food may already be saved, or the name is empty.");
      }
    } finally {
      setSaving(false);
    }
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

  const visible = favorites.filter(
    f => f.default_meal_type === activeTab || !f.default_meal_type,
  );

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, display: "flex", alignItems: "center", gap: 5 }}>
          ⭐ Favorites
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => { setShowForm(s => !s); setManageMode(false); }}
            style={{ fontSize: 11, fontWeight: 800, color: C.gold, background: "none", border: "none", cursor: "pointer" }}
          >
            {showForm ? "✕ Cancel" : "+ Add Favorite"}
          </button>
          {favorites.length > 0 ? (
            <button
              onClick={() => { setManageMode(m => !m); setShowForm(false); }}
              style={{ fontSize: 11, fontWeight: 700, color: manageMode ? C.gold : C.sub, background: "none", border: "none", cursor: "pointer" }}
            >
              {manageMode ? "Done" : "Manage"}
            </button>
          ) : null}
        </div>
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

      {/* Create-favorite form */}
      {showForm ? (
        <div style={{ background: C.chip, border: `1.5px solid ${C.gold}`, borderRadius: 14, padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.gold }}>
            New {activeTab} favorite
          </div>
          <input style={iStyle} placeholder="Food name (e.g. 6 eggs w/ Moz cheese)" value={fName} onChange={e => setFName(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...iStyle, flex: 1 }} type="text" inputMode="numeric" placeholder="Calories" value={fCal} onChange={e => setFCal(e.target.value)} />
            <input style={{ ...iStyle, flex: 1 }} type="text" inputMode="decimal" placeholder="Protein (g)" value={fProtein} onChange={e => setFProtein(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...iStyle, flex: 1 }} type="text" inputMode="decimal" placeholder="Carbs (g)" value={fCarbs} onChange={e => setFCarbs(e.target.value)} />
            <input style={{ ...iStyle, flex: 1 }} type="text" inputMode="decimal" placeholder="Fat (g)" value={fFat} onChange={e => setFFat(e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handlePhotoPick}
              disabled={uploadingPhoto}
              style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${C.chipBorder}`, background: "transparent", color: C.blue, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              📷 {uploadingPhoto ? "Uploading…" : fPhoto ? "Change photo" : "Add photo"}
            </button>
            {fPhoto ? <img src={fPhoto} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} /> : null}
          </div>
          <button
            onClick={handleCreateFavorite}
            disabled={!fName.trim() || saving}
            style={{ fontSize: 13, fontWeight: 800, padding: "10px 14px", borderRadius: 10, border: "none", background: !fName.trim() || saving ? "#3A2D5C" : "linear-gradient(135deg, #7C3AED, #A78BFA)", color: "#fff", cursor: !fName.trim() || saving ? "default" : "pointer" }}
          >
            {saving ? "Saving…" : `⭐ Save to ${activeTab}`}
          </button>
        </div>
      ) : null}

      {/* Chips for the active tab */}
      {loading ? (
        <div style={{ padding: "8px 0", fontSize: 12, color: C.sub }}>Loading favorites…</div>
      ) : visible.length === 0 ? (
        !showForm ? (
          <div style={{ padding: "10px 12px", fontSize: 12, color: C.sub, background: C.chip, borderRadius: 12, border: `1px dashed ${C.chipBorder}` }}>
            {favorites.length === 0
              ? "No favorites yet. Tap “+ Add Favorite” to create one, or ⭐ a food below after adding it."
              : `No ${activeTab.toLowerCase()} favorites yet. Tap “+ Add Favorite” to create one.`}
          </div>
        ) : null
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

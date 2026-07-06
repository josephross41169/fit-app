"use client";

// components/FoodFavorites.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Favorites section in the nutrition logging tab, organized by meal type.
//
//   • Tabs: Breakfast · Lunch · Dinner · Snacks. Tapping a tab filters the
//     favorites + switches the post's Meal Type (onSetMealType).
//   • "+ Add Favorite" → inline form to create one from scratch (name,
//     calories, macros, photo); files under the active tab.
//   • Favorites render as PHOTO-FORWARD cards: when a favorite has a photo it
//     shows a large thumbnail on top, name + macros below. Tap a card to add
//     it to the meal being logged (photo auto-attaches to the post).
//   • Manage mode shows ✏️ Edit and 🗑 Delete on each card. Edit opens the
//     same form pre-filled so you can fix a typo / macros / photo.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import {
  fetchSavedFoods,
  saveFood,
  updateSavedFood,
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
  blue: "#5BBE93",
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

  // ── Form state (shared by create + edit) ─────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = create
  const [fName, setFName] = useState("");
  const [fCal, setFCal] = useState("");
  const [fProtein, setFProtein] = useState("");
  const [fCarbs, setFCarbs] = useState("");
  const [fFat, setFFat] = useState("");
  const [fPhoto, setFPhoto] = useState<string | null>(null);
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
    setEditingId(null);
    setFName(""); setFCal(""); setFProtein(""); setFCarbs(""); setFFat(""); setFPhoto(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
    setManageMode(false);
  }

  function openEdit(fav: SavedFood) {
    setEditingId(fav.id);
    setFName(fav.name);
    setFCal(String(fav.calories ?? ""));
    setFProtein(fav.protein ? String(fav.protein) : "");
    setFCarbs(fav.carbs ? String(fav.carbs) : "");
    setFFat(fav.fat ? String(fav.fat) : "");
    setFPhoto(fav.photo_url || null);
    setShowForm(true);
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

  async function handleSubmitForm() {
    if (!fName.trim() || saving) return;
    setSaving(true);
    try {
      if (editingId) {
        // EDIT existing favorite
        const ok = await updateSavedFood(editingId, {
          name: fName,
          calories: fCal || "0",
          protein: fProtein || 0,
          carbs: fCarbs || 0,
          fat: fFat || 0,
          default_meal_type: activeTab,
          photoUrl: fPhoto,
        });
        if (ok) { resetForm(); setShowForm(false); await load(); }
      } else {
        // CREATE new favorite
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
        if (saved) { resetForm(); setShowForm(false); await load(); }
        else alert("That food may already be saved, or the name is empty.");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleTap(fav: SavedFood) {
    if (manageMode) { openEdit(fav); return; } // in manage mode, tapping the card opens the editor (bigger target than the pencil)
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
            onClick={() => (showForm && !editingId ? (setShowForm(false), resetForm()) : openCreate())}
            style={{ fontSize: 11, fontWeight: 800, color: C.gold, background: "none", border: "none", cursor: "pointer" }}
          >
            {showForm && !editingId ? "✕ Cancel" : "+ Add Favorite"}
          </button>
          {favorites.length > 0 ? (
            <button
              onClick={() => { setManageMode(m => !m); setShowForm(false); resetForm(); }}
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
                fontSize: 12, fontWeight: 800, padding: "7px 14px", borderRadius: 20,
                border: active ? "none" : `1.5px solid ${C.chipBorder}`,
                background: active ? "linear-gradient(135deg, #5BBE93, #86CFAE)" : "transparent",
                color: active ? "#fff" : C.sub, cursor: "pointer",
              }}
            >
              {tab}{count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {/* Create / Edit form */}
      {showForm ? (
        <div style={{ background: C.chip, border: `1.5px solid ${C.gold}`, borderRadius: 14, padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.gold }}>
            {editingId ? "Edit favorite" : `New ${activeTab} favorite`}
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
            {fPhoto ? (
              <div style={{ position: "relative" }}>
                <img src={fPhoto} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                <button onClick={() => setFPhoto(null)} title="Remove photo"
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", border: "none", background: "#FF4444", color: "#fff", fontSize: 11, cursor: "pointer", lineHeight: "18px", padding: 0 }}>✕</button>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSubmitForm}
              disabled={!fName.trim() || saving}
              style={{ flex: 1, fontSize: 13, fontWeight: 800, padding: "10px 14px", borderRadius: 10, border: "none", background: !fName.trim() || saving ? "#24382E" : "linear-gradient(135deg, #5BBE93, #86CFAE)", color: "#fff", cursor: !fName.trim() || saving ? "default" : "pointer" }}
            >
              {saving ? "Saving…" : editingId ? "Save changes" : `⭐ Save to ${activeTab}`}
            </button>
            {editingId ? (
              <button onClick={() => { resetForm(); setShowForm(false); }}
                style={{ fontSize: 13, fontWeight: 700, padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${C.chipBorder}`, background: "transparent", color: C.sub, cursor: "pointer" }}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Favorite cards (photo-forward) */}
      {loading ? (
        <div style={{ padding: "8px 0", fontSize: 12, color: C.sub }}>Loading favorites…</div>
      ) : visible.length === 0 ? (
        !showForm ? (
          <div style={{ padding: "10px 12px", fontSize: 12, color: C.sub, background: C.chip, borderRadius: 12, border: `1px dashed ${C.chipBorder}` }}>
            {favorites.length === 0
              ? "No favorites yet. Tap “+ Add Favorite” to create one."
              : `No ${activeTab.toLowerCase()} favorites yet. Tap “+ Add Favorite” to create one.`}
          </div>
        ) : null
      ) : (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
          {/* Compact quick-add row: one swipeable line instead of a wrapping
              grid. The whole card adds the item; the small + badge signals
              tappability without a text row on every card. */}
          {visible.map(fav => (
            <div
              key={fav.id}
              style={{ width: 96, flexShrink: 0, borderRadius: 12, background: C.chip, border: `1px solid ${C.chipBorder}`, overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              <button
                onClick={() => handleTap(fav)}
                style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
              >
                <div style={{ position: "relative", width: "100%", height: 60, background: fav.photo_url ? "#000" : "linear-gradient(135deg,#12291D,#1E5B3F)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {fav.photo_url ? (
                    <img src={fav.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <span style={{ fontSize: 22 }}>{fav.is_meal ? "🍱" : "🍽️"}</span>
                  )}
                  {!manageMode ? (
                    <div style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "#5BBE93", color: "#fff", fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>+</div>
                  ) : null}
                </div>
                <div style={{ padding: "6px 8px 7px" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.text, lineHeight: 1.25, height: 28, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {fav.name}
                  </div>
                  <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginTop: 3 }}>
                    {Math.round(fav.calories)} cal{fav.protein ? <span style={{ color: C.sub, fontWeight: 600 }}>{` · ${Math.round(fav.protein)}g P`}</span> : null}{fav.is_meal ? <span style={{ color: C.sub, fontWeight: 600 }}> · meal</span> : null}
                  </div>
                </div>
              </button>
              {manageMode ? (
                <div style={{ display: "flex", borderTop: `1px solid ${C.chipBorder}` }}>
                  <button onClick={() => openEdit(fav)} title="Edit"
                    style={{ flex: 1, padding: "6px 0", border: "none", background: "transparent", color: C.gold, fontSize: 12, cursor: "pointer" }}>
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(fav.id)} title="Delete"
                    style={{ flex: 1, padding: "6px 0", border: "none", borderLeft: `1px solid ${C.chipBorder}`, background: "transparent", color: "#FF6B6B", fontSize: 12, cursor: "pointer" }}>
                    🗑
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

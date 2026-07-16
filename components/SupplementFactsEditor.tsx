"use client";
// components/SupplementFactsEditor.tsx
// ─────────────────────────────────────────────────────────────────────────────
// One-time "Supplement Facts" editor for a saved supplement. Optional depth:
// casual users never open this; serious users copy their label in once and
// every future one-tap log carries the micros automatically.
//
// Ingredient picker searches lib/nutrients.ts (static, offline, ~35 entries)
// so units and % Daily Value compute themselves.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { NUTRIENTS, searchNutrients, pctDV, type IngredientRow } from "@/lib/nutrients";
import { updateSupplementFacts, type SavedSupplement } from "@/lib/savedSupplements";

const C = {
  card: "#0E1311", cardIn: "#111811", border: "#1B231E", borderIn: "#2A3A2A",
  text: "#F0F0F0", sub: "#9CA3AF", green: "#5BBE93", greenLight: "#86CFAE",
  greenBg: "#12291D", gold: "#F5A623",
};

export default function SupplementFactsEditor({
  supplement,
  onClose,
  onSaved,
}: {
  supplement: SavedSupplement;
  onClose: () => void;
  onSaved: (updated: Partial<SavedSupplement>) => void;
}) {
  const [brand, setBrand] = useState(supplement.brand || "");
  const [servingSize, setServingSize] = useState(supplement.serving_size || "");
  const [rows, setRows] = useState<IngredientRow[]>(supplement.ingredients || []);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const matches = pickerOpen ? searchNutrients(query).filter(n => !rows.some(r => r.key === n.key)).slice(0, 8) : [];

  function addNutrient(key: string) {
    const def = NUTRIENTS.find(n => n.key === key);
    if (!def) return;
    setRows(r => [...r, { key: def.key, name: def.name, amount: 0, unit: def.unit }]);
    setQuery("");
    setPickerOpen(false);
  }

  function setAmount(i: number, v: string) {
    const amount = parseFloat(v);
    setRows(r => r.map((row, j) => (j === i ? { ...row, amount: isNaN(amount) ? 0 : amount } : row)));
  }

  async function save() {
    setSaving(true);
    const cleaned = rows.filter(r => r.amount > 0);
    const ok = await updateSupplementFacts(supplement.id, {
      brand: brand.trim() || null,
      serving_size: servingSize.trim() || null,
      ingredients: cleaned.length > 0 ? cleaned : null,
    });
    setSaving(false);
    if (ok) {
      onSaved({ brand: brand.trim() || null, serving_size: servingSize.trim() || null, ingredients: cleaned.length > 0 ? cleaned : null });
      onClose();
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, width: "100%", maxWidth: 440, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, color: C.text }}>Supplement Facts</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{supplement.name} · optional, one-time setup</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: C.border, color: C.text, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: 0.5, marginBottom: 4 }}>BRAND (optional)</div>
              <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Optimum Nutrition"
                style={{ width: "100%", boxSizing: "border-box", background: C.cardIn, border: `1px solid ${C.borderIn}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: 0.5, marginBottom: 4 }}>SERVING SIZE</div>
              <input value={servingSize} onChange={e => setServingSize(e.target.value)} placeholder="2 tablets"
                style={{ width: "100%", boxSizing: "border-box", background: C.cardIn, border: `1px solid ${C.borderIn}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 14 }} />
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: 0.5, marginBottom: 6 }}>
            INGREDIENTS <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· amounts per serving · %DV computes itself</span>
          </div>

          {rows.map((row, i) => {
            const pct = pctDV(row);
            return (
              <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8, background: C.cardIn, border: `1px solid ${C.borderIn}`, borderRadius: 10, padding: "8px 10px", marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                <input
                  type="number" inputMode="decimal" value={row.amount || ""} onChange={e => setAmount(i, e.target.value)} placeholder="0"
                  style={{ width: 64, background: C.card, border: `1px solid ${C.borderIn}`, borderRadius: 8, padding: "6px 8px", color: C.text, fontSize: 13, textAlign: "right" }} />
                <span style={{ fontSize: 12, color: C.sub, width: 30 }}>{row.unit}</span>
                {pct !== null && row.amount > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.greenLight, background: C.greenBg, borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>{pct}% DV</span>
                )}
                <button onClick={() => setRows(r => r.filter((_, j) => j !== i))} aria-label={`Remove ${row.name}`}
                  style={{ width: 22, height: 22, borderRadius: "50%", border: "none", background: "transparent", color: C.sub, fontSize: 14, cursor: "pointer", padding: 0 }}>×</button>
              </div>
            );
          })}

          {!pickerOpen ? (
            <button onClick={() => setPickerOpen(true)}
              style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: `1.5px dashed ${C.borderIn}`, background: "transparent", color: C.green, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              + Add ingredient
            </button>
          ) : (
            <div style={{ border: `1px solid ${C.borderIn}`, borderRadius: 10, overflow: "hidden" }}>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search — vitamin d, magnesium, creatine..."
                style={{ width: "100%", boxSizing: "border-box", background: C.cardIn, border: "none", borderBottom: `1px solid ${C.borderIn}`, padding: "10px 12px", color: C.text, fontSize: 14 }} />
              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                {matches.map(n => (
                  <button key={n.key} onClick={() => addNutrient(n.key)}
                    style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "10px 12px", border: "none", borderBottom: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 13, cursor: "pointer", textAlign: "left" }}>
                    <span>{n.name}</span>
                    <span style={{ color: C.sub, fontSize: 12 }}>{n.dv !== null ? `DV ${n.dv} ${n.unit}` : n.unit}</span>
                  </button>
                ))}
                {matches.length === 0 && <div style={{ padding: "12px", fontSize: 12, color: C.sub }}>No matches — all added or try another spelling.</div>}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={save} disabled={saving}
            style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: saving ? "#24382E" : "linear-gradient(135deg,#5BBE93,#86CFAE)", color: "#04342C", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
            {saving ? "Saving..." : "Save facts"}
          </button>
        </div>
      </div>
    </div>
  );
}

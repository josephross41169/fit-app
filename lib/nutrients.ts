// lib/nutrients.ts
// ─────────────────────────────────────────────────────────────────────────────
// Reference data for the supplement tracker: the standard nutrients a label
// can contain, each with its canonical unit, FDA adult Daily Value (DV), and —
// where one is established — the tolerable Upper Intake Level (UL).
//
// Static by design: no API, works offline, and the numbers are regulatory
// constants that change rarely. Sources: FDA DV tables (adults, 2016 final
// rule) and NIH ODS ULs. `dv: null` = no official DV (e.g. creatine) — the
// dashboard shows the raw amount instead of a percentage for those.
// ─────────────────────────────────────────────────────────────────────────────

export type NutrientUnit = "mg" | "mcg" | "g" | "IU";

export interface NutrientDef {
  key: string;          // stable identifier stored in saved facts
  name: string;         // display name
  unit: NutrientUnit;   // canonical label unit
  dv: number | null;    // adult daily value in `unit` (null = no DV)
  ul: number | null;    // tolerable upper limit in `unit` (null = none set)
}

export const NUTRIENTS: NutrientDef[] = [
  // ── Vitamins ──
  { key: "vitamin_a",     name: "Vitamin A",          unit: "mcg", dv: 900,  ul: 3000 },
  { key: "vitamin_c",     name: "Vitamin C",          unit: "mg",  dv: 90,   ul: 2000 },
  { key: "vitamin_d",     name: "Vitamin D (D3/D2)",  unit: "mcg", dv: 20,   ul: 100 },
  { key: "vitamin_e",     name: "Vitamin E",          unit: "mg",  dv: 15,   ul: 1000 },
  { key: "vitamin_k",     name: "Vitamin K",          unit: "mcg", dv: 120,  ul: null },
  { key: "thiamin",       name: "Thiamin (B1)",       unit: "mg",  dv: 1.2,  ul: null },
  { key: "riboflavin",    name: "Riboflavin (B2)",    unit: "mg",  dv: 1.3,  ul: null },
  { key: "niacin",        name: "Niacin (B3)",        unit: "mg",  dv: 16,   ul: 35 },
  { key: "vitamin_b6",    name: "Vitamin B6",         unit: "mg",  dv: 1.7,  ul: 100 },
  { key: "folate",        name: "Folate (B9)",        unit: "mcg", dv: 400,  ul: 1000 },
  { key: "vitamin_b12",   name: "Vitamin B12",        unit: "mcg", dv: 2.4,  ul: null },
  { key: "biotin",        name: "Biotin (B7)",        unit: "mcg", dv: 30,   ul: null },
  { key: "pantothenic",   name: "Pantothenic acid (B5)", unit: "mg", dv: 5,  ul: null },
  { key: "choline",       name: "Choline",            unit: "mg",  dv: 550,  ul: 3500 },
  // ── Minerals ──
  { key: "calcium",       name: "Calcium",            unit: "mg",  dv: 1300, ul: 2500 },
  { key: "iron",          name: "Iron",               unit: "mg",  dv: 18,   ul: 45 },
  { key: "magnesium",     name: "Magnesium",          unit: "mg",  dv: 420,  ul: 350 }, // UL applies to supplemental Mg only
  { key: "zinc",          name: "Zinc",               unit: "mg",  dv: 11,   ul: 40 },
  { key: "selenium",      name: "Selenium",           unit: "mcg", dv: 55,   ul: 400 },
  { key: "copper",        name: "Copper",             unit: "mg",  dv: 0.9,  ul: 10 },
  { key: "manganese",     name: "Manganese",          unit: "mg",  dv: 2.3,  ul: 11 },
  { key: "chromium",      name: "Chromium",           unit: "mcg", dv: 35,   ul: null },
  { key: "molybdenum",    name: "Molybdenum",         unit: "mcg", dv: 45,   ul: 2000 },
  { key: "iodine",        name: "Iodine",             unit: "mcg", dv: 150,  ul: 1100 },
  { key: "potassium",     name: "Potassium",          unit: "mg",  dv: 4700, ul: null },
  { key: "sodium",        name: "Sodium",             unit: "mg",  dv: 2300, ul: 2300 },
  { key: "phosphorus",    name: "Phosphorus",         unit: "mg",  dv: 1250, ul: 4000 },
  // ── Performance & other common label items (no official DV) ──
  { key: "creatine",      name: "Creatine monohydrate", unit: "g", dv: null, ul: null },
  { key: "caffeine",      name: "Caffeine",           unit: "mg",  dv: null, ul: 400 }, // FDA guidance for healthy adults
  { key: "omega3_epa",    name: "Omega-3 EPA",        unit: "mg",  dv: null, ul: null },
  { key: "omega3_dha",    name: "Omega-3 DHA",        unit: "mg",  dv: null, ul: null },
  { key: "beta_alanine",  name: "Beta-alanine",       unit: "g",   dv: null, ul: null },
  { key: "l_citrulline",  name: "L-citrulline",       unit: "g",   dv: null, ul: null },
  { key: "ashwagandha",   name: "Ashwagandha",        unit: "mg",  dv: null, ul: null },
  { key: "melatonin",     name: "Melatonin",          unit: "mg",  dv: null, ul: null },
  { key: "collagen",      name: "Collagen",           unit: "g",   dv: null, ul: null },
  { key: "protein",       name: "Protein",            unit: "g",   dv: 50,   ul: null },
];

const byKey = new Map(NUTRIENTS.map(n => [n.key, n]));
export function nutrientByKey(key: string): NutrientDef | undefined {
  return byKey.get(key);
}

// Search by name for the ingredient picker (case-insensitive substring).
export function searchNutrients(q: string): NutrientDef[] {
  const t = q.trim().toLowerCase();
  if (!t) return NUTRIENTS;
  return NUTRIENTS.filter(n => n.name.toLowerCase().includes(t) || n.key.includes(t));
}

// One ingredient row as stored on a saved supplement (and snapshotted onto
// activity logs). Amount is per ONE serving.
export interface IngredientRow {
  key: string;
  name: string;
  amount: number;
  unit: NutrientUnit;
}

// % of daily value, or null when the nutrient has no DV.
export function pctDV(row: IngredientRow): number | null {
  const def = byKey.get(row.key);
  if (!def || def.dv === null || def.dv === 0) return null;
  return Math.round((row.amount / def.dv) * 100);
}

// Whether a daily TOTAL amount exceeds the nutrient's upper limit.
export function overUL(key: string, totalAmount: number): boolean {
  const def = byKey.get(key);
  return !!(def && def.ul !== null && totalAmount > def.ul);
}

export function fmtAmount(amount: number, unit: string): string {
  const v = amount >= 100 ? Math.round(amount) : Math.round(amount * 10) / 10;
  return `${v} ${unit}`;
}

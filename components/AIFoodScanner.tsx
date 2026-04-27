"use client";
// ── components/AIFoodScanner.tsx ────────────────────────────────────────────
// Modal that handles the full AI food scan flow:
//   1. User picks a photo (camera or library)
//   2. We compress + base64-encode it client-side
//   3. POST to /api/ai-food-scan (server enforces caps)
//   4. Show editable preview of what AI detected
//   5. On confirm → callback with food items + photo dataUrl
//      Parent (post page) merges items into the food log AND sets the
//      log's nutrition photo to the same image.

import { useRef, useState } from "react";
import { compressImage } from "@/lib/compressImage";

// ── Types matching the API response ─────────────────────────────────────────
type ScanItem = {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type ScanResult = {
  items: ScanItem[];
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
  confidence: "low" | "medium" | "high";
  notes: string;
};

// ── Output to parent: shape the post page's foodItems array expects ────────
export type ScannedFoodItem = {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  servingSize?: string;
  qty?: string;
};

interface Props {
  userId: string;
  onClose: () => void;
  // Parent receives: array of food items to merge in + the photo dataUrl
  // (which the parent should set as nutPhoto for the log)
  onResult: (items: ScannedFoodItem[], photoDataUrl: string) => void;
}

const C = {
  bg: "#0D0D0D",
  card: "#1A1228",
  border: "#2D1F52",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  purple: "#7C3AED",
  purpleLight: "#A78BFA",
  green: "#16A34A",
  amber: "#F5A623",
  red: "#EF4444",
};

export default function AIFoodScanner({ userId, onClose, onResult }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ used: number; remaining: number; limit: number } | null>(null);

  // ── Photo selection → compress → base64 → API call ────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // Show local preview while we work
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rawDataUrl = ev.target?.result as string;
      setPhotoDataUrl(rawDataUrl); // immediate preview
      setError(null);
      setResult(null);
      setScanning(true);

      try {
        // Compress to keep upload small + cheaper to send
        const compressedFile = await compressImage(rawDataUrl);
        // Read the compressed File as a dataUrl for both the API + preview
        const compressedDataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(new Error("Could not read compressed image"));
          r.readAsDataURL(compressedFile);
        });
        // Strip the data URL prefix to get pure base64
        const base64 = compressedDataUrl.replace(/^data:image\/\w+;base64,/, "");
        const mediaType = compressedDataUrl.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

        // Save the compressed version as our final photo (smaller for upload)
        setPhotoDataUrl(compressedDataUrl);

        const res = await fetch("/api/ai-food-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            imageBase64: base64,
            mediaType,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          // Server returned a structured error — surface its message
          setError(data.message || data.error || "Couldn't scan that photo.");
          return;
        }

        setResult(data.nutrition as ScanResult);
        if (data.quota) {
          setQuota({
            used: data.quota.scans_used_today,
            remaining: data.quota.scans_remaining_today,
            limit: data.quota.daily_limit,
          });
        }
      } catch (err: any) {
        setError(err?.message || "Something went wrong. Try again or log manually.");
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(f);
    e.target.value = ""; // allow re-picking the same file
  };

  // ── Update an item's field while the user reviews ────────────────────
  const updateItem = (idx: number, field: keyof ScanItem, value: string | number) => {
    if (!result) return;
    const newItems = [...result.items];
    (newItems[idx] as any)[field] = value;
    setResult({ ...result, items: newItems });
  };

  const removeItem = (idx: number) => {
    if (!result) return;
    setResult({ ...result, items: result.items.filter((_, i) => i !== idx) });
  };

  // ── Confirm → push items + photo back to parent, close modal ──────────
  const confirm = () => {
    if (!result || !photoDataUrl) return;
    const items: ScannedFoodItem[] = result.items.map((it) => ({
      name: it.name,
      calories: String(Math.round(it.calories || 0)),
      protein: String(Math.round(it.protein_g || 0)),
      carbs: String(Math.round(it.carbs_g || 0)),
      fat: String(Math.round(it.fat_g || 0)),
      servingSize: it.portion || "",
      qty: "1",
    }));
    onResult(items, photoDataUrl);
    onClose();
  };

  // ── Reset to scan a different photo ───────────────────────────────────
  const tryAgain = () => {
    setResult(null);
    setError(null);
    setPhotoDataUrl(null);
    fileRef.current?.click();
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, zIndex: 1000,
      }}
    >
      <div
        style={{
          background: C.bg, borderRadius: 20, border: `1.5px solid ${C.border}`,
          maxWidth: 540, width: "100%", maxHeight: "92vh", overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🤖</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 17, color: C.text }}>AI Food Scanner</div>
              <div style={{ fontSize: 11, color: C.sub }}>Snap a photo, we'll do the rest</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, fontSize: 24, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* ── State: nothing picked yet ─────────────────────────── */}
          {!photoDataUrl && !scanning && !result && !error && (
            <>
              <div style={{ background: C.card, border: `1.5px dashed ${C.border}`, borderRadius: 16, padding: "40px 24px", textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>📸</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>Take or upload a photo</div>
                <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 18 }}>
                  Get the food clearly in frame. Better light + closer shot = better accuracy.
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    padding: "12px 28px", borderRadius: 14, border: "none",
                    background: `linear-gradient(135deg, ${C.purple}, ${C.purpleLight})`,
                    color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer",
                  }}
                >
                  📷 Choose Photo
                </button>
              </div>
              <div style={{ background: "rgba(245,166,35,0.08)", border: `1px solid rgba(245,166,35,0.3)`, borderRadius: 12, padding: "10px 14px", fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
                <strong>Heads up:</strong> AI estimates are approximate. You'll be able to edit everything before saving. Limit: 3 scans/day.
              </div>
            </>
          )}

          {/* ── State: scanning ───────────────────────────────────── */}
          {scanning && (
            <div style={{ textAlign: "center", padding: "24px 8px" }}>
              {photoDataUrl && (
                <img src={photoDataUrl} alt="" style={{ width: "100%", maxWidth: 320, borderRadius: 14, marginBottom: 18, objectFit: "cover", maxHeight: 260 }} />
              )}
              <div style={{ width: 32, height: 32, borderRadius: "50%", border: `4px solid ${C.border}`, borderTopColor: C.purple, animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>Analyzing photo…</div>
              <div style={{ fontSize: 12, color: C.sub }}>Usually takes 3–6 seconds</div>
            </div>
          )}

          {/* ── State: error ──────────────────────────────────────── */}
          {error && !scanning && (
            <div style={{ textAlign: "center", padding: "20px 8px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 8 }}>Couldn't scan</div>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 20, maxWidth: 360, margin: "0 auto 20px" }}>
                {error}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={tryAgain} style={{ padding: "10px 22px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: "transparent", color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Try Another Photo
                </button>
                <button onClick={onClose} style={{ padding: "10px 22px", borderRadius: 12, border: "none", background: C.purple, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Log Manually
                </button>
              </div>
            </div>
          )}

          {/* ── State: result preview (editable) ──────────────────── */}
          {result && !scanning && (
            <>
              {photoDataUrl && (
                <img src={photoDataUrl} alt="" style={{ width: "100%", borderRadius: 14, marginBottom: 14, objectFit: "cover", maxHeight: 220 }} />
              )}

              {/* Confidence + notes */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 99,
                  background: result.confidence === "high" ? "rgba(22,163,74,0.18)" : result.confidence === "medium" ? "rgba(245,166,35,0.18)" : "rgba(239,68,68,0.18)",
                  color: result.confidence === "high" ? "#4ADE80" : result.confidence === "medium" ? C.amber : "#FCA5A5",
                  textTransform: "uppercase", letterSpacing: 0.6,
                }}>
                  {result.confidence} confidence
                </span>
                {quota && (
                  <span style={{ fontSize: 11, color: C.sub }}>
                    {quota.remaining} of {quota.limit} scans left today
                  </span>
                )}
              </div>
              {result.notes && (
                <div style={{ fontSize: 12, color: C.sub, fontStyle: "italic", marginBottom: 14, lineHeight: 1.5 }}>
                  AI says: {result.notes}
                </div>
              )}

              {/* Totals card */}
              <div style={{ background: C.card, borderRadius: 14, padding: 14, border: `1px solid ${C.border}`, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Estimated Totals</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { label: "Cal", val: Math.round(result.totals.calories), color: C.purple },
                    { label: "P", val: Math.round(result.totals.protein_g) + "g", color: "#4ADE80" },
                    { label: "C", val: Math.round(result.totals.carbs_g) + "g", color: C.amber },
                    { label: "F", val: Math.round(result.totals.fat_g) + "g", color: "#F472B6" },
                  ].map((m) => (
                    <div key={m.label} style={{ background: C.bg, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: C.sub, fontWeight: 700, textTransform: "uppercase" }}>{m.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: m.color }}>{m.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Item list — editable */}
              <div style={{ fontSize: 12, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
                Items ({result.items.length}) — tap to edit
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {result.items.map((it, i) => (
                  <div key={i} style={{ background: C.card, borderRadius: 12, padding: 10, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <input
                        value={it.name}
                        onChange={(e) => updateItem(i, "name", e.target.value)}
                        placeholder="Food name"
                        style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, color: C.text, outline: "none" }}
                      />
                      <input
                        value={it.portion}
                        onChange={(e) => updateItem(i, "portion", e.target.value)}
                        placeholder="Portion"
                        style={{ width: 90, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, color: C.sub, outline: "none" }}
                      />
                      <button
                        onClick={() => removeItem(i)}
                        title="Remove"
                        style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 10px", color: C.red, cursor: "pointer", fontSize: 14 }}
                      >×</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                      {[
                        { f: "calories" as const, label: "Cal" },
                        { f: "protein_g" as const, label: "P (g)" },
                        { f: "carbs_g" as const, label: "C (g)" },
                        { f: "fat_g" as const, label: "F (g)" },
                      ].map((m) => (
                        <div key={m.f}>
                          <div style={{ fontSize: 9, color: C.sub, marginBottom: 2, fontWeight: 700, textTransform: "uppercase" }}>{m.label}</div>
                          <input
                            type="number"
                            value={(it as any)[m.f] || 0}
                            onChange={(e) => updateItem(i, m.f, parseFloat(e.target.value) || 0)}
                            style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, color: C.text, outline: "none", boxSizing: "border-box" }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={tryAgain} style={{ padding: "12px 18px", borderRadius: 14, border: `1.5px solid ${C.border}`, background: "transparent", color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Retake
                </button>
                <button
                  onClick={confirm}
                  disabled={result.items.length === 0}
                  style={{
                    flex: 1, padding: "12px 18px", borderRadius: 14, border: "none",
                    background: result.items.length === 0 ? C.border : `linear-gradient(135deg, ${C.green}, #22C55E)`,
                    color: "#fff", fontWeight: 800, fontSize: 14,
                    cursor: result.items.length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  ✓ Add to Log
                </button>
              </div>
            </>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}

// Timed sets (planks, ab circuits, carries…) store the set length as total
// SECONDS in the reps slot. These helpers turn that into what people expect
// to read and type: "45s", "10 min", "1:30".

/** Format a stored seconds value for display. Non-numbers pass through. */
export function fmtTimedSec(v: unknown): string {
  const s = String(v ?? "").trim();
  const n = parseInt(s, 10);
  if (!s || isNaN(n)) return s || "—";
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60), r = n % 60;
  return r === 0 ? `${m} min` : `${m}:${String(r).padStart(2, "0")}`;
}

/** Split stored seconds into minute/second input strings ("" when empty). */
export function splitTimedSec(v: unknown): { min: string; sec: string } {
  const n = parseInt(String(v ?? ""), 10);
  if (isNaN(n) || n <= 0) return { min: "", sec: "" };
  const m = Math.floor(n / 60), r = n % 60;
  return { min: m ? String(m) : "", sec: r ? String(r) : (m ? "" : "0") };
}

/** Combine minute/second input strings into stored seconds ("" when both empty). */
export function joinTimedSec(min: string, sec: string): string {
  const m = parseInt(min.replace(/\D/g, ""), 10);
  const s = parseInt(sec.replace(/\D/g, ""), 10);
  if (isNaN(m) && isNaN(s)) return "";
  return String((isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s));
}

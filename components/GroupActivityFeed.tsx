"use client";
// ─────────────────────────────────────────────────────────────────────────────
// Group "Activity" feed — one box per member per day, built from the
// members' PUBLIC activity_logs (last 14 days). Each box shows who, when and
// a short summary; tapping it opens the full daily card (exercises, cardio,
// wellness, meals, notes, photos).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { wellnessLabel, autoWellnessStyle, isAppleHealth, APPLE_HEALTH_LABEL } from "@/lib/wellnessLabels";

export type FeedMember = { userId: string | null; name: string; username?: string | null; avatarUrl?: string | null; avatar?: string };

const C = { card: "#161D19", border: "#232C27", text: "#F0F0F0", sub: "#9CA3AF", green: "#5BBE93", soft: "#86CFAE", gold: "#F5C451", blue: "#5BC8E0", bg: "#0E1311" };
const DAYS_BACK = 14;

const WELL_EMOJI: [RegExp, string][] = [
  [/cold|ice|cryo/i, "❄️"], [/infrared/i, "🌅"], [/sauna|steam/i, "🔥"], [/medit|breath/i, "🧘"], [/yoga|stretch|mobility/i, "🤸"],
  [/sleep|nap/i, "😴"], [/massage|recovery|foam/i, "💆"], [/red light/i, "🔴"], [/walk/i, "🚶"], [/fast/i, "⏳"], [/journal|gratitude/i, "📓"],
];
const wellEmoji = (t: string) => autoWellnessStyle(t)?.emoji || (WELL_EMOJI.find(([re]) => re.test(t)) || [null, "🌿"])[1] as string;
const CARDIO_EMOJI: Record<string, string> = { running: "🏃", walking: "🚶", biking: "🚴", cycling: "🚴", swimming: "🏊", rowing: "🚣", hiking: "🥾", hiit: "⚡", elliptical: "🔁" };
const cap = (s: string) => (s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const r1 = (n: number) => Math.round(n * 10) / 10;

function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function dayLabel(d: Date) {
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return "Today";
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function photosOf(l: any): string[] {
  const raw = l.photo_url;
  if (!raw) return [];
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try { return Object.values(JSON.parse(raw)).filter((u: any) => typeof u === "string" && u.startsWith("http")) as string[]; } catch { return []; }
  }
  return typeof raw === "string" && raw.startsWith("http") ? [raw] : [];
}
function setsLine(ex: any): string {
  if (ex?.isCircuit) return ex.circuitMinutes ? `${ex.circuitMinutes} min circuit` : "Circuit";
  const n = parseInt(ex?.sets) || 0;
  const reps: string[] = Array.isArray(ex?.repsArr) && ex.repsArr.length ? ex.repsArr : Array(n).fill(ex?.reps || "");
  const ws: string[] = Array.isArray(ex?.weights) ? ex.weights : [];
  const parts = Array.from({ length: n }, (_, k) => {
    const r = String(reps[k] || ex?.reps || "").trim(); const w = String((ws.length ? ws[k] : ex?.weight) || "").trim();
    if (!r) return "";
    if (ex?.timed) return `${r}s`;
    return ex?.bodyweight || !w ? r : `${r}×${w}`;
  }).filter(Boolean);
  return parts.length ? parts.join(" · ") : `${n} sets`;
}

type DayCard = { key: string; member: FeedMember; date: Date; logs: any[] };

function summarize(card: DayCard): { e: string; t: string }[] {
  const out: { e: string; t: string }[] = [];
  const workouts = card.logs.filter(l => l.log_type === "workout");
  const exCount = workouts.reduce((s, w) => s + (Array.isArray(w.exercises) ? w.exercises.filter((x: any) => x?.name).length : 0), 0);
  if (exCount) out.push({ e: "💪", t: `${exCount} exercise${exCount === 1 ? "" : "s"}${workouts[0]?.workout_type && !/^workout$/i.test(workouts[0].workout_type) ? ` · ${workouts[0].workout_type}` : ""}` });
  const cardio = workouts.flatMap(w => (Array.isArray(w.cardio) ? w.cardio : []).filter(Boolean));
  if (cardio.length) {
    const first = cardio[0]; const miles = cardio.reduce((s: number, c: any) => s + (parseFloat(c.distance) || 0), 0);
    out.push({ e: CARDIO_EMOJI[String(first.type || "").toLowerCase()] || "🏃", t: `${cap(first.type || "Cardio")}${cardio.length > 1 ? ` +${cardio.length - 1}` : ""}${miles ? ` · ${r1(miles)} mi` : first.duration ? ` · ${Math.round(first.duration)} min` : ""}` });
  } else {
    const other = workouts.find(w => !exCount && w.workout_category && w.workout_category !== "lifting");
    if (other) out.push({ e: "⚡", t: `${cap(other.workout_category)}${other.workout_duration_min ? ` · ${other.workout_duration_min} min` : ""}` });
  }
  const well = card.logs.filter(l => l.log_type === "wellness");
  if (well.length) out.push({ e: wellEmoji(well[0].wellness_type || ""), t: well.map(w => wellnessLabel(w.wellness_type)).slice(0, 2).join(", ") + (well.length > 2 ? ` +${well.length - 2}` : "") });
  const meals = card.logs.filter(l => l.log_type === "nutrition");
  if (meals.length) {
    const cal = meals.reduce((s, m) => s + (Number(m.calories_total) || 0), 0);
    out.push({ e: "🥗", t: `${meals.length} meal${meals.length === 1 ? "" : "s"}${cal ? ` · ${Math.round(cal)} cal` : ""}` });
  }
  return out;
}

function Avatar({ m, size }: { m: FeedMember; size: number }) {
  const initials = (m.avatar || m.name || "?").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#5BBE93,#2E7D5B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 900, color: "#fff", flexShrink: 0, overflow: "hidden" }}>
      {m.avatarUrl && m.avatarUrl.startsWith("http") ? <img src={m.avatarUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
    </div>
  );
}

export default function GroupActivityFeed({ members, accent = C.green }: { members: FeedMember[]; accent?: string }) {
  const router = useRouter();
  const [logs, setLogs] = useState<any[] | null>(null);
  const [open, setOpen] = useState<DayCard | null>(null);
  const [showAll, setShowAll] = useState(false);
  const ids = useMemo(() => members.map(m => m.userId).filter(Boolean) as string[], [members]);
  const idKey = ids.join(",");

  useEffect(() => {
    if (!ids.length) { setLogs([]); return; }
    let cancelled = false;
    const since = new Date(); since.setDate(since.getDate() - DAYS_BACK); since.setHours(0, 0, 0, 0);
    supabase.from("activity_logs")
      .select("id, user_id, log_type, logged_at, workout_type, workout_category, workout_duration_min, exercises, cardio, wellness_type, wellness_duration_min, external_source, meal_type, food_items, calories_total, protein_g, notes, photo_url, supplements")
      .in("user_id", ids).eq("is_public", true).gte("logged_at", since.toISOString())
      .order("logged_at", { ascending: false }).limit(400)
      .then(({ data }) => { if (!cancelled) setLogs(data || []); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const cards: DayCard[] = useMemo(() => {
    const byId = new Map(members.filter(m => m.userId).map(m => [m.userId as string, m]));
    const map = new Map<string, DayCard>();
    (logs || []).forEach(l => {
      const m = byId.get(l.user_id); if (!m) return;
      const d = new Date(l.logged_at); const k = `${l.user_id}|${dayKey(d)}`;
      if (!map.has(k)) map.set(k, { key: k, member: m, date: d, logs: [] });
      map.get(k)!.logs.push(l);
    });
    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [logs, members]);

  const visible = showAll ? cards : cards.slice(0, 12);

  return (
    <div>
      <style>{`
        .gaf-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 767px) { .gaf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
        .gaf-box { min-width: 0; text-align: left; background: ${C.card}; border: 1.5px solid ${C.border}; border-radius: 16px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 8px; color: ${C.text}; transition: border-color .15s, transform .12s; min-height: 150px; }
        .gaf-box:hover { border-color: ${accent}; }
        .gaf-box:active { transform: scale(0.98); }
      `}</style>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 17, color: C.text }}>📋 Member activity</div>
        <div style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>Last {DAYS_BACK} days · tap a box</div>
      </div>

      {logs === null ? (
        <div className="gaf-grid">{[0, 1, 2].map(i => <div key={i} className="gaf-box" style={{ opacity: 0.4, cursor: "default" }} />)}</div>
      ) : cards.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 16px", color: C.sub, background: C.card, border: `1.5px dashed ${C.border}`, borderRadius: 16 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 800, color: C.text, marginBottom: 4 }}>No activity yet</div>
          <div style={{ fontSize: 13 }}>When members log workouts, meals or wellness, their daily cards show up here.</div>
        </div>
      ) : (
        <>
          <div className="gaf-grid">
            {visible.map(card => {
              const lines = summarize(card);
              const pics = card.logs.flatMap(photosOf);
              return (
                <button key={card.key} className="gaf-box" onClick={() => setOpen(card)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                    <Avatar m={card.member} size={30} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.member.name}</div>
                      <div style={{ fontSize: 10.5, color: accent, fontWeight: 700 }}>{dayLabel(card.date)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                    {lines.slice(0, 3).map((x, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 700, color: C.text, minWidth: 0 }}>
                        <span style={{ flexShrink: 0 }}>{x.e}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.t}</span>
                      </div>
                    ))}
                    {lines.length > 3 && <div style={{ fontSize: 11, color: C.sub }}>+{lines.length - 3} more</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", fontSize: 10.5, color: C.sub, fontWeight: 700 }}>
                    <span>{pics.length ? `📸 ${pics.length}` : ""}</span>
                    <span style={{ color: accent }}>View ›</span>
                  </div>
                </button>
              );
            })}
          </div>
          {cards.length > 12 && (
            <button onClick={() => setShowAll(s => !s)} style={{ width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 12, border: `1.5px solid ${C.border}`, background: "transparent", color: C.text, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              {showAll ? "Show less" : `Show all ${cards.length} cards`}
            </button>
          )}
        </>
      )}

      {open && <DayDetail card={open} accent={accent} onClose={() => setOpen(null)} onProfile={() => { const u = open.member.username; setOpen(null); router.push(u ? `/profile/${u}` : "/profile"); }} />}
    </div>
  );
}

function DayDetail({ card, accent, onClose, onProfile }: { card: DayCard; accent: string; onClose: () => void; onProfile: () => void }) {
  const workouts = card.logs.filter(l => l.log_type === "workout");
  const exercises = workouts.flatMap(w => (Array.isArray(w.exercises) ? w.exercises : []).filter((x: any) => x?.name));
  const cardio = workouts.flatMap(w => (Array.isArray(w.cardio) ? w.cardio : []).filter(Boolean));
  const others = workouts.filter(w => !(w.exercises || []).length && !(w.cardio || []).length && w.workout_category);
  const well = card.logs.filter(l => l.log_type === "wellness");
  const meals = card.logs.filter(l => l.log_type === "nutrition");
  const notes = card.logs.filter(l => !isAppleHealth(l)).map(l => (l.notes || "").trim()).filter(Boolean).filter(n => !well.some(w => w.wellness_type === n));
  const pics = Array.from(new Set(card.logs.flatMap(photosOf)));
  const sec = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 } as const;
  const h = { fontWeight: 900, fontSize: 14, color: C.text, marginBottom: 10 } as const;
  const totalSets = exercises.reduce((s, x: any) => s + (parseInt(x.sets) || 0), 0);
  const dur = workouts.reduce((s, w) => s + (Number(w.workout_duration_min) || 0), 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Activity card"
        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, width: "100%", maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <Avatar m={card.member} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.member.name}</div>
            <div style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{card.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#232C27", color: C.text, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {exercises.length > 0 && (
            <div style={sec}>
              <div style={{ ...h, display: "flex", justifyContent: "space-between" }}>
                <span>💪 Workout{workouts[0]?.workout_type && !/^workout$/i.test(workouts[0].workout_type) ? ` · ${workouts[0].workout_type}` : ""}</span>
                <span style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>{totalSets} sets{dur ? ` · ${dur} min` : ""}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {exercises.map((x: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 10px", borderRadius: 10, background: i % 2 ? "transparent" : "#141C18" }}>
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 13, color: C.text }}>{x.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.gold, textAlign: "right" }}>{setsLine(x)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(cardio.length > 0 || others.length > 0) && (
            <div style={sec}>
              <div style={h}>🏃 Cardio</div>
              {cardio.map((c: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: C.text, padding: "4px 0" }}>
                  <span>{CARDIO_EMOJI[String(c.type || "").toLowerCase()] || "🏃"} {cap(c.type || "Cardio")}</span>
                  <span style={{ color: C.blue }}>{[c.distance ? `${c.distance} ${/swim/i.test(c.type || "") ? "" : "mi"}`.trim() : "", c.duration ? `${Math.round(c.duration)} min` : ""].filter(Boolean).join(" · ")}</span>
                </div>
              ))}
              {others.map((w: any) => (
                <div key={w.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: C.text, padding: "4px 0" }}>
                  <span>⚡ {cap(w.workout_category)}</span><span style={{ color: C.blue }}>{w.workout_duration_min ? `${w.workout_duration_min} min` : ""}</span>
                </div>
              ))}
            </div>
          )}
          {well.length > 0 && (
            <div style={sec}>
              <div style={h}>🧘 Wellness</div>
              {well.map((w: any) => (
                <div key={w.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: C.text, padding: "4px 0" }}>
                  <span>{wellEmoji(w.wellness_type || "")} {wellnessLabel(w.wellness_type)}{isAppleHealth(w) && <span style={{ display: "block", fontSize: 11, color: "#F472B6", fontWeight: 700, marginTop: 2 }}>❤️ {APPLE_HEALTH_LABEL}</span>}</span>
                  <span style={{ color: C.soft }}>{w.wellness_duration_min ? `${w.wellness_duration_min} min` : isAppleHealth(w) ? (w.notes || "") : ""}</span>
                </div>
              ))}
            </div>
          )}
          {meals.length > 0 && (
            <div style={sec}>
              <div style={h}>🥗 Meals</div>
              {meals.map((m: any) => {
                const foods = (Array.isArray(m.food_items) ? m.food_items : []).map((f: any) => f?.name).filter(Boolean);
                const supps = (Array.isArray(m.supplements) ? m.supplements : []).map((s: any) => s?.name).filter(Boolean);
                return (
                  <div key={m.id} style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, color: C.text }}>
                      <span>{m.meal_type || "Meal"}</span>
                      <span style={{ color: C.gold }}>{m.calories_total ? `${Math.round(m.calories_total)} cal` : ""}{m.protein_g ? ` · ${Math.round(m.protein_g)}g P` : ""}</span>
                    </div>
                    {(foods.length > 0 || supps.length > 0) && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{[...foods, ...supps.map((s: string) => `💊 ${s}`)].join(" · ")}</div>}
                  </div>
                );
              })}
            </div>
          )}
          {notes.length > 0 && (
            <div style={sec}>
              <div style={h}>📝 Notes</div>
              {notes.map((n, i) => <div key={i} style={{ fontSize: 13, color: C.text, lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 6 }}>{n}</div>)}
            </div>
          )}
          {pics.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {pics.map(u => <img key={u} src={u} alt="" loading="lazy" style={{ width: "100%", borderRadius: 12, display: "block" }} />)}
            </div>
          )}
          <button onClick={onProfile} style={{ padding: "12px 0", borderRadius: 14, border: "none", background: `linear-gradient(135deg,${accent},#86CFAE)`, color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>
            View {card.member.name.split(" ")[0]}'s profile →
          </button>
        </div>
      </div>
    </div>
  );
}

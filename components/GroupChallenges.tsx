"use client";
// ─── Group Challenges (v2) ──────────────────────────────────────────────────
// Box on the group page (between Group Goals and Group Wars). Owner/mods
// create challenges (popular presets or "Make your own" with tasks + points);
// members join before the start date; staff can add people any time.
// Tapping a challenge opens a full-screen details page with the leaderboard.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  PRESETS, PRESET_BY_ID, TASKS, TASK_BY_KEY, addDays, daysBetween, pointsSummary,
  type DailyTask, type PointsTask, type Preset,
} from "@/lib/groupChallenges";

type Member = { userId: string | null; name: string; username?: string | null; avatarUrl?: string | null };
type Props = {
  groupId: string;
  isStaff: boolean;
  isMember: boolean;
  currentUserId: string | null;
  members: Member[];
};

const G = {
  bg: "#0E1311", card: "#161D19", border: "#2A3A2A", line: "#1B231E", green: "#1F5F3F",
  accent: "#4A9D6E", light: "#7FBF98", gold: "#F5A623", text: "#F0F0F0", sub: "#9CA3AF", soft: "#C8D3CC",
};
const GRAD = "linear-gradient(135deg,#1F5F3F,#4A9D6E)";

async function api(action: string, payload: any): Promise<any> {
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  } catch {}
  const res = await fetch("/api/db", { method: "POST", headers, body: JSON.stringify({ action, payload: { ...payload, tz: new Date().getTimezoneOffset() } }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.error) json.error = "Something went wrong — try again.";
  return json;
}

const fmt = (day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Date(day + "T12:00:00").toLocaleDateString(undefined, opts);
const fmtWd = (day: string) => fmt(day, { weekday: "short", month: "short", day: "numeric" });
const localToday = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const nextMonday = (today: string) => { const dow = new Date(today + "T12:00:00").getDay(); return addDays(today, ((8 - dow) % 7) || 7); };
const initials = (n: string) => (n || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
const AV_COLORS = ["#2E7D54", "#3B6E8F", "#8F5B3B", "#6B3B8F", "#3B8F7A", "#8F3B5B"];

function Avatar({ name, url, size = 30, i = 0 }: { name: string; url?: string | null; size?: number; i?: number }) {
  return url
    ? <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${G.bg}` }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: AV_COLORS[i % AV_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 800, color: "#fff", flexShrink: 0, border: `2px solid ${G.bg}` }}>{initials(name)}</div>;
}

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: G.sub, margin: "16px 0 8px" };
const chip = (on: boolean): React.CSSProperties => ({ padding: "8px 12px", borderRadius: 999, background: on ? G.green : G.card, border: `1.5px solid ${on ? G.accent : G.border}`, fontSize: 13, fontWeight: 700, color: on ? "#fff" : G.soft, cursor: "pointer" });
const tag = (auto: boolean): React.CSSProperties => ({ marginLeft: "auto", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 99, whiteSpace: "nowrap", background: auto ? "rgba(74,157,110,.18)" : "rgba(245,166,35,.15)", color: auto ? G.light : G.gold });
const sec: React.CSSProperties = { background: G.card, border: `1.5px solid ${G.border}`, borderRadius: 14, padding: "12px 13px", marginBottom: 10 };
const secH: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: G.sub, marginBottom: 8 };
const bigBtn = (disabled = false): React.CSSProperties => ({ width: "100%", background: disabled ? "#2A3A2A" : GRAD, border: "none", borderRadius: 16, padding: 15, textAlign: "center", fontWeight: 900, fontSize: 16, color: "#fff", cursor: disabled ? "default" : "pointer" });

/** Full-screen page used for "New challenge" and challenge details. */
function Screen({ title, back, onBack, children, footer }: { title: string; back: string; onBack: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9600, background: G.bg, color: G.text, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "calc(14px + env(safe-area-inset-top)) 16px 12px", borderBottom: `1px solid ${G.line}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: G.accent, fontWeight: 800, fontSize: 15, cursor: "pointer", padding: 0, minWidth: 64, textAlign: "left" }}>{back}</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 900, fontSize: 17 }}>{title}</div>
        <div style={{ minWidth: 64 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as any }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 16px 24px" }}>{children}</div>
      </div>
      {footer && <div style={{ borderTop: `1px solid ${G.line}`, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))" }}><div style={{ maxWidth: 560, margin: "0 auto" }}>{footer}</div></div>}
    </div>
  );
}

function StartPicker({ start, setStart, today }: { start: string; setStart: (d: string) => void; today: string }) {
  const mon = nextMonday(today);
  const custom = start !== today && start !== mon;
  return (
    <>
      <div style={lbl}>Starts</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
        <span style={chip(start === today)} onClick={() => setStart(today)}>Today</span>
        <span style={chip(start === mon)} onClick={() => setStart(mon)}>{fmtWd(mon)}</span>
        <label style={{ ...chip(custom), position: "relative" }}>
          📅 {custom ? fmtWd(start) : "Pick date"}
          <input type="date" min={today} value={start} onChange={e => e.target.value && e.target.value >= today && setStart(e.target.value)}
            style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: "pointer" }} />
        </label>
      </div>
    </>
  );
}

function DailyRules({ tasks }: { tasks: DailyTask[] }) {
  return (
    <>
      {tasks.map(t => (
        <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", background: G.card, border: `1.5px solid ${G.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 7, fontSize: 13.5 }}>
          <span>{t.emoji}</span><span>{t.label}</span>
          <span style={tag(!!t.metric)}>{t.metric ? (t.manual ? "AUTO / CHECK OFF" : "AUTO") : "CHECK OFF"}</span>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: G.sub, marginTop: 6, lineHeight: 1.4 }}>AUTO ticks itself from what people log. CHECK OFF — they tap it each day.</div>
    </>
  );
}

// ── Creator ─────────────────────────────────────────────────────────────────
function CreateChallenge({ groupId, onClose, onCreated }: { groupId: string; onClose: () => void; onCreated: () => void }) {
  const today = useMemo(localToday, []);
  const [mode, setMode] = useState<"pick" | "own">("pick");
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [start, setStart] = useState(nextMonday(today));
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🏆");
  const [desc, setDesc] = useState("");
  const [tasks, setTasks] = useState<PointsTask[]>([{ key: "workout", points: 10 }]);
  const [days, setDays] = useState(30);
  const [customDays, setCustomDays] = useState(false);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const create = async () => {
    setErr(""); setSaving(true);
    const body = mode === "pick"
      ? { groupId, name: preset.name, emoji: preset.emoji, description: preset.blurb, kind: preset.kind, preset: preset.id, tasks: preset.tasks, target: preset.target ?? null, startDate: start, days: preset.days, strict: preset.strict }
      : { groupId, name: name.trim(), emoji, description: desc.trim() || null, kind: "points", preset: null, tasks, startDate: start, days, strict: false };
    const r = await api("gch_create", body);
    setSaving(false);
    if (r.error) { setErr(r.setup_needed ? "Challenges aren’t set up on the server yet." : r.error); return; }
    onCreated();
  };

  const startWord = start === today ? "today" : fmt(start);
  const ownValid = name.trim().length > 0 && tasks.length > 0 && days >= 1 && days <= 365;

  if (mode === "pick") {
    return (
      <Screen title="New challenge" back="✕" onBack={onClose}
        footer={<>{err && <div style={{ color: "#FCA5A5", fontSize: 13, marginBottom: 8, textAlign: "center" }}>{err}</div>}
          <button onClick={create} disabled={saving} style={bigBtn(saving)}>{saving ? "Creating…" : "Create challenge"}</button></>}>
        <div style={{ ...lbl, marginTop: 2 }}>Popular</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {PRESETS.map(p => {
            const on = preset.id === p.id;
            return (
              <button key={p.id} onClick={() => setPreset(p)} style={{ textAlign: "left", background: on ? "rgba(46,125,84,.16)" : G.card, border: `1.5px solid ${on ? G.accent : G.border}`, borderRadius: 14, padding: "11px 11px 10px", color: G.text, cursor: "pointer" }}>
                <div style={{ fontSize: 22 }}>{p.emoji}</div>
                <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: G.sub, marginTop: 3, lineHeight: 1.3 }}>{p.blurb}</div>
              </button>
            );
          })}
          <button onClick={() => setMode("own")} style={{ background: G.card, border: `1.5px dashed ${G.accent}`, borderRadius: 14, padding: 11, color: G.light, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ fontSize: 24 }}>＋</div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Make your own</div>
            <div style={{ fontSize: 11, color: G.sub, marginTop: 3 }}>Pick your tasks & points</div>
          </button>
        </div>
        <StartPicker start={start} setStart={setStart} today={today} />
        <div style={lbl}>What {preset.name} tracks</div>
        {preset.kind === "daily"
          ? <DailyRules tasks={preset.tasks as DailyTask[]} />
          : <div style={{ fontSize: 13.5, color: G.soft, lineHeight: 1.5 }}>Miles {(preset.tasks as PointsTask[]).map(t => TASK_BY_KEY[t.key]?.label.replace(/^Miles /, "").toLowerCase()).join(" + ")} — counted automatically from logged cardio. Goal: {preset.target} miles.</div>}
        {preset.strict && <div style={{ ...sec, marginTop: 10, borderColor: "rgba(239,68,68,.45)", background: "rgba(239,68,68,.07)", fontSize: 13, color: G.soft }}>Miss a day and you restart at day 1.</div>}
      </Screen>
    );
  }

  const picked = new Set(tasks.map(t => t.key));
  const setPts = (key: string, pts: number) => setTasks(ts => ts.map(t => t.key === key ? { ...t, points: Math.max(0, Math.min(1000, pts)) } : t));
  return (
    <Screen title="Make your own" back="‹ Back" onBack={() => setMode("pick")}
      footer={<>{err && <div style={{ color: "#FCA5A5", fontSize: 13, marginBottom: 8, textAlign: "center" }}>{err}</div>}
        <button onClick={create} disabled={saving || !ownValid} style={bigBtn(saving || !ownValid)}>{saving ? "Creating…" : !name.trim() ? "Name your challenge" : "Create challenge"}</button></>}>
      <div style={{ display: "flex", gap: 8 }}>
        <select value={emoji} onChange={e => setEmoji(e.target.value)} aria-label="Icon"
          style={{ background: "#111", border: `1.5px solid ${G.line}`, borderRadius: 12, fontSize: 18, color: G.text, padding: "0 6px" }}>
          {["🏆", "🏔️", "🔥", "💪", "🏃", "🥗", "🧘", "⚡", "🚀", "🎯", "🧊", "👟"].map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <input value={name} onChange={e => setName(e.target.value.slice(0, 80))} placeholder="Challenge name"
          style={{ flex: 1, background: "#111", border: `1.5px solid ${G.line}`, borderRadius: 12, padding: "11px 12px", fontSize: 15, color: G.text, outline: "none" }} />
      </div>
      <div style={lbl}>Tasks · points</div>
      {tasks.map(t => {
        const d = TASK_BY_KEY[t.key];
        if (!d) return null;
        const stepBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, background: G.bg, border: `1.5px solid ${G.border}`, color: G.light, fontWeight: 900, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
        return (
          <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 10, background: G.card, border: `1.5px solid ${G.border}`, borderRadius: 14, padding: "10px 11px", marginBottom: 8 }}>
            <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>{d.emoji}</span>
            <span style={{ flex: 1, fontWeight: 800, fontSize: 14 }}>{d.label}<small style={{ display: "block", fontWeight: 600, fontSize: 11, color: G.sub, marginTop: 1 }}>per {d.unit}</small></span>
            <button style={stepBtn} onClick={() => setPts(t.key, t.points - (t.points > 10 ? 5 : 1))} aria-label="Fewer points">−</button>
            <span style={{ minWidth: 42, textAlign: "center", fontWeight: 900, fontSize: 15, color: G.gold }}>{t.points}<small style={{ display: "block", fontSize: 9.5, color: G.sub, fontWeight: 700 }}>pts</small></span>
            <button style={stepBtn} onClick={() => setPts(t.key, t.points + (t.points >= 10 ? 5 : 1))} aria-label="More points">+</button>
            <button onClick={() => setTasks(ts => ts.filter(x => x.key !== t.key))} aria-label="Remove task" style={{ background: "none", border: "none", color: "#6B7A70", fontSize: 16, cursor: "pointer", padding: "0 2px" }}>✕</button>
          </div>
        );
      })}
      <button onClick={() => setPicker(true)} style={{ width: "100%", background: "transparent", border: `1.5px dashed ${G.accent}`, borderRadius: 14, padding: 11, color: G.light, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>＋ Add a task</button>

      <div style={lbl}>How long</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
        {[7, 14, 30, 75].map(n => <span key={n} style={chip(!customDays && days === n)} onClick={() => { setCustomDays(false); setDays(n); }}>{n} days</span>)}
        <span style={chip(customDays)} onClick={() => setCustomDays(true)}>Custom</span>
        {customDays && <input type="number" inputMode="numeric" min={1} max={365} value={days} onChange={e => setDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
          style={{ width: 70, background: "#111", border: `1.5px solid ${G.line}`, borderRadius: 10, padding: "7px 8px", color: G.text, fontSize: 14 }} />}
      </div>
      <StartPicker start={start} setStart={setStart} today={today} />
      <div style={lbl}>Description (optional)</div>
      <textarea value={desc} onChange={e => setDesc(e.target.value.slice(0, 500))} rows={2} placeholder="What's this challenge about?"
        style={{ width: "100%", background: "#111", border: `1.5px solid ${G.line}`, borderRadius: 12, padding: "10px 12px", fontSize: 14, color: G.text, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
      {tasks.length > 0 && (
        <div style={{ background: "rgba(46,125,84,.12)", border: "1.5px solid rgba(74,157,110,.45)", borderRadius: 14, padding: "12px 13px", fontSize: 14, lineHeight: 1.5, color: "#DDE8DF", marginTop: 14 }}>
          For <b style={{ color: "#fff" }}>{days} days</b> starting <b style={{ color: "#fff" }}>{startWord}</b>, everyone earns {pointsSummary(tasks)}. <b style={{ color: "#fff" }}>Most points wins.</b>
        </div>
      )}

      {picker && (
        <div onClick={() => setPicker(false)} style={{ position: "fixed", inset: 0, zIndex: 9700, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "80vh", overflowY: "auto", background: "#121815", borderRadius: "24px 24px 0 0", borderTop: `1.5px solid ${G.border}`, padding: "10px 16px calc(16px + env(safe-area-inset-bottom))" }}>
            <div style={{ width: 40, height: 5, borderRadius: 9, background: G.border, margin: "2px auto 10px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 17 }}>Add tasks</div>
              <button onClick={() => setPicker(false)} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: G.light, cursor: "pointer" }}>Done ({tasks.length})</button>
            </div>
            {(["Physical", "Meals", "Wellness"] as const).map(grp => (
              <div key={grp}>
                <div style={{ ...lbl, margin: "12px 0 6px" }}>{grp === "Physical" ? "🏋️" : grp === "Meals" ? "🥗" : "🧘"} {grp}</div>
                {TASKS.filter(t => t.group === grp).map(t => {
                  const on = picked.has(t.key);
                  return (
                    <div key={t.key} onClick={() => setTasks(ts => on ? ts.filter(x => x.key !== t.key) : [...ts, { key: t.key, points: t.defaultPoints }])}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderBottom: `1px solid ${G.line}`, fontSize: 14, cursor: "pointer" }}>
                      <span>{t.emoji}</span><span>{t.label}</span>
                      <span style={{ marginLeft: "auto", width: 22, height: 22, borderRadius: 7, border: `2px solid ${on ? G.accent : G.border}`, background: on ? G.accent : "transparent", color: G.bg, fontWeight: 900, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{on ? "✓" : ""}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </Screen>
  );
}

// ── Details + leaderboard ───────────────────────────────────────────────────
function scoreLabel(c: any, row: any): string {
  if (c.status === "upcoming") return "";
  if (c.kind === "points") return c.preset === "100_mile_month" ? `${Math.round(row.score * 10) / 10} mi` : `${row.score} pts`;
  return c.strict ? `${row.streak} day${row.streak === 1 ? "" : "s"}` : `${row.completedDays}/${c.days}`;
}

function ChallengeDetails({ c, today, isStaff, isMember, currentUserId, members, creatorName, onClose, onChanged }: {
  c: any; today: string; isStaff: boolean; isMember: boolean; currentUserId: string | null; members: Member[]; creatorName: string;
  onClose: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const run = async (action: string, extra: any = {}) => {
    setBusy(true); setErr("");
    const r = await api(action, { challengeId: c.id, ...extra });
    setBusy(false);
    if (r.error) { setErr(r.error); return false; }
    onChanged();
    return true;
  };
  const dayN = Math.min(c.days, daysBetween(c.start_date, today) + 1);
  const startsIn = daysBetween(today, c.start_date);
  const board: any[] = c.board || [];
  const me = board.find(r => r.userId === currentUserId);
  const top = Math.max(1, c.target || 0, ...board.map(r => r.score || 0));
  const inIds = new Set(board.map(r => r.userId));
  const addable = members.filter(m => m.userId && !inIds.has(m.userId));
  const dailyTasks = (c.tasks || []) as DailyTask[];

  const footer = c.status === "upcoming" && isMember && currentUserId ? (
    <>
      {err && <div style={{ color: "#FCA5A5", fontSize: 13, marginBottom: 8, textAlign: "center" }}>{err}</div>}
      {c.joined
        ? <button disabled={busy} onClick={() => run("gch_leave")} style={{ ...bigBtn(), background: "transparent", border: `2px solid ${G.border}`, color: G.soft }}>✓ You're in · tap to leave</button>
        : <button disabled={busy} onClick={() => run("gch_join")} style={bigBtn(busy)}>{busy ? "Joining…" : "Join challenge"}</button>}
      <div style={{ textAlign: "center", fontSize: 11.5, color: G.sub, marginTop: 7 }}>You can leave any time before it starts</div>
    </>
  ) : err ? <div style={{ color: "#FCA5A5", fontSize: 13, textAlign: "center" }}>{err}</div> : undefined;

  const ex = c.kind === "points" ? (() => {
    const amt: Record<string, number> = { workout: 4, lift: 3, run_mi: 3, walk_mi: 5, bike_mi: 10, active_min: 120, steps_10k_day: 3, meal: 10, protein_day: 4, water_day: 5, cold_plunge: 2, sauna: 2, meditation: 3, yoga: 2, wellness: 3 };
    const parts = (c.tasks as PointsTask[]).slice(0, 3).map(t => ({ t, n: amt[t.key] || 1, d: TASK_BY_KEY[t.key] })).filter(x => x.d);
    if (!parts.length) return null;
    const words = parts.map(x => `${x.n} ${x.d.unit}${x.n === 1 ? "" : "s"}${x.d.unit === "mile" ? " " + x.d.label.replace(/^Miles /, "") : ""}`);
    const sums = parts.map(x => x.n * x.t.points);
    return { text: words.join(", "), sums, total: sums.reduce((a, b) => a + b, 0) };
  })() : null;

  return (
    <Screen title="Challenge" back="‹ Group" onBack={onClose} footer={footer}>
      <div style={{ background: "linear-gradient(135deg,#1F5F3F,#2E7D54)", borderRadius: 18, padding: "16px 16px 14px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 34 }}>{c.emoji}</span>
          <div><div style={{ fontWeight: 900, fontSize: 19 }}>{c.name}</div>
            <div style={{ fontSize: 12, opacity: .85 }}>Created by {creatorName}{c.preset && PRESET_BY_ID[c.preset] ? " · Popular challenge" : ""}</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[[fmt(c.start_date), "Starts"], [`${c.days} days`, "Length"], [fmt(c.endDate), "Ends"]].map(([b, s]) => (
            <div key={s} style={{ flex: 1, background: "rgba(0,0,0,.18)", borderRadius: 10, padding: "7px 6px", textAlign: "center" }}>
              <b style={{ display: "block", fontSize: 14 }}>{b}</b><span style={{ fontSize: 10.5, opacity: .8 }}>{s}</span></div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 800, borderRadius: 10, padding: "7px 10px", textAlign: "center",
          background: c.status === "upcoming" ? "rgba(245,166,35,.18)" : "rgba(255,255,255,.14)", color: c.status === "upcoming" ? "#FFD27A" : "#fff" }}>
          {c.status === "upcoming" ? `⏳ Starts ${startsIn === 1 ? "tomorrow" : `in ${startsIn} days`} · join before it begins`
            : c.status === "live" ? `🔴 Live · Day ${dayN} of ${c.days}${me ? ` · You're #${board.indexOf(me) + 1}` : ""}`
            : "🏁 Finished"}
        </div>
      </div>

      <div style={{ marginTop: 12 }} />
      {c.description && c.kind === "points" && !c.preset && <div style={sec}><div style={secH}>About</div><div style={{ fontSize: 13.5, color: G.soft, lineHeight: 1.5 }}>{c.description}</div></div>}

      {/* Today's checklist for daily challenges */}
      {c.kind === "daily" && c.status === "live" && me && (
        <div style={{ ...sec, borderColor: "rgba(74,157,110,.55)" }}>
          <div style={secH}>Today</div>
          {dailyTasks.map(t => {
            const st = (me.todayTasks || []).find((x: any) => x.id === t.id) || {};
            const canTap = !!t.manual && !st.auto;
            return (
              <div key={t.id} onClick={() => canTap && !busy && run("gch_checkin", { task: t.id, day: today })}
                style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, padding: "8px 0", cursor: canTap ? "pointer" : "default" }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${G.accent}`, background: st.done ? G.accent : "transparent", color: G.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>{st.done ? "✓" : ""}</span>
                <span style={{ flex: 1 }}>{t.emoji} {t.label}
                  {t.metric && !st.done && st.value ? <small style={{ display: "block", color: G.sub, fontSize: 11 }}>{Math.round(st.value)} / {t.min} so far</small> : null}</span>
                <span style={tag(!!st.auto || (!!t.metric && !t.manual))}>{st.auto ? "LOGGED" : t.manual ? "TAP" : "AUTO"}</span>
              </div>
            );
          })}
          {c.strict && me.restarts > 0 && <div style={{ fontSize: 11.5, color: G.sub, marginTop: 4 }}>Restarted {me.restarts}× · current run {me.streak} day{me.streak === 1 ? "" : "s"}</div>}
        </div>
      )}

      {c.kind === "points" ? (
        <div style={sec}>
          <div style={secH}>How you earn points</div>
          {(c.tasks as PointsTask[]).map(t => {
            const d = TASK_BY_KEY[t.key];
            return d ? <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", fontSize: 14, borderBottom: `1px solid ${G.line}` }}>
              {d.emoji} {d.label}<span style={{ marginLeft: "auto", fontWeight: 900, color: G.gold }}>{t.points} <small style={{ color: G.sub, fontWeight: 700 }}>/ {d.unit}</small></span></div> : null;
          })}
          <div style={{ fontSize: 11.5, color: G.sub, marginTop: 8, lineHeight: 1.4 }}>Counted automatically from what you log in Livelee.{c.target ? ` Goal: ${c.target}${c.preset === "100_mile_month" ? " miles" : " pts"}.` : ""} Most {c.preset === "100_mile_month" ? "miles" : "points"} by {fmt(c.endDate)} wins.</div>
        </div>
      ) : (
        <div style={sec}><div style={secH}>Every day, you must</div><DailyRules tasks={dailyTasks} /></div>
      )}

      {ex && c.status === "upcoming" && c.preset !== "100_mile_month" && (
        <div style={sec}><div style={secH}>Example</div><div style={{ fontSize: 13.5, color: G.soft, lineHeight: 1.5 }}>
          {ex.text} = <b style={{ color: G.gold }}>{ex.sums.join(" + ")} = {ex.total} pts</b></div></div>
      )}
      {c.kind === "daily" && c.strict && (
        <div style={{ ...sec, borderColor: "rgba(239,68,68,.45)", background: "rgba(239,68,68,.07)" }}>
          <div style={{ ...secH, color: "#FCA5A5" }}>The rule</div>
          <div style={{ fontSize: 13.5, color: G.soft, lineHeight: 1.5 }}>Miss any task on any day and you <b style={{ color: "#fff" }}>restart at day 1</b>. Finish all {c.days} days to complete it.</div>
        </div>
      )}

      {/* Leaderboard / who's in */}
      <div style={sec}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ ...secH, marginBottom: 0 }}>{c.status === "upcoming" ? `Who's in · ${board.length}` : `Leaderboard · ${board.length}`}</div>
          {isStaff && c.status !== "ended" && <button onClick={() => setAdding(a => !a)} style={{ marginLeft: "auto", background: "none", border: "none", color: G.light, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>{adding ? "Close" : "+ Add member"}</button>}
        </div>
        {c.status !== "upcoming" && c.kind === "daily" && <div style={{ fontSize: 11.5, color: G.sub, marginTop: 4 }}>{c.strict ? "Ranked by days completed in a row." : "Ranked by days completed."}</div>}
        {adding && (
          <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto", background: G.bg, borderRadius: 10, border: `1px solid ${G.line}` }}>
            {addable.length === 0 ? <div style={{ padding: 12, fontSize: 13, color: G.sub }}>Everyone in the group is already in.</div>
              : addable.map((m, i) => (
                <div key={m.userId!} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderBottom: `1px solid ${G.line}` }}>
                  <Avatar name={m.name} url={m.avatarUrl} size={28} i={i} />
                  <span style={{ flex: 1, fontSize: 13.5 }}>{m.name}</span>
                  <button disabled={busy} onClick={() => run("gch_add_member", { userId: m.userId })} style={{ padding: "5px 11px", borderRadius: 9, border: `1.5px solid ${G.accent}`, background: "transparent", color: G.light, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Add</button>
                </div>
              ))}
          </div>
        )}
        {board.length === 0 && <div style={{ fontSize: 13, color: G.sub, marginTop: 8 }}>Nobody yet — be the first.</div>}
        {c.status === "upcoming" ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {board.map((r, i) => (
              <div key={r.userId} style={{ display: "flex", alignItems: "center", gap: 6, background: G.bg, borderRadius: 99, padding: "3px 10px 3px 3px", fontSize: 12.5, color: G.soft }}>
                <Avatar name={r.name} url={r.avatarUrl} size={24} i={i} />{r.userId === currentUserId ? "You" : r.name.split(" ")[0]}
              </div>
            ))}
          </div>
        ) : board.map((r, i) => {
          const mine = r.userId === currentUserId;
          const pct = c.kind === "points" ? (r.score / top) * 100 : ((c.strict ? r.streak : r.completedDays) / Math.max(1, c.days)) * 100;
          return (
            <div key={r.userId}>
              <div onClick={() => c.kind === "points" && setOpen(o => o === r.userId ? null : r.userId)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", margin: "0 -13px", fontSize: 14, borderBottom: `1px solid ${G.line}`, background: mine ? "rgba(46,125,84,.12)" : "transparent", cursor: c.kind === "points" ? "pointer" : "default" }}>
                <b style={{ width: 18, color: i === 0 ? G.gold : i === 1 ? G.soft : i === 2 ? "#B87333" : G.sub }}>{i + 1}</b>
                <Avatar name={r.name} url={r.avatarUrl} i={i} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mine ? "You" : r.name}{c.kind === "daily" && c.strict && r.restarts > 0 ? <span style={{ fontSize: 11, color: G.sub }}> · restarted {r.restarts}×</span> : null}</div>
                  <div style={{ height: 6, background: G.line, borderRadius: 9, overflow: "hidden", marginTop: 4 }}><i style={{ display: "block", height: "100%", width: `${Math.min(100, pct)}%`, background: G.accent, borderRadius: 9 }} /></div>
                </div>
                <b style={{ whiteSpace: "nowrap" }}>{scoreLabel(c, r)}</b>
              </div>
              {open === r.userId && r.breakdown && (
                <div style={{ padding: "6px 0 8px 28px", fontSize: 12, color: G.sub, lineHeight: 1.6 }}>
                  {(c.tasks as PointsTask[]).map(t => {
                    const d = TASK_BY_KEY[t.key]; const v = r.breakdown[t.key] || 0;
                    return d ? <div key={t.key}>{d.emoji} {v} {d.unit}{v === 1 ? "" : "s"} × {t.points} = <b style={{ color: G.gold }}>{Math.round(v * t.points * 10) / 10}</b></div> : null;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isStaff && (
        <button disabled={busy} onClick={async () => { if (!confirmDel) { setConfirmDel(true); return; } if (await run("gch_delete")) onClose(); }}
          style={{ width: "100%", marginTop: 6, padding: 11, borderRadius: 12, border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", color: "#EF4444", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          {confirmDel ? "Tap again to delete this challenge" : "🗑 Delete challenge"}
        </button>
      )}
    </Screen>
  );
}

// ── The box on the group page ───────────────────────────────────────────────
export default function GroupChallenges({ groupId, isStaff, isMember, currentUserId, members }: Props) {
  const [list, setList] = useState<any[]>([]);
  const [today, setToday] = useState(localToday());
  const [loaded, setLoaded] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api("gch_list", { groupId });
    if (r.error) { setSetupNeeded(!!r.setup_needed); setLoaded(true); return; }
    setList(r.challenges || []);
    if (r.today) setToday(r.today);
    setLoaded(true);
  }, [groupId]);
  useEffect(() => { load(); }, [load]);

  const current = list.filter(c => c.status !== "ended").sort((a, b) => (a.status === b.status ? a.start_date.localeCompare(b.start_date) : a.status === "live" ? -1 : 1));
  const past = list.filter(c => c.status === "ended");
  const openC = list.find(c => c.id === openId);
  const nameOf = (uid: string | null) => members.find(m => m.userId === uid)?.name || "a group admin";

  if (setupNeeded && !isStaff) return null;

  const row = (c: any) => {
    const board: any[] = c.board || [];
    const meIdx = board.findIndex(r => r.userId === currentUserId);
    const dayN = Math.min(c.days, daysBetween(c.start_date, today) + 1);
    return (
      <div key={c.id} onClick={() => setOpenId(c.id)} style={{ background: G.bg, border: `1.5px solid ${G.border}`, borderRadius: 14, padding: 12, marginBottom: 9, cursor: "pointer" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 24 }}>{c.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: G.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.status === "upcoming" ? G.gold : c.status === "live" ? G.light : G.sub }}>
              {c.status === "upcoming" ? `Starts ${fmtWd(c.start_date)} · ${c.memberCount} joined`
                : c.status === "live" ? `Live · Day ${dayN} of ${c.days}${meIdx >= 0 ? ` · You're #${meIdx + 1}` : ` · ${c.memberCount} in`}`
                : `Ended ${fmt(c.endDate)}${board[0] ? ` · 🏆 ${board[0].userId === currentUserId ? "You" : board[0].name}` : ""}`}
            </div>
          </div>
          {c.status === "upcoming" && isMember && currentUserId ? (
            c.joined
              ? <span style={{ fontSize: 12, fontWeight: 800, color: G.light }}>✓ Joined</span>
              : <button disabled={joining === c.id} onClick={async e => { e.stopPropagation(); setJoining(c.id); await api("gch_join", { challengeId: c.id }); setJoining(null); load(); }}
                  style={{ fontSize: 12, fontWeight: 800, padding: "7px 11px", borderRadius: 11, border: `1.5px solid ${G.accent}`, background: "transparent", color: G.light, cursor: "pointer" }}>{joining === c.id ? "…" : "Join"}</button>
          ) : <span style={{ color: G.accent, fontSize: 22 }}>›</span>}
        </div>
        {c.status === "live" && <div style={{ height: 6, background: G.line, borderRadius: 9, overflow: "hidden", marginTop: 8 }}><i style={{ display: "block", height: "100%", width: `${(dayN / c.days) * 100}%`, background: G.accent, borderRadius: 9 }} /></div>}
      </div>
    );
  };

  return (
    <div style={{ background: G.card, borderRadius: 20, border: `2px solid ${G.border}`, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: G.text }}>🏆 Challenges</div>
        {isStaff && !setupNeeded && <button onClick={() => setCreating(true)} style={{ padding: "8px 14px", borderRadius: 12, border: "none", background: GRAD, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ New</button>}
      </div>
      {setupNeeded ? <div style={{ fontSize: 13, color: G.sub }}>Challenges need a quick database update before they can be used.</div>
        : !loaded ? <div style={{ fontSize: 13, color: G.sub }}>Loading…</div>
        : current.length === 0 ? <div style={{ fontSize: 13, color: G.sub, lineHeight: 1.5 }}>{isStaff ? "No challenges yet. Tap + New to start one — 75 Hard, a step challenge, or your own." : "No challenges right now. Check back soon!"}</div>
        : current.map(row)}
      {past.length > 0 && (
        <>
          <button onClick={() => setShowPast(s => !s)} style={{ background: "none", border: "none", color: G.sub, fontWeight: 800, fontSize: 12.5, cursor: "pointer", padding: "4px 0" }}>{showPast ? "Hide" : "Show"} past challenges ({past.length})</button>
          {showPast && <div style={{ marginTop: 8 }}>{past.map(row)}</div>}
        </>
      )}

      {creating && <CreateChallenge groupId={groupId} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
      {openC && <ChallengeDetails c={openC} today={today} isStaff={isStaff} isMember={isMember} currentUserId={currentUserId} members={members}
        creatorName={openC.created_by === currentUserId ? "you" : nameOf(openC.created_by)} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

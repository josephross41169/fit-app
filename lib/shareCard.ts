// lib/shareCard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Data for the "share my day" image (rendered by /api/share-card).
//
// The card has ONE fixed layout so every share looks consistent:
//   • photo area on top: 2 photos side by side, 1 photo full width, or a
//     branded background when there's no photo — always the same height
//   • name + date
//   • separate boxes for Weight lifting, Cardio and Wellness — a box only
//     appears if that was logged
//   • badges the day counted toward (+ any unlocked that day)
//   • Livelee footer
// Client code formats every string here; the server route only lays it out.
// ─────────────────────────────────────────────────────────────────────────────

import { fmtTimedSec } from "./timedFormat";
import { artForActivity, badgeArt } from "./badgeArt";
import { BADGES } from "./badges";
import { categoryForExercise } from "./workoutStats";

export type ShareFormat = "story" | "post";

export interface ShareCardV2 {
  v: 2;
  format: ShareFormat;
  name: string;
  username?: string;
  avatarUrl?: string | null;
  dateLabel: string;                       // "Sunday, Nov 8"
  photos: { url: string; label: string }[]; // 0–2
  lifting?: { meta: string; rows: { name: string; detail: string }[] } | null;
  cardio?: { meta: string; rows: { name: string; detail: string }[] } | null;
  wellness?: { meta: string; items: { emoji: string; name: string; detail: string }[] } | null;
  badges: { img: string }[];               // site-relative badge art, e.g. /badges/sauna.webp
  badgeNote?: string;
}

/** A photo the user can choose to put on the card. */
export interface SharePhotoOption { url: string; label: string }

const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function exerciseDetail(e: any): string {
  const sets = parseInt(e.sets) || 0;
  const reps: string[] = (Array.isArray(e.repsArr) ? e.repsArr : []).map((r: any) => String(r ?? "").trim()).filter(Boolean);
  if (e.timed) {
    const times = (reps.length ? reps : [String(e.reps ?? "")]).filter(Boolean).map(fmtTimedSec);
    if (!times.length) return sets ? `${sets} sets` : "";
    const allSame = times.every(t => t === times[0]);
    return times.length > 1 && !allSame ? times.join(" / ") : (sets > 1 ? `${sets} × ${times[0]}` : times[0]);
  }
  const list = reps.length ? reps : (e.reps ? [String(e.reps)] : []);
  if (!list.length) return sets ? `${sets} sets` : "";
  const allSame = list.every(r => r === list[0]);
  if (allSame) return `${sets || list.length} × ${list[0]}`;
  return `${sets || list.length} × ${list.join("/")}`;
}

function cardioDetail(c: any): string {
  const bits: string[] = [];
  const miles = typeof c.miles === "number" && c.miles > 0 ? c.miles : parseFloat(String(c.distance || "")) || 0;
  if (miles > 0) bits.push(`${Math.round(miles * 100) / 100} mi`);
  else if (typeof c.meters === "number" && c.meters > 0) bits.push(`${Math.round(c.meters).toLocaleString()} m`);
  else if (c.distance) bits.push(String(c.distance));
  if (c.duration && c.duration !== "—") bits.push(String(c.duration));
  return bits.join(" · ");
}

/** Every photo from the day that can go on the card, workout photos first. */
export function sharePhotoOptions(day: any): SharePhotoOption[] {
  const out: SharePhotoOption[] = [];
  const seen = new Set<string>();
  for (const url of (day?.workoutPhotoUrls || [])) if (url && !seen.has(url)) { seen.add(url); out.push({ url, label: "💪 Workout" }); }
  for (const e of (day?.wellness?.entries || [])) if (e?.photo_url && !seen.has(e.photo_url)) { seen.add(e.photo_url); out.push({ url: e.photo_url, label: "🧘 Wellness" }); }
  return out;
}

/** Default pick: first workout photo + first wellness photo (max 2). */
export function defaultSharePhotos(opts: SharePhotoOption[]): string[] {
  const w = opts.find(o => o.label.includes("Workout"));
  const z = opts.find(o => o.label.includes("Wellness"));
  return [w?.url, z?.url].filter(Boolean).slice(0, 2) as string[];
}

/**
 * Build the card for one profile day.
 * @param day        the profile DayCard `day` object
 * @param owner      whose day it is
 * @param earnedIds  badge ids earned on this day
 * @param photoUrls  photos chosen for the card (0–2)
 */
export function buildShareCard(
  day: any,
  owner: { name: string; username?: string; avatarUrl?: string | null },
  earnedIds: string[],
  photoUrls: string[],
  format: ShareFormat,
): ShareCardV2 {
  const w = day?.workout || null;
  const exercises: any[] = (w?.exercises || []).filter((e: any) => e?.name);
  const cardio: any[] = (w?.cardio || []).filter((c: any) => c);
  const wellnessEntries: any[] = day?.wellness?.entries || [];

  // ── Weight lifting ──
  let lifting: ShareCardV2["lifting"] = null;
  if (exercises.length) {
    let groups: string[] = Array.isArray(w?.muscleGroups) ? w.muscleGroups : [];
    if (!groups.length) {
      const s = new Set<string>();
      exercises.forEach(e => { const c = categoryForExercise(e.name); if (c && c !== "Cardio") s.add(c); });
      groups = Array.from(s);
    }
    const meta = [groups.slice(0, 3).join(" · "), w?.durationMin ? `${w.durationMin} min` : ""].filter(Boolean).join(" · ");
    lifting = { meta, rows: exercises.map(e => ({ name: String(e.name), detail: exerciseDetail(e) })) };
  }

  // ── Cardio ──
  let cardioSec: ShareCardV2["cardio"] = null;
  if (cardio.length) {
    const cal = cardio.reduce((s, c) => s + (Number(c.est_calories) || 0), 0) || (!exercises.length ? Number(w?.calories) || 0 : 0);
    cardioSec = {
      meta: cal > 0 ? `${Math.round(cal)} cal` : "",
      rows: cardio.map(c => ({ name: cap(String(c.type || "Cardio")), detail: cardioDetail(c) })),
    };
  }

  // ── Wellness ──
  let wellness: ShareCardV2["wellness"] = null;
  if (wellnessEntries.length) {
    const total = wellnessEntries.reduce((s, e) => s + (Number(e.duration) || 0), 0);
    wellness = {
      meta: total > 0 ? `${total} min` : "",
      items: wellnessEntries.map(e => ({
        emoji: e.emoji || "🌿",
        name: String(e.activity || "Wellness"),
        detail: Number(e.duration) > 0 ? `${e.duration} min` : "",
      })),
    };
  }

  // ── Badges: unlocked today first, then the ones today's logs count toward ──
  const imgs: string[] = [];
  const add = (src: string | null) => { if (src && !imgs.includes(src)) imgs.push(src); };
  earnedIds.forEach(id => add(badgeArt(id)));
  if (exercises.length) add(artForActivity("lifting"));
  cardio.forEach(c => add(artForActivity(String(c.type || ""))));
  wellnessEntries.forEach(e => add(artForActivity(String(e.activity || ""))));
  let badgeNote = "";
  const firstEarned = earnedIds.map(id => BADGES.find(b => b.id === id)).find(Boolean);
  if (firstEarned) badgeNote = earnedIds.length > 1 ? `Unlocked ${firstEarned.label} +${earnedIds.length - 1} more` : `Unlocked: ${firstEarned.label}`;

  return {
    v: 2,
    format,
    name: owner.name || owner.username || "Livelee athlete",
    username: owner.username || undefined,
    avatarUrl: owner.avatarUrl || null,
    dateLabel: day?._date
      ? new Date(day._date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
      : String(day?.label || ""),
    photos: photoUrls.slice(0, 2).map(url => ({
      url,
      label: (day?.wellness?.entries || []).some((e: any) => e?.photo_url === url) ? "🧘 Wellness" : "💪 Workout",
    })),
    lifting,
    cardio: cardioSec,
    wellness,
    badges: imgs.slice(0, 5).map(img => ({ img })),
    badgeNote,
  };
}

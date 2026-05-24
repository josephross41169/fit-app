// lib/couples.ts
// ─────────────────────────────────────────────────────────────────────────────
// Couples mode helpers. Two users link via an invite code, then co-fill a fun
// relationship profile shown on the Couples tab.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

export interface CouplePartner {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  avatar_video_url?: string | null;
  city?: string | null;
}

export interface CoupleDetails {
  together_since?: string;       // date
  anniversary?: string;          // date
  who_asked_first?: "a" | "b";   // which partner asked the other out
  how_they_met?: string;
  last_date_night?: string;      // date
  favorite_activity?: string;
  anthem?: string;
  nicknames?: string;
  who_more_competitive?: "a" | "b";
  who_gym_motivator?: "a" | "b";
}

export interface Couple {
  id: string;
  user_a_id: string;
  user_b_id: string | null;
  status: "pending" | "active" | "ended";
  invite_code: string | null;
  details: CoupleDetails;
  created_at: string;
  linked_at: string | null;
  // Hydrated:
  partnerA?: CouplePartner | null;
  partnerB?: CouplePartner | null;
  iAmA?: boolean; // is the current user partner A?
}

async function fetchPartner(userId: string | null): Promise<CouplePartner | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("users")
    .select("id, username, full_name, avatar_url, avatar_video_url, city")
    .eq("id", userId)
    .single();
  return (data as any) || null;
}

/** The current user's couple (active or pending), hydrated with partner info. */
export async function getMyCouple(): Promise<Couple | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("couples")
    .select("*")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const c = data as Couple;
  const [partnerA, partnerB] = await Promise.all([
    fetchPartner(c.user_a_id),
    fetchPartner(c.user_b_id),
  ]);
  return { ...c, partnerA, partnerB, iAmA: c.user_a_id === user.id, details: c.details || {} };
}

/** Create an invite code to link with a partner. */
export async function createCoupleInvite(): Promise<string> {
  const { data, error } = await supabase.rpc("create_couple_invite");
  if (error) throw new Error(error.message);
  return data as string;
}

/** Accept a partner's invite code → links the couple. Returns couple id. */
export async function acceptCoupleInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_couple_invite", { p_code: code.trim() });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Update the couple's relationship profile (merges into details). */
export async function updateCoupleDetails(coupleId: string, details: CoupleDetails): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("couples")
    .update({ details })
    .eq("id", coupleId);
  if (error) {
    console.warn("[couples] update failed:", error.message);
    return false;
  }
  return true;
}

/** End / unlink a couple. */
export async function unlinkCouple(coupleId: string): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("couples")
    .update({ status: "ended" })
    .eq("id", coupleId);
  return !error;
}

/** Cancel a pending invite the current user created. */
export async function cancelCoupleInvite(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await (supabase as any)
    .from("couples")
    .update({ status: "ended" })
    .eq("user_a_id", user.id)
    .eq("status", "pending");
}

/** Human-readable "together for X" string from a date. */
export function formatTogetherDuration(since: string | undefined): string {
  if (!since) return "";
  const start = new Date(since);
  if (isNaN(start.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  if (parts.length === 0) return "Less than a month";
  return parts.join(", ");
}

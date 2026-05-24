// ── lib/rivalries.ts ────────────────────────────────────────────────────────
// All rivalry-system queries live here. Page components should never call
// supabase directly for rivalry data — always go through this module so types
// and error handling are consistent.

import { supabase } from "./supabase";
import { uploadPhoto } from "./uploadPhoto";

// ── TYPES ───────────────────────────────────────────────────────────────────

export type RivalCategory =
  | "running" | "walking" | "biking" | "lifting"
  | "swimming" | "combat" | "wellness";

export type RivalTier = "beginner" | "intermediate" | "mayhem";

export type RivalryStatus = "active" | "completed" | "cancelled";

// Metrics each category supports. Keep this in sync with compute_rivalry_score()
// in migration-rivalries.sql — if you add a new metric in one place, add it here.
export const COMPETITIONS: Record<RivalCategory, { id: string; label: string }[]> = {
  running:  [
    { id: "most_miles",    label: "Most miles"      },
    { id: "fastest_mile",  label: "Fastest mile"    },
    { id: "longest_run",   label: "Longest run"     },
    { id: "most_runs",     label: "Most runs"       },
  ],
  walking:  [
    { id: "most_steps",    label: "Most steps"      },
    { id: "most_miles",    label: "Most miles"      },
    { id: "most_sessions", label: "Most walks"      },
  ],
  biking:   [
    { id: "most_miles",    label: "Most miles"      },
    { id: "most_sessions", label: "Most rides"      },
  ],
  lifting:  [
    { id: "most_volume",   label: "Most volume"     },
    { id: "most_sessions", label: "Most sessions"   },
    { id: "1rm_bench",     label: "Top bench"       },
    { id: "1rm_squat",     label: "Top squat"       },
    { id: "1rm_deadlift",  label: "Top deadlift"    },
  ],
  swimming: [
    { id: "most_distance", label: "Most distance"   },
    { id: "most_sessions", label: "Most sessions"   },
  ],
  combat:   [
    { id: "most_rounds",   label: "Most rounds"     },
    { id: "most_sessions", label: "Most sessions"   },
    { id: "most_minutes",  label: "Most minutes"    },
  ],
  wellness: [
    { id: "most_sessions",   label: "Most sessions"     },
    { id: "most_minutes",    label: "Most minutes"      },
    { id: "longest_session", label: "Longest session"   },
  ],
};

export interface Rivalry {
  id: string;
  user_a_id: string;
  user_b_id: string;
  category: RivalCategory;
  competition_type: string;
  tier: RivalTier;
  status: RivalryStatus;
  started_at: string;
  ends_at: string;
  resolved_at: string | null;
  user_a_score: number | null;
  user_b_score: number | null;
  winner_id: string | null;
}

export interface RivalUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  avatar_video_url?: string | null;
  city: string | null;
  bio: string | null;
  rival_prompt_answers?: Record<string, string> | null;
}

export interface RivalryWithOpponent extends Rivalry {
  // "opponent" is whichever participant isn't the currently logged-in user
  opponent: RivalUser;
  my_score: number;
  their_score: number;
  i_am_winner: boolean | null; // null if tie / unresolved / cancelled
}

export interface RivalMessage {
  id: string;
  rivalry_id: string;
  sender_id: string;
  content: string | null;
  photo_url: string | null;
  is_blurred: boolean;
  created_at: string;
}

export interface RivalryBadge {
  id: string;
  rivalry_id: string;
  user_id: string;
  badge_key: string;
  earned_at: string;
}

export interface UserRivalryRecord {
  wins: number;
  losses: number;
  ties: number;
  cancelled: number;
  active: number;
}

// ── QUEUE / MATCHMAKING ─────────────────────────────────────────────────────

/** Join the matchmaking queue. Returns an active rivalry if matched instantly,
 *  otherwise null (user is now waiting). Throws if already in an active rivalry. */
export async function joinQueue(params: {
  category: RivalCategory;
  competition_type: string;
  tier: RivalTier;
}): Promise<RivalryWithOpponent | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // The DB trigger creates the rivalry + deletes queue rows atomically if a
  // match exists. Either way, we insert then check for a fresh active rivalry.
  const { error } = await supabase
    .from("rivalry_queue")
    .insert({ user_id: user.id, ...params });

  // The trigger returns NULL to cancel the insert when it made a match; that
  // surfaces as an error with code "P0002" or similar. Either way we check
  // below — don't throw on insert errors that might be legitimate match wins.
  if (error && !error.message.includes("already has an active rivalry")) {
    // Silently continue — match may have been made
  }
  if (error?.message.includes("already has an active rivalry")) {
    throw new Error("You already have an active rivalry.");
  }

  // ── Match notification ──────────────────────────────────────────────
  // The DB trigger atomically creates the rivalry + clears both queue
  // rows when it finds an opponent. We can't tell from the insert
  // result alone whether a match happened, so we read back the active
  // rivalry. If we got matched, both users need to know — the user
  // who joined first has been waiting (could be hours/days) and the
  // user who joined second is also told their match is live so they
  // can jump straight in. Best-effort: a missed notification doesn't
  // invalidate the rivalry itself.
  const matched = await getActiveRivalry();
  if (matched) {
    try {
      const opponentId = matched.user_a_id === user.id ? matched.user_b_id : matched.user_a_id;
      // Notify ME — the user who triggered the match completion
      fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_notification',
          payload: {
            userId: user.id,
            fromUserId: opponentId,
            type: 'rivalry_matched',
            referenceId: matched.id,
            body: `You've been matched with a rival! Time to compete 🥊`,
          },
        }),
      }).catch(() => {});
      // Notify OPPONENT — the user who joined the queue first
      fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_notification',
          payload: {
            userId: opponentId,
            fromUserId: user.id,
            type: 'rivalry_matched',
            referenceId: matched.id,
            body: `Your rival just joined! Game on 🥊`,
          },
        }),
      }).catch(() => {});
    } catch { /* best-effort */ }
  }

  return matched;
}

/** Leave the matchmaking queue. Safe to call if not queued. */
export async function leaveQueue(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("rivalry_queue").delete().eq("user_id", user.id);
}

export interface QueueEntry {
  user_id: string;
  category: RivalCategory;
  competition_type: string;
  tier: RivalTier;
  queued_at: string;
}

/** Get the current user's queue entry if they're waiting for a match, else null.
 *  Used to restore matchmaking state when the user navigates back to the page. */
export async function getQueueEntry(): Promise<QueueEntry | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("rivalry_queue")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as QueueEntry) || null;
}

/** Is the current user currently queued (not yet matched)? */
export async function isQueued(): Promise<boolean> {
  const entry = await getQueueEntry();
  return !!entry;
}

// ── ACTIVE RIVALRY ──────────────────────────────────────────────────────────

/** Resolve any of the current user's rivalries whose time has expired but
 *  which the DB still has marked "active" (the resolver cron may not be
 *  scheduled). Calls the same server-side resolver that stamps scores +
 *  winner, then flips status to completed/cancelled. Returns the number
 *  resolved (0 most of the time — cheap no-op). Best-effort: failure here
 *  shouldn't block the page, the defensive check in getActiveRivalry still
 *  prevents showing an expired matchup.
 *
 *  This is what lets the page return to the queue state once a rivalry ends:
 *  it frees the user from the DB's "already has an active rivalry" guard so
 *  they can matchmake again. */
export async function resolveExpiredRivalries(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("resolve_expired_rivalries");
    if (error) {
      console.warn("[rivalries] resolve_expired_rivalries failed:", error.message);
      return 0;
    }
    return Number(data ?? 0);
  } catch (e) {
    console.warn("[rivalries] resolve threw:", e);
    return 0;
  }
}

// ── DIRECT CHALLENGES (by code) ─────────────────────────────────────────────

export interface PendingChallenge {
  code: string;
  category: RivalCategory;
  competition_type: string;
  tier: RivalTier;
  expires_at: string;
}

/** Create a shareable challenge code for a specific pick. Returns the code.
 *  Throws if the user already has an active rivalry. */
export async function createChallenge(params: {
  category: RivalCategory;
  competition_type: string;
  tier: RivalTier;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_rivalry_challenge", {
    p_category: params.category,
    p_competition_type: params.competition_type,
    p_tier: params.tier,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Accept a challenge by code → creates the rivalry. Returns the rivalry id.
 *  Throws with a friendly message if invalid/expired/already-in-a-rivalry. */
export async function acceptChallenge(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_rivalry_challenge", {
    p_code: code.trim(),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** The current user's live (pending) challenge, if any. */
export async function getMyPendingChallenge(): Promise<PendingChallenge | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("rivalry_challenges")
    .select("code, category, competition_type, tier, expires_at")
    .eq("challenger_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  return (data as any) || null;
}

/** Cancel the current user's pending challenge. */
export async function cancelChallenge(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await (supabase as any)
    .from("rivalry_challenges")
    .update({ status: "cancelled" })
    .eq("challenger_id", user.id)
    .eq("status", "pending");
}

/** Save the current user's rival prompt answers (shown to opponents). */
export async function saveMyRivalPromptAnswers(answers: Record<string, string>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await (supabase as any)
    .from("users")
    .update({ rival_prompt_answers: answers })
    .eq("id", user.id);
  if (error) { console.warn("[rivalries] prompt save failed:", error.message); return false; }
  return true;
}

/** Get the current user's active rivalry (or null). */
export async function getActiveRivalry(): Promise<RivalryWithOpponent | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("rivalries")
    .select("*")
    .eq("status", "active")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .maybeSingle();

  if (error || !data) return null;

  // Defensive: if the rivalry's time has already passed, treat it as not
  // active even though the DB row still says "active" (resolution may not
  // have run yet). This keeps the page from showing an ended matchup; the
  // resolver call on page load flips the DB row so matchmaking reopens.
  const r = data as Rivalry;
  if (r.ends_at && new Date(r.ends_at).getTime() <= Date.now()) {
    return null;
  }

  return hydrateRivalry(r, user.id);
}

/** Attach opponent profile + orient scores from the current user's POV. */
async function hydrateRivalry(r: Rivalry, myId: string): Promise<RivalryWithOpponent> {
  const opponentId = r.user_a_id === myId ? r.user_b_id : r.user_a_id;

  const { data: opp } = await supabase
    .from("users")
    .select("id, username, full_name, avatar_url, avatar_video_url, city, bio, rival_prompt_answers")
    .eq("id", opponentId)
    .single();

  const iAmA = r.user_a_id === myId;
  const my_score    = (iAmA ? r.user_a_score : r.user_b_score) ?? 0;
  const their_score = (iAmA ? r.user_b_score : r.user_a_score) ?? 0;

  let i_am_winner: boolean | null = null;
  if (r.status === "completed") {
    if (r.winner_id === myId) i_am_winner = true;
    else if (r.winner_id && r.winner_id !== myId) i_am_winner = false;
    // winner_id null on completed = tie → leave as null
  }

  return {
    ...r,
    opponent: opp || { id: opponentId, username: "?", full_name: "Unknown", avatar_url: null, city: null, bio: null },
    my_score,
    their_score,
    i_am_winner,
  };
}

// ── LIVE SCORE (pre-resolution) ─────────────────────────────────────────────

/** Current score snapshot for an active rivalry. Calls the same DB function
 *  the resolver uses, so what you see here is exactly what gets stamped at
 *  the end of the week. */
export async function getLiveScores(rivalry: Rivalry): Promise<{ my_score: number; their_score: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { my_score: 0, their_score: 0 };

  const myId = user.id;
  const oppId = rivalry.user_a_id === myId ? rivalry.user_b_id : rivalry.user_a_id;

  const [{ data: mine }, { data: theirs }] = await Promise.all([
    supabase.rpc("compute_rivalry_score", {
      uid: myId,
      p_category: rivalry.category,
      p_metric: rivalry.competition_type,
      p_from: rivalry.started_at,
      p_to: rivalry.ends_at,
    }),
    supabase.rpc("compute_rivalry_score", {
      uid: oppId,
      p_category: rivalry.category,
      p_metric: rivalry.competition_type,
      p_from: rivalry.started_at,
      p_to: rivalry.ends_at,
    }),
  ]);

  return {
    my_score:    Number(mine ?? 0),
    their_score: Number(theirs ?? 0),
  };
}

// ── ALL-TIME RECORD ─────────────────────────────────────────────────────────

export async function getUserRecord(userId: string): Promise<UserRivalryRecord> {
  const { data } = await supabase
    .from("user_rivalry_records")
    .select("wins, losses, ties, cancelled, active")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? { wins: 0, losses: 0, ties: 0, cancelled: 0, active: 0 };
}

// ── RECENT ACTIVITY STATS (per-category, last 4 weeks) ──────────────────────
//
// Powers the "at a glance" panel on the rivalry view. For each category, we
// surface 3 stats that give the user a feel for how strong their opponent is
// — e.g. "they run 12mi/week on avg" or "they hit the gym 4 days/week".
//
// Window is fixed at 28 days. Same query for both users; we run it twice
// (once for me, once for opponent) and compare side by side in the UI.
//
// Number formatting:
// - Distances: 1 decimal, "mi" suffix
// - Per-week counts: 1 decimal so "3.5 runs/week" reads sensibly
// - Long values: rounded with comma separators
// - "—" placeholder when there's no relevant data so empty cards look clean

export interface RivalryStat {
  label: string;
  value: string;
}

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

function fmtDist(miles: number): string {
  if (miles <= 0) return "—";
  return `${miles.toFixed(1)} mi`;
}

function fmtPerWeek(total: number): string {
  if (total <= 0) return "—";
  return (total / 4).toFixed(1);
}

export async function getRivalryActivityStats(
  userId: string,
  category: RivalCategory,
): Promise<RivalryStat[]> {
  const since = new Date(Date.now() - FOUR_WEEKS_MS).toISOString();

  // Pull the broadest set of fields once and slice up in JS. Doing one query
  // and aggregating client-side is cheaper than 4 RPCs and easier to keep
  // consistent across categories.
  const { data: logs } = await supabase
    .from("activity_logs")
    .select("log_type, workout_category, workout_type, workout_duration_min, exercises, cardio, wellness_type, wellness_duration_min, logged_at")
    .eq("user_id", userId)
    .gte("logged_at", since);

  const rows: any[] = logs || [];

  // Cardio entries (running/walking/biking/swimming) live in a JSONB array
  // on workout-type logs. Each entry is { type, distance, duration, ... }.
  // Different log entries can have multiple cardio sessions (e.g. brick
  // workouts) so we flatten across all logs.
  const allCardio: any[] = rows.flatMap(l =>
    Array.isArray(l.cardio) ? l.cardio : []
  );

  switch (category) {
    case "running": {
      // Running includes all run subtypes (outdoor / treadmill / trail / hiit)
      // — match by case-insensitive substring on `type`.
      const runs = allCardio.filter(c => /run/i.test(c.type || ""));
      const totalMiles = runs.reduce((s, c) => s + (parseFloat(String(c.distance)) || 0), 0);
      const longest = runs.reduce((m, c) => Math.max(m, parseFloat(String(c.distance)) || 0), 0);
      return [
        { label: "Avg mi/week", value: totalMiles > 0 ? (totalMiles / 4).toFixed(1) : "—" },
        { label: "Runs/week",   value: fmtPerWeek(runs.length) },
        { label: "Longest run", value: fmtDist(longest) },
      ];
    }

    case "walking": {
      const walks = allCardio.filter(c => /walk|hik/i.test(c.type || ""));
      const totalMiles = walks.reduce((s, c) => s + (parseFloat(String(c.distance)) || 0), 0);
      const totalMin = walks.reduce((s, c) => s + (parseFloat(String(c.duration)) || 0), 0);
      return [
        { label: "Avg mi/week",    value: totalMiles > 0 ? (totalMiles / 4).toFixed(1) : "—" },
        { label: "Walks/week",     value: fmtPerWeek(walks.length) },
        { label: "Avg min/walk",   value: walks.length > 0 ? Math.round(totalMin / walks.length).toString() : "—" },
      ];
    }

    case "biking": {
      const rides = allCardio.filter(c => /bik|cycl/i.test(c.type || ""));
      const totalMiles = rides.reduce((s, c) => s + (parseFloat(String(c.distance)) || 0), 0);
      const totalMin = rides.reduce((s, c) => s + (parseFloat(String(c.duration)) || 0), 0);
      return [
        { label: "Avg mi/week",  value: totalMiles > 0 ? (totalMiles / 4).toFixed(1) : "—" },
        { label: "Hours/week",   value: totalMin > 0 ? (totalMin / 60 / 4).toFixed(1) : "—" },
        { label: "Rides/week",   value: fmtPerWeek(rides.length) },
      ];
    }

    case "swimming": {
      const swims = allCardio.filter(c => /swim/i.test(c.type || ""));
      const totalMin = swims.reduce((s, c) => s + (parseFloat(String(c.duration)) || 0), 0);
      const totalDist = swims.reduce((s, c) => s + (parseFloat(String(c.distance)) || 0), 0);
      return [
        { label: "Sessions/week", value: fmtPerWeek(swims.length) },
        { label: "Total dist",    value: totalDist > 0 ? `${totalDist.toFixed(1)} mi` : "—" },
        { label: "Hours total",   value: totalMin > 0 ? (totalMin / 60).toFixed(1) : "—" },
      ];
    }

    case "lifting": {
      // Lifting = workout logs with a non-empty exercises array. Volume is
      // sum of (weight * reps * sets) across all exercises in all sessions.
      const liftSessions = rows.filter(
        l => l.log_type === "workout" && Array.isArray(l.exercises) && l.exercises.length > 0
      );
      let totalVolume = 0;
      let totalMin = 0;
      liftSessions.forEach(l => {
        if (Array.isArray(l.exercises)) {
          l.exercises.forEach((ex: any) => {
            const sets = parseFloat(String(ex.sets)) || 0;
            const reps = parseFloat(String(ex.reps)) || 0;
            const weight = parseFloat(String(ex.weight)) || 0;
            totalVolume += sets * reps * weight;
          });
        }
        totalMin += parseFloat(String(l.workout_duration_min)) || 0;
      });
      return [
        { label: "Sessions/week", value: fmtPerWeek(liftSessions.length) },
        { label: "Avg volume",    value: liftSessions.length > 0 ? `${Math.round(totalVolume / liftSessions.length).toLocaleString()} lb` : "—" },
        { label: "Avg duration",  value: liftSessions.length > 0 ? `${Math.round(totalMin / liftSessions.length)} min` : "—" },
      ];
    }

    case "combat": {
      // Combat sessions show up either as cardio with type="combat"/"boxing"
      // or as workout logs with workout_category="combat". Combine both.
      const combatCardio = allCardio.filter(c => /box|mma|combat|martial|kick/i.test(c.type || ""));
      const combatLogs = rows.filter(l => l.workout_category === "combat" || l.workout_category === "martial_arts");
      const totalSessions = combatCardio.length + combatLogs.length;
      const totalMin =
        combatCardio.reduce((s, c) => s + (parseFloat(String(c.duration)) || 0), 0) +
        combatLogs.reduce((s, l) => s + (parseFloat(String(l.workout_duration_min)) || 0), 0);
      return [
        { label: "Sessions/week", value: fmtPerWeek(totalSessions) },
        { label: "Hours total",   value: totalMin > 0 ? (totalMin / 60).toFixed(1) : "—" },
        { label: "Avg session",   value: totalSessions > 0 ? `${Math.round(totalMin / totalSessions)} min` : "—" },
      ];
    }

    case "wellness": {
      // Wellness logs are their own log_type, with wellness_type being
      // the activity (meditation / sauna / cold plunge / yoga / etc).
      const wellness = rows.filter(l => l.log_type === "wellness");
      const totalMin = wellness.reduce((s, l) => s + (parseFloat(String(l.wellness_duration_min)) || 0), 0);
      // Count distinct types for "variety" stat — shows whether they go deep
      // on one thing or sample everything.
      const types = new Set(wellness.map(l => l.wellness_type).filter(Boolean));
      return [
        { label: "Sessions/week", value: fmtPerWeek(wellness.length) },
        { label: "Hours total",   value: totalMin > 0 ? (totalMin / 60).toFixed(1) : "—" },
        { label: "Variety",       value: types.size > 0 ? `${types.size} type${types.size > 1 ? "s" : ""}` : "—" },
      ];
    }

    default:
      return [];
  }
}

// ── CHAT ────────────────────────────────────────────────────────────────────

/** All messages in a rivalry's chat, ordered oldest-first. */
export async function getMessages(rivalryId: string): Promise<RivalMessage[]> {
  const { data } = await supabase
    .from("rival_messages")
    .select("*")
    .eq("rivalry_id", rivalryId)
    .order("created_at", { ascending: true });
  return (data as RivalMessage[]) || [];
}

/** Send a text-only message. */
export async function sendTextMessage(rivalryId: string, content: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const trimmed = content.trim();
  if (!trimmed) return;

  const { error } = await supabase.from("rival_messages").insert({
    rivalry_id: rivalryId,
    sender_id: user.id,
    content: trimmed,
    photo_url: null,
    is_blurred: false, // text isn't blurred
  });
  if (error) throw error;
}

/** Send a photo message. Photo is stored blurred until receiver taps to reveal.
 *  Accepts base64 data URL or File. */
export async function sendPhotoMessage(
  rivalryId: string,
  source: string | File,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const path = `rivals/${rivalryId}/${user.id}-${Date.now()}.jpg`;
  const url = await uploadPhoto(source, "activity", path);
  if (!url) throw new Error("Photo upload failed");

  const { error } = await supabase.from("rival_messages").insert({
    rivalry_id: rivalryId,
    sender_id: user.id,
    content: null,
    photo_url: url,
    is_blurred: true, // receiver sees blurred until they tap
  });
  if (error) throw error;
}

/** Receiver taps a blurred photo to reveal it. RLS only allows the non-sender. */
export async function unblurPhoto(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("rival_messages")
    .update({ is_blurred: false })
    .eq("id", messageId);
  if (error) throw error;
}

/** Subscribe to new messages in a rivalry. Returns an unsubscribe function. */
export function subscribeToMessages(
  rivalryId: string,
  onInsert: (msg: RivalMessage) => void,
  onUpdate?: (msg: RivalMessage) => void,
): () => void {
  const channel = supabase
    .channel(`rival_messages:${rivalryId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "rival_messages", filter: `rivalry_id=eq.${rivalryId}` },
      (payload) => onInsert(payload.new as RivalMessage),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "rival_messages", filter: `rivalry_id=eq.${rivalryId}` },
      (payload) => onUpdate?.(payload.new as RivalMessage),
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ── BADGES ──────────────────────────────────────────────────────────────────

/** Badges earned within a specific rivalry, by either participant. */
export async function getRivalryBadges(rivalryId: string): Promise<RivalryBadge[]> {
  const { data } = await supabase
    .from("rivalry_badges")
    .select("*")
    .eq("rivalry_id", rivalryId)
    .order("earned_at", { ascending: true });
  return (data as RivalryBadge[]) || [];
}

/** All rivalry badges a user has ever earned, across every rivalry they've been in.
 *  Includes the rivalry context (opponent name, category) for display. */
export interface RivalryBadgeWithContext extends RivalryBadge {
  opponent_name: string;
  category: string;
  rivalry_ended_at: string | null;
}

export async function getAllUserRivalryBadges(userId: string): Promise<RivalryBadgeWithContext[]> {
  // Fetch all badge rows for the user, joining the rivalry for context
  const { data: badges } = await supabase
    .from("rivalry_badges")
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (!badges || badges.length === 0) return [];

  // Pull the unique rivalry IDs and fetch their metadata in one batch
  const rivalryIds = [...new Set(badges.map((b) => b.rivalry_id))];
  const { data: rivalries } = await supabase
    .from("rivalries")
    .select("id, user_a_id, user_b_id, category, resolved_at")
    .in("id", rivalryIds);

  const rivalryMap = new Map((rivalries || []).map((r) => [r.id, r]));

  // Collect all opponent IDs so we can resolve names in one query
  const opponentIds = [...new Set(
    (rivalries || []).map((r) => r.user_a_id === userId ? r.user_b_id : r.user_a_id)
  )];
  const { data: opponents } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", opponentIds);

  const opponentMap = new Map((opponents || []).map((u) => [u.id, u.full_name]));

  return badges.map((b) => {
    const r = rivalryMap.get(b.rivalry_id);
    const oppId = r ? (r.user_a_id === userId ? r.user_b_id : r.user_a_id) : null;
    return {
      ...b,
      opponent_name: oppId ? (opponentMap.get(oppId) || "Unknown") : "Unknown",
      category: r?.category || "unknown",
      rivalry_ended_at: r?.resolved_at || null,
    } as RivalryBadgeWithContext;
  });
}

// ── UTILITIES ───────────────────────────────────────────────────────────────

/** Human-readable time remaining string for an active rivalry. */
export function formatTimeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const days  = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins  = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (days >= 1) return `${days}d ${hours}h left`;
  if (hours >= 1) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

/** Format score for display — some metrics want a unit. */
export function formatScore(category: RivalCategory, competition_type: string, value: number): string {
  if (value === 0) return "—";
  if (competition_type === "fastest_mile") {
    // stored as (1000 - pace); invert back
    const pace = 1000 - value;
    const min = Math.floor(pace);
    const sec = Math.round((pace - min) * 60);
    return `${min}:${String(sec).padStart(2, "0")}/mi`;
  }
  if (competition_type.startsWith("1rm_"))      return `${Math.round(value)} lbs`;
  if (competition_type === "most_volume")       return `${Math.round(value).toLocaleString()} lbs`;
  if (competition_type === "most_steps")        return `${Math.round(value).toLocaleString()}`;
  if (competition_type === "most_miles" ||
      competition_type === "most_distance" ||
      competition_type === "longest_run")       return `${value.toFixed(1)} mi`;
  if (competition_type === "most_minutes" ||
      competition_type === "longest_session")   return `${Math.round(value)} min`;
  return `${Math.round(value)}`;
}

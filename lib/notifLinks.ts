// ─────────────────────────────────────────────────────────────────────────────
// Where a notification should take you when tapped. Notifications store a
// `type` plus a `reference_id` whose meaning depends on the type (post id,
// conversation id, event id, activity-card id "<userId>__MM/DD/YYYY", …).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";

const profileOf = (username?: string | null) => (username ? `/profile/${encodeURIComponent(username)}` : null);

/** Activity-card ids look like "<ownerUserId>__10/03/2026". */
async function cardOwnerHref(cardId: string, myId?: string | null): Promise<string | null> {
  const ownerId = cardId.split("__")[0];
  if (!ownerId) return null;
  if (ownerId === myId) return "/profile";
  const { data } = await supabase.from("users").select("username").eq("id", ownerId).maybeSingle();
  return profileOf((data as any)?.username);
}

export async function notifHref(n: any, myId?: string | null): Promise<string | null> {
  const ref: string = n?.reference_id ? String(n.reference_id) : "";
  const fromProfile = profileOf(n?.from_user?.username);
  try {
    switch (n?.type) {
      case "follow":
        return fromProfile;
      case "message":
        return ref ? `/messages?conv=${encodeURIComponent(ref)}` : "/messages";
      case "activity_comment":
        return ref.includes("__") ? await cardOwnerHref(ref, myId) : "/profile";
      case "like":
      case "comment":
      case "reply":
      case "mention":
      case "tag":
        if (ref.includes("__")) return await cardOwnerHref(ref, myId);
        if (ref) return `/post/${encodeURIComponent(ref)}`;
        return fromProfile;
      case "event_approved":
      case "event_rsvp":
        return ref ? `/events/${encodeURIComponent(ref)}` : "/events";
      case "group_join_request":
      case "group_approved":
        return ref ? `/groups/${encodeURIComponent(ref)}` : "/connect";
      case "challenge_join":
        return "/challenges";
      case "rivalry_matched":
        return "/rivals";
      case "buddy_matched":
        return "/connect";
      default:
        return fromProfile;
    }
  } catch {
    return fromProfile;
  }
}

// ─── lib/buddyChat.ts ────────────────────────────────────────────────
// Buddy chat helpers — drop-in counterpart to the chat section of
// lib/rivalries.ts. Same shape so the UI can use a near-copy of the
// rivalry chat component, just pointed at this module.
//
// Schema lives in migration-buddy-chat.sql:
//   buddy_chat_messages(id, match_id, sender_id, content, photo_url,
//                       is_blurred, created_at)
// RLS restricts read/write to the two participants of the buddy match.
//
// Photos are uploaded BLURRED — the receiver taps to reveal, same as
// rivalry chat. Sender's own messages are never blurred to themselves.

import { supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/uploadPhoto";

export interface BuddyMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string | null;
  photo_url: string | null;
  is_blurred: boolean;
  created_at: string;
}

/** All messages in a buddy match's chat, ordered oldest-first. */
export async function getBuddyMessages(matchId: string): Promise<BuddyMessage[]> {
  const { data } = await (supabase as any)
    .from("buddy_chat_messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  return (data as BuddyMessage[]) || [];
}

/** Send a text-only message. */
export async function sendBuddyTextMessage(matchId: string, content: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const trimmed = content.trim();
  if (!trimmed) return;

  const { error } = await (supabase as any).from("buddy_chat_messages").insert({
    match_id: matchId,
    sender_id: user.id,
    content: trimmed,
    photo_url: null,
    is_blurred: false, // text isn't blurred
  });
  if (error) throw error;
}

/** Send a photo message. Photo is stored blurred until receiver taps to reveal.
 *  Accepts base64 data URL or File. */
export async function sendBuddyPhotoMessage(
  matchId: string,
  source: string | File,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Same bucket as rivalry photos to keep storage simple. Path
  // namespace differs ("buddies/" vs "rivals/") so listings don't
  // collide. Filename includes sender id + epoch so the same buddy
  // pair sending photos back-to-back doesn't overwrite each other.
  const path = `buddies/${matchId}/${user.id}-${Date.now()}.jpg`;
  const url = await uploadPhoto(source, "activity", path);
  if (!url) throw new Error("Photo upload failed");

  const { error } = await (supabase as any).from("buddy_chat_messages").insert({
    match_id: matchId,
    sender_id: user.id,
    content: null,
    photo_url: url,
    is_blurred: true, // receiver sees blurred until they tap
  });
  if (error) throw error;
}

/** Receiver taps a blurred photo to reveal it. RLS only allows the non-sender. */
export async function unblurBuddyPhoto(messageId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("buddy_chat_messages")
    .update({ is_blurred: false })
    .eq("id", messageId);
  if (error) throw error;
}

/** Subscribe to message events in a buddy match. Returns an unsubscribe function.
 *  onInsert fires for new messages, onUpdate for blur-reveal flips. Same
 *  shape as subscribeToMessages in lib/rivalries.ts. */
export function subscribeToBuddyMessages(
  matchId: string,
  onInsert: (msg: BuddyMessage) => void,
  onUpdate?: (msg: BuddyMessage) => void,
): () => void {
  const channel = supabase
    .channel(`buddy_chat_messages:${matchId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "buddy_chat_messages", filter: `match_id=eq.${matchId}` },
      (payload) => onInsert(payload.new as BuddyMessage),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "buddy_chat_messages", filter: `match_id=eq.${matchId}` },
      (payload) => onUpdate?.(payload.new as BuddyMessage),
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

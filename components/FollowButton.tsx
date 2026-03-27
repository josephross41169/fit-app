"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export default function FollowButton({ targetUserId, size = "md" }: { targetUserId: string; size?: "sm" | "md" }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.id === targetUserId) { setLoading(false); return; }
    supabase.from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .single()
      .then(({ data }) => {
        setFollowing(!!data);
        setLoading(false);
      });
  }, [user, targetUserId]);

  async function toggle() {
    if (!user || loading) return;
    setLoading(true);
    if (following) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);
      setFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetUserId });
      setFollowing(true);
    }
    setLoading(false);
  }

  if (!user || user.id === targetUserId) return null;

  const pad = size === "sm" ? "6px 14px" : "9px 22px";
  const fontSize = size === "sm" ? 12 : 14;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        padding: pad,
        borderRadius: 99,
        cursor: loading ? "not-allowed" : "pointer",
        fontWeight: 800,
        fontSize,
        transition: "all 0.15s",
        background: following ? "#F0FDF4" : "linear-gradient(135deg, #16A34A, #22C55E)",
        color: following ? "#16A34A" : "#fff",
        border: following ? "2px solid #BBF7D0" : "2px solid transparent",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "..." : following ? "Following ✓" : "+ Follow"}
    </button>
  );
}

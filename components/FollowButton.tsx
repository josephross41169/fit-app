"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { track } from "@/components/PostHogProvider";

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
      track("unfollow_user", { target_user_id: targetUserId });
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetUserId });
      setFollowing(true);
      // follow_user is the key social-graph growth signal — track every
      // successful follow so we can measure network density over time.
      track("follow_user", { target_user_id: targetUserId });
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
        background: following ? "#F3F0FF" : "linear-gradient(135deg, #7C3AED, #A78BFA)",
        color: following ? "#7C3AED" : "#fff",
        border: following ? "2px solid #DDD6FE" : "2px solid transparent",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "..." : following ? "Following ✓" : "+ Follow"}
    </button>
  );
}



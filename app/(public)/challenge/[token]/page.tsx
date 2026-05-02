"use client";

// ─── app/(public)/challenge/[token]/page.tsx ─────────────────────────────
// Public landing page for a group-challenge invite link. Reachable at
// liveleeapp.com/challenge/<12-char-token>. Designed to be sharable on
// social media / texts so friends can preview a challenge before joining.
//
// Flow:
//   • Page loads with the token from the URL
//   • Fetches challenge + host group info via /api/db (no auth needed)
//   • Anonymous visitor sees a "Sign in to Join" CTA → goes through normal
//     auth and comes back here
//   • Authenticated visitor sees "Join Challenge" CTA → POST to API,
//     joins the group + enrolls in the challenge, then redirects to the
//     group page where the challenge is visible
//
// The page is intentionally minimal — its job is to drive a conversion
// from "saw a link" to "joined the challenge." Heavier challenge details
// live inside the group page.

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";

const C = {
  bg: "#0A0A0F",
  card: "#15131D",
  border: "#2D1F52",
  text: "#F5F1E8",
  sub: "#9CA3AF",
  accent: "#7C3AED",
  accent2: "#A78BFA",
  green: "#4ADE80",
  red: "#F87171",
};

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  metric: string | null;
  lift_type: string | null;
  target_value: number | null;
  goal: number | null;
  duration_days: number | null;
  status: string;
  is_group_goal: boolean;
  goal_category: string | null;
  stakes: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  participant_count: number;
  member_count: number | null;
  invite_token_expires_at: string | null;
  // Joined relations — Supabase returns these as objects when we use the
  // "creator_group:creator_group_id(...)" alias syntax in the select.
  creator_group: { id: string; name: string; emoji: string | null; member_count: number | null; avatar_url: string | null } | null;
  group: { id: string; name: string; emoji: string | null; member_count: number | null; avatar_url: string | null } | null;
};

const METRIC_LABELS: Record<string, { label: string; unit: string; icon: string }> = {
  miles_run:      { label: "Miles Run",      unit: "mi",  icon: "🏃" },
  miles_walked:   { label: "Miles Walked",   unit: "mi",  icon: "🚶" },
  miles_cycled:   { label: "Miles Cycled",   unit: "mi",  icon: "🚴" },
  total_workouts: { label: "Total Workouts", unit: "",    icon: "💪" },
  weight_lifted:  { label: "Weight Lifted",  unit: "lbs", icon: "🏋️" },
  weight_lost:    { label: "Weight Lost",    unit: "lbs", icon: "⚖️" },
};

export default function ChallengeInvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // ─── Load challenge by token ────────────────────────────────────────
  useEffect(() => {
    const token = params?.token;
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_challenge_by_token", payload: { token } }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setError(data.error || "Couldn't load this challenge");
          return;
        }
        setChallenge(data.challenge);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params]);

  // ─── Join handler ───────────────────────────────────────────────────
  async function handleJoin() {
    if (!user) {
      // Redirect to sign-in. We pass the current URL as the "next" so
      // the user comes back here after authing. The auth layout doesn't
      // currently honor a `next` param everywhere, so we also stash it
      // in sessionStorage as a belt-and-suspenders approach.
      try { sessionStorage.setItem("post_auth_redirect", window.location.pathname); } catch {}
      router.push("/sign-in");
      return;
    }
    if (!challenge) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join_via_challenge_token",
          payload: { token: params?.token, userId: user.id },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setJoinError(data.error || "Couldn't join the challenge");
        setJoining(false);
        return;
      }
      // Success — bounce them to the group page. They'll see the
      // challenge they just joined.
      router.push(`/groups/${data.groupId}`);
    } catch (e: any) {
      setJoinError(e?.message || "Network error");
      setJoining(false);
    }
  }

  // ─── Auto-redirect after auth ───────────────────────────────────────
  // If the user just signed in elsewhere and was sent back here, we want
  // them to NOT have to tap Join again. Detect the "they bounced through
  // auth" case via the sessionStorage flag and auto-trigger the join.
  useEffect(() => {
    if (!user || !challenge) return;
    try {
      const flag = sessionStorage.getItem("post_auth_redirect");
      if (flag && window.location.pathname === flag) {
        sessionStorage.removeItem("post_auth_redirect");
        // small delay so the user sees what they're joining for half a sec
        const t = setTimeout(handleJoin, 500);
        return () => clearTimeout(t);
      }
    } catch { /* sessionStorage might be unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, challenge]);

  // ─── Render guards ──────────────────────────────────────────────────
  if (loading || authLoading) {
    return (
      <div style={pageWrap}>
        <div style={{ textAlign: "center", color: C.sub }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: `4px solid ${C.border}`, borderTopColor: C.accent,
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Loading challenge…</div>
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div style={pageWrap}>
        <div style={{
          maxWidth: 420, textAlign: "center", padding: 32,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>
            Challenge not found
          </div>
          <div style={{ fontSize: 14, color: C.sub, marginBottom: 24, lineHeight: 1.5 }}>
            {error || "This invite link may have expired, or the challenge may have been removed."}
          </div>
          <button onClick={() => router.push(user ? "/feed" : "/")} style={primaryBtn}>
            {user ? "← Back to Feed" : "Go to Livelee"}
          </button>
        </div>
      </div>
    );
  }

  // ─── Challenge details derived from data ────────────────────────────
  const hostGroup = challenge.group || challenge.creator_group;
  const target = challenge.target_value ?? challenge.goal ?? 0;
  const metricInfo = challenge.metric
    ? METRIC_LABELS[challenge.metric] || { label: challenge.metric, unit: "", icon: "🎯" }
    : { label: "Goal", unit: "", icon: "🎯" };

  // Days remaining if there's an end_date
  const daysLeft: number | null = (() => {
    if (!challenge.end_date) return null;
    const ms = new Date(challenge.end_date).getTime() - Date.now();
    if (ms < 0) return 0;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  })();

  const isExpired = daysLeft === 0 || challenge.status !== "active";

  return (
    <div style={pageWrap}>
      <div style={{
        maxWidth: 460, width: "100%",
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
      }}>
        {/* Top accent band */}
        <div style={{
          background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
          padding: "20px 24px",
          color: "#fff",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 900, letterSpacing: "0.2em",
            opacity: 0.85, marginBottom: 6,
          }}>
            🎯 GROUP CHALLENGE INVITE
          </div>
          {hostGroup && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(255,255,255,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 900,
                overflow: "hidden",
              }}>
                {hostGroup.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hostGroup.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  hostGroup.emoji || hostGroup.name?.[0] || "🏆"
                )}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{hostGroup.name}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>
                  {hostGroup.member_count || 0} {hostGroup.member_count === 1 ? "member" : "members"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ padding: "24px 24px 28px" }}>
          {/* Title */}
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 900, color: C.text,
            lineHeight: 1.15, letterSpacing: "-0.01em",
          }}>
            {challenge.title}
          </h1>

          {/* Status pill if expired */}
          {isExpired && (
            <div style={{
              display: "inline-block", marginTop: 10,
              padding: "4px 10px", borderRadius: 99,
              background: `${C.red}20`, border: `1px solid ${C.red}55`,
              fontSize: 11, fontWeight: 800, color: C.red,
              letterSpacing: "0.04em",
            }}>
              {daysLeft === 0 ? "ENDED" : challenge.status?.toUpperCase()}
            </div>
          )}

          {/* Description if present */}
          {challenge.description && (
            <div style={{
              marginTop: 12, fontSize: 14, lineHeight: 1.55,
              color: C.sub,
            }}>
              {challenge.description}
            </div>
          )}

          {/* Goal big number */}
          <div style={{
            marginTop: 22,
            padding: "20px 18px",
            background: `${C.accent}15`,
            border: `1.5px solid ${C.accent}55`,
            borderRadius: 14,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ fontSize: 36, lineHeight: 1 }}>{metricInfo.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.accent2, letterSpacing: "0.18em", marginBottom: 4 }}>
                THE GOAL
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>
                {target ? `${target.toLocaleString()}${metricInfo.unit ? " " + metricInfo.unit : ""} ${metricInfo.label}` : metricInfo.label}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            marginTop: 14,
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
          }}>
            <Stat label="JOINED" value={String(challenge.participant_count || 0)} />
            <Stat label={daysLeft === null ? "DURATION" : "DAYS LEFT"} value={
              daysLeft === null ? (challenge.duration_days ? `${challenge.duration_days}d` : "—") : String(daysLeft)
            } />
            <Stat label="STAKES" value={challenge.stakes || "Bragging rights"} />
          </div>

          {/* Join CTA */}
          <button
            onClick={handleJoin}
            disabled={joining || isExpired}
            style={{
              ...primaryBtn,
              marginTop: 24,
              width: "100%",
              padding: "16px",
              fontSize: 16,
              cursor: (joining || isExpired) ? "default" : "pointer",
              opacity: (joining || isExpired) ? 0.6 : 1,
            }}
          >
            {isExpired ? "Challenge ended" :
             joining ? "Joining…" :
             user ? `🚀 Join ${hostGroup?.name || "the Group"} & Accept` :
                    "Sign in to Join"}
          </button>

          {joinError && (
            <div style={{
              marginTop: 12, padding: "10px 14px",
              background: `${C.red}15`, border: `1px solid ${C.red}55`,
              borderRadius: 10, fontSize: 13, color: C.red, fontWeight: 600,
            }}>
              ⚠️ {joinError}
            </div>
          )}

          {/* Friendly footer */}
          <div style={{
            marginTop: 20, paddingTop: 16,
            borderTop: `1px solid ${C.border}`,
            fontSize: 12, color: C.sub, textAlign: "center", lineHeight: 1.5,
          }}>
            By joining, you'll become a member of {hostGroup?.name || "this group"} and be enrolled in this challenge.
          </div>
        </div>
      </div>

      {/* Tiny brand footer */}
      <div style={{ marginTop: 22, fontSize: 11, fontWeight: 800, color: C.sub, letterSpacing: "0.18em" }}>
        LIVELEEAPP.COM
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: "10px 8px",
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: C.text, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
      <div style={{ fontSize: 9, fontWeight: 800, color: C.sub, letterSpacing: "0.15em", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background: `radial-gradient(ellipse at top, ${C.accent}11 0%, ${C.bg} 60%)`,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
};

const primaryBtn: React.CSSProperties = {
  background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
  color: "#fff",
  border: "none",
  borderRadius: 99,
  padding: "12px 24px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  letterSpacing: "0.02em",
  boxShadow: `0 6px 20px ${C.accent}55`,
};

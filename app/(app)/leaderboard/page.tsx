"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { computeTier, TIER_INFO, TIER_COLORS } from "@/lib/tiers";
import type { Tier } from "@/lib/tiers";
import { TierFrame } from "@/components/TierFrame";

const C = {
  purple: "#7C3AED",
  purpleDark: "#1E1530",
  purpleMid: "#2D1F52",
  purpleBorder: "#4C3A7A",
  gold: "#F5A623",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  white: "#1A1A1A",
  bg: "#0D0D0D",
  green: "#4ADE80",
  red: "#F87171",
};

type Tab = "global" | "weekly" | "groups";

type LeaderEntry = {
  rank: number;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  total_logs: number;
  logs_last7: number;
  logs_last28: number;
  longest_streak: number;
  tier: Tier;
  isCurrentUser: boolean;
};

type GroupEntry = {
  group_id: string;
  group_name: string;
  group_emoji: string;
  member_count: number;
  weekly_logs: number;
  total_logs: number;
};

function Avatar({ url, username, size = 44, tier }: { url: string | null; username: string; size?: number; tier: Tier }) {
  const initials = username ? username.slice(0, 2).toUpperCase() : "??";
  const tc = TIER_COLORS[tier];
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size,
        borderRadius: "50%",
        background: url ? "transparent" : C.purpleMid,
        border: `2.5px solid ${tc.border}`,
        boxShadow: `0 0 8px ${tc.glow}`,
        overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.3, fontWeight: 800, color: tc.accent,
      }}>
        {url ? <img src={url} alt={username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ fontSize: 22 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 22 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 22 }}>🥉</span>;
  return (
    <span style={{
      fontSize: 13, fontWeight: 800, color: C.sub,
      minWidth: 28, textAlign: "center",
    }}>
      #{rank}
    </span>
  );
}

function TierPill({ tier }: { tier: Tier }) {
  const info = TIER_INFO[tier];
  const tc = TIER_COLORS[tier];
  if (tier === "default") return null;
  return (
    <span style={{
      fontSize: 10, fontWeight: 800,
      padding: "2px 8px", borderRadius: 99,
      background: tc.badge, color: tc.badgeText,
      border: `1px solid ${tc.border}40`,
      letterSpacing: 0.5,
    }}>
      {info.icon} {info.label.toUpperCase()}
    </span>
  );
}

function UserRow({ entry, onClick }: { entry: LeaderEntry; onClick: () => void }) {
  const tc = TIER_COLORS[entry.tier];
  const isTop3 = entry.rank <= 3;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 18px",
        borderRadius: 16,
        background: entry.isCurrentUser
          ? `linear-gradient(135deg, ${C.purpleMid}80, ${C.purpleDark}80)`
          : isTop3
            ? `linear-gradient(135deg, ${tc.badge}60, ${C.white})`
            : C.white,
        border: `1.5px solid ${entry.isCurrentUser ? C.purple : isTop3 ? tc.border : "#2A2A2A"}`,
        boxShadow: isTop3 ? `0 0 16px ${tc.glow}` : entry.isCurrentUser ? `0 0 12px rgba(124,58,237,0.2)` : "none",
        cursor: "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
        marginBottom: 8,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px ${tc.glow || "rgba(124,58,237,0.2)"}`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = isTop3 ? `0 0 16px ${tc.glow}` : entry.isCurrentUser ? `0 0 12px rgba(124,58,237,0.2)` : "none";
      }}
    >
      {/* Rank */}
      <div style={{ width: 32, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <RankBadge rank={entry.rank} />
      </div>

      {/* Avatar */}
      <Avatar url={entry.avatar_url} username={entry.username} size={44} tier={entry.tier} />

      {/* Name + tier */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.full_name || entry.username}
          </span>
          {entry.isCurrentUser && (
            <span style={{ fontSize: 10, fontWeight: 700, color: C.purple, background: `${C.purple}20`, padding: "1px 7px", borderRadius: 99, border: `1px solid ${C.purple}40` }}>YOU</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 12, color: C.sub }}>@{entry.username}</span>
          <TierPill tier={entry.tier} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: tc.accent || C.text }}>{entry.logs_last28}</div>
          <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>28d logs</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.gold }}>{entry.longest_streak}</div>
          <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>streak</div>
        </div>
      </div>
    </div>
  );
}

function GroupRow({ entry, rank }: { entry: GroupEntry; rank: number }) {
  const router = useRouter();
  const isTop3 = rank <= 3;
  const colors = ["#F5A623", "#9CA3AF", "#CD7F32"];
  const accent = isTop3 ? colors[rank - 1] : C.sub;
  return (
    <div
      onClick={() => router.push(`/groups/${entry.group_id}`)}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 18px",
        borderRadius: 16,
        background: isTop3 ? `rgba(245,166,35,0.06)` : C.white,
        border: `1.5px solid ${isTop3 ? accent + "50" : "#2A2A2A"}`,
        cursor: "pointer",
        transition: "transform 0.15s",
        marginBottom: 8,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
    >
      <div style={{ width: 32, display: "flex", justifyContent: "center" }}>
        <RankBadge rank={rank} />
      </div>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: C.purpleMid, border: `2px solid ${accent}50`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>
        {entry.group_emoji}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{entry.group_name}</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{entry.member_count} members</div>
      </div>
      <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: accent }}>{entry.weekly_logs}</div>
          <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>this week</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{entry.total_logs}</div>
          <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>all time</div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("global");
  const [users, setUsers] = useState<LeaderEntry[]>([]);
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myEntry, setMyEntry] = useState<LeaderEntry | null>(null);

  useEffect(() => {
    if (tab === "groups") {
      loadGroups();
    } else {
      loadUsers();
    }
  }, [tab, user]);

  async function loadUsers() {
    setLoading(true);
    try {
      const now = new Date();
      const ago28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
      const ago7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch users with their activity_log counts
      const { data: userRows } = await supabase
        .from("users")
        .select("id, username, full_name, avatar_url")
        .limit(200);

      if (!userRows || userRows.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // For each user, count logs in last 28 days and last 7 days
      const entries: LeaderEntry[] = [];
      for (const u of userRows) {
        const [r28, r7, rAll] = await Promise.all([
          supabase.from("activity_logs").select("id", { count: "exact", head: true })
            .eq("user_id", u.id).gte("logged_at", ago28),
          supabase.from("activity_logs").select("id", { count: "exact", head: true })
            .eq("user_id", u.id).gte("logged_at", ago7),
          supabase.from("activity_logs").select("id", { count: "exact", head: true })
            .eq("user_id", u.id),
        ]);
        const logs28 = r28.count || 0;
        const logs7 = r7.count || 0;
        const logsAll = rAll.count || 0;

        // Simple streak: estimate from logs_last28
        const estimatedStreak = Math.floor(logs28 / 4);

        const tier = computeTier(logs28, estimatedStreak);

        entries.push({
          rank: 0,
          user_id: u.id,
          username: u.username || "user",
          full_name: u.full_name || u.username || "User",
          avatar_url: u.avatar_url,
          total_logs: logsAll,
          logs_last7: logs7,
          logs_last28: logs28,
          longest_streak: estimatedStreak,
          tier,
          isCurrentUser: user?.id === u.id,
        });
      }

      // Sort by tab
      const sorted = [...entries].sort((a, b) => {
        if (tab === "weekly") return b.logs_last7 - a.logs_last7;
        return b.logs_last28 - a.logs_last28;
      });

      sorted.forEach((e, i) => { e.rank = i + 1; });

      const currentUserEntry = sorted.find(e => e.isCurrentUser) || null;
      setMyRank(currentUserEntry?.rank || null);
      setMyEntry(currentUserEntry);
      setUsers(sorted);
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    }
    setLoading(false);
  }

  async function loadGroups() {
    setLoading(true);
    try {
      const now = new Date();
      const ago7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: groupRows } = await supabase
        .from("groups")
        .select("id, name, emoji, member_count:group_members(count)")
        .limit(50);

      if (!groupRows || groupRows.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const entries: GroupEntry[] = [];

      for (const g of groupRows) {
        // Count weekly activity from members
        const { data: members } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", g.id);

        const memberIds = (members || []).map((m: any) => m.user_id);

        let weeklyLogs = 0;
        let totalLogs = 0;
        if (memberIds.length > 0) {
          const [rW, rT] = await Promise.all([
            supabase.from("activity_logs").select("id", { count: "exact", head: true })
              .in("user_id", memberIds).gte("logged_at", ago7),
            supabase.from("activity_logs").select("id", { count: "exact", head: true })
              .in("user_id", memberIds),
          ]);
          weeklyLogs = rW.count || 0;
          totalLogs = rT.count || 0;
        }

        entries.push({
          group_id: g.id,
          group_name: g.name,
          group_emoji: g.emoji || "💪",
          member_count: memberIds.length,
          weekly_logs: weeklyLogs,
          total_logs: totalLogs,
        });
      }

      entries.sort((a, b) => b.weekly_logs - a.weekly_logs);
      setGroups(entries);
    } catch (err) {
      console.error("Failed to load group leaderboard:", err);
    }
    setLoading(false);
  }

  const tierCounts: Record<Tier, number> = { default: 0, active: 0, grinder: 0, elite: 0, untouchable: 0 };
  users.forEach(u => { tierCounts[u.tier]++; });

  const tabs_: { label: string; value: Tab; icon: string }[] = [
    { label: "All-Time", value: "global", icon: "🌍" },
    { label: "This Week", value: "weekly", icon: "📅" },
    { label: "Groups", value: "groups", icon: "👥" },
  ];

  return (
    <div style={{ padding: "24px 24px 120px", background: C.bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: C.text, marginBottom: 6 }}>
            🏆 Leaderboard
          </h1>
          <p style={{ fontSize: 14, color: C.sub }}>
            Top performers ranked by activity. Earned, never bought.
          </p>
        </div>

        {/* Tier distribution mini summary */}
        {!loading && users.length > 0 && tab !== "groups" && (
          <div style={{
            display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap",
          }}>
            {(["untouchable", "elite", "grinder", "active"] as Tier[]).map(t => {
              const info = TIER_INFO[t];
              const tc = TIER_COLORS[t];
              const n = tierCounts[t];
              if (n === 0) return null;
              return (
                <div key={t} style={{
                  padding: "6px 14px", borderRadius: 99,
                  background: tc.badge, border: `1px solid ${tc.border}40`,
                  fontSize: 12, fontWeight: 700, color: tc.badgeText,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  {info.icon} {n} {info.label}
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {tabs_.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              style={{
                padding: "9px 18px", borderRadius: 14,
                border: "none",
                background: tab === t.value ? C.purple : C.purpleMid,
                color: tab === t.value ? "#fff" : C.sub,
                fontWeight: 700, fontSize: 13,
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* My rank callout (user tab only) */}
        {!loading && myEntry && tab !== "groups" && (
          <div style={{
            background: `linear-gradient(135deg, ${C.purpleMid}, ${C.purpleDark})`,
            border: `2px solid ${C.purple}`,
            borderRadius: 20, padding: "16px 20px",
            marginBottom: 24,
            display: "flex", alignItems: "center", gap: 16,
            boxShadow: "0 0 20px rgba(124,58,237,0.25)",
          }}>
            <Avatar url={myEntry.avatar_url} username={myEntry.username} size={48} tier={myEntry.tier} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 2 }}>Your Ranking</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>
                #{myRank} <span style={{ fontSize: 14, color: C.sub, fontWeight: 400 }}>out of {users.length}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: TIER_COLORS[myEntry.tier].accent || C.gold }}>
                {tab === "weekly" ? myEntry.logs_last7 : myEntry.logs_last28}
              </div>
              <div style={{ fontSize: 11, color: C.sub }}>{tab === "weekly" ? "logs this week" : "logs in 28 days"}</div>
              <div style={{ marginTop: 6 }}>
                <TierPill tier={myEntry.tier} />
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              border: `4px solid ${C.purpleMid}`, borderTopColor: C.purple,
              animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 14, color: C.sub }}>Loading leaderboard...</div>
          </div>
        ) : tab === "groups" ? (
          /* Groups leaderboard */
          <div>
            {groups.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: C.sub, fontSize: 14 }}>
                No group data yet. Join a group to see rankings!
              </div>
            ) : (
              groups.map((g, i) => <GroupRow key={g.group_id} entry={g} rank={i + 1} />)
            )}
          </div>
        ) : (
          /* Users leaderboard */
          <div>
            {users.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: C.sub, fontSize: 14 }}>
                No activity data yet. Start logging to climb the ranks!
              </div>
            ) : (
              <>
                {/* Top 3 podium */}
                {users.length >= 3 && (
                  <div style={{ display: "flex", gap: 12, marginBottom: 28, alignItems: "flex-end", justifyContent: "center" }}>
                    {/* 2nd place */}
                    {[1, 0, 2].map(idx => {
                      const e = users[idx];
                      if (!e) return null;
                      const heights = [100, 130, 85];
                      const hIdx = [1, 0, 2].indexOf(idx);
                      const tc = TIER_COLORS[e.tier];
                      return (
                        <div
                          key={e.user_id}
                          onClick={() => router.push(`/profile/${e.username}`)}
                          style={{
                            flex: 1, maxWidth: 200,
                            background: `linear-gradient(180deg, ${tc.badge}80, ${C.white})`,
                            border: `2px solid ${tc.border}`,
                            borderRadius: 20,
                            padding: "16px 12px",
                            textAlign: "center",
                            cursor: "pointer",
                            boxShadow: `0 0 16px ${tc.glow}`,
                            minHeight: heights[hIdx],
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
                          }}
                        >
                          <Avatar url={e.avatar_url} username={e.username} size={idx === 0 ? 56 : 44} tier={e.tier} />
                          <div style={{ fontSize: 22, marginTop: 8 }}>
                            {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : "🥉"}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                            {e.full_name || e.username}
                          </div>
                          <div style={{ fontSize: 11, color: C.sub }}>@{e.username}</div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: tc.accent || C.gold, marginTop: 6 }}>
                            {tab === "weekly" ? e.logs_last7 : e.logs_last28}
                          </div>
                          <div style={{ fontSize: 10, color: C.sub }}>logs</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Full list from rank 1 */}
                {users.map(e => (
                  <UserRow
                    key={e.user_id}
                    entry={e}
                    onClick={() => router.push(`/profile/${e.username}`)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const C = {
  purple:"#7C3AED", purpleDim:"#2D1F52", purpleBorder:"#3D2A6E",
  gold:"#F5A623", cyan:"#06B6D4", green:"#4ADE80", red:"#F87171",
  text:"#F0F0F0", sub:"#6B7280", subLight:"#9CA3AF",
  bg:"#0A0A0F", card:"#111118", border:"#1E1E2E",
};

const METRICS: Record<string,{label:string;icon:string;unit:string}> = {
  miles_run:      { label:"Miles Run",      icon:"🏃", unit:"mi" },
  miles_walked:   { label:"Miles Walked",   icon:"🚶", unit:"mi" },
  miles_cycled:   { label:"Miles Cycled",   icon:"🚴", unit:"mi" },
  total_workouts: { label:"Total Workouts", icon:"💪", unit:""   },
  weight_lifted:  { label:"Weight Lifted",  icon:"🏋️", unit:"lbs"},
  weight_lost:    { label:"Weight Lost",    icon:"⚖️", unit:"lbs"},
};

const LIFT_LABELS: Record<string,string> = {
  bench_press:"Bench Press", squat:"Squat",
  deadlift:"Deadlift", dumbbell_curl:"Dumbbell Curl",
};

export default function OpenChallengeBoardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [challenges, setChallenges] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [accepting, setAccepting] = useState<string|null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Open challenges (no opponent yet)
      const { data: chals } = await supabase.from("group_challenges")
        .select(`*, creator_group:creator_group_id(id, name, emoji)`)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      setChallenges(chals || []);

      if (user) {
        // Groups where user is admin/owner
        const { data: mem } = await supabase.from("group_members")
          .select("group_id, role, groups(id, name, emoji)")
          .eq("user_id", user.id)
          .in("role", ["admin","owner"]);
        setMyGroups((mem||[]).filter((m:any) => m.groups));
      }
      setLoading(false);
    }
    load();
  }, [user]);

  async function acceptChallenge(chalId: string, memberCount: number, durationDays: number) {
    if (!selectedGroup) return alert("Select which group to challenge with");
    if (!user) return;
    setAccepting(chalId);
    try {
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + durationDays);

      const { error } = await supabase.from("group_challenges").update({
        opponent_group_id: selectedGroup,
        status: "active",
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      }).eq("id", chalId);
      if (error) throw error;

      alert("Challenge accepted! Head to your group's Challenges tab to add your team.");
      router.push(`/groups/${selectedGroup}/challenges`);
    } catch(e) {
      alert("Error accepting challenge");
    }
    setAccepting(null);
  }

  const filtered = filter === "all" ? challenges : challenges.filter(c => c.metric === filter);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, paddingBottom:100 }}>

      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:50, background:"rgba(10,10,15,0.97)",
        backdropFilter:"blur(14px)", borderBottom:`1px solid ${C.border}`, padding:"14px 16px" }}>
        <div style={{ fontWeight:900, fontSize:22, marginBottom:4 }}>⚔️ Open Challenges</div>
        <div style={{ fontSize:12, color:C.sub, marginBottom:12 }}>
          Groups looking for opponents · Accept to start a war
        </div>
        {/* Filter pills */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", scrollbarWidth:"none" }}>
          {["all", ...Object.keys(METRICS)].map(k => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding:"5px 12px", borderRadius:20, border:`1px solid ${filter===k ? C.purple : C.border}`,
              background: filter===k ? C.purpleDim : "transparent",
              color: filter===k ? "#fff" : C.sub, fontWeight:700, fontSize:11,
              cursor:"pointer", flexShrink:0, whiteSpace:"nowrap",
            }}>
              {k==="all" ? "All" : `${METRICS[k].icon} ${METRICS[k].label}`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"18px 16px", maxWidth:720, margin:"0 auto" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:C.sub }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:C.sub }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🏳️</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:8 }}>No open challenges</div>
            <div style={{ fontSize:13 }}>Head to your group and post one!</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {filtered.map(chal => {
              const meta = METRICS[chal.metric] || METRICS.miles_run;
              return (
                <div key={chal.id} style={{
                  background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:"16px 18px",
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:22 }}>{meta.icon}</span>
                        <div>
                          <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{chal.title}</div>
                          <div style={{ fontSize:11, color:C.sub }}>
                            {chal.creator_group?.emoji} {chal.creator_group?.name}
                          </div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:6 }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99,
                          background:`${C.cyan}22`, color:C.cyan }}>
                          {meta.label}{chal.lift_type ? ` · ${LIFT_LABELS[chal.lift_type]||chal.lift_type}` : ""}
                        </span>
                        <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99,
                          background:`${C.purple}22`, color:C.purple }}>
                          ⚔️ {chal.member_count}v{chal.member_count}
                        </span>
                        <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99,
                          background:`${C.gold}22`, color:C.gold }}>
                          ⏱ {chal.duration_days} days
                        </span>
                      </div>
                      {chal.description && (
                        <div style={{ fontSize:12, color:C.subLight, marginTop:8 }}>{chal.description}</div>
                      )}
                    </div>
                  </div>

                  {/* Accept section */}
                  {myGroups.length > 0 && (
                    <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:11, color:C.sub, marginBottom:8 }}>Accept as:</div>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        {myGroups
                          .filter((m:any) => m.group_id !== chal.creator_group_id) // can't challenge yourself
                          .map((m:any) => (
                          <button key={m.group_id} onClick={() => setSelectedGroup(
                            selectedGroup === m.group_id ? "" : m.group_id
                          )} style={{
                            padding:"6px 12px", borderRadius:10,
                            border:`1px solid ${selectedGroup===m.group_id ? C.green : C.border}`,
                            background: selectedGroup===m.group_id ? "rgba(74,222,128,0.12)" : "transparent",
                            color: selectedGroup===m.group_id ? C.green : C.sub,
                            fontSize:12, fontWeight:700, cursor:"pointer",
                          }}>
                            {m.groups?.emoji} {m.groups?.name}
                          </button>
                        ))}
                      </div>
                      {selectedGroup && !myGroups.find((m:any) => m.group_id === selectedGroup && m.group_id === chal.creator_group_id) && (
                        <button
                          onClick={() => acceptChallenge(chal.id, chal.member_count, chal.duration_days)}
                          disabled={!!accepting}
                          style={{
                            marginTop:10, width:"100%", padding:"11px 0", borderRadius:12, border:"none",
                            background:`linear-gradient(135deg,${C.green},#16A34A)`,
                            color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer",
                          }}>
                          {accepting === chal.id ? "Accepting..." : "⚔️ Accept Challenge"}
                        </button>
                      )}
                    </div>
                  )}
                  {myGroups.length === 0 && (
                    <div style={{ marginTop:10, fontSize:12, color:C.sub }}>
                      Join a group as admin to accept challenges.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

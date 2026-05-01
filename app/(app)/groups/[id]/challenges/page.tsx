"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  purple:"#7C3AED", purpleDim:"#2D1F52", purpleBorder:"#3D2A6E",
  gold:"#F5A623",   cyan:"#06B6D4",      green:"#4ADE80",
  red:"#F87171",    orange:"#FB923C",
  text:"#F0F0F0",   sub:"#6B7280",       subLight:"#9CA3AF",
  bg:"#0A0A0F",     card:"#111118",      cardHi:"#16161F",
  border:"#1E1E2E", borderHi:"#2D2040",
};

// ── Metric config ─────────────────────────────────────────────────────────────
const METRICS = [
  { key:"miles_run",       label:"Miles Run",         icon:"🏃", unit:"mi",  cumulative:true  },
  { key:"miles_walked",    label:"Miles Walked",      icon:"🚶", unit:"mi",  cumulative:true  },
  { key:"miles_cycled",    label:"Miles Cycled",      icon:"🚴", unit:"mi",  cumulative:true  },
  { key:"total_workouts",  label:"Total Workouts",    icon:"💪", unit:"",    cumulative:true  },
  { key:"weight_lifted",   label:"Weight Lifted",     icon:"🏋️", unit:"lbs", cumulative:false },
  { key:"weight_lost",     label:"Weight Lost",       icon:"⚖️", unit:"lbs", cumulative:false },
] as const;
type Metric = typeof METRICS[number]["key"];

const LIFT_TYPES = [
  { key:"bench_press",    label:"Bench Press"    },
  { key:"squat",          label:"Squat"          },
  { key:"deadlift",       label:"Deadlift"       },
  { key:"dumbbell_curl",  label:"Dumbbell Curl"  },
];

function metaFor(metric: Metric) {
  return METRICS.find(m => m.key === metric) ?? METRICS[0];
}

// ── Small UI atoms ────────────────────────────────────────────────────────────
function Pill({ label, color }: { label:string; color:string }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99,
      background:`${color}22`, color, border:`1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function statusColor(s:string) {
  if (s==="open")      return C.cyan;
  if (s==="active")    return C.green;
  if (s==="completed") return C.gold;
  return C.sub;
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ a, b, labelA, labelB, unit }:
  { a:number; b:number; labelA:string; labelB:string; unit:string }) {
  const total = a + b || 1;
  const pctA = Math.round((a/total)*100);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:13, fontWeight:700 }}>
        <span style={{ color:C.purple }}>{labelA}</span>
        <span style={{ color:C.sub, fontSize:11 }}>{a.toLocaleString()}{unit} vs {b.toLocaleString()}{unit}</span>
        <span style={{ color:C.cyan }}>{labelB}</span>
      </div>
      <div style={{ height:10, borderRadius:99, background:C.border, overflow:"hidden", display:"flex" }}>
        <div style={{ width:`${pctA}%`, background:C.purple, borderRadius:"99px 0 0 99px", transition:"width 0.5s" }}/>
        <div style={{ flex:1, background:C.cyan, borderRadius:"0 99px 99px 0" }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, fontSize:10, color:C.sub }}>
        <span>{pctA}%</span><span>{100-pctA}%</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GroupChallengesPage() {
  const { id: groupId } = useParams<{ id:string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<"active"|"open"|"completed">("active");
  const [challenges, setChallenges] = useState<any[]>([]);
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBoard, setShowBoard] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    title:"", description:"", metric:"miles_run" as Metric,
    lift_type:"", duration_days:7, member_count:5,
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Load group + challenges
  const load = useCallback(async () => {
    if (!user || !groupId) return;
    setLoading(true);
    try {
      // Group info
      const { data: grp } = await supabase.from("groups").select("*").eq("id", groupId).single();
      setGroupInfo(grp);

      // Check if user is admin/owner
      const { data: mem } = await supabase.from("group_members")
        .select("role").eq("group_id", groupId).eq("user_id", user.id).single();
      setIsAdmin(mem?.role === "admin" || mem?.role === "owner" || grp?.creator_id === user.id);

      // All group members
      const { data: members } = await supabase.from("group_members")
        .select("user_id, role, users(id, username, full_name, avatar_url)")
        .eq("group_id", groupId);
      setGroupMembers(members || []);

      // Challenges involving this group
      const { data: chals } = await supabase.from("group_challenges")
        .select(`
          *,
          creator_group:creator_group_id(id, name),
          opponent_group:opponent_group_id(id, name),
          winner_group:winner_group_id(id, name),
          group_challenge_members(
            user_id, group_id, contribution, weight_entry, weight_submitted,
            users(id, username, full_name, avatar_url)
          ),
          group_challenge_media(id, media_url, media_type, caption, created_at, user_id)
        `)
        .or(`creator_group_id.eq.${groupId},opponent_group_id.eq.${groupId}`)
        .order("created_at", { ascending: false });
      setChallenges(chals || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [user, groupId]);

  useEffect(() => { load(); }, [load]);

  // ── Create challenge ────────────────────────────────────────────────────────
  async function createChallenge() {
    if (!user || !groupId) return;
    if (!form.title.trim()) return alert("Please add a title");
    if (selectedMembers.length === 0) return alert("Select at least 1 member");
    if (form.metric === "weight_lifted" && !form.lift_type) return alert("Select a lift type");

    setSaving(true);
    try {
      const { data: chal, error } = await supabase.from("group_challenges").insert({
        creator_group_id: groupId,
        title: form.title,
        description: form.description,
        metric: form.metric,
        lift_type: form.metric === "weight_lifted" ? form.lift_type : null,
        duration_days: form.duration_days,
        member_count: selectedMembers.length,
        status: "open",
      }).select().single();
      if (error) throw error;

      // Add selected members
      await supabase.from("group_challenge_members").insert(
        selectedMembers.map(uid => ({
          challenge_id: chal.id,
          user_id: uid,
          group_id: groupId,
        }))
      );

      setShowCreate(false);
      setForm({ title:"", description:"", metric:"miles_run", lift_type:"", duration_days:7, member_count:5 });
      setSelectedMembers([]);
      load();
    } catch(e) { console.error(e); alert("Error creating challenge"); }
    setSaving(false);
  }

  // ── Accept challenge (opponent group admin) ─────────────────────────────────
  async function acceptChallenge(chalId: string) {
    if (!user || !groupId) return;
    const countNeeded = challenges.find(c => c.id === chalId)?.member_count || 5;

    // Show member selection UI — simplified: auto-select first N members
    const memberIds = groupMembers.slice(0, countNeeded).map((m:any) => m.user_id);

    const start = new Date();
    const chal = challenges.find(c => c.id === chalId);
    const end = new Date(start);
    end.setDate(end.getDate() + (chal?.duration_days || 7));

    const { error } = await supabase.from("group_challenges").update({
      opponent_group_id: groupId,
      status: "active",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    }).eq("id", chalId);
    if (error) { alert("Error accepting challenge"); return; }

    await supabase.from("group_challenge_members").insert(
      memberIds.map((uid:string) => ({
        challenge_id: chalId, user_id: uid, group_id: groupId,
      }))
    );
    load();
  }

  // ── Submit weight entry ─────────────────────────────────────────────────────
  async function submitWeightEntry(chalId:string, value:number) {
    if (!user) return;
    await supabase.from("group_challenge_members")
      .update({ weight_entry: value, weight_submitted: true })
      .eq("challenge_id", chalId).eq("user_id", user.id);

    // Recalc group score for weight metric
    const { data: members } = await supabase.from("group_challenge_members")
      .select("weight_entry, group_id, weight_submitted").eq("challenge_id", chalId);

    const chal = challenges.find(c => c.id === chalId);
    if (!chal) return;
    const creatorMembers = (members||[]).filter(m => m.group_id === chal.creator_group_id);
    const opponentMembers = (members||[]).filter(m => m.group_id === chal.opponent_group_id);
    const creatorScore = creatorMembers.reduce((s:number,m:any) => s+(m.weight_entry||0), 0);
    const opponentScore = opponentMembers.reduce((s:number,m:any) => s+(m.weight_entry||0), 0);

    await supabase.from("group_challenges").update({ creator_score: creatorScore, opponent_score: opponentScore }).eq("id", chalId);

    // Check if all submitted → auto-complete
    const allSubmitted = (members||[]).every((m:any) => m.weight_submitted);
    if (allSubmitted) {
      await supabase.from("group_challenges").update({
        status: "completed",
        winner_group_id: creatorScore > opponentScore ? chal.creator_group_id : opponentScore > creatorScore ? chal.opponent_group_id : null,
      }).eq("id", chalId);
    }
    load();
  }

  // ── Cancel challenge ────────────────────────────────────────────────────────
  async function cancelChallenge(chalId:string) {
    if (!confirm("Cancel this challenge?")) return;
    await supabase.from("group_challenges").update({ status:"cancelled" }).eq("id", chalId);
    load();
  }

  // ── Filter challenges by tab ────────────────────────────────────────────────
  const filtered = challenges.filter(c => {
    if (tab === "active")    return c.status === "active";
    if (tab === "open")      return c.status === "open";
    if (tab === "completed") return ["completed","cancelled"].includes(c.status);
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, paddingBottom:100 }}>

      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:50, background:"rgba(10,10,15,0.97)",
        backdropFilter:"blur(14px)", borderBottom:`1px solid ${C.border}`, padding:"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div>
            <button onClick={() => router.back()} style={{ background:"none", border:"none", color:C.sub, cursor:"pointer", fontSize:13, marginBottom:4 }}>← Back</button>
            <div style={{ fontWeight:900, fontSize:20, color:C.text }}>⚔️ Group Challenges</div>
            {groupInfo && <div style={{ fontSize:12, color:C.sub }}>{groupInfo.name}</div>}
          </div>
          {isAdmin && (
            <button onClick={() => setShowCreate(true)} style={{
              padding:"9px 16px", borderRadius:12, border:"none",
              background:`linear-gradient(135deg,${C.purple},#A78BFA)`,
              color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer",
            }}>+ Create Challenge</button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4 }}>
          {(["active","open","completed"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:"7px 14px", borderRadius:20, border:`1px solid ${tab===t ? C.purple : C.border}`,
              background: tab===t ? C.purpleDim : "transparent",
              color: tab===t ? "#fff" : C.sub, fontWeight:700, fontSize:12, cursor:"pointer",
              textTransform:"capitalize",
            }}>{t === "active" ? "⚡ Active" : t === "open" ? "📋 Open" : "🏁 Completed"}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"18px 16px", maxWidth:720, margin:"0 auto" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:C.sub }}>Loading challenges...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:C.sub }}>
            <div style={{ fontSize:40, marginBottom:12 }}>
              {tab==="active" ? "⚔️" : tab==="open" ? "📋" : "🏁"}
            </div>
            <div style={{ fontWeight:700, fontSize:16, color:C.text, marginBottom:8 }}>
              {tab==="active" ? "No active challenges" : tab==="open" ? "No open challenges" : "No completed challenges"}
            </div>
            <div style={{ fontSize:13 }}>
              {tab==="open" && isAdmin && "Create a challenge to find an opponent."}
              {tab==="active" && "Accept an open challenge to get started."}
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {filtered.map(chal => {
              const meta = metaFor(chal.metric);
              const isCreator = chal.creator_group_id === groupId;
              const isOpponent = chal.opponent_group_id === groupId;
              const myGroupScore = isCreator ? chal.creator_score : chal.opponent_score;
              const theirGroupScore = isCreator ? chal.opponent_score : chal.creator_score;
              const myGroupName = isCreator ? chal.creator_group?.name : chal.opponent_group?.name;
              const theirGroupName = isCreator ? chal.opponent_group?.name : chal.creator_group?.name;
              const myMembers = (chal.group_challenge_members||[]).filter((m:any) => m.group_id === groupId);
              const theirMembers = (chal.group_challenge_members||[]).filter((m:any) => m.group_id !== groupId);

              // Top 5 contributors from my side
              const top5 = [...myMembers].sort((a:any,b:any) => (b.contribution||0)-(a.contribution||0)).slice(0,5);

              const daysLeft = chal.end_date
                ? Math.max(0, Math.ceil((new Date(chal.end_date).getTime() - Date.now()) / 86400000))
                : null;

              return (
                <div key={chal.id} style={{
                  background:C.card, borderRadius:18, border:`1px solid ${C.border}`,
                  overflow:"hidden",
                }}>
                  {/* Card header */}
                  <div style={{ padding:"16px 18px", borderBottom:`1px solid ${C.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <span style={{ fontSize:20 }}>{meta.icon}</span>
                          <span style={{ fontWeight:900, fontSize:16, color:C.text }}>{chal.title}</span>
                          <Pill label={chal.status.toUpperCase()} color={statusColor(chal.status)}/>
                        </div>
                        <div style={{ fontSize:12, color:C.sub }}>
                          {meta.label}
                          {chal.lift_type && ` · ${LIFT_TYPES.find(l=>l.key===chal.lift_type)?.label}`}
                          {chal.duration_days && ` · ${chal.duration_days} days`}
                          {daysLeft !== null && chal.status === "active" && ` · ${daysLeft}d left`}
                        </div>
                        {chal.description && <div style={{ fontSize:12, color:C.subLight, marginTop:4 }}>{chal.description}</div>}
                      </div>
                      <div style={{ display:"flex", gap:8, flexShrink:0, marginLeft:12 }}>
                        {/* Show live board button for active */}
                        {chal.status === "active" && (
                          <button onClick={() => { setSelectedChallenge(chal); setShowBoard(true); }} style={{
                            padding:"6px 12px", borderRadius:10, border:`1px solid ${C.border}`,
                            background:"transparent", color:C.sub, fontSize:12, fontWeight:700, cursor:"pointer",
                          }}>📊 Board</button>
                        )}
                        {/* Accept button for open challenges if we're a different group */}
                        {chal.status === "open" && !isCreator && !isOpponent && isAdmin && (
                          <button onClick={() => acceptChallenge(chal.id)} style={{
                            padding:"6px 14px", borderRadius:10, border:"none",
                            background:`linear-gradient(135deg,${C.green},#16A34A)`,
                            color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer",
                          }}>⚔️ Accept</button>
                        )}
                        {/* Cancel for creator */}
                        {(chal.status === "open" || chal.status === "active") && isCreator && isAdmin && (
                          <button onClick={() => cancelChallenge(chal.id)} style={{
                            padding:"6px 10px", borderRadius:10, border:`1px solid ${C.border}`,
                            background:"transparent", color:C.red, fontSize:11, fontWeight:700, cursor:"pointer",
                          }}>Cancel</button>
                        )}
                      </div>
                    </div>

                    {/* Vs display for active/completed */}
                    {(chal.status === "active" || chal.status === "completed") && chal.opponent_group_id && (
                      <ScoreBar
                        a={isCreator ? chal.creator_score : chal.opponent_score}
                        b={isCreator ? chal.opponent_score : chal.creator_score}
                        labelA={myGroupName || "Us"}
                        labelB={theirGroupName || "Them"}
                        unit={meta.unit ? ` ${meta.unit}` : ""}
                      />
                    )}

                    {/* Open: looking for opponent */}
                    {chal.status === "open" && (
                      <div style={{ background:C.purpleDim, borderRadius:10, padding:"10px 14px",
                        border:`1px solid ${C.purpleBorder}`, fontSize:12, color:C.subLight, marginTop:8 }}>
                        🔍 Looking for an opponent · {chal.member_count}v{chal.member_count} · {meta.label}
                      </div>
                    )}

                    {/* Winner banner */}
                    {chal.status === "completed" && (
                      <div style={{
                        marginTop:10, padding:"10px 14px", borderRadius:10,
                        background: chal.winner_group_id === groupId ? "rgba(245,166,35,0.15)" : "rgba(30,30,46,0.6)",
                        border: `1px solid ${chal.winner_group_id === groupId ? C.gold : C.border}`,
                        fontSize:13, fontWeight:700,
                        color: chal.winner_group_id === groupId ? C.gold : C.sub,
                      }}>
                        {chal.winner_group_id === groupId ? "🏆 Your group won!" :
                         chal.winner_group_id ? `🥈 ${chal.winner_group?.name || "Opponent"} won` :
                         "🤝 It was a tie"}
                      </div>
                    )}
                  </div>

                  {/* My group's top 5 contributors */}
                  {myMembers.length > 0 && (
                    <div style={{ padding:"12px 18px" }}>
                      <div style={{ fontSize:10, fontWeight:700, color:C.sub, textTransform:"uppercase",
                        letterSpacing:1, marginBottom:8 }}>
                        Top Contributors — {myGroupName || "Your Group"}
                      </div>
                      {top5.map((m:any, i:number) => {
                        const u = m.users;
                        const val = chal.metric.includes("weight") ? (m.weight_entry||0) : (m.contribution||0);
                        const maxVal = top5[0] ? (chal.metric.includes("weight") ? (top5[0].weight_entry||1) : (top5[0].contribution||1)) : 1;
                        return (
                          <div key={m.user_id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                            <div style={{ fontSize:12, fontWeight:800, color:i===0?C.gold:C.sub, width:16 }}>
                              {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                            </div>
                            <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${C.purple},#A78BFA)`,
                              display:"flex", alignItems:"center", justifyContent:"center", fontSize:11,
                              fontWeight:900, color:"#fff", flexShrink:0, overflow:"hidden" }}>
                              {u?.avatar_url
                                ? <img src={u.avatar_url} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                                : (u?.full_name||u?.username||"?")[0]?.toUpperCase()}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:700, color:C.text, overflow:"hidden",
                                textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {u?.full_name || u?.username || "Member"}
                              </div>
                              <div style={{ height:4, background:C.border, borderRadius:99, overflow:"hidden", marginTop:3 }}>
                                <div style={{ width:`${maxVal>0?Math.round((val/maxVal)*100):0}%`,
                                  height:"100%", background:i===0?C.gold:C.purple, borderRadius:99 }}/>
                              </div>
                            </div>
                            <div style={{ fontSize:12, fontWeight:800, color:i===0?C.gold:C.text, flexShrink:0 }}>
                              {val}{meta.unit}
                            </div>
                            {/* Weight entry button for weight metrics */}
                            {chal.metric.includes("weight") && m.user_id === user?.id && !m.weight_submitted && (
                              <button onClick={() => {
                                const v = parseFloat(prompt(`Enter your ${chal.metric === "weight_lifted" ?
                                  LIFT_TYPES.find(l=>l.key===chal.lift_type)?.label||"lift" : "weight lost"
                                } in lbs:`) || "0");
                                if (v > 0) submitWeightEntry(chal.id, v);
                              }} style={{
                                padding:"4px 10px", borderRadius:8, border:"none",
                                background:C.purple, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer",
                              }}>Submit</button>
                            )}
                            {chal.metric.includes("weight") && m.weight_submitted && (
                              <span style={{ fontSize:10, color:C.green }}>✓</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Media wall preview */}
                  {(chal.group_challenge_media||[]).length > 0 && (
                    <div style={{ padding:"0 18px 14px" }}>
                      <div style={{ fontSize:10, fontWeight:700, color:C.sub, textTransform:"uppercase",
                        letterSpacing:1, marginBottom:8 }}>📸 Challenge Media</div>
                      <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
                        {chal.group_challenge_media.slice(0,8).map((m:any) => {
                          const isVid = m.media_type === 'video' || (typeof m.media_url === 'string' && /\.(mp4|mov|webm|m4v|qt)(\?|#|$)/i.test(m.media_url));
                          return isVid ? (
                            <video key={m.id} src={m.media_url} preload="metadata" muted playsInline
                              onClick={(e) => { e.stopPropagation(); (e.currentTarget as HTMLVideoElement).paused ? (e.currentTarget as HTMLVideoElement).play() : (e.currentTarget as HTMLVideoElement).pause(); }}
                              style={{ width:72, height:72, borderRadius:10, objectFit:"cover", flexShrink:0,
                                border:`1px solid ${C.border}`, background:"#000", cursor:"pointer" }}/>
                          ) : (
                            <img key={m.id} src={m.media_url} alt={m.caption||""}
                              style={{ width:72, height:72, borderRadius:10, objectFit:"cover", flexShrink:0,
                                border:`1px solid ${C.border}` }}/>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CREATE CHALLENGE MODAL ─────────────────────────────────────────── */}
      {showCreate && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200,
          display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={e => { if (e.target===e.currentTarget) setShowCreate(false); }}>
          <div style={{ background:C.card, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:560,
            maxHeight:"90vh", overflowY:"auto", padding:"24px 20px 40px" }}>
            <div style={{ fontWeight:900, fontSize:20, color:C.text, marginBottom:4 }}>⚔️ Create Challenge</div>
            <div style={{ fontSize:12, color:C.sub, marginBottom:20 }}>
              This will appear on the open board for any group to accept.
            </div>

            {/* Title */}
            <label style={{ fontSize:11, fontWeight:700, color:C.sub, display:"block", marginBottom:5, textTransform:"uppercase" }}>Title</label>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
              placeholder="e.g. Summer Mile Challenge" style={{
                width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:10,
                padding:"10px 12px", fontSize:14, color:C.text, outline:"none", boxSizing:"border-box", marginBottom:14 }}/>

            {/* Description */}
            <label style={{ fontSize:11, fontWeight:700, color:C.sub, display:"block", marginBottom:5, textTransform:"uppercase" }}>Description (optional)</label>
            <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
              placeholder="What's this challenge about?" rows={2} style={{
                width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:10,
                padding:"10px 12px", fontSize:13, color:C.text, outline:"none", resize:"vertical",
                boxSizing:"border-box", marginBottom:14 }}/>

            {/* Metric */}
            <label style={{ fontSize:11, fontWeight:700, color:C.sub, display:"block", marginBottom:8, textTransform:"uppercase" }}>Challenge Type</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
              {METRICS.map(m => (
                <button key={m.key} onClick={() => setForm(f=>({...f,metric:m.key as Metric}))} style={{
                  padding:"10px 8px", borderRadius:10, border:`1.5px solid ${form.metric===m.key ? C.purple : C.border}`,
                  background: form.metric===m.key ? C.purpleDim : "transparent",
                  color: form.metric===m.key ? "#fff" : C.sub, cursor:"pointer", fontSize:12, fontWeight:700,
                }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>{m.icon}</div>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Lift type (only for weight_lifted) */}
            {form.metric === "weight_lifted" && (
              <>
                <label style={{ fontSize:11, fontWeight:700, color:C.sub, display:"block", marginBottom:8, textTransform:"uppercase" }}>Lift Type</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
                  {LIFT_TYPES.map(l => (
                    <button key={l.key} onClick={() => setForm(f=>({...f,lift_type:l.key}))} style={{
                      padding:"10px", borderRadius:10, border:`1.5px solid ${form.lift_type===l.key ? C.gold : C.border}`,
                      background: form.lift_type===l.key ? "rgba(245,166,35,0.12)" : "transparent",
                      color: form.lift_type===l.key ? C.gold : C.sub, cursor:"pointer", fontSize:13, fontWeight:700,
                    }}>{l.label}</button>
                  ))}
                </div>
              </>
            )}

            {/* Duration */}
            <label style={{ fontSize:11, fontWeight:700, color:C.sub, display:"block", marginBottom:8, textTransform:"uppercase" }}>Duration</label>
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              {[3,7,14,30].map(d => (
                <button key={d} onClick={() => setForm(f=>({...f,duration_days:d}))} style={{
                  padding:"8px 16px", borderRadius:20, border:`1px solid ${form.duration_days===d ? C.purple : C.border}`,
                  background: form.duration_days===d ? C.purpleDim : "transparent",
                  color: form.duration_days===d ? "#fff" : C.sub, cursor:"pointer", fontSize:13, fontWeight:700,
                }}>{d} days</button>
              ))}
            </div>

            {/* Member selection */}
            <label style={{ fontSize:11, fontWeight:700, color:C.sub, display:"block", marginBottom:8, textTransform:"uppercase" }}>
              Select Your Team ({selectedMembers.length} selected)
            </label>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20, maxHeight:200, overflowY:"auto" }}>
              {groupMembers.map((m:any) => {
                const u = m.users;
                const sel = selectedMembers.includes(m.user_id);
                return (
                  <button key={m.user_id} onClick={() => setSelectedMembers(s =>
                    sel ? s.filter(id=>id!==m.user_id) : [...s, m.user_id]
                  )} style={{
                    display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
                    borderRadius:10, border:`1px solid ${sel ? C.purple : C.border}`,
                    background: sel ? C.purpleDim : "transparent", cursor:"pointer", textAlign:"left",
                  }}>
                    <div style={{ width:30, height:30, borderRadius:"50%", background:`linear-gradient(135deg,${C.purple},#A78BFA)`,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:12,
                      fontWeight:900, color:"#fff", flexShrink:0 }}>
                      {(u?.full_name||u?.username||"?")[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{u?.full_name || u?.username}</div>
                      <div style={{ fontSize:11, color:C.sub }}>@{u?.username} · {m.role}</div>
                    </div>
                    {sel && <div style={{ marginLeft:"auto", color:C.purple, fontWeight:800 }}>✓</div>}
                  </button>
                );
              })}
            </div>

            {/* Submit */}
            <button onClick={createChallenge} disabled={saving} style={{
              width:"100%", padding:"13px 0", borderRadius:14, border:"none",
              background:`linear-gradient(135deg,${C.purple},#A78BFA)`,
              color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer",
            }}>{saving ? "Creating..." : "⚔️ Post Challenge"}</button>

            <button onClick={() => setShowCreate(false)} style={{
              width:"100%", marginTop:10, padding:"11px 0", borderRadius:14,
              border:`1px solid ${C.border}`, background:"transparent",
              color:C.sub, fontWeight:700, fontSize:14, cursor:"pointer",
            }}>Cancel</button>
          </div>
        </div>
      )}

    </div>
  );
}

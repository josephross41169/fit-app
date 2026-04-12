"use client";
import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Dot } from "recharts";
import { supabase } from "@/lib/supabase";

const C = {
  purple: "#7C3AED",
  purpleDark: "#6D28D9",
  purpleLight: "#F3F0FF",
  purpleMid: "#DDD6FE",
  gold: "#F5A623",
  text: "#F0F0F0",
  sub: "#9CA3AF",
  bg: "#1A1D2E",
  card: "#0F1117",
  border: "#2D2B3A",
};

type WeightLog = {
  id: string;
  weight_lbs: number;
  logged_at: string;
  notes?: string;
};

type Props = {
  userId: string;
};

const RANGE_OPTIONS = [
  { label: "2W", days: 14 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "All", days: 9999 },
];

function formatDate(isoStr: string) {
  const d = new Date(isoStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateFull(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Custom tooltip for chart
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  return (
    <div style={{
      background: C.bg,
      border: `1.5px solid ${C.purpleMid}`,
      borderRadius: 12,
      padding: "10px 14px",
      boxShadow: "0 4px 16px rgba(124,58,237,0.25)",
    }}>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 2 }}>{formatDateFull(entry.logged_at)}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: C.purple }}>{entry.weight_lbs} lbs</div>
      {entry.notes && <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>{entry.notes}</div>}
    </div>
  );
}

export default function WeightTracker({ userId }: Props) {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState(30);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("weight_logs")
        .select("id, weight_lbs, logged_at, notes")
        .eq("user_id", userId)
        .order("logged_at", { ascending: true })
        .limit(200);
      setLogs(data || []);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Filter by range
  const now = Date.now();
  const cutoff = range === 9999 ? 0 : now - range * 24 * 60 * 60 * 1000;
  const filtered = logs.filter(l => new Date(l.logged_at).getTime() >= cutoff);
  const chartData = filtered.map(l => ({ ...l, date: formatDate(l.logged_at) }));

  // Stats
  const allWeights = filtered.map(l => l.weight_lbs);
  const latest = allWeights.at(-1);
  const first = allWeights[0];
  const change = latest !== undefined && first !== undefined ? +(latest - first).toFixed(1) : null;
  const minW = allWeights.length ? Math.min(...allWeights) : null;
  const maxW = allWeights.length ? Math.max(...allWeights) : null;
  // 7-day avg
  const last7 = logs.filter(l => new Date(l.logged_at).getTime() >= now - 7 * 24 * 60 * 60 * 1000);
  const avg7 = last7.length ? +(last7.reduce((s, l) => s + l.weight_lbs, 0) / last7.length).toFixed(1) : null;

  async function logWeight() {
    const w = parseFloat(weightInput);
    if (!w || isNaN(w) || w < 50 || w > 999) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("weight_logs")
        .insert({
          user_id: userId,
          weight_lbs: w,
          notes: notesInput.trim() || null,
        })
        .select()
        .single();
      if (!error && data) {
        setLogs(prev => [...prev, data].sort((a, b) =>
          new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
        ));
        setWeightInput("");
        setNotesInput("");
        setShowInput(false);
      }
    } catch {}
    setSaving(false);
  }

  async function deleteLog(id: string) {
    await supabase.from("weight_logs").delete().eq("id", id).eq("user_id", userId);
    setLogs(prev => prev.filter(l => l.id !== id));
    setDeleteId(null);
  }

  // Y-axis domain with some padding
  const yMin = minW !== null ? Math.floor(minW - 3) : 150;
  const yMax = maxW !== null ? Math.ceil(maxW + 3) : 250;

  const inputStyle: React.CSSProperties = {
    background: "#1A1D2E",
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 14,
    color: C.text,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      background: C.card,
      borderRadius: 22,
      padding: 24,
      border: `2px solid ${C.border}`,
      boxShadow: "0 4px 14px rgba(124,58,237,0.08)",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 17, color: C.text }}>⚖️ Body Weight</div>
        <button
          onClick={() => setShowInput(s => !s)}
          style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20,
            background: showInput ? C.border : C.purple, color: "#fff",
            border: "none", cursor: "pointer",
          }}
        >
          {showInput ? "✕ Cancel" : "+ Log Weight"}
        </button>
      </div>

      {/* Log input */}
      {showInput && (
        <div style={{
          background: "#111827", borderRadius: 16, padding: 16,
          border: `1.5px solid ${C.purpleMid}`, marginBottom: 16,
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>
                WEIGHT (LBS)
              </label>
              <input
                style={inputStyle}
                type="number"
                inputMode="decimal"
                placeholder="e.g. 215.5"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") logWeight(); }}
                autoFocus
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.sub, display: "block", marginBottom: 4 }}>
              NOTES (OPTIONAL)
            </label>
            <input
              style={inputStyle}
              placeholder="e.g. morning, post-workout, etc."
              value={notesInput}
              onChange={e => setNotesInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") logWeight(); }}
            />
          </div>
          <button
            onClick={logWeight}
            disabled={saving || !weightInput}
            style={{
              padding: "11px 0", borderRadius: 12, border: "none",
              background: weightInput ? `linear-gradient(135deg,${C.purple},#A78BFA)` : "#374151",
              color: "#fff", fontWeight: 900, cursor: weightInput ? "pointer" : "not-allowed",
              fontSize: 14,
            }}
          >
            {saving ? "Saving..." : "💾 Save Weight"}
          </button>
        </div>
      )}

      {/* Stats row */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: C.sub }}>
          <div style={{ fontSize: 13 }}>Loading...</div>
        </div>
      ) : logs.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "32px 16px",
          background: "#111827", borderRadius: 16, border: `1.5px dashed ${C.border}`,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚖️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.sub, marginBottom: 4 }}>No weigh-ins yet</div>
          <div style={{ fontSize: 12, color: C.sub }}>Log your first weight above to start tracking your trend</div>
        </div>
      ) : (
        <>
          {/* Stats pills */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div style={{ background: "#111827", borderRadius: 14, padding: "12px 10px", textAlign: "center", border: `1.5px solid ${C.border}` }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.purple }}>{latest ?? "—"}</div>
              <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Current (lbs)</div>
            </div>
            <div style={{ background: "#111827", borderRadius: 14, padding: "12px 10px", textAlign: "center", border: `1.5px solid ${C.border}` }}>
              <div style={{
                fontSize: 22, fontWeight: 900,
                color: change === null ? C.sub : change < 0 ? "#4ADE80" : change > 0 ? "#EF4444" : C.sub,
              }}>
                {change === null ? "—" : `${change > 0 ? "+" : ""}${change}`}
              </div>
              <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Change ({RANGE_OPTIONS.find(r => r.days === range)?.label || "range"})
              </div>
            </div>
            {avg7 !== null && (
              <div style={{ background: "#111827", borderRadius: 14, padding: "12px 10px", textAlign: "center", border: `1.5px solid ${C.border}` }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.gold }}>{avg7}</div>
                <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>7-Day Avg</div>
              </div>
            )}
            {minW !== null && (
              <div style={{ background: "#111827", borderRadius: 14, padding: "12px 10px", textAlign: "center", border: `1.5px solid ${C.border}` }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#4ADE80" }}>{minW}</div>
                <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Lowest</div>
              </div>
            )}
          </div>

          {/* Range selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setRange(opt.days)}
                style={{
                  flex: 1, padding: "6px 0", borderRadius: 10, border: "none",
                  background: range === opt.days ? C.purple : "#111827",
                  color: range === opt.days ? "#fff" : C.sub,
                  fontSize: 11, fontWeight: 800, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Trend chart */}
          {chartData.length > 1 ? (
            <div style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: C.sub }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[yMin, yMax]}
                    tick={{ fontSize: 10, fill: C.sub }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {avg7 !== null && (
                    <ReferenceLine
                      y={avg7}
                      stroke={C.gold}
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="weight_lbs"
                    stroke={C.purple}
                    strokeWidth={2.5}
                    dot={(props: any) => {
                      const isLatest = props.index === chartData.length - 1;
                      return (
                        <Dot
                          {...props}
                          r={isLatest ? 6 : 3}
                          fill={isLatest ? C.purple : "#A78BFA"}
                          strokeWidth={isLatest ? 2 : 0}
                          stroke={isLatest ? "#fff" : "none"}
                        />
                      );
                    }}
                    activeDot={{ r: 7, fill: C.purple, stroke: "#fff", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              {avg7 !== null && (
                <div style={{ fontSize: 10, color: C.sub, textAlign: "center", marginTop: 4 }}>
                  <span style={{ color: C.gold }}>— </span>7-day average ({avg7} lbs)
                </div>
              )}
            </div>
          ) : chartData.length === 1 ? (
            <div style={{ textAlign: "center", padding: "12px 0 16px", color: C.sub, fontSize: 12 }}>
              Log a second weigh-in to see your trend chart
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "12px 0 16px", color: C.sub, fontSize: 12 }}>
              No entries in this time range
            </div>
          )}

          {/* Recent logs */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Recent Weigh-ins
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...logs].reverse().slice(0, 7).map(log => (
                <div
                  key={log.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "#111827", borderRadius: 12, padding: "10px 12px",
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 17, fontWeight: 900, color: C.purple }}>{log.weight_lbs}</span>
                      <span style={{ fontSize: 11, color: C.sub }}>lbs</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>
                      {formatDateFull(log.logged_at)}
                      {log.notes && <span style={{ color: "#6B7280" }}> · {log.notes}</span>}
                    </div>
                  </div>
                  <div style={{ position: "relative" }}>
                    {deleteId === log.id ? (
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          onClick={() => deleteLog(log.id)}
                          style={{ padding: "4px 8px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer" }}
                        >Del</button>
                        <button
                          onClick={() => setDeleteId(null)}
                          style={{ padding: "4px 8px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.sub, fontWeight: 800, fontSize: 11, cursor: "pointer" }}
                        >No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteId(log.id)}
                        style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#1F2937", color: C.sub, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {logs.length > 7 && (
              <div style={{ fontSize: 11, color: C.sub, textAlign: "center", marginTop: 8 }}>
                {logs.length - 7} more entries
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

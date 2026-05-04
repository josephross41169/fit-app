// ─── components/GymLeaderboard.tsx ──────────────────────────────────────
// Public leaderboard rendered on a business profile (gym/studio). Owner
// can add/edit/delete entries; everyone else sees a read-only view.
//
// Categories:
//   • Strength: bench, squat, deadlift, ohp, db_curl, pullups
//   • Speed:    mile, 5k, 10k, row_2k (stored as seconds)
//   • Cardio:   cycle_distance (miles)
//   • Special:  club_1000 (sum of bench+squat+deadlift)
//   • Custom:   gym defines their own category
//
// Tagging rules:
//   • Search restricted to users currently following the gym
//   • Free-text display name allowed for non-followers / non-Livelee folks
//
// All-time leaderboard, no time window. Owner curates.

"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types + categories ─────────────────────────────────────────────────

type CategoryKey =
  | "club_1000" | "bench" | "squat" | "deadlift" | "ohp"
  | "db_curl" | "pullups"
  | "mile" | "5k" | "10k" | "row_2k"
  | "cycle_distance"
  | "custom";

type CategoryDef = {
  key: CategoryKey;
  label: string;
  emoji: string;
  unit: string;        // display unit
  /** "weight" → lbs (descending = best), "time" → seconds (ascending = best),
   *  "reps" → count (desc), "distance" → miles (desc). Drives sorting +
   *  the input UI for time entries (we want mm:ss not "180 seconds"). */
  kind: "weight" | "time" | "reps" | "distance";
};

const CATEGORIES: CategoryDef[] = [
  { key: "club_1000",      label: "1000-lb Club", emoji: "💪", unit: "lbs",   kind: "weight"   },
  { key: "bench",          label: "Bench Press",  emoji: "🏋️", unit: "lbs",   kind: "weight"   },
  { key: "squat",          label: "Squat",        emoji: "🦵", unit: "lbs",   kind: "weight"   },
  { key: "deadlift",       label: "Deadlift",     emoji: "🏋️", unit: "lbs",   kind: "weight"   },
  { key: "ohp",            label: "Overhead Press", emoji: "💪", unit: "lbs", kind: "weight"   },
  { key: "db_curl",        label: "Dumbbell Curl", emoji: "💪", unit: "lbs",  kind: "weight"   },
  { key: "pullups",        label: "Max Pull-Ups",  emoji: "🤸", unit: "reps", kind: "reps"     },
  { key: "mile",           label: "Fastest Mile",  emoji: "🏃", unit: "time", kind: "time"     },
  { key: "5k",             label: "Fastest 5K",    emoji: "🏃", unit: "time", kind: "time"     },
  { key: "10k",            label: "Fastest 10K",   emoji: "🏃", unit: "time", kind: "time"     },
  { key: "row_2k",         label: "2K Row",        emoji: "🚣", unit: "time", kind: "time"     },
  { key: "cycle_distance", label: "Longest Ride",  emoji: "🚴", unit: "mi",   kind: "distance" },
  { key: "custom",         label: "Custom",        emoji: "✨", unit: "",     kind: "weight"   },
];

type Entry = {
  id: string;
  gym_id: string;
  category: string;
  custom_label: string | null;
  value: number;
  unit: string;
  tagged_user_id: string | null;
  display_name: string;
  notes: string | null;
  date_achieved: string;
  created_at: string;
};

// ─── Time helpers ───────────────────────────────────────────────────────
// Time entries are stored as seconds. UI shows mm:ss (or h:mm:ss for >60min).

function secondsToTimeString(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function timeStringToSeconds(str: string): number {
  // Accepts "mm:ss", "h:mm:ss", or plain seconds
  const parts = str.split(":").map(p => parseFloat(p) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function formatValue(entry: Entry): string {
  const def = CATEGORIES.find(c => c.key === entry.category);
  if (!def) return `${entry.value} ${entry.unit}`;
  if (def.kind === "time") return secondsToTimeString(entry.value);
  if (def.kind === "weight") return `${entry.value} lbs`;
  if (def.kind === "reps") return `${entry.value} reps`;
  if (def.kind === "distance") return `${entry.value} mi`;
  return `${entry.value} ${entry.unit}`;
}

// ─── Component ──────────────────────────────────────────────────────────

export default function GymLeaderboard({
  gymId,
  isOwner,
}: {
  /** users.id of the business — i.e. the gym/studio owner whose
   *  leaderboard this is. */
  gymId: string;
  /** True only when the viewer IS the gym owner. Drives the Manage
   *  button visibility. */
  isOwner: boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<CategoryKey>("club_1000");
  const [showManage, setShowManage] = useState(false);

  async function loadEntries() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("gym_leaderboard_entries")
        .select("*")
        .eq("gym_id", gymId);
      setEntries((data || []) as Entry[]);
    } catch (e) { console.error(e); }
    setLoading(false);
  }
  useEffect(() => { loadEntries(); /* eslint-disable-next-line */ }, [gymId]);

  // Per-category top 10. Time entries sort ascending (faster = better);
  // everything else descending (heavier/longer = better).
  const topForCategory = useMemo(() => {
    const def = CATEGORIES.find(c => c.key === activeCat);
    const cat = activeCat;
    const inCat = entries.filter(e => e.category === cat);
    const sorted = [...inCat].sort((a, b) => {
      if (def?.kind === "time") return a.value - b.value;
      return b.value - a.value;
    });
    return sorted.slice(0, 10);
  }, [entries, activeCat]);

  return (
    <div style={{ background: "#0F1117", borderRadius: 22, padding: 22, border: "1.5px solid #1E2130" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#F0F0F0" }}>🏆 Leaderboard</div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
            All-time records. Tap a category to see top 10.
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowManage(true)}
            style={{
              padding: "8px 14px", borderRadius: 12, border: "1.5px solid #3D2A6E",
              background: "#1A1228", color: "#A78BFA",
              fontWeight: 800, fontSize: 12, cursor: "pointer",
            }}
          >🔧 Manage</button>
        )}
      </div>

      {/* Category tabs — horizontally scrollable so 13 fit on mobile */}
      <div style={{
        display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16,
        borderBottom: "1px solid #1E2130",
      }}>
        {CATEGORIES.map(cat => {
          const count = entries.filter(e => e.category === cat.key).length;
          const isActive = activeCat === cat.key;
          // Hide custom tab if no custom entries exist (avoids dead pill)
          if (cat.key === "custom" && count === 0 && !isOwner) return null;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCat(cat.key)}
              style={{
                padding: "8px 14px", borderRadius: 99, border: "none",
                background: isActive ? "#7C3AED" : "#1A1228",
                color: isActive ? "#fff" : "#9CA3AF",
                fontWeight: 800, fontSize: 12, cursor: "pointer",
                whiteSpace: "nowrap", flexShrink: 0,
                opacity: count === 0 && !isActive ? 0.5 : 1,
              }}
            >
              {cat.emoji} {cat.label}
              {count > 0 && <span style={{ opacity: 0.7, marginLeft: 4 }}>· {count}</span>}
            </button>
          );
        })}
      </div>

      {/* Leaderboard list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", fontSize: 13 }}>Loading…</div>
      ) : topForCategory.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "#9CA3AF", fontSize: 13 }}>
          {isOwner ? (
            <>
              No entries yet for {CATEGORIES.find(c => c.key === activeCat)?.label}.<br/>
              Tap <strong>Manage</strong> to add the first record.
            </>
          ) : (
            <>No entries yet for this category.</>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {topForCategory.map((entry, idx) => (
            <LeaderboardRow key={entry.id} rank={idx + 1} entry={entry} />
          ))}
        </div>
      )}

      {/* Manage modal */}
      {showManage && isOwner && (
        <ManageModal
          gymId={gymId}
          entries={entries}
          onClose={() => { setShowManage(false); loadEntries(); }}
        />
      )}
    </div>
  );
}

// ─── Single row in the leaderboard ──────────────────────────────────────

function LeaderboardRow({ rank, entry }: { rank: number; entry: Entry }) {
  // Top 3 get medal accent colors. Rank 1 also gets a subtle gold glow.
  const medalColor = rank === 1 ? "#F5A623" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : "#3D2A6E";
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px",
      background: rank === 1 ? "linear-gradient(90deg, #2A1F00 0%, #1A1228 100%)" : "#1A1228",
      borderRadius: 12,
      border: `1px solid ${medalColor}`,
    }}>
      <div style={{
        width: 38, fontSize: rank > 3 ? 13 : 22, fontWeight: 900,
        color: medalColor, textAlign: "center", flexShrink: 0,
      }}>{medal}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* If tagged, link to their profile. Otherwise plain text. */}
        {entry.tagged_user_id ? (
          <a
            href={`/profile/${entry.tagged_user_id}`}
            style={{
              fontWeight: 800, fontSize: 14, color: "#F0F0F0", textDecoration: "none",
              display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >{entry.display_name}</a>
        ) : (
          <div style={{
            fontWeight: 800, fontSize: 14, color: "#F0F0F0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{entry.display_name}</div>
        )}
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
          {new Date(entry.date_achieved).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          {entry.notes && <span> · {entry.notes}</span>}
        </div>
      </div>
      <div style={{
        fontSize: 16, fontWeight: 900, color: "#A78BFA",
        flexShrink: 0, textAlign: "right",
      }}>{formatValue(entry)}</div>
    </div>
  );
}

// ─── Manage modal — gym owner CRUD ──────────────────────────────────────

function ManageModal({
  gymId, entries, onClose,
}: {
  gymId: string;
  entries: Entry[];
  onClose: () => void;
}) {
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  function startNew() {
    setEditingEntry(null);
    setView("edit");
  }
  function startEdit(e: Entry) {
    setEditingEntry(e);
    setView("edit");
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0D0820", borderRadius: 22, width: "100%", maxWidth: 560,
          maxHeight: "90vh", overflowY: "auto", border: "1px solid #3D2A6E",
        }}
      >
        <div style={{ padding: "20px 22px", borderBottom: "1px solid #1E2130", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, color: "#F0F0F0" }}>
              {view === "list" ? "🔧 Manage Leaderboard" : (editingEntry ? "Edit Entry" : "New Entry")}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
              {view === "list" ? `${entries.length} total entries` : "Tag a follower or enter a name manually"}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: "#9CA3AF",
            fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        <div style={{ padding: "16px 22px" }}>
          {view === "list" ? (
            <ManageList
              gymId={gymId}
              entries={entries}
              onEdit={startEdit}
              onNew={startNew}
              onChange={onClose}
            />
          ) : (
            <EditForm
              gymId={gymId}
              entry={editingEntry}
              onDone={() => setView("list")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ManageList({
  gymId, entries, onEdit, onNew, onChange,
}: {
  gymId: string;
  entries: Entry[];
  onEdit: (e: Entry) => void;
  onNew: () => void;
  onChange: () => void;
}) {
  async function deleteEntry(e: Entry) {
    if (!confirm(`Delete ${e.display_name}'s entry?`)) return;
    await supabase.from("gym_leaderboard_entries").delete().eq("id", e.id);
    onChange();
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={onNew}
        style={{
          padding: "12px 16px", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
          color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer",
        }}
      >+ New Entry</button>
      {entries.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
          No entries yet. Tap "New Entry" to add the first record.
        </div>
      ) : (
        entries
          .slice()
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map(entry => (
            <div key={entry.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10,
              background: "#1A1228", border: "1px solid #2D1F52",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#F0F0F0", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{CATEGORIES.find(c => c.key === entry.category)?.emoji || "✨"}</span>
                  <span>{entry.display_name}</span>
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {entry.custom_label || CATEGORIES.find(c => c.key === entry.category)?.label} · {formatValue(entry)}
                </div>
              </div>
              <button onClick={() => onEdit(entry)} style={{
                background: "transparent", border: "1px solid #3D2A6E",
                color: "#A78BFA", fontWeight: 700, fontSize: 11,
                padding: "5px 10px", borderRadius: 8, cursor: "pointer",
              }}>Edit</button>
              <button onClick={() => deleteEntry(entry)} style={{
                background: "transparent", border: "1px solid #7F1D1D",
                color: "#F87171", fontWeight: 700, fontSize: 11,
                padding: "5px 10px", borderRadius: 8, cursor: "pointer",
              }}>×</button>
            </div>
          ))
      )}
    </div>
  );
}

// ─── Edit/create form ──────────────────────────────────────────────────

function EditForm({
  gymId, entry, onDone,
}: {
  gymId: string;
  entry: Entry | null;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<CategoryKey>((entry?.category as CategoryKey) || "bench");
  const [customLabel, setCustomLabel] = useState(entry?.custom_label || "");
  const [valueStr, setValueStr] = useState(() => {
    if (!entry) return "";
    const def = CATEGORIES.find(c => c.key === entry.category);
    if (def?.kind === "time") return secondsToTimeString(entry.value);
    return String(entry.value);
  });
  const [taggedUserId, setTaggedUserId] = useState<string | null>(entry?.tagged_user_id || null);
  const [displayName, setDisplayName] = useState(entry?.display_name || "");
  const [notes, setNotes] = useState(entry?.notes || "");
  const [dateAchieved, setDateAchieved] = useState(entry?.date_achieved || new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  // Follower search state — searches users currently following this gym
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const def = CATEGORIES.find(c => c.key === category)!;
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    background: "#0D0D0D",
    border: "1.5px solid #3D2A6E",
    color: "#F0F0F0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  // Search followers — only users who follow this gym can be tagged
  useEffect(() => {
    if (!showSearch || searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        // 1) Get all follower user_ids of this gym
        const { data: followers } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", gymId);
        const followerIds = (followers || []).map((f: any) => f.follower_id);
        if (followerIds.length === 0) {
          setSearchResults([]);
          return;
        }
        // 2) Look up matching users in that follower set
        const q = searchQuery.toLowerCase();
        const { data: users } = await supabase
          .from("users")
          .select("id, username, full_name, avatar_url")
          .in("id", followerIds)
          .or(`username.ilike.${q}%,full_name.ilike.%${q}%`)
          .limit(8);
        setSearchResults(users || []);
      } catch (e) { console.error(e); }
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery, showSearch, gymId]);

  function pickUser(u: any) {
    setTaggedUserId(u.id);
    setDisplayName(u.full_name || u.username);
    setShowSearch(false);
    setSearchQuery("");
  }

  async function submit() {
    if (!displayName.trim()) { alert("Add a name"); return; }
    if (category === "custom" && !customLabel.trim()) { alert("Add a custom label"); return; }
    let numValue: number;
    if (def.kind === "time") {
      numValue = timeStringToSeconds(valueStr);
    } else {
      numValue = parseFloat(valueStr);
    }
    if (!Number.isFinite(numValue) || numValue <= 0) { alert("Enter a valid value"); return; }

    setSubmitting(true);
    const row = {
      gym_id: gymId,
      category,
      custom_label: category === "custom" ? customLabel.trim() : null,
      value: numValue,
      unit: def.kind === "time" ? "sec" : (def.kind === "weight" ? "lbs" : (def.kind === "reps" ? "reps" : "mi")),
      tagged_user_id: taggedUserId,
      display_name: displayName.trim(),
      notes: notes.trim() || null,
      date_achieved: dateAchieved,
      updated_at: new Date().toISOString(),
    };

    if (entry) {
      const { error } = await supabase.from("gym_leaderboard_entries").update(row).eq("id", entry.id);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.from("gym_leaderboard_entries").insert(row);
      if (error) alert(error.message);
    }
    setSubmitting(false);
    onDone();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>CATEGORY</label>
        <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value as CategoryKey)}>
          {CATEGORIES.map(c => (
            <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
          ))}
        </select>
      </div>

      {category === "custom" && (
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>CUSTOM LABEL</label>
          <input style={inputStyle} value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="e.g. Atlas stone over bar" />
        </div>
      )}

      {/* Tagged user search — only allowed for followers */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>
          TAG A FOLLOWER (optional)
        </label>
        {taggedUserId ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: "#1A1228", borderRadius: 10, border: "1px solid #3D2A6E" }}>
            <span style={{ fontSize: 13, color: "#A78BFA", fontWeight: 700 }}>📌 {displayName}</span>
            <button onClick={() => { setTaggedUserId(null); setDisplayName(""); }} style={{
              marginLeft: "auto", background: "transparent", border: "none", color: "#9CA3AF",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>Untag</button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input
              style={inputStyle}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder="Search a follower by name…"
            />
            {showSearch && searchResults.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: "#0D0820", border: "1px solid #3D2A6E", borderRadius: 12,
                zIndex: 100, maxHeight: 200, overflowY: "auto",
              }}>
                {searchResults.map(u => (
                  <button key={u.id} onClick={() => pickUser(u)} style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "10px 12px", background: "transparent", border: "none",
                    cursor: "pointer", textAlign: "left", color: "#F0F0F0",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 800, fontSize: 11,
                      overflow: "hidden",
                    }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : (u.full_name || u.username || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{u.full_name || u.username}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>@{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4 }}>
              Only members who follow your gym appear in search. Or skip and enter a name below.
            </div>
          </div>
        )}
      </div>

      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>
          DISPLAY NAME {taggedUserId && <span style={{ color: "#6B7280", fontWeight: 500 }}>· tag controls this</span>}
        </label>
        <input
          style={inputStyle}
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="e.g. John Smith"
          disabled={!!taggedUserId}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>
            VALUE {def.kind === "time" ? "(mm:ss)" : `(${def.unit})`}
          </label>
          <input
            style={inputStyle}
            value={valueStr}
            onChange={e => setValueStr(e.target.value)}
            placeholder={def.kind === "time" ? "5:30" : (def.kind === "weight" ? "315" : (def.kind === "reps" ? "20" : "100"))}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>DATE</label>
          <input
            style={inputStyle}
            type="date"
            value={dateAchieved}
            onChange={e => setDateAchieved(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 5 }}>NOTES (optional)</label>
        <input
          style={inputStyle}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. PR set during Memorial Day comp"
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <button
          onClick={onDone}
          style={{
            flex: 1, padding: "12px 0", borderRadius: 12, border: "1.5px solid #3D2A6E",
            background: "transparent", color: "#9CA3AF", fontWeight: 700, cursor: "pointer",
          }}
        >Cancel</button>
        <button
          onClick={submit}
          disabled={submitting}
          style={{
            flex: 2, padding: "12px 0", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
            color: "#fff", fontWeight: 900, fontSize: 14,
            cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
          }}
        >{submitting ? "Saving…" : entry ? "Save Changes" : "Add Entry"}</button>
      </div>
    </div>
  );
}

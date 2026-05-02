"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type TaggedUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

type Props = {
  /** Currently tagged users. Controlled by parent. */
  value: TaggedUser[];
  /** Called when the parent should update the list (added or removed). */
  onChange: (next: TaggedUser[]) => void;
  /** Hide the current user from search results (don't tag yourself). */
  excludeSelfId?: string;
  /** Optional cap. Defaults to 10. Above this, the search box hides itself. */
  max?: number;
  /** Pass-through className so callers can style the wrapper. */
  className?: string;
  /** Override the default placeholder text. */
  placeholder?: string;
};

/**
 * Multi-user tag picker.
 *
 * Lets the parent component collect a list of users to tag in a post or
 * workout. UI flow:
 *   1. User types a query → debounced 250ms
 *   2. Matching users render in a dropdown below the input
 *   3. User taps one → it's added to the chip row above the input
 *   4. Chips have an × to remove
 *
 * The parent owns the state so this component is reusable across the
 * Share-to-Feed page and the Log-Activity workout page (and anywhere else).
 *
 * Performance: debounce + per-query result cache so typing "jo" → "joe" → "joe"
 * only hits the network on the first two strokes. Cache keyed by raw query.
 */
export default function TagPicker({
  value,
  onChange,
  excludeSelfId,
  max = 10,
  className,
  placeholder = "Search to tag people…",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TaggedUser[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, TaggedUser[]>>(new Map());

  // Run search whenever the query stabilizes for 250ms. Empty query clears.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    // Cache hit — show instantly without re-querying.
    const cached = cacheRef.current.get(q.toLowerCase());
    if (cached) {
      setResults(filterOut(cached, value, excludeSelfId));
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("users")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(8);
      const list = (data || []) as TaggedUser[];
      cacheRef.current.set(q.toLowerCase(), list);
      setResults(filterOut(list, value, excludeSelfId));
      setSearching(false);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, value, excludeSelfId]);

  function addUser(u: TaggedUser) {
    if (value.length >= max) return;
    if (value.some(v => v.id === u.id)) return;
    onChange([...value, u]);
    setQuery("");
    setResults([]);
    setOpen(false);
  }
  function removeUser(id: string) {
    onChange(value.filter(v => v.id !== id));
  }

  const atMax = value.length >= max;

  return (
    <div className={className} style={{ position: "relative" }}>
      {/* Selected chips row — always above the input so users can see who's tagged */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map(u => (
            <div key={u.id} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 10px 4px 4px", borderRadius: 99,
              background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.45)",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "linear-gradient(135deg,#7C3AED,#4ADE80)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 900, color: "#fff", overflow: "hidden",
                flexShrink: 0,
              }}>
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (u.full_name || u.username || "?")[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>@{u.username}</span>
              <button onClick={() => removeUser(u.id)} aria-label={`Remove ${u.username}`}
                style={{ background: "transparent", border: "none", color: "#A78BFA", fontSize: 14, lineHeight: 1, cursor: "pointer", padding: "0 2px" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Search input — hides when tag cap reached so users don't keep typing */}
      {!atMax && (
        <div style={{ position: "relative" }}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            // Defer close so click on a result fires before the dropdown unmounts
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            placeholder={placeholder}
            style={{
              width: "100%", padding: "10px 14px",
              background: "#1A1228", border: "1.5px solid #2D1F52",
              borderRadius: 12, color: "#E2E8F0",
              fontSize: 14, outline: "none",
            }}
          />
          {/* Results dropdown */}
          {open && query.trim() && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              background: "#111118", border: "1.5px solid #2D1F52", borderRadius: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 50,
              maxHeight: 260, overflowY: "auto",
            }}>
              {searching ? (
                <div style={{ padding: 14, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Searching…</div>
              ) : results.length === 0 ? (
                <div style={{ padding: 14, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No users found</div>
              ) : results.map(u => (
                <button key={u.id} onMouseDown={() => addUser(u)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "10px 14px",
                    background: "transparent", border: "none",
                    borderBottom: "1px solid #2D1F52",
                    cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#2D1F52")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "linear-gradient(135deg,#7C3AED,#4ADE80)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 900, color: "#fff", overflow: "hidden", flexShrink: 0,
                  }}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : (u.full_name || u.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.full_name || u.username}
                    </div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>@{u.username}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {atMax && (
        <div style={{ fontSize: 12, color: "#9CA3AF", padding: "4px 2px" }}>
          Reached the {max}-tag limit. Remove someone to add more.
        </div>
      )}
    </div>
  );
}

// Shared filter helper — drops the current user and anyone already tagged.
function filterOut(list: TaggedUser[], already: TaggedUser[], excludeId?: string): TaggedUser[] {
  const taken = new Set(already.map(u => u.id));
  return list.filter(u => u.id !== excludeId && !taken.has(u.id));
}

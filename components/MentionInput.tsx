// ─── components/MentionInput.tsx ─────────────────────────────────────────
// Drop-in replacement for <input> / <textarea> that adds @mention
// autocomplete. Type "@" → debounced user search → tap a user to insert
// "@username " into the text. Caller still owns the value/onChange — this
// component is purely a presentational wrapper that intercepts the @
// trigger and shows a suggestion dropdown.
//
// Why a wrapper component instead of a hook?
//   • Comment + caption surfaces all want the same autocomplete UX
//   • The dropdown positioning + keyboard-nav logic is non-trivial
//   • Caller doesn't have to manage suggestion state, debouncing, keys
//
// LIMITATIONS:
//   • No fancy text styling (mentions render as plain "@username" text).
//     Real Instagram-style colored chips would require a contenteditable
//     or rich-text rewrite — out of scope for this pass.
//   • Mentions are detected by regex on submit (caller's job — see
//     parseMentions helper at bottom of this file).

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type MentionUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

type Props = {
  /** Current input value (caller owns it). */
  value: string;
  /** Called on every change. */
  onChange: (next: string) => void;
  /** Render as multi-line textarea instead of input. Default: false. */
  multiline?: boolean;
  /** Placeholder text. */
  placeholder?: string;
  /** Style overrides for the input/textarea element. */
  style?: React.CSSProperties;
  /** Submit handler — called when Enter pressed (without shift on textarea). */
  onSubmit?: () => void;
  /** Pass through autoFocus flag. */
  autoFocus?: boolean;
  /** Number of rows for textarea mode. */
  rows?: number;
  /** Disabled flag. */
  disabled?: boolean;
  /** Optional id passed through (so a label[htmlFor] can target it). */
  id?: string;
  /** Forward a ref so callers can imperatively focus the input. */
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
};

export default function MentionInput({
  value,
  onChange,
  multiline = false,
  placeholder,
  style,
  onSubmit,
  autoFocus,
  rows = 3,
  disabled,
  id,
  inputRef: externalRef,
}: Props) {
  // Suggestion state. The "trigger" is the position in `value` where the
  // active "@..." starts. When non-null, the dropdown is open and we're
  // querying users matching the partial text after the @.
  const [triggerStart, setTriggerStart] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MentionUser[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [searching, setSearching] = useState(false);

  const internalRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const ref = externalRef || internalRef;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Watch the input — when the user types "@" or extends an active @-trigger,
  // open the dropdown and update the query. Cancel the trigger when the
  // user types whitespace or moves the cursor away.
  function handleValueChange(next: string, cursorPos: number) {
    onChange(next);

    // Walk backward from cursor to find an active "@" trigger. Stop at
    // whitespace (no mention spans whitespace) or string start.
    let i = cursorPos - 1;
    let foundAt = -1;
    while (i >= 0) {
      const ch = next[i];
      if (ch === "@") { foundAt = i; break; }
      if (/\s/.test(ch)) break;
      i--;
    }

    if (foundAt === -1) {
      // No active trigger — close dropdown
      setTriggerStart(null);
      setQuery("");
      setResults([]);
      return;
    }

    // The @ must be at the start OR preceded by whitespace. Otherwise
    // it's part of an email address or something else.
    const before = foundAt === 0 ? "" : next[foundAt - 1];
    if (before && !/\s/.test(before)) {
      setTriggerStart(null);
      setQuery("");
      setResults([]);
      return;
    }

    const partial = next.slice(foundAt + 1, cursorPos);
    setTriggerStart(foundAt);
    setQuery(partial);
    setHighlightIdx(0);
  }

  // Debounced user search whenever query updates
  useEffect(() => {
    if (triggerStart === null) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length === 0) {
      // Show recent / popular users? For now, just keep dropdown empty
      // until they type at least 1 char.
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const q = query.trim().toLowerCase();
        const { data } = await supabase
          .from("users")
          .select("id, username, full_name, avatar_url")
          .or(`username.ilike.${q}%,full_name.ilike.%${q}%`)
          .limit(8);
        setResults((data || []) as MentionUser[]);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, triggerStart]);

  // Insert "@username " at the trigger position, replacing the partial
  function selectUser(u: MentionUser) {
    if (triggerStart === null) return;
    const before = value.slice(0, triggerStart);
    const after = value.slice(triggerStart + 1 + query.length);
    const inserted = `@${u.username} `;
    const next = before + inserted + after;
    onChange(next);
    // Move cursor to end of insertion
    const newCursor = before.length + inserted.length;
    setTriggerStart(null);
    setQuery("");
    setResults([]);
    // Defer setSelectionRange to next tick so React's update has applied
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        try { (el as any).setSelectionRange(newCursor, newCursor); } catch {}
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // When dropdown is open: arrow keys nav, Enter selects, Esc closes.
    if (triggerStart !== null && results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx(i => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel = results[highlightIdx];
        if (sel) selectUser(sel);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTriggerStart(null);
        setResults([]);
        return;
      }
    }
    // Submit on Enter (when no dropdown). Shift+Enter inserts newline in textarea.
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  const sharedProps = {
    id,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      handleValueChange(e.target.value, e.target.selectionStart || e.target.value.length),
    onKeyDown: handleKeyDown,
    placeholder,
    autoFocus,
    disabled,
    style,
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {multiline ? (
        <textarea
          {...sharedProps}
          rows={rows}
          ref={ref as React.RefObject<HTMLTextAreaElement>}
        />
      ) : (
        <input
          {...sharedProps}
          ref={ref as React.RefObject<HTMLInputElement>}
        />
      )}

      {/* Suggestion dropdown — positions just below the input */}
      {triggerStart !== null && (results.length > 0 || searching) && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#0D0820",
            border: "1px solid #2D1F52",
            borderRadius: 12,
            zIndex: 1000,
            maxHeight: 240,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {searching && results.length === 0 ? (
            <div style={{ padding: "10px 14px", fontSize: 12, color: "#9CA3AF" }}>
              Searching…
            </div>
          ) : (
            results.map((u, i) => {
              const active = i === highlightIdx;
              return (
                <button
                  key={u.id}
                  onMouseDown={(e) => { e.preventDefault(); selectUser(u); }}
                  onMouseEnter={() => setHighlightIdx(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 12px",
                    background: active ? "#2D1F52" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "#F0F0F0",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#7C3AED,#A78BFA)",
                      flexShrink: 0,
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#fff",
                    }}
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      (u.full_name || u.username || "?")[0].toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {u.full_name || u.username}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>@{u.username}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

/** Extract @usernames from a string. Used after submit to detect who got
 *  mentioned and fire notifications. Returns unique usernames in order
 *  of first appearance. */
export function parseMentions(text: string): string[] {
  if (!text) return [];
  const re = /(?:^|\s)@([a-zA-Z0-9_]{2,32})/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const u = m[1].toLowerCase();
    if (!seen.has(u)) {
      seen.add(u);
      out.push(m[1]);
    }
  }
  return out;
}

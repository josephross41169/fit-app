"use client";
import { useState, type ReactNode } from "react";

/**
 * Instagram-style caption block shown under a post's photo + actions:
 *   **Name** caption text…  more
 *   [🏋️ Strength] [⏱ 62 min] [📍 Las Vegas]
 * Long captions are clamped to 3 lines with a "more" toggle.
 */
export default function PostCaption({
  name,
  caption,
  rawText,
  tags = [],
  onNameClick,
}: {
  name: string;
  caption?: ReactNode;
  /** Plain text of the caption, used to decide whether to clamp. */
  rawText?: string;
  tags?: string[];
  onNameClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const text = rawText || "";
  const hasCaption = !!text.trim();
  const cleanTags = tags.filter(Boolean).slice(0, 5);
  if (!hasCaption && cleanTags.length === 0) return null;

  const long = text.length > 140 || text.split("\n").length > 3;
  const clamped = long && !open;

  return (
    <div style={{ padding: "4px 18px 12px" }}>
      {hasCaption && (
        <div>
          <div
            style={{
              fontSize: 15.5,
              lineHeight: 1.5,
              color: "#EEF3EF",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              ...(clamped
                ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }
                : {}),
            }}
          >
            <span
              onClick={onNameClick}
              style={{ fontWeight: 800, color: "#fff", marginRight: 6, cursor: onNameClick ? "pointer" : "default" }}
            >
              {name}
            </span>
            {caption ?? text}
          </div>
          {long && (
            <button
              onClick={() => setOpen(o => !o)}
              style={{ background: "none", border: "none", padding: "2px 0 0", cursor: "pointer", color: "#7FBF98", fontWeight: 700, fontSize: 14 }}
            >
              {open ? "less" : "more"}
            </button>
          )}
        </div>
      )}
      {cleanTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: hasCaption ? 10 : 0 }}>
          {cleanTags.map((t, i) => (
            <span
              key={i}
              style={{
                background: "#1F2E27",
                border: "1px solid #2E4A3B",
                color: "#CFE3D6",
                fontSize: 13,
                fontWeight: 600,
                padding: "5px 11px",
                borderRadius: 20,
                whiteSpace: "nowrap",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

// ─── components/recap/Motif.tsx ───────────────────────────────────────────
// Renders the decorative SVG motif for a card based on the active theme.
// Each theme's `decorMotif` field selects which shape pattern gets drawn
// behind the card content. These are the "designed" feel of each theme —
// without them every card is just colored boxes.
//
// All motifs are SVG so they scale infinitely and tint cleanly via CSS
// fill/stroke. They render absolute-positioned behind content with
// pointer-events:none so they never interfere with interaction.

import type { Theme } from "./themes";

type Props = {
  theme: Theme;
  /** "fill" mode renders the motif covering the whole card. "corner" mode
   *  renders it as an accent in the top-right or bottom-left only. */
  variant?: "fill" | "corner";
};

export default function Motif({ theme, variant = "fill" }: Props) {
  const opacity = theme.motifIntensity === "bold" ? 0.18 : 0.08;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity,
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio={variant === "fill" ? "xMidYMid slice" : "xMidYMid meet"}
      aria-hidden="true"
    >
      {renderMotifContent(theme, variant)}
    </svg>
  );
}

function renderMotifContent(theme: Theme, variant: "fill" | "corner") {
  const fill = theme.decor;
  const stroke = theme.decor;

  switch (theme.decorMotif) {
    case "stripes":
      // Diagonal lines — speed/motion feel for VELOCITY theme. Tilted
      // so they read as kinetic rather than static.
      return (
        <g stroke={stroke} strokeWidth="0.6" fill="none">
          {Array.from({ length: 30 }).map((_, i) => (
            <line key={i}
              x1={-50 + i * 6} y1={150}
              x2={50 + i * 6} y2={-50}
            />
          ))}
        </g>
      );

    case "circles":
      // Concentric + scattered circles — playful for SPECTRUM. Different
      // sizes give a confetti-like feel.
      return (
        <g fill="none" stroke={stroke} strokeWidth="0.4">
          <circle cx="20" cy="20" r="18" />
          <circle cx="20" cy="20" r="12" />
          <circle cx="20" cy="20" r="6" />
          <circle cx="80" cy="80" r="22" />
          <circle cx="80" cy="80" r="14" />
          <circle cx="85" cy="20" r="8" fill={fill} />
          <circle cx="15" cy="85" r="5" fill={fill} />
          <circle cx="60" cy="40" r="3" fill={fill} />
          <circle cx="40" cy="60" r="2" fill={fill} />
        </g>
      );

    case "grid":
      // Clean grid — subtle structure for IRON. Doesn't dominate.
      return (
        <g stroke={stroke} strokeWidth="0.2" fill="none">
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 10} y1={0} x2={i * 10} y2={100} />
          ))}
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 10} x2={100} y2={i * 10} />
          ))}
        </g>
      );

    case "starburst":
      // Radiating lines from a focal point — peak / fire feel for APEX
      // and INFERNO. Thicker at center.
      return (
        <g stroke={stroke} strokeWidth="0.8" fill="none">
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * 2 * Math.PI;
            const x2 = 50 + Math.cos(angle) * 80;
            const y2 = 50 + Math.sin(angle) * 80;
            return <line key={i} x1={50} y1={50} x2={x2} y2={y2} />;
          })}
          <circle cx="50" cy="50" r="3" fill={fill} stroke="none" />
        </g>
      );

    case "waves":
      // Horizontal wavy lines — calm/ocean feel for STILLNESS. Multiple
      // sine waves at different phases.
      return (
        <g stroke={stroke} strokeWidth="0.5" fill="none">
          {[20, 40, 60, 80].map((y, i) => {
            // Generate a sine wave path
            let d = `M 0 ${y}`;
            for (let x = 0; x <= 100; x += 2) {
              const wy = y + Math.sin((x / 100) * Math.PI * 4 + i) * 3;
              d += ` L ${x} ${wy}`;
            }
            return <path key={i} d={d} />;
          })}
        </g>
      );

    case "geometric":
      // Hard-edged abstract — IRON theme. Triangles + rectangles + lines.
      return (
        <g stroke={stroke} strokeWidth="0.5" fill="none">
          <polygon points="10,10 30,10 20,30" />
          <polygon points="80,80 95,80 87,95" />
          <rect x="60" y="15" width="25" height="25" />
          <line x1="0" y1="50" x2="100" y2="50" strokeWidth="0.3" />
          <line x1="50" y1="0" x2="50" y2="100" strokeWidth="0.3" />
        </g>
      );

    default:
      return null;
  }
}

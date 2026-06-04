"use client";

// ─── components/recap/Motif.tsx ───────────────────────────────────────────
// Renders bold abstract SVG patterns used as the visual identity of each
// theme. v2 (Spotify Wrapped style): patterns are LOUD, saturated, fill
// the card. The previous v1 8%-opacity decorations didn't show up.
//
// All patterns are pure SVG so they scale infinitely and tint cleanly.
// They render absolute-positioned with pointer-events:none so they never
// block interaction.
//
// Each pattern uses theme.accent / decor for fill colors so the same
// pattern shape can carry multiple themes (e.g. starburst is gold for
// INFERNO but neon yellow for APEX).

import type { Theme, MotifId } from "./themes";

type Props = {
  theme: Theme;
  /** Where on the card the motif anchors. "fill" covers the whole card.
   *  "top" / "bottom" / "side" are corner accents. */
  variant?: "fill" | "topRight" | "bottomLeft";
};

export default function Motif({ theme, variant = "fill" }: Props) {
  // Opacity is driven by intensity. Even "loud" patterns are pulled back a
  // bit so they read as a bold *background texture* rather than competing
  // with the text on top (the content sits above a darkening scrim in
  // CardFrame, so the motif doesn't need to be at full blast).
  const opacity = (
    theme.motifIntensity === "loud" ? 0.6 :
    theme.motifIntensity === "bold" ? 0.32 : 0.14
  );

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
      viewBox="0 0 100 140"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {renderMotif(theme.decorMotif, theme, variant)}
    </svg>
  );
}

function renderMotif(id: MotifId, theme: Theme, variant: "fill" | "topRight" | "bottomLeft") {
  const fill = theme.decor;
  const accent = theme.accent;
  const accent2 = theme.accent2;
  const accent3 = theme.accent3;

  switch (id) {
    case "paintSplash": {
      // Splattered-paint look: a handful of soft organic blobs in the theme's
      // splash palette, scattered across the card, surrounded by smaller
      // droplets/flecks. Soft blur + varied opacity makes it read like wet
      // paint rather than hard geometric shapes. Colors come from the theme
      // so each week's palette flows through.
      const palette = [accent, accent2, accent3, fill];
      // A blobby organic path (roughly circular but lumpy), scaled/placed via transform.
      const blob = (cx: number, cy: number, r: number, color: string, op: number, rot: number, key: string) => (
        <path
          key={key}
          transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${r})`}
          d="M0.9,-0.4 C1.1,0.0 0.7,0.6 0.2,0.9 C-0.3,1.1 -0.9,0.8 -1.0,0.2 C-1.1,-0.4 -0.7,-0.9 -0.2,-1.0 C0.4,-1.1 0.7,-0.8 0.9,-0.4 Z"
          fill={color}
          opacity={op}
        />
      );
      // Scattered round droplets/flecks.
      const drop = (cx: number, cy: number, r: number, color: string, op: number, key: string) => (
        <circle key={key} cx={cx} cy={cy} r={r} fill={color} opacity={op} />
      );
      return (
        <g>
          <defs>
            <filter id="paintBlur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.1" />
            </filter>
          </defs>
          <g filter="url(#paintBlur)">
            {/* Big soft splashes anchored to the corners so the center stays
                a touch calmer for text. */}
            {blob(16, 24, 20, palette[0], 0.85, 20, "b1")}
            {blob(86, 40, 24, palette[1], 0.8, -35, "b2")}
            {blob(24, 104, 26, palette[2], 0.78, 60, "b3")}
            {blob(82, 120, 22, palette[3], 0.82, -15, "b4")}
            {blob(54, 70, 16, palette[1], 0.5, 120, "b5")}
            {/* Mid-size accent blobs */}
            {blob(70, 88, 11, palette[0], 0.7, 200, "b6")}
            {blob(40, 46, 9, palette[3], 0.65, 300, "b7")}
          </g>
          {/* Crisp droplets/flecks on top (not blurred) — the "splatter". */}
          {drop(40, 18, 1.6, palette[1], 0.9, "d1")}
          {drop(64, 28, 1.1, palette[0], 0.85, "d2")}
          {drop(12, 56, 2.0, palette[2], 0.8, "d3")}
          {drop(92, 64, 1.4, palette[3], 0.85, "d4")}
          {drop(30, 80, 1.2, palette[0], 0.8, "d5")}
          {drop(74, 56, 1.8, palette[2], 0.75, "d6")}
          {drop(50, 110, 1.5, palette[1], 0.85, "d7")}
          {drop(60, 128, 1.0, palette[3], 0.8, "d8")}
          {drop(18, 126, 1.3, palette[0], 0.8, "d9")}
          {drop(88, 100, 1.1, palette[1], 0.8, "d10")}
          {drop(46, 92, 0.9, palette[2], 0.75, "d11")}
          {drop(36, 34, 1.0, palette[3], 0.8, "d12")}
        </g>
      );
    }
    case "warpedCircles":
      // Concentric rings drifting toward the bottom-right. Reads like the
      // optical-illusion patterns Spotify uses on their Wrapped cards.
      return (
        <g>
          {Array.from({ length: 14 }).map((_, i) => (
            <circle
              key={i}
              cx={70} cy={50}
              r={6 + i * 7}
              fill="none"
              stroke={fill}
              strokeWidth={i % 3 === 0 ? 1.4 : 0.6}
              opacity={1 - i * 0.04}
            />
          ))}
          {/* Solid pop dot */}
          <circle cx={70} cy={50} r={4} fill={accent2} />
        </g>
      );

    case "checkerboard":
      // Hard B&W squares, rotated. Two-tone, no grayscale halftone.
      return (
        <g transform="rotate(-12, 50, 70)">
          {Array.from({ length: 14 }).map((_, row) => (
            Array.from({ length: 12 }).map((_, col) => {
              const isFilled = (row + col) % 2 === 0;
              if (!isFilled) return null;
              return (
                <rect
                  key={`${row}-${col}`}
                  x={col * 11 - 10}
                  y={row * 11 - 10}
                  width={10}
                  height={10}
                  fill={fill}
                  opacity={row > 7 ? 0.35 : 1}
                />
              );
            })
          ))}
        </g>
      );

    case "spiral":
      // Hypnotic spiral made of progressively smaller circles spiraling in.
      // Center sits off the card so we only see part of the spiral —
      // creates a sense of motion / depth.
      return (
        <g>
          {Array.from({ length: 60 }).map((_, i) => {
            const angle = (i / 60) * Math.PI * 8;
            const r = 75 - i * 1.1;
            const x = 50 + Math.cos(angle) * r * 0.5;
            const y = 90 + Math.sin(angle) * r * 0.5;
            const size = 14 - i * 0.18;
            if (size < 1) return null;
            return (
              <circle
                key={i}
                cx={x} cy={y} r={size}
                fill="none"
                stroke={fill}
                strokeWidth={0.9}
              />
            );
          })}
          {/* Central pop circle */}
          <circle cx={50} cy={90} r={4} fill={accent2} />
        </g>
      );

    case "starburst":
      // Dense radiating rays from a focal point. Used by INFERNO/APEX.
      // Variable line lengths give the rays a sun/flame feel.
      return (
        <g>
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i / 36) * Math.PI * 2;
            // Vary length so it doesn't feel uniform
            const len = 70 + (i % 3 === 0 ? 25 : 0);
            const x2 = 50 + Math.cos(angle) * len;
            const y2 = 70 + Math.sin(angle) * len;
            return (
              <line
                key={i}
                x1={50} y1={70}
                x2={x2} y2={y2}
                stroke={fill}
                strokeWidth={i % 3 === 0 ? 1.2 : 0.5}
              />
            );
          })}
          {/* Concentric center for emphasis */}
          <circle cx={50} cy={70} r={6} fill={accent} />
          <circle cx={50} cy={70} r={3} fill={accent2} />
        </g>
      );

    case "diagonalSplit":
      // Hard diagonal split — the card is bisected at an angle into two
      // contrasting color blocks with a stripe pattern overlaid on top.
      // VELOCITY's signature look.
      return (
        <g>
          {/* Diagonal block — covers the bottom-right triangle */}
          <polygon
            points="0,140 100,0 100,140"
            fill={accent2}
          />
          {/* Diagonal stripes overlaid on the top-left */}
          <g stroke={fill} strokeWidth="1.5" fill="none">
            {Array.from({ length: 16 }).map((_, i) => (
              <line key={i}
                x1={-30 + i * 9} y1={140}
                x2={30 + i * 9} y2={-20}
              />
            ))}
          </g>
          {/* Pop dots scattered for accent */}
          <circle cx={20} cy={25} r={2.5} fill={accent} />
          <circle cx={85} cy={120} r={3.5} fill={accent3} />
        </g>
      );

    case "dotMatrix":
      // Grid of dots with size variation creates rhythm. Larger dots in
      // a wave pattern across the card.
      return (
        <g>
          {Array.from({ length: 14 }).map((_, row) => (
            Array.from({ length: 10 }).map((_, col) => {
              // Wave function for size variation
              const wave = Math.sin((col + row) * 0.5);
              const r = 1 + (wave + 1) * 1.2;
              return (
                <circle
                  key={`${row}-${col}`}
                  cx={col * 10 + 5}
                  cy={row * 10 + 5}
                  r={r}
                  fill={fill}
                />
              );
            })
          ))}
        </g>
      );

    case "wavyLines":
      // Hand-drawn squiggles like Spotify's "78,432" card. Multiple
      // overlapping squiggle paths at slight rotations.
      return (
        <g stroke={fill} strokeWidth="1.5" fill="none" strokeLinecap="round">
          {[0, 25, 50, 75, 100, 125].map((y, i) => {
            // Generate a sine-wavy path
            const phase = i * 0.7;
            let d = `M 0 ${y}`;
            for (let x = 0; x <= 100; x += 3) {
              const wy = y + Math.sin((x / 100) * Math.PI * 5 + phase) * 4;
              d += ` L ${x} ${wy}`;
            }
            return <path key={i} d={d} opacity={0.7 + (i % 2) * 0.3} />;
          })}
          {/* A few hand-drawn loops as accents */}
          <path d="M 15 20 q 8 -10 16 0 q -8 10 -16 0" stroke={accent} strokeWidth="1.2" />
          <path d="M 70 110 q 10 -8 20 0 q -10 8 -20 0" stroke={accent} strokeWidth="1.2" />
        </g>
      );

    case "halfMoons":
      // Big half-circles bleeding off the corners — bold and graphic.
      // Used by SPECTRUM theme.
      return (
        <g>
          {/* Big half-circle bleeding off the top-right */}
          <circle cx={110} cy={-10} r={50} fill={accent2} opacity={0.85} />
          {/* Smaller half-circle bleeding off the bottom-left */}
          <circle cx={-10} cy={140} r={40} fill={accent} opacity={0.85} />
          {/* Mid-card filled circle */}
          <circle cx={75} cy={90} r={18} fill={fill} opacity={0.7} />
          {/* Outline ring overlapping the mid circle */}
          <circle cx={30} cy={50} r={22} fill="none" stroke={accent3} strokeWidth={1.5} />
          <circle cx={30} cy={50} r={14} fill="none" stroke={accent3} strokeWidth={0.8} />
        </g>
      );

    default:
      return null;
  }
}

/**
 * Standalone "marker highlight" rectangle — like a hand-drawn highlighter
 * on top of a word. Used by ranked lists (Wellness Top 5, etc.) to mimic
 * Spotify Wrapped's "K-Pop / R&B" black box treatment.
 *
 * Render INSIDE a card content block, not inside Motif's SVG.
 */
export function MarkerHighlight({
  children,
  bg,
  text,
  rotate = 0,
}: {
  children: React.ReactNode;
  bg: string;
  text: string;
  rotate?: number;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color: text,
        padding: "2px 10px",
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        // Slight slant on the box edges for that "marker swipe" feel
        clipPath: "polygon(2% 8%, 98% 0%, 100% 92%, 0% 100%)",
        fontWeight: 900,
      }}
    >
      {children}
    </span>
  );
}

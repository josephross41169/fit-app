"use client";
// Badge artwork with a soft moving shine + a few twinkling sparkles.
// The shine is masked to the badge's own shape, so it only glints across
// the badge itself, never the transparent area around it.
import type { CSSProperties } from "react";

const CSS = `
@keyframes lvShine { 0%, 55% { background-position: 160% 0 } 85%, 100% { background-position: -60% 0 } }
@keyframes lvTwinkle { 0%, 100% { opacity: 0; transform: scale(0.3) rotate(0deg) } 45% { opacity: 1; transform: scale(1) rotate(45deg) } 60% { opacity: 0.9; transform: scale(0.85) rotate(60deg) } }
@media (prefers-reduced-motion: reduce) { .lv-shine, .lv-twinkle { animation: none !important; opacity: 0 !important } }
`;

// Stable per-image offset so a grid of badges doesn't glint in lockstep.
function phase(src: string): number {
  let h = 0;
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) >>> 0;
  return (h % 4000) / 1000;
}

const SPARKLES = [
  { left: "80%", top: "6%", size: 0.16, delay: 0 },
  { left: "4%", top: "30%", size: 0.11, delay: 1.3 },
  { left: "74%", top: "80%", size: 0.13, delay: 2.4 },
];

export function ShinyBadge({ src, width, height, style, imgStyle, sparkles = true }: {
  src: string;
  width: number | string;
  height: number | string;
  style?: CSSProperties;
  imgStyle?: CSSProperties;
  /** Hide the twinkles on very small icons. */
  sparkles?: boolean;
}) {
  const p = phase(src);
  const mask = `url("${src}")`;
  return (
    <span style={{ position: "relative", display: "inline-block", width, height, flexShrink: 0, verticalAlign: "middle", ...style }}>
      <style>{CSS}</style>
      <img src={src} alt="" draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", ...imgStyle }} />
      <span className="lv-shine" aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        WebkitMaskImage: mask, maskImage: mask,
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskPosition: "center", maskPosition: "center",
        background: "linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.10) 44%, rgba(255,255,255,0.55) 50%, rgba(255,250,220,0.18) 56%, transparent 62%)",
        backgroundSize: "250% 100%", backgroundPosition: "160% 0",
        mixBlendMode: "screen",
        animation: `lvShine 5.5s ease-in-out ${p}s infinite`,
      } as CSSProperties} />
      {sparkles && SPARKLES.map((s, i) => (
        <svg key={i} className="lv-twinkle" aria-hidden viewBox="0 0 24 24" style={{
          position: "absolute", left: s.left, top: s.top, width: `${s.size * 100}%`, height: `${s.size * 100}%`,
          minWidth: 6, minHeight: 6, pointerEvents: "none", opacity: 0,
          filter: "drop-shadow(0 0 3px rgba(255,236,170,0.95)) drop-shadow(0 0 6px rgba(255,214,102,0.6))",
          animation: `lvTwinkle 2.8s ease-in-out ${(p + s.delay) % 2.8}s infinite`,
        }}>
          <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill="#FFFBEA" />
        </svg>
      ))}
    </span>
  );
}

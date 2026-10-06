"use client";
import { badgeArt } from "@/lib/badgeArt";

/** Badge artwork if we have it, otherwise the emoji. `size` is in px. */
export function BadgeIcon({ id, image, emoji, size, imgSize, style }: {
  id?: string | null; image?: string | null; emoji: string; size: number; imgSize?: number; style?: React.CSSProperties;
}) {
  const src = image ?? badgeArt(id);
  if (src) {
    return <img src={src} alt="" draggable={false}
      style={{ width: imgSize ?? size * 1.35, height: imgSize ?? size * 1.35, objectFit: "contain", display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }} />;
  }
  return <span style={{ fontSize: size, flexShrink: 0, ...style }}>{emoji}</span>;
}

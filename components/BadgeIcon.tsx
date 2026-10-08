"use client";
import { badgeArt } from "@/lib/badgeArt";
import { ShinyBadge } from "./ShinyBadge";

/** Badge artwork if we have it, otherwise the emoji. `size` is in px. */
export function BadgeIcon({ id, image, emoji, size, imgSize, style }: {
  id?: string | null; image?: string | null; emoji: string; size: number; imgSize?: number; style?: React.CSSProperties;
}) {
  const src = image ?? badgeArt(id);
  if (src) {
    const px = imgSize ?? size * 1.35;
    return <ShinyBadge src={src} width={px} height={px} sparkles={px >= 36} style={style} />;
  }
  return <span style={{ fontSize: size, flexShrink: 0, ...style }}>{emoji}</span>;
}

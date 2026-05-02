"use client";

// ─── components/recap/CardFrame.tsx ────────────────────────────────────────
// Shared card wrapper used by every card type in the recap carousel. Handles
// the gradient background, the decorative motif, the safe content area, and
// the "share this card" footer button.
//
// Cards are designed at a 9:16 aspect ratio (1080x1920 when generated as
// share images). On screen they fill the viewport; when we render them
// to a canvas for sharing, we use the same aspect ratio so the design
// translates 1:1.

import type { ReactNode } from "react";
import type { Theme } from "./themes";
import Motif from "./Motif";

type Props = {
  theme: Theme;
  children: ReactNode;
  /** Optional CSS class for additional one-off styling. */
  className?: string;
  /** Optional inline style override. */
  style?: React.CSSProperties;
  /** When true, omits the corner brand label. Used by the title card
   *  which has its own header treatment. */
  hideBrand?: boolean;
};

export default function CardFrame({ theme, children, className, style, hideBrand }: Props) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: `linear-gradient(180deg, ${theme.bgTop} 0%, ${theme.bgBottom} 100%)`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {/* Decorative motif — sits behind everything */}
      <Motif theme={theme} variant="fill" />

      {/* Brand label — fixed top-right corner, very small */}
      {!hideBrand && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 18,
            color: theme.textSub,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            zIndex: 5,
            opacity: 0.7,
          }}
        >
          LIVELEE
        </div>
      )}

      {/* Content area */}
      <div
        style={{
          position: "relative",
          flex: 1,
          width: "100%",
          padding: "48px 32px 36px",
          display: "flex",
          flexDirection: "column",
          zIndex: 2,
        }}
      >
        {children}
      </div>
    </div>
  );
}

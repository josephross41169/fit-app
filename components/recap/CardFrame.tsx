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

      {/* Contrast scrim — sits BETWEEN the motif and the content. This is the
          Spotify-Wrapped trick: the bold pattern stays, but a darkening
          gradient keeps text legible everywhere instead of letting the
          pattern bleed through the numbers. Darkest at the very top and
          bottom (where headers / footer sit) and gently shaded through the
          middle so a same-color motif (e.g. yellow circles under yellow text)
          can't wash out the type. pointer-events:none so it never blocks taps. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.30) 22%, rgba(0,0,0,0.18) 50%, rgba(0,0,0,0.34) 78%, rgba(0,0,0,0.60) 100%)",
        }}
      />
      {/* A soft vignette to push the corners down further and frame the card. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          background:
            "radial-gradient(120% 90% at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.38) 100%)",
        }}
      />

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
          // Subtle shadow on every text element so numbers/labels stay crisp
          // against the bold pattern behind them (Spotify does the same — text
          // never relies on the background being plain).
          textShadow: "0 1px 12px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.6)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

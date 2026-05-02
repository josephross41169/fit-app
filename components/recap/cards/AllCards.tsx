"use client";

// ─── components/recap/cards/AllCards.tsx ───────────────────────────────────
// Every card type the recap carousel can render. Each card receives the
// theme + relevant slice of the recap data and renders a 9:16 themed view.
//
// Cards are intentionally simple — one big idea per card. No charts, no
// dashboards, just a bold stat or visual moment. The Spotify Wrapped
// approach: each card is shareable on its own.
//
// All cards use the shared CardFrame which provides the gradient background,
// decorative motif, and brand label. They just fill the inner content area
// with their specific layout.

import type { ReactNode } from "react";
import CardFrame from "../CardFrame";
import type { Theme } from "../themes";
import type { Recap } from "@/lib/recap";
import { wellnessEmoji, cardioEmoji } from "../wellness-icons";
import type { StreakResult } from "@/lib/streaks";

// ─── Shared primitives ─────────────────────────────────────────────────────

function BigNumber({ children, theme, italic }: { children: ReactNode; theme: Theme; italic?: boolean }) {
  return (
    <div
      style={{
        fontSize: "var(--card-num-size)",
        fontWeight: theme.numberWeight,
        color: theme.accent,
        lineHeight: 0.9,
        letterSpacing: theme.headerLetterSpacing,
        fontStyle: italic ? "italic" : (theme.numberStyle === "italic" ? "italic" : "normal"),
      }}
    >
      {children}
    </div>
  );
}

function CardLabel({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        color: theme.textSub,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <div
      style={{
        fontSize: "var(--card-title-size)",
        fontWeight: 900,
        color: theme.text,
        lineHeight: 1.05,
        letterSpacing: theme.headerLetterSpacing,
        textTransform: theme.headlineTransform,
      }}
    >
      {children}
    </div>
  );
}

function CardSub({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <div
      style={{
        fontSize: 16,
        fontWeight: 600,
        color: theme.textSub,
        lineHeight: 1.4,
        marginTop: 12,
      }}
    >
      {children}
    </div>
  );
}

// ─── Card 1: Title ─────────────────────────────────────────────────────────
// The opener. Sets the theme tone — one big date range, no stats yet.
export function TitleCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  return (
    <CardFrame theme={theme} hideBrand>
      {/* Top brand band */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 64 }}>
        <div style={{
          fontSize: 11, fontWeight: 900, color: theme.textSub,
          letterSpacing: "0.25em", textTransform: "uppercase",
        }}>
          LIVELEE · WEEKLY RECAP
        </div>
        <div style={{
          fontSize: 11, fontWeight: 800, color: theme.textSub,
          letterSpacing: "0.18em", textTransform: "uppercase",
        }}>
          {theme.vibeWord}
        </div>
      </div>

      {/* Center hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
        <div style={{
          fontSize: "var(--card-hero-size)",
          fontWeight: 900,
          color: theme.text,
          lineHeight: 0.95,
          letterSpacing: theme.headerLetterSpacing,
          fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
          textTransform: theme.headlineTransform,
        }}>
          {recap.rangeLabel.split(",")[0]}
        </div>
        <div style={{
          marginTop: 14,
          fontSize: 18,
          fontWeight: 700,
          color: theme.textSub,
          letterSpacing: "0.06em",
        }}>
          {recap.rangeLabel.split(",")[1]?.trim() || ""}
        </div>
      </div>

      {/* Footer summary */}
      <div style={{
        textAlign: "center",
        paddingTop: 24,
        borderTop: `1.5px solid ${theme.decor}33`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-around", gap: 16 }}>
          <FooterStat value={String(recap.activeDays)} label="Active Days" theme={theme} />
          <FooterStat value={String(recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions)} label="Sessions" theme={theme} />
          <FooterStat value={String(recap.photos.length)} label="Posts" theme={theme} />
        </div>
        <div style={{ fontSize: 11, color: theme.textSub, marginTop: 18, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          ← Swipe to start
        </div>
      </div>
    </CardFrame>
  );
}

function FooterStat({ value, label, theme }: { value: string; label: string; theme: Theme }) {
  return (
    <div>
      <div style={{ fontSize: 32, fontWeight: 900, color: theme.accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 800, color: theme.textSub, marginTop: 4, letterSpacing: "0.15em", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

// ─── Card 2: Lifts ─────────────────────────────────────────────────────────
export function LiftsCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  // Hero metric: PRs if any, else best single lift, else session count
  const hasPRs = recap.lifts.prs.length > 0;
  const hasBest = recap.lifts.bestLifts.length > 0;
  const heroPR = hasPRs ? recap.lifts.prs[0] : null;

  return (
    <CardFrame theme={theme}>
      <CardLabel theme={theme}>💪 Lifting</CardLabel>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {hasPRs ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 800, color: theme.accent2, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
              🎯 New Personal Record
            </div>
            <CardTitle theme={theme}>{heroPR!.exercise}</CardTitle>
            <BigNumber theme={theme}>
              {heroPR!.weight}<span style={{ fontSize: "0.4em", color: theme.textSub }}> lbs</span>
            </BigNumber>
            <CardSub theme={theme}>
              {heroPR!.reps} reps at max weight
              {recap.lifts.prs.length > 1 && ` · ${recap.lifts.prs.length - 1} more PR${recap.lifts.prs.length > 2 ? "s" : ""} this week`}
            </CardSub>
          </>
        ) : hasBest ? (
          <>
            <CardTitle theme={theme}>{recap.lifts.sessions} Lifting {recap.lifts.sessions === 1 ? "Session" : "Sessions"}</CardTitle>
            <BigNumber theme={theme}>
              {recap.lifts.bestLifts[0].weight}<span style={{ fontSize: "0.4em", color: theme.textSub }}> lbs</span>
            </BigNumber>
            <CardSub theme={theme}>
              Heaviest lift: {recap.lifts.bestLifts[0].exercise} × {recap.lifts.bestLifts[0].reps}
            </CardSub>
          </>
        ) : (
          <>
            <CardTitle theme={theme}>Lifting Sessions</CardTitle>
            <BigNumber theme={theme}>{recap.lifts.sessions}</BigNumber>
            <CardSub theme={theme}>{Math.round(recap.lifts.totalMinutes)} minutes total</CardSub>
          </>
        )}
      </div>

      {/* Bottom: full PR list if 2+ PRs, else stat row */}
      {recap.lifts.prs.length > 1 ? (
        <div style={{ paddingTop: 16, borderTop: `1.5px solid ${theme.decor}33` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: theme.textSub, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
            All PRs This Week
          </div>
          {recap.lifts.prs.slice(1, 4).map((pr, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: theme.text }}>
              <span style={{ fontWeight: 700 }}>{pr.exercise}</span>
              <span style={{ fontWeight: 800, color: theme.accent }}>{pr.weight} lbs × {pr.reps}</span>
            </div>
          ))}
        </div>
      ) : (
        <BottomStatRow theme={theme} stats={[
          { label: "Sessions", value: String(recap.lifts.sessions) },
          { label: "Total Min", value: String(Math.round(recap.lifts.totalMinutes)) },
          { label: "Avg/Day", value: recap.lifts.sessions > 0 ? `${(recap.lifts.totalMinutes / recap.lifts.sessions).toFixed(0)}m` : "—" },
        ]} />
      )}
    </CardFrame>
  );
}

// ─── Card 3: Cardio ────────────────────────────────────────────────────────
export function CardioCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  // Hero: total miles if user logs distance, else session count
  const heroIsMiles = recap.cardio.totalMiles > 0;

  return (
    <CardFrame theme={theme}>
      <CardLabel theme={theme}>🏃 Cardio</CardLabel>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {heroIsMiles ? (
          <>
            <CardTitle theme={theme}>Distance covered</CardTitle>
            <BigNumber theme={theme}>
              {recap.cardio.totalMiles.toFixed(1)}
              <span style={{ fontSize: "0.4em", color: theme.textSub }}> mi</span>
            </BigNumber>
            <CardSub theme={theme}>
              Across {recap.cardio.sessions} {recap.cardio.sessions === 1 ? "session" : "sessions"} · {formatTime(recap.cardio.totalMinutes)} total
            </CardSub>
          </>
        ) : (
          <>
            <CardTitle theme={theme}>Cardio Sessions</CardTitle>
            <BigNumber theme={theme}>{recap.cardio.sessions}</BigNumber>
            <CardSub theme={theme}>
              {formatTime(recap.cardio.totalMinutes)} of cardio this week
            </CardSub>
          </>
        )}
      </div>

      {/* Per-type breakdown */}
      <div style={{ paddingTop: 16, borderTop: `1.5px solid ${theme.decor}33` }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: theme.textSub, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
          By Type
        </div>
        {recap.cardio.byType.slice(0, 3).map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: i < Math.min(2, recap.cardio.byType.length - 1) ? `1px solid ${theme.decor}1A` : "none" }}>
            <span style={{ fontSize: 22, marginRight: 12 }}>{cardioEmoji(c.type)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: theme.text, textTransform: "capitalize" }}>{c.type}</div>
              <div style={{ fontSize: 12, color: theme.textSub, fontWeight: 600 }}>
                {c.sessions}× · {formatTime(c.totalMinutes)}{c.avgMiles > 0 ? ` · ${c.avgMiles.toFixed(1)}mi avg` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}

// ─── Card 4: Wellness ──────────────────────────────────────────────────────
export function WellnessCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  const top = recap.wellness.byType[0];

  return (
    <CardFrame theme={theme}>
      <CardLabel theme={theme}>🌿 Wellness</CardLabel>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {top ? (
          <>
            <div style={{ fontSize: "var(--card-emoji-size)", lineHeight: 1, marginBottom: 8 }}>
              {wellnessEmoji(top.type)}
            </div>
            <BigNumber theme={theme}>
              {top.sessions}<span style={{ fontSize: "0.35em", color: theme.textSub }}>×</span>
            </BigNumber>
            <CardTitle theme={theme}>{top.type}</CardTitle>
            <CardSub theme={theme}>
              Most-logged wellness this week
            </CardSub>
          </>
        ) : (
          <>
            <CardTitle theme={theme}>Wellness Sessions</CardTitle>
            <BigNumber theme={theme}>{recap.wellness.sessions}</BigNumber>
          </>
        )}
      </div>

      {/* All wellness types as emoji chips */}
      {recap.wellness.byType.length > 0 && (
        <div style={{ paddingTop: 16, borderTop: `1.5px solid ${theme.decor}33` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: theme.textSub, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
            All Wellness ({recap.wellness.sessions} sessions)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {recap.wellness.byType.slice(0, 8).map((w, i) => (
              <div key={i} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 12px",
                background: `${theme.decor}1A`,
                border: `1px solid ${theme.decor}33`,
                borderRadius: 99,
                fontSize: 13, fontWeight: 700, color: theme.text,
              }}>
                <span style={{ fontSize: 18 }}>{wellnessEmoji(w.type)}</span>
                <span>{w.type}</span>
                <span style={{ color: theme.accent, fontWeight: 900 }}>×{w.sessions}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CardFrame>
  );
}

// ─── Card 5: Photos ────────────────────────────────────────────────────────
export function PhotosCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  const count = recap.photos.length;
  // Mosaic layout: up to 9 photos in a 3x3 grid. If fewer, lay out
  // adaptively (1 photo = single hero, 2-4 = 2x2, 5-9 = 3x3 with empty
  // slots filled with theme color).
  const display = recap.photos.slice(0, 9);
  const cols = count >= 5 ? 3 : count >= 2 ? 2 : 1;

  return (
    <CardFrame theme={theme}>
      <CardLabel theme={theme}>📸 Posts</CardLabel>

      <div style={{ marginBottom: 16 }}>
        <BigNumber theme={theme}>{count}</BigNumber>
        <CardTitle theme={theme}>{count === 1 ? "Post Shared" : "Posts Shared"}</CardTitle>
        <CardSub theme={theme}>
          Photos from your feed this week
        </CardSub>
      </div>

      {count > 0 ? (
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 6,
            minHeight: 0,
          }}
        >
          {display.map((p, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: 12,
                overflow: "hidden",
                background: theme.bgBottom,
                border: `1.5px solid ${theme.decor}33`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                crossOrigin="anonymous"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: `center ${p.position ?? 50}%`,
                  display: "block",
                }}
              />
            </div>
          ))}
          {/* Pad empty slots if grid isn't filled */}
          {Array.from({ length: Math.max(0, (cols * cols) - display.length) }).map((_, i) => (
            <div key={`pad-${i}`} style={{
              aspectRatio: "1",
              borderRadius: 12,
              background: `${theme.decor}11`,
              border: `1.5px dashed ${theme.decor}33`,
            }} />
          ))}
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          textAlign: "center",
          color: theme.textSub,
        }}>
          No posts this week
        </div>
      )}
    </CardFrame>
  );
}

// ─── Card 6: Streaks ───────────────────────────────────────────────────────
export function StreaksCard({
  theme,
  streaks,
}: {
  theme: Theme;
  streaks: { workout: StreakResult; wellness: StreakResult; nutrition: StreakResult } | null;
}) {
  const longest = streaks ? Math.max(streaks.workout.current, streaks.wellness.current, streaks.nutrition.current) : 0;
  const longestLabel = (() => {
    if (!streaks) return "Workout";
    if (streaks.workout.current === longest) return "Workout";
    if (streaks.wellness.current === longest) return "Wellness";
    return "Nutrition";
  })();

  return (
    <CardFrame theme={theme}>
      <CardLabel theme={theme}>🔥 Streaks</CardLabel>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {longest > 0 ? (
          <>
            <CardTitle theme={theme}>Longest Active</CardTitle>
            <BigNumber theme={theme}>
              {longest}<span style={{ fontSize: "0.3em", color: theme.textSub }}> day{longest === 1 ? "" : "s"}</span>
            </BigNumber>
            <CardSub theme={theme}>
              {longestLabel} streak · don't break it
            </CardSub>
          </>
        ) : (
          <>
            <CardTitle theme={theme}>Build a streak</CardTitle>
            <CardSub theme={theme}>
              Log any workout or wellness session to start a streak.
            </CardSub>
          </>
        )}
      </div>

      {/* All 3 streaks side by side */}
      {streaks && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, paddingTop: 16, borderTop: `1.5px solid ${theme.decor}33` }}>
          <StreakMini label="Workout" current={streaks.workout.current} best={streaks.workout.best} theme={theme} />
          <StreakMini label="Wellness" current={streaks.wellness.current} best={streaks.wellness.best} theme={theme} />
          <StreakMini label="Nutrition" current={streaks.nutrition.current} best={streaks.nutrition.best} theme={theme} />
        </div>
      )}
    </CardFrame>
  );
}

function StreakMini({ label, current, best, theme }: { label: string; current: number; best: number; theme: Theme }) {
  const active = current > 0;
  return (
    <div style={{
      padding: "12px 8px",
      background: active ? `${theme.decor}22` : `${theme.decor}0A`,
      border: `1.5px solid ${active ? theme.decor + "55" : theme.decor + "22"}`,
      borderRadius: 12,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 18, marginBottom: 2 }}>{active ? "🔥" : "·"}</div>
      <div style={{ fontSize: 9, fontWeight: 800, color: theme.textSub, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: active ? theme.accent : theme.textSub, lineHeight: 1 }}>
        {current}
      </div>
      <div style={{ fontSize: 10, color: theme.textSub, marginTop: 4, fontWeight: 600 }}>
        Best {best}
      </div>
    </div>
  );
}

// ─── Card 7: Achievements ──────────────────────────────────────────────────
export function AchievementsCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  const total = recap.badgesEarned.length + recap.placesTagged.length;

  return (
    <CardFrame theme={theme}>
      <CardLabel theme={theme}>🏆 Achievements</CardLabel>

      <div style={{ marginBottom: 16 }}>
        <BigNumber theme={theme}>{total}</BigNumber>
        <CardTitle theme={theme}>{total === 1 ? "Win This Week" : "Wins This Week"}</CardTitle>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Badges */}
        {recap.badgesEarned.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: theme.textSub, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
              ✨ {recap.badgesEarned.length} New Badge{recap.badgesEarned.length === 1 ? "" : "s"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {recap.badgesEarned.slice(0, 8).map((b, i) => (
                <div key={i} style={{
                  padding: "8px 12px",
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                  border: `1.5px solid ${theme.accent}88`,
                  borderRadius: 10,
                  fontSize: 12, fontWeight: 800, color: theme.bgBottom,
                  letterSpacing: "0.02em",
                }}>
                  {prettyBadgeId(b.badge_id)}
                </div>
              ))}
              {recap.badgesEarned.length > 8 && (
                <div style={{
                  padding: "8px 12px",
                  fontSize: 12, fontWeight: 800, color: theme.textSub,
                }}>
                  +{recap.badgesEarned.length - 8} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Places */}
        {recap.placesTagged.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: theme.textSub, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
              📍 Places Visited
            </div>
            {recap.placesTagged.slice(0, 4).map((p, i) => (
              <div key={i} style={{
                padding: "8px 0",
                borderBottom: i < Math.min(3, recap.placesTagged.length - 1) ? `1px solid ${theme.decor}1A` : "none",
                fontSize: 14, fontWeight: 700, color: theme.text,
              }}>
                {p.name}{p.city ? <span style={{ color: theme.textSub, fontWeight: 600 }}> · {p.city}</span> : ""}
              </div>
            ))}
          </div>
        )}

        {/* PRs (in addition to those highlighted on the lifts card) */}
        {recap.lifts.prs.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: theme.textSub, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
              💪 PRs Set
            </div>
            {recap.lifts.prs.slice(0, 3).map((pr, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", padding: "6px 0",
                fontSize: 13, color: theme.text, fontWeight: 700,
              }}>
                <span>{pr.exercise}</span>
                <span style={{ color: theme.accent }}>{pr.weight} lbs × {pr.reps}</span>
              </div>
            ))}
          </div>
        )}

        {total === 0 && (
          <div style={{ textAlign: "center", color: theme.textSub, fontSize: 14, padding: "40px 0" }}>
            Show up next week — earn your first badge.
          </div>
        )}
      </div>
    </CardFrame>
  );
}

// ─── Card 8: Outro ─────────────────────────────────────────────────────────
export function OutroCard({ theme, recap, username }: { theme: Theme; recap: Recap; username?: string }) {
  return (
    <CardFrame theme={theme}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
        <div style={{
          fontSize: 14, fontWeight: 800, color: theme.textSub,
          letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 24,
        }}>
          Week Complete
        </div>
        <div style={{
          fontSize: "var(--card-num-size)",
          fontWeight: 900,
          color: theme.text,
          lineHeight: 1,
          letterSpacing: theme.headerLetterSpacing,
          fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
        }}>
          {recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions}
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700, color: theme.accent, marginTop: 14,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          Total Sessions
        </div>
        <div style={{ fontSize: 16, color: theme.textSub, marginTop: 32, fontWeight: 600, lineHeight: 1.5 }}>
          {recap.activeDays >= 5 ? "You showed up. That's how it's done." :
           recap.activeDays >= 3 ? "Solid week. Keep building." :
           recap.activeDays >= 1 ? "Every session counts. Next week, push harder." :
           "Rest weeks are part of it. Get back at it."}
        </div>
      </div>

      <div style={{ textAlign: "center", paddingTop: 24, borderTop: `1.5px solid ${theme.decor}33` }}>
        {username && (
          <div style={{ fontSize: 14, fontWeight: 800, color: theme.text, marginBottom: 6 }}>@{username}</div>
        )}
        <div style={{ fontSize: 12, fontWeight: 800, color: theme.accent, letterSpacing: "0.18em", textTransform: "uppercase" }}>
          liveleeapp.com
        </div>
      </div>
    </CardFrame>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function BottomStatRow({ theme, stats }: { theme: Theme; stats: { label: string; value: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 10, paddingTop: 16, borderTop: `1.5px solid ${theme.decor}33` }}>
      {stats.map((s, i) => (
        <div key={i} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: theme.accent, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: 9, fontWeight: 800, color: theme.textSub, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTime(min: number): string {
  const m = Math.round(min);
  if (m === 0) return "0m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function prettyBadgeId(id: string): string {
  return id.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

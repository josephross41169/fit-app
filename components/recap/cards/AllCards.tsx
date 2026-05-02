"use client";

// ─── components/recap/cards/AllCards.tsx ───────────────────────────────────
// Every card type the recap carousel renders. Each card gets its OWN custom
// composition rather than the shared "label/big-number/caption" template
// the v1 cards used. Goal: every card feels distinct, dense with data,
// and visually loud (Spotify Wrapped style).
//
// Cards still receive the active theme so colors/typography stay consistent
// across the carousel, but each card composes those colors differently.

import type { ReactNode } from "react";
import CardFrame from "../CardFrame";
import type { Theme } from "../themes";
import type { Recap } from "@/lib/recap";
import { wellnessEmoji, cardioEmoji } from "../wellness-icons";
import type { StreakResult } from "@/lib/streaks";

// ═══════════════════════════════════════════════════════════════════════
// Shared formatting helpers
// ═══════════════════════════════════════════════════════════════════════

function formatTime(min: number): string {
  const m = Math.round(min);
  if (m === 0) return "0m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function formatPace(minPerMi: number): string {
  if (!minPerMi) return "—";
  const m = Math.floor(minPerMi);
  const s = Math.round((minPerMi - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function formatVolume(v: number): string {
  if (v >= 100000) return `${(v / 1000).toFixed(0)}k`;
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
  return Math.round(v).toLocaleString();
}

function prettyBadgeId(id: string): string {
  return id.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Reusable "stat chip" for compact secondary stats that float around the hero
function StatChip({ value, label, theme }: { value: ReactNode; label: string; theme: Theme }) {
  return (
    <div style={{
      background: `${theme.accent3}15`,
      border: `1.5px solid ${theme.accent3}33`,
      borderRadius: 12,
      padding: "10px 14px",
      minWidth: 0,
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: theme.accent, lineHeight: 1, letterSpacing: theme.headerLetterSpacing }}>
        {value}
      </div>
      <div style={{ fontSize: 9, fontWeight: 800, color: theme.textSub, letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 5 }}>
        {label}
      </div>
    </div>
  );
}

// Compact ranked list row with marker-highlight on the rank number — mimics
// Spotify Wrapped's "1 K-Pop / 2 R&B" treatment.
function RankRow({
  rank, label, value, theme, accentColor,
}: {
  rank: number; label: string; value: string; theme: Theme; accentColor?: string;
}) {
  const bg = accentColor || theme.accent;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
      borderBottom: `1px solid ${theme.accent3}1A`,
    }}>
      <div style={{
        flexShrink: 0,
        background: bg,
        color: theme.text === "#FFFFFF" ? theme.bgBottom : theme.bgTop,
        fontSize: 13, fontWeight: 900,
        width: 26, height: 26, borderRadius: 4,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: theme.textSub }}>
        {value}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CARD 1: TITLE — week brand opener
// ═══════════════════════════════════════════════════════════════════════
export function TitleCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  const totalSessions = recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions;
  // Parse range label for big display: "Apr 19 – 25, 2026"
  const [datePart, yearPart] = recap.rangeLabel.split(",").map(s => s.trim());

  return (
    <CardFrame theme={theme} hideBrand>
      {/* Top-left brand */}
      <div style={{
        position: "absolute", top: 18, left: 22, right: 22,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 5,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 900, color: theme.text,
          letterSpacing: "0.25em",
        }}>
          LIVELEE · WEEKLY RECAP
        </div>
        <div style={{
          fontSize: 11, fontWeight: 900,
          letterSpacing: "0.18em",
          padding: "4px 10px",
          background: theme.accent,
          color: theme.bgBottom === "#0A0A0A" ? "#0A0A0A" : theme.text,
        }}>
          {theme.vibeWord}
        </div>
      </div>

      {/* Center hero — date stacked huge */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{
          fontSize: "var(--card-hero-size)",
          fontWeight: 900, color: theme.text,
          lineHeight: 0.85,
          letterSpacing: theme.headerLetterSpacing,
          fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
        }}>
          {datePart}
        </div>
        <div style={{
          fontSize: 24, fontWeight: 900, color: theme.accent,
          marginTop: 14, letterSpacing: "0.02em",
        }}>
          {yearPart}
        </div>

        {/* Three big highlight stats — stacked */}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
          <BigHighlight label="ACTIVE DAYS" value={recap.activeDays} suffix={recap.activeDays === 1 ? " of 7" : " of 7"} theme={theme} />
          <BigHighlight label="SESSIONS" value={totalSessions} theme={theme} />
          <BigHighlight label="POSTS SHARED" value={recap.photos.length} theme={theme} />
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{ paddingTop: 14, textAlign: "center" }}>
        <div style={{
          fontSize: 11, fontWeight: 800, color: theme.text,
          letterSpacing: "0.2em", opacity: 0.75,
        }}>
          ← SWIPE TO START →
        </div>
      </div>
    </CardFrame>
  );
}

function BigHighlight({ label, value, suffix, theme }: { label: string; value: number; suffix?: string; theme: Theme }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      borderBottom: `2px solid ${theme.text}33`, paddingBottom: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: theme.text, letterSpacing: "0.18em", opacity: 0.8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <div style={{
          fontSize: 36, fontWeight: 900, color: theme.accent,
          lineHeight: 1, letterSpacing: theme.headerLetterSpacing,
          fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
        }}>
          {value}
        </div>
        {suffix && <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, opacity: 0.6 }}>{suffix}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CARD 2: LIFTS — heavy data, ranked list of best lifts + advanced stats
// ═══════════════════════════════════════════════════════════════════════
export function LiftsCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  const hasPRs = recap.lifts.prs.length > 0;
  const heroLift = hasPRs ? recap.lifts.prs[0] : recap.lifts.heaviestSet || recap.lifts.bestLifts[0];

  return (
    <CardFrame theme={theme}>
      {/* Top label */}
      <div style={{
        fontSize: 12, fontWeight: 900, color: theme.accent,
        letterSpacing: "0.25em", marginBottom: 8,
      }}>
        💪 LIFTS · {recap.lifts.sessions} {recap.lifts.sessions === 1 ? "SESSION" : "SESSIONS"}
      </div>

      {/* Hero — heaviest lift OR PR */}
      {heroLift && (
        <>
          {hasPRs && (
            <div style={{
              display: "inline-block",
              fontSize: 11, fontWeight: 900, color: theme.bgBottom === "#0A0A0A" ? "#0A0A0A" : theme.text,
              background: theme.accent,
              padding: "3px 10px",
              letterSpacing: "0.18em",
              marginBottom: 10,
            }}>
              ★ NEW PR
            </div>
          )}
          <div style={{
            fontSize: "var(--card-title-size)",
            fontWeight: 900, color: theme.text,
            lineHeight: 0.95, letterSpacing: theme.headerLetterSpacing,
            textTransform: "uppercase",
          }}>
            {heroLift.exercise}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
            <div style={{
              fontSize: "var(--card-num-size)",
              fontWeight: 900, color: theme.accent,
              lineHeight: 0.9, letterSpacing: theme.headerLetterSpacing,
              fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
            }}>
              {heroLift.weight}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: theme.textSub }}>
              lbs × {heroLift.reps}
            </div>
          </div>
        </>
      )}

      {/* Stat grid — 2x2 dense */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
        <StatChip value={formatVolume(recap.lifts.totalVolume)} label="TOTAL VOLUME (LBS)" theme={theme} />
        <StatChip value={recap.lifts.totalSets} label="SETS LOGGED" theme={theme} />
        <StatChip value={recap.lifts.uniqueExercises} label="UNIQUE LIFTS" theme={theme} />
        <StatChip value={formatTime(recap.lifts.totalMinutes)} label="TIME UNDER BAR" theme={theme} />
      </div>

      {/* Most-trained */}
      {recap.lifts.mostTrained && (
        <div style={{
          marginTop: 14, padding: "10px 14px",
          background: `${theme.accent}1F`,
          border: `1.5px solid ${theme.accent}55`,
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: theme.accent, letterSpacing: "0.18em", marginBottom: 3 }}>
            MOST TRAINED
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: theme.text }}>
              {recap.lifts.mostTrained.exercise}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: theme.textSub }}>
              {recap.lifts.mostTrained.sets} sets
            </div>
          </div>
        </div>
      )}

      {/* Top lifts ranked list */}
      {recap.lifts.bestLifts.length > 1 && (
        <div style={{ marginTop: 14, flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: theme.textSub, letterSpacing: "0.18em", marginBottom: 6 }}>
            TOP LIFTS THIS WEEK
          </div>
          {recap.lifts.bestLifts.slice(0, 4).map((l, i) => (
            <RankRow
              key={i}
              rank={i + 1}
              label={l.exercise}
              value={`${l.weight} × ${l.reps}`}
              theme={theme}
            />
          ))}
        </div>
      )}
    </CardFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CARD 3: CARDIO — distance hero + dense supporting stats
// ═══════════════════════════════════════════════════════════════════════
export function CardioCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  const heroIsMiles = recap.cardio.totalMiles > 0;

  return (
    <CardFrame theme={theme}>
      <div style={{
        fontSize: 12, fontWeight: 900, color: theme.accent,
        letterSpacing: "0.25em", marginBottom: 8,
      }}>
        🏃 CARDIO · {recap.cardio.sessions} {recap.cardio.sessions === 1 ? "SESSION" : "SESSIONS"}
      </div>

      {/* Hero number */}
      {heroIsMiles ? (
        <>
          <div style={{
            fontSize: "var(--card-title-size)",
            fontWeight: 900, color: theme.text,
            lineHeight: 0.95, letterSpacing: theme.headerLetterSpacing,
            textTransform: "uppercase",
          }}>
            YOU COVERED
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
            <div style={{
              fontSize: "var(--card-num-size)",
              fontWeight: 900, color: theme.accent,
              lineHeight: 0.9, letterSpacing: theme.headerLetterSpacing,
              fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
            }}>
              {recap.cardio.totalMiles.toFixed(1)}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: theme.textSub }}>miles</div>
          </div>
        </>
      ) : (
        <>
          <div style={{
            fontSize: "var(--card-title-size)",
            fontWeight: 900, color: theme.text,
            lineHeight: 0.95, letterSpacing: theme.headerLetterSpacing,
            textTransform: "uppercase",
          }}>
            TOTAL TIME
          </div>
          <div style={{
            fontSize: "var(--card-num-size)",
            fontWeight: 900, color: theme.accent,
            lineHeight: 0.9,
          }}>
            {formatTime(recap.cardio.totalMinutes)}
          </div>
        </>
      )}

      {/* Dense stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
        <StatChip value={formatTime(recap.cardio.totalMinutes)} label="TOTAL TIME" theme={theme} />
        <StatChip
          value={recap.cardio.avgPaceMinPerMi ? formatPace(recap.cardio.avgPaceMinPerMi).replace("/mi", "") : "—"}
          label="AVG PACE / MI"
          theme={theme}
        />
        <StatChip
          value={recap.cardio.longestSession ? `${recap.cardio.longestSession.miles.toFixed(1)}mi` : "—"}
          label="LONGEST RUN"
          theme={theme}
        />
        <StatChip value={recap.cardio.cardioDays.length} label={recap.cardio.cardioDays.length === 1 ? "DAY ACTIVE" : "DAYS ACTIVE"} theme={theme} />
      </div>

      {/* Day-of-week breakdown */}
      {recap.cardio.cardioDays.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: theme.textSub, letterSpacing: "0.18em", marginBottom: 6 }}>
            DAYS YOU MOVED
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} style={{
                width: 36, height: 36, borderRadius: 8,
                background: recap.cardio.cardioDays.includes(d) ? theme.accent : `${theme.accent3}15`,
                color: recap.cardio.cardioDays.includes(d) ? (theme.bgBottom === "#0A0A0A" ? "#0A0A0A" : theme.text) : theme.textSub,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 900, letterSpacing: "0.04em",
                opacity: recap.cardio.cardioDays.includes(d) ? 1 : 0.5,
              }}>
                {d.substring(0, 1)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-type ranked breakdown */}
      {recap.cardio.byType.length > 0 && (
        <div style={{ marginTop: 14, flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: theme.textSub, letterSpacing: "0.18em", marginBottom: 6 }}>
            BY TYPE
          </div>
          {recap.cardio.byType.slice(0, 3).map((c, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0",
              borderBottom: i < Math.min(2, recap.cardio.byType.length - 1) ? `1px solid ${theme.accent3}1A` : "none",
            }}>
              <span style={{ fontSize: 22 }}>{cardioEmoji(c.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 14, color: theme.text, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                  {c.type}
                </div>
                <div style={{ fontSize: 11, color: theme.textSub, fontWeight: 700 }}>
                  {c.sessions}× · {formatTime(c.totalMinutes)}{c.avgMiles > 0 ? ` · ${c.avgMiles.toFixed(1)}mi avg` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CARD 4: WELLNESS — top type as hero, others as ranked list
// ═══════════════════════════════════════════════════════════════════════
export function WellnessCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  const top = recap.wellness.byType[0];

  return (
    <CardFrame theme={theme}>
      <div style={{
        fontSize: 12, fontWeight: 900, color: theme.accent,
        letterSpacing: "0.25em", marginBottom: 8,
      }}>
        🌿 WELLNESS · {recap.wellness.sessions} {recap.wellness.sessions === 1 ? "SESSION" : "SESSIONS"}
      </div>

      {top && (
        <>
          {/* Hero emoji + count */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: "var(--card-emoji-size)", lineHeight: 1 }}>
              {wellnessEmoji(top.type)}
            </div>
            <div style={{
              fontSize: "var(--card-num-size)",
              fontWeight: 900, color: theme.accent,
              lineHeight: 0.85, letterSpacing: theme.headerLetterSpacing,
              fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
            }}>
              {top.sessions}<span style={{ fontSize: "0.4em", color: theme.textSub }}>×</span>
            </div>
          </div>
          <div style={{
            fontSize: "var(--card-title-size)",
            fontWeight: 900, color: theme.text,
            lineHeight: 0.95, letterSpacing: theme.headerLetterSpacing,
            textTransform: "uppercase",
          }}>
            {top.type}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.textSub, marginTop: 4 }}>
            Most-logged wellness this week
          </div>
        </>
      )}

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 18 }}>
        <StatChip value={recap.wellness.varietyCount} label="UNIQUE TYPES" theme={theme} />
        <StatChip
          value={recap.wellness.longestSession ? formatTime(recap.wellness.longestSession.minutes) : "—"}
          label="LONGEST"
          theme={theme}
        />
        <StatChip
          value={recap.wellness.bestDay ? recap.wellness.bestDay.label : "—"}
          label="TOP DAY"
          theme={theme}
        />
      </div>

      {/* Ranked list of all wellness types */}
      {recap.wellness.byType.length > 1 && (
        <div style={{ marginTop: 14, flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: theme.textSub, letterSpacing: "0.18em", marginBottom: 6 }}>
            ALL WELLNESS TYPES
          </div>
          {recap.wellness.byType.slice(0, 5).map((w, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 0",
              borderBottom: i < Math.min(4, recap.wellness.byType.length - 1) ? `1px solid ${theme.accent3}1A` : "none",
            }}>
              <span style={{ fontSize: 18 }}>{wellnessEmoji(w.type)}</span>
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: theme.text }}>
                {w.type}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 900,
                background: theme.accent,
                color: theme.bgBottom === "#0A0A0A" ? "#0A0A0A" : theme.bgBottom,
                padding: "3px 10px",
                borderRadius: 4,
                letterSpacing: "0.04em",
              }}>
                {w.sessions}×
              </div>
            </div>
          ))}
        </div>
      )}
    </CardFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CARD 5: PHOTOS — mosaic with engagement stats
// ═══════════════════════════════════════════════════════════════════════
export function PhotosCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  const count = recap.photos.length;
  const display = recap.photos.slice(0, 6);

  return (
    <CardFrame theme={theme}>
      <div style={{
        fontSize: 12, fontWeight: 900, color: theme.accent,
        letterSpacing: "0.25em", marginBottom: 8,
      }}>
        📸 POSTS · {count} {count === 1 ? "SHARE" : "SHARES"}
      </div>

      {/* Hero number + total likes */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{
          fontSize: "var(--card-num-size)",
          fontWeight: 900, color: theme.accent,
          lineHeight: 0.85,
          fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
        }}>
          {count}
        </div>
        <div style={{
          fontSize: "var(--card-title-size)",
          fontWeight: 900, color: theme.text,
          lineHeight: 1, letterSpacing: theme.headerLetterSpacing,
          textTransform: "uppercase",
        }}>
          POSTS
        </div>
      </div>

      {/* Engagement stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
        <StatChip value={recap.totalLikes} label="TOTAL ❤️ LIKES" theme={theme} />
        <StatChip
          value={recap.topPost ? recap.topPost.likes : 0}
          label="TOP POST LIKES"
          theme={theme}
        />
      </div>

      {/* Photo mosaic */}
      {count > 0 ? (
        <div style={{
          marginTop: 14, flex: 1,
          display: "grid",
          gridTemplateColumns: count === 1 ? "1fr" : (count === 2 ? "1fr 1fr" : "1fr 1fr 1fr"),
          gridAutoRows: "1fr",
          gap: 4,
          minHeight: 0,
          overflow: "hidden",
        }}>
          {display.map((p, i) => (
            <div key={i} style={{
              position: "relative",
              aspectRatio: "1",
              borderRadius: 8,
              overflow: "hidden",
              background: theme.bgBottom,
              border: `2px solid ${theme.accent3}33`,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                crossOrigin="anonymous"
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  objectPosition: `center ${p.position ?? 50}%`,
                  display: "block",
                }}
              />
              {p.likes > 0 && (
                <div style={{
                  position: "absolute", top: 4, right: 4,
                  background: "rgba(0,0,0,0.7)",
                  color: "#fff", fontSize: 10, fontWeight: 900,
                  padding: "2px 6px", borderRadius: 6,
                }}>
                  ♥ {p.likes}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          flex: 1, marginTop: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          textAlign: "center", color: theme.textSub,
          fontSize: 14, fontWeight: 700,
        }}>
          No posts shared this week
        </div>
      )}
    </CardFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CARD 6: STREAKS — three vertical streak meters
// ═══════════════════════════════════════════════════════════════════════
export function StreaksCard({
  theme,
  streaks,
}: {
  theme: Theme;
  streaks: { workout: StreakResult; wellness: StreakResult; nutrition: StreakResult } | null;
}) {
  const longest = streaks ? Math.max(streaks.workout.current, streaks.wellness.current, streaks.nutrition.current) : 0;
  const totalAlive = streaks ? [streaks.workout.current, streaks.wellness.current, streaks.nutrition.current].filter(c => c > 0).length : 0;

  return (
    <CardFrame theme={theme}>
      <div style={{
        fontSize: 12, fontWeight: 900, color: theme.accent,
        letterSpacing: "0.25em", marginBottom: 8,
      }}>
        🔥 STREAKS
      </div>

      {longest > 0 ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{
            fontSize: "var(--card-num-size)",
            fontWeight: 900, color: theme.accent,
            lineHeight: 0.85, letterSpacing: theme.headerLetterSpacing,
            fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
          }}>
            {longest}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: theme.textSub }}>
            day{longest === 1 ? "" : "s"}
          </div>
        </div>
      ) : (
        <div style={{
          fontSize: "var(--card-title-size)",
          fontWeight: 900, color: theme.text,
          lineHeight: 1, letterSpacing: theme.headerLetterSpacing,
          textTransform: "uppercase",
        }}>
          NO ACTIVE STREAKS
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginTop: 4 }}>
        {longest > 0 ? "Longest active streak" : "Log a workout to begin"}
      </div>
      {totalAlive > 0 && (
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.textSub, marginTop: 2 }}>
          {totalAlive} of 3 streaks alive
        </div>
      )}

      {/* Three streak meters stacked */}
      {streaks && (
        <div style={{ marginTop: 22, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <StreakMeter label="WORKOUT" current={streaks.workout.current} best={streaks.workout.best} theme={theme} />
          <StreakMeter label="WELLNESS" current={streaks.wellness.current} best={streaks.wellness.best} theme={theme} />
          <StreakMeter label="NUTRITION" current={streaks.nutrition.current} best={streaks.nutrition.best} theme={theme} />
        </div>
      )}
    </CardFrame>
  );
}

function StreakMeter({ label, current, best, theme }: { label: string; current: number; best: number; theme: Theme }) {
  const active = current > 0;
  // Show progress against best — full bar if current === best, else proportional
  const fillPct = best > 0 ? Math.min(100, (current / best) * 100) : 0;

  return (
    <div style={{
      padding: "12px 14px",
      background: active ? `${theme.accent}1F` : `${theme.accent3}10`,
      border: `2px solid ${active ? theme.accent + "88" : theme.accent3 + "22"}`,
      borderRadius: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{
          fontSize: 11, fontWeight: 900, color: active ? theme.accent : theme.textSub,
          letterSpacing: "0.18em",
        }}>
          {active ? "🔥 " : ""}{label}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{
            fontSize: 26, fontWeight: 900, color: active ? theme.accent : theme.textSub,
            lineHeight: 1,
          }}>
            {current}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: theme.textSub }}>
            / best {best}
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{
        height: 4, borderRadius: 2,
        background: `${theme.accent3}20`,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${fillPct}%`,
          background: active ? theme.accent : theme.accent3,
          transition: "width 0.4s",
        }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CARD 7: ACHIEVEMENTS — badges + places + PRs in one
// ═══════════════════════════════════════════════════════════════════════
export function AchievementsCard({ theme, recap }: { theme: Theme; recap: Recap }) {
  const total = recap.badgesEarned.length + recap.placesTagged.length + recap.lifts.prs.length;

  return (
    <CardFrame theme={theme}>
      <div style={{
        fontSize: 12, fontWeight: 900, color: theme.accent,
        letterSpacing: "0.25em", marginBottom: 8,
      }}>
        🏆 ACHIEVEMENTS
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{
          fontSize: "var(--card-num-size)",
          fontWeight: 900, color: theme.accent,
          lineHeight: 0.85,
          fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
        }}>
          {total}
        </div>
        <div style={{
          fontSize: "var(--card-title-size)",
          fontWeight: 900, color: theme.text,
          lineHeight: 1, letterSpacing: theme.headerLetterSpacing,
          textTransform: "uppercase",
        }}>
          {total === 1 ? "WIN" : "WINS"}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
        {/* PRs */}
        {recap.lifts.prs.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: theme.textSub, letterSpacing: "0.18em", marginBottom: 6 }}>
              💪 {recap.lifts.prs.length} NEW PR{recap.lifts.prs.length === 1 ? "" : "s"}
            </div>
            {recap.lifts.prs.slice(0, 3).map((pr, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", padding: "5px 0",
                fontSize: 13, fontWeight: 800, color: theme.text,
                borderBottom: i < Math.min(2, recap.lifts.prs.length - 1) ? `1px solid ${theme.accent3}1A` : "none",
              }}>
                <span>{pr.exercise}</span>
                <span style={{ color: theme.accent }}>{pr.weight} × {pr.reps}</span>
              </div>
            ))}
          </div>
        )}

        {/* Badges */}
        {recap.badgesEarned.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: theme.textSub, letterSpacing: "0.18em", marginBottom: 6 }}>
              ✨ {recap.badgesEarned.length} NEW BADGE{recap.badgesEarned.length === 1 ? "" : "S"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {recap.badgesEarned.slice(0, 8).map((b, i) => (
                <div key={i} style={{
                  padding: "5px 10px",
                  background: theme.accent,
                  color: theme.bgBottom === "#0A0A0A" ? "#0A0A0A" : theme.bgBottom,
                  borderRadius: 6,
                  fontSize: 11, fontWeight: 900,
                  letterSpacing: "0.02em",
                }}>
                  {prettyBadgeId(b.badge_id)}
                </div>
              ))}
              {recap.badgesEarned.length > 8 && (
                <div style={{ padding: "5px 10px", fontSize: 11, fontWeight: 800, color: theme.textSub }}>
                  +{recap.badgesEarned.length - 8} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Places */}
        {recap.placesTagged.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: theme.textSub, letterSpacing: "0.18em", marginBottom: 6 }}>
              📍 {recap.placesTagged.length} {recap.placesTagged.length === 1 ? "PLACE" : "PLACES"} VISITED
            </div>
            {recap.placesTagged.slice(0, 4).map((p, i) => (
              <div key={i} style={{
                padding: "5px 0", fontSize: 13, fontWeight: 800, color: theme.text,
                borderBottom: i < Math.min(3, recap.placesTagged.length - 1) ? `1px solid ${theme.accent3}1A` : "none",
              }}>
                {p.name}{p.city ? <span style={{ color: theme.textSub, fontWeight: 600 }}> · {p.city}</span> : ""}
              </div>
            ))}
          </div>
        )}

        {total === 0 && (
          <div style={{
            textAlign: "center", color: theme.textSub,
            fontSize: 14, fontWeight: 700,
            padding: "30px 0",
          }}>
            Keep showing up — wins are coming.
          </div>
        )}
      </div>
    </CardFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CARD 8: OUTRO — summary + week vs last week + signoff
// ═══════════════════════════════════════════════════════════════════════
export function OutroCard({ theme, recap, username }: { theme: Theme; recap: Recap; username?: string }) {
  const total = recap.lifts.sessions + recap.cardio.sessions + recap.wellness.sessions;
  const vs = recap.vsLastWeek;
  const trendLabel = vs && vs.sessionsPct > 0 ? `+${vs.sessionsPct}% from last week`
                   : vs && vs.sessionsPct < 0 ? `${vs.sessionsPct}% from last week`
                   : null;

  // Personal signoff phrase based on activity level
  const signoff =
    recap.activeDays >= 6 ? "RELENTLESS." :
    recap.activeDays >= 5 ? "CONSISTENT." :
    recap.activeDays >= 3 ? "BUILDING." :
    recap.activeDays >= 1 ? "JUST GETTING STARTED." :
    "REST WEEK. RESET.";

  return (
    <CardFrame theme={theme}>
      <div style={{
        fontSize: 12, fontWeight: 900, color: theme.accent,
        letterSpacing: "0.25em", marginBottom: 8,
      }}>
        WEEK COMPLETE
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{
          fontSize: "var(--card-num-size)",
          fontWeight: 900, color: theme.accent,
          lineHeight: 0.85, letterSpacing: theme.headerLetterSpacing,
          fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
        }}>
          {total}
        </div>
        <div style={{
          fontSize: "var(--card-title-size)",
          fontWeight: 900, color: theme.text,
          lineHeight: 0.95, letterSpacing: theme.headerLetterSpacing,
          textTransform: "uppercase", marginTop: 4,
        }}>
          TOTAL SESSIONS
        </div>

        {/* Trend */}
        {trendLabel && (
          <div style={{
            display: "inline-block",
            marginTop: 12, padding: "5px 12px",
            background: vs!.sessionsPct >= 0 ? theme.accent : `${theme.accent3}33`,
            color: vs!.sessionsPct >= 0 ? (theme.bgBottom === "#0A0A0A" ? "#0A0A0A" : theme.bgBottom) : theme.text,
            fontSize: 12, fontWeight: 900, letterSpacing: "0.04em",
            alignSelf: "flex-start", borderRadius: 4,
          }}>
            {vs!.sessionsPct >= 0 ? "↗" : "↘"} {trendLabel}
          </div>
        )}

        {/* Last week comparison */}
        {vs && (
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <StatChip value={`${total}`} label="THIS WEEK" theme={theme} />
            <StatChip value={`${vs.lastWeekSessions}`} label="LAST WEEK" theme={theme} />
          </div>
        )}

        {/* Most active day callout */}
        {recap.mostActiveDay && (
          <div style={{
            marginTop: 18, padding: "12px 14px",
            background: `${theme.accent}15`,
            border: `1.5px solid ${theme.accent}55`,
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: theme.accent, letterSpacing: "0.18em" }}>
              MOST ACTIVE DAY
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: theme.text, marginTop: 3 }}>
              {recap.mostActiveDay.label} — {recap.mostActiveDay.sessions} sessions
            </div>
          </div>
        )}

        {/* Signoff */}
        <div style={{
          marginTop: 24,
          fontSize: 22, fontWeight: 900, color: theme.text,
          letterSpacing: theme.headerLetterSpacing,
          fontStyle: theme.numberStyle === "italic" ? "italic" : "normal",
        }}>
          {signoff}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: "center", paddingTop: 14,
        borderTop: `2px solid ${theme.accent3}33`,
      }}>
        {username && (
          <div style={{ fontSize: 14, fontWeight: 900, color: theme.text, marginBottom: 4 }}>
            @{username}
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 900, color: theme.accent, letterSpacing: "0.2em" }}>
          LIVELEEAPP.COM
        </div>
      </div>
    </CardFrame>
  );
}

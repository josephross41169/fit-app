// lib/rivalPrompts.ts
// ─────────────────────────────────────────────────────────────────────────────
// Two pools of get-to-know-you prompts shown on the compete tabs. The point of
// the rivalry/couples features is healthy competition AND meeting people — so
// each side answers a few prompts that show up on the matchup card.
//
// We show 3 at a time. Answers are stored keyed by prompt id, so over multiple
// challenges the asker surfaces the *next* unanswered prompts — cycling through
// the whole pool without ever asking all 40 at once.
// ─────────────────────────────────────────────────────────────────────────────

export interface Prompt {
  id: string;   // stable id (never reuse/renumber — answers are keyed to it)
  text: string;
}

// ── Individual rival prompts — about YOU as a competitor/person ──────────────
export const RIVAL_PROMPTS: Prompt[] = [
  { id: "r01", text: "My go-to hype song before a workout" },
  { id: "r02", text: "The workout I'd never skip" },
  { id: "r03", text: "My guilty-pleasure cheat meal" },
  { id: "r04", text: "What got me into fitness" },
  { id: "r05", text: "My biggest fitness goal right now" },
  { id: "r06", text: "Morning workout or night owl?" },
  { id: "r07", text: "The exercise I secretly hate" },
  { id: "r08", text: "My hidden talent outside the gym" },
  { id: "r09", text: "If I win this rivalry, I'm treating myself to…" },
  { id: "r10", text: "My trash-talk level, 1–10" },
  { id: "r11", text: "The sport I played growing up" },
  { id: "r12", text: "Coffee, pre-workout, or neither?" },
  { id: "r13", text: "My longest streak ever" },
  { id: "r14", text: "Something most people don't know about me" },
  { id: "r15", text: "My favorite way to recover" },
  { id: "r16", text: "A city I'd love to run a race in" },
  { id: "r17", text: "My biggest fitness pet peeve" },
  { id: "r18", text: "Gym buddy or solo grinder?" },
  { id: "r19", text: "My current obsession (show/song/snack)" },
  { id: "r20", text: "What keeps me consistent" },
  { id: "r21", text: "My most embarrassing gym moment" },
  { id: "r22", text: "The one machine I always go to" },
  { id: "r23", text: "My ideal rest-day activity" },
  { id: "r24", text: "A fitness myth I used to believe" },
  { id: "r25", text: "My weekend usually looks like…" },
  { id: "r26", text: "The emoji that describes my training" },
  { id: "r27", text: "My favorite post-workout meal" },
  { id: "r28", text: "The goal that scares me a little" },
  { id: "r29", text: "My workout playlist genre" },
  { id: "r30", text: "How I celebrate a PR" },
  { id: "r31", text: "My biggest non-fitness passion" },
  { id: "r32", text: "Where I see my fitness in a year" },
  { id: "r33", text: "My personal motto" },
  { id: "r34", text: "The teammate quality I value most" },
  { id: "r35", text: "My idea of a perfect active day" },
  { id: "r36", text: "Why I'm here on Livelee" },
  { id: "r37", text: "My spirit animal when I compete" },
  { id: "r38", text: "What I want a rival to know about me" },
  { id: "r39", text: "The habit that changed my fitness most" },
  { id: "r40", text: "My hype level for this challenge, 1–10" },
];

// ── Couple prompts — about the TWO of you ────────────────────────────────────
export const COUPLE_PROMPTS: Prompt[] = [
  { id: "c01", text: "How we met (short version)" },
  { id: "c02", text: "Our first date was…" },
  { id: "c03", text: "Who said 'I love you' first" },
  { id: "c04", text: "Our couple superpower" },
  { id: "c05", text: "The workout we do together" },
  { id: "c06", text: "Who's the better cook" },
  { id: "c07", text: "Our go-to date night" },
  { id: "c08", text: "Who's more likely to skip leg day" },
  { id: "c09", text: "Our song" },
  { id: "c10", text: "The trip we'd take if money were no object" },
  { id: "c11", text: "Who's the early riser" },
  { id: "c12", text: "Our biggest shared goal this year" },
  { id: "c13", text: "Who wins most (friendly) arguments" },
  { id: "c14", text: "Our favorite way to be lazy together" },
  { id: "c15", text: "Who's more competitive" },
  { id: "c16", text: "A pet name nobody else knows" },
  { id: "c17", text: "Our dream Sunday" },
  { id: "c18", text: "Who's the planner, who's the chaos" },
  { id: "c19", text: "How we hype each other up" },
  { id: "c20", text: "Our couple motto" },
  { id: "c21", text: "Who'd survive longer in a zombie apocalypse" },
  { id: "c22", text: "The thing we always (lightly) disagree on" },
  { id: "c23", text: "Our proudest moment together" },
  { id: "c24", text: "Who texts back faster" },
  { id: "c25", text: "Our shared guilty pleasure" },
  { id: "c26", text: "Who's the gym motivator" },
  { id: "c27", text: "A habit we picked up from each other" },
  { id: "c28", text: "Our ideal vacation vibe" },
  { id: "c29", text: "Who's more likely to cry at a movie" },
  { id: "c30", text: "What we're competing for in this challenge" },
  { id: "c31", text: "Our favorite meal to share" },
  { id: "c32", text: "Who controls the thermostat" },
  { id: "c33", text: "The dream we're chasing together" },
  { id: "c34", text: "Who's the bigger foodie" },
  { id: "c35", text: "Our nickname as a duo" },
  { id: "c36", text: "The first thing we noticed about each other" },
  { id: "c37", text: "Who's louder at the gym" },
  { id: "c38", text: "Our relationship in 3 emojis" },
  { id: "c39", text: "What makes us a power couple" },
  { id: "c40", text: "Why we joined Livelee together" },
];

export type PromptAnswers = Record<string, string>;

/** The next `count` unanswered prompts from a pool, in order. When the pool is
 *  fully answered, returns []. This is what makes the asker "cycle" — each new
 *  challenge surfaces the next batch the user hasn't filled in yet. */
export function pickNextPrompts(pool: Prompt[], answers: PromptAnswers | null | undefined, count = 3): Prompt[] {
  const answered = answers || {};
  return pool.filter(p => !answered[p.id] || !String(answered[p.id]).trim()).slice(0, count);
}

/** All answered prompts (id → {text, answer}) for display, in pool order. */
export function answeredPrompts(pool: Prompt[], answers: PromptAnswers | null | undefined): { id: string; text: string; answer: string }[] {
  const a = answers || {};
  return pool
    .filter(p => a[p.id] && String(a[p.id]).trim())
    .map(p => ({ id: p.id, text: p.text, answer: String(a[p.id]).trim() }));
}

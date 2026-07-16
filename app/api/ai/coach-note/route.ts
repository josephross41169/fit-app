// app/api/ai/coach-note/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Private AI "coach's note" — one short observation per user per day, based on
// the last 7 days of activity logs INCLUDING the gaps (the user's insight:
// "you never log dinner" is more useful than anything about what IS logged).
//
// Follows the ai-food-scan route's patterns: server-side only, Anthropic key
// from env, service-role Supabase client, per-user daily cap. The cap here is
// structural — one note per user per day, cached in ai_notes — so the cost
// ceiling is (daily active users × ~$0.003).
//
// Privacy: notes are personal. The ai_notes table has an owner-only SELECT
// policy (see migration), and this route verifies the caller's JWT before
// generating or returning anything.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: NextRequest) {
  try {
    // ── Verify the caller: the bearer token must belong to a real user ──
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const userId = userData.user.id;

    // ── Cached note for today? Return it (structural 1/day cap) ──
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await admin
      .from("ai_notes")
      .select("content, created_at")
      .eq("user_id", userId)
      .eq("note_date", today)
      .maybeSingle();
    if (existing?.content) {
      return NextResponse.json({ note: existing.content, cached: true });
    }

    // ── Gather 7 days of logs — presence AND absence ──
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: logs } = await admin
      .from("activity_logs")
      .select("log_type, logged_at, meal_type, wellness_type, workout_type, workout_category")
      .eq("user_id", userId)
      .gte("logged_at", weekAgo.toISOString())
      .order("logged_at", { ascending: true });

    const rows = logs || [];
    if (rows.length === 0) {
      return NextResponse.json({ note: null, reason: "not-enough-data" });
    }

    // Compact factual summary — the model sees patterns, not raw rows.
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const workoutDays = new Set<string>();
    const mealTypes: Record<string, number> = {};
    const wellnessTypes: Record<string, number> = {};
    let workouts = 0, meals = 0, wellness = 0;
    for (const r of rows) {
      const d = new Date(r.logged_at);
      const dayKey = d.toISOString().slice(0, 10);
      if (r.log_type === "workout") { workouts++; workoutDays.add(dayKey); }
      if (r.log_type === "nutrition") { meals++; const mt = (r.meal_type || "unspecified").toLowerCase(); mealTypes[mt] = (mealTypes[mt] || 0) + 1; }
      if (r.log_type === "wellness") { wellness++; const wt = (r.wellness_type || "other").toLowerCase(); wellnessTypes[wt] = (wellnessTypes[wt] || 0) + 1; }
    }
    const missingMeals = ["breakfast", "lunch", "dinner"].filter(m => !mealTypes[m]);
    const restDays = 7 - workoutDays.size;

    const summary = [
      `Last 7 days: ${workouts} workouts across ${workoutDays.size} days (${restDays} rest days), ${meals} nutrition logs, ${wellness} wellness logs.`,
      `Meal types logged: ${Object.entries(mealTypes).map(([k, v]) => `${k}×${v}`).join(", ") || "none"}.`,
      missingMeals.length > 0 ? `Never logged: ${missingMeals.join(", ")}.` : `All meal types logged at least once.`,
      `Wellness: ${Object.entries(wellnessTypes).map(([k, v]) => `${k}×${v}`).join(", ") || "none"}.`,
      `Today is ${dayNames[new Date().getDay()]}.`,
    ].join(" ");

    if (!ANTHROPIC_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    // ── Generate — short, warm, observational; never prescriptive ──
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 200,
        system:
          "You are a friendly fitness companion writing ONE private note (2-3 sentences, max 60 words) on a user's weekly activity summary. Be warm and observational. Point out at most ONE pattern — especially gaps in LOGGING (e.g. dinners never logged makes their nutrition picture incomplete) — framed as a logging observation, never as a judgment about their eating or body. Never give medical, diet, or training prescriptions. Never mention calories, weight loss, or deficiency. No greetings, no sign-off, no emojis.",
        messages: [{ role: "user", content: summary }],
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return NextResponse.json({ error: `AI error: ${t.slice(0, 200)}` }, { status: 502 });
    }
    const aiJson = await aiRes.json();
    const note = (aiJson?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ").trim();
    if (!note) return NextResponse.json({ note: null, reason: "empty" });

    // Cache (upsert so a race can't duplicate)
    await admin.from("ai_notes").upsert({ user_id: userId, note_date: today, content: note }, { onConflict: "user_id,note_date" });

    return NextResponse.json({ note, cached: false });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown" }, { status: 500 });
  }
}

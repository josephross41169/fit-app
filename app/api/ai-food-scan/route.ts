// ── app/api/ai-food-scan/route.ts ───────────────────────────────────────────
// AI-powered food photo → nutrition estimate.
// Uses Claude Sonnet 4.5 Vision. Server-side only because the API key must
// not be in client bundles, and we need the service role to enforce caps.
//
// Caps (single source of truth — adjust ONLY here):
//   GLOBAL_MONTHLY_CAP_CENTS = 3000   ($30/month across all users)
//   PER_USER_DAILY_LIMIT     = 3      (per user, resets at UTC midnight)
//
// Cost model (rough overestimate to stay safe):
//   - ~1500 input tokens (image at default detail) + ~400 output tokens
//   - Sonnet 4.5: $3/M input + $15/M output ≈ $0.011 per scan
//   - $30 budget ≈ ~2700 scans/month max globally

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Run at request time. This route depends on per-request data (image upload,
// user identity, runtime env vars), so it can't be statically generated.
export const dynamic = "force-dynamic";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const GLOBAL_MONTHLY_CAP_CENTS = 3000;
const PER_USER_DAILY_LIMIT = 3;

// $3/M input, $15/M output for Sonnet 4.5 → cost in cents (always round up)
function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 300;
  const outputCost = (outputTokens / 1_000_000) * 1500;
  return Math.ceil(inputCost + outputCost);
}

export async function POST(req: NextRequest) {
  try {
    const { userId, imageBase64, mediaType } = await req.json();

    if (!userId || !imageBase64) {
      return NextResponse.json({ error: "Missing userId or imageBase64" }, { status: 400 });
    }
    if (!ANTHROPIC_KEY) {
      return NextResponse.json({ error: "AI scanning is not configured. Contact support." }, { status: 503 });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Cap check 1: per-user daily limit (UTC day) ──────────────────────
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const { count: userScansToday } = await admin
      .from("ai_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", "food_scan")
      .gte("created_at", startOfToday.toISOString());

    if ((userScansToday || 0) >= PER_USER_DAILY_LIMIT) {
      return NextResponse.json({
        error: "daily_limit",
        message: `You've used all ${PER_USER_DAILY_LIMIT} AI scans for today. Try again tomorrow, or log manually.`,
      }, { status: 429 });
    }

    // ── Cap check 2: global monthly budget ──────────────────────────────
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const { data: monthRows } = await admin
      .from("ai_usage_log")
      .select("cost_cents")
      .eq("feature", "food_scan")
      .gte("created_at", startOfMonth.toISOString());
    const monthSpentCents = (monthRows || []).reduce(
      (sum: number, r: any) => sum + (r.cost_cents || 0), 0
    );

    if (monthSpentCents >= GLOBAL_MONTHLY_CAP_CENTS) {
      return NextResponse.json({
        error: "monthly_cap",
        message: "AI scanning is at capacity for the month. Please log manually — the feature will be back next month.",
      }, { status: 429 });
    }

    // ── Call Claude Vision ───────────────────────────────────────────────
    // Sonnet is the right balance — Haiku misses items on busy plates,
    // Opus is overkill for this. Strict-JSON prompt so we can parse cleanly.
    const prompt = `You are analyzing a food photo to estimate its nutritional content.

Identify the food items visible, estimate portion sizes, and calculate nutrition. Be conservative — when uncertain about portion size, lean toward the average serving.

Respond with ONLY a JSON object in this exact shape (no prose, no markdown fences):
{
  "items": [
    { "name": "string", "portion": "string (e.g. '1 cup', '6 oz')", "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number }
  ],
  "totals": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number,
    "sugar_g": number,
    "sodium_mg": number
  },
  "confidence": "low" | "medium" | "high",
  "notes": "string (one short sentence about what you see)"
}

If the image does not show food, respond with: {"error":"no_food"}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      console.error("[ai-food-scan] Claude API error:", claudeRes.status, errBody);
      return NextResponse.json({ error: "AI service unavailable. Try again or log manually." }, { status: 502 });
    }

    const data = await claudeRes.json();
    const usage = data.usage || {};
    const inputTokens = usage.input_tokens || 1500;
    const outputTokens = usage.output_tokens || 400;
    const costCents = estimateCostCents(inputTokens, outputTokens);

    // Log usage even on parse failure — Claude billed us either way.
    await admin.from("ai_usage_log").insert({
      user_id: userId,
      feature: "food_scan",
      cost_cents: costCents,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });

    // Parse the model's JSON. Strip code fences defensively in case it added them.
    const text = data.content?.[0]?.text || "";
    let parsed: any = null;
    try {
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn("[ai-food-scan] could not parse model response:", text.slice(0, 200));
      return NextResponse.json({
        error: "parse_failed",
        message: "AI couldn't read this photo clearly. Try a closer or better-lit shot, or log manually.",
      }, { status: 502 });
    }

    if (parsed?.error === "no_food") {
      return NextResponse.json({
        error: "no_food",
        message: "We didn't see any food in that photo. Try again with the food clearly in frame.",
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      nutrition: parsed,
      quota: {
        scans_used_today: (userScansToday || 0) + 1,
        scans_remaining_today: PER_USER_DAILY_LIMIT - ((userScansToday || 0) + 1),
        daily_limit: PER_USER_DAILY_LIMIT,
      },
    });
  } catch (e: any) {
    console.error("[ai-food-scan] unexpected error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected server error" }, { status: 500 });
  }
}

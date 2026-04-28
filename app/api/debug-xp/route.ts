// app/api/debug-xp/route.ts
// Surfaces what the v2 level system actually sees for a user.
// Visit https://YOUR_APP/api/debug-xp?uid=USER_ID
// Default uid = Joey's. Delete this file after you're done debugging.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const uid = url.searchParams.get("uid") || "70e170ca-4428-4357-8e8e-410135fc3948";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);
  const isoDay = startOfDayUtc.toISOString();

  // 1. What level does the users table say?
  const { data: u, error: uErr } = await admin
    .from("users")
    .select("id, username, current_level, xp_in_level")
    .eq("id", uid)
    .single();

  // 2. What's in user_xp_log for the last 7 days?
  const { data: xpRows, error: xpErr } = await admin
    .from("user_xp_log")
    .select("category, xp_amount, awarded_at, award_date")
    .eq("user_id", uid)
    .order("awarded_at", { ascending: false })
    .limit(20);

  // 3. What activity logs exist for today (UTC)?
  const { data: todayLogs, error: tErr } = await admin
    .from("activity_logs")
    .select("id, log_type, workout_category, workout_type, wellness_type, logged_at, created_at")
    .eq("user_id", uid)
    .gte("created_at", isoDay)
    .order("created_at", { ascending: false });

  // 4. Anything in the last 36 hours that might be the run
  const last36h = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const { data: recentLogs } = await admin
    .from("activity_logs")
    .select("id, log_type, workout_category, workout_type, logged_at, created_at")
    .eq("user_id", uid)
    .gte("created_at", last36h)
    .order("created_at", { ascending: false });

  // 5. XP entries today specifically
  const { data: xpToday } = await admin
    .from("user_xp_log")
    .select("category, awarded_at, award_date")
    .eq("user_id", uid)
    .gte("awarded_at", isoDay);

  return NextResponse.json({
    user_id: uid,
    server_time_utc: new Date().toISOString(),
    start_of_day_utc: isoDay,
    user_row: u,
    user_row_error: uErr?.message || null,
    xp_log_recent: xpRows,
    xp_log_error: xpErr?.message || null,
    xp_log_today: xpToday,
    activity_logs_today: todayLogs,
    activity_logs_today_error: tErr?.message || null,
    activity_logs_last_36h: recentLogs,
  });
}

// app/api/debug-ai-env/route.ts
// Surfaces whether ANTHROPIC_API_KEY is reaching the deployed function.
// SAFE: never returns the key itself, only metadata.
// Delete this file after you've confirmed the issue is fixed.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY || "";
  return NextResponse.json({
    has_key: !!key,
    key_length: key.length,
    key_prefix: key ? key.slice(0, 7) : null,   // should be "sk-ant-"
    key_looks_valid: key.startsWith("sk-ant-"),
    has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    node_env: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV || null,  // "production" | "preview" | "development"
  });
}

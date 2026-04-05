-- ============================================================
-- FIT APP — Missing Columns Migration
-- Run this in Supabase SQL Editor
-- Adds columns that code uses but weren't in the original schema
-- ============================================================

-- ── USERS table — missing columns ──────────────────────────
alter table public.users
  add column if not exists city text,
  add column if not exists highlights jsonb default '[]'::jsonb,
  add column if not exists banner_position numeric default 50,
  add column if not exists avatar_position numeric default 50,
  add column if not exists favorite_brands jsonb default '[]'::jsonb;

-- ── ACTIVITY LOGS — missing wellness_emoji ─────────────────
alter table public.activity_logs
  add column if not exists wellness_emoji text;

-- ── Update the database types hint (for reference only) ────
-- highlights: string[] stored as jsonb array of URLs
-- favorite_brands: array of {name: string, emoji: string}
-- banner_position / avatar_position: 0-100 (vertical % for object-position)
-- wellness_emoji: emoji string for wellness log entries

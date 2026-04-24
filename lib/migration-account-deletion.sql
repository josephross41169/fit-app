-- ============================================================
-- FIT APP — Account Deletion (Soft Delete) Migration
-- Run in Supabase SQL Editor.
--
-- Apple Guideline 5.1.1(v) requires in-app account deletion since June 2022.
-- We soft-delete: anonymize PII but keep the row so:
--   - Foreign keys don't cascade and wipe their posts, messages, badges
--   - Their username stays reserved so nobody can impersonate them
--   - We can undelete within 30 days if they email us
--
-- After 30 days a scheduled job (separate) can hard-delete if desired.
-- ============================================================

alter table public.users
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_reason text;

-- Speed up "is this user deleted?" lookups in feed/search queries
create index if not exists users_deleted_at_idx
  on public.users (deleted_at)
  where deleted_at is not null;

-- A username reservation table so even after a hard delete nobody can
-- re-register the old handle. Separate from users so it survives account purges.
create table if not exists public.reserved_usernames (
  username text primary key,
  reserved_at timestamptz default now(),
  original_user_id uuid,
  reason text
);

-- RLS: only the service role reads/writes reserved_usernames.
-- Signup logic will check this table via the server API, not the client.
alter table public.reserved_usernames enable row level security;
-- No policies = no public access. Service-role bypasses RLS by design.

-- ── Verify with: ───────────────────────────────────────────
-- select column_name from information_schema.columns
-- where table_name = 'users' and column_name in ('deleted_at', 'deleted_reason');

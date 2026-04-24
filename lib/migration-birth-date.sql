-- ============================================================
-- FIT APP — Birth Date Column (Age Gating)
-- Run in Supabase SQL Editor.
--
-- Apple + COPPA require age verification at signup for social apps.
-- We collect birth_date (not age) so the value stays valid as time passes.
-- Column is nullable because existing users predate this field.
-- ============================================================

alter table public.users
  add column if not exists birth_date date;

-- Index for any future "min-age" audits (rare, but cheap insurance)
create index if not exists users_birth_date_idx
  on public.users (birth_date)
  where birth_date is not null;

-- ── Verify with: ───────────────────────────────────────────
-- select column_name from information_schema.columns
-- where table_name = 'users' and column_name = 'birth_date';

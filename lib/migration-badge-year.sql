-- ============================================================
-- FIT APP — Add year column to badges for yearly-stamped badges
-- Run this in Supabase SQL Editor
--
-- Enables badges like "2026 Birthday Workout" where the year is
-- part of the badge identity. Null for all non-yearly badges.
-- Existing rows untouched — year stays null for them.
-- ============================================================

alter table public.badges
  add column if not exists year int;

-- Allow multiple birthday-workout rows per user (one per year).
-- The existing unique(user_id, badge_id) would prevent that, so we
-- relax it to unique(user_id, badge_id, year) where year can be null.
-- Postgres treats nulls as distinct in unique constraints by default,
-- so this still prevents duplicate non-yearly badges.
do $$ begin
  if exists (
    select 1 from pg_constraint
    where conname = 'badges_user_id_badge_id_key'
  ) then
    alter table public.badges drop constraint badges_user_id_badge_id_key;
  end if;
end $$;

alter table public.badges
  add constraint badges_user_badge_year_key
  unique nulls not distinct (user_id, badge_id, year);

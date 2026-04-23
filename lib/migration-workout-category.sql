-- ============================================================
-- FIT APP — Workout Category + Source Migration
-- Run this in Supabase SQL Editor
--
-- Adds two new columns to activity_logs:
--
--   workout_category — standardized enum-like string (running, lifting, etc.)
--                      used by stats, badges, rivalries. Free-text workout_type
--                      still exists for the user-facing workout NAME ("Push Day A").
--
--   source           — how the log was created: 'manual' (entered by user),
--                      'fitbit', 'apple-watch', 'whoop', 'oura', 'garmin'.
--                      Lets future wearable integrations tag their own data
--                      without touching the form code.
--
-- Existing rows get backfilled by keyword-matching the old workout_type text.
-- ============================================================

-- ── 1. ADD COLUMNS ──────────────────────────────────────────────
alter table public.activity_logs
  add column if not exists workout_category text,
  add column if not exists source text default 'manual';

-- ── 2. BACKFILL workout_category FOR EXISTING WORKOUT ROWS ──────
-- Use loose keyword matching on the old workout_type free-text.
-- Order matters: first match wins, so more specific keywords should
-- come before more generic ones (e.g. "deadlift" before a generic lift check).
update public.activity_logs
set workout_category = case
  -- Running keywords
  when workout_type ilike '%run%'        then 'running'
  when workout_type ilike '%jog%'        then 'running'
  when workout_type ilike '%sprint%'     then 'running'
  when workout_type ilike '%5k%'         then 'running'
  when workout_type ilike '%10k%'        then 'running'
  when workout_type ilike '%marathon%'   then 'running'

  -- Walking
  when workout_type ilike '%walk%'       then 'walking'
  when workout_type ilike '%hike%'       then 'walking'

  -- Biking
  when workout_type ilike '%bike%'       then 'biking'
  when workout_type ilike '%cycl%'       then 'biking'
  when workout_type ilike '%spin%'       then 'biking'

  -- Swimming
  when workout_type ilike '%swim%'       then 'swimming'
  when workout_type ilike '%lap%'        then 'swimming'

  -- Rowing
  when workout_type ilike '%row%'        then 'rowing'
  when workout_type ilike '%erg%'        then 'rowing'

  -- Yoga / Pilates
  when workout_type ilike '%yoga%'       then 'yoga'
  when workout_type ilike '%pilates%'    then 'pilates'

  -- Boxing / Combat
  when workout_type ilike '%box%'        then 'boxing'
  when workout_type ilike '%mma%'        then 'boxing'
  when workout_type ilike '%muay%'       then 'boxing'
  when workout_type ilike '%kickbox%'    then 'boxing'
  when workout_type ilike '%martial%'    then 'boxing'
  when workout_type ilike '%bjj%'        then 'boxing'

  -- HIIT
  when workout_type ilike '%hiit%'       then 'hiit'
  when workout_type ilike '%tabata%'     then 'hiit'
  when workout_type ilike '%circuit%'    then 'hiit'
  when workout_type ilike '%crossfit%'   then 'hiit'

  -- Sports
  when workout_type ilike '%basketball%' then 'sports'
  when workout_type ilike '%soccer%'     then 'sports'
  when workout_type ilike '%football%'   then 'sports'
  when workout_type ilike '%tennis%'     then 'sports'
  when workout_type ilike '%volley%'     then 'sports'
  when workout_type ilike '%baseball%'   then 'sports'
  when workout_type ilike '%hockey%'     then 'sports'
  when workout_type ilike '%golf%'       then 'sports'
  when workout_type ilike '%pickleball%' then 'sports'

  -- Lifting — any common lifting keyword (checked last so running/sports keywords win)
  when workout_type ilike '%lift%'        then 'lifting'
  when workout_type ilike '%deadlift%'    then 'lifting'
  when workout_type ilike '%squat%'       then 'lifting'
  when workout_type ilike '%bench%'       then 'lifting'
  when workout_type ilike '%press%'       then 'lifting'
  when workout_type ilike '%chest%'       then 'lifting'
  when workout_type ilike '%back day%'    then 'lifting'
  when workout_type ilike '%leg day%'     then 'lifting'
  when workout_type ilike '%push day%'    then 'lifting'
  when workout_type ilike '%pull day%'    then 'lifting'
  when workout_type ilike '%arm%'         then 'lifting'
  when workout_type ilike '%shoulder%'    then 'lifting'
  when workout_type ilike '%glute%'       then 'lifting'

  -- Rows with exercises[] filled out but no keyword match → likely lifting
  when exercises is not null and jsonb_array_length(exercises) > 0 then 'lifting'

  -- Rows with cardio.miles → likely some kind of cardio (guess running)
  when cardio is not null and (cardio->0->>'miles')::numeric > 0 then 'running'

  -- Give up
  else 'other'
end
where log_type = 'workout'
  and workout_category is null;

-- ── 3. SET DEFAULT source='manual' FOR EXISTING ROWS ────────────
-- (The `default 'manual'` only applies to new inserts; existing rows are still null.)
update public.activity_logs
set source = 'manual'
where source is null;

-- ── 4. INDEXES FOR STATS QUERIES ────────────────────────────────
create index if not exists activity_logs_workout_category_idx
  on public.activity_logs(user_id, workout_category)
  where log_type = 'workout';

create index if not exists activity_logs_source_idx
  on public.activity_logs(user_id, source);

-- ── 5. UPDATE RIVALRY SCORING FUNCTION ──────────────────────────
-- The original compute_rivalry_score() in migration-rivalries.sql queried
-- activity_logs by `workout_type = 'running'`. Now it needs to use
-- `workout_category = 'running'` for reliable matching.
create or replace function public.compute_rivalry_score(
  uid uuid,
  p_category text,
  p_metric text,
  p_from timestamptz,
  p_to timestamptz
) returns numeric
language plpgsql
stable
as $$
declare
  result numeric;
begin
  -- RUNNING
  if p_category = 'running' then
    if p_metric = 'most_miles' then
      select coalesce(sum((c->>'miles')::numeric), 0) into result
      from public.activity_logs,
           jsonb_array_elements(coalesce(cardio, '[]'::jsonb)) c
      where user_id = uid and log_type = 'workout' and workout_category = 'running'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'fastest_mile' then
      select case when min((c->>'pace_min_per_mile')::numeric) is null then 0
                  else 1000 - min((c->>'pace_min_per_mile')::numeric) end into result
      from public.activity_logs,
           jsonb_array_elements(coalesce(cardio, '[]'::jsonb)) c
      where user_id = uid and log_type = 'workout' and workout_category = 'running'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'longest_run' then
      select coalesce(max((c->>'miles')::numeric), 0) into result
      from public.activity_logs,
           jsonb_array_elements(coalesce(cardio, '[]'::jsonb)) c
      where user_id = uid and log_type = 'workout' and workout_category = 'running'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_runs' then
      select count(*)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_category = 'running'
        and logged_at >= p_from and logged_at < p_to;
    end if;

  -- LIFTING
  elsif p_category = 'lifting' then
    if p_metric = 'most_volume' then
      select coalesce(sum(
        (select sum((s->>'weight')::numeric * (s->>'reps')::numeric)
         from jsonb_array_elements(coalesce(exercises, '[]'::jsonb)) e,
              jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) s)
      ), 0) into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_category = 'lifting'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_sessions' then
      select count(*)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_category = 'lifting'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric in ('1rm_bench','1rm_squat','1rm_deadlift') then
      select coalesce(max((s->>'weight')::numeric), 0) into result
      from public.activity_logs,
           jsonb_array_elements(coalesce(exercises, '[]'::jsonb)) e,
           jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) s
      where user_id = uid and log_type = 'workout' and workout_category = 'lifting'
        and logged_at >= p_from and logged_at < p_to
        and lower(e->>'name') like case p_metric
          when '1rm_bench'    then '%bench%'
          when '1rm_squat'    then '%squat%'
          when '1rm_deadlift' then '%deadlift%'
        end;
    end if;

  -- WALKING / BIKING / SWIMMING — generic distance/session-based metrics
  elsif p_category in ('walking','biking','swimming') then
    if p_metric = 'most_miles' or p_metric = 'most_distance' then
      select coalesce(sum((c->>'miles')::numeric), 0) into result
      from public.activity_logs,
           jsonb_array_elements(coalesce(cardio, '[]'::jsonb)) c
      where user_id = uid and log_type = 'workout' and workout_category = p_category
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_sessions' then
      select count(*)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_category = p_category
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_steps' and p_category = 'walking' then
      select coalesce(sum((c->>'steps')::numeric), 0) into result
      from public.activity_logs,
           jsonb_array_elements(coalesce(cardio, '[]'::jsonb)) c
      where user_id = uid and log_type = 'workout' and workout_category = 'walking'
        and logged_at >= p_from and logged_at < p_to;
    end if;

  -- COMBAT (boxing)
  elsif p_category = 'combat' then
    if p_metric = 'most_rounds' then
      select coalesce(sum((c->>'rounds')::numeric), 0) into result
      from public.activity_logs,
           jsonb_array_elements(coalesce(cardio, '[]'::jsonb)) c
      where user_id = uid and log_type = 'workout' and workout_category = 'boxing'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_sessions' then
      select count(*)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_category = 'boxing'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_minutes' then
      select coalesce(sum(workout_duration_min), 0)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_category = 'boxing'
        and logged_at >= p_from and logged_at < p_to;
    end if;

  -- WELLNESS — still reads from log_type='wellness', unchanged
  elsif p_category = 'wellness' then
    if p_metric = 'most_sessions' then
      select count(*)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'wellness'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_minutes' then
      select coalesce(sum(wellness_duration_min), 0)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'wellness'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'longest_session' then
      select coalesce(max(wellness_duration_min), 0)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'wellness'
        and logged_at >= p_from and logged_at < p_to;
    end if;
  end if;

  return coalesce(result, 0);
end;
$$;

-- ── DONE ───────────────────────────────────────────────────────
-- Quick verification:
--   select workout_category, count(*) from activity_logs
--   where log_type = 'workout' group by workout_category;
--
-- Expected: your existing rows sorted into 'lifting', 'other', etc.

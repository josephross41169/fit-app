-- ============================================================
-- FIT APP — Backfill 8-Tier Wellness & Nutrition Badges
-- Run ONCE in Supabase SQL Editor after deploying the new badge ladder.
--
-- Why: We added 8-tier progression ladders for all wellness activities
-- (sauna, breathwork, cold plunge, yoga, meditation, stretching, walking,
-- total wellness) and for nutrition logs. Users who already logged these
-- activities won't automatically get the new tier badges until they log
-- again, so this script retroactively awards them based on current counts.
--
-- Safe to re-run: every insert uses `on conflict do nothing` so existing
-- badge rows are untouched.
-- ============================================================

-- ── SAUNA ─────────────────────────────────────────────────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'first-sauna' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%sauna%'
  group by user_id
) t where t.c >= 1
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'sauna-5' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%sauna%' group by user_id
) t where t.c >= 5
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'sauna-20' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%sauna%' group by user_id
) t where t.c >= 20
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'sauna-50' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%sauna%' group by user_id
) t where t.c >= 50
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'sauna-100' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%sauna%' group by user_id
) t where t.c >= 100
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'sauna-200' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%sauna%' group by user_id
) t where t.c >= 200
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'sauna-500' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%sauna%' group by user_id
) t where t.c >= 500
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'sauna-1000' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%sauna%' group by user_id
) t where t.c >= 1000
on conflict (user_id, badge_id, year) do nothing;

-- ── COLD PLUNGE ───────────────────────────────────────────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'first-cold-plunge' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and (wellness_type ilike '%cold%' or wellness_type ilike '%ice%' or wellness_type ilike '%plunge%')
  group by user_id
) t where t.c >= 1
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'cold-plunge-5' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and (wellness_type ilike '%cold%' or wellness_type ilike '%ice%' or wellness_type ilike '%plunge%') group by user_id
) t where t.c >= 5
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'cold-plunge-20' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and (wellness_type ilike '%cold%' or wellness_type ilike '%ice%' or wellness_type ilike '%plunge%') group by user_id
) t where t.c >= 20
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'cold-plunge-50' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and (wellness_type ilike '%cold%' or wellness_type ilike '%ice%' or wellness_type ilike '%plunge%') group by user_id
) t where t.c >= 50
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'cold-plunge-100' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and (wellness_type ilike '%cold%' or wellness_type ilike '%ice%' or wellness_type ilike '%plunge%') group by user_id
) t where t.c >= 100
on conflict (user_id, badge_id, year) do nothing;

-- ── MEDITATION ────────────────────────────────────────────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'first-meditation' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%meditat%' group by user_id
) t where t.c >= 1
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'meditation-5' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%meditat%' group by user_id
) t where t.c >= 5
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'meditation-10' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%meditat%' group by user_id
) t where t.c >= 20
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'meditation-50' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%meditat%' group by user_id
) t where t.c >= 50
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'meditation-100' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%meditat%' group by user_id
) t where t.c >= 100
on conflict (user_id, badge_id, year) do nothing;

-- ── BREATHWORK ────────────────────────────────────────────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'first-breathwork' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%breath%' group by user_id
) t where t.c >= 1
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'breathwork-5' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%breath%' group by user_id
) t where t.c >= 5
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'breathwork-20' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%breath%' group by user_id
) t where t.c >= 20
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'breathwork-50' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%breath%' group by user_id
) t where t.c >= 50
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'breathwork-100' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%breath%' group by user_id
) t where t.c >= 100
on conflict (user_id, badge_id, year) do nothing;

-- ── STRETCHING ────────────────────────────────────────────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'first-stretch' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%stretch%' group by user_id
) t where t.c >= 1
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'stretch-5' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%stretch%' group by user_id
) t where t.c >= 5
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'stretch-20' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%stretch%' group by user_id
) t where t.c >= 20
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'stretch-50' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%stretch%' group by user_id
) t where t.c >= 50
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'stretch-100' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' and wellness_type ilike '%stretch%' group by user_id
) t where t.c >= 100
on conflict (user_id, badge_id, year) do nothing;

-- ── YOGA (moved to workout category — same workflow) ─────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'yoga-5' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'workout' and workout_category = 'yoga' group by user_id
) t where t.c >= 5
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'yoga-10' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'workout' and workout_category = 'yoga' group by user_id
) t where t.c >= 20
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'yoga-50' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'workout' and workout_category = 'yoga' group by user_id
) t where t.c >= 50
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'yoga-100' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'workout' and workout_category = 'yoga' group by user_id
) t where t.c >= 100
on conflict (user_id, badge_id, year) do nothing;

-- ── WALKING (workout category) ────────────────────────────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'walks-5' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'workout' and workout_category = 'walking' group by user_id
) t where t.c >= 5
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'walks-20' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'workout' and workout_category = 'walking' group by user_id
) t where t.c >= 20
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'walks-50' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'workout' and workout_category = 'walking' group by user_id
) t where t.c >= 50
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'walks-100' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'workout' and workout_category = 'walking' group by user_id
) t where t.c >= 100
on conflict (user_id, badge_id, year) do nothing;

-- ── TOTAL WELLNESS ─────────────────────────────────────────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'wellness-1' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' group by user_id
) t where t.c >= 1
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'wellness-5' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' group by user_id
) t where t.c >= 5
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'wellness-20' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' group by user_id
) t where t.c >= 20
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'wellness-50' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' group by user_id
) t where t.c >= 50
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'wellness-100' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'wellness' group by user_id
) t where t.c >= 100
on conflict (user_id, badge_id, year) do nothing;

-- ── NUTRITION LOGS ─────────────────────────────────────────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'nutrition-5' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'nutrition' group by user_id
) t where t.c >= 5
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'nutrition-20' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'nutrition' group by user_id
) t where t.c >= 20
on conflict (user_id, badge_id, year) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'nutrition-50' from (
  select user_id, count(*) as c from public.activity_logs
  where log_type = 'nutrition' group by user_id
) t where t.c >= 50
on conflict (user_id, badge_id, year) do nothing;

-- ── Verify with: ─────────────────────────────────────────────────────
-- select badge_id, count(*) from public.badges
-- where badge_id ilike 'sauna-%' or badge_id ilike 'cold-plunge-%'
--   or badge_id ilike 'breathwork-%' or badge_id ilike 'meditation-%'
--   or badge_id ilike 'stretch-%' or badge_id ilike 'walks-%'
--   or badge_id ilike 'wellness-%' or badge_id ilike 'yoga-%'
--   or badge_id ilike 'nutrition-%'
-- group by badge_id order by badge_id;

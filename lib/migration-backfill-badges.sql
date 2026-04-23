-- ============================================================
-- FIT APP — Backfill missing badges based on existing activity
-- Run this ONCE in Supabase SQL Editor after deploying the
-- workout_category migration.
--
-- Scans every user's activity_logs and inserts any missing
-- badge rows. Existing badges are not touched (upsert with
-- ON CONFLICT DO NOTHING).
-- ============================================================

-- ── Total workouts (1 / 10 / 25 / 50 / 100 / 200 / 500 / 1000) ──
insert into public.badges (user_id, badge_id)
select user_id, badge_id from (
  select a.user_id,
    case
      when count(*) >= 1000 then '1000-workouts'
      when count(*) >= 500  then '500-workouts'
      when count(*) >= 200  then 'centurion-2x'
      when count(*) >= 100  then 'centurion'
      when count(*) >= 50   then 'centurion-half'
      when count(*) >= 25   then 'workouts-25'
      when count(*) >= 10   then 'workouts-10'
      when count(*) >= 1    then 'first-workout'
    end as badge_id
  from public.activity_logs a
  where a.log_type = 'workout'
  group by a.user_id
) t where t.badge_id is not null
on conflict (user_id, badge_id) do nothing;

-- Also insert EVERY lower-tier badge the user qualifies for
-- (the query above only picks the highest, but all lower ones
--  should also be granted). Loop via generate_series over thresholds.
do $$
declare
  tiers int[] := array[1,10,25,50,100,200,500,1000];
  ids   text[] := array['first-workout','workouts-10','workouts-25','centurion-half','centurion','centurion-2x','500-workouts','1000-workouts'];
  i int;
begin
  for i in 1..array_length(tiers,1) loop
    insert into public.badges (user_id, badge_id)
    select user_id, ids[i] from public.activity_logs
    where log_type = 'workout'
    group by user_id
    having count(*) >= tiers[i]
    on conflict (user_id, badge_id) do nothing;
  end loop;
end $$;

-- ── Running (uses new workout_category) ────────────────────
do $$
declare
  tiers int[] := array[1,5,20,50,100,200,500,1000];
  ids   text[] := array['first-run','runs-5','runs-20','runs-50','runs-100','runs-200','runs-500','runs-1000'];
  i int;
begin
  for i in 1..array_length(tiers,1) loop
    insert into public.badges (user_id, badge_id)
    select user_id, ids[i] from public.activity_logs
    where log_type = 'workout' and workout_category = 'running'
    group by user_id
    having count(*) >= tiers[i]
    on conflict (user_id, badge_id) do nothing;
  end loop;
end $$;

-- ── Lifting (uses new workout_category) ────────────────────
do $$
declare
  tiers int[] := array[1,10,25,50,100,200,500,1000];
  ids   text[] := array['first-lift','lifts-10','lifts-25','lifts-50','lifts-100','lifts-200','lifts-500','lifts-1000'];
  i int;
begin
  for i in 1..array_length(tiers,1) loop
    insert into public.badges (user_id, badge_id)
    select user_id, ids[i] from public.activity_logs
    where log_type = 'workout' and workout_category = 'lifting'
    group by user_id
    having count(*) >= tiers[i]
    on conflict (user_id, badge_id) do nothing;
  end loop;
end $$;

-- ── Yoga (now a workout category) ──────────────────────────
do $$
declare
  tiers int[] := array[1,10,30,100];
  ids   text[] := array['first-yoga','yoga-10','yoga-lover','yoga-queen'];
  i int;
begin
  for i in 1..array_length(tiers,1) loop
    insert into public.badges (user_id, badge_id)
    select user_id, ids[i] from public.activity_logs
    where log_type = 'workout' and workout_category = 'yoga'
    group by user_id
    having count(*) >= tiers[i]
    on conflict (user_id, badge_id) do nothing;
  end loop;
end $$;

-- ── Walking (now a workout category) ───────────────────────
do $$
declare
  tiers int[] := array[1,10,50];
  ids   text[] := array['first-walk','nature-walk','walks-50'];
  i int;
begin
  for i in 1..array_length(tiers,1) loop
    insert into public.badges (user_id, badge_id)
    select user_id, ids[i] from public.activity_logs
    where log_type = 'workout' and workout_category = 'walking'
    group by user_id
    having count(*) >= tiers[i]
    on conflict (user_id, badge_id) do nothing;
  end loop;
end $$;

-- ── Wellness: Cold Plunge / Ice Bath ───────────────────────
do $$
declare
  tiers int[] := array[1,5,20,50];
  ids   text[] := array['first-cold-plunge','ice-bath','cold-plunge-20','ice-warrior'];
  i int;
begin
  for i in 1..array_length(tiers,1) loop
    insert into public.badges (user_id, badge_id)
    select user_id, ids[i] from public.activity_logs
    where log_type = 'wellness'
      and (wellness_type ilike 'cold%' or wellness_type ilike 'ice%' or wellness_type ilike '%plunge%')
    group by user_id
    having count(*) >= tiers[i]
    on conflict (user_id, badge_id) do nothing;
  end loop;
end $$;

-- ── Wellness: Sauna ────────────────────────────────────────
do $$
declare
  tiers int[] := array[1,10,30];
  ids   text[] := array['first-sauna','sauna','sauna-30'];
  i int;
begin
  for i in 1..array_length(tiers,1) loop
    insert into public.badges (user_id, badge_id)
    select user_id, ids[i] from public.activity_logs
    where log_type = 'wellness' and wellness_type ilike 'sauna'
    group by user_id
    having count(*) >= tiers[i]
    on conflict (user_id, badge_id) do nothing;
  end loop;
end $$;

-- ── Wellness: Meditation ───────────────────────────────────
do $$
declare
  tiers int[] := array[1,10,30];
  ids   text[] := array['first-meditation','meditation-10','meditation-master'];
  i int;
begin
  for i in 1..array_length(tiers,1) loop
    insert into public.badges (user_id, badge_id)
    select user_id, ids[i] from public.activity_logs
    where log_type = 'wellness' and wellness_type ilike 'meditation'
    group by user_id
    having count(*) >= tiers[i]
    on conflict (user_id, badge_id) do nothing;
  end loop;
end $$;

-- ── Wellness: Breathwork ───────────────────────────────────
do $$
declare
  tiers int[] := array[1,10,30];
  ids   text[] := array['first-breathwork','breathwork','breathwork-30'];
  i int;
begin
  for i in 1..array_length(tiers,1) loop
    insert into public.badges (user_id, badge_id)
    select user_id, ids[i] from public.activity_logs
    where log_type = 'wellness' and wellness_type ilike 'breathwork'
    group by user_id
    having count(*) >= tiers[i]
    on conflict (user_id, badge_id) do nothing;
  end loop;
end $$;

-- ── Total wellness ─────────────────────────────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'wellness-10' from public.activity_logs
where log_type = 'wellness' group by user_id having count(*) >= 10
on conflict (user_id, badge_id) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, 'wellness-50' from public.activity_logs
where log_type = 'wellness' group by user_id having count(*) >= 50
on conflict (user_id, badge_id) do nothing;

-- ── Nutrition ──────────────────────────────────────────────
do $$
declare
  tiers int[] := array[1,7,14,100];
  ids   text[] := array['first-nutrition-log','nutrition-week','nutrition-pro','nutrition-100'];
  i int;
begin
  for i in 1..array_length(tiers,1) loop
    insert into public.badges (user_id, badge_id)
    select user_id, ids[i] from public.activity_logs
    where log_type = 'nutrition'
    group by user_id
    having count(*) >= tiers[i]
    on conflict (user_id, badge_id) do nothing;
  end loop;
end $$;

-- ── Posts ──────────────────────────────────────────────────
insert into public.badges (user_id, badge_id)
select user_id, 'first-post' from public.posts group by user_id having count(*) >= 1
on conflict (user_id, badge_id) do nothing;

insert into public.badges (user_id, badge_id)
select user_id, '10-posts' from public.posts group by user_id having count(*) >= 10
on conflict (user_id, badge_id) do nothing;

-- ── Verify with: ───────────────────────────────────────────
-- select badge_id, count(*) from badges group by badge_id order by count desc;

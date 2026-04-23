-- ============================================================
-- FIT APP — Rivalry System Migration
-- Run this in Supabase SQL Editor
--
-- Creates the 1v1 weekly rivalry system:
--   • 7-day duration, no cancel, no early drop
--   • One active rivalry per user across all categories
--   • Category + competition type + tier matchmaking
--   • Per-rivalry badges (first-to-earn locks it)
--   • Rivalry-scoped chat with photo blur support
--
-- Depends on: schema.sql (users, activity_logs, messages-schema.sql)
-- ============================================================


-- ── 1. RIVALRIES ───────────────────────────────────────────────
-- The main pairing. One row per 1v1 matchup. Always symmetric
-- (user_a_id / user_b_id ordering is just insert order, no semantics).
-- Status lifecycle:
--   pending   → someone queued but no match yet (queue rows only, see table 2)
--   active    → matched, 7-day clock running
--   completed → week ended, winner recorded
--   cancelled → week ended with zero activity from both → no W/L
create table if not exists public.rivalries (
  id uuid default uuid_generate_v4() primary key,
  user_a_id uuid references public.users(id) on delete cascade not null,
  user_b_id uuid references public.users(id) on delete cascade not null,

  -- What you're competing in
  category text not null check (category in (
    'running','walking','biking','lifting','swimming','combat','wellness'
  )),
  competition_type text not null, -- e.g. 'fastest_mile', 'most_miles', '1rm_bench'
  tier text not null check (tier in ('beginner','intermediate','mayhem')),

  -- Lifecycle
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  started_at timestamptz default now() not null,
  ends_at    timestamptz not null, -- started_at + 7 days, enforced at insert time
  resolved_at timestamptz,         -- set when status transitions to completed/cancelled

  -- Final scores (filled in when resolved)
  user_a_score numeric,
  user_b_score numeric,
  winner_id uuid references public.users(id) on delete set null, -- null if cancelled

  -- Placeholder for future sponsor prize system. Unused for now.
  prize_description text,

  created_at timestamptz default now(),

  -- Don't allow a rivalry with yourself
  check (user_a_id <> user_b_id)
);

-- Fast lookup: "what's my active rivalry?"
create index if not exists rivalries_active_user_a_idx
  on public.rivalries(user_a_id) where status = 'active';
create index if not exists rivalries_active_user_b_idx
  on public.rivalries(user_b_id) where status = 'active';

-- Fast lookup: "find rivalries that need resolving"
create index if not exists rivalries_ends_at_idx
  on public.rivalries(ends_at) where status = 'active';


-- ── 2. MATCHMAKING QUEUE ───────────────────────────────────────
-- A user waiting for someone to match their exact pick.
-- When a new row is inserted, a trigger looks for an existing row with
-- the same category + competition_type + tier. If found: create a rivalry
-- and delete both queue entries.
create table if not exists public.rivalry_queue (
  user_id uuid references public.users(id) on delete cascade primary key,
  category text not null check (category in (
    'running','walking','biking','lifting','swimming','combat','wellness'
  )),
  competition_type text not null,
  tier text not null check (tier in ('beginner','intermediate','mayhem')),
  queued_at timestamptz default now()
);

create index if not exists rivalry_queue_match_idx
  on public.rivalry_queue(category, competition_type, tier);


-- ── 3. RIVALRY BADGES ──────────────────────────────────────────
-- Badges awarded within the context of a specific rivalry.
-- The unique constraint on (rivalry_id, badge_key) enforces the
-- "one person per badge per rivalry" rule — first to earn it locks it.
create table if not exists public.rivalry_badges (
  id uuid default uuid_generate_v4() primary key,
  rivalry_id uuid references public.rivalries(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  badge_key text not null, -- e.g. 'early_bird', 'dominant', 'first_blood'
  earned_at timestamptz default now(),

  unique(rivalry_id, badge_key)
);

create index if not exists rivalry_badges_user_idx
  on public.rivalry_badges(user_id);


-- ── 4. RIVAL MESSAGES ──────────────────────────────────────────
-- Rivalry chat is its own table (not extending the existing messages
-- table) because the lifecycle is different: messages die when the
-- rivalry resolves. Keeping them separate avoids mixing rules.
create table if not exists public.rival_messages (
  id uuid default uuid_generate_v4() primary key,
  rivalry_id uuid references public.rivalries(id) on delete cascade not null,
  sender_id uuid references public.users(id) on delete cascade not null,
  content text,        -- null if photo-only
  photo_url text,      -- null if text-only
  is_blurred boolean default true, -- receiver sees blurred until they tap
  created_at timestamptz default now(),

  -- Must have either text or a photo
  check (content is not null or photo_url is not null)
);

create index if not exists rival_messages_rivalry_idx
  on public.rival_messages(rivalry_id, created_at);


-- ── RLS POLICIES ───────────────────────────────────────────────
alter table public.rivalries       enable row level security;
alter table public.rivalry_queue   enable row level security;
alter table public.rivalry_badges  enable row level security;
alter table public.rival_messages  enable row level security;

-- RIVALRIES: both participants can read; inserts/updates happen via
-- server-side functions (matchmaker + resolver), never direct client writes
create policy "Participants can view their rivalries"
  on public.rivalries for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- QUEUE: users manage only their own queue entry
create policy "Users can view own queue entry"
  on public.rivalry_queue for select using (auth.uid() = user_id);
create policy "Users can join queue"
  on public.rivalry_queue for insert with check (auth.uid() = user_id);
create policy "Users can leave queue"
  on public.rivalry_queue for delete using (auth.uid() = user_id);

-- RIVALRY BADGES: anyone participating in the rivalry can see them
create policy "Participants can view rivalry badges"
  on public.rivalry_badges for select
  using (exists (
    select 1 from public.rivalries r
    where r.id = rivalry_id
    and (auth.uid() = r.user_a_id or auth.uid() = r.user_b_id)
  ));

-- RIVAL MESSAGES: participants can read + send in their own rivalry
create policy "Participants can read rival messages"
  on public.rival_messages for select
  using (exists (
    select 1 from public.rivalries r
    where r.id = rivalry_id
    and (auth.uid() = r.user_a_id or auth.uid() = r.user_b_id)
  ));

create policy "Participants can send rival messages"
  on public.rival_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.rivalries r
      where r.id = rivalry_id
      and r.status = 'active'
      and (auth.uid() = r.user_a_id or auth.uid() = r.user_b_id)
    )
  );

-- Receiver can flip is_blurred to false (unblur a photo they received)
create policy "Receiver can unblur photos"
  on public.rival_messages for update
  using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.rivalries r
      where r.id = rivalry_id
      and (auth.uid() = r.user_a_id or auth.uid() = r.user_b_id)
    )
  )
  with check (is_blurred = false);


-- ── MATCHMAKING TRIGGER ────────────────────────────────────────
-- When a user joins the queue, look for a compatible waiting user.
-- If found: pair them into a rivalry + clean up both queue entries.
create or replace function public.try_match_rivalry()
returns trigger
language plpgsql
security definer
as $$
declare
  opponent_id uuid;
begin
  -- Reject if the joining user already has an active rivalry.
  -- (Also enforced at app layer, but defense in depth.)
  if exists (
    select 1 from public.rivalries
    where status = 'active'
    and (user_a_id = new.user_id or user_b_id = new.user_id)
  ) then
    raise exception 'User already has an active rivalry';
  end if;

  -- Find someone else waiting with identical pick
  select user_id into opponent_id
  from public.rivalry_queue
  where user_id <> new.user_id
    and category = new.category
    and competition_type = new.competition_type
    and tier = new.tier
  order by queued_at asc
  limit 1;

  -- No one waiting → stay in queue
  if opponent_id is null then
    return new;
  end if;

  -- Match found → create rivalry, remove both from queue
  insert into public.rivalries (
    user_a_id, user_b_id, category, competition_type, tier,
    status, started_at, ends_at
  ) values (
    opponent_id, new.user_id, new.category, new.competition_type, new.tier,
    'active', now(), now() + interval '7 days'
  );

  delete from public.rivalry_queue where user_id in (opponent_id, new.user_id);

  return null; -- cancel the original insert, we already handled both sides
end;
$$;

drop trigger if exists rivalry_matchmaker on public.rivalry_queue;
create trigger rivalry_matchmaker
  before insert on public.rivalry_queue
  for each row execute function public.try_match_rivalry();


-- ── RESOLVE EXPIRED RIVALRIES ──────────────────────────────────
-- Call this on a cron schedule (e.g. every 5 minutes via pg_cron or
-- a Supabase Edge Function) to close out rivalries whose ends_at has passed.
--
-- Scoring logic is driven off activity_logs filtered by category + the
-- competition_type's metric. The metric→column mapping lives here so it's
-- all in one place.
create or replace function public.resolve_expired_rivalries()
returns integer
language plpgsql
security definer
as $$
declare
  r record;
  score_a numeric;
  score_b numeric;
  resolved_count integer := 0;
begin
  for r in
    select * from public.rivalries
    where status = 'active' and ends_at <= now()
  loop
    -- Compute each user's score for this rivalry's competition_type
    score_a := public.compute_rivalry_score(r.user_a_id, r.category, r.competition_type, r.started_at, r.ends_at);
    score_b := public.compute_rivalry_score(r.user_b_id, r.category, r.competition_type, r.started_at, r.ends_at);

    -- Both zero → cancel, no W/L
    if (coalesce(score_a,0) = 0 and coalesce(score_b,0) = 0) then
      update public.rivalries
      set status = 'cancelled',
          resolved_at = now(),
          user_a_score = 0, user_b_score = 0
      where id = r.id;
    else
      -- Determine winner. Null winner = tie (both logged the same non-zero amount).
      update public.rivalries
      set status = 'completed',
          resolved_at = now(),
          user_a_score = coalesce(score_a, 0),
          user_b_score = coalesce(score_b, 0),
          winner_id = case
            when coalesce(score_a,0) > coalesce(score_b,0) then r.user_a_id
            when coalesce(score_b,0) > coalesce(score_a,0) then r.user_b_id
            else null
          end
      where id = r.id;
    end if;

    resolved_count := resolved_count + 1;
  end loop;

  return resolved_count;
end;
$$;


-- Score a single user for a single rivalry metric over a time window.
-- Extend this function as you add new competition_types.
-- Metrics are derived from activity_logs.
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
      select coalesce(sum((cardio->>'miles')::numeric), 0) into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = 'running'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'fastest_mile' then
      -- Lowest pace in minutes/mile wins; invert for "higher = better"
      select case when min((cardio->>'pace_min_per_mile')::numeric) is null then 0
                  else 1000 - min((cardio->>'pace_min_per_mile')::numeric) end into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = 'running'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'longest_run' then
      select coalesce(max((cardio->>'miles')::numeric), 0) into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = 'running'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_runs' then
      select count(*)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = 'running'
        and logged_at >= p_from and logged_at < p_to;
    end if;

  -- LIFTING
  elsif p_category = 'lifting' then
    if p_metric = 'most_volume' then
      -- Sum weight*reps across all exercises in the week
      select coalesce(sum(
        (select sum((s->>'weight')::numeric * (s->>'reps')::numeric)
         from jsonb_array_elements(coalesce(exercises, '[]'::jsonb)) e,
              jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) s)
      ), 0) into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = 'lifting'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_sessions' then
      select count(*)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = 'lifting'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric in ('1rm_bench','1rm_squat','1rm_deadlift') then
      -- Highest single weight for the target exercise (approximates 1RM
      -- via Epley could be added later; for now it's max observed weight).
      select coalesce(max((s->>'weight')::numeric), 0) into result
      from public.activity_logs,
           jsonb_array_elements(coalesce(exercises, '[]'::jsonb)) e,
           jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) s
      where user_id = uid and log_type = 'workout' and workout_type = 'lifting'
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
      select coalesce(sum((cardio->>'miles')::numeric), 0) into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = p_category
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_sessions' then
      select count(*)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = p_category
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_steps' and p_category = 'walking' then
      select coalesce(sum((cardio->>'steps')::numeric), 0) into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = 'walking'
        and logged_at >= p_from and logged_at < p_to;
    end if;

  -- COMBAT SPORTS
  elsif p_category = 'combat' then
    if p_metric = 'most_rounds' then
      select coalesce(sum((cardio->>'rounds')::numeric), 0) into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = 'combat'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_sessions' then
      select count(*)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = 'combat'
        and logged_at >= p_from and logged_at < p_to;
    elsif p_metric = 'most_minutes' then
      select coalesce(sum(workout_duration_min), 0)::numeric into result
      from public.activity_logs
      where user_id = uid and log_type = 'workout' and workout_type = 'combat'
        and logged_at >= p_from and logged_at < p_to;
    end if;

  -- WELLNESS
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


-- ── HELPER VIEW: user rivalry record ───────────────────────────
-- Easy way for the profile page to show "3-2 all-time".
create or replace view public.user_rivalry_records as
select
  u.id as user_id,
  count(*) filter (where r.status = 'completed' and r.winner_id = u.id) as wins,
  count(*) filter (where r.status = 'completed' and r.winner_id is not null and r.winner_id <> u.id) as losses,
  count(*) filter (where r.status = 'completed' and r.winner_id is null) as ties,
  count(*) filter (where r.status = 'cancelled') as cancelled,
  count(*) filter (where r.status = 'active') as active
from public.users u
left join public.rivalries r
  on u.id in (r.user_a_id, r.user_b_id)
group by u.id;


-- ── DONE ───────────────────────────────────────────────────────
-- After running this:
-- 1. Verify the tables exist:   select * from public.rivalries limit 1;
-- 2. Schedule resolve_expired_rivalries() to run every 5 minutes:
--    Option A: pg_cron (if enabled in Supabase)
--      select cron.schedule('resolve-rivalries', '*/5 * * * *',
--        $$select public.resolve_expired_rivalries()$$);
--    Option B: Supabase Edge Function on a scheduled trigger
-- 3. The app can now query/insert against rivalry_queue, rivalries,
--    rival_messages, and rivalry_badges.

-- ============================================================
-- FIT APP — Events System Migration
-- Run in Supabase SQL Editor.
--
-- Three tables:
--   events         — the events themselves
--   event_rsvps    — going / interested per user per event
--   event_comments — feed under each event (with threaded replies)
-- ============================================================

-- ── EVENTS ──────────────────────────────────────────────────────────────
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.users(id) on delete cascade not null,
  -- Optional: events tied to a group show up in that group's tab too.
  group_id uuid references public.groups(id) on delete set null,
  title text not null,
  description text,

  -- Two-level taxonomy. category required, subcategory optional. Both stored
  -- as strings (no enum) so we can add new types without migrations.
  -- See lib/eventCategories.ts for the canonical list the UI uses.
  category text not null,
  subcategory text,

  -- Time
  event_date timestamptz not null,
  end_date timestamptz,
  -- TBD events: just store a placeholder far-future date and flag it
  date_tbd boolean default false,

  -- Location
  location_name text,           -- "Bellagio Conservatory" or "Sunset Park"
  address text,                 -- full street address
  city text,                    -- "Las Vegas, NV" — used for filtering
  latitude double precision,    -- for future radius search
  longitude double precision,

  -- Pricing — text not numeric so users can write "Free", "$25", "$10–$50", etc.
  price text default 'Free',

  -- Media
  image_url text,

  -- Capacity (optional)
  max_attendees integer,

  -- Visibility — false = unlisted, true = shows in discover/feed
  is_public boolean default true,

  -- Source — tracks where the event came from for future auto-import.
  -- 'user' = manually created; 'eventbrite', 'meetup', etc. for imported.
  source text default 'user',
  external_url text,            -- for imported events, link back to source

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists events_event_date_idx on public.events(event_date desc);
create index if not exists events_city_idx on public.events(city);
create index if not exists events_category_idx on public.events(category);
create index if not exists events_creator_idx on public.events(creator_id);
create index if not exists events_group_idx on public.events(group_id) where group_id is not null;

-- ── RSVPS ───────────────────────────────────────────────────────────────
create table if not exists public.event_rsvps (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  -- 'going' = committed; 'interested' = soft maybe. No "not going" — that's
  -- just absence of an RSVP row.
  status text not null check (status in ('going','interested')),
  created_at timestamptz default now(),
  primary key (event_id, user_id)
);

create index if not exists event_rsvps_user_idx on public.event_rsvps(user_id);
create index if not exists event_rsvps_status_idx on public.event_rsvps(event_id, status);

-- ── COMMENTS ────────────────────────────────────────────────────────────
-- Same shape as post comments but for events. Threaded via parent_id.
create table if not exists public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  parent_id uuid references public.event_comments(id) on delete cascade,
  content text not null check (length(content) <= 2000),
  created_at timestamptz default now()
);

create index if not exists event_comments_event_idx on public.event_comments(event_id, created_at desc);
create index if not exists event_comments_parent_idx on public.event_comments(parent_id) where parent_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_comments enable row level security;

-- Public events visible to all logged-in users
create policy "Public events visible" on public.events
  for select using (is_public = true);

-- Creators can do anything with their own events
create policy "Creators manage own events" on public.events
  for all using (auth.uid() = creator_id);

-- Anyone can RSVP / view RSVPs
create policy "RSVPs visible" on public.event_rsvps for select using (true);
create policy "Users RSVP themselves" on public.event_rsvps
  for insert with check (auth.uid() = user_id);
create policy "Users update own RSVP" on public.event_rsvps
  for update using (auth.uid() = user_id);
create policy "Users delete own RSVP" on public.event_rsvps
  for delete using (auth.uid() = user_id);

-- Comments — anyone can read, only authors can mutate their own
create policy "Comments visible" on public.event_comments for select using (true);
create policy "Users post comments" on public.event_comments
  for insert with check (auth.uid() = user_id);
create policy "Users delete own comments" on public.event_comments
  for delete using (auth.uid() = user_id);

-- ── COUNT HELPERS ───────────────────────────────────────────────────────
-- Convenience views so the UI can fetch RSVP counts without aggregations.
create or replace view public.events_with_counts as
select
  e.*,
  coalesce((select count(*) from public.event_rsvps r where r.event_id = e.id and r.status = 'going'), 0) as going_count,
  coalesce((select count(*) from public.event_rsvps r where r.event_id = e.id and r.status = 'interested'), 0) as interested_count,
  coalesce((select count(*) from public.event_comments c where c.event_id = e.id), 0) as comments_count
from public.events e;

-- ── Verify with: ────────────────────────────────────────────────────────
-- select count(*) from information_schema.tables
-- where table_schema = 'public' and table_name in ('events','event_rsvps','event_comments');
-- -> should return 3

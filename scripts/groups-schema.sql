-- ============================================================
-- Groups Schema Migration
-- Run this in Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/biqsvrrnnoyulrrhgitc/sql
-- ============================================================

-- Add missing columns to groups table
alter table public.groups add column if not exists emoji text default '💪';
alter table public.groups add column if not exists tags text[] default '{}';
alter table public.groups add column if not exists banner_url text;
alter table public.groups add column if not exists meet_frequency text;
alter table public.groups add column if not exists location text;
alter table public.groups add column if not exists is_online boolean default false;
alter table public.groups add column if not exists member_count int default 1;
alter table public.groups add column if not exists slug text;
alter table public.groups add column if not exists created_by uuid references public.users(id) on delete set null;
alter table public.groups add column if not exists category text default 'General';
alter table public.groups add column if not exists description text;

-- Add role column to group_members if missing
alter table public.group_members add column if not exists role text default 'member';

-- Group Posts
create table if not exists public.group_posts (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  content text not null,
  media_url text,
  likes_count int default 0,
  created_at timestamptz default now()
);

-- Group Events
create table if not exists public.group_events (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  creator_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  description text,
  event_date timestamptz,
  location text,
  price text default 'Free',
  emoji text default '📅',
  rsvp_count int default 0,
  created_at timestamptz default now()
);

-- Group Event RSVPs
create table if not exists public.group_event_rsvps (
  event_id uuid references public.group_events(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (event_id, user_id)
);

-- Challenges
create table if not exists public.challenges (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  creator_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  description text,
  emoji text default '🏆',
  metric_label text not null,
  metric_unit text,
  difficulty text default 'Medium' check (difficulty in ('Beginner','Medium','Hard','Elite')),
  deadline timestamptz,
  is_active boolean default true,
  participant_count int default 0,
  created_at timestamptz default now()
);

-- Challenge Participants
create table if not exists public.challenge_participants (
  challenge_id uuid references public.challenges(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  score numeric default 0,
  log_entries jsonb default '[]',
  joined_at timestamptz default now(),
  primary key (challenge_id, user_id)
);

-- Community Notes
create table if not exists public.community_notes (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  category text default 'General' check (category in ('Workout','Recipe','Mindset','General','Tip')),
  content text not null,
  likes_count int default 0,
  created_at timestamptz default now()
);

-- Leaderboard Entries
create table if not exists public.leaderboard_entries (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  challenge_id uuid references public.challenges(id) on delete cascade,
  score numeric default 0,
  metric_label text,
  updated_at timestamptz default now(),
  unique(group_id, user_id, challenge_id)
);

-- ============================================================
-- RLS Policies (permissive for now - tighten later)
-- ============================================================

alter table public.group_posts enable row level security;
create policy "Anyone can read group posts" on public.group_posts for select using (true);
create policy "Members can post" on public.group_posts for insert with check (true);

alter table public.group_events enable row level security;
create policy "Anyone can read group events" on public.group_events for select using (true);
create policy "Members can create events" on public.group_events for insert with check (true);
create policy "Service can update events" on public.group_events for update using (true);

alter table public.group_event_rsvps enable row level security;
create policy "Anyone can read rsvps" on public.group_event_rsvps for select using (true);
create policy "Users can rsvp" on public.group_event_rsvps for insert with check (true);

alter table public.challenges enable row level security;
create policy "Anyone can read challenges" on public.challenges for select using (true);
create policy "Members can create challenges" on public.challenges for insert with check (true);
create policy "Service can update challenges" on public.challenges for update using (true);

alter table public.challenge_participants enable row level security;
create policy "Anyone can read participants" on public.challenge_participants for select using (true);
create policy "Users can join challenges" on public.challenge_participants for insert with check (true);
create policy "Users can update their progress" on public.challenge_participants for update using (true);

alter table public.community_notes enable row level security;
create policy "Anyone can read notes" on public.community_notes for select using (true);
create policy "Members can post notes" on public.community_notes for insert with check (true);

alter table public.leaderboard_entries enable row level security;
create policy "Anyone can read leaderboard" on public.leaderboard_entries for select using (true);
create policy "Service can manage leaderboard" on public.leaderboard_entries for all using (true);

-- Also add RLS policies for groups table updates (join_group increments member_count)
create policy if not exists "Service can update groups" on public.groups for update using (true);
create policy if not exists "Anyone can read groups" on public.groups for select using (true);
create policy if not exists "Authenticated can create groups" on public.groups for insert with check (true);

-- ============================================================
-- DONE! After running this SQL, call the seed endpoint:
-- POST https://fit-app-ecru.vercel.app/api/db
-- Body: {"action":"seed_groups","payload":{"creatorId":"70e170ca-4428-4357-8e8e-410135fc3948","memberIds":["16462922-d36f-4cc4-9f8a-a42be78bf6b3"]}}
-- ============================================================

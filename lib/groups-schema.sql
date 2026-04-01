-- ============================================================
-- FIT APP — Groups Schema Extension
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add missing columns to groups table
alter table public.groups add column if not exists emoji text default '💪';
alter table public.groups add column if not exists tags text[] default '{}';
alter table public.groups add column if not exists banner_url text;
alter table public.groups add column if not exists meet_frequency text;
alter table public.groups add column if not exists location_text text;
alter table public.groups add column if not exists is_online boolean default false;
alter table public.groups add column if not exists member_count int default 1;

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
alter table public.group_posts enable row level security;
create policy "Anyone can view group posts" on public.group_posts for select using (true);
create policy "Members can post" on public.group_posts for insert with check (auth.uid() = user_id);
create policy "Authors can delete own posts" on public.group_posts for delete using (auth.uid() = user_id);

-- Group Events
create table if not exists public.group_events (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  creator_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  description text,
  event_date timestamptz,
  location_text text,
  price text default 'Free',
  emoji text default '📅',
  rsvp_count int default 0,
  created_at timestamptz default now()
);
alter table public.group_events enable row level security;
create policy "Anyone can view events" on public.group_events for select using (true);
create policy "Members can create events" on public.group_events for insert with check (auth.uid() = creator_id);

-- Group Event RSVPs
create table if not exists public.group_event_rsvps (
  event_id uuid references public.group_events(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (event_id, user_id)
);
alter table public.group_event_rsvps enable row level security;
create policy "Anyone can view RSVPs" on public.group_event_rsvps for select using (true);
create policy "Users can RSVP" on public.group_event_rsvps for all using (auth.uid() = user_id);

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
alter table public.challenges enable row level security;
create policy "Anyone can view challenges" on public.challenges for select using (true);
create policy "Members can create challenges" on public.challenges for insert with check (auth.uid() = creator_id);
create policy "Creators can update challenges" on public.challenges for update using (auth.uid() = creator_id);

-- Challenge Participants
create table if not exists public.challenge_participants (
  challenge_id uuid references public.challenges(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  score numeric default 0,
  log_entries jsonb default '[]',
  joined_at timestamptz default now(),
  primary key (challenge_id, user_id)
);
alter table public.challenge_participants enable row level security;
create policy "Anyone can view participants" on public.challenge_participants for select using (true);
create policy "Users can join challenges" on public.challenge_participants for insert with check (auth.uid() = user_id);
create policy "Users can update own progress" on public.challenge_participants for update using (auth.uid() = user_id);

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
alter table public.community_notes enable row level security;
create policy "Anyone can view notes" on public.community_notes for select using (true);
create policy "Members can post notes" on public.community_notes for insert with check (auth.uid() = user_id);

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
alter table public.leaderboard_entries enable row level security;
create policy "Anyone can view leaderboard" on public.leaderboard_entries for select using (true);
create policy "Service can manage leaderboard" on public.leaderboard_entries for all using (true);

-- Add groups RLS policies for insert (missing)
create policy "Authenticated users can create groups" on public.groups
  for insert with check (auth.uid() = creator_id);
create policy "Owners can update groups ext" on public.groups
  for update using (auth.uid() = creator_id);

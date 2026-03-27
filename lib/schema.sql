-- ============================================================
-- FIT APP — Supabase Schema
-- Run this in Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── USERS ──────────────────────────────────────────────────
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text not null,
  bio text,
  avatar_url text,
  banner_url text,
  is_private boolean default false,
  followers_count int default 0,
  following_count int default 0,
  posts_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "Users can view public profiles" on public.users
  for select using (true);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.users
  for insert with check (auth.uid() = id);

-- ── POSTS ──────────────────────────────────────────────────
create table if not exists public.posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  caption text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  post_type text default 'general' check (post_type in ('workout', 'nutrition', 'wellness', 'achievement', 'general')),
  location text,
  likes_count int default 0,
  comments_count int default 0,
  is_public boolean default true,
  created_at timestamptz default now()
);

alter table public.posts enable row level security;

create policy "Anyone can view public posts" on public.posts
  for select using (is_public = true or auth.uid() = user_id);

create policy "Users can create own posts" on public.posts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own posts" on public.posts
  for update using (auth.uid() = user_id);

create policy "Users can delete own posts" on public.posts
  for delete using (auth.uid() = user_id);

-- ── ACTIVITY LOGS ──────────────────────────────────────────
create table if not exists public.activity_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  log_type text not null check (log_type in ('workout', 'nutrition', 'wellness')),
  is_public boolean default true,
  logged_at timestamptz default now(),
  created_at timestamptz default now(),
  -- Workout
  workout_type text,
  workout_duration_min int,
  workout_calories int,
  exercises jsonb,
  cardio jsonb,
  -- Nutrition
  meal_type text,
  food_items jsonb,
  calories_total int,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  water_oz numeric,
  -- Wellness
  wellness_type text,
  wellness_duration_min int,
  mood text,
  -- Shared
  notes text,
  photo_url text
);

alter table public.activity_logs enable row level security;

create policy "Users can view public logs" on public.activity_logs
  for select using (is_public = true or auth.uid() = user_id);

create policy "Users can insert own logs" on public.activity_logs
  for insert with check (auth.uid() = user_id);

create policy "Users can update own logs" on public.activity_logs
  for update using (auth.uid() = user_id);

create policy "Users can delete own logs" on public.activity_logs
  for delete using (auth.uid() = user_id);

-- ── FOLLOWS ────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid references public.users(id) on delete cascade,
  following_id uuid references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

alter table public.follows enable row level security;

create policy "Anyone can view follows" on public.follows
  for select using (true);

create policy "Users can follow/unfollow" on public.follows
  for all using (auth.uid() = follower_id);

-- Auto-update follower counts
create or replace function update_follow_counts()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.users set following_count = following_count + 1 where id = NEW.follower_id;
    update public.users set followers_count = followers_count + 1 where id = NEW.following_id;
  elsif TG_OP = 'DELETE' then
    update public.users set following_count = following_count - 1 where id = OLD.follower_id;
    update public.users set followers_count = followers_count - 1 where id = OLD.following_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger on_follow_change
  after insert or delete on public.follows
  for each row execute function update_follow_counts();

-- ── LIKES ──────────────────────────────────────────────────
create table if not exists public.likes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

alter table public.likes enable row level security;

create policy "Anyone can view likes" on public.likes for select using (true);
create policy "Users can like/unlike" on public.likes for all using (auth.uid() = user_id);

create or replace function update_like_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set likes_count = likes_count - 1 where id = OLD.post_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger on_like_change
  after insert or delete on public.likes
  for each row execute function update_like_count();

-- ── COMMENTS ───────────────────────────────────────────────
create table if not exists public.comments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.comments enable row level security;

create policy "Anyone can view comments" on public.comments for select using (true);
create policy "Users can comment" on public.comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = user_id);

-- ── BADGES ─────────────────────────────────────────────────
create table if not exists public.badges (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  badge_id text not null,
  note text,
  earned_at timestamptz default now(),
  unique(user_id, badge_id)
);

alter table public.badges enable row level security;

create policy "Anyone can view badges" on public.badges for select using (true);
create policy "Users can earn badges" on public.badges for insert with check (auth.uid() = user_id);

-- ── GROUPS ─────────────────────────────────────────────────
create table if not exists public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  category text not null,
  is_local boolean default false,
  city text,
  creator_id uuid references public.users(id) on delete cascade not null,
  members_count int default 1,
  created_at timestamptz default now()
);

alter table public.groups enable row level security;
create policy "Anyone can view groups" on public.groups for select using (true);
create policy "Users can create groups" on public.groups for insert with check (auth.uid() = creator_id);
create policy "Owners can update groups" on public.groups for update using (auth.uid() = creator_id);

create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text default 'member' check (role in ('member', 'moderator', 'owner')),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;
create policy "Anyone can view group members" on public.group_members for select using (true);
create policy "Users can join/leave groups" on public.group_members for all using (auth.uid() = user_id);

-- ── ANALYTICS ──────────────────────────────────────────────
create table if not exists public.analytics_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  event_data jsonb,
  session_id text,
  platform text,
  created_at timestamptz default now()
);

alter table public.analytics_events enable row level security;
create policy "Users can insert own events" on public.analytics_events
  for insert with check (auth.uid() = user_id or user_id is null);
-- Only admins can read analytics (service role key needed)

create table if not exists public.analytics_sessions (
  id text primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_sec int,
  platform text,
  pages_visited int default 1
);

alter table public.analytics_sessions enable row level security;
create policy "Users can manage own sessions" on public.analytics_sessions
  for all using (auth.uid() = user_id);

-- ── STORAGE BUCKETS ────────────────────────────────────────
-- Run these separately in Supabase dashboard → Storage or via SQL:
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- insert into storage.buckets (id, name, public) values ('posts', 'posts', true);
-- insert into storage.buckets (id, name, public) values ('activity', 'activity', true);

-- ── AUTO-CREATE USER PROFILE ON SIGNUP ─────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── POST COUNT TRIGGER ─────────────────────────────────────
create or replace function update_post_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.users set posts_count = posts_count + 1 where id = NEW.user_id;
  elsif TG_OP = 'DELETE' then
    update public.users set posts_count = posts_count - 1 where id = OLD.user_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger on_post_change
  after insert or delete on public.posts
  for each row execute function update_post_count();

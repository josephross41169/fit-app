-- ============================================================
-- FIT APP — Activity Comments + Notifications Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── NOTIFICATIONS table (used by existing code, may not exist yet) ──
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  from_user_id uuid references public.users(id) on delete set null,
  type text not null check (type in ('like', 'comment', 'follow', 'message', 'activity_comment')),
  reference_id text,
  body text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "Users can view own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Anyone can insert notifications" on public.notifications
  for insert with check (true);

create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- ── ACTIVITY COMMENTS table ─────────────────────────────────
-- activity_card_id = "{userId}__{MM/DD/YYYY}" composite key
-- This ties comments to a user's full-day activity card in the feed
create table if not exists public.activity_comments (
  id uuid default uuid_generate_v4() primary key,
  activity_card_id text not null,
  commenter_id uuid references public.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists activity_comments_card_id_idx
  on public.activity_comments (activity_card_id);

alter table public.activity_comments enable row level security;

create policy "Anyone can view activity comments" on public.activity_comments
  for select using (true);

create policy "Users can post activity comments" on public.activity_comments
  for insert with check (auth.uid() = commenter_id);

create policy "Users can delete own activity comments" on public.activity_comments
  for delete using (auth.uid() = commenter_id);

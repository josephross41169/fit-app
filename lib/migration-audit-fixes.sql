-- ============================================================
-- FIT APP — Audit Fixes Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── USERS — business + extended columns ────────────────────
alter table public.users
  add column if not exists account_type text default 'personal' check (account_type in ('personal', 'business')),
  add column if not exists business_name text,
  add column if not exists business_type text,
  add column if not exists business_website text;

-- ── POSTS — multi-photo carousel column ────────────────────
alter table public.posts
  add column if not exists media_urls jsonb;

-- ── MESSAGES schema (if not created yet) ───────────────────
create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamptz default now()
);

alter table public.conversations enable row level security;
create policy if not exists "Anyone can view conversations they are in" on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = conversations.id and user_id = auth.uid()
    )
  );
create policy if not exists "Users can create conversations" on public.conversations
  for insert with check (true);

create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;
create policy if not exists "Users can view their own participations" on public.conversation_participants
  for select using (auth.uid() = user_id);
create policy if not exists "Users can join conversations" on public.conversation_participants
  for insert with check (true);

create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.users(id) on delete cascade not null,
  content text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists messages_created_at_idx on public.messages (created_at);

alter table public.messages enable row level security;
create policy if not exists "Users can view messages in their conversations" on public.messages
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );
create policy if not exists "Users can send messages" on public.messages
  for insert with check (auth.uid() = sender_id);

-- ── Enable Supabase Realtime on messages ───────────────────
alter publication supabase_realtime add table public.messages;

create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamptz default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  last_read_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy "Participants can view their conversations" on public.conversations
  for select using (
    exists (select 1 from public.conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid())
  );

create policy "Participants can view conversation members" on public.conversation_participants
  for select using (user_id = auth.uid() or conversation_id in (
    select conversation_id from public.conversation_participants where user_id = auth.uid()
  ));

create policy "Users can join conversations" on public.conversation_participants
  for insert with check (user_id = auth.uid());

create policy "Participants can read messages" on public.messages
  for select using (
    exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversation_id and cp.user_id = auth.uid())
  );

create policy "Participants can send messages" on public.messages
  for insert with check (
    sender_id = auth.uid() and
    exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversation_id and cp.user_id = auth.uid())
  );

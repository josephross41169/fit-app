-- Emoji Reactions table
-- One row per user per post per emoji type
-- Replaces the simple likes system (backwards compatible — 'heart' maps to old likes)

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  emoji text not null check (emoji in ('heart','fire','flex','clap','rocket')),
  created_at timestamptz default now(),
  unique(post_id, user_id, emoji)
);

create index if not exists reactions_post_id_idx on reactions(post_id);
create index if not exists reactions_user_id_idx on reactions(user_id);

-- Enable RLS
alter table reactions enable row level security;

-- Anyone can read reactions
create policy "reactions_read" on reactions for select using (true);

-- Authenticated users can insert/delete their own reactions
create policy "reactions_insert" on reactions for insert with check (auth.uid() = user_id);
create policy "reactions_delete" on reactions for delete using (auth.uid() = user_id);

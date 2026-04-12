-- Weight Log Table
-- Run this in Supabase SQL editor: https://supabase.com/dashboard/project/biqsvrrnnoyulrrhgitc/sql

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  weight_lbs numeric not null,
  notes text,
  logged_at timestamptz default now()
);

-- Index for fast per-user queries
create index if not exists weight_logs_user_id_idx on weight_logs(user_id, logged_at desc);

-- RLS
alter table weight_logs enable row level security;

create policy "Users can manage their own weight logs"
  on weight_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

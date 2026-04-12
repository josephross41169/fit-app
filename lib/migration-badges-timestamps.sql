-- Add timestamps and display flag to badges table
alter table if exists public.badges
add column if not exists created_at timestamptz default now(),
add column if not exists show_celebration boolean default true;

-- Create index for faster queries
create index if not exists badges_created_at_idx on public.badges (created_at);
create index if not exists badges_show_celebration_idx on public.badges (show_celebration);

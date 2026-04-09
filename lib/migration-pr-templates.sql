-- ============================================================
-- FIT APP — PR Detection + Workout Templates Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── PERSONAL RECORDS ────────────────────────────────────────
create table if not exists public.personal_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  exercise_name text not null,
  weight numeric not null,
  reps integer not null,
  volume numeric not null, -- weight * reps (1RM proxy)
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.personal_records enable row level security;

create policy "Users can view own PRs" on public.personal_records
  for select using (auth.uid() = user_id);

create policy "Users can insert own PRs" on public.personal_records
  for insert with check (auth.uid() = user_id);

create policy "Users can update own PRs" on public.personal_records
  for update using (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists idx_personal_records_user_exercise 
  on public.personal_records(user_id, exercise_name);

-- ── WORKOUT TEMPLATES ────────────────────────────────────────
create table if not exists public.workout_templates (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  exercises jsonb not null, -- [{name, sets, reps, weight}]
  created_at timestamptz default now()
);

alter table public.workout_templates enable row level security;

create policy "Users can view own templates" on public.workout_templates
  for select using (auth.uid() = user_id);

create policy "Users can insert own templates" on public.workout_templates
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own templates" on public.workout_templates
  for delete using (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists idx_workout_templates_user 
  on public.workout_templates(user_id);

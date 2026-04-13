-- Add tier column to users table
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/biqsvrrnnoyulrrhgitc/sql

alter table public.users
  add column if not exists tier text default 'default'
    check (tier in ('default', 'active', 'grinder', 'elite', 'untouchable'));

alter table public.users
  add column if not exists logs_last_28_days int default 0;

alter table public.users
  add column if not exists longest_streak int default 0;

-- Allow users to update their own tier fields
-- (already covered by existing "Users can update own profile" policy)

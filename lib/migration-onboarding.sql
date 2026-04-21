-- Migration: Onboarding + fitness profile fields
-- Run in Supabase SQL Editor

alter table users add column if not exists onboarded boolean default false;
alter table users add column if not exists fitness_goal text;
alter table users add column if not exists activity_level text;
alter table users add column if not exists focus_areas jsonb;
alter table users add column if not exists equipment_access jsonb;

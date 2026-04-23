-- ============================================================
-- FIT APP — Auto-tracked Challenges Migration
-- Run this in Supabase SQL Editor
--
-- Adds `metric_key` column to the challenges table. This is the
-- standardized metric identifier (miles_run, runs, workouts, etc.)
-- that groupGoalSync uses to auto-compute progress from activity_logs.
--
-- When metric_key is NULL, the challenge is "custom manual" — users
-- log their own progress via the existing log_challenge_progress flow.
-- When metric_key is set, the user's `score` in challenge_participants
-- auto-syncs after every activity log.
--
-- This mirrors how group_challenges.metric works for goals, just on
-- the challenges table for member challenges.
-- ============================================================

alter table public.challenges
  add column if not exists metric_key text;

-- Index for the sync query — fast lookup of active challenges a user
-- is participating in, filtered to only auto-tracked ones.
create index if not exists challenges_metric_key_idx
  on public.challenges(metric_key)
  where metric_key is not null;

-- ── Verify with: ───────────────────────────────────────────
-- select name, metric_label, metric_key from challenges;

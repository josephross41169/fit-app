-- Wellness Data Extended Fields Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/biqsvrrnnoyulrrhgitc/sql/new
-- Enables sleep tracking, steps, HRV/resting HR storage

alter table activity_logs add column if not exists wellness_data jsonb;

-- GIN index for querying wellness_data contents
create index if not exists idx_activity_logs_wellness_data on activity_logs using gin(wellness_data);

-- Example shape of wellness_data for a Sleep log:
-- {
--   "sleep_hours": 7.5,
--   "sleep_quality": 4,
--   "sleep_bedtime": "22:30",
--   "sleep_wake_time": "06:00",
--   "steps": 8500,
--   "hrv": 62
-- }

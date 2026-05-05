-- ─────────────────────────────────────────────────────────────────────────────
-- migration-healthkit-dedup.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds external-source tracking columns so the HealthKit sync can deduplicate.
-- Without these, every sync would re-import the same workouts and steps.
--
-- Columns:
--   external_id      Unique identifier from the source system. For HealthKit
--                    this is the HKObject UUID (stable across queries).
--   external_source  String tag identifying the integration ('healthkit',
--                    'fitbit', 'whoop', 'oura', etc.). NULL means the row
--                    was created by manual entry inside Livelee.
--
-- Run once in Supabase SQL editor. Idempotent — safe to run twice.
-- ─────────────────────────────────────────────────────────────────────────────

alter table activity_logs
  add column if not exists external_id     text,
  add column if not exists external_source text;

-- A given (source, external_id) can only exist once per user. NULL
-- external_id rows (manual entries) are unaffected because Postgres treats
-- NULL as distinct in unique indexes (the WHERE clause makes this explicit).
create unique index if not exists activity_logs_external_idx
  on activity_logs (user_id, external_source, external_id)
  where external_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Same treatment for weight_logs so HealthKit weight syncs don't duplicate.
-- ─────────────────────────────────────────────────────────────────────────────

alter table weight_logs
  add column if not exists external_id     text,
  add column if not exists external_source text;

create unique index if not exists weight_logs_external_idx
  on weight_logs (user_id, external_source, external_id)
  where external_id is not null;

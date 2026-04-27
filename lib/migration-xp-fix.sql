-- ── Ensure user_xp_log can accept all 5 XP categories ─────────────────────
-- Run this in Supabase SQL editor. Idempotent — safe to run more than once.
--
-- Why this exists: the awardXp helper insert fails silently if the category
-- isn't in the table's CHECK constraint. Categories `wellness` and `feed_post`
-- were added later but the constraint on the table didn't always get updated,
-- causing weeks of "I logged stuff but no XP" complaints with no visible error.
-- This migration drops + recreates the constraint so all 5 categories work.

-- 1. Make sure the table exists at all (no-op if it does)
CREATE TABLE IF NOT EXISTS public.user_xp_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category     text NOT NULL,
  xp_amount    integer NOT NULL DEFAULT 3,
  awarded_at   timestamptz NOT NULL DEFAULT now(),
  award_date   date GENERATED ALWAYS AS ((awarded_at AT TIME ZONE 'UTC')::date) STORED
);

-- 2. Drop and recreate the category CHECK constraint with all 5 values.
--    Wrapped in a DO block so the DROP doesn't error if the constraint
--    name is different (Postgres auto-generates one if not specified).
DO $$
BEGIN
  -- Drop any existing CHECK constraint on category
  ALTER TABLE public.user_xp_log
    DROP CONSTRAINT IF EXISTS user_xp_log_category_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.user_xp_log
  ADD CONSTRAINT user_xp_log_category_check
  CHECK (category IN ('workout', 'cardio', 'nutrition', 'wellness', 'feed_post'));

-- 3. Ensure the once-per-day-per-category unique constraint is in place.
--    This is what awardXp relies on for idempotency.
DO $$
BEGIN
  ALTER TABLE public.user_xp_log
    DROP CONSTRAINT IF EXISTS user_xp_log_unique_per_day;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.user_xp_log
  ADD CONSTRAINT user_xp_log_unique_per_day
  UNIQUE (user_id, category, award_date);

-- 4. Index for the daily lookups the awardXp helper does
CREATE INDEX IF NOT EXISTS user_xp_log_user_day_idx
  ON public.user_xp_log (user_id, award_date);

-- 5. RLS policies — users can read their own log; service role inserts
ALTER TABLE public.user_xp_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent) before recreating
DROP POLICY IF EXISTS "Users can read their own xp log" ON public.user_xp_log;
DROP POLICY IF EXISTS "Users can insert their own xp log" ON public.user_xp_log;

CREATE POLICY "Users can read their own xp log"
  ON public.user_xp_log FOR SELECT
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own XP entries (the new helper
-- runs client-side, so we need INSERT permission on the user's own rows)
CREATE POLICY "Users can insert their own xp log"
  ON public.user_xp_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Make sure users table has the columns awardXp updates
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS xp_in_level integer DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS current_level integer DEFAULT 1;

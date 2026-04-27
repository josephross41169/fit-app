-- ── ai_usage_log: tracks every Claude Vision food scan so we can enforce
-- the global $30/month cap and the 3/day per-user cap.
-- Run this once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feature      text NOT NULL,                     -- 'food_scan' for now; future-proof
  cost_cents   integer NOT NULL DEFAULT 0,        -- estimated cost in cents (we round up)
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the two hot lookups: monthly total + daily per-user count.
CREATE INDEX IF NOT EXISTS ai_usage_log_created_at_idx ON public.ai_usage_log (created_at);
CREATE INDEX IF NOT EXISTS ai_usage_log_user_day_idx ON public.ai_usage_log (user_id, created_at);

-- RLS: users can read their own usage; only the service role inserts (via API).
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own usage"
  ON public.ai_usage_log FOR SELECT
  USING (auth.uid() = user_id);

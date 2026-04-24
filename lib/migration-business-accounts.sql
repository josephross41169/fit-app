-- ============================================================
-- FIT APP — Business Accounts Migration (Phase 1)
-- Run in Supabase SQL Editor.
--
-- Expands the existing account_type='business' infrastructure so business
-- profiles can function as proper advertising / community pages:
--   - Contact info (address, phone, email, hours)
--   - Social links (instagram, tiktok, twitter, youtube)
--   - Long description
--   - Verification system (requested → approved/denied by admin)
--
-- Business accounts CANNOT log personal workouts/nutrition/wellness.
-- Enforced in the UI (Option A — fully separate UX) and server-side
-- by activity_logs insert guards added in a later migration.
-- ============================================================

alter table public.users
  -- Contact & location
  add column if not exists business_address text,
  add column if not exists business_phone text,
  add column if not exists business_email text,
  -- JSON of operating hours, shape:
  --   {"mon": {"open":"06:00","close":"22:00"}, "tue": {...}, ..., "sun": "closed"}
  -- Nullable — only if the business has physical hours (brands/nutrition companies may not).
  add column if not exists business_hours jsonb,
  add column if not exists business_description_long text,
  -- Social links — stored as full URLs; UI will format as @handle.
  add column if not exists business_instagram text,
  add column if not exists business_tiktok text,
  add column if not exists business_twitter text,
  add column if not exists business_youtube text,
  -- Verification state — null until they request, 'pending' after request,
  -- 'verified' once approved, 'denied' if rejected. Matches a simple
  -- manual-review flow; expand later if automated.
  add column if not exists verification_status text
    check (verification_status in ('pending','verified','denied')),
  add column if not exists verification_requested_at timestamptz,
  add column if not exists verification_approved_at timestamptz,
  add column if not exists verification_notes text;

-- Convenience boolean for quick UI checks
-- (Postgres generated columns don't work with existing data well, so
--  we compute `is_verified` in the API layer rather than add a column.)

-- ── VERIFICATION REQUESTS TABLE ───────────────────────────────────────
-- Separate table so full request history is preserved even if a user is
-- denied, retries, and eventually gets verified. Plus uploaded proof docs.
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  legal_business_name text not null,
  website text,
  proof_urls jsonb,  -- array of uploaded image URLs (business license, Google listing screenshot, etc.)
  notes text,        -- user's own notes
  status text not null default 'pending'
    check (status in ('pending','reviewing','approved','denied')),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz default now()
);

create index if not exists verification_requests_status_idx
  on public.verification_requests(status, created_at desc);

alter table public.verification_requests enable row level security;

-- Users can see and create their own requests
create policy "Users view own verification requests" on public.verification_requests
  for select using (auth.uid() = user_id);
create policy "Users create own verification requests" on public.verification_requests
  for insert with check (auth.uid() = user_id);

-- ── BUSINESS-TYPE CONSTRAINT ──────────────────────────────────────────
-- Standardize business_type values so the app can render matching icons.
-- Adding as a soft check (not enforced) so existing data (e.g. "Gym") still
-- validates — new signups use the dropdown which ensures valid values.
-- Known types: gym, yoga_studio, boxing_gym, nutrition_brand, supplement_brand,
-- apparel_brand, running_club, crossfit_box, swim_club, spa, recovery_center,
-- coach, dietitian, sports_team, other

-- ── Verify with: ──────────────────────────────────────────────────────
-- select column_name from information_schema.columns
-- where table_name = 'users' and column_name like 'business_%' or column_name like 'verification_%';
--
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name = 'verification_requests';

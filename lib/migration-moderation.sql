-- ============================================================
-- FIT APP — Moderation: Reports & Blocks
-- Apple Guideline 1.2 requires user-generated-content apps to provide:
--   1. A mechanism for users to flag objectionable content
--   2. A mechanism for users to block abusive users
--   3. The developer to act on reports within 24h
--
-- This adds the schema for both; UI + feed-filter logic is in the code changes.
-- ============================================================

-- ── REPORTS TABLE ─────────────────────────────────────────────────────
-- One row per user-submitted report. target_type narrows what's being reported.
-- Keep the reporter's user_id for follow-up but allow cascade-delete on account
-- deletion so deleted accounts don't leave orphan reports.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete cascade not null,
  target_type text not null check (target_type in ('post','user','comment','message','challenge')),
  target_id uuid not null,
  reason text not null check (reason in (
    'spam',
    'harassment',
    'hate_speech',
    'sexual_content',
    'violence',
    'self_harm',
    'misinformation',
    'impersonation',
    'other'
  )),
  details text,
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz default now(),
  -- A single user can only report the same target once. Prevents spam and
  -- makes admin dashboards sane. If they want to amend, they can delete +
  -- resubmit (or we can surface an "Update report" UI later).
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_status_idx on public.reports(status, created_at desc);
create index if not exists reports_target_idx on public.reports(target_type, target_id);

-- RLS: users can create reports and see their own. Only admin (service role)
-- can update status / see all reports.
alter table public.reports enable row level security;

create policy "Users create own reports" on public.reports
  for insert with check (auth.uid() = reporter_id);

create policy "Users view own reports" on public.reports
  for select using (auth.uid() = reporter_id);

-- ── BLOCKS TABLE ──────────────────────────────────────────────────────
-- When user A blocks user B:
--   - A never sees B's posts in their feed
--   - A never sees B's comments under posts
--   - B can't message A (messages API rejects)
--   - B can't see A's private content (if A is private)
-- Mutual effect: blocks hide content in BOTH directions to prevent sidestepping.
create table if not exists public.user_blocks (
  blocker_id uuid references public.users(id) on delete cascade not null,
  blocked_id uuid references public.users(id) on delete cascade not null,
  reason text,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)  -- can't block yourself
);

create index if not exists user_blocks_blocker_idx on public.user_blocks(blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

create policy "Users manage own blocks" on public.user_blocks
  for all using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

-- ── Verify with: ───────────────────────────────────────────────────────
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name in ('reports','user_blocks');

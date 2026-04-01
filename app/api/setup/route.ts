import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// One-time setup: create notifications table if missing
export async function GET() {
  try {
    // Try inserting a dummy notification to see if table exists
    const { error: testError } = await admin.from('notifications').select('id').limit(1);

    if (testError && testError.code === '42P01') {
      // Table doesn't exist — create via raw SQL would require pg access
      // Instead we'll just return instructions
      return NextResponse.json({ 
        status: 'notifications table missing',
        sql: `
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  from_user_id uuid references public.users(id) on delete cascade,
  type text not null check (type in ('like','comment','follow','message')),
  reference_id text,
  body text not null,
  read boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Service can insert notifications" on public.notifications for insert with check (true);
create policy "Users can mark own read" on public.notifications for update using (auth.uid() = user_id);
        `
      });
    }

    return NextResponse.json({ status: 'ok', notificationsTable: !testError });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

-- Connected Devices Table for Fitbit, Garmin, etc.
create table if not exists public.connected_devices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  device_type text not null, -- 'fitbit', 'garmin', 'oura', etc.
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  last_synced timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure one of each device type per user
  unique(user_id, device_type)
);

alter table public.connected_devices enable row level security;

create policy "Users can view own connected devices" on public.connected_devices
  for select using (auth.uid() = user_id);

create policy "Users can insert own connected devices" on public.connected_devices
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own connected devices" on public.connected_devices
  for delete using (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists idx_connected_devices_user 
  on public.connected_devices(user_id);

create index if not exists idx_connected_devices_device_type 
  on public.connected_devices(device_type);

-- Add columns to activity_logs for auto-logged data
alter table public.activity_logs add column if not exists device_type text;
alter table public.activity_logs add column if not exists steps integer;
alter table public.activity_logs add column if not exists distance numeric;
alter table public.activity_logs add column if not exists calories_burned integer;
alter table public.activity_logs add column if not exists heart_rate integer;
alter table public.activity_logs add column if not exists sleep_minutes integer;
alter table public.activity_logs add column if not exists sleep_efficiency integer;

-- Index for filtering auto-logged activities
create index if not exists idx_activity_logs_device_type 
  on public.activity_logs(device_type);

-- Run in Supabase SQL Editor to create storage buckets
insert into storage.buckets (id, name, public) values ('activity', 'activity', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('posts', 'posts', true) on conflict (id) do nothing;

-- Allow authenticated users to upload to activity bucket
create policy "Authenticated users can upload activity photos" on storage.objects
  for insert with check (bucket_id = 'activity' and auth.role() = 'authenticated');

create policy "Anyone can view activity photos" on storage.objects
  for select using (bucket_id = 'activity');

create policy "Users can delete own activity photos" on storage.objects
  for delete using (bucket_id = 'activity' and auth.uid()::text = (storage.foldername(name))[1]);

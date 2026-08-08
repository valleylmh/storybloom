create extension if not exists pgcrypto;

create table if not exists public.account_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cloud_sync_enabled boolean not null default false,
  retention_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retention_days is null or retention_days > 0)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'family_characters_id_profile_user_key'
      and conrelid = 'public.family_characters'::regclass
  ) then
    alter table public.family_characters
      add constraint family_characters_id_profile_user_key
      unique (id, profile_id, user_id);
  end if;
end;
$$;

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  family_profile_id uuid not null,
  user_id uuid not null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  primary_character_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (family_profile_id, user_id)
    references public.family_profiles(id, user_id)
    on delete cascade,
  foreign key (primary_character_id, family_profile_id, user_id)
    references public.family_characters(id, profile_id, user_id)
    on delete set null (primary_character_id)
);

create table if not exists public.saved_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_profile_id uuid,
  client_story_id text not null check (char_length(trim(client_story_id)) between 1 and 200),
  title text not null check (char_length(trim(title)) between 1 and 300),
  story_snapshot jsonb not null,
  asset_manifest jsonb not null default '{"version":1,"pages":[]}'::jsonb,
  status text not null check (char_length(trim(status)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, client_story_id),
  foreign key (child_profile_id, user_id)
    references public.child_profiles(id, user_id)
    on delete set null (child_profile_id)
);

create table if not exists public.growth_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_profile_id uuid not null,
  saved_story_id uuid,
  client_record_id text not null check (char_length(trim(client_record_id)) between 1 and 200),
  occurred_on date not null,
  note text not null default '' check (char_length(note) <= 2000),
  idea text not null default '' check (char_length(idea) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, client_record_id),
  foreign key (child_profile_id, user_id)
    references public.child_profiles(id, user_id)
    on delete cascade,
  foreign key (saved_story_id, user_id)
    references public.saved_stories(id, user_id)
    on delete set null (saved_story_id)
);

create table if not exists public.growth_record_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  growth_record_id uuid not null,
  storage_path text not null,
  original_name text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  foreign key (growth_record_id, user_id)
    references public.growth_records(id, user_id)
    on delete cascade,
  check (storage_path like user_id::text || '/%')
);

create index if not exists child_profiles_family_idx
  on public.child_profiles (family_profile_id, created_at);
create index if not exists saved_stories_user_updated_idx
  on public.saved_stories (user_id, updated_at desc);
create index if not exists saved_stories_child_updated_idx
  on public.saved_stories (child_profile_id, updated_at desc);
create index if not exists growth_records_child_occurred_idx
  on public.growth_records (child_profile_id, occurred_on desc, updated_at desc);
create index if not exists growth_record_photos_record_sort_idx
  on public.growth_record_photos (growth_record_id, sort_order, created_at);

drop trigger if exists account_settings_set_updated_at on public.account_settings;
create trigger account_settings_set_updated_at
before update on public.account_settings
for each row execute function public.set_family_updated_at();

drop trigger if exists child_profiles_set_updated_at on public.child_profiles;
create trigger child_profiles_set_updated_at
before update on public.child_profiles
for each row execute function public.set_family_updated_at();

drop trigger if exists saved_stories_set_updated_at on public.saved_stories;
create trigger saved_stories_set_updated_at
before update on public.saved_stories
for each row execute function public.set_family_updated_at();

drop trigger if exists growth_records_set_updated_at on public.growth_records;
create trigger growth_records_set_updated_at
before update on public.growth_records
for each row execute function public.set_family_updated_at();

create or replace function public.create_account_settings_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_settings (user_id, cloud_sync_enabled)
  values (new.id, false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_create_account_settings on auth.users;
create trigger auth_user_create_account_settings
after insert on auth.users
for each row execute function public.create_account_settings_for_user();

insert into public.account_settings (user_id, cloud_sync_enabled)
select users.id, false
from auth.users as users
on conflict (user_id) do nothing;

alter table public.account_settings enable row level security;
alter table public.child_profiles enable row level security;
alter table public.saved_stories enable row level security;
alter table public.growth_records enable row level security;
alter table public.growth_record_photos enable row level security;

revoke all on table public.account_settings from anon;
revoke all on table public.child_profiles from anon;
revoke all on table public.saved_stories from anon;
revoke all on table public.growth_records from anon;
revoke all on table public.growth_record_photos from anon;

grant select, insert, update, delete on table public.account_settings to authenticated;
grant select, insert, update, delete on table public.child_profiles to authenticated;
grant select, insert, update, delete on table public.saved_stories to authenticated;
grant select, insert, update, delete on table public.growth_records to authenticated;
grant select, insert, update, delete on table public.growth_record_photos to authenticated;

grant all on table public.account_settings to service_role;
grant all on table public.child_profiles to service_role;
grant all on table public.saved_stories to service_role;
grant all on table public.growth_records to service_role;
grant all on table public.growth_record_photos to service_role;

drop policy if exists account_settings_select_own on public.account_settings;
create policy account_settings_select_own on public.account_settings
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists account_settings_insert_own on public.account_settings;
create policy account_settings_insert_own on public.account_settings
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists account_settings_update_own on public.account_settings;
create policy account_settings_update_own on public.account_settings
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists account_settings_delete_own on public.account_settings;
create policy account_settings_delete_own on public.account_settings
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists child_profiles_select_own on public.child_profiles;
create policy child_profiles_select_own on public.child_profiles
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists child_profiles_insert_own on public.child_profiles;
create policy child_profiles_insert_own on public.child_profiles
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists child_profiles_update_own on public.child_profiles;
create policy child_profiles_update_own on public.child_profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists child_profiles_delete_own on public.child_profiles;
create policy child_profiles_delete_own on public.child_profiles
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists saved_stories_select_own on public.saved_stories;
create policy saved_stories_select_own on public.saved_stories
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists saved_stories_insert_own on public.saved_stories;
create policy saved_stories_insert_own on public.saved_stories
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists saved_stories_update_own on public.saved_stories;
create policy saved_stories_update_own on public.saved_stories
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists saved_stories_delete_own on public.saved_stories;
create policy saved_stories_delete_own on public.saved_stories
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists growth_records_select_own on public.growth_records;
create policy growth_records_select_own on public.growth_records
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists growth_records_insert_own on public.growth_records;
create policy growth_records_insert_own on public.growth_records
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists growth_records_update_own on public.growth_records;
create policy growth_records_update_own on public.growth_records
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists growth_records_delete_own on public.growth_records;
create policy growth_records_delete_own on public.growth_records
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists growth_record_photos_select_own on public.growth_record_photos;
create policy growth_record_photos_select_own on public.growth_record_photos
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists growth_record_photos_insert_own on public.growth_record_photos;
create policy growth_record_photos_insert_own on public.growth_record_photos
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists growth_record_photos_update_own on public.growth_record_photos;
create policy growth_record_photos_update_own on public.growth_record_photos
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists growth_record_photos_delete_own on public.growth_record_photos;
create policy growth_record_photos_delete_own on public.growth_record_photos
for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'story-archive',
    'story-archive',
    false,
    10485760,
    array['image/webp']
  ),
  (
    'growth-record-photos',
    'growth-record-photos',
    false,
    8388608,
    array['image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists story_archive_select_own on storage.objects;
create policy story_archive_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'story-archive'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists story_archive_insert_own on storage.objects;
create policy story_archive_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'story-archive'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists story_archive_update_own on storage.objects;
create policy story_archive_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'story-archive'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'story-archive'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists story_archive_delete_own on storage.objects;
create policy story_archive_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'story-archive'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists growth_record_photos_storage_select_own on storage.objects;
create policy growth_record_photos_storage_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'growth-record-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists growth_record_photos_storage_insert_own on storage.objects;
create policy growth_record_photos_storage_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'growth-record-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists growth_record_photos_storage_update_own on storage.objects;
create policy growth_record_photos_storage_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'growth-record-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'growth-record-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists growth_record_photos_storage_delete_own on storage.objects;
create policy growth_record_photos_storage_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'growth-record-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

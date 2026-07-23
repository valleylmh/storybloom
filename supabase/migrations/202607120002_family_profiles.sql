create extension if not exists pgcrypto;

create table if not exists public.family_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'zh-CN',
  guardian_consent_at timestamptz,
  guardian_consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (
    (guardian_consent_at is null and guardian_consent_version is null)
    or (guardian_consent_at is not null and nullif(trim(guardian_consent_version), '') is not null)
  )
);

create table if not exists public.family_characters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  user_id uuid not null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  relationship text not null check (char_length(trim(relationship)) between 1 and 40),
  kind text not null default 'person' check (kind in ('person', 'pet')),
  description text not null default '' check (char_length(description) <= 2000),
  source_photo_path text,
  canonical_photo_path text,
  status text not null default 'draft'
    check (status in ('draft', 'source_uploaded', 'processing', 'ready', 'failed')),
  error_message text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, user_id)
    references public.family_profiles(id, user_id)
    on delete cascade,
  check (source_photo_path is null or source_photo_path like user_id::text || '/%'),
  check (canonical_photo_path is null or canonical_photo_path like user_id::text || '/%')
);

create index if not exists family_characters_profile_sort_idx
  on public.family_characters (profile_id, sort_order, created_at);
create index if not exists family_characters_user_status_idx
  on public.family_characters (user_id, status, updated_at desc);

create or replace function public.set_family_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists family_profiles_set_updated_at on public.family_profiles;
create trigger family_profiles_set_updated_at
before update on public.family_profiles
for each row execute function public.set_family_updated_at();

drop trigger if exists family_characters_set_updated_at on public.family_characters;
create trigger family_characters_set_updated_at
before update on public.family_characters
for each row execute function public.set_family_updated_at();

create or replace function public.create_family_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.family_profiles (user_id, display_name, locale)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')), ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'locale'), ''), 'zh-CN')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_create_family_profile on auth.users;
create trigger auth_user_create_family_profile
after insert on auth.users
for each row execute function public.create_family_profile_for_user();

insert into public.family_profiles (user_id, display_name, locale)
select
  users.id,
  nullif(trim(coalesce(users.raw_user_meta_data ->> 'name', users.raw_user_meta_data ->> 'full_name', '')), ''),
  coalesce(nullif(trim(users.raw_user_meta_data ->> 'locale'), ''), 'zh-CN')
from auth.users as users
on conflict (user_id) do nothing;

alter table public.family_profiles enable row level security;
alter table public.family_characters enable row level security;

revoke all on table public.family_profiles from anon;
revoke all on table public.family_characters from anon;
grant select, insert, update, delete on table public.family_profiles to authenticated;
grant select, insert, update, delete on table public.family_characters to authenticated;
grant all on table public.family_profiles to service_role;
grant all on table public.family_characters to service_role;

drop policy if exists family_profiles_select_own on public.family_profiles;
create policy family_profiles_select_own
on public.family_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists family_profiles_insert_own on public.family_profiles;
create policy family_profiles_insert_own
on public.family_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists family_profiles_update_own on public.family_profiles;
create policy family_profiles_update_own
on public.family_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists family_profiles_delete_own on public.family_profiles;
create policy family_profiles_delete_own
on public.family_profiles for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists family_characters_select_own on public.family_characters;
create policy family_characters_select_own
on public.family_characters for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists family_characters_insert_own on public.family_characters;
create policy family_characters_insert_own
on public.family_characters for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists family_characters_update_own on public.family_characters;
create policy family_characters_update_own
on public.family_characters for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists family_characters_delete_own on public.family_characters;
create policy family_characters_delete_own
on public.family_characters for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-photos',
  'family-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists family_photos_select_own on storage.objects;
create policy family_photos_select_own
on storage.objects for select
to authenticated
using (
  bucket_id = 'family-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists family_photos_insert_own on storage.objects;
create policy family_photos_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'family-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists family_photos_update_own on storage.objects;
create policy family_photos_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'family-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'family-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists family_photos_delete_own on storage.objects;
create policy family_photos_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'family-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

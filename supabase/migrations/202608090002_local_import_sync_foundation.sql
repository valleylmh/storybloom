-- PR-4: additive, resumable local import foundations.
-- This migration intentionally builds on 202608090001_cloud_growth_archive.sql
-- without rewriting the existing archive schema.

alter table public.child_profiles
  add column if not exists client_child_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'child_profiles_client_child_id_format_check'
      and conrelid = 'public.child_profiles'::regclass
  ) then
    alter table public.child_profiles
      add constraint child_profiles_client_child_id_format_check
      check (
        client_child_id is null
        or (
          client_child_id = btrim(client_child_id)
          and char_length(client_child_id) between 1 and 200
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'child_profiles_user_client_child_id_key'
      and conrelid = 'public.child_profiles'::regclass
  ) then
    alter table public.child_profiles
      add constraint child_profiles_user_client_child_id_key
      unique (user_id, client_child_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_records_no_embedded_image_data_check'
      and conrelid = 'public.growth_records'::regclass
  ) then
    alter table public.growth_records
      add constraint growth_records_no_embedded_image_data_check
      check (
        note !~* 'data:image/'
        and idea !~* 'data:image/'
      );
  end if;
end;
$$;

-- A normalized manifest gives every uploaded story image a deterministic
-- upsert target while the existing saved_stories.asset_manifest remains
-- available to older clients.
create table if not exists public.saved_story_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_story_id uuid not null,
  asset_key text not null,
  storage_path text not null,
  mime_type text not null default 'image/webp',
  byte_size bigint,
  checksum_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, saved_story_id, asset_key),
  unique (user_id, storage_path),
  foreign key (saved_story_id, user_id)
    references public.saved_stories(id, user_id)
    on delete cascade,
  check (
    asset_key = btrim(asset_key)
    and char_length(asset_key) between 1 and 80
  ),
  check (mime_type = 'image/webp'),
  check (byte_size is null or byte_size between 1 and 10485760),
  check (
    checksum_sha256 is null
    or checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),
  check (
    storage_path like user_id::text || '/' || saved_story_id::text || '/%'
    and storage_path !~* '^(data|blob|https?):'
    and storage_path !~ '(^|/)\.\.(/|$)'
    and storage_path ~* '\.webp$'
  )
);

create index if not exists saved_story_assets_story_sort_idx
  on public.saved_story_assets (saved_story_id, asset_key, created_at);

drop trigger if exists saved_story_assets_set_updated_at
  on public.saved_story_assets;
create trigger saved_story_assets_set_updated_at
before update on public.saved_story_assets
for each row execute function public.set_family_updated_at();

alter table public.growth_record_photos
  add column if not exists client_photo_id text,
  add column if not exists mime_type text not null default 'image/webp',
  add column if not exists byte_size bigint,
  add column if not exists checksum_sha256 text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_record_photos_client_photo_id_format_check'
      and conrelid = 'public.growth_record_photos'::regclass
  ) then
    alter table public.growth_record_photos
      add constraint growth_record_photos_client_photo_id_format_check
      check (
        client_photo_id is null
        or (
          client_photo_id = btrim(client_photo_id)
          and char_length(client_photo_id) between 1 and 200
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_record_photos_mime_type_check'
      and conrelid = 'public.growth_record_photos'::regclass
  ) then
    alter table public.growth_record_photos
      add constraint growth_record_photos_mime_type_check
      check (mime_type = 'image/webp');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_record_photos_byte_size_check'
      and conrelid = 'public.growth_record_photos'::regclass
  ) then
    alter table public.growth_record_photos
      add constraint growth_record_photos_byte_size_check
      check (byte_size is null or byte_size between 1 and 8388608);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_record_photos_checksum_check'
      and conrelid = 'public.growth_record_photos'::regclass
  ) then
    alter table public.growth_record_photos
      add constraint growth_record_photos_checksum_check
      check (
        checksum_sha256 is null
        or checksum_sha256 ~ '^[0-9a-f]{64}$'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_record_photos_owned_path_check'
      and conrelid = 'public.growth_record_photos'::regclass
  ) then
    alter table public.growth_record_photos
      add constraint growth_record_photos_owned_path_check
      check (
        storage_path like user_id::text || '/' || growth_record_id::text || '/%'
        and storage_path !~* '^(data|blob|https?):'
        and storage_path !~ '(^|/)\.\.(/|$)'
        and storage_path ~* '\.webp$'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_record_photos_sort_order_range_check'
      and conrelid = 'public.growth_record_photos'::regclass
  ) then
    alter table public.growth_record_photos
      add constraint growth_record_photos_sort_order_range_check
      check (sort_order between 0 and 3);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_record_photos_user_record_client_photo_key'
      and conrelid = 'public.growth_record_photos'::regclass
  ) then
    alter table public.growth_record_photos
      add constraint growth_record_photos_user_record_client_photo_key
      unique (user_id, growth_record_id, client_photo_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_record_photos_user_record_storage_path_key'
      and conrelid = 'public.growth_record_photos'::regclass
  ) then
    alter table public.growth_record_photos
      add constraint growth_record_photos_user_record_storage_path_key
      unique (user_id, growth_record_id, storage_path);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_record_photos_user_record_sort_order_key'
      and conrelid = 'public.growth_record_photos'::regclass
  ) then
    alter table public.growth_record_photos
      add constraint growth_record_photos_user_record_sort_order_key
      unique (user_id, growth_record_id, sort_order);
  end if;
end;
$$;

drop trigger if exists growth_record_photos_set_updated_at
  on public.growth_record_photos;
create trigger growth_record_photos_set_updated_at
before update on public.growth_record_photos
for each row execute function public.set_family_updated_at();

-- The application already strips image data URLs before persistence. These
-- constraints make that privacy/storage boundary enforceable at the database.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_stories_no_embedded_image_data_check'
      and conrelid = 'public.saved_stories'::regclass
  ) then
    alter table public.saved_stories
      add constraint saved_stories_no_embedded_image_data_check
      check (
        story_snapshot::text !~* 'data:image/'
        and asset_manifest::text !~* 'data:image/'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_stories_private_asset_manifest_check'
      and conrelid = 'public.saved_stories'::regclass
  ) then
    alter table public.saved_stories
      add constraint saved_stories_private_asset_manifest_check
      check (asset_manifest::text !~* '(blob:|https?://)');
  end if;
end;
$$;

-- Higher page count dominates, then non-empty bilingual page text, then a
-- completed/private image. Both the current camelCase snapshot and a future
-- snake_case representation are accepted.
create or replace function public.story_snapshot_completeness(snapshot jsonb)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  pages jsonb;
  page_value jsonb;
  score integer := 0;
begin
  pages := snapshot -> 'pages';
  if jsonb_typeof(pages) is distinct from 'array' then
    return 0;
  end if;

  score := jsonb_array_length(pages) * 1000;
  for page_value in
    select value from jsonb_array_elements(pages) as page_items(value)
  loop
    if nullif(
      btrim(coalesce(page_value ->> 'zhText', page_value ->> 'zh_text', '')),
      ''
    ) is not null then
      score := score + 10;
    end if;
    if nullif(
      btrim(coalesce(page_value ->> 'enText', page_value ->> 'en_text', '')),
      ''
    ) is not null then
      score := score + 10;
    end if;
    if lower(
      coalesce(page_value ->> 'imageStatus', page_value ->> 'image_status', '')
    ) = 'complete'
      or nullif(
        coalesce(
          page_value #>> '{image,storagePath}',
          page_value #>> '{image,storage_path}',
          ''
        ),
        ''
      ) is not null then
      score := score + 1;
    end if;
  end loop;

  return score;
end;
$$;

create or replace function public.protect_saved_story_import_merge()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    lower(old.status) = 'complete'
    and lower(new.status) = 'generating'
  ) or public.story_snapshot_completeness(new.story_snapshot)
    < public.story_snapshot_completeness(old.story_snapshot) then
    new.title := old.title;
    new.story_snapshot := old.story_snapshot;
    new.asset_manifest := old.asset_manifest;
    new.status := old.status;
  end if;

  return new;
end;
$$;

drop trigger if exists saved_stories_protect_import_merge
  on public.saved_stories;
create trigger saved_stories_protect_import_merge
before update on public.saved_stories
for each row execute function public.protect_saved_story_import_merge();

alter table public.saved_story_assets enable row level security;

revoke all on table public.saved_story_assets from anon;
grant select, insert, update, delete on table public.saved_story_assets
  to authenticated;
grant all on table public.saved_story_assets to service_role;

drop policy if exists saved_story_assets_select_own
  on public.saved_story_assets;
create policy saved_story_assets_select_own on public.saved_story_assets
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists saved_story_assets_insert_own
  on public.saved_story_assets;
create policy saved_story_assets_insert_own on public.saved_story_assets
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists saved_story_assets_update_own
  on public.saved_story_assets;
create policy saved_story_assets_update_own on public.saved_story_assets
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists saved_story_assets_delete_own
  on public.saved_story_assets;
create policy saved_story_assets_delete_own on public.saved_story_assets
for delete to authenticated
using ((select auth.uid()) = user_id);

-- Keep the existing upload-before-row story flow working, while requiring a
-- user-owned UUID namespace and a WebP object name for both private buckets.
drop policy if exists story_archive_select_own on storage.objects;
create policy story_archive_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'story-archive'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) = 'webp'
);

drop policy if exists story_archive_insert_own on storage.objects;
create policy story_archive_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'story-archive'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) = 'webp'
);

drop policy if exists story_archive_update_own on storage.objects;
create policy story_archive_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'story-archive'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) = 'webp'
)
with check (
  bucket_id = 'story-archive'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) = 'webp'
);

drop policy if exists story_archive_delete_own on storage.objects;
create policy story_archive_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'story-archive'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) = 'webp'
);

drop policy if exists growth_record_photos_storage_select_own
  on storage.objects;
create policy growth_record_photos_storage_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'growth-record-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) = 'webp'
);

drop policy if exists growth_record_photos_storage_insert_own
  on storage.objects;
create policy growth_record_photos_storage_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'growth-record-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) = 'webp'
);

drop policy if exists growth_record_photos_storage_update_own
  on storage.objects;
create policy growth_record_photos_storage_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'growth-record-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) = 'webp'
)
with check (
  bucket_id = 'growth-record-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) = 'webp'
);

drop policy if exists growth_record_photos_storage_delete_own
  on storage.objects;
create policy growth_record_photos_storage_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'growth-record-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) = 'webp'
);

-- Compatibility foundation for the local-first GrowthMoment / StorybookVersion v1.
--
-- This migration is intentionally schema-only:
-- - it does not backfill legacy growth_records;
-- - it does not enable account cloud sync;
-- - it does not add Storage policies or make any bucket public;
-- - the application cloud repository remains on the legacy schema until an
--   explicit-consent import path and production verification are completed.

create table if not exists public.growth_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_profile_id uuid not null,
  legacy_growth_record_id uuid,
  active_storybook_version_id uuid,
  client_moment_id text not null,
  occurred_on date not null,
  parent_note text not null default '',
  source_idea text not null default '',
  parent_facts text,
  allowed_imaginations text,
  confirmed_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, client_moment_id),
  unique (user_id, legacy_growth_record_id),
  foreign key (child_profile_id, user_id)
    references public.child_profiles(id, user_id)
    on delete cascade,
  foreign key (legacy_growth_record_id, user_id)
    references public.growth_records(id, user_id)
    on delete set null (legacy_growth_record_id),
  check (
    client_moment_id = btrim(client_moment_id)
    and char_length(client_moment_id) between 1 and 200
  ),
  check (char_length(parent_note) <= 2000),
  check (char_length(source_idea) between 1 and 4000),
  check (parent_facts is null or char_length(parent_facts) <= 300),
  check (
    allowed_imaginations is null
    or char_length(allowed_imaginations) <= 300
  ),
  check (cardinality(confirmed_tags) <= 12),
  check (
    parent_note !~* '(data:image/|data:audio/|blob:|https?://)'
    and source_idea !~* '(data:image/|data:audio/|blob:|https?://)'
    and coalesce(parent_facts, '') !~* '(data:image/|data:audio/|blob:|https?://)'
    and coalesce(allowed_imaginations, '') !~* '(data:image/|data:audio/|blob:|https?://)'
  )
);

create table if not exists public.growth_moment_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  growth_moment_id uuid not null,
  client_asset_id text not null,
  asset_kind text not null default 'photo',
  storage_path text not null,
  original_name text not null default '',
  mime_type text not null default 'image/webp',
  byte_size bigint,
  checksum_sha256 text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, growth_moment_id, client_asset_id),
  unique (user_id, growth_moment_id, sort_order),
  unique (user_id, storage_path),
  foreign key (growth_moment_id, user_id)
    references public.growth_moments(id, user_id)
    on delete cascade,
  check (
    client_asset_id = btrim(client_asset_id)
    and char_length(client_asset_id) between 1 and 200
  ),
  check (asset_kind = 'photo'),
  check (mime_type = 'image/webp'),
  check (byte_size is null or byte_size between 1 and 8388608),
  check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  check (sort_order between 0 and 3),
  check (
    storage_path like user_id::text || '/' || growth_moment_id::text || '/%'
    and storage_path !~* '^(data|blob|https?):'
    and storage_path !~ '(^|/)\.\.(/|$)'
    and storage_path ~* '\.webp$'
  )
);

create table if not exists public.storybook_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  growth_moment_id uuid not null,
  saved_story_id uuid,
  character_reference_id uuid,
  character_profile_id uuid,
  client_version_id text not null,
  client_story_id text not null,
  story_snapshot jsonb not null,
  asset_manifest jsonb not null default '{"version":1,"pages":[]}'::jsonb,
  reading_stage text not null,
  illustration_style text not null,
  story_treatment text,
  prompt_version text,
  text_model text,
  image_providers text[] not null default '{}',
  character_bible_version text,
  source text not null default 'generated',
  generation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, client_version_id),
  unique (user_id, growth_moment_id, client_story_id),
  foreign key (growth_moment_id, user_id)
    references public.growth_moments(id, user_id)
    on delete cascade,
  foreign key (saved_story_id, user_id)
    references public.saved_stories(id, user_id)
    on delete set null (saved_story_id),
  foreign key (character_reference_id, character_profile_id, user_id)
    references public.family_characters(id, profile_id, user_id)
    on delete set null (character_reference_id, character_profile_id),
  check (
    client_version_id = btrim(client_version_id)
    and char_length(client_version_id) between 1 and 200
  ),
  check (
    client_story_id = btrim(client_story_id)
    and char_length(client_story_id) between 1 and 200
  ),
  check (reading_stage in ('2-3', '4-5', '6-8')),
  check (illustration_style in ('watercolor', 'cartoon', 'fairytale')),
  check (
    story_treatment is null
    or story_treatment in ('documentary', 'warm-imagination', 'fairytale')
  ),
  check (
    (character_reference_id is null and character_profile_id is null)
    or (character_reference_id is not null and character_profile_id is not null)
  ),
  check (source in ('generated', 'legacy-growth-record')),
  check (cardinality(image_providers) <= 12),
  check (
    story_snapshot::text !~* '(data:image/|data:audio/|blob:|https?://)'
    and asset_manifest::text !~* '(data:image/|data:audio/|blob:|https?://)'
    and generation_metadata::text !~* '(data:image/|data:audio/|blob:|https?://)'
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_moments_active_storybook_version_user_fkey'
      and conrelid = 'public.growth_moments'::regclass
  ) then
    alter table public.growth_moments
      add constraint growth_moments_active_storybook_version_user_fkey
      foreign key (active_storybook_version_id, user_id)
      references public.storybook_versions(id, user_id)
      on delete set null (active_storybook_version_id)
      deferrable initially deferred;
  end if;
end;
$$;

create index if not exists growth_moments_child_occurred_idx
  on public.growth_moments (child_profile_id, occurred_on desc, updated_at desc);
create index if not exists growth_moment_assets_moment_sort_idx
  on public.growth_moment_assets (growth_moment_id, sort_order, created_at);
create index if not exists storybook_versions_moment_updated_idx
  on public.storybook_versions (growth_moment_id, updated_at desc);

drop trigger if exists growth_moments_set_updated_at on public.growth_moments;
create trigger growth_moments_set_updated_at
before update on public.growth_moments
for each row execute function public.set_family_updated_at();

drop trigger if exists growth_moment_assets_set_updated_at
  on public.growth_moment_assets;
create trigger growth_moment_assets_set_updated_at
before update on public.growth_moment_assets
for each row execute function public.set_family_updated_at();

drop trigger if exists storybook_versions_set_updated_at
  on public.storybook_versions;
create trigger storybook_versions_set_updated_at
before update on public.storybook_versions
for each row execute function public.set_family_updated_at();

alter table public.growth_moments enable row level security;
alter table public.growth_moment_assets enable row level security;
alter table public.storybook_versions enable row level security;

revoke all on table public.growth_moments from anon;
revoke all on table public.growth_moment_assets from anon;
revoke all on table public.storybook_versions from anon;

grant select, insert, update, delete on table public.growth_moments to authenticated;
grant select, insert, update, delete on table public.growth_moment_assets to authenticated;
grant select, insert, update, delete on table public.storybook_versions to authenticated;

grant all on table public.growth_moments to service_role;
grant all on table public.growth_moment_assets to service_role;
grant all on table public.storybook_versions to service_role;

drop policy if exists growth_moments_select_own on public.growth_moments;
create policy growth_moments_select_own on public.growth_moments
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists growth_moments_insert_own on public.growth_moments;
create policy growth_moments_insert_own on public.growth_moments
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists growth_moments_update_own on public.growth_moments;
create policy growth_moments_update_own on public.growth_moments
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists growth_moments_delete_own on public.growth_moments;
create policy growth_moments_delete_own on public.growth_moments
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists growth_moment_assets_select_own on public.growth_moment_assets;
create policy growth_moment_assets_select_own on public.growth_moment_assets
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists growth_moment_assets_insert_own on public.growth_moment_assets;
create policy growth_moment_assets_insert_own on public.growth_moment_assets
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists growth_moment_assets_update_own on public.growth_moment_assets;
create policy growth_moment_assets_update_own on public.growth_moment_assets
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists growth_moment_assets_delete_own on public.growth_moment_assets;
create policy growth_moment_assets_delete_own on public.growth_moment_assets
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists storybook_versions_select_own on public.storybook_versions;
create policy storybook_versions_select_own on public.storybook_versions
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists storybook_versions_insert_own on public.storybook_versions;
create policy storybook_versions_insert_own on public.storybook_versions
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists storybook_versions_update_own on public.storybook_versions;
create policy storybook_versions_update_own on public.storybook_versions
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists storybook_versions_delete_own on public.storybook_versions;
create policy storybook_versions_delete_own on public.storybook_versions
for delete to authenticated using ((select auth.uid()) = user_id);

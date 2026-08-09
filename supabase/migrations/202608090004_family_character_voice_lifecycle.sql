create extension if not exists pgcrypto;

-- Keep this migration additive because 202608090003 may already have been
-- applied manually in Supabase before the lifecycle fields were finalized.
alter table public.family_character_voices
  add column if not exists enrollment_attempt_id uuid
  not null default gen_random_uuid();
alter table public.family_character_voices
  add column if not exists retired_voice_ids text[]
  not null default '{}';
alter table public.family_character_voices
  add column if not exists previous_ready_voice jsonb;
alter table public.family_character_voices
  add column if not exists retired_sample_paths text[]
  not null default '{}';
alter table public.family_character_voices
  add column if not exists provider_voice_ids_before_attempt text[];

update public.family_character_voices
set enrollment_attempt_id = gen_random_uuid()
where enrollment_attempt_id is null;
update public.family_character_voices
set retired_voice_ids = '{}'
where retired_voice_ids is null;
update public.family_character_voices
set retired_sample_paths = '{}'
where retired_sample_paths is null;

alter table public.family_character_voices
  alter column enrollment_attempt_id set default gen_random_uuid(),
  alter column enrollment_attempt_id set not null,
  alter column retired_voice_ids set default '{}',
  alter column retired_voice_ids set not null,
  alter column retired_sample_paths set default '{}',
  alter column retired_sample_paths set not null;

-- The original migration used .mp4 as the M4A extension. New clients use the
-- canonical .m4a suffix; retain legacy suffixes so existing rows stay valid.
alter table public.family_character_voices
  drop constraint if exists family_character_voices_sample_path_check;
alter table public.family_character_voices
  add constraint family_character_voices_sample_path_check
  check (
    sample_audio_path like
      user_id::text || '/' || family_character_id::text || '/%'
    and sample_audio_path ~ '^[^/]+/[^/]+/[^/]+$'
    and sample_audio_path !~ '[?#]'
    and lower(sample_audio_path) ~ '\.(wav|mp3|m4a|mp4|webm|ogg)$'
  );

alter table public.family_character_voices
  drop constraint if exists family_character_voices_status_check;
alter table public.family_character_voices
  add constraint family_character_voices_status_check
  check (status in ('processing', 'ready', 'failed', 'deleting'));

-- Provider IDs are an operational deletion queue. Do not cap it in the
-- database: silently truncating the queue could permanently orphan voices.
alter table public.family_character_voices
  drop constraint if exists family_character_voices_retired_voice_ids_check;

alter table public.family_character_voices
  drop constraint if exists family_character_voices_previous_ready_voice_check;
alter table public.family_character_voices
  add constraint family_character_voices_previous_ready_voice_check
  check (
    previous_ready_voice is null
    or jsonb_typeof(previous_ready_voice) = 'object'
  );

alter table public.family_character_voices
  drop constraint if exists family_character_voices_retired_sample_paths_check;
alter table public.family_character_voices
  add constraint family_character_voices_retired_sample_paths_check
  check (array_position(retired_sample_paths, null) is null);

-- RLS protects ordinary browser deletes. RESTRICT also closes the race where
-- a concurrent service enrollment commits after the DELETE statement took its
-- visibility snapshot but before the character row is removed.
alter table public.family_character_voices
  drop constraint if exists family_character_voices_character_owner_fkey;
alter table public.family_character_voices
  add constraint family_character_voices_character_owner_fkey
  foreign key (family_character_id, profile_id, user_id)
  references public.family_characters(id, profile_id, user_id)
  on delete restrict;

comment on column public.family_character_voices.enrollment_attempt_id is
  'Server-only claim token preventing stale enrollment requests from overwriting newer state.';
comment on column public.family_character_voices.retired_voice_ids is
  'Server-only, unbounded queue of provider voice IDs awaiting confirmed deletion.';
comment on column public.family_character_voices.previous_ready_voice is
  'Server-only durable snapshot used to restore the active voice if re-enrollment is interrupted.';
comment on column public.family_character_voices.retired_sample_paths is
  'Server-only queue of private enrollment samples awaiting confirmed Storage deletion.';
comment on column public.family_character_voices.provider_voice_ids_before_attempt is
  'Server-only list_voice snapshot used to reconcile ambiguous create_voice outcomes.';

-- Re-assert the least-privilege grants in case an earlier hand-applied version
-- of 202608090003 exposed full rows or client-side mutations.
alter table public.family_character_voices enable row level security;

revoke all on table public.family_character_voices
  from public, anon, authenticated;
grant select (
  id,
  family_character_id,
  profile_id,
  user_id,
  sample_audio_path,
  sample_duration_seconds,
  target_model,
  status,
  error_message,
  consent_confirmed_at,
  consent_version,
  created_at,
  updated_at
) on table public.family_character_voices to authenticated;
grant all on table public.family_character_voices to service_role;

drop policy if exists family_character_voices_select_own
  on public.family_character_voices;
drop policy if exists family_character_voices_insert_own
  on public.family_character_voices;
drop policy if exists family_character_voices_update_own
  on public.family_character_voices;
drop policy if exists family_character_voices_delete_own
  on public.family_character_voices;
create policy family_character_voices_select_own
on public.family_character_voices for select
to authenticated
using ((select auth.uid()) = user_id);

-- An account-data deletion takes this lock before snapshotting voice state.
-- Browser clients deliberately receive no privileges on this table, so a
-- concurrent enrollment cannot remove or forge the server-side lock.
create table if not exists public.account_voice_deletion_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  operation_id uuid not null default gen_random_uuid(),
  locked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists account_voice_deletion_locks_set_updated_at
  on public.account_voice_deletion_locks;
create trigger account_voice_deletion_locks_set_updated_at
before update on public.account_voice_deletion_locks
for each row execute function public.set_family_updated_at();

alter table public.account_voice_deletion_locks enable row level security;

revoke all on table public.account_voice_deletion_locks
  from public, anon, authenticated;
grant all on table public.account_voice_deletion_locks to service_role;

drop policy if exists account_voice_deletion_locks_service_role_all
  on public.account_voice_deletion_locks;
create policy account_voice_deletion_locks_service_role_all
on public.account_voice_deletion_locks for all
to service_role
using (true)
with check (true);

comment on table public.account_voice_deletion_locks is
  'Service-only lock preventing voice enrollment while account data is being deleted.';
comment on column public.account_voice_deletion_locks.operation_id is
  'Deletion operation that owns the lock; callers should release only their own operation.';

-- A browser may still delete an ordinary character/profile directly when it
-- has no cloned-voice row. If a voice row exists, provider and private sample
-- cleanup must complete through the server endpoint first.
drop policy if exists family_characters_delete_own
  on public.family_characters;
create policy family_characters_delete_own
on public.family_characters for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and not exists (
    select 1
    from public.family_character_voices as voice
    where voice.family_character_id = family_characters.id
      and voice.user_id = family_characters.user_id
  )
);

drop policy if exists family_profiles_delete_own
  on public.family_profiles;
create policy family_profiles_delete_own
on public.family_profiles for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and not exists (
    select 1
    from public.family_character_voices as voice
    where voice.profile_id = family_profiles.id
      and voice.user_id = family_profiles.user_id
  )
);

-- Qwen voice enrollment accepts at most 10 MiB and only WAV, MP3 or M4A.
-- audio/mp4 and audio/x-m4a are both common MIME labels for M4A files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-voice-samples',
  'family-voice-samples',
  false,
  10485760,
  array[
    'audio/wav',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_upload_family_voice_sample(
  p_user_id uuid,
  p_character_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    p_user_id = auth.uid()
    and not exists (
      select 1
      from public.account_voice_deletion_locks as deletion_lock
      where deletion_lock.user_id = p_user_id
    )
    and (
      select count(*) < 8
      from storage.objects
      where bucket_id = 'family-voice-samples'
        and name like p_user_id::text || '/' || p_character_id || '/%'
    );
$$;
revoke all on function public.can_upload_family_voice_sample(uuid, text)
  from public;
grant execute on function public.can_upload_family_voice_sample(uuid, text)
  to authenticated;

drop policy if exists family_voice_samples_select_own on storage.objects;
drop policy if exists family_voice_samples_update_own on storage.objects;
drop policy if exists family_voice_samples_insert_own on storage.objects;
create policy family_voice_samples_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'family-voice-samples'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and lower(storage.extension(name)) in ('wav', 'mp3', 'm4a')
  and public.can_upload_family_voice_sample(
    (select auth.uid()),
    (storage.foldername(name))[2]
  )
  and exists (
    select 1
    from public.family_characters as character
    where character.id::text = (storage.foldername(name))[2]
      and character.user_id = (select auth.uid())
  )
);

drop policy if exists family_voice_samples_delete_own on storage.objects;
create policy family_voice_samples_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'family-voice-samples'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[2]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  -- Keep legacy extensions deletable even though new uploads are forbidden.
  and lower(storage.extension(name))
    in ('wav', 'mp3', 'm4a', 'mp4', 'webm', 'ogg')
);

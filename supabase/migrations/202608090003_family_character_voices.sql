create extension if not exists pgcrypto;

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

create table if not exists public.family_character_voices (
  id uuid primary key default gen_random_uuid(),
  family_character_id uuid not null,
  profile_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  sample_audio_path text not null,
  sample_duration_seconds numeric(6, 3) not null,
  voice_id text,
  target_model text not null default 'qwen-audio-3.0-tts-plus',
  status text not null default 'processing',
  error_message text,
  provider_request_id text,
  enrollment_attempt_id uuid not null default gen_random_uuid(),
  retired_voice_ids text[] not null default '{}',
  previous_ready_voice jsonb,
  consent_confirmed_at timestamptz not null,
  consent_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_character_voices_character_key
    unique (family_character_id),
  constraint family_character_voices_character_owner_fkey
    foreign key (family_character_id, profile_id, user_id)
    references public.family_characters(id, profile_id, user_id)
    on delete cascade,
  constraint family_character_voices_sample_duration_check
    check (sample_duration_seconds between 10 and 60),
  constraint family_character_voices_sample_path_check
    check (
      sample_audio_path like
        user_id::text || '/' || family_character_id::text || '/%'
      and sample_audio_path ~ '^[^/]+/[^/]+/[^/]+$'
      and sample_audio_path !~ '[?#]'
      and lower(sample_audio_path) ~ '\.(webm|wav|mp3|mp4|ogg)$'
    ),
  constraint family_character_voices_target_model_check
    check (target_model = 'qwen-audio-3.0-tts-plus'),
  constraint family_character_voices_status_check
    check (status in ('processing', 'ready', 'failed', 'deleting')),
  constraint family_character_voices_ready_voice_id_check
    check (
      status <> 'ready'
      or nullif(trim(voice_id), '') is not null
    ),
  constraint family_character_voices_voice_id_check
    check (voice_id is null or char_length(trim(voice_id)) between 1 and 300),
  constraint family_character_voices_provider_request_id_check
    check (
      provider_request_id is null
      or char_length(trim(provider_request_id)) between 1 and 300
    ),
  constraint family_character_voices_retired_voice_ids_check
    check (cardinality(retired_voice_ids) <= 1000),
  constraint family_character_voices_previous_ready_voice_check
    check (
      previous_ready_voice is null
      or jsonb_typeof(previous_ready_voice) = 'object'
    ),
  constraint family_character_voices_error_message_check
    check (error_message is null or char_length(error_message) <= 2000),
  constraint family_character_voices_consent_version_check
    check (char_length(trim(consent_version)) between 1 and 100)
);

alter table public.family_character_voices
  add column if not exists enrollment_attempt_id uuid
  not null default gen_random_uuid();
alter table public.family_character_voices
  add column if not exists retired_voice_ids text[]
  not null default '{}';
alter table public.family_character_voices
  add column if not exists previous_ready_voice jsonb;

alter table public.family_character_voices
  drop constraint if exists family_character_voices_status_check;
alter table public.family_character_voices
  add constraint family_character_voices_status_check
  check (status in ('processing', 'ready', 'failed', 'deleting'));
alter table public.family_character_voices
  drop constraint if exists family_character_voices_retired_voice_ids_check;
alter table public.family_character_voices
  add constraint family_character_voices_retired_voice_ids_check
  check (cardinality(retired_voice_ids) <= 1000);
alter table public.family_character_voices
  drop constraint if exists family_character_voices_previous_ready_voice_check;
alter table public.family_character_voices
  add constraint family_character_voices_previous_ready_voice_check
  check (
    previous_ready_voice is null
    or jsonb_typeof(previous_ready_voice) = 'object'
  );

create index if not exists family_character_voices_user_updated_idx
  on public.family_character_voices (user_id, updated_at desc);
create index if not exists family_character_voices_profile_status_idx
  on public.family_character_voices (profile_id, status, updated_at desc);

drop trigger if exists family_character_voices_set_updated_at
  on public.family_character_voices;
create trigger family_character_voices_set_updated_at
before update on public.family_character_voices
for each row execute function public.set_family_updated_at();

alter table public.family_character_voices enable row level security;

revoke all on table public.family_character_voices from anon;
revoke all on table public.family_character_voices from authenticated;
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
create policy family_character_voices_select_own
on public.family_character_voices for select
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-voice-samples',
  'family-voice-samples',
  false,
  15728640,
  array[
    'audio/webm',
    'audio/wav',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg'
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
  and lower(storage.extension(name)) in ('webm', 'wav', 'mp3', 'mp4', 'ogg')
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
  and lower(storage.extension(name)) in ('webm', 'wav', 'mp3', 'mp4', 'ogg')
);

comment on table public.family_character_voices is
  'Private, consented voice-cloning enrollment metadata for one family character.';
comment on column public.family_character_voices.voice_id is
  'Server-only DashScope voice identifier used by qwen-audio-3.0-tts-plus.';
comment on column public.family_character_voices.provider_request_id is
  'Server-only provider request identifier retained for support and auditing.';
comment on column public.family_character_voices.enrollment_attempt_id is
  'Server-only claim token preventing stale enrollment requests from overwriting newer state.';
comment on column public.family_character_voices.retired_voice_ids is
  'Server-only queue of superseded provider voice IDs awaiting confirmed deletion.';
comment on column public.family_character_voices.previous_ready_voice is
  'Server-only durable snapshot used to restore the active voice if re-enrollment is interrupted.';

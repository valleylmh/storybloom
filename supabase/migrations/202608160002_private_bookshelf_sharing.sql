-- Phase 4: private bookshelf share lifecycle.
-- Existing links stay backward compatible: null expires_at means permanent.
alter table public.shared_stories
  add column if not exists client_story_id text,
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_stories_client_story_id_format_check'
      and conrelid = 'public.shared_stories'::regclass
  ) then
    alter table public.shared_stories
      add constraint shared_stories_client_story_id_format_check
      check (
        client_story_id is null
        or (
          client_story_id = btrim(client_story_id)
          and char_length(client_story_id) between 1 and 200
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_stories_expiry_after_creation_check'
      and conrelid = 'public.shared_stories'::regclass
  ) then
    alter table public.shared_stories
      add constraint shared_stories_expiry_after_creation_check
      check (expires_at is null or expires_at > created_at);
  end if;

end;
$$;

create index if not exists shared_stories_owner_story_idx
  on public.shared_stories (owner_user_id, client_story_id, created_at desc);

create index if not exists shared_stories_expiry_idx
  on public.shared_stories (expires_at)
  where expires_at is not null;

comment on column public.shared_stories.client_story_id is
  'Client story identity used for owner-only bookshelf share management.';

comment on column public.shared_stories.expires_at is
  'Public access expiry. Null is only used when the guardian explicitly chooses permanent sharing or for legacy links.';

comment on column public.shared_stories.revoked_at is
  'Set before public assets are removed so a revoked link becomes unreadable immediately and cleanup can be retried safely.';

drop index if exists public.shared_stories_expiry_idx;
drop index if exists public.shared_stories_owner_story_idx;

alter table public.shared_stories
  drop constraint if exists shared_stories_revoked_after_creation_check,
  drop constraint if exists shared_stories_expiry_after_creation_check,
  drop constraint if exists shared_stories_client_story_id_format_check,
  drop column if exists revoked_at,
  drop column if exists expires_at,
  drop column if exists client_story_id;

-- Public share links for user-generated storybooks (task D).
-- Rows are written/read only through the server's service-role client;
-- share pages fetch by unguessable share_id, deletion requires the
-- creator's delete_token (returned once at creation time).
create table if not exists public.shared_stories (
  share_id text primary key,
  story jsonb not null,
  delete_token text not null,
  owner_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.shared_stories enable row level security;

-- No policies on purpose: anon/authenticated clients have no direct access.

-- Public bucket for shared page illustrations. Uploads go through the
-- service-role client only; objects are world-readable by design (share
-- pages are public).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-shares',
  'story-shares',
  true,
  5242880,
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

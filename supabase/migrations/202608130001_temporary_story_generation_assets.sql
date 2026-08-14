-- Private, server-managed temporary illustration bytes for durable generation
-- jobs. Redis remains authoritative for short-lived ownership/lease metadata;
-- this bucket stores bytes only and is never public.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'story-generation-assets',
  'story-generation-assets',
  false,
  16777216,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally no storage.objects policies. Only the server-side
-- service-role client may upload, download or remove these opaque objects.
-- Browsers receive bytes through an application route after principal-hash
-- authorization; Storage object paths and signed URLs are not exposed.
-- Applying this migration is necessary but not sufficient for production
-- verification. On the target project, manually confirm bucket privacy,
-- MIME/size limits, anon/auth denial, and service-role upload/download/delete
-- with a disposable non-sensitive probe object before enabling production jobs.

-- Private, server-managed narration cache. The service-role client uploads
-- deterministic MP3 objects and returns short-lived signed URLs to browsers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-audio',
  'story-audio',
  false,
  20971520,
  array['audio/mpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are created intentionally. Reads and writes go
-- through the server's service-role client; listeners receive signed URLs only.

create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('library', 'personalized')),
  content_id text not null check (char_length(content_id) between 1 and 240),
  page_index integer not null default 0 check (page_index >= 0),
  max_page_index integer not null default 0 check (max_page_index >= page_index),
  position_ms integer check (position_ms is null or position_ms >= 0),
  language_mode text not null default 'zh' check (language_mode in ('zh', 'en', 'zh-en')),
  playback_mode text not null default 'page' check (playback_mode = 'page'),
  auto_advance boolean not null default true,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  completed_at timestamptz,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_type, content_id)
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('library', 'personalized')),
  content_id text not null check (char_length(content_id) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, content_type, content_id)
);

create index if not exists reading_progress_user_recent_idx
  on public.reading_progress (user_id, last_read_at desc);

create index if not exists favorites_user_active_idx
  on public.favorites (user_id, updated_at desc)
  where deleted_at is null;

create or replace function public.set_family_reading_state_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = greatest(coalesce(new.updated_at, now()), now());
  return new;
end;
$$;

drop trigger if exists reading_progress_set_updated_at on public.reading_progress;
create trigger reading_progress_set_updated_at
before update on public.reading_progress
for each row execute function public.set_family_reading_state_updated_at();

drop trigger if exists favorites_set_updated_at on public.favorites;
create trigger favorites_set_updated_at
before update on public.favorites
for each row execute function public.set_family_reading_state_updated_at();

alter table public.reading_progress enable row level security;
alter table public.favorites enable row level security;

drop policy if exists reading_progress_select_own on public.reading_progress;
create policy reading_progress_select_own on public.reading_progress
for select using (auth.uid() = user_id);

drop policy if exists reading_progress_insert_own on public.reading_progress;
create policy reading_progress_insert_own on public.reading_progress
for insert with check (auth.uid() = user_id);

drop policy if exists reading_progress_update_own on public.reading_progress;
create policy reading_progress_update_own on public.reading_progress
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists reading_progress_delete_own on public.reading_progress;
create policy reading_progress_delete_own on public.reading_progress
for delete using (auth.uid() = user_id);

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own on public.favorites
for select using (auth.uid() = user_id);

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own on public.favorites
for insert with check (auth.uid() = user_id);

drop policy if exists favorites_update_own on public.favorites;
create policy favorites_update_own on public.favorites
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own on public.favorites
for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.reading_progress to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;

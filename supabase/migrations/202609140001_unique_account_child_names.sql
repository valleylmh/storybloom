-- A child's normalized name is unique within an account, across devices.
-- Merge references before deleting duplicate profiles; never cascade-delete
-- growth records or stories to deduplicate a child.
begin;
lock table public.child_profiles, public.saved_stories, public.growth_records,
  public.growth_moments in share row exclusive mode;

create temporary table child_name_merges on commit drop as
select id as duplicate_id, canonical_id, user_id
from (
  select id, user_id,
    first_value(id) over (
      partition by user_id, lower(regexp_replace(display_name, '\s+', '', 'g'))
      order by created_at, id
    ) as canonical_id
  from public.child_profiles
) ranked where id <> canonical_id;

-- Preserve original profile metadata for recovery/audit; not exposed to clients.
create table if not exists public.child_profile_merge_archive (
  duplicate_id uuid primary key,
  canonical_id uuid not null,
  user_id uuid not null,
  original_profile jsonb not null,
  merged_at timestamptz not null default now()
);
alter table public.child_profile_merge_archive enable row level security;
revoke all on public.child_profile_merge_archive from anon, authenticated;
grant all on public.child_profile_merge_archive to service_role;
insert into public.child_profile_merge_archive (duplicate_id, canonical_id, user_id, original_profile)
select m.duplicate_id, m.canonical_id, m.user_id, to_jsonb(c)
from child_name_merges m join public.child_profiles c on c.id = m.duplicate_id
on conflict (duplicate_id) do nothing;

update public.saved_stories s set child_profile_id = m.canonical_id
from child_name_merges m where s.child_profile_id = m.duplicate_id and s.user_id = m.user_id;
update public.growth_records g set child_profile_id = m.canonical_id
from child_name_merges m where g.child_profile_id = m.duplicate_id and g.user_id = m.user_id;
update public.growth_moments g set child_profile_id = m.canonical_id
from child_name_merges m where g.child_profile_id = m.duplicate_id and g.user_id = m.user_id;

-- Keep a usable character association when the retained profile lacks one.
update public.child_profiles c set primary_character_id = (
  select d.primary_character_id from public.child_profiles d
  join child_name_merges m on m.duplicate_id = d.id
  where m.canonical_id = c.id and d.family_profile_id = c.family_profile_id
    and d.primary_character_id is not null order by d.created_at, d.id limit 1
) where c.primary_character_id is null
  and exists (select 1 from child_name_merges m where m.canonical_id = c.id);

delete from public.child_profiles c using child_name_merges m
where c.id = m.duplicate_id and c.user_id = m.user_id;

create unique index if not exists child_profiles_user_normalized_name_key
on public.child_profiles (user_id, lower(regexp_replace(display_name, '\s+', '', 'g')));
commit;

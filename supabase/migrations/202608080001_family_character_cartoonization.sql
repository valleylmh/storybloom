alter table public.family_characters
  add column if not exists cartoonize boolean not null default true,
  add column if not exists canonical_generation_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'family_characters_generation_count_check'
      and conrelid = 'public.family_characters'::regclass
  ) then
    alter table public.family_characters
      add constraint family_characters_generation_count_check
      check (
        canonical_generation_count >= 0
        and canonical_generation_count <= 5
      );
  end if;
end;
$$;

create or replace function public.protect_family_character_generation_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(auth.role(), '') <> 'service_role' then
      new.canonical_generation_count = 0;
    end if;
  elsif new.canonical_generation_count is distinct from old.canonical_generation_count
    and coalesce(auth.role(), '') <> 'service_role' then
    new.canonical_generation_count = old.canonical_generation_count;
  end if;
  return new;
end;
$$;

drop trigger if exists family_characters_protect_generation_count
  on public.family_characters;
create trigger family_characters_protect_generation_count
before insert or update of canonical_generation_count
on public.family_characters
for each row execute function public.protect_family_character_generation_count();

comment on column public.family_characters.cartoonize is
  'Whether the uploaded source photo should be transformed into a storybook character.';
comment on column public.family_characters.canonical_generation_count is
  'Server-controlled number of successful image-to-image generations, limited to five per character; failed claims are rolled back.';

alter table public.family_characters
  add column if not exists source_crop jsonb not null
    default '{"x": 50, "y": 50, "zoom": 1}'::jsonb,
  add column if not exists canonical_crop jsonb not null
    default '{"x": 50, "y": 50, "zoom": 1}'::jsonb;

comment on column public.family_characters.source_crop is
  'Non-destructive card crop for the uploaded source photo: x/y percentages and zoom.';
comment on column public.family_characters.canonical_crop is
  'Non-destructive card crop for the generated canonical image: x/y percentages and zoom.';

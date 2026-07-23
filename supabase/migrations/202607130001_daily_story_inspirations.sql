create table if not exists public.daily_story_inspirations (
  id uuid primary key default gen_random_uuid(),
  issue_date date not null unique,
  theme text not null,
  title_zh text not null,
  title_en text not null,
  opening_zh text not null,
  opening_en text not null,
  questions_zh text[] not null,
  questions_en text[] not null,
  story_prompt_zh text not null,
  story_prompt_en text not null,
  source text not null default 'fallback'
    check (source in ('generated', 'fallback')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_deliveries (
  id uuid primary key default gen_random_uuid(),
  inspiration_id uuid not null references public.daily_story_inspirations(id) on delete cascade,
  subscription_id uuid not null references public.newsletter_subscriptions(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  resend_email_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inspiration_id, subscription_id)
);

create index if not exists newsletter_deliveries_status_idx
  on public.newsletter_deliveries (status, updated_at);

create or replace function public.set_daily_story_inspiration_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_story_inspirations_set_updated_at
  on public.daily_story_inspirations;
create trigger daily_story_inspirations_set_updated_at
before update on public.daily_story_inspirations
for each row execute function public.set_daily_story_inspiration_updated_at();

create or replace function public.set_newsletter_delivery_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_deliveries_set_updated_at
  on public.newsletter_deliveries;
create trigger newsletter_deliveries_set_updated_at
before update on public.newsletter_deliveries
for each row execute function public.set_newsletter_delivery_updated_at();

create or replace function public.claim_newsletter_delivery(
  p_inspiration_id uuid,
  p_subscription_id uuid,
  p_recipient_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  if not exists (
    select 1
    from public.newsletter_subscriptions
    where id = p_subscription_id
      and status = 'confirmed'
      and lower(email) = lower(trim(p_recipient_email))
  ) then
    return null;
  end if;

  insert into public.newsletter_deliveries (
    inspiration_id,
    subscription_id,
    recipient_email,
    status
  )
  values (
    p_inspiration_id,
    p_subscription_id,
    lower(trim(p_recipient_email)),
    'sending'
  )
  on conflict (inspiration_id, subscription_id)
  do update set
    status = 'sending',
    attempts = public.newsletter_deliveries.attempts + 1,
    error_message = null,
    updated_at = now()
  where public.newsletter_deliveries.status = 'failed'
     or (
       public.newsletter_deliveries.status = 'sending'
       and public.newsletter_deliveries.updated_at < now() - interval '30 minutes'
     )
  returning id into claimed_id;

  return claimed_id;
end;
$$;

alter table public.daily_story_inspirations enable row level security;
alter table public.newsletter_deliveries enable row level security;

revoke all on table public.daily_story_inspirations from anon, authenticated;
revoke all on table public.newsletter_deliveries from anon, authenticated;
grant all on table public.daily_story_inspirations to service_role;
grant all on table public.newsletter_deliveries to service_role;

revoke all on function public.claim_newsletter_delivery(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_newsletter_delivery(uuid, uuid, text)
  to service_role;

create extension if not exists pgcrypto;

create table if not exists public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  parent_name text,
  locale text not null default 'zh-CN',
  source text not null default 'website',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'unsubscribed', 'bounced', 'complained')),
  consent_version text not null,
  consent_at timestamptz not null,
  confirm_token_hash text unique,
  unsubscribe_token_hash text not null unique,
  resend_contact_id text,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  bounce_at timestamptz,
  complaint_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists newsletter_subscriptions_email_lower_idx
  on public.newsletter_subscriptions (lower(email));
create index if not exists newsletter_subscriptions_status_idx
  on public.newsletter_subscriptions (status, updated_at desc);

create or replace function public.set_newsletter_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_subscriptions_set_updated_at
  on public.newsletter_subscriptions;
create trigger newsletter_subscriptions_set_updated_at
before update on public.newsletter_subscriptions
for each row execute function public.set_newsletter_updated_at();

alter table public.newsletter_subscriptions enable row level security;

revoke all on table public.newsletter_subscriptions from anon, authenticated;
grant all on table public.newsletter_subscriptions to service_role;

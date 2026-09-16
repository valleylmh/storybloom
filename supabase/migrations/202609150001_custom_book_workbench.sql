-- Workbench-only quota, durable jobs and private image assets.
create table public.custom_book_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start timestamptz not null,
  reserved integer not null default 0 check (reserved >= 0),
  used integer not null default 0 check (used >= 0),
  primary key (user_id, week_start),
  check (reserved + used <= 1)
);
create table public.custom_book_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available integer not null default 0 check (available >= 0)
);
create table public.custom_book_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_hash text not null,
  input jsonb not null,
  result jsonb not null,
  status text not null default 'outline' check (status in ('outline','review','images','retryable','complete','failed')),
  resume_status text not null default 'outline',
  cursor integer not null default 0,
  attempts integer not null default 0,
  lease_id uuid,
  lease_until timestamptz,
  error text,
  model text not null,
  quota_source text not null check (quota_source in ('weekly','paid')),
  quota_state text not null default 'reserved' check (quota_state in ('reserved','committed','refunded')),
  week_start timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index custom_book_jobs_owner on public.custom_book_jobs(user_id, created_at desc);
alter table public.custom_book_usage enable row level security;
alter table public.custom_book_credits enable row level security;
alter table public.custom_book_jobs enable row level security;
-- All access is through authenticated server routes. No direct client mutations.
revoke all on public.custom_book_usage, public.custom_book_credits, public.custom_book_jobs from anon, authenticated;
grant all on public.custom_book_usage, public.custom_book_credits, public.custom_book_jobs to service_role;

create function public.custom_book_reserve(p_user uuid, p_id uuid, p_hash text, p_draft jsonb, p_model text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare j custom_book_jobs; w timestamptz; source text; u custom_book_usage;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 818));
  select * into j from custom_book_jobs where id = p_id;
  if found then
    if j.user_id <> p_user or j.request_hash <> p_hash then raise exception 'REQUEST_CONFLICT'; end if;
    return to_jsonb(j);
  end if;
  if exists(select 1 from custom_book_jobs where user_id=p_user and quota_state='reserved') then raise exception 'ACTIVE_JOB'; end if;
  w := date_trunc('week', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai';
  insert into custom_book_usage(user_id,week_start) values(p_user,w) on conflict do nothing;
  select * into u from custom_book_usage where user_id=p_user and week_start=w for update;
  if u.reserved+u.used < 1 then
    source := 'weekly';
    update custom_book_usage set reserved=reserved+1 where user_id=p_user and week_start=w;
  else
    update custom_book_credits set available=available-1 where user_id=p_user and available>0;
    if not found then raise exception 'QUOTA_EXHAUSTED'; end if;
    source := 'paid';
  end if;
  insert into custom_book_jobs(id,user_id,request_hash,input,result,model,quota_source,week_start)
    values(p_id,p_user,p_hash,p_draft,p_draft,p_model,source,w) returning * into j;
  return to_jsonb(j);
end $$;

create function public.custom_book_claim(p_user uuid, p_id uuid, p_lease uuid, p_retry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare j custom_book_jobs;
begin
  select * into j from custom_book_jobs where id=p_id and user_id=p_user for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if j.quota_state <> 'reserved' or j.status in ('review','complete','failed') then return null; end if;
  if j.lease_until > now() then return null; end if;
  -- A lost worker must be explicitly resumed; do not blindly duplicate a provider request.
  if (j.status='retryable' or j.lease_id is not null) and not p_retry then return null; end if;
  update custom_book_jobs set lease_id=p_lease,lease_until=now()+interval '5 minutes',
    attempts=attempts+1,status=resume_status,error=null,updated_at=now() where id=p_id returning * into j;
  return to_jsonb(j);
end $$;

create function public.custom_book_finish(p_user uuid, p_id uuid, p_lease uuid, p_result jsonb, p_status text, p_cursor integer, p_error text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare j custom_book_jobs; terminal boolean; succeeded boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,818));
  select * into j from custom_book_jobs where id=p_id and user_id=p_user for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if j.lease_id is distinct from p_lease or j.quota_state <> 'reserved' then raise exception 'STALE_LEASE'; end if;
  if p_status not in ('review','images','retryable','complete','failed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  if p_status='retryable' and j.attempts>=3 then p_status:='failed'; end if;
  terminal := p_status in ('complete','failed','cancelled'); succeeded := p_status in ('complete','cancelled');
  if p_status='cancelled' then p_status:='failed'; end if;
  if terminal then
    if j.quota_source='weekly' then
      update custom_book_usage set reserved=reserved-1,used=used+(case when succeeded then 1 else 0 end)
        where user_id=p_user and week_start=j.week_start;
    elsif not succeeded then
      insert into custom_book_credits(user_id,available) values(p_user,1)
        on conflict(user_id) do update set available=custom_book_credits.available+1;
    end if;
  end if;
  update custom_book_jobs set result=p_result,status=p_status,cursor=p_cursor,error=p_error,
    resume_status=case when p_status='retryable' then resume_status else p_status end,
    attempts=case when p_status='retryable' then attempts else 0 end,
    lease_id=null,lease_until=null,updated_at=now(),
    quota_state=case when terminal then (case when succeeded then 'committed' else 'refunded' end) else quota_state end
    where id=p_id returning * into j;
  return to_jsonb(j);
end $$;

create function public.custom_book_confirm(p_user uuid,p_id uuid,p_pages jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j custom_book_jobs;
begin
  select * into j from custom_book_jobs where id=p_id and user_id=p_user for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if j.status='images' then return to_jsonb(j); end if;
  if j.status<>'review' then raise exception 'INVALID_STATUS'; end if;
  update custom_book_jobs set result=jsonb_set(result,'{pages}',p_pages),status='images',resume_status='images',
    cursor=0,attempts=0,updated_at=now() where id=p_id returning * into j;
  return to_jsonb(j);
end $$;

revoke all on function public.custom_book_reserve(uuid,uuid,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.custom_book_claim(uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.custom_book_finish(uuid,uuid,uuid,jsonb,text,integer,text) from public, anon, authenticated;
revoke all on function public.custom_book_confirm(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.custom_book_reserve(uuid,uuid,text,jsonb,text) to service_role;
grant execute on function public.custom_book_claim(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.custom_book_finish(uuid,uuid,uuid,jsonb,text,integer,text) to service_role;
grant execute on function public.custom_book_confirm(uuid,uuid,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('custom-books','custom-books',false,20971520,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- No storage policies: only service_role can write/read; browser receives short-lived signed URLs.

create table public.custom_book_codes (
  code_hash text primary key,
  expires_at timestamptz not null,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.custom_book_code_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.custom_book_codes enable row level security;
alter table public.custom_book_code_attempts enable row level security;
revoke all on public.custom_book_codes,public.custom_book_code_attempts from anon,authenticated;
grant all on public.custom_book_codes,public.custom_book_code_attempts to service_role;
create function public.custom_book_redeem(p_user uuid,p_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c custom_book_codes; a custom_book_code_attempts;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,818));
  insert into custom_book_code_attempts(user_id) values(p_user) on conflict do nothing;
  update custom_book_code_attempts set attempts=case when window_start < now()-interval '1 hour' then 1 else attempts+1 end,
    window_start=case when window_start < now()-interval '1 hour' then now() else window_start end
    where user_id=p_user returning * into a;
  if a.attempts>10 then return jsonb_build_object('error','RATE_LIMITED'); end if;
  select * into c from custom_book_codes where code_hash=p_hash for update;
  if not found then return jsonb_build_object('error','INVALID_CODE'); end if;
  if c.redeemed_at is not null then
    if c.redeemed_by=p_user then return jsonb_build_object('ok',true,'alreadyRedeemed',true); end if;
    return jsonb_build_object('error','INVALID_CODE');
  end if;
  if c.expires_at<=now() then return jsonb_build_object('error','INVALID_CODE'); end if;
  update custom_book_codes set redeemed_by=p_user,redeemed_at=now() where code_hash=p_hash;
  insert into custom_book_credits(user_id,available) values(p_user,1)
    on conflict(user_id) do update set available=custom_book_credits.available+1;
  return jsonb_build_object('ok',true,'alreadyRedeemed',false);
end $$;
revoke all on function public.custom_book_redeem(uuid,text) from public,anon,authenticated;
grant execute on function public.custom_book_redeem(uuid,text) to service_role;

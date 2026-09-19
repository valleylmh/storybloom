-- Run after 202609150001_custom_book_workbench.sql.
alter table public.custom_book_codes
  add column batch_id uuid,
  add column intended_user uuid references auth.users(id) on delete cascade,
  add column revoked_at timestamptz;
create index custom_book_codes_batch_idx on public.custom_book_codes(batch_id);

create or replace function public.custom_book_redeem(p_user uuid,p_hash text)
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
  if c.revoked_at is not null or (c.intended_user is not null and c.intended_user<>p_user) then return jsonb_build_object('error','INVALID_CODE'); end if;
  if c.expires_at<=now() then return jsonb_build_object('error','INVALID_CODE'); end if;
  update custom_book_codes set redeemed_by=p_user,redeemed_at=now() where code_hash=p_hash;
  insert into custom_book_credits(user_id,available) values(p_user,1)
    on conflict(user_id) do update set available=custom_book_credits.available+1;
  return jsonb_build_object('ok',true,'alreadyRedeemed',false);
end $$;
revoke all on function public.custom_book_redeem(uuid,text) from public,anon,authenticated;
grant execute on function public.custom_book_redeem(uuid,text) to service_role;

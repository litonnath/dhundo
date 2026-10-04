-- ===========================================================================
-- 110_part3.sql -- withdrawals wait 24 hours before they can be marked paid,
-- and the admin list says when a UPI id has never been paid before.
-- ===========================================================================
alter table public.services_withdrawals
  add column if not exists release_at timestamptz not null default (now() + interval '24 hours');

-- Requests already open get their 24 hours from now.
update public.services_withdrawals set release_at = now() + interval '24 hours'
 where status = 'requested' and release_at < now();

create or replace function public.services_admin_withdrawal_set(p_id uuid, p_status text, p_note text default null)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_account uuid;
  v_amount  bigint;
  v_state   text;
  v_release timestamptz;
begin
  if not public.services_is_admin() then
    return query select false, 'not_admin'::text;
    return;
  end if;
  if p_status not in ('paid', 'rejected') then
    return query select false, 'bad_status'::text;
    return;
  end if;
  select x.account_id, x.amount_paise, x.status, x.release_at into v_account, v_amount, v_state, v_release
    from public.services_withdrawals x where x.id = p_id for update;
  if v_account is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  if v_state <> 'requested' then
    return query select false, 'already_done'::text;
    return;
  end if;
  if p_status = 'paid' and v_release > now() then
    return query select false, 'on_hold'::text;
    return;
  end if;
  update public.services_withdrawals
     set status = p_status, note = nullif(btrim(coalesce(p_note, '')), ''), processed_at = now()
   where id = p_id;
  if p_status = 'rejected' then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note)
    values (v_account, v_amount, 'refund', 'Withdrawal returned');
  end if;
  return query select true, p_status::text;
end;
$fn$;
revoke all on function public.services_admin_withdrawal_set(uuid, text, text) from public, anon, authenticated;
grant execute on function public.services_admin_withdrawal_set(uuid, text, text) to authenticated;

select 'part 3 of 4 done' as "110_part3";

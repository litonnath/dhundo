-- ===========================================================================
-- 103_part2.sql -- run after 103_part1.sql. The admin function that marks a
-- withdrawal paid or rejected (a rejected one is returned to the wallet).
--   select * from services_admin_withdrawal_set(<id>, paid, UTR 1234);
--   select * from services_admin_withdrawal_set(<id>, rejected, reason);
-- ===========================================================================
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
begin
  if not public.services_is_admin() then
    return query select false, 'not_admin'::text;
    return;
  end if;
  if p_status not in ('paid', 'rejected') then
    return query select false, 'bad_status'::text;
    return;
  end if;
  select x.account_id, x.amount_paise, x.status into v_account, v_amount, v_state
    from public.services_withdrawals x where x.id = p_id for update;
  if v_account is null then
    return query select false, 'not_found'::text;
    return;
  end if;
  if v_state <> 'requested' then
    return query select false, 'already_done'::text;
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

notify pgrst, 'reload schema';
select 'done' as "103_part2";

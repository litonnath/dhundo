-- 229_item_release_2.sql -- part 2 of 2: completing a paid item order credits the seller.
create or replace function public.services_item_money()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.paid_online and coalesce(new.offer_rupees, 0) > 0 then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (new.seller_id, (new.offer_rupees * 100)::bigint, 'earning', 'Item sale', 'item:' || new.id::text) on conflict do nothing;
    perform public.services_notify(new.seller_id, 'pay_received', new.offer_rupees::text);
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_item_money_trg on public.services_item_orders;
create trigger services_item_money_trg after update of status on public.services_item_orders
  for each row when (new.status = 'completed' and old.status is distinct from new.status) execute function public.services_item_money();
select '229 item release part 2 done' as "229_2";

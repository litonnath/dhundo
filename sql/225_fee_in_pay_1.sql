-- 225_fee_in_pay_1.sql -- the delivery partner fee is part of the order payment. Part 1 of 8.
-- Online: the customer pays the high end of the fee; when a rider accepts, the
-- difference to the final fee is refunded to the wallet and the rider is credited the
-- final fee on delivery. Cash on delivery: the rider keeps the cash, his fee, and the
-- shop and Dhundo shares are settled in wallets. Applies to orders placed after this
-- runs (ledger). Needs 196, 215, 216 and 224. Run 225_2 .. _8 next.
alter table public.services_orders add column if not exists ledger boolean not null default false;
alter table public.services_orders add column if not exists fee_prepaid_paise int not null default 0;
alter table public.services_wallet_entries drop constraint if exists services_wallet_kind_known;
alter table public.services_wallet_entries add constraint services_wallet_kind_known
  check (kind in ('signup_bonus', 'promo', 'adjustment', 'refund', 'referral', 'listing_bonus', 'withdrawal', 'earning', 'topup', 'spend', 'settlement'));
create unique index if not exists services_wallet_one_settlement on public.services_wallet_entries (ref) where kind = 'settlement';

create or replace function public.services_order_cod_fee()
returns trigger language plpgsql set search_path to 'public' as $fn$
begin
  if tg_op = 'INSERT' then new.ledger := true; end if;
  new.cod_fee_paise := case when new.pay_method = 'cod' and new.mode <> 'pickup' and not new.paid
                            then public.services_cod_fee_paise() else 0 end;
  return new;
end;
$fn$;

-- What the delivery partner fee is in the order payment right now: the final fee once a
-- rider has accepted, otherwise the high end of the range.
create or replace function public.services_order_fee_due(p_order uuid)
returns int language sql stable security definer set search_path to 'public' as $fn$
  select case when o.ledger and o.mode = 'delivery' then
           case when exists (select 1 from public.services_jobs j where j.id = o.job_id and j.rider_work is not null)
                then o.delivery_fee_paise else greatest(o.delivery_fee_max_paise, o.delivery_fee_paise) end
         else 0 end
    from public.services_orders o where o.id = p_order;
$fn$;
revoke all on function public.services_order_fee_due(uuid) from public, anon, authenticated;

-- Refund the part of the prepaid fee that the final fee did not use (once).
create or replace function public.services_order_fee_settle(p_order uuid)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare o record;
begin
  select * into o from public.services_orders where id = p_order;
  if not found or not o.ledger or o.fee_prepaid_paise <= 0 or o.status in ('cancelled', 'rejected') then return; end if;
  if not exists (select 1 from public.services_jobs j where j.id = o.job_id and j.rider_work is not null) then return; end if;
  if o.fee_prepaid_paise > o.delivery_fee_paise then
    insert into public.services_wallet_entries (account_id, amount_paise, kind, note, ref)
    values (o.customer_id, o.fee_prepaid_paise - o.delivery_fee_paise, 'refund',
            'Delivery fee refund: the rider was closer', 'feediff:' || p_order::text) on conflict do nothing;
  end if;
end;
$fn$;
revoke all on function public.services_order_fee_settle(uuid) from public, anon, authenticated;
select '225 fee in pay part 1 done' as "225_1";

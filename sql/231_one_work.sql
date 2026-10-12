-- 231_one_work.sql -- one work (listing) per login. A person cannot add a second listing, change the main
-- work, or add other works; only an admin can. Existing listings are left as they are.
create or replace function public.services_one_work()
returns trigger language plpgsql set search_path to 'public' as $fn$
begin
  if public.services_is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.user_id is not null and exists (select 1 from public.services_workers w where w.user_id = new.user_id) then
      raise exception 'one_listing_per_account';
    end if;
  else
    new.trade_slug := old.trade_slug;
    new.other_trades := old.other_trades;
  end if;
  return new;
end;
$fn$;
drop trigger if exists services_one_work_trg on public.services_workers;
create trigger services_one_work_trg before insert or update on public.services_workers
  for each row execute function public.services_one_work();
select '231 one work done' as "231_work";

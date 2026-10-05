-- ===========================================================================
-- 127_bike_and_vehicle_number.sql -- adds Bike taxi to the Drivers trades, and
-- makes every driver trade ask for a vehicle number and an ID photo. Safe to
-- run again.
-- ===========================================================================
do $fn$
declare
  k text;
  has_kind boolean;
begin
  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'services_trades'
                    and column_name = 'kind') into has_kind;
  if has_kind then
    execute $q$select kind::text from public.services_trades
                where group_name = 'Drivers' and kind is not null limit 1$q$ into k;
  end if;
  if not exists (select 1 from public.services_trades where slug = 'bike-taxi') then
    if k is null then
      insert into public.services_trades (slug, group_name, name_en, name_hi, name_bn)
      values ('bike-taxi', 'Drivers', 'Bike taxi', 'बाइक टैक्सी', 'বাইক ট্যাক্সি');
    else
      execute format('insert into public.services_trades (slug, group_name, name_en, name_hi, name_bn, kind) values (%L, %L, %L, %L, %L, %L)',
                     'bike-taxi', 'Drivers', 'Bike taxi', 'बाइक टैक्सी', 'বাইক ট্যাক্সি', k);
    end if;
  end if;
end;
$fn$;

update public.services_trades set requires_vehicle = true, requires_id = true where group_name = 'Drivers';

select slug, name_en, requires_vehicle, requires_id from public.services_trades where group_name = 'Drivers' order by name_en;

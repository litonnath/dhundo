-- ===========================================================================
-- 209_other_categories.sql -- an "Other" choice in every service category, for
-- anything not in the list. The person types what it is when they list it.
-- Safe to run twice. (Shops already have "Other shop" from 150.)
-- ===========================================================================
do $do$
declare
  g record;
  has_kind boolean;
  kind_value text;
  cols text;
  vals text;
  v_slug text;
  v_name text;
begin
  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'services_trades' and column_name = 'kind') into has_kind;
  for g in select distinct group_name from public.services_trades where group_name is not null loop
    if g.group_name = 'Suppliers' then continue; end if; -- has Other shop
    v_slug := 'other-' || regexp_replace(lower(g.group_name), '[^a-z0-9]+', '-', 'g');
    v_slug := regexp_replace(v_slug, '-+$', '');
    if exists (select 1 from public.services_trades where slug = v_slug) then continue; end if;
    v_name := case g.group_name when 'Drivers' then 'Other vehicle or machine'
                                when 'Eat & Stay' then 'Other food or stay' else 'Other' end;
    cols := 'slug, group_name, name_en, name_hi, name_bn';
    vals := format('%L, %L, %L, %L, %L', v_slug, g.group_name, v_name, 'अन्य', 'অন্যান্য');
    if has_kind then
      execute format('select kind::text from public.services_trades where group_name = %L and kind is not null limit 1', g.group_name) into kind_value;
      if kind_value is not null then cols := cols || ', kind'; vals := vals || format(', %L', kind_value); end if;
    end if;
    execute format('insert into public.services_trades (%s) values (%s)', cols, vals);
    update public.services_trades
       set requires_vehicle = (group_name = 'Drivers'),
           requires_id = (group_name in ('Drivers', 'Home & Domestic'))
     where slug = v_slug;
  end loop;
end
$do$;
select slug, name_en, group_name from public.services_trades where slug like 'other-%' order by group_name;

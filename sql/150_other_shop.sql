-- 150_other_shop.sql
-- Adds one shop type called Other shop, for any shop that is not in the list.
-- The owner writes what the shop sells when signing up. Safe to run twice.

do $$
declare
  has_kind   boolean;
  kind_value text;
  cols       text := 'slug, group_name, name_en, name_hi, name_bn';
  vals       text;
begin
  if to_regclass('public.services_trades') is null then
    raise exception 'services_trades not found.';
  end if;
  if exists (select 1 from public.services_trades where slug = 'supply-other') then
    return;
  end if;

  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'services_trades'
                    and column_name = 'kind') into has_kind;
  if has_kind then
    execute $q$select kind::text from public.services_trades
                where group_name = 'Suppliers' and kind is not null limit 1$q$ into kind_value;
    kind_value := coalesce(kind_value, 'supplier');
    cols := cols || ', kind';
  end if;

  vals := format('%L, %L, %L, %L, %L', 'supply-other', 'Suppliers',
                 'Other shop', 'अन्य दुकान', 'অন্য দোকান');
  if has_kind then vals := vals || format(', %L', kind_value); end if;
  execute format('insert into public.services_trades (%s) values (%s)', cols, vals);
end $$;

select slug, name_en, group_name from public.services_trades
 where slug = 'supply-other';

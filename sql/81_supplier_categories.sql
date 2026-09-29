-- ===========================================================================
-- 81_supplier_categories.sql
--
-- Every kind of building-material shop as its own category, so a search for
-- "paint" or "rod" finds a shop instead of nothing: cement, sand and stone,
-- bricks, steel rods, hardware, paints, tiles and marble, sanitary and
-- plumbing, electrical goods, plywood and timber, glass and aluminium, tin
-- roofing, pipes and tanks.
--
-- Nothing already there is changed or duplicated. Each new category carries
-- a few words to look for; if any existing category in the Suppliers group
-- already matches one of them, that shop type is skipped. Run it again and
-- it adds nothing.
--
-- services_trades comes from a migration that is not in this repository, so
-- the insert names only the columns known to exist (slug, group_name,
-- name_en, name_hi, name_bn) plus a `kind` column if there is one, and says
-- plainly if some other column refuses to be left empty.
-- ===========================================================================

drop table if exists _81_new;
create temporary table _81_new (
  slug text, name_en text, name_hi text, name_bn text, match text[]
);

insert into _81_new values
 ('supply-cement',     'Cement shop',                      'सीमेंट की दुकान',           'সিমেন্টের দোকান',          array['cement']),
 ('supply-sand-stone', 'Sand, stone chips & gravel',       'बालू, गिट्टी, बजरी',         'বালি, পাথরকুচি',            array['sand','stone','gravel','chips','balu']),
 ('supply-bricks',     'Bricks',                           'ईंट',                        'ইট',                        array['brick']),
 ('supply-steel-rod',  'Steel & TMT rods',                 'सरिया, स्टील',               'রড, স্টিল',                 array['steel','rod','tmt','saria','iron']),
 ('supply-hardware',   'Hardware store',                   'हार्डवेयर की दुकान',         'হার্ডওয়্যারের দোকান',       array['hardware']),
 ('supply-paints',     'Paints',                           'पेंट की दुकान',              'রঙের দোকান',                array['paint']),
 ('supply-tiles',      'Tiles, marble & granite',          'टाइल्स, मार्बल, ग्रेनाइट',   'টাইলস, মার্বেল, গ্রানাইট',   array['tile','marble','granite']),
 ('supply-sanitary',   'Sanitary & plumbing goods',        'सैनिटरी, प्लंबिंग सामान',    'স্যানিটারি ও প্লাম্বিং সামগ্রী', array['sanitary','bathroom']),
 ('supply-electrical', 'Electrical goods',                 'बिजली का सामान',             'ইলেকট্রিক্যাল সামগ্রী',      array['electrical goods','electrical shop','electric shop','wire']),
 ('supply-plywood',    'Plywood, timber & doors',          'प्लाईवुड, लकड़ी, दरवाज़े',   'প্লাইউড, কাঠ, দরজা',        array['plywood','timber','wood']),
 ('supply-glass',      'Glass & aluminium',                'शीशा, एल्युमिनियम',           'কাচ ও অ্যালুমিনিয়াম',       array['glass','alumin']),
 ('supply-roofing',    'Tin sheets & roofing',             'टिन की चादर, छत',            'টিনের চাল, ছাদ',            array['tin','roofing']),
 ('supply-pipes-tanks','Pipes & water tanks',              'पाइप, पानी की टंकी',          'পাইপ ও জলের ট্যাঙ্ক',        array['pipe','tank']);

drop table if exists _81_added;
create temporary table _81_added (slug text, name_en text);

do $$
declare
  n            record;
  has_kind     boolean;
  kind_value   text;
  blocking     text;
  cols         text := 'slug, group_name, name_en, name_hi, name_bn';
  vals         text;
begin
  if to_regclass('public.services_trades') is null then
    raise exception 'services_trades not found.';
  end if;

  -- Any other NOT NULL column without a default would make the insert
  -- fail on a constraint nobody here can see. Say which, rather than
  -- failing with a bare error.
  select string_agg(column_name, ', ') into blocking
    from information_schema.columns
   where table_schema = 'public' and table_name = 'services_trades'
     and is_nullable = 'NO' and column_default is null
     and column_name not in ('slug', 'group_name', 'name_en', 'name_hi', 'name_bn', 'kind');
  if blocking is not null then
    raise exception 'services_trades needs values for: %. Send this message over.', blocking;
  end if;

  -- The browse cards call a shop a "supplier" (trade_kind). If the table
  -- keeps that in a `kind` column, copy it from an existing Suppliers row.
  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'services_trades'
                    and column_name = 'kind') into has_kind;
  if has_kind then
    execute $q$select kind::text from public.services_trades
                where group_name = 'Suppliers' and kind is not null limit 1$q$ into kind_value;
    kind_value := coalesce(kind_value, 'supplier');
    cols := cols || ', kind';
  end if;

  for n in select * from _81_new loop
    continue when exists (select 1 from public.services_trades where slug = n.slug);
    continue when exists (
      select 1 from public.services_trades t, unnest(n.match) m
       where t.group_name = 'Suppliers' and t.name_en ~* ('\m' || m));

    vals := format('%L, %L, %L, %L, %L', n.slug, 'Suppliers', n.name_en, n.name_hi, n.name_bn);
    if has_kind then vals := vals || format(', %L', kind_value); end if;
    execute format('insert into public.services_trades (%s) values (%s)', cols, vals);
    insert into _81_added values (n.slug, n.name_en);
  end loop;
end $$;

select jsonb_pretty(jsonb_build_object(
  'added', (select coalesce(jsonb_agg(name_en), '[]'::jsonb) from _81_added),
  'suppliers_now', (select coalesce(jsonb_agg(name_en order by name_en), '[]'::jsonb)
                      from public.services_trades where group_name = 'Suppliers'),
  'expected', 'added lists the shop types that were missing; suppliers_now is the full shop list'
)) as "81_verify";

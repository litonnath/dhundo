-- ===========================================================================
-- 112_eat_and_stay.sql -- the trades for the Eat and Stay tile: restaurants,
-- dhabas, tea stalls, bakeries, tiffin and home food, fast food, caterers,
-- hotels and lodges, homestays. A food licence number is NOT required: many
-- small places run without one, and the form does not ask for it. They are
-- listed like shops (a place people go to or call), so they get the shop
-- form: a business name and no day rate.
-- Safe to run again: a trade that already exists is skipped.
-- ===========================================================================
do $fn$
declare
  n          record;
  has_kind   boolean;
  kind_value text;
  cols       text := 'slug, group_name, name_en, name_hi, name_bn';
  vals       text;
begin
  if to_regclass('public.services_trades') is null then
    raise exception 'services_trades not found.';
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
  for n in select * from (values
    ('restaurant', 'Restaurant', 'रेस्टोरेंट', 'রেস্তোরাঁ'),
    ('dhaba-hotel', 'Dhaba and food hotel', 'ढाबा और होटल', 'ধাবা ও খাবার হোটেল'),
    ('tea-snacks', 'Tea stall and snacks', 'चाय और नाश्ता', 'চা ও জলখাবার'),
    ('bakery-sweets', 'Bakery and sweets', 'बेकरी और मिठाई', 'বেকারি ও মিষ্টি'),
    ('tiffin-home-food', 'Tiffin and home food', 'टिफिन और घर का खाना', 'টিফিন ও বাড়ির খাবার'),
    ('fast-food-biryani', 'Fast food and biryani', 'फास्ट फूड और बिरयानी', 'ফাস্ট ফুড ও বিরিয়ানি'),
    ('catering-service', 'Catering service', 'केटरिंग सेवा', 'ক্যাটারিং সার্ভিস'),
    ('hotel-lodge', 'Hotel and lodge', 'होटल और लॉज', 'হোটেল ও লজ'),
    ('homestay-guesthouse', 'Homestay and guest house', 'होमस्टे और गेस्ट हाउस', 'হোমস্টে ও গেস্ট হাউস')
  ) as v(slug, name_en, name_hi, name_bn) loop
    continue when exists (select 1 from public.services_trades where slug = n.slug);
    vals := format('%L, %L, %L, %L, %L', n.slug, 'Eat & Stay', n.name_en, n.name_hi, n.name_bn);
    if has_kind then vals := vals || format(', %L', kind_value); end if;
    execute format('insert into public.services_trades (%s) values (%s)', cols, vals);
  end loop;
end;
$fn$;

select group_name, count(*) as trades from public.services_trades
 where group_name = 'Eat & Stay' group by group_name;

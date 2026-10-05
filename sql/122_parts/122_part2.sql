-- ===========================================================================
-- 122_part2.sql -- Dhundo is for eating, not lodging: remove the two stay
-- trades when nobody has listed under them. The app already hides them.
-- ===========================================================================
delete from public.services_trades t
 where t.slug in ('hotel-lodge', 'homestay-guesthouse')
   and not exists (select 1 from public.services_workers w where w.trade_slug = t.slug);
select count(*) as stay_trades_left from public.services_trades where slug in ('hotel-lodge', 'homestay-guesthouse');

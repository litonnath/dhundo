-- ===========================================================================
-- 124_part1.sql -- a listing's address is public: shown on the card so people
-- can find where the person works. New listings start public, and the
-- existing ones are switched on. An owner can still turn it off in My listing.
-- ===========================================================================
alter table public.services_workers alter column address_public set default true;
update public.services_workers set address_public = true where address_public is distinct from true;
select count(*) as listings_with_public_address from public.services_workers where address_public;

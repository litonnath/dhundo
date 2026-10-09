-- 160: a very small platform fee. Only rows still on the old starting values
-- are changed, so anything you set yourself in the admin screen is kept.
update public.services_rate_card set platform_rupees = 2 where key in ('ride','delivery_food','delivery_small') and platform_rupees = 10;
update public.services_rate_card set platform_rupees = 3 where key = 'delivery_medium' and platform_rupees = 15;
update public.services_rate_card set platform_rupees = 5 where key = 'delivery_heavy' and platform_rupees = 30;
select '160 minimal platform fee done' as "160";

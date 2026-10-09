-- 161: GST is always 18%, on Dhundo's platform fee. The column stays but the
-- admin screen no longer edits it.
update public.services_rate_card set gst_percent = 18;
select '161 gst 18 done' as "161";

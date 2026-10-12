-- 230_refund_queue_2.sql -- part 2 of 3: cancellations raise a refund request instead of refunding.
create or replace function public.services_refund_payment(p_purpose text, p_ref uuid)
returns void language plpgsql security definer set search_path to 'public' as $fn$
begin
  perform public.services_refund_request(p_purpose, p_ref, 'Cancelled');
end;
$fn$;
revoke all on function public.services_refund_payment(text, uuid) from public, anon, authenticated;

create or replace function public.services_refund_booking()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  perform public.services_refund_request('booking', old.id, 'Booking cancelled');
  return coalesce(new, old);
end;
$fn$;
select '230 refund queue part 2 done' as "230_2";

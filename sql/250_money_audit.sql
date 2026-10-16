-- 250_money_audit.sql -- READ ONLY. Shows money in wallets that did not come from a real payment or a real job.
-- Changes nothing. Paste the three result tables back to review before anything is removed.
-- 1. Total by kind: topup = real PayU money, earning/refund/settlement = real jobs, the rest is credits we gave.
select kind, count(*) as rows, sum(amount_paise)/100.0 as rupees from public.services_wallet_entries group by kind order by kind;
-- 2. Hand-made credits (promo / adjustment): anything here was typed in by an admin or a script.
select e.created_at, e.account_id, e.kind, e.amount_paise/100.0 as rupees, e.note from public.services_wallet_entries e where e.kind in ('promo','adjustment') order by e.created_at desc limit 100;
-- 3. Top-ups made before you went live on PayU: set the date below to the day you switched to live keys.
select e.created_at, e.account_id, e.amount_paise/100.0 as rupees, e.ref from public.services_wallet_entries e where e.kind = 'topup' and e.created_at < date '2026-10-01' order by e.created_at;

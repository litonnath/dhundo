# Dhundo: everything to do, in order

Project ref: `nowhtdsuestyduzqtcks`. Run the SQL in Supabase > SQL editor (paste a file, press Run, wait for the "done" row).
Skip a file you already ran; running one twice is safe. Files that start with a number lower than 197 should already be done.

## Step 1. Get the latest code
```
cd ~/services-app
git fetch origin claude/epic-carson-1igflg
git checkout claude/epic-carson-1igflg
git pull origin claude/epic-carson-1igflg
```

## Step 2. SQL, in exactly this order (all in the `sql` folder)
Earlier features (needed by the app):
1. `180_menu_photos.sql`
2. `181_no_rider_fallback_1.sql`, `181_no_rider_fallback_2.sql`
3. `182_delivery_quote.sql`, `182_job_distances.sql`
4. `183_ride_rates_1.sql`, `183_ride_rates_2.sql`
5. `184_order_rider_position.sql`, `185_order_set_drop.sql`, `186_rider_points.sql`
6. `187_delivery_ratings.sql`, `188_ratings_rides.sql`, `189_admin_quality.sql`, `190_delivery_rateable.sql`
7. `191_pricing_defaults.sql`, `192_cod_paid_on_delivery.sql`, `193_my_order_ratings.sql`, `194_order_delivery_ratings.sql`
8. `195_job_accept_far.sql`, `196_fee_range_1.sql`
Workers, bookings, rides, shops:
9. `197_fee_bounds.sql`, `198_food_gst_5.sql`, `199_inbox_rate.sql`, `200_profile_photo.sql`
10. `201_booking_complete.sql`, `202_booking_reschedule.sql`, `203_worker_busy.sql`, `204_booking_remove.sql`
11. `205_worker_card_extra.sql`, `206_booking_done_rate.sql`, `207_booking_reports.sql`
12. `208_ride_rates_cheaper.sql`, `209_other_categories.sql`, `210_worker_kinds.sql`, `211_pickup_collected.sql`
Support chat:
13. `212_support_1.sql`, `212_support_2.sql`, `212_support_3.sql`
Payments and wallet:
14. `213_payments_1.sql`, `213_payments_2.sql`
15. `214_earnings.sql`
16. `215_wallet_1.sql`, `215_wallet_2.sql`
17. `216_refunds.sql`, `217_admin_payments.sql`, `218_pay_flags.sql`
18. `219_booking_pay_1.sql`, `219_booking_pay_2.sql`, `219_booking_pay_3.sql`
19. `220_payments_received.sql`
20. `221_admin_refunds_1.sql`, `221_admin_refunds_2.sql`
21. `222_withdraw_1.sql`, `222_withdraw_2.sql`  (needs `103`, `155_part3` and `156` done earlier)
22. `223_pay_guard_1.sql`, `223_pay_guard_2.sql`
23. `224_online_first_1.sql` to `224_online_first_5.sql` (pay first, then the restaurant sees the order; cash on delivery costs Rs 30 extra)
24. `225_fee_in_pay_1.sql` to `225_fee_in_pay_8.sql` (delivery partner fee inside the payment, refund of the difference, cash settlement between rider, shop and Dhundo)
25. `226_receipt.sql` (payment receipt on the order)
If a file says a function or table does not exist, run the file number just before it first, then retry.
If the shop price-list save fails, also run the `143` and `144` files.

## Step 3. Bank-account key (only for withdrawals to a bank account)
Supabase > Project Settings > Vault > New secret. Name exactly `dhundo_bank_key`, value any long random text. Keep a copy somewhere safe.

## Step 4. PayU
1. PayU dashboard: copy Key and Salt (Test mode first: Developers > API Keys). Never put them in chat or code.
2. From `~/services-app` run:
```
bash scripts/payments-setup.sh
```
It asks the site address, test or live, the key and salt (hidden), sets the secrets and deploys `payu-order` and `payu-callback`.
3. Check: `PAYU_KEY=... PAYU_SALT=... PAYU_BASE=https://test.payu.in/_payment node scripts/payu-check.mjs` (leave PAYU_BASE out for live).
4. Test, live key with live salt only. Never mix test and live.
5. Optional: PayU dashboard > Webhooks > payment success: `https://nowhtdsuestyduzqtcks.supabase.co/functions/v1/payu-callback`
6. After any code pull, redeploy: `supabase functions deploy payu-order --project-ref nowhtdsuestyduzqtcks` and `supabase functions deploy payu-callback --no-verify-jwt --project-ref nowhtdsuestyduzqtcks`

## Step 5. Publish the website
Create `src/config.js` on your server (it is not in GitHub), then `npm install` and `npm run build`, and publish the `dist` folder as you normally do.

## Step 6. Try it
1. Wallet > Add money > 10 rupees > pay in PayU test mode > balance rises; Admin > Payments shows it Paid.
2. Book a worker, worker sets a price, pay from wallet; the worker's wallet rises.
3. Wallet > Withdraw: choose UPI or Bank, enter an amount. A new UPI id or bank detail waits 24 hours the first time.
4. Admin > Withdrawals: pay the person from your own app, then Mark paid.
5. Admin > Payments: refund a payment or send a refund to a UPI id. Refunds are admin-only.

## Not automatic yet
Payouts to partners and UPI refunds are paid by you by hand until PayU's payout product is activated.

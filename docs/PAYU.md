# Online payment with PayU (UPI, cards, net banking)

Customers can pay for an **order**, a **ride fare** or a **second-hand item** from the app.
The person is sent to PayU's secure payment page, pays, and is sent back to the app.
Which options PayU shows (UPI apps, UPI QR, cards, net banking, wallets) depends on what is enabled on your PayU account.

The amount is always worked out on the server from the order, ride or item. The phone cannot change it.
Every PayU request is signed with your salt, and every reply is checked with the same salt before anything is marked paid.

## Set up (once)

1. **PayU dashboard** (use the Test environment first): get your Merchant **Key** and **Salt**.
2. **Supabase secrets** (Project > Edge Functions > Secrets). Never put these in the code or in GitHub:
   - `PAYU_KEY`
   - `PAYU_SALT`
   - `APP_URL` — your site's address, for example `https://dhundo.in` (people are sent back here after paying)
   - `PAYU_BASE` — only for testing: `https://test.payu.in/_payment`. Leave it unset for live (`https://secure.payu.in/_payment`).
3. **Deploy the two functions**
   ```
   supabase functions deploy payu-order
   supabase functions deploy payu-callback --no-verify-jwt
   ```
4. **PayU webhook** (optional but recommended, so a payment is still recorded if the person closes the page):
   PayU dashboard > Webhooks > Payment success. URL: `https://<your-project>.supabase.co/functions/v1/payu-callback`.
5. **SQL** (Supabase SQL editor, in order): `213_payments_1.sql`, then `213_payments_2.sql`. (Already run for the earlier gateway? Nothing new to run: the payment records are gateway neutral.)
6. Pay a small test order with the Test key and salt. When it works, switch the secrets to your live key and salt and remove `PAYU_BASE`.

## What happens to the money

PayU settles what customers pay into **your PayU account** (and then your bank). The app records each payment in
`services_payments` and marks the order, ride or item paid. It does **not** pay shops, riders, drivers or sellers by itself.
You pay partners from your account. Paying partners automatically, and withdrawals from the app, need PayU's payout
product, which is a separate activation with PayU.

Collecting money for others and paying it on is a regulated activity in India. Check with PayU and your accountant before you hold partners' money.

## Delivery partner fee

The delivery partner fee is still paid **directly to the rider** on arrival. Online payment for an order covers the items, GST and
DhundoNow's delivery fee only.

## UPI QR, and paying partners (withdrawals to UPI)

**UPI QR.** On an order card, "Pay the shop with a UPI QR" shows a QR code made from the shop's own UPI id and the exact amount.
Scan it with PhonePe, Google Pay, Paytm or BHIM, or tap "Open my UPI app" on the same phone. This money goes straight to the shop
(nothing passes through DhundoNow), so the customer taps "I have paid" afterwards. The shop adds its UPI id in My business > Payments.

**Earnings and withdrawals.** When a customer pays online (PayU), the partner's share is credited to their wallet:
a shop gets the items of the order, a driver gets the ride fare, a seller gets the item price. DhundoNow keeps its delivery fee and the GST.
The delivery partner fee is paid by the customer straight to the rider. Partners withdraw from Account > Wallet to their UPI id
(a new UPI id works after 24 hours, as a safety hold). The admin console lists the requests: pay each one from your PayU/bank/UPI app and mark it paid.
Run `214_earnings.sql` after `213_payments_2.sql`.

**Paying out automatically** (no admin step) needs PayU's payout product, a separate activation with PayU and its own API
credentials. When you have it, ask for the payout step to be connected to the same withdrawal list.

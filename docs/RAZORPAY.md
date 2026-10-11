# Online payment with Razorpay (UPI, scan a QR, cards)

Customers can pay for an **order**, a **ride fare** or a **second-hand item** from the app.
Razorpay's checkout shows UPI apps, a **QR code to scan** (on a computer), cards and net banking.

The amount is always worked out on the server from the order, ride or item. The phone cannot change it.
Nothing is marked paid until Razorpay tells our server (a signed webhook).

## Set up (once)

1. **Razorpay dashboard** (use Test mode first): Settings > API Keys > generate a key. You get a Key Id and a Key Secret.
2. **Supabase secrets** (Project > Edge Functions > Secrets). Never put these in the code or in GitHub:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET` (you choose it in step 4)
3. **Deploy the two functions**
   ```
   supabase functions deploy razorpay-order
   supabase functions deploy razorpay-webhook --no-verify-jwt
   ```
4. **Razorpay webhook**: Settings > Webhooks > Add. URL: `https://<your-project>.supabase.co/functions/v1/razorpay-webhook`.
   Active events: `payment.captured` and `order.paid`. Secret: the same text as `RAZORPAY_WEBHOOK_SECRET`.
5. **SQL** (Supabase SQL editor, in order): `213_payments_1.sql`, then `213_payments_2.sql`.
6. Pay a small test order in Test mode, then switch to Live keys (update the secrets) when ready.

## What happens to the money

Razorpay pays what customers pay into **your Razorpay account** (settled to your bank). The app records each payment in
`services_payments` and marks the order, ride or item paid. It does **not** pay shops, riders, drivers or sellers by itself.
Partners are paid out of your account by you. Paying partners automatically (and withdrawals to a bank or UPI id from the app)
needs Razorpay's payout product (RazorpayX / Route), which is a separate activation and KYC with Razorpay.

Rules to be aware of: collecting money for others and paying it on is a regulated activity in India (RBI payment aggregator rules).
Razorpay Route is built for this; check with them and your accountant before you hold partners' money.

## Delivery partner fee

The delivery partner fee is still paid **directly to the rider** on arrival. Online payment for an order covers the items, GST and
Dhundo's delivery fee only.

# Payments: everything to switch on, in order

Do these once. Each step says where. The code is already in the repository.

## 1. SQL (Supabase > SQL editor). Paste and run each file, in this order. Skip any you already ran.

| # | File | What it adds |
|---|------|--------------|
| 1 | `213_payments_1.sql` | payments table, what a person may pay for |
| 2 | `213_payments_2.sql` | marking a payment paid (only the server can) |
| 3 | `214_earnings.sql` | partners' earnings go to their wallet |
| 4 | `215_wallet_1.sql` | wallet top-up as a payment, one price check |
| 5 | `215_wallet_2.sql` | pay from wallet, settle a payment |
| 6 | `216_refunds.sql` | a cancelled paid order or item is refunded to the wallet |
| 7 | `217_admin_payments.sql` | the admin Payments tab |
| 8 | `219_booking_pay_1.sql`, `_2`, `_3` | paying a booked worker, hired vehicle or item by wallet, PayU, QR or cash; refunds |
| 10 | `221_admin_refunds_1.sql`, `221_admin_refunds_2.sql` | admin-only refunds to a person's wallet or UPI id |
| 11 | `222_withdraw_1.sql`, `222_withdraw_2.sql` | withdraw any amount (min ₹100) to UPI or a bank account; admin sees a masked account and can reveal it (logged). Needs the Vault key `dhundo_bank_key` (see 155_part3) before bank details can be saved. Payout itself is manual until PayU payouts are active. |
| 12 | `223_pay_guard_1.sql`, `223_pay_guard_2.sql` | no double payment: a PayU payment for something already paid (cash/QR/earlier), or with a different amount, credits nobody and shows in Admin → Payments as "Needs refund". Redeploy `payu-callback` too. |
| 9 | `220_payments_received.sql` | "Payments received" list on the wallet screen |
| 8b | `218_pay_flags.sql` | paid / not paid for rides and the delivery partner fee, shown to driver and rider; QR for the customer |

Also needed for the other new screens (run if you have not): `212_support_1/2/3.sql`.

## 2. PayU key and salt
PayU dashboard > Test Mode > Developers > API Keys (test). Live: Payment Gateway > Web Integration > Key Salt Details
(live only appears after PayU finishes your business onboarding).

## 3. Secrets and the two functions (one command)
On the server, from the project folder:
```
bash scripts/payments-setup.sh
```
It asks for the site address, whether you are testing, the key and the salt (hidden), sets the Supabase secrets and deploys
`payu-order` and `payu-callback` (with the JWT check off for the callback).

## 4. Check the key, salt and address before using the app
```
PAYU_KEY=yourkey PAYU_SALT=yoursalt PAYU_BASE=https://test.payu.in/_payment node scripts/payu-check.mjs
```
Leave `PAYU_BASE` out for live. It tells you whether PayU accepts the hash. Nothing is charged.
If it says the hash is wrong, the key, salt or address do not match (test and live mixed, or the other salt if PayU shows two).

## 5. PayU webhook (optional, recommended)
PayU dashboard > Webhooks > payment success: `https://nowhtdsuestyduzqtcks.supabase.co/functions/v1/payu-callback`

## 6. Try it
Account > Wallet > Add money > 10 rupees. You go to PayU, pay with a test option, come back, and the balance rises.
Admin console > Payments shows the payment as Paid.

## What still needs PayU's payout product
Withdrawals are requested in the app and paid by you from the admin console. Paying partners automatically is a separate PayU activation.

## Who gets what on an order

The customer pays: items + GST on the items + DhundoNow's small fee + GST on that fee. The delivery partner fee is paid directly to the rider. The shop or restaurant is credited the item total only. Item GST and the fee's GST are held by DhundoNow (as the platform) and counted in the Admin GST report, so they are not credited to the shop's wallet.

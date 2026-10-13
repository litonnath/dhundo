# Checking the phone with a one-time code

Rewards (the Rs 20 listing bonus, the Rs 10 referral) and withdrawals are paid only to an account whose phone
number has been checked with a code sent by SMS. Sign-in stays phone + PIN.

## Set up (once) -- WhatsApp code, no SMS and no DLT
1. Meta Business: developers.facebook.com, create an app, add WhatsApp, add your business phone number
   (a number not already on the WhatsApp app). Create a System User token that never expires (WA_TOKEN).
2. Message templates: create one of category Authentication (add the "copy code" button). Wait for approval,
   usually minutes. Note its name (WA_TEMPLATE) and language.
3. Run sql/240_phone_otp.sql.
4. `supabase functions deploy phone-otp`, then set secrets:
   `supabase secrets set WA_TOKEN=... WA_PHONE_ID=<phone number id> WA_TEMPLATE=<name> WA_LANG=en OTP_SECRET=<long random text>`
5. Deploy the app. In Supabase Authentication, Providers, Phone can stay off.
Cost: Meta charges about Rs 0.115 per authentication message in India; the first 1000 service chats a month are free.
Limits built in: one code per 40 seconds, 5 per day, 5 wrong tries, valid 10 minutes.

## How it works
- After sign-up the app offers to check the phone; the wallet keeps a red reminder until it is done.
- Rewards waiting for that account are paid the moment the code is accepted.
- An account that never checks its phone keeps working as before but earns and withdraws nothing.
- Older rewards already paid are left alone.

## Cost
One WhatsApp message per person, once (plus resends), about Rs 0.115 each.

## Without a template (the person messages us) -- no approval wait, no cost
1. Run sql/241_phone_claim.sql.
2. Secrets: `supabase secrets set --project-ref <ref> WA_BUSINESS_NUMBER=919560677568 WA_VERIFY_TOKEN=<text you choose> WA_APP_SECRET=<Meta app secret>`
   (Meta app secret: developers.facebook.com, your app, App settings, Basic, App secret, Show.)
3. `supabase functions deploy phone-otp --project-ref <ref>` and
   `supabase functions deploy wa-webhook --project-ref <ref> --no-verify-jwt`.
4. Meta: your app, WhatsApp, Configuration, Webhook: Callback URL
   `https://<ref>.supabase.co/functions/v1/wa-webhook`, Verify token = WA_VERIFY_TOKEN, click Verify and save.
   Then under Webhook fields subscribe to `messages`.
5. In the app the person taps Open WhatsApp, presses send on the ready message, and is verified within seconds.

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

## Firebase Phone Auth (SMS from Google, no DLT) -- the code arrives and the person types it
1. console.firebase.google.com: Add project (DhundoNow). Build, Authentication, Get started, Sign-in method: enable **Phone**.
2. Authentication, Settings, Authorized domains: add `dhundonow.shortlistone.com`.
3. Project settings (gear), General, Your apps: add a **Web** app. Copy its config (apiKey, authDomain, projectId, appId).
4. India SMS may need billing: Project settings, Usage and billing, upgrade to the pay-as-you-go (Blaze) plan; set a budget alert.
   (Test with a "Phone numbers for testing" entry under Authentication, Sign-in method, Phone: no SMS is sent or charged.)
5. In `src/config.js` add:
   `export const FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", appId: "..." };`
6. Supabase: `supabase secrets set --project-ref <ref> FIREBASE_API_KEY=<the same apiKey>` and
   `supabase functions deploy phone-firebase --project-ref <ref>`.
7. Publish the app. When FIREBASE_CONFIG is present the sheet sends an SMS and asks for the code; without it the app uses the WhatsApp-message way.

## Reset a forgotten PIN (sign-in screen, "Forgot PIN? Reset it with a code")
Needs the Firebase setup above (FIREBASE_CONFIG in src/config.js, Phone sign-in on, the domain allowed, India allowed in the SMS region policy).
1. Run sql/247_pin_reset.sql.
2. `supabase functions deploy pin-reset --project-ref <ref> --no-verify-jwt` (not signed in when it is called). It uses the secret FIREBASE_API_KEY.
3. The person enters their phone number, types the SMS code, chooses a new 6-digit PIN twice, and signs in with it.
The server checks the code with Google, allows 5 resets per number and 20 per address an hour, and accepts only a code confirmed in the last 10 minutes.
A test number from the Firebase console (fixed code) works for trying it without sending an SMS.

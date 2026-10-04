# Checking the phone with a one-time code

Rewards (the Rs 20 listing bonus, the Rs 10 referral) and withdrawals are paid only to an account whose phone
number has been checked with a code sent by SMS. Sign-in stays phone + PIN.

## Set up (once)
1. Choose an SMS provider that Supabase supports and that works in India. Textlocal is the Indian one in the list;
   Twilio, Twilio Verify, MessageBird and Vonage also work. India requires DLT registration of your business and
   your message template with the provider (they guide you; allow a few days).
2. Supabase dashboard: Authentication, Providers, Phone. Switch it on and enter the provider details. Switch on
   "Confirm phone". Under Rate Limits keep SMS per hour low (for example 30).
3. Run sql/109_parts/109_part1.sql, 109_part2.sql, 109_part3.sql and 109_part4.sql in that order, each as its own query.
4. Deploy the app (npm run deploy).

## How it works
- After sign-up the app offers to check the phone; the wallet keeps a red reminder until it is done.
- Rewards waiting for that account are paid the moment the code is accepted.
- An account that never checks its phone keeps working as before but earns and withdraws nothing.
- Older rewards already paid are left alone.

## Cost
One SMS per person, once (plus resends). Roughly Rs 0.15 to 0.25 each in India.

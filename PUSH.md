# Alerts when the app is closed (web push)

The app side is built. Nothing is sent until you do these steps once. Alerts
are sent for: a new order (to the shop), order accepted / ready / delivered /
declined (to the customer), a new delivery job and a new ride request (to
online riders and drivers within 10 km and 8 km), and a driver accepting a
ride (to the passenger).

1. **Run the SQL**: `sql/118_parts/118_part1.sql` to `118_part6.sql`, in order.

2. **Make a key pair** (once, on any computer with Node):

       npx web-push generate-vapid-keys

   Keep the private key secret. The public key goes in the app.

3. **Deploy the sender** (needs the Supabase CLI, `npm i -g supabase`):

       supabase login
       supabase link --project-ref nowhtdsuestyduzqtcks
       supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
           VAPID_SUBJECT=mailto:you@example.com PUSH_SECRET=choose-a-long-random-text
       supabase functions deploy push-send --no-verify-jwt

4. **Connect the queue to it**: Supabase dashboard > Database > Webhooks >
   Create: table `services_notify_queue`, event Insert, type "Supabase Edge
   Functions", function `push-send`, and add the HTTP header
   `x-push-secret` with the same PUSH_SECRET text.

5. **Put the public key in the app**: in `src/config.js` add

       export const VAPID_PUBLIC_KEY = "the public key";

   then `npm run deploy`. People now see "Alerts when the app is closed" in
   the Menu, in the shop and rider dashboards, in My orders and while waiting
   for a ride. They tap to allow it; the phone asks permission.

What is stored: for each phone that said yes, a push address and two keys,
and the language. Alerts the phone cannot receive are never queued, and queue
rows older than a day are deleted by the sender. Turning alerts off in the
app removes the phone's row.

Test: allow alerts on your phone, close the app, then place an order for a
shop that is yours (from another account). The shop phone should buzz.

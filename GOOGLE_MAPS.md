# Google map, with a monthly allowance

1. Google Cloud: create a project, enable billing, enable **Map Tiles API** (the SKU is "Map Tiles API: 2D Map Tiles (India)", Essentials: 700,000 requests a month free in India).
2. Create an API key. Restrict it to the website (HTTP referrers) and, for the
   Android app, to the app. Under Quotas set a hard daily limit and add a
   budget alert.
3. On the server add one line to `~/services-app/src/config.js` (it is kept
   across deploys):  `export const GOOGLE_MAPS_KEY = "AIza...";`
4. Run `sql/99_gmap_budget.sql`. The allowance is 6000 map sessions a month,
   shared by all devices; change it with `update services_gmap_cap set cap = N;`
5. Redeploy.

Past the allowance, with no key, or if Google's tiles fail to load, the app
draws the free map (Esri satellite / OpenStreetMap) and the OpenStreetMap
shop labels instead. Google counts Map Tiles per tile request (about 30-100 per map open),
so 6000 opens stays inside the 700,000 free requests. Check the usage page
after a month and raise the cap if there is room.

## Road distance on the cards (Routes API)

Cards show the driving distance, for example "6.4 km · by road". It is computed on the server so other
peoples positions never reach the phone.

1. Google Cloud: enable **Routes API**. Create a SECOND API key for it. This one is called from the
   server, so it cannot be restricted by website; restrict it by API (Routes API only) and keep it secret.
2. Run `sql/107_profile_location.sql` (it adds a monthly allowance, 1500 calls; change it with
   `update services_gmap_caps set cap = 3000 where kind = 'routes';`).
3. Deploy the function (Supabase CLI, once per change):
   `supabase secrets set GOOGLE_ROUTES_KEY=AIza...` then
   `supabase functions deploy road-distance`
4. Past the allowance, or if anything fails, cards keep the straight-line distance.
Check usage: `select * from services_gmap_usage where month like 'routes-%';`

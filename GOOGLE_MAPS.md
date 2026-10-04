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

## Road distance on the cards (Routes API, from the phone)

Cards show the driving distance, for example "6.4 km - by road", asked of Google straight from the phone.

1. Google Cloud: enable **Routes API** and add it to the SAME website-restricted key as the map
   (API restrictions: Map Tiles, Geocoding, Places, Routes). No second key and no server function.
2. Run `sql/107_profile_location.sql` (allowance row, 1500 calls a month) and `sql/108_public_positions.sql`.
3. Deploy the app.

Privacy: the phone is given only positions that are safe to give. The exact spot of a shop that shows its
address; the position rounded to about 1 km for everybody else (the card then says area only). Live positions
are never included.

A key in a browser can be copied by a script that fakes the website name. The monthly counter above only
counts calls made by the app, so the real limit is on Google's side: in Google Cloud open
APIs & Services, Routes API, Quotas, and set a daily limit; keep the budget alert on.

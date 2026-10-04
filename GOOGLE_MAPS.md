# Google map, with a monthly allowance

1. Google Cloud: create a project, enable billing, enable **Map Tiles API**.
2. Create an API key. Restrict it to the website (HTTP referrers) and, for the
   Android app, to the app. Under Quotas set a hard daily limit and add a
   budget alert.
3. On the server add one line to `~/services-app/src/config.js` (it is kept
   across deploys):  `export const GOOGLE_MAPS_KEY = "AIza...";`
4. Run `sql/99_gmap_budget.sql`. The allowance is 8000 map sessions a month,
   shared by all devices; change it with `update services_gmap_cap set cap = N;`
5. Redeploy.

Past the allowance, with no key, or if Google's tiles fail to load, the app
draws the free map (Esri satellite / OpenStreetMap) and the OpenStreetMap
shop labels instead. Google bills Map Tiles per tile request, not per session,
so check the free tier on Google's pricing page and pick the cap accordingly.

# Companies that handle Dhundo data for us

The DPDP Act keeps Dhundo responsible for personal data even when another company handles it, so each of
these needs a written agreement (their standard data-processing terms are fine) and a note of where the data sits.
Tick each when done.

| Company | What it receives | Where to find the terms | Done |
|---|---|---|---|
| Supabase | Everything in the database and the stored photos and IDs. Check the project region in Project Settings, General | supabase.com/legal/dpa (sign it from the dashboard under Legal) | [ ] |
| Contabo (server) | The app files, nginx logs with visitor IP addresses | contabo.com, data processing agreement in the customer panel | [ ] |
| Google (Maps tiles, address lookup, place search) | Map positions and typed search words, the visitor IP address | Google Cloud, Cloud Data Processing Addendum, accepted in the console | [ ] |
| Esri (satellite pictures) | Map tile requests with the visitor IP address | Esri terms of use | [ ] |
| OpenStreetMap services (Photon, Nominatim, Overpass) | Map positions and search words, sent through your server proxy where set up | Their usage policies. No contract: use the proxy (geo-proxy.sh) so visitors addresses do not reach them | [ ] |

After signing, write the region of each into the privacy notice if you want to name it. If a service is
outside India, nothing in the Act forbids it today unless the Government restricts that country, but you
must still protect the data and say so in the notice (the notice already says some services may be outside India).

Retention is set in sql/105_parts/105_part2.sql (services_purge_old). Run it monthly, or schedule it in
Supabase under Database, Cron.

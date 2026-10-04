# Security review of Dhundo (code and database scripts in this repository)

Method: read the app source, every SQL file, the deploy and nginx scripts; searched for secrets (tree and git
history), dangerous browser calls, missing row security, unsafe database functions, open grants; ran `npm audit`.
NOT possible from here: scanning the live server, reading the Supabase dashboard settings, or reading the
storage rules made in the dashboard. Those are listed at the end as things to check yourself.

## Good (checked, nothing found)
- No keys or passwords in the code or in git history. config.js is ignored by git. The service key is typed at a
  prompt by the import script, never stored.
- No cross-site scripting sinks: no innerHTML, dangerouslySetInnerHTML, eval, document.write, javascript: links.
  The one place that builds HTML (map shop labels) escapes every name first. Links to other sites carry rel=noreferrer.
- All 18 tables have row-level security. Every SECURITY DEFINER function pins its search_path (no hijack).
- Admin functions all check services_is_admin. Dynamic SQL uses %L quoting. Contact numbers are never in search results.
- npm audit: 0 known vulnerabilities. No source maps shipped.

## Problems, most serious first
| # | Severity | Problem | Why it matters | Fix |
|---|---|---|---|---|
| 1 | HIGH | Anyone can sign up with any phone number (no code) and then reveal 40 contacts an hour per account | A script makes accounts and copies your workers' phone numbers (spam, harassment, selling the list) | Require the checked phone (sql/109) to reveal a contact; lower the limit to about 15 an hour |
| 2 | HIGH | Accounts are protected by a 6-digit PIN (a million combinations) and the lock-out after wrong tries is only in the browser | Sign-in limits depend on Supabase defaults per address; a spread-out attack can guess PINs. An account now holds money and can request a withdrawal | Make a withdrawal need a fresh one-time code and a 24-hour hold; lock an account server-side after 10 wrong PINs; tell the owner by SMS when a UPI id is added or changed |
| 3 | HIGH | The admin account is also phone + 6-digit PIN, and admins can open ID photos and every phone number | One guessed admin PIN exposes everything | Give admins a long password or a second factor; keep the admin list to one or two accounts; the access log (sql/105) helps afterwards |
| 4 | HIGH (check) | How an admin is decided (services_is_admin) is not in this repository, and Dhundo shares one Postgres with ShortlistOne | If "admin" is read from the hiring product's table, an admin or a bug there is an admin here, and the reverse. Row security on the hiring tables is outside this review | Read the function in Supabase (Database, Functions). Make Dhundo admins their own list. Review ShortlistOne tables the same way |
| 5 | MEDIUM | Listing photo and avatar addresses are stored as typed, with no check that they point to your storage | A person can point a photo at any web address: tracking of everyone who views the card (their IP), unwanted pictures, broken layout | In the database, accept only addresses starting with your Supabase storage path (the ads already do this; listings do not) |
| 6 | MEDIUM | nginx sends no security headers (no Content-Security-Policy, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy) and shows its version | The site can be put inside another page (click-hijacking); weaker protection if a script ever gets in | Add the headers in the site config (a ready block is in the section below) |
| 7 | MEDIUM | The Google allowance counter (services_gmap_take) can be called by anyone with the public key | A script can use up the month's tile, address, search and road-distance allowance in minutes; the app then falls back to the free map. It cannot raise your bill | Set daily quotas in Google Cloud; keep the budget alert |
| 8 | MEDIUM | The 10-second database timeout (sql/97) applies to anonymous callers, and place search is open to anyone | Easier to tie up the database with heavy searches | Keep the nginx and Supabase rate limits on; consider 6 seconds for anonymous callers once the indexes are warm |
| 9 | LOW | Sign-up says "this number is already registered" | Lets a stranger test whether a phone number has an account | Acceptable; the one-time code at sign-up would reduce it |
| 10 | LOW | The session is kept in the browser's local storage | Standard for this kind of app; it is stolen only if a script runs on the page, which problems 6 and the absence of script sinks make unlikely | Fixed by the headers in 6 |
| 11 | LOW | The Google map key is in the site code | Normal for map keys; abuse is limited by the website restriction and quotas | Restrict to your site and the four APIs; daily quotas |

## Server checks to run yourself (I cannot reach the server)
```
ss -tulpn                      # what listens; expect only 22, 80, 443 (and nothing for Postgres)
ufw status verbose             # firewall on? allow 22, 80, 443 only
grep -E "PermitRootLogin|PasswordAuthentication" /etc/ssh/sshd_config
last -n 20                     # who logged in
```
Do: SSH by key only, no password login, no root login (use a normal user with sudo), install fail2ban and
unattended-upgrades, keep nginx and the system updated. Postgres is hosted by Supabase, so it is not on your
server; do not open any database port.

## Supabase dashboard checks
- Storage: bucket services-ids must be PRIVATE, upload allowed only into the person's own folder, file size limit
  (5 MB) and image types only. services-photos may be public but with the same folder and size rules.
- Authentication: switch on the phone provider (for the code), set rate limits low, switch off anything unused.
- API: keep the service key out of the app and out of chat; rotate it if it was ever pasted anywhere.
- Turn on database backups (Pro plan) and email alerts.

## Headers to add (nginx, inside the server block for the site)
```
server_tokens off;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(self), camera=(self), microphone=()" always;
add_header Strict-Transport-Security "max-age=31536000" always;
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://tile.googleapis.com https://maps.googleapis.com https://places.googleapis.com https://routes.googleapis.com https://overpass-api.de https://overpass.kumi.systems https://photon.komoot.io https://nominatim.openstreetmap.org; script-src 'self'; frame-ancestors 'none'" always;
```
Test in a private window after adding; if the map or a font stops loading, the browser console names the blocked address.

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
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://tile.googleapis.com https://maps.googleapis.com https://places.googleapis.com https://routes.googleapis.com https://overpass-api.de https://overpass.kumi.systems https://photon.komoot.io https://nominatim.openstreetmap.org https://router.project-osrm.org; script-src 'self'; frame-ancestors 'none'" always;
```
Test in a private window after adding; if the map or a font stops loading, the browser console names the blocked address.

---
## Fixes added after the review (run, then tick)
| # | What was done | You must |
|---|---|---|
| 1 | sql/110_parts/110_part1 and 110_part2: contact reveal limit is now 15 an hour, and can require a checked phone | Run 110 part 1 and 2. After the SMS provider works and people have checked their phones, run: `update services_settings set value = 'on' where name = 'reveal_needs_phone';` (it is OFF until then so calling does not stop working) |
| 2 (part) | sql/110_part3: a withdrawal cannot be marked paid for 24 hours; the admin screen data flags a UPI id never paid before (part 6) | Run part 3 and part 6. In Supabase, Authentication, set sign-in rate limits low, and turn on CAPTCHA for sign-up and sign-in; if you are on the Pro plan, add the password-attempt hook to lock an account after 10 wrong PINs. I cannot set these from the code |
| 3 | Not fixed in code. Needs a second factor for admins | In Supabase, Authentication, MFA: switch on. Tell me and I will add the admin screen that asks for the code and make admin functions require it |
| 4 | Not fixable from here | Run `select pg_get_functiondef('public.services_is_admin'::regproc);` in the SQL editor and send me the result |
| 5 | sql/110_part4: new or changed listing photo and avatar addresses must be in your photo storage | Run part 4. Optional extra lock: set storage_prefix as shown in the file |
| 6 | security-headers.sh | On the server: `cd ~/services-app && sudo bash security-headers.sh`. It starts in report-only mode; use the site, check the browser console, then `sudo CSP_ENFORCE=1 bash security-headers.sh` |
| 7 | sql/110_part5: the Google allowance also has a daily cap (a twentieth of the month) | Run part 5. Also set daily quotas in Google Cloud |
| 8 | sql/110_part4: anonymous timeout lowered from 10 to 6 seconds | Run part 4 |

## Admin two-step sign-in (item 3)
1. Supabase: Authentication, Multi-Factor, TOTP enabled (done).
2. Run sql/111_parts/111_part1.sql then 111_part2.sql. Needs 110_part1 first.
3. Deploy. Each admin signs in, opens Manage, and presses Set up in the card at the top: scan the picture with an
   authenticator app, type the 6-digit code, Turn on. Do this for EVERY admin account.
4. From the next sign-in, an admin is asked for the code after the PIN.
5. Only when every admin has done 3, switch the requirement on (one line in the SQL editor):
       update services_settings set value = 'on' where name = 'admin_needs_mfa';
   From then on every admin function and every admin storage rule refuses a session without the code.
   To undo in an emergency: update services_settings set value = 'off' where name = 'admin_needs_mfa';

## Update after the business features (bank, payouts, ratings, schedule, documents)
Done:
- Bank account numbers are now ENCRYPTED in the database (sql/155_parts/155_part3.sql); the key lives in Supabase Vault and
  only the last 4 digits reach the phone. Create the key first (see the top of that file).
- A new UPI id for a withdrawal is held for 24 hours (sql/156_hardening_part1.sql), so a stolen session cannot cash out at
  once. Withdrawals already needed a checked phone, a rate limit and a minimum.
- PIN guessing: 10 wrong tries lock the account for 15 minutes on the server (sql/156_hardening_part2.sql). It only works
  once the hook is switched on in Supabase (Authentication, Hooks, Password verification attempt).
- Ratings only for a delivered order; the sales report CSV neutralises spreadsheet formulas; the invoice window uses no
  inline script (the Content-Security-Policy forbids it) and escapes every value.
- The resume-orders function can only be called by a signed-in user.
- Re-read the order, ride, delivery job, second-hand order, chat and withdrawal functions: each one takes the account from
  the signed token and checks the caller is a party to the record. The money and delete functions are not callable from
  the app. The app hiding the business or customer view is only display; the database does the checking.
Still to do: admin accounts (a second factor or a long password), one-time code for withdrawals, checking how
services_is_admin is decided, and the nginx headers (security-headers.sh) on the live server.

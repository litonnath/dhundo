# Consent and rate limits

What the app asks before it stores or reads personal data, what the database
refuses without it, and how often each action is allowed.

## Consent

Six purposes. Each is a yes/no kept on the device and, for a signed-in person,
in `services_consents` (with a log of every change in `services_consent_log`).
Both are removed when the account is deleted.

| Purpose | Asked when | What the database refuses without it |
|---|---|---|
| `location` | first "use my location" tap, the home card, the map picker's "my position" | a listing position taken from GPS |
| `live` | switching on "Available now" | the live position (and it is deleted on withdrawal) |
| `account` | the tick box on sign-up | (recorded; the account is created after the tick) |
| `listing` | saving a listing | creating or editing a listing |
| `market` | posting an item | creating or editing an item |
| `profile` | saving email, address, town or PIN | those profile fields |

* Nothing reads the phone's position on its own any more. A returning visitor
  who already said yes is located on load; everyone else is asked by the card
  on the home screen or by the button that needs it.
* Account → Privacy lists all six with Allow / Withdraw. Withdrawing
  `location` removes the position from the saved place; withdrawing `live`
  switches "Available now" off and deletes the position on the server.
* The consent texts name what is stored, who sees it, and the third party
  involved (OpenStreetMap receives coordinates to name the area).
* Raise `CONSENT_VERSION` in `src/consent-core.js` when what a purpose covers
  changes, and everybody is asked again.

## Rate limits (enforced in the database, `sql/93_parts`)

Fixed windows, counted per account (per IP for new accounts). Over the limit
the request fails with HTTP 429 `rate_limited`; the app shows it in the
person's language.

| Action | Limit |
|---|---|
| New accounts | 30 per hour per IP |
| Consent changes | 60 per hour per account |
| New listing | 5 per day |
| Listing edits | 60 per day |
| Live position updates | 240 per hour |
| Items posted | 10 per day |
| Item edits | 60 per day |
| Item reports | 20 per day |
| Profile saves (address, email, PIN) | 30 per hour |
| Saving an exact position | 30 per hour |
| Referral code tries | 10 per hour |
| Phone numbers opened (already existed) | 40 per hour |
| Item contacts opened (already existed) | 40 per day |

Admins, other people acting on a row (a view, a report) and internal jobs are
not counted. To change a number, edit it in part 3 or 4 and run that part again.

In the browser: five wrong sign-in PINs lock the form for a minute, doubling
each time up to fifteen minutes; a location read is not repeated within four
seconds (OpenStreetMap asks for about one request a second).

## Not covered by the database, set these in Supabase

* **Sign-in and sign-up per IP**: Authentication → Rate Limits. The PIN is six
  digits, so this limit (and the lock above) is what stands between a guesser
  and an account. Lower "sign-ins" and "sign-ups" than the defaults.
* **Bot protection**: Authentication → Attack Protection → CAPTCHA (Turnstile
  or hCaptcha) if sign-ups are being scripted.
* **Photo uploads**: Storage → the photo buckets → file size limit and allowed
  types. Uploads go straight to storage, so a database limit cannot count them.
* **Search and lookup functions** (browse, place search, PIN lookup) are
  read-only and cannot count calls; they are protected by what Supabase puts in
  front of the API, not by this code.

## Location

* The home screen and both listing forms use one control: type a road, shop,
  landmark or village and tap it, or use the phone's position, then move the
  pin to the exact house. There is no PIN code box and no state list; the PIN
  comes from the spot (the village's post office, else the map's own postcode).
* A listing has its own location. Choosing it never moves the location someone
  is browsing from.
* An exact position (phone GPS, a pin placed on the map, a shop or road chosen
  from the search) is saved as the listing's position and is not overwritten by
  later edits (`sql/94_parts`). A village chosen from the search is only the
  middle of the village, so it is flagged and not saved as exact.
* A saved browsing location whose coordinates do not fit its state is dropped.
* Distances shown are straight-line, as the crow flies. Roads are longer.

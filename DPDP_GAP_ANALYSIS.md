# Dhundo against the DPDP Act 2023 and the DPDP Rules 2025

Not legal advice. A lawyer who does Indian data-protection work should read it before you rely on it.
The Rules were notified on 13 November 2025. Most duties (notice, safeguards, breach, erasure, children, rights)
apply 18 months later, about **May 2027**. Consent-manager rules apply after 12 months. The Act applies to
everyone who handles the personal data of people in India, whatever the size of the business.

## What Dhundo already does well
- Consent asked for each purpose, at the moment the data is saved (location, live position, account, listing, market, profile), in 12 languages.
- Consent can be withdrawn from the same screen, and the database refuses the action without a consent record (triggers).
- Account deletion exists, with a queue that removes stored files.
- ID documents sit in a private bucket and the app tells people to cover the Aadhaar number.
- Rate limits protect sign-in, search, directions and withdrawals.

## Gaps, most serious first

| # | Duty (Act / Rules) | What Dhundo does today | What to do |
|---|---|---|---|
| 1 | **Notice** (s5, Rule 3): plain-language notice before or with each consent, listing the data, the purpose, how to withdraw, how to complain to the Board | Short consent texts per purpose. No full privacy notice or privacy policy page anywhere in the app or website | Write one notice page, link it from sign-up, the consent sheets, Account and the website footer, in all 12 languages |
| 2 | **Grievance redressal** (s8(10), Rule 14): publish contact details of a person who answers rights requests | None published | Name an owner (you), an email and a response time. Show it in the app and notice |
| 3 | **Children** (s9, Rule 10-12): anyone under 18 needs verifiable parental consent; no tracking or targeted ads aimed at children | Sign-up has no age question. The platform lists workers and takes ID, so under-18 workers are possible | Add an age or date-of-birth declaration at sign-up. Under 18: block, or add a parental-consent flow. Do not list minors |
| 4 | **Data principal rights** (s11-14, Rule 14): access a summary of data, correct, erase, nominate someone, get a reply within 90 days | Account deletion exists. No way to see or download your data, no nomination, no request log | Add "My data" (view and download as a file) and a request form with a log and a 90-day clock |
| 5 | **Breach notification** (s8(6), Rule 7): tell the Board and each affected person within 72 hours | No written plan | Write a one-page breach plan: who decides, what is logged, how to message users, the Board template |
| 6 | **Security safeguards** (s8(5), Rule 6): encryption, access control, monitoring, logs kept 1 year, backups, contracts with processors | HTTPS, row-level security, private ID bucket. No access log for admins viewing ID documents or phone numbers. No written processor contracts | Log every admin view of an ID or a contact. Keep logs a year. Sign the data-processing terms with Supabase, Google and your server host |
| 7 | **Retention and erasure** (s8(7), Rule 8): erase when the purpose ends or consent is withdrawn; tell the person 48 hours before erasure for the inactive-user case | Blocked-phone list keeps phone digits after an admin deletion (sql 71). Wallet ledger keeps rows. Old consent rows kept | Write a retention table (what, why, how long). Keep the ledger and blocked list only for the period a law or fraud control needs, and say so in the notice |
| 8 | **Third parties and cross-border** (s16, Rule 15): allowed unless the Government restricts a country; you stay responsible | Supabase (check the project region), Google Maps (tiles, address lookup, place search send coordinates and search text to Google), Photon, Nominatim and Overpass (public servers receive coordinates), Esri tiles | Name each processor in the notice. Check the Supabase region. Prefer the server-side proxy so people addresses are not sent from their browsers |
| 9 | **Consent form quality** (s6): free, specific, informed, unconditional, clear affirmative action | Mostly good. Sign-up tick box exists. The referral code links one person to another without asking the invited person | Show the invited person that a referral is recorded and what the referrer sees (their name in the wallet history) |
| 10 | **Legitimate uses and publication of contact** (s7) | A worker phone number is revealed to signed-in customers by design | Say clearly in the listing consent that the number is shared with customers who tap Call. Already mostly covered; make it explicit |
| 11 | **Money and identity data** | UPI IDs and withdrawal records are stored | Keep them out of logs, restrict admin access, and include in the retention table |
| 12 | **Significant Data Fiduciary** duties (DPO in India, audit, impact assessment) | Not applicable at this size | Revisit if the Government notifies you or the user base grows very large |

## Penalties to keep in mind
Up to Rs 250 crore for failing reasonable security safeguards, Rs 200 crore for failing to notify a breach or
the child-data duties, Rs 50 crore for other breaches of the Act.

## A sensible order of work
1. Privacy notice page and grievance contact (gaps 1 and 2): about a day.
2. Age declaration and under-18 block (gap 3).
3. "My data" view and download plus request log (gap 4).
4. Admin access logging (gap 6) and the retention table (gap 7).
5. Written breach plan and processor terms (gaps 5, 6, 8).

Sources: DPDP Act 2023; DPDP Rules 2025 (PIB, 17 Nov 2025).

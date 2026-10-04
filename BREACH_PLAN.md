# Personal data breach plan (one page)

A personal data breach is any loss, leak, unauthorised access or change of personal data: a stolen admin
login, a leaked database key, a bucket made public by mistake, a lost phone with the admin session open.
Under the DPDP Rules 2025 you must tell the Data Protection Board without delay and each affected person
within 72 hours of learning of it.

**Owner:** Liton Nath. **Backup:** name one person who can act if the owner is away.

## First hour: stop it
1. Rotate the keys that may be exposed: Supabase service key and anon key (Project Settings, API), the Google
   Maps key (Google Cloud, Credentials), the server SSH key, the admin account PIN.
2. Sign out all sessions if sign-in may be involved (Supabase, Authentication, Users).
3. If a bucket or table was open: close it, then note when it was open and for how long.
4. Write the time you learned of it. The 72 hours start there.

## First day: find out what happened
- What data: names, phones, PINs (scrambled), ID photos, exact locations, UPI IDs, wallet records.
- Whose data and how many people: query the tables; use services_access_log (sql/105) for admin access.
- How: login stolen, key leaked, bug, insider. Keep logs and screenshots.
- Is it ongoing: confirm it is stopped.

## Within 72 hours: tell people
Message each affected person (WhatsApp or SMS from the number they know) in their language:
- what happened and when, in plain words;
- which of their data was involved;
- what could follow (for example spam calls, misuse of an ID photo, someone using a UPI ID);
- what you did to stop it and what they can do (change PIN, watch for calls, report to you);
- who to write to: the grievance contact in the notice.

Tell the Data Protection Board using the form on its portal, with the same facts and the steps taken.
Keep a copy of both.

## After
Fix the cause, write down what changed, and keep this record for at least a year. Review this plan each year.

This is a working plan, not legal advice. Have a lawyer check the notification wording.

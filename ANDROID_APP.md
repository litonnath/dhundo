# Making DhundoNow a real Android app

There are two ways people can get DhundoNow on their phone. They are not
alternatives — do the first today, the second when you are ready to hand out
a file or put it on the Play Store.

---

## 1. Install from the browser (works now, nothing to build)

The site is already a Progressive Web App: manifest, icons, service worker,
HTTPS. On Android Chrome a person opens `dhundonow.shortlistone.com`, taps the
**Install app** button in the header (or Chrome's ⋮ → *Add to Home screen*),
and gets a DhundoNow icon that opens full-screen with no address bar. It
updates itself every time they open it, because the service worker is
network-first.

On iPhone there is no install button — Safari does not allow one. The person
taps **Share → Add to Home Screen**. The app says exactly that when it
detects iOS.

**What this does not give you:** a file you can send on WhatsApp, and a
listing on the Play Store. That is what the APK is for.

---

## 2. Build an APK (a real installable file)

The app is wrapped in a *Trusted Web Activity* — a thin Android shell around
the same website. Same code, same updates, no second app to maintain. This
is how Twitter Lite, Starbucks and a lot of Indian apps ship.

### Step A — generate the package

Easiest route, no tools to install:

1. Go to **pwabuilder.com**
2. Enter `https://dhundonow.shortlistone.com`
3. It scores the site and offers **Package for stores** → **Android**
4. Settings worth checking before you generate:
   - **Package ID**: `com.shortlistone.dhundo` — this must match
     `public/.well-known/assetlinks.json`, and **can never be changed**
     once the app is on the Play Store
   - **App name**: DhundoNow
   - **Signing key**: choose *Create new* the first time
5. Download the zip. It contains:
   - `app-release-signed.apk` — the file people install
   - `app-release-bundle.aab` — the file the Play Store wants
   - `signing.keystore` and `signing-key-info.txt`
   - `assetlinks.json` — with the real fingerprint in it

### Step B — the part everybody forgets

> **Keep `signing.keystore` and its password somewhere you cannot lose them.**
>
> If you lose that file you can never publish an update to the same Play
> Store listing. Not "it is difficult" — you cannot. You would have to
> publish a new app and ask every user to install it again. Put a copy
> somewhere other than the laptop that built it.
>
> It does not belong in git. `.gitignore` it along with `.env` and the
> `*.pem` files.

### Step C — publish the fingerprint

Open the `assetlinks.json` that PWABuilder generated, copy the
`sha256_cert_fingerprints` value out of it, and paste it into
`public/.well-known/assetlinks.json` in this project, replacing
`REPLACE_WITH_YOUR_SIGNING_FINGERPRINT`. Then redeploy.

Check it is live before installing the APK:

```
curl -s https://dhundonow.shortlistone.com/.well-known/assetlinks.json
```

If that returns the file, the app opens clean. If it returns the app's HTML,
nginx is serving the SPA fallback instead of the file and the APK will show a
browser bar across the top.

### Step D — hand it out

The `.apk` can be sent on WhatsApp or put on the site for download. Android
will warn about installing from an unknown source — that is normal and the
person taps through it. For a listing without that warning, upload the
`.aab` to the Play Console (one-off $25 registration).

---

## Renaming the existing Android app to DhundoNow (and the new address)

The APK you already have (`public/dhundo.apk`, package `com.shortlistone.dhundo`) has the OLD name and the OLD address
(`services.shortlistone.com`) baked inside it. It keeps working as long as the server still answers to the old name, but
it will keep showing "Dhundo". To change it you build a new package:

1. Go to **pwabuilder.com**, enter `https://dhundonow.shortlistone.com`, choose **Package for stores, Android**.
2. Set **App name** and **Launcher name** to `DhundoNow`.
3. **Package ID**: this is the one decision to make carefully.
   - **Not on the Play Store yet:** you may pick a new ID that matches the brand, `com.shortlistone.dhundonow`.
     Then put that ID (and the new fingerprint) in `public/.well-known/assetlinks.json`.
   - **Already on the Play Store:** keep `com.shortlistone.dhundo`. The ID can never change on a listing. The name people
     see is the app name you set here and the title you enter in the Play Console.
4. **Signing key**: choose *Use existing* and upload your old `signing.keystore` if the app is already published
   (otherwise Play will refuse the update). Choose *Create new* only for a brand-new listing. Keep the keystore safe.
5. Download, copy the fingerprint into `public/.well-known/assetlinks.json`, deploy, then check
   `https://dhundonow.shortlistone.com/.well-known/assetlinks.json` returns the file (not the app's HTML page).
6. Replace `public/dhundo.apk` with the new APK if you offer it for download, and upload the `.aab` to the Play Console
   as an update (or a new app).

---

## Which should you do first?

Install-from-browser, today. It costs nothing, it is already built, and it
tells you whether people actually want the app on their home screen before
you spend $25 and a week on store review.

Build the APK when you have a reason to hand someone a file — a shop owner
with a bad connection, a WhatsApp group of mistris, a stall at a market.

# DhundoNow on iPhone

iPhone has no "Trusted Web Activity" like Android, so there are two honest routes.

## 1. Install from Safari (works now, free)
Open `https://dhundonow.shortlistone.com` in **Safari**, tap **Share, Add to Home Screen**. The app opens full screen with its
own icon. On iOS 16.4 and newer, alerts (web push) also work, but only after it has been added to the Home Screen.
Limits: no App Store listing, and Safari may clear saved data for sites not opened for a long time.

## 2. A real App Store app
You need:
- A **Mac** with **Xcode** (free). There is no way around this for building and uploading an iPhone app.
- An **Apple Developer Program** membership (about US$99 a year, check the current price in India).

### Steps
1. Go to **pwabuilder.com**, enter `https://dhundonow.shortlistone.com`, choose **Package for stores, iOS**.
   (Or use Capacitor: `npm i @capacitor/core @capacitor/cli @capacitor/ios`, `npx cap init DhundoNow com.shortlistone.dhundonow --web-dir dist`,
   `npm run build`, `npx cap add ios`, `npx cap sync`, `npx cap open ios`.)
2. **Bundle ID**: `com.shortlistone.dhundonow` (it can never change once published). **App name**: DhundoNow.
3. Open the project in Xcode, choose your Team under Signing, run it on a real iPhone to test.
4. **Product, Archive**, then upload to **App Store Connect** and fill in the listing: name, description, screenshots,
   privacy policy address (`https://dhundonow.shortlistone.com/privacy`), age rating, privacy "nutrition labels".
5. Submit for review.

### What Apple checks (plan for these)
- **A bare website in a frame is often rejected** (Guideline 4.2, "minimum functionality"). The app should feel like an app:
  working push alerts, location, camera for photos and the share sheet. Test these before you submit.
- **Alerts inside a store app**: the web push the site uses does not work inside an app's web view. A store app needs
  native push (APNs). That is extra work on the app and on the `push-send` function. Ask for it if you go this route.
- **Reviewer login**: reviewers cannot receive an SMS. Give them a demo account with a phone number and PIN.
- **Account deletion** must be inside the app. DhundoNow has it (Account, My data).
- **Payments**: orders, rides and worker bookings are real-world services, which may use PayU. Check the wallet top-up
  wording with the current App Store rules before you submit, because stored-value top-ups are looked at closely.
- Location permission text (why you need it) and a working privacy policy.

### Suggested order
Safari install now, Android update (see ANDROID_APP.md), then the App Store app only when you have a Mac, the membership
and the native push work done.

# CAPTCHA at sign-up and sign-in

Supabase now refuses sign-ups with `captcha_failed ... no captcha_token found`
when **Authentication > Attack Protection > CAPTCHA protection** is switched on
but the app sends no token. The app now sends one. You need two things:

1. A free CAPTCHA account and a site (widget) for your domain:
   - Cloudflare Turnstile (dash.cloudflare.com > Turnstile), or
   - hCaptcha (dashboard.hcaptcha.com).
   Copy the **site key** (public) and the **secret key** (private).
2. In Supabase: Authentication > Attack Protection: choose the same provider
   and paste the **secret key**. Never put the secret in the app.

Then add two lines to `src/config.js` (the site key is public by design):

    export const CAPTCHA_PROVIDER = "turnstile";   // or "hcaptcha"
    export const CAPTCHA_SITE_KEY = "your-public-site-key";

and run `npm run deploy`. With no site key set the app sends nothing, so it
only works while the Supabase CAPTCHA switch is OFF.

The check is shown only when the provider needs it (Turnstile) as a small
box on top of the sign-up or sign-in screen. `security-headers.sh` already
allows both providers in the Content-Security-Policy.

To get people in right now: turn the Supabase CAPTCHA switch off, add the site
key, deploy, then switch it back on.

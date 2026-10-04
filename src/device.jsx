// ===========================================================================
// device.jsx -- two things the browser can do for us: find the user's area,
// and install itself onto their phone.
// ===========================================================================
import { useState, useEffect, useCallback, useRef } from "react";
import { normalizeState } from "./states.js";
import { useConsent } from "./consent-core.js";
import { addressFrom } from "./regions.js";

// ---------------------------------------------------------------------------
// LOCATION
//
// The goal is not coordinates -- it is the word people actually use for where
// they are ("Krishnanagar"), because that is what the listings are tagged
// with. So: GPS, then reverse-geocode to a neighbourhood name.
//
// Nominatim (OpenStreetMap) is used rather than Google Maps: no API key, no
// billing account, and no per-lookup cost. Its usage policy allows light use
// at up to one request a second, which a human tapping a button never
// approaches. If it is ever rate-limited the button fails quietly and the
// person types their area, which is the same thing they would have done
// anyway.
//
// Everything about this degrades to "type it yourself":
//   * no HTTPS -> the API does not exist, button hidden
//   * permission denied -> a one-line message, field stays editable
//   * geocoder down or slow -> timeout, same message
// The field is never disabled and never auto-submits, so a wrong guess costs
// one backspace rather than a wrong search.
// ---------------------------------------------------------------------------
const GEO_TIMEOUT_MS = 12000;

// One read at a time, and not again within a few seconds: OpenStreetMap asks
// for no more than about a request a second, and a nervous double tap is
// better answered with the fix just taken than with a second lookup.
let inflight = null;
let recent = null;
const RECENT_MS = 4000;
// A read that never answers (the phone's permission prompt left open, or a
// GPS that never settles) must not be handed to every later tap.
const GIVE_UP_MS = 45000;

// Why a read failed, from the browser's own error code, so the screen can say
// what to DO rather than one sentence for everything.
function reasonOf(err) {
  if (err && err.code === 1) return "denied";
  if (err && err.code === 2) return "unavailable";
  if (err && err.code === 3) return "timeout";
  return "other";
}
// The text key for a reason (loc_e_* in i18n).
export function locErrorKey(reason) {
  return reason === "denied" ? "loc_e_denied"
       : reason === "unavailable" ? "loc_e_unavailable"
       : reason === "timeout" ? "loc_e_timeout" : "loc_e_other";
}

export function useMyLocation() {
  const [state, setState] = useState("idle"); // idle | locating | done | error
  const [reason, setReason] = useState(null); // why it failed: denied | unavailable | timeout | other
  const consent = useConsent();
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // Only offered where it can actually work. navigator.geolocation exists but
  // silently fails on insecure origins, which would look like a broken button.
  const supported =
    typeof window !== "undefined" &&
    !!(window.navigator && window.navigator.geolocation) &&
    (window.isSecureContext || window.location.hostname === "localhost");

  const detect = useCallback(
    async () => {
      // The phone's position is read only after a yes (consent-core.js). A
      // no is not an error: nothing is shown, and the caller gets null.
      if (!(await consent.ask("location"))) {
        if (alive.current) { setState("idle"); setReason(null); }
        return null;
      }
      if (inflight) return inflight;
      if (recent && Date.now() - recent.at < RECENT_MS) return recent.value;
      // A reading was taken, so the first-visit auto-detect has no business
      // running again behind it.
      try { window.localStorage.setItem("dhundo_geo_tried", "1"); } catch (_) {}
      inflight = new Promise((resolve0) => {
        let settled = false;
        const resolve = (v) => { settled = true; resolve0(v); };
        if (!supported) { setReason("other"); setState("error"); return resolve(null); }
        setReason(null);
        setState("locating");
        setTimeout(() => {
          if (settled) return;
          if (alive.current) { setReason("timeout"); setState("error"); }
          resolve(null);
        }, GIVE_UP_MS);

        // ------------------------------------------------------------------
        // WHY THIS ASKS TWICE
        //
        // It used to ask once with enableHighAccuracy:false and accept a fix
        // up to five minutes old. That is the wrong request for this app:
        //   * high accuracy OFF tells Android not to use GPS at all. It
        //     answers from cell towers and wifi, which in a town is a few
        //     hundred metres and in rural Tripura is routinely kilometres --
        //     far enough to name the next village along. That was the real
        //     cause of a wrong area being detected, not the naming step.
        //   * maximumAge of five minutes let it hand back a cached coarse
        //     fix that some other app had taken, from wherever the phone was
        //     at the time.
        //
        // So: ask for a real GPS fix with no cached answer allowed. A cold
        // GPS fix takes ten to twenty seconds outdoors and can fail entirely
        // indoors, so a failure falls back to the coarse fix rather than
        // leaving somebody with nothing -- and the accuracy comes back with
        // it, so the caller can tell a 20-metre answer from a 3-kilometre
        // one instead of treating them alike.
        // ------------------------------------------------------------------
        const onFix = async (pos) => {
            try {
              const { latitude, longitude, accuracy } = pos.coords;

              // A fix this vague cannot support a place NAME. Naming it
              // would print a village the person may be nowhere near, which
              // is worse than printing nothing -- they would have to notice
              // it was wrong to fix it, and most people trust the machine.
              // The coordinates are still returned: distance from a 2 km fix
              // is rough but honest, and they can pick the area by hand.
              if (typeof accuracy === "number" && accuracy > 1500) {
                if (!alive.current) return resolve(null);
                setState("done");
                return resolve({
                  area: null, state: null,
                  lat: latitude, lng: longitude, accuracy,
                });
              }
              // accept-language=en: the app stores state and place names in
              // English, and without this Nominatim answers in whatever the
              // browser prefers -- "ত্রিপুরা" never matches "Tripura".
              const url =
                "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en" +
                `&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;

              const ctrl = new AbortController();
              const kill = setTimeout(() => ctrl.abort(), GEO_TIMEOUT_MS);
              const res = await fetch(url, {
                signal: ctrl.signal,
                headers: { Accept: "application/json" },
              });
              clearTimeout(kill);
              if (!res.ok) throw new Error("geocoder");

              const body = await res.json();
              const a = (body && body.address) || {};
              // Most specific first. `suburb` is what Agartala's localities
              // are usually tagged as in OSM; the rest are fallbacks for
              // places mapped less finely.
              const area =
                a.suburb || a.neighbourhood || a.quarter || a.village ||
                a.town || a.city_district || a.county || null;
              // The state matters as much as the locality: if somebody is in
              // Assam, the useful answer is "we are not there yet", not a
              // silent empty result list.
              // Normalised, so "NCT of Delhi" or "Orissa" match the app's
              // list. Outside India this stays whatever OSM said.
              const st = a.state ? normalizeState(a.state) : (a.country_code === "in" ? null : a.country || null);

              if (!alive.current) return resolve(null);
              // A remote spot the map names in no way at all is still a
              // position: keep it. Throwing a good GPS fix away because the
              // map has nothing written there is how "cannot find my
              // location" happened in villages.
              setState("done");
              // The coordinates come back too, not just the name. Distance
              // is computed from these -- "4 km away" cannot be derived
              // from the word "Krishnanagar".
              resolve({ area, state: st, lat: latitude, lng: longitude, accuracy,
                        address: addressFrom(a, body && body.display_name) });
            } catch (_) {
              // The geocoder failed, but the FIX did not. Coordinates
              // without a name are still worth having: distance works, and
              // the person can pick their area by hand. Throwing the
              // position away because a name lookup timed out would be
              // discarding the more useful half.
              if (!alive.current) return resolve(null);
              setState("done");
              resolve({
                area: null, state: null,
                lat: pos.coords.latitude, lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              });
            }
        };

        // Coarse, as a last resort: better a rough position than none, and
        // the accuracy figure travels with it so nothing downstream mistakes
        // it for a precise one.
        const coarse = () =>
          window.navigator.geolocation.getCurrentPosition(
            onFix,
            (err) => { if (alive.current) { setReason(reasonOf(err)); setState("error"); } resolve(null); },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60 * 1000 }
          );

        window.navigator.geolocation.getCurrentPosition(
          onFix,
          coarse,
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
      }).then((v) => {
        recent = v ? { at: Date.now(), value: v } : null;
        inflight = null;
        return v;
      });
      return inflight;
    },
    [supported, consent.ask]
  );

  return { supported, state, reason, detect, reset: () => { setState("idle"); setReason(null); } };
}

// ---------------------------------------------------------------------------
// INSTALL
//
// "Download the app" without a Play Store listing. Chrome on Android fires
// beforeinstallprompt when a site is installable (manifest + icons + service
// worker over HTTPS); capturing it lets a real button trigger the same
// install sheet the browser would otherwise bury in a menu.
//
// iOS never fires it -- Safari has no programmatic install -- so there the
// only honest thing is to say where the button is. Detected by feature, not
// by sniffing the user agent string.
// ---------------------------------------------------------------------------
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // NOTE: preventDefault() is NOT called here any more.
    //
    // It used to be, so that installing happened from our own button instead
    // of Chrome's mini-infobar. That was coherent while the app had an
    // "Install" button to press. It no longer does -- add-to-home-screen was
    // removed in favour of the APK -- so preventing the default suppressed
    // Chrome's banner and then offered nothing in its place, which Chrome
    // reports in the console as:
    //
    //   Banner not shown: beforeinstallpromptevent.preventDefault() called.
    //   The page must call beforeinstallpromptevent.prompt() to show the
    //   banner.
    //
    // Letting the event through means Chrome can still offer its own install
    // to whoever wants it, while our sheet hands out the APK. The event is
    // captured (not prevented) only so `canInstall` stays meaningful.
    const onPrompt = (e) => { setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Already running as an installed app -- don't offer to install it again.
    try {
      if (window.matchMedia("(display-mode: standalone)").matches ||
          window.navigator.standalone === true) {
        setInstalled(true);
      }
    } catch (_) {}

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIos = (() => {
    try {
      // Feature-shaped detection: touch-capable, no install event support,
      // and Apple's standalone flag present on the navigator.
      return /iP(hone|ad|od)/.test(window.navigator.platform || "") ||
        (window.navigator.userAgent.includes("Mac") && "ontouchend" in document);
    } catch (_) { return false; }
  })();

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    deferred.prompt();
    try {
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      return outcome === "accepted";
    } catch (_) {
      setDeferred(null);
      return false;
    }
  }, [deferred]);

  return {
    canInstall: !!deferred && !installed,
    installed,
    isIos: isIos && !installed,
    promptInstall,
  };
}

// ---------------------------------------------------------------------------
// The service worker exists for one reason: Chrome will not consider a site
// installable without one. It deliberately does very little.
//
// Caching the app shell aggressively is how a PWA ends up serving a version
// from three weeks ago with no way to force an update. So: network first for
// everything, cache only as a fallback when the network fails, and never
// cache API responses -- a stale phone number is worse than no phone number.
// ---------------------------------------------------------------------------
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in window.navigator)) return;
  window.addEventListener("load", () => {
    window.navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not fatal: the site works fine, it just cannot be installed.
    });
  });
}

// Running as the installed app -- the Android APK (a Trusted Web Activity,
// which opens the site with an android-app:// referrer) or the site added
// to the home screen (display-mode: standalone) -- rather than in a browser
// tab. Read once and kept for the session: the referrer is only there on
// the first page load.
export function isInstalledApp() {
  try {
    if (window.sessionStorage.getItem("dhundo_in_app") === "1") return true;
    const inApp =
      String(document.referrer || "").startsWith("android-app://") ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
    if (inApp) window.sessionStorage.setItem("dhundo_in_app", "1");
    return inApp;
  } catch (_) {
    return false;
  }
}

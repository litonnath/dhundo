// Minimal service worker. It exists because Chrome will not treat a site as
// installable without one -- not to make the app work offline.
//
// NETWORK FIRST, ALWAYS. Aggressive caching is how a PWA ends up serving a
// build from three weeks ago with no way to force an update. The cache is
// only a fallback for when the network fails outright.
//
// API responses are never cached: a stale phone number is worse than no
// phone number.
// BUMP THIS ON ANY DEPLOY THAT CHANGES HOW THE APP BOOTS.
//
// The name is the cache's identity: `activate` deletes every cache whose key
// is not this one, so changing it is the only thing that guarantees an old
// shell is thrown away. Left at v1 forever, a browser that cached an index.html
// during a bad minute keeps serving it -- and with it, the chunk hashes from
// that build -- long after the source is fixed. That is how a fault that no
// longer exists in the code keeps appearing in somebody's browser.
const CACHE = "services-shell-v4";
const SHELL = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Anything that is not this origin -- Supabase, the geocoder -- goes
  // straight to the network, untouched.
  if (url.origin !== self.location.origin) return;
  // The place search and address lookup (nginx proxies them under /geo/) are
  // answered fresh and remembered by the server, not here: every different
  // search would otherwise be stored in this cache for good.
  if (url.pathname.startsWith("/geo/")) return;

  // Whether this is a page load or an asset. It decides what a failure may
  // fall back to, and getting that wrong is worse than having no worker.
  const isPage = req.mode === "navigate";

  e.respondWith(
    fetch(req)
      .then((res) => {
        // Only cache a real answer. A 404 or a 500 cached as the shell is
        // how a deploy that half-failed becomes permanent.
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          // ONLY a page may fall back to the shell.
          //
          // This used to hand index.html back for ANY failed request. A
          // script tag asking for /assets/index-ABC.js would receive a page
          // of HTML and the browser would try to execute it, which surfaces
          // as a syntax or initialisation error somewhere deep in a minified
          // bundle -- a symptom that points nowhere near the cause.
          if (isPage) return caches.match("/index.html");
          return Response.error();
        })
      )
  );
});

// Alerts when the app is closed. The server sends the words already in the
// person's language: { title, body, url }.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {}; }
  e.waitUntil(self.registration.showNotification(d.title || "Dhundo", {
    body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png",
    tag: d.tag || "dhundo", data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

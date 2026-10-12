// LIVE LOCATION, AUTOMATIC: while a ride, a delivery or a booking is on, each person's phone sends its own
// position every few seconds and reads the other person's, so both can see each other move. No button: it
// runs for as long as the screen is on. The server only lets the two people of that ride, order or booking
// send and read, and only while it is on.
import { useEffect, useRef, useState } from "react";

export function useLiveShare(api, kind, id, active, everyMs = 4000) {
  const [mine, setMine] = useState(null);
  const sent = useRef(0);
  useEffect(() => {
    if (!active || !id || !api.liveShare) return undefined;
    const geo = typeof navigator !== "undefined" && navigator.geolocation;
    if (!geo) return undefined;
    const w = geo.watchPosition((g) => {
      const cur = { lat: g.coords.latitude, lng: g.coords.longitude };
      setMine(cur);
      if (Date.now() - sent.current >= everyMs) {
        sent.current = Date.now();
        Promise.resolve(api.liveShare(kind, id, cur.lat, cur.lng)).catch(() => {});
      }
    }, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    return () => geo.clearWatch(w);
  }, [api, kind, id, active, everyMs]);
  return mine;
}

export function useLivePeer(api, kind, id, active, everyMs = 4000) {
  const [peer, setPeer] = useState(null);
  useEffect(() => {
    if (!active || !id || !api.livePeer) { setPeer(null); return undefined; }
    let alive = true;
    const pull = async () => {
      try { const r = await api.livePeer(kind, id); const x = Array.isArray(r) ? r[0] : r; if (alive) setPeer(x && typeof x.lat === "number" ? { lat: x.lat, lng: x.lng } : null); } catch (_) { /* next tick */ }
    };
    pull();
    const timer = setInterval(() => { if (!document.hidden) pull(); }, everyMs);
    return () => { alive = false; clearInterval(timer); };
  }, [api, kind, id, active, everyMs]);
  return peer;
}

// Sends this phone's position for a ride, order or booking while it is on; shows nothing.
export function LiveShare({ api, kind, id, active }) {
  useLiveShare(api, kind, id, active);
  return null;
}

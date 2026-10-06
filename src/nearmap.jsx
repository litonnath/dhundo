// ---------------------------------------------------------------------------
// DRIVERS NEAR YOU, on a map and in a list, like the ride apps: your pickup
// as a blue dot, each driver as a coloured marker (green = online now,
// grey = listed but offline). Positions are the public ones only: exact for a
// listing that published its address, rounded for the rest. Leaflet is loaded
// when this is first shown, not with the app.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef } from "react";
import { T, Icon } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import * as CFG from "./config.js";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
// CARTO Voyager when CARTO_KEY is set in src/config.js (the key is public by
// design but is kept out of git); otherwise plain OpenStreetMap tiles.
const TILES = CFG.CARTO_KEY
  ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=" + CFG.CARTO_KEY
  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const SUBS = CFG.CARTO_KEY ? "abcd" : "abc";
const CREDIT = CFG.CARTO_KEY ? "&copy; OpenStreetMap contributors &copy; CARTO" : "&copy; OpenStreetMap contributors";

export function DriverMap({ me, pins, height }) {
  const box = useRef(null);
  const st = useRef({});
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (dead || !box.current) return;
      if (!st.current.map) {
        st.current.L = L;
        st.current.map = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([me.lat, me.lng], 13);
        L.tileLayer(TILES, { subdomains: SUBS, maxZoom: 19, attribution: CREDIT }).addTo(st.current.map);
        st.current.layer = L.layerGroup().addTo(st.current.map);
      }
      const { map, layer } = st.current;
      layer.clearLayers();
      L.marker([me.lat, me.lng], {
        zIndexOffset: 1000,
        icon: L.divIcon({ className: "", html: '<div style="width:20px;height:20px;border-radius:50%;background:#1D4ED8;border:4px solid #fff;box-shadow:0 0 0 3px rgba(29,78,216,.35),0 2px 6px rgba(0,0,0,.4)"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
      }).addTo(layer);
      L.circle([me.lat, me.lng], { radius: 250, color: "#1D4ED8", weight: 1, fillOpacity: 0.08 }).addTo(layer);
      const pts = [[me.lat, me.lng]];
      pins.forEach((p) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:30px;height:30px;border-radius:50%;background:${p.color || (p.online ? "#16A34A" : "#6B7280")};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:800 13px sans-serif">${String(p.name || "?").trim().charAt(0).toUpperCase()}</div>`,
          iconSize: [30, 30], iconAnchor: [15, 15],
        });
        const m = L.marker([p.lat, p.lng], { icon }).addTo(layer);
        const tip = document.createElement("div");
        tip.style.cssText = "font:600 13px sans-serif";
        tip.textContent = `${p.name}${p.vehicle ? " · " + p.vehicle : ""}${p.km != null ? " · " + p.km + " km" : ""}`;
        m.bindPopup(tip);
        pts.push([p.lat, p.lng]);
      });
      if (pts.length > 1) map.fitBounds(pts, { padding: [28, 28], maxZoom: 15 });
      else map.setView([me.lat, me.lng], 14);
      setTimeout(() => map.invalidateSize(), 50);
    })();
    return () => { dead = true; };
  }, [me.lat, me.lng, JSON.stringify(pins.map((p) => [p.id, p.online]))]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (st.current.map) { st.current.map.remove(); st.current = {}; } }, []);
  return <div ref={box} style={{ height, borderRadius: 14, overflow: "hidden", border: `1px solid ${T.line}`, background: "#E8EEF4" }} />;
}

export function NearbyDrivers({ api, pick, state, slugs, vehicle, onlineIds, onlineRows = [], fares, trip, height = 250 }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(null);
  const [pos, setPos] = useState({});
  const onlineIdsRef = useRef([]);
  onlineIdsRef.current = onlineRows.map((r) => r && r.id).filter(Boolean);
  useEffect(() => {
    if (!pick || typeof pick.lat !== "number") { setRows(null); return undefined; }
    let live = true;
    (async () => {
      try {
        const list = many(await api.browse({ group: "Drivers", lat: pick.lat, lng: pick.lng, radiusKm: 30, limit: 40, state }));
        if (!live) return;
        setRows(list);
        const ids = [...new Set([...onlineIdsRef.current, ...list.map((r) => r.id)])].filter(Boolean).slice(0, 25);
        if (ids.length) {
          const got = many(await api.publicPositions(ids));
          if (live) { const o = {}; got.forEach((g) => { o[g.id] = g; }); setPos(o); }
        }
      } catch (_) { if (live) setRows([]); }
    })();
    return () => { live = false; };
  }, [api, pick && pick.lat, pick && pick.lng, state, onlineRows.map((r) => r && r.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pick || typeof pick.lat !== "number") return null;
  // Drivers who are online right now are always included, even when the
  // ordinary search did not return them.
  const have = new Set((rows || []).map((r) => r.id));
  const merged = (rows || []).concat(onlineRows.filter((r) => r && r.id && !have.has(r.id)));
  const shown = merged.filter((r) => (!slugs || slugs.includes(r.trade_slug)) && (!vehicle || vehicle === "any" || r.trade_slug === vehicle));
  const sorted = shown.slice().sort((a, b) => (onlineIds.has(b.id) ? 1 : 0) - (onlineIds.has(a.id) ? 1 : 0)
    || (Number(a.distance_km ?? 1e9) - Number(b.distance_km ?? 1e9)));
  const pins = sorted.filter((r) => pos[r.id]).map((r) => ({
    id: r.id, name: r.display_name, vehicle: r.trade_name, km: r.distance_km, online: onlineIds.has(r.id), lat: pos[r.id].lat, lng: pos[r.id].lng,
  }));
  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: T.ink, margin: "0 0 10px" }}>{t("rd_nearby")}{sorted.length ? ` (${sorted.length})` : ""}</h2>
      <DriverMap me={{ lat: pick.lat, lng: pick.lng }} pins={pins} height={height} />
      {rows !== null && sorted.length === 0 && <div style={{ fontSize: 14, color: T.inkFaint, lineHeight: 1.6, marginTop: 10 }}>{t("rd_nearby_none")}</div>}
      <div style={{ marginTop: 10 }}>
        {sorted.map((d) => {
          const on = onlineIds.has(d.id);
          const km = d.distance_km != null ? Number(d.distance_km) : null;
          const rate = Number(fares[d.id]) > 0 ? Number(fares[d.id]) : null;
          const tripFare = trip && rate ? Math.max(rate, Math.round((trip.km * rate) / 5) * 5) : null;
          return (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: "10px 12px", marginBottom: 8 }}>
              <span style={{ width: 40, height: 40, borderRadius: "50%", background: on ? "#16A34A" : "#6B7280", color: "#fff", fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{String(d.display_name || "?").trim().charAt(0).toUpperCase()}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.display_name}</span>
                <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft }}>{d.trade_name}{d.locality ? ` · ${d.locality}` : ""}</span>
                <span style={{ display: "inline-block", marginTop: 3, fontSize: 11.5, fontWeight: 800, color: on ? "#0F8A3C" : "#6B7280" }}>{on ? t("rd_on") : t("rd_off")}</span>
              </span>
              <span style={{ textAlign: "right" }}>
                {km != null && <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.brandDark }}>{String(t("rd_away")).replace("{n}", km < 10 ? km.toFixed(1) : Math.round(km))}</span>}
                {rate && <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft }}>{String(t("rs_km_show")).replace("{n}", rate)}</span>}
                {tripFare && <span style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: T.ink }}>{String(t("rd_trip_fare")).replace("{n}", tripFare)}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LIVE RIDE: the driver as an arrow pointing the way he is moving, the pickup
// and the drop, and a line between driver and pickup.
// ---------------------------------------------------------------------------
const rad = (x) => (x * Math.PI) / 180;
export function kmBetween(a, b) {
  const R = 6371, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
const fmtKm = (km) => (km < 1 ? `${Math.max(50, Math.round(km * 10) * 100)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);

export function LiveRideMap({ pick, drop, driver, height = 230 }) {
  const box = useRef(null);
  const st = useRef({});
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (dead || !box.current) return;
      if (!st.current.map) {
        st.current.map = L.map(box.current).setView([pick.lat, pick.lng], 14);
        L.tileLayer(TILES, { subdomains: SUBS, maxZoom: 19, attribution: CREDIT }).addTo(st.current.map);
        st.current.layer = L.layerGroup().addTo(st.current.map);
      }
      const { map, layer } = st.current;
      layer.clearLayers();
      const dot = (c, txt) => L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13],
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);color:#fff;font:800 12px sans-serif;display:flex;align-items:center;justify-content:center">${txt}</div>` });
      const pts = [[pick.lat, pick.lng]];
      L.marker([pick.lat, pick.lng], { icon: dot("#16A34A", "A") }).addTo(layer);
      if (drop && typeof drop.lat === "number") { L.marker([drop.lat, drop.lng], { icon: dot("#DC2626", "B") }).addTo(layer); pts.push([drop.lat, drop.lng]); }
      if (driver) {
        const h = Math.round(driver.heading || 0);
        L.marker([driver.lat, driver.lng], {
          zIndexOffset: 1000,
          icon: L.divIcon({ className: "", iconSize: [44, 44], iconAnchor: [22, 22],
            html: `<div style="width:44px;height:44px;border-radius:50%;background:#1D4ED8;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><svg width="26" height="26" viewBox="0 0 24 24" style="transform:rotate(${h}deg)"><path d="M12 2l7 18-7-4-7 4z" fill="#fff"/></svg></div>` }),
        }).addTo(layer);
        L.polyline([[driver.lat, driver.lng], [pick.lat, pick.lng]], { color: "#1D4ED8", weight: 3, dashArray: "6 8", opacity: 0.8 }).addTo(layer);
        pts.push([driver.lat, driver.lng]);
      }
      if (pts.length > 1) map.fitBounds(pts, { padding: [34, 34], maxZoom: 16 }); else map.setView(pts[0], 15);
      setTimeout(() => map.invalidateSize(), 50);
    })();
    return () => { dead = true; };
  }, [pick.lat, pick.lng, drop && drop.lat, driver && driver.lat, driver && driver.lng, driver && Math.round((driver.heading || 0) / 10)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (st.current.map) { st.current.map.remove(); st.current = {}; } }, []);
  return <div ref={box} style={{ height, borderRadius: 14, overflow: "hidden", border: `1px solid ${T.line}`, background: "#E8EEF4", margin: "10px 0" }} />;
}

// The passenger's view: poll the matched driver every few seconds, work out
// which way he is heading from his last two fixes.
export function PassengerLive({ api, ride }) {
  const { t } = useI18n();
  const [drv, setDrv] = useState(null);
  const prev = useRef(null);
  const [toward, setToward] = useState(null);
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const r = many(await api.rideDriverPos(ride.id))[0];
        if (!live) return;
        if (!r) { setDrv(null); return; }
        const cur = { lat: r.lat, lng: r.lng, seen: r.seen_at };
        const p = prev.current;
        let heading = (drv && drv.heading) || 0;
        if (p && kmBetween(p, cur) > 0.01) {
          heading = bearing(p, cur);
          setToward(kmBetween(cur, { lat: ride.pick_lat, lng: ride.pick_lng }) < kmBetween(p, { lat: ride.pick_lat, lng: ride.pick_lng }));
          prev.current = cur;
        } else if (!p) prev.current = cur;
        setDrv({ ...cur, heading });
      } catch (_) { /* next tick */ }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { live = false; clearInterval(id); };
  }, [api, ride.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (typeof ride.pick_lat !== "number") return null;
  const pick = { lat: ride.pick_lat, lng: ride.pick_lng };
  const km = drv ? kmBetween(drv, pick) : null;
  return (
    <div>
      <LiveRideMap pick={pick} drop={typeof ride.drop_lat === "number" ? { lat: ride.drop_lat, lng: ride.drop_lng } : null} driver={drv} />
      <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 6 }}>
        {drv ? `${String(t("rd_live_dist")).replace("{n}", fmtKm(km))}${toward === true ? ` · ${t("rd_live_toward")}` : toward === false ? ` · ${t("rd_live_away")}` : ""}` : t("rd_live_wait")}
      </div>
    </div>
  );
}

// The driver's view: own position and heading from the phone, sent every few
// seconds while the ride is on, with the pickup in view.
export function DriverLive({ api, ride }) {
  const { t } = useI18n();
  const [me, setMe] = useState(null);
  const last = useRef(null);
  const sent = useRef(0);
  useEffect(() => {
    const geo = typeof navigator !== "undefined" && navigator.geolocation;
    if (!geo) return undefined;
    const id = geo.watchPosition((g) => {
      const cur = { lat: g.coords.latitude, lng: g.coords.longitude };
      let heading = typeof g.coords.heading === "number" && !Number.isNaN(g.coords.heading) ? g.coords.heading : null;
      if (heading === null && last.current && kmBetween(last.current, cur) > 0.01) heading = bearing(last.current, cur);
      if (!last.current || kmBetween(last.current, cur) > 0.01) last.current = cur;
      setMe((m) => ({ ...cur, heading: heading === null ? (m && m.heading) || 0 : heading }));
      if (Date.now() - sent.current > 8000) {
        sent.current = Date.now();
        api.setAvailability(true, { lat: cur.lat, lng: cur.lng, accuracy: g.coords.accuracy }, null).catch(() => {});
      }
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return () => geo.clearWatch(id);
  }, [api]);
  if (typeof ride.pick_lat !== "number") return null;
  const pick = { lat: ride.pick_lat, lng: ride.pick_lng };
  const km = me ? kmBetween(me, pick) : null;
  return (
    <div>
      <LiveRideMap pick={pick} drop={typeof ride.drop_lat === "number" ? { lat: ride.drop_lat, lng: ride.drop_lng } : null} driver={me} />
      {me && <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{String(t("rd_pick_in")).replace("{n}", fmtKm(km))}</div>}
    </div>
  );
}

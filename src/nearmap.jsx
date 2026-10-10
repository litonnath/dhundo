// ---------------------------------------------------------------------------
// DRIVERS NEAR YOU, on a map and in a list, like the ride apps: your pickup
// as a blue dot, each driver as a coloured marker (green = online now,
// grey = listed but offline). Positions are the public ones only: exact for a
// listing that published its address, rounded for the rest. Leaflet is loaded
// when this is first shown, not with the app.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef } from "react";
import { T, CloseButton, useDismissable } from "./ui.jsx";
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

// ---------------------------------------------------------------------------
// The ride-app map: your blue dot, vehicles as icons with a minutes-away
// label, a green pickup pin with the fare, a red drop pin, and the route.
// Clean (no zoom buttons, pinch or scroll to zoom), tall, tappable.
// ---------------------------------------------------------------------------
export function vehicleEmoji(txt) {
  const x = String(txt || "").toLowerCase();
  if (/bike|moto|two/.test(x)) return "\u{1F3CD}\u{FE0F}";
  if (/auto|rick|tuk|toto|e-?rick/.test(x)) return "\u{1F6FA}";
  if (/taxi|cab|car|sedan|suv|jeep|van/.test(x)) return "\u{1F695}";
  if (/truck|tempo|lorry|jcb|tractor|loader/.test(x)) return "\u{1F69A}";
  return "\u{1F697}";
}
export const etaMin = (km) => Math.max(1, Math.round((Number(km) / 22) * 60));
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STYLE_ID = "dhundo-map-css";
function ensureCss() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = "@keyframes dhPulse{0%{transform:scale(.6);opacity:.7}100%{transform:scale(2.4);opacity:0}}.leaflet-control-attribution{font-size:9px!important;opacity:.5;background:transparent!important;padding:0 4px!important}.dh-pulse{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(37,99,235,.45);animation:dhPulse 2s ease-out infinite}";
  document.head.appendChild(el);
}

// markers: { id, lat, lng, kind: "me"|"driver"|"pickup"|"drop", emoji, label, sub, online, selected }
// lines:   { pts: [[lat,lng],...], dashed }
export function UberMap({ markers, lines = [], height = "50vh", onSelect, fitKey }) {
  const box = useRef(null);
  const st = useRef({});
  const keyRef = useRef("");
  const sig = JSON.stringify([markers.map((m) => [m.id, m.lat, m.lng, m.label, m.selected, m.online]), lines.map((l) => l.pts)]);
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (dead || !box.current) return;
      ensureCss();
      if (!st.current.map) {
        st.current.map = L.map(box.current, { zoomControl: false, attributionControl: true }).setView([markers[0].lat, markers[0].lng], 14);
        st.current.map.attributionControl.setPrefix(false);
        L.tileLayer(TILES, { subdomains: SUBS, maxZoom: 19, attribution: CREDIT }).addTo(st.current.map);
        st.current.layer = L.layerGroup().addTo(st.current.map);
      }
      if (!st.current.map) return;
      const { map, layer } = st.current;
      layer.clearLayers();
      const pill = (txt, bg, fg) => `<div style="margin-top:3px;background:${bg};color:${fg};font:800 12px/1 sans-serif;padding:4px 8px;border-radius:10px;white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,.35)">${esc(txt)}</div>`;
      lines.forEach((l) => {
        L.polyline(l.pts, { color: "#fff", weight: 8, opacity: 0.9, lineCap: "round" }).addTo(layer);
        L.polyline(l.pts, { color: l.dashed ? "#2563EB" : "#111827", weight: 4, dashArray: l.dashed ? "2 9" : null, lineCap: "round" }).addTo(layer);
      });
      const pts = [];
      markers.forEach((m) => {
        let html, size, anchor;
        if (m.kind === "me") {
          html = '<div style="position:relative;width:22px;height:22px"><div class="dh-pulse"></div><div style="position:absolute;inset:0;border-radius:50%;background:#2563EB;border:4px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45)"></div></div>';
          size = [22, 22]; anchor = [11, 11];
        } else if (m.kind === "driver") {
          const d = m.selected ? 50 : 42;
          html = `<div style="display:flex;flex-direction:column;align-items:center;width:84px"><div style="width:${d}px;height:${d}px;border-radius:50%;background:#fff;border:3px solid ${m.online ? "#16A34A" : "#9CA3AF"};box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:${m.selected ? 26 : 21}px;${m.online ? "" : "filter:grayscale(1);opacity:.85"}">${m.emoji || ""}</div>${m.label ? pill(m.label, m.selected ? "#111827" : "#fff", m.selected ? "#fff" : "#111827") : ""}</div>`;
          size = [84, 70]; anchor = [42, d / 2];
        } else {
          const pick = m.kind === "pickup";
          const c = pick ? "#16A34A" : "#DC2626";
          html = `<div style="display:flex;flex-direction:column;align-items:center;width:110px">${m.label ? pill(m.label, "#111827", "#fff") : ""}<div style="width:18px;height:18px;margin-top:3px;border-radius:${pick ? "50%" : "4px"};background:${c};border:4px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45)"></div></div>`;
          size = [110, 52]; anchor = [55, m.label ? 42 : 9];
        }
        const mk = L.marker([m.lat, m.lng], {
          zIndexOffset: m.kind === "me" ? 900 : m.selected ? 800 : m.kind === "driver" ? 100 : 500,
          icon: L.divIcon({ className: "", html, iconSize: size, iconAnchor: anchor }),
        }).addTo(layer);
        if (onSelect && m.id) mk.on("click", () => onSelect(m.id));
        pts.push([m.lat, m.lng]);
      });
      // Re-fit only when what is shown changes, not on every refresh, so the
      // map does not jump about while someone is looking at it.
      const fk = fitKey != null ? String(fitKey) : markers.map((m) => m.id).join(",");
      if (keyRef.current !== fk) {
        keyRef.current = fk;
        if (pts.length > 1) map.fitBounds(pts, { padding: [60, 40], maxZoom: 16, animate: false });
        else map.setView(pts[0], 15, { animate: false });
      }
      setTimeout(() => map.invalidateSize(), 50);
    })();
    return () => { dead = true; };
  }, [sig, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (st.current.map) { st.current.map.remove(); st.current = {}; } }, []);
  return <div ref={box} style={{ height, minHeight: 300, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.line}`, background: "#E8EEF4" }} />;
}


// ---------------------------------------------------------------------------
// DIRECTIONS INSIDE THE APP: the road route from the driver to the pickup on
// the app's own map, with the turns listed, instead of handing over to another
// maps app. Routes come from the OpenStreetMap-based OSRM service.
// ---------------------------------------------------------------------------
const OSRM = "https://router.project-osrm.org/route/v1/driving/";
function stepText(st, t) {
  const m = st.maneuver || {};
  const mod = String(m.modifier || "");
  const road = st.name ? String(t("nav_onto")).replace("{road}", st.name) : "";
  let arrow = "\u2191", word = t("nav_straight");
  if (m.type === "arrive") { arrow = "\u2691"; word = t("nav_arrive"); }
  else if (m.type === "depart") { arrow = "\u2191"; word = t("nav_depart"); }
  else if (/roundabout|rotary/.test(m.type)) { arrow = "\u21BB"; word = t("nav_round"); }
  else if (mod === "uturn") { arrow = "\u21B6"; word = t("nav_uturn"); }
  else if (/left/.test(mod)) { arrow = "\u2190"; word = t("nav_left"); }
  else if (/right/.test(mod)) { arrow = "\u2192"; word = t("nav_right"); }
  return { arrow, text: `${word}${road ? " " + road : ""}` };
}
export function RouteNav({ from, to, title, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [start, setStart] = useState(from && typeof from.lat === "number" ? from : null);
  const [route, setRoute] = useState(null);
  const [state, setState] = useState("load");
  useEffect(() => {
    if (start) return undefined;
    const geo = typeof navigator !== "undefined" && navigator.geolocation;
    if (!geo) { setState("fail"); return undefined; }
    geo.getCurrentPosition((g) => setStart({ lat: g.coords.latitude, lng: g.coords.longitude }), () => setState("fail"), { enableHighAccuracy: true, timeout: 15000 });
    return undefined;
  }, [start]);
  useEffect(() => {
    if (!start) return undefined;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 9000);
    setState("load");
    fetch(`${OSRM}${start.lng},${start.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => {
        const r = j && j.routes && j.routes[0];
        if (!r) { setState("fail"); return; }
        setRoute({
          km: r.distance / 1000, min: Math.max(1, Math.round(r.duration / 60)),
          pts: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          steps: (r.legs || []).flatMap((l) => l.steps || []),
        });
        setState("ok");
      })
      .catch(() => setState("fail"))
      .finally(() => clearTimeout(timer));
    return () => { ctl.abort(); clearTimeout(timer); };
  }, [start && start.lat, start && start.lng, to.lat, to.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const markers = start ? [{ id: "me", kind: "me", ...start }, { id: "to", kind: "pickup", lat: to.lat, lng: to.lng }] : [{ id: "to", kind: "pickup", lat: to.lat, lng: to.lng }];
  const lines = route ? [{ pts: route.pts }] : start ? [{ pts: [[start.lat, start.lng], [to.lat, to.lng]], dashed: true }] : [];
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 590, background: "#F4F6F8", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", background: T.white, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>{title}</div>
          {route && <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 1 }}>{route.min} {t("nav_min")} {"\u00B7"} {route.km < 10 ? route.km.toFixed(1) : Math.round(route.km)} km</div>}
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div style={{ padding: "10px 12px 0" }}>
        <UberMap markers={markers} lines={lines} height="42vh" fitKey={route ? "r" : "l"} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px 24px" }}>
        {state === "load" && <div style={{ fontSize: 14, color: T.inkSoft, padding: "8px 4px" }}>{t("nav_loading")}</div>}
        {state === "fail" && <div style={{ fontSize: 14, color: "#B91C1C", padding: "8px 4px", lineHeight: 1.5 }}>{t("nav_failed")}</div>}
        {route && route.steps.map((st, i) => {
          const x = stepText(st, t);
          const d = st.distance || 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 7 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#111827", color: "#fff", fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{x.arrow}</span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: T.ink, lineHeight: 1.3, overflowWrap: "anywhere" }}>{x.text}</span>
              {d > 0 && <span style={{ fontSize: 12.5, fontWeight: 800, color: T.inkSoft, flexShrink: 0 }}>{d < 1000 ? `${Math.max(10, Math.round(d / 10) * 10)} m` : `${(d / 1000).toFixed(1)} km`}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NearbyDrivers({ api, pick, state, slugs, vehicle, onlineIds, onlineRows = [], fares, trip, height = 250, drop = null, between = null }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(null);
  const [pos, setPos] = useState({});
  const [sel, setSel] = useState(null);
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
      } catch (_) { if (live) setRows([]); }
    })();
    return () => { live = false; };
  }, [api, pick && pick.lat, pick && pick.lng, state, onlineRows.map((r) => r && r.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  // Where each online driver is right now, refreshed every few seconds, not
  // the address on their listing. Drivers who are offline are not on the map.
  // The account address of each driver (services_signups), shown instead of
  // the listing address.
  const [homes, setHomes] = useState({});
  const homeKey = [...new Set([...onlineRows.map((r) => r && r.id), ...(rows || []).map((r) => r.id)])].filter(Boolean).slice(0, 25).join(",");
  useEffect(() => {
    if (!homeKey || !api.driverHomes) return undefined;
    let live = true;
    api.driverHomes(homeKey.split(",")).then((got) => {
      if (!live) return;
      const o = {}; many(got).forEach((g) => { o[g.id] = g; }); setHomes(o);
    }).catch(() => {});
    return () => { live = false; };
  }, [api, homeKey]);
  const idsKey = [...new Set([...onlineRows.map((r) => r && r.id), ...(rows || []).map((r) => r.id)])].filter(Boolean).slice(0, 25).join(",");
  useEffect(() => {
    if (!idsKey) { setPos({}); return undefined; }
    let live = true;
    const pull = async () => {
      try {
        const got = many(await api.liveDriverPositions(idsKey.split(",")));
        if (live) { const o = {}; got.forEach((g) => { o[g.id] = g; }); setPos(o); }
      } catch (_) { /* the next tick */ }
    };
    pull();
    const id = setInterval(pull, 6000);
    return () => { live = false; clearInterval(id); };
  }, [api, idsKey]);
  // Drivers who are online right now are always included, even when the
  // ordinary search did not return them.
  const have = new Set((rows || []).map((r) => r.id));
  const merged = (rows || []).concat(onlineRows.filter((r) => r && r.id && !have.has(r.id)));
  const shown = merged.filter((r) => (!slugs || slugs.includes(r.trade_slug)) && (!vehicle || vehicle === "any" || r.trade_slug === vehicle));
  const sorted = shown.slice().sort((a, b) => (onlineIds.has(b.id) ? 1 : 0) - (onlineIds.has(a.id) ? 1 : 0)
    || (Number(a.distance_km ?? 1e9) - Number(b.distance_km ?? 1e9)));
  // The nearest driver who is live, and how long he needs to reach the pickup:
  // by road when the routing service answers, a straight-line estimate if not.
  const pickOk = !!pick && typeof pick.lat === "number";
  const liveList = (!pickOk ? [] : sorted.filter((r) => pos[r.id])).map((r) => ({ id: r.id, km: kmBetween(pick, pos[r.id]), at: pos[r.id] })).sort((a, b) => a.km - b.km);
  const near = liveList[0] || null;
  const [roadMin, setRoadMin] = useState(null);
  const nearKey = near ? `${near.id}:${near.at.lat.toFixed(3)},${near.at.lng.toFixed(3)}` : "";
  useEffect(() => {
    setRoadMin(null);
    if (!near || !pickOk) return undefined;
    const ctl = new AbortController();
    fetch(`${OSRM}${near.at.lng},${near.at.lat};${pick.lng},${pick.lat}?overview=false`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => { const r = j && j.routes && j.routes[0]; if (r) setRoadMin(Math.max(1, Math.round(r.duration / 60))); })
      .catch(() => {});
    return () => ctl.abort();
  }, [nearKey, pick && pick.lat, pick && pick.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pickOk) return null;
  const info = { count: liveList.length, min: near ? (roadMin != null ? roadMin : etaMin(near.km)) : null, km: near ? near.km : null };
  const hasDrop = drop && typeof drop.lat === "number";
  const markers = [{ id: "me", kind: "me", lat: pick.lat, lng: pick.lng }].concat(hasDrop ? [{ id: "drop", kind: "drop", lat: drop.lat, lng: drop.lng }] : []).concat(
    sorted.filter((r) => pos[r.id]).map((r) => ({
      id: r.id, kind: "driver", lat: pos[r.id].lat, lng: pos[r.id].lng, online: true,
      emoji: vehicleEmoji(r.trade_slug + " " + r.trade_name), selected: sel === r.id,
      label: `${etaMin(kmBetween(pick, pos[r.id]))} min`,
    })));
  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: T.ink, margin: "0 0 10px" }}>{t("rd_nearby")}{sorted.length ? ` (${sorted.length})` : ""}</h2>
      <UberMap markers={markers} lines={hasDrop ? [{ pts: [[pick.lat, pick.lng], [drop.lat, drop.lng]] }] : []} height="46vh" onSelect={(id) => { if (id !== "me" && id !== "drop") setSel(id); }} />
      {typeof between === "function" ? between(info) : between}
      {rows !== null && sorted.length === 0 && <div style={{ fontSize: 14, color: T.inkFaint, lineHeight: 1.6, marginTop: 10 }}>{t("rd_nearby_none")}</div>}
      <div style={{ marginTop: 10 }}>
        {sorted.map((d) => {
          const on = onlineIds.has(d.id);
          const hm = homes[d.id];
          const km = hm && typeof hm.lat === "number" && pickOk ? kmBetween(pick, hm) : d.distance_km != null ? Number(d.distance_km) : null;
          const rate = Number(fares[d.id]) > 0 ? Number(fares[d.id]) : null;
          const tripFare = trip && rate ? Math.max(rate, Math.round((trip.km * rate) / 5) * 5) : null;
          return (
            <div key={d.id} onClick={() => setSel(d.id)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: T.white, border: sel === d.id ? "2px solid #111827" : `1px solid ${T.line}`, borderRadius: 14, padding: "10px 12px", marginBottom: 8 }}>
              <span style={{ width: 44, height: 44, borderRadius: "50%", background: "#F3F4F6", border: `3px solid ${on ? "#16A34A" : "#9CA3AF"}`, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, filter: on ? "none" : "grayscale(1)" }}>{vehicleEmoji(d.trade_slug + " " + d.trade_name)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.display_name}</span>
                <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft }}>{d.trade_name}{(hm && hm.address) || d.locality ? ` · ${(hm && hm.address) || d.locality}` : ""}</span>
                <span style={{ display: "inline-block", marginTop: 3, fontSize: 11.5, fontWeight: 800, color: on ? "#0F8A3C" : "#6B7280" }}>{on ? t("rd_on") : t("rd_off")}</span>
              </span>
              <span style={{ textAlign: "right" }}>
                {km != null && <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.brandDark }}>{String(t("rd_away")).replace("{n}", km < 10 ? km.toFixed(1) : Math.round(km))}{` · ${etaMin(km)} min`}</span>}
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

export function LiveRideMap({ pick, drop, driver, route = null, delivery = false, height = 230 }) {
  const box = useRef(null);
  const st = useRef({});
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (dead || !box.current) return;
      if (!st.current.map) {
        const base = pick || drop || driver;
        if (!base) return;
        st.current.map = L.map(box.current).setView([base.lat, base.lng], 14);
        st.current.map.attributionControl.setPrefix(false); ensureCss();
        L.tileLayer(TILES, { subdomains: SUBS, maxZoom: 19, attribution: CREDIT }).addTo(st.current.map);
        st.current.layer = L.layerGroup().addTo(st.current.map);
      }
      const { map, layer } = st.current;
      layer.clearLayers();
      const dot = (c, txt) => L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13],
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);color:#fff;font:800 12px sans-serif;display:flex;align-items:center;justify-content:center">${txt}</div>` });
      // In a delivery the customer's own door is the biggest thing on the map,
      // the restaurant is a shop icon, and the rider is smaller than both so
      // he never hides the door when he arrives.
      const big = (c, emoji, size, label) => L.divIcon({ className: "", iconSize: [size, size + (label ? 18 : 0)], iconAnchor: [size / 2, size / 2],
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">${emoji}</div>${label ? `<div style="margin-top:2px;text-align:center;font:800 12px sans-serif;color:#111;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;white-space:nowrap">${label}</div>` : ""}` });
      const pts = [];
      if (pick && delivery) { pts.push([pick.lat, pick.lng]); L.marker([pick.lat, pick.lng], { icon: big("#166534", `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M4 9l1.5-5h13L20 9M4 9v10h16V9M4 9h16M9 19v-5h6v5"/></svg>`, 28), zIndexOffset: 200 }).addTo(layer); }
      else if (pick) { pts.push([pick.lat, pick.lng]); L.marker([pick.lat, pick.lng], { icon: dot("#16A34A", "A") }).addTo(layer); }
      if (drop && typeof drop.lat === "number") { L.marker([drop.lat, drop.lng], { icon: delivery ? big("#B91C1C", `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6"/></svg>`, 34, "You") : dot("#DC2626", "B"), zIndexOffset: delivery ? 500 : 0 }).addTo(layer); pts.push([drop.lat, drop.lng]); }
      if (driver) {
        const h = Math.round(driver.heading || 0);
        L.marker([driver.lat, driver.lng], {
          zIndexOffset: 1000,
          icon: L.divIcon({ className: "", iconSize: [delivery ? 24 : 44, delivery ? 24 : 44], iconAnchor: [delivery ? 12 : 22, delivery ? 12 : 22],
            html: `<div style="width:${delivery ? 24 : 44}px;height:${delivery ? 24 : 44}px;border-radius:50%;background:#1D4ED8;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><svg width="${delivery ? 14 : 26}" height="${delivery ? 14 : 26}" viewBox="0 0 24 24" style="transform:rotate(${h}deg)"><path d="M12 2l7 18-7-4-7 4z" fill="#fff"/></svg></div>` }),
        }).addTo(layer);
        if (route && route.length > 1) L.polyline(route, { color: "#1D4ED8", weight: 5, opacity: 0.85 }).addTo(layer);
        else if (pick) L.polyline([[driver.lat, driver.lng], [pick.lat, pick.lng]], { color: "#1D4ED8", weight: 3, dashArray: "6 8", opacity: 0.8 }).addTo(layer);
        pts.push([driver.lat, driver.lng]);
      }
      if (pts.length === 0) return;
      if (pts.length > 1) map.fitBounds(pts, { padding: [34, 34], maxZoom: 16 }); else map.setView(pts[0], 15);
      setTimeout(() => map.invalidateSize(), 50);
    })();
    return () => { dead = true; };
  }, [pick && pick.lat, pick && pick.lng, drop && drop.lat, route && route.length, driver && driver.lat, driver && driver.lng, driver && Math.round((driver.heading || 0) / 10)]); // eslint-disable-line react-hooks/exhaustive-deps
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
        {drv && km != null && km < 0.12 ? t("rd_live_arrived") : drv ? `${String(t("rd_live_dist")).replace("{n}", fmtKm(km))}${toward === true ? ` · ${t("rd_live_toward")}` : toward === false ? ` · ${t("rd_live_away")}` : ""}` : t("rd_live_wait")}
      </div>
    </div>
  );
}

// The driver's view: own position and heading from the phone, sent every few
// seconds while the ride is on, with the pickup in view.
export function DriverLive({ api, ride, where = null }) {
  const { t } = useI18n();
  const [me, setMe] = useState(null);
  const last = useRef(null);
  const sent = useRef(0);
  // One position for the driver everywhere: when the driver chose a spot (the
  // saved address or a pin) that spot is used here and sent to the passenger;
  // the phone is only read when the driver is on live GPS.
  const pinned = where && where.manual;
  useEffect(() => {
    if (pinned) return undefined;
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
  }, [api, pinned]);
  if (typeof ride.pick_lat !== "number") return null;
  const pick = { lat: ride.pick_lat, lng: ride.pick_lng };
  const here = pinned ? { lat: where.lat, lng: where.lng, heading: bearing({ lat: where.lat, lng: where.lng }, pick) } : me;
  const km = here ? kmBetween(here, pick) : null;
  return (
    <div>
      <LiveRideMap pick={pick} drop={typeof ride.drop_lat === "number" ? { lat: ride.drop_lat, lng: ride.drop_lng } : null} driver={here} />
      {here && <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{String(t("rd_pick_in")).replace("{n}", fmtKm(km))}</div>}
    </div>
  );
}

// The customer's map for a food delivery: the restaurant, their own door and
// the rider moving between them, with plain words for where the rider is.
export function DeliveryLive({ api, orderId, riderName }) {
  const { t } = useI18n();
  const [d, setD] = useState(null);
  const prev = useRef(null);
  const [heading, setHeading] = useState(0);
  const [route, setRoute] = useState(null);
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const r = many(await api.orderRiderPos(orderId))[0];
        if (!live) return;
        setD(r || null);
        if (r && typeof r.lat === "number") {
          const cur = { lat: r.lat, lng: r.lng };
          if (prev.current && kmBetween(prev.current, cur) > 0.01) { setHeading(bearing(prev.current, cur)); prev.current = cur; }
          else if (!prev.current) prev.current = cur;
        }
      } catch (_) { /* next tick */ }
    };
    tick();
    const id = setInterval(() => { if (!document.hidden) tick(); }, 5000);
    return () => { live = false; clearInterval(id); };
  }, [api, orderId]);
  const hasShop = d && typeof d.shop_lat === "number", hasDoor = d && typeof d.drop_lat === "number";
  const shop = hasShop ? { lat: d.shop_lat, lng: d.shop_lng } : null;
  const door = hasDoor ? { lat: d.drop_lat, lng: d.drop_lng } : null;
  const rider = d && typeof d.lat === "number" ? { lat: d.lat, lng: d.lng, heading } : null;
  const picked = !!d && d.job_status === "picked_up";
  const target = picked ? door : shop;
  // The road the rider will take, from where he is now to the next stop,
  // asked again every 20 seconds or so (the same free routing service the
  // directions screen uses).
  const rl = rider && Math.round(rider.lat * 500), rg = rider && Math.round(rider.lng * 500);
  const [eta, setEta] = useState(null);
  useEffect(() => {
    if (!rider || !target) { setRoute(null); setEta(null); return undefined; }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    fetch(`${OSRM}${rider.lng},${rider.lat};${target.lng},${target.lat}?overview=full&geometries=geojson`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => { const r0 = j && j.routes && j.routes[0]; if (r0) { setRoute(r0.geometry.coordinates.map(([lng, lat]) => [lat, lng])); setEta(Math.max(1, Math.round(r0.duration / 60))); } })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => { ctl.abort(); clearTimeout(timer); };
  }, [rl, rg, picked, target && target.lat, target && target.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shop && !door && !rider) return null;
  const km = rider && target ? kmBetween(rider, target) : null;
  const reached = km != null && km < 0.12;
  // The rider's phone has not reported for a while: say how long, instead of
  // showing an old dot as if it were live.
  const ageMin = d && d.seen_at ? Math.round((Date.now() - new Date(d.seen_at).getTime()) / 60000) : null;
  const stale = rider && ageMin != null && ageMin >= 2 ? ageMin : null;
  const text = !rider ? t("dl_no_pos")
    : !target ? t("dl_on_way")
    : picked ? (reached ? t("dl_at_you") : String(t("dl_to_you")).replace("{n}", fmtKm(km)))
    : (reached ? t("dl_at_shop") : String(t("dl_to_shop")).replace("{n}", fmtKm(km)));
  return (
    <div style={{ margin: "10px 0" }}>
      <LiveRideMap pick={shop} drop={door} driver={rider} route={route} delivery />
      <div style={{ fontSize: 15, fontWeight: 800, color: reached ? "#0F6B33" : T.ink, marginTop: 8 }}>
        {riderName ? `${riderName}: ` : ""}{text}
      </div>
      {stale != null && <div style={{ fontSize: 13.5, fontWeight: 700, color: "#B45309", marginTop: 2 }}>{String(t("dl_stale")).replace("{n}", stale)}</div>}
      {eta != null && !reached && <div style={{ fontSize: 14, fontWeight: 700, color: T.brandDark, marginTop: 2 }}>{String(picked ? t("dl_eta_you") : t("dl_eta_shop")).replace("{n}", eta)}</div>}
      <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{t("dl_legend")}</div>
    </div>
  );
}

// On the rider's phone while a delivery is on: sends the position every few
// seconds so the customer's map moves. Renders nothing.
// The rider's own position while a delivery is on: read from the phone, sent to
// the server every few seconds so the customer's map moves, and returned for
// the rider's own map. A pinned spot (where.manual) is used as it is.
export function useJobPosition(api, where = null) {
  const sent = useRef(0);
  const last = useRef(null);
  const [me, setMe] = useState(null);
  const pinned = where && where.manual;
  useEffect(() => {
    if (pinned) return undefined;
    const geo = typeof navigator !== "undefined" && navigator.geolocation;
    if (!geo) return undefined;
    const push = (g, force) => {
      if (!force && Date.now() - sent.current < 8000) return;
      sent.current = Date.now();
      api.setAvailability(true, { lat: g.lat, lng: g.lng, accuracy: g.accuracy }, null).catch(() => {});
    };
    const id = geo.watchPosition((g) => {
      const cur = { lat: g.coords.latitude, lng: g.coords.longitude, accuracy: g.coords.accuracy };
      let heading = typeof g.coords.heading === "number" && !Number.isNaN(g.coords.heading) ? g.coords.heading : null;
      if (heading === null && last.current && kmBetween(last.current, cur) > 0.01) heading = bearing(last.current, cur);
      if (!last.current || kmBetween(last.current, cur) > 0.01) last.current = cur;
      setMe((m) => ({ ...cur, heading: heading === null ? (m && m.heading) || 0 : heading }));
      push(cur, false);
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    // Keep the screen awake while a delivery is on, and send the position the
    // moment the rider comes back to the app.
    let lock = null;
    const hold = async () => { try { if (navigator.wakeLock && !document.hidden) lock = await navigator.wakeLock.request("screen"); } catch (_) { /* not allowed: fine */ } };
    const onVis = () => { if (!document.hidden) { hold(); if (last.current) push(last.current, true); } };
    hold();
    document.addEventListener("visibilitychange", onVis);
    return () => { geo.clearWatch(id); document.removeEventListener("visibilitychange", onVis); try { if (lock) lock.release(); } catch (_) { /* ignore */ } };
  }, [api, pinned]);
  return pinned ? { lat: where.lat, lng: where.lng, heading: 0 } : me;
}

// Sends the position only; draws nothing.
export function JobPositionSender({ api, where = null }) {
  useJobPosition(api, where);
  return null;
}

// The rider's map for a delivery: the restaurant, the customer's door, himself,
// and the road to the next stop with the distance and time.
export function RiderJobMap({ api, job, where = null, onChanged = null }) {
  const { t } = useI18n();
  const me = useJobPosition(api, where);
  const shop = typeof job.pickup_lat === "number" ? { lat: job.pickup_lat, lng: job.pickup_lng } : null;
  const door = typeof job.drop_lat === "number" ? { lat: job.drop_lat, lng: job.drop_lng } : null;
  const picked = job.status === "picked_up";
  const target = picked ? door : shop;
  const [route, setRoute] = useState(null);
  const [eta, setEta] = useState(null);
  const rl = me && Math.round(me.lat * 500), rg = me && Math.round(me.lng * 500);
  useEffect(() => {
    if (!me || !target) { setRoute(null); setEta(null); return undefined; }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    fetch(`${OSRM}${me.lng},${me.lat};${target.lng},${target.lat}?overview=full&geometries=geojson`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => { const r0 = j && j.routes && j.routes[0]; if (r0) { setRoute(r0.geometry.coordinates.map(([lng, lat]) => [lat, lng])); setEta({ min: Math.max(1, Math.round(r0.duration / 60)), km: r0.distance / 1000 }); } })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => { ctl.abort(); clearTimeout(timer); };
  }, [rl, rg, picked, target && target.lat, target && target.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shop && !door && !me) return null;
  const km = me && target ? kmBetween(me, target) : null;
  const reached = km != null && km < 0.12;
  // A point that is missing can be saved from the rider's own phone, standing
  // at the restaurant or at the customer's door.
  const [pinMsg, setPinMsg] = useState("");
  const save = async (kind) => {
    setPinMsg("");
    try {
      const r = many(await api.jobSetPoint(job.id, kind, me.lat, me.lng))[0];
      if (r && r.ok) { onChanged && onChanged(); } else setPinMsg(t("rm_pin_fail"));
    } catch (_) { setPinMsg(t("rm_pin_fail")); }
  };
  const missing = !picked && !shop ? "shop" : picked && !door ? "drop" : null;
  return (
    <div style={{ margin: "10px 0" }}>
      <LiveRideMap pick={shop} drop={door} driver={me} route={route} delivery />
      {missing && (
        <div style={{ background: "#FFF7E6", border: "1px solid #F5D58C", borderRadius: 12, padding: "10px 12px", margin: "8px 0" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#8A5A00", marginBottom: 8 }}>{t(missing === "shop" ? "rm_no_shop" : "rm_no_drop")}</div>
          <button disabled={!me} onClick={() => save(missing)} style={{ minHeight: 46, padding: "0 16px", borderRadius: 12, border: "none", background: "#0A5BB8", color: "#fff", fontWeight: 800, fontSize: 14.5, cursor: me ? "pointer" : "default", fontFamily: "inherit", opacity: me ? 1 : 0.5 }}>{t(missing === "shop" ? "rm_save_shop" : "rm_save_drop")}</button>
          {pinMsg && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, fontSize: 13, marginTop: 6 }}>{pinMsg}</div>}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 800, color: reached ? "#0F6B33" : T.ink }}>
        {reached ? (picked ? t("rm_at_customer") : t("rm_at_shop"))
          : !me ? t("rm_locating")
          : eta ? String(picked ? t("rm_to_customer") : t("rm_to_shop")).replace("{km}", eta.km < 10 ? eta.km.toFixed(1) : Math.round(eta.km)).replace("{n}", eta.min)
          : km != null ? String(picked ? t("rm_to_customer_km") : t("rm_to_shop_km")).replace("{km}", fmtKm(km)) : ""}
      </div>
    </div>
  );
}

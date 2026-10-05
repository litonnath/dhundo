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

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

function DriverMap({ me, pins, height }) {
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
        L.tileLayer(TILES, { subdomains: "abcd", maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(st.current.map);
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
          html: `<div style="width:30px;height:30px;border-radius:50%;background:${p.online ? "#16A34A" : "#6B7280"};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:800 13px sans-serif">${String(p.name || "?").trim().charAt(0).toUpperCase()}</div>`,
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

export function NearbyDrivers({ api, pick, state, slugs, vehicle, onlineIds, fares, trip, height = 250 }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(null);
  const [pos, setPos] = useState({});
  useEffect(() => {
    if (!pick || typeof pick.lat !== "number") { setRows(null); return undefined; }
    let live = true;
    (async () => {
      try {
        const list = many(await api.browse({ group: "Drivers", lat: pick.lat, lng: pick.lng, radiusKm: 30, limit: 40, state }));
        if (!live) return;
        setRows(list);
        const ids = list.map((r) => r.id).filter(Boolean).slice(0, 25);
        if (ids.length) {
          const got = many(await api.publicPositions(ids));
          if (live) { const o = {}; got.forEach((g) => { o[g.id] = g; }); setPos(o); }
        }
      } catch (_) { if (live) setRows([]); }
    })();
    return () => { live = false; };
  }, [api, pick && pick.lat, pick && pick.lng, state]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pick || typeof pick.lat !== "number") return null;
  const shown = (rows || []).filter((r) => (!slugs || slugs.includes(r.trade_slug)) && (!vehicle || vehicle === "any" || r.trade_slug === vehicle));
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

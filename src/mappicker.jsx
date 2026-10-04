// ===========================================================================
// mappicker.jsx -- "put the pin on your house".
//
// WHY THIS EXISTS AT ALL
// Three attempts at precise location came before it: free text, a curated
// list, then an OpenStreetMap geocoder. Each failed the same way -- somebody
// typed a real place ("Tilthai") that the data did not contain. No geocoder
// fixes that, Google included: a para that appears in no register cannot be
// looked up by name in any register.
//
// A map sidesteps the question. The person does not name their location,
// they POINT at it. That works for an unnamed para, a new colony, a house
// on a lane with no name -- and it is exact to a few metres, which is better
// than Google's geocoder would give for a rural address anyway.
//
// WHAT IT COSTS: nothing.
//   * Leaflet is MIT-licensed and loaded from the bundle, not a CDN.
//   * The tiles come from OpenStreetMap's own servers -- no key, no account.
//   * No geocoding call is made at all. Nothing is looked up; a coordinate
//     comes straight off the map.
//
// ON THE TILES
// openstreetmap.org's tile servers are run on donated hardware and their
// usage policy is meant for light use. This qualifies today -- a map opened
// a handful of times a day while somebody sets their address once. If Dhundo
// grows to where that is no longer true, TILE_URL below is one line and free
// keyed providers (MapTiler, Carto) have tiers far beyond anything this will
// reach. Attribution is a condition of use, not a courtesy, and is rendered
// in the corner of the map.
//
// LOADED ON DEMAND
// Leaflet is about 42 KB gzipped, which is a third of this whole app. It is
// imported dynamically so it downloads the first time somebody opens the
// map and never for anyone who does not -- on the 3G connections this
// audience has, making everyone pay for a screen most will not open would
// be a poor trade.
// ===========================================================================
import React, { useEffect, useRef, useState } from "react";
import { T, Icon, Btn, CloseButton, useDismissable } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { useConsent } from "./consent-core.js";
import { geoJson, takeGoogleMap, googleTileUrl, searchAnywhere, placeCoords, googleSearch } from "./regions.js";

// THREE WAYS TO SEE THE GROUND, in the order they are tried.
//   sat     satellite photographs (Esri World Imagery) with place names on top.
//           The one that matters for "put the pin on my house": a village lane
//           that OpenStreetMap draws as nothing is plain to see from above.
//   street  OpenStreetMap's own map.
//   carto   Carto's street map, the backup when the first two do not load.
// Each is one entry here, so swapping a provider (or putting a keyed one in
// when the free ones are outgrown) is a one-line change. Esri's public tile
// service is meant for light use and asks for the attribution shown on the
// map; for heavier use take a keyed provider (MapTiler, Mapbox, Esri's own).
const TILES = {
  sat: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    // Names drawn over the photographs: roads, then towns, villages and
    // rivers. (Shops and landmarks are not in these layers; the line under the
    // map lists the ones nearest the pin.)
    overlays: [
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", native: 17 },
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", native: 18 },
    ],
    native: 18,
    attrib: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    native: 19,
    attrib: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  carto: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    sub: "abcd", native: 19,
    attrib: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};
const ORDER = ["sat", "street", "carto"];
const LAYER_KEY = "dhundo_map_layer";

// Agartala, for when there is nothing else to centre on.
const FALLBACK = { lat: 23.8315, lng: 91.2868 };

export default function MapPicker({ start, state, onCancel, onConfirm }) {
  const consent = useConsent();
  const { t } = useI18n();
  // Back closes the map rather than leaving the app -- the most likely place
  // for somebody to press it, since this covers the whole screen.
  useDismissable(true, onCancel);
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const [point, setPoint] = useState(
    start && typeof start.lat === "number" ? { lat: start.lat, lng: start.lng } : FALLBACK
  );
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [layer, setLayerState] = useState(() => {
    try { const v = window.localStorage.getItem(LAYER_KEY); if (TILES[v]) return v; } catch (_) {}
    return "sat";
  });
  const [backup, setBackup] = useState(false);
  // null until asked; "google" while this month's allowance lasts; then "free".
  const [gate, setGate] = useState(null);
  const gsess = useRef({});
  const [near, setNear] = useState([]);
  const [sq, setSq] = useState("");
  const [srows, setSrows] = useState([]);
  const [sbusy, setSbusy] = useState(false);
  const LRef = useRef(null);
  const setLayer = (v) => {
    setLayerState(v);
    try { window.localStorage.setItem(LAYER_KEY, v); } catch (_) {}
  };

  useEffect(() => {
    let map = null;
    let cancelled = false;

    (async () => {
      let L;
      try {
        // Both dynamic, so neither is in the main bundle.
        L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
      } catch (_) {
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled || !boxRef.current) return;

      LRef.current = L;
      map = L.map(boxRef.current, {
        center: [point.lat, point.lng],
        zoom: start && typeof start.lat === "number" ? 17 : 14,
        zoomControl: true,
        attributionControl: true,
      });

      // The pin is FIXED to the centre of the screen and the map moves under
      // it -- the pattern every delivery app settled on. Dragging a small
      // marker with a thumb that covers it is the obvious design and the
      // wrong one: your own finger hides the thing you are aiming.
      const update = () => {
        const c = map.getCenter();
        if (!cancelled) setPoint({ lat: c.lat, lng: c.lng });
      };
      map.on("move", update);
      map.on("moveend", update);

      mapRef.current = map;
      if (!cancelled) setReady(true);
      // Leaflet mis-sizes itself inside a sheet that animates in.
      setTimeout(() => map.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
    };
    // Built once: re-running this would tear down the map mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The ground under the pin. Re-drawn when the person switches, and moved on
  // to the next provider by itself when the first one is not loading (a
  // blocked server, a network that refuses it): six failures and not one tile
  // is how a blank grey map is told from a slow one.
  // One Google session is counted per opening of the map (sql/99), against a
  // monthly allowance; past it, or with no key, the free layers below are used.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    takeGoogleMap().then((ok) => { if (alive) setGate(ok ? "google" : "free"); });
    return () => { alive = false; };
  }, [ready]);

  useEffect(() => {
    const L = LRef.current, map = mapRef.current;
    if (!ready || !L || !map || gate === null) return undefined;
    let parts = [];
    let dead = false;
    const arm = (first, withFallback) => {
      let good = 0, bad = 0, moved = false;
      first.on("tileload", () => { good += 1; });
      first.on("tileerror", () => {
        bad += 1;
        if (!moved && good === 0 && bad >= 6) { moved = true; withFallback(); }
      });
    };
    const drawFree = () => {
      const spec = TILES[layer === "google" ? "sat" : layer];
      const base = L.tileLayer(spec.url, {
        maxZoom: 19, maxNativeZoom: spec.native, subdomains: spec.sub || "abc", attribution: spec.attrib,
      });
      parts = [base];
      (spec.overlays || []).forEach((o) => parts.push(L.tileLayer(o.url, { maxZoom: 19, maxNativeZoom: o.native })));
      arm(base, () => {
        const next = ORDER[(ORDER.indexOf(layer) + 1) % ORDER.length];
        if (next !== "sat") { setBackup(true); setLayerState(next); }
        else setBackup(false);
      });
      parts.forEach((x) => x.addTo(map));
    };
    if (gate === "google" && (layer === "sat" || layer === "street")) {
      googleTileUrl(layer === "sat" ? "sat" : "road", gsess.current).then((url) => {
        if (dead) return;
        if (!url) { setGate("free"); return; }
        const g = L.tileLayer(url, {
          maxZoom: 21, maxNativeZoom: 20, attribution: "&copy; Google",
        });
        parts = [g];
        arm(g, () => setGate("free"));
        g.addTo(map);
      });
    } else {
      drawFree();
    }
    return () => { dead = true; parts.forEach((x) => { try { map.removeLayer(x); } catch (_) {} }); };
  }, [layer, ready, gate]);

  // WHAT IS NEAR THE PIN: the closest named things the map knows -- a shop, a
  // school, a road, a river -- so the pin can be checked against something
  // real. Asked once the map has stopped moving, and not again for a pin that
  // has hardly moved.
  const lastNear = useRef(null);
  useEffect(() => {
    if (!ready) return undefined;
    const last = lastNear.current;
    if (last && Math.abs(last.lat - point.lat) < 0.00015 && Math.abs(last.lng - point.lng) < 0.00015) return undefined;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      lastNear.current = { lat: point.lat, lng: point.lng };
      geoJson("photon", `reverse?lat=${point.lat}&lon=${point.lng}&limit=10&lang=en`, ctrl.signal)
        .then((j) => {
          const seen = new Set();
          const names = ((j && j.features) || []).map((f) => {
            const p = (f && f.properties) || {};
            return String(p.name || p.street || "").trim();
          }).filter((x) => {
            const k = x.toLowerCase();
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return true;
          }).slice(0, 6);
          if (!ctrl.signal.aborted) setNear(names);
        })
        .catch(() => {});
    }, 800);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [point.lat, point.lng, ready]);

  // SHOPS, RESTAURANTS, CLINICS ON THE MAP. Satellite photos carry no names,
  // so the named places OpenStreetMap holds inside the view are drawn on top
  // as small labelled dots once the map is zoomed in far enough to read
  // them. Only what people have mapped can show: where nobody has added a
  // shop yet there is nothing to draw, and that is a gap in the data, not in
  // the app.
  const poiLayer = useRef(null);
  const poiKey = useRef("");
  useEffect(() => {
    const L = LRef.current, map = mapRef.current;
    if (!ready || !L || !map || gate !== "free") return undefined;
    if (!poiLayer.current) poiLayer.current = L.layerGroup().addTo(map);
    let ctrl = null, timer = null;
    const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const draw = (els) => {
      poiLayer.current.clearLayers();
      els.forEach((e) => {
        const la = e.lat != null ? e.lat : e.center && e.center.lat;
        const lo = e.lon != null ? e.lon : e.center && e.center.lon;
        const name = e.tags && (e.tags["name:en"] || e.tags.name);
        if (typeof la !== "number" || typeof lo !== "number" || !name) return;
        L.marker([la, lo], {
          interactive: false, keyboard: false,
          icon: L.divIcon({
            className: "",
            html: `<div style="transform:translate(-4px,-4px);white-space:nowrap;font:700 11px system-ui,sans-serif;` +
              `color:#fff;text-shadow:0 0 3px #000,0 0 3px #000,0 0 2px #000;display:flex;align-items:center;gap:4px">` +
              `<span style="width:8px;height:8px;border-radius:50%;background:#FFB300;border:1.5px solid #fff;flex:none"></span>${esc(name)}</div>`,
            iconSize: [0, 0],
          }),
        }).addTo(poiLayer.current);
      });
    };
    const load = () => {
      if (map.getZoom() < 16) { poiLayer.current.clearLayers(); poiKey.current = ""; return; }
      const b = map.getBounds();
      const bb = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((n) => n.toFixed(4)).join(",");
      if (bb === poiKey.current) return;
      poiKey.current = bb;
      if (ctrl) ctrl.abort();
      ctrl = new AbortController();
      const q = `[out:json][timeout:12];(nwr["name"]["shop"](${bb});nwr["name"]["amenity"](${bb});` +
        `nwr["name"]["tourism"](${bb});nwr["name"]["office"](${bb});nwr["name"]["craft"](${bb}););out center 80;`;
      const tryHost = async (host) => {
        const r = await fetch(`${host}?data=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error("overpass " + r.status);
        return r.json();
      };
      tryHost("https://overpass-api.de/api/interpreter")
        .catch((e) => { if (ctrl.signal.aborted) throw e; return tryHost("https://overpass.kumi.systems/api/interpreter"); })
        .then((j) => { if (!ctrl.signal.aborted) draw((j && j.elements) || []); })
        .catch(() => { poiKey.current = ""; });
    };
    const onMove = () => { clearTimeout(timer); timer = setTimeout(load, 700); };
    map.on("moveend", onMove);
    onMove();
    return () => {
      clearTimeout(timer); if (ctrl) ctrl.abort();
      map.off("moveend", onMove);
      if (poiLayer.current) { poiLayer.current.clearLayers(); }
    };
  }, [ready, gate]);

  // SEARCH INSIDE THE MAP: type a village, shop or road and the map moves
  // there, so the pin can be set on the exact spot without going back.
  useEffect(() => {
    const q = sq.trim();
    if (q.length < 3) { setSrows([]); setSbusy(false); return undefined; }
    const ctrl = new AbortController();
    setSbusy(true);
    const timer = setTimeout(async () => {
      // Google first; the free search when it has nothing or its monthly
      // allowance is used up.
      const g = q.length >= 4 ? await googleSearch(q, point.lat, point.lng) : [];
      if (ctrl.signal.aborted) return;
      if (g.length) { setSrows(g); setSbusy(false); return; }
      searchAnywhere(q, { state, near: point, signal: ctrl.signal })
        .then((out) => { if (!ctrl.signal.aborted) setSrows(((out && out.rows) || []).slice(0, 6)); })
        .catch(() => {})
        .finally(() => { if (!ctrl.signal.aborted) setSbusy(false); });
    }, 700);
    return () => { clearTimeout(timer); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sq]);

  // Enter asks Google; what it finds goes above the free results.
  const askGoogle = async () => {
    const q = sq.trim();
    if (q.length < 3) return;
    setSbusy(true);
    const rows = await googleSearch(q, point.lat, point.lng);
    setSbusy(false);
    if (rows.length) setSrows((cur) => [...rows, ...cur.filter((c) => c.source !== "google")].slice(0, 8));
  };

  const goTo = async (r) => {
    let { lat, lng } = r;
    if (typeof lat !== "number") {
      const xy = await placeCoords(r.state || state, r.area || r.title).catch(() => null);
      if (xy) { lat = xy.lat; lng = xy.lng; }
    }
    if (typeof lat !== "number" || !mapRef.current) return;
    mapRef.current.setView([lat, lng], r.kind === "place" ? 16 : 18);
    setSq(""); setSrows([]);
  };

  const useDeviceFix = async () => {
    if (!navigator.geolocation) return;
    // The phone's position is read only after a yes.
    if (!(await consent.ask("location"))) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPoint({ lat: latitude, lng: longitude });
        if (mapRef.current) mapRef.current.setView([latitude, longitude], 17);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <div
      role="dialog" aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 360, background: T.white,
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
        borderBottom: `1px solid ${T.line}`, flexShrink: 0,
      }}>
        <button onClick={onCancel} aria-label={t("w_back")} style={{
          background: "none", border: "none", cursor: "pointer", color: T.ink, padding: 4,
        }}><Icon name="back" size={22} /></button>
        <span style={{ fontSize: 16.5, fontWeight: 800, color: T.ink, flex: 1 }}>
          {t("map_title")}
        </span>
        {/* Both a back arrow and an X: this is full-screen, so it reads as a
            page to some people and as a dialog to others. */}
        <CloseButton onClick={onCancel} />
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <div ref={boxRef} style={{ position: "absolute", inset: 0, background: T.paper }} />

        {/* The pin, dead centre, above the map and ignoring pointer events so
            it never swallows a drag. */}
        {ready && (
          <div style={{
            position: "absolute", left: "50%", top: "50%", pointerEvents: "none",
            transform: "translate(-50%, -100%)", zIndex: 500,
          }}>
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
              <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"
                    fill="#F87617" stroke="#fff" strokeWidth="1.6" />
              <circle cx="12" cy="10" r="2.6" fill="#fff" />
            </svg>
          </div>
        )}

        {!ready && !failed && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", color: T.inkFaint, fontSize: 14,
          }}>{t("map_loading")}</div>
        )}

        {/* The map is a convenience, not a dependency: if it will not load --
            no network, a blocked tile server -- the person can still save the
            fix their phone already has. */}
        {failed && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 14, padding: 24,
            textAlign: "center",
          }}>
            <span style={{ color: T.inkFaint }}><Icon name="pin" size={34} /></span>
            <span style={{ fontSize: 14.5, color: T.inkSoft, lineHeight: 1.6 }}>
              {t("map_failed")}
            </span>
            <Btn onClick={useDeviceFix}>{t("map_use_gps")}</Btn>
          </div>
        )}

        {ready && (
          <div style={{ position: "absolute", left: 62, right: 150, top: 12, zIndex: 500 }}>
            <input
              value={sq} onChange={(e) => setSq(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") askGoogle(); }} enterKeyHint="search"
              placeholder={t("map_search_ph")} aria-label={t("map_search_ph")}
              style={{
                width: "100%", boxSizing: "border-box", minHeight: 42, borderRadius: 10,
                border: `1px solid ${T.line}`, padding: "8px 12px", fontSize: 14.5,
                fontFamily: "inherit", boxShadow: "0 2px 8px rgba(15,20,25,0.3)", background: T.white, color: T.ink,
              }}
            />
            {(srows.length > 0 || (sbusy && sq.trim().length >= 3)) && (
              <div style={{
                marginTop: 4, background: T.white, borderRadius: 10, overflow: "hidden",
                boxShadow: "0 2px 10px rgba(15,20,25,0.3)", maxHeight: 260, overflowY: "auto",
              }}>
                {srows.length === 0 && <div style={{ padding: "10px 12px", fontSize: 13, color: T.inkFaint }}>…</div>}
                {srows.map((r, i) => (
                  <button key={i} onClick={() => goTo(r)} style={{
                    display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                    background: T.white, padding: "9px 12px", borderTop: i ? `1px solid ${T.line}` : "none",
                    fontFamily: "inherit",
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: T.inkFaint }}>{r.line || r.area}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {ready && (
          <div style={{
            position: "absolute", right: 12, top: 12, zIndex: 500, display: "flex",
            borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 8px rgba(15,20,25,0.3)",
            background: T.white,
          }}>
            {[["sat", "map_sat"], ["street", "map_street"]].map(([k, label]) => (
              <button key={k} onClick={() => { setBackup(false); setLayer(k); }} style={{
                border: "none", padding: "10px 14px", minHeight: 42, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13.5, fontWeight: 800,
                background: (layer === k || (k === "street" && layer === "carto")) ? T.brandDark : T.white,
                color: (layer === k || (k === "street" && layer === "carto")) ? "#fff" : T.ink,
              }}>{t(label)}</button>
            ))}
          </div>
        )}
        {ready && backup && (
          <div style={{
            position: "absolute", left: 12, right: 70, top: 12, zIndex: 500, padding: "8px 11px",
            borderRadius: 9, background: "rgba(255,255,255,0.94)", color: T.inkSoft, fontSize: 12.5,
            lineHeight: 1.45, boxShadow: "0 2px 8px rgba(15,20,25,0.2)", marginLeft: 44,
          }}>{t("map_backup")}</div>
        )}

        {ready && (
          <button onClick={useDeviceFix} aria-label={t("map_use_gps")} title={t("map_use_gps")}
            style={{
              position: "absolute", right: 12, bottom: 14, zIndex: 500,
              width: 46, height: 46, borderRadius: "50%", border: "none",
              background: T.white, color: T.brandDark, cursor: "pointer",
              boxShadow: "0 3px 10px rgba(15,20,25,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Icon name="crosshair" size={22} /></button>
        )}
      </div>

      <div style={{ padding: "14px 16px 18px", borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
        {near.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.inkFaint, textTransform: "uppercase",
                          letterSpacing: 0.4, marginBottom: 5 }}>{t("map_near")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {near.map((n) => (
                <span key={n} style={{
                  padding: "5px 10px", borderRadius: 16, background: T.paper, border: `1px solid ${T.line}`,
                  fontSize: 12.5, fontWeight: 600, color: T.ink,
                }}>{n}</span>
              ))}
            </div>
          </div>
        )}
        <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, marginBottom: 12 }}>
          {t("map_hint")}
        </div>
        <Btn full onClick={() => onConfirm(point)} disabled={!ready && !failed}>
          {t("map_confirm")}
        </Btn>
      </div>
    </div>
  );
}

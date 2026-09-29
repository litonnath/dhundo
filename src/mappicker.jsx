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

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Agartala, for when there is nothing else to centre on.
const FALLBACK = { lat: 23.8315, lng: 91.2868 };

export default function MapPicker({ start, onCancel, onConfirm }) {
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

      map = L.map(boxRef.current, {
        center: [point.lat, point.lng],
        zoom: start && typeof start.lat === "number" ? 17 : 13,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIB }).addTo(map);

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

  const useDeviceFix = () => {
    if (!navigator.geolocation) return;
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

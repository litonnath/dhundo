// ===========================================================================
// locpicker.jsx -- where you are, the way Uber and Rapido ask for it.
//
// One control, used on the front screen and in both listing forms:
//   * TYPE a place -- a road, a shop, a school, a colony, a village -- and
//     tap the result; or
//   * USE MY LOCATION, which reads the phone and finds the address; and then
//   * MOVE THE PIN on the map to the exact house, if the spot is not exact.
//
// There is no PIN code box and no state list: the PIN is worked out from the
// spot (the post office of that village, else the map's own postcode), and
// the state comes from the place chosen. Both used to be typed by hand, and
// both were wrong often enough to put Tripura under Haryana.
//
// What comes back is always the same shape:
//   { area, state, lat, lng, pin, city, address, source, exact }
//   source  "device" (the phone's GPS) or "picked" (chosen or placed by hand)
//   exact   false when the spot is only the middle of a village -- results
//           sort by distance from it, but it is not somebody's house.
// ===========================================================================
import React, { useState, useEffect } from "react";
import { T, Icon, Btn, CloseButton, useDismissable, input } from "./ui.jsx";
import { useI18n, stateName } from "./i18n.jsx";
import { STATES, DEFAULT_STATE, STATE_CENTERS } from "./states.js";
import { useMyLocation, locErrorKey } from "./device.jsx";
import MapPicker from "./mappicker.jsx";
import {
  searchAnywhere, reverseLookup, placeCoords, nearestPlaces, bestNearName,
  snapToKnown, pinForPlace, warmPlaceSearch, geoJson, googleDescribe,
} from "./regions.js";

const metresBetween = (aLat, aLng, bLat, bLng) => {
  const R = 6371000, rad = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * rad) / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(((bLng - aLng) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const fmtKm = (km) => (km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${km.toFixed(1)} km`);

// The nearest named thing within 250 m of a point -- a shop, a school, a
// temple -- so an exact pin can be described by what it is next to. The
// village itself is not one: that is already the area.
async function nearestLandmark(lat, lng) {
  try {
    const j = await geoJson("photon", `reverse?lat=${lat}&lon=${lng}&limit=6&lang=en`);
    for (const f of (j && j.features) || []) {
      const p = (f && f.properties) || {};
      const xy = (f && f.geometry && f.geometry.coordinates) || [];
      const name = String(p.name || "").trim();
      if (!name || p.osm_key === "place" || p.osm_key === "boundary" || typeof xy[1] !== "number") continue;
      if (metresBetween(lat, lng, xy[1], xy[0]) <= 250) return name;
    }
  } catch (_) { /* a landmark is a nicety */ }
  return null;
}

// Everything known about a point: the address, the state, the village, the
// PIN. Used for the phone's position, for a pin moved on the map, and for the
// phone position the page reads on its own for somebody who already said yes.
export async function describePoint({ lat, lng, state, address, area, accuracy, google: exactGoogle = false }) {
  let addr = address || null;
  let ar = area || null;
  let st = state || null;
  // Google first (its address and shop names are the fuller ones); the free
  // map service when Google is not set up, used up, or has nothing here.
  const g = exactGoogle ? await googleDescribe(lat, lng).catch(() => null) : null;
  if (g && g.address) { addr = g.address; ar = g.area || ar; st = g.state || st; }
  if (!addr) {
    const rev = await reverseLookup(lat, lng).catch(() => null);
    if (rev) { addr = rev.address; ar = rev.area || ar; st = rev.state || st; }
  }
  // The map names the nearest mapped TOWN when a village is only a dot on
  // it; the place table knows the village itself.
  const close = await nearestPlaces(lat, lng).catch(() => []);
  const fromMap = ar && st && STATES.includes(st) ? snapToKnown(st, ar) : ar;
  const named = bestNearName(close, fromMap) || ar || "";
  const pinR = await pinForPlace({
    lat, lng, name: named, state: st, postcode: addr && addr.postcode,
  }).catch(() => null);
  // How far the spot is from the middle of the village it is named after:
  // the proof that it is where it was placed, not the village centre.
  const centre = close.find((r) => r.place === named);
  const gPlaces = (g && g.places) || [];
  const landmark = gPlaces.length ? gPlaces[0].name : await nearestLandmark(lat, lng);
  const base = (addr && addr.line) || named;
  return {
    title: base,
    area: named, state: st, lat, lng,
    line: landmark ? `Near ${landmark}, ${base}` : base,
    // The pieces the address is built from, so the person can rename the
    // spot or move it to another village and the line follows.
    parts: true,
    road: (addr && addr.road) || null,
    district: (centre && centre.district) || (close[0] && close[0].district) || null,
    nearby: close.filter((r) => typeof r.km === "number" && r.km <= 6).slice(0, 6)
      .map((r) => ({ place: r.place, district: r.district, km: r.km })),
    landmark,
    places: gPlaces.slice(0, 6),
    centreKm: centre && typeof centre.km === "number" ? centre.km : null,
    pin: (pinR && pinR.pincode) || "", town: (pinR && pinR.place) || "",
    accuracy: typeof accuracy === "number" ? Math.round(accuracy) : null,
    exact: true,
  };
}

const joinUnique = (parts) => {
  const seen = new Set();
  return parts.map((x) => String(x || "").trim()).filter((x) => {
    const k = x.toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).join(", ");
};

// The address as it will be saved and shown: the name the person gave the
// spot (else the nearest landmark), the road, the village, the district.
const lineOf = (c) => {
  if (!c) return "";
  if (c.parts) {
    return joinUnique([c.label || (c.landmark ? `Near ${c.landmark}` : ""), c.road, c.area, c.district]);
  }
  return c.label ? joinUnique([c.label, c.line]) : (c.line || c.area || "");
};

const startOf = (place, state) => {
  if (place && typeof place.lat === "number") return { lat: place.lat, lng: place.lng };
  const c = STATE_CENTERS[state];
  return c ? { lat: c[0], lng: c[1] } : null;
};

// ------------------------------------------------------------------- sheet
export function LocationSheet({ place, onChange, onClose }) {
  const { t, lang } = useI18n();
  useDismissable(true, onClose);
  const geo = useMyLocation();
  const state0 = (place && place.state) || DEFAULT_STATE;
  const near = place && typeof place.lat === "number" ? { lat: place.lat, lng: place.lng } : null;

  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [looking, setLooking] = useState(false);
  const [searched, setSearched] = useState(false);
  // Set when the search service could not be asked at all (as opposed to
  // answering "nothing found"): the words say so, and the detail is for
  // whoever has to find out why.
  const [searchDown, setSearchDown] = useState(null);
  const [partial, setPartial] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [chosenQ, setChosenQ] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Warm the place index while the person is still reading the sheet.
  useEffect(() => { warmPlaceSearch(state0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Searching: one request per pause in typing, never one per keystroke.
  useEffect(() => {
    const typed = q.trim();
    if (typed.length < 3) { setRows([]); setLooking(false); setSearched(false); setSearchDown(null); return undefined; }
    const ctrl = new AbortController();
    setLooking(true);
    const timer = setTimeout(() => {
      searchAnywhere(typed, { state: state0, near, signal: ctrl.signal })
        .then((out) => {
          if (ctrl.signal.aborted) return;
          setRows(out.rows); setSearched(true);
          setSearchDown(out.failed ? (out.detail || "unreachable") : null);
          setPartial(!!out.partial && !out.failed);
        })
        .finally(() => { if (!ctrl.signal.aborted) setLooking(false); });
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); setLooking(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // A result tapped: its position (a village from our table may have none
  // yet), its PIN, and whether the spot is exact or only a village centre.
  const choose = async (r) => {
    setBusy(true);
    let { lat, lng } = r;
    if (typeof lat !== "number") {
      const xy = await placeCoords(r.state || state0, r.area || r.title).catch(() => null);
      if (xy) { lat = xy.lat; lng = xy.lng; }
    }
    const st = r.state || state0;
    const pinR = await pinForPlace({
      lat, lng, name: r.area || r.title, state: st, district: r.district, postcode: r.postcode,
    }).catch(() => null);
    setChosen({
      title: r.title, area: r.area || r.title, state: st, lat, lng,
      line: r.line || r.title, pin: (pinR && pinR.pincode) || "", town: (pinR && pinR.place) || "",
      exact: r.kind !== "place", source: "picked",
    });
    setChosenQ(q);
    setBusy(false);
    // A searched place opens on the map at once, so the pin can be set on
    // the exact spot instead of being left at the village centre.
    if (typeof lat === "number") setMapOpen(true);
  };

  const useGps = async () => {
    const got = await geo.detect();
    if (!got || typeof got.lat !== "number") return;
    setBusy(true);
    const d = await describePoint({
      lat: got.lat, lng: got.lng, state: got.state || state0,
      address: got.address, area: got.area, accuracy: got.accuracy, google: true,
    });
    setChosen({ ...d, source: "device" });
    setChosenQ(q);
    setBusy(false);
  };

  const onPin = async (pt) => {
    setMapOpen(false);
    setBusy(true);
    const d = await describePoint({ lat: pt.lat, lng: pt.lng, state: (chosen && chosen.state) || state0, google: true });
    setChosen({ ...d, source: "picked" });
    setChosenQ(q);
    setBusy(false);
  };

  // The nearest village on record is not always the one people call this
  // place (a pin in Tilthai was named after a para of the next village).
  const pickVillage = async (r) => {
    setBusy(true);
    const pr = await pinForPlace({ name: r.place, state: chosen.state, district: r.district }).catch(() => null);
    setChosen((c) => ({
      ...c, area: r.place, district: r.district || c.district, centreKm: r.km,
      pin: (pr && pr.pincode) || c.pin, town: (pr && pr.place) || c.town,
    }));
    setBusy(false);
  };

  const outside = chosen && chosen.state && !STATES.includes(chosen.state) ? chosen.state : null;
  const done = () => {
    if (!chosen || outside) return;
    onChange({
      area: chosen.area || chosen.title, state: chosen.state || state0,
      lat: typeof chosen.lat === "number" ? chosen.lat : undefined,
      lng: typeof chosen.lng === "number" ? chosen.lng : undefined,
      pin: chosen.pin || undefined, city: chosen.town || undefined,
      address: lineOf(chosen) || undefined, source: chosen.source, exact: !!chosen.exact,
    });
    onClose();
  };

  const showRows = q.trim().length >= 3 && q !== chosenQ;
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 320, background: "rgba(15,20,25,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div style={{
        background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 460,
        padding: "20px 18px 24px", boxShadow: "0 -10px 40px rgba(0,30,45,0.25)",
        maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: T.ink, flex: 1 }}>{t("loc_title")}</span>
          <CloseButton onClick={onClose} />
        </div>

        <label style={{
          display: "flex", alignItems: "center", gap: 9, padding: "0 12px", marginBottom: 10,
          borderRadius: 12, border: `1.5px solid ${T.brandDark}`, background: T.white,
        }}>
          <span style={{ color: T.brandDark, flexShrink: 0 }}><Icon name="search" size={19} /></span>
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("loc_search_ph")} aria-label={t("loc_search_ph")}
            autoComplete="off" autoCorrect="off" spellCheck={false}
            style={{ ...input, border: "none", outline: "none", flex: 1, minWidth: 0,
                     minHeight: 50, fontSize: 16, padding: "0 2px", boxShadow: "none" }}
          />
        </label>

        {geo.supported && (
          <button onClick={useGps} disabled={geo.state === "locating" || busy} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 9, padding: "12px 14px", borderRadius: 11, marginBottom: 10,
            border: "1px solid rgba(5,66,145,0.28)", background: T.brandSoft,
            color: T.brandDeep, fontSize: 14.5, fontWeight: 700, fontFamily: "inherit",
            cursor: geo.state === "locating" ? "default" : "pointer", minHeight: 48,
          }}>
            <Icon name="crosshair" size={19} />
            {geo.state === "locating" ? t("loc_detecting") : t("loc_detect")}
          </button>
        )}
        {geo.state === "error" && (
          <div style={{ fontSize: 12.5, color: T.red, margin: "0 2px 10px", lineHeight: 1.5 }}>
            {t(locErrorKey(geo.reason))}
          </div>
        )}

        {showRows && (
          <div style={{ marginBottom: 12 }}>
            {rows.map((r, i) => (
              <button key={`${r.title}|${r.subtitle}|${i}`} onClick={() => choose(r)} disabled={busy} style={{
                width: "100%", display: "flex", alignItems: "flex-start", gap: 11, textAlign: "left",
                padding: "11px 4px", border: "none", borderBottom: `1px solid ${T.line}`,
                background: "none", cursor: "pointer", fontFamily: "inherit", minHeight: 52,
              }}>
                <span style={{ color: T.inkFaint, flexShrink: 0, marginTop: 2 }}><Icon name="pin" size={18} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: T.ink }}>{r.title}</span>
                  {r.subtitle && (
                    <span style={{ display: "block", fontSize: 12.5, color: T.inkFaint, lineHeight: 1.4, marginTop: 1 }}>
                      {r.subtitle}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {looking && (
              <div style={{ fontSize: 13, color: T.inkFaint, padding: "10px 4px" }}>{t("loc_looking")}</div>
            )}
            {!looking && searched && rows.length === 0 && !searchDown && (
              <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, padding: "10px 4px" }}>
                {t("loc_none")}
              </div>
            )}
            {!looking && partial && !searchDown && rows.length > 0 && (
              <div style={{ fontSize: 12.5, color: T.inkFaint, lineHeight: 1.5, padding: "8px 4px" }}>
                {t("loc_partial")}
              </div>
            )}
            {!looking && searchDown && (
              <div style={{ padding: "10px 4px" }}>
                <div style={{ fontSize: 13.5, color: T.red, lineHeight: 1.55 }}>{t("loc_search_down")}</div>
                <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 3 }}>{searchDown}</div>
              </div>
            )}
          </div>
        )}

        {chosen && (
          <div style={{
            padding: "12px 13px", marginBottom: 12, borderRadius: 11,
            background: T.greenSoft, border: "1px solid rgba(18,128,74,0.3)",
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: T.green, flexShrink: 0, marginTop: 1 }}><Icon name="check" size={19} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: T.green,
                               textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {chosen.source === "picked" && chosen.exact ? t("loc_pin_set") : t("loc_selected")}
                </span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.ink, lineHeight: 1.4 }}>
                  {lineOf(chosen)}
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>
                  {chosen.state ? stateName(chosen.state, lang) : ""}
                  {chosen.pin ? ` · ${chosen.pin}` : ""}
                  {chosen.accuracy !== null && chosen.accuracy !== undefined
                    ? ` · ${t("loc_accuracy").replace("{m}", String(chosen.accuracy))}` : ""}
                </span>
              </span>
            </div>
            {!chosen.exact && (
              <div style={{ fontSize: 12.5, color: "#8A4A00", marginTop: 8, lineHeight: 1.5 }}>{t("loc_rough")}</div>
            )}
            {chosen.exact && typeof chosen.centreKm === "number" && chosen.area && (
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
                {t("loc_pin_off").replace("{d}", fmtKm(chosen.centreKm)).replace("{a}", chosen.area)}
              </div>
            )}
            {chosen.places && chosen.places.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6 }}>
                <b>{t("map_near")}:</b>{" "}
                {chosen.places.map((p) => (p.type ? `${p.name} (${p.type})` : p.name)).join(" · ")}
              </div>
            )}
            {chosen.exact && (
              <input
                value={chosen.label || ""} maxLength={80}
                onChange={(e) => setChosen((c) => ({ ...c, label: e.target.value }))}
                placeholder={t("loc_name_ph")} aria-label={t("loc_name_ph")}
                style={{ ...input, marginTop: 10, minHeight: 44, fontSize: 14.5 }}
              />
            )}
            {chosen.nearby && chosen.nearby.length > 1 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.inkFaint, marginBottom: 6 }}>
                  {t("loc_other_village")}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {chosen.nearby.map((r) => {
                    const on = r.place === chosen.area;
                    return (
                      <button key={`${r.place}|${r.district}`} onClick={() => pickVillage(r)} disabled={busy} style={{
                        padding: "7px 11px", borderRadius: 18, cursor: "pointer", fontFamily: "inherit",
                        fontSize: 13, fontWeight: on ? 800 : 600, minHeight: 36,
                        border: `1.5px solid ${on ? T.brandDark : T.line}`,
                        background: on ? T.white : "rgba(255,255,255,0.7)", color: on ? T.brandDeep : T.ink,
                      }}>
                        {r.place} <span style={{ color: T.inkFaint, fontWeight: 600 }}>· {fmtKm(r.km)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {chosen.exact && typeof chosen.lat === "number" && (
              <a href={`https://www.openstreetmap.org/?mlat=${chosen.lat}&mlon=${chosen.lng}#map=18/${chosen.lat}/${chosen.lng}`}
                 target="_blank" rel="noopener noreferrer" style={{
                display: "inline-block", marginTop: 6, color: T.brandDark, fontWeight: 700,
                fontSize: 12.5, textDecoration: "underline",
              }}>{t("loc_view_map")}</a>
            )}
            {chosen.exact && typeof chosen.lat === "number" && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${chosen.lat},${chosen.lng}`}
                 target="_blank" rel="noopener noreferrer" style={{
                display: "inline-block", marginTop: 6, marginLeft: 14, color: T.brandDark, fontWeight: 700,
                fontSize: 12.5, textDecoration: "underline",
              }}>Google Maps</a>
            )}
            <button onClick={() => setMapOpen(true)} style={{
              marginTop: 8, background: "none", border: "none", padding: "6px 0", cursor: "pointer",
              color: T.brandDark, fontWeight: 800, fontSize: 13.5, fontFamily: "inherit",
              textDecoration: "underline", minHeight: 36,
            }}>{t("loc_adjust")}</button>
          </div>
        )}

        {outside && (
          <div style={{
            padding: "12px 13px", borderRadius: 10, marginBottom: 12,
            background: T.accentSoft, border: "1px solid rgba(248,118,23,0.35)",
            color: "#8A4A00", fontSize: 13, lineHeight: 1.55,
          }}>
            <strong style={{ display: "block", marginBottom: 3 }}>{t("oos_title").replace("{x}", outside)}</strong>
            {t("oos_body").replace("{x}", outside)}
          </div>
        )}

        {!chosen && (
          <button onClick={() => setMapOpen(true)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "11px 14px", borderRadius: 10, minHeight: 46, marginBottom: 12,
            border: `1px solid ${T.line}`, background: T.white, color: T.ink,
            fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
          }}>
            <Icon name="pin" size={17} style={{ color: T.brandDark }} />
            {t("loc_pick_map")}
          </button>
        )}

        <Btn full onClick={done} disabled={!chosen || !!outside || busy}>{t("loc_done")}</Btn>
      </div>

      {mapOpen && (
        <MapPicker start={chosen || startOf(place, state0)} state={(chosen && chosen.state) || state0} onCancel={() => setMapOpen(false)} onConfirm={onPin} />
      )}
    </div>
  );
}

// ----------------------------------------------------- the front-screen bar
// The first thing on the home screen: a field that opens the search, and a
// button for the phone's position.
export function LocationBar({ place, onOpen, onLocate, locating, errorKey }) {
  const { t, lang } = useI18n();
  const has = place && place.area;
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={onOpen} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "12px 14px",
        minHeight: 56, borderRadius: 14, border: `1.5px solid ${T.brandDark}`, background: T.white,
        textAlign: "left", cursor: "pointer", fontFamily: "inherit", boxSizing: "border-box",
      }}>
        <span style={{ color: T.brandDark, flexShrink: 0 }}><Icon name={has ? "pin" : "search"} size={21} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          {has ? (
            <>
              <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: T.ink,
                             overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {place.address || place.area}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: T.inkFaint }}>
                {stateName(place.state, lang)}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 16, fontWeight: 700, color: T.inkSoft }}>{t("loc_front")}</span>
          )}
        </span>
        {has && <span style={{ color: T.brandDark, fontWeight: 800, fontSize: 13.5, flexShrink: 0 }}>{t("loc_change")}</span>}
      </button>
      {onLocate && (
        <button onClick={onLocate} disabled={locating} style={{
          display: "inline-flex", alignItems: "center", gap: 7, marginTop: 8, padding: "9px 14px",
          borderRadius: 20, minHeight: 40, border: "1px solid rgba(5,66,145,0.28)",
          background: T.brandSoft, color: T.brandDeep, fontSize: 13.5, fontWeight: 700,
          fontFamily: "inherit", cursor: locating ? "default" : "pointer",
        }}>
          <Icon name="crosshair" size={16} />
          {locating ? t("loc_detecting") : t("loc_detect")}
        </button>
      )}
      {errorKey && (
        <div style={{ fontSize: 12.5, color: T.red, marginTop: 6, lineHeight: 1.5 }}>{t(errorKey)}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------- the field in a form
// Shows the chosen place and opens the same sheet to change it. The form
// keeps its own copy, so choosing a shop's location while listing never moves
// the location somebody is browsing from.
export function PlaceField({ value, onChange, sheetPlace }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const has = value && (value.area || typeof value.lat === "number");
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "12px 14px",
        minHeight: 56, borderRadius: 11, border: `1px solid ${has ? "rgba(18,128,74,0.45)" : T.line}`,
        background: has ? T.greenSoft : T.white, textAlign: "left", cursor: "pointer",
        fontFamily: "inherit", boxSizing: "border-box",
      }}>
        <span style={{ color: has ? T.green : T.brandDark, flexShrink: 0 }}>
          <Icon name={has ? "check" : "search"} size={20} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          {has ? (
            <>
              <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.ink, lineHeight: 1.4 }}>
                {value.address || value.area}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, marginTop: 1 }}>
                {value.state ? stateName(value.state, lang) : ""}{value.pin ? ` · ${value.pin}` : ""}
                {value.exact ? ` · ${t("loc_exact")}` : ""}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 15.5, fontWeight: 700, color: T.inkSoft }}>{t("loc_front")}</span>
          )}
        </span>
        <span style={{ color: T.brandDark, fontWeight: 800, fontSize: 13.5, flexShrink: 0 }}>
          {has ? t("loc_change") : ""}
        </span>
      </button>
      {has && value.exact === false && (
        <div style={{ fontSize: 12.5, color: "#8A4A00", marginTop: 6, lineHeight: 1.5 }}>{t("loc_rough")}</div>
      )}
      {open && (
        <LocationSheet
          place={sheetPlace || value}
          onChange={(p) => onChange(p)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

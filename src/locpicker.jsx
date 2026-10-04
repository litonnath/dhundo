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
  snapToKnown, pinForPlace,
} from "./regions.js";

// Everything known about a point: the address, the state, the village, the
// PIN. Used for the phone's position, for a pin moved on the map, and for the
// phone position the page reads on its own for somebody who already said yes.
export async function describePoint({ lat, lng, state, address, area, accuracy }) {
  let addr = address || null;
  let ar = area || null;
  let st = state || null;
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
  return {
    title: (addr && addr.line) || named,
    area: named, state: st, lat, lng,
    line: (addr && addr.line) || named,
    pin: (pinR && pinR.pincode) || "", town: (pinR && pinR.place) || "",
    accuracy: typeof accuracy === "number" ? Math.round(accuracy) : null,
    exact: true,
  };
}

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
  const [chosen, setChosen] = useState(null);
  const [chosenQ, setChosenQ] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
  };

  const useGps = async () => {
    const got = await geo.detect();
    if (!got || typeof got.lat !== "number") return;
    setBusy(true);
    const d = await describePoint({
      lat: got.lat, lng: got.lng, state: got.state || state0,
      address: got.address, area: got.area, accuracy: got.accuracy,
    });
    setChosen({ ...d, source: "device" });
    setChosenQ(q);
    setBusy(false);
  };

  const onPin = async (pt) => {
    setMapOpen(false);
    setBusy(true);
    const d = await describePoint({ lat: pt.lat, lng: pt.lng, state: (chosen && chosen.state) || state0 });
    setChosen({ ...d, source: "picked" });
    setChosenQ(q);
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
      address: chosen.line || undefined, source: chosen.source, exact: !!chosen.exact,
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
                               textTransform: "uppercase", letterSpacing: 0.4 }}>{t("loc_selected")}</span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.ink, lineHeight: 1.4 }}>
                  {chosen.line || chosen.area}
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
        <MapPicker start={chosen || startOf(place, state0)} onCancel={() => setMapOpen(false)} onConfirm={onPin} />
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

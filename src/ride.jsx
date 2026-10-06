// ---------------------------------------------------------------------------
// RIDE: a passenger gives a pickup and a destination, drivers who are online
// nearby see the request and the first to accept gets it. The fare is agreed
// between the two; the app takes no payment.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useCallback } from "react";
import { T, Btn, Icon, Notice, input, useDismissable } from "./ui.jsx";
import { PlaceField, describePoint } from "./locpicker.jsx";
import { useMyLocation } from "./device.jsx";
import { useI18n } from "./i18n.jsx";
import { AlertsCard } from "./alerts.jsx";
import { FormSheet } from "./rates.jsx";
import { RideChat, RideCode } from "./ridechat.jsx";
import { HireNearby } from "./hire.jsx";
import { SetupCard } from "./food.jsx";
import { vehicleLabel, tradeIcon, vividFor } from "./start.jsx";
import { TileArt } from "./scenes.jsx";
import { tripKm } from "./regions.js";
import { NearbyDrivers, PassengerLive, DriverLive, UberMap, RouteNav } from "./nearmap.jsx";
import { alertNewJob } from "./hub.jsx";

const one = (r) => (Array.isArray(r) ? r[0] : r);
const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const card = { background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: "13px 14px", marginBottom: 10 };
const linkBtn = (bg) => ({
  display: "inline-flex", alignItems: "center", background: bg, color: "#fff", borderRadius: 10,
  padding: "10px 14px", minHeight: 44, fontWeight: 700, fontSize: 14.5, textDecoration: "none", boxSizing: "border-box",
});
const placeText = (p) => (p && (p.address || p.area)) || "";
const dirUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

const VEHICLES = [["any", "rd_any", "search"], ["bike", "rd_bike", "drivers"], ["auto", "rd_auto", "drivers"], ["car", "rd_car", "drivers"]];

export function RideScreen({ api, signedIn, place, onSignIn, onBrowse, trades = [] }) {
  const { t, lang } = useI18n();
  const allVeh = trades.filter((x) => x.group_name === "Drivers");
  // Travel (bike, auto, car) is a different errand from hiring a machine for
  // work (JCB, truck, tractor, crane): no destination, a place to work at.
  const isDelivery = (x) => /deliver/i.test(`${x.slug} ${x.name_en || ""}`);
  const isTravel = (x) => !isDelivery(x) && /\b(bike|auto|car|cab|taxi|rickshaw|toto|scooter|e-?rickshaw)\b/i.test(`${x.slug} ${x.name_en || ""}`);
  const [mode, setMode] = useState("travel");
  const hire = mode === "hire";
  // A delivery rider is another service altogether, booked by shops through
  // delivery jobs: not a ride and not a machine for hire.
  // Travel offers three vehicles, in this order: bike taxi, taxi / cab, auto.
  // A plain "car" is not a separate choice, and there is no "any".
  const rank = (x) => { const k = `${x.slug} ${x.name_en || ""}`.toLowerCase(); return /bike|moto|scooter/.test(k) ? 0 : /taxi|cab/.test(k) ? 1 : 2; };
  const isPlainCar = (x) => /^car$/i.test(String(x.slug || "").trim()) || /^car$/i.test(String(x.name_en || "").trim());
  const vehicles = allVeh.filter((x) => !isDelivery(x) && (hire ? !isTravel(x) : isTravel(x) && !isPlainCar(x)))
    .sort((a, b) => (hire ? 0 : rank(a) - rank(b)));
  const geo = useMyLocation();
  const [pick, setPick] = useState(() => (place && typeof place.lat === "number" ? place : null));
  const [drop, setDrop] = useState(null);
  const [vehicle, setVehicle] = useState("any");
  const vehicleKey = vehicles.map((v) => v.slug).join(",");
  useEffect(() => {
    if (!hire && vehicles.length && !vehicles.some((v) => v.slug === vehicle)) setVehicle(vehicles[0].slug);
  }, [hire, vehicleKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [fare, setFare] = useState("");
  const [ride, setRide] = useState(null);
  const [online, setOnline] = useState([]);
  const [fares, setFares] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [finished, setFinished] = useState(false);
  const wasActive = useRef(false);
  const lastRide = useRef(null);
  const [trip, setTrip] = useState(null);
  // Distance from the chosen pickup to the destination, for the fare.
  useEffect(() => {
    let live = true;
    setTrip(null);
    if (hire || !pick || !drop || typeof pick.lat !== "number" || typeof drop.lat !== "number") return undefined;
    tripKm(pick, drop).then((r) => { if (live) setTrip(r); }).catch(() => {});
    return () => { live = false; };
  }, [hire, pick && pick.lat, pick && pick.lng, drop && drop.lat, drop && drop.lng]);

  // Toll on the route, asked of the routing service for cars and cabs (two
  // wheelers and autos do not pay it). null means unknown, 0 means none.
  const tollVehicle = /car|taxi|cab/.test(vehicle);
  const anyCab = vehicles.some((v) => /car|taxi|cab/.test(v.slug));
  const [toll, setToll] = useState(null);
  useEffect(() => {
    let live = true;
    setToll(null);
    if (hire || !anyCab || !pick || !drop || typeof pick.lat !== "number" || typeof drop.lat !== "number") return undefined;
    tripKm(pick, drop, { toll: true }).then((r) => { if (live && r && typeof r.toll === "number") setToll(r.toll); }).catch(() => {});
    return () => { live = false; };
  }, [hire, anyCab, pick && pick.lat, pick && pick.lng, drop && drop.lat, drop && drop.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRide = useCallback(async () => {
    if (!signedIn) return;
    try {
      const r = many(await api.myRide()).find((x) => x.role === "passenger") || null;
      if (r) { wasActive.current = true; lastRide.current = r; }
      else if (wasActive.current) { wasActive.current = false; setFinished(true); }
      setRide(r);
    } catch (_) { /* the next tick tries again */ }
  }, [api, signedIn]);
  useEffect(() => {
    loadRide();
    const id = setInterval(loadRide, 5000);
    return () => clearInterval(id);
  }, [loadRide]);

  // Drivers online near the pickup, as cards and distances only.
  useEffect(() => {
    if (!pick || typeof pick.lat !== "number") { setOnline([]); return; }
    let live = true;
    api.availableWorkers({ lat: pick.lat, lng: pick.lng, group: "Drivers", trade: vehicle !== "any" ? vehicle : null, radiusKm: 8, limit: 8 })
      .then((rows) => {
        if (!live) return;
        const list = many(rows); setOnline(list);
        if (list.length) api.storeInfos(list.map((x) => x.id)).then((inf) => { if (live) { const o = {}; many(inf).forEach((i) => { o[i.id] = i.per_km_rupees; }); setFares(o); } }).catch(() => {});
      }).catch(() => {});
    return () => { live = false; };
  }, [api, vehicle, pick && pick.lat, pick && pick.lng]);

  // Rates of the drivers near the pickup, kept per kind of vehicle: those online
  // now and those only listed. Each vehicle gets its own price from its own
  // drivers' per-km rates.
  const [book, setBook] = useState({});
  const [fuels, setFuels] = useState({ petrol: 100, diesel: 90, cng: 80, electric: 9 });
  useEffect(() => {
    let live = true;
    api.fuelPrices().then((r) => { if (!live) return; const o = {}; many(r).forEach((x) => { o[x.fuel] = Number(x.price); }); if (Object.keys(o).length) setFuels((f) => ({ ...f, ...o })); }).catch(() => {});
    return () => { live = false; };
  }, [api]);
  useEffect(() => {
    setBook({});
    if (!pick || typeof pick.lat !== "number") return undefined;
    let live = true;
    const notDelivery = (r) => !/deliver/i.test(`${r.trade_slug} ${r.trade_name || ""}`);
    Promise.all([
      api.availableWorkers({ lat: pick.lat, lng: pick.lng, group: "Drivers", trade: null, radiusKm: 8, limit: 30 }).catch(() => []),
      api.browse({ group: "Drivers", lat: pick.lat, lng: pick.lng, radiusKm: 30, limit: 40, state: place && place.state }).catch(() => []),
    ]).then(([on, all]) => {
      const onl = many(on).filter(notDelivery);
      const lst = many(all).filter(notDelivery);
      const ids = [...new Set([...onl, ...lst].map((r) => r.id))];
      if (!ids.length) return null;
      // driverPricing needs sql/139; without it the per-km rates still come from the store info.
      return api.driverPricing(ids).catch(() => api.storeInfos(ids)).then((inf) => {
        const rate = {}, fuelOf = {};
        many(inf).forEach((i) => { rate[i.id] = Number(i.per_km_rupees); fuelOf[i.id] = i.fuel_type; });
        const out = {};
        const add = (rows, kind) => rows.forEach((r) => {
          const e = out[r.trade_slug] || (out[r.trade_slug] = { online: [], listed: [], fuels: [] });
          if (fuelOf[r.id]) e.fuels.push(fuelOf[r.id]);
          if (rate[r.id] > 0) e[kind].push(rate[r.id]);
        });
        add(onl, "online"); add(lst, "listed");
        return out;
      });
    }).then((out) => { if (live && out) setBook(out); }).catch(() => {});
    return () => { live = false; };
  }, [api, pick && pick.lat, pick && pick.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // The price of each vehicle is worked out, not typed: the distance times a
  // per-km rate, plus the toll for cars and cabs. The rate is, in this order:
  // the middle rate of that vehicle's drivers online near the pickup; else of
  // its drivers listed near it; else the standard rate for that kind of vehicle.
  // Rounded to the nearest 5 rupees.
  const median = (a) => { const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
  // The standard rate comes from the price of the fuel the vehicle runs on:
  // fuel cost per km (price / km per litre, kg or kWh) plus a fixed amount for
  // the driver's time and the upkeep of the vehicle.
  const KM_PER = { bike: { petrol: 40, electric: 10 }, auto: { cng: 28, petrol: 25, diesel: 22, electric: 8 }, car: { petrol: 15, diesel: 18, cng: 22, electric: 6 } };
  const BASE = { bike: 5.5, auto: 9, car: 8.3 };
  const kindOf = (slug) => (/bike|moto/.test(slug) ? "bike" : /auto|rick|toto/.test(slug) ? "auto" : "car");
  const priceFor = (slug) => {
    if (!trip) return null;
    const e = book[slug] || { online: [], listed: [], fuels: [] };
    const kind = kindOf(slug);
    // The standard (fallback) rate starts from the bike rate, which comes from
    // the petrol price, and an auto is 5 times that and a car 10 times.
    const bikeBook = Object.keys(book).filter((k) => kindOf(k) === "bike").flatMap((k) => book[k].fuels);
    const counts = {}; bikeBook.forEach((f) => { counts[f] = (counts[f] || 0) + 1; });
    const common = Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0];
    const bikeFuel = KM_PER.bike[common] ? common : "petrol";
    const bikeStd = Math.ceil((fuels[bikeFuel] || 100) / KM_PER.bike[bikeFuel] + BASE.bike);
    const fuel = bikeFuel;
    const std = bikeStd * (kind === "auto" ? 5 : kind === "car" ? 10 : 1);
    const set = e.online.length ? median(e.online) : e.listed.length ? median(e.listed) : null;
    // The riders' own per-km rate is the price: rate x distance, nothing
    // adjusted or capped. The standard rate only stands in when no rider of
    // this vehicle has set one.
    const basis = set == null ? "fuel" : "driver";
    const perKm = set != null ? set : std;
    const fare = Math.round(trip.km * perKm);
    const tl = /car|taxi|cab/.test(slug) ? (toll || 0) : 0;
    return { perKm, basis, fuel, fare, toll: tl, total: fare + tl };
  };
  const cheapest = (() => {
    const all = vehicles.map((v) => priceFor(v.slug)).filter(Boolean);
    return all.length ? Math.min(...all.map((x) => x.total)) : null;
  })();
  const cur = vehicle === "any" ? null : priceFor(vehicle);
  const basis = cur ? cur.basis : "fuel";
  const perKm = cur ? cur.perKm : null;
  const fareOnly = cur ? cur.fare : cheapest;
  const est = vehicle === "any" ? cheapest : cur ? cur.total : null;

  const here = async () => {
    const got = await geo.detect();
    if (!got || typeof got.lat !== "number") return;
    const d = await describePoint({ lat: got.lat, lng: got.lng, state: got.state || (place && place.state),
                                    address: got.address, area: got.area, accuracy: got.accuracy });
    setPick({ area: d.area || "", state: d.state || (place && place.state), lat: d.lat, lng: d.lng,
              pin: d.pin || undefined, address: d.line || undefined, exact: true });
  };

  const send = async () => {
    if (!signedIn) { onSignIn && onSignIn(); return; }
    if (!pick || typeof pick.lat !== "number" || (!hire && !placeText(drop))) { setMsg(t("rd_need_loc")); return; }
    setBusy(true); setMsg(null); setFinished(false);
    try {
      const r = one(await api.rideRequest(
        { text: placeText(pick), lat: pick.lat, lng: pick.lng },
        hire ? { text: placeText(pick), lat: pick.lat, lng: pick.lng } : { text: placeText(drop), lat: drop.lat, lng: drop.lng },
        vehicle, est != null ? est : fare === "" ? null : Number(fare)));
      if (r && r.ok) loadRide();
      else setMsg(r && r.reason === "already_open" ? t("rd_open") : r && r.reason === "sign_in_required" ? t("e_signin") : t("e_save"));
    } catch (e) { setMsg((e && e.message) || t("e_save")); }
    setBusy(false);
  };
  const cancel = async () => {
    setBusy(true);
    try { await api.rideUpdate(ride.id, "cancel"); } catch (_) {}
    wasActive.current = false; setRide(null); setBusy(false);
  };

  const wrap = { maxWidth: 560, margin: "0 auto", padding: "14px 16px 130px" };

  if (ride) {
    const accepted = ride.status === "accepted";
    const hasPos = typeof ride.pick_lat === "number" && typeof ride.pick_lng === "number";
    const dropPt = typeof ride.drop_lat === "number" ? { lat: ride.drop_lat, lng: ride.drop_lng } : null;
    const vTrade = allVeh.find((x) => x.slug === ride.vehicle);
    const sheetFor = (info) => (
      <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, boxShadow: "0 6px 22px rgba(15,23,42,0.10)", padding: "16px 16px 14px", margin: "12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ position: "relative", width: 14, height: 14, flexShrink: 0 }}>
            {!accepted && <span className="dh-pulse" style={{ background: "rgba(22,163,74,.45)" }} />}
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: accepted ? T.green : "#16A34A" }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, lineHeight: 1.25 }}>{accepted ? t("rd_found") : t("rd_searching")}</div>
            {!accepted && <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.45, marginTop: 2 }}>{t("rd_wait_sub")}</div>}
          </div>
          {ride.fare_paise != null && (
            <span style={{ fontSize: 20, fontWeight: 800, color: T.ink, flexShrink: 0 }}>{"\u20B9"}{Math.round(ride.fare_paise / 100)}</span>
          )}
        </div>
        {accepted && (
          <div style={{ margin: "12px 0 0", padding: "10px 12px", background: "#F3F6FA", borderRadius: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>{ride.other_name}</div>
            {ride.other_vehicle && <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 1 }}>{ride.other_vehicle}</div>}
          </div>
        )}
        {!accepted && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 0", padding: "10px 12px", background: info && info.count ? "#ECFDF3" : "#FFF7E6", borderRadius: 12 }}>
            <span style={{ fontSize: 22 }}>{"\u{1F3CD}\u{FE0F}"}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.ink, lineHeight: 1.35 }}>
              {info && info.count
                ? String(t("rd_eta")).replace("{n}", info.min)
                : t("rd_eta_none")}
            </span>
          </div>
        )}
        <Timeline pick={ride.pick_text} drop={ride.drop_text} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {vTrade && <span style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, background: "#F3F4F6", borderRadius: 14, padding: "5px 11px" }}>{vehicleLabel(vTrade, lang)}</span>}
          {ride.fare_paise != null && <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>{String(t("rdr_fare")).replace("{n}", Math.round(ride.fare_paise / 100))}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {accepted && ride.other_phone && <a href={`tel:${ride.other_phone}`} style={{ ...linkBtn(T.green), flex: 1, textAlign: "center", minHeight: 48 }}>{t("rd_call")}</a>}
          <Btn kind="ghost" full={!accepted || !ride.other_phone} disabled={busy} onClick={cancel} style={{ color: "#B91C1C", borderColor: "#FCA5A5" }}>{t("rd_cancel")}</Btn>
        </div>
        {!accepted && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.brandDark, minHeight: 32, display: "flex", alignItems: "center" }}>{t("rd_alerts_more")}</summary>
            <div style={{ marginTop: 6 }}><AlertsCard api={api} compact /></div>
          </details>
        )}
      </div>
    );
    return (
      <div style={wrap}>
        {accepted && <PassengerLive api={api} ride={ride} />}
        {accepted && <RideCode api={api} rideId={ride.id} role="passenger" />}
        {accepted && <RideChat api={api} rideId={ride.id} role="passenger" />}
        {!accepted && hasPos ? (
          <NearbyDrivers api={api} pick={{ lat: ride.pick_lat, lng: ride.pick_lng }} drop={dropPt} state={place && place.state} slugs={null}
                         vehicle={ride.vehicle || "any"} onlineIds={new Set(online.map((d) => d.id))} onlineRows={online}
                         fares={fares} trip={null} between={sheetFor} />
        ) : sheetFor(null)}
      </div>
    );
  }

  return (
    <div style={wrap}>
      <TileArt k="need-ride" pos="center top" style={{ borderRadius: 14, aspectRatio: "2 / 1", maxHeight: 240, marginBottom: 14 }} />
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "6px 0 14px" }}>{t("rd_title")}</h1>
      {finished && <RideDone ride={lastRide.current} who="passenger" onClose={() => setFinished(false)} />}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["travel", "rd_mode_travel"], ["hire", "rd_mode_hire"]].map(([k, key]) => (
          <button key={k} onClick={() => { setMode(k); setVehicle("any"); }} aria-pressed={mode === k} style={{
            flex: 1, minHeight: 46, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14.5,
            border: `2px solid ${mode === k ? T.brandDark : T.line}`, background: mode === k ? T.brandDark : T.white, color: mode === k ? "#fff" : T.ink,
          }}>{t(key)}</button>
        ))}
      </div>
      {hire && <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>{t("rd_hire_hint")}</p>}
      <div style={{ ...card, padding: "14px 14px 16px" }}>
        <Label dot="#16A34A" text={hire ? t("rd_hire_where") : t("rd_pick")} />
        <PlaceField value={pick} onChange={setPick} sheetPlace={pick || place} />
        {geo.supported && (
          <button onClick={here} disabled={geo.state === "locating"} style={{
            display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer",
            color: T.brandDark, fontWeight: 700, fontSize: 13.5, padding: "8px 0 2px", minHeight: 40, fontFamily: "inherit",
          }}><Icon name="crosshair" size={16} /> {geo.state === "locating" ? "…" : t("rd_here")}</button>
        )}
        {!hire && (<>
          <div style={{ height: 12 }} />
          <Label dot="#DC2626" text={t("rd_drop")} />
          <PlaceField value={drop} onChange={setDrop} sheetPlace={drop || place} />
        </>)}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, margin: "4px 0 8px" }}>{t("rd_which")}</div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", marginBottom: 14 }}>
        {(hire ? [{ slug: "any", label: t("rd_any"), icon: "search", color: T.brandDark }] : []).concat(
          vehicles.map((x) => ({ slug: x.slug, label: vehicleLabel(x, lang), icon: tradeIcon(x, "drivers"), color: vividFor(x.slug) }))
        ).map((v) => (
          <button key={v.slug} onClick={() => setVehicle(v.slug)} aria-pressed={vehicle === v.slug} style={{
            display: "flex", alignItems: "center", gap: 9, textAlign: "left", padding: "9px 10px", minHeight: 52, borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
            border: `2px solid ${vehicle === v.slug ? T.brandDark : T.line}`, background: vehicle === v.slug ? T.brandSoft : T.white,
          }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: v.color, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={v.icon} size={19} />
            </span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.2, minWidth: 0, overflowWrap: "anywhere" }}>{v.label}</span>
            {(() => {
              const pr = v.slug === "any" ? (cheapest != null ? { total: cheapest } : null) : priceFor(v.slug);
              return pr ? <span style={{ fontSize: 14, fontWeight: 800, color: T.ink, flexShrink: 0, textAlign: "right" }}>{v.slug === "any" ? "\u20B9" + pr.total + "+" : "\u20B9" + pr.total}{pr.toll > 0 && <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#B45309" }}>{t("rd_incl_toll")}</span>}</span> : null;
            })()}
          </button>
        ))}
      </div>
      {hire ? (
        <HireNearby api={api} pick={pick} vehicle={vehicle} vehicles={vehicles} place={place} signedIn={signedIn} onSignIn={onSignIn} />
      ) : (
        <>
      {est != null ? (
        <div style={{ ...card, border: `2px solid ${T.brandDark}`, marginBottom: 10 }}>
          <div style={{ fontSize: 13.5, color: T.inkSoft }}>{String(t("rd_dist")).replace("{n}", trip.km)}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.ink }}>{String(t("rd_fare_est")).replace("{n}", est)}</div>
          {cur && <div style={{ fontSize: 14, fontWeight: 700, color: T.inkSoft, marginTop: 2 }}>{"\u20B9"}{cur.perKm}/km {"\u00D7"} {trip.km} km = {"\u20B9"}{cur.fare}</div>}
          {tollVehicle && cur && toll !== null && (
            <div style={{ fontSize: 14, fontWeight: 800, color: toll > 0 ? "#B45309" : "#0F6B33", marginTop: 4 }}>
              {toll > 0 ? String(t("rd_toll_line")).replace("{a}", fareOnly).replace("{n}", toll) : t("rd_toll_none")}
            </div>
          )}
          
        </div>
      ) : (
        <input style={{ ...input, marginBottom: 8 }} value={fare} inputMode="numeric" maxLength={5}
               placeholder={t("rd_offer")} aria-label={t("rd_offer")}
               onChange={(e) => setFare(e.target.value.replace(/\D/g, ""))} />
      )}
      <p style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>{t("rd_note")}</p>
      {msg && <div style={{ marginBottom: 10 }}><Notice tone="bad">{msg}</Notice></div>}
      <Btn full disabled={busy} onClick={send}>{busy ? "…" : signedIn ? t(hire ? "rd_hire_find" : "rd_find") : t("nav_signin")}</Btn>
      {signedIn && <RideHistory api={api} />}
        </>
      )}
    </div>
  );
}

function Label({ dot, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: T.inkSoft, margin: "0 0 6px" }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: dot }} /> {text}
    </div>
  );
}

// Pickup and drop as a ride-app timeline: green dot, a line, red square, the
// place name bold and the rest of the address lighter.
function Timeline({ pick, drop }) {
  const split = (txt) => {
    const x = String(txt || "");
    const i = x.indexOf(",");
    return i < 0 ? [x, ""] : [x.slice(0, i), x.slice(i + 1).trim()];
  };
  const row = (txt, shape, color, label) => {
    const [a, b] = split(txt);
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ width: 16, display: "flex", justifyContent: "center", paddingTop: 4, flexShrink: 0 }}>
          <span style={{ width: 12, height: 12, background: color, borderRadius: shape === "dot" ? "50%" : 3 }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
          <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.ink, lineHeight: 1.3, overflowWrap: "anywhere" }}>{a}</span>
          {b && <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4, overflowWrap: "anywhere" }}>{b}</span>}
        </span>
      </div>
    );
  };
  const { t } = useI18n();
  return (
    <div style={{ margin: "14px 0 12px", position: "relative" }}>
      <span style={{ position: "absolute", left: 7, top: 22, bottom: 30, width: 2, background: "#D1D5DB" }} />
      {row(pick, "dot", "#16A34A", t("rd_pick"))}
      <div style={{ height: 14 }} />
      {row(drop, "sq", "#DC2626", t("rd_drop"))}
    </div>
  );
}

// Shown to both sides when a ride has been finished: a clear success message
// with the trip and the fare.
function RideDone({ ride, who, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: T.white, borderRadius: 22, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box", padding: "24px 18px 18px", textAlign: "center", boxShadow: "0 18px 50px rgba(0,0,0,0.35)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#16A34A", color: "#fff", fontSize: 42, fontWeight: 800, lineHeight: "72px", margin: "0 auto 12px", boxShadow: "0 0 0 10px rgba(22,163,74,0.15)" }}>{"\u2713"}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0F6B33" }}>{t("rdn_title")}</div>
        <div style={{ fontSize: 14.5, color: T.ink, lineHeight: 1.5, margin: "6px 0 4px" }}>{t(who === "driver" ? "rdn_drv" : "rdn_pax")}</div>
        {ride && ride.fare_paise != null && <div style={{ fontSize: 28, fontWeight: 800, color: T.ink, margin: "8px 0" }}>{"\u20B9"}{Math.round(ride.fare_paise / 100)}</div>}
        {ride && <div style={{ textAlign: "left", margin: "8px 0 14px", background: "#F7F9FB", borderRadius: 14, padding: "4px 12px" }}><Timeline pick={ride.pick_text} drop={ride.drop_text} /></div>}
        <Btn full onClick={onClose}>{t("rdn_ok")}</Btn>
      </div>
    </div>
  );
}

// Past rides, for both sides: a button that opens the list.
export function RideHistory({ api }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const show = async () => {
    setOpen(true);
    try { setRows(many(await api.rideHistory())); } catch (_) { setRows([]); }
  };
  const col = { done: "#16A34A", cancelled: "#B91C1C", expired: "#6B7280" };
  return (
    <>
      <button onClick={show} style={{ display: "block", width: "100%", minHeight: 48, margin: "12px 0 0", borderRadius: 12, border: `1.5px solid ${T.line}`, background: T.white, color: T.ink, fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" }}>{t("rh_title")}</button>
      {open && (
        <FormSheet title={t("rh_title")} onClose={() => setOpen(false)}>
          {rows === null && <div style={{ fontSize: 14, color: T.inkSoft }}>{"\u2026"}</div>}
          {rows && rows.length === 0 && <div style={{ fontSize: 14, color: T.inkFaint }}>{t("rh_none")}</div>}
          {(rows || []).map((r) => (
            <div key={r.id} style={{ border: `1px solid ${T.line}`, borderLeft: `4px solid ${col[r.status] || T.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: col[r.status] || T.inkSoft }}>{t("rh_" + r.status)}</span>
                {r.fare_paise != null && <span style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{"\u20B9"}{Math.round(r.fare_paise / 100)}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, margin: "1px 0 2px" }}>
                {new Date(r.done_at || r.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                {r.other_name ? ` \u00B7 ${t(r.role === "driver" ? "rh_drv" : "rh_pax")} ${r.other_name}` : ""}
              </div>
              <Route pick={r.pick_text} drop={r.drop_text} />
            </div>
          ))}
        </FormSheet>
      )}
    </>
  );
}

function Route({ pick, drop }) {
  return (
    <div style={{ margin: "10px 0", fontSize: 14, color: T.ink, lineHeight: 1.45 }}>
      <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#16A34A" }}>●</span><span>{pick}</span></div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}><span style={{ color: "#DC2626" }}>●</span><span>{drop}</span></div>
    </div>
  );
}

// ------------------------------------------------- the driver's side
function RiderSettings({ api, onSaved }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    Promise.all([api.myRider(), api.myFuel ? api.myFuel().catch(() => null) : null]).then(([r, fu]) => {
      const x = one(r) || {};
      setF({ perKm: x.per_km_rupees == null ? "" : String(x.per_km_rupees), rides: x.serves_rides !== false, delivery: x.serves_delivery !== false, fuel: (one(fu) && one(fu).fuel_type) || "" });
    }).catch(() => setF({ perKm: "", rides: true, delivery: true, fuel: "" }));
  }, [api]);
  if (!f) return null;
  const set = (k, v) => { setSaved(false); setF((x) => ({ ...x, [k]: v })); };
  const row = { display: "flex", alignItems: "center", gap: 10, minHeight: 48, fontSize: 15, fontWeight: 700 };
  const save = async () => { try { await api.setRider(f); if (api.setFuel) await api.setFuel(f.fuel); setSaved(true); onSaved && onSaved(); setOpen(false); } catch (_) {} };
  const on = (v) => (v ? "\u2713" : "\u2013");
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{t("rs_title")}</div>
          <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 2 }}>
            {f.perKm ? String(t("rs_km_show")).replace("{n}", f.perKm) : t("rs_per_km")} {"\u00B7"} {on(f.rides)} {t("rs_rides")} {"\u00B7"} {on(f.delivery)} {t("rs_delivery")}
          </div>
        </div>
        <Btn kind="ghost" onClick={() => { setSaved(false); setOpen(true); }}>{t("av_change")}</Btn>
      </div>
      {open && (
        <FormSheet title={t("rs_title")} onClose={() => setOpen(false)}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 4 }}>{t("rs_per_km")}</div>
          <input style={{ ...input, marginBottom: 10 }} inputMode="numeric" maxLength={3} value={f.perKm} placeholder="12"
                 onChange={(e) => set("perKm", e.target.value.replace(/\D/g, ""))} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 4 }}>{t("rs_fuel")}</div>
          <select style={{ ...input, marginBottom: 10 }} value={f.fuel} onChange={(e) => set("fuel", e.target.value)}>
            <option value="">{t("rs_fuel_none")}</option>
            {["petrol", "diesel", "cng", "electric"].map((x) => <option key={x} value={x}>{t("fuel_" + x)}</option>)}
          </select>
          <label style={row}><input type="checkbox" checked={f.rides} onChange={(e) => set("rides", e.target.checked)} /> {t("rs_rides")}</label>
          <label style={row}><input type="checkbox" checked={f.delivery} onChange={(e) => set("delivery", e.target.checked)} /> {t("rs_delivery")}</label>
          <div style={{ marginTop: 10 }}><Btn full onClick={save}>{t("ow_save")}</Btn></div>
        </FormSheet>
      )}
    </div>
  );
}

// The driver's setup, settings and alerts: lives under the map and requests.
export function RideTools({ api, online }) {
  const { t } = useI18n();
  const [rider, setRiderInfo] = useState(null);
  const loadRider = useCallback(() => { api.myRider().then((r) => setRiderInfo(one(r) || {})).catch(() => {}); }, [api]);
  useEffect(loadRider, [loadRider]);
  return (
    <div style={{ marginTop: 6 }}>
      <SetupCard steps={rider ? [
        { done: rider.per_km_rupees != null, label: t("su_fare") },
        { done: !!online, label: t("su_online") },
      ] : []} />
      <RiderSettings api={api} onSaved={loadRider} />
      <AlertsCard api={api} />
      <RideHistory api={api} />
    </div>
  );
}

export function RideRequests({ api, online, trades = [], where = null }) {
  const { t, lang } = useI18n();
  const [rides, setRides] = useState([]);
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([api.ridesNearby(), api.myRide()]);
      setRides(many(n));
      setMine(many(m).filter((x) => x.role === "driver"));
    } catch (_) { /* the next tick tries again */ }
  }, [api]);
  useEffect(() => {
    load();
    const id = setInterval(load, online ? 4000 : 30000);
    return () => clearInterval(id);
  }, [load, online]);

  // While requests are waiting and nobody has been picked, the phone keeps
  // beeping and buzzing every few seconds, nearest request first in the list,
  // until the driver answers, silences it, or the requests are gone.
  const [muted, setMuted] = useState(false);
  const [selId, setSelId] = useState(null);
  const [navFor, setNavFor] = useState(null);
  const [started, setStarted] = useState(false);
  const [doneRide, setDoneRide] = useState(null);
  const sorted = rides.slice().sort((a, b) => Number(a.pick_km) - Number(b.pick_km));
  const idsKey = sorted.map((r) => r.id).join(",");
  const busyNow = mine.length > 0;
  useEffect(() => { setMuted(false); }, [idsKey]);
  useEffect(() => {
    if (!online || busyNow || muted || sorted.length === 0) return undefined;
    alertNewJob();
    const id = setInterval(alertNewJob, 6000);
    return () => clearInterval(id);
  }, [online, busyNow, muted, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const accept = async (r) => {
    setBusy(r.id); setMsg("");
    try {
      const x = one(await api.rideAccept(r.id));
      if (!x || !x.ok) setMsg(t("rdr_taken"));
    } catch (e) { setMsg((e && e.message) || t("rdr_taken")); }
    setBusy(null); load();
  };
  const move = async (r, action) => {
    setBusy(r.id);
    try {
      const x = one(await api.rideUpdate(r.id, action));
      if (action === "done" && x && x.ok) setDoneRide(r);
    } catch (_) {}
    setBusy(null); load();
  };

  return (
    <div style={{ marginTop: 4 }}>
      {doneRide && <RideDone ride={doneRide} who="driver" onClose={() => setDoneRide(null)} />}
      {navFor && <RouteNav from={where && where.manual ? where : null} to={{ lat: navFor.pick_lat, lng: navFor.pick_lng }} title={t("rdr_dir_pick")} onClose={() => setNavFor(null)} />}
      {mine.map((r) => (
        <div key={r.id} style={{ ...card, border: `2px solid ${T.green}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.green, marginBottom: 4 }}>{t("rdr_active")}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{r.other_name}</div>
          <DriverLive api={api} ride={r} where={where} />
          <RideCode api={api} rideId={r.id} role="driver" onState={setStarted} />
          <RideChat api={api} rideId={r.id} role="driver" />
          <Route pick={r.pick_text} drop={r.drop_text} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {r.other_phone && <a href={`tel:${r.other_phone}`} style={linkBtn(T.green)}>{t("rdr_call_pax")}</a>}
            <button onClick={() => setNavFor(r)} style={{ ...linkBtn(T.brandDark), border: "none", cursor: "pointer", fontFamily: "inherit" }}>{t("rdr_dir_pick")}</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!started && <Btn kind="ghost" disabled={busy === r.id} onClick={() => move(r, "release")}>{t("rdr_release")}</Btn>}
            <Btn disabled={busy === r.id || !started} onClick={() => move(r, "done")}>{t("rdr_finish")}</Btn>
          </div>
        </div>
      ))}
      {online && !busyNow && <h2 style={{ fontSize: 17, fontWeight: 800, color: T.ink, margin: "0 0 8px" }}>{t("rdr_title")}</h2>}
      {online && !busyNow && sorted.length > 0 && typeof sorted[0].my_lat === "number" && (() => {
        const cur = sorted.find((r) => r.id === selId) || sorted[0];
        const me = { lat: sorted[0].my_lat, lng: sorted[0].my_lng };
        const fare = (r) => (r.fare_paise != null ? `\u20B9${Math.round(r.fare_paise / 100)}` : "");
        const markers = [{ id: "me", kind: "me", ...me }].concat(
          sorted.filter((r) => typeof r.pick_lat === "number").map((r) => ({
            id: r.id, kind: "pickup", lat: r.pick_lat, lng: r.pick_lng, selected: r.id === cur.id,
            label: r.id === cur.id ? `${fare(r) || t("rdr_title")} \u00B7 ${r.pick_km} km` : fare(r),
          })));
        const lines = [];
        if (typeof cur.pick_lat === "number") {
          lines.push({ pts: [[me.lat, me.lng], [cur.pick_lat, cur.pick_lng]], dashed: true });
          if (typeof cur.drop_lat === "number") {
            markers.push({ id: "drop", kind: "drop", lat: cur.drop_lat, lng: cur.drop_lng, label: cur.trip_km != null ? `${cur.trip_km} km` : "" });
            lines.push({ pts: [[cur.pick_lat, cur.pick_lng], [cur.drop_lat, cur.drop_lng]] });
          }
        }
        return (
          <div style={{ margin: "0 0 10px" }}>
            <UberMap markers={markers} lines={lines} height="52vh" fitKey={cur.id} onSelect={(id) => { if (id !== "me" && id !== "drop") setSelId(id); }} />
          </div>
        );
      })()}
      {msg && <Notice tone="bad">{msg}</Notice>}
      {busyNow ? null : !online ? (
        <Notice tone="info">{t("jb_offline")}</Notice>
      ) : rides.length === 0 ? (
        <div style={{ fontSize: 14, color: T.inkFaint, lineHeight: 1.6 }}>{t("rdr_none")}</div>
      ) : (
        <>
        {!busyNow && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFF3D6", border: "1px solid #F3D48A", borderRadius: 12, padding: "9px 12px", margin: "0 0 10px" }}>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: "#7A4A00" }}>{String(t("rdr_waiting")).replace("{n}", sorted.length)}</span>
            {!muted && <button onClick={() => setMuted(true)} style={{ minHeight: 40, padding: "0 14px", borderRadius: 20, border: "1.5px solid #B45309", background: "#fff", color: "#7A4A00", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>{t("rdr_silence")}</button>}
          </div>
        )}
        {sorted.map((r, i) => (
        <div key={r.id} onClick={() => setSelId(r.id)} style={{ ...card, cursor: "pointer", border: (selId ? selId === r.id : i === 0) ? `2px solid ${T.green}` : card.border }}>
          {i === 0 && sorted.length > 1 && <div style={{ display: "inline-block", fontSize: 11.5, fontWeight: 800, color: "#fff", background: T.green, borderRadius: 6, padding: "2px 8px", marginBottom: 6 }}>{t("rdr_nearest")}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T.brandDark }}>#{i + 1} · {String(t("rdr_pick_km")).replace("{n}", Number(r.pick_km) < 0.1 ? "<0.1" : r.pick_km)}</span>
            {r.trip_km != null && <span style={{ fontSize: 12.5, color: T.inkFaint }}>{String(t("rdr_trip")).replace("{n}", r.trip_km)}</span>}
          </div>
          <Route pick={r.pick_text} drop={r.drop_text} />
          <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 700, margin: "0 0 10px" }}>
            {r.fare_paise != null ? String(t("rdr_fare")).replace("{n}", Math.round(r.fare_paise / 100)) : t("rdr_nofare")}
            {r.vehicle !== "any" && trades.find((x) => x.slug === r.vehicle) ? ` · ${vehicleLabel(trades.find((x) => x.slug === r.vehicle), lang)}` : ""}
          </div>
          <Btn full disabled={busy === r.id} onClick={() => accept(r)}>{busy === r.id ? "…" : t("rdr_accept")}</Btn>
        </div>
        ))}
        </>
      )}
    </div>
  );
}

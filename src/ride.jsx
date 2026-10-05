// ---------------------------------------------------------------------------
// RIDE: a passenger gives a pickup and a destination, drivers who are online
// nearby see the request and the first to accept gets it. The fare is agreed
// between the two; the app takes no payment.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useCallback } from "react";
import { T, Btn, Icon, Notice, input } from "./ui.jsx";
import { PlaceField, describePoint } from "./locpicker.jsx";
import { useMyLocation } from "./device.jsx";
import { useI18n } from "./i18n.jsx";
import { AlertsCard } from "./alerts.jsx";
import { SetupCard } from "./food.jsx";
import { vehicleLabel, tradeIcon, vividFor } from "./start.jsx";
import { TileArt } from "./scenes.jsx";

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
  const vehicles = trades.filter((x) => x.group_name === "Drivers");
  const geo = useMyLocation();
  const [pick, setPick] = useState(() => (place && typeof place.lat === "number" ? place : null));
  const [drop, setDrop] = useState(null);
  const [vehicle, setVehicle] = useState("any");
  const [fare, setFare] = useState("");
  const [ride, setRide] = useState(null);
  const [online, setOnline] = useState([]);
  const [fares, setFares] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [finished, setFinished] = useState(false);
  const wasActive = useRef(false);

  const loadRide = useCallback(async () => {
    if (!signedIn) return;
    try {
      const r = many(await api.myRide()).find((x) => x.role === "passenger") || null;
      if (r) wasActive.current = true;
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
    if (!pick || typeof pick.lat !== "number" || !placeText(drop)) { setMsg(t("rd_need_loc")); return; }
    setBusy(true); setMsg(null); setFinished(false);
    try {
      const r = one(await api.rideRequest(
        { text: placeText(pick), lat: pick.lat, lng: pick.lng },
        { text: placeText(drop), lat: drop.lat, lng: drop.lng },
        vehicle, fare === "" ? null : Number(fare)));
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
    return (
      <div style={wrap}>
        <div style={{ ...card, border: `2px solid ${accepted ? T.green : T.brandDark}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: accepted ? T.green : T.brandDark, marginBottom: 6 }}>
            {accepted ? t("rd_found") : t("rd_searching")}
          </div>
          {!accepted && <AlertsCard api={api} compact />}
          {accepted ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.ink }}>{ride.other_name}</div>
              {ride.other_vehicle && <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 2 }}>{ride.other_vehicle}</div>}
            </>
          ) : (
            <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55 }}>{t("rd_wait_sub")}</div>
          )}
          <Route pick={ride.pick_text} drop={ride.drop_text} />
          {ride.fare_paise != null && (
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.brandDark, marginBottom: 8 }}>
              {String(t("rdr_fare")).replace("{n}", Math.round(ride.fare_paise / 100))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {accepted && ride.other_phone && <a href={`tel:${ride.other_phone}`} style={linkBtn(T.green)}>{t("rd_call")}</a>}
            <Btn kind="ghost" disabled={busy} onClick={cancel}>{t("rd_cancel")}</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <TileArt k="need-ride" pos="center top" style={{ borderRadius: 14, aspectRatio: "2 / 1", maxHeight: 240, marginBottom: 14 }} />
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "6px 0 14px" }}>{t("rd_title")}</h1>
      {finished && <div style={{ marginBottom: 12 }}><Notice tone="good">{t("rd_done")}</Notice></div>}
      <div style={{ ...card, padding: "14px 14px 16px" }}>
        <Label dot="#16A34A" text={t("rd_pick")} />
        <PlaceField value={pick} onChange={setPick} sheetPlace={pick || place} />
        {geo.supported && (
          <button onClick={here} disabled={geo.state === "locating"} style={{
            display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer",
            color: T.brandDark, fontWeight: 700, fontSize: 13.5, padding: "8px 0 2px", minHeight: 40, fontFamily: "inherit",
          }}><Icon name="crosshair" size={16} /> {geo.state === "locating" ? "…" : t("rd_here")}</button>
        )}
        <div style={{ height: 12 }} />
        <Label dot="#DC2626" text={t("rd_drop")} />
        <PlaceField value={drop} onChange={setDrop} sheetPlace={drop || place} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, margin: "4px 0 8px" }}>{t("rd_which")}</div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", marginBottom: 14 }}>
        {[{ slug: "any", label: t("rd_any"), icon: "search", color: T.brandDark }].concat(
          vehicles.map((x) => ({ slug: x.slug, label: vehicleLabel(x, lang), icon: tradeIcon(x, "drivers"), color: vividFor(x.slug) }))
        ).map((v) => (
          <button key={v.slug} onClick={() => setVehicle(v.slug)} aria-pressed={vehicle === v.slug} style={{
            display: "flex", alignItems: "center", gap: 9, textAlign: "left", padding: "9px 10px", minHeight: 52, borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
            border: `2px solid ${vehicle === v.slug ? T.brandDark : T.line}`, background: vehicle === v.slug ? T.brandSoft : T.white,
          }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: v.color, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={v.icon} size={19} />
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.2, minWidth: 0, overflowWrap: "anywhere" }}>{v.label}</span>
          </button>
        ))}
      </div>
      <input style={{ ...input, marginBottom: 8 }} value={fare} inputMode="numeric" maxLength={5}
             placeholder={t("rd_offer")} aria-label={t("rd_offer")}
             onChange={(e) => setFare(e.target.value.replace(/\D/g, ""))} />
      <p style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>{t("rd_note")}</p>
      {msg && <div style={{ marginBottom: 10 }}><Notice tone="bad">{msg}</Notice></div>}
      <Btn full disabled={busy} onClick={send}>{busy ? "…" : signedIn ? t("rd_find") : t("nav_signin")}</Btn>

      <h2 style={{ fontSize: 17, fontWeight: 800, color: T.ink, margin: "24px 0 10px" }}>{t("rd_online")}</h2>
      {online.length === 0 ? (
        <div style={{ fontSize: 14, color: T.inkFaint, lineHeight: 1.6 }}>{t("rd_online_none")}</div>
      ) : online.map((d) => (
        <div key={d.id} style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#1FA85A", flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.ink }}>{d.display_name || d.full_name || d.trade_name}</span>
            <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft }}>{d.trade_name}</span>
          </span>
          <span style={{ textAlign: "right" }}>
            {d.distance_km != null && <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.brandDark }}>{String(t("rd_away")).replace("{n}", d.distance_km)}</span>}
            {fares[d.id] != null && <span style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: T.ink }}>{String(t("rs_km_show")).replace("{n}", fares[d.id])}</span>}
          </span>
        </div>
      ))}
      {onBrowse && (
        <button onClick={onBrowse} style={{
          background: "none", border: "none", cursor: "pointer", color: T.brandDark, fontWeight: 700, fontSize: 14,
          padding: "8px 0", minHeight: 44, fontFamily: "inherit",
        }}>{t("rd_browse")}</button>
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
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api.myRider().then((r) => { const x = one(r) || {}; setF({ perKm: x.per_km_rupees == null ? "" : String(x.per_km_rupees), rides: x.serves_rides !== false, delivery: x.serves_delivery !== false }); })
      .catch(() => setF({ perKm: "", rides: true, delivery: true }));
  }, [api]);
  if (!f) return null;
  const set = (k, v) => { setSaved(false); setF((x) => ({ ...x, [k]: v })); };
  const save = async () => { try { await api.setRider(f); setSaved(true); onSaved && onSaved(); } catch (_) {} };
  const row = { display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 15, fontWeight: 700 };
  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{t("rs_title")}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 4 }}>{t("rs_per_km")}</div>
      <input style={{ ...input, marginBottom: 8 }} inputMode="numeric" maxLength={3} value={f.perKm} placeholder="12"
             onChange={(e) => set("perKm", e.target.value.replace(/\D/g, ""))} />
      <label style={row}><input type="checkbox" checked={f.rides} onChange={(e) => set("rides", e.target.checked)} /> {t("rs_rides")}</label>
      <label style={row}><input type="checkbox" checked={f.delivery} onChange={(e) => set("delivery", e.target.checked)} /> {t("rs_delivery")}</label>
      <Btn kind="ghost" onClick={save}>{saved ? t("ow_store_saved") : t("ow_save")}</Btn>
    </div>
  );
}

export function RideRequests({ api, online, trades = [] }) {
  const { t, lang } = useI18n();
  const [rides, setRides] = useState([]);
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const [rider, setRiderInfo] = useState(null);
  const loadRider = useCallback(() => { api.myRider().then((r) => setRiderInfo(one(r) || {})).catch(() => {}); }, [api]);
  useEffect(loadRider, [loadRider]);

  const load = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([api.ridesNearby(), api.myRide()]);
      setRides(many(n));
      setMine(many(m).filter((x) => x.role === "driver"));
    } catch (_) { /* the next tick tries again */ }
  }, [api]);
  useEffect(() => {
    load();
    const id = setInterval(load, online ? 8000 : 30000);
    return () => clearInterval(id);
  }, [load, online]);

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
    try { await api.rideUpdate(r.id, action); } catch (_) {}
    setBusy(null); load();
  };

  return (
    <div style={{ marginTop: 18 }}>
      {mine.map((r) => (
        <div key={r.id} style={{ ...card, border: `2px solid ${T.green}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.green, marginBottom: 4 }}>{t("rdr_active")}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{r.other_name}</div>
          <Route pick={r.pick_text} drop={r.drop_text} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {r.other_phone && <a href={`tel:${r.other_phone}`} style={linkBtn(T.green)}>{t("jb_call")}</a>}
            <a href={dirUrl(r.pick_lat, r.pick_lng)} target="_blank" rel="noopener noreferrer" style={linkBtn(T.brandDark)}>{t("jb_dir")}</a>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="ghost" disabled={busy === r.id} onClick={() => move(r, "release")}>{t("rdr_release")}</Btn>
            <Btn disabled={busy === r.id} onClick={() => move(r, "done")}>{t("rdr_finish")}</Btn>
          </div>
        </div>
      ))}
      <SetupCard steps={rider ? [
        { done: rider.per_km_rupees != null, label: t("su_fare") },
        { done: !!online, label: t("su_online") },
      ] : []} />
      <RiderSettings api={api} onSaved={loadRider} />
      <AlertsCard api={api} />
      <h2 style={{ fontSize: 17, fontWeight: 800, color: T.ink, margin: "0 0 8px" }}>{t("rdr_title")}</h2>
      {msg && <Notice tone="bad">{msg}</Notice>}
      {!online ? (
        <Notice tone="info">{t("jb_offline")}</Notice>
      ) : rides.length === 0 ? (
        <div style={{ fontSize: 14, color: T.inkFaint, lineHeight: 1.6 }}>{t("rdr_none")}</div>
      ) : rides.map((r) => (
        <div key={r.id} style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T.brandDark }}>{String(t("rdr_pick_km")).replace("{n}", r.pick_km)}</span>
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
    </div>
  );
}

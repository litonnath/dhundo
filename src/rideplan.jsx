// SCHEDULED RIDES: book a bike taxi, car / taxi / cab or auto driver for a pickup and a destination at
// a pickup time and a drop time: once, every day or every week until a date. The price is the distance
// fare times the trips. The driver sees when he is free (busy calendar) and receives it as a booking.
import React, { useEffect, useMemo, useState } from "react";
import { T, Btn, Notice, input } from "./ui.jsx";
import { FormSheet } from "./rates.jsx";
import { useI18n } from "./i18n.jsx";
import { useRateCard, calcFare, rateKeyFor } from "./fares.jsx";
import { BusyCalendar, useBusy, clashWith } from "./busycal.jsx";
import { vehicleClass } from "./nearmap.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const one = (r) => (Array.isArray(r) ? r[0] : r);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const rs = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function Pills({ value, onChange, items }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
      {items.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} aria-pressed={value === k} style={{ flex: "1 1 80px", minHeight: 42, borderRadius: 21, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, border: `1.5px solid ${value === k ? T.brandDark : T.line}`, background: value === k ? T.brandSoft : T.white, color: value === k ? T.brandDeep : T.ink }}>{label}</button>
      ))}
    </div>
  );
}

export function RidePlanSheet({ api, pick, drop, km, vehicle, place, signedIn, onSignIn, onClose }) {
  const { t } = useI18n();
  const card = useRateCard(api);
  const [drivers, setDrivers] = useState(null);
  const [sel, setSel] = useState(null);
  const [sums, setSums] = useState({});
  const [repeat, setRepeat] = useState("daily");
  const [from, setFrom] = useState(() => ymd(new Date()));
  const [until, setUntil] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 29); return ymd(d); });
  const [pickT, setPickT] = useState("08:00");
  const [dropT, setDropT] = useState("09:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(null);
  const slots = useBusy(api, sel);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const all = many(await api.browse({ group: "Drivers", lat: pick.lat, lng: pick.lng, radiusKm: 30, limit: 30, state: place && place.state }));
        const list = all.filter((r) => vehicleClass(r.trade_slug) === vehicleClass(vehicle)).slice(0, 15);
        if (live) { setDrivers(list); if (list[0]) setSel(list[0].id); }
        if (list.length && api.ratingSummary) { const m = {}; many(await api.ratingSummary(list.map((d) => d.id)).catch(() => [])).forEach((x) => { m[x.worker_id] = x; }); if (live) setSums(m); }
      } catch (_) { if (live) setDrivers([]); }
    })();
    return () => { live = false; };
  }, [api, vehicle, pick && pick.lat, pick && pick.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = card.find((c) => c.key === rateKeyFor(vehicle || ""));
  const fare = row && km ? calcFare(row, km).rider : null;
  const startAt = new Date(`${from}T${pickT}:00`);
  const [ph, pm] = pickT.split(":").map(Number), [dh, dm] = dropT.split(":").map(Number);
  const mins = dh * 60 + dm - (ph * 60 + pm);
  const dayMs = 86400000;
  const span = Math.round((new Date(`${(repeat === "once" ? from : until)}T00:00:00`) - new Date(`${from}T00:00:00`)) / dayMs);
  const trips = repeat === "once" ? 1 : repeat === "daily" ? span + 1 : Math.floor(span / 7) + 1;
  const okTime = !Number.isNaN(startAt.getTime()) && mins >= 5 && mins <= 600 && startAt.getTime() > Date.now() - 600000;
  const okRange = repeat === "once" || (span >= 0 && span <= 180);
  const clash = useMemo(() => okTime && clashWith(slots, startAt, new Date(startAt.getTime() + mins * 60000)), [slots, from, pickT, dropT]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = fare != null ? fare * trips : null;
  const label = { once: t("rp_once"), daily: t("rp_daily"), weekly: t("rp_weekly") };

  const send = async () => {
    if (!signedIn) { onSignIn && onSignIn(); return; }
    setBusy(true); setMsg("");
    try {
      const r = one(await api.ridePlanRequest({
        worker: sel, start: startAt.toISOString(), minutes: mins, repeat, until: repeat === "once" ? null : until,
        pick: pick.address || pick.area || "", drop: drop.address || drop.area || "", km, note,
      }));
      if (r && r.ok) setDone(r);
      else setMsg(r && r.reason === "already_open" ? t("rp_open") : r && r.reason === "sign_in_required" ? t("e_signin") : t("e_save"));
    } catch (e) { setMsg((e && e.message) || t("e_save")); }
    setBusy(false);
  };

  return (
    <FormSheet title={t("rp_title")} onClose={onClose}>
      {done ? (
        <div>
          <Notice tone="good">{String(t("rp_sent")).replace("{n}", done.trips).replace("{a}", rs(done.price_paise / 100))}</Notice>
          <div style={{ marginTop: 12 }}><Btn full kind="ghost" onClick={onClose}>{t("w_back")}</Btn></div>
        </div>
      ) : (
        <>
          <div style={{ padding: "10px 12px", background: "#F7F9FB", borderRadius: 12, fontSize: 14, lineHeight: 1.55, color: T.ink, marginBottom: 12 }}>
            <div><b>{t("rd_pick")}:</b> {pick.address || pick.area}</div>
            <div><b>{t("rd_drop")}:</b> {drop.address || drop.area}</div>
            {km ? <div style={{ color: T.inkSoft }}>{km} km</div> : null}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: T.inkSoft, margin: "0 0 6px" }}>{t("rp_driver")}</div>
          {drivers === null && <div style={{ fontSize: 14, color: T.inkSoft }}>{"…"}</div>}
          {drivers && drivers.length === 0 && <div style={{ fontSize: 14, color: T.inkFaint, marginBottom: 8 }}>{t("hr_none")}</div>}
          {(drivers || []).map((d) => (
            <button key={d.id} onClick={() => setSel(d.id)} aria-pressed={sel === d.id} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, minHeight: 50, padding: "8px 12px", marginBottom: 6, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", border: `2px solid ${sel === d.id ? T.brandDark : T.line}`, background: sel === d.id ? T.brandSoft : T.white }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: T.ink }}>{d.display_name}<span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>{d.trade_name}</span>{sums[d.id] && sums[d.id].n > 0 ? <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#B7791F" }}>{"\u2605"} {Number(sums[d.id].avg_stars).toFixed(1)} <span style={{ color: T.inkSoft, fontWeight: 600 }}>({sums[d.id].n})</span></span> : <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.inkFaint }}>{t("rp_new_driver")}</span>}</span>
              {d.distance_km != null && <span style={{ fontSize: 13, fontWeight: 800, color: T.brandDark }}>{Number(d.distance_km).toFixed(1)} km</span>}
            </button>
          ))}
          {sel && <div style={{ margin: "8px 0 12px" }}><div style={{ fontSize: 13.5, fontWeight: 800, color: T.inkSoft, margin: "0 0 6px" }}>{t("rp_busy")}</div><BusyCalendar slots={slots} picked={okTime ? startAt : null} /></div>}
          <div style={{ fontSize: 13.5, fontWeight: 800, color: T.inkSoft, margin: "0 0 6px" }}>{t("rp_repeat")}</div>
          <Pills value={repeat} onChange={setRepeat} items={[["once", label.once], ["daily", label.daily], ["weekly", label.weekly]]} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <label style={{ flex: "1 1 130px", fontSize: 13, fontWeight: 700, color: T.inkSoft }}>{t("hr_from")}
              <input type="date" min={ymd(new Date())} value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > until) setUntil(e.target.value); }} style={{ ...input, marginTop: 4, marginBottom: 0 }} />
            </label>
            {repeat !== "once" && (
              <label style={{ flex: "1 1 130px", fontSize: 13, fontWeight: 700, color: T.inkSoft }}>{t("rp_until")}
                <input type="date" min={from} value={until} onChange={(e) => setUntil(e.target.value)} style={{ ...input, marginTop: 4, marginBottom: 0 }} />
              </label>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <label style={{ flex: "1 1 130px", fontSize: 13, fontWeight: 700, color: T.inkSoft }}>{t("rp_pick_time")}
              <input type="time" value={pickT} onChange={(e) => setPickT(e.target.value)} style={{ ...input, marginTop: 4, marginBottom: 0 }} />
            </label>
            <label style={{ flex: "1 1 130px", fontSize: 13, fontWeight: 700, color: T.inkSoft }}>{t("rp_drop_time")}
              <input type="time" value={dropT} onChange={(e) => setDropT(e.target.value)} style={{ ...input, marginTop: 4, marginBottom: 0 }} />
            </label>
          </div>
          {!okTime && <div style={{ marginBottom: 8 }}><Notice tone="bad">{t("rp_bad_time")}</Notice></div>}
          {clash && <div role="alert" style={{ margin: "0 0 8px", padding: "9px 12px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#B91C1C", fontWeight: 700, fontSize: 13.5 }}>{t("rp_clash")}</div>}
          <input style={{ ...input, marginBottom: 10 }} value={note} maxLength={120} placeholder={t("st_note")} aria-label={t("st_note")} onChange={(e) => setNote(e.target.value)} />
          <div style={{ padding: "10px 12px", background: "#EEF4FD", border: "1px solid #CFE0F7", borderRadius: 12, marginBottom: 10 }}>
            {fare != null ? (
              <>
                <div style={{ fontSize: 14, color: T.ink }}>{trips} {t("rp_trips")} {"×"} {rs(fare)} ({label[repeat]})</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#0B3A78" }}>{t("hr_total")}: {rs(total)}</div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{t("rp_fare_note")}</div>
              </>
            ) : <div style={{ fontSize: 14, color: T.inkSoft }}>{"…"}</div>}
          </div>
          {msg && <div style={{ marginBottom: 8 }}><Notice tone="bad">{msg}</Notice></div>}
          <Btn full disabled={busy || !sel || !okTime || !okRange || fare == null} onClick={send}>{busy ? "…" : signedIn ? t("rp_send") : t("nav_signin")}</Btn>
        </>
      )}
    </FormSheet>
  );
}

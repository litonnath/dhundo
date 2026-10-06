// ---------------------------------------------------------------------------
// HIRE FOR WORK: machines and trucks near the work place, each with the price
// its owner set. The price is worked out here: the hours wanted times the
// owner's hourly rate, plus the distance the machine has to travel to reach the
// place times the owner's per-km rate. The customer can call or book.
// ---------------------------------------------------------------------------
import React, { useState, useEffect } from "react";
import { T, Btn, Notice, input } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { BookingSheet } from "./hub.jsx";
import { kmBetween, vehicleEmoji } from "./nearmap.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const one = (r) => (Array.isArray(r) ? r[0] : r);
const money = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

export function HireNearby({ api, pick, vehicle, vehicles, place, signedIn, onSignIn }) {
  const { t } = useI18n();
  const [hours, setHours] = useState(2);
  const [rows, setRows] = useState(null);
  const [info, setInfo] = useState({});
  const [book, setBook] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null);
  const slugs = vehicles.map((v) => v.slug);
  const key = `${pick && pick.lat},${pick && pick.lng},${vehicle},${slugs.join(",")}`;
  useEffect(() => {
    if (!pick || typeof pick.lat !== "number") { setRows([]); return undefined; }
    let live = true;
    setRows(null);
    (async () => {
      try {
        const all = many(await api.browse({ group: "Drivers", lat: pick.lat, lng: pick.lng, radiusKm: 30, limit: 30, state: place && place.state }));
        const list = all.filter((r) => (vehicle === "any" ? slugs.includes(r.trade_slug) : r.trade_slug === vehicle)).slice(0, 12);
        if (!live) return;
        const ids = list.map((r) => r.id);
        const [prices, homes, online, rates] = await Promise.all([
          ids.length ? api.driverPricing(ids).catch(() => []) : [],
          ids.length && api.driverHomes ? api.driverHomes(ids).catch(() => []) : [],
          api.availableWorkers({ lat: pick.lat, lng: pick.lng, group: "Drivers", trade: null, radiusKm: 30, limit: 40 }).catch(() => []),
          Promise.all(ids.map((id) => api.ratesGet(id).then(many).catch(() => []))),
        ]);
        if (!live) return;
        const o = {};
        const on = new Set(many(online).map((r) => r.id));
        list.forEach((r, i) => {
          const pr = many(prices).find((p) => p.id === r.id) || {};
          const hm = many(homes).find((h) => h.id === r.id);
          const rr = rates[i] || [];
          const cheapest = (unit) => rr.filter((x) => x.unit === unit).sort((a, b) => a.rupees - b.rupees)[0];
          const hr = cheapest("hour");
          const km = cheapest("km");
          o[r.id] = {
            hourly: hr ? Number(hr.rupees) : null,
            perKm: km ? Number(km.rupees) : (Number(pr.per_km_rupees) > 0 ? Number(pr.per_km_rupees) : null),
            away: hm && typeof hm.lat === "number" ? kmBetween(pick, hm) : (r.distance_km != null ? Number(r.distance_km) : null),
            where: (hm && hm.address) || r.locality || "",
            online: on.has(r.id),
          };
        });
        setInfo(o);
        setRows(list.sort((a, b) => (o[b.id].online - o[a.id].online) || ((o[a.id].away ?? 1e9) - (o[b.id].away ?? 1e9))));
      } catch (_) { if (live) setRows([]); }
    })();
    return () => { live = false; };
  }, [api, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (r) => {
    if (!signedIn) { onSignIn && onSignIn(); return; }
    setBusy(r.id); setMsg("");
    try {
      const x = one(await api.reveal(r.id));
      if (x && x.ok) { try { window.location.href = `tel:${String(x.phone).replace(/\s/g, "")}`; } catch (_) {} }
      else setMsg(x && x.reason === "phone_not_verified" ? t("pv_banner") : x && x.reason === "rate_limited" ? t("e_rate") : t("e_gone"));
    } catch (e) { setMsg((e && e.message) || t("e_gone")); }
    setBusy(null);
  };

  return (
    <div style={{ marginTop: 6 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: T.ink, margin: "6px 0 8px" }}>{t("hr_title")}</h2>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>{t("hr_hours")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[1, 2, 4, 8].map((h) => (
          <button key={h} onClick={() => setHours(h)} aria-pressed={hours === h} style={{ minWidth: 58, minHeight: 42, borderRadius: 21, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, border: `1.5px solid ${hours === h ? T.brandDark : T.line}`, background: hours === h ? T.brandSoft : T.white, color: hours === h ? T.brandDeep : T.ink }}>{String(t("hr_h")).replace("{n}", h)}</button>
        ))}
        <input style={{ ...input, width: 84, marginBottom: 0, textAlign: "center" }} inputMode="numeric" maxLength={3} value={[1, 2, 4, 8].includes(hours) ? "" : String(hours)} placeholder={t("hr_other")} aria-label={t("hr_other")}
               onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); if (n >= 1 && n <= 240) setHours(n); }} />
      </div>
      {msg && <div style={{ marginBottom: 8 }}><Notice tone="bad">{msg}</Notice></div>}
      {rows === null && <div style={{ fontSize: 14, color: T.inkSoft }}>{"…"}</div>}
      {rows && rows.length === 0 && <div style={{ fontSize: 14, color: T.inkFaint, lineHeight: 1.6 }}>{t("hr_none")}</div>}
      {(rows || []).map((r) => {
        const d = info[r.id] || {};
        const work = d.hourly != null ? hours * d.hourly : null;
        const travel = d.perKm != null && d.away != null ? Math.round(d.away * 10) / 10 * d.perKm : 0;
        return (
          <div key={r.id} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ width: 44, height: 44, borderRadius: "50%", background: "#F3F4F6", border: `3px solid ${d.online ? "#16A34A" : "#9CA3AF"}`, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{vehicleEmoji(r.trade_slug + " " + r.trade_name)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: T.ink }}>{r.display_name}</span>
                <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, overflowWrap: "anywhere" }}>{r.trade_name}{d.where ? ` · ${d.where}` : ""}</span>
              </span>
              <span style={{ textAlign: "right", flexShrink: 0 }}>
                {d.away != null && <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.brandDark }}>{d.away < 10 ? d.away.toFixed(1) : Math.round(d.away)} km</span>}
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: d.online ? "#0F8A3C" : "#6B7280" }}>{d.online ? t("rd_on") : t("rd_off")}</span>
              </span>
            </div>
            <div style={{ margin: "10px 0 0", padding: "9px 11px", background: "#F7F9FB", borderRadius: 10, fontSize: 13.5, lineHeight: 1.55, color: T.ink }}>
              {work == null ? (
                <span style={{ color: T.inkSoft, fontWeight: 700 }}>{t("hr_nohr")}</span>
              ) : (
                <>
                  <div>{hours} h {"×"} {money(d.hourly)}/h = <b>{money(work)}</b></div>
                  {travel > 0 && <div>{(Math.round(d.away * 10) / 10)} km {"×"} {money(d.perKm)}/km = <b>{money(travel)}</b> <span style={{ color: T.inkSoft }}>({t("hr_travel")})</span></div>}
                  <div style={{ fontSize: 16, fontWeight: 800, marginTop: 3 }}>{t("hr_total")}: {money(work + travel)}</div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn kind="call" disabled={busy === r.id} onClick={() => call(r)}>{t("fk_call")}</Btn>
              <Btn onClick={() => { if (!signedIn) { onSignIn && onSignIn(); return; } setBook(r); }}>{t("hr_book")}</Btn>
            </div>
          </div>
        );
      })}
      {book && <BookingSheet api={api} row={book} place={place} onClose={() => setBook(null)} />}
    </div>
  );
}

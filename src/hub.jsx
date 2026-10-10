// ---------------------------------------------------------------------------
// THE REQUEST SCREENS: delivery jobs for riders and shops, bookings for
// workers and customers, and the partner programme. Money is never handled
// here: the people involved agree it between themselves.
// ---------------------------------------------------------------------------
import { CancelButton, dateTime, DueTimer } from "./cancel.jsx";
import { DeliveryRateBox } from "./bizpay.jsx";
import { OrderHeader, Banner, Steps, Fold, PayBadge, callStyle, outlineStyle, cardStyle } from "./orderui.jsx";
import { scheduleLine } from "./bizmore.jsx";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { T, Btn, CloseButton, useDismissable, input, Notice, InvitePanel } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { rateText } from "./rates.jsx";
import { PlaceField } from "./locpicker.jsx";
import { RouteNav, RiderJobMap } from "./nearmap.jsx";
import { RideChat, JobCode, DeliveryHandover } from "./ridechat.jsx";
import { BusyCalendar, TimeSlots, useBusy, clashWith } from "./busycal.jsx";

const one = (r) => (Array.isArray(r) ? r[0] : r);
const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const card = { background: T.white, border: "1px solid #E5E7EB", borderRadius: 14, padding: "14px 15px", marginBottom: 12, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" };
const h2 = { fontSize: 17, fontWeight: 800, color: T.ink, margin: "0 0 8px" };

// A short beep and a buzz when a new job arrives, so a rider with the phone
// in a pocket notices. Both are silently skipped where not allowed.
export function alertNewJob() {
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (_) {}
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = new C(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.15;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 250);
  } catch (_) {}
}


// ----------------------------------------------------------------- RIDER
export function RiderJobs({ api, online, where = null }) {
  const { t } = useI18n();
  const [jobs, setJobs] = useState([]);
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const seen = useRef(new Set());
  const first = useRef(true);
  const [navFor, setNavFor] = useState(null);

  const load = useCallback(async () => {
    try {
      if (online && api.ordersReleaseDue) await api.ordersReleaseDue().catch(() => {});
      const [n, m] = await Promise.all([api.jobsNearby(), api.myJobs()]);
      const list = many(n);
      if (!first.current && list.some((j) => !seen.current.has(j.id))) alertNewJob();
      list.forEach((j) => seen.current.add(j.id));
      first.current = false;
      setJobs(list);
      setMine(many(m).filter((j) => j.role === "rider" && ["accepted", "picked_up"].includes(j.status)));
    } catch (_) { /* the next tick tries again */ }
  }, [api, online]);

  useEffect(() => {
    load();
    const id = setInterval(load, online ? 12000 : 30000);
    return () => clearInterval(id);
  }, [load, online]);

  const accept = async (j) => {
    setBusy(j.id); setMsg("");
    try {
      const r = one(await api.jobAccept(j.id));
      if (!r || !r.ok) setMsg(t("jb_taken"));
    } catch (e) { setMsg((e && e.message) || t("jb_taken")); }
    setBusy(null); load();
  };

  return (
    <div style={{ marginTop: 18 }}>
      {navFor && <RouteNav from={where && where.manual ? where : null} to={{ lat: navFor.pickup_lat, lng: navFor.pickup_lng }} title={t("jb_dir")} onClose={() => setNavFor(null)} />}
      {mine.map((j) => (
        <div key={j.id} style={cardStyle}>
          {!(where && where.manual) && <div style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 8px" }}>{t("jb_keep_open")}</div>}
          <OrderHeader name={j.status === "picked_up" ? (j.customer_name || j.drop_text) : j.other_name}
                       sub={j.status === "picked_up" ? j.drop_text : j.note} />
          {j.fee_paise != null && <div style={{ fontSize: 14, fontWeight: 800, color: "#0F6B33", marginTop: 8 }}>{String(t("jb_fee")).replace("{n}", Math.round(j.fee_paise / 100))}</div>}
          {j.pay_method && (
            <div style={{ margin: "10px 0 0", padding: "10px 12px", borderRadius: 14, background: j.paid ? "#ECFDF3" : "#FFF7E6", border: `1px solid ${j.paid ? "#A7E3BE" : "#F5D58C"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <PayBadge method={j.pay_method} paid={j.paid} t={t} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: j.paid ? "#0F6B33" : "#8A5A00", marginTop: 6 }}>
                {j.paid ? t("pay_dont_collect") : j.pay_method === "upi" ? t("pay_upi_check") : String(t("pay_collect")).replace("{n}", Math.round((j.due_paise || 0) / 100 * 100) / 100)}
              </div>
              {!j.paid && j.status === "picked_up" && (
                <div style={{ marginTop: 8 }}><Btn full onClick={async () => { try { await api.orderPay(j.order_id || null, "mark_paid"); } catch (_) {} load(); }}>{t("pay_collected")}</Btn></div>
              )}
            </div>
          )}
          <Banner tone={j.status === "picked_up" ? "go" : "wait"}
                  title={j.status === "picked_up" ? t("jb_step2") : t("jb_step1")}>
            {j.due_at && <DueTimer due={j.due_at} style={{ marginTop: 8 }} />}
          </Banner>
          <Steps steps={[t("jb_s_accepted"), t("jb_s_shop"), t("jb_s_picked"), t("jb_s_done")]} at={j.status === "picked_up" ? 2 : 1} />
          <RiderJobMap api={api} job={j} where={where} onChanged={load} />
          {(() => {
            const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
            const hasMap = typeof j.drop_lat === "number" && typeof j.drop_lng === "number";
            const customer = (j.customer_phone || hasMap) ? (
              <div style={grid}>
                {j.customer_phone && <a href={`tel:${j.customer_phone}`} style={callStyle}>{t("jb_call_cust")}</a>}
                {hasMap && <a href={`https://www.google.com/maps/dir/?api=1&destination=${j.drop_lat},${j.drop_lng}`} target="_blank" rel="noopener noreferrer" style={outlineStyle}>{t("jb_dir_cust")}</a>}
              </div>
            ) : null;
            const label = { fontSize: 12.5, fontWeight: 800, color: T.inkSoft, letterSpacing: 0.4, textTransform: "uppercase", margin: "12px 0 6px" };
            return j.status !== "picked_up" ? (
              <>
                <div style={label}>{t("jb_shop")}</div>
                <div style={grid}>
                  {j.other_phone && <a href={`tel:${j.other_phone}`} style={callStyle}>{t("jb_call")}</a>}
                  {typeof j.pickup_lat === "number" && (
                    <button onClick={() => setNavFor(j)} style={{ ...outlineStyle, cursor: "pointer", fontFamily: "inherit" }}>{t("jb_dir")}</button>
                  )}
                </div>
                <JobCode api={api} jobId={j.id} role="rider" onChanged={load} />
                {customer && <Fold title={`${t("jb_customer")}${j.customer_name ? `: ${j.customer_name}` : ""}${Number(j.cust_n) > 0 ? ` \u2605 ${Number(j.cust_avg).toFixed(1)} (${j.cust_n})` : ""}`}>{customer}</Fold>}
              </>
            ) : (
              <>
                <div style={label}>{t("jb_customer")}{j.customer_name ? `: ${j.customer_name}` : ""}{Number(j.cust_n) > 0 ? ` \u2605 ${Number(j.cust_avg).toFixed(1)} (${j.cust_n})` : ""}</div>
                {customer}
                <DeliveryHandover api={api} jobId={j.id} role="rider" ready onChanged={load} />
              </>
            );
          })()}
          <Fold title={t("jb_msgs")}>
            <RideChat api={api} rideId={j.id} role="rider" kind="job" />
          </Fold>
          {j.status !== "picked_up" && (
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <CancelButton role="rider" label={t("cn_rider_give_back")} onConfirm={async (reason) => { const r = await api.jobRiderCancel(j.id, reason); load(); return r; }} />
            </div>
          )}
        </div>
      ))}
      <h2 style={h2}>{t("jb_title")}</h2>
      {msg && <Notice tone="bad">{msg}</Notice>}
      {!online ? (
        <Notice tone="info">{t("jb_offline")}</Notice>
      ) : jobs.length === 0 ? (
        <div style={{ fontSize: 14, color: T.inkFaint, lineHeight: 1.6 }}>{t("jb_none")}</div>
      ) : jobs.map((j) => (
        <div key={j.id} style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.ink }}>{j.shop}</span>
            {j.km != null && <span style={{ fontSize: 12.5, color: T.inkFaint }}>{String(t("jb_km")).replace("{n}", j.km)}</span>}
          </div>
          <div style={{ fontSize: 14, color: T.inkSoft, margin: "4px 0" }}>{j.note}</div>
          <div style={{ fontSize: 14, color: T.ink }}>{t("jb_to")} {j.drop_text}</div>
          {Number(j.cust_n) > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, marginTop: 2 }}>{t("jb_customer")}: {"\u2605"} {Number(j.cust_avg).toFixed(1)} ({j.cust_n})</div>}
          {j.km != null && j.drop_km != null && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, margin: "8px 0 0" }}>
              {[["jb_d_pick", j.km], ["jb_d_drop", j.drop_km], ["jb_d_total", Math.round((Number(j.km) + Number(j.drop_km)) * 10) / 10]].map(([k, v]) => (
                <div key={k} style={{ background: k === "jb_d_total" ? "#EAF2FF" : "#F7F8FA", borderRadius: 10, padding: "7px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{v} km</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkSoft, lineHeight: 1.2 }}>{t(k)}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 16, color: T.brandDark, fontWeight: 800, margin: "8px 0 10px" }}>
            {j.fee_paise != null ? String(t("jb_fee")).replace("{n}", Math.round(j.fee_paise / 100)) : t("jb_fee_none")}
          </div>
          <Btn full disabled={busy === j.id} onClick={() => accept(j)}>{busy === j.id ? "…" : t("jb_accept")}</Btn>
        </div>
      ))}
    </div>
  );
}

const linkBtn = (bg) => ({
  display: "inline-flex", alignItems: "center", background: bg, color: "#fff", borderRadius: 10,
  padding: "10px 14px", minHeight: 44, fontWeight: 700, fontSize: 14.5, textDecoration: "none", boxSizing: "border-box",
});

// ------------------------------------------------------------------ SHOP
// A rider's finished deliveries, newest first.
export function RiderHistory({ api }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);
  const [canRate, setCanRate] = useState(() => new Set());
  const [both, setBoth] = useState({});
  const [mineAvg, setMineAvg] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.myJobs()).then(async (r) => {
      const list = many(r).filter((j) => j.role === "rider" && ["delivered", "cancelled", "expired"].includes(j.status));
      if (alive) setRows(list);
      const ids = list.filter((j) => j.status === "delivered" && j.order_id).map((j) => j.order_id);
      if (ids.length && api.orderDeliveryRatings) {
        try { const m = {}; many(await api.orderDeliveryRatings(ids)).forEach((x) => { (m[x.order_id] = m[x.order_id] || {})[x.by_role] = x; }); if (alive) setBoth(m); } catch (_) { /* keep */ }
      }
      if (api.myDeliveryRatings) {
        try { const rr = many(await api.myDeliveryRatings()).filter((x) => x.by_role === "customer" && !x.complaint); if (alive && rr.length) setMineAvg({ avg: rr.reduce((a, x) => a + x.stars, 0) / rr.length, n: rr.length }); } catch (_) { /* keep */ }
      }
      if (ids.length && api.deliveryRateable) { try { const x = many(await api.deliveryRateable(ids)); if (alive) setCanRate(new Set(x.map((y) => (typeof y === "string" ? y : y.order_id)))); } catch (_) { /* keep */ } }
    }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [api]);
  if (rows === null) return <div style={{ height: 80 }} />;
  if (rows.length === 0) return <div style={{ margin: "14px 0", color: T.inkSoft, fontSize: 14 }}>{t("st_noorders")}</div>;
  return (
    <div>
      {mineAvg && (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: T.ink }}>{mineAvg.avg.toFixed(1)}</span>
          <span><span style={{ display: "block", color: "#B7791F", fontSize: 16, letterSpacing: 1 }}>{"\u2605".repeat(Math.round(mineAvg.avg))}{"\u2606".repeat(5 - Math.round(mineAvg.avg))}</span><span style={{ display: "block", fontSize: 13, color: T.inkSoft }}>{String(t("rt_count")).replace("{n}", mineAvg.n)}</span></span>
        </div>
      )}
      {rows.map((j) => {
        const done = j.status === "delivered";
        const cash = j.pay_method === "cod" && j.due_paise != null;
        const tile = (label, value, tone) => (
          <div style={{ flex: "1 1 120px", background: tone === "good" ? "#F2FAF5" : "#F6F8FB", border: `1px solid ${tone === "good" ? "#BEE3CB" : "#E5E7EB"}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: tone === "good" ? "#166534" : T.ink, marginTop: 2 }}>{value}</div>
          </div>
        );
        return (
          <div key={j.id} style={cardStyle}>
            <OrderHeader name={j.other_name || j.drop_text} sub={dateTime(j.done_at || j.created_at)} />
            <Banner tone={done ? "good" : "bad"} title={done ? t("jb_h_done") : t("jp_status_" + j.status)} />
            {done && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
                {j.fee_paise != null && tile(t("jb_h_earned_l"), `\u20b9${Math.round(j.fee_paise / 100)}`, "good")}
                {cash && j.paid && tile(t("jb_h_cash_l"), `\u20b9${Math.round(j.due_paise / 100 * 100) / 100}`)}
                {j.pay_method === "upi" && tile(t("jb_h_pay_l"), j.paid ? `UPI \u00B7 ${t("pay_paid")}` : `UPI \u00B7 ${t("pay_unpaid")}`)}
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 600, color: T.inkSoft, letterSpacing: 0.3, textTransform: "uppercase", margin: "10px 0 2px" }}>{t("jb_to")}</div>
            <div style={{ fontSize: 14.5, color: T.ink, lineHeight: 1.4 }}>{j.drop_text}</div>
            {done && j.order_id && (() => {
              const b = both[j.order_id] || {};
              const star = (n) => "\u2605".repeat(n) + "\u2606".repeat(Math.max(0, 5 - n));
              const line = (x, label, emptyKey) => (
                <div style={{ margin: "6px 0", padding: "9px 12px", background: "#F6F8FB", border: "1px solid #E5E7EB", borderRadius: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</div>
                  {x ? (<>
                    <div style={{ fontSize: 16, color: "#B7791F", marginTop: 2, letterSpacing: 1 }}>{star(x.stars)}{x.complaint ? <span style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 700, color: "#A32424", letterSpacing: 0 }}>{t("rt_complaint")}</span> : null}</div>
                    {x.comment && <div style={{ fontSize: 14, color: T.ink, marginTop: 3, overflowWrap: "anywhere" }}>{x.comment}</div>}
                  </>) : <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 2 }}>{t(emptyKey)}</div>}
                </div>
              );
              return (<>
                {line(b.customer, t("jb_r_from_cust"), "jb_r_wait")}
                {line(b.rider, t("jb_r_to_cust"), "jb_r_notyet")}
              </>);
            })()}
            {done && j.order_id && canRate.has(j.order_id) && <DeliveryRateBox api={api} orderId={j.order_id} who="customer" onDone={(id) => setCanRate((s) => { const n = new Set(s); n.delete(id); return n; })} />}
          </div>
        );
      })}
    </div>
  );
}

export function ShopJobs({ api, hasListing, collapsed = false }) {
  const { t } = useI18n();
  const [f, setF] = useState({ note: "", drop: "", fee: "" });
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try { setJobs(many(await api.myJobs()).filter((j) => j.role === "shop")); } catch (_) {}
  }, [api]);
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.jobPost(f.note, f.drop, f.fee === "" ? null : Number(f.fee)));
      if (r && r.ok) { setF({ note: "", drop: "", fee: "" }); setMsg({ tone: "good", text: t("jp_sent") }); load(); }
      else setMsg({ tone: "bad", text: r && r.reason === "no_listing" ? t("jp_need_listing") : t("e_save") });
    } catch (e) { setMsg({ tone: "bad", text: (e && e.message) || t("e_save") }); }
    setBusy(false);
  };
  const cancel = async (j) => { try { await api.jobUpdate(j.id, "cancel"); } catch (_) {} load(); };

  if (!hasListing) return null;
  const Wrap = ({ children }) => (collapsed
    ? <details style={{ marginTop: 18 }}><summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 800, color: T.brandDark, minHeight: 40, display: "flex", alignItems: "center" }}>{t("jp_more")}</summary><div style={{ marginTop: 8 }}>{children}</div></details>
    : <div style={{ marginTop: 18 }}>{children}</div>);
  return (
    <Wrap>
      <h2 style={h2}>{t("jp_title")}</h2>
      <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, marginBottom: 10 }}>{t("jp_sub")}</div>
      <input style={{ ...input, marginBottom: 8 }} value={f.note} maxLength={300} placeholder={t("jp_note_ph")} aria-label={t("jp_note")}
             onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} />
      <input style={{ ...input, marginBottom: 8 }} value={f.drop} maxLength={200} placeholder={t("jp_drop")} aria-label={t("jp_drop")}
             onChange={(e) => setF((x) => ({ ...x, drop: e.target.value }))} />
      <input style={{ ...input, marginBottom: 10 }} value={f.fee} inputMode="numeric" maxLength={4} placeholder={t("jp_fee")} aria-label={t("jp_fee")}
             onChange={(e) => setF((x) => ({ ...x, fee: e.target.value.replace(/\D/g, "") }))} />
      {msg && <div style={{ marginBottom: 10 }}><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <Btn full disabled={busy || f.note.trim().length < 3 || f.drop.trim().length < 3} onClick={send}>{busy ? "…" : t("jp_send")}</Btn>
      {jobs.length > 0 && <h2 style={{ ...h2, marginTop: 18 }}>{t("jp_mine")}</h2>}
      {jobs.map((j) => (
        <div key={j.id} style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{j.note}</div>
          <div style={{ fontSize: 13.5, color: T.inkSoft, margin: "3px 0" }}>{t("jb_to")} {j.drop_text}</div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: j.status === "delivered" ? T.green : T.brandDark }}>{t("jp_status_" + j.status)}</div>
          {j.other_name && j.status !== "cancelled" && (
            <div style={{ fontSize: 13.5, color: T.ink, marginTop: 4 }}>
              {String(t("jp_rider")).replace("{name}", j.other_name)}{" "}
              {j.other_phone && <a href={`tel:${j.other_phone}`} style={{ color: T.brandDark, fontWeight: 700 }}>{j.other_phone}</a>}
            </div>
          )}
          {["accepted", "picked_up"].includes(j.status) && <JobCode api={api} jobId={j.id} role="shop" />}
          {["accepted", "picked_up"].includes(j.status) && <RideChat api={api} rideId={j.id} role="shop" kind="job" startOpen={false} />}
          {["open", "accepted"].includes(j.status) && (
            <button onClick={() => cancel(j)} style={{ background: "none", border: "none", color: T.red, fontWeight: 700, cursor: "pointer", minHeight: 40, padding: 0, fontFamily: "inherit" }}>{t("jp_cancel")}</button>
          )}
        </div>
      ))}
    </Wrap>
  );
}

// -------------------------------------------------------------- BOOKINGS
// Lengths people ask for, in minutes: a few minutes, hours, days, up to a year.
const LENGTHS = [10, 30, 60, 120, 240, 480, 1440, 10080, 43200, 129600, 525600];
const UNITS = [["bk_unit_min", 1], ["bk_unit_hr", 60], ["bk_unit_day", 1440]];

// 90 -> "90 min", 120 -> "2 hr", 10080 -> "1 wk": the largest unit that divides evenly.
export function fmtLength(mins, t) {
  const n = Number(mins) || 0;
  const [key, div] = n % 525600 === 0 ? ["bk_u_yr", 525600] : n % 43200 === 0 ? ["bk_u_mo", 43200]
    : n % 10080 === 0 ? ["bk_u_wk", 10080] : n % 1440 === 0 ? ["bk_u_day", 1440]
    : n % 60 === 0 ? ["bk_u_hr", 60] : ["bk_u_min", 1];
  return String(t(key)).replace("{n}", n / div);
}
const pad2 = (x) => String(x).padStart(2, "0");
// A phone's date-time box wants local time as YYYY-MM-DDTHH:MM.
const localStamp = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (_) { return ""; } };

export function BookingSheet({ api, row, onClose, place }) {
  const { t, lang } = useI18n();
  useDismissable(true, onClose);
  const [mins, setMins] = useState(60);
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState(60);
  const [whenKey, setWhenKey] = useState("now");
  const [start, setStart] = useState(localStamp(new Date(Date.now() + 5 * 60000)));
  const [pay, setPay] = useState("");
  const [where, setWhere] = useState(() => (place && (place.address || place.area) ? place : null));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sent, setSent] = useState(false);
  const [rates, setRates] = useState([]);
  const [rate, setRate] = useState(null);
  const [sched, setSched] = useState(null);
  const busySlots = useBusy(api, row.id);
  useEffect(() => { let live = true; Promise.resolve(api.schedulePublic ? api.schedulePublic(row.id) : null).then((r) => { const x = Array.isArray(r) ? r[0] : r; if (live && x) setSched(x); }).catch(() => {}); return () => { live = false; }; }, [api, row.id]);
  useEffect(() => {
    let live = true;
    api.ratesGet(row.id).then((r) => { if (live) setRates(many(r)); }).catch(() => {});
    return () => { live = false; };
  }, [api, row.id]);
  const total = custom ? Math.round(Number(amount || 0) * unit) : mins;
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + total * 60000);
  const ok = !!start && !Number.isNaN(startDate.getTime()) && total >= 5 && total <= 525600;
  const quick = (key) => {
    setWhenKey(key);
    const d = new Date();
    if (key === "now") d.setMinutes(d.getMinutes() + 5);
    else if (key === "1h") d.setHours(d.getHours() + 1);
    else if (key === "tmr") { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    if (key !== "pick") setStart(localStamp(d));
  };
  const placeText = where ? (where.address || where.area || "") : "";

  const send = async () => {
    setBusy(true); setMsg(null);
    // The owner reads this as one line, so it is kept to plain English.
    const units = { rt_u_hour: "hour", rt_u_day: "day", rt_u_week: "week", rt_u_month: "month", rt_u_trip: "trip", rt_u_km: "km", rt_u_job: "job" };
    const text = [
      rate ? `Rate: ${rate.label} ${rateText(rate, (k) => units[k])}` : "",
      pay ? `Offer: \u20B9${pay}` : "",
      placeText ? `At: ${placeText}` : "",
    ].filter(Boolean).join(" \u00b7 ").slice(0, 300);
    try {
      const r = one(await api.bookingRequest(row.id, startDate.toISOString(), total, text));
      if (r && r.ok) setSent(true);
      else setMsg(r && r.reason === "already_open" ? t("bk_open") : t("e_save"));
    } catch (e) { setMsg((e && e.message) || t("e_save")); }
    setBusy(false);
  };
  const pill = (on) => ({
    border: `1.5px solid ${on ? T.brandDark : T.line}`, borderRadius: 18, padding: "8px 14px", minHeight: 40,
    background: on ? T.brandSoft : T.white, color: on ? T.brandDark : T.ink, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit",
  });
  const head = { display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 800, color: T.ink, margin: "16px 0 8px" };
  const num = { width: 22, height: 22, borderRadius: "50%", background: T.brandDark, color: "#fff", fontSize: 12.5, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  const face = row.avatar_url || (row.photos && row.photos[0]);
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, padding: "14px 18px 24px", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: face ? `center/cover url(${face}) ${T.line}` : T.brandSoft, color: T.brandDark, fontWeight: 800, fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!face && String(row.display_name || "?").trim().charAt(0).toUpperCase()}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 18, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(t("bk_title")).replace("{name}", row.display_name || "")}</span>
            {row.trade_name && <span style={{ display: "block", fontSize: 13, color: T.inkSoft }}>{row.trade_name}</span>}
          </span>
          <CloseButton onClick={onClose} />
        </div>
        {sent ? (
          <div style={{ marginTop: 14 }}>
            <Notice tone="good">{t("bk_sent")}</Notice>
            <div style={{ marginTop: 12 }}><Btn full kind="ghost" onClick={onClose}>{t("w_back")}</Btn></div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6, margin: "10px 0 0" }}>{t("bk_sub")}</p>

            {sched && <div style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: 12, background: "#EEF4FF", fontSize: 14, fontWeight: 700, color: "#1E3A8A", lineHeight: 1.5 }}>{scheduleLine(sched, t, lang)}</div>}
            <div style={head}><span style={num}>1</span>{t("bk_when")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {[["now", "bk_now"], ["1h", "bk_1h"], ["tmr", "bk_tmr"], ["pick", "bk_pick"]].map(([k, key]) => (
                <button key={k} onClick={() => quick(k)} aria-pressed={whenKey === k} style={pill(whenKey === k)}>{t(key)}</button>
              ))}
            </div>
            {whenKey === "pick" && (
              <input type="datetime-local" min={localStamp(new Date(Date.now() - 600000))} value={start}
                     onChange={(e) => setStart(e.target.value)} style={{ ...input, marginBottom: 4 }} />
            )}

            <BusyCalendar slots={busySlots} picked={ok ? startDate : null} onPick={(d) => {
              const cur = new Date(start);
              const b = new Date(d);
              b.setHours(Number.isNaN(cur.getTime()) ? 9 : cur.getHours(), Number.isNaN(cur.getTime()) ? 0 : cur.getMinutes(), 0, 0);
              if (b.getTime() < Date.now()) { const n = new Date(Date.now() + 5 * 60000); b.setHours(n.getHours(), n.getMinutes(), 0, 0); }
              setWhenKey("pick"); setStart(localStamp(b));
            }} />
            {whenKey === "pick" && ok && <TimeSlots day={startDate} slots={busySlots} minutes={total} value={startDate} onPick={(a) => setStart(localStamp(a))} />}
            {ok && clashWith(busySlots, startDate, endDate) && <div role="alert" style={{ margin: "0 0 8px", padding: "9px 12px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#B91C1C", fontSize: 13.5, fontWeight: 700, lineHeight: 1.45 }}>{t("bc_clash")}</div>}

            <div style={head}><span style={num}>2</span>{t("bk_period")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {LENGTHS.map((m) => (
                <button key={m} onClick={() => { setCustom(false); setMins(m); }} style={pill(!custom && mins === m)}>{fmtLength(m, t)}</button>
              ))}
              <button onClick={() => setCustom(true)} style={pill(custom)}>{t("bk_custom")}</button>
            </div>
            {custom && (
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <input style={{ ...input, flex: 1 }} inputMode="numeric" maxLength={5} value={amount} placeholder={t("bk_amount")} aria-label={t("bk_amount")}
                       onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
                <select style={{ ...input, flex: 1 }} value={unit} onChange={(e) => setUnit(Number(e.target.value))}>
                  {UNITS.map(([k, v]) => <option key={k} value={v}>{t(k)}</option>)}
                </select>
              </div>
            )}

            <div style={head}><span style={num}>3</span>{t("bk_where")}</div>
            <PlaceField value={where} onChange={setWhere} sheetPlace={where || place} />

            <div style={head}><span style={num}>4</span>{t("bk_pay")}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...input, flex: 1 }} value={pay} inputMode="numeric" maxLength={7} placeholder={t("bk_pay")} aria-label={t("bk_pay")}
                     onChange={(e) => setPay(e.target.value.replace(/\D/g, ""))} />
            </div>
            {rates.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, margin: "10px 0 6px" }}>{t("rt_choose")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {rates.map((r) => (
                    <button key={r.id} onClick={() => setRate(rate && rate.id === r.id ? null : r)} aria-pressed={!!rate && rate.id === r.id} style={pill(!!rate && rate.id === r.id)}>
                      {r.label} · {rateText(r, t)}
                    </button>
                  ))}
                  <button onClick={() => setRate(null)} aria-pressed={!rate} style={pill(!rate)}>{t("rt_other")}</button>
                </div>
              </>
            )}


            {ok && (
              <div style={{ background: T.brandSoft, borderRadius: 12, padding: "10px 12px", margin: "16px 0 12px", fontSize: 13.5, color: T.ink, lineHeight: 1.6 }}>
                <b>{row.display_name}</b>{row.trade_name ? ` · ${row.trade_name}` : ""}<br />
                {fmtWhen(startDate)}{" \u2192 "}{fmtWhen(endDate)} · {fmtLength(total, t)}
                {pay ? <><br />{"\u20B9"}{pay}</> : null}
              </div>
            )}
            {msg && <div style={{ margin: "12px 0" }}><Notice tone="bad">{msg}</Notice></div>}
            <div style={{ marginTop: ok ? 0 : 16 }}>
              <Btn full disabled={busy || !ok} onClick={send}>{busy ? "\u2026" : t("bk_send")}</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- PARTNER
export function PartnerSheet({ api, signedIn, onSignIn, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, padding: "14px 18px 24px", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1 style={{ flex: 1, fontSize: 20, fontWeight: 800, margin: 0, color: T.ink }}>{t("pt_title")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        <p style={{ fontSize: 14.5, color: T.inkSoft, lineHeight: 1.6 }}>{t("pt_body")}</p>
        <ol style={{ paddingLeft: 20, fontSize: 14.5, color: T.ink, lineHeight: 1.8, margin: "0 0 14px" }}>
          <li>{t("pt_1")}</li><li>{t("pt_2")}</li><li>{t("pt_3")}</li>
        </ol>
        {signedIn ? <InvitePanel api={api} /> : <Btn full onClick={() => { onClose(); onSignIn && onSignIn(); }}>{t("nav_signin")}</Btn>}
        <p style={{ fontSize: 13, color: T.inkFaint, lineHeight: 1.6, marginTop: 14 }}>{t("pt_help")}</p>
      </div>
    </div>
  );
}

// FARES: the rate card, the admin's fare and payout calculator, and the
// delivery-fee suggestion a shop sees when it sends a rider. A trip costs
// max(minimum, base + per-km x km) and goes whole to the rider or driver. The
// customer pays that plus Dhundo's flat delivery fee and GST on that fee, so
// Dhundo takes no commission from the partner.
import React, { useState, useEffect, useMemo } from "react";
import { T, Btn, input } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const many = (r) => (Array.isArray(r) ? r : []);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
const GST_PERCENT = 18; // the only GST rate: 18%, on Dhundo's fee
const r2 = (n) => Math.round(n * 100) / 100;
const rs = (n) => `\u20b9${r2(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function calcFare(card, km) {
  if (!card) return null;
  const k = Math.max(0, num(km));
  const rider = Math.round(Math.max(num(card.min_rupees), num(card.base_rupees) + num(card.per_km_rupees) * k));
  const platform = Math.round(num(card.platform_rupees));
  const gst = r2(platform * GST_PERCENT / 100);
  // rider: what the partner earns, whole. The customer also pays Dhundo's
  // delivery fee and the GST on it.
  return { rider, platform, gst, customer: r2(rider + platform + gst), fare: rider, payout: rider };
}

// The card, loaded once per screen. Empty until it arrives or if the server
// does not have it yet, so callers must cope with an empty list.
export function useRateCard(api) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.rateCard ? api.rateCard() : []).then((r) => { if (alive) setRows(many(r)); }).catch(() => {});
    return () => { alive = false; };
  }, [api]);
  return rows;
}

// What a customer pays for a placed order, from the amounts saved on it.
export function orderBill(o) {
  const n = (v) => Number(v) || 0;
  const items = n(o.total_paise), gst = n(o.gst_paise);
  const delivery = n(o.delivery_fee_paise), dGst = n(o.delivery_gst_paise);
  const misc = n(o.misc_fee_paise), mGst = n(o.misc_gst_paise);
  return { items, gst, delivery, dGst, misc, mGst, total: items + gst + delivery + dGst + misc + mGst };
}

// Dhundo's registered details, for the bill. Empty until the admin saves them.
export function useBusinessInfo(api) {
  const [b, setB] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.businessInfo ? api.businessInfo() : null).then((r) => { const x = Array.isArray(r) ? r[0] : r; if (alive && x && x.gstin) setB(x); }).catch(() => {});
    return () => { alive = false; };
  }, [api]);
  return b;
}

// Which rate card row a driver's vehicle is priced from.
export const rateKeyFor = (slug) => (/deliver/i.test(slug) ? "delivery_food" : /bike|moto|scooter/i.test(slug) ? "ride_bike" : /auto|rick|toto/i.test(slug) ? "ride_auto" : /taxi|cab|\bcar\b/i.test(slug) ? "ride_taxi" : null);

// The only price a rider, cab, taxi, auto or delivery driver gives: a per-km
// range, inside the band the admin allows around the standard rate.
export function KmRateFields({ api, slug, min, max, onChange, style }) {
  const { t } = useI18n();
  const card = useRateCard(api);
  const row = card.find((c) => c.key === rateKeyFor(slug || ""));
  if (!row) return null;
  const band = row.band_pct == null ? 20 : row.band_pct;
  const lo = Math.ceil(row.per_km_rupees * (100 - band) / 100), hi = Math.floor(row.per_km_rupees * (100 + band) / 100);
  const box = { ...input, flex: 1, marginBottom: 0, minHeight: 52, fontSize: 16 };
  return (
    <div style={style}>
      <div style={{ display: "flex", gap: 9 }}>
        <input style={box} inputMode="numeric" maxLength={3} value={min} placeholder={`${t("w3_rate_from")} (${lo})`} aria-label={t("w3_rate_from")}
               onChange={(e) => onChange(e.target.value.replace(/\D/g, ""), max)} />
        <input style={box} inputMode="numeric" maxLength={3} value={max} placeholder={`${t("w3_rate_to")} (${hi})`} aria-label={t("w3_rate_to")}
               onChange={(e) => onChange(min, e.target.value.replace(/\D/g, ""))} />
      </div>
      <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.45, marginTop: 6 }}>{String(t("rs_km_allowed")).replace("{a}", lo).replace("{b}", hi).replace("{s}", row.per_km_rupees)}</div>
    </div>
  );
}

// The GST on what is bought from a restaurant or a shop, set by the admin.
export function useGstRates(api) {
  const [r, setR] = useState({ restaurant: 0, shop: 0 });
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.gstRates ? api.gstRates() : []).then((x) => { const o = { restaurant: 0, shop: 0 }; many(x).forEach((g) => { o[g.kind] = Number(g.percent) || 0; }); if (alive) setR(o); }).catch(() => {});
    return () => { alive = false; };
  }, [api]);
  return r;
}

// Size chips and a distance under a shop's "send a rider" box. Picking one
// fills the fee with the card's price; the shop can still change the number.
export function FeeHelper({ api, food, onPick }) {
  const { t } = useI18n();
  const card = useRateCard(api);
  const [key, setKey] = useState(food ? "delivery_food" : "delivery_small");
  const [km, setKm] = useState("3");
  const opts = (food ? ["delivery_food"] : ["delivery_small", "delivery_medium", "delivery_heavy"]);
  const names = { delivery_food: "fr_food", delivery_small: "fr_small", delivery_medium: "fr_medium", delivery_heavy: "fr_heavy" };
  const row = card.find((c) => c.key === key);
  const q = row ? calcFare(row, km) : null;
  useEffect(() => { if (q) onPick(q.rider); }, [key, km, card.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!row) return null;
  return (
    <div style={{ margin: "0 0 8px" }}>
      {!food && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {opts.map((o) => (
            <button key={o} onClick={() => setKey(o)} aria-pressed={key === o}
                    style={{ minHeight: 38, padding: "0 12px", borderRadius: 19, fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${key === o ? T.brandDark : "#D1D5DB"}`, background: key === o ? "#EAF2FF" : "#fff", color: T.ink }}>{t(names[o])}</button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: T.inkSoft, fontWeight: 700 }}>
        <span>{t("fr_km")}</span>
        <input style={{ ...input, width: 70, minHeight: 38, marginBottom: 0, padding: "6px 10px" }} inputMode="decimal" maxLength={4} value={km}
               onChange={(e) => setKm(e.target.value.replace(/[^\d.]/g, ""))} aria-label={t("fr_km")} />
        {q && <span>{String(t("fr_suggest")).replace("{n}", q.rider)}</span>}
      </div>
    </div>
  );
}

const cell = { ...input, minHeight: 40, marginBottom: 0, padding: "6px 8px", width: "100%", boxSizing: "border-box" };
const lbl = { fontSize: 12, fontWeight: 800, color: T.inkSoft, marginBottom: 3 };

function RateRow({ api, row, onSaved }) {
  const [f, setF] = useState({ base: String(row.base_rupees), perKm: String(row.per_km_rupees), min: String(row.min_rupees), platform: String(row.platform_rupees), band: String(row.band_pct == null ? 20 : row.band_pct), max: String(row.max_rupees == null ? 100 : row.max_rupees) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k, v) => { setMsg(""); setF((p) => ({ ...p, [k]: v.replace(/\D/g, "") })); };
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api.rateSet(row.key, num(f.base), num(f.perKm), num(f.min), num(f.platform), GST_PERCENT);
      const x = Array.isArray(r) ? r[0] : r;
      if (x && x.ok === false) throw new Error("no");
      if (row.key.startsWith("delivery_") && api.rateSetMax) {
        const r2 = await api.rateSetMax(row.key, num(f.max));
        const y = Array.isArray(r2) ? r2[0] : r2;
        if (y && y.ok === false) throw new Error("no");
      }
      if (row.key.startsWith("ride_") && api.rateSetBand) {
        const r3 = await api.rateSetBand(row.key, num(f.band));
        const z = Array.isArray(r3) ? r3[0] : r3;
        if (z && z.ok === false) throw new Error("no");
      }
      setMsg("Saved"); onSaved();
    } catch (_) { setMsg("Could not save"); }
    setBusy(false);
  };
  return (
    <div style={{ padding: "12px 0", borderTop: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{row.label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
        {[["base", "Rider base \u20b9"], ["perKm", "Rider per km \u20b9"], ["min", row.key.startsWith("delivery_") ? "Partner fee minimum \u20b9" : "Rider minimum \u20b9"], ["platform", "Delivery fee \u20b9"]].concat(row.key.startsWith("delivery_") ? [["max", "Partner fee maximum \u20b9"]] : []).concat(row.key.startsWith("ride_") ? [["band", "Driver can move rate \u00B1 %"]] : []).map(([k, l]) => (
          <div key={k}><div style={lbl}>{l}</div><input style={cell} inputMode="numeric" maxLength={4} value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <Btn onClick={save} disabled={busy}>{busy ? "…" : "Save"}</Btn>
        {msg && <span role="status" style={{ fontSize: 13.5, fontWeight: 700, color: msg === "Saved" ? "#157A43" : "#B91C1C" }}>{msg}</span>}
      </div>
    </div>
  );
}

// Admin: edit the card, and see what a day of trips earns and pays out.
export function FareCalculator({ api }) {
  const [card, setCard] = useState([]);
  const [tick, setTick] = useState(0);
  const [km, setKm] = useState("5");
  const [trips, setTrips] = useState({});
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.rateCard()).then((r) => { if (alive) setCard(many(r)); }).catch(() => { if (alive) setCard([]); });
    return () => { alive = false; };
  }, [api, tick]);
  const rows = useMemo(() => card.map((c) => {
    const n = trips[c.key] === undefined ? 20 : num(trips[c.key]);
    const q = calcFare(c, km);
    return { c, n, q, rev: q.platform * n, pay: q.rider * n, gst: q.gst * n, bill: q.customer * n };
  }), [card, km, trips]);
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, margin: "0 0 20px" }}>
      <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 4px" }}>Fare and payout calculator</h2>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 12 }}>The rider or driver earns the larger of the minimum and (base + per km x distance), in full: no commission is taken from them. The customer pays that plus Dhundo's delivery fee and 18% GST on that fee. Dhundo keeps the delivery fee; the GST is collected for the government. Shops use these rates to suggest a delivery fee, and the rider only ever sees what he earns.</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ width: 200 }}>
          <div style={lbl}>Average distance per trip (km)</div>
          <input style={cell} inputMode="decimal" maxLength={4} value={km} onChange={(e) => setKm(e.target.value.replace(/[^\d.]/g, ""))} />
        </div>
        <div style={{ width: 200 }}>
          <div style={lbl}>Average order value (₹)</div>
          <input style={cell} inputMode="numeric" maxLength={6} value={ov} onChange={(e) => setOv(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 900 }}>
          <thead><tr style={{ textAlign: "left", color: T.inkSoft }}>
            {["Service", "Trips / day", "Rider earns", "Delivery fee", "GST", "Customer pays", "Delivery fees / day", "Rider payouts / day", "GST / day"].map((h) => <th key={h} style={{ padding: "6px 6px", fontWeight: 800 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(({ c, n, q, rev, pay, gst }) => (
              <tr key={c.key} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ padding: "8px 6px", fontWeight: 700 }}>{c.label}</td>
                <td style={{ padding: "8px 6px", width: 90 }}><input style={cell} inputMode="numeric" maxLength={5} value={trips[c.key] === undefined ? "20" : trips[c.key]} onChange={(e) => setTrips((p) => ({ ...p, [c.key]: e.target.value.replace(/\D/g, "") }))} /></td>
                <td style={{ padding: "8px 6px" }}>{rs(q.rider)}</td>
                <td style={{ padding: "8px 6px" }}>{rs(q.platform)}</td>
                <td style={{ padding: "8px 6px" }}>{rs(q.gst)}</td>
                <td style={{ padding: "8px 6px", fontWeight: 800 }}>{rs(q.customer)}</td>
                <td style={{ padding: "8px 6px", fontWeight: 800, color: "#157A43" }}>{rs(rev)}</td>
                <td style={{ padding: "8px 6px", fontWeight: 800 }}>{rs(pay)}</td>
                <td style={{ padding: "8px 6px" }}>{rs(gst)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{ borderTop: `2px solid ${T.ink}`, fontWeight: 800 }}>
            <td style={{ padding: "8px 6px" }} colSpan={5}>Total per day (customers pay {rs(sum("bill"))})</td>
            <td style={{ padding: "8px 6px", color: "#157A43" }}>{rs(sum("rev"))}</td>
            <td style={{ padding: "8px 6px" }}>{rs(sum("pay"))}</td>
            <td style={{ padding: "8px 6px" }}>{rs(sum("gst"))}</td>
          </tr></tfoot>
        </table>
      </div>
      <BusinessEditor api={api} />
      <GstRatesEditor api={api} />
      <GstReport api={api} />
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "18px 0 0" }}>Rate card</h3>
      {card.map((c) => <RateRow key={c.key + c.base_rupees + c.per_km_rupees + c.min_rupees + c.platform_rupees + "b" + c.band_pct + "x" + c.max_rupees } api={api} row={c} onSaved={() => setTick((n) => n + 1)} />)}
    </div>
  );
}

// GST that appears on the customer's bill for restaurant food and shop goods.
function GstRatesEditor({ api }) {
  const [v, setV] = useState({ restaurant: "", shop: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.gstRates()).then((x) => { const o = { restaurant: "", shop: "" }; many(x).forEach((g) => { o[g.kind] = String(Number(g.percent)); }); if (alive) setV(o); }).catch(() => {});
    return () => { alive = false; };
  }, [api]);
  const save = async () => {
    setMsg("");
    try {
      for (const k of ["restaurant", "shop"]) {
        const r = await api.gstSet(k, num(v[k]));
        const x = Array.isArray(r) ? r[0] : r;
        if (x && x.ok === false) throw new Error("no");
      }
      setMsg("Saved");
    } catch (_) { setMsg("Could not save"); }
  };
  return (
    <div style={{ margin: "18px 0 0", padding: "12px 0", borderTop: `1px solid ${T.line}` }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>GST on food and goods</h3>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 8 }}>Added to the customer's bill for items bought from a restaurant or a shop. Charged to the customer only.</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[["restaurant", "Restaurants %"], ["shop", "Shops %"]].map(([k, l]) => (
          <div key={k} style={{ width: 150 }}><div style={lbl}>{l}</div>
            <input style={cell} inputMode="decimal" maxLength={4} value={v[k]} onChange={(e) => { setMsg(""); setV((p) => ({ ...p, [k]: e.target.value.replace(/[^\d.]/g, "") })); }} /></div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <Btn onClick={save}>Save</Btn>
        {msg && <span role="status" style={{ fontSize: 13.5, fontWeight: 700, color: msg === "Saved" ? "#157A43" : "#B91C1C" }}>{msg}</span>}
      </div>
    </div>
  );
}

// Admin: GST and fee totals on delivered orders, by month, for the accountant.
function GstReport({ api }) {
  const [rows, setRows] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [err, setErr] = useState("");
  const load = () => {
    setErr("");
    Promise.resolve(api.gstReport(from || null, to || null)).then((r) => setRows(many(r))).catch(() => { setRows([]); setErr("Could not load"); });
  };
  const rup = (p) => Math.round(Number(p || 0)) / 100;
  const csv = () => {
    const head = ["Month", "Orders", "Items", "GST on food", "GST on goods", "Delivery partner fee", "GST on delivery partner fee", "Delivery fee", "GST on delivery fee"];
    const out = [head].concat((rows || []).map((r) => [r.month, r.orders, rup(r.items_paise), rup(r.items_gst_restaurant_paise), rup(r.items_gst_shop_paise), rup(r.delivery_paise), rup(r.delivery_gst_paise), rup(r.misc_fee_paise), rup(r.misc_gst_paise)]));
    const text = out.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" })); a.download = "dhundo-gst-report.csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  return (
    <div style={{ margin: "18px 0 0", padding: "12px 0", borderTop: `1px solid ${T.line}` }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>GST report for your accountant</h3>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 8 }}>Totals on delivered orders, month by month. Keep these for your GST returns.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><div style={lbl}>From</div><input type="date" style={{ ...cell, width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><div style={lbl}>To</div><input type="date" style={{ ...cell, width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Btn onClick={load}>Show</Btn>
        {rows && rows.length > 0 && <Btn kind="ghost" onClick={csv}>Download CSV</Btn>}
      </div>
      {err && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, marginTop: 8 }}>{err}</div>}
      {rows && rows.length === 0 && !err && <div style={{ marginTop: 8, fontSize: 14, color: T.inkSoft }}>No delivered orders in this range.</div>}
      {rows && rows.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 760 }}>
            <thead><tr style={{ textAlign: "left", color: T.inkSoft }}>{["Month", "Orders", "Items", "GST food", "GST goods", "Delivery", "GST delivery", "Delivery fee", "GST misc."].map((h) => <th key={h} style={{ padding: "6px", fontWeight: 800 }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.month} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ padding: "7px 6px", fontWeight: 700 }}>{r.month}</td><td style={{ padding: "7px 6px" }}>{r.orders}</td>
                {[r.items_paise, r.items_gst_restaurant_paise, r.items_gst_shop_paise, r.delivery_paise, r.delivery_gst_paise, r.misc_fee_paise, r.misc_gst_paise].map((v, i) => <td key={i} style={{ padding: "7px 6px" }}>{rs(rup(v))}</td>)}
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const SAMPLE = { legal_name: "Sample Business Pvt Ltd", gstin: "22AAAAA0000A1Z5", address: "Sample address, Agartala, Tripura" };

// Admin: Dhundo's registered name, GSTIN and address. Customers see them on
// their bill once a GSTIN is saved. The preview uses an obvious sample.
function BusinessEditor({ api }) {
  const [f, setF] = useState({ name: "", gstin: "", address: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.businessInfo()).then((r) => { const x = Array.isArray(r) ? r[0] : r; if (alive && x) setF({ name: x.legal_name || "", gstin: x.gstin || "", address: x.address || "" }); }).catch(() => {});
    return () => { alive = false; };
  }, [api]);
  const set = (k, v) => { setMsg(""); setF((p) => ({ ...p, [k]: v })); };
  const save = async () => {
    setMsg("");
    try {
      const r = await api.businessInfoSet(f.name, f.gstin.trim().toUpperCase(), f.address);
      const x = Array.isArray(r) ? r[0] : r;
      if (x && x.reason === "bad_gstin") return setMsg("That GSTIN is not in the right format (15 characters, like 22AAAAA0000A1Z5).");
      if (x && x.ok === false) throw new Error("no");
      setMsg("Saved");
    } catch (_) { setMsg("Could not save"); }
  };
  const shown = f.gstin.trim() ? { legal_name: f.name, gstin: f.gstin.trim().toUpperCase(), address: f.address } : null;
  const p = shown || SAMPLE;
  return (
    <div style={{ margin: "18px 0 0", padding: "12px 0", borderTop: `1px solid ${T.line}` }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>Business details for the bill</h3>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 8 }}>Enter your registered name, GSTIN and address. Customers see them on their bill. Nothing is shown until you save a GSTIN.</div>
      <div style={lbl}>Registered business name</div>
      <input style={{ ...cell, marginBottom: 8 }} maxLength={120} value={f.name} onChange={(e) => set("name", e.target.value)} />
      <div style={lbl}>GSTIN</div>
      <input style={{ ...cell, marginBottom: 8 }} maxLength={15} value={f.gstin} placeholder="22AAAAA0000A1Z5" onChange={(e) => set("gstin", e.target.value.toUpperCase())} />
      <div style={lbl}>Registered address</div>
      <input style={{ ...cell, marginBottom: 8 }} maxLength={300} value={f.address} onChange={(e) => set("address", e.target.value)} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Btn onClick={save}>Save</Btn>
        {msg && <span role="status" style={{ fontSize: 13.5, fontWeight: 700, color: msg === "Saved" ? "#157A43" : "#B91C1C" }}>{msg}</span>}
      </div>
      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "#F7F8FA", fontSize: 13.5 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.inkSoft, marginBottom: 4 }}>{shown ? "How customers will see it" : "PREVIEW WITH A SAMPLE (not real, not shown to customers)"}</div>
        <div style={{ fontWeight: 800 }}>{p.legal_name || "Dhundo"}</div>
        <div>GSTIN: {p.gstin}</div>
        {p.address && <div style={{ color: T.inkSoft }}>{p.address}</div>}
      </div>
    </div>
  );
}

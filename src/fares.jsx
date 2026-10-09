// FARES: the rate card, the admin's fare and payout calculator, and the
// delivery-fee suggestion a shop sees when it sends a rider. A trip costs
// max(minimum, base + per-km x km) and goes whole to the rider or driver. The
// customer pays that plus Dhundo's flat platform fee and GST on that fee, so
// Dhundo takes no commission from the partner.
import React, { useState, useEffect, useMemo } from "react";
import { T, Btn, input } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const many = (r) => (Array.isArray(r) ? r : []);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
const rs = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function calcFare(card, km) {
  if (!card) return null;
  const k = Math.max(0, num(km));
  const rider = Math.round(Math.max(num(card.min_rupees), num(card.base_rupees) + num(card.per_km_rupees) * k));
  const platform = Math.round(num(card.platform_rupees));
  const gst = Math.round(platform * num(card.gst_percent) / 100);
  // rider: what the partner earns, whole. The customer also pays Dhundo's
  // platform fee and the GST on it.
  return { rider, platform, gst, customer: rider + platform + gst, fare: rider, payout: rider };
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
      {q && q.platform + q.gst > 0 && (
        <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
          {String(t("fr_bill")).replace("{c}", q.customer).replace("{p}", q.platform).replace("{g}", q.gst)}
        </div>
      )}
    </div>
  );
}

const cell = { ...input, minHeight: 40, marginBottom: 0, padding: "6px 8px", width: "100%", boxSizing: "border-box" };
const lbl = { fontSize: 12, fontWeight: 800, color: T.inkSoft, marginBottom: 3 };

function RateRow({ api, row, onSaved }) {
  const [f, setF] = useState({ base: String(row.base_rupees), perKm: String(row.per_km_rupees), min: String(row.min_rupees), platform: String(row.platform_rupees), gst: String(row.gst_percent) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k, v) => { setMsg(""); setF((p) => ({ ...p, [k]: v.replace(/\D/g, "") })); };
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api.rateSet(row.key, num(f.base), num(f.perKm), num(f.min), num(f.platform), num(f.gst));
      const x = Array.isArray(r) ? r[0] : r;
      if (x && x.ok === false) throw new Error("no");
      setMsg("Saved"); onSaved();
    } catch (_) { setMsg("Could not save"); }
    setBusy(false);
  };
  return (
    <div style={{ padding: "12px 0", borderTop: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{row.label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
        {[["base", "Rider base \u20b9"], ["perKm", "Rider per km \u20b9"], ["min", "Rider minimum \u20b9"], ["platform", "Platform fee \u20b9"], ["gst", "GST % on fee"]].map(([k, l]) => (
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
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 12 }}>The rider or driver earns the larger of the minimum and (base + per km x distance), in full: no commission is taken from them. The customer pays that plus Dhundo\'s platform fee and GST on that fee. Dhundo keeps the platform fee; the GST is collected for the government. Shops use these rates to suggest a delivery fee, and the rider only ever sees what he earns.</div>
      <div style={{ maxWidth: 200, marginBottom: 12 }}>
        <div style={lbl}>Average distance per trip (km)</div>
        <input style={cell} inputMode="decimal" maxLength={4} value={km} onChange={(e) => setKm(e.target.value.replace(/[^\d.]/g, ""))} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 760 }}>
          <thead><tr style={{ textAlign: "left", color: T.inkSoft }}>
            {["Service", "Trips / day", "Rider earns", "Platform fee", "GST", "Customer pays", "Dhundo revenue / day", "Rider payouts / day", "GST / day"].map((h) => <th key={h} style={{ padding: "6px 6px", fontWeight: 800 }}>{h}</th>)}
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
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "18px 0 0" }}>Rate card</h3>
      {card.map((c) => <RateRow key={c.key + c.base_rupees + c.per_km_rupees + c.min_rupees + c.platform_rupees + "g" + c.gst_percent} api={api} row={c} onSaved={() => setTick((n) => n + 1)} />)}
    </div>
  );
}

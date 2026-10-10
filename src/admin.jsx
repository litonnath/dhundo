// ADMIN CONSOLE: one place for the admin to see everything. Tabs: overview
// numbers, partners, orders, rides, people, money, fares and taxes, ads and
// items, security. Partners, money, ads and security are existing panels
// passed in; the rest are read-only lists loaded here.
import React, { useState, useEffect, useCallback } from "react";
import { T, Btn, input } from "./ui.jsx";
import { FareCalculator } from "./fares.jsx";

const many = (r) => (Array.isArray(r) ? r : []);
const rs = (p) => `₹${(Number(p || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (d) => (d ? new Date(d).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const card = { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 14 };
const th = { padding: "7px 8px", fontWeight: 800, textAlign: "left", color: T.inkSoft, whiteSpace: "nowrap" };
const td = { padding: "8px 8px", borderTop: `1px solid ${T.line}`, verticalAlign: "top" };

const TABS = [["overview", "Overview"], ["partners", "Partners"], ["orders", "Orders"], ["rides", "Rides"], ["people", "People"], ["money", "Money"], ["fares", "Fares & tax"], ["ads", "Ads & items"], ["security", "Security"]];

export function AdminConsole({ api, panels }) {
  const [tab, setTab] = useState("overview");
  return (
    <div>
      <div role="tablist" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 14 }}>
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  style={{ flexShrink: 0, minHeight: 42, padding: "0 16px", borderRadius: 21, fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${tab === k ? T.brandDark : "#D1D5DB"}`, background: tab === k ? T.brandDark : "#fff", color: tab === k ? "#fff" : T.ink }}>{label}</button>
        ))}
      </div>
      {tab === "overview" && <Overview api={api} go={setTab} />}
      {tab === "partners" && panels.partners}
      {tab === "orders" && <Orders api={api} />}
      {tab === "rides" && <Rides api={api} />}
      {tab === "people" && <People api={api} />}
      {tab === "money" && panels.money}
      {tab === "fares" && <FareCalculator api={api} />}
      {tab === "ads" && panels.ads}
      {tab === "security" && panels.security}
    </div>
  );
}

// A list that loads once, can be reloaded, and says so when it fails.
function useList(fetcher, deps) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    setErr("");
    Promise.resolve(fetcher()).then((r) => setRows(many(r))).catch(() => { setRows([]); setErr("Could not load. Run the latest SQL files in Supabase."); });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return [rows, err, load];
}

function Overview({ api, go }) {
  const [rows, err, load] = useList(() => api.adminOverview(), [api]);
  const o = rows && rows[0];
  const tiles = o ? [
    ["People", o.users, "people"], ["Live partners", o.partners_live, "partners"], ["Waiting for approval", o.partners_pending, "partners"],
    ["Orders today", o.orders_today, "orders"], ["Orders in progress", o.orders_active, "orders"], ["Orders, 30 days", o.orders_30d, "orders"],
    ["Sales, 30 days", rs(o.sales_30d_paise), "orders"], ["Rides today", o.rides_today, "rides"], ["Rides, 30 days", o.rides_30d, "rides"],
    ["Delivery jobs open", o.jobs_open, "orders"], ["Withdrawals waiting", o.withdrawals_pending, "money"],
    ["Misc. fees, 30 days", rs(o.misc_fee_30d_paise), "fares"], ["GST charged, 30 days", rs(o.gst_30d_paise), "fares"],
  ] : [];
  return (
    <div>
      {err && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 10 }}>{err}</div>}
      {rows === null && <div style={{ height: 120 }} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
        {tiles.map(([label, v, to]) => (
          <button key={label} onClick={() => go(to)} style={{ ...card, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.ink }}>{v}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.inkSoft, marginTop: 2 }}>{label}</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}><Btn kind="ghost" onClick={load}>Refresh</Btn></div>
    </div>
  );
}

function Filter({ value, onChange, options }) {
  return (
    <select style={{ ...input, width: "auto", minHeight: 42, marginBottom: 0 }} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Status">
      <option value="">All</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Table({ head, rows, empty }) {
  if (rows === null) return <div style={{ height: 120 }} />;
  if (rows.length === 0) return <div style={{ ...card, color: T.inkSoft, fontSize: 14 }}>{empty}</div>;
  return (
    <div style={{ ...card, padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 900 }}>
        <thead><tr>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={td}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Orders({ api }) {
  const [st, setSt] = useState("");
  const [rows, err, load] = useList(() => api.adminOrders(st || null), [api, st]);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Filter value={st} onChange={setSt} options={["placed", "confirmed", "quoted", "accepted", "ready", "delivered", "rejected", "cancelled"]} />
        <Btn kind="ghost" onClick={load}>Refresh</Btn>
      </div>
      {err && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 8 }}>{err}</div>}
      <Table head={["When", "Shop", "Customer", "Type", "Status", "Paid", "Customer pays", "Shop gets", "Rider gets", "Dhundo gets", "GST"]} empty="No orders."
             rows={rows && rows.map((o) => [when(o.created_at), o.shop, <span key="c">{o.customer}<br /><span style={{ color: T.inkSoft }}>{o.customer_phone}</span></span>, o.mode, o.status, o.paid ? `Paid \u00B7 ${o.pay_method === "upi" ? "UPI" : "cash"}` : `Unpaid \u00B7 ${o.pay_method === "upi" ? "UPI" : "cash"}`, rs(Number(o.total_paise) + Number(o.charges_paise)), rs(o.shop_gets_paise), rs(o.rider_gets_paise), rs(o.platform_gets_paise), rs(o.gst_paise)])} />
    </div>
  );
}

function Rides({ api }) {
  const [st, setSt] = useState("");
  const [rows, err, load] = useList(() => api.adminRides(st || null), [api, st]);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Filter value={st} onChange={setSt} options={["open", "accepted", "done", "cancelled", "expired"]} />
        <Btn kind="ghost" onClick={load}>Refresh</Btn>
      </div>
      {err && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 8 }}>{err}</div>}
      <Table head={["When", "Passenger", "Driver", "Vehicle", "From", "To", "Fare", "Status"]} empty="No rides."
             rows={rows && rows.map((r) => [when(r.created_at), r.passenger, r.driver || "—", r.vehicle, r.pick_text, r.drop_text, r.fare_paise == null ? "—" : rs(r.fare_paise), r.status])} />
    </div>
  );
}

function People({ api }) {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [rows, err] = useList(() => api.adminPeople(applied || null), [api, applied]);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input style={{ ...input, flex: 1, minHeight: 42, marginBottom: 0 }} placeholder="Search name or phone" value={q} maxLength={40}
               onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setApplied(q.trim()); }} />
        <Btn onClick={() => setApplied(q.trim())}>Search</Btn>
      </div>
      {err && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 8 }}>{err}</div>}
      <Table head={["Name", "Phone", "Joined", "Listings", "Orders", "Rides"]} empty="Nobody found."
             rows={rows && rows.map((p) => [p.full_name, p.phone, p.joined ? when(p.joined) : "—", p.listings, p.orders, p.rides])} />
    </div>
  );
}

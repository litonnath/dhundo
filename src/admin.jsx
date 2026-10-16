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
const lbl = { fontSize: 12, fontWeight: 800, color: T.inkSoft, marginBottom: 3 };
const cell = { ...input, minHeight: 40, marginBottom: 0, padding: "6px 8px", width: "100%", boxSizing: "border-box" };
const td = { padding: "8px 8px", borderTop: `1px solid ${T.line}`, verticalAlign: "top" };

const TABS = [["overview", "Overview"], ["partners", "Partners"], ["quality", "Quality"], ["reports", "Reports"], ["support", "Support"], ["orders", "Orders"], ["rides", "Rides"], ["people", "People"], ["money", "Money"], ["payments", "Payments"], ["fares", "Fares & tax"], ["ads", "Ads & items"], ["security", "Security"]];

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
      {tab === "quality" && <Quality api={api} />}
      {tab === "reports" && <Reports api={api} />}
      {tab === "support" && <Support api={api} />}
      {tab === "orders" && <Orders api={api} />}
      {tab === "rides" && <Rides api={api} />}
      {tab === "people" && <People api={api} />}
      {tab === "money" && panels.money}
      {tab === "payments" && <Payments api={api} />}
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
    ["Delivery fees, 30 days", rs(o.misc_fee_30d_paise), "fares"], ["GST charged, 30 days", rs(o.gst_30d_paise), "fares"],
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
      <Table head={["When", "Shop", "Customer", "Type", "Status", "Paid", "Customer pays", "Shop gets", "Rider gets", "Delivery fee", "GST"]} empty="No orders."
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

const stars = (n) => `\u2605 ${Number(n).toFixed(1)}`;

// Who is rated badly, and every rating and complaint. A partner with 3 or more
// ratings averaging under 3.5, or 2 or more complaints, is flagged; the admin
// can hide it until it has been looked at, and bring it back.
// Refund a person who raised an issue: into their wallet at once, or to their
// UPI id (you pay it, then mark it paid in the list below). Admin only.
function RefundBox({ api, accountId, ticketId = null, payment = null, name = "", onDone }) {
  const left = payment ? Math.max(0, Math.floor((Number(payment.amount_paise) - Number(payment.refunded_paise || 0)) / 100)) : 0;
  const [amt, setAmt] = useState(left ? String(left) : "");
  const [dest, setDest] = useState("wallet");
  const [upi, setUpi] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const send = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api.adminRefund({ account: accountId, rupees: Number(amt), dest, reason: why, payment: payment && payment.id, ticket: ticketId, upi });
      const x = Array.isArray(r) ? r[0] : r;
      if (x && x.ok) { setMsg("Refund recorded."); setWhy(""); onDone && onDone(); }
      else setMsg({ bad_amount: "Enter an amount from \u20B91 to \u20B950,000.", over_payment: "That is more than was paid on this payment.", bad_upi: "That UPI id does not look right.", bad_input: "Give a reason (a few words).", no_account: "Person not found." }[x && x.reason] || "Could not refund.");
    } catch (_) { setMsg("Could not refund. Run the latest SQL (221)."); }
    setBusy(false);
  };
  return (
    <div style={{ ...card, border: "1.5px solid #F59E0B", background: "#FFFBF0" }}>
      <div style={{ fontSize: 15.5, fontWeight: 800 }}>Refund {name || "this person"}{payment ? ` \u00B7 payment of ${rs(payment.amount_paise)}` : ""}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        <div style={{ width: 130 }}><div style={lbl}>Amount (\u20B9)</div><input style={cell} inputMode="numeric" maxLength={6} value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} /></div>
        <div style={{ flex: "1 1 200px" }}>
          <div style={lbl}>Refund to</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["wallet", "DhundoNow wallet (instant)"], ["upi", "Their UPI id"]].map(([k, l]) => (
              <button key={k} onClick={() => setDest(k)} aria-pressed={dest === k} style={{ flex: 1, minHeight: 40, borderRadius: 10, fontFamily: "inherit", fontWeight: 800, fontSize: 13.5, cursor: "pointer", border: `1.5px solid ${dest === k ? T.brandDark : T.line}`, background: dest === k ? T.brandDark : "#fff", color: dest === k ? "#fff" : T.ink }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      {dest === "upi" && <div style={{ marginBottom: 8 }}><div style={lbl}>Their UPI id (ask them in the chat)</div><input style={cell} value={upi} maxLength={64} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" /></div>}
      <div style={{ marginBottom: 8 }}><div style={lbl}>Reason (kept on record)</div><input style={cell} value={why} maxLength={200} onChange={(e) => setWhy(e.target.value)} placeholder="For example: order not delivered" /></div>
      <Btn disabled={busy || !(Number(amt) > 0) || why.trim().length < 3} onClick={send}>{busy ? "\u2026" : "Refund"}</Btn>
      {msg && <span role="status" style={{ marginLeft: 10, fontWeight: 700, fontSize: 13.5, color: msg === "Refund recorded." ? "#157A43" : "#B91C1C" }}>{msg}</span>}
    </div>
  );
}

// Every online payment (PayU): who, what for, how much, and whether PayU confirmed it.
function Payments({ api }) {
  const [rows, err, load] = useList(() => api.adminPayments(), [api]);
  const [refunds, , reloadRefunds] = useList(() => api.adminRefundsList("to_pay"), [api]);
  const [refunding, setRefunding] = useState(null);
  const [reqs, , reloadReqs] = useList(() => api.adminRefundRequests("pending"), [api]);
  const paid = (rows || []).filter((r) => r.status === "paid");
  const sum = (a) => a.reduce((n, r) => n + Number(r.amount_paise || 0), 0);
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const today = paid.filter((r) => r.paid_at && new Date(r.paid_at) >= day);
  const when = (iso) => (iso ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "\u2014");
  const label = { order: "Order", ride: "Ride", item: "Item", booking: "Booking", topup: "Wallet top-up" };
  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>Online payments</h2>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 10 }}>Payments through PayU. A payment shows Paid once PayU has confirmed it to our server. "Created" means the person was sent to PayU but we have not heard back (they may have closed the page).</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ ...card, flex: "1 1 160px", margin: 0 }}><div style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 700 }}>Paid today</div><div style={{ fontSize: 22, fontWeight: 800 }}>{rs(sum(today))}</div></div>
        <div style={{ ...card, flex: "1 1 160px", margin: 0 }}><div style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 700 }}>Paid (last 200)</div><div style={{ fontSize: 22, fontWeight: 800 }}>{rs(sum(paid))}</div></div>
        <div style={{ ...card, flex: "1 1 160px", margin: 0 }}><div style={{ fontSize: 12.5, color: "#B91C1C", fontWeight: 700 }}>Needs refund</div><div style={{ fontSize: 22, fontWeight: 800 }}>{(rows || []).filter((r) => r.issue && !r.refunded_at).length}</div></div>
        <div style={{ ...card, flex: "1 1 160px", margin: 0 }}><div style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 700 }}>Waiting for PayU</div><div style={{ fontSize: 22, fontWeight: 800 }}>{(rows || []).filter((r) => r.status === "created").length}</div></div>
      </div>
      {err && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 8 }}>{err}</div>}
      <div style={{ marginBottom: 8 }}><Btn kind="ghost" onClick={load}>Refresh</Btn></div>
      {refunding && <RefundBox api={api} accountId={refunding.account_id} payment={refunding} name={refunding.name} onDone={() => { setRefunding(null); load(); reloadRefunds(); }} />}
      <Table head={["When", "Person", "For", "Amount", "Status", "PayU id", ""]} empty="No online payments yet."
             rows={rows && rows.map((r) => [
               when(r.created_at),
               <span key="p"><b>{r.name || "\u2014"}</b>{r.phone ? <><br />{r.phone}</> : null}</span>,
               label[r.purpose] || r.purpose,
               <b key="a">{rs(r.amount_paise)}</b>,
               <span key="s" style={{ fontWeight: 800, color: r.refunded_at ? "#B45309" : r.status === "paid" ? "#157A43" : T.inkSoft }}>{r.refunded_at ? "Refunded" : r.status === "paid" ? "Paid " + when(r.paid_at) : r.status}{r.issue && !r.refunded_at ? <><br /><span style={{ color: "#B91C1C" }}>Needs refund: {r.issue}</span></> : null}</span>,
               <span key="g" style={{ fontSize: 12, color: T.inkSoft, overflowWrap: "anywhere" }}>{r.gateway_id || r.txn}</span>,
               r.status === "paid" && !r.refunded_at ? <Btn key="rf" kind="ghost" onClick={() => setRefunding(r)}>Refund</Btn> : null,
             ])} />
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "18px 0 6px" }}>Refund requests to approve</h3>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 8 }}>A cancelled or unfinished paid order, ride, booking or item waits here. Nothing is refunded until you approve it. Approving sends the money to the person's wallet and takes back any partner earning. Rejecting keeps the money with DhundoNow.</div>
      <Table head={["When", "Person", "For", "Amount", "Why", ""]} empty="No refund requests."
             rows={reqs && reqs.map((r) => [
               when(r.created_at), <span key="p"><b>{r.name || "\u2014"}</b>{r.phone ? <><br />{r.phone}</> : null}</span>, label[r.purpose] || r.purpose,
               <b key="a">{rs(r.amount_paise)}</b>, r.reason || "\u2014",
               <span key="b" style={{ display: "flex", gap: 6 }}>
                 <Btn kind="ghost" onClick={async () => { try { await api.adminRefundDecide(r.id, true); } catch (_) {} reloadReqs(); load(); }}>Approve</Btn>
                 <Btn kind="ghost" onClick={async () => { try { await api.adminRefundDecide(r.id, false); } catch (_) {} reloadReqs(); }}>Reject</Btn>
               </span>,
             ])} />
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "18px 0 6px" }}>Refunds to pay out</h3>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 8 }}>Refunds sent to a UPI id. Pay each one from your UPI or bank app, then mark it paid. Refunds to the wallet are already done.</div>
      <Table head={["When", "Person", "Amount", "UPI id", "Reason", ""]} empty="Nothing waiting."
             rows={refunds && refunds.map((r) => [
               when(r.created_at), <span key="p"><b>{r.name || "\u2014"}</b>{r.phone ? <><br />{r.phone}</> : null}</span>, <b key="a">{rs(r.amount_paise)}</b>,
               r.upi_id || "\u2014", r.reason,
               <Btn key="m" kind="ghost" onClick={async () => { try { await api.adminRefundPaid(r.id); } catch (_) {} reloadRefunds(); }}>Mark paid</Btn>,
             ])} />
    </div>
  );
}

// Live support: customers and partners write from the Help button; answer here.
function Support({ api }) {
  const [status, setStatus] = useState("open");
  const [rows, err, load] = useList(() => api.adminSupportList(status), [api, status]);
  const [sel, setSel] = useState(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const id = setInterval(load, 10000); return () => clearInterval(id); }, [load]);
  const loadThread = useCallback(async (id) => { try { setMsgs(many(await api.adminSupportThread(id))); } catch (_) {} }, [api]);
  useEffect(() => {
    if (!sel) return undefined;
    loadThread(sel.id);
    const id = setInterval(() => loadThread(sel.id), 5000);
    return () => clearInterval(id);
  }, [sel, loadThread]);
  const reply = async () => {
    if (!text.trim() || !sel) return;
    setBusy(true);
    try { await api.adminSupportReply(sel.id, text.trim()); setText(""); await loadThread(sel.id); load(); } catch (_) {}
    setBusy(false);
  };
  const setTicketStatus = async (st) => { try { await api.adminSupportStatus(sel.id, st); setSel(null); load(); } catch (_) {} };
  const when = (iso) => new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  if (sel) {
    return (
      <div>
        <button onClick={() => { setSel(null); load(); }} style={{ background: "none", border: "none", color: T.brandDark, fontWeight: 800, fontSize: 15, cursor: "pointer", padding: "4px 0", marginBottom: 6, fontFamily: "inherit" }}>{"\u2039"} Back to tickets</button>
        <div style={{ ...card, marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{sel.topic}</div>
          <div style={{ fontSize: 14, marginTop: 2 }}><b>{sel.name || "\u2014"}</b>{sel.phone ? <> {"\u00B7 "}<a href={`tel:${sel.phone}`} style={{ color: T.brandDark, fontWeight: 700 }}>{sel.phone}</a></> : null}</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>Opened {when(sel.created_at)} {"\u00B7"} {sel.status}</div>
        </div>
        <div style={{ ...card, maxHeight: 360, overflowY: "auto" }}>
          {msgs.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "agent" ? "flex-end" : "flex-start", margin: "6px 0" }}>
              <div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: 14, background: m.sender === "agent" ? "#0A5BB8" : "#EEF2F7", color: m.sender === "agent" ? "#fff" : T.ink, fontSize: 14.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {m.body}<div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{when(m.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input style={{ ...input, flex: 1, marginBottom: 0 }} value={text} maxLength={1000} placeholder="Write a reply" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") reply(); }} />
          <Btn disabled={busy || !text.trim()} onClick={reply}>Send</Btn>
        </div>
        {sel.account_id && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setRefundOpen((v) => !v)} style={{ background: "none", border: "none", color: "#B45309", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>{refundOpen ? "Hide refund" : "Refund this person"}</button>
            {refundOpen && <RefundBox api={api} accountId={sel.account_id} ticketId={sel.id} name={sel.name} onDone={() => loadThread(sel.id)} />}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          {sel.status === "open" ? <Btn kind="ghost" onClick={() => setTicketStatus("closed")}>Close ticket</Btn> : <Btn kind="ghost" onClick={() => setTicketStatus("open")}>Reopen</Btn>}
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>Support chats</h2>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 10 }}>People write from the Help button in the app. Open a ticket to read it and reply. They see your answer in the app within a few seconds.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {[["open", "Open"], ["closed", "Closed"], ["all", "All"]].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} aria-pressed={status === k} style={{ minHeight: 40, padding: "0 16px", borderRadius: 20, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${status === k ? T.brandDark : T.line}`, background: status === k ? T.brandDark : T.white, color: status === k ? "#fff" : T.ink }}>{l}</button>
        ))}
      </div>
      {err && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 8 }}>{err}</div>}
      {rows && rows.length === 0 && <div style={{ ...card, color: T.inkSoft, fontSize: 14 }}>No tickets.</div>}
      {(rows || []).map((r) => (
        <button key={r.id} onClick={() => setSel(r)} style={{ display: "block", width: "100%", textAlign: "left", ...card, marginBottom: 8, cursor: "pointer", fontFamily: "inherit", borderLeft: `4px solid ${r.unread ? "#DC2626" : T.line}` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{r.name || r.phone || "\u2014"} <span style={{ fontWeight: 600, color: T.inkSoft }}>{"\u00B7"} {r.topic}</span></span>
            {r.unread && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", background: "#DC2626", borderRadius: 10, padding: "2px 8px" }}>New</span>}
          </div>
          <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.last_body}</div>
          <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2 }}>{when(r.updated_at)} {"\u00B7"} {r.status}</div>
        </button>
      ))}
    </div>
  );
}

function Reports({ api }) {
  const [status, setStatus] = useState("open");
  const [rows, err, load] = useList(() => api.adminBookingReports(status), [api, status]);
  const [busy, setBusy] = useState(null);
  const done = async (id) => { setBusy(id); try { await api.adminBookingReportResolve(id); } catch (_) {} setBusy(null); load(); };
  const who = (name, phone) => (
    <span><b>{name || "\u2014"}</b>{phone ? <> {"\u00B7 "}<a href={`tel:${phone}`} style={{ color: T.brandDark, fontWeight: 700 }}>{phone}</a></> : null}</span>
  );
  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>Abuse reports on bookings</h2>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 10 }}>Customers and workers can report each other. Call either number to follow up, then mark it resolved.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {[["open", "Open"], ["resolved", "Resolved"], ["all", "All"]].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} aria-pressed={status === k} style={{ minHeight: 40, padding: "0 16px", borderRadius: 20, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${status === k ? T.brandDark : T.line}`, background: status === k ? T.brandDark : T.white, color: status === k ? "#fff" : T.ink }}>{l}</button>
        ))}
      </div>
      {err && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 8 }}>{err}</div>}
      <Table head={["When", "Reported by", "Customer", "Worker", "Reason", ""]} empty="No reports."
             rows={rows && rows.map((r) => [
               new Date(r.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
               <b key="b">{r.reporter_role === "customer" ? "Customer" : "Worker"}</b>,
               who(r.customer_name, r.customer_phone), who(r.worker_name, r.worker_phone),
               <span key="r"><b>{r.reason}</b>{r.note ? <><br />{r.note}</> : null}</span>,
               r.status === "open" ? <Btn key="d" kind="ghost" disabled={busy === r.id} onClick={() => done(r.id)}>Resolved</Btn> : "\u2713",
             ])} />
    </div>
  );
}

function Quality({ api }) {
  const [rows, err, load] = useList(() => api.adminQuality(), [api]);
  const [only, setOnly] = useState(false);
  const [feed, ferr] = useList(() => api.adminRatings(only), [api, only]);
  const [busy, setBusy] = useState(null);
  const [actErr, setActErr] = useState("");
  const setStatus = async (id, s) => {
    setBusy(id); setActErr("");
    try {
      const r = await api.adminSetStatus(id, s, null, s === "hidden" ? "Poor ratings: under review" : null);
      const x = Array.isArray(r) ? r[0] : r;
      if (x && x.ok === false) throw new Error("no");
      load();
    } catch (_) { setActErr("Could not change that listing."); }
    setBusy(null);
  };
  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>Rated by customers</h2>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 10 }}>Flagged: 3 or more ratings averaging under 3.5, or 2 or more complaints. Hiding a partner takes it out of search until you bring it back.</div>
      {(err || ferr) && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 8 }}>{err || ferr}</div>}
      {actErr && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, marginBottom: 8 }}>{actErr}</div>}
      <Table head={["Partner", "Work", "Average", "Ratings", "Complaints", "Status", ""]} empty="Nobody has been rated yet."
             rows={rows && rows.map((r) => [
               <span key="n" style={{ fontWeight: 700 }}>{r.name}<br /><span style={{ color: T.inkSoft, fontWeight: 400 }}>{r.phone}</span></span>,
               r.trade, <span key="a" style={{ fontWeight: 800, color: r.flagged ? "#B91C1C" : T.ink }}>{stars(r.avg_stars)}</span>,
               r.ratings, r.complaints > 0 ? <span key="c" style={{ color: "#B91C1C", fontWeight: 800 }}>{r.complaints}</span> : 0,
               <span key="s">{r.status}{r.flagged ? " \u00B7 flagged" : ""}</span>,
               r.status === "hidden"
                 ? <Btn key="b" kind="ghost" disabled={busy === r.worker_id} onClick={() => setStatus(r.worker_id, "approved")}>Restore</Btn>
                 : <Btn key="b" kind="ghost" disabled={busy === r.worker_id} onClick={() => setStatus(r.worker_id, "hidden")}>Hide</Btn>,
             ])} />
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "20px 0 8px" }}>All ratings and complaints</h2>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} style={{ width: 18, height: 18 }} /> Complaints only
      </label>
      <Table head={["When", "Type", "From", "To", "Stars", "Comment"]} empty="No ratings yet."
             rows={feed && feed.map((f) => [when(f.created_at), `${f.kind} \u00B7 ${f.by_role === "customer" ? "customer \u2192 partner" : "partner \u2192 customer"}`, f.from_name, f.to_name,
               <span key="s" style={{ fontWeight: 800, color: f.complaint ? "#B91C1C" : T.ink }}>{stars(f.stars)}{f.complaint ? " \u00B7 complaint" : ""}</span>, f.comment || "\u2014"])} />
    </div>
  );
}

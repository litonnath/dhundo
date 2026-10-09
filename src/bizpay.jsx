// ---------------------------------------------------------------------------
// WHAT A BUSINESS OWNER NEEDS AFTER SIGN-UP, about money:
//   * PaymentsPanel  -- how customers pay (cash, UPI and the UPI id) and the
//                       owner's GST and licence numbers.
//   * EarningsPanel  -- what was earned today, in 7 days and in 30 days, from
//                       the completed orders, jobs and rides in the app.
// Customers pay the business directly; Dhundo takes no commission.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { T, Btn, Icon, Notice, input } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { CONTACT } from "./brand.jsx";
import { exportCsv, openInvoice, docStatus } from "./bizmore.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const one = (r) => (Array.isArray(r) ? r[0] || null : r || null);
const rupees = (paise) => "₹" + Math.round((Number(paise) || 0) / 100).toLocaleString("en-IN");

const card = { background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, marginBottom: 14 };
const tick = (on) => ({ display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "10px 14px", borderRadius: 14, cursor: "pointer", marginBottom: 10,
  border: `1.5px solid ${on ? T.brandDark : T.line}`, background: on ? T.brandSoft : T.white, fontSize: 16, fontWeight: 800, color: T.ink });

export function PaymentsPanel({ api, kind }) {
  const { t } = useI18n();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.bizPayGet()).then((r) => {
      const x = one(r) || {};
      if (alive) setF({ cash: x.accepts_cash !== false, upiOk: !!x.accepts_upi, upi: x.upi_id || "", gst: x.gst_no || "", lic: x.licence_no || "" });
    }).catch(() => { if (alive) setF({ cash: true, upiOk: false, upi: "", gst: "", lic: "" }); });
    return () => { alive = false; };
  }, [api]);
  if (!f) return <div style={{ height: 120 }} />;
  const set = (k, v) => { setMsg(null); setF((p) => ({ ...p, [k]: v })); };
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.bizPaySave(f.cash, f.upiOk, f.upi.trim(), f.gst.trim(), f.lic.trim()));
      if (r && r.ok) setMsg({ tone: "good", text: t("p_saved") });
      else setMsg({ tone: "bad", text: r && r.reason === "bad_upi" ? t("bp_bad_upi") : r && r.reason === "upi_needed" ? t("bp_need_upi") : t("e_save") });
    } catch (e) { setMsg({ tone: "bad", text: (e && e.message) || t("e_save") }); }
    setBusy(false);
  };
  return (
    <div>
      <div style={{ ...card, background: T.brandSoft, border: "none", fontSize: 14.5, lineHeight: 1.55, color: T.brandDeep, fontWeight: 600 }}>{t("bp_intro")}</div>
      <label style={tick(f.cash)}><input type="checkbox" checked={f.cash} onChange={(e) => set("cash", e.target.checked)} style={{ width: 22, height: 22 }} /> {t("bp_cash")}</label>
      <label style={tick(f.upiOk)}><input type="checkbox" checked={f.upiOk} onChange={(e) => set("upiOk", e.target.checked)} style={{ width: 22, height: 22 }} /> {t("bp_upi")}</label>
      {f.upiOk && (
        <div style={{ margin: "0 0 14px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, margin: "0 0 6px" }}>{t("bp_upi_id")}</div>
          <input style={{ ...input, minHeight: 54, fontSize: 17 }} value={f.upi} autoCapitalize="none" autoCorrect="off" maxLength={80}
                 placeholder="name@bank" onChange={(e) => set("upi", e.target.value.replace(/\s/g, ""))} />
        </div>
      )}
      {kind === "owner" && (
        <div style={{ margin: "0 0 14px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, margin: "0 0 6px" }}>{t("bp_gst")}</div>
          <input style={{ ...input, minHeight: 54, fontSize: 17 }} value={f.gst} maxLength={20} onChange={(e) => set("gst", e.target.value.toUpperCase())} />
        </div>
      )}
      <div style={{ margin: "0 0 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, margin: "0 0 6px" }}>{t("bp_lic")}</div>
        <input style={{ ...input, minHeight: 54, fontSize: 17 }} value={f.lic} maxLength={30} onChange={(e) => set("lic", e.target.value)} />
      </div>
      {msg && <div style={{ marginBottom: 12 }}><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <Btn full onClick={save} disabled={busy || (!f.cash && !f.upiOk)} style={{ minHeight: 54, fontSize: 17 }}>{busy ? "…" : t("p_save")}</Btn>
    </div>
  );
}

// kind: "owner" (orders received), "delivery" (rider jobs), "travel" (rides)
export function EarningsPanel({ api, kind, bizName = "" }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);
  const [gst, setGst] = useState("");
  useEffect(() => { let alive = true; Promise.resolve(api.bizPayGet ? api.bizPayGet() : null).then((r) => { const x = Array.isArray(r) ? r[0] : r; if (alive && x && x.gst_no) setGst(x.gst_no); }).catch(() => {}); return () => { alive = false; }; }, [api]);
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        let list = [];
        if (kind === "owner") {
          list = many(await api.myOrders()).filter((o) => o.role === "owner" && o.status === "delivered").map((o) => ({ at: o.created_at, paise: o.total_paise, title: o.other_name, lines: Array.isArray(o.lines) ? o.lines : [], mode: o.mode, fee: o.delivery_fee_paise || 0 }));
        } else if (kind === "delivery") {
          list = many(await api.myJobs()).filter((j) => j.role === "rider" && j.status === "delivered").map((j) => ({ at: j.created_at, paise: j.fee_paise || 0, title: j.other_name || j.drop_text, sub: j.drop_text, note: j.note }));
        } else {
          list = many(await api.rideHistory()).filter((r) => r.role === "driver" && r.status === "done").map((r) => ({ at: r.done_at || r.created_at, paise: r.fare_paise || 0, title: r.drop_text || r.other_name, sub: r.pick_text, drop: r.drop_text, pick: r.pick_text, who: r.other_name }));
        }
        if (alive) setRows(list);
      } catch (_) { if (alive) setRows([]); }
    };
    pull();
    return () => { alive = false; };
  }, [api, kind]);
  if (rows === null) return <div style={{ height: 120 }} />;
  const now = Date.now();
  const within = (days) => rows.filter((r) => r.at && now - new Date(r.at).getTime() <= days * 86400000);
  const sum = (a) => a.reduce((s, r) => s + (Number(r.paise) || 0), 0);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const today = rows.filter((r) => r.at && new Date(r.at) >= startOfDay);
  const blocks = [["er_today", today], ["er_week", within(7)], ["er_month", within(30)]];
  return (
    <div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr", marginBottom: 14 }}>
        {blocks.map(([key, a], i) => (
          <div key={key} style={{ ...card, marginBottom: 0, background: i === 0 ? "linear-gradient(135deg,#032C61,#0A5BB8)" : T.white, color: i === 0 ? "#fff" : T.ink, border: i === 0 ? "none" : card.border }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, opacity: i === 0 ? 0.85 : 0.6 }}>{t(key)}</div>
            <div style={{ fontSize: i === 0 ? 38 : 30, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "4px 0 2px" }}>{rupees(sum(a))}</div>
            <div style={{ fontSize: 13.5, opacity: i === 0 ? 0.85 : 0.6 }}>{String(t("er_done")).replace("{n}", a.length)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, marginBottom: 14 }}>{t("er_note")}</div>
      {rows.length > 0 && (
        <button onClick={() => exportCsv(rows.slice().sort((a, b) => new Date(b.at) - new Date(a.at)), "dhundo-sales")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 52, marginBottom: 14, borderRadius: 14, border: `1.5px solid ${T.brandDark}`, background: T.white, color: T.brandDark, fontWeight: 800, fontSize: 15.5, cursor: "pointer", fontFamily: "inherit" }}>
          <Icon name="download" size={19} /> {t("iv_csv")}
        </button>
      )}
      {rows.length === 0 ? <div style={{ ...card, color: T.inkSoft }}>{t("er_none")}</div> : (
        <div style={card}>
          {rows.slice().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10).map((r, i) => (
            <details key={i} style={{ borderTop: i ? `1px solid ${T.line}` : "none" }}>
              <summary style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", cursor: "pointer", listStyle: "none", minHeight: 44 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                <span style={{ fontSize: 12.5, color: T.inkFaint }}>{r.at ? new Date(r.at).toLocaleDateString([], { day: "numeric", month: "short" }) : ""}</span>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{rupees(r.paise)}</span>
              </summary>
              <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, padding: "0 0 10px" }}>
                {(r.lines || []).map((l, j) => <div key={j}>{l.qty} {"\u00D7"} {l.name}</div>)}
                {r.mode && <div>{String(r.mode).replace("_", " ")}{r.fee ? ` \u00B7 ${rupees(r.fee)}` : ""}</div>}
                {r.pick && <div>{"\u25CF"} {r.pick}</div>}
                {r.drop && <div>{"\u25A0"} {r.drop}</div>}
                {r.who && <div>{r.who}</div>}
                {r.sub && !r.pick && <div>{r.sub}</div>}
                {r.note && <div>{r.note}</div>}
                <button onClick={() => openInvoice({ biz: bizName || "Dhundo", gst, row: r, t })} style={{ marginTop: 8, minHeight: 40, padding: "0 16px", borderRadius: 20, border: `1.5px solid ${T.line}`, background: "#fff", color: T.brandDark, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{t("iv_invoice")}</button>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// THE DASHBOARD on the business Home. Everything on it can be touched:
//   * Today / 7 days / 30 days changes every number, the chart and top sellers.
//   * A bar in the chart opens that day's list.
//   * A new order can be accepted or declined right here.
//   * "Waiting" and "In progress" open the orders; the refresh button reloads.
// It also refreshes itself every 15 seconds.
// ---------------------------------------------------------------------------
export function BizDashboard({ api, kind, views = null, requests = 0, onOrders, onWallet = null, auto = null, bookings = [], onBookingAnswer = null, profile = null, onProfile = null, shareName = "", onDocs = null }) {
  const { t } = useI18n();
  const [d, setD] = useState(null);
  const [range, setRange] = useState(7);
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(null);
  const [spin, setSpin] = useState(false);
  const [, setTick] = useState(0);
  const [stamp, setStamp] = useState(null);
  const [taking, setTaking] = useState(null);
  const [docAlert, setDocAlert] = useState(0);
  useEffect(() => {
    if (kind === "owner" || !api.docsList || !onDocs) return undefined;
    let alive = true;
    Promise.resolve(api.docsList()).then((r) => { const n = many(r).filter((x) => ["soon", "expired"].includes(docStatus(x.expires_on).key)).length; if (alive) setDocAlert(n); }).catch(() => {});
    return () => { alive = false; };
  }, [api, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (kind !== "owner" || !api.myMenu) return undefined;
    let alive = true;
    Promise.resolve(api.myMenu()).then((m) => { const a = many(m); if (alive) setTaking(a.length === 0 || a[0].accepting !== false); }).catch(() => {});
    return () => { alive = false; };
  }, [api, kind]);
  const [resumeAt, setResumeAt] = useState(null);
  useEffect(() => {
    if (kind !== "owner") return undefined;
    let alive = true;
    (async () => {
      try { if (api.resumeDue) await api.resumeDue(); } catch (_) {}
      try { const r = api.myResume ? await api.myResume() : null; const v = Array.isArray(r) ? r[0] : r; const at = typeof v === "string" ? v : v && v.services_my_resume ? v.services_my_resume : null; if (alive && at) setResumeAt(at); } catch (_) {}
    })();
    return () => { alive = false; };
  }, [api, kind, taking]);
  const flipTaking = async () => { const next = !taking; setTaking(next); if (next) setResumeAt(null); try { await api.setAccepting(next); } catch (_) { setTaking(!next); } };
  const pauseFor = async (m) => { setTaking(false); try { const r = await api.pauseOrders(m); const x = Array.isArray(r) ? r[0] : r; if (x && x.resume_at) setResumeAt(x.resume_at); } catch (_) { try { await api.setAccepting(false); } catch (e) {} } };
  const pull = async () => {
    try {
      let rows = [];
      if (kind === "owner") {
        rows = many(await api.myOrders()).filter((o) => o.role === "owner").map((o) => ({ id: o.id, at: o.created_at, paise: o.total_paise, title: o.other_name, lines: Array.isArray(o.lines) ? o.lines : [], status: o.status, canAct: o.status === "placed", wait: ["placed", "quoted", "confirmed"].includes(o.status), active: ["accepted", "ready"].includes(o.status), done: o.status === "delivered" }));
        const it = many(api.myItemOrders ? await api.myItemOrders() : []).filter((x) => x.role === "seller" && x.status === "requested");
        it.forEach((x) => rows.push({ id: x.id, at: x.created_at, paise: 0, title: x.title || t("mb_mine"), status: "requested", wait: true, active: false, done: false, noMoney: true }));
      } else if (kind === "delivery") {
        rows = many(await api.myJobs()).filter((j) => j.role === "rider").map((j) => ({ id: j.id, at: j.created_at, paise: j.fee_paise || 0, title: j.other_name || j.drop_text, status: j.status, wait: false, active: ["accepted", "picked_up"].includes(j.status), done: j.status === "delivered" }));
      } else if (kind === "travel") {
        rows = many(await api.rideHistory()).filter((r) => r.role === "driver").map((r) => ({ id: r.id, at: r.done_at || r.created_at, paise: r.fare_paise || 0, title: r.drop_text || r.other_name, status: r.status, wait: false, active: ["accepted", "started", "arrived"].includes(r.status), done: r.status === "done" }));
      }
      setD(rows); setStamp(Date.now());
    } catch (_) { setD((x) => x || []); }
  };
  useEffect(() => {
    pull();
    const id = setInterval(pull, 15000);
    const id2 = setInterval(() => setTick((n) => n + 1), 10000);
    return () => { clearInterval(id); clearInterval(id2); };
  }, [api, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (d === null) return <div style={{ height: 120 }} />;

  const now = Date.now();
  const sod = new Date(); sod.setHours(0, 0, 0, 0);
  const fromTime = range === 1 ? sod.getTime() : now - range * 86400000;
  const done = d.filter((r) => r.done);
  const inRange = done.filter((r) => r.at && new Date(r.at).getTime() >= fromTime);
  const sum = (a) => a.reduce((acc, r) => acc + (Number(r.paise) || 0), 0);
  const bk = Array.isArray(bookings) ? bookings : [];
  const bkWait = kind === "other" ? bk.filter((x) => x.role === "worker" && x.status === "requested").map((x) => ({ id: x.id, title: x.other_name, at: x.start_at, status: "requested", noMoney: true, canAct: true, wait: true, bk: true })) : [];
  const bkUp = kind === "other" ? bk.filter((x) => x.role === "worker" && x.status === "accepted") : [];
  const waitRows = kind === "other" ? bkWait : d.filter((r) => r.wait);
  const waiting = waitRows.length + (kind === "travel" ? requests : 0);
  const active = d.filter((r) => r.active).length;
  const money = kind !== "other";
  const nDays = range === 30 ? 30 : 7;
  const days = Array.from({ length: nDays }, (_, i) => {
    const a = new Date(sod); a.setDate(a.getDate() - (nDays - 1 - i));
    const b = new Date(a); b.setDate(b.getDate() + 1);
    const rows = done.filter((r) => r.at && new Date(r.at) >= a && new Date(r.at) < b);
    return { a, label: a.toLocaleDateString([], nDays === 30 ? { day: "numeric" } : { weekday: "short" }).slice(0, 3), paise: sum(rows), rows };
  });
  const peak = Math.max(1, ...days.map((x) => x.paise));
  const top = {};
  if (kind === "owner") inRange.forEach((r) => (r.lines || []).forEach((l) => { if (l && l.name) top[l.name] = (top[l.name] || 0) + (Number(l.qty) || 1); }));
  const topList = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const pill = { placed: "#B45309", quoted: "#B45309", confirmed: "#B45309", requested: "#B45309", accepted: "#1D4ED8", ready: "#15803D", picked_up: "#1D4ED8", started: "#1D4ED8", arrived: "#1D4ED8", delivered: "#15803D", done: "#15803D", cancelled: "#6B7280", rejected: "#B91C1C", expired: "#6B7280" };
  const label = (st) => { const k = "st_status_" + st; const v = t(k); return v === k ? st : v; };
  const rangeKey = range === 1 ? "er_today" : range === 7 ? "er_week" : "er_month";
  const act = async (r, action) => {
    if (r.bk) { setBusy(r.id); try { if (onBookingAnswer) await onBookingAnswer(r.id, action === "accept"); } catch (_) {} setBusy(null); return; }
    setBusy(r.id);
    try { await api.orderUpdate(r.id, action); } catch (_) {}
    setBusy(null); pull();
  };
  const refresh = async () => { setSpin(true); await pull(); setSpin(false); };
  const secs = stamp ? Math.max(0, Math.round((Date.now() - stamp) / 1000)) : 0; // eslint-disable-line no-unused-vars
  const tileBtn = (go) => ({ border: "none", cursor: go ? "pointer" : "default", fontFamily: "inherit", textAlign: "left", width: "100%" });
  const tiles = money
    ? [
        [rangeKey, rupees(sum(inRange)), "#0A5BB8", "#E8F0FB", null],
        ["db_count", inRange.length, "#15803D", "#E7F5EC", null],
        ["db_avg", rupees(inRange.length ? sum(inRange) / inRange.length : 0), "#A16207", "#FDF3DC", null],
        ["db_waiting", waiting, "#C2410C", "#FFF1E6", onOrders],
        ["db_active", active, "#7E22CE", "#F3E8FD", onOrders],
      ]
    : [["db_waiting", bkWait.length, "#C2410C", "#FFF1E6", null], ["db_upcoming", bkUp.length, "#15803D", "#E7F5EC", null], ["db_views", views == null ? "\u2014" : views, "#0A5BB8", "#E8F0FB", null]];
  const dayRows = sel !== null && days[sel] ? days[sel].rows : [];
  const waNum = String(CONTACT.whatsapp || "").replace(/\D/g, "");
  return (
    <div style={{ margin: "0 0 20px" }}>
      {kind === "owner" && taking !== null && (
        <div style={{ padding: "12px 14px", marginBottom: 12, borderRadius: 18, background: taking ? "#F0FAF4" : "#FEF2F2", border: `1.5px solid ${taking ? "#1FA85A" : "#FCA5A5"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: taking ? "#157A43" : "#B91C1C" }}>{taking ? t("pn_taking") : t("pn_paused")}</span>
              {!taking && resumeAt && <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.inkSoft, marginTop: 2 }}>{String(t("pn_back_at")).replace("{t}", new Date(resumeAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}</span>}
            </span>
            <button onClick={flipTaking} role="switch" aria-checked={taking} style={{ position: "relative", width: 62, height: 36, borderRadius: 18, border: "none", cursor: "pointer", background: taking ? "#1FA85A" : "#C5CBD3", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 4, left: taking ? 30 : 4, width: 28, height: 28, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
            </button>
          </div>
          {taking && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: T.inkSoft }}>{t("pn_pause")}</span>
              {[[30, "pn_30"], [60, "pn_1h"], [120, "pn_2h"]].map(([m, key]) => (
                <button key={m} onClick={() => pauseFor(m)} style={{ minHeight: 40, padding: "0 14px", borderRadius: 20, border: "1.5px solid #D1D5DB", background: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", color: T.ink }}>{t(key)}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {money && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div role="tablist" style={{ flex: 1, display: "flex", gap: 4, background: "#EEF1F5", borderRadius: 14, padding: 4 }}>
            {[[1, "er_today"], [7, "er_week"], [30, "er_month"]].map(([n, key]) => (
              <button key={n} role="tab" aria-selected={range === n} onClick={() => { setRange(n); setSel(null); }} style={{ flex: 1, minHeight: 42, borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, background: range === n ? T.white : "transparent", color: range === n ? T.brandDark : T.inkSoft, boxShadow: range === n ? "0 2px 6px rgba(15,20,25,0.12)" : "none" }}>{t(key)}</button>
            ))}
          </div>
          <button onClick={refresh} aria-label="Refresh" style={{ width: 46, height: 46, borderRadius: "50%", border: `1px solid ${T.line}`, background: T.white, color: T.brandDark, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ display: "inline-flex", transition: "transform .6s ease", transform: spin ? "rotate(360deg)" : "none" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg></span>
          </button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {tiles.map(([key, val, fg, bg, go], i) => (
          <button key={key} onClick={go || undefined} style={{ ...tileBtn(go), background: bg, borderRadius: 18, padding: "14px 14px 12px", gridColumn: i === 0 && money ? "1 / -1" : "auto" }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: fg }}>{t(key)}</span>
            <span style={{ display: "block", fontSize: i === 0 && money ? 36 : 28, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em", lineHeight: 1.15, marginTop: 4 }}>{val}</span>
          </button>
        ))}
      </div>

      {docAlert > 0 && (
        <button onClick={onDocs} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 58, padding: "10px 14px", marginBottom: 12, borderRadius: 16, border: "1.5px solid #F87171", background: "#FEF2F2", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          <Icon name="alert" size={22} style={{ color: "#B91C1C" }} />
          <span style={{ flex: 1, fontSize: 15.5, fontWeight: 800, color: "#B91C1C" }}>{t("dc_alert")}</span>
        </button>
      )}
      {profile && profile.pct < 100 && (
        <button onClick={onProfile} style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 14px 12px", marginBottom: 12, borderRadius: 18, border: `1px solid ${T.line}`, background: T.white, cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.ink }}>{t("db_profile")}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.brandDark }}>{profile.pct}%</span>
          </span>
          <span style={{ display: "block", height: 8, borderRadius: 4, background: "#E5E9EF", overflow: "hidden", marginBottom: 8 }}>
            <span style={{ display: "block", height: "100%", width: profile.pct + "%", background: "linear-gradient(90deg,#2E86E6,#0A5BB8)", borderRadius: 4 }} />
          </span>
          <span style={{ display: "block", fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5 }}>{profile.missing.slice(0, 3).join(" \u00B7 ")}</span>
        </button>
      )}
      {waitRows.length > 0 && (
        <div style={{ background: "#FFF8E6", border: "1.5px solid #F59E0B", borderRadius: 18, padding: "10px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0 8px" }}>
            <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#F59E0B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>{waiting}</span>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.ink }}>{t("db_attention")}</span>
          </div>
          {waitRows.slice(0, 4).map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: "1px solid rgba(245,158,11,0.35)", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 120px", minWidth: 0, fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
              {r.bk && r.at && <span style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 700 }}>{new Date(r.at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>}
              {!r.noMoney && <span style={{ fontSize: 14, fontWeight: 800 }}>{rupees(r.paise)}</span>}
              {r.canAct ? (
                <>
                  <button disabled={busy === r.id} onClick={() => act(r, "accept")} style={{ minHeight: 42, padding: "0 16px", borderRadius: 21, border: "none", background: "#16A34A", color: "#fff", fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit", opacity: busy === r.id ? 0.6 : 1 }}>{t("ow_accept")}</button>
                  <button disabled={busy === r.id} onClick={() => act(r, "reject")} style={{ minHeight: 42, padding: "0 14px", borderRadius: 21, border: "1.5px solid #D1D5DB", background: "#fff", color: "#B91C1C", fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" }}>{t("ow_reject")}</button>
                </>
              ) : (
                <button onClick={onOrders} style={{ minHeight: 42, padding: "0 16px", borderRadius: 21, border: "1.5px solid #F59E0B", background: "#fff", color: "#8A5A00", fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" }}>{t("db_open")}</button>
              )}
            </div>
          ))}
          {waitRows.length > 4 && <button onClick={onOrders} style={{ display: "block", width: "100%", background: "none", border: "none", color: "#8A5A00", fontWeight: 800, fontSize: 14.5, minHeight: 44, cursor: "pointer", fontFamily: "inherit" }}>{t("nav_activity")}</button>}
        </div>
      )}

      {money && (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, padding: "14px 12px 10px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10, padding: "0 2px" }}>{t(range === 30 ? "er_month" : "er_week")}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: nDays === 30 ? 2 : 8, height: 130 }}>
            {days.map((x, i) => (
              <button key={i} onClick={() => setSel(sel === i ? null : i)} aria-label={x.a.toDateString()} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                {nDays === 7 && <span style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, marginBottom: 3 }}>{x.paise ? "\u20B9" + Math.round(x.paise / 100) : ""}</span>}
                <span style={{ display: "block", width: "100%", maxWidth: 40, height: Math.max(4, Math.round((x.paise / peak) * 88)), borderRadius: nDays === 30 ? 3 : 8, background: sel === i ? "#F87617" : i === nDays - 1 ? "linear-gradient(180deg,#2E86E6,#0A5BB8)" : "#C9DBF7", transition: "background .15s" }} />
                <span style={{ fontSize: nDays === 30 ? 8.5 : 11.5, color: sel === i ? "#C2410C" : T.inkFaint, marginTop: 5, fontWeight: 700 }}>{nDays === 30 && i % 3 !== 0 ? "" : x.label}</span>
              </button>
            ))}
          </div>
          {sel !== null && days[sel] && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{days[sel].a.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#C2410C" }}>{rupees(days[sel].paise)}</span>
              </div>
              {dayRows.length === 0 ? <div style={{ fontSize: 14, color: T.inkSoft, padding: "6px 0" }}>{t("er_none")}</div> : dayRows.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 800 }}>{rupees(r.paise)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {topList.length > 0 && (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, padding: "6px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, padding: "10px 0 4px" }}>{String(t("db_top")).replace(/\s*[\(\uFF08][^)\uFF09]*[\)\uFF09]/, "")} {"\u00B7"} {t(rangeKey)}</div>
          {topList.map(([name, n], i) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: T.brandSoft, color: T.brandDark, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.inkSoft }}>{"\u00D7"} {n}</span>
            </div>
          ))}
        </div>
      )}

      {d.length > 0 && (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, padding: "6px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, padding: "10px 0 4px" }}>{t("db_recent")}</div>
          {d.slice().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5).map((r, i) => (
            <button key={r.id + ":" + i} onClick={onOrders} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", width: "100%", background: "none", border: "none", borderTop: i ? `1px solid ${T.line}` : "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", background: pill[r.status] || "#6B7280", borderRadius: 12, padding: "3px 10px", whiteSpace: "nowrap" }}>{label(r.status)}</span>
              {!r.noMoney && <span style={{ fontSize: 14.5, fontWeight: 800, minWidth: 54, textAlign: "right", color: T.ink }}>{rupees(r.paise)}</span>}
            </button>
          ))}
          <button onClick={onOrders} style={{ display: "block", width: "100%", background: "none", border: "none", borderTop: `1px solid ${T.line}`, color: T.brandDark, fontWeight: 800, fontSize: 14.5, minHeight: 46, cursor: "pointer", fontFamily: "inherit" }}>{t("nav_activity")}</button>
        </div>
      )}
      {bkUp.length > 0 && (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, padding: "6px 14px", marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, padding: "10px 0 4px" }}>{t("db_upcoming")}</div>
          {bkUp.slice(0, 5).map((x, i) => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.other_name}</span>
              <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 700 }}>{x.start_at ? new Date(x.start_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""}</span>
              {x.other_phone && <a href={`tel:${x.other_phone}`} aria-label="Call" style={{ width: 40, height: 40, borderRadius: "50%", background: "#0F8A3C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="phone" size={18} /></a>}
            </div>
          ))}
        </div>
      )}
      {auto && (
        <button onClick={() => auto.set(!auto.on)} role="switch" aria-checked={auto.on} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 14px", marginTop: 12, borderRadius: 18, border: `1.5px solid ${auto.on ? "#1FA85A" : T.line}`, background: auto.on ? "#F0FAF4" : T.white, cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: T.ink }}>{t("au_title")}</span>
            <span style={{ display: "block", fontSize: 13, color: T.inkSoft, lineHeight: 1.45, marginTop: 2 }}>{t("au_sub")}</span>
          </span>
          <span style={{ position: "relative", width: 56, height: 32, borderRadius: 16, background: auto.on ? "#1FA85A" : "#C5CBD3", flexShrink: 0 }}>
            <span style={{ position: "absolute", top: 4, left: auto.on ? 28 : 4, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
          </span>
        </button>
      )}
      <RatingsCard api={api} />
      {(kind === "delivery" || kind === "travel") && <SosButton />}
      <div style={{ display: "grid", gridTemplateColumns: onWallet ? "1fr 1fr" : "1fr", gap: 10, marginTop: 12 }}>
        {onWallet && (
          <button onClick={onWallet} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 56, borderRadius: 16, border: `1.5px solid ${T.brandDark}`, background: T.white, color: T.brandDark, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            <Icon name="wallet" size={20} /> {t("bz_cashout")}
          </button>
        )}
        <button onClick={() => { const url = (typeof window !== "undefined" ? window.location.origin : "") + "/"; const text = String(t("sh_promo")).replace("{name}", shareName || "").replace("{url}", url); window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener"); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 56, borderRadius: 16, border: "1.5px solid #25D366", background: "#fff", color: "#157A43", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", gridColumn: "1 / -1" }}>
          {t("sh_btn_promo")}
        </button>
        {waNum && (
          <a href={`https://wa.me/${waNum}?text=${encodeURIComponent(t("pn_help_msg"))}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 56, borderRadius: 16, background: "#25D366", color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
            {t("pn_help")}
          </a>
        )}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// RATINGS the owner has received, and complaints (which only the owner sees).
// ---------------------------------------------------------------------------
function Stars({ n, size = 16 }) {
  return <span aria-label={n + " / 5"} style={{ color: "#F59E0B", fontSize: size, letterSpacing: 1 }}>{"\u2605".repeat(Math.round(n))}<span style={{ color: "#D1D5DB" }}>{"\u2605".repeat(5 - Math.round(n))}</span></span>;
}
export function RatingsCard({ api }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.myReviews ? api.myReviews() : []).then((r) => { if (alive) setRows(many(r)); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [api]);
  if (rows === null || rows.length === 0) return rows === null ? null : (
    <div style={{ ...card, marginTop: 12, marginBottom: 0, color: T.inkSoft, fontSize: 14.5 }}>{t("rtg_title")}: {t("rt_none")}</div>
  );
  const rated = rows.filter((r) => !r.complaint);
  const avg = rated.length ? rated.reduce((s, r) => s + r.stars, 0) / rated.length : 0;
  return (
    <div style={{ ...card, marginTop: 12, marginBottom: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>{avg.toFixed(1)}</span>
        <span>
          <Stars n={avg} size={20} />
          <span style={{ display: "block", fontSize: 13, color: T.inkSoft, fontWeight: 700 }}>{String(t("rt_count")).replace("{n}", rated.length)}</span>
        </span>
      </div>
      {rows.slice(0, 5).map((r, i) => (
        <div key={i} style={{ padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Stars n={r.stars} />
            {r.complaint && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", background: "#B91C1C", borderRadius: 10, padding: "2px 9px" }}>{t("rt_complaint")}</span>}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: T.inkFaint }}>{r.created_at ? new Date(r.created_at).toLocaleDateString([], { day: "numeric", month: "short" }) : ""}</span>
          </div>
          {r.comment && <div style={{ fontSize: 14.5, color: T.ink, marginTop: 3, overflowWrap: "anywhere" }}>{r.comment}</div>}
        </div>
      ))}
    </div>
  );
}

// What the customer sees after a delivered order: stars, a few words, or a problem.
export function RateBox({ api, orderId, onDone }) {
  const { t } = useI18n();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState(false);
  const [state, setState] = useState(null);
  const send = async () => {
    setState("busy");
    try {
      const r = one(await api.reviewAdd({ kind: "order", ref: orderId, stars, comment: text, complaint: problem }));
      if (r && (r.ok || r.reason === "already")) { setState("done"); onDone && onDone(orderId); } else setState("err");
    } catch (_) { setState("err"); }
  };
  if (state === "done") return <div style={{ margin: "8px 0", fontSize: 15, fontWeight: 800, color: "#157A43" }}>{"\u2713 "}{t("rt_thanks")}</div>;
  return (
    <div style={{ margin: "10px 0 4px", padding: "12px 12px", borderRadius: 14, background: "#FFF9E8", border: "1px solid #F5E2A8" }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{t("rt_rate")}</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} aria-label={n + " / 5"} style={{ background: "none", border: "none", padding: 2, fontSize: 34, lineHeight: 1, cursor: "pointer", color: n <= stars ? "#F59E0B" : "#D1D5DB" }}>{"\u2605"}</button>
        ))}
      </div>
      {stars > 0 && (
        <>
          <input style={{ ...input, marginBottom: 8 }} value={text} maxLength={200} placeholder={t("rt_comment_ph")} onChange={(e) => setText(e.target.value)} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={problem} onChange={(e) => setProblem(e.target.checked)} style={{ width: 20, height: 20 }} /> {t("rt_problem")}
          </label>
          {state === "err" && <div style={{ fontSize: 13.5, color: "#B91C1C", marginBottom: 6 }}>{t("e_save")}</div>}
          <Btn full onClick={send} disabled={state === "busy"}>{state === "busy" ? "\u2026" : t("rt_send")}</Btn>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SOS for riders and drivers: call 112, or send the position to Dhundo help.
// ---------------------------------------------------------------------------
export function SosButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const share = () => {
    const num = String(CONTACT.whatsapp || "").replace(/\D/g, "");
    const go = (pos) => {
      const where = pos ? ` https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}` : "";
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(t("sos_msg") + where)}`, "_blank", "noopener");
      setBusy(false);
    };
    setBusy(true);
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(go, () => go(null), { enableHighAccuracy: true, timeout: 8000 });
    else go(null);
  };
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", minHeight: 56, marginTop: 12, borderRadius: 16, border: "none", background: "#DC2626", color: "#fff", fontWeight: 800, fontSize: 17, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1 }}>
        <Icon name="alert" size={22} /> {t("sos_btn")}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(15,20,25,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "22px 22px 0 0", width: "100%", maxWidth: 480, padding: "18px 18px calc(22px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 21, fontWeight: 800, color: "#B91C1C" }}>{t("sos_title")}</h2>
            <a href="tel:112" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 62, borderRadius: 16, background: "#DC2626", color: "#fff", fontWeight: 800, fontSize: 18, textDecoration: "none", marginBottom: 10 }}>{t("sos_112")}</a>
            <button onClick={share} disabled={busy} style={{ display: "block", width: "100%", minHeight: 62, borderRadius: 16, border: "none", background: "#25D366", color: "#fff", fontWeight: 800, fontSize: 17, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>{busy ? "\u2026" : t("sos_share")}</button>
            <button onClick={() => setOpen(false)} style={{ display: "block", width: "100%", minHeight: 50, borderRadius: 14, border: `1.5px solid ${T.line}`, background: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit" }}>{t("sos_close")}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// LEARN: short tips for new partners, in the partner's language.
// ---------------------------------------------------------------------------
export function LearnPanel({ kind }) {
  const { t } = useI18n();
  const tips = ["lr_1", "lr_2", "lr_3", "lr_4", "lr_5", "lr_6"];
  return (
    <div>
      {tips.map((k, i) => (
        <details key={k} style={{ ...card, padding: "4px 16px", marginBottom: 10 }}>
          <summary style={{ cursor: "pointer", minHeight: 54, display: "flex", alignItems: "center", gap: 12, fontSize: 16, fontWeight: 800, color: T.ink, listStyle: "none" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: T.brandSoft, color: T.brandDark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{i + 1}</span>
            <span style={{ flex: 1 }}>{t(k + "_t")}</span>
          </summary>
          <div style={{ fontSize: 15, lineHeight: 1.65, color: T.inkSoft, padding: "0 0 14px 42px" }}>{t(k + "_b")}</div>
        </details>
      ))}
    </div>
  );
}

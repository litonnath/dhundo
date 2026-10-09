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
export function EarningsPanel({ api, kind }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        let list = [];
        if (kind === "owner") {
          list = many(await api.myOrders()).filter((o) => o.role === "owner" && o.status === "delivered").map((o) => ({ at: o.created_at, paise: o.total_paise, title: o.other_name }));
        } else if (kind === "delivery") {
          list = many(await api.myJobs()).filter((j) => j.role === "rider" && j.status === "delivered").map((j) => ({ at: j.created_at, paise: j.fee_paise || 0, title: j.other_name || j.drop_text }));
        } else {
          list = many(await api.rideHistory()).filter((r) => r.role === "driver" && r.status === "done").map((r) => ({ at: r.done_at || r.created_at, paise: r.fare_paise || 0, title: r.drop_text || r.other_name }));
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
      {rows.length === 0 ? <div style={{ ...card, color: T.inkSoft }}>{t("er_none")}</div> : (
        <div style={card}>
          {rows.slice().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
              <span style={{ fontSize: 12.5, color: T.inkFaint }}>{r.at ? new Date(r.at).toLocaleDateString([], { day: "numeric", month: "short" }) : ""}</span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{rupees(r.paise)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// THE DASHBOARD on the business Home: the numbers an owner looks at first,
// what needs them now, and the latest activity. Refreshes every 15 seconds.
// ---------------------------------------------------------------------------
export function BizDashboard({ api, kind, views = null, requests = 0, onOrders }) {
  const { t } = useI18n();
  const [d, setD] = useState(null);
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        let rows = [];
        if (kind === "owner") {
          rows = many(await api.myOrders()).filter((o) => o.role === "owner").map((o) => ({ at: o.created_at, paise: o.total_paise, title: o.other_name, lines: Array.isArray(o.lines) ? o.lines : [], status: o.status, wait: ["placed", "quoted", "confirmed"].includes(o.status), active: ["accepted", "ready"].includes(o.status), done: o.status === "delivered" }));
          const it = many(api.myItemOrders ? await api.myItemOrders() : []).filter((x) => x.role === "seller" && x.status === "requested");
          it.forEach((x) => rows.push({ at: x.created_at, paise: 0, title: x.title || t("mb_mine"), status: "requested", wait: true, active: false, done: false, noMoney: true }));
        } else if (kind === "delivery") {
          rows = many(await api.myJobs()).filter((j) => j.role === "rider").map((j) => ({ at: j.created_at, paise: j.fee_paise || 0, title: j.other_name || j.drop_text, status: j.status, wait: false, active: ["accepted", "picked_up"].includes(j.status), done: j.status === "delivered" }));
        } else if (kind === "travel") {
          rows = many(await api.rideHistory()).filter((r) => r.role === "driver").map((r) => ({ at: r.done_at || r.created_at, paise: r.fare_paise || 0, title: r.drop_text || r.other_name, status: r.status, wait: false, active: ["accepted", "started", "arrived"].includes(r.status), done: r.status === "done" }));
        }
        if (alive) setD(rows);
      } catch (_) { if (alive) setD([]); }
    };
    pull();
    const id = setInterval(pull, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [api, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (d === null) return <div style={{ height: 120 }} />;
  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const done = d.filter((r) => r.done);
  const sum = (a) => a.reduce((s, r) => s + (Number(r.paise) || 0), 0);
  const today = done.filter((r) => r.at && new Date(r.at) >= startOfDay);
  const week = done.filter((r) => r.at && now - new Date(r.at).getTime() <= 7 * 86400000);
  const waiting = d.filter((r) => r.wait).length + (kind === "travel" ? requests : 0);
  const active = d.filter((r) => r.active).length;
  const money = kind !== "other";
  const tiles = money
    ? [["er_today", rupees(sum(today)), "#0A5BB8", "#E8F0FB"], ["er_week", rupees(sum(week)), "#15803D", "#E7F5EC"], ["er_month", rupees(sum(month)), "#0F766E", "#E3F4F2"], ["db_avg", rupees(avg), "#A16207", "#FDF3DC"], ["db_waiting", waiting, "#C2410C", "#FFF1E6"], ["db_active", active, "#7E22CE", "#F3E8FD"]]
    : [["db_views", views == null ? "—" : views, "#0A5BB8", "#E8F0FB"]];
  const month = done.filter((r) => r.at && now - new Date(r.at).getTime() <= 30 * 86400000);
  const avg = month.length ? sum(month) / month.length : 0;
  const days = Array.from({ length: 7 }, (_, i) => {
    const a = new Date(startOfDay); a.setDate(a.getDate() - (6 - i));
    const b = new Date(a); b.setDate(b.getDate() + 1);
    const rows7 = done.filter((r) => r.at && new Date(r.at) >= a && new Date(r.at) < b);
    return { label: a.toLocaleDateString([], { weekday: "short" }).slice(0, 3), paise: sum(rows7), n: rows7.length };
  });
  const peak = Math.max(1, ...days.map((x) => x.paise));
  const top = {};
  if (kind === "owner") month.forEach((r) => (r.lines || []).forEach((l) => { if (l && l.name) top[l.name] = (top[l.name] || 0) + (Number(l.qty) || 1); }));
  const topList = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const pill = { placed: "#B45309", quoted: "#B45309", confirmed: "#B45309", requested: "#B45309", accepted: "#1D4ED8", ready: "#15803D", picked_up: "#1D4ED8", started: "#1D4ED8", arrived: "#1D4ED8", delivered: "#15803D", done: "#15803D", cancelled: "#6B7280", rejected: "#B91C1C", expired: "#6B7280" };
  const label = (st) => { const k = "st_status_" + st; const v = t(k); return v === k ? st : v; };
  return (
    <div style={{ margin: "0 0 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {tiles.map(([key, val, fg, bg]) => (
          <div key={key} style={{ background: bg, borderRadius: 18, padding: "14px 14px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: fg }}>{t(key)}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em", lineHeight: 1.15, marginTop: 4 }}>{val}</div>
          </div>
        ))}
      </div>
      {money && (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, padding: "14px 14px 10px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>{t("er_week")}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
            {days.map((x, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, marginBottom: 3 }}>{x.paise ? "\u20B9" + Math.round(x.paise / 100) : ""}</span>
                <div style={{ width: "100%", maxWidth: 38, height: Math.max(4, Math.round((x.paise / peak) * 84)), borderRadius: 8, background: i === 6 ? "linear-gradient(180deg,#2E86E6,#0A5BB8)" : "#C9DBF7" }} />
                <span style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 5, fontWeight: 700 }}>{x.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {topList.length > 0 && (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, padding: "6px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, padding: "10px 0 4px" }}>{t("db_top")}</div>
          {topList.map(([name, n], i) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: T.brandSoft, color: T.brandDark, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.inkSoft }}>× {n}</span>
            </div>
          ))}
        </div>
      )}
      {waiting > 0 && (
        <button onClick={onOrders} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 62, padding: "10px 14px", marginBottom: 12, borderRadius: 16, border: "1.5px solid #F59E0B", background: "#FFF8E6", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", background: "#F59E0B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800 }}>{waiting}</span>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.ink }}>{t("db_attention")}</span>
          <Icon name="chev" size={18} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
        </button>
      )}
      {d.length > 0 && (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, padding: "6px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, padding: "10px 0 4px" }}>{t("db_recent")}</div>
          {d.slice().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", background: pill[r.status] || "#6B7280", borderRadius: 12, padding: "3px 10px", whiteSpace: "nowrap" }}>{label(r.status)}</span>
              {!r.noMoney && <span style={{ fontSize: 14.5, fontWeight: 800, minWidth: 54, textAlign: "right" }}>{rupees(r.paise)}</span>}
            </div>
          ))}
          <button onClick={onOrders} style={{ display: "block", width: "100%", background: "none", border: "none", borderTop: `1px solid ${T.line}`, color: T.brandDark, fontWeight: 800, fontSize: 14.5, minHeight: 46, cursor: "pointer", fontFamily: "inherit" }}>{t("nav_activity")}</button>
        </div>
      )}
    </div>
  );
}

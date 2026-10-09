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

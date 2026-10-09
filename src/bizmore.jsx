// ---------------------------------------------------------------------------
// MORE FOR A BUSINESS OWNER:
//   SchedulePanel -- working days, working hours and how far they travel.
//   DocsPanel     -- licence, insurance and other papers with expiry dates.
//   BankPanel     -- a bank account for payouts (only the last 4 digits ever
//                    come back to the phone).
//   exportCsv / openInvoice -- the sales report and a printable invoice.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { T, Btn, Notice, input } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const one = (r) => (Array.isArray(r) ? r[0] || null : r || null);
const card = { background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, marginBottom: 14 };
const label = { fontSize: 14, fontWeight: 800, margin: "14px 0 6px", color: T.ink };
const field = { ...input, minHeight: 54, fontSize: 17 };

export function dayName(i, lang) {
  try { return new Date(2024, 0, 1 + i).toLocaleDateString(lang || undefined, { weekday: "short" }); } catch (_) { return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]; }
}
export function scheduleLine(s, t, lang) {
  if (!s) return "";
  const on = [0, 1, 2, 3, 4, 5, 6].filter((i) => (s.days >> i) & 1).map((i) => dayName(i, lang));
  const days = on.length === 7 ? t("sc_everyday") : on.join(", ");
  const time = s.all_day ? t("sc_allday") : `${s.from_time || ""}–${s.to_time || ""}`;
  const far = s.radius_km ? ` · ${String(t("sc_within")).replace("{n}", s.radius_km)}` : "";
  return `${days} · ${time}${far}`;
}

export function SchedulePanel({ api }) {
  const { t, lang } = useI18n();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.scheduleGet()).then((r) => {
      const x = one(r) || {};
      if (alive) setF({ days: x.days == null ? 127 : x.days, all: x.all_day !== false, from: x.from_time || "09:00", to: x.to_time || "18:00", km: x.radius_km || 0 });
    }).catch(() => { if (alive) setF({ days: 127, all: true, from: "09:00", to: "18:00", km: 0 }); });
    return () => { alive = false; };
  }, [api]);
  if (!f) return <div style={{ height: 120 }} />;
  const set = (k, v) => { setMsg(null); setF((p) => ({ ...p, [k]: v })); };
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.scheduleSave(f.days, f.all, f.from, f.to, f.km));
      setMsg(r && r.ok ? { tone: "good", text: t("p_saved") } : { tone: "bad", text: t("e_save") });
    } catch (e) { setMsg({ tone: "bad", text: (e && e.message) || t("e_save") }); }
    setBusy(false);
  };
  const chip = (on) => ({ minWidth: 56, minHeight: 48, padding: "0 12px", borderRadius: 24, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800, border: `1.5px solid ${on ? T.brandDark : T.line}`, background: on ? T.brandDark : T.white, color: on ? "#fff" : T.ink });
  return (
    <div>
      <div style={label}>{t("sc_days")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <button key={i} aria-pressed={!!((f.days >> i) & 1)} onClick={() => set("days", f.days ^ (1 << i))} style={chip(!!((f.days >> i) & 1))}>{dayName(i, lang)}</button>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "10px 14px", margin: "16px 0 8px", borderRadius: 14, cursor: "pointer", border: `1.5px solid ${f.all ? T.brandDark : T.line}`, background: f.all ? T.brandSoft : T.white, fontSize: 16, fontWeight: 800 }}>
        <input type="checkbox" checked={f.all} onChange={(e) => set("all", e.target.checked)} style={{ width: 22, height: 22 }} /> {t("sc_allday")}
      </label>
      {!f.all && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><div style={label}>{t("sc_from")}</div><input type="time" style={field} value={f.from} onChange={(e) => set("from", e.target.value)} /></div>
          <div style={{ flex: 1 }}><div style={label}>{t("sc_to")}</div><input type="time" style={field} value={f.to} onChange={(e) => set("to", e.target.value)} /></div>
        </div>
      )}
      <div style={label}>{t("sc_radius")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {[[0, t("sc_any")], [2, "2 km"], [5, "5 km"], [10, "10 km"], [25, "25 km"], [50, "50 km"], [100, "100 km"]].map(([n, lbl]) => (
          <button key={n} aria-pressed={f.km === n} onClick={() => set("km", n)} style={chip(f.km === n)}>{lbl}</button>
        ))}
      </div>
      {msg && <div style={{ marginBottom: 12 }}><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <Btn full onClick={save} disabled={busy || f.days === 0} style={{ minHeight: 54, fontSize: 17 }}>{busy ? "…" : t("p_save")}</Btn>
    </div>
  );
}

const DOC_KINDS = [["licence", "dc_licence"], ["insurance", "dc_insurance"], ["rc", "dc_rc"], ["puc", "dc_puc"], ["permit", "dc_permit"]];
export function docStatus(exp) {
  if (!exp) return { key: "none", days: null };
  const days = Math.ceil((new Date(exp + "T23:59:59") - Date.now()) / 86400000);
  return { key: days < 0 ? "expired" : days <= 30 ? "soon" : "ok", days };
}
export function DocsPanel({ api }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => Promise.resolve(api.docsList()).then((r) => setRows(many(r))).catch(() => setRows([]));
  useEffect(() => { load(); }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  if (rows === null) return <div style={{ height: 120 }} />;
  const by = Object.fromEntries(rows.map((r) => [r.kind, r]));
  const save = async () => {
    setBusy(true);
    try { await api.docSave(edit.kind, edit.no, edit.exp || null); setEdit(null); await load(); } catch (_) { /* stays open */ }
    setBusy(false);
  };
  const tone = { ok: ["#ECFDF3", "#0F6B33"], soon: ["#FFF7E0", "#8A5A00"], expired: ["#FEF2F2", "#B91C1C"], none: ["#F3F4F6", "#6B7280"] };
  return (
    <div>
      {DOC_KINDS.map(([k, key]) => {
        const r = by[k]; const st = docStatus(r && r.expires_on); const c = tone[st.key];
        return (
          <button key={k} onClick={() => setEdit({ kind: k, no: (r && r.doc_no) || "", exp: (r && r.expires_on) || "" })} style={{ ...card, display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", padding: "14px 16px", marginBottom: 10 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: T.ink }}>{t(key)}</span>
              <span style={{ display: "block", fontSize: 13.5, color: T.inkSoft, marginTop: 2 }}>{r && r.doc_no ? r.doc_no : "—"}{r && r.expires_on ? ` · ${new Date(r.expires_on).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}` : ""}</span>
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 800, padding: "5px 11px", borderRadius: 14, background: c[0], color: c[1], whiteSpace: "nowrap" }}>
              {st.key === "none" ? t("dc_missing") : st.key === "expired" ? t("dc_expired") : st.key === "soon" ? String(t("dc_soon")).replace("{n}", st.days) : "✓"}
            </span>
          </button>
        );
      })}
      {edit && (
        <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setEdit(null); }} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "22px 22px 0 0", width: "100%", maxWidth: 480, padding: "18px 18px calc(22px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>{t(DOC_KINDS.find((x) => x[0] === edit.kind)[1])}</h2>
            <div style={label}>{t("dc_no")}</div>
            <input style={field} value={edit.no} maxLength={40} onChange={(e) => setEdit({ ...edit, no: e.target.value.toUpperCase() })} />
            <div style={label}>{t("dc_expires")}</div>
            <input type="date" style={field} value={edit.exp} onChange={(e) => setEdit({ ...edit, exp: e.target.value })} />
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <Btn kind="ghost" onClick={() => setEdit(null)} style={{ flex: 1 }}>{t("sos_close")}</Btn>
              <Btn onClick={save} disabled={busy} style={{ flex: 1 }}>{busy ? "…" : t("p_save")}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BankPanel({ api }) {
  const { t } = useI18n();
  const [cur, setCur] = useState(undefined);
  const [f, setF] = useState({ holder: "", acct: "", acct2: "", ifsc: "", bank: "" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => Promise.resolve(api.bankGet()).then((r) => setCur(one(r) || null)).catch(() => setCur(null));
  useEffect(() => { load(); }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  if (cur === undefined) return <div style={{ height: 120 }} />;
  const set = (k, v) => { setMsg(null); setF((p) => ({ ...p, [k]: v })); };
  const save = async () => {
    if (!/^[0-9]{6,18}$/.test(f.acct)) return setMsg({ tone: "bad", text: t("bnk_bad_acct") });
    if (f.acct !== f.acct2) return setMsg({ tone: "bad", text: t("bnk_mismatch") });
    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(f.ifsc.trim())) return setMsg({ tone: "bad", text: t("bnk_bad_ifsc") });
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.bankSave(f.holder.trim(), f.acct, f.ifsc.trim().toUpperCase(), f.bank.trim()));
      if (r && r.ok) { setF({ holder: "", acct: "", acct2: "", ifsc: "", bank: "" }); setMsg({ tone: "good", text: t("p_saved") }); load(); }
      else setMsg({ tone: "bad", text: t("e_save") });
    } catch (e) { setMsg({ tone: "bad", text: (e && e.message) || t("e_save") }); }
    setBusy(false);
  };
  return (
    <div>
      <div style={{ ...card, background: T.brandSoft, border: "none", fontSize: 14.5, lineHeight: 1.55, color: T.brandDeep, fontWeight: 600 }}>{t("bnk_note")}</div>
      {cur && <div style={{ ...card, fontWeight: 800, fontSize: 16 }}>{String(t("bnk_saved_as")).replace("{n}", cur.last4)}<div style={{ fontWeight: 600, fontSize: 14, color: T.inkSoft, marginTop: 2 }}>{cur.holder} {"·"} {cur.ifsc}</div></div>}
      <div style={label}>{t("bnk_holder")}</div>
      <input style={field} value={f.holder} maxLength={80} onChange={(e) => set("holder", e.target.value)} />
      <div style={label}>{t("bnk_acct")}</div>
      <input style={field} inputMode="numeric" value={f.acct} maxLength={18} onChange={(e) => set("acct", e.target.value.replace(/\D/g, ""))} />
      <div style={label}>{t("bnk_acct2")}</div>
      <input style={field} inputMode="numeric" value={f.acct2} maxLength={18} onChange={(e) => set("acct2", e.target.value.replace(/\D/g, ""))} />
      <div style={label}>{t("bnk_ifsc")}</div>
      <input style={field} value={f.ifsc} maxLength={11} autoCapitalize="characters" onChange={(e) => set("ifsc", e.target.value.toUpperCase())} />
      <div style={label}>{t("bnk_bank")}</div>
      <input style={field} value={f.bank} maxLength={60} onChange={(e) => set("bank", e.target.value)} />
      {msg && <div style={{ margin: "14px 0 0" }}><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <div style={{ marginTop: 16 }}><Btn full onClick={save} disabled={busy || f.holder.trim().length < 2} style={{ minHeight: 54, fontSize: 17 }}>{busy ? "…" : t("p_save")}</Btn></div>
    </div>
  );
}

// ------------------------------------------------------------ report + invoice
const csvCell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
export function exportCsv(rows, name) {
  const head = ["Date", "Customer / place", "Details", "Amount (INR)"];
  const lines = [head.map(csvCell).join(",")].concat(rows.map((r) => [r.at ? new Date(r.at).toISOString().slice(0, 10) : "", r.title, (r.lines || []).map((l) => `${l.qty} x ${l.name}`).join("; ") || r.sub || r.drop || "", (Number(r.paise) || 0) / 100].map(csvCell).join(",")));
  const total = rows.reduce((s, r) => s + (Number(r.paise) || 0), 0) / 100;
  lines.push(["", "", "Total", total].map(csvCell).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `${name || "dhundo-report"}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const esc = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function openInvoice({ biz, gst, row, t }) {
  const w = window.open("", "_blank");
  if (!w) return;
  const rows = (row.lines || []).map((l) => `<tr><td>${esc(l.name)}</td><td style="text-align:right">${esc(l.qty)}</td></tr>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(t("iv_invoice"))}</title>
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px;margin:28px auto;padding:0 18px;color:#111}h1{font-size:24px;margin:0 0 4px}.m{color:#555;font-size:14px}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{padding:9px 6px;border-bottom:1px solid #ddd;text-align:left;font-size:15px}.t{font-size:22px;font-weight:800;text-align:right}@media print{button{display:none}}</style></head><body>
<h1>${esc(biz)}</h1>${gst ? `<div class="m">GST: ${esc(gst)}</div>` : ""}
<div class="m" style="margin-top:12px">${esc(t("iv_invoice"))} · ${row.at ? esc(new Date(row.at).toLocaleString()) : ""}</div>
<div class="m">${esc(row.title)}</div>
<table><tr><th>${esc(t("iv_item"))}</th><th style="text-align:right">${esc(t("iv_qty"))}</th></tr>${rows || `<tr><td>${esc(row.sub || row.title)}</td><td></td></tr>`}</table>
<div class="t">₹${((Number(row.paise) || 0) / 100).toLocaleString("en-IN")}</div>
<p class="m">${esc(t("iv_thanks"))}</p><button onclick="window.print()" style="margin-top:12px;padding:12px 22px;font-size:16px">${esc(t("iv_print"))}</button></body></html>`);
  w.document.close();
}

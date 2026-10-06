// ---------------------------------------------------------------------------
// Pay scale: the worker or driver lists the rates they work for and the
// customer chooses one when booking, instead of typing a price.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from "react";
import { T, Btn, Notice, input, useDismissable, CloseButton } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const one = (r) => (Array.isArray(r) ? r[0] : r);
const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
export const UNITS = ["hour", "day", "week", "month", "trip", "km", "job"];
export const rateText = (r, t) => `₹${r.rupees} / ${t("rt_u_" + r.unit)}`;

// A bottom sheet with a form in it, used for the driver and worker settings so
// the dashboard stays a short summary and the fields live in a proper form.
export function FormSheet({ title, onClose, children }) {
  useDismissable(true, onClose);
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 580, background: "rgba(15,20,25,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box", padding: "16px 16px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0, color: T.ink }}>{title}</h2>
          <CloseButton onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

export function RatesCard({ api }) {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ label: "", rupees: "", unit: "hour" });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = useCallback(async () => { try { setRows(many(await api.myRates())); } catch (_) {} }, [api]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.rateSave({ label: f.label, unit: f.unit, rupees: Number(f.rupees) }));
      if (r && r.ok) { setF((x) => ({ ...x, label: "", rupees: "" })); setOpen(false); load(); }
      else setMsg(r && r.reason === "too_many" ? t("rt_max") : t("e_save"));
    } catch (e) { setMsg((e && e.message) || t("e_save")); }
    setBusy(false);
  };
  const del = async (id) => { try { await api.rateDelete(id); } catch (_) {} load(); };
  return (
    <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 14px 12px", margin: "14px 0" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px", color: T.ink }}>{t("rt_title")}</h2>
      <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 10px" }}>{t("rt_sub")}</p>
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: T.ink }}>{r.label}</span>
          <span style={{ fontWeight: 800, fontSize: 15, color: T.brandDark }}>{rateText(r, t)}</span>
          <button onClick={() => del(r.id)} aria-label={t("rt_remove")} style={{ background: "none", border: "none", color: T.inkSoft, fontWeight: 700, cursor: "pointer", minHeight: 40, fontFamily: "inherit" }}>{t("rt_remove")}</button>
        </div>
      ))}
      <div style={{ marginTop: 10 }}><Btn full kind="ghost" onClick={() => { setMsg(null); setOpen(true); }}>+ {t("rt_add")}</Btn></div>
      {open && (
        <FormSheet title={t("rt_title")} onClose={() => setOpen(false)}>
          <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>{t("rt_sub")}</p>
      <input style={{ ...input, margin: "0 0 10px" }} value={f.label} maxLength={40} placeholder={t("rt_label_ph")} aria-label={t("rt_label_ph")}
             onChange={(e) => setF((x) => ({ ...x, label: e.target.value }))} />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input style={{ ...input, flex: 1 }} value={f.rupees} inputMode="numeric" maxLength={7} placeholder={t("rt_amount")} aria-label={t("rt_amount")}
               onChange={(e) => setF((x) => ({ ...x, rupees: e.target.value.replace(/\D/g, "") }))} />
        <select style={{ ...input, flex: 1 }} value={f.unit} onChange={(e) => setF((x) => ({ ...x, unit: e.target.value }))}>
          {UNITS.map((u) => <option key={u} value={u}>{"/ " + t("rt_u_" + u)}</option>)}
        </select>
      </div>
      {msg && <div style={{ marginBottom: 8 }}><Notice tone="bad">{msg}</Notice></div>}
      <Btn full disabled={busy || f.label.trim().length < 2 || !(Number(f.rupees) >= 1)} onClick={add}>{busy ? "…" : t("rt_add")}</Btn>
        </FormSheet>
      )}
    </div>
  );
}

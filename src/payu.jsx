// ONLINE PAYMENT (PayU): UPI, cards, net banking. The server decides the
// amount and signs the request; this posts it to PayU's page. PayU sends the
// person back to the app, and our server is told the result directly, so a
// payment is only shown as paid once the server has marked it.
import React, { useEffect, useState } from "react";
import { Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

// Posts the signed fields to PayU. The page navigates away.
function postToPayu(action, fields) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  Object.keys(fields).forEach((k) => {
    const i = document.createElement("input");
    i.type = "hidden"; i.name = k; i.value = String(fields[k] == null ? "" : fields[k]);
    form.appendChild(i);
  });
  document.body.appendChild(form);
  form.submit();
}

// A "Pay now" button that shows the outcome in words.
export function PayOnline({ api, purpose, refId, onPaid = null, full = false, style }) {
  const { t } = useI18n();
  const [state, setState] = useState("idle"); // idle | busy | error | off
  const [already, setAlready] = useState(false);
  const [bal, setBal] = useState(0);
  const [low, setLow] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.walletBalance ? api.walletBalance() : 0).then((b) => { if (alive) setBal(Array.isArray(b) ? Number(b[0] || 0) : Number(b || 0)); }).catch(() => {});
    return () => { alive = false; };
  }, [api]);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.paymentStatus ? api.paymentStatus(purpose, refId) : "unpaid").then((s) => { if (alive && s === "paid") { setAlready(true); onPaid && onPaid(); } }).catch(() => {});
    return () => { alive = false; };
  }, [api, purpose, refId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!api.payCreate) return null;
  if (already) return <span style={{ fontSize: 14, fontWeight: 800, color: "#157A43", ...style }}>{"\u2713 "}{t("po_done")}</span>;
  const go = async () => {
    setState("busy");
    let r = null;
    try { r = await api.payCreate(purpose, refId); } catch (_) { r = null; }
    if (!r || !r.ok) { setState(r && r.reason === "not_configured" ? "off" : "error"); return; }
    postToPayu(r.action, r.fields);
  };
  const fromWallet = async () => {
    setState("busy"); setLow(false);
    try {
      const r = await api.walletPay(purpose, refId);
      const x = Array.isArray(r) ? r[0] : r;
      if (x && x.ok) { setAlready(true); try { window.dispatchEvent(new Event("dhundo:paid")); } catch (_) { /* no window */ } onPaid && onPaid(); return; }
      if (x && x.reason === "insufficient") setLow(true); else setState("error");
      if (x && x.reason === "insufficient") setState("idle");
    } catch (_) { setState("error"); }
  };
  return (
    <span style={{ display: full ? "block" : "inline-block", ...style }}>
      <Btn full={full} disabled={state === "busy"} onClick={go}>{state === "busy" ? t("po_wait") : t("po_pay")}</Btn>
      {bal > 0 && api.walletPay && <span style={{ display: full ? "block" : "inline-block", marginLeft: full ? 0 : 8, marginTop: full ? 8 : 0 }}><Btn full={full} kind="ghost" disabled={state === "busy"} onClick={fromWallet}>{String(t("po_wallet")).replace("{n}", `\u20B9${(bal / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`)}</Btn></span>}
      {low && <span role="alert" style={{ display: "block", fontSize: 13, color: "#B45309", fontWeight: 700, marginTop: 4 }}>{t("po_low")}</span>}
      {state === "error" && <span role="alert" style={{ display: "block", fontSize: 13, color: "#B91C1C", fontWeight: 700, marginTop: 4 }}>{t("po_err")}</span>}
      {state === "off" && <span role="alert" style={{ display: "block", fontSize: 13, color: "#B91C1C", fontWeight: 700, marginTop: 4 }}>{t("po_off")}</span>}
    </span>
  );
}

// What the page says when PayU sends the person back (?pay=ok|failed).
export function usePayReturn() {
  const [r, setR] = useState(null);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const v = q.get("pay");
      if (v) {
        setR({ ok: v === "ok", review: v === "review", purpose: q.get("purpose") || "", ref: q.get("ref") || "" });
        q.delete("pay"); q.delete("purpose"); q.delete("ref");
        const rest = q.toString();
        window.history.replaceState({}, "", window.location.pathname + (rest ? "?" + rest : "") + window.location.hash);
      }
    } catch (_) { /* no query string to read */ }
  }, []);
  return [r, () => setR(null)];
}

// "Add money" on the wallet screen: pick an amount, pay through PayU, and the
// balance rises once PayU confirms.
export function AddMoney({ api }) {
  const { t } = useI18n();
  const [amt, setAmt] = useState("500");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!api.payCreate) return null;
  const n = Number(amt) || 0;
  const go = async () => {
    if (n < 10 || n > 50000) { setErr(t("am_range")); return; }
    setBusy(true); setErr("");
    let r = null;
    try { r = await api.payCreate("topup", null, n); } catch (_) { r = null; }
    if (!r || !r.ok) { setBusy(false); setErr(r && r.reason === "not_configured" ? t("po_off") : t("po_err")); return; }
    postToPayu(r.action, r.fields);
  };
  return (
    <div style={{ marginBottom: 14, padding: "14px", borderRadius: 14, background: "#F2F7FE", border: "1px solid #CFE0F7" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#0B3A78", marginBottom: 8 }}>{t("am_title")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {[100, 500, 1000, 2000].map((v) => (
          <button key={v} onClick={() => { setAmt(String(v)); setErr(""); }} aria-pressed={n === v} style={{ minHeight: 40, padding: "0 14px", borderRadius: 20, fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer", border: `1.5px solid ${n === v ? "#0A5BB8" : "#CFE0F7"}`, background: n === v ? "#0A5BB8" : "#fff", color: n === v ? "#fff" : "#0B3A78" }}>{"\u20B9"}{v}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input inputMode="numeric" maxLength={5} value={amt} onChange={(e) => { setErr(""); setAmt(e.target.value.replace(/\D/g, "")); }} aria-label={t("am_title")}
               style={{ flex: 1, minHeight: 46, fontSize: 17, fontWeight: 700, padding: "0 12px", borderRadius: 12, border: "1px solid #B8C9E0", fontFamily: "inherit" }} />
        <Btn disabled={busy || n < 10} onClick={go}>{busy ? t("po_wait") : t("am_add")}</Btn>
      </div>
      {err && <div role="alert" style={{ color: "#B91C1C", fontSize: 13, fontWeight: 700, marginTop: 6 }}>{err}</div>}
      <div style={{ fontSize: 12.5, color: "#4B6A94", marginTop: 6, lineHeight: 1.45 }}>{t("am_note")}</div>
    </div>
  );
}

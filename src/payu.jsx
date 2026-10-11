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
  return (
    <span style={{ display: full ? "block" : "inline-block", ...style }}>
      <Btn full={full} disabled={state === "busy"} onClick={go}>{state === "busy" ? t("po_wait") : t("po_pay")}</Btn>
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
        setR({ ok: v === "ok", purpose: q.get("purpose") || "", ref: q.get("ref") || "" });
        q.delete("pay"); q.delete("purpose"); q.delete("ref");
        const rest = q.toString();
        window.history.replaceState({}, "", window.location.pathname + (rest ? "?" + rest : "") + window.location.hash);
      }
    } catch (_) { /* no query string to read */ }
  }, []);
  return [r, () => setR(null)];
}

// RECEIPT and PAY-BY-QR. The receipt shows what the customer paid and when. The QR
// opens the app on the customer's phone at their order, where they pay online; the
// money goes to Dhundo's account and is shared out after delivery, never straight
// to the rider or the shop.
import React, { useEffect, useState } from "react";
import { T, CloseButton, useDismissable } from "./ui.jsx";
import { PayOnline } from "./payu.jsx";
import { useI18n } from "./i18n.jsx";
import { Fold } from "./orderui.jsx";

const rs = (p) => `₹${(Number(p) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function Receipt({ api, purpose, refId }) {
  const { t } = useI18n();
  const [r, setR] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.paymentReceipt ? api.paymentReceipt(purpose, refId) : null)
      .then((x) => { const y = Array.isArray(x) ? x[0] : x; if (alive && y && y.paid_at) setR(y); }).catch(() => {});
    return () => { alive = false; };
  }, [api, purpose, refId]);
  if (!r) return null;
  const row = (k, v) => (
    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, color: T.inkSoft, padding: "2px 0" }}>
      <span>{k}</span><span style={{ color: T.ink, fontWeight: 700, textAlign: "right", overflowWrap: "anywhere" }}>{v}</span>
    </div>
  );
  return (
    <Fold title={t("rcp_title")} right={rs(r.amount_paise)}>
      {row(t("rc_status"), "✓ " + t("po_done"))}
      {row(t("rc_when"), new Date(r.paid_at).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }))}
      {row(t("rc_via"), r.via === "wallet" ? t("rc_via_wallet") : t("rc_via_online"))}
      {r.via !== "wallet" && r.gateway_id ? row(t("rc_ref"), r.gateway_id) : null}
    </Fold>
  );
}

// The rider shows this when the customer wants to pay by UPI instead of cash.
export function PayQr({ orderId, purpose = "order", refId = null, startOpen = false }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(startOpen);
  const [img, setImg] = useState("");
  const link = `${window.location.origin}/?${purpose === "ride" ? "payride" : "payorder"}=${encodeURIComponent(refId || orderId)}`;
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    import("qrcode").then((m) => (m.default || m).toDataURL(link, { width: 240, margin: 1, errorCorrectionLevel: "M" }))
      .then((u) => { if (alive) setImg(u); }).catch(() => {});
    return () => { alive = false; };
  }, [open, link]);
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ background: "none", border: "none", color: T.brandDark, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 0, minHeight: 40 }}>{open ? t("qr_hide") : t("rqr_btn")}</button>
      {open && (
        <div style={{ textAlign: "center", padding: 12, borderRadius: 14, background: "#F6F9FE", border: "1px solid #D6E3F5" }}>
          {img ? <img src={img} alt="QR" width={220} height={220} style={{ background: "#fff", padding: 8, borderRadius: 12 }} /> : <div style={{ height: 220 }} />}
          <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 6, lineHeight: 1.5 }}>{t(purpose === "ride" ? "rqr_hint_ride" : "rqr_hint")}</div>
        </div>
      )}
    </div>
  );
}

// Opened by scanning the driver's QR: pay for the ride in the app.
export function PayLinkSheet({ api, purpose, refId, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 620, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, padding: "16px 16px calc(20px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ flex: 1, fontSize: 19, fontWeight: 800, color: T.ink }}>{t("plk_title")}</div>
          <CloseButton onClick={onClose} />
        </div>
        <PayOnline api={api} purpose={purpose} refId={refId} full onPaid={onClose} />
      </div>
    </div>
  );
}

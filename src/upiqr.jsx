// PAY BY UPI QR. Scan the code with any UPI app (on another phone or screen),
// or tap to open a UPI app on this phone. The money goes straight to the UPI id
// shown; nothing passes through DhundoNow, so the person taps "I have paid" after.
import React, { useEffect, useState } from "react";
import { T, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

export const upiLink = ({ upi, name, amount, note }) =>
  `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent((name || "DhundoNow").slice(0, 40))}` +
  `${amount ? `&am=${Number(amount).toFixed(2)}` : ""}&cu=INR${note ? `&tn=${encodeURIComponent(String(note).slice(0, 40))}` : ""}`;

export function UpiQr({ upi, name, amount, note }) {
  const { t } = useI18n();
  const [img, setImg] = useState("");
  const [copied, setCopied] = useState(false);
  const link = upiLink({ upi, name, amount, note });
  useEffect(() => {
    let alive = true;
    import("qrcode").then((m) => (m.default || m).toDataURL(link, { width: 240, margin: 1, errorCorrectionLevel: "M" }))
      .then((u) => { if (alive) setImg(u); }).catch(() => {});
    return () => { alive = false; };
  }, [link]);
  const copy = async () => { try { await navigator.clipboard.writeText(upi); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_) {} };
  return (
    <div style={{ textAlign: "center", padding: "12px", borderRadius: 14, background: "#F6F9FE", border: "1px solid #D6E3F5" }}>
      {img ? <img src={img} alt="UPI QR" width={220} height={220} style={{ background: "#fff", padding: 8, borderRadius: 12, border: `1px solid ${T.line}` }} /> : <div style={{ height: 220 }} />}
      {amount ? <div style={{ fontSize: 22, fontWeight: 800, color: T.ink, marginTop: 6 }}>{"₹"}{Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div> : null}
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 2 }}>{t("qr_scan")}</div>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0B3A78", margin: "6px 0" }}>{upi}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <a href={link} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 18px", borderRadius: 22, background: "#15803D", color: "#fff", fontWeight: 800, fontSize: 14.5, textDecoration: "none" }}>{t("qr_open")}</a>
        <Btn kind="ghost" onClick={copy}>{copied ? t("qr_copied") : t("qr_copy")}</Btn>
      </div>
    </div>
  );
}

// On an order card: "Pay the shop with a UPI QR", using the shop's own UPI id.
export function OrderUpiQr({ api, workerId, shopName, amount, note }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [upi, setUpi] = useState(null);
  const [none, setNone] = useState(false);
  const show = async () => {
    setOpen((v) => !v);
    if (upi || none) return;
    try {
      const r = await api.storePay(workerId);
      const x = Array.isArray(r) ? r[0] : r;
      if (x && x.accepts_upi && x.upi_id) setUpi(x.upi_id); else setNone(true);
    } catch (_) { setNone(true); }
  };
  return (
    <div style={{ margin: "6px 0" }}>
      <Btn kind="ghost" onClick={show}>{open ? t("qr_hide") : t("qr_show")}</Btn>
      {open && (none
        ? <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 6 }}>{t("qr_none")}</div>
        : upi ? <div style={{ marginTop: 8 }}><UpiQr upi={upi} name={shopName} amount={amount} note={note} /></div> : <div style={{ marginTop: 6 }}>{"…"}</div>)}
    </div>
  );
}

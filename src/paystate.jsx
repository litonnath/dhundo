// WHO HAS PAID, for rides and for the delivery partner fee. The driver or rider
// sees "Paid online (confirmed)", "Paid (confirmed by you)" or "Not paid yet",
// and can confirm cash or UPI received. At the end the customer who has not
// paid sees a UPI QR for the driver or rider (like Rapido), and can also pay
// in the app (PayU or wallet).
import React, { useEffect, useState } from "react";
import { T, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { PayOnline } from "./payu.jsx";
import { UpiQr } from "./upiqr.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const rs = (p) => `₹${(Number(p || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function usePoll(fn, deps, ms = 6000) {
  const [v, setV] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const pull = async () => { try { const r = await fn(); if (alive) setV(r); } catch (_) { /* next try */ } };
    pull();
    const id = setInterval(pull, ms);
    return () => { alive = false; clearInterval(id); };
  }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, () => setTick((n) => n + 1)];
}

const box = (tone) => ({
  margin: "10px 0", padding: "10px 12px", borderRadius: 12,
  background: tone === "good" ? "#ECFDF3" : "#FFF7E6", border: `1px solid ${tone === "good" ? "#A7E3BE" : "#F3D48A"}`,
  color: tone === "good" ? "#0F6B33" : "#7A4A00",
});

// The driver's (or rider's) view: paid or not, and a button to confirm money received.
function ReceiverBox({ paid, via, amount, label, onConfirm, t }) {
  const [busy, setBusy] = useState(false);
  if (paid) {
    return <div style={{ ...box("good"), fontWeight: 800, fontSize: 14.5 }}>{"✓ "}{via === "online" ? t("ps_paid_online") : t("ps_paid_confirmed")}{amount ? ` · ${rs(amount)}` : ""}</div>;
  }
  return (
    <div style={box("wait")}>
      <div style={{ fontWeight: 800, fontSize: 14.5 }}>{label}{amount ? ` · ${rs(amount)}` : ""}</div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{t("ps_not_paid")}</div>
      <div style={{ marginTop: 8 }}><Btn disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } catch (_) {} setBusy(false); }}>{t("ps_received")}</Btn></div>
    </div>
  );
}

export function RideDriverPay({ api, rideId }) {
  const { t } = useI18n();
  const [f, again] = usePoll(async () => many(await api.ridePayFlags([rideId]))[0], [rideId]);
  if (!f || !f.is_driver) return null;
  return <ReceiverBox t={t} paid={f.paid} via={f.via} amount={f.fare_paise} label={t("ps_fare")} onConfirm={async () => { await api.rideMarkPaid(rideId); again(); }} />;
}

// The passenger's end-of-ride payment: paid, or QR / app / wallet.
export function RidePassengerPay({ api, rideId }) {
  const { t } = useI18n();
  const [f, again] = usePoll(async () => many(await api.ridePayFlags([rideId]))[0], [rideId], 5000);
  if (!f || f.is_driver) return null;
  if (f.paid) return <div style={{ ...box("good"), fontWeight: 800 }}>{"✓ "}{f.via === "online" ? t("ps_paid_online") : t("ps_paid_confirmed")}</div>;
  return (
    <div style={{ margin: "8px 0" }}>
      <div style={{ ...box("wait"), fontWeight: 800 }}>{t("ps_pay_now")}{f.fare_paise ? ` · ${rs(f.fare_paise)}` : ""}</div>
      {f.upi_id && <UpiQr upi={f.upi_id} name={f.driver_name} amount={Number(f.fare_paise) / 100} note="Dhundo ride" />}
      <div style={{ margin: "8px 0" }}><PayOnline api={api} purpose="ride" refId={rideId} full onPaid={again} /></div>
    </div>
  );
}

// The rider's view of the delivery partner fee.
export function FeeRiderPay({ api, orderId }) {
  const { t } = useI18n();
  const [f, again] = usePoll(async () => many(await api.orderFeeFlags([orderId]))[0], [orderId]);
  if (!f || !f.is_rider) return null;
  return <ReceiverBox t={t} paid={f.paid} amount={f.fee_paise} label={t("ps_fee")} onConfirm={async () => { await api.orderFeeMarkPaid(orderId); again(); }} />;
}

// The customer's view: pay the rider by QR.
export function FeeCustomerPay({ api, orderId }) {
  const { t } = useI18n();
  const [f] = usePoll(async () => many(await api.orderFeeFlags([orderId]))[0], [orderId], 8000);
  const [open, setOpen] = useState(false);
  if (!f || f.is_rider) return null;
  if (f.paid) return <div style={{ ...box("good"), fontWeight: 800 }}>{"✓ "}{t("ps_fee_paid")}</div>;
  return (
    <div style={{ margin: "8px 0" }}>
      <div style={{ ...box("wait"), fontWeight: 800 }}>{t("ps_fee_pay")}{` · ${rs(f.fee_paise)}`}</div>
      {f.upi_id && (
        <>
          <Btn kind="ghost" onClick={() => setOpen((v) => !v)}>{open ? t("qr_hide") : t("ps_fee_qr")}</Btn>
          {open && <div style={{ marginTop: 8 }}><UpiQr upi={f.upi_id} name={f.rider_name} amount={Number(f.fee_paise) / 100} note="Dhundo delivery" /></div>}
        </>
      )}
    </div>
  );
}

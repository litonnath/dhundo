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

// Paying for a booked worker, a hired vehicle or an item. The worker (or seller)
// names the price and confirms money received in cash or by QR; the customer
// chooses how to pay: wallet, UPI or card in the app, a UPI QR, or cash.
export function PurposePay({ api, purpose, refId, suggest = 0 }) {
  const { t } = useI18n();
  const [f, again] = usePoll(async () => many(await api.payFlags(purpose, [refId]))[0], [purpose, refId], 7000);
  const [price, setPrice] = useState("");
  const [qr, setQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!f) return null;
  const amount = Number(f.amount_paise) || 0;
  const paidLine = f.paid ? <div style={{ ...box("good"), fontWeight: 800, fontSize: 14.5 }}>{"\u2713 "}{f.via === "online" ? t("ps_paid_online") : t("ps_paid_confirmed")}{amount ? ` \u00B7 ${rs(amount)}` : ""}</div> : null;
  if (f.is_receiver) {
    if (f.paid) return paidLine;
    return (
      <div style={box("wait")}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{amount ? `${t("ps_price")}: ${rs(amount)}` : t("ps_no_price")}</div>
        <div style={{ fontSize: 13, marginTop: 2 }}>{amount ? t("ps_not_paid") : t("ps_set_hint")}</div>
        {purpose === "booking" && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input inputMode="numeric" maxLength={6} value={price} placeholder={suggest ? `\u20B9${suggest}` : t("ps_price")} onChange={(e) => { setErr(""); setPrice(e.target.value.replace(/\D/g, "")); }}
                   style={{ flex: 1, minHeight: 44, fontSize: 16, padding: "0 12px", borderRadius: 12, border: "1px solid #E5C9B0", fontFamily: "inherit" }} />
            <Btn disabled={busy || !(Number(price) > 0)} onClick={async () => {
              setBusy(true); setErr("");
              try { const r = many(await api.bookingSetPrice(refId, Number(price)))[0]; if (r && r.ok) { setPrice(""); again(); } else setErr(t("e_save")); } catch (_) { setErr(t("e_save")); }
              setBusy(false);
            }}>{t("ps_set_price")}</Btn>
          </div>
        )}
        {err && <div role="alert" style={{ color: "#B91C1C", fontSize: 13, fontWeight: 700, marginTop: 4 }}>{err}</div>}
        {amount > 0 && <div style={{ marginTop: 8 }}><Btn onClick={async () => { try { await api.payMarkReceived(purpose, refId); } catch (_) {} again(); }}>{t("ps_received")}</Btn></div>}
      </div>
    );
  }
  if (f.paid) return paidLine;
  if (!amount) return <div style={{ ...box("wait"), fontSize: 13.5, fontWeight: 700 }}>{t("ps_wait_price")}</div>;
  return (
    <div style={{ margin: "8px 0" }}>
      <div style={{ ...box("wait"), fontWeight: 800 }}>{t("ps_pay_now")}{` \u00B7 ${rs(amount)}`}</div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#4B6A94", textTransform: "uppercase", letterSpacing: 0.5, margin: "6px 0 4px" }}>{t("ps_modes")}</div>
      <PayOnline api={api} purpose={purpose} refId={refId} onPaid={again} />
      {f.upi_id && (
        <div style={{ marginTop: 8 }}>
          <Btn kind="ghost" onClick={() => setQr((v) => !v)}>{qr ? t("qr_hide") : t("ps_mode_qr")}</Btn>
          {qr && <div style={{ marginTop: 8 }}><UpiQr upi={f.upi_id} name={f.other_name} amount={amount / 100} note={`Dhundo ${purpose}`} /></div>}
        </div>
      )}
      <div style={{ fontSize: 12.5, color: "#4B6A94", marginTop: 6 }}>{t("ps_mode_cash")}</div>
    </div>
  );
}

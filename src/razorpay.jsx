// ONLINE PAYMENT (Razorpay): UPI, scan-a-QR, cards. The server decides the
// amount and creates the Razorpay order; this opens Razorpay's checkout and then
// waits for our server to confirm the payment (Razorpay tells it directly).
import React, { useEffect, useState } from "react";
import { Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

let loading = null;
function loadCheckout() {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => { loading = null; resolve(false); };
    document.head.appendChild(s);
  });
  return loading;
}

// Returns "paid", "pending" (paid at the bank, our server not told yet),
// "dismissed", "off" (not set up) or "error".
export async function startPayment(api, purpose, ref, prefill = {}) {
  let order;
  try { order = await api.payCreate(purpose, ref); } catch (_) { return "error"; }
  if (!order || !order.ok) return order && order.reason === "not_configured" ? "off" : "error";
  if (!(await loadCheckout())) return "error";
  return new Promise((resolve) => {
    let done = false;
    const finish = async () => {
      if (done) return; done = true;
      for (let i = 0; i < 12; i++) {
        try { if ((await api.paymentStatus(purpose, ref)) === "paid") return resolve("paid"); } catch (_) {}
        await new Promise((r) => setTimeout(r, 1500));
      }
      resolve("pending");
    };
    const rz = new window.Razorpay({
      key: order.key_id, order_id: order.order_id, amount: order.amount, currency: "INR", name: "Dhundo",
      description: purpose === "ride" ? "Ride fare" : purpose === "item" ? "Item" : "Order",
      prefill: { contact: prefill.phone || "", name: prefill.name || "" },
      theme: { color: "#0A5BB8" },
      handler: () => { finish(); },
      modal: { ondismiss: () => { if (!done) { done = true; resolve("dismissed"); } } },
    });
    rz.on("payment.failed", () => { if (!done) { done = true; resolve("error"); } });
    rz.open();
  });
}

// A "Pay now (UPI / QR)" button that shows the outcome in words.
export function PayOnline({ api, purpose, refId, phone = "", name = "", onPaid = null, full = false, style }) {
  const { t } = useI18n();
  const [state, setState] = useState("idle"); // idle | busy | paid | pending | error | off
  const [already, setAlready] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.resolve(api.paymentStatus ? api.paymentStatus(purpose, refId) : "unpaid").then((s) => { if (alive && s === "paid") setAlready(true); }).catch(() => {});
    return () => { alive = false; };
  }, [api, purpose, refId]);
  if (!api.payCreate) return null;
  if (already || state === "paid") return <span style={{ fontSize: 14, fontWeight: 800, color: "#157A43", ...style }}>{"✓ "}{t("po_done")}</span>;
  const go = async () => {
    setState("busy");
    const r = await startPayment(api, purpose, refId, { phone, name });
    if (r === "paid") { setState("paid"); onPaid && onPaid(); }
    else setState(r === "dismissed" ? "idle" : r);
  };
  return (
    <span style={{ display: full ? "block" : "inline-block", ...style }}>
      <Btn full={full} disabled={state === "busy"} onClick={go}>{state === "busy" ? t("po_wait") : t("po_pay")}</Btn>
      {state === "pending" && <span role="status" style={{ display: "block", fontSize: 13, color: "#8A5A00", fontWeight: 700, marginTop: 4 }}>{t("po_pending")}</span>}
      {state === "error" && <span role="alert" style={{ display: "block", fontSize: 13, color: "#B91C1C", fontWeight: 700, marginTop: 4 }}>{t("po_err")}</span>}
      {state === "off" && <span role="alert" style={{ display: "block", fontSize: 13, color: "#B91C1C", fontWeight: 700, marginTop: 4 }}>{t("po_off")}</span>}
    </span>
  );
}

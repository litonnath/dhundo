// POPUPS: a message that appears inside the app, for the customer and for whoever did the work, when a ride is
// completed, an order is delivered, a booking is completed or a payment goes through. The server writes them; this
// reads them every few seconds (and straight after a payment) and shows them one by one until each is dismissed.
import React, { useEffect, useRef, useState } from "react";
import { T, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const rs = (p) => `₹${(Number(p) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const LOOK = {
  ride_done_c: ["#16A34A", "✓"], ride_done_p: ["#16A34A", "✓"],
  order_done_c: ["#16A34A", "✓"], order_done_p: ["#16A34A", "✓"],
  booking_done_c: ["#16A34A", "✓"], booking_done_p: ["#16A34A", "✓"],
  pay_ok: ["#0A5BB8", "₹"], pay_in: ["#0F8A3C", "₹"], cash_ok: ["#0A5BB8", "₹"], cash_in: ["#0F8A3C", "₹"],
};

export function Popups({ api }) {
  const { t } = useI18n();
  const [queue, setQueue] = useState([]);
  const shown = useRef(new Set());
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const rows = many(await api.popupsPending()).filter((x) => !shown.current.has(x.id));
        if (alive && rows.length) setQueue((q) => [...q, ...rows.filter((x) => !q.some((y) => y.id === x.id))]);
      } catch (_) { /* next tick */ }
    };
    pull();
    const timer = setInterval(() => { if (!document.hidden) pull(); }, 8000);
    const soon = () => { pull(); setTimeout(pull, 2500); };
    window.addEventListener("dhundo:paid", soon);
    document.addEventListener("visibilitychange", pull);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("dhundo:paid", soon); document.removeEventListener("visibilitychange", pull); };
  }, [api]);
  const cur = queue[0];
  useEffect(() => { if (cur) { try { navigator.vibrate && navigator.vibrate(180); } catch (_) { /* no vibration */ } } }, [cur && cur.id]);
  if (!cur) return null;
  const [color, mark] = LOOK[cur.kind] || ["#0A5BB8", "✓"];
  const close = () => {
    shown.current.add(cur.id);
    setQueue((q) => q.slice(1));
    Promise.resolve(api.popupsSeen([cur.id])).catch(() => {});
  };
  return (
    <div role="alertdialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 650, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.white, borderRadius: 22, width: "100%", maxWidth: 380, padding: "26px 22px 20px", textAlign: "center", boxShadow: "0 12px 40px rgba(0,0,0,.3)" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: color, color: "#fff", fontSize: 32, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>{mark}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, lineHeight: 1.3 }}>{t("pp_" + cur.kind)}</div>
        {cur.amount_paise ? <div style={{ fontSize: 26, fontWeight: 800, color, margin: "6px 0 0" }}>{rs(cur.amount_paise)}</div> : null}
        {queue.length > 1 && <div style={{ fontSize: 12.5, color: T.inkFaint, marginTop: 6 }}>+{queue.length - 1}</div>}
        <div style={{ marginTop: 16 }}><Btn full onClick={close}>{t("pp_ok")}</Btn></div>
      </div>
    </div>
  );
}

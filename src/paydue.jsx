// PAYMENT DUE: once a ride or a booking is finished and not yet paid, the customer sees a bar on every screen
// until it is paid (or the rider / worker confirms the cash). It opens the pay sheet: PayU or the wallet.
import React, { useEffect, useRef, useState } from "react";
import { T, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { PayLinkSheet } from "./receipt.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const rs = (p) => `₹${(Number(p) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function PaymentDue({ api, bookings = [] }) {
  const { t } = useI18n();
  const [due, setDue] = useState([]);
  const [open, setOpen] = useState(null);
  const hasDue = useRef(false);
  const bk = bookings.filter((x) => x.role === "customer" && x.status === "completed").map((x) => x.id).join(",");
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const out = [];
        const rides = many(await api.rideHistory()).filter((x) => x.role === "passenger" && x.status === "done" && Number(x.fare_paise) >= 100
          && x.done_at && Date.now() - new Date(x.done_at).getTime() < 3 * 86400000);
        if (rides.length) {
          const flags = many(await api.ridePayFlags(rides.map((x) => x.id)));
          flags.filter((f) => !f.paid && !f.is_driver).forEach((f) => out.push({ purpose: "ride", id: f.id, amount: f.fare_paise, name: f.driver_name }));
        }
        if (bk && api.payFlags) {
          const flags = many(await api.payFlags("booking", bk.split(",")));
          flags.filter((f) => !f.paid && !f.is_receiver && Number(f.amount_paise) >= 100).forEach((f) => out.push({ purpose: "booking", id: f.id, amount: f.amount_paise, name: f.other_name }));
        }
        if (alive) setDue(out);
      } catch (_) { /* next tick */ }
    };
    pull();
    // Quicker while something is due, and at once when a payment has just gone through.
    const timer = setInterval(() => { if (!document.hidden) pull(); }, hasDue.current ? 6000 : 20000);
    const onPaid = () => { pull(); setTimeout(pull, 2500); };
    window.addEventListener("dhundo:paid", onPaid);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("dhundo:paid", onPaid); };
  }, [api, bk, due.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  hasDue.current = due.length > 0;
  if (!due.length) return null;
  const d = due[0];
  return (
    <>
      <div role="status" style={{ position: "fixed", left: 12, right: 12, bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 450, maxWidth: 520, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 16, background: "#FFF4E0", border: "1.5px solid #F3B34C", boxShadow: "0 6px 20px rgba(0,0,0,.18)" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: "#7A4A00" }}>{t("due_title")} {"·"} {rs(d.amount)}{due.length > 1 ? ` (+${due.length - 1})` : ""}</span>
          {d.name && <span style={{ display: "block", fontSize: 12.5, color: "#7A4A00", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>}
        </span>
        <Btn onClick={() => setOpen(d)}>{t("pd_pay")}</Btn>
      </div>
      {open && <PayLinkSheet api={api} purpose={open.purpose} refId={open.id} onClose={() => { setOpen(null); try { window.dispatchEvent(new Event("dhundo:paid")); } catch (_) { /* no window */ } }} />}
    </>
  );
}

// CANCEL: a reason is asked for before an order or a delivery is cancelled,
// whoever cancels (customer, shop or restaurant, rider). Also the date and
// time shown on order cards.
import React, { useState } from "react";
import { T, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

export const dateTime = (d) => (d ? new Date(d).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

const REASONS = {
  customer: ["cn_c1", "cn_c2", "cn_c3", "cn_c4"],
  shop: ["cn_s1", "cn_s2", "cn_s3", "cn_s4"],
  rider: ["cn_r1", "cn_r2", "cn_r3", "cn_r4"],
};

// A link-style button that opens the reason sheet, then calls onConfirm(reason)
// and shows the error if it fails.
export function CancelButton({ role, label, onConfirm, style }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const reason = pick === "other" ? other.trim() : pick ? t(pick) : "";
  const go = async () => {
    if (reason.length < 2) return setErr(t("cn_need"));
    setBusy(true); setErr("");
    try {
      const r = await onConfirm(reason);
      const x = Array.isArray(r) ? r[0] : r;
      if (x && x.ok === false) throw new Error(x.reason || "no");
      setOpen(false);
    } catch (e) {
      const m = (e && e.message) || "";
      setErr(m === "already_picked_up" ? t("cn_picked")
        : m === "no_change" ? t("cn_err_done")
        : m === "not_allowed" ? t("cn_err_not_yours")
        : e && e.code ? m
        : /could not find the function|schema cache|does not exist|404/i.test(m) ? t("cn_err_update")
        : t("e_save"));
    }
    setBusy(false);
  };
  return (
    <>
      <button onClick={() => { setOpen(true); setErr(""); }} style={{ background: "none", border: "none", color: "#B91C1C", fontWeight: 800, cursor: "pointer", minHeight: 40, padding: 0, fontFamily: "inherit", fontSize: 14.5, ...style }}>{label || t("cn_cancel")}</button>
      {open && (
        <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}
             style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "22px 22px 0 0", width: "100%", maxWidth: 480, padding: "18px 18px calc(22px + env(safe-area-inset-bottom))", boxSizing: "border-box", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>{t("cn_why")}</h2>
            <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 10 }}>{t("cn_why_sub")}</div>
            {[...REASONS[role], "other"].map((k) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, fontSize: 15.5, fontWeight: 700, cursor: "pointer" }}>
                <input type="radio" name="cn-reason" checked={pick === k} onChange={() => { setPick(k); setErr(""); }} />
                {k === "other" ? t("cn_other") : t(k)}
              </label>
            ))}
            {pick === "other" && (
              <input autoFocus maxLength={200} value={other} onChange={(e) => setOther(e.target.value)} placeholder={t("cn_other_ph")}
                     style={{ width: "100%", boxSizing: "border-box", minHeight: 48, padding: "10px 12px", fontSize: 16, borderRadius: 11, border: `1.5px solid ${T.line}`, margin: "4px 0 6px", fontFamily: "inherit" }} />
            )}
            {err && <div role="alert" style={{ color: "#B91C1C", fontWeight: 700, fontSize: 14, margin: "6px 0" }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <Btn kind="ghost" onClick={() => setOpen(false)} disabled={busy} style={{ flex: 1 }}>{t("cn_keep")}</Btn>
              <button onClick={go} disabled={busy} style={{ flex: 1, minHeight: 50, borderRadius: 14, border: "none", background: "#B91C1C", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : t("cn_confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// "Cancelled by the shop: out of stock", for a cancelled order card.
export function CancelNote({ o }) {
  const { t } = useI18n();
  if (o.status !== "cancelled" && o.status !== "rejected") return null;
  const who = o.cancelled_by === "shop" ? t("cn_by_shop") : o.cancelled_by === "customer" ? t("cn_by_customer") : "";
  if (!who && !o.cancel_reason) return null;
  return <div style={{ fontSize: 13.5, color: "#B91C1C", fontWeight: 700, marginTop: 4 }}>{who}{o.cancel_reason ? `: ${o.cancel_reason}` : ""}</div>;
}

// Placed time, and the finished time once an order is over.
export function OrderDates({ o }) {
  const { t } = useI18n();
  const over = ["delivered", "rejected", "cancelled"].includes(o.status);
  return (
    <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>
      {t("cn_placed")}: {dateTime(o.created_at)}
      {over && o.updated_at ? ` · ${o.status === "delivered" ? t("cn_delivered_on") : t("cn_ended_on")}: ${dateTime(o.updated_at)}` : ""}
    </div>
  );
}

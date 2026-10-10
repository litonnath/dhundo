// ORDER UI: one look for every order and delivery card, for the customer, the
// restaurant or shop, and the rider: a header with the name and amount, a big
// status banner that says what is happening, a progress tracker, and the
// actions together at the bottom.
import React, { useState } from "react";
import { T } from "./ui.jsx";

const rup = (p) => `₹${(Number(p || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const cardStyle = {
  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "16px 16px 14px", marginBottom: 12,
  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
};

const TONES = {
  wait: { bg: "#FFFBF0", fg: "#92600A", line: "#F1D9A0", dot: "#D99A1F" },
  go: { bg: "#F3F7FD", fg: "#1E4E8C", line: "#CFDDF0", dot: "#2563EB" },
  good: { bg: "#F2FAF5", fg: "#166534", line: "#BEE3CB", dot: "#16A34A" },
  bad: { bg: "#FDF4F4", fg: "#A32424", line: "#EFC4C4", dot: "#DC2626" },
};

// Who and how much: a round initial, the name, a small line under it, and the
// amount on the right.
export function OrderHeader({ name, sub, amount }) {
  const ini = String(name || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 38, height: 38, borderRadius: 10, background: "#F1F3F6", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{ini}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: T.ink, lineHeight: 1.25, overflowWrap: "anywhere" }}>{name}</span>
        {sub && <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{sub}</span>}
      </span>
      {amount != null && <span style={{ fontSize: 16, fontWeight: 700, color: T.ink, flexShrink: 0 }}>{rup(amount)}</span>}
    </div>
  );
}

// The one thing to know right now, large, with an icon and an optional timer.
export function Banner({ tone = "go", title, sub, children }) {
  const c = TONES[tone] || TONES.go;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.line}`, borderLeft: `4px solid ${c.dot}`, borderRadius: 10, padding: "11px 14px", margin: "12px 0 6px" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: c.fg, lineHeight: 1.3 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: c.fg, opacity: 0.88, lineHeight: 1.45, marginTop: 3 }}>{sub}</div>}
      {children}
    </div>
  );
}

// Progress: dots joined by a line; done steps are green with a tick, the
// current one is larger and bold.
export function Steps({ steps, at }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", margin: "14px 0 10px" }}>
      {steps.map((label, i) => {
        const done = i < at, cur = i === at, on = i <= at;
        return (
          <div key={i} style={{ flex: 1, textAlign: "center", position: "relative", minWidth: 0 }}>
            {i > 0 && <span style={{ position: "absolute", top: 10, right: "50%", width: "100%", height: 2, background: i <= at ? "#166534" : "#E5E7EB" }} />}
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: on ? "#166534" : "#fff", border: on ? "none" : "2px solid #D1D5DB", color: on ? "#fff" : "#9CA3AF", fontSize: 11, fontWeight: 700, lineHeight: 1, boxShadow: cur ? "0 0 0 4px rgba(22,101,52,0.15)" : "none", boxSizing: "border-box" }}>
              {done ? "✓" : i + 1}
            </span>
            <div style={{ fontSize: 11.5, fontWeight: cur ? 700 : 500, color: on ? T.ink : T.inkFaint, lineHeight: 1.25, marginTop: 5, padding: "0 2px", overflowWrap: "anywhere" }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

// Items, in a tidy list.
export function ItemsBox({ lines }) {
  const rows = Array.isArray(lines) ? lines : [];
  if (rows.length === 0) return null;
  return (
    <div style={{ margin: "8px 0", borderTop: "1px solid #EEF0F3" }}>
      {rows.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, color: T.ink, padding: "7px 0", borderBottom: "1px solid #EEF0F3" }}>
          <span style={{ color: T.inkSoft, minWidth: 26, fontWeight: 600 }}>{l.qty}{"\u00D7"}</span>
          <span style={{ flex: 1, overflowWrap: "anywhere" }}>{l.name}</span>
        </div>
      ))}
    </div>
  );
}

// A folded part: closed shows the title, open shows the content.
export function Fold({ title, right, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ margin: "6px 0", borderTop: "1px solid #EEF0F4" }}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ display: "flex", alignItems: "center", width: "100%", minHeight: 44, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.ink }}>{title}</span>
        {right && <span style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, marginRight: 8 }}>{right}</span>}
        <span aria-hidden="true" style={{ color: T.inkSoft, fontSize: 13 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ paddingBottom: 8 }}>{children}</div>}
    </div>
  );
}

// The actions of a card, together at the bottom.
export function Actions({ children, style }) {
  return <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10, paddingTop: 12, borderTop: "1px solid #EEF0F4", ...style }}>{children}</div>;
}

export const callStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, padding: "0 16px", borderRadius: 10, background: "#166534", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none", boxSizing: "border-box", flex: "1 1 auto" };
export const outlineStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, padding: "0 16px", borderRadius: 10, background: "#fff", color: "#1E4E8C", border: "1px solid #B8C9E0", fontWeight: 600, fontSize: 14, textDecoration: "none", boxSizing: "border-box", flex: "1 1 auto" };

// Paid or unpaid, and how: a clear pill. method is 'cod' or 'upi'.
export function PayBadge({ method, paid, claimed, t, style }) {
  const how = method === "upi" ? "UPI" : t("pay_cod");
  let c = TONES.wait, text = `${t("pay_unpaid")} \u00B7 ${how}`;
  if (paid) { c = TONES.good; text = `${t("pay_paid")} \u00B7 ${how}`; }
  else if (method === "upi" && claimed) { c = TONES.go; text = t("pay_claimed"); }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "4px 11px", borderRadius: 999, background: c.bg, color: c.fg, border: `1px solid ${c.line}`, ...style }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />{text}
    </span>
  );
}

// Who gets what from one order: the shop, the rider, Dhundo and the GST for
// the government. The rider's share is the delivery job fee; whatever is left
// of the delivery charge stays with the shop (and the shop covers any shortfall).
export function splitOf(o) {
  const n = (v) => Number(v) || 0;
  const items = n(o.total_paise), delivery = n(o.delivery_fee_paise);
  // The delivery fee goes to the rider: the job fee once there is a job, the fee
  // the customer pays until then.
  const rider = o.rider_fee_paise != null ? n(o.rider_fee_paise) : o.mode === "delivery" ? delivery : 0;
  const platform = n(o.misc_fee_paise);
  const gst = n(o.gst_paise) + n(o.delivery_gst_paise) + n(o.misc_gst_paise);
  const shop = items + delivery - rider;
  return { shop, rider, platform, gst, total: shop + rider + platform + gst };
}

export function SplitBox({ o, t, who = "all" }) {
  const sp = splitOf(o);
  const row = (key, label, v, strong) => (
    <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: strong ? 15 : 14, fontWeight: strong ? 800 : 600, color: strong ? T.ink : T.inkSoft, padding: "3px 0" }}>
      <span>{label}</span><span>{rup(v)}</span>
    </div>
  );
  return (
    <div>
      {row("shop", t("sp_shop"), sp.shop)}
      {sp.rider > 0 && row("rider", t("sp_rider"), sp.rider)}
      {row("platform", t("sp_platform"), sp.platform)}
      {sp.gst > 0 && row("gst", t("sp_gst"), sp.gst)}
      <div style={{ borderTop: "1px solid #EEF0F4", marginTop: 4, paddingTop: 4 }}>{row("total", t("sp_total"), sp.total, true)}</div>
    </div>
  );
}

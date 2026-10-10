// ORDER UI: one look for every order and delivery card, for the customer, the
// restaurant or shop, and the rider: a header with the name and amount, a big
// status banner that says what is happening, a progress tracker, and the
// actions together at the bottom.
import React, { useState } from "react";
import { T } from "./ui.jsx";

const rup = (p) => `₹${(Number(p || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const cardStyle = {
  background: "#fff", border: "1px solid #E7EAF0", borderRadius: 20, padding: 16, marginBottom: 14,
  boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
};

const TONES = {
  wait: { bg: "#FFF7E6", fg: "#8A5A00", line: "#F5D58C" },
  go: { bg: "#EAF2FF", fg: "#0A4FA3", line: "#B9D4FA" },
  good: { bg: "#ECFDF3", fg: "#0F6B33", line: "#A7E3BE" },
  bad: { bg: "#FEF2F2", fg: "#B91C1C", line: "#FCA5A5" },
};

// Who and how much: a round initial, the name, a small line under it, and the
// amount on the right.
export function OrderHeader({ name, sub, amount }) {
  const ini = String(name || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 44, height: 44, borderRadius: 14, background: "#EAF2FF", color: "#0A4FA3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, flexShrink: 0 }}>{ini}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 17, fontWeight: 800, color: T.ink, lineHeight: 1.25, overflowWrap: "anywhere" }}>{name}</span>
        {sub && <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{sub}</span>}
      </span>
      {amount != null && <span style={{ fontSize: 18, fontWeight: 800, color: T.ink, flexShrink: 0 }}>{rup(amount)}</span>}
    </div>
  );
}

// The one thing to know right now, large, with an icon and an optional timer.
export function Banner({ tone = "go", icon, title, sub, children }) {
  const c = TONES[tone] || TONES.go;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.line}`, borderRadius: 16, padding: "12px 14px", margin: "12px 0 6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon && <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1 }}>{icon}</span>}
        <span style={{ flex: 1, minWidth: 0, fontSize: 16.5, fontWeight: 800, color: c.fg, lineHeight: 1.3 }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize: 13.5, color: c.fg, opacity: 0.9, lineHeight: 1.45, marginTop: 4 }}>{sub}</div>}
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
            {i > 0 && <span style={{ position: "absolute", top: 11, right: "50%", width: "100%", height: 3, background: i <= at ? "#16A34A" : "#E1E5EA" }} />}
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: cur ? 26 : 22, height: cur ? 26 : 22, marginTop: cur ? -2 : 0, borderRadius: "50%", background: on ? "#16A34A" : "#E1E5EA", color: "#fff", fontSize: 13, fontWeight: 800, lineHeight: 1, boxShadow: cur ? "0 0 0 5px rgba(22,163,74,0.18)" : "none" }}>
              {done ? "✓" : i + 1}
            </span>
            <div style={{ fontSize: 11.5, fontWeight: cur ? 800 : 600, color: on ? T.ink : T.inkFaint, lineHeight: 1.25, marginTop: 5, padding: "0 2px", overflowWrap: "anywhere" }}>{label}</div>
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
    <div style={{ margin: "8px 0", padding: "10px 12px", background: "#F7F8FA", borderRadius: 12 }}>
      {rows.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 8, fontSize: 14.5, color: T.ink, padding: "2px 0" }}>
          <span style={{ fontWeight: 800, minWidth: 28 }}>{l.qty} {"×"}</span>
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
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 800, color: T.brandDark }}>{title}</span>
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

export const callStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 46, padding: "0 16px", borderRadius: 14, background: "#16A34A", color: "#fff", fontWeight: 800, fontSize: 14.5, textDecoration: "none", boxSizing: "border-box", flex: "1 1 auto" };
export const outlineStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 46, padding: "0 16px", borderRadius: 14, background: "#fff", color: "#0A4FA3", border: "1.5px solid #0A4FA3", fontWeight: 800, fontSize: 14.5, textDecoration: "none", boxSizing: "border-box", flex: "1 1 auto" };

// Paid or unpaid, and how: a clear pill. method is 'cod' or 'upi'.
export function PayBadge({ method, paid, claimed, t, style }) {
  const how = method === "upi" ? "UPI" : t("pay_cod");
  let c = TONES.wait, text = `${t("pay_unpaid")} \u00B7 ${how}`, icon = "\u{1F4B5}";
  if (paid) { c = TONES.good; text = `${t("pay_paid")} \u00B7 ${how}`; icon = "\u2705"; }
  else if (method === "upi" && claimed) { c = TONES.go; text = t("pay_claimed"); icon = "\u{1F4F2}"; }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 800, padding: "5px 12px", borderRadius: 14, background: c.bg, color: c.fg, border: `1px solid ${c.line}`, ...style }}>
      <span aria-hidden="true">{icon}</span>{text}
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

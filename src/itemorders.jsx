// ---------------------------------------------------------------------------
// BUYING SECOND HAND, START TO FINISH. The buyer books an item (collect it, or
// the seller delivers), sees what it will cost, and the seller accepts or
// declines, naming a delivery charge if it is delivered. The buyer then gets a
// four digit handover code and gives it to the seller once the item is in
// their hands; the seller types it in and the sale is complete. Everything is
// paid in cash at the handover.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from "react";
import { T, Btn, Notice, input } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { FormSheet } from "./rates.jsx";
import { RideChat } from "./ridechat.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const one = (r) => (Array.isArray(r) ? r[0] : r);
const rs = (n) => "\u20B9" + Math.round(n).toLocaleString("en-IN");

export function BuySheet({ api, item, onClose, onSent, onHire }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("pickup");
  const [offer, setOffer] = useState(String(item.price));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sent, setSent] = useState(false);
  const price = item.negotiable && Number(offer) >= 1 && Number(offer) <= item.price ? Number(offer) : item.price;
  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.itemBuy(item.id, mode, price, note));
      if (r && r.ok) { setSent(true); onSent && onSent(); }
      else setMsg(r && r.reason === "already_open" ? t("mb_open") : t("e_save"));
    } catch (e) { setMsg((e && e.message) || t("e_save")); }
    setBusy(false);
  };
  const row = { display: "flex", justifyContent: "space-between", fontSize: 15, margin: "4px 0" };
  return (
    <FormSheet title={t("mb_sheet")} onClose={onClose}>
      {sent ? (
        <>
          <Notice tone="good">{t("mb_sent")}</Notice>
          <div style={{ marginTop: 12 }}><Btn full onClick={onClose}>{t("rdn_ok")}</Btn></div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{item.title}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[["pickup", "mb_mode_pick"], ["delivery", "mb_mode_deliv"]].map(([k, key]) => (
              <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} style={{
                flex: 1, minHeight: 46, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14,
                border: `1.5px solid ${mode === k ? T.brandDark : T.line}`, background: mode === k ? T.brandSoft : T.white, color: mode === k ? T.brandDark : T.ink,
              }}>{t(key)}</button>
            ))}
          </div>
          {item.negotiable && (
            <input style={{ ...input, marginBottom: 10 }} inputMode="numeric" maxLength={9} value={offer} placeholder={t("mb_offer")} aria-label={t("mb_offer")}
                   onChange={(e) => setOffer(e.target.value.replace(/\D/g, ""))} />
          )}
          <input style={{ ...input, marginBottom: 12 }} value={note} maxLength={250} placeholder={t("mb_note_ph")} aria-label={t("mb_note_ph")} onChange={(e) => setNote(e.target.value)} />
          <div style={{ background: "#F7F9FB", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
            <div style={row}><span>{t("mb_cost")}</span><b>{rs(price)}</b></div>
            {mode === "delivery" && <div style={row}><span>{t("mb_delivery")}</span><span style={{ color: T.inkSoft }}>{t("mb_delivery_set")}</span></div>}
            <div style={{ ...row, fontSize: 17, fontWeight: 800, borderTop: `1px solid ${T.line}`, paddingTop: 8, marginTop: 6 }}>
              <span>{t("mb_topay")}</span><span>{rs(price)}{mode === "delivery" ? " +" : ""}</span>
            </div>
          </div>
          {msg && <div style={{ marginBottom: 10 }}><Notice tone="bad">{msg}</Notice></div>}
          <Btn full disabled={busy} onClick={send}>{busy ? "\u2026" : t("mb_send")}</Btn>
          {onHire && <div style={{ marginTop: 8 }}><Btn full kind="ghost" onClick={onHire}>{t("mb_hire")}</Btn></div>}
        </>
      )}
    </FormSheet>
  );
}

const STATUS_COLOR = { requested: "#B45309", accepted: "#1D4ED8", completed: "#16A34A", declined: "#B91C1C", cancelled: "#6B7280" };

export function ItemOrdersSheet({ api, onClose, onHire }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(null);
  const [fee, setFee] = useState({});
  const [code, setCode] = useState({});
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState({});
  const load = useCallback(async () => {
    try { setRows(many(await api.myItemOrders())); } catch (_) { setRows((r) => r || []); }
  }, [api]);
  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [load]);
  const act = async (o, action, feeRs) => {
    setBusy(o.id);
    try { await api.itemOrderUpdate(o.id, action, feeRs); } catch (_) {}
    setBusy(null); load();
  };
  const complete = async (o) => {
    setBusy(o.id); setMsg((m) => ({ ...m, [o.id]: "" }));
    try {
      const r = one(await api.itemOrderComplete(o.id, code[o.id] || ""));
      if (!(r && r.ok)) setMsg((m) => ({ ...m, [o.id]: t("rv_wrong") }));
    } catch (_) { setMsg((m) => ({ ...m, [o.id]: t("rv_wrong") })); }
    setBusy(null); load();
  };
  const label = (o) => (o.status === "requested" ? (o.role === "buyer" ? t("mb_wait") : t("mb_new")) : o.status === "accepted" ? t("mb_accepted") : o.status === "completed" ? t("mb_done") : o.status === "declined" ? t("mb_declined") : t("mb_cancelled"));
  return (
    <FormSheet title={t("mb_mine")} onClose={onClose}>
      {rows === null && <div style={{ color: T.inkSoft }}>{"\u2026"}</div>}
      {rows && rows.length === 0 && <div style={{ fontSize: 14, color: T.inkFaint }}>{t("mb_none")}</div>}
      {(rows || []).map((o) => {
        const total = o.offer_rupees + Math.round((o.delivery_fee_paise || 0) / 100);
        return (
          <div key={o.id} style={{ border: `1px solid ${T.line}`, borderLeft: `4px solid ${STATUS_COLOR[o.status] || T.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ width: 54, height: 54, borderRadius: 10, flexShrink: 0, background: o.photo ? `center/cover url(${o.photo}) ${T.line}` : T.brandSoft }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.title}</span>
                <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft }}>{o.role === "buyer" ? t("mb_buying") : t("mb_selling")} {"\u00B7"} {o.other_name}</span>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: STATUS_COLOR[o.status] }}>{label(o)}</span>
              </span>
            </div>
            <div style={{ fontSize: 14, margin: "8px 0 2px" }}>
              {t("mb_cost")}: <b>{rs(o.offer_rupees)}</b>{o.offer_rupees !== o.list_price ? <span style={{ color: T.inkSoft }}> ({rs(o.list_price)})</span> : null}
              {" \u00B7 "}{t(o.mode === "delivery" ? "mb_mode_deliv" : "mb_mode_pick")}
            </div>
            {o.delivery_fee_paise > 0 && <div style={{ fontSize: 14 }}>{t("mb_delivery")}: <b>{rs(o.delivery_fee_paise / 100)}</b></div>}
            {["requested", "accepted"].includes(o.status) && (o.mode === "pickup" || o.delivery_fee_paise > 0) && (
              <div style={{ fontSize: 15.5, fontWeight: 800, margin: "2px 0 4px" }}>{t("mb_topay")}: {rs(total)}</div>
            )}
            {o.note && <div style={{ fontSize: 13, color: T.inkSoft, fontStyle: "italic" }}>{o.note}</div>}
            {o.other_phone && <a href={`tel:${o.other_phone}`} style={{ display: "inline-block", margin: "4px 0", color: T.brandDark, fontWeight: 700 }}>{o.other_phone}</a>}

            {o.role === "seller" && o.status === "requested" && (
              <div style={{ marginTop: 6 }}>
                {o.mode === "delivery" && (
                  <input style={{ ...input, marginBottom: 8 }} inputMode="numeric" maxLength={5} value={fee[o.id] || ""} placeholder={t("mb_fee_ph")} aria-label={t("mb_fee_ph")}
                         onChange={(e) => setFee((f) => ({ ...f, [o.id]: e.target.value.replace(/\D/g, "") }))} />
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn disabled={busy === o.id} onClick={() => act(o, "accept", o.mode === "delivery" ? Number(fee[o.id] || 0) : null)}>{t("mb_accept")}</Btn>
                  <Btn kind="ghost" disabled={busy === o.id} onClick={() => act(o, "decline")}>{t("mb_decline")}</Btn>
                </div>
              </div>
            )}
            {o.role === "buyer" && o.status === "accepted" && (
              <div style={{ background: "#F3F6FA", border: `1px solid ${T.line}`, borderRadius: 12, textAlign: "center", padding: "10px 12px", margin: "8px 0" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft }}>{t("mb_code_title")}</div>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 10, color: T.ink }}>{o.code || "\u2026"}</div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.45 }}>{t("mb_code_hint")}</div>
              </div>
            )}
            {o.role === "seller" && o.status === "accepted" && (
              <div style={{ background: "#FFF7E6", border: "1px solid #F3D48A", borderRadius: 12, padding: "10px 12px", margin: "8px 0" }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#7A4A00", marginBottom: 8 }}>{t("mb_code_enter")}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...input, flex: 1, marginBottom: 0, textAlign: "center", fontSize: 22, fontWeight: 800, letterSpacing: 8 }} inputMode="numeric" maxLength={4} value={code[o.id] || ""}
                         placeholder={"\u2022\u2022\u2022\u2022"} aria-label={t("mb_code_enter")} onChange={(e) => setCode((c) => ({ ...c, [o.id]: e.target.value.replace(/\D/g, "") }))} />
                  <Btn disabled={busy === o.id || (code[o.id] || "").length !== 4} onClick={() => complete(o)}>{t("mb_code_verify")}</Btn>
                </div>
                {msg[o.id] && <div style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C", marginTop: 8 }}>{msg[o.id]}</div>}
              </div>
            )}
            {["requested", "accepted"].includes(o.status) && <RideChat api={api} rideId={o.id} role={o.role} kind="buy" />}
            {["requested", "accepted"].includes(o.status) && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                {o.role === "buyer" && o.mode === "delivery" && <Btn kind="ghost" disabled={busy === o.id} onClick={() => act(o, "switch_pickup")}>{t("mb_pick_myself")}</Btn>}
                {o.role === "buyer" && onHire && <Btn kind="ghost" onClick={onHire}>{t("mb_hire")}</Btn>}
                {o.role === "buyer" && <Btn kind="ghost" disabled={busy === o.id} onClick={() => act(o, "cancel")}>{t("mb_cancelled")}</Btn>}
                {o.role === "seller" && o.status === "accepted" && <Btn kind="ghost" disabled={busy === o.id} onClick={() => act(o, "decline")}>{t("mb_decline")}</Btn>}
              </div>
            )}
          </div>
        );
      })}
    </FormSheet>
  );
}

// My bookings: the workers I asked to come to me (cooks, plumbers and so on).
// One card per request with who, for what, when, where and the answer so far.
import React, { useState } from "react";
import { T, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { cardStyle } from "./orderui.jsx";

const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
const stamp = (iso) => { try { return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (_) { return ""; } };
const TONE = { requested: ["#B45309", "#FFF4E0"], accepted: ["#15803D", "#E7F5EC"], declined: ["#B91C1C", "#FDECEC"], cancelled: ["#6B7280", "#F1F2F4"] };

export function MyBookings({ api, items, view, onChat, onChanged, asWorker = false }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(null);
  const mine = (items || []).filter((x) => x.role === (asWorker ? "worker" : "customer"));
  const list = mine.filter((x) => (view === "past" ? ["declined", "cancelled"].includes(x.status) : ["requested", "accepted"].includes(x.status)));
  if (!list.length) return <div style={{ color: T.inkSoft, padding: "14px 2px" }}>{t("mbk_empty")}</div>;
  const label = { requested: t(asWorker ? "mbk_needs_you" : "mbk_waiting"), accepted: t("mbk_accepted"), declined: t("mbk_declined"), cancelled: t("mbk_cancelled") };
  const answer = async (x, ok) => { setBusy(x.id); try { await api.bookingAnswer(x.id, ok); } catch (_) {} setBusy(null); onChanged && onChanged(); };
  const cancel = async (x) => { setBusy(x.id); try { await api.bookingCancel(x.id); } catch (_) {} setBusy(null); onChanged && onChanged(); };
  const money = (n) => `\u20B9${Number(n).toLocaleString("en-IN")}`;
  const rate = (x) => {
    const lo = Number(x.rate_min) || 0, hi = Number(x.rate_max) || 0;
    if (!lo && !hi) return "";
    return `${lo && hi && lo !== hi ? `${money(lo)} \u2013 ${money(hi)}` : money(lo || hi)} ${t("mbk_per_day")}`;
  };
  // A listed rate is per 8-hour day; the estimate is that rate for the hours asked.
  const estimate = (x) => {
    const lo = Number(x.rate_min) || 0, hi = Number(x.rate_max) || 0, m = Number(x.duration_mins) || 0;
    if ((!lo && !hi) || !m) return "";
    const f = (r) => Math.max(1, Math.round((r * m) / 480 / 10) * 10 || 10);
    const a = f(lo || hi), b = f(hi || lo);
    return `${a !== b ? `${money(a)} \u2013 ${money(b)}` : money(a)}`;
  };
  const row = (k, v) => v ? <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 3 }}><b style={{ color: T.ink }}>{k}</b> {v}</div> : null;
  return (
    <div>
      {list.map((x) => {
        const [fg, bg] = TONE[x.status] || TONE.cancelled;
        return (
          <div key={x.id} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 16.5, fontWeight: 800, color: T.ink }}>{x.other_name || x.trade_name}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, padding: "4px 10px", borderRadius: 12, color: fg, background: bg }}>{label[x.status] || x.status}</span>
            </div>
            {row(t("mbk_for"), x.trade_name)}
            {row(t(asWorker ? "mbk_rate_you" : "mbk_rate"), rate(x))}
            {estimate(x) && (
              <div style={{ margin: "8px 0 0", padding: "9px 12px", background: "#EEF4FD", border: "1px solid #CFE0F7", borderRadius: 10, fontSize: 13.5, color: "#0B3A78", lineHeight: 1.5 }}>
                <b>{String(t(asWorker ? "mbk_est_you" : "mbk_est")).replace("{len}", mins(x.duration_mins)).replace("{amt}", estimate(x))}</b>
                <div style={{ marginTop: 2 }}>{t(asWorker ? "mbk_est_note_you" : "mbk_est_note")}</div>
              </div>
            )}
            {row(t("mbk_when"), x.start_at ? `${stamp(x.start_at)}${x.duration_mins ? ` · ${mins(x.duration_mins)}` : ""}` : "")}
            {row(t("mbk_where"), x.note)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {["requested", "accepted"].includes(x.status) && x.other_phone && <a href={`tel:${x.other_phone}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 18px", borderRadius: 22, background: "#15803D", color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none" }}>{t("mbk_call")}</a>}
              {["requested", "accepted"].includes(x.status) && onChat && <Btn kind="ghost" onClick={() => onChat(x)}>{t("mbk_chat")}</Btn>}
              {asWorker && x.status === "requested" && <Btn disabled={busy === x.id} onClick={() => answer(x, true)}>{t("bk_accept")}</Btn>}
              {asWorker && x.status === "requested" && <Btn kind="ghost" disabled={busy === x.id} onClick={() => answer(x, false)}>{t("bk_decline")}</Btn>}
              {!asWorker && ["requested", "accepted"].includes(x.status) && <Btn kind="ghost" disabled={busy === x.id} onClick={() => cancel(x)}>{t("bk_cancel")}</Btn>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

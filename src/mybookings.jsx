// My bookings: the workers I asked to come to me (cooks, plumbers and so on).
// One card per request with who, for what, when, where and the answer so far.
import React, { useState } from "react";
import { T, Btn } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { cardStyle } from "./orderui.jsx";

const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
const stamp = (iso) => { try { return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (_) { return ""; } };
const TONE = { requested: ["#B45309", "#FFF4E0"], accepted: ["#15803D", "#E7F5EC"], declined: ["#B91C1C", "#FDECEC"], cancelled: ["#6B7280", "#F1F2F4"] };

export function MyBookings({ api, items, view, onChat, onChanged }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(null);
  const mine = (items || []).filter((x) => x.role === "customer");
  const list = mine.filter((x) => (view === "past" ? ["declined", "cancelled"].includes(x.status) : ["requested", "accepted"].includes(x.status)));
  if (!list.length) return <div style={{ color: T.inkSoft, padding: "14px 2px" }}>{t("mbk_empty")}</div>;
  const label = { requested: t("mbk_waiting"), accepted: t("mbk_accepted"), declined: t("mbk_declined"), cancelled: t("mbk_cancelled") };
  const cancel = async (x) => { setBusy(x.id); try { await api.bookingCancel(x.id); } catch (_) {} setBusy(null); onChanged && onChanged(); };
  const row = (k, v) => v ? <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 3 }}><b style={{ color: T.ink }}>{k}</b> {v}</div> : null;
  return (
    <div>
      {list.map((x) => {
        const [fg, bg] = TONE[x.status] || TONE.cancelled;
        return (
          <div key={x.id} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 16.5, fontWeight: 800, color: T.ink }}>{x.other_name}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, padding: "4px 10px", borderRadius: 12, color: fg, background: bg }}>{label[x.status] || x.status}</span>
            </div>
            {row(t("mbk_for"), x.trade_name)}
            {row(t("mbk_when"), x.start_at ? `${stamp(x.start_at)}${x.duration_mins ? ` · ${mins(x.duration_mins)}` : ""}` : "")}
            {row(t("mbk_where"), x.note)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {["requested", "accepted"].includes(x.status) && onChat && <Btn kind="ghost" onClick={() => onChat(x)}>{t("mbk_chat")}</Btn>}
              {["requested", "accepted"].includes(x.status) && <Btn kind="ghost" disabled={busy === x.id} onClick={() => cancel(x)}>{t("bk_cancel")}</Btn>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

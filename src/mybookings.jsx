// Bookings: a worker asked to come (cook, plumber and so on). Used by the
// customer ("My bookings") and by the worker ("Requests from customers").
// One card per request: who, what for, when, where, the rate card, the answer.
import React, { useState } from "react";
import { T, Icon } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { BusyCalendar, useBusy, clashWith } from "./busycal.jsx";

const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
const stamp = (iso) => { try { return new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (_) { return ""; } };
const TONE = { completed: ["#0A5BB8", "#E8F0FB"], requested: ["#B45309", "#FFF4E0"], accepted: ["#15803D", "#E7F5EC"], declined: ["#B91C1C", "#FDECEC"], cancelled: ["#6B7280", "#F1F2F4"] };
const money = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const COLORS = ["#1D4ED8", "#0F8A3C", "#B45309", "#7C3AED", "#BE185D", "#0E7490"];

function Face({ name, url }) {
  const c = COLORS[[...String(name || "?")].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COLORS.length];
  const base = { width: 56, height: 56, borderRadius: "50%", flexShrink: 0, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(11,58,120,0.25)" };
  if (url) return <img src={url} alt="" style={{ ...base, objectFit: "cover" }} />;
  return <span style={{ ...base, background: c, color: "#fff", fontWeight: 800, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>{String(name || "?").trim().charAt(0).toUpperCase()}</span>;
}

const pill = (bg, fg, extra) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, padding: "0 18px", borderRadius: 22, border: "none", background: bg, color: fg, fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer", textDecoration: "none", ...extra });

function ReschedPanel({ api, x, resched, setResched, busy, rmsg, setRmsg, onSave, t }) {
  const slots = useBusy(api, x.worker_id, x.id);
  const a = resched.value ? new Date(resched.value) : null;
  const ok = a && !Number.isNaN(a.getTime());
  const b = ok ? new Date(a.getTime() + (Number(x.duration_mins) || 60) * 60000) : null;
  return (
    <div style={{ margin: "4px 14px 10px", padding: "10px 12px", background: "#F3F7FD", border: "1px solid #CFDDF0", borderRadius: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0B3A78", marginBottom: 6 }}>{t("mbk_resched_title")}</div>
      {x.worker_id && <BusyCalendar slots={slots} picked={ok ? a : null} />}
      <input type="datetime-local" value={resched.value} onChange={(e) => { setRmsg(""); setResched({ id: x.id, value: e.target.value }); }}
             style={{ width: "100%", boxSizing: "border-box", minHeight: 46, fontSize: 16, padding: "8px 10px", borderRadius: 10, border: "1px solid #B8C9E0", fontFamily: "inherit" }} />
      {ok && clashWith(slots, a, b) && <div role="alert" style={{ color: "#B91C1C", fontSize: 13.5, fontWeight: 700, marginTop: 6 }}>{t("mbk_busy_err")}</div>}
      {rmsg && <div role="alert" style={{ color: "#B91C1C", fontSize: 13.5, fontWeight: 700, marginTop: 6 }}>{rmsg}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button disabled={busy === x.id || !resched.value || (ok && clashWith(slots, a, b))} onClick={onSave} style={pill("#0A5BB8", "#fff", { flex: 1 })}>{t("mbk_resched_save")}</button>
        <button onClick={() => { setResched(null); setRmsg(""); }} style={pill("#fff", "#6B7280", { flex: 1, border: "1.5px solid #D1D5DB" })}>{t("cancel")}</button>
      </div>
    </div>
  );
}

export function MyBookings({ api, items, view, onChat, onChanged, asWorker = false }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(null);
  const [resched, setResched] = useState(null); // { id, value }
  const [rmsg, setRmsg] = useState("");
  const mine = (items || []).filter((x) => x.role === (asWorker ? "worker" : "customer"));
  const list = mine.filter((x) => (view === "past" ? ["declined", "cancelled", "completed"].includes(x.status) : ["requested", "accepted"].includes(x.status)));
  if (!list.length) return <div style={{ color: T.inkSoft, padding: "14px 2px" }}>{t("mbk_empty")}</div>;
  const label = { requested: t(asWorker ? "mbk_needs_you" : "mbk_waiting"), accepted: t("mbk_accepted"), declined: t("mbk_declined"), completed: t("mbk_completed"), cancelled: t("mbk_cancelled") };
  const answer = async (x, ok) => { setBusy(x.id); try { await api.bookingAnswer(x.id, ok); } catch (_) {} setBusy(null); onChanged && onChanged(); };
  const saveResched = async () => {
    if (!resched || !resched.value) return;
    setBusy(resched.id); setRmsg("");
    try {
      const r = await api.bookingReschedule(resched.id, new Date(resched.value).toISOString());
      const x = Array.isArray(r) ? r[0] : r;
      if (x && x.ok === false) throw new Error(x.reason);
      setResched(null);
    } catch (e) { setRmsg(t(e && e.message === "worker_busy" ? "mbk_busy_err" : "mbk_resched_err")); }
    setBusy(null); onChanged && onChanged();
  };
  const cancel = async (x) => { setBusy(x.id); try { await api.bookingCancel(x.id); } catch (_) {} setBusy(null); onChanged && onChanged(); };
  // A listed rate is per 8-hour day. The rate card scales it to hours.
  const scale = (r, m) => Math.max(10, Math.round((r * m) / 480 / 10) * 10);
  const span = (lo, hi, m) => {
    const a = lo ? scale(lo, m) : scale(hi, m), b = hi ? scale(hi, m) : a;
    return a !== b ? `${money(a)} – ${money(b)}` : money(a);
  };
  const field = (icon, k, v) => v ? (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0" }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: "#E8F0FB", color: "#0A5BB8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={icon} size={16} /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: T.inkFaint }}>{k}</span>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: T.ink, lineHeight: 1.35, overflowWrap: "anywhere" }}>{v}</span>
      </span>
    </div>
  ) : null;
  return (
    <div>
      {list.map((x) => {
        const [fg, bg] = TONE[x.status] || TONE.cancelled;
        const lo = Number(x.rate_min) || 0, hi = Number(x.rate_max) || 0, m = Number(x.duration_mins) || 0;
        const live = ["requested", "accepted"].includes(x.status);
        const place = x.note ? String(x.note).replace(/^At:\s*/i, "") : "";
        return (
          <div key={x.id} style={{ background: "#fff", border: "1px solid #D6E3F5", borderRadius: 18, marginBottom: 14, overflow: "hidden", boxShadow: "0 2px 10px rgba(11,58,120,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 14px 12px", background: "linear-gradient(135deg,#EEF4FD,#F8FAFE)" }}>
              <Face name={x.other_name || x.trade_name} url={x.other_avatar} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 18, fontWeight: 800, color: "#0B3A78", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.other_name || x.trade_name}</span>
                {x.trade_name && <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.inkSoft, marginTop: 2 }}>{x.trade_name}</span>}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 800, padding: "5px 11px", borderRadius: 14, color: fg, background: bg, whiteSpace: "nowrap" }}>{label[x.status] || x.status}</span>
            </div>
            {x.prev_start_at && live && (
              <div style={{ margin: "10px 14px 0", padding: "8px 12px", background: "#EEF4FD", border: "1px solid #CFDDF0", borderRadius: 10, fontSize: 13.5, fontWeight: 700, color: "#0B3A78", lineHeight: 1.45 }}>
                {String(t(x.resched_by === "customer" ? "mbk_moved_cust" : "mbk_moved_work")).replace("{old}", stamp(x.prev_start_at))}
              </div>
            )}
            {asWorker && x.status === "requested" && x.start_at && (() => {
              const s0 = new Date(x.start_at).getTime(), e0 = s0 + (Number(x.duration_mins) || 60) * 60000;
              const clash = mine.find((y) => y.id !== x.id && y.status === "accepted" && y.start_at
                && new Date(y.start_at).getTime() < e0 && new Date(y.start_at).getTime() + (Number(y.duration_mins) || 60) * 60000 > s0);
              return clash ? (
                <div role="alert" style={{ margin: "10px 14px 0", padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, fontSize: 13.5, fontWeight: 700, color: "#B91C1C", lineHeight: 1.45 }}>
                  {String(t("mbk_clash")).replace("{name}", clash.other_name || "").replace("{when}", stamp(clash.start_at))}
                </div>
              ) : null;
            })()}
            <div style={{ padding: "6px 14px 4px" }}>
              {field("clock", String(t("mbk_when")).replace(/[:：]$/, ""), x.start_at ? `${stamp(x.start_at)}${m ? ` · ${mins(m)}` : ""}` : "")}
              {field("pin", String(t("mbk_where")).replace(/[:：]$/, ""), place)}
            </div>
            {!asWorker && (lo || hi) && (
              <div style={{ margin: "6px 14px 10px", border: "1px solid #CFE0F7", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: "#E8F0FB", fontSize: 12.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "#0B3A78" }}>{t(asWorker ? "mbk_card_you" : "mbk_card")}</div>
                {[[t("mbk_1h"), span(lo, hi, 60)], [t("mbk_half"), span(lo, hi, 240)], [t("mbk_full"), span(lo, hi, 480)]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", fontSize: 14.5, borderTop: "1px solid #E6EEF9" }}>
                    <span style={{ color: T.inkSoft, fontWeight: 600 }}>{k}</span><b style={{ color: T.ink }}>{v}</b>
                  </div>
                ))}
                {m > 0 && (
                  <div style={{ padding: "10px 12px", background: "#F2FAF5", borderTop: "1px solid #BEE3CB" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#166534" }}>
                      <span>{String(t("mbk_for_len")).replace("{len}", mins(m))}</span><span>{span(lo, hi, m)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#166534", marginTop: 3, lineHeight: 1.45 }}>{t(asWorker ? "mbk_est_note_you" : "mbk_est_note")}</div>
                  </div>
                )}
              </div>
            )}
            {live && resched && resched.id === x.id && (
              <ReschedPanel api={api} x={x} resched={resched} setResched={setResched} busy={busy} rmsg={rmsg} setRmsg={setRmsg} onSave={saveResched} t={t} />
            )}
            {live && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "4px 14px 14px" }}>
                {asWorker && x.status === "requested" && <button disabled={busy === x.id} onClick={() => answer(x, true)} style={pill("#0A5BB8", "#fff", { flex: "1 1 120px" })}>{t("bk_accept")}</button>}
                {asWorker && x.status === "requested" && <button disabled={busy === x.id} onClick={() => answer(x, false)} style={pill("#fff", "#B91C1C", { flex: "1 1 100px", border: "1.5px solid #D1D5DB" })}>{t("bk_decline")}</button>}
                {!(resched && resched.id === x.id) && <button onClick={() => { setRmsg(""); const d = x.start_at ? new Date(x.start_at) : new Date(); const loc = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); setResched({ id: x.id, value: loc }); }} style={pill("#fff", "#0A5BB8", { flex: "1 1 120px", border: "1.5px solid #B8C9E0" })}>{t("mbk_resched")}</button>}
                {x.other_phone && <a href={`tel:${x.other_phone}`} style={pill("#15803D", "#fff", { flex: "1 1 100px" })}><Icon name="phone" size={17} /> {t("mbk_call")}</a>}
                {onChat && <button onClick={() => onChat(x)} style={pill("#EEF4FD", "#0A5BB8", { flex: "1 1 90px" })}>{t("mbk_chat")}</button>}
                {!asWorker && <button disabled={busy === x.id} onClick={() => cancel(x)} style={pill("#fff", "#6B7280", { flex: "1 1 90px", border: "1.5px solid #D1D5DB" })}>{t("bk_cancel")}</button>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

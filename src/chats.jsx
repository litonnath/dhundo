// ---------------------------------------------------------------------------
// CHATS AND NOTIFICATIONS. Chats is a main tab: one conversation per request,
// like a messaging app. The bell in the header is the notification list:
// requests waiting for an answer, answers received, deliveries. A chat closes
// when its request is declined or cancelled and is deleted 24 hours later.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useCallback } from "react";
import { T, Btn, Icon, Notice, input, CloseButton, useDismissable } from "./ui.jsx";
import { fmtLength } from "./hub.jsx";
import { useI18n } from "./i18n.jsx";

const one = (r) => (Array.isArray(r) ? r[0] : r);
const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const SEEN_KEY = "dhundo_seen_req";
const readSeen = () => { try { return JSON.parse(window.localStorage.getItem(SEEN_KEY) || "{}") || {}; } catch (_) { return {}; } };

const when = (iso, long) => {
  try {
    const d = new Date(iso); const now = new Date();
    const same = d.toDateString() === now.toDateString();
    if (long) return d.toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    return same ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
  } catch (_) { return ""; }
};
const dayLabel = (iso) => { try { return new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }); } catch (_) { return ""; } };
const COLORS = ["#1D4ED8", "#0F8A3C", "#B45309", "#7C3AED", "#BE185D", "#0E7490"];
const colorOf = (s) => COLORS[[...String(s || "?")].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];
function Avatar({ name, size = 46 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: colorOf(name), color: "#fff", fontWeight: 800, fontSize: size * 0.42, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {String(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
const statusColor = { requested: "#B45309", accepted: "#0F8A3C", declined: "#B91C1C", cancelled: "#6B7280" };

// ------------------------------------------------------------------- inbox
export function useInbox(api, signedIn) {
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(readSeen);
  const reload = useCallback(async () => {
    if (!signedIn) { setItems([]); return; }
    try { setItems(many(await api.chatInbox())); } catch (_) { /* next tick */ }
  }, [api, signedIn]);
  useEffect(() => {
    reload();
    if (!signedIn) return undefined;
    const id = setInterval(reload, 10000);
    return () => clearInterval(id);
  }, [reload, signedIn]);
  const unread = items.reduce((n, x) => n + (x.unread || 0), 0);
  const alerts = items.filter((x) => (x.role === "worker" && x.status === "requested")
    || (x.role === "customer" && x.status !== "requested" && seen[x.id] !== x.status)).length;
  const markSeen = () => {
    const next = { ...readSeen() };
    items.forEach((x) => { next[x.id] = x.status; });
    try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch (_) {}
    setSeen(next);
  };
  return { items, reload, unread, alerts, markSeen };
}

// -------------------------------------------------------------- chats tab
export function ChatsPage({ items, onOpen, onHome, alerts = 0, onRequests = null, onDelete = null }) {
  const { t } = useI18n();
  const [ask, setAsk] = useState(null);
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 16px 120px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "4px 0 4px" }}>{t("ch_tab")}</h1>
      <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5, margin: "0 0 14px" }}>{t("ch_note")}</p>
      {onRequests && (
        <button onClick={onRequests} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 12, cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: T.brandSoft, color: T.brandDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="bell" size={20} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: T.ink }}>{t("nt_requests")}</span>
            <span style={{ display: "block", fontSize: 13, color: T.inkSoft }}>{t("nt_requests_sub")}</span>
          </span>
          {alerts > 0 && <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: "#DC2626", color: "#fff", fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{alerts}</span>}
          <Icon name="back" size={16} style={{ transform: "rotate(180deg)", color: T.inkFaint }} />
        </button>
      )}
      {items.length === 0 ? (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: "34px 20px", textAlign: "center" }}>
          <span style={{ display: "inline-flex", width: 56, height: 56, borderRadius: "50%", background: T.brandSoft, color: T.brandDark, alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icon name="chat" size={26} /></span>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{t("ch_none_t")}</div>
          <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.55, marginBottom: 14 }}>{t("ch_none")}</div>
          {onHome && <Btn onClick={onHome}>{t("nav_home")}</Btn>}
        </div>
      ) : (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden" }}>
          {items.map((x, i) => {
            const over = ["declined", "cancelled"].includes(x.status);
            return (
              <div key={x.id} style={{ borderTop: i ? `1px solid ${T.line}` : "none", background: x.unread ? "#F3F8FF" : T.white }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <button onClick={() => onOpen(x)} style={{
                    display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, textAlign: "left", padding: "13px 6px 13px 14px",
                    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <Avatar name={x.other_name} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 16, fontWeight: x.unread ? 800 : 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.other_name}</span>
                        <span style={{ fontSize: 12, color: T.inkFaint, flexShrink: 0 }}>{when(x.last_at || x.created_at)}</span>
                      </span>
                      {x.trade_name && <span style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: T.brandDark, marginTop: 1 }}>{t("ch_for")}: {x.trade_name}</span>}
                      <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <span style={{ flex: 1, fontSize: 13.5, color: x.unread ? T.ink : T.inkSoft, fontWeight: x.unread ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {x.last_body ? `${x.last_mine ? `${t("ch_you")}: ` : ""}${x.last_body}` : (x.note || t("ch_req_sent"))}
                        </span>
                        {x.unread > 0 && <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: "#1FA85A", color: "#fff", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{x.unread}</span>}
                      </span>
                      <span style={{ display: "inline-block", marginTop: 4, fontSize: 11.5, fontWeight: 800, color: statusColor[x.status] || T.inkSoft }}>{t("bk_status_" + x.status)}</span>
                    </span>
                  </button>
                  {onDelete && (
                    <button onClick={() => setAsk(ask === x.id ? null : x.id)} aria-label={t("ch_delete")} style={{ width: 44, height: 44, marginRight: 6, border: "none", background: "none", color: T.inkFaint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="trash" size={19} />
                    </button>
                  )}
                </div>
                {ask === x.id && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "0 14px 12px 14px" }}>
                    <span style={{ flex: 1, minWidth: 180, fontSize: 13.5, color: T.ink, fontWeight: 700 }}>{t(over ? "ch_del_q_closed" : "ch_del_q_open")}</span>
                    <Btn kind="ghost" onClick={() => setAsk(null)}>{t("ch_keep")}</Btn>
                    <button onClick={() => { setAsk(null); onDelete(x); }} style={{ minHeight: 44, padding: "0 18px", borderRadius: 12, border: "none", background: "#B91C1C", color: "#fff", fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" }}>{t("ch_delete")}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- one chat
export function ChatScreen({ api, item, onClose, onChanged }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [msgs, setMsgs] = useState([]);
  const [info, setInfo] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const box = useRef(null);
  const count = useRef(0);
  const load = useCallback(async () => {
    try {
      const i = one(await api.chatOpen(item.id));
      setInfo(i || { is_open: false, gone: true });
      const list = many(await api.chatList(item.id));
      setMsgs(list);
      if (list.length !== count.current) { count.current = list.length; api.chatMarkRead(item.id).then(() => onChanged && onChanged()).catch(() => {}); }
    } catch (_) { /* the next tick tries again */ }
  }, [api, item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); api.chatMarkRead(item.id).then(() => onChanged && onChanged()).catch(() => {}); const id = setInterval(load, 4000); return () => clearInterval(id); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs.length]);
  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = one(await api.chatSend(item.id, body));
      if (r && r.ok) { setText(""); load(); onChanged && onChanged(); }
      else setErr(r && r.reason === "closed" ? t("ch_ended") : t("e_save"));
    } catch (e) { setErr((e && e.message) || t("e_save")); }
    setBusy(false);
  };
  const open = info && info.is_open;
  const status = (info && info.status) || item.status;
  const hours = info && info.closes_at ? Math.max(1, Math.ceil((new Date(info.closes_at) - Date.now()) / 3600000)) : null;
  const phone = item.other_phone;
  let lastDay = "";
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(15,20,25,0.5)", display: "flex", justifyContent: "center" }}>
      <div style={{ background: "#F4F6F8", width: "100%", maxWidth: 560, height: "100%", display: "flex", flexDirection: "column", boxShadow: "0 0 40px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: T.white, borderBottom: `1px solid ${T.line}` }}>
          <button onClick={onClose} aria-label={t("w_back")} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "none", cursor: "pointer", color: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="back" size={22} /></button>
          <Avatar name={item.other_name} size={42} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 16.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.other_name}</span>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: statusColor[status] || T.inkSoft }}>{t("bk_status_" + status)}{item.trade_name ? ` \u00B7 ${item.trade_name}` : ""}</span>
          </span>
          {phone && <a href={`tel:${phone}`} aria-label={t("fk_call")} style={{ width: 42, height: 42, borderRadius: "50%", background: "#0F8A3C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="phone" size={20} /></a>}
        </div>
        <div style={{ background: T.white, borderBottom: `1px solid ${T.line}`, padding: "8px 14px", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5 }}>
          {item.trade_name && <><b style={{ color: T.ink }}>{t("ch_for")}: {item.trade_name}</b><br /></>}
          {item.start_at && <b style={{ color: T.ink }}>{when(item.start_at, true)}{item.duration_mins ? ` · ${fmtLength(item.duration_mins, t)}` : ""}</b>}
          {item.note ? <><br />{item.note}</> : null}
        </div>
        <div ref={box} style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          {msgs.length === 0 && <div style={{ textAlign: "center", color: T.inkFaint, fontSize: 14, marginTop: 28 }}>{t("ch_empty")}</div>}
          {msgs.map((m) => {
            const d = dayLabel(m.created_at); const show = d !== lastDay; lastDay = d;
            return (
              <React.Fragment key={m.id}>
                {show && <div style={{ textAlign: "center", margin: "10px 0 6px" }}><span style={{ fontSize: 11.5, color: T.inkSoft, background: "#E4E8EC", borderRadius: 10, padding: "3px 10px", fontWeight: 700 }}>{d}</span></div>}
                <div style={{ display: "flex", justifyContent: m.mine ? "flex-end" : "flex-start", marginBottom: 5 }}>
                  <span style={{
                    maxWidth: "80%", padding: "8px 12px 6px", borderRadius: m.mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px", fontSize: 15, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
                    background: m.mine ? T.brandDark : T.white, color: m.mine ? "#fff" : T.ink, border: m.mine ? "none" : `1px solid ${T.line}`,
                  }}>
                    {m.body}
                    <span style={{ display: "block", fontSize: 10.5, opacity: 0.7, marginTop: 2, textAlign: "right" }}>{when(m.created_at, false)}</span>
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {open ? (
          <div style={{ padding: "10px 12px calc(12px + env(safe-area-inset-bottom))", background: T.white, borderTop: `1px solid ${T.line}` }}>
            {err && <div style={{ marginBottom: 8 }}><Notice tone="bad">{err}</Notice></div>}
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...input, flex: 1, borderRadius: 22 }} value={text} maxLength={500} placeholder={t("ch_ph")} aria-label={t("ch_ph")}
                     onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
              <button onClick={send} disabled={busy || !text.trim()} aria-label={t("ch_send")} style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: T.brandDark, color: "#fff", cursor: "pointer", opacity: busy || !text.trim() ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="send" size={20} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: "12px 14px calc(14px + env(safe-area-inset-bottom))", background: T.white, borderTop: `1px solid ${T.line}` }}>
            <Notice tone="info">{info && info.gone ? t("ch_gone") : t("ch_ended")}{hours ? ` ${String(t("ch_left")).replace("{n}", hours)}` : ""}</Notice>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------- notifications
export function NotificationsSheet({ api, items, jobs, rides = [], onRides, onClose, onChat, onChanged }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [busy, setBusy] = useState(null);
  const act = async (fn) => { setBusy(true); try { await fn(); } catch (_) { /* the list reloads */ } setBusy(null); onChanged && onChanged(); };
  const line = (x) => {
    const n = x.other_name || "";
    if (x.role === "worker" && x.status === "requested") return String(t("nt_new_req")).replace("{name}", n);
    if (x.role === "customer" && x.status === "requested") return String(t("nt_waiting")).replace("{name}", n);
    if (x.status === "accepted") return String(t(x.role === "customer" ? "nt_accepted" : "nt_you_acc")).replace("{name}", n);
    if (x.status === "declined") return String(t("nt_declined")).replace("{name}", n);
    return String(t("nt_cancelled")).replace("{name}", n);
  };
  const dot = (x) => statusColor[x.status] || T.inkSoft;
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 560, background: "rgba(15,20,25,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      <div style={{ background: "#F4F6F8", borderRadius: "0 0 18px 18px", width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box", padding: "14px 14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <h1 style={{ flex: 1, fontSize: 20, fontWeight: 800, margin: 0, color: T.ink }}>{t("nt_title")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        {items.length === 0 && jobs.length === 0 && rides.length === 0 && <div style={{ textAlign: "center", color: T.inkFaint, fontSize: 14.5, padding: "26px 0" }}>{t("nt_empty")}</div>}
        {rides.slice().sort((a, b) => Number(a.pick_km) - Number(b.pick_km)).map((r) => (
          <div key={"ride" + r.id} style={{ background: T.white, border: `1px solid ${T.line}`, borderLeft: "4px solid #DC2626", borderRadius: 12, padding: "11px 13px", marginBottom: 9 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink }}>{t("rdr_title")} · {String(t("rdr_pick_km")).replace("{n}", r.pick_km)}</div>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>{r.pick_text}{r.drop_text ? ` → ${r.drop_text}` : ""}</div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: T.brandDark, margin: "3px 0 9px" }}>{r.fare_paise != null ? String(t("rdr_fare")).replace("{n}", Math.round(r.fare_paise / 100)) : t("rdr_nofare")}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn disabled={!!busy} onClick={() => act(async () => { await api.rideAccept(r.id); onRides && onRides(); })}>{t("rdr_accept")}</Btn>
              <Btn kind="ghost" onClick={() => onRides && onRides()}>{t("rdr_title")}</Btn>
            </div>
          </div>
        ))}
        {items.map((x) => (
          <div key={x.id} style={{ background: T.white, border: `1px solid ${T.line}`, borderLeft: `4px solid ${dot(x)}`, borderRadius: 12, padding: "11px 13px", marginBottom: 9 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Avatar name={x.other_name} size={38} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: T.ink, lineHeight: 1.35 }}>{line(x)}</span>
                {x.trade_name && <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.brandDark, marginTop: 2 }}>{t("ch_for")}: {x.trade_name}</span>}
                <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>
                  {x.start_at ? when(x.start_at, true) : ""}{x.duration_mins ? ` · ${fmtLength(x.duration_mins, t)}` : ""}
                </span>
                {x.note && <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{x.note}</span>}
                {["declined", "cancelled"].includes(x.status) && x.closes_at && (
                  <span style={{ display: "block", fontSize: 12, color: T.inkFaint, marginTop: 2 }}>{String(t("ch_left")).replace("{n}", Math.max(1, Math.ceil((new Date(x.closes_at) - Date.now()) / 3600000)))}</span>
                )}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 9 }}>
              {x.role === "worker" && x.status === "requested" && (
                <>
                  <Btn disabled={!!busy} onClick={() => act(() => api.bookingAnswer(x.id, true))}>{t("bk_accept")}</Btn>
                  <Btn kind="ghost" disabled={!!busy} onClick={() => act(() => api.bookingAnswer(x.id, false))}>{t("bk_decline")}</Btn>
                </>
              )}
              {x.role === "customer" && ["requested", "accepted"].includes(x.status) && (
                <Btn kind="ghost" disabled={!!busy} onClick={() => act(() => api.bookingCancel(x.id))}>{t("bk_cancel")}</Btn>
              )}
              {x.other_phone && <a href={`tel:${x.other_phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 16px", borderRadius: 12, background: "#0F8A3C", color: "#fff", fontWeight: 800, fontSize: 14.5, textDecoration: "none" }}><Icon name="phone" size={16} /> {t("fk_call")}</a>}
              <Btn kind="ghost" onClick={() => onChat(x)}>{t("ch_btn")}</Btn>
            </div>
          </div>
        ))}
        {jobs.length > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, margin: "14px 2px 6px" }}>{t("jb_title")}</div>}
        {jobs.map((j) => (
          <div key={j.id} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 13px", marginBottom: 9 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{j.other_name ? `${j.other_name} · ` : ""}{j.note}</div>
            <div style={{ fontSize: 13, color: T.inkSoft }}>{t("jb_to")} {j.drop_text}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.brandDark }}>{t("jp_status_" + j.status)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

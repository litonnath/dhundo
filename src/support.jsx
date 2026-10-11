// HELP & SUPPORT. A round Help button on every screen opens a sheet: quick
// answers from a bot for the common problems, and "Talk to our team" for
// anything else. A ticket is a chat with our team; the team replies from the
// admin console and the reply appears here (checked every few seconds).
import React, { useEffect, useRef, useState } from "react";
import { T, Btn, Icon, input } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { CONTACT } from "./brand.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const one = (r) => (Array.isArray(r) ? r[0] : r);
const TOPICS = ["order", "payment", "rider", "booking", "ride", "account", "other"];
const WORDS = {
  order: /order|food|late|missing|wrong item|restaurant|shop|cancel|অর্ডার|खাবার|ऑर्डर|खाना/i,
  payment: /pay|refund|money|upi|cash|charge|bill|gst|পেমেন্ট|টাকা|पेमेंट|पैसे|रिफंड/i,
  rider: /rider|delivery partner|driver late|otp|code/i,
  booking: /book|worker|cook|plumber|electric|reschedule|hire/i,
  ride: /ride|taxi|cab|auto|bike|fare|trip/i,
  account: /account|login|log in|otp|phone|password|profile|delete/i,
};
const guess = (text) => { const k = Object.keys(WORDS).find((x) => WORDS[x].test(text)); return k || null; };

export function SupportButton({ api, signedIn, onSignIn, bottom = 92 }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    if (!signedIn || !api.supportMy) { setUnread(false); return undefined; }
    let alive = true;
    const pull = async () => { try { const r = many(await api.supportMy()); if (alive) setUnread(r.some((x) => x.unread)); } catch (_) {} };
    pull();
    const id = setInterval(pull, 20000);
    return () => { alive = false; clearInterval(id); };
  }, [api, signedIn, open]);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t("sp_help")} style={{
        position: "fixed", right: 14, bottom, zIndex: 400, minHeight: 50, padding: "0 18px 0 14px", borderRadius: 25, border: "none", cursor: "pointer",
        background: "#0A5BB8", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 6px 18px rgba(10,91,184,0.4)",
      }}>
        <Icon name="chat" size={20} /> {t("sp_help")}
        {unread && <span style={{ position: "absolute", top: -3, right: -3, width: 16, height: 16, borderRadius: "50%", background: "#DC2626", border: "2px solid #fff" }} />}
      </button>
      {open && <SupportSheet api={api} signedIn={signedIn} onSignIn={onSignIn} onClose={() => setOpen(false)} />}
    </>
  );
}

function Bubble({ mine, children, time }) {
  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", margin: "6px 0" }}>
      <div style={{ maxWidth: "82%", padding: "9px 13px", borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4,
                    background: mine ? "#0A5BB8" : "#EEF2F7", color: mine ? "#fff" : T.ink, fontSize: 14.5, lineHeight: 1.45, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
        {children}
        {time && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3, textAlign: "right" }}>{time}</div>}
      </div>
    </div>
  );
}

export function SupportSheet({ api, signedIn, onSignIn, onClose }) {
  const { t } = useI18n();
  const [view, setView] = useState("menu"); // menu | bot | chat
  const [topic, setTopic] = useState(null);
  const [text, setText] = useState("");
  const [mine, setMine] = useState([]);
  const [ticket, setTicket] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef(null);
  const topicName = (k) => t("sp_t_" + k);
  const loadMine = async () => { if (!signedIn || !api.supportMy) return; try { setMine(many(await api.supportMy())); } catch (_) {} };
  useEffect(() => { loadMine(); }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadThread = async (id) => {
    try { const r = many(await api.supportThread(id)); setMsgs(r); setClosed(r.length > 0 && r[0].status === "closed"); } catch (_) {}
  };
  useEffect(() => {
    if (view !== "chat" || !ticket) return undefined;
    loadThread(ticket);
    const id = setInterval(() => loadThread(ticket), 5000);
    return () => clearInterval(id);
  }, [view, ticket]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: "end" }); }, [msgs.length, view]);

  const openTicket = async (tp, body) => {
    if (!signedIn) { onSignIn && onSignIn(); return; }
    setBusy(true); setErr("");
    try {
      const r = one(await api.supportOpen(tp, body, null));
      if (r && r.ok) { setTicket(r.ticket_id); setText(""); setView("chat"); loadMine(); }
      else setErr(t("sp_err"));
    } catch (e) { setErr(/could not find the function|schema cache/i.test((e && e.message) || "") ? t("sp_off") : t("sp_err")); }
    setBusy(false);
  };
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true); setErr("");
    try {
      const r = one(await api.supportSend(ticket, body));
      if (r && r.ok) { setText(""); await loadThread(ticket); } else setErr(t("sp_err"));
    } catch (_) { setErr(t("sp_err")); }
    setBusy(false);
  };
  const ask = () => {
    const body = text.trim();
    if (body.length < 2) return;
    const g = guess(body);
    if (g) { setTopic(g); setView("bot"); } else openTicket(t("sp_t_other"), body);
  };
  const time = (iso) => { try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch (_) { return ""; } };
  const row = { display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 52, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.white, fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: T.ink, cursor: "pointer", textAlign: "left" };
  const wa = String(CONTACT.whatsapp || "").replace(/\D/g, "");

  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 560, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 520, height: "86vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${T.line}` }}>
          {view !== "menu" && <button onClick={() => { setView("menu"); setTicket(null); setTopic(null); loadMine(); }} aria-label="Back" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Icon name="back" size={20} /></button>}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0B3A78" }}>{t("sup_title")}</div>
            <div style={{ fontSize: 12.5, color: T.inkSoft }}>{view === "chat" ? t("sp_team_hint") : t("sp_sub")}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: T.inkSoft, padding: 4 }}>{"×"}</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {view === "menu" && (
            <>
              <Bubble>{t("sp_hello")}</Bubble>
              {mine.filter((x) => x.status === "open").length > 0 && (
                <div style={{ margin: "10px 0" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{t("sp_open")}</div>
                  {mine.filter((x) => x.status === "open").map((x) => (
                    <button key={x.id} onClick={() => { setTicket(x.id); setView("chat"); }} style={{ ...row, marginBottom: 8, borderColor: x.unread ? "#DC2626" : T.line }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block" }}>{x.topic}</span>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.last_body}</span>
                      </span>
                      {x.unread && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", background: "#DC2626", borderRadius: 10, padding: "2px 8px" }}>{t("sp_new")}</span>}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {TOPICS.map((k) => <button key={k} onClick={() => { setTopic(k); setView(k === "other" ? "bot" : "bot"); }} style={row}>{topicName(k)}<span style={{ flex: 1 }} /><Icon name="chev" size={16} style={{ transform: "rotate(-90deg)", color: T.inkFaint }} /></button>)}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" style={{ ...row, width: "auto", flex: "1 1 140px", justifyContent: "center", textDecoration: "none", color: "#15803D", borderColor: "#BEE3CB" }}>WhatsApp</a>}
                {CONTACT.phone && <a href={`tel:${CONTACT.phone}`} style={{ ...row, width: "auto", flex: "1 1 140px", justifyContent: "center", textDecoration: "none", color: "#0A5BB8" }}>{t("sp_call")}</a>}
              </div>
            </>
          )}

          {view === "bot" && topic && (
            <>
              <Bubble mine>{topicName(topic)}</Bubble>
              {topic !== "other" && <Bubble>{t("sp_a_" + topic)}</Bubble>}
              <Bubble>{t(topic === "other" ? "sp_ask_other" : "sp_helpful")}</Bubble>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
                {topic !== "other" && <Btn kind="ghost" onClick={() => { setView("menu"); setTopic(null); }}>{t("sp_yes")}</Btn>}
                <Btn onClick={() => { setView("compose"); }}>{t("sp_talk")}</Btn>
              </div>
            </>
          )}

          {view === "compose" && (
            <>
              <Bubble>{t("sp_describe")}</Bubble>
              {err && <div role="alert" style={{ color: "#B91C1C", fontSize: 13.5, fontWeight: 700 }}>{err}</div>}
            </>
          )}

          {view === "chat" && (
            <>
              <Bubble>{t("sp_team_welcome")}</Bubble>
              {msgs.map((m) => <Bubble key={m.id} mine={m.sender === "user"} time={time(m.created_at)}>{m.body}</Bubble>)}
              {closed && <div style={{ textAlign: "center", fontSize: 13, color: T.inkSoft, margin: "10px 0" }}>{t("sp_closed")}</div>}
              <div ref={endRef} />
            </>
          )}
        </div>

        {(view === "menu" || view === "compose" || view === "chat") && (
          <div style={{ padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.line}` }}>
            {!signedIn && view !== "menu" ? <Btn full onClick={onSignIn}>{t("nav_signin")}</Btn> : (
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...input, flex: 1, marginBottom: 0, minHeight: 48 }} value={text} maxLength={view === "menu" ? 300 : 1000}
                       placeholder={view === "menu" ? t("sp_type_ph") : t("sp_msg_ph")} onChange={(e) => setText(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); view === "menu" ? ask() : view === "compose" ? openTicket(topic ? topicName(topic) : t("sp_t_other"), text) : send(); } }} />
                <Btn disabled={busy || !text.trim()} onClick={() => (view === "menu" ? ask() : view === "compose" ? openTicket(topic ? topicName(topic) : t("sp_t_other"), text) : send())}>{busy ? "…" : t("sp_send")}</Btn>
              </div>
            )}
            {err && view !== "compose" && <div role="alert" style={{ color: "#B91C1C", fontSize: 13, fontWeight: 700, marginTop: 6 }}>{err}</div>}
            {view === "chat" && !closed && <button onClick={async () => { try { await api.supportClose(ticket); setClosed(true); loadMine(); } catch (_) {} }} style={{ background: "none", border: "none", color: T.inkSoft, fontFamily: "inherit", fontWeight: 700, fontSize: 13, marginTop: 6, cursor: "pointer" }}>{t("sp_resolved")}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

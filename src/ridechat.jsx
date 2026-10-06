// ---------------------------------------------------------------------------
// MESSAGES ON A RIDE: the passenger and the driver of an accepted ride can
// text each other, with one-tap replies for the usual things ("I have
// reached", "Are you at your location?"). Every message is saved in the
// database, so the conversation is still there if the screen is reopened.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useCallback } from "react";
import { T, input } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);

export function RideChat({ api, rideId, role, kind = "ride" }) {
  const { t } = useI18n();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const end = useRef(null);
  const load = useCallback(async () => {
    try { setMsgs(many(await (kind === "job" ? api.jobChatList(rideId) : api.rideChatList(rideId)))); } catch (_) { /* next tick */ }
  }, [api, rideId, kind]);
  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => { if (open && end.current) end.current.scrollIntoView({ block: "nearest" }); }, [msgs.length, open]);
  const send = async (body) => {
    const b = String(body || "").trim();
    if (!b || busy) return;
    setBusy(true);
    try { await (kind === "job" ? api.jobChatSend(rideId, b) : api.rideChatSend(rideId, b)); setText(""); await load(); } catch (_) {}
    setBusy(false);
  };
  const quick = kind === "job"
    ? (role === "rider" ? ["jq1", "jq2", "jq3", "jq4"] : role === "shop" ? ["jo1", "jo2", "jo3"] : ["jc1", "jc2", "jc3"])
    : role === "driver" ? ["qd1", "qd2", "qd3", "qd4"] : ["qp1", "qp2", "qp3", "qp4"];
  return (
    <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: "10px 12px", margin: "10px 0" }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ display: "flex", alignItems: "center", width: "100%", background: "none", border: "none", padding: 0, minHeight: 36, cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: 800, color: T.ink }}>{t("rc_title")}{msgs.length ? ` (${msgs.length})` : ""}</span>
        <span style={{ fontSize: 14, color: T.inkSoft }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          <div style={{ maxHeight: 220, overflowY: "auto", margin: "8px 0", display: "flex", flexDirection: "column", gap: 6 }}>
            {msgs.length === 0 && <div style={{ fontSize: 13, color: T.inkFaint, lineHeight: 1.5 }}>{t("rc_empty")}</div>}
            {msgs.map((m) => (
              <div key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "82%", background: m.mine ? "#0A5BB8" : "#EEF1F5", color: m.mine ? "#fff" : T.ink, borderRadius: 14, padding: "7px 11px", fontSize: 14.5, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                {kind === "job" && !m.mine && m.who && <div style={{ fontSize: 10.5, fontWeight: 800, opacity: 0.7 }}>{t("jw_" + m.who)}</div>}
                {m.body}
                <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 2, textAlign: "right" }}>{new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {quick.map((k) => (
              <button key={k} disabled={busy} onClick={() => send(t(k))} style={{ minHeight: 38, padding: "0 12px", borderRadius: 19, border: `1.5px solid ${T.line}`, background: "#F7F9FB", color: T.ink, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{t(k)}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...input, flex: 1, marginBottom: 0 }} value={text} maxLength={300} placeholder={t("rc_ph")} aria-label={t("rc_ph")}
                   onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(text); }} />
            <button disabled={busy || !text.trim()} onClick={() => send(text)} style={{ minHeight: 48, padding: "0 16px", borderRadius: 12, border: "none", background: "#0A5BB8", color: "#fff", fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit", opacity: !text.trim() ? 0.5 : 1 }}>{t("rc_send")}</button>
          </div>
        </>
      )}
    </div>
  );
}

// The pickup code. Passenger: shows the four digits. Driver: asks for them
// and starts the ride when they match. onStarted tells the screen to unlock
// "Ride finished".
export function RideCode({ api, rideId, role, onState }) {
  const { t } = useI18n();
  const [st, setSt] = useState(null);
  const [val, setVal] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = many(await api.rideCode(rideId))[0];
      if (r) { setSt(r); onState && onState(!!r.started); }
    } catch (_) { /* next tick */ }
  }, [api, rideId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);
  if (!st) return null;
  const box = { borderRadius: 14, padding: "12px 14px", margin: "10px 0" };
  if (st.started) {
    return <div style={{ ...box, background: "#ECFDF3", border: "1px solid #A7E3BE", fontSize: 14.5, fontWeight: 800, color: "#0F6B33" }}>{"\u2713 "}{t(role === "driver" ? "rv_ok" : "rv_started")}</div>;
  }
  if (role !== "driver") {
    return (
      <div style={{ ...box, background: "#F3F6FA", border: `1px solid ${T.line}`, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft }}>{t("rv_title")}</div>
        <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: 10, color: T.ink, margin: "4px 0 2px" }}>{st.code || "\u2026"}</div>
        <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.45 }}>{t("rv_hint")}</div>
      </div>
    );
  }
  const verify = async () => {
    setBusy(true); setMsg("");
    try {
      const r = many(await api.rideVerify(rideId, val))[0];
      if (r && r.ok) { setVal(""); await load(); } else setMsg(t("rv_wrong"));
    } catch (_) { setMsg(t("rv_wrong")); }
    setBusy(false);
  };
  return (
    <div style={{ ...box, background: "#FFF7E6", border: "1px solid #F3D48A" }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#7A4A00", marginBottom: 8 }}>{t("rv_enter")}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...input, flex: 1, marginBottom: 0, textAlign: "center", fontSize: 22, fontWeight: 800, letterSpacing: 8 }} inputMode="numeric" maxLength={4} value={val}
               placeholder={"\u2022\u2022\u2022\u2022"} aria-label={t("rv_enter")} onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))} />
        <button disabled={busy || val.length !== 4} onClick={verify} style={{ minHeight: 48, padding: "0 14px", borderRadius: 12, border: "none", background: "#0A5BB8", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: val.length !== 4 ? 0.5 : 1 }}>{t("rv_verify")}</button>
      </div>
      {msg && <div style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C", marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

// The pickup code of a delivery job. Shop or restaurant: shows the four digits
// to give the rider. Rider: asks for them and marks the order picked up when
// they match.
export function JobCode({ api, jobId, role, onChanged }) {
  const { t } = useI18n();
  const [st, setSt] = useState(null);
  const [val, setVal] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const r = many(await api.jobCode(jobId))[0]; if (r) setSt(r); } catch (_) { /* next tick */ }
  }, [api, jobId]);
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);
  if (!st) return null;
  const box = { borderRadius: 14, padding: "12px 14px", margin: "10px 0" };
  if (st.picked) return <div style={{ ...box, background: "#ECFDF3", border: "1px solid #A7E3BE", fontSize: 14.5, fontWeight: 800, color: "#0F6B33" }}>{"\u2713 "}{t(role === "rider" ? "jv_ok" : "jv_done")}</div>;
  if (role !== "rider") {
    return (
      <div style={{ ...box, background: "#F3F6FA", border: `1px solid ${T.line}`, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft }}>{t("jv_title")}</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 10, color: T.ink, margin: "4px 0 2px" }}>{st.code || "\u2026"}</div>
        <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.45 }}>{t("jv_hint")}</div>
      </div>
    );
  }
  const verify = async () => {
    setBusy(true); setMsg("");
    try {
      const r = many(await api.jobVerify(jobId, val))[0];
      if (r && r.ok) { setVal(""); await load(); onChanged && onChanged(); } else setMsg(t("rv_wrong"));
    } catch (_) { setMsg(t("rv_wrong")); }
    setBusy(false);
  };
  return (
    <div style={{ ...box, background: "#FFF7E6", border: "1px solid #F3D48A" }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#7A4A00", marginBottom: 8 }}>{t("jv_enter")}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...input, flex: 1, marginBottom: 0, textAlign: "center", fontSize: 22, fontWeight: 800, letterSpacing: 8 }} inputMode="numeric" maxLength={4} value={val}
               placeholder={"\u2022\u2022\u2022\u2022"} aria-label={t("jv_enter")} onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))} />
        <button disabled={busy || val.length !== 4} onClick={verify} style={{ minHeight: 48, padding: "0 14px", borderRadius: 12, border: "none", background: "#0A5BB8", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: val.length !== 4 ? 0.5 : 1 }}>{t("jv_verify")}</button>
      </div>
      {msg && <div style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C", marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// THE REQUEST SCREENS: delivery jobs for riders and shops, bookings for
// workers and customers, and the partner programme. Money is never handled
// here: the people involved agree it between themselves.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useCallback } from "react";
import { T, Btn, Icon, CloseButton, useDismissable, input, Notice, InvitePanel } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";

const one = (r) => (Array.isArray(r) ? r[0] : r);
const many = (r) => (Array.isArray(r) ? r : r ? [r] : []);
const card = { background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: "13px 14px", marginBottom: 10 };
const h2 = { fontSize: 17, fontWeight: 800, color: T.ink, margin: "0 0 8px" };

// A short beep and a buzz when a new job arrives, so a rider with the phone
// in a pocket notices. Both are silently skipped where not allowed.
function alertNewJob() {
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (_) {}
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = new C(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.15;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 250);
  } catch (_) {}
}

const dirUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

// ----------------------------------------------------------------- RIDER
export function RiderJobs({ api, online }) {
  const { t } = useI18n();
  const [jobs, setJobs] = useState([]);
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const seen = useRef(new Set());
  const first = useRef(true);

  const load = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([api.jobsNearby(), api.myJobs()]);
      const list = many(n);
      if (!first.current && list.some((j) => !seen.current.has(j.id))) alertNewJob();
      list.forEach((j) => seen.current.add(j.id));
      first.current = false;
      setJobs(list);
      setMine(many(m).filter((j) => j.role === "rider" && ["accepted", "picked_up"].includes(j.status)));
    } catch (_) { /* the next tick tries again */ }
  }, [api]);

  useEffect(() => {
    load();
    const id = setInterval(load, online ? 12000 : 30000);
    return () => clearInterval(id);
  }, [load, online]);

  const accept = async (j) => {
    setBusy(j.id); setMsg("");
    try {
      const r = one(await api.jobAccept(j.id));
      if (!r || !r.ok) setMsg(t("jb_taken"));
    } catch (e) { setMsg((e && e.message) || t("jb_taken")); }
    setBusy(null); load();
  };
  const move = async (j, action) => {
    setBusy(j.id);
    try { await api.jobUpdate(j.id, action); } catch (_) {}
    setBusy(null); load();
  };

  return (
    <div style={{ marginTop: 18 }}>
      {mine.map((j) => (
        <div key={j.id} style={{ ...card, border: `2px solid ${T.green}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.green, marginBottom: 4 }}>{t("jb_active")}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{j.other_name}</div>
          <div style={{ fontSize: 14, color: T.inkSoft, margin: "4px 0" }}>{j.note}</div>
          <div style={{ fontSize: 14, color: T.ink, marginBottom: 10 }}>{t("jb_to")} {j.drop_text}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {j.other_phone && <a href={`tel:${j.other_phone}`} style={linkBtn(T.green)}>{t("jb_call")}</a>}
            {typeof j.pickup_lat === "number" && (
              <a href={dirUrl(j.pickup_lat, j.pickup_lng)} target="_blank" rel="noopener noreferrer" style={linkBtn(T.brandDark)}>{t("jb_dir")}</a>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {j.status === "accepted" && <Btn kind="ghost" disabled={busy === j.id} onClick={() => move(j, "picked_up")}>{t("jb_picked")}</Btn>}
            <Btn disabled={busy === j.id} onClick={() => move(j, "delivered")}>{t("jb_done")}</Btn>
          </div>
        </div>
      ))}
      <h2 style={h2}>{t("jb_title")}</h2>
      {msg && <Notice tone="bad">{msg}</Notice>}
      {!online ? (
        <Notice tone="info">{t("jb_offline")}</Notice>
      ) : jobs.length === 0 ? (
        <div style={{ fontSize: 14, color: T.inkFaint, lineHeight: 1.6 }}>{t("jb_none")}</div>
      ) : jobs.map((j) => (
        <div key={j.id} style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.ink }}>{j.shop}</span>
            <span style={{ fontSize: 12.5, color: T.inkFaint }}>{String(t("jb_km")).replace("{n}", j.km)}</span>
          </div>
          <div style={{ fontSize: 14, color: T.inkSoft, margin: "4px 0" }}>{j.note}</div>
          <div style={{ fontSize: 14, color: T.ink }}>{t("jb_to")} {j.drop_text}</div>
          <div style={{ fontSize: 13.5, color: T.brandDark, fontWeight: 700, margin: "6px 0 10px" }}>
            {j.fee_paise != null ? String(t("jb_fee")).replace("{n}", Math.round(j.fee_paise / 100)) : t("jb_fee_none")}
          </div>
          <Btn full disabled={busy === j.id} onClick={() => accept(j)}>{busy === j.id ? "…" : t("jb_accept")}</Btn>
        </div>
      ))}
    </div>
  );
}

const linkBtn = (bg) => ({
  display: "inline-flex", alignItems: "center", background: bg, color: "#fff", borderRadius: 10,
  padding: "10px 14px", minHeight: 44, fontWeight: 700, fontSize: 14.5, textDecoration: "none", boxSizing: "border-box",
});

// ------------------------------------------------------------------ SHOP
export function ShopJobs({ api, hasListing }) {
  const { t } = useI18n();
  const [f, setF] = useState({ note: "", drop: "", fee: "" });
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try { setJobs(many(await api.myJobs()).filter((j) => j.role === "shop")); } catch (_) {}
  }, [api]);
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.jobPost(f.note, f.drop, f.fee === "" ? null : Number(f.fee)));
      if (r && r.ok) { setF({ note: "", drop: "", fee: "" }); setMsg({ tone: "good", text: t("jp_sent") }); load(); }
      else setMsg({ tone: "bad", text: r && r.reason === "no_listing" ? t("jp_need_listing") : t("e_save") });
    } catch (e) { setMsg({ tone: "bad", text: (e && e.message) || t("e_save") }); }
    setBusy(false);
  };
  const cancel = async (j) => { try { await api.jobUpdate(j.id, "cancel"); } catch (_) {} load(); };

  if (!hasListing) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={h2}>{t("jp_title")}</h2>
      <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, marginBottom: 10 }}>{t("jp_sub")}</div>
      <input style={{ ...input, marginBottom: 8 }} value={f.note} maxLength={300} placeholder={t("jp_note_ph")} aria-label={t("jp_note")}
             onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} />
      <input style={{ ...input, marginBottom: 8 }} value={f.drop} maxLength={200} placeholder={t("jp_drop")} aria-label={t("jp_drop")}
             onChange={(e) => setF((x) => ({ ...x, drop: e.target.value }))} />
      <input style={{ ...input, marginBottom: 10 }} value={f.fee} inputMode="numeric" maxLength={4} placeholder={t("jp_fee")} aria-label={t("jp_fee")}
             onChange={(e) => setF((x) => ({ ...x, fee: e.target.value.replace(/\D/g, "") }))} />
      {msg && <div style={{ marginBottom: 10 }}><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <Btn full disabled={busy || f.note.trim().length < 3 || f.drop.trim().length < 3} onClick={send}>{busy ? "…" : t("jp_send")}</Btn>
      {jobs.length > 0 && <h2 style={{ ...h2, marginTop: 18 }}>{t("jp_mine")}</h2>}
      {jobs.map((j) => (
        <div key={j.id} style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{j.note}</div>
          <div style={{ fontSize: 13.5, color: T.inkSoft, margin: "3px 0" }}>{t("jb_to")} {j.drop_text}</div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: j.status === "delivered" ? T.green : T.brandDark }}>{t("jp_status_" + j.status)}</div>
          {j.other_name && j.status !== "cancelled" && (
            <div style={{ fontSize: 13.5, color: T.ink, marginTop: 4 }}>
              {String(t("jp_rider")).replace("{name}", j.other_name)}{" "}
              {j.other_phone && <a href={`tel:${j.other_phone}`} style={{ color: T.brandDark, fontWeight: 700 }}>{j.other_phone}</a>}
            </div>
          )}
          {["open", "accepted"].includes(j.status) && (
            <button onClick={() => cancel(j)} style={{ background: "none", border: "none", color: T.red, fontWeight: 700, cursor: "pointer", minHeight: 40, padding: 0, fontFamily: "inherit" }}>{t("jp_cancel")}</button>
          )}
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------- BOOKINGS
const PERIODS = ["week", "month", "quarter", "year"];

export function BookingSheet({ api, row, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [period, setPeriod] = useState("month");
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = one(await api.bookingRequest(row.id, period, start, note));
      if (r && r.ok) setSent(true);
      else setMsg(r && r.reason === "already_open" ? t("bk_open") : t("e_save"));
    } catch (e) { setMsg((e && e.message) || t("e_save")); }
    setBusy(false);
  };
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 460, padding: "14px 18px 24px", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0, color: T.ink }}>{String(t("bk_title")).replace("{name}", row.display_name || "")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        {sent ? (
          <div style={{ marginTop: 12 }}><Notice tone="good">{t("bk_sent")}</Notice></div>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6 }}>{t("bk_sub")}</p>
            <div style={{ fontSize: 14, fontWeight: 700, margin: "6px 0" }}>{t("bk_period")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  border: `1px solid ${period === p ? T.brandDark : T.line}`, borderRadius: 18, padding: "8px 14px", minHeight: 40,
                  background: period === p ? T.brandSoft : T.white, color: T.ink, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit",
                }}>{t("bk_" + p)}</button>
              ))}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, margin: "6px 0" }}>{t("bk_start")}</div>
            <input type="date" min={today} value={start} onChange={(e) => setStart(e.target.value)} style={{ ...input, marginBottom: 12 }} />
            <textarea style={{ ...input, width: "100%", minHeight: 80, boxSizing: "border-box", marginBottom: 12 }} maxLength={300}
                      placeholder={t("bk_note")} value={note} onChange={(e) => setNote(e.target.value)} />
            {msg && <div style={{ marginBottom: 10 }}><Notice tone="bad">{msg}</Notice></div>}
            <Btn full disabled={busy || !start} onClick={send}>{busy ? "…" : t("bk_send")}</Btn>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------- MY BOOKINGS AND JOBS
export function MyRequestsSheet({ api, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [bk, setBk] = useState([]);
  const [jobs, setJobs] = useState([]);
  const load = useCallback(async () => {
    try { setBk(many(await api.myBookings())); } catch (_) {}
    try { setJobs(many(await api.myJobs())); } catch (_) {}
  }, [api]);
  useEffect(() => { load(); }, [load]);
  const answer = async (b, yes) => { try { await api.bookingAnswer(b.id, yes); } catch (_) {} load(); };
  const cancel = async (b) => { try { await api.bookingCancel(b.id); } catch (_) {} load(); };
  const empty = bk.length === 0 && jobs.length === 0;
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, padding: "14px 18px 24px", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0, color: T.ink }}>{t("rq_title")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        {empty && <p style={{ color: T.inkFaint, fontSize: 14 }}>{t("rq_empty")}</p>}
        {bk.length > 0 && <h2 style={{ ...h2, marginTop: 14 }}>{t("bk_mine")}</h2>}
        {bk.map((b) => (
          <div key={b.id} style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{b.other_name} · {t("bk_" + b.period)}</div>
            <div style={{ fontSize: 13.5, color: T.inkSoft }}>{t("bk_start")}: {b.start_on}</div>
            {b.note && <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 3 }}>{b.note}</div>}
            <div style={{ fontSize: 13.5, fontWeight: 800, color: b.status === "accepted" ? T.green : T.brandDark, marginTop: 4 }}>{t("bk_status_" + b.status)}</div>
            {b.other_phone && <a href={`tel:${b.other_phone}`} style={{ ...linkBtn(T.green), marginTop: 8 }}>{b.other_phone}</a>}
            {b.role === "worker" && b.status === "requested" && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Btn onClick={() => answer(b, true)}>{t("bk_accept")}</Btn>
                <Btn kind="ghost" onClick={() => answer(b, false)}>{t("bk_decline")}</Btn>
              </div>
            )}
            {b.role === "customer" && ["requested", "accepted"].includes(b.status) && (
              <button onClick={() => cancel(b)} style={{ background: "none", border: "none", color: T.red, fontWeight: 700, cursor: "pointer", minHeight: 40, padding: 0, fontFamily: "inherit" }}>{t("bk_cancel")}</button>
            )}
          </div>
        ))}
        {jobs.length > 0 && <h2 style={{ ...h2, marginTop: 14 }}>{t("jb_title")}</h2>}
        {jobs.map((j) => (
          <div key={j.id} style={card}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{j.other_name ? `${j.other_name} · ` : ""}{j.note}</div>
            <div style={{ fontSize: 13.5, color: T.inkSoft }}>{t("jb_to")} {j.drop_text}</div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: T.brandDark }}>{t("jp_status_" + j.status)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- PARTNER
export function PartnerSheet({ api, signedIn, onSignIn, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, padding: "14px 18px 24px", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1 style={{ flex: 1, fontSize: 20, fontWeight: 800, margin: 0, color: T.ink }}>{t("pt_title")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        <p style={{ fontSize: 14.5, color: T.inkSoft, lineHeight: 1.6 }}>{t("pt_body")}</p>
        <ol style={{ paddingLeft: 20, fontSize: 14.5, color: T.ink, lineHeight: 1.8, margin: "0 0 14px" }}>
          <li>{t("pt_1")}</li><li>{t("pt_2")}</li><li>{t("pt_3")}</li>
        </ol>
        {signedIn ? <InvitePanel api={api} /> : <Btn full onClick={() => { onClose(); onSignIn && onSignIn(); }}>{t("nav_signin")}</Btn>}
        <p style={{ fontSize: 13, color: T.inkFaint, lineHeight: 1.6, marginTop: 14 }}>{t("pt_help")}</p>
      </div>
    </div>
  );
}

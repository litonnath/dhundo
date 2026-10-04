// ---------------------------------------------------------------------------
// CHECK THE PHONE: a one-time code sent by SMS, once per account. Rewards and
// withdrawals are paid only after this (sql/109), so accounts made with
// numbers somebody does not own earn nothing. Signing in stays phone + PIN.
// Needs an SMS provider switched on in Supabase (Authentication, Providers,
// Phone) -- see PHONE_CHECK.md.
// ---------------------------------------------------------------------------
import React, { useState, useEffect } from "react";
import { T, Btn, CloseButton, useDismissable, input, Notice } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { mfaVerifiedFactor, mfaEnroll, mfaChallengeVerify } from "./auth.jsx";

export function PhoneVerifySheet({ api, phone, onClose, onDone }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const e164 = () => {
    const d = String(phone || "").replace(/\D/g, "");
    return `+${d.length === 10 ? "91" + d : d}`;
  };

  const send = async () => {
    setBusy(true); setErr("");
    const r = await api.sendPhoneCode(e164());
    setBusy(false);
    if (r.ok) { setSent(true); setWait(45); }
    else setErr(r.status === 429 ? t("e_rate") : t("pv_unavail"));
  };
  const verify = async () => {
    setBusy(true); setErr("");
    const r = await api.verifyPhoneCode(e164(), code.trim());
    if (!r.ok) { setBusy(false); setErr(t("pv_bad")); return; }
    try { await api.claimRewards(); } catch (_) { /* the wallet shows what arrived */ }
    setBusy(false);
    onDone && onDone();
  };

  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 530, background: "rgba(15,20,25,0.55)",
                  display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 460,
                    padding: "14px 18px 24px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0, color: T.ink }}>{t("pv_title")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>{t("pv_body")}</p>
        <div style={{ fontWeight: 800, fontSize: 15, color: T.ink, marginBottom: 10 }}>{e164()}</div>
        {err && <div style={{ marginBottom: 10 }}><Notice tone="bad">{err}</Notice></div>}
        {!sent ? (
          <Btn full disabled={busy} onClick={send}>{busy ? "…" : t("pv_send")}</Btn>
        ) : (
          <>
            <Notice tone="info">{t("pv_sent")}</Notice>
            <input style={{ ...input, marginTop: 10, marginBottom: 10, letterSpacing: 6, fontSize: 20, textAlign: "center" }}
                   inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                   placeholder={t("pv_code_ph")} aria-label={t("pv_code_ph")}
                   onChange={(e) => { setErr(""); setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); }} />
            <Btn full disabled={busy || code.length < 6} onClick={verify}>{busy ? "…" : t("pv_verify")}</Btn>
            <button disabled={wait > 0 || busy} onClick={send} style={{
              background: "none", border: "none", color: T.brandDark, fontWeight: 700, fontSize: 13.5,
              minHeight: 44, cursor: wait > 0 ? "default" : "pointer", fontFamily: "inherit", marginTop: 4,
            }}>{wait > 0 ? `${t("pv_send")} (${wait})` : t("pv_send")}</button>
          </>
        )}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// ADMIN: turn on the authenticator-app code for this admin account. Shown at
// the top of Manage. Once every admin has done this, switch the requirement
// on in the database (sql/111) and an admin session without the code is
// refused by every admin function.
// ---------------------------------------------------------------------------
export function AdminMfaCard({ api, onSession }) {
  const [state, setState] = useState("loading");
  const [enrol, setEnrol] = useState(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = api.accessToken ? await api.accessToken() : null;
      if (!token) { if (alive) setState("none"); return; }
      const f = await mfaVerifiedFactor(api.cfg, token);
      if (alive) setState(f ? "on" : "off");
    })();
    return () => { alive = false; };
  }, [api]);

  const start = async () => {
    setBusy(true); setErr("");
    try { setEnrol(await mfaEnroll(api.cfg, await api.accessToken())); }
    catch (_) { setErr("Could not start. Is MFA switched on in Supabase (Authentication, Multi-Factor)?"); }
    setBusy(false);
  };
  const confirm = async () => {
    setBusy(true); setErr("");
    try {
      const tk = await mfaChallengeVerify(api.cfg, await api.accessToken(), enrol.id, code);
      onSession && onSession(tk);
      setEnrol(null); setState("on");
    } catch (_) { setErr("That code is not right. Wait for the next one and try again."); }
    setBusy(false);
  };

  if (state === "loading" || state === "none") return null;
  const box = { background: T.white, border: `1px solid ${state === "on" ? T.line : T.red}`, borderRadius: 14, padding: "13px 14px", marginBottom: 16 };
  return (
    <div style={box}>
      <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 4 }}>
        Admin two-step sign-in {state === "on" ? "- on" : "- not set up"}
      </div>
      {state === "on" ? (
        <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55 }}>
          You sign in with your PIN and then a 6-digit code from your authenticator app.
        </div>
      ) : !enrol ? (
        <>
          <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, marginBottom: 8 }}>
            Admins can open every ID photo and phone number, so a PIN alone is not enough. Set up an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) in a minute.
          </div>
          <Btn onClick={start} disabled={busy}>{busy ? "…" : "Set up"}</Btn>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, marginBottom: 8 }}>
            In the app choose Add account, scan this picture (or type the key), then enter the 6-digit code it shows.
          </div>
          {enrol.qr && <img src={enrol.qr} alt="" width={180} height={180} style={{ display: "block", margin: "0 auto 8px" }} />}
          {enrol.secret && <div style={{ fontFamily: "monospace", fontSize: 13, textAlign: "center", wordBreak: "break-all", marginBottom: 10 }}>{enrol.secret}</div>}
          <input style={{ ...input, letterSpacing: 6, fontSize: 20, textAlign: "center", marginBottom: 8 }} inputMode="numeric"
                 maxLength={6} value={code} onChange={(e) => { setErr(""); setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); }} />
          <Btn full disabled={busy || code.length < 6} onClick={confirm}>{busy ? "…" : "Turn on"}</Btn>
        </>
      )}
      {err && <div style={{ color: T.red, fontSize: 13, fontWeight: 700, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

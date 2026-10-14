// RESET A FORGOTTEN PIN. Three steps: an SMS code proves the number is theirs (Firebase), then a new
// 6-digit PIN is saved by the pin-reset function. Needs FIREBASE_CONFIG (see PHONE_CHECK.md).
import React, { useEffect, useRef, useState } from "react";
import { T, Btn, CloseButton, useDismissable, input, Notice } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { firebaseConfigured, fbWarm, fbSendCode, fbConfirmCode } from "./firebasephone.js";
import { normalizePhone, isValidPhone, prettyPhone } from "./auth.jsx";

export function PinResetSheet({ cfg, phone, onClose, onDone }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const on = firebaseConfigured();
  const box = useRef(null);
  const [step, setStep] = useState("phone");   // phone | code | pin | done
  const [num, setNum] = useState(String(phone || ""));
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => { if (on) fbWarm(box.current).catch(() => {}); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const why = (e) => { const c = String((e && (e.code || e.message)) || ""); return c ? ` (${c})` : ""; };
  const send = async () => {
    if (!isValidPhone(num)) { setErr(t("ae_phone")); return; }
    setBusy(true); setErr("");
    try { await fbSendCode(`+${normalizePhone(num)}`, box.current); setStep("code"); setWait(45); }
    catch (e) { setErr(/too-many/.test(String((e && e.code) || "")) ? t("e_rate") : `${t("pv_unavail")}${why(e)}`); }
    setBusy(false);
  };
  const confirm = async () => {
    setBusy(true); setErr("");
    try { setToken(await fbConfirmCode(code.trim())); setStep("pin"); }
    catch (e) { setErr(`${t("pv_bad")}${why(e)}`); }
    setBusy(false);
  };
  const save = async () => {
    if (!/^\d{6}$/.test(pin)) { setErr(t("pr_bad_pin")); return; }
    if (pin !== pin2) { setErr(t("pr_mismatch")); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch(`${cfg.url}/functions/v1/pin-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.anonKey },
        body: JSON.stringify({ idToken: token, newPin: pin }),
      });
      let j = {};
      try { j = await res.json(); } catch (_) { /* no body */ }
      if (res.ok && j.ok) setStep("done");
      else if (j.reason === "no_account") setErr(t("pr_no_account"));
      else if (j.reason === "limit" || res.status === 429) setErr(t("e_rate"));
      else if (j.reason === "expired") { setErr(t("pr_expired")); setStep("phone"); setCode(""); }
      else setErr(`${t("pv_unavail")}${j.reason ? ` (${j.reason})` : ""}`);
    } catch (_) { setErr(t("pv_unavail")); }
    setBusy(false);
  };

  const num6 = { ...input, marginTop: 8, marginBottom: 8, letterSpacing: 6, fontSize: 20, textAlign: "center" };
  const digits = (setter) => (e) => { setErr(""); setter(e.target.value.replace(/\D/g, "").slice(0, 6)); };
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 560, background: "rgba(15,20,25,0.58)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 460, padding: "14px 18px 24px", boxSizing: "border-box", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0, color: T.ink }}>{t("pr_title")}</h1>
          <CloseButton onClick={() => { if (!busy) onClose(); }} />
        </div>
        <div ref={box} />
        {!on ? (
          <div style={{ marginTop: 12 }}><Notice tone="info">{t("pr_off")}</Notice></div>
        ) : (
          <>
            {err && <div style={{ margin: "10px 0 0" }}><Notice tone="bad">{err}</Notice></div>}
            {step === "phone" && (
              <>
                <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>{t("pr_phone_hint")}</p>
                <input style={{ ...input, marginBottom: 10 }} inputMode="tel" autoComplete="tel" value={num} placeholder="98620 12345" aria-label={t("pr_phone_hint")}
                       onChange={(e) => { setErr(""); setNum(e.target.value); }} />
                <Btn full disabled={busy || !num.trim()} onClick={send}>{busy ? t("pv_sending") : t("pv_send")}</Btn>
              </>
            )}
            {step === "code" && (
              <>
                <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>{t("pv_sent")} {prettyPhone(num)}</p>
                <input style={num6} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} placeholder={t("pv_code_ph")} aria-label={t("pv_code_ph")} onChange={digits(setCode)} />
                <Btn full disabled={busy || code.length < 6} onClick={confirm}>{busy ? t("pv_checking") : t("pr_continue")}</Btn>
                <button disabled={wait > 0 || busy} onClick={send} style={{ background: "none", border: "none", color: T.brandDark, fontWeight: 700, fontSize: 13.5, minHeight: 44, cursor: wait > 0 ? "default" : "pointer", fontFamily: "inherit", marginTop: 4 }}>
                  {wait > 0 ? `${t("pv_send")} (${wait})` : t("pv_send")}
                </button>
              </>
            )}
            {step === "pin" && (
              <>
                <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>{t("pr_new_hint")}</p>
                <input style={num6} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} placeholder={t("pr_new")} aria-label={t("pr_new")} onChange={digits(setPin)} />
                <input style={num6} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin2} placeholder={t("pr_again")} aria-label={t("pr_again")} onChange={digits(setPin2)} />
                <Btn full disabled={busy || pin.length < 6 || pin2.length < 6} onClick={save}>{busy ? "…" : t("pr_save")}</Btn>
              </>
            )}
            {step === "done" && (
              <>
                <div style={{ margin: "12px 0" }}><Notice tone="good">{t("pr_done")}</Notice></div>
                <Btn full onClick={() => onDone && onDone(num)}>{t("pr_signin")}</Btn>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

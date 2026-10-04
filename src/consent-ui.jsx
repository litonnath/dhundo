// ---------------------------------------------------------------------------
// CONSENT UI -- the provider that asks, the sheet it asks with, the card on
// the home screen and the Privacy panel in Account. What is stored and how is
// in consent-core.js; the database enforces the answers (sql/93_parts).
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { T, Btn, Icon, CloseButton, useDismissable } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import {
  ConsentCtx, useConsent, CONSENT_VERSION, CONSENT_EVENT, DEVICE_ONLY, PURPOSES,
  getLocal, hasLocal, setLocal,
} from "./consent-core.js";

const ICONS = { location: "pin", live: "pin", account: "user", listing: "user", market: "suppliers", profile: "home" };

// ------------------------------------------------------------------- sheet
function ConsentSheet({ purpose, onDecide }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const decide = async (granted) => {
    if (busy) return;
    setBusy(true);
    await onDecide(granted);
  };
  // Esc and the Android Back button mean "not now".
  useDismissable(true, () => decide(false));
  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="cs-title"
      onClick={(e) => { if (e.target === e.currentTarget) decide(false); }}
      style={{
        position: "fixed", inset: 0, zIndex: 500, background: "rgba(15,20,25,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{
        background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 460,
        padding: "20px 20px 24px", boxShadow: "0 -10px 40px rgba(0,30,45,0.25)",
        maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, color: "#fff",
            background: `linear-gradient(135deg, ${T.brand}, ${T.brandDeep})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><Icon name={ICONS[purpose] || "user"} size={23} /></span>
          <span id="cs-title" style={{ flex: 1, fontSize: 17.5, fontWeight: 800, color: T.ink, lineHeight: 1.3, paddingTop: 2 }}>
            {t("cs_t_" + purpose)}
          </span>
          <CloseButton onClick={() => decide(false)} />
        </div>
        <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.65, margin: "0 0 10px" }}>
          {t("cs_b_" + purpose)}
        </p>
        <p style={{ fontSize: 12.5, color: T.inkFaint, lineHeight: 1.55, margin: "0 0 16px" }}>
          {t("cs_hint")}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn kind="ghost" full disabled={busy} onClick={() => decide(false)}>{t("cs_deny")}</Btn>
          <Btn full disabled={busy} onClick={() => decide(true)}>{t("cs_allow")}</Btn>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- provider
// rpc(name, body) is an authenticated call; signedIn says whether to use it.
export function ConsentProvider({ rpc, signedIn, children }) {
  const [tick, setTick] = useState(0);
  const [asking, setAsking] = useState(null);
  const queue = useRef([]);
  const active = useRef(null);
  const rpcRef = useRef(rpc);
  const signedRef = useRef(signedIn);
  rpcRef.current = rpc;
  signedRef.current = signedIn;

  const bump = () => setTick((n) => n + 1);

  // One place that records an answer: on the device, to whoever is listening
  // (the live switch, the saved position), and in the database when signed in.
  const save = useCallback(async (purpose, granted) => {
    setLocal(purpose, granted);
    bump();
    try { window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { purpose, granted } })); } catch (_) {}
    if (signedRef.current && rpcRef.current) {
      try {
        await rpcRef.current("services_record_consent",
          { p_purpose: purpose, p_granted: granted, p_version: CONSENT_VERSION });
      } catch (_) { /* the database refuses what it has no record of, and says so */ }
    }
  }, []);

  const next = useCallback(() => {
    if (active.current || !queue.current.length) return;
    active.current = queue.current.shift();
    setAsking(active.current.purpose);
  }, []);

  // True at once when already allowed; otherwise opens the sheet. Two asks
  // for the same thing share one sheet; different ones take turns.
  const ask = useCallback((purpose) => new Promise((resolve) => {
    if (hasLocal(purpose)) return resolve(true);
    const same = (active.current && active.current.purpose === purpose)
      ? active.current : queue.current.find((q) => q.purpose === purpose);
    if (same) { same.resolvers.push(resolve); return; }
    queue.current.push({ purpose, resolvers: [resolve] });
    next();
  }), [next]);

  const decide = useCallback(async (granted) => {
    const cur = active.current;
    if (!cur) return;
    await save(cur.purpose, granted);
    active.current = null;
    setAsking(null);
    cur.resolvers.forEach((r) => r(granted));
    setTimeout(next, 0);
  }, [save, next]);

  const grant = useCallback((p) => save(p, true), [save]);
  const withdraw = useCallback((p) => save(p, false), [save]);

  // On sign-in: send what this device already agreed to (the sign-up box was
  // ticked before there was an account to record it against), and take what
  // the account agreed to on another device, except the two that belong to
  // one device.
  useEffect(() => {
    if (!signedIn || !rpc) return undefined;
    let alive = true;
    (async () => {
      let rows;
      try { rows = await rpc("services_my_consents", {}); } catch (_) { return; }
      if (!alive || !Array.isArray(rows)) return;
      const byP = {};
      rows.forEach((r) => { byP[r.purpose] = r; });
      for (const p of PURPOSES) {
        const srv = byP[p];
        const loc = getLocal(p);
        const srvAt = srv ? (Date.parse(srv.at) || 0) : 0;
        if (loc && (!srv || (loc.at > srvAt && loc.granted !== srv.granted))) {
          try {
            await rpc("services_record_consent",
              { p_purpose: p, p_granted: loc.granted, p_version: loc.v || CONSENT_VERSION });
          } catch (_) {}
        } else if (srv && !DEVICE_ONLY.includes(p) && (!loc || srvAt > loc.at)) {
          setLocal(p, srv.granted, srvAt);
        }
      }
      if (alive) bump();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const value = useMemo(
    () => ({ has: hasLocal, ask, grant, withdraw, tick }),
    [ask, grant, withdraw, tick]);

  return (
    <ConsentCtx.Provider value={value}>
      {children}
      {asking && <ConsentSheet purpose={asking} onDecide={decide} />}
    </ConsentCtx.Provider>
  );
}

// ------------------------------------------------------ account > privacy
export function PrivacyPanel({ bare = false }) {
  const { t } = useI18n();
  const c = useConsent();
  return (
    <div style={bare ? {} : {
      background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: "16px 16px 12px",
      marginTop: 14,
    }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: T.ink, margin: "0 0 3px" }}>{t("cs_priv_t")}</h2>
      <p style={{ fontSize: 13, color: T.inkFaint, margin: "0 0 12px", lineHeight: 1.5 }}>{t("cs_priv_b")}</p>
      {PURPOSES.map((p) => {
        const on = hasLocal(p);
        return (
          <div key={p} style={{ borderTop: `1px solid ${T.line}`, padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: T.ink, lineHeight: 1.35 }}>
                {t("cs_t_" + p)}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 800, borderRadius: 12, padding: "3px 9px", whiteSpace: "nowrap",
                background: on ? "#E4F5EA" : "#F1F4F6", color: on ? "#14793B" : T.inkSoft,
              }}>{on ? t("cs_on") : t("cs_off")}</span>
            </div>
            <p style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6, margin: "6px 0 8px" }}>
              {t("cs_b_" + p)}
            </p>
            {p !== "account" && (
              on
                ? <Btn kind="ghost" onClick={() => c.withdraw(p)} style={{ minHeight: 38, padding: "7px 14px", fontSize: 13.5 }}>
                    {t("cs_withdraw")}
                  </Btn>
                : <Btn onClick={() => c.ask(p)} style={{ minHeight: 38, padding: "7px 14px", fontSize: 13.5 }}>
                    {t("cs_allow")}
                  </Btn>
            )}
          </div>
        );
      })}
      <p style={{ fontSize: 12.5, color: T.inkFaint, lineHeight: 1.55, margin: "4px 0 2px" }}>{t("cs_wnote")}</p>
    </div>
  );
}

// ---------------------------------------------------------- the small link
// Consent is asked where the data is saved: at sign-up, on a listing, on
// "use my location". This is only the way back -- one quiet link in Account
// that opens the same answers in a sheet, so taking a yes back is as easy as
// giving it was, without a page of text sitting in the Account tab.
export function PrivacyLink() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <button onClick={() => setOpen(true)} style={{
          background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
          color: T.inkFaint, fontSize: 13, fontWeight: 600, textDecoration: "underline",
          minHeight: 40, padding: "6px 10px",
        }}>{t("cs_priv_t")}</button>
      </div>
      {open && <PrivacySheet onClose={() => setOpen(false)} />}
    </>
  );
}

function PrivacySheet({ onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 330, background: "rgba(15,20,25,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{
        background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 460,
        padding: "8px 18px 22px", boxShadow: "0 -10px 40px rgba(0,30,45,0.25)",
        maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><CloseButton onClick={onClose} /></div>
        <PrivacyPanel bare />
      </div>
    </div>
  );
}

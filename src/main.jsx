// ===========================================================================
// main.jsx -- Dhundo.
//
// A separate build, a separate origin, a separate brand and now separate
// accounts. It shares ONE thing with ShortlistOne: the Postgres database. No
// code crosses between them, so a change here cannot break the hiring
// platform.
//
// WHAT CHANGED, AND WHY IT MATTERED
// This app used to sign people in with a ShortlistOne email and password,
// against the sign_up table. Two problems with that, one of them fatal:
//
//   * somebody looking for a plumber had to hold an account on a hiring
//     platform, and had to have an email address at all -- which a good part
//     of this audience does not
//   * every listing and every revealed number was keyed to a sign_up row, so
//     the two products could not be separated later without a data migration
//
// Accounts now live in services_signups and are keyed on a phone number. See
// auth.jsx for how a phone number still ends up with a GoTrue session, and
// sql/59 for the identity change on the database side.
//
// WHO IS AN ADMIN
// Not an email address compared in the browser -- that was only ever a UI
// hint, since the real check lives in the definer functions. It is now the
// is_admin column on services_signups, returned by services_me(), so the tabs
// the browser shows and the permissions the database enforces come from one
// place.
// ===========================================================================
import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import ServicesPage from "./services.jsx";
import { I18nProvider, useI18n } from "./i18n.jsx";
import { registerServiceWorker } from "./device.jsx";
import { DhundoLogo } from "./brand.jsx";
import { CloseButton, useDismissable, SignupHelp } from "./ui.jsx";
import { NoticePage, NoticeSheet } from "./privacy.jsx";
import { ConsentProvider } from "./consent-ui.jsx";
import { useConsent } from "./consent-core.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import {
  signUpWithPhone, signInWithPhone, refreshAccount, signOutEverywhere,
  isValidPhone, prettyPhone,
} from "./auth.jsx";
import { cleanCode, codeLooksRight, pendingCode, rememberCode } from "./referral.js";

const CFG = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };

const INK = "#0F1419";
// Taken from the logo, like the rest of the app. These were left at the old
// teal when the palette moved, so the sign-in button was the one control on
// the site still wearing the pre-Dhundo colours -- visible only when the
// panel was open over a blue page.
const MATCH = "#0A5BB8";
const DEEP = "#054291";
const LINE = "rgba(15,20,25,0.10)";
const MUTED = "rgba(15,20,25,0.55)";
const ERROR = "#C43D2E";

// Its own storage key on its own origin. The old key is left alone rather
// than deleted: it belongs to a session shape this build no longer
// understands, and clearing it is not worth a read-modify-write on load.
const STORE = "dhundo_session";

function readSession() {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.user || !s.access_token) return null;
    // A token past its life is worse than none: it produces 401s that look
    // like permission bugs rather than like being signed out.
    if (s.expires_at && Date.now() >= s.expires_at) return null;
    return s;
  } catch (_) {
    return null;
  }
}

function writeSession(s) {
  try {
    if (s) window.localStorage.setItem(STORE, JSON.stringify(s));
    else window.localStorage.removeItem(STORE);
  } catch (_) {
    // Private mode. The session lives in memory for this tab only.
  }
}

// Every thrown code from auth.jsx maps to one sentence in the person's own
// language. Nothing from GoTrue reaches the screen: its messages talk about
// email addresses, which would be baffling to somebody who typed a phone
// number.
function messageFor(code, t) {
  switch (code) {
    case "BAD_PHONE":           return t("ae_phone");
    case "SHORT_PASSWORD":      return t("ae_pass");
    case "BAD_PIN":             return t("ae_pin");
    case "NAME_REQUIRED":       return t("ae_name");
    case "PHONE_TAKEN":         return t("ae_taken");
    case "BAD_CREDENTIALS":     return t("ae_bad");
    case "ACCOUNT_BLOCKED":     return t("ae_blocked");
    case "CONFIRM_EMAIL_IS_ON": return t("ae_confirm");
    case "RATE_LIMITED":        return t("rl_msg");
    default:                    return t("ae_failed");
  }
}

// A courtesy lock on this browser: five wrong PINs in ten minutes and the
// form waits, a minute at first and longer each time. It stops a thumb that
// keeps guessing; the real limit is the sign-in service's own, per address,
// which a person on a script would not be stopped by this.
const LOCK_KEY = "dhundo_authlock";
const LOCK_FAILS = 5;
const LOCK_WINDOW = 10 * 60 * 1000;
function readLock() {
  try { return JSON.parse(window.localStorage.getItem(LOCK_KEY)) || {}; } catch (_) { return {}; }
}
function writeLock(o) {
  try { window.localStorage.setItem(LOCK_KEY, JSON.stringify(o)); } catch (_) {}
}
function lockLeft() {
  const l = readLock();
  return l.until && l.until > Date.now() ? Math.ceil((l.until - Date.now()) / 1000) : 0;
}
// Seconds to wait after this failure, or 0 while still allowed.
function noteFail() {
  const l = readLock();
  const now = Date.now();
  const fails = (l.fails || []).filter((x) => now - x < LOCK_WINDOW);
  fails.push(now);
  if (fails.length >= LOCK_FAILS) {
    const strikes = Math.min((l.strikes || 0) + 1, 5);
    const secs = Math.min(60 * 2 ** (strikes - 1), 900);
    writeLock({ fails: [], strikes, until: now + secs * 1000 });
    return secs;
  }
  writeLock({ ...l, fails });
  return 0;
}

// ---------------------------------------------------------------------------
function AuthPanel({ onDone, onClose }) {
  const { t } = useI18n();
  // Escape and the Android Back button, same as every other sheet.
  useDismissable(true, onClose);
  const [mode, setMode] = useState("signin"); // signin | signup
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  // AN INVITE CODE, TYPED.
  //
  // The referral work shipped with only one way in: a ?ref= link. That
  // assumes the code arrives as something tappable, and for this audience it
  // mostly will not -- a mistri tells his friend "Y7RWHJ" at a tea stall,
  // and that friend had nowhere to put it. A link still works and still
  // pre-fills this box; typing is the path that was missing.
  const [code, setCode] = useState(() => pendingCode() || "");
  const consent = useConsent();
  const [agree, setAgree] = useState(false);
  const [more, setMore] = useState(false);
  const [notice, setNotice] = useState(false);

  const signup = mode === "signup";
  const codeBad = code.length > 0 && !codeLooksRight(code);

  const submit = async () => {
    setErr(null);
    if (!isValidPhone(phone)) return setErr(t("ae_phone"));
    if (signup && !name.trim()) return setErr(t("ae_name"));
    // Sign-up insists on six digits; sign-in only on a minimum length, so
    // accounts made before the PIN change can still get in.
    if (signup && !/^\d{6}$/.test(password)) return setErr(t("ae_pin"));
    if (!signup && (!password || password.length < 6)) return setErr(t("ae_pass"));

    // Not blocking. Somebody who mistypes a friend's code should still get
    // an account: the code is worth ₹3 to the person who gave it out, not to
    // them, so a wrong one costs them nothing and refusing the sign-up over
    // it would cost them everything. The database decides whether it is real.
    if (signup && code.trim() && codeLooksRight(code)) rememberCode(code);

    // Storing a name, a number and a PIN needs a yes first. Recorded on this
    // device now and in the database as soon as the account exists.
    if (signup && !agree) return setErr(t("cs_agree_need"));
    if (!signup) {
      const wait = lockLeft();
      if (wait > 0) return setErr(t("rl_signin").replace("{n}", wait));
    }

    setBusy(true);
    try {
      if (signup) await consent.grant("account");
      const s = signup
        ? await signUpWithPhone(CFG, { phone, name, password })
        : await signInWithPhone(CFG, { phone, password });
      if (!signup) writeLock({});
      if (signup) { try { window.localStorage.setItem("dhundo_verify_prompt", "1"); } catch (_) {} }
      onDone(s);
    } catch (e) {
      const wait = !signup && e.message === "BAD_CREDENTIALS" ? noteFail() : 0;
      setErr(wait ? t("rl_signin").replace("{n}", wait) : messageFor(e.message, t));
    } finally {
      setBusy(false);
    }
  };

  const field = {
    width: "100%", padding: "12px 13px", borderRadius: 10, border: `1px solid ${LINE}`,
    fontSize: 15.5, boxSizing: "border-box", minHeight: 48, fontFamily: "inherit",
    outline: "none", background: "#fff", color: INK,
  };
  const label = {
    display: "block", fontSize: 12.5, fontWeight: 700, color: MUTED,
    margin: "0 0 5px", letterSpacing: 0.2,
  };
  const hint = { fontSize: 11.5, color: "rgba(15,20,25,0.42)", margin: "5px 2px 0", lineHeight: 1.45 };

  return (
    <div
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 340, background: "rgba(15,20,25,0.58)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 440,
        padding: "22px 20px 26px", boxShadow: "0 -10px 44px rgba(0,30,45,0.28)",
        maxHeight: "92vh", overflowY: "auto",
      }}>
        {/* The X was missing here entirely. The only way out was "Keep
            browsing without signing in" at the very bottom, under the PIN
            field and two paragraphs -- easy to miss, and nothing in the top
            corner where everybody looks first. */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <DhundoLogo size={34} tagline={t("tagline")} />
          </span>
          <CloseButton onClick={() => { if (!busy) onClose(); }} />
        </div>

        {/* One panel, two modes. A separate sign-up screen behind a link is
            a screen people do not find; a toggle they can see is one tap. */}
        <div style={{
          display: "flex", background: "#F1F4F6", borderRadius: 11, padding: 4, marginBottom: 18,
        }}>
          {[["signin", t("au_signin")], ["signup", t("au_signup")]].map(([m, lbl]) => (
            <button key={m} onClick={() => { setMode(m); setErr(null); }} disabled={busy} style={{
              flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", minHeight: 44,
              background: mode === m ? "#fff" : "transparent",
              color: mode === m ? INK : MUTED,
              fontWeight: mode === m ? 800 : 600, fontSize: 14, cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: mode === m ? "0 1px 3px rgba(15,20,25,0.14)" : "none",
            }}>{lbl}</button>
          ))}
        </div>

        {/* Before the form, not after it: somebody stuck on the form is
            not going to scroll past it to find help. */}
        <SignupHelp />

        {err && (
          <div style={{
            background: "#FDECEA", border: "1px solid rgba(196,61,46,0.35)", color: ERROR,
            borderRadius: 10, padding: "10px 12px", fontSize: 13.5, marginBottom: 14,
            lineHeight: 1.55,
          }}>{err}</div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={label} htmlFor="ph">{t("au_phone")}</label>
          {/* inputMode numeric puts the number pad up on a phone; type="tel"
              alone still shows the full keyboard on some Android builds. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, ...field, padding: "0 13px" }}>
            <span style={{ fontSize: 15.5, color: MUTED, fontWeight: 600 }}>+91</span>
            <input
              id="ph" type="tel" inputMode="numeric" autoComplete="tel"
              value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus
              placeholder="98620 12345"
              style={{
                flex: 1, border: "none", outline: "none", fontSize: 15.5, minWidth: 0,
                padding: "12px 0", fontFamily: "inherit", background: "transparent", color: INK,
              }}
            />
          </div>
          {signup && <p style={hint}>{t("au_phone_hint")}</p>}
        </div>

        {signup && (
          <div style={{ marginBottom: 14 }}>
            <label style={label} htmlFor="nm">{t("au_name")}</label>
            <input id="nm" style={field} value={name} autoComplete="name"
                   onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        {/* Last, and visibly optional. Above the PIN it would read as one
            more obstacle between them and an account. */}
        {signup && (
          <div style={{ marginBottom: 14 }}>
            <label style={label} htmlFor="rf">{t("au_code")}</label>
            <input
              id="rf"
              style={{ ...field, textTransform: "uppercase", letterSpacing: 4,
                       fontWeight: 700, maxWidth: 220,
                       borderColor: codeBad ? ERROR : LINE }}
              value={code}
              maxLength={6}
              autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              placeholder="ABC123"
              onChange={(e) => setCode(cleanCode(e.target.value))}
            />
            <p style={hint}>{codeBad ? t("au_code_bad") : t("au_code_hint")}{code.trim() && !codeBad ? ` ${t("au_code_note")}` : ""}</p>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={label} htmlFor="pw">
            {signup ? t("au_pin") : t("au_pin_in")}
          </label>
          <input
            id="pw"
            type="password"
            // A number pad rather than the full keyboard, and a hard stop at
            // six on sign-up so nobody types seven and wonders why it failed.
            inputMode={signup ? "numeric" : "text"}
            maxLength={signup ? 6 : undefined}
            style={{ ...field, letterSpacing: signup ? 6 : "normal",
                     fontSize: signup ? 20 : 15.5 }}
            value={password}
            autoComplete={signup ? "new-password" : "current-password"}
            onChange={(e) => setPassword(
              signup ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value
            )}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) submit(); }}
          />
          {signup && <p style={hint}>{t("au_pin_hint")}</p>}
        </div>

        {signup && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", gap: 11, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
                     disabled={busy} style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, color: INK, lineHeight: 1.55 }}>{t("cs_agree")}</span>
            </label>
            <button type="button" onClick={() => setMore((v) => !v)} style={{
              background: "none", border: "none", padding: "6px 0 0 33px", color: DEEP,
              fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", minHeight: 32,
            }}>{t("cs_agree_more")}</button>
            {more && (
              <p style={{ ...hint, paddingLeft: 33, fontSize: 12.5, color: MUTED }}>{t("cs_b_account")}</p>
            )}
            <button type="button" onClick={() => setNotice(true)} style={{
              background: "none", border: "none", padding: "2px 0 0 33px", color: DEEP,
              fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", minHeight: 32,
            }}>{t("pn_link")}</button>
            {notice && <NoticeSheet onClose={() => setNotice(false)} />}
          </div>
        )}

        <button onClick={submit} disabled={busy} style={{
          width: "100%", padding: "13px", borderRadius: 11, border: "none",
          background: busy ? "rgba(0,180,216,0.6)" : `linear-gradient(135deg, ${MATCH}, ${DEEP})`,
          color: "#fff", fontWeight: 800, fontSize: 15.5, minHeight: 50,
          cursor: busy ? "default" : "pointer", fontFamily: "inherit",
        }}>
          {busy ? t("au_working") : signup ? t("au_signup") : t("au_signin")}
        </button>

        <p style={{ fontSize: 12.5, color: MUTED, margin: "14px 2px 0", lineHeight: 1.6 }}>
          {t("au_why")}
        </p>

        {/* Said out loud, because there is no self-service reset on a
            phone-only account: no email to send a link to. Somebody who
            forgets has to reach a human, and being told that up front beats
            discovering it while locked out. */}
        {!signup && (
          <p style={{ fontSize: 12.5, color: MUTED, margin: "8px 2px 0", lineHeight: 1.6 }}>
            {t("au_forgot")}
          </p>
        )}

        <button onClick={onClose} disabled={busy} style={{
          width: "100%", marginTop: 12, padding: "11px", borderRadius: 10,
          border: "none", background: "none", color: "rgba(15,20,25,0.45)",
          fontSize: 13.5, cursor: "pointer", minHeight: 44, fontFamily: "inherit",
        }}>{t("au_skip")}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function App() {
  const [session, setSession] = useState(() => readSession());
  const [showAuth, setShowAuth] = useState(false);

  // A stored token that is still in date can still be dead. One call on load
  // settles it, and refreshes the name and the admin flag while it is there.
  useEffect(() => {
    let alive = true;
    const s = readSession();
    if (!s) return;
    refreshAccount(CFG, s).then((next) => {
      if (!alive) return;
      if (!next) { writeSession(null); setSession(null); return; }
      writeSession(next);
      setSession(next);
    });
    return () => { alive = false; };
  }, []);

  // An expired token must not linger: every signed-in call would 401 and the
  // page would look broken rather than signed out.
  useEffect(() => {
    if (!session) return;
    const ms = (session.expires_at || 0) - Date.now();
    if (ms <= 0) { writeSession(null); setSession(null); return; }
    const timer = setTimeout(() => { writeSession(null); setSession(null); }, ms);
    return () => clearTimeout(timer);
  }, [session]);

  const getAccessToken = useCallback(
    async () => (session && session.access_token) || null,
    [session]
  );

  const signOut = useCallback(() => {
    const s = session;
    writeSession(null);
    setSession(null);
    // Best effort, after the UI has already updated. Nobody should watch a
    // spinner to sign out.
    signOutEverywhere(CFG, s);
  }, [session]);

  const user = session
    ? {
        id: session.user.id,
        full_name: session.user.full_name || "",
        phone: prettyPhone(session.user.phone),
      }
    : null;

  // The calls the consent layer makes as the signed-in person.
  const consentRpc = useCallback(async (name, body) => {
    const token = session && session.access_token;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }, [session]);

  return (
    <ConsentProvider rpc={consentRpc} signedIn={!!session}>
      <ServicesPage
        supabaseUrl={SUPABASE_URL}
        anonKey={SUPABASE_ANON_KEY}
        user={user}
        getAccessToken={getAccessToken}
        isAdmin={!!(session && session.user.is_admin)}
        onSignIn={() => setShowAuth(true)}
        onSignOut={signOut}
        onProfileSaved={(p) => {
          if (!session || !p) return;
          const next = { ...session, user: { ...session.user, full_name: p.full_name || null } };
          writeSession(next); setSession(next);
        }}
      />

      {showAuth && (
        <AuthPanel
          onDone={(s) => { writeSession(s); setSession(s); setShowAuth(false); }}
          onClose={() => setShowAuth(false)}
        />
      )}
    </ConsentProvider>
  );
}

// Registering the worker is what makes the site installable at all; it is
// network-first, so it can never pin people to an old build.
registerServiceWorker();

// /privacy is the standalone notice (the Play Store and the footer link to it).
const onPrivacyPage = (() => {
  try { return window.location.pathname.replace(/\/+$/, "") === "/privacy"; } catch (_) { return false; }
})();

createRoot(document.getElementById("root")).render(
  <I18nProvider>
    {onPrivacyPage ? <NoticePage /> : <App />}
  </I18nProvider>
);

// The opening screen in index.html: faded out once the app has painted,
// and never in under 700 ms, so a fast load does not flash the logo for a
// blink -- that reads as a glitch, not a brand.
(function hideSplash() {
  const el = document.getElementById("splash");
  if (!el) return;
  const shown = performance.now();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    setTimeout(() => {
      el.classList.add("gone");
      setTimeout(() => el.remove(), 400);
    }, Math.max(0, 700 - shown));
  }));
})();

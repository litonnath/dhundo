// ===========================================================================
// worker.jsx -- Work mode: the "captain app" half of Dhundo.
//
// Dhundo has two kinds of people and they want opposite things. Somebody
// looking for help wants a list; a mistri or an auto driver wants one big
// switch that says "I can take work now". Work mode is that switch and what
// it needs around it, kept apart from the search so neither screen has to
// explain the other.
//
// HOW "AVAILABLE NOW" STAYS TRUE
// While the switch is on and Dhundo is open, the phone's position goes to
// services_set_availability about once a minute, and immediately whenever
// the worker has moved 150 m or brings the app back to the front. The
// database drops anybody not heard from in 30 minutes, and the switch ends
// by itself after the hours chosen. Dhundo is a web app in an Android shell,
// so it cannot report from a locked phone -- the screen says so plainly
// rather than letting a worker believe customers can still see them.
//
// Customers are shown a distance, never the position (sql/80).
// ===========================================================================
import React, { useState, useEffect, useRef, useCallback } from "react";
import { T, Icon, Btn, Notice, SignupHelp } from "./ui.jsx";
import { SignInGate } from "./start.jsx";
import { useI18n } from "./i18n.jsx";
import { useConsent, CONSENT_EVENT } from "./consent-core.js";

const one = (r) => (Array.isArray(r) ? r[0] || null : r || null);

const HEARTBEAT_MS = 60 * 1000;
const MOVE_METRES = 150;
const HOURS_CHOICES = [2, 4, 8, 12];

function metresBetween(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ------------------------------------------------------------------- hook
//
// Lives at page level (ServicesPage), not inside the Work screen, so the
// position keeps going while the worker looks at their listing or wallet.
export function useAvailability(api, enabled) {
  const consent = useConsent();
  const [s, setS] = useState({
    loaded: false, online: false, until: null, seenAt: null,
    visible: true, busy: false, error: null,
  });
  const pos = useRef(null);       // latest fix from the phone
  const sent = useRef(null);      // position last sent, and when
  const watch = useRef(null);

  const patch = (p) => setS((old) => ({ ...old, ...p }));

  // What the database says, on load and after sign-in.
  useEffect(() => {
    if (!enabled) { patch({ loaded: true, online: false }); return; }
    let alive = true;
    api.myAvailability()
      .then((r) => {
        const row = one(r);
        if (!alive) return;
        patch({
          loaded: true,
          online: !!(row && row.online),
          until: row && row.online_until,
          seenAt: row && row.seen_at,
          visible: row ? row.visible !== false : true,
        });
      })
      .catch(() => alive && patch({ loaded: true }));
    return () => { alive = false; };
  }, [api, enabled]);

  const beat = useCallback(async (force) => {
    const p = pos.current;
    if (!p) return;
    const last = sent.current;
    const due = force || !last || Date.now() - last.at >= HEARTBEAT_MS ||
                metresBetween(last, p) >= MOVE_METRES;
    if (!due) return;
    sent.current = { ...p, at: Date.now() };
    try {
      const r = one(await api.setAvailability(true, p, null));
      if (r && r.ok) patch({ seenAt: new Date().toISOString(), until: r.online_until, error: null });
      else if (r && r.reason === "offline") patch({ online: false, until: null });
    } catch (e) {
      // The database refuses a position with no live-location consent on
      // record (withdrawn on another phone): stop saying "online".
      if (e && e.code === "consent_required") { patch({ online: false, until: null, error: "consent" }); return; }
      // Otherwise a dropped request on a weak signal: the next beat tries
      // again, and the database's 30-minute window absorbs a few missed ones.
    }
  }, [api]);

  // While online: follow the position, and beat on a timer so a worker
  // standing still at a stand is still "seen".
  useEffect(() => {
    if (!enabled || !s.online) return undefined;
    // The position is read only with the live-location consent given ON THIS
    // DEVICE: a worker who was online from another phone is asked again here.
    if (!consent.has("live")) { patch({ error: "consent" }); return undefined; }
    const geo = typeof navigator !== "undefined" && navigator.geolocation;
    if (geo) {
      watch.current = geo.watchPosition(
        (g) => {
          pos.current = { lat: g.coords.latitude, lng: g.coords.longitude,
                          accuracy: g.coords.accuracy };
          beat(false);
        },
        () => patch({ error: "location" }),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 }
      );
    }
    const timer = setInterval(() => beat(true), HEARTBEAT_MS);
    const onShow = () => { if (document.visibilityState === "visible") beat(true); };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      if (geo && watch.current !== null) geo.clearWatch(watch.current);
      watch.current = null;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [enabled, s.online, beat, consent.tick]);

  const goOnline = useCallback(async (hours) => {
    patch({ busy: true, error: null });
    if (!(await consent.ask("live"))) { patch({ busy: false, error: "consent" }); return; }
    const geo = typeof navigator !== "undefined" && navigator.geolocation;
    if (!geo) { patch({ busy: false, error: "location" }); return; }
    geo.getCurrentPosition(
      async (g) => {
        const p = { lat: g.coords.latitude, lng: g.coords.longitude, accuracy: g.coords.accuracy };
        pos.current = p;
        try {
          const r = one(await api.setAvailability(true, p, hours));
          if (r && r.ok) {
            sent.current = { ...p, at: Date.now() };
            patch({ online: true, until: r.online_until, seenAt: new Date().toISOString(),
                    visible: r.visible !== false, busy: false });
          } else {
            patch({ busy: false, error: (r && r.reason) || "failed" });
          }
        } catch (e) {
          patch({ busy: false, error: e && e.code === "consent_required" ? "consent" : "failed" });
        }
      },
      () => patch({ busy: false, error: "location" }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  }, [api, consent.ask]);

  const goOffline = useCallback(async () => {
    patch({ busy: true, error: null });
    try { await api.setAvailability(false, null, null); } catch (_) {}
    sent.current = null;
    patch({ online: false, until: null, busy: false });
  }, [api]);

  // Withdrawing the live-location consent switches it off at once, here and
  // (the database deletes the position when it records the withdrawal) there.
  useEffect(() => {
    const onConsent = (e) => {
      if (e.detail && e.detail.purpose === "live" && !e.detail.granted) goOffline();
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [goOffline]);

  return { ...s, goOnline, goOffline };
}

// ----------------------------------------------------------------- screen
function timeOf(iso, lang) {
  try {
    return new Date(iso).toLocaleTimeString(lang === "en" ? "en-IN" : lang,
                                            { hour: "numeric", minute: "2-digit" });
  } catch (_) { return ""; }
}

export function WorkerHome({ avail, signedIn, hasListing, onSignIn, onList, onOpenListing, extra = null }) {
  const { t, lang } = useI18n();
  const [hours, setHours] = useState(4);
  const [, tick] = useState(0);

  // Re-render every 30 s so "updated 2 min ago" stays honest.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const wrap = (children) => (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 16px 40px" }}>{children}</div>
  );

  // Not yet a worker: the pitch, and the one step that makes them one.
  if (!signedIn) {
    return (
      <SignInGate art="worker" onSignIn={onSignIn} title={t("wk_title")} text={t("wk_pitch")}
                  perks={[[t("trust_2_t"), t("trust_2_s")], [t("trust_3_t"), t("trust_3_s")]]}>
        <SignupHelp style={{ margin: "14px 0 0" }} />
      </SignInGate>
    );
  }
  if (!hasListing) {
    return wrap(
      <div style={{
        background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>{t("wk_title")}</h1>
        <p style={{ fontSize: 14.5, color: T.inkSoft, lineHeight: 1.6, margin: "0 0 18px" }}>
          {t("wk_pitch")}
        </p>
        {signedIn
          ? <Btn full onClick={onList}>{t("nav_list")}</Btn>
          : <Btn full onClick={onSignIn}>{t("nav_signin")}</Btn>}
        {!signedIn && <SignupHelp style={{ margin: "14px 0 0" }} />}
      </div>
    );
  }

  const on = avail.online;
  const mins = avail.seenAt ? Math.max(0, Math.round((Date.now() - new Date(avail.seenAt)) / 60000)) : null;

  return wrap(
    <>
      <div style={{
        background: on ? T.greenSoft : T.white,
        border: `1.5px solid ${on ? "rgba(18,128,74,0.35)" : T.line}`,
        borderRadius: 18, padding: "26px 20px", textAlign: "center",
      }}>
        <div style={{
          width: 86, height: 86, borderRadius: "50%", margin: "0 auto 14px",
          background: on ? T.green : "#D5DAE0",
          boxShadow: on ? "0 0 0 10px rgba(18,128,74,0.15)" : "none",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
          transition: "all .2s",
        }}>
          <Icon name={on ? "check" : "user"} size={40} />
        </div>

        <div style={{ fontSize: 21, fontWeight: 800, color: on ? T.green : T.ink }}>
          {on ? t("av_on") : t("av_off")}
        </div>
        <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.55, margin: "8px auto 18px", maxWidth: 380 }}>
          {on
            ? t("av_on_body").replace("{t}", avail.until ? timeOf(avail.until, lang) : "—")
            : t("av_off_body")}
        </p>

        {!on && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkFaint, marginBottom: 8 }}>
              {t("av_for")}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {HOURS_CHOICES.map((h) => (
                <button key={h} onClick={() => setHours(h)} style={{
                  minWidth: 64, minHeight: 42, borderRadius: 21, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  border: `1.5px solid ${hours === h ? T.brandDark : T.line}`,
                  background: hours === h ? T.brandSoft : T.white,
                  color: hours === h ? T.brandDeep : T.ink,
                }}>{t("av_hours").replace("{n}", String(h))}</button>
              ))}
            </div>
          </div>
        )}

        <Btn full kind={on ? "ghost" : "call"} disabled={avail.busy || !avail.loaded}
             onClick={() => (on ? avail.goOffline() : avail.goOnline(hours))}
             style={{ fontSize: 17, minHeight: 56 }}>
          {avail.busy ? t("au_working") : on ? t("av_stop") : t("av_go")}
        </Btn>

        {on && mins !== null && (
          <div style={{ fontSize: 12.5, color: T.inkFaint, marginTop: 12 }}>
            {mins < 1 ? t("av_seen_now") : t("av_seen").replace("{n}", String(mins))}
          </div>
        )}
      </div>

      {avail.error === "location" && <div style={{ marginTop: 14 }}><Notice tone="bad">{t("av_need_loc")}</Notice></div>}
      {avail.error === "consent" && <div style={{ marginTop: 14 }}><Notice tone="bad">{t("cs_server")}</Notice></div>}
      {avail.error && avail.error !== "location" && avail.error !== "consent" && (
        <div style={{ marginTop: 14 }}><Notice tone="bad">{t("e_save")}</Notice></div>
      )}
      {on && !avail.visible && (
        <div style={{ marginTop: 14 }}><Notice tone="info">{t("av_not_visible")}</Notice></div>
      )}

      {/* The one limit a worker must know, said once and plainly. */}
      <div style={{ marginTop: 14 }}>
        <Notice tone="info">{t("av_keep_open")}</Notice>
      </div>

      <div style={{ marginTop: 16 }}>
        <Btn full kind="ghost" onClick={onOpenListing}>
          <Icon name="edit" size={16} /> {t("nav_mine")}
        </Btn>
      </div>
      {extra}
    </>
  );
}

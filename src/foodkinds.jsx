// ---------------------------------------------------------------------------
// Each kind of food place is used differently: a caterer gets an enquiry, a
// tiffin kitchen a daily meal plan, a dhaba a call and directions. Both
// requests go through the booking flow the owner already answers from My
// requests, so nothing is paid in the app and no new table is needed.
// ---------------------------------------------------------------------------
import React, { useState } from "react";
import { T, Btn, Icon, Notice, input, CloseButton, useDismissable } from "./ui.jsx";
import { PlaceField } from "./locpicker.jsx";
import { useI18n } from "./i18n.jsx";

const one = (r) => (Array.isArray(r) ? r[0] : r);
const pad2 = (x) => String(x).padStart(2, "0");
const stamp = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const foodKind = (slug) =>
  slug === "catering-service" ? "catering"
  : slug === "tiffin-home-food" ? "tiffin"
  : slug === "bakery-sweets" ? "bakery"
  : slug === "dhaba-hotel" ? "dhaba" : "plain";

// ---- call, WhatsApp, directions: the number is revealed on tap, as elsewhere.
export function ContactRow({ api, row, user, onSignIn }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const go = async (how) => {
    if (!user || !user.id) { onSignIn && onSignIn(); return; }
    setBusy(true); setMsg(null);
    try {
      if (how === "dir") {
        const d = one(await api.directions(row.id));
        if (d && d.ok && typeof d.lat === "number") window.open(`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`, "_blank", "noopener");
        else setMsg(t("e_gone"));
      } else {
        const r = one(await api.reveal(row.id));
        if (r && r.ok) {
          const n = String(r.phone).replace(/[^\d+]/g, "");
          if (how === "call") window.location.href = `tel:${n}`;
          else window.open(`https://wa.me/${n.replace(/^\+/, "").replace(/^0+/, "").replace(/^(\d{10})$/, "91$1")}`, "_blank", "noopener");
        } else setMsg(r && r.reason === "phone_not_verified" ? t("pv_banner") : r && r.reason === "rate_limited" ? t("e_rate") : t("e_gone"));
      }
    } catch (e) { setMsg((e && e.message) || t("e_gone")); }
    setBusy(false);
  };
  const b = (bg, fg) => ({
    flex: 1, minHeight: 44, borderRadius: 12, border: bg === T.white ? `1.5px solid ${T.line}` : "none", background: bg, color: fg,
    fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  });
  return (
    <div style={{ margin: "0 0 12px" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={busy} onClick={() => go("call")} style={b("#0F8A3C", "#fff")}><Icon name="phone" size={17} /> {t("fk_call")}</button>
        <button disabled={busy} onClick={() => go("wa")} style={b("#128C7E", "#fff")}>{t("fk_wa")}</button>
        <button disabled={busy} onClick={() => go("dir")} style={b(T.white, T.brandDark)}><Icon name="crosshair" size={17} /> {t("fk_dir")}</button>
      </div>
      {msg && <div style={{ marginTop: 8 }}><Notice tone="bad">{msg}</Notice></div>}
    </div>
  );
}

const pill = (on) => ({
  border: `1.5px solid ${on ? T.brandDark : T.line}`, borderRadius: 18, padding: "8px 14px", minHeight: 42,
  background: on ? T.brandSoft : T.white, color: on ? T.brandDark : T.ink, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
});

// ---- daily meal plan (tiffin) or catering enquiry
export function RequestSheet({ api, row, kind, place, onClose }) {
  const { t } = useI18n();
  useDismissable(true, onClose);
  const tiffin = kind === "tiffin";
  const [meals, setMeals] = useState({ lunch: true });
  const [days, setDays] = useState(30);
  const [start, setStart] = useState(() => stamp(new Date(Date.now() + (tiffin ? 24 : 72) * 3600000)));
  const [addr, setAddr] = useState(() => (place && typeof place.lat === "number" ? place : null));
  const [event, setEvent] = useState("");
  const [people, setPeople] = useState("");
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sent, setSent] = useState(false);
  const addrText = addr ? (addr.address || addr.area || "") : "";
  const chosen = ["breakfast", "lunch", "dinner"].filter((m) => meals[m]);

  const send = async () => {
    setMsg(null);
    if (tiffin && !chosen.length) return setMsg(t("fk_need_meal"));
    if (!tiffin && (event.trim().length < 2 || !(Number(people) >= 1))) return setMsg(t("fk_need_ev"));
    const text = (tiffin
      ? `Daily meals: ${chosen.map((m) => m[0].toUpperCase() + m.slice(1)).join(" + ")} · ${days} days${addrText ? ` · Deliver to: ${addrText}` : ""}`
      : `Catering: ${event.trim()} · ${Number(people)} people${budget ? ` · Budget ₹${Number(budget)}` : ""}`)
      + (note.trim() ? ` · ${note.trim()}` : "");
    setBusy(true);
    try {
      const r = one(await api.bookingRequest(row.id, new Date(start).toISOString(), tiffin ? days * 1440 : 480, text.slice(0, 300)));
      if (r && r.ok) setSent(true);
      else setMsg(r && r.reason === "already_open" ? t("bk_open") : t("e_save"));
    } catch (e) { setMsg((e && e.message) || t("e_save")); }
    setBusy(false);
  };
  const lab = { fontSize: 14, fontWeight: 700, margin: "10px 0 6px", color: T.ink };
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{ position: "fixed", inset: 0, zIndex: 560, background: "rgba(15,20,25,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, padding: "14px 18px 24px", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 800, margin: 0, color: T.ink }}>{t(tiffin ? "fk_plan_title" : "fk_cat_title")}</h1>
          <CloseButton onClick={onClose} />
        </div>
        {sent ? (
          <div style={{ marginTop: 12 }}><Notice tone="good">{t("fk_sent")}</Notice></div>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6 }}>{t(tiffin ? "fk_plan_sub" : "fk_cat_sub")}</p>
            {tiffin ? (
              <>
                <div style={lab}>{t("fk_meals")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[["breakfast", "fk_b"], ["lunch", "fk_l"], ["dinner", "fk_d"]].map(([k, key]) => (
                    <button key={k} aria-pressed={!!meals[k]} onClick={() => setMeals((m) => ({ ...m, [k]: !m[k] }))} style={pill(!!meals[k])}>{t(key)}</button>
                  ))}
                </div>
                <div style={lab}>{t("fk_length")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[7, 15, 30, 90].map((n) => (
                    <button key={n} aria-pressed={days === n} onClick={() => setDays(n)} style={pill(days === n)}>{String(t("fk_days")).replace("{n}", n)}</button>
                  ))}
                </div>
                <div style={lab}>{t("fk_addr")}</div>
                <PlaceField value={addr} onChange={setAddr} sheetPlace={addr || place} />
              </>
            ) : (
              <>
                <input style={{ ...input, marginBottom: 8 }} value={event} maxLength={60} placeholder={t("fk_event")} aria-label={t("fk_event")} onChange={(e) => setEvent(e.target.value)} />
                <input style={{ ...input, marginBottom: 8 }} value={people} inputMode="numeric" maxLength={5} placeholder={t("fk_people")} aria-label={t("fk_people")} onChange={(e) => setPeople(e.target.value.replace(/\D/g, ""))} />
                <input style={{ ...input, marginBottom: 8 }} value={budget} inputMode="numeric" maxLength={8} placeholder={t("fk_budget")} aria-label={t("fk_budget")} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} />
              </>
            )}
            <div style={lab}>{t(tiffin ? "fk_start" : "fk_when")}</div>
            <input type="datetime-local" min={stamp(new Date())} value={start} onChange={(e) => setStart(e.target.value)} style={{ ...input, marginBottom: 10 }} />
            <input style={{ ...input, marginBottom: 12 }} value={note} maxLength={100} placeholder={t("bk_note")} aria-label={t("bk_note")} onChange={(e) => setNote(e.target.value)} />
            {msg && <div style={{ marginBottom: 10 }}><Notice tone="bad">{msg}</Notice></div>}
            <Btn full disabled={busy || !start} onClick={send}>{busy ? "…" : t("fk_send")}</Btn>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FIRST SCREENS, after the language: "I need something" or "I offer
// something"; and for those who offer, what they offer. Each choice is
// remembered, so these show once.
// ---------------------------------------------------------------------------
import React, { useState, useEffect } from "react";
import { T, Icon, groupStyle, groupLabel, VoiceButton, Hero } from "./ui.jsx";
import { useI18n, tradeName } from "./i18n.jsx";
import { TileArt } from "./scenes.jsx";
import { tradeIcon, vividFor } from "./tradeicons.js";
export { tradeIcon, vividFor };

// Centred both ways: on a wide screen the choices sit in the middle, not in a
// corner, and on a phone they still start at the top when they do not fit.
const shell = {
  position: "fixed", inset: 0, zIndex: 420, overflowY: "auto",
  background: "linear-gradient(160deg, #F4F8FF 0%, #FFFFFF 55%, #FFF7EC 100%)",
  display: "flex", justifyContent: "center", alignItems: "safe center",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};
const wrap = { width: "100%", maxWidth: 520, margin: "auto", padding: "28px 18px 34px", boxSizing: "border-box" };

function BigChoice({ icon, bg, fg, title, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 14, textAlign: "left",
      minHeight: 88, padding: "14px 16px", marginBottom: 12, borderRadius: 18,
      border: `1px solid ${T.line}`, background: T.white, cursor: "pointer", fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(15,20,25,0.05)",
    }}>
      <span style={{
        width: 54, height: 54, borderRadius: 16, background: bg, color: fg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><Icon name={icon} size={28} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 17.5, fontWeight: 800, color: T.ink, lineHeight: 1.25 }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 13.5, color: T.inkSoft, lineHeight: 1.45, marginTop: 3 }}>{sub}</span>}
      </span>
      <Icon name="chev" size={20} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
    </button>
  );
}

// Screen 1: who are you today.
export function StartGate({ onNeed, onOffer }) {
  const { t } = useI18n();
  return (
    <div style={shell} role="dialog" aria-modal="true">
      <div style={wrap}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: T.ink, margin: "0 0 22px", lineHeight: 1.25, textAlign: "center" }}>{t("start_title")}</h1>
        <BigChoice icon="search" bg="#E8F1FF" fg="#1D4ED8" title={t("start_need")} sub={t("start_need_sub")} onClick={onNeed} />
        <BigChoice icon="construction" bg="#FFF1E6" fg="#B45309" title={t("start_offer")} sub={t("start_offer_sub")} onClick={onOffer} />
      </div>
    </div>
  );
}

// Screen 2, for people who offer: what kind of business is it.
export function OfferTypeGate({ onPick, onBack, inline = false, trades = [] }) {
  const { t, lang } = useI18n();
  const [type, setType] = useState(null);
  const [oq, setOq] = useState("");
  const [grp, setGrp] = useState(null);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 600);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 600);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const types = [
    ["worker", "construction", "#FFF1E6", "#C2410C", "home_worker", "offer_sub_worker"],
    ["ride", "drivers", "#E8F0FE", "#1D4ED8", "home_ride", "offer_sub_ride"],
    ["hire", "drivers", "#FEF3C7", "#B45309", "offer_hire", "offer_sub_hire"],
    ["delivery", "drivers", "#E0F2FE", "#0369A1", "offer_delivery", "offer_sub_delivery"],
    ["shop", "suppliers", "#E7F5EC", "#15803D", "home_shop", "offer_sub_shop"],
    ["eat", "food", "#FDF3DC", "#A16207", "home_eat", "offer_sub_eat"],
    ["sell", "tag", "#F3E8FD", "#7E22CE", "offer_sell", "offer_sub_sell"],
  ].filter((x) => x[0] !== "hire" || tradesFor("hire", trades).length > 0).filter((x) => x[0] !== "delivery" || tradesFor("delivery", trades).length > 0);
  // Second step, like the Worker screen on the other side: what exactly do you do.
  const picking = type && tradesFor(type, trades).length > 0 ? type : null;
  const step2 = picking && (() => {
    const list = tradesFor(picking, trades);
    const meta = types.find((x) => x[0] === picking);
    const byGroup = [];
    list.forEach((x) => {
      let g = byGroup.find((y) => y.g === x.group_name);
      if (!g) { g = { g: x.group_name, items: [] }; byGroup.push(g); }
      g.items.push({ key: x.slug, label: picking === "ride" || picking === "hire" ? vehicleLabel(x, lang) : tradeName(x, lang), icon: tradeIcon(x, groupStyle(x.group_name).icon) });
    });
    const searching = oq.trim().length > 0;
    // Worker or Helper has many trades: pick the kind of work first, like the
    // other side does, then the exact trade.
    if (picking === "worker" && byGroup.length > 1 && !grp && !searching) {
      return (
        <>
          <TileArt k={picking} pos="center top" style={{ borderRadius: 14, aspectRatio: "2 / 1", maxHeight: 240, marginBottom: 14 }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "0 0 4px" }}>{t(meta[4])}</h2>
          <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 14px" }}>{t("offer_what")}</p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {byGroup.map((g) => {
              const st = groupStyle(g.g);
              return (
                <button key={g.g} onClick={() => setGrp(g.g)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 10px 14px", borderRadius: 14,
                  border: `1px solid ${T.line}`, background: T.white, cursor: "pointer", fontFamily: "inherit",
                }}>
                  <span style={{ width: 58, height: 58, borderRadius: "50%", background: st.fg, color: "#fff", display: "flex",
                                 alignItems: "center", justifyContent: "center", boxShadow: `0 4px 10px ${st.fg}44` }}>
                    <Icon name={st.icon} size={28} />
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{groupLabel(g.g, lang)}</span>
                  <span style={{ fontSize: 12.5, color: T.inkSoft }}>{g.items.length}</span>
                </button>
              );
            })}
          </div>
        </>
      );
    }
    const shown = grp && !searching ? byGroup.filter((g) => g.g === grp) : byGroup;
    return (
      <SubCategories
        art={grp && !searching ? null : picking} title={grp && !searching ? groupLabel(grp, lang) : t(meta[4])}
        sub={t(picking === "ride" || picking === "hire" ? "offer_which" : "offer_what")} query={oq}
        sections={shown.map((g) => ({ title: shown.length > 1 ? groupLabel(g.g, lang) : null, items: g.items,
                                      icon: groupStyle(g.g).icon, fg: groupStyle(g.g).fg, bg: groupStyle(g.g).bg }))}
        onPick={(slug) => onPick(picking === "hire" ? "ride" : picking, slug)} />
    );
  })();
  const meta2 = picking && types.find((x) => x[0] === picking);
  const body = picking ? (
    <div style={{ width: "100%" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "10px 16px 0" }}>
        <button onClick={() => { if (grp) { setGrp(null); setOq(""); } else { setType(null); setOq(""); } }} style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: T.white, border: `1px solid ${T.line}`, borderRadius: 20,
          padding: "7px 14px", minHeight: 40, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: T.brandDark,
        }}><Icon name="back" size={16} /> {t("w_back")}</button>
      </div>
      <Hero search={oq} setSearch={setOq} onVoice={setOq} tone={picking} title={t(meta2[4])} sub={t(picking === "ride" || picking === "hire" ? "offer_which" : "offer_what")} placeholder={t("st_search")} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "62px 16px 120px" }}>{step2}</div>
    </div>
  ) : (
    <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: inline ? "26px 16px 120px" : "20px 16px 34px", boxSizing: "border-box" }}>
      <button onClick={() => (picking ? setType(null) : onBack())} style={{
        display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: "4px 0",
        color: T.brandDark, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 40, marginBottom: 6,
      }}><Icon name="back" size={16} /> {t("w_back")}</button>
      {step2 || (<>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "0 0 18px", lineHeight: 1.25 }}>{t("offer_title")}</h1>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${wide ? 3 : 2}, 1fr)`, gap: 12 }}>
        {types.map(([key, icon, bg, fg, title, sub]) => (
          <button key={key} onClick={() => (key === "delivery" ? onPick("ride", tradesFor("delivery", trades)[0].slug) : key === "worker" || key === "shop" || key === "eat" || key === "ride" || key === "hire" ? setType(key) : onPick(key))} style={{
            display: "flex", flexDirection: "column", alignItems: "stretch", textAlign: "left", padding: 0, overflow: "hidden",
            borderRadius: 14, border: `1px solid ${T.line}`, background: T.white, cursor: "pointer", fontFamily: "inherit",
          }}>
            <TileArt k={key === "hire" || key === "delivery" ? "ride" : key} />
            <span style={{ display: "block", padding: "11px 13px 13px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: fg, color: "#fff", flexShrink: 0,
                               display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} /></span>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>{t(title)}</span>
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4, marginTop: 6 }}>{t(sub)}</span>
            </span>
          </button>
        ))}
      </div>
      </>)}
    </div>
  );
  if (inline) return body;
  return <div style={shell} role="dialog" aria-modal="true">{body}</div>;
}


// THE FRONT OF THE APP for somebody who needs something: six plain tiles,
// a line icon on a soft tint, a title and one line under it. Each opens its
// own screen. Deliberately flat -- no gradients, no pictures.
const TILES = [
  ["worker", "construction", "#C2410C", "#FFF1E6", "home_worker", "offer_sub_worker", "worker"],
  ["ride", "drivers", "#1D4ED8", "#E8F0FE", "home_ride", "offer_sub_ride", "need-ride"],
  ["shop", "suppliers", "#15803D", "#E7F5EC", "home_shop", "offer_sub_shop", "shop"],
  ["eat", "food", "#A16207", "#FDF3DC", "home_eat", "offer_sub_eat", "need-eat"],
  ["market", "tag", "#7E22CE", "#F3E8FD", "need_buy", "need_buy_sub", "need-market"],
  ["partner", "user", "#0F766E", "#E3F4F2", "home_partner", "home_partner_sub", "partner"],
];

// The small "back to home" pill at the top of every screen that opens from the front.
export function HomeButton({ onClick, label }) {
  const { t } = useI18n();
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, background: T.white, border: `1px solid ${T.line}`,
      borderRadius: 20, padding: "7px 14px", minHeight: 40, cursor: "pointer", fontFamily: "inherit",
      fontSize: 14, fontWeight: 700, color: T.brandDark,
    }}><Icon name="back" size={16} /> {label || t("launch_back")}</button>
  );
}

export function CustomerLauncher({ onPick, onOffer, hasBusiness = false, liveNow = [], onLive }) {
  const { t } = useI18n();
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 600);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 600);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return (
    <div style={{ padding: "22px 16px 120px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        {liveNow.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 8px" }}>{t("hm_continue")}</div>
            {liveNow.map((x, i) => (
              <button key={i} onClick={() => onLive && onLive(x.go)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", minHeight: 62, padding: "10px 14px", marginBottom: 8,
                borderRadius: 14, border: "1.5px solid #1FA85A", background: "#F0FAF4", cursor: "pointer", fontFamily: "inherit",
              }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "#1FA85A", color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={x.icon} size={20} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: T.ink }}>{x.title}</span>
                  <span style={{ display: "block", fontSize: 13.5, color: "#157A43", fontWeight: 700 }}>{x.sub}</span>
                </span>
                <Icon name="chev" size={18} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
              </button>
            ))}
          </div>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "0 0 14px", lineHeight: 1.25 }}>{t("launch_title")}</h1>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${wide ? 3 : 2}, 1fr)`, gap: 12 }}>
          {TILES.filter((x) => x[0] !== "partner").map(([key, icon, fg, bg, label, sub, art]) => (
            <button key={key} onClick={() => onPick(key)} style={{
              display: "flex", flexDirection: "column", alignItems: "stretch", textAlign: "left",
              padding: 0, overflow: "hidden", borderRadius: 14, border: `1px solid ${T.line}`, background: T.white,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <TileArt k={art} />
              <span style={{ display: "block", padding: "11px 13px 13px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 9, color: "#fff", background: fg, flexShrink: 0,
                                 display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={18} /></span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>{t(label)}</span>
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4, marginTop: 6 }}>{t(sub)}</span>
              </span>
            </button>
          ))}
        </div>
        <button onClick={onOffer} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14, textAlign: "left", minHeight: 76, padding: "12px 16px", marginTop: 16,
          borderRadius: 16, border: "1.5px dashed #C2410C", background: "#FFF7EC", cursor: "pointer", fontFamily: "inherit",
        }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, background: "#C2410C", color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={hasBusiness ? "construction" : "edit"} size={22} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 17, fontWeight: 800, color: T.ink }}>{hasBusiness ? t("hm_mybiz") : t("hm_earn")}</span>
            <span style={{ display: "block", fontSize: 13.5, color: T.inkSoft, lineHeight: 1.4, marginTop: 2 }}>{hasBusiness ? t("hm_mybiz_sub") : t("hm_earn_sub")}</span>
          </span>
          <Icon name="chev" size={18} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
        </button>
      </div>
    </div>
  );
}

// What a signed-out visitor sees on a page that needs an account: a banner,
// what they get, and one clear Sign in button. Nothing pops up by itself.
export function SignInGate({ art, title, text, onBack, onSignIn, perks = [], note = null, children = null }) {
  const { t } = useI18n();
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "10px 16px 60px" }}>
      {onBack && <HomeButton onClick={onBack} label={t("w_back")} />}
      {art && <TileArt k={art} pos="center top" style={{ borderRadius: 14, aspectRatio: "2 / 1", maxHeight: 260, margin: "12px 0 16px" }} />}
      <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: "20px 20px 22px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "0 0 6px" }}>{title}</h1>
        {text && <p style={{ fontSize: 15, color: T.inkSoft, lineHeight: 1.6, margin: "0 0 14px" }}>{text}</p>}
        {note}
        {perks.map(([a, b]) => (
          <div key={a} style={{ display: "flex", gap: 12, alignItems: "flex-start", margin: "0 0 12px" }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: "#16A34A", color: "#fff", flexShrink: 0,
                           display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={20} /></span>
            <span><span style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.ink }}>{a}</span>
                  <span style={{ display: "block", fontSize: 13.5, color: T.inkSoft }}>{b}</span></span>
          </div>
        ))}
        <button onClick={onSignIn} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 52, marginTop: 8,
          border: "none", borderRadius: 12, background: T.brand, color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
        }}><Icon name="user" size={19} /> {t("nav_signin")}</button>
        {children}
      </div>
    </div>
  );
}

// A search box with the microphone, like the one on the Worker screen.
export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: "4px 6px 4px 14px", margin: "0 0 14px" }}>
      <Icon name="search" size={19} style={{ color: T.inkFaint }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
             style={{ flex: 1, border: "none", outline: "none", fontSize: 16, minHeight: 44, background: "transparent", fontFamily: "inherit", minWidth: 0 }} />
      {value && (
        <button onClick={() => onChange("")} aria-label="Clear" style={{ border: "none", background: "none", cursor: "pointer", color: T.inkFaint, width: 36, height: 44 }}>
          <Icon name="close" size={18} />
        </button>
      )}
      <VoiceButton onHeard={onChange} />
    </div>
  );
}

// Which trades belong to which front tile, so every screen agrees.
const NOT_WORKER = ["Drivers", "Suppliers", "Eat & Stay"];
// "Car driver" -> "Car": the customer is choosing a vehicle, and the owner is
// saying which vehicle they have, so the word driver or operator is dropped.
export function vehicleLabel(tr, lang) {
  const n = tradeName(tr, lang);
  if (lang !== "en" && lang) return n;
  return String(n).replace(/\s+(driver|operator)\b/i, "");
}

// The Drivers group holds three different services: the rides (bike taxi,
// taxi / cab, auto), vehicles and machines for hire for work, and the delivery
// rider. A plain "car driver" is none of them and is not offered.
export function driverKind(x) {
  const k = `${x.slug || ""} ${x.name_en || ""}`.toLowerCase();
  if (/deliver/.test(k)) return "delivery";
  if (/taxi|cab/.test(k)) return "travel";
  if (/bike|moto|auto|rick|toto/.test(k)) return "travel";
  if (/\bcar\b/.test(k)) return "car";
  return "hire";
}

export function tradesFor(kind, trades) {
  if (kind === "ride") return trades.filter((x) => x.group_name === "Drivers" && driverKind(x) === "travel");
  if (kind === "hire") return trades.filter((x) => x.group_name === "Drivers" && driverKind(x) === "hire");
  if (kind === "delivery") return trades.filter((x) => x.group_name === "Drivers" && driverKind(x) === "delivery");
  if (kind === "eat") return trades.filter((x) => x.group_name === "Eat & Stay");
  if (kind === "shop") return trades.filter((x) => (x.kind === "supplier" || x.group_name === "Suppliers") && x.group_name !== "Eat & Stay");
  return trades.filter((x) => x.kind !== "supplier" && !NOT_WORKER.includes(x.group_name));
}

// WHAT DO YOU NEED / WHAT DO YOU OFFER, for the app somebody chose: only that
// app's own sub-categories, as plain rows with a line icon (or an emoji for
// the items). No illustrations. Optional banner on top; optional sections.
export function SubCategories({ title, sub, icon, fg, bg, items, sections, onPick, onAll, allLabel, art, searchPh, query = null }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const needle = (query !== null ? query : q).trim().toLowerCase();
  const secs = (sections || [{ items }]).map((sc) => ({ ...sc, items: needle ? sc.items.filter((it) => String(it.label).toLowerCase().includes(needle)) : sc.items })).filter((sc) => sc.items.length);
  return (
    <div>
      {art && <TileArt k={art} pos="center top" style={{ borderRadius: 14, aspectRatio: "2 / 1", maxHeight: 240, marginBottom: 14 }} />}
      {title && <h2 style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "0 0 4px" }}>{title}</h2>}
      {title && <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 14px" }}>{sub || t("what_need")}</p>}
      {searchPh && query === null && <SearchBox value={q} onChange={setQ} placeholder={searchPh} />}
      {onAll && !needle && (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", marginBottom: 10 }}>
          <button onClick={onAll} style={tileStyle(T.brandSoft, T.brandDark)}>
            <span style={iconBox(T.brandDark, "#fff")}><Icon name="search" size={22} /></span>
            <span style={labelStyle}>{allLabel}</span>
          </button>
        </div>
      )}
      {secs.map((sec, si) => (
        <div key={si} style={{ marginBottom: 14 }}>
          {sec.title && <div style={{ fontSize: 13, fontWeight: 800, color: T.inkSoft, margin: "6px 0 8px", textTransform: "uppercase", letterSpacing: 0.3 }}>{sec.title}</div>}
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {sec.items.map((it) => (
              <button key={it.key} onClick={() => onPick(it.key)} style={tileStyle(T.white, T.line)}>
                <span style={iconBox(it.emoji ? "#F3E8FD" : vividFor(it.key || it.label), "#fff")}>
                  {it.emoji ? <span style={{ fontSize: 21 }}>{it.emoji}</span> : <Icon name={it.icon || sec.icon || icon} size={22} />}
                </span>
                <span style={labelStyle}>{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
const tileStyle = (bg, line) => ({
  display: "flex", alignItems: "center", gap: 9, textAlign: "left", padding: "12px 9px", minHeight: 62,
  borderRadius: 12, border: `1px solid ${line}`, background: bg, cursor: "pointer", fontFamily: "inherit",
});
const iconBox = (bg, fg) => ({
  width: 42, height: 42, borderRadius: 11, background: bg, color: fg, flexShrink: 0, boxShadow: "0 3px 8px rgba(15,20,25,0.18)",
  display: "flex", alignItems: "center", justifyContent: "center",
});
const labelStyle = { fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.25, minWidth: 0, overflowWrap: "break-word" };

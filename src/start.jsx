// ---------------------------------------------------------------------------
// FIRST SCREENS, after the language: "I need something" or "I offer
// something"; and for those who offer, what they offer. Each choice is
// remembered, so these show once.
// ---------------------------------------------------------------------------
import React, { useState, useEffect } from "react";
import { T, Icon } from "./ui.jsx";
import { useI18n } from "./i18n.jsx";
import { TileArt } from "./scenes.jsx";

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
export function OfferTypeGate({ onPick, onBack }) {
  const { t } = useI18n();
  const types = [
    ["worker", "construction", "#FFF1E6", "#B45309", t("home_worker"), t("offer_sub_worker")],
    ["ride", "drivers", "#E8F1FF", "#1D4ED8", t("home_ride"), t("offer_sub_ride")],
    ["shop", "suppliers", "#EAF7EE", "#15803D", t("home_shop"), t("offer_sub_shop")],
    ["eat", "food", "#FFF4D6", "#A16207", t("home_eat"), t("offer_sub_eat")],
    ["sell", "tag", "#F3E8FF", "#7E22CE", t("mk_my_ads"), t("offer_sub_sell")],
  ];
  return (
    <div style={shell} role="dialog" aria-modal="true">
      <div style={wrap}>
        <button onClick={onBack} style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
          color: T.brandDark, fontSize: 15, fontWeight: 700, cursor: "pointer", padding: "6px 0",
          fontFamily: "inherit", minHeight: 44,
        }}><Icon name="back" size={18} /> {t("w_back")}</button>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, margin: "4px 0 20px", lineHeight: 1.25, textAlign: "center" }}>{t("offer_title")}</h1>
        {types.map(([key, icon, bg, fg, title, sub]) => (
          <button key={key} onClick={() => onPick(key)} style={{
            width: "100%", display: "block", padding: 0, marginBottom: 12, overflow: "hidden", textAlign: "left",
            borderRadius: 14, border: `1px solid ${T.line}`, background: T.white, cursor: "pointer", fontFamily: "inherit",
          }}>
            <TileArt k={key} style={{ aspectRatio: "21 / 8" }} />
            <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px 12px" }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: bg, color: fg, flexShrink: 0,
                             display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={18} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: T.ink }}>{title}</span>
                <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4 }}>{sub}</span>
              </span>
              <Icon name="chev" size={18} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}


// THE FRONT OF THE APP for somebody who needs something: six plain tiles,
// a line icon on a soft tint, a title and one line under it. Each opens its
// own screen. Deliberately flat -- no gradients, no pictures.
const TILES = [
  ["worker", "construction", "#C2410C", "#FFF1E6", "home_worker", "offer_sub_worker"],
  ["ride", "drivers", "#1D4ED8", "#E8F0FE", "home_ride", "offer_sub_ride"],
  ["shop", "suppliers", "#15803D", "#E7F5EC", "home_shop", "offer_sub_shop"],
  ["eat", "food", "#A16207", "#FDF3DC", "home_eat", "offer_sub_eat"],
  ["market", "tag", "#7E22CE", "#F3E8FD", "mk_tab", "mk_tab_sub"],
  ["partner", "user", "#0F766E", "#E3F4F2", "home_partner", "home_partner_sub"],
];

export function CustomerLauncher({ onPick, onOffer, side, setSide }) {
  const { t } = useI18n();
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 600);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 600);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  if (!side) {
    const cards = [
      ["need", "mode_need", "start_need_sub", "search", "#1D4ED8", "#E8F0FE", () => setSide("need")],
      ["offer", "mode_offer", "start_offer_sub", "edit", "#C2410C", "#FFF1E6", onOffer],
    ];
    return (
      <div style={{ minHeight: "calc(100vh - 170px)", display: "flex", flexDirection: "column", justifyContent: "center",
                    padding: "26px 16px 110px", boxSizing: "border-box" }}>
        <div style={{ width: "100%", maxWidth: 820, margin: "0 auto" }}>
          <h1 style={{ fontSize: wide ? 30 : 25, fontWeight: 800, color: T.ink, margin: "0 0 6px", lineHeight: 1.25, textAlign: "center" }}>{t("start_title")}</h1>
          <p style={{ fontSize: 14.5, color: T.inkSoft, margin: "0 0 20px", textAlign: "center" }}>{t("trust_2_s")}</p>
          <div style={{ display: "grid", gridTemplateColumns: wide ? "1fr 1fr" : "1fr", gap: 16 }}>
            {cards.map(([k, title, sub, icon, fg, bg, go]) => (
              <button key={k} onClick={go} style={{
                display: "block", padding: 0, overflow: "hidden", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                borderRadius: 18, border: `1px solid ${T.line}`, background: T.white, boxShadow: "0 6px 20px rgba(15,20,25,0.07)",
              }}>
                <TileArt k={k} style={{ aspectRatio: wide ? "16 / 9" : "21 / 9" }} />
                <span style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 16px" }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: bg, color: fg, flexShrink: 0,
                                 display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={22} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 19, fontWeight: 800, color: T.ink }}>{t(title)}</span>
                    <span style={{ display: "block", fontSize: 13, color: T.inkSoft, lineHeight: 1.45, marginTop: 2 }}>{t(sub)}</span>
                  </span>
                  <Icon name="chev" size={20} style={{ color: T.inkFaint, transform: "rotate(-90deg)" }} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: "26px 16px 120px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <button onClick={() => setSide(null)} style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: "4px 0",
          color: T.brandDark, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 40, marginBottom: 6,
        }}><Icon name="back" size={16} /> {t("launch_back")}</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "0 0 18px", lineHeight: 1.25 }}>
          {t("launch_title")}
        </h1>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${wide ? 3 : 2}, 1fr)`, gap: 12 }}>
          {TILES.map(([key, icon, fg, bg, label, sub]) => (
            <button key={key} onClick={() => onPick(key)} style={{
              display: "flex", flexDirection: "column", alignItems: "stretch", textAlign: "left",
              padding: 0, overflow: "hidden", borderRadius: 14, border: `1px solid ${T.line}`, background: T.white,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <TileArt k={key} />
              <span style={{ display: "block", padding: "11px 13px 13px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, color: fg, background: bg, flexShrink: 0,
                                 display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} /></span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>{t(label)}</span>
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4, marginTop: 6 }}>{t(sub)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// WHAT DO YOU NEED, for the app somebody chose: only that app's own
// sub-categories, as plain rows with a line icon. No illustrations.
export function SubCategories({ title, icon, fg, bg, items, onPick, onAll, allLabel, art }) {
  const { t } = useI18n();
  return (
    <div>
      {art && <TileArt k={art} style={{ borderRadius: 14, aspectRatio: "21 / 8", marginBottom: 14 }} />}
      <h2 style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "0 0 4px" }}>{title}</h2>
      <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 14px" }}>{t("what_need")}</p>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {onAll && (
          <button onClick={onAll} style={tileStyle(T.brandSoft, T.brandDark)}>
            <span style={iconBox(T.white, T.brandDark)}><Icon name="search" size={20} /></span>
            <span style={labelStyle}>{allLabel}</span>
          </button>
        )}
        {items.map((it) => (
          <button key={it.key} onClick={() => onPick(it.key)} style={tileStyle(T.white, T.line)}>
            <span style={iconBox(bg, fg)}><Icon name={it.icon || icon} size={20} /></span>
            <span style={labelStyle}>{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
const tileStyle = (bg, line) => ({
  display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "12px 12px", minHeight: 62,
  borderRadius: 12, border: `1px solid ${line}`, background: bg, cursor: "pointer", fontFamily: "inherit",
});
const iconBox = (bg, fg) => ({
  width: 38, height: 38, borderRadius: 10, background: bg, color: fg, flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
});
const labelStyle = { fontSize: 14.5, fontWeight: 700, color: T.ink, lineHeight: 1.25, minWidth: 0 };
